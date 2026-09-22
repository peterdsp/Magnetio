import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIp, anonymizeIp } from '../lib/analytics.js';

test('normalizeIp keeps IPv4 and unwraps IPv4-mapped IPv6', () => {
  assert.equal(normalizeIp('203.0.113.7'), '203.0.113.7');
  assert.equal(normalizeIp('::ffff:203.0.113.7'), '203.0.113.7');
});

test('normalizeIp reduces IPv6 to its /64 so rotating addresses count once', () => {
  assert.equal(normalizeIp('2001:db8:abcd:12:1111:2222:3333:4444'), '2001:db8:abcd:12::/64');
  assert.equal(normalizeIp('2001:db8:abcd:12:aaaa::1'), '2001:db8:abcd:12::/64');
  assert.equal(normalizeIp('2001:db8::1'), '2001:db8:0:0::/64');
});

test('normalizeIp rejects empty and invalid input', () => {
  assert.equal(normalizeIp(undefined), null);
  assert.equal(normalizeIp(''), null);
  assert.equal(normalizeIp('not-an-ip'), null);
});

test('anonymizeIp is stable per salt and never contains the IP', () => {
  const a = anonymizeIp('203.0.113.7', 'salt-1');
  assert.equal(a, anonymizeIp('203.0.113.7', 'salt-1'));
  assert.notEqual(a, anonymizeIp('203.0.113.7', 'salt-2'));
  assert.notEqual(a, anonymizeIp('203.0.113.8', 'salt-1'));
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.ok(!a.includes('203'));
});

test('anonymizeIp gives one id for addresses in the same IPv6 /64', () => {
  assert.equal(
    anonymizeIp('2001:db8:abcd:12::1', 's'),
    anonymizeIp('2001:db8:abcd:12:ffff:ffff:ffff:ffff', 's'),
  );
});
