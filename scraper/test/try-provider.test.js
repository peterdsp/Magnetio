import test from 'node:test';
import assert from 'node:assert/strict';

const { parseArgs } = await import('../scripts/try-provider.js');

test('a bare word is the provider id', () => {
  assert.equal(parseArgs(['1337x']).id, '1337x');
});

test('numeric options are parsed as numbers, not strings', () => {
  const o = parseArgs(['eztv', '--season', '1', '--episode', '2', '--year', '2008']);
  assert.equal(o.season, 1);
  assert.equal(o.episode, 2);
  assert.equal(o.year, 2008);
});

test('a non-numeric value for a numeric option is rejected', () => {
  assert.throws(() => parseArgs(['eztv', '--season', 'one']), /--season must be a whole number/);
});

test('an option with no value is rejected rather than swallowing the next flag', () => {
  assert.throws(() => parseArgs(['yts', '--name']), /--name needs a value/);
});

test('an unknown option is rejected instead of being ignored', () => {
  assert.throws(() => parseArgs(['yts', '--qualtiy', '1080p']), /unknown option --qualtiy/);
});

test('two provider ids are rejected, since only one runs', () => {
  assert.throws(() => parseArgs(['yts', 'eztv']), /more than one provider id/);
});

test('flags do not need a value', () => {
  const o = parseArgs(['yts', '--json', '--full', '--name', 'Heat']);
  assert.equal(o.json, true);
  assert.equal(o.full, true);
  assert.equal(o.name, 'Heat');
});

// A fake default sent providers that search by id (yts, torznab) looking for a
// film that does not exist, which reads as a broken provider.
test('imdb has no fake default', () => {
  assert.equal(parseArgs(['yts']).imdb, null);
});

test('type defaults to movie and is overridable', () => {
  assert.equal(parseArgs(['yts']).type, 'movie');
  assert.equal(parseArgs(['nyaa', '--type', 'anime']).type, 'anime');
});

test('--list and --help are recognised without an id', () => {
  assert.equal(parseArgs(['--list']).list, true);
  assert.equal(parseArgs(['--help']).help, true);
  assert.equal(parseArgs(['-h']).help, true);
});
