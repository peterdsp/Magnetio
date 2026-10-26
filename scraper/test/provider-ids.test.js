// SCRAPER_DISABLED_PROVIDERS is read once when the provider index is loaded, so
// it has to be set before that import. Static imports are hoisted above this
// assignment, which is why the provider index is pulled in dynamically below.
// node --test gives each test file its own process, so this does not leak.
process.env.SCRAPER_DISABLED_PROVIDERS = 'yts,glotorrents';

import test from 'node:test';
import assert from 'node:assert/strict';

const { classifyProviderIds, listProviders } = await import('../providers/index.js');

// ─── classifyProviderIds ──────────────────────────────────────────────────────

test('an id this host disabled is reported as disabled, never as unknown', () => {
  const { active, disabled, unknown } = classifyProviderIds(['yts']);

  assert.deepEqual(disabled, ['yts']);
  assert.deepEqual(unknown, []);
  assert.deepEqual(active, []);
});

test('an id that was never registered is unknown', () => {
  const { active, disabled, unknown } = classifyProviderIds(['nope']);

  assert.deepEqual(unknown, ['nope']);
  assert.deepEqual(disabled, []);
  assert.deepEqual(active, []);
});

test('a request mixing all three cases keeps them apart', () => {
  const { active, disabled, unknown } = classifyProviderIds(['eztv', 'yts', 'nope']);

  assert.deepEqual(active, ['eztv']);
  assert.deepEqual(disabled, ['yts']);
  assert.deepEqual(unknown, ['nope']);
});

test('one bad id does not discard the valid ones', () => {
  const { active } = classifyProviderIds(['eztv', 'nyaa', 'nope']);

  assert.deepEqual(active, ['eztv', 'nyaa']);
});

// The id of 1337x is '1337x' even though the module is providers/leetx.js, and
// both #177 and #184 got this backwards. Pin it down so the next reader does
// not have to rediscover it from a 400.
test('1337x registers under its site name, not its module name', () => {
  const { active, unknown } = classifyProviderIds(['1337x', 'leetx']);

  assert.deepEqual(active, ['1337x']);
  assert.deepEqual(unknown, ['leetx']);
});

test('an empty request classifies as nothing at all', () => {
  assert.deepEqual(classifyProviderIds([]), { active: [], disabled: [], unknown: [] });
});

// ─── listProviders ────────────────────────────────────────────────────────────

test('listProviders hides what this host disabled', () => {
  const ids = listProviders().map(p => p.id);

  assert.ok(!ids.includes('yts'), 'a disabled provider must not be advertised');
  assert.ok(!ids.includes('glotorrents'), 'a disabled provider must not be advertised');
  assert.ok(ids.includes('eztv'), 'an active provider must still be advertised');
});
