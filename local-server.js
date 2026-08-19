#!/usr/bin/env node

/**
 * 本地开发服务器：提供静态文件和本地API路由。
 */

import express from 'express';
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });

const projectRoot = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(projectRoot));

async function loadApiRoutes() {
  const { default: analyzeHandler } = await import('./api/analyze.js');
  const { default: faceHandler } = await import('./api/face-features.js');

  app.post('/api/analyze', async (req, res) => {
    try {
      await analyzeHandler(req, res);
    } catch (error) {
      console.error('Error in /api/analyze:', error);
      if (!res.headersSent) res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/face-features', async (req, res) => {
    try {
      await faceHandler(req, res);
    } catch (error) {
      console.error('Error in /api/face-features:', error);
      if (!res.headersSent) res.status(500).json({ error: error.message });
    }
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
