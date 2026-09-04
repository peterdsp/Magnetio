import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { get } from '../lib/httpClient.js';

// A pinned lookup that forces every hostname to the loopback test server,
// mirroring what lib/ssrf.js hands to the client (but pointing at 127.0.0.1 so
// the test needs no real network). Handles the options.all shape Node uses.
function pinToLoopback() {
  return (hostname, options, callback) => {
    if (typeof options === 'function') { callback = options; options = {}; }
    if (options && options.all) callback(null, [{ address: '127.0.0.1', family: 4 }]);
    else callback(null, '127.0.0.1', 4);
  };
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

test('pinned lookup connects to the pinned IP while preserving the Host header', async () => {
  const received = [];
  const server = http.createServer((req, res) => {
    received.push({ host: req.headers.host, url: req.url });
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  });
  const port = await listen(server);

  try {
    // `blocked.invalid` never resolves in real DNS; the request only succeeds
    // because the pinned lookup routes the socket to 127.0.0.1.
    const res = await get(`http://blocked.invalid:${port}/torznab/api`, {
      limiterKey: `pin-${port}`,
      retries: 0,
      params: { t: 'search', q: 'x' },
      lookup: pinToLoopback(),
    });

    assert.equal(res.status, 200);
    assert.equal(res.data, 'ok');
    assert.equal(received.length, 1);
    // Host header carries the original hostname + port, not the connect IP.
    assert.equal(received[0].host, `blocked.invalid:${port}`);
    assert.equal(received[0].url, '/torznab/api?t=search&q=x');
  } finally {
    await close(server);
  }
});

test('pinned lookup disables redirects (a 3xx does not reach another host)', async () => {
  let hits = 0;
  const server = http.createServer((req, res) => {
    hits++;
    // Try to bounce the client to an internal target.
    res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' });
    res.end();
  });
  const port = await listen(server);

  try {
    await assert.rejects(
      get(`http://target.invalid:${port}/`, {
        limiterKey: `redir-${port}`,
        retries: 0,
        lookup: pinToLoopback(),
      }),
      (err) => {
        // maxRedirects: 0 -> the 302 is surfaced as an error, never followed.
        assert.equal(err.response?.status, 302);
        return true;
      },
    );
    assert.equal(hits, 1, 'redirect target must not be requested');
  } finally {
    await close(server);
  }
});

test('requests without a lookup are unaffected (normal redirect following)', async () => {
  let hits = 0;
  const server = http.createServer((req, res) => {
    hits++;
    if (req.url === '/start') {
      res.writeHead(302, { Location: '/final' });
      res.end();
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('landed');
    }
  });
  const port = await listen(server);

  try {
    const res = await get(`http://127.0.0.1:${port}/start`, {
      limiterKey: `noredir-${port}`,
      retries: 0,
    });
    assert.equal(res.status, 200);
    assert.equal(res.data, 'landed');
    assert.equal(hits, 2, 'default path should follow the redirect');
  } finally {
    await close(server);
  }
});
