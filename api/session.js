// Phone → desktop photo relay.
//   POST /api/session { id, image }   phone uploads a photo (data URL) for session `id`
//   GET  /api/session?id=...          desktop collects it (one-shot: deleted once read)
//   POST /api/session { id, result }  desktop sends the finished card back to the phone
//   GET  /api/session?id=...&kind=result   phone collects the card (kept until TTL so a reload still works)
//
// Storage: Vercel KV / Upstash Redis (REST) when KV_REST_API_URL + KV_REST_API_TOKEN
// (or UPSTASH_REDIS_REST_URL/TOKEN) are set — required on Vercel, where serverless
// instances don't share memory. Otherwise falls back to in-process memory, which is
// fine for the local dev server.

import { cardsUsed, validPid, CARD_LIMIT, LIMIT_MESSAGE } from '../lib/quota.js';

const TTL_SECONDS = 600;
const MAX_IMAGE_CHARS = 900_000; // keeps us under Upstash's 1 MB request limit
const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const mem = (globalThis.__pokefoodSessions ||= new Map());
const memRes = (globalThis.__pokefoodResults ||= new Map());

async function kv(command) {
  const r = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

async function putImage(id, image, pid) {
  if (KV_URL && KV_TOKEN) return kv(['SET', `pf:sess:${id}`, JSON.stringify({ image, pid }), 'EX', TTL_SECONDS]);
  mem.set(id, { image, pid, exp: Date.now() + TTL_SECONDS * 1000 });
}

async function putResult(id, image) {
  if (KV_URL && KV_TOKEN) return kv(['SET', `pf:res:${id}`, image, 'EX', TTL_SECONDS]);
  memRes.set(id, { image, exp: Date.now() + TTL_SECONDS * 1000 });
}

async function getResult(id) {
  if (KV_URL && KV_TOKEN) return (await kv(['GET', `pf:res:${id}`])) || null;
  for (const [k, v] of memRes) if (v.exp < Date.now()) memRes.delete(k);
  const hit = memRes.get(id);
  return hit ? hit.image : null;
}

async function takeImage(id) {
  if (KV_URL && KV_TOKEN) {
    const raw = await kv(['GET', `pf:sess:${id}`]);
    if (raw) await kv(['DEL', `pf:sess:${id}`]);
    return raw ? JSON.parse(raw) : null;
  }
  for (const [k, v] of mem) if (v.exp < Date.now()) mem.delete(k);
  const hit = mem.get(id);
  mem.delete(id);
  return hit ? { image: hit.image, pid: hit.pid } : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      const { id, image, result, pid } = req.body || {};
      if (!/^[a-z0-9]{8,40}$/.test(id || '')) return res.status(400).json({ error: 'bad session id' });
      if (result !== undefined) {
        if (typeof result !== 'string' || !result.startsWith('data:image/')) return res.status(400).json({ error: 'result must be a data URL' });
        if (result.length > MAX_IMAGE_CHARS) return res.status(413).json({ error: 'image too large' });
        await putResult(id, result);
        return res.status(200).json({ ok: true });
      }
      if (typeof image !== 'string' || !image.startsWith('data:image/')) return res.status(400).json({ error: 'image must be a data URL' });
      if (image.length > MAX_IMAGE_CHARS) return res.status(413).json({ error: 'image too large' });
      if (!validPid(pid)) return res.status(400).json({ error: 'missing device id' });
      // Out of cards? Tell the phone right away instead of after the desktop starts analysing.
      if ((await cardsUsed(pid)) >= CARD_LIMIT) return res.status(429).json({ error: LIMIT_MESSAGE, limitReached: true });
      await putImage(id, image, pid);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'GET') {
      const id = String(req.query?.id || '');
      if (!/^[a-z0-9]{8,40}$/.test(id)) return res.status(400).json({ error: 'bad session id' });
      if (req.query?.kind === 'result') return res.status(200).json({ image: await getResult(id) });
      const hit = await takeImage(id);
      return res.status(200).json({ image: hit ? hit.image : null, pid: hit ? hit.pid : null });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('session error:', e);
    return res.status(500).json({ error: e.message });
  }
}
