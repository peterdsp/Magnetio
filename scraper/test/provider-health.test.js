import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyError, recordSuccess, recordFailure, snapshot, reset, isSkipped,
} from '../lib/providerHealth.js';

const err = (code, extra = {}) => Object.assign(new Error(code ?? 'boom'), { code }, extra);
const find = id => snapshot().find(p => p.id === id);

test('a name that does not exist is separated from a resolver that could not answer', () => {
  // ENOTFOUND is permanent and needs a code change. EAI_AGAIN is the resolver
  // having a moment, and reporting it as a dead host would send someone
  // rewriting a provider that is fine.
  assert.equal(classifyError(err('ENOTFOUND')), 'dns');
  assert.equal(classifyError(err('EAI_AGAIN')), 'dns-temporary');
});

test('the other failure kinds are classified', () => {
  assert.equal(classifyError(err('ECONNREFUSED')), 'connection');
  assert.equal(classifyError(err('ETIMEDOUT')), 'timeout');
  assert.equal(classifyError(new Error('request timed out after 15000ms')), 'timeout');
  assert.equal(classifyError(err(undefined, { response: { status: 503 } })), 'http');
  assert.equal(classifyError(new Error('something else')), 'other');
  assert.equal(classifyError(undefined), 'other');
});

test('successes and failures are counted per provider', (t) => {
  reset();
  t.after(reset);

  recordSuccess('yts');
  recordSuccess('yts');
  recordFailure('eztv', err('ETIMEDOUT'));

  assert.equal(find('yts').ok, 2);
  assert.equal(find('yts').failed, 0);
  assert.equal(find('eztv').failed, 1);
  assert.equal(find('eztv').ok, 0);
});

test('a success clears the failure streak but not the history', (t) => {
  reset();
  t.after(reset);

  recordFailure('nyaa', err('ENOTFOUND'));
  recordFailure('nyaa', err('ENOTFOUND'));
  assert.equal(find('nyaa').consecutiveFailures, 2);

  recordSuccess('nyaa');
  assert.equal(find('nyaa').consecutiveFailures, 0);
  assert.equal(find('nyaa').failed, 2, 'the failures still happened');
  assert.equal(find('nyaa').healthy, true);
});

test('three consecutive failures mark a provider unhealthy', (t) => {
  reset();
  t.after(reset);

  for (let i = 0; i < 2; i++) recordFailure('torlock', err('ENOTFOUND'));
  assert.equal(find('torlock').healthy, true, 'two is not yet a verdict');

  recordFailure('torlock', err('ENOTFOUND'));
  assert.equal(find('torlock').healthy, false);
});

// A provider that rotates domains can fail on three hosts for three different
// reasons, and the single lastError is whichever host was tried last.
test('the mix of failure kinds is kept, not just the last one', (t) => {
  reset();
  t.after(reset);

  recordFailure('1337x', err('ETIMEDOUT'));
  recordFailure('1337x', err(undefined, { response: { status: 403 } }));
  recordFailure('1337x', err('ENOTFOUND'));

  const e = find('1337x');
  assert.deepEqual(e.kinds, { timeout: 1, http: 1, dns: 1 });
  assert.equal(e.lastErrorKind, 'dns', 'last is still available');
});

test('the worst provider sorts first, so a monitor sees it', (t) => {
  reset();
  t.after(reset);

  recordSuccess('yts');
  recordFailure('eztv', err('ETIMEDOUT'));
  for (let i = 0; i < 4; i++) recordFailure('btdig', err('ENOTFOUND'));

  assert.deepEqual(snapshot().map(p => p.id), ['btdig', 'eztv', 'yts']);
});

// httpClient passes its limiterKey straight through, and 'default' is the
// value for anything that is not a provider.
test('non-provider traffic is not recorded', (t) => {
  reset();
  t.after(reset);

  recordSuccess('default');
  recordFailure('default', err('ENOTFOUND'));
  recordSuccess(undefined);
  recordSuccess('');

  assert.deepEqual(snapshot(), []);
});

// ─── skipping a failing provider ──────────────────────────────────────────────

test('a healthy or unknown provider is never skipped', (t) => {
  reset();
  t.after(reset);

  assert.equal(isSkipped('yts'), false, 'never asked for anything yet');
  recordSuccess('yts');
  assert.equal(isSkipped('yts'), false);
  recordFailure('yts', err('ETIMEDOUT'));
  assert.equal(isSkipped('yts'), false, 'one failure is not a verdict');
});

test('a provider is skipped once it has failed its last three requests', (t) => {
  reset();
  t.after(reset);

  for (let i = 0; i < 3; i++) recordFailure('torlock', err(undefined, { response: { status: 403 } }));
  assert.equal(isSkipped('torlock'), true);
  assert.equal(snapshot().find(p => p.id === 'torlock').skipped, true);
});

// The skip must expire on its own. A block or an outage is usually temporary,
// and a provider that needs a restart to come back is a worse bug than the
// one being fixed.
test('the skip lifts after the cooldown, so a recovered provider returns', (t) => {
  reset();
  t.after(reset);

  for (let i = 0; i < 3; i++) recordFailure('bt4g', err(undefined, { response: { status: 429 } }));
  assert.equal(isSkipped('bt4g'), true);

  // Backdate the last failure past the five minute cooldown.
  const e = snapshot().find(p => p.id === 'bt4g');
  assert.ok(e.lastFailureAt);
  mock.timers.enable({ apis: ['Date'], now: Date.parse(e.lastFailureAt) + 300_001 });
  t.after(() => mock.timers.reset());

  assert.equal(isSkipped('bt4g'), false, 'the trial request is allowed through');
});

test('a success during the trial clears the skip entirely', (t) => {
  reset();
  t.after(reset);

  for (let i = 0; i < 3; i++) recordFailure('animetosho', err(undefined, { response: { status: 403 } }));
  assert.equal(isSkipped('animetosho'), true);

  recordSuccess('animetosho');
  assert.equal(isSkipped('animetosho'), false);
  assert.equal(snapshot().find(p => p.id === 'animetosho').healthy, true);
});
