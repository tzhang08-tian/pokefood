#!/usr/bin/env node

/**
 * 本地开发服务器：提供静态文件和本地API路由。
 */

import express from 'express';
import dotenv from 'dotenv';
import { dirname } from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });

const projectRoot = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

app.use((req, res, next) => {
  const origin = req.get('origin');
  const isLocalDevOrigin = origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (isLocalDevOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(isLocalDevOrigin ? 204 : 405);
  }

  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.static(projectRoot));

async function loadApiRoutes() {
  const { default: analyzeHandler } = await import('./api/analyze.js');
  const { default: faceHandler } = await import('./api/face-features.js');
  const { default: sessionHandler } = await import('./api/session.js');

  app.all('/api/analyze', async (req, res) => {
    try {
      await analyzeHandler(req, res);
    } catch (error) {
      console.error('Error in /api/analyze:', error);
      if (!res.headersSent) res.status(500).json({ error: error.message });
    }
  });

  app.all('/api/face-features', async (req, res) => {
    try {
      await faceHandler(req, res);
    } catch (error) {
      console.error('Error in /api/face-features:', error);
      if (!res.headersSent) res.status(500).json({ error: error.message });
    }
  });

  app.all('/api/session', async (req, res) => {
    try {
      await sessionHandler(req, res);
    } catch (error) {
      console.error('Error in /api/session:', error);
      if (!res.headersSent) res.status(500).json({ error: error.message });
    }
  });

  // LAN address of this machine, so the homepage QR code points somewhere a phone can reach
  app.get('/api/lan', (req, res) => {
    const nets = Object.values(os.networkInterfaces()).flat();
    const lan = nets.find(n => n && n.family === 'IPv4' && !n.internal);
    res.json({ url: lan ? `http://${lan.address}:${port}` : null });
  });

  app.get('/favicon.ico', (req, res) => res.sendStatus(204));
  app.get('/favicon.png', (req, res) => res.sendStatus(204));
}

async function start() {
  try {
    await loadApiRoutes();
    app.listen(port, () => {
      console.log(`PokéFood 本地开发服务器：http://localhost:${port}`);
      console.log(`API密钥配置：${process.env.ANTHROPIC_API_KEY ? '已设置' : '未设置'}`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

start();
