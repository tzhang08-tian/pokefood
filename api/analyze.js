import fetch from 'node-fetch';

// 简单的内存存储 - 存储用户的调用记录
// 格式：{ "userId:YYYY-MM-DD": count }
const callCounts = new Map();

const MAX_CALLS_PER_DAY = 5;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// 获取当天日期
function getTodayDate() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

// 检查用户是否超过限制
function checkRateLimit(userId) {
  const today = getTodayDate();
  const key = `${userId}:${today}`;
  const count = callCounts.get(key) || 0;
  
  if (count >= MAX_CALLS_PER_DAY) {
    return { allowed: false, remaining: 0, count: count };
  }
  
  return { allowed: true, remaining: MAX_CALLS_PER_DAY - count - 1, count: count };
}

// 记录一次调用
function recordCall(userId) {
  const today = getTodayDate();
  const key = `${userId}:${today}`;
  const count = (callCounts.get(key) || 0) + 1;
  callCounts.set(key, count);
  return count;
}

// 调用Anthropic API
async function callClaudeAPI(system, messages) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1600,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// 主处理函数
export default async function handler(req, res) {
  // 只接受POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, b64, mimeType } = req.body;

    // 验证请求
    if (!userId || !b64 || !mimeType) {
      return res.status(400).json({ error: 'Missing required fields: userId, b64, mimeType' });
    }

    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // 检查调用限制
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `您今天已经调用5次了，请明天再试。`,
        remaining: 0,
      });
    }

    // 调用Claude API
    const system = `You are a food recognition and nutrition expert.
Respond ONLY with valid JSON (no markdown fences) matching this schema exactly:
{
  "name": "common food name",
  "sharpness": 0-10,
  "dominantMacro": "sugar|fat|protein|fiber",
  "foodCategory": "vegetable|meat|carb|snack",
  "colorProfile": "warm|cool|neutral",
  "personality": "2-sentence character personality based on dominant macro and shape",
  "faceX": 0.0-1.0,
  "faceY": 0.0-1.0,
  "faceScale": 0.0-1.0,
  "nutrients": {
    "sugar": number, "fat": number, "protein": number, "carbs": number,
    "fiber": number, "potassium": number, "magnesium": number,
    "calcium": number, "vitaminC": number
  },
  "speeches": [
    {
      "nutrient": "Nutrient Name",
      "amount": "Xg",
      "text": "First-person 1-2 sentences. Wrap nutrient name and amount in **bold**. Translate numbers into feelings or superpowers. Match the personality."
    }
  ],
  "foodPolygon": [[0.1,0.2],[0.3,0.05],...]
}
faceX/faceY: normalized 0-1 (image coords, 0=top-left) of the face center on the food.
faceScale: fraction of image width the face region spans.
speeches: 5-7 items, one per key nutrient. Use casual personality-appropriate language.
foodPolygon: 50-80 normalized [x,y] points tracing the complete outer silhouette clockwise.
foodCategory: classify the food — "vegetable" if vegetables dominate, "meat" if meat/fish/poultry dominate, "carb" if starchy carbs (bread/rice/pasta/potato) dominate, "snack" if it is a processed sugar/fat snack (candy/chips/cake/pastry).
Use standard per-serving nutritional values.`;

    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: b64,
            },
          },
          {
            type: 'text',
            text: 'Analyze this food image.',
          },
        ],
      },
    ];

    const result = await callClaudeAPI(system, messages);
    
    // 记录调用
    recordCall(userId);
    const newRateLimit = checkRateLimit(userId);

    // 解析并返回结果
    const jsonResult = JSON.parse(
      result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    );

    res.status(200).json({
      success: true,
      data: jsonResult,
      remaining: newRateLimit.remaining,
      resetTime: new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString(), // 明天UTC 00:00
    });
  } catch (error) {
    console.error('Error:', error);
    
    if (error.message.includes('Rate limit')) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
    });
  }
}
