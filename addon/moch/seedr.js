import axios from 'axios';
import { isValidToken, blacklistToken, selectVideoFile, resolveWithCache, tokenScope } from './mochHelper.js';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { logger } from '../lib/logger.js';

/**
 * Seedr -- a torrent-to-own-cloud service (#181).
 *
 * Two things set it apart from the other eight, and both are deliberate here:
 *
 * 1. There is no cache check, and none is possible. Seedr downloads into the
 *    user's own storage rather than a shared pool, so "can you serve this
 *    infohash now" has no meaning. instantAvailability is false and the moch
 *    layer's on-demand path handles it.
 *
 * 2. The configured key is a *refresh* token, not an access token. Seedr's
 *    REST v1 auth is HTTP Basic with the account email and password, which has
 *    no place in a configuration string carried inside an add-on URL. The
 *    device code flow instead yields a long-lived refresh token, which is
 *    revocable and is what we store. Refresh responses carry only a new
 *    access_token and never a new refresh_token, so the configured value stays
 *    valid and nothing has to be written back to the user's URL.
 *
 * Endpoints and error contracts verified directly against the live service.
 */
const SEEDR_TOKEN_URL    = 'https://www.seedr.cc/oauth_test/token.php';
const SEEDR_RESOURCE_URL = 'https://www.seedr.cc/oauth_test/resource.php';

// Seedr's own client id for the password/refresh grant.
const SEEDR_CLIENT_ID = 'seedr_chrome';

// Access tokens are short lived. Cached in memory per account, keyed by
// tokenScope so one user's token is never handed to another, and expired a
// minute early so a request cannot start on a token that dies mid-flight.
const ACCESS_TOKEN_MARGIN_MS = 60_000;
const accessTokens = new Map();

// Seedr names the folder after the torrent and never reports the infohash in
// list_contents, so there is nothing in its responses to match a folder back
// to the hash we asked for. add_torrent does return the title, so it is
// recorded against the infohash when the transfer starts and read back on the
// attempt that finds the finished folder. Long TTL because a Seedr download
// can take a while and the folder then stays until the user deletes it.
const TITLE_CACHE_TTL = 60 * 60 * 24 * 14;
const titleKey = infoHash => `sr:title:${infoHash}`;

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getCachedStreams(streams, apiKey) {
  // No cache-check endpoint exists, and none can: Seedr has no shared pool.
  return new Map();
}

export async function resolve(stream, apiKey) {
  if (!isValidToken(apiKey)) return null;

  const cacheKey = `sr:resolve:${tokenScope(apiKey)}:${stream.infoHash}:${stream.fileIdx ?? 0}`;
  return resolveWithCache(cacheKey, () => _resolve(stream, apiKey));
}

export async function prewarm(stream, apiKey) {
  if (!isValidToken(apiKey)) return false;

  try {
    const token = await accessToken(apiKey);
    const added = await addTorrent(token, stream.infoHash);
    return added !== null;
  } catch (err) {
    handleSeedrError(err, apiKey);
    return false;
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function _resolve(stream, apiKey) {
  try {
    const token = await accessToken(apiKey);

    // Already in the account from a previous add, so it can be served at once.
    // This is the case Seedr is actually good for: a re-watch, or anything the
    // user already downloaded.
    const existing = await findReadyFolder(token, stream.infoHash);
    if (existing) return fileUrlFrom(token, existing, stream.fileIdx);

    // Otherwise start it and give up on this attempt. A fresh Seedr download
    // takes minutes, far longer than a play click will wait, so promising a
    // link here would only produce a stall. The transfer keeps running and the
    // next attempt finds it ready above.
    const added = await addTorrent(token, stream.infoHash);
    if (added === null) return null;

    logger.info(`Seedr: started ${stream.infoHash}, not ready yet`);
    return null;
  } catch (err) {
    handleSeedrError(err, apiKey);
    return null;
  }
}

/**
 * Exchange the configured refresh token for an access token, reusing a cached
 * one while it lasts.
 */
async function accessToken(refreshToken) {
  const scope = tokenScope(refreshToken);
  const cached = accessTokens.get(scope);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     SEEDR_CLIENT_ID,
    refresh_token: refreshToken,
  });

  const { data } = await axios.post(SEEDR_TOKEN_URL, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15_000,
  });

  if (!data?.access_token) {
    // A dead or revoked refresh token answers 400 invalid_grant, which axios
    // throws; an empty body here means something else went wrong.
    throw new Error(data?.error_description ?? data?.error ?? 'no access token returned');
  }

  const expiresIn = Number(data.expires_in) || 0;
  accessTokens.set(scope, {
    token:     data.access_token,
    expiresAt: Date.now() + Math.max(0, expiresIn * 1000 - ACCESS_TOKEN_MARGIN_MS),
  });
  return data.access_token;
}

/**
 * Call resource.php. An expired access token arrives as {"error":"expired_token"}
 * inside a 200 body rather than as a 401, so the caller cannot rely on the
 * status alone; that case is surfaced as a throw for the retry above.
 */
async function resourceCall(token, func, payload = {}) {
  const { data } = await axios.post(
    SEEDR_RESOURCE_URL,
    new URLSearchParams(payload).toString(),
    {
      params:  { access_token: token, func },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20_000,
    }
  );

  if (data?.error === 'expired_token') {
    const err = new Error('expired_token');
    err.expiredToken = true;
    throw err;
  }
  return data;
}

async function addTorrent(token, infoHash) {
  const data = await resourceCall(token, 'add_torrent', {
    torrent_magnet: `magnet:?xt=urn:btih:${infoHash}`,
    folder_id:      '-1',
  });

  // Seedr reports a full account or a plan limit as a result:false with a
  // reason rather than an HTTP error, and in that case nothing was queued.
  if (data?.result === false) {
    logger.warn(`Seedr: add_torrent refused (${data.error ?? data.reason ?? 'unknown reason'})`);
    return null;
  }

  // The only chance to learn the name Seedr will give the folder.
  const title = data?.title ?? data?.name;
  if (title) await cacheSet(titleKey(infoHash), title, TITLE_CACHE_TTL);

  return data ?? null;
}

/**
 * A finished folder for this infohash, or null.
 *
 * Matched by the title recorded when the transfer was started, since nothing
 * in list_contents carries the infohash. Without that title there is no
 * reliable way to tell which folder belongs to this hash, so rather than
 * guessing at a half-match and risking handing back somebody else's file, it
 * reports nothing and lets the add path run again.
 */
async function findReadyFolder(token, infoHash) {
  const title = await cacheGet(titleKey(infoHash));
  if (!title) return null;

  const root = await resourceCall(token, 'list_contents', {
    content_type: 'folder',
    content_id:   '0',
  });

  const wanted = normalise(title);
  const match = (root?.folders ?? []).find(f => normalise(f.name ?? '') === wanted);
  return match?.id ?? null;
}

// Seedr substitutes characters it cannot use in a folder name, so the stored
// title and the folder name are compared on their alphanumerics alone.
function normalise(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

async function fileUrlFrom(token, folderId, fileIdx) {
  const contents = await resourceCall(token, 'list_contents', {
    content_type: 'folder',
    content_id:   String(folderId),
  });

  const files = (contents?.files ?? []).map(f => ({
    name: f.name,
    size: f.size,
    id:   f.folder_file_id ?? f.id,
  }));
  if (!files.length) return null;

  const chosen = fileIdx != null && files[fileIdx]
    ? files[fileIdx]
    : selectVideoFile(files);
  if (!chosen?.id) return null;

  const fetched = await resourceCall(token, 'fetch_file', {
    folder_file_id: String(chosen.id),
  });
  return fetched?.url ?? null;
}

function handleSeedrError(err, apiKey) {
  const status = err.response?.status;
  const code = err.response?.data?.error;

  // 400 invalid_grant on the token endpoint, or access_denied on a resource
  // call, both mean the configured refresh token is no longer usable. An
  // expired access token is a different thing and must not blacklist anything.
  if (!err.expiredToken && (code === 'invalid_grant' || code === 'access_denied' || status === 401)) {
    accessTokens.delete(tokenScope(apiKey));
    blacklistToken(apiKey);
  }
  logger.warn(`Seedr error: ${err.response?.data?.error_description ?? err.message}`);
}

/** Test seam: forget cached access tokens. */
export function resetAccessTokens() {
  accessTokens.clear();
}
