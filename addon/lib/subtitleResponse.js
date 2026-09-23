// Shared response helpers for the /proxy/*.srt subtitle routes.
//
// Stremio's streaming server downloads subtitles with `needle` in its default
// parse mode. Any `application/json` body is parsed into an object before the
// server calls Buffer.concat on the chunks, which throws ERR_INVALID_ARG_TYPE
// and kills the whole streaming server process. Subtitle routes must therefore
// never answer with JSON, not even for errors.

const SUBTITLE_CONTENT_TYPE = 'application/x-subrip; charset=utf-8';

export function sendSubtitle(res, content, { maxAge = 604800, staleSeconds = 604800 } = {}) {
  res.status(200);
  res.setHeader('content-type', SUBTITLE_CONTENT_TYPE);
  res.setHeader(
    'cache-control',
    `public, max-age=${maxAge}, stale-while-revalidate=${staleSeconds}, stale-if-error=${staleSeconds}`,
  );
  res.send(content);
}

export function sendSubtitleError(res, status, message) {
  res.status(status);
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.send(`${message}\n`);
}

// express-rate-limit handler for subtitle routes: plain text, never JSON.
export function subtitleRateLimitHandler(_req, res, _next, options) {
  const status = options?.statusCode || 429;
  const message = typeof options?.message === 'string'
    ? options.message
    : 'Too many subtitle requests, try again later';
  sendSubtitleError(res, status, message);
}
