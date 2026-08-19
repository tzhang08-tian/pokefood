#!/usr/bin/env node

/**
 * 本地开发服务器
 * 支持：
 * - 静态文件服务
 * - API路由代理（/api/*)
 * - 环境变量加载
 */

import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// 加载 .env.local 环境变量
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname)); // 正确的路径：__dirname 就是项目根目录

// 动态导入 API 路由
async function loadApiRoutes() {
  // 导入后端 API 处理函数
  const { default: analyzeHandler } = await import('./api/analyze.js');
  const { default: faceHandler } = await import('./api/face-features.js');

  // API 路由
  app.post('/api/analyze', async (req, res) => {
    try {
      await analyzeHandler(req, res);
    } catch (error) {
      console.error('Error in /api/analyze:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.post('/api/face-features', async (req, res) => {
    try {
      await faceHandler(req, res);
    } catch (error) {
      console.error('Error in /api/face-features:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // Favicon 路由（返回 204，忽略 favicon 请求）
  app.get('/favicon.ico', (req, res) => {
    res.status(204).send();
  });
}

// 启动服务器
async function start() {
  try {
    await loadApiRoutes();

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║   PokéFood 本地开发服务器已启动        ║
╚════════════════════════════════════════╝

📍 打开浏览器访问：http://localhost:${PORT}

✨ 功能：
  ✓ 前端：http://localhost:${PORT}/index.html
  ✓ API：/api/analyze
  ✓ API：/api/face-features

🔑 API密钥配置：${process.env.ANTHROPIC_API_KEY ? '✅ 已设置' : '❌ 未设置（查看 .env.local）'}

按 Ctrl+C 停止服务器
      `);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

start();
