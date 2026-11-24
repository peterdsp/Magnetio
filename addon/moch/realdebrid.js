import axios from 'axios';
import { isValidToken, blacklistToken, selectVideoFile, tokenScope } from './mochHelper.js';
import { logger } from '../lib/logger.js';
import { getClientIp } from '../lib/requestContext.js';

const RD_BASE = 'https://api.real-debrid.com/rest/1.0';

// RealDebrid error codes that indicate the token is no longer valid
const AUTH_ERROR_CODES = new Set([8, 9, 20]);
// Errors that mean the specific torrent/file is unusable (not an account issue)
const CONTENT_ERROR_CODES = new Set([35, 36]);

// ─── Public API ───────────────────────────────────────────────────────────────

const inFlight = new Map();
const preparing = new Map();
const TERMINAL_STATES = new Set(['error', 'dead', 'magnet_error', 'virus']);

/**
 * Check which of the given infoHashes are available on RD.
 * Returns a Map<infoHash, true>.
 *
 * This is a read-only, partial view of the user's account library. Unmatched
 * hashes remain playable candidates. Download preparation is a separate,
 * bounded background step; this lookup never adds or deletes torrents.
 */
export async function getCachedStreams(streams, apiKey) {
  if (!isValidToken(apiKey)) return new Map();

  const hashes = streams.map(s => s.infoHash).filter(Boolean);
  if (!hashes.length) return new Map();

  const results = new Map();

  try {
    const torrents = await listTorrents(apiKey, { limit: 200 }, 2000);

    const hashSet = new Set(hashes.map(h => h.toLowerCase()));

    for (const t of torrents) {
      if (t.hash && hashSet.has(t.hash.toLowerCase()) && t.status === 'downloaded') {
        results.set(t.hash.toLowerCase(), true);
      }
    }

    logger.info(`RD library check: ${results.size}/${hashes.length} already downloaded`);
    return results;
  } catch (err) {
    handleRdError(err, apiKey);
    return results;
  }
}

/**
 * Resolve a magnet/infoHash to a direct download URL via RealDebrid.
 */
export async function resolve(stream, apiKey) {
  if (!isValidToken(apiKey)) return null;
  // A player's simultaneous/retried HTTP requests must not add duplicate jobs.
  // Links can be IP-bound, so never share a result across account/IP contexts.
  const scope = `${tokenScope(apiKey)}:${getClientIp() || ''}:${stream.infoHash}:${stream.fileIdx ?? 'auto'}:${stream.videoId || ''}`;
  if (inFlight.has(scope)) return inFlight.get(scope);
  const pending = _resolve(stream, apiKey).finally(() => inFlight.delete(scope));
  inFlight.set(scope, pending);
  return pending;
}

export async function prewarm(stream, apiKey) {
  if (!isValidToken(apiKey)) return false;

  try {
    return !!(await prepareForStream(stream, apiKey));
  } catch (err) {
    handleRdError(err, apiKey);
    return false;
  }
}

/**
 * Fetch the user's RD downloads/torrents for catalog display.
 */
export async function getCatalog(apiKey, type, skip = 0) {
  if (!isValidToken(apiKey)) return [];

  try {
    const torrents = await listTorrents(apiKey, { limit: 25, offset: skip });
    return torrents.map(t => ({
      id:          `rd:${t.hash}`,
      type,
      name:        t.filename,
      poster:      null,
      description: `Size: ${(t.bytes / 1024 ** 3).toFixed(1)} GB | Progress: ${t.progress}%`,
    }));
  } catch (err) {
    handleRdError(err, apiKey);
    return [];
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function _resolve(stream, apiKey) {
  try {
    // Reuse prewarm's preparation, including one still running when play is pressed.
    const prepared = await prepareForStream(stream, apiKey);
    if (!prepared) return null;
    const { torrentId } = prepared;

    // 3. Wait for the torrent to become ready
    const torrentInfo = prepared.info.status === 'downloaded'
      ? prepared.info : await _waitForReady(torrentId, apiKey);
    if (!torrentInfo) return null;

    // 4. Unrestrict the relevant link
    // RD links correspond to selected files, not the original torrent index.
    const selected = (torrentInfo.files ?? []).filter(file => file.selected === 1);
    const linkIndex = selected.findIndex(file => file.id === prepared.file.id);
    const link = linkIndex < 0 ? null : torrentInfo.links?.[linkIndex];

    if (!link) return null;
    return _unrestrictLink(link, apiKey);
  } catch (err) {
    handleRdError(err, apiKey);
    return null;
  }
}

async function prepareForStream(stream, apiKey) {
  const scope = `${tokenScope(apiKey)}:${stream.infoHash}:${stream.fileIdx ?? 'auto'}:${stream.videoId || ''}`;
  if (preparing.has(scope)) return preparing.get(scope);
  const task = prepareAccountTorrent(stream, apiKey).finally(() => preparing.delete(scope));
  preparing.set(scope, task);
  return task;
}

async function prepareAccountTorrent(stream, apiKey) {
  const existing = await listTorrents(apiKey, { limit: 200 });
  const candidates = existing.filter(t => t.hash?.toLowerCase() === stream.infoHash.toLowerCase() && !TERMINAL_STATES.has(t.status));
  for (const candidate of candidates) {
    const prepared = await prepareVideo(candidate.id, stream, apiKey);
    if (!prepared) return null;
    // Do not alter another episode's selection or duplicate a later matching job.
    if (!prepared.needsSeparateJob) return { ...prepared, torrentId: candidate.id };
  }

  const torrentId = await addTorrent(stream.infoHash, apiKey);
  if (!torrentId) return null;
  const prepared = await prepareVideo(torrentId, stream, apiKey);
  return prepared && !prepared.needsSeparateJob ? { ...prepared, torrentId } : null;
}

async function addTorrent(infoHash, apiKey) {
  const magnet = `magnet:?xt=urn:btih:${infoHash}`;
  const { data } = await rdPost(`${RD_BASE}/torrents/addMagnet`, apiKey, { magnet });
  return data?.id ?? null;
}

export function selectRequestedVideo(files, stream) {
  const videos = files.filter(file => selectVideoFile([file]));
  if (stream.fileIdx != null) {
    const file = files[stream.fileIdx];
    return videos.includes(file) ? file : null;
  }
  const episode = stream.videoId?.match(/:(\d+):(\d+)$/);
  if (episode) {
    const [, season, number] = episode;
    const marker = new RegExp(`(?:\\bs0*${Number(season)}[ ._-]*e0*${Number(number)}\\b|\\b0*${Number(season)}x0*${Number(number)}\\b)`, 'i');
    const matches = videos.filter(file => marker.test(file.path ?? file.name ?? ''));
    if (matches.length) return selectVideoFile(matches.map(file => ({ ...file, size: file.bytes ?? file.size })));
    // Single-episode releases can lack episode markers; never guess within a pack.
    if (videos.length !== 1 || /(?:\bs\d+[ ._-]*e\d+\b|\b\d+x\d+\b)/i.test(videos[0].path ?? videos[0].name ?? '')) return null;
  }
  return selectVideoFile(videos.map(file => ({ ...file, size: file.bytes ?? file.size })));
}

async function prepareVideo(torrentId, stream, apiKey) {
  // New magnets can spend time discovering metadata before file IDs exist.
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data: info } = await rdGet(`${RD_BASE}/torrents/info/${torrentId}`, apiKey);
    if (TERMINAL_STATES.has(info.status)) return null;
    const files = info.files ?? [];
    if (!files.length && info.status === 'magnet_conversion') {
      await sleep(1000);
      continue;
    }
    const file = selectRequestedVideo(files, stream);
    if (!file) return null; // Never select installers, unrelated episodes or all files.
    if (file.selected === 1 && info.status !== 'waiting_files_selection') return { info, file };
    if (info.status !== 'waiting_files_selection') return { needsSeparateJob: true };
    await rdPost(`${RD_BASE}/torrents/selectFiles/${torrentId}`, apiKey, { files: String(file.id) });
    return { info, file };
  }
  return null;
}

async function _waitForReady(torrentId, apiKey, retries = 10, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    const { data } = await rdGet(`${RD_BASE}/torrents/info/${torrentId}`, apiKey);
    if (data.status === 'downloaded') return data;
    if (TERMINAL_STATES.has(data.status)) return null;
    await sleep(delayMs);
  }
  return null;
}

async function _unrestrictLink(link, apiKey) {
  const { data } = await rdPost(`${RD_BASE}/unrestrict/link`, apiKey, { link });
  return data?.download ?? null;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function rdGet(url, apiKey, params = {}, timeout = 15_000) {
  return axios.get(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    params,
    timeout,
  });
}

// GET /torrents answers 204 No Content (an empty body, which axios hands back
// as '') when the library is empty or the offset is past the end. Treat any
// body that is not a list as no torrents rather than letting callers crash.
async function listTorrents(apiKey, params, timeout) {
  const { data } = await rdGet(`${RD_BASE}/torrents`, apiKey, params, timeout);
  return Array.isArray(data) ? data : [];
}

function rdPost(url, apiKey, data = {}) {
  const clientIp = getClientIp();
  if (clientIp) {
    data.ip = clientIp;
  }
  const form = new URLSearchParams(data);
  return axios.post(url, form.toString(), {
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 15_000,
  });
}

function handleRdError(err, apiKey) {
  const code = err.response?.data?.error_code;
  if (AUTH_ERROR_CODES.has(code)) {
    blacklistToken(apiKey);
    logger.error(`Real-Debrid auth error (code ${code}), token blacklisted`);
    return;
  }
  if (CONTENT_ERROR_CODES.has(code)) {
    logger.info(`Real-Debrid content unavailable (code ${code}): ${err.message}`);
    return;
  }
  logger.warn(`Real-Debrid error (code ${code ?? 'unknown'}): ${err.message}`);
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
