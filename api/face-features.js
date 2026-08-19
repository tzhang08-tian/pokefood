// Face feature extraction endpoint
// 从人脸图像中提取面部特征（眼睛、鼻子、嘴巴等）

import fetch from 'node-fetch';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
    const { b64 } = req.body;

    if (!b64) {
      return res.status(400).json({ error: 'Missing required field: b64' });
    }

    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // 调用Claude API进行人脸特征检测
    const system = `You are a face landmark detector.
Respond ONLY with valid JSON (no markdown) matching this schema exactly:
{"leftEye":{"x":0.0,"y":0.0,"w":0.0,"h":0.0},"rightEye":{"x":0.0,"y":0.0,"w":0.0,"h":0.0},"nose":{"x":0.0,"y":0.0,"w":0.0,"h":0.0},"mouth":{"x":0.0,"y":0.0,"w":0.0,"h":0.0}}
x,y=top-left (0-1 normalized), w,h=width/height (0-1 normalized). Include ~25% padding.`;

    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: b64,
            },
          },
          {
            type: 'text',
            text: 'Return the facial feature bounding boxes for this portrait.',
          },
        ],
      },
    ];

    const result = await callClaudeAPI(system, messages);

    // 解析并返回结果
    const jsonResult = JSON.parse(
      result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    );

    res.status(200).json({
      success: true,
      data: jsonResult,
    });
  } catch (error) {
    console.error('Error:', error);

    res.status(500).json({
      error: 'Face feature extraction failed',
      message: error.message,
    });
  }
}
