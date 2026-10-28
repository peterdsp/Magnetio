/**
 * Per-provider request health.
 *
 * A provider must never throw, so each one catches its own errors and returns
 * an empty array. That makes "this site is gone" indistinguishable from "this
 * search found nothing" to everything upstream, which is how AnimeTosho sat
 * dead for months behind a hostname that no longer resolved (#196).
 *
 * Providers all fetch through lib/httpClient.js with `limiterKey` set to the
 * provider id, so that single chokepoint can record what actually happened to
 * the request without any provider knowing about it. One place to instrument,
 * every provider covered, and nothing for a new provider to remember.
 */
import { logger } from './logger.js';

// Consecutive hard failures before saying so out loud. Low enough to notice a
// dead host quickly, high enough that one timeout stays quiet.
const ALERT_AFTER = 3;

const health = new Map();

function entry(id) {
  if (!health.has(id)) {
    health.set(id, {
      ok: 0, failed: 0, consecutiveFailures: 0,
      // Tally per failure kind. A provider that rotates domains reports the
      // error of whichever host it tried last, so a single lastError cannot
      // say why it is failing; the mix can.
      kinds: {},
      lastOkAt: null, lastFailureAt: null, lastError: null, lastErrorKind: null,
    });
  }
  return health.get(id);
}

/**
 * Classify a request failure. A hostname that no longer resolves is permanent
 * and needs a code change; a timeout or a 5xx is the site having a bad day.
 * Treating them alike is what makes the signal useless.
 *
 * ENOTFOUND and EAI_AGAIN are deliberately not the same thing: the first means
 * the name does not exist, the second that the resolver could not answer right
 * now, which is transient and must not be reported as a dead host.
 *
 * @returns {'dns'|'dns-temporary'|'connection'|'timeout'|'http'|'other'}
 */
export function classifyError(err) {
  const code = err?.code;
  if (code === 'ENOTFOUND') return 'dns';
  if (code === 'EAI_AGAIN') return 'dns-temporary';
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EHOSTUNREACH') return 'connection';
  // Both spellings on purpose: axios says "timeout of 12000ms exceeded" and
  // the aggregator's own wrapper says "timed out", and only matching one of
  // them filed half the timeouts under "other".
  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED'
      || /timed\s?out|timeout/i.test(err?.message ?? '')) return 'timeout';
  if (err?.response?.status) return 'http';
  return 'other';
}

export function recordSuccess(id) {
  if (!id || id === 'default') return;
  const e = entry(id);
  e.ok++;
  e.consecutiveFailures = 0;
  e.lastOkAt = new Date().toISOString();
}

export function recordFailure(id, err) {
  if (!id || id === 'default') return;
  const e = entry(id);
  const kind = classifyError(err);

  e.failed++;
  e.consecutiveFailures++;
  e.kinds[kind] = (e.kinds[kind] ?? 0) + 1;
  e.lastFailureAt = new Date().toISOString();
  e.lastError = err?.message ?? String(err);
  e.lastErrorKind = kind;

  // Only on crossing the threshold, so a persistently dead provider does not
  // reprint on every request. A 'dns' failure is called out as permanent,
  // because that is the case a code change has to fix.
  // Reports the mix rather than prescribing a cause: a provider that rotates
  // domains can fail on three hosts for three different reasons, and naming
  // only the last one sent a reader after the wrong problem.
  if (e.consecutiveFailures === ALERT_AFTER) {
    const mix = Object.entries(e.kinds).map(([k, n]) => `${k}=${n}`).join(' ');
    logger.error(
      `[${id}] ${ALERT_AFTER} consecutive request failures [${mix}], last: ${e.lastError}`
    );
  }
}

/**
 * Current health, worst first, so an operator sees the broken ones at the top.
 */
export function snapshot() {
  return [...health.entries()]
    .map(([id, e]) => ({ id, ...e, healthy: e.consecutiveFailures < ALERT_AFTER }))
    .sort((a, b) => b.consecutiveFailures - a.consecutiveFailures || a.id.localeCompare(b.id));
}

export function reset() {
  health.clear();
}
