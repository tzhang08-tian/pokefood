# PokéFood - 食物AI识别系统

这是一个用Claude AI识别食物并生成营养信息的网页应用，现在已经配置为使用**后端API**来安全管理API密钥和限制用户调用次数。

## 🎯 功能特性

✅ **安全的API管理** - API密钥存储在后端，不会暴露给用户  
✅ **用户调用限制** - 每个用户每天最多5次调用  
✅ **自动用户识别** - 浏览器自动分配唯一用户ID  
✅ **预设人脸库** - 为识别的食物附加卡通人脸  
✅ **3D可视化** - 展示食物的3D模型  

---

## 🚀 快速开始

### 1. 本地开发

**安装依赖**
```bash
npm install
```

**启动本地开发服务器**
```bash
npm run dev
```

然后打开 `http://localhost:3000`

### 2. 部署到Vercel

Vercel会自动从GitHub部署你的代码。只需：

1. 推送代码到GitHub
2. 在 [Vercel.com](https://vercel.com) 导入GitHub仓库
3. 设置环境变量：`ANTHROPIC_API_KEY`
4. 点击"Deploy"

**设置环境变量：**

在Vercel项目设置中添加环境变量：
- 名称：`ANTHROPIC_API_KEY`
- 值：你的API密钥（从 https://console.anthropic.com/ 获取）

---

## 📁 项目结构

```
pokefood/
├── index.html              ← 主网页（前端）
├── api/
│   ├── analyze.js          ← 食物分析API端点（后端）
│   └── face-features.js    ← 人脸特征检测API端点（后端）
├── faces/                  ← 预设人脸图片
├── library/                ← 库文件
├── package.json            ← 依赖配置
├── vercel.json             ← Vercel部署配置
└── .env.local              ← 本地环境变量（不要提交到Git）
```

---

## 🔄 工作流程

```
用户上传图片
    ↓
前端生成唯一用户ID → 发送到后端
    ↓
后端检查用户今天的调用次数
    ↓
如果未超过5次 → 调用Anthropic Claude API
    ↓
后端返回分析结果 + 剩余调用次数
    ↓
前端显示结果并提示用户剩余次数
```

---

## 📊 调用次数限制

- **每用户每天** 最多5次调用
- 用户ID存储在浏览器 localStorage（`cf_user_id`）
- 每天UTC时间 00:00 自动重置

### 状态消息

| 情况 | 显示内容 |
|------|--------|
| 剩余3次以上 | （无特殊提示） |
| 剩余1-2次 | ⚠️ 警告信息 |
| 剩余0次 | ❌ 错误提示，请明天再试 |

---

## 🔐 安全特性

✅ **API密钥从不暴露**
- 密钥只在后端服务器存储
- 前端通过HTTPS与后端通信
- 浏览器开发者工具看不到密钥

✅ **请求验证**
- 每个请求都需要userId
- 后端验证请求格式

✅ **速率限制**
- 防止恶意刷API

---

## 📝 前端 → 后端 API

### 食物分析

**请求：**
```javascript
POST /api/analyze

{
  "userId": "user_1234567890",
  "b64": "base64编码的图片数据",
  "mimeType": "image/jpeg"
}
```

**响应（成功）：**
```json
{
  "success": true,
  "data": {
    "name": "Apple",
    "nutrients": { ... },
    "speeches": [ ... ],
    "foodPolygon": [ ... ]
  },
  "remaining": 3,
  "resetTime": "2026-08-19T00:00:00.000Z"
}
```

**响应（超限）：**
```json
{
  "error": "Rate limit exceeded",
  "message": "您今天已经调用5次了，请明天再试。",
  "remaining": 0
}
```

### 人脸特征检测

**请求：**
```javascript
POST /api/face-features

{
  "b64": "base64编码的人脸图片"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "leftEye": {"x": 0.35, "y": 0.3, "w": 0.12, "h": 0.15},
    "rightEye": {"x": 0.65, "y": 0.3, "w": 0.12, "h": 0.15},
    "nose": {"x": 0.5, "y": 0.5, "w": 0.08, "h": 0.12},
    "mouth": {"x": 0.5, "y": 0.7, "w": 0.2, "h": 0.1}
  }
}
```

---

## 🐛 故障排除

### 问题：本地开发时出现 "Cannot find module" 错误

**解决：** 运行 `npm install`

### 问题：Vercel 部署失败

**检查：**
1. 是否设置了 `ANTHROPIC_API_KEY` 环境变量？
2. API密钥是否有效？
3. GitHub仓库是否公开或Vercel有权限访问？

### 问题：每次都说"调用限制已超"

**说明：** 这是正常的。每个用户（由localStorage中的userId识别）每天UTC 00:00前只能调用5次。

---

## 📞 技术支持

如有问题，请检查：
- 浏览器开发者工具的 Network 标签（查看API请求）
- 浏览器开发者工具的 Console 标签（查看错误信息）
- 浏览器 Application → LocalStorage → cf_user_id （查看用户ID）

---

## 📜 许可证

MIT
