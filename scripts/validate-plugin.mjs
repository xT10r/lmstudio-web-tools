import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

// Project checks, not a replacement for LM Studio's own manifest validation.
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const manifest = await readJson('manifest.json');
const pkg = await readJson('package.json');
const lock = await readJson('package-lock.json');

assert.equal(manifest.type, 'plugin', 'Expected an LM Studio plugin');
assert.equal(manifest.runner, 'node', 'This project uses the Node runner');
assert.match(manifest.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Plugin name must be kebab-case');
assert.ok(typeof manifest.owner === 'string' && manifest.owner.trim(), 'Plugin owner is required');
assert.ok(Number.isInteger(manifest.revision) && manifest.revision >= 0, 'Revision must be a non-negative integer');
assert.equal(pkg.name, manifest.name, 'Package and plugin names must match');
assert.equal(lock.name, pkg.name, 'Lockfile name must match');
assert.equal(lock.packages[''].name, pkg.name, 'Lockfile root name must match');
assert.equal(lock.packages[''].version, pkg.version, 'Lockfile version must match');
assert.ok(pkg.dependencies['@lmstudio/sdk'], 'LM Studio SDK dependency is required');
await access('src/index.ts');
await access('LICENSE');
console.log('Plugin metadata checks passed (Hub ownership and runtime compatibility are not checked).');
