import axios from 'axios';
import { isValidToken, blacklistToken, selectVideoFile, resolveWithCache, tokenScope } from './mochHelper.js';
import { logger } from '../lib/logger.js';

const TB_BASE = 'https://api.torbox.app/v1/api';

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getCachedStreams(streams, apiKey) {
  if (!isValidToken(apiKey)) return new Map();

  const hashes = streams.map(s => s.infoHash).filter(Boolean);
  if (!hashes.length) return new Map();

  try {
    const { data } = await tbPost(
      `${TB_BASE}/torrents/checkcached`,
      apiKey,
      buildCacheCheckBody(streams),
      { format: 'object', list_files: true },
    );
    if (!data.success) return new Map();
    return parseCachedHashes(data.data);
  } catch (err) {
    handleTbError(err, apiKey, 'checkcached');
    return new Map();
  }
}

export async function resolve(stream, apiKey) {
  if (!isValidToken(apiKey)) return null;

  const cacheKey = `tb:resolve:${tokenScope(apiKey)}:${stream.infoHash}:${stream.fileIdx ?? 0}`;
  return resolveWithCache(cacheKey, () => _resolve(stream, apiKey));
}

export async function prewarm(stream, apiKey) {
  if (!isValidToken(apiKey)) return false;

  try {
    const { data } = await tbPostForm(
      `${TB_BASE}/torrents/createtorrent`,
      apiKey,
      buildTorrentForm(stream.infoHash),
    );

    return !!(data.success && data.data?.torrent_id);
  } catch (err) {
    handleTbError(err, apiKey, 'createtorrent (prewarm)');
    return false;
  }
}

export async function getCatalog(apiKey, type, skip = 0) {
  if (!isValidToken(apiKey)) return [];

  try {
    const { data } = await tbGet(`${TB_BASE}/torrents/mylist`, apiKey, { limit: 25, offset: skip });
    if (!data.success) return [];
    return (data.data ?? []).map(t => ({
      id:          `tb:${t.id}`,
      type,
      name:        t.name,
      poster:      null,
      description: `Size: ${(t.size / 1024 ** 3).toFixed(1)} GB | Status: ${t.download_state}`,
    }));
  } catch (err) {
    handleTbError(err, apiKey, 'mylist (catalog)');
    return [];
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function _resolve(stream, apiKey) {
  let endpoint = 'createtorrent';
  try {
    // Create or locate the torrent
    const { data: addData } = await tbPostForm(
      `${TB_BASE}/torrents/createtorrent`,
      apiKey,
      buildTorrentForm(stream.infoHash, { cachedOnly: true }),
    );

    if (!addData.success) {
      logger.warn(`TorBox createtorrent failed: ${describeTbError(addData)}`);
      return null;
    }

    // A queued_id instead of a torrent_id means it is not ready to stream yet
    const torrentId = addData.data?.torrent_id;
    if (!torrentId) return null;

    // Wait for ready state
    endpoint = 'mylist';
    const info = await _waitForReady(torrentId, apiKey);
    if (!info) return null;

    const files = info.files ?? [];
    const video = selectVideoFile(files.map(f => ({
      name: f.short_name ?? f.name,
      size: f.size,
      id:   f.id,
    })));

    const fileId = video?.id ?? files[0]?.id;
    if (!fileId) return null;

    // Request direct download URL. requestdl authenticates with the `token`
    // query param only; without it TorBox answers 422.
    endpoint = 'requestdl';
    const { data: dlData } = await tbGet(`${TB_BASE}/torrents/requestdl`, apiKey, {
      token:      apiKey,
      torrent_id: torrentId,
      file_id:    fileId,
      zip_link:   false,
    });

    return dlData.data ?? null;
  } catch (err) {
    handleTbError(err, apiKey, endpoint);
    return null;
  }
}

async function _waitForReady(torrentId, apiKey, retries = 10, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    const { data } = await tbGet(`${TB_BASE}/torrents/mylist`, apiKey, { id: torrentId, bypass_cache: true });
    // Queried by id, mylist returns a single object rather than a list
    const torrent = Array.isArray(data.data) ? data.data[0] : data.data;
    if (!torrent) return null;
    if (isReady(torrent)) return torrent;
    if (['error', 'dead'].includes(torrent.download_state)) return null;
    await sleep(delayMs);
  }
  return null;
}

// Cached torrents report states like "cached" or "uploading", never
// "completed"; download_present is what says the files can be streamed.
export function isReady(torrent) {
  return !!(torrent?.download_present || torrent?.download_finished);
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function tbGet(url, apiKey, params = {}) {
  return axios.get(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    params,
    timeout: 15_000,
  });
}

function tbPost(url, apiKey, data = {}, params = {}) {
  return axios.post(url, data, {
    headers: { Authorization: `Bearer ${apiKey}` },
    params,
    timeout: 15_000,
  });
}

function tbPostForm(url, apiKey, data) {
  return axios.postForm(url, data, {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 15_000,
  });
}

export function buildCacheCheckBody(streams) {
  return {
    hashes: [...new Set(streams.map(stream => stream.infoHash?.toLowerCase()).filter(Boolean))],
  };
}

export function buildTorrentForm(infoHash, { cachedOnly = false } = {}) {
  const data = new FormData();
  data.append('magnet', `magnet:?xt=urn:btih:${infoHash}`);
  if (cachedOnly) data.append('add_only_if_cached', 'true');
  return data;
}

export function parseCachedHashes(payload) {
  const entries = Array.isArray(payload)
    ? payload.map(item => [item?.hash, item])
    : Object.entries(payload ?? {}).map(([key, item]) => [item?.hash ?? key, item]);

  return new Map(
    entries
      .filter(([hash, item]) => hash && item)
      .map(([hash]) => [String(hash).toLowerCase(), true]),
  );
}

const AUTH_ERRORS = new Set(['AUTH_ERROR', 'BAD_TOKEN', 'NO_AUTH']);

function handleTbError(err, apiKey, endpoint) {
  const status = err.response?.status;
  const body   = err.response?.data;
  // Only blacklist on real auth failures: a 403 can also carry a plan or
  // limit error, which says nothing about whether the key is valid.
  if (status === 401 || AUTH_ERRORS.has(body?.error) || (status === 403 && !body?.error)) {
    blacklistToken(apiKey);
  }
  const reason = status ? `HTTP ${status}` : (err.code ?? err.message);
  logger.warn(`TorBox ${endpoint} failed: ${reason}${body ? ` ${describeTbError(body)}` : ''}`);
}

/** Summarise a TorBox error body (never includes the API key). */
export function describeTbError(body) {
  const code = body?.error ?? 'UNKNOWN';
  const detail = Array.isArray(body?.detail)
    ? body.detail.map(d => `${(d.loc ?? []).join('.')}: ${d.msg}`).join('; ')
    : body?.detail;
  return detail ? `${code} (${String(detail).slice(0, 200)})` : code;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
