/**
 * Provider contract test.
 *
 * Checks that every file in providers/ satisfies the module contract and is
 * actually wired into the aggregator. No network: this runs in CI and tells a
 * contributor what they got wrong before a maintainer has to.
 *
 * The contract is documented in CONTRIBUTING.md#adding-a-torrent-provider.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { listProviders } from '../providers/index.js';

const PROVIDERS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'providers');

// index.js is the aggregator, _template.js is the copy-me starting point and is
// deliberately not registered.
const NOT_PROVIDERS = new Set(['index.js', '_template.js']);

const providerFiles = readdirSync(PROVIDERS_DIR)
  .filter(f => f.endsWith('.js') && !NOT_PROVIDERS.has(f))
  .sort();

const modules = await Promise.all(
  providerFiles.map(async file => ({ file, mod: await import(join(PROVIDERS_DIR, file)) }))
);

test('there is at least one provider', () => {
  assert.ok(providerFiles.length > 0, 'providers/ is empty');
});

for (const { file, mod } of modules) {
  test(`${file} exports a string id`, () => {
    assert.equal(typeof mod.id, 'string', `${file} must export \`id\``);
    assert.ok(mod.id.length > 0, `${file} exports an empty id`);
  });

  test(`${file} id is lowercase with no whitespace`, () => {
    assert.equal(mod.id, mod.id.toLowerCase(), `${file}: id must be lowercase`);
    assert.doesNotMatch(mod.id, /\s/, `${file}: id must not contain whitespace`);
  });

  test(`${file} exports a non-empty name`, () => {
    assert.equal(typeof mod.name, 'string', `${file} must export \`name\``);
    assert.ok(mod.name.trim().length > 0, `${file} exports an empty name`);
  });

  test(`${file} exports an async scrape function`, () => {
    assert.equal(typeof mod.scrape, 'function', `${file} must export \`scrape\``);
    assert.equal(
      mod.scrape.constructor.name,
      'AsyncFunction',
      `${file}: scrape must be declared async so a throw becomes a rejected promise`
    );
  });

  test(`${file} scrape takes the meta object`, () => {
    assert.ok(
      mod.scrape.length >= 1,
      `${file}: scrape must accept the meta argument`
    );
  });
}

test('provider ids are unique', () => {
  const byId = new Map();
  for (const { file, mod } of modules) {
    if (byId.has(mod.id)) {
      assert.fail(`id "${mod.id}" is used by both ${byId.get(mod.id)} and ${file}`);
    }
    byId.set(mod.id, file);
  }
});

test('every provider file is registered in the aggregator', () => {
  // listProviders() reflects ALL_PROVIDERS minus anything disabled by env, so
  // run this with no SCRAPER_DISABLED_PROVIDERS set (the CI default).
  if (process.env.SCRAPER_DISABLED_PROVIDERS) {
    return; // cannot distinguish "unregistered" from "disabled on this host"
  }

  const registered = new Set(listProviders().map(p => p.id));
  const missing = modules
    .filter(({ mod }) => !registered.has(mod.id))
    .map(({ file, mod }) => `${file} (id: ${mod.id})`);

  assert.deepEqual(
    missing,
    [],
    `not wired into providers/index.js: ${missing.join(', ')}. ` +
    'Add the import and append the module to ALL_PROVIDERS.'
  );
});

test('the aggregator reports the same id and name as each module', () => {
  const registered = new Map(listProviders().map(p => [p.id, p.name]));
  for (const { file, mod } of modules) {
    if (!registered.has(mod.id)) continue;
    assert.equal(
      registered.get(mod.id),
      mod.name,
      `${file}: aggregator name disagrees with the module's \`name\` export`
    );
  }
});

test('the _template provider still satisfies the contract it documents', async () => {
  // Guards against the template rotting away from the real contract, which
  // would send every new contributor down the wrong path.
  const tpl = await import(join(PROVIDERS_DIR, '_template.js'));
  assert.equal(typeof tpl.id, 'string');
  assert.equal(typeof tpl.name, 'string');
  assert.equal(tpl.scrape.constructor.name, 'AsyncFunction');
  assert.deepEqual(await tpl.scrape({}), [], 'template must return [] for empty meta');
});

test('the shared extractInfoHash normalises base32 to hex', async () => {
  // The template tells contributors to use this instead of a local regex, so
  // the behaviour it promises is pinned here. A base32 btih lowercased rather
  // than converted is a 32-char string that is not the torrent's infoHash: it
  // cannot deduplicate against the same torrent from another provider, and a
  // debrid service will reject it.
  const { extractInfoHash } = await import(join(PROVIDERS_DIR, '..', 'lib', 'magnetHelper.js'));

  // Both forms below are the same torrent. Taken from a live Tokyo Toshokan
  // feed, whose own .torrent filename is the hex form, which is what makes
  // this pair a fixture rather than a guess.
  const hex = '6383139c533b515314c7bb5a6933ccc4899f0825';
  assert.equal(
    extractInfoHash('magnet:?xt=urn:btih:MOBRHHCTHNIVGFGHXNNGSM6MYSEZ6CBF&tr=http://x/announce'),
    hex,
    'base32 btih must be converted to hex, not lowercased'
  );
  assert.equal(
    extractInfoHash(`magnet:?xt=urn:btih:${hex.toUpperCase()}`),
    hex,
    'hex btih must be lowercased'
  );
  assert.equal(extractInfoHash('magnet:?dn=no-hash-here'), null);
  assert.equal(extractInfoHash(''), null);
});
