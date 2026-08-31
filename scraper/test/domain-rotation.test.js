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
