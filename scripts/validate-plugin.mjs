import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

// Project checks, not a replacement for LM Studio's own manifest validation.
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const manifest = await readJson('manifest.json');
const pkg = await readJson('package.json');
const lock = await readJson('package-lock.json');
const runtime = (await readFile('.node-version', 'utf8')).trim();
assert.match(runtime, /^\d+\.\d+\.\d+$/, '.node-version must pin a full Node.js version');
const runtimeMajor = runtime.split('.')[0];
const nodeTypesRange = pkg.devDependencies['@types/node'];
// Accept exact, tilde or caret versions that stay within one non-zero major.
assert.match(nodeTypesRange, /^[~^]?[1-9]\d*\.\d+\.\d+$/, '@types/node must use an exact, tilde or caret version');
assert.equal(nodeTypesRange.replace(/^[~^]/, '').split('.')[0], runtimeMajor,
  '@types/node must target the major version in .node-version');
assert.equal(lock.packages[''].devDependencies['@types/node'], nodeTypesRange,
  'Lockfile root @types/node requirement must match package.json');
assert.equal(lock.packages['node_modules/@types/node'].version.split('.')[0], runtimeMajor,
  'Locked @types/node must match the supported Node.js major');

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
