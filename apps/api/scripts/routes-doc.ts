/**
 * Rewrites the route table in docs/15-route-catalogue.md from the route catalogues.
 * Run after adding a route:  npx ts-node scripts/routes-doc.ts
 * (routes.spec.ts fails until the table matches.)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGUES } from '../src/common/routes/route-catalogues';

const lines = ['| Module | Method | Path | Capability | Handler |', '| --- | --- | --- | --- | --- |'];
for (const [moduleName, routes] of Object.entries(CATALOGUES)) {
  for (const route of routes) {
    const capability = route.capability === null ? '—' : `\`${route.capability}\``;
    lines.push(`| ${moduleName} | ${route.method} | \`${route.path}\` | ${capability} | \`${route.handler.controller.name}.${route.handler.method}\` |`);
  }
}

const file = join(__dirname, '..', '..', '..', 'docs', '15-route-catalogue.md');
const document = readFileSync(file, 'utf8');
const updated = document.replace(/(<!-- routes:start -->)[\s\S]*?(<!-- routes:end -->)/, `$1\n${lines.join('\n')}\n$2`);
writeFileSync(file, updated);
console.log(`Updated ${file} (${lines.length - 2} routes)`);
