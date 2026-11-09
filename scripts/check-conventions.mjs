#!/usr/bin/env node
/**
 * Conventions gate — enforces the machine-checkable rules from docs/13-coding-rules.md.
 *
 * Run with: npm run check:conventions
 *
 * Implemented here: R1 (file size), R2 (controllers never reach the data layer),
 * R5 (single client entry point), R6 (no environment reads in feature code),
 * R10 (no cross-module repository or controller imports).
 *
 * The rest of the rulebook needs judgement and is reviewed, not scripted.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Rule R1 — no source file may grow past this many lines. */
export const MAX_LINES = 300;

/** Rule R1 — must stay empty. Adding an entry postpones a split; argue it in docs/13. */
const LINE_COUNT_EXEMPT = new Set([]);

/** Rule R2 — controllers that may touch the database, with the reason. */
const CONTROLLER_DB_ALLOWED = new Set([
  // Readiness must ping the database; it returns no tenant data.
  'apps/api/src/modules/health/health.controller.ts',
]);

const SOURCE_ROOTS = ['apps/api/src', 'apps/web/src', 'packages/shared/src'];

const SKIP_DIRS = new Set(['node_modules', 'generated', 'dist', 'coverage']);

const DB_ACCESS_DIRS = ['apps/api/src/database'];
const DB_ACCESS_FILES = ['apps/api/prisma/seed.ts'];
const ENV_ACCESS_DIRS = ['apps/api/src/config'];
const ENV_ACCESS_FILES = [
  'apps/api/prisma/seed.ts',
  'apps/api/prisma.config.ts',
  // Integration test: needs the owner and app database URLs, not application config.
  'apps/api/src/database/tenant-isolation.spec.ts',
  'apps/api/src/jobs/mail-queue.integration.spec.ts',
];

const MODULE_PATH = /^apps\/api\/src\/modules\/([^/]+)\//;
const INTERNAL_LAYER =
  /^apps\/api\/src\/modules\/([^/]+)\/(?:[^/]+\/)*[^/]+\.(repository|controller)$/;

const IMPORT_SPECIFIER = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;

function toPosix(path) {
  return path.split(sep).join('/');
}

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      return SKIP_DIRS.has(entry.name) ? [] : walk(full);
    }

    if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.endsWith('.d.ts')) {
      return [];
    }

    return [full];
  });
}

function countLines(source) {
  const lines = source.split('\n');
  return source.endsWith('\n') ? lines.length - 1 : lines.length;
}

function isUnder(relPath, roots) {
  return roots.some((root) => relPath.startsWith(`${root}/`));
}

function checkFileLength(relPath, source, errors, warnings) {
  const lines = countLines(source);

  if (lines <= MAX_LINES) {
    if (lines > MAX_LINES * 0.9) {
      warnings.push(
        `${relPath} is ${lines} lines — split it before adding more (limit ${MAX_LINES}).`,
      );
    }
    return;
  }

  if (LINE_COUNT_EXEMPT.has(relPath)) {
    warnings.push(
      `${relPath} is ${lines} lines and is exempt: extract a layer before adding anything.`,
    );
    return;
  }

  errors.push(`${relPath} is ${lines} lines, over the ${MAX_LINES}-line limit (see R1).`);
}

function checkControllerDatabaseAccess(relPath, source, errors) {
  if (!relPath.endsWith('.controller.ts') || CONTROLLER_DB_ALLOWED.has(relPath)) {
    return;
  }

  if (/from\s+['"][^'"]*\/database\//.test(source) || /\bPrismaService\b/.test(source)) {
    errors.push(`${relPath} reaches the data layer directly; go through a service (see R2).`);
  }
}

function checkDatabaseImports(relPath, source, errors) {
  if (isUnder(relPath, DB_ACCESS_DIRS) || DB_ACCESS_FILES.includes(relPath)) {
    return;
  }

  if (/from\s+['"][^'"]*generated\/prisma|from\s+['"]@prisma\/client['"]/.test(source)) {
    errors.push(`${relPath} imports the generated client; use the single entry point (see R5).`);
  }
}

function checkEnvironmentAccess(relPath, source, errors) {
  if (isUnder(relPath, ENV_ACCESS_DIRS) || ENV_ACCESS_FILES.includes(relPath)) {
    return;
  }

  if (/process\.env/.test(source)) {
    errors.push(`${relPath} reads the environment directly; inject typed config (see R6).`);
  }
}

function checkCrossModuleAccess(relPath, source, errors) {
  const ownModule = MODULE_PATH.exec(relPath);
  if (!ownModule) {
    return;
  }

  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) {
      continue;
    }

    const resolved = posix.normalize(posix.join(posix.dirname(relPath), specifier));
    const target = INTERNAL_LAYER.exec(resolved);

    if (target && target[1] !== ownModule[1]) {
      errors.push(
        `${relPath} imports ${target[2]} from module "${target[1]}"; import its service instead (see R10).`,
      );
    }
  }
}

/**
 * Inspects a project tree and reports rule violations.
 * Returns { errors, warnings, files } so the gate itself can be tested.
 */
export function runConventions(root) {
  const errors = [];
  const warnings = [];

  const files = SOURCE_ROOTS.flatMap((rootDir) => walk(join(root, rootDir))).map((full) =>
    toPosix(relative(root, full)),
  );

  for (const relPath of files) {
    const source = readFileSync(join(root, relPath), 'utf8');

    checkFileLength(relPath, source, errors, warnings);
    checkControllerDatabaseAccess(relPath, source, errors);
    checkDatabaseImports(relPath, source, errors);
    checkEnvironmentAccess(relPath, source, errors);
    checkCrossModuleAccess(relPath, source, errors);
  }

  return { errors, warnings, files };
}

function report({ errors, warnings, files }) {
  for (const warning of warnings) {
    console.warn(`  warn  ${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`  fail  ${error}`);
    }
    console.error(`\n${errors.length} convention violation(s). See docs/13-coding-rules.md.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Conventions OK (${files.length} files checked, ${warnings.length} warning(s)).`);
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  report(runConventions(process.cwd()));
}
