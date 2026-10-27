import test from 'node:test';
import assert from 'node:assert/strict';

import { normaliseInfoHash, extractInfoHash, base32ToHex } from '../lib/magnetHelper.js';

const HEX    = '6383139c533b515314c7bb5a6933ccc4899f0825';
const BASE32 = 'MOBRHHCTHNIVGFGHXNNGSM6MYSEZ6CBF';  // the same hash

test('base32 and hex are the same infoHash', () => {
  assert.equal(base32ToHex(BASE32), HEX);
  assert.equal(normaliseInfoHash(BASE32), HEX);
  assert.equal(normaliseInfoHash(HEX), HEX);
});

test('an uppercase hex hash is lowercased, not rejected', () => {
  assert.equal(normaliseInfoHash(HEX.toUpperCase()), HEX);
});

test('surrounding whitespace from a scraped field is tolerated', () => {
  assert.equal(normaliseInfoHash(`  ${HEX}\n`), HEX);
});

// Dedup keys on this value, so a bad hash is worse than none: the aggregator
// drops a record with no hash, but a wrong one duplicates or yields a magnet
// that resolves to nothing.
test('anything that is not a valid infoHash is rejected', () => {
  for (const bad of [
    '',
    'not-a-hash',
    HEX.slice(0, 39),            // truncated
    `${HEX}aa`,                  // too long
    'z'.repeat(40),              // right length, not hex
    '1'.repeat(32),              // right length, but 0 and 1 are not base32
    null,
    undefined,
    12345,
    {},
  ]) {
    assert.equal(normaliseInfoHash(bad), null, JSON.stringify(bad));
  }
});

test('extractInfoHash normalises through the same path', () => {
  assert.equal(extractInfoHash(`magnet:?xt=urn:btih:${BASE32}&tr=udp`), HEX);
  assert.equal(extractInfoHash(`magnet:?xt=urn:btih:${HEX.toUpperCase()}`), HEX);
  assert.equal(extractInfoHash('magnet:?xt=urn:btih:nope'), null);
  assert.equal(extractInfoHash(''), null);
});

// Every provider must emit 40-char lowercase hex, whatever the site gave it.
test('the providers that read a hash from an API field validate it', async () => {
  const eztv = await import('../providers/eztv.js');
  const tpb  = await import('../providers/thepiratebay.js');
  const yts  = await import('../providers/yts.js');

  for (const mod of [eztv, tpb, yts]) {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync(new URL(`../providers/${mod.id === '1337x' ? 'leetx' : mod.id}.js`, import.meta.url), 'utf8'));
    assert.match(
      src,
      /normaliseInfoHash\(/,
      `${mod.id}: assigns infoHash without normaliseInfoHash(). A raw toLowerCase() ` +
      'cannot catch a base32, truncated or malformed value from the API.'
    );
    assert.doesNotMatch(
      src,
      /infoHash:\s*\w+\.\w+\?\.toLowerCase\(\)/,
      `${mod.id}: still lowercases an API field directly`
    );
  }
});
