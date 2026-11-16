// Public card gallery.
//   POST   /api/cards { image, foodName, calories }   anyone: store a finished card
//   GET    /api/cards?limit=&before=                   anyone: list cards (metadata, newest first)
//   GET    /api/cards?id=...&img=1                     anyone: the card image itself (binary, cacheable)
//   GET    /api/cards?auth=1                           check an admin token (Authorization: Bearer ...)
//   DELETE /api/cards?id=...                           ADMIN ONLY: Authorization: Bearer <ADMIN_TOKEN>
//
// Storage: Upstash / Vercel KV (REST) when configured, in-process memory otherwise (local dev).
// Deleting needs the ADMIN_TOKEN env var; if it is not set, nobody can delete.

import { timingSafeEqual } from 'node:crypto';

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const MAX_IMAGE_CHARS = 900_000;
const useKV = !!(KV_URL && KV_TOKEN);

const mem = (globalThis.__pokefoodCards ||= new Map());   // id -> { meta, image }

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

const isAdmin = req => {
  if (!ADMIN_TOKEN) return false;
  const m = /^Bearer (.+)$/.exec(req.headers?.authorization || '');
  if (!m) return false;
  const a = Buffer.from(m[1]), b = Buffer.from(ADMIN_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
};

const cleanText = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').slice(0, n);

async function addCard(meta, image) {
  if (useKV) {
    await kv(['SET', `pf:card:${meta.id}`, JSON.stringify(meta)]);
    await kv(['SET', `pf:cardimg:${meta.id}`, image]);
    await kv(['ZADD', 'pf:cards', meta.ts, meta.id]);
  } else mem.set(meta.id, { meta, image });
}

async function listCards(limit, before) {
  if (useKV) {
    const ids = await kv(['ZREVRANGEBYSCORE', 'pf:cards', before ? `(${before}` : '+inf', '-inf', 'LIMIT', 0, limit]);
    if (!ids?.length) return [];
    const metas = await kv(['MGET', ...ids.map(i => `pf:card:${i}`)]);
    return metas.filter(Boolean).map(m => JSON.parse(m));
  }
  return [...mem.values()].map(v => v.meta).filter(m => !before || m.ts < before)
    .sort((a, b) => b.ts - a.ts).slice(0, limit);
}

async function getImage(id) {
  if (useKV) return kv(['GET', `pf:cardimg:${id}`]);
  return mem.get(id)?.image || null;
}

async function deleteCard(id) {
  if (useKV) {
    await kv(['DEL', `pf:card:${id}`, `pf:cardimg:${id}`]);
    await kv(['ZREM', 'pf:cards', id]);
  } else mem.delete(id);
}

const validId = id => /^[a-z0-9]{8,40}$/.test(id || '');

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { image, foodName, calories } = req.body || {};
      if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(image)) return res.status(400).json({ error: 'image must be a jpeg/png/webp data URL' });
      if (image.length > MAX_IMAGE_CHARS) return res.status(413).json({ error: 'image too large' });
      const ts = Date.now();
      const id = ts.toString(36) + Math.random().toString(36).slice(2, 8);
      const meta = { id, ts, foodName: cleanText(foodName, 60) || 'Food', calories: cleanText(calories, 12) };
      await addCard(meta, image);
      return res.status(200).json({ ok: true, id });
    }

    if (req.method === 'GET') {
      const q = req.query || {};
      res.setHeader('Cache-Control', 'no-store');
      if (q.auth) return res.status(isAdmin(req) ? 200 : 401).json({ admin: isAdmin(req) });
      if (q.id) {
        if (!validId(q.id)) return res.status(400).json({ error: 'bad id' });
        const image = await getImage(q.id);
        if (!image) return res.status(404).json({ error: 'not found' });
        const m = /^data:(image\/[a-z]+);base64,(.*)$/s.exec(image);
        res.setHeader('Content-Type', m[1]);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.status(200).send(Buffer.from(m[2], 'base64'));
      }
      const limit = Math.min(Math.max(parseInt(q.limit, 10) || 60, 1), 200);
      const before = parseInt(q.before, 10) || 0;
      return res.status(200).json({ cards: await listCards(limit, before) });
    }

    if (req.method === 'DELETE') {
      if (!isAdmin(req)) return res.status(403).json({ error: 'admin only' });
      const id = String(req.query?.id || '');
      if (!validId(id)) return res.status(400).json({ error: 'bad id' });
      await deleteCard(id);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('cards error:', e);
    return res.status(500).json({ error: e.message });
  }
}
