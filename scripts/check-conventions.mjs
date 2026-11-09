#!/usr/bin/env node
/**
 * Conventions gate — enforces the checkable rules from docs/13-coding-rules.md.
 *
 * Run with: npm run check:conventions
 *
 * Only rules a machine can decide without judgement live here. The rest of the
 * rulebook is reviewed by humans and by the coding agent.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();

/** Rule R1 — no source file may grow past this many lines. */
const MAX_LINES = 300;

/** Files allowed to exceed the limit today. Shrink this list; never extend it. */
const LINE_COUNT_EXEMPT = new Set([
  'apps/api/src/modules/auth/auth.service.ts',
  'apps/api/src/modules/events/events.service.ts',
]);

/** Controllers that may touch the database, with the reason. */
const CONTROLLER_DB_ALLOWED = new Set([
  // Readiness must ping the database; it returns no tenant data.
  'apps/api/src/modules/health/health.controller.ts',
]);

const SOURCE_ROOTS = ['apps/api/src', 'apps/web/src', 'packages/shared/src'];

const SKIP_DIRS = new Set(['node_modules', 'generated', 'dist', 'coverage']);

const DB_ACCESS_DIRS = ['apps/api/src/database'];
const DB_ACCESS_FILES = ['apps/api/prisma/seed.ts'];
const ENV_ACCESS_DIRS = ['apps/api/src/config'];
const ENV_ACCESS_FILES = ['apps/api/prisma/seed.ts', 'apps/api/prisma.config.ts'];

const errors = [];
const warnings = [];

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

function checkFileLength(relPath, source) {
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
      `${relPath} is ${lines} lines and is on the shrink list: extract a layer before adding anything.`,
    );
    return;
  }

  errors.push(`${relPath} is ${lines} lines, over the ${MAX_LINES}-line limit (see R1).`);
}

function checkControllerDatabaseAccess(relPath, source) {
  if (!relPath.endsWith('.controller.ts') || CONTROLLER_DB_ALLOWED.has(relPath)) {
    return;
  }

  if (/from\s+['"][^'"]*\/database\//.test(source) || /\bPrismaService\b/.test(source)) {
    errors.push(`${relPath} reaches the database layer directly; go through a service (see R2).`);
  }
}

function checkDatabaseImports(relPath, source) {
  if (isUnder(relPath, DB_ACCESS_DIRS) || DB_ACCESS_FILES.includes(relPath)) {
    return;
  }

  if (/from\s+['"][^'"]*generated\/prisma|from\s+['"]@prisma\/client['"]/.test(source)) {
    errors.push(
      `${relPath} imports the generated database client; use the shared entry point (see R5).`,
    );
  }
}

function checkEnvironmentAccess(relPath, source) {
  if (isUnder(relPath, ENV_ACCESS_DIRS) || ENV_ACCESS_FILES.includes(relPath)) {
    return;
  }

  if (/process\.env/.test(source)) {
    errors.push(`${relPath} reads the environment directly; inject typed config (see R6).`);
  }
}

const files = SOURCE_ROOTS.flatMap((root) => walk(join(ROOT, root))).map((full) =>
  toPosix(relative(ROOT, full)),
);

for (const relPath of files) {
  const source = readFileSync(join(ROOT, relPath), 'utf8');

  checkFileLength(relPath, source);
  checkControllerDatabaseAccess(relPath, source);
  checkDatabaseImports(relPath, source);
  checkEnvironmentAccess(relPath, source);
}

for (const warning of warnings) {
  console.warn(`  warn  ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`  fail  ${error}`);
  }
  console.error(`\n${errors.length} convention violation(s). See docs/13-coding-rules.md.`);
  process.exit(1);
}

console.log(`Conventions OK (${files.length} files checked, ${warnings.length} warning(s)).`);
