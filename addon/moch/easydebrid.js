import axios from 'axios';
import { isValidToken, blacklistToken, resolveWithCache, tokenScope } from './mochHelper.js';
import { logger } from '../lib/logger.js';

const ED_BASE = 'https://easydebrid.com/api/v1';

// After a 429, EasyDebrid is left alone for this long unless it sends a
// Retry-After. Without the pause, every queued resolve for the same token hits
// the API within the same second and is rejected too.
const RATE_LIMIT_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_MS = 15 * 60_000;
const cooldownUntil = new Map(); // tokenScope -> epoch ms

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getCachedStreams(streams, apiKey) {
  if (!isValidToken(apiKey)) return new Map();

  const hashes = streams.map(s => s.infoHash).filter(Boolean);
  if (!hashes.length || isCoolingDown(apiKey)) return new Map();

  try {
    const { data } = await axios.post(
      `${ED_BASE}/link/lookup`,
      { urls: hashes.map(h => `magnet:?xt=urn:btih:${h}`) },
      { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 15_000 }
    );

    const result = new Map();
    (data.cached ?? []).forEach((cached, i) => {
      if (cached) result.set(hashes[i].toLowerCase(), true);
    });
    return result;
  } catch (err) {
    handleEdError(err, apiKey);
    return new Map();
  }
}

export async function resolve(stream, apiKey, { signal } = {}) {
  if (!isValidToken(apiKey)) return null;

  const cacheKey = `ed:resolve:${tokenScope(apiKey)}:${stream.infoHash}`;
  return resolveWithCache(cacheKey, () => _resolve(stream, apiKey, signal));
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function _resolve(stream, apiKey, signal) {
  if (isCoolingDown(apiKey)) return null;
  try {
    const { data } = await axios.post(
      `${ED_BASE}/link/generate`,
      { url: `magnet:?xt=urn:btih:${stream.infoHash}` },
      { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 20_000, signal }
    );
    return data.url ?? null;
  } catch (err) {
    handleEdError(err, apiKey);
    return null;
  }
}

// ─── Error handling ───────────────────────────────────────────────────────────

function handleEdError(err, apiKey) {
  // The caller gave up (resolve timeout) and already logs that.
  if (axios.isCancel(err)) return;
  if (err.response?.status === 429) {
    const seconds = startCooldown(apiKey, err.response.headers?.['retry-after']);
    // Requests already in flight when the first 429 landed are not re-logged.
    if (seconds != null) logger.warn(`EasyDebrid rate limited (429), pausing this token for ${seconds}s`);
    return;
  }
  if (err.response?.status === 401) blacklistToken(apiKey);
  logger.warn(`EasyDebrid error: ${err.message}`);
}

function isCoolingDown(apiKey) {
  const scope = tokenScope(apiKey);
  const until = cooldownUntil.get(scope);
  if (until == null) return false;
  if (Date.now() < until) return true;
  cooldownUntil.delete(scope);
  return false;
}

/** Returns the new pause in seconds, or null when one was already running. */
function startCooldown(apiKey, retryAfter) {
  const now = Date.now();
  const scope = tokenScope(apiKey);
  if ((cooldownUntil.get(scope) ?? 0) > now) return null;
  for (const [key, until] of cooldownUntil) {
    if (until <= now) cooldownUntil.delete(key);
  }
  const ms = Math.min(parseRetryAfter(retryAfter, now) ?? RATE_LIMIT_COOLDOWN_MS, MAX_COOLDOWN_MS);
  cooldownUntil.set(scope, now + ms);
  return Math.ceil(ms / 1000);
}

// Retry-After is either delta-seconds or an HTTP date.
function parseRetryAfter(value, now) {
  if (value == null || String(value).trim() === '') return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds > 0 ? seconds * 1000 : null;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now) || null;
}
