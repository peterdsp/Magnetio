import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTitle } from '../lib/titleHelper.js';

const langs = title => parseTitle(title).languages;

test('short scene tags count as an audio track, not just full language names', () => {
  // "iTA" is how Italian releases are labelled in practice; reading it as
  // English is what made the addon's Italian language filter return nothing.
  assert.deepEqual(langs('Nuovo.Cinema.Paradiso.1988.ITA.1080p'), ['it']);
  assert.deepEqual(langs('Gomorra.S01E01.ITALiANO.1080p'), ['it']);
  assert.deepEqual(langs('Il.Padrino.1972.iTALiAN.AC3.BDRip.XviD'), ['it']);
});

test('a dual-audio release reports both tracks', () => {
  assert.deepEqual(langs('The.Godfather.1972.iTA.ENG.1080p.BluRay.x264'), ['en', 'it']);
});

test('a "sub ita" tag is a subtitle track and not Italian audio', () => {
  for (const title of [
    'Dune.Part.Two.2024.ENG.SUB-ITA.1080p',
    'Dune.Part.Two.2024.SUB.ITA.1080p',
    'Dune.Part.Two.2024.SUB_ITA.1080p',
    'Dune.Part.Two.2024.SubITA.1080p',
  ]) {
    assert.deepEqual(langs(title), ['en'], title);
  }
});

test('a tag only matches on a word boundary', () => {
  // "Vita" and "Ital" must not register as Italian audio.
  assert.deepEqual(langs('Vita.e.Morte.2019.1080p.BluRay'), ['en']);
  assert.deepEqual(langs('Capital.2012.1080p.WEB-DL'), ['en']);
});

test('untagged and multi releases keep their previous labels', () => {
  assert.deepEqual(langs('Some.Movie.2020.1080p.BluRay.x264'), ['en']);
  assert.deepEqual(langs('The.Bear.S03E01.MULTi.1080p'), ['multi']);
  assert.deepEqual(langs('Brat.1997.RUSSIAN.BDRip'), ['ru']);
});
