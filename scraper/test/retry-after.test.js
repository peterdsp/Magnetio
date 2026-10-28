import test from 'node:test';
import assert from 'node:assert/strict';

import { retryAfterMs } from '../lib/httpClient.js';

const with429 = headers => ({ response: { status: 429, headers } });

test('without a Retry-After header the wait backs off per attempt', () => {
  assert.equal(retryAfterMs(with429({}), 0), 1000);
  assert.equal(retryAfterMs(with429({}), 1), 2000);
  assert.equal(retryAfterMs({}, 0), 1000);
  assert.equal(retryAfterMs(undefined, 2), 3000);
});

test('a Retry-After in seconds is honoured', () => {
  assert.equal(retryAfterMs(with429({ 'retry-after': '2' }), 0), 2000);
  assert.equal(retryAfterMs(with429({ 'retry-after': 3 }), 0), 3000);
  assert.equal(retryAfterMs(with429({ 'retry-after': '0' }), 0), 0);
});

// The aggregator gives each provider a hard timeout, so a server asking for
// two minutes is better treated as a failure now than as a request that
// outlives the response it belongs to.
test('an unreasonable Retry-After is capped', () => {
  assert.equal(retryAfterMs(with429({ 'retry-after': '120' }), 0), 5000);
});

test('a Retry-After as an HTTP date is honoured', () => {
  const soon = new Date(Date.now() + 2000).toUTCString();
  const ms = retryAfterMs(with429({ 'retry-after': soon }), 0);
  assert.ok(ms > 500 && ms <= 2000, `expected about 2000ms, got ${ms}`);
});

test('a Retry-After date in the past waits no time rather than going negative', () => {
  const past = new Date(Date.now() - 60_000).toUTCString();
  assert.equal(retryAfterMs(with429({ 'retry-after': past }), 0), 0);
});

test('a nonsense Retry-After falls back to the backoff', () => {
  assert.equal(retryAfterMs(with429({ 'retry-after': 'soon-ish' }), 0), 1000);
  assert.equal(retryAfterMs(with429({ 'retry-after': '-5' }), 0), 1000);
});
