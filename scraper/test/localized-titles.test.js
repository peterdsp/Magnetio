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

// ─── Guards (offline) ─────────────────────────────────────────────────────────

test('the lookup is skipped when there is nothing to look up', async () => {
  // Guarded so no request is made at all.
  assert.deepEqual(await getLocalizedTitles(GODFATHER, []), []);
  assert.deepEqual(await getLocalizedTitles(GODFATHER, ['en']), []);
  assert.deepEqual(await getLocalizedTitles(GODFATHER, ['en', 'multi']), []);
  assert.deepEqual(await getLocalizedTitles({ name: 'x' }, ['it']), [], 'no IMDb id');
  assert.deepEqual(await getLocalizedTitles({ imdbId: 'tt0068646' }, ['it']), [], 'no name');
});

test('the IMDb id is validated before it reaches SPARQL', async () => {
  // The id arrives from the request path and is interpolated into a query, so
  // anything that is not an IMDb id must be refused rather than escaped.
  for (const imdbId of [
    'tt1" } UNION { ?x ?y ?z',
    'tt1; DROP',
    '../../etc',
    'nt0068646',
    'tt12',
    '',
  ]) {
    assert.deepEqual(
      await getLocalizedTitles({ name: 'x', imdbId, type: 'movie' }, ['it']),
      [],
      `rejected: ${imdbId}`
    );
  }
});

// ─── Keyless lookup (network) ─────────────────────────────────────────────────
//
// Wikidata is the fallback when no TMDB key is configured, which is the default
// for a fresh deployment. Asserted tolerantly: an unreachable or throttled
// Wikidata must degrade to [] rather than fail the suite, so this checks the
// shape and, when results do arrive, that they are the right ones.

test('a localized title is resolved without any API key', async () => {
  const previous = process.env.TMDB_API_KEY;
  delete process.env.TMDB_API_KEY;
  try {
    const titles = await getLocalizedTitles(GODFATHER, ['it']);
    assert.ok(Array.isArray(titles), 'always an array');
    if (!titles.length) {
      console.warn('    (Wikidata unreachable; keyless lookup degraded to [])');
      return;
    }
    assert.ok(
      titles.some(t => /padrino/i.test(t)),
      `expected an Italian title, got ${JSON.stringify(titles)}`
    );
    assert.ok(
      !titles.some(t => /^the godfather$/i.test(t)),
      'the name we already have is not repeated as an alias'
    );
  } finally {
    if (previous !== undefined) process.env.TMDB_API_KEY = previous;
  }
});
