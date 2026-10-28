import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';

import { resolve, getCachedStreams, resetAccessTokens } from '../moch/seedr.js';
import { MochOptions } from '../moch/options.js';

// A refresh token long enough to pass isValidToken's MIN_API_KEY_LENGTH.
const TOKEN = 'seedr-refresh-token-0123456789';
const HASH  = 'a'.repeat(40);

function stub(handlers) {
  const calls = [];
  const post = mock.method(axios, 'post', async (url, body, cfg) => {
    const func = cfg?.params?.func ?? 'token';
    calls.push({ func, body, params: cfg?.params });
    const handler = handlers[func];
    if (!handler) throw new Error(`unexpected call: ${func}`);
    return { data: typeof handler === 'function' ? handler(body) : handler };
  });
  return { calls, restore: () => post.mock.restore() };
}

const tokenOk = { access_token: 'access-123', expires_in: 3600, token_type: 'Bearer' };

test('Seedr is registered as a service that cannot report cached streams', () => {
  assert.equal(MochOptions.seedr.instantAvailability, false);
  assert.equal(MochOptions.seedr.configKey, 'seedrRefreshToken');
  assert.equal(MochOptions.seedr.id, 'sr');
});

// No cache endpoint exists and none is possible: Seedr downloads into the
// user's own storage, not a shared pool.
test('getCachedStreams always reports nothing cached', async () => {
  assert.equal((await getCachedStreams([{ infoHash: HASH }], TOKEN)).size, 0);
  assert.equal((await getCachedStreams([], 'short')).size, 0);
});

test('an invalid token resolves to null without any request', async (t) => {
  const s = stub({});
  t.after(s.restore);
  assert.equal(await resolve({ infoHash: HASH }, 'tiny'), null);
  assert.equal(s.calls.length, 0);
});

// The first attempt on new content can only start the transfer: a fresh Seedr
// download takes minutes, far longer than a play click waits.
test('a torrent not yet in the account is started and resolves to null', async (t) => {
  resetAccessTokens();
  const s = stub({
    token:         tokenOk,
    list_contents: { folders: [], files: [] },
    add_torrent:   { result: true, title: 'Some.Release.1080p' },
  });
  t.after(() => { s.restore(); resetAccessTokens(); });

  assert.equal(await resolve({ infoHash: HASH }, TOKEN), null);
  assert.ok(s.calls.some(c => c.func === 'add_torrent'), 'the transfer was started');
});

test('a full account is reported and not treated as started', async (t) => {
  resetAccessTokens();
  const s = stub({
    token:         tokenOk,
    list_contents: { folders: [] },
    add_torrent:   { result: false, error: 'not_enough_space_added_to_wishlist' },
  });
  t.after(() => { s.restore(); resetAccessTokens(); });

  assert.equal(await resolve({ infoHash: HASH }, TOKEN), null);
});

test('the access token is fetched once and reused across resolves', async (t) => {
  resetAccessTokens();
  const s = stub({
    token:         tokenOk,
    list_contents: { folders: [] },
    add_torrent:   { result: true, title: 'X' },
  });
  t.after(() => { s.restore(); resetAccessTokens(); });

  await resolve({ infoHash: HASH }, TOKEN);
  await resolve({ infoHash: 'b'.repeat(40) }, TOKEN);

  assert.equal(s.calls.filter(c => c.func === 'token').length, 1);
});

test('the refresh token is sent as a refresh_token grant, never as a password', async (t) => {
  resetAccessTokens();
  const s = stub({ token: tokenOk, list_contents: { folders: [] }, add_torrent: { result: true } });
  t.after(() => { s.restore(); resetAccessTokens(); });

  await resolve({ infoHash: HASH }, TOKEN);

  const body = s.calls.find(c => c.func === 'token').body;
  assert.match(body, /grant_type=refresh_token/);
  assert.match(body, /refresh_token=seedr-refresh-token/);
  assert.doesNotMatch(body, /password|username|email/i);
});

// An expired access token arrives as {"error":"expired_token"} inside a 200
// body rather than as a 401, so a status check alone would miss it.
test('an expired access token in a 200 body is not mistaken for success', async (t) => {
  resetAccessTokens();
  const s = stub({ token: tokenOk, list_contents: { error: 'expired_token' } });
  t.after(() => { s.restore(); resetAccessTokens(); });

  assert.equal(await resolve({ infoHash: HASH }, TOKEN), null);
});

test('a token endpoint that returns no access token does not proceed', async (t) => {
  resetAccessTokens();
  const s = stub({ token: { error: 'invalid_grant', error_description: 'Invalid refresh token' } });
  t.after(() => { s.restore(); resetAccessTokens(); });

  assert.equal(await resolve({ infoHash: HASH }, TOKEN), null);
  assert.ok(!s.calls.some(c => c.func === 'list_contents'), 'no resource call was attempted');
});

// Nothing in list_contents carries the infohash, so without the recorded title
// a folder cannot be matched. Guessing could hand back an unrelated file.
test('with no recorded title, no folder is matched', async (t) => {
  resetAccessTokens();
  const s = stub({
    token:         tokenOk,
    list_contents: { folders: [{ id: 99, name: 'Someone.Elses.Download' }] },
    add_torrent:   { result: true, title: 'Mine' },
  });
  t.after(() => { s.restore(); resetAccessTokens(); });

  assert.equal(await resolve({ infoHash: 'c'.repeat(40) }, TOKEN), null);
  assert.ok(!s.calls.some(c => c.func === 'fetch_file'), 'no file was fetched from a stranger folder');
});
