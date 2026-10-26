import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTitle } from '../lib/titleHelper.js';

const q = t => parseTitle(t).quality;
const c = t => parseTitle(t).codec;
const s = t => parseTitle(t).source;

// ─── quality ──────────────────────────────────────────────────────────────────

test('each resolution tag maps to its tier', () => {
  assert.equal(q('Film.2024.2160p.BluRay.x265'), '4k');
  assert.equal(q('Film.2024.1080p.BluRay.x264'), '1080p');
  assert.equal(q('Film.2024.720p.WEB-DL.x264'),  '720p');
  assert.equal(q('Film.2024.480p.DVDRip.XviD'),  '480p');
  assert.equal(q('Film.2024.4320p.8K.HDR.x265'), '8k');
});

test('4k is recognised from its aliases, not just 2160p', () => {
  assert.equal(q('Film.2024.4K.BluRay.x265'),  '4k');
  assert.equal(q('Film.2024.UHD.BluRay.x265'), '4k');
  assert.equal(q('Film.2024.7680x4320.remux'), '8k');
});

test('the highest tag present wins, so an upscale claim cannot downgrade', () => {
  // Both tags appear; 8k is tested before 4k and 4k before 1080p.
  assert.equal(q('Film.2024.8K.upscale.from.1080p'), '8k');
  assert.equal(q('Film.2024.2160p.downscaled.720p'), '4k');
});

test('resolution beats a cam tag when both appear', () => {
  // A "1080p TS" is still a telesync, but the tier is driven by resolution
  // first, which is the existing ranking contract.
  assert.equal(q('Film.2024.1080p.TS.x264'), '1080p');
});

test('cam tags are recognised', () => {
  for (const t of ['CAM', 'CAMRip', 'TS', 'TELESYNC', 'TELECINE', 'HDCAM']) {
    assert.equal(q(`Film.2024.${t}.x264`), 'cam', t);
  }
});

// A group suffixed after a dash is a name, not a source tag. This scored the
// worst tier and was dropped by anyone filtering cams out.
test('a release group called TS is not a cam', () => {
  assert.equal(q('Some.Movie.2024.DVDRip.XviD-TS'), null);
  assert.equal(s('Some.Movie.2024.DVDRip.XviD-TS'), 'DVDRip');
});

test('a tag only matches as a whole word', () => {
  assert.equal(q('Transport.2024.XviD'), null);  // not "ts" inside a word
  assert.equal(q('Camelot.2024.XviD'), null);    // not "cam" inside a word
});

test('an unlabelled title has no quality rather than a guessed one', () => {
  assert.equal(q('Some.Movie.2024.XviD'), null);
});

// ─── codec ────────────────────────────────────────────────────────────────────

test('HEVC is recognised from each of its spellings', () => {
  for (const t of ['x265', 'HEVC', 'h265', 'h.265']) {
    assert.equal(c(`Film.2024.1080p.${t}`), 'HEVC', t);
  }
});

test('AVC is recognised from each of its spellings', () => {
  for (const t of ['x264', 'AVC', 'h264', 'h.264']) {
    assert.equal(c(`Film.2024.1080p.${t}`), 'AVC', t);
  }
});

test('AV1 is not mistaken for AVC', () => {
  assert.equal(c('Film.2024.1080p.AV1.WEB-DL'), 'AV1');
});

test('an unknown codec reports null, not a default', () => {
  assert.equal(c('Film.2024.1080p.XviD'), null);
  assert.equal(c('Film.2024.1080p.DivX'), null);
});

// ─── source ───────────────────────────────────────────────────────────────────

test('each source tag maps to its label', () => {
  assert.equal(s('Film.2024.1080p.BluRay.x264'), 'BluRay');
  assert.equal(s('Film.2024.1080p.BDRip.x264'),  'BluRay');
  assert.equal(s('Film.2024.1080p.BRRip.x264'),  'BluRay');
  assert.equal(s('Film.2024.1080p.WEBRip.x264'), 'WEBRip');
  assert.equal(s('Film.2024.1080p.WEB-DL.x264'), 'WEB-DL');
  assert.equal(s('Film.2024.1080p.HDRip.x264'),  'HDRip');
  assert.equal(s('Film.2024.1080p.DVDRip.XviD'), 'DVDRip');
  assert.equal(s('Show.S01E01.720p.HDTV.x264'),  'HDTV');
});

test('a bare WEB tag still reports WEB-DL', () => {
  assert.equal(s('Show.S01E01.1080p.WEB.x264'), 'WEB-DL');
});

// "Web" is an ordinary English word. Before the specific tags were tested
// first, any film with it in the title reported WEB-DL whatever its real
// source was.
test('the word web in a film title does not become its source', () => {
  assert.equal(s('Spider.Web.2023.DVDRip.XviD'), 'DVDRip');
  assert.equal(s('Charlottes.Web.2006.1080p.BluRay.x264'), 'BluRay');
  assert.equal(s('The.Web.2024.720p.HDTV.x264'), 'HDTV');
});

test('WEBRip is not reported as WEB-DL', () => {
  assert.equal(s('Film.2024.1080p.WEBRip.x264'), 'WEBRip');
});

// ─── HDR and bit depth ────────────────────────────────────────────────────────

test('HDR is detected from its tags', () => {
  for (const t of ['HDR', 'HDR10', 'DV', 'Dolby.Vision', 'DolbyVision']) {
    assert.equal(parseTitle(`Film.2024.2160p.${t}.x265`).hdr, true, t);
  }
});

test('an SDR release is not flagged as HDR', () => {
  assert.equal(parseTitle('Film.2024.1080p.BluRay.x264').hdr, false);
});

// "HDRip" starts with the same three letters as "HDR" and is a wholly
// different thing: an HDRip is not an HDR release.
test('HDRip is not treated as HDR', () => {
  const r = parseTitle('Film.2024.1080p.HDRip.x264');
  assert.equal(r.hdr, false);
  assert.equal(r.source, 'HDRip');
  assert.equal(r.bitdepth, null);
});

test('HDR implies 10-bit even when the title does not say so', () => {
  assert.equal(parseTitle('Film.2024.2160p.HDR10.x265').bitdepth, '10bit');
});

test('10-bit is detected on its own, in either spelling', () => {
  assert.equal(parseTitle('Film.2024.1080p.10bit.x265').bitdepth, '10bit');
  assert.equal(parseTitle('Film.2024.1080p.10-bit.x265').bitdepth, '10bit');
});

test('an 8-bit release reports no bit depth rather than claiming 10', () => {
  assert.equal(parseTitle('Film.2024.1080p.8bit.x264').bitdepth, null);
});

// ─── shape ────────────────────────────────────────────────────────────────────

test('a full release name parses every field at once', () => {
  assert.deepEqual(parseTitle('Film.2024.2160p.UHD.BluRay.DV.HDR10.x265-GROUP'), {
    quality:   '4k',
    codec:     'HEVC',
    source:    'BluRay',
    languages: ['en'],
    hdr:       true,
    bitdepth:  '10bit',
  });
});

// Documented, not endorsed: an empty title returns {} rather than a shape with
// null fields, so `languages` is absent instead of an array. Callers spread the
// result, so anything reading `.languages` on it would get undefined.
test('an empty title returns an empty object', () => {
  assert.deepEqual(parseTitle(''), {});
  assert.deepEqual(parseTitle(null), {});
  assert.deepEqual(parseTitle(undefined), {});
});
