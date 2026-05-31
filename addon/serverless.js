import crypto from 'crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import StremioAddonSdk from 'stremio-addon-sdk';
import { dummyManifest } from './lib/manifest.js';
import { getDefaultConfiguration, parseConfiguration } from './lib/configuration.js';
import { getAddonInterface } from './addon.js';
import { landingTemplate } from './lib/landingTemplate.js';
import { logger } from './lib/logger.js';
import { handleSubtitleProxyRequest } from './lib/subtitleProxy.js';
import { trackRequest, getStats } from './lib/analytics.js';
import { runWithClientIp } from './lib/requestContext.js';

const router = express.Router();
const ROUTER_CACHE_TTL_MS = 1000 * 60 * 5;
const MAX_CACHED_ROUTERS = 64;
const addonRouterCache = new Map();
const { getRouter: getSdkRouter } = StremioAddonSdk;

router.get('/', (_req, res) => {
  res.setHeader('content-type', 'text/html');
  res.send(landingTemplate(dummyManifest(), getDefaultConfiguration()));
});

router.get('/configure', (_req, res) => {
  res.setHeader('content-type', 'text/html');
  res.send(landingTemplate(dummyManifest(), getDefaultConfiguration()));
});

router.get('/manifest.json', (_req, res) => {
  res.json(dummyManifest());
});

// ─── SEO: robots.txt and sitemap ─────────────────────────────────────────────

router.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /proxy/',
    'Disallow: /swagger',
    'Disallow: /stats',
    '',
    'Sitemap: https://magnetio.peterdsp.dev/sitemap.xml',
  ].join('\n'));
});

router.get('/sitemap.xml', (_req, res) => {
  const now = new Date().toISOString().split('T')[0];
  res.type('application/xml').send([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    '    <loc>https://magnetio.peterdsp.dev/</loc>',
    `    <lastmod>${now}</lastmod>`,
    '    <changefreq>weekly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '  <url>',
    '    <loc>https://magnetio.peterdsp.dev/configure</loc>',
    `    <lastmod>${now}</lastmod>`,
    '    <changefreq>weekly</changefreq>',
    '    <priority>0.8</priority>',
    '  </url>',
    '</urlset>',
  ].join('\n'));
});

const subtitleProxyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many subtitle requests, try again later' },
});

router.get('/proxy/subtitle/:id.srt', subtitleProxyLimiter, handleSubtitleProxyRequest);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Magnetio', version: '1.1.5' });
});

router.get('/stats', async (_req, res) => {
  const stats = await getStats();
  res.json(stats);
});

router.get('/:configuration', (req, res) => {
  try {
    const config = parseConfiguration(req.params.configuration);
    res.setHeader('content-type', 'text/html');
    res.send(landingTemplate(dummyManifest(), config));
  } catch (err) {
    logger.error(`Configuration page error: ${err.message}`);
    res.status(500).send('Unable to render configuration');
  }
});

router.get('/:configuration/configure', (req, res) => {
  try {
    const config = parseConfiguration(req.params.configuration);
    res.setHeader('content-type', 'text/html');
    res.send(landingTemplate(dummyManifest(), config));
  } catch (err) {
    logger.error(`Configuration page error: ${err.message}`);
    res.status(500).send('Unable to render configuration');
  }
});

router.use('/:configuration', async (req, res, next) => {
  const clientIp = req.ip || req.connection?.remoteAddress;

  runWithClientIp(clientIp, async () => {
    try {
      const configHash = hashConfiguration(req.params.configuration);
      const pathAfterConfig = req.path.replace(/^\/[^/]+/, '');
      const type = pathAfterConfig.match(/^\/(stream|catalog|subtitle|meta)\b/)?.[1] || 'page';
      trackRequest(type, configHash).catch(() => {});

      const addonRouter = await getConfiguredAddonRouter(
        req.params.configuration,
        getPublicBaseUrl(req),
      );
      addonRouter(req, res, next);
    } catch (err) {
      logger.error(`Addon routing error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });
});

export const serverless = router;

async function getConfiguredAddonRouter(configString, publicBaseUrl) {
  purgeExpiredRouters();

  const cacheKey = hashConfiguration(`${configString}|${publicBaseUrl}`);
  const cached = addonRouterCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    cached.expiresAt = Date.now() + ROUTER_CACHE_TTL_MS;
    addonRouterCache.delete(cacheKey);
    addonRouterCache.set(cacheKey, cached);
    return cached.router;
  }

  const config = parseConfiguration(configString);
  config._publicBaseUrl = publicBaseUrl;
  const addonInterface = await getAddonInterface(config);
  const addonRouter = getSdkRouter(addonInterface);

  addonRouterCache.set(cacheKey, {
    router: addonRouter,
    expiresAt: Date.now() + ROUTER_CACHE_TTL_MS,
  });

  while (addonRouterCache.size > MAX_CACHED_ROUTERS) {
    const oldestKey = addonRouterCache.keys().next().value;
    addonRouterCache.delete(oldestKey);
  }

  return addonRouter;
}

function purgeExpiredRouters() {
  const now = Date.now();
  for (const [key, value] of addonRouterCache.entries()) {
    if (value.expiresAt <= now) {
      addonRouterCache.delete(key);
    }
  }
}

function hashConfiguration(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function getPublicBaseUrl(req) {
  const envUrl = process.env.ADDON_PUBLIC_URL || process.env.PUBLIC_URL;
  if (envUrl) return String(envUrl).replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}
