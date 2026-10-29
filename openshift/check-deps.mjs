// Exit 0 only if no package that serves requests in production has a critical or high advisory
// against the version the app resolves (the top-level entry in bun.lock). Advisories against
// nested copies in test and build tooling are not failures.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const semver = require('semver');

const RUNTIME = ['next', 'next-auth', '@auth/core', '@auth/pg-adapter', 'axios', 'pg', 'js-yaml', 'bcryptjs', 'react', 'react-dom'];
const lock = readFileSync('bun.lock', 'utf8');
const topLevel = (pkg) => lock.match(new RegExp(`^    "${pkg}": \\["${pkg}@([^"]+)"`, 'm'))?.[1];

const run = spawnSync('bun', ['audit', '--json'], { encoding: 'utf8' });
const audit = JSON.parse(run.stdout || '{}');

let failed = false;
for (const pkg of RUNTIME) {
  const version = topLevel(pkg);
  if (!version) continue;
  for (const adv of audit[pkg] ?? []) {
    if (!['critical', 'high'].includes(adv.severity)) continue;
    if (semver.satisfies(version, adv.vulnerable_versions, { includePrerelease: true })) {
      failed = true;
      console.log(`${adv.severity.padEnd(8)} ${pkg}@${version}: ${adv.title.slice(0, 100)}`);
    }
  }
}
process.exit(failed ? 1 : 0);
