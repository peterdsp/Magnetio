import test from 'node:test';
import assert from 'node:assert/strict';

import { parseConfiguration } from '../lib/configuration.js';
import { manifest, dummyManifest } from '../lib/manifest.js';
import { buildSubtitleSearchParams, resolveSubtitleLanguages } from '../lib/subtitles.js';
import { toStreamInfo } from '../lib/streamInfo.js';
import { computeOpenSubtitlesHashFromBuffers, createStreamSubtitleProxies } from '../lib/subtitleProxy.js';
import { pickPrewarmCandidates } from '../moch/moch.js';

test('configuration parser supports subtitle languages', () => {
  const config = parseConfiguration('providers=yts,eztv|subtitleLanguages=en,es|limit=20');

  assert.deepEqual(config.providers, ['yts', 'eztv']);
  assert.deepEqual(config.subtitleLanguages, ['en', 'es']);
  assert.equal(config.limit, 20);
});

test('configuration parser supports debrid prewarm controls', () => {
  const config = parseConfiguration('prewarm=0|prewarmLimit=5');

  assert.equal(config.prewarmDebrid, false);
  assert.equal(config.prewarmLimit, 5);
});

test('dummy manifest advertises configurable subtitles-enabled addon surface', () => {
  const rootManifest = dummyManifest();

  assert.equal(rootManifest.behaviorHints.configurable, true);
  assert.equal(rootManifest.behaviorHints.p2p, true);
  assert.ok(rootManifest.resources.some(resource => resource.name === 'subtitles'));
});

test('configured manifest exposes subtitle resource and p2p hint', () => {
  const addonManifest = manifest(parseConfiguration('providers=yts|rd=abcdefghijklmnop'));

  assert.equal(addonManifest.behaviorHints.p2p, true);
  assert.ok(addonManifest.resources.some(resource => resource.name === 'stream'));
  assert.ok(addonManifest.resources.some(resource => resource.name === 'subtitles'));
});

test('subtitle search uses imdb ids for movies and preferred subtitle languages', () => {
  const params = buildSubtitleSearchParams(
    {
      type: 'movie',
      id: 'tt1254207',
      extra: { filename: 'Big.Buck.Bunny.1080p.mkv' },
    },
    { subtitleLanguages: ['en', 'fr'] }
  );

  assert.equal(params.imdb_id, '1254207');
  assert.equal(params.type, 'movie');
  assert.equal(params.languages, 'en,fr');
  assert.equal(params.query, 'Big.Buck.Bunny.1080p');
});

test('subtitle search uses parent imdb and episode coordinates for series', () => {
  const params = buildSubtitleSearchParams(
    {
      type: 'series',
      id: 'tt0944947:1:2',
      extra: { videoHash: 'abc123' },
    },
    { subtitleLanguages: ['en'] }
  );

  assert.equal(params.parent_imdb_id, '0944947');
  assert.equal(params.season_number, 1);
  assert.equal(params.episode_number, 2);
  assert.equal(params.moviehash, 'abc123');
  assert.equal(params.type, 'episode');
});

test('subtitle language preferences fall back to audio languages and then english', () => {
  assert.deepEqual(resolveSubtitleLanguages({ subtitleLanguages: ['pt', 'en'] }), ['pt', 'en']);
  assert.deepEqual(resolveSubtitleLanguages({ languages: ['es', 'multi'] }), ['es']);
  assert.deepEqual(resolveSubtitleLanguages({}), ['en']);
});

test('stream info exposes tracker sources and subtitle matching hints', () => {
  const stream = toStreamInfo({
    infoHash: 'abcdef0123456789abcdef0123456789abcdef01',
    title: 'Example.Release.1080p.WEB-DL.x265',
    provider: 'YTS',
    seeders: 42,
    size: 2 * 1024 * 1024 * 1024,
    codec: 'HEVC',
    source: 'WEB-DL',
    trackers: ['udp://tracker.example:1337/announce'],
  }, {});

  assert.equal(stream.infoHash, 'abcdef0123456789abcdef0123456789abcdef01');
  assert.deepEqual(stream.sources, ['tracker:udp://tracker.example:1337/announce']);
  assert.equal(stream.behaviorHints.filename, 'Example.Release.1080p.WEB-DL.x265');
  assert.equal(stream.behaviorHints.videoSize, 2 * 1024 * 1024 * 1024);
  assert.match(stream.description, /WEB-DL/);
});

test('opensubtitles hash helper uses file size and both edge chunks', () => {
  const first = Buffer.alloc(64 * 1024);
  const last = Buffer.alloc(64 * 1024);

  first.writeBigUInt64LE(1n, 0);
  last.writeBigUInt64LE(2n, 0);

  const hash = computeOpenSubtitlesHashFromBuffers(first, last, 131072);
  assert.equal(hash, '0000000000020003');
});

test('debrid streams can register subtitle proxy urls per preferred language', async () => {
  const previousApiKey = process.env.OPENSUBTITLES_API_KEY;
  process.env.OPENSUBTITLES_API_KEY = 'test-api-key';

  try {
    const subtitles = await createStreamSubtitleProxies(
      { type: 'movie', id: 'tt1254207' },
      {
        url: 'https://example.com/video.mp4',
        behaviorHints: {
          filename: 'Big.Buck.Bunny.1080p.mp4',
          videoSize: 123456,
        },
      },
      {
        _publicBaseUrl: 'https://addon.example',
        subtitleLanguages: ['en', 'fr'],
      },
    );

    assert.deepEqual(
      subtitles.map(subtitle => subtitle.lang),
      ['eng', 'fra'],
    );
    assert.ok(subtitles.every(subtitle => subtitle.url.startsWith('https://addon.example/proxy/subtitle/')));
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.OPENSUBTITLES_API_KEY;
    } else {
      process.env.OPENSUBTITLES_API_KEY = previousApiKey;
    }
  }
});

test('prewarm candidates skip already cached and duplicate torrents', () => {
  const candidates = pickPrewarmCandidates([
    { infoHash: 'aaa', fileIdx: 0 },
    { infoHash: 'aaa', fileIdx: 0 },
    { infoHash: 'bbb', fileIdx: 1 },
    { infoHash: 'ccc', fileIdx: 0 },
  ], new Map([['bbb', true]]), 2);

  assert.deepEqual(candidates, [
    { infoHash: 'aaa', fileIdx: 0 },
    { infoHash: 'ccc', fileIdx: 0 },
  ]);
});
