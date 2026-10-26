#!/usr/bin/env node
/**
 * Run one provider from the command line, without starting the server.
 *
 * A provider is just a module exporting scrape(meta), so it can be driven
 * directly. That means a contributor can see real results from the site they
 * are adding without a server, a client, or a Stremio install, and reviewers
 * can reproduce a claim in one command.
 *
 * Usage:
 *   node scripts/try-provider.js --list
 *   node scripts/try-provider.js 1337x --name "The Matrix" --year 1999
 *   node scripts/try-provider.js eztv --type series --name "Breaking Bad" --season 1 --episode 2
 *   node scripts/try-provider.js tokyotosho --type anime --name "One Piece" --json
 */
import { listProviders, classifyProviderIds, getProvider } from '../providers/index.js';

const FLAGS = {
  type: 'movie', name: null, year: null, season: null, episode: null,
  imdb: null, json: false, full: false,
};
const NUMERIC = new Set(['year', 'season', 'episode']);

export function parseArgs(argv) {
  const out = { ...FLAGS, id: null, list: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list') { out.list = true; continue; }
    if (arg === '--help' || arg === '-h') { out.help = true; continue; }
    if (arg === '--json') { out.json = true; continue; }
    if (arg === '--full') { out.full = true; continue; }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (!(key in FLAGS)) throw new Error(`unknown option --${key}`);
      const value = argv[++i];
      if (value === undefined) throw new Error(`--${key} needs a value`);
      if (NUMERIC.has(key)) {
        const n = Number(value);
        if (!Number.isInteger(n)) throw new Error(`--${key} must be a whole number, got "${value}"`);
        out[key] = n;
      } else {
        out[key] = value;
      }
      continue;
    }
    if (out.id) throw new Error(`more than one provider id given: "${out.id}" and "${arg}"`);
    out.id = arg;
  }
  return out;
}

function fmtSize(bytes) {
  if (!bytes) return '?';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes, u = 0;
  while (n >= 1024 && u < units.length - 1) { n /= 1024; u++; }
  return `${n.toFixed(n < 10 ? 1 : 0)}${units[u]}`;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`try-provider: ${err.message}`);
    process.exit(2);
  }

  const providers = listProviders();

  if (opts.help || (!opts.id && !opts.list)) {
    console.log('Usage: node scripts/try-provider.js <id> [--type movie|series|anime]');
    console.log('       [--name "Title"] [--imdb ttNNNNNNN] [--year N] [--season N]');
    console.log('       [--episode N] [--json] [--full]');
    console.log('');
    console.log('--name is always required. Add --imdb for providers that search by id');
    console.log('rather than title, such as yts and torznab.');
    console.log('       node scripts/try-provider.js --list');
    process.exit(opts.help ? 0 : 2);
  }

  if (opts.list) {
    const width = Math.max(...providers.map(p => p.id.length));
    for (const p of providers) {
      console.log(`${p.id.padEnd(width)}  ${p.types.join(', ').padEnd(21)}  ${p.name}`);
    }
    console.log(`\n${providers.length} providers enabled here.`);
    return;
  }

  // The same classification the /streams route uses, so the CLI says "disabled
  // on this host" rather than "unknown" for an id the operator switched off.
  const { active, disabled, unknown } = classifyProviderIds([opts.id]);
  if (unknown.length) {
    console.error(`try-provider: unknown provider id "${opts.id}".`);
    console.error(`Known ids: ${providers.map(p => p.id).sort().join(', ')}`);
    console.error('The id is not always the site name: 1337x is `1337x`, in leetx.js.');
    process.exit(1);
  }
  if (disabled.length) {
    console.error(`try-provider: "${opts.id}" is registered but disabled here via SCRAPER_DISABLED_PROVIDERS.`);
    process.exit(1);
  }

  const provider = providers.find(p => p.id === active[0]);
  if (!provider.types.includes(opts.type)) {
    console.error(`try-provider: ${provider.id} does not serve "${opts.type}" (it serves ${provider.types.join(', ')}).`);
    console.error('It would return nothing. Pick a type it covers.');
    process.exit(1);
  }
  if (!opts.name) {
    console.error('try-provider: --name is required (every provider searches by title).');
    process.exit(2);
  }

  const mod = getProvider(provider.id);
  const meta = {
    name: opts.name, year: opts.year, imdbId: opts.imdb, type: opts.type,
    season: opts.season, episode: opts.episode, aliases: [], searchTags: [],
  };

  const started = Date.now();
  const results = await mod.scrape(meta);
  const elapsed = Date.now() - started;

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log(`${provider.name} (${provider.id}): ${results.length} results in ${elapsed}ms\n`);
  if (!results.length) {
    console.log('Nothing came back. Before blaming the parser, check the query:');
    if (!opts.imdb) {
      console.log('  - Some providers search by IMDb id, not title (yts, torznab).');
      console.log('    Pass --imdb tt0111161. Without it they have nothing to search for.');
    }
    console.log('  - Anime sites index absolute episode numbers, not S01E02 (see #188).');
    console.log('  - Try a bare title with no --year and no --season.');
    console.log('  - Try --json to see whether the response arrived but parsed empty.');
    return;
  }
  for (const r of results.slice(0, opts.full ? results.length : 15)) {
    const seeds = `${r.seeders ?? 0}/${r.leechers ?? 0}`;
    const hash = r.infoHash ? r.infoHash.slice(0, 10) : 'NO HASH';
    console.log(`${hash}  ${fmtSize(r.size).padStart(7)}  ${seeds.padStart(9)}  ${(r.title ?? '').slice(0, 70)}`);
  }
  if (!opts.full && results.length > 15) console.log(`\n... ${results.length - 15} more, pass --full`);

  const noHash = results.filter(r => !r.infoHash).length;
  const base32 = results.filter(r => r.infoHash && !/^[0-9a-f]{40}$/.test(r.infoHash)).length;
  if (noHash) console.log(`\nWARNING: ${noHash} result(s) have no infoHash and will be dropped.`);
  if (base32) console.log(`\nWARNING: ${base32} infoHash(es) are not 40-char lowercase hex. Use extractInfoHash().`);
}

if (process.argv[1] && process.argv[1].endsWith('try-provider.js')) {
  await main();
}
