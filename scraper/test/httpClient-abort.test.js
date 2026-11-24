import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { get, runWithSignal, isCancellation } from '../lib/httpClient.js';

// A server that accepts requests and never answers, the shape of a provider
// that has stopped responding. It counts what actually reached it.
async function hangingServer() {
  const pending = [];
  let received = 0;
  const server = http.createServer((_req, res) => { received++; pending.push(res); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    get received() { return received; },
    close: () => new Promise(resolve => {
      for (const res of pending) res.destroy();
      server.closeAllConnections?.();
      server.close(resolve);
    }),
  };
}

const settleWithin = (promise, ms) => Promise.race([
  promise.then(() => 'resolved', err => err),
  new Promise(resolve => setTimeout(() => resolve('still pending'), ms)),
]);

test('aborting the search signal cancels a request in flight and does not retry it', async () => {
  const server = await hangingServer();
  try {
    const controller = new AbortController();
    const request = runWithSignal(controller.signal, () =>
      get(server.url, { limiterKey: 'abort-inflight', timeout: 10_000, retries: 2 }));
    await new Promise(resolve => setTimeout(resolve, 100));
    controller.abort(new Error('Provider timed out'));

    const outcome = await settleWithin(request, 500);
    assert.ok(outcome instanceof Error, `expected a rejection, got ${outcome}`);
    assert.equal(isCancellation(outcome), true);
    assert.equal(outcome.message, 'Provider timed out');

    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.equal(server.received, 1, 'a cancelled request must not be retried');
  } finally {
    await server.close();
  }
});

// The production heap exhaustion: requests queued behind a slow site kept
// their caller's parsed page alive until the queue reached them, minutes after
// the caller had timed out. Queued requests now settle on abort and never
// reach the network.
test('aborting releases queued requests at once and they never reach the network', async () => {
  const server = await hangingServer();
  try {
    const controller = new AbortController();
    const requests = runWithSignal(controller.signal, () =>
      Array.from({ length: 10 }, () =>
        get(server.url, { limiterKey: 'abort-queued', timeout: 10_000, retries: 0 })));
    await new Promise(resolve => setTimeout(resolve, 1200));
    const reachedBeforeAbort = server.received;
    assert.ok(reachedBeforeAbort <= 4, 'the limiter runs at most four at once');

    controller.abort(new Error('Search finished'));
    const outcomes = await Promise.all(requests.map(r => settleWithin(r, 300)));
    for (const outcome of outcomes) {
      assert.ok(outcome instanceof Error && isCancellation(outcome), `expected a cancellation, got ${outcome}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.equal(server.received, reachedBeforeAbort, 'queued requests must not start after the abort');
  } finally {
    await server.close();
  }
});

test('a request made after its search was aborted is refused without queueing', async () => {
  const controller = new AbortController();
  controller.abort(new Error('gone'));
  await assert.rejects(
    runWithSignal(controller.signal, () => get('http://127.0.0.1:9/', { limiterKey: 'abort-before' })),
    err => isCancellation(err),
  );
});

test('a provider queue is bounded and drops its oldest waiting request', async () => {
  const server = await hangingServer();
  try {
    // Four run, 32 wait (the default high water mark), and every request past
    // that pushes the oldest waiting one out.
    const requests = Array.from({ length: 40 }, () =>
      get(server.url, { limiterKey: 'bounded-queue', timeout: 3_000, retries: 0 }));
    const early = await Promise.all(requests.slice(0, 8).map(r => settleWithin(r, 200)));
    const dropped = early.filter(o => o instanceof Error && o.code === 'ERR_QUEUE_DROPPED');
    assert.equal(dropped.length, 4);
    assert.equal(isCancellation(dropped[0]), true);
    await Promise.allSettled(requests.slice(8).map(r => settleWithin(r, 0)));
  } finally {
    await server.close();
  }
});
