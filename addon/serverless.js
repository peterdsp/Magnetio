import crypto from 'crypto';
import express from 'express';
import StremioAddonSdk from 'stremio-addon-sdk';
import { dummyManifest } from './lib/manifest.js';
import { getDefaultConfiguration, parseConfiguration } from './lib/configuration.js';
import { getAddonInterface } from './addon.js';
import { landingTemplate } from './lib/landingTemplate.js';
import { logger } from './lib/logger.js';
import { handleSubtitleProxyRequest } from './lib/subtitleProxy.js';

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

router.get('/proxy/subtitle/:id.srt', handleSubtitleProxyRequest);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Magnetio', version: '1.1.1' });
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
  try {
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
