import crypto from 'crypto';
import net from 'net';
import { createClient } from 'redis';
import { logger } from './logger.js';

let client = null;
let enabled = false;
let salt = null;

const PREFIX = 'magnetio:stats';

async function getClient() {
  if (client) return client;
  if (!process.env.REDIS_URI) return null;

  try {
    client = createClient({ url: process.env.REDIS_URI });
    client.on('error', err => logger.debug(`Analytics redis error: ${err.message}`));
    await client.connect();
    enabled = true;
    return client;
  } catch (err) {
    logger.debug(`Analytics disabled: ${err.message}`);
    return null;
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Reduce a client IP to the part that identifies a user: IPv4-mapped IPv6 is
 * unwrapped, and IPv6 is cut to its /64 because devices rotate the lower half
 * (privacy addresses) and would otherwise be counted many times.
 */
export function normalizeIp(ip) {
  if (!ip) return null;
  let addr = String(ip).trim().replace(/^::ffff:/i, '');
  if (net.isIPv4(addr)) return addr;
  if (!net.isIPv6(addr)) return null;

  // Expand "::" so the first four groups can be read reliably
  const [head, tail = ''] = addr.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const groups = addr.includes('::')
    ? [...headParts, ...Array(8 - headParts.length - tailParts.length).fill('0'), ...tailParts]
    : headParts;
  return groups.slice(0, 4).map(g => parseInt(g || '0', 16).toString(16)).join(':') + '::/64';
}

/**
 * Salted hash used as the unique-user id. Only this hash reaches Redis, and
 * only inside a HyperLogLog, so raw IPs are never stored.
 */
export function anonymizeIp(ip, secret) {
  const normalized = normalizeIp(ip);
  if (!normalized) return null;
  return crypto.createHmac('sha256', secret).update(normalized).digest('hex').slice(0, 32);
}

async function getSalt(redis) {
  if (salt) return salt;
  if (process.env.STATS_SALT) return (salt = process.env.STATS_SALT);
  // Generate once per Redis instance so ids stay stable across restarts
  const key = `${PREFIX}:salt`;
  await redis.set(key, crypto.randomBytes(32).toString('hex'), { NX: true });
  return (salt = await redis.get(key));
}

export async function trackRequest(type, configHash, clientIp) {
  const redis = await getClient();
  if (!redis) return;

  const day = todayKey();
  try {
    const userId = anonymizeIp(clientIp, await getSalt(redis));
    await Promise.all([
      redis.incr(`${PREFIX}:requests:${day}`),
      redis.incr(`${PREFIX}:requests:total`),
      redis.incr(`${PREFIX}:${type}:${day}`),
      // Distinct addon configurations. Kept under the legacy "users" keys so
      // existing instances keep their history; unique users now come from ips.
      redis.pfAdd(`${PREFIX}:users:${day}`, configHash),
      redis.pfAdd(`${PREFIX}:users:total`, configHash),
      ...(userId ? [
        redis.pfAdd(`${PREFIX}:ips:${day}`, userId),
        redis.pfAdd(`${PREFIX}:ips:total`, userId),
      ] : []),
    ]);
  } catch {
    // analytics are best-effort, never block requests
  }
}

export async function getStats() {
  const redis = await getClient();
  if (!redis) return { enabled: false };

  const day = todayKey();
  try {
    const [
      totalRequests,
      todayRequests,
      todayStreams,
      todayCatalogs,
      todaySubtitles,
      todayPages,
      totalUsers,
      todayUsers,
      totalConfigs,
      todayConfigs,
    ] = await Promise.all([
      redis.get(`${PREFIX}:requests:total`),
      redis.get(`${PREFIX}:requests:${day}`),
      redis.get(`${PREFIX}:stream:${day}`),
      redis.get(`${PREFIX}:catalog:${day}`),
      redis.get(`${PREFIX}:subtitle:${day}`),
      redis.get(`${PREFIX}:page:${day}`),
      redis.pfCount(`${PREFIX}:ips:total`),
      redis.pfCount(`${PREFIX}:ips:${day}`),
      redis.pfCount(`${PREFIX}:users:total`),
      redis.pfCount(`${PREFIX}:users:${day}`),
    ]);

    const last7 = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const [reqs, users] = await Promise.all([
        redis.get(`${PREFIX}:requests:${key}`),
        redis.pfCount(`${PREFIX}:ips:${key}`),
      ]);
      last7.push({ date: key, requests: parseInt(reqs || '0', 10), users });
    }

    return {
      enabled: true,
      total: {
        requests: parseInt(totalRequests || '0', 10),
        uniqueUsers: totalUsers,
        uniqueConfigs: totalConfigs,
      },
      today: {
        date: day,
        requests: parseInt(todayRequests || '0', 10),
        uniqueUsers: todayUsers,
        uniqueConfigs: todayConfigs,
        streams: parseInt(todayStreams || '0', 10),
        catalogs: parseInt(todayCatalogs || '0', 10),
        subtitles: parseInt(todaySubtitles || '0', 10),
        pages: parseInt(todayPages || '0', 10),
      },
      last7days: last7,
    };
  } catch (err) {
    return { enabled: true, error: err.message };
  }
}
