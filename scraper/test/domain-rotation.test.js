import test from 'node:test';
import assert from 'node:assert/strict';

import { tryDomains } from '../lib/domainRotation.js';
import { isValidYtsResponse } from '../providers/yts.js';

test('domain rotation skips an HTTP 200 response with an invalid body', async () => {
  const visited = [];
  const result = await tryDomains(
    ['https://invalid.example', 'https://valid.example'],
    async domain => {
      visited.push(domain);
      return domain.includes('invalid')
        ? { data: '<html>not the API</html>' }
        : { data: { status: 'ok', data: { movies: [] } } };
    },
    'YTS-test',
    { validate: isValidYtsResponse },
  );

  assert.deepEqual(visited, ['https://invalid.example', 'https://valid.example']);
  assert.equal(result.data.status, 'ok');
});

test('YTS response validation rejects non-API payloads', () => {
  assert.equal(isValidYtsResponse({ data: '<html>gateway</html>' }), false);
  assert.equal(isValidYtsResponse({ data: { status: 'error' } }), false);
  assert.equal(isValidYtsResponse({ data: { status: 'ok', data: {} } }), true);
});

// A request cancelled because its caller stopped waiting says nothing about
// the domain. Rotating on it marked every domain failed for five minutes and
// queued the same cancelled search against each mirror in turn.
test('domain rotation stops on a cancelled request without trying the next domain', async () => {
  const visited = [];
  const cancelled = Object.assign(new Error('timed out'), { code: 'ERR_CANCELED' });
  await assert.rejects(
    tryDomains(
      ['https://cancel-a.example', 'https://cancel-b.example'],
      async domain => { visited.push(domain); throw cancelled; },
      'Cancel-test',
    ),
    err => err === cancelled,
  );
  assert.deepEqual(visited, ['https://cancel-a.example']);

  // And the domain is still considered healthy afterwards.
  const again = [];
  await tryDomains(
    ['https://cancel-a.example', 'https://cancel-b.example'],
    async domain => { again.push(domain); return { data: 'ok' }; },
    'Cancel-test',
  );
  assert.deepEqual(again, ['https://cancel-a.example']);
});
