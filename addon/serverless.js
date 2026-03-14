import { addonBuilder } from 'stremio-addon-sdk';
import express from 'express';
import { dummyManifest } from './lib/manifest.js';
import { parseConfiguration } from './lib/configuration.js';
import { getRouter } from './addon.js';
import { landingTemplate } from './lib/landingTemplate.js';
import { logger } from './lib/logger.js';

const router = express.Router();

// Landing page - configure the addon
router.get('/', (req, res) => {
  res.setHeader('content-type', 'text/html');
  res.send(landingTemplate(dummyManifest()));
});

// Dynamic manifest based on configuration
router.get('/:configuration/manifest.json', async (req, res) => {
  try {
    const config = parseConfiguration(req.params.configuration);
    const addon = await getRouter(config);
    addon(req, res);
  } catch (err) {
    logger.error(`Manifest error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Stream handler
router.get('/:configuration/stream/:type/:id.json', async (req, res) => {
  try {
    const config = parseConfiguration(req.params.configuration);
    const addon = await getRouter(config);
    addon(req, res);
  } catch (err) {
    logger.error(`Stream error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Catalog handler
router.get('/:configuration/catalog/:type/:id/:extra?.json', async (req, res) => {
  try {
    const config = parseConfiguration(req.params.configuration);
    const addon = await getRouter(config);
    addon(req, res);
  } catch (err) {
    logger.error(`Catalog error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Meta handler
router.get('/:configuration/meta/:type/:id.json', async (req, res) => {
  try {
    const config = parseConfiguration(req.params.configuration);
    const addon = await getRouter(config);
    addon(req, res);
  } catch (err) {
    logger.error(`Meta error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Magnetio', version: '1.0.0' });
});

export const serverless = router;
