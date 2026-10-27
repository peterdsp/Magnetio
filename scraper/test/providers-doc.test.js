import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// The matrix is generated, so the only way it can be wrong is by being stale.
// This fails the build instead of letting the document quietly drift from the
// registry, which is what made the provider ids confusing in the first place.
test('PROVIDERS.md matches the provider registry', async () => {
  const { render } = await import('../scripts/gen-providers-doc.js');

  const committed = readFileSync(join(REPO, 'PROVIDERS.md'), 'utf8');
  assert.equal(
    committed,
    await render(),
    'PROVIDERS.md is out of date. Regenerate it with `npm run doc:providers` in scraper/.'
  );
});
