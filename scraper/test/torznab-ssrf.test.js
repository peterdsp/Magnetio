import test from 'node:test';
import assert from 'node:assert/strict';

import { isUrlSafe, isPrivateIp } from '../providers/torznab.js';

// Each of these hostnames resolves to an internal address but is written in a
// form the old string/prefix checks missed. isUrlSafe() must reject them all.
// All are IP literals, so no DNS lookup happens and the tests stay offline.
const UNSAFE_URLS = [
  // Loopback 127.0.0.1 in every IPv4 encoding.
  'http://127.0.0.1/',
  'http://2130706433/',      // decimal
  'http://0x7f000001/',      // hex
  'http://0177.0.0.1/',      // octal first octet
  'http://017700000001/',    // full octal
  'http://0x7f.0.0.1/',      // mixed hex
  'http://127.1/',           // short form
  // Private and reserved IPv4 ranges, including numeric encodings.
  'http://10.0.0.1/',
  'http://192.168.1.1/',
  'http://3232235521/',      // decimal 192.168.0.1
  'http://0xC0A80001/',      // hex 192.168.0.1
  'http://172.16.0.1/',
  'http://172.31.255.255/',
  'http://169.254.169.254/', // cloud metadata
  'http://100.64.0.1/',      // carrier-grade NAT
  'http://0.0.0.0/',
  // IPv6 loopback / unspecified / internal ranges.
  'http://[::1]/',
  'http://[::]/',
  'http://[fe80::1]/',       // link-local
  'http://[fc00::1]/',       // unique local
  'http://[fd12:3456:789a::1]/',
  'http://[ff02::1]/',       // multicast
  // IPv4-mapped and IPv4-compatible IPv6 pointing back at internal v4.
  'http://[::ffff:127.0.0.1]/',
  'http://[::ffff:7f00:1]/',
  'http://[::ffff:10.0.0.1]/',
  'http://[::ffff:169.254.169.254]/',
  'http://[::ffff:a9fe:a9fe]/',
  'http://[::127.0.0.1]/',
];

for (const url of UNSAFE_URLS) {
  test(`isUrlSafe rejects internal address: ${url}`, async () => {
    assert.equal(await isUrlSafe(url), false);
  });
}

// Hostname forms that should never reach the network.
const UNSAFE_NAMES = [
  'http://localhost/',
  'http://localhost:9117/',
  'http://foo.local/',
  'http://service.internal/',
  'http://metadata.google.internal/',
];

for (const url of UNSAFE_NAMES) {
  test(`isUrlSafe rejects internal hostname: ${url}`, async () => {
    assert.equal(await isUrlSafe(url), false);
  });
}

// Non-HTTP schemes and malformed input.
const REJECTED_INPUT = [
  'ftp://example.com/',
  'file:///etc/passwd',
  'gopher://127.0.0.1/',
  'not a url',
  '',
];

for (const url of REJECTED_INPUT) {
  test(`isUrlSafe rejects non-HTTP or malformed input: ${JSON.stringify(url)}`, async () => {
    assert.equal(await isUrlSafe(url), false);
  });
}

// Public IP literals must still be allowed (these need no DNS lookup).
const SAFE_URLS = [
  'http://1.1.1.1/',
  'https://8.8.8.8/',
  'https://93.184.216.34:9117/torznab/api',
  'http://172.15.0.1/',   // just below the 172.16.0.0/12 block
  'http://172.32.0.1/',   // just above it
  'http://11.0.0.1/',     // adjacent to 10.0.0.0/8
  'http://126.255.255.255/', // just below 127.0.0.0/8
  'http://128.0.0.1/',    // just above it
  'http://[2606:4700:4700::1111]/',
  'http://[2a00:1450:4001:800::200e]/',
];

for (const url of SAFE_URLS) {
  test(`isUrlSafe allows public address: ${url}`, async () => {
    assert.equal(await isUrlSafe(url), true);
  });
}

// Direct range-boundary checks on the classifier.
test('isPrivateIp flags private and reserved IPv4 ranges', () => {
  for (const ip of ['0.0.0.0', '10.0.0.1', '100.64.0.0', '100.127.255.255',
    '127.0.0.1', '169.254.169.254', '172.16.0.0', '172.31.255.255',
    '192.168.0.1', '198.18.0.1', '224.0.0.1', '255.255.255.255']) {
    assert.equal(isPrivateIp(ip), true, `${ip} should be private`);
  }
});

test('isPrivateIp allows public IPv4 just outside each range', () => {
  for (const ip of ['1.1.1.1', '8.8.8.8', '100.63.255.255', '100.128.0.0',
    '172.15.255.255', '172.32.0.0', '192.167.255.255', '192.169.0.0',
    '198.17.255.255', '198.20.0.0', '223.255.255.255']) {
    assert.equal(isPrivateIp(ip), false, `${ip} should be public`);
  }
});

test('isPrivateIp flags internal IPv6 and IPv4-mapped forms', () => {
  for (const ip of ['::1', '::', '::ffff:127.0.0.1', '::ffff:7f00:1',
    '::ffff:10.0.0.1', 'fe80::1', 'fc00::1', 'fd00::1', 'ff02::1']) {
    assert.equal(isPrivateIp(ip), true, `${ip} should be private`);
  }
});

test('isPrivateIp allows public IPv6', () => {
  for (const ip of ['2606:4700:4700::1111', '2a00:1450:4001:800::200e']) {
    assert.equal(isPrivateIp(ip), false, `${ip} should be public`);
  }
});
