import test from 'node:test';
import assert from 'node:assert/strict';

import { getLocalizedTitles, releaseTagsFor } from '../lib/localizedTitles.js';

const GODFATHER = { name: 'The Godfather', imdbId: 'tt0068646', type: 'movie' };

test('release tags are resolved for the requested languages', () => {
  assert.deepEqual(releaseTagsFor(['it']), ['ITA']);
  assert.deepEqual(releaseTagsFor(['it', 'fr']), ['ITA', 'FRENCH']);
  assert.deepEqual(releaseTagsFor(['IT', ' it ']), ['ITA'], 'codes are normalized and deduped');
});

test('English and multi never trigger an extra search pass', () => {
  // The catalogue name is already the English one, and "multi" is not a
  // language, so neither has a localized title or a tag worth searching for.
  assert.deepEqual(releaseTagsFor([]), []);
  assert.deepEqual(releaseTagsFor(['en']), []);
  assert.deepEqual(releaseTagsFor(['en', 'multi']), []);
  assert.deepEqual(releaseTagsFor(['en', 'it']), ['ITA']);
});

test('a language with no known scene tag is skipped rather than guessed', () => {
  assert.deepEqual(releaseTagsFor(['xx']), []);
});

test('the localized lookup is a no-op without a TMDB key', async () => {
  const previous = process.env.TMDB_API_KEY;
  delete process.env.TMDB_API_KEY;
  try {
    assert.deepEqual(await getLocalizedTitles(GODFATHER, ['it']), []);
  } finally {
    if (previous !== undefined) process.env.TMDB_API_KEY = previous;
  }
});

test('the localized lookup is a no-op without a non-English language', async () => {
  // Guarded so no request is made even when a key is configured.
  assert.deepEqual(await getLocalizedTitles(GODFATHER, [], 'test-key'), []);
  assert.deepEqual(await getLocalizedTitles(GODFATHER, ['en'], 'test-key'), []);
  assert.deepEqual(await getLocalizedTitles({ name: 'x' }, ['it'], 'test-key'), [],
    'no IMDb id, nothing to look up');
});
