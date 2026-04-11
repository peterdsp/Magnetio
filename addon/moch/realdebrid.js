import axios from 'axios';
import { isValidToken, blacklistToken, selectVideoFile, buildDebridStream, resolveWithCache } from './mochHelper.js';
import { logger } from '../lib/logger.js';

const RD_BASE = 'https://api.real-debrid.com/rest/1.0';
const SERVICE  = 'RD';

// RealDebrid error codes that indicate the token is no longer valid
const AUTH_ERROR_CODES = new Set([8, 9, 20]);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check which of the given infoHashes are instantly available (cached) on RD.
 * Returns a Map<infoHash, true>.
 */
export async function getCachedStreams(streams, apiKey) {
  if (!isValidToken(apiKey)) return new Map();

  const hashes = streams.map(s => s.infoHash).filter(Boolean);
  if (!hashes.length) return new Map();

  try {
    const chunks = chunkArray(hashes, 100); // RD allows up to 100 hashes per request
    const results = new Map();

    for (const chunk of chunks) {
      const url  = `${RD_BASE}/torrents/instantAvailability/${chunk.join('/')}`;
      const { data } = await rdGet(url, apiKey);

      for (const [hash, providers] of Object.entries(data)) {
        if (providers && Object.keys(providers).length) {
          results.set(hash.toLowerCase(), true);
        }
      }
    }

    return results;
  } catch (err) {
    handleRdError(err, apiKey);
    return new Map();
  }
}

/**
 * Resolve a magnet/infoHash to a direct download URL via RealDebrid.
 */
export async function resolve(stream, apiKey) {
  if (!isValidToken(apiKey)) return null;

  const cacheKey = `rd:resolve:${stream.infoHash}:${stream.fileIdx ?? 0}`;
  return resolveWithCache(cacheKey, () => _resolve(stream, apiKey));
}

export async function prewarm(stream, apiKey) {
  if (!isValidToken(apiKey)) return false;

  try {
    const torrentId = await _createOrFindTorrentId(stream.infoHash, apiKey);
    if (!torrentId) return false;

    await _selectVideoFiles(torrentId, stream.fileIdx, apiKey);
    return true;
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
    const { data: torrents } = await rdGet(`${RD_BASE}/torrents`, apiKey, { limit: 25, offset: skip });
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
    // 1. Add or find the torrent
    const torrentId = await _createOrFindTorrentId(stream.infoHash, apiKey);
    if (!torrentId) return null;

    // 2. Select video files
    await _selectVideoFiles(torrentId, stream.fileIdx, apiKey);

    // 3. Wait for the torrent to become ready
    const torrentInfo = await _waitForReady(torrentId, apiKey);
    if (!torrentInfo) return null;

    // 4. Unrestrict the relevant link
    const fileLinks = torrentInfo.links;
    const link      = stream.fileIdx != null && fileLinks[stream.fileIdx]
      ? fileLinks[stream.fileIdx]
      : fileLinks[0];

    if (!link) return null;
    return _unrestrictLink(link, apiKey);
  } catch (err) {
    handleRdError(err, apiKey);
    return null;
  }
}

async function _createOrFindTorrentId(infoHash, apiKey) {
  // Check if already added
  const { data: existing } = await rdGet(`${RD_BASE}/torrents`, apiKey, { limit: 200 });
  const found = existing.find(t => t.hash?.toLowerCase() === infoHash.toLowerCase());
  if (found) return found.id;

  // Add new magnet
  const magnet = `magnet:?xt=urn:btih:${infoHash}`;
  const { data } = await rdPost(`${RD_BASE}/torrents/addMagnet`, apiKey, { magnet });
  return data?.id ?? null;
}

async function _selectVideoFiles(torrentId, fileIdx, apiKey) {
  const { data: info } = await rdGet(`${RD_BASE}/torrents/info/${torrentId}`, apiKey);
  const files = info.files ?? [];

  let selectedIds;
  if (fileIdx != null) {
    selectedIds = String(fileIdx + 1); // RD uses 1-based indices
  } else {
    const video = selectVideoFile(files.map((f, i) => ({ ...f, index: i + 1 })));
    selectedIds = video ? String(video.index) : 'all';
  }

  await rdPost(`${RD_BASE}/torrents/selectFiles/${torrentId}`, apiKey, { files: selectedIds });
}

async function _waitForReady(torrentId, apiKey, retries = 10, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    const { data } = await rdGet(`${RD_BASE}/torrents/info/${torrentId}`, apiKey);
    if (data.status === 'downloaded') return data;
    if (['error', 'dead', 'magnet_error'].includes(data.status)) return null;
    await sleep(delayMs);
  }
  return null;
}

async function _unrestrictLink(link, apiKey) {
  const { data } = await rdPost(`${RD_BASE}/unrestrict/link`, apiKey, { link });
  return data?.download ?? null;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function rdGet(url, apiKey, params = {}) {
  return axios.get(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    params,
    timeout: 15_000,
  });
}

function rdPost(url, apiKey, data = {}) {
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
  }
  logger.warn(`Real-Debrid error (code ${code ?? 'unknown'}): ${err.message}`);
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
