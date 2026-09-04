/**
 * SSRF protection for user-supplied URLs (currently the Torznab base URL).
 *
 * The guard does two things:
 *   1. Resolves the hostname and range-checks every resolved IP against the
 *      private / reserved ranges (the "check").
 *   2. Returns a pinned `lookup` bound to the exact IP it just validated, so the
 *      socket connects to that same address (the "use").
 *
 * Pinning the verified IP closes the DNS-rebinding window: without it the
 * hostname is resolved once for validation and a second time by the HTTP client
 * at connect time, and an attacker controlling DNS could return a public IP for
 * the first lookup and a private one for the second (classic TOCTOU rebinding).
 *
 * Only Node built-ins are used (node:net / node:dns); no third-party IP parser.
 */
import net from 'node:net';
import dns from 'node:dns';

// ─── IPv4 helpers ───────────────────────────────────────────────────────────

function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    n = n * 256 + octet;
  }
  return n >>> 0;
}

function inCidrV4(n, baseStr, bits) {
  const base = ipv4ToInt(baseStr);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (n & mask) === (base & mask);
}

// Private, loopback, link-local (incl. cloud metadata 169.254.169.254), CGNAT,
// broadcast, multicast, documentation and otherwise reserved IPv4 ranges.
const UNSAFE_V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

function isUnsafeV4(n) {
  if (n === null) return true;
  return UNSAFE_V4.some(([base, bits]) => inCidrV4(n, base, bits));
}

// ─── IPv6 helpers ───────────────────────────────────────────────────────────

/** Expand any valid IPv6 text form (incl. embedded IPv4) to 16 bytes, else null. */
function ipv6ToBytes(input) {
  let ip = input.split('%')[0]; // drop zone id, e.g. fe80::1%eth0

  // Fold a trailing embedded IPv4 (::ffff:1.2.3.4, ::1.2.3.4) into two hextets.
  if (ip.includes('.')) {
    const lastColon = ip.lastIndexOf(':');
    if (lastColon === -1) return null;
    const v4 = ipv4ToInt(ip.slice(lastColon + 1));
    if (v4 === null) return null;
    const hi = ((v4 >>> 16) & 0xffff).toString(16);
    const lo = (v4 & 0xffff).toString(16);
    ip = ip.slice(0, lastColon + 1) + hi + ':' + lo;
  }

  const halves = ip.split('::');
  if (halves.length > 2) return null;

  const toGroups = (str) => (str === '' ? [] : str.split(':'));
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : null;

  let groups;
  if (tail === null) {
    groups = head;
  } else {
    const missing = 8 - (head.length + tail.length);
    if (missing < 1) return null; // '::' must stand for at least one group
    groups = [...head, ...Array(missing).fill('0'), ...tail];
  }
  if (groups.length !== 8) return null;

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(groups[i])) return null;
    const value = parseInt(groups[i], 16);
    bytes[i * 2] = (value >> 8) & 0xff;
    bytes[i * 2 + 1] = value & 0xff;
  }
  return bytes;
}

function allZero(bytes, start, end) {
  for (let i = start; i < end; i++) if (bytes[i] !== 0) return false;
  return true;
}

function bytesToV4Int(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) |
          (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function isUnsafeV6(bytes) {
  // IPv4-mapped ::ffff:a.b.c.d, so validate the embedded IPv4.
  if (allZero(bytes, 0, 10) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return isUnsafeV4(bytesToV4Int(bytes, 12));
  }
  // IPv4-compatible / low addresses ::a.b.c.d (top 96 bits zero) incl. :: and ::1.
  if (allZero(bytes, 0, 12)) {
    return isUnsafeV4(bytesToV4Int(bytes, 12));
  }
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if ((bytes[0] & 0xfe) === 0xfc) return true;                      // fc00::/7 unique-local
  if (bytes[0] === 0xff) return true;                              // ff00::/8 multicast
  // 2001:db8::/32 documentation
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return true;
  return false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * True when `ip` is not a globally-routable unicast address, i.e. it falls in a
 * private, loopback, link-local, CGNAT, multicast, reserved or documentation
 * range (or is not a valid IP at all). Unknown / unparseable input is unsafe.
 */
export function isPrivateOrReservedIp(ip) {
  const kind = net.isIP(ip);
  if (kind === 4) return isUnsafeV4(ipv4ToInt(ip));
  if (kind === 6) {
    const bytes = ipv6ToBytes(ip);
    return bytes === null ? true : isUnsafeV6(bytes);
  }
  return true;
}

/**
 * Build a Node `lookup(hostname, options, callback)` that always resolves to a
 * single pre-validated IP, regardless of what DNS would return. Re-checks the
 * address on every call as defense-in-depth, so it can never hand a
 * private/reserved IP to the socket even if reused for another host.
 */
export function pinnedLookup(address, family) {
  const fam = family || net.isIP(address) || 4;
  return function lookup(hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    options = options || {};
    if (isPrivateOrReservedIp(address)) {
      const err = new Error(`Blocked connection to private or reserved address ${address}`);
      err.code = 'EAI_BLOCKED';
      callback(err);
      return;
    }
    // Node may request the full list (options.all, used by autoSelectFamily).
    if (options.all) callback(null, [{ address, family: fam }]);
    else callback(null, address, fam);
  };
}

/**
 * Validate a user-supplied URL and pin the IP the request must connect to.
 *
 * Returns `{ url, hostname, address, family, lookup }` when the URL is http(s),
 * resolves, and every resolved address is public; otherwise `null`. Pass the
 * returned `lookup` to the HTTP client so it connects to `address` while still
 * sending the original hostname (Host header + TLS SNI stay intact).
 *
 * @param {string} urlStr
 * @param {object} [opts]
 * @param {(host: string, options: object) => Promise<Array<{address: string, family: number}>>} [opts.dnsLookup]
 *        DNS resolver override (defaults to dns.promises.lookup); injectable for tests.
 */
export async function resolveSafeTarget(urlStr, opts = {}) {
  let url;
  try {
    url = new URL(urlStr);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const hostname = url.hostname;
  if (!hostname) return null;

  // Cheap denials for obvious internal names. The DNS-resolved IP check below is
  // authoritative; these just reject before touching the resolver.
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return null;
  }

  // URL keeps IPv6 literals bracketed ([::1]); net/dns want them unbracketed.
  const host = hostname.replace(/^\[|\]$/g, '');

  const dnsLookup = opts.dnsLookup || ((h, o) => dns.promises.lookup(h, o));

  let addresses;
  try {
    addresses = await dnsLookup(host, { all: true });
  } catch {
    return null;
  }
  if (!Array.isArray(addresses) || addresses.length === 0) return null;

  // Reject if ANY resolved address is unsafe: DNS round-robin could otherwise
  // hand a private record to the socket even when the first one looked public.
  for (const entry of addresses) {
    if (!entry || isPrivateOrReservedIp(entry.address)) return null;
  }

  const chosen = addresses[0];
  return {
    url,
    hostname,
    address: chosen.address,
    family: chosen.family,
    lookup: pinnedLookup(chosen.address, chosen.family),
  };
}
