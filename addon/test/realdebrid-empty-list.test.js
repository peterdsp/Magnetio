import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { logger } from '../lib/logger.js';
import { getCachedStreams, getCatalog, resolve } from '../moch/realdebrid.js';

// Real-Debrid answers GET /torrents with 204 No Content for an empty library
// or an offset past the end; axios then hands back '' instead of an array.
const noContent = { status: 204, data: '' };

test('RD catalog treats a 204 torrent list as empty instead of erroring', async t => {
  t.mock.method(axios, 'get', async url => {
    assert.ok(url.endsWith('/torrents'));
    return noContent;
  });
  const warn = t.mock.method(logger, 'warn');
  assert.deepEqual(await getCatalog('rd-empty-catalog-api-key-0001', 'movie', 25), []);
  assert.equal(warn.mock.callCount(), 0);
});

test('RD library check treats a 204 torrent list as nothing downloaded', async t => {
  t.mock.method(axios, 'get', async () => noContent);
  const warn = t.mock.method(logger, 'warn');
  const result = await getCachedStreams([{ infoHash: 'c'.repeat(40) }], 'rd-empty-library-api-key-0001');
  assert.equal(result.size, 0);
  assert.equal(warn.mock.callCount(), 0);
});

test('RD resolve adds the magnet when the account library is empty (204)', async t => {
  const hash = 'd'.repeat(40);
  t.mock.method(axios, 'get', async url => {
    if (url.endsWith('/torrents')) return noContent;
    assert.ok(url.endsWith('/torrents/info/T1'));
    return { data: { status: 'downloaded', links: ['https://real-debrid.example/d/1'],
      files: [{ id: 1, path: '/Movie.2020.1080p.mkv', bytes: 5000, selected: 1 }] } };
  });
  const post = t.mock.method(axios, 'post', async url => {
    if (url.endsWith('/torrents/addMagnet')) return { data: { id: 'T1' } };
    if (url.endsWith('/unrestrict/link')) return { data: { download: 'https://cdn.example/movie.mkv' } };
    throw new Error(`unexpected POST ${url}`);
  });
  const url = await resolve({ infoHash: hash }, 'rd-empty-resolve-api-key-0001');
  assert.equal(url, 'https://cdn.example/movie.mkv');
  assert.ok(post.mock.calls.some(call => call.arguments[0].endsWith('/torrents/addMagnet')));
});
