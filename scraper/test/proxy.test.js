import test from 'node:test';
import assert from 'node:assert/strict';

import { proxyAppliesTo, proxyAgents, resetProxy } from '../lib/proxy.js';

function withEnv(env, fn) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  resetProxy();
  try { return fn(); } finally {
    process.env = saved;
    resetProxy();
  }
}

test('off unless a proxy URL is set, so nothing changes by default', () => {
  withEnv({ SCRAPER_PROXY_URL: undefined, SCRAPER_PROXY_PROVIDERS: undefined }, () => {
    assert.equal(proxyAppliesTo('animetosho'), false);
    assert.equal(proxyAgents(), null);
  });
});

test('with no provider list, the proxy applies to everything', () => {
  withEnv({ SCRAPER_PROXY_URL: 'socks5h://127.0.0.1:1080', SCRAPER_PROXY_PROVIDERS: undefined }, () => {
    assert.equal(proxyAppliesTo('animetosho'), true);
    assert.equal(proxyAppliesTo('yts'), true);
  });
});

// Scoping is the better default in practice: one exit for all 24 providers
// adds a single point of failure for the twenty that are already fine.
test('a provider list scopes the proxy to those providers', () => {
  withEnv({ SCRAPER_PROXY_URL: 'socks5h://127.0.0.1:1080', SCRAPER_PROXY_PROVIDERS: 'animetosho, BT4G' }, () => {
    assert.equal(proxyAppliesTo('animetosho'), true);
    assert.equal(proxyAppliesTo('bt4g'), true, 'the list is case-insensitive');
    assert.equal(proxyAppliesTo('yts'), false);
    assert.equal(proxyAppliesTo(undefined), false);
  });
});

test('a socks proxy builds an agent', () => {
  for (const url of ['socks5h://127.0.0.1:1080', 'socks5://127.0.0.1:1080', 'socks4://127.0.0.1:1080']) {
    withEnv({ SCRAPER_PROXY_URL: url }, () => {
      const agents = proxyAgents();
      assert.ok(agents?.httpAgent && agents?.httpsAgent, url);
    });
  }
});

test('an http proxy builds an agent', () => {
  withEnv({ SCRAPER_PROXY_URL: 'http://127.0.0.1:8080' }, () => {
    const agents = proxyAgents();
    assert.ok(agents?.httpAgent && agents?.httpsAgent);
  });
});

// A typo in an env var must not take every provider down with it.
test('a malformed or unsupported proxy URL is ignored rather than fatal', () => {
  for (const url of ['not a url', 'ftp://127.0.0.1:21', 'gopher://x']) {
    withEnv({ SCRAPER_PROXY_URL: url }, () => {
      assert.equal(proxyAgents(), null, url);
    });
  }
});

test('the agents are built once and reused', () => {
  withEnv({ SCRAPER_PROXY_URL: 'socks5h://127.0.0.1:1080' }, () => {
    assert.equal(proxyAgents(), proxyAgents());
  });
});
