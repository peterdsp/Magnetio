import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isPrivateOrReservedIp,
  pinnedLookup,
  resolveSafeTarget,
} from '../lib/ssrf.js';

// Promisified pinnedLookup helpers for assertions.
function callLookup(lookup, options = {}) {
  return new Promise((resolve, reject) => {
    lookup('any-host.example', options, (err, address, family) => {
      if (err) reject(err);
      else resolve({ address, family });
    });
  });
}

// ─── isPrivateOrReservedIp ─────────────────────────────────────────────────────

test('isPrivateOrReservedIp flags private / reserved IPv4', () => {
  for (const ip of [
    '0.0.0.0', '10.0.0.1', '10.255.255.255', '100.64.0.1', '127.0.0.1',
    '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.0.2.1',
    '192.168.1.1', '198.18.0.5', '198.51.100.7', '203.0.113.9',
    '224.0.0.1', '240.0.0.1', '255.255.255.255',
  ]) {
    assert.equal(isPrivateOrReservedIp(ip), true, `${ip} should be unsafe`);
  }
});

test('isPrivateOrReservedIp allows public IPv4', () => {
  for (const ip of [
    '8.8.8.8', '1.1.1.1', '93.184.216.34',
    '172.15.255.255', '172.32.0.1', '100.63.255.255', '11.0.0.1',
  ]) {
    assert.equal(isPrivateOrReservedIp(ip), false, `${ip} should be safe`);
  }
});

test('isPrivateOrReservedIp flags private / reserved IPv6', () => {
  for (const ip of [
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1',
    '2001:db8::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:169.254.169.254',
  ]) {
    assert.equal(isPrivateOrReservedIp(ip), true, `${ip} should be unsafe`);
  }
});

test('isPrivateOrReservedIp allows public IPv6', () => {
  for (const ip of ['2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8']) {
    assert.equal(isPrivateOrReservedIp(ip), false, `${ip} should be safe`);
  }
});

test('isPrivateOrReservedIp treats non-IP input as unsafe', () => {
  for (const value of ['', 'not-an-ip', 'example.com', '999.1.1.1', '::gggg']) {
    assert.equal(isPrivateOrReservedIp(value), true, `${value} should be unsafe`);
  }
});

// ─── pinnedLookup ──────────────────────────────────────────────────────────────

test('pinnedLookup returns the pinned address for all callback shapes', async () => {
  const lookup = pinnedLookup('8.8.8.8', 4);

  assert.deepEqual(await callLookup(lookup, {}), { address: '8.8.8.8', family: 4 });
  assert.deepEqual(await callLookup(lookup, { family: 4 }), { address: '8.8.8.8', family: 4 });

  // options.all -> array form (used by autoSelectFamily)
  const all = await new Promise((resolve, reject) =>
    lookup('h', { all: true }, (err, addrs) => (err ? reject(err) : resolve(addrs))));
  assert.deepEqual(all, [{ address: '8.8.8.8', family: 4 }]);

  // options omitted -> (hostname, callback)
  const short = await new Promise((resolve, reject) =>
    lookup('h', (err, address, family) => (err ? reject(err) : resolve({ address, family }))));
  assert.deepEqual(short, { address: '8.8.8.8', family: 4 });
});

test('pinnedLookup derives IPv6 family and returns it', async () => {
  const lookup = pinnedLookup('2606:4700:4700::1111');
  assert.deepEqual(await callLookup(lookup, {}), { address: '2606:4700:4700::1111', family: 6 });
});

test('pinnedLookup refuses to hand out a private address (defense in depth)', async () => {
  const lookup = pinnedLookup('10.0.0.1', 4);
  await assert.rejects(callLookup(lookup, {}), (err) => {
    assert.equal(err.code, 'EAI_BLOCKED');
    return true;
  });
});

// ─── resolveSafeTarget ─────────────────────────────────────────────────────────

test('resolveSafeTarget rejects non-http(s) protocols', async () => {
  for (const url of ['ftp://example.com/', 'file:///etc/passwd', 'gopher://x/']) {
    assert.equal(await resolveSafeTarget(url), null, url);
  }
});

test('resolveSafeTarget rejects malformed URLs', async () => {
  assert.equal(await resolveSafeTarget('not a url'), null);
  assert.equal(await resolveSafeTarget(''), null);
});

test('resolveSafeTarget rejects internal hostnames without resolving', async () => {
  const explode = () => { throw new Error('resolver must not be called'); };
  for (const url of [
    'http://localhost/', 'http://LOCALHOST:9117/', 'http://box.local/',
    'http://svc.internal/', 'http://app.localhost/',
  ]) {
    assert.equal(await resolveSafeTarget(url, { dnsLookup: explode }), null, url);
  }
});

test('resolveSafeTarget rejects private IP literals (no network)', async () => {
  for (const url of [
    'http://127.0.0.1:9117/', 'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.5/', 'http://[::1]/', 'http://[fd00::1]/',
  ]) {
    assert.equal(await resolveSafeTarget(url), null, url);
  }
});

test('resolveSafeTarget rejects encoded-integer IP hosts (decimal/hex/octal/short)', async () => {
  // WHATWG new URL() canonicalises these numeric forms to dotted-decimal
  // (127.0.0.1 / 192.168.0.1), which the range check then rejects. All are
  // numeric hosts, so dns.lookup short-circuits and no network is touched.
  for (const url of [
    'http://2130706433/',   // decimal 127.0.0.1
    'http://0x7f000001/',   // hex 127.0.0.1
    'http://0177.0.0.1/',   // octal first octet -> 127.0.0.1
    'http://127.1/',        // short form -> 127.0.0.1
    'http://3232235521/',   // decimal 192.168.0.1
    'http://0xC0A80001/',   // hex 192.168.0.1
  ]) {
    assert.equal(await resolveSafeTarget(url), null, url);
  }
});

test('resolveSafeTarget fails closed when DNS resolution is too slow', async () => {
  // Resolver that only answers after the timeout window. It still settles (so
  // no promise leaks in the test runner), but resolveSafeTarget must give up
  // first and return null.
  const slow = () =>
    new Promise((resolve) => setTimeout(() => resolve([{ address: '8.8.8.8', family: 4 }]), 60));
  assert.equal(
    await resolveSafeTarget('http://slow-resolver.example/', { dnsLookup: slow, dnsTimeoutMs: 20 }),
    null,
  );
});

test('resolveSafeTarget accepts a public IP literal and pins it', async () => {
  const target = await resolveSafeTarget('http://8.8.8.8:9117/api');
  assert.ok(target);
  assert.equal(target.address, '8.8.8.8');
  assert.equal(target.hostname, '8.8.8.8');
  assert.equal(typeof target.lookup, 'function');
});

test('resolveSafeTarget pins the validated IP even if DNS later rebinds', async () => {
  // Simulate the check returning a public address...
  const target = await resolveSafeTarget('http://scanner.example/api', {
    dnsLookup: async () => [{ address: '93.184.216.34', family: 4 }],
  });
  assert.ok(target);
  assert.equal(target.address, '93.184.216.34');

  // ...and confirm the pinned lookup keeps returning that same address (it does
  // NOT re-resolve), so a rebind to a private IP at connect time cannot happen.
  const resolved = await callLookup(target.lookup, { all: false });
  assert.deepEqual(resolved, { address: '93.184.216.34', family: 4 });
});

test('resolveSafeTarget rejects when DNS resolves to a private address', async () => {
  const target = await resolveSafeTarget('http://rebind.example/api', {
    dnsLookup: async () => [{ address: '127.0.0.1', family: 4 }],
  });
  assert.equal(target, null);
});

test('resolveSafeTarget rejects when ANY resolved address is private', async () => {
  const target = await resolveSafeTarget('http://mixed.example/api', {
    dnsLookup: async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ],
  });
  assert.equal(target, null);
});

test('resolveSafeTarget rejects an IPv4-mapped private address', async () => {
  const target = await resolveSafeTarget('http://mapped.example/api', {
    dnsLookup: async () => [{ address: '::ffff:169.254.169.254', family: 6 }],
  });
  assert.equal(target, null);
});

test('resolveSafeTarget returns null on resolver failure or empty result', async () => {
  assert.equal(await resolveSafeTarget('http://nxdomain.example/', {
    dnsLookup: async () => { throw Object.assign(new Error('nope'), { code: 'ENOTFOUND' }); },
  }), null);
  assert.equal(await resolveSafeTarget('http://empty.example/', {
    dnsLookup: async () => [],
  }), null);
});
