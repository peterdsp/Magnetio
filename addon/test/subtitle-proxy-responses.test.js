import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { decodeSubtitleText, codepageForLanguage } from '../lib/subtitleZip.js';
import { languageFromZipUrl } from '../lib/yifySubtitles.js';
import { decodeProxyId } from '../lib/tvSubtitles.js';
import { cacheWrap } from '../lib/cache.js';
import { resolveInternalProxy } from '../lib/translatedSubtitles.js';
import { sendSubtitleError, subtitleRateLimitHandler } from '../lib/subtitleResponse.js';
import { serverless } from '../serverless.js';

// ─── Charset handling ────────────────────────────────────────────────────────

test('decoder keeps valid UTF-8 and strips the BOM', () => {
  const text = decodeSubtitleText(Buffer.from('﻿1\n00:00:01,000 --> 00:00:02,000\nΓεια σου\n', 'utf8'));
  assert.equal(text.charCodeAt(0), '1'.charCodeAt(0));
  assert.match(text, /Γεια σου/);
});

test('decoder uses windows-1253 for Greek files that are not UTF-8', () => {
  // "Καλημέρα" in windows-1253
  const bytes = Buffer.from([0xca, 0xe1, 0xeb, 0xe7, 0xec, 0xdd, 0xf1, 0xe1]);
  assert.equal(decodeSubtitleText(bytes, 'el'), 'Καλημέρα');
  assert.equal(decodeSubtitleText(bytes, 'ell'), 'Καλημέρα');
});

test('decoder uses windows-1251 for Cyrillic and falls back to windows-1252 without a hint', () => {
  // "Привет" in windows-1251
  const bytes = Buffer.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);
  assert.equal(decodeSubtitleText(bytes, 'ru'), 'Привет');
  assert.notEqual(decodeSubtitleText(bytes), 'Привет');
  assert.equal(codepageForLanguage('el'), 'windows-1253');
  assert.equal(codepageForLanguage('xx'), 'windows-1252');
});

test('decoder honors UTF-16 byte order marks', () => {
  const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Γεια', 'utf16le')]);
  assert.equal(decodeSubtitleText(le), 'Γεια');
});

test('yify language hint is parsed from the zip slug', () => {
  assert.equal(languageFromZipUrl('https://yifysubtitles.ch/subtitle/the-movie-2024-greek-yify-12345.zip'), 'el');
  assert.equal(languageFromZipUrl('https://yifysubtitles.ch/subtitle/the-movie-english-yify-1.zip'), 'en');
  assert.equal(languageFromZipUrl('https://yifysubtitles.ch/subtitle/nothing-here.zip'), null);
});

test('tvsubs proxy id accepts legacy bare URLs and new JSON payloads', () => {
  const legacy = Buffer.from('https://www.tvsubtitles.net/download-1.html').toString('base64url');
  assert.deepEqual(decodeProxyId(legacy), { url: 'https://www.tvsubtitles.net/download-1.html', lang: null });

  const modern = Buffer.from(JSON.stringify({ url: 'https://www.tvsubtitles.net/download-2.html', lang: 'el' })).toString('base64url');
  assert.deepEqual(decodeProxyId(modern), { url: 'https://www.tvsubtitles.net/download-2.html', lang: 'el' });
});

// ─── Negative caching ────────────────────────────────────────────────────────

test('cacheWrap does not pin a null result when nullTtl is 0', async () => {
  let calls = 0;
  const loader = async () => (++calls === 1 ? null : 'content');
  const key = `test:null:${Date.now()}:${Math.random()}`;

  assert.equal(await cacheWrap(key, loader, 3600, { nullTtl: 0 }), null);
  assert.equal(await cacheWrap(key, loader, 3600, { nullTtl: 0 }), 'content');
  assert.equal(await cacheWrap(key, loader, 3600, { nullTtl: 0 }), 'content');
  assert.equal(calls, 2);
});

test('cacheWrap keeps a null result only for nullTtl seconds', async () => {
  let calls = 0;
  const loader = async () => { calls++; return null; };
  const key = `test:null-ttl:${Date.now()}:${Math.random()}`;

  await cacheWrap(key, loader, 3600, { nullTtl: 1 });
  await cacheWrap(key, loader, 3600, { nullTtl: 1 });
  assert.equal(calls, 1, 'second call within the negative TTL is served from cache');

  await new Promise(resolve => setTimeout(resolve, 1100));
  await cacheWrap(key, loader, 3600, { nullTtl: 1 });
  assert.equal(calls, 2, 'after the negative TTL the loader runs again');
});

// ─── Internal proxy resolution for translations ──────────────────────────────

test('translated source resolves our own proxy URLs in-process', () => {
  const url = 'https://magnetio.example/proxy/yify/abc_DEF-123.srt';
  assert.deepEqual(resolveInternalProxy(url, 'magnetio.example'), { kind: 'yify', id: 'abc_DEF-123' });
  assert.deepEqual(resolveInternalProxy(url, 'MAGNETIO.EXAMPLE'), { kind: 'yify', id: 'abc_DEF-123' });
  assert.equal(resolveInternalProxy(url, 'other.example'), null);
  assert.equal(resolveInternalProxy('https://magnetio.example/other/abc.srt', 'magnetio.example'), null);

  const previous = process.env.ADDON_PUBLIC_URL;
  process.env.ADDON_PUBLIC_URL = 'https://magnetio.example';
  try {
    assert.deepEqual(resolveInternalProxy(url), { kind: 'yify', id: 'abc_DEF-123' });
  } finally {
    if (previous === undefined) delete process.env.ADDON_PUBLIC_URL;
    else process.env.ADDON_PUBLIC_URL = previous;
  }
});

// ─── Responses are never JSON ────────────────────────────────────────────────

function fakeResponse() {
  const headers = {};
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    getHeader(name) { return headers[name.toLowerCase()]; },
    send(body) { this.body = body; return this; },
  };
}

test('subtitle error helper sends plain text', () => {
  const res = fakeResponse();
  sendSubtitleError(res, 404, 'Subtitle not available');
  assert.equal(res.statusCode, 404);
  assert.match(res.getHeader('content-type'), /^text\/plain/);
  assert.equal(res.body, 'Subtitle not available\n');
});

test('subtitle rate limit handler sends plain text', () => {
  const res = fakeResponse();
  subtitleRateLimitHandler({}, res, () => {}, { statusCode: 429, message: 'slow down' });
  assert.equal(res.statusCode, 429);
  assert.match(res.getHeader('content-type'), /^text\/plain/);
  assert.equal(res.body, 'slow down\n');
});

test('every subtitle proxy route answers errors with text/plain over HTTP', async () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use('/', serverless);
  const server = await new Promise(resolve => {
    const instance = http.createServer(app).listen(0, '127.0.0.1', () => resolve(instance));
  });
  const { port } = server.address();

  const badHost = Buffer.from('https://evil.example/file.zip').toString('base64url');
  const badJson = Buffer.from('not json').toString('base64url');
  const paths = [
    `/proxy/yify/${badHost}.srt`,
    `/proxy/tvsubs/${badHost}.srt`,
    `/proxy/community/${badJson}.srt`,
    `/proxy/translated/${badJson}.srt`,
    '/proxy/subtitle/00000000-0000-0000-0000-000000000000.srt',
  ];

  try {
    for (const path of paths) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      const body = await response.text();
      assert.ok(response.status >= 400, `${path} should fail`);
      assert.match(response.headers.get('content-type') || '', /^text\/plain/, `${path} content-type`);
      assert.throws(() => JSON.parse(body), `${path} body must not be JSON`);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
