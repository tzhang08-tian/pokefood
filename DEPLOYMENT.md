# Vercel 部署指南

## 5分钟快速部署到Vercel

### 第1步：准备GitHub仓库

1. 确保你的代码已推送到GitHub
2. 包含以下文件：
   - `index.html` ✓
   - `api/analyze.js` ✓
   - `api/face-features.js` ✓
   - `vercel.json` ✓
   - `package.json` ✓

### 第2步：连接Vercel

1. 访问 https://vercel.com
2. 点击 **"New Project"**
3. 选择 **"Import Git Repository"**
4. 授权GitHub，选择你的 `pokefood` 仓库

### 第3步：设置环境变量

1. 在Vercel项目设置中，进入 **"Environment Variables"**
2. 添加新变量：
   - Name: `ANTHROPIC_API_KEY`
   - Value: 你的API密钥（从 https://console.anthropic.com/ 获取）
3. 点击 **"Add"**

### 第4步：部署

1. 点击 **"Deploy"**
2. 等待部署完成（通常30秒-2分钟）
3. 你会看到类似这样的URL：
   ```
   https://pokefood-xyz123.vercel.app
   ```

### 完成！🎉

你的网站现在已经上线了！

---

## 自动部署（推荐）

设置完后，Vercel会：
- 自动监听GitHub推送
- 每次你推送代码时自动部署
- 失败时自动回滚到上个版本

### 推送新代码：
```bash
git add .
git commit -m "更新功能"
git push origin main
```

Vercel会自动部署！✨

---

## 验证部署成功

1. 打开你的Vercel URL
2. 上传一张食物图片
3. 查看是否能分析成功

如果出错，查看 Vercel 仪表板中的 **"Functions"** 标签查看日志。

---

## 常见问题

**Q: 部署失败，显示"API key not configured"**  
A: 检查是否正确设置了 `ANTHROPIC_API_KEY` 环境变量

**Q: 如何更新API密钥？**  
A: 在Vercel项目设置中修改环境变量，然后重新部署（点击 "Redeploy"）

**Q: 我的项目部署地址是什么？**  
A: 在Vercel仪表板中看，格式是 `https://[项目名]-[随机ID].vercel.app`
