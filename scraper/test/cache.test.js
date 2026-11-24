import test from 'node:test';
import assert from 'node:assert/strict';

delete process.env.REDIS_URI;
const { BoundedMap, cacheWrap } = await import('../lib/cache.js');

test('the in-memory cache store evicts its oldest entry past its bound', () => {
  const map = new BoundedMap(3);
  for (const k of ['a', 'b', 'c']) map.set(k, k);
  map.set('a', 'again'); // re-setting moves it to the back
  map.set('d', 'd');
  assert.deepEqual([...map.keys()], ['c', 'a', 'd']);
  assert.equal(map.size, 3);
});

test('concurrent loads of the same key share one loader run', async () => {
  let runs = 0;
  const loader = async () => {
    runs++;
    await new Promise(resolve => setTimeout(resolve, 50));
    return [{ infoHash: 'x' }];
  };
  const results = await Promise.all([
    cacheWrap('dedupe:key', loader, 60),
    cacheWrap('dedupe:key', loader, 60),
    cacheWrap('dedupe:key', loader, 60),
  ]);
  assert.equal(runs, 1);
  for (const r of results) assert.deepEqual(r.value, [{ infoHash: 'x' }]);

  const later = await cacheWrap('dedupe:key', loader, 60);
  assert.equal(later.cached, true);
  assert.equal(runs, 1);
});

test('a failed load is shared by its waiters and not remembered', async () => {
  let runs = 0;
  const failing = async () => { runs++; await new Promise(r => setTimeout(r, 20)); throw new Error('boom'); };
  const outcomes = await Promise.allSettled([
    cacheWrap('dedupe:fail', failing, 60),
    cacheWrap('dedupe:fail', failing, 60),
  ]);
  assert.equal(runs, 1);
  assert.ok(outcomes.every(o => o.status === 'rejected' && o.reason.message === 'boom'));

  const ok = await cacheWrap('dedupe:fail', async () => { runs++; return ['y']; }, 60);
  assert.deepEqual(ok.value, ['y']);
  assert.equal(runs, 2);
});

test('empty results are still not cached', async () => {
  let runs = 0;
  await cacheWrap('dedupe:empty', async () => { runs++; return []; }, 60);
  await cacheWrap('dedupe:empty', async () => { runs++; return []; }, 60);
  assert.equal(runs, 2);
});
