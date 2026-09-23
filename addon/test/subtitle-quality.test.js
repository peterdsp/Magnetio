import test from 'node:test';
import assert from 'node:assert/strict';

process.env.TRANSLATION_PREWARM = '0';

import { cleanSrt, isJunkCue, cleanCueText } from '../lib/subtitleClean.js';
import { parseSrt, parseTimestampRange, formatTimestampRange } from '../lib/srt.js';
import { rankSubtitles, stripSubtitleMeta, tokenizeRelease, releaseGroup } from '../lib/subtitleRank.js';
import { attachTranslatedSubtitles, prewarmTranslatedSubtitles } from '../lib/translatedSubtitles.js';
import { toLanguageCode } from '../lib/languages.js';
import { codepageForLanguage } from '../lib/subtitleZip.js';

function cue(index, start, end, text) {
  return `${index}\n${start} --> ${end}\n${text}\n`;
}

test('cleanSrt removes ads and uploader credits but keeps dialogue', () => {
  const cues = [
    cue(1, '00:00:01,000', '00:00:02,000', 'Subtitles by SomeUploader'),
    cue(2, '00:00:03,000', '00:00:04,000', 'Hello there.'),
  ];
  for (let i = 3; i <= 20; i++) {
    cues.push(cue(i, `00:00:${String(i + 10).padStart(2, '0')},000`, `00:00:${String(i + 10).padStart(2, '0')},900`, `Line ${i}`));
  }
  cues.push(cue(21, '00:00:30,000', '00:00:31,000', 'It was translated by monks.'));
  cues.push(cue(22, '00:00:32,000', '00:00:33,000', 'Advertise your product or brand here'));
  cues.push(cue(23, '00:00:34,000', '00:00:35,000', 'Visit www.example.com'));
  for (let i = 24; i <= 40; i++) {
    cues.push(cue(i, `00:01:${String(i).padStart(2, '0')},000`, `00:01:${String(i).padStart(2, '0')},900`, `Line ${i}`));
  }
  cues.push(cue(41, '00:02:00,000', '00:02:01,000', 'Synced and corrected by Somebody'));

  const cleaned = cleanSrt(cues.join('\n'));
  assert.doesNotMatch(cleaned, /SomeUploader/);
  assert.doesNotMatch(cleaned, /Advertise/);
  assert.doesNotMatch(cleaned, /example\.com/);
  assert.doesNotMatch(cleaned, /Synced and corrected/);
  assert.match(cleaned, /Hello there\./);
  assert.match(cleaned, /translated by monks/, 'weak credit pattern in the middle of the file is dialogue');
  assert.match(cleaned, /^1\n00:00:03,000 --> 00:00:04,000\nHello there\./, 'cues are renumbered from 1');
  const indices = parseSrt(cleaned).map(block => block.index);
  assert.deepEqual(indices, indices.map((_, i) => i + 1), 'indices are sequential');
});

test('cleanSrt fixes tags, entities, reversed timings and ordering', () => {
  const srt = [
    cue(1, '00:00:05,000', '00:00:06,000', 'Second'),
    cue(2, '00:00:01,000', '00:00:02,000', '{\\an8}First &amp; <i>foremost</i>&nbsp;'),
    cue(3, '00:00:09,000', '00:00:08,000', 'reversed'),
    cue(4, '00:00:10,000', '00:00:10,050', 'blink'),
    cue(5, '00:00:12,000', '00:01:12,000', 'way too long'),
  ].join('\n');

  const blocks = parseSrt(cleanSrt(srt));
  assert.deepEqual(blocks.map(block => block.text), ['First & <i>foremost</i>', 'Second', 'blink', 'way too long']);
  assert.equal(blocks[2].timestamp, '00:00:10,000 --> 00:00:10,200');
  assert.equal(blocks[3].timestamp, '00:00:12,000 --> 00:00:32,000');
});

test('cleanSrt never returns an empty file when every cue looks like junk', () => {
  const srt = cue(1, '00:00:01,000', '00:00:02,000', 'www.example.com');
  assert.match(cleanSrt(srt), /example\.com/);
});

test('junk detection and cue text helpers', () => {
  assert.equal(isJunkCue('Support us and become VIP member', 200, 1000), true);
  assert.equal(isJunkCue('Uploaded by someone', 200, 1000), false);
  assert.equal(isJunkCue('Uploaded by someone', 2, 1000), true);
  assert.equal(cleanCueText('  a   b <br> c '), 'a b\nc');
  assert.deepEqual(parseTimestampRange('00:00:01,500 --> 00:00:02,000 X1:0'), { start: 1500, end: 2000 });
  assert.equal(formatTimestampRange(1500, 3661001), '00:00:01,500 --> 01:01:01,001');
});

test('release tokens and group are extracted from filenames', () => {
  const tokens = tokenizeRelease('Movie.2024.1080p.WEB-DL.DDP5.1.x264-GROUP.mkv');
  assert.ok(tokens.has('1080p'));
  assert.ok(tokens.has('web'));
  assert.ok(tokens.has('x264'));
  assert.equal(releaseGroup('Movie.2024.1080p.WEB-DL.x264-GROUP.mkv'), 'group');
  assert.equal(releaseGroup('Movie.2024.1080p.BluRay.x264-SPARKS[rarbg]'), 'sparks');
});

test('ranking prefers user language order, hash matches, and matching releases', () => {
  const subs = [
    { id: 'en-web', lang: 'eng', url: 'u1', _meta: { source: 'community', release: 'Movie.2024.720p.WEB-DL-OTHER' } },
    { id: 'el-yify', lang: 'ell', url: 'u2', _meta: { source: 'yify', rating: 3 } },
    { id: 'el-hash', lang: 'ell', url: 'u3', _meta: { source: 'opensubtitles', hashMatch: true } },
    { id: 'el-mt', lang: 'ell', url: 'u4', _meta: { source: 'opensubtitles', machineTranslated: true } },
    { id: 'el-release', lang: 'ell', url: 'u5', _meta: { source: 'community', release: 'Movie.2024.1080p.BluRay.x264-SPARKS' } },
    { id: 'fr', lang: 'fra', url: 'u6', _meta: { source: 'opensubtitles' } },
  ];

  const ranked = rankSubtitles(subs, {
    config: { subtitleLanguages: ['el', 'en'] },
    filename: 'Movie.2024.1080p.BluRay.x264-SPARKS.mkv',
  });
  assert.deepEqual(ranked.map(sub => sub.id), ['el-hash', 'el-release', 'el-yify', 'el-mt', 'en-web', 'fr']);

  const stripped = stripSubtitleMeta(ranked);
  assert.ok(stripped.every(sub => !('_meta' in sub)));
  assert.equal(stripped[0].id, 'el-hash');
});

test('translated entries follow the best ranked English source', () => {
  const subtitles = [
    { id: 'en-best', lang: 'eng', url: 'https://example.com/best.srt' },
    { id: 'en-second', lang: 'eng', url: 'https://example.com/second.srt' },
    { id: 'en-third', lang: 'eng', url: 'https://example.com/third.srt' },
  ];
  const result = attachTranslatedSubtitles(subtitles, {
    subtitleLanguages: ['el', 'en'],
    _publicBaseUrl: 'https://magnetio.example',
  });
  const translated = result.filter(sub => sub.lang === 'ell');
  assert.deepEqual(translated.map(sub => sub.id), ['translated-el-en-best', 'translated-el-en-second']);
});

test('junk detection keeps dialogue with an ellipsis before a short word', () => {
  assert.equal(isJunkCue('Come with...me', 200, 1000), false);
  assert.equal(isJunkCue('Leave it to...tv people', 200, 1000), false);
  assert.equal(isJunkCue('Visit example.com for more', 200, 1000), true);
  assert.equal(isJunkCue('Get it at sub-site.net', 200, 1000), true);
});

test('language hints accept two-letter, three-letter and region codes', () => {
  assert.equal(toLanguageCode('tur'), 'tr');
  assert.equal(toLanguageCode('ell'), 'el');
  assert.equal(toLanguageCode('pt-BR'), 'pt');
  assert.equal(toLanguageCode('EL'), 'el');
  assert.equal(codepageForLanguage('tur'), 'windows-1254');
  assert.equal(codepageForLanguage('pol'), 'windows-1250');
});

test('release group ignores WEB-DL style suffixes', () => {
  assert.equal(releaseGroup('Show.S01E01.1080p.WEB-DL.mkv'), null);
  assert.equal(releaseGroup('Show.S01E01.1080p.WEB-DL.x264-NTb.mkv'), 'ntb');
});

test('pre-warm is a no-op when disabled and never throws on odd input', () => {
  process.env.TRANSLATION_PREWARM = '0';
  assert.doesNotThrow(() => prewarmTranslatedSubtitles([{ lang: 'ell', url: 'https://x/proxy/translated/abc.srt' }]));
  assert.doesNotThrow(() => prewarmTranslatedSubtitles([]));
  assert.doesNotThrow(() => prewarmTranslatedSubtitles([null, { url: 'not a url' }]));
});
