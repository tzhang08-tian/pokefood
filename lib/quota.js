// Per-person card quota: each person (a device id kept in the browser) can make CARD_LIMIT cards.
// Counted server-side (Upstash / Vercel KV when configured, in-process memory for local dev),
// so it holds across the phone, the on-site display and every serverless instance.
// A "card" is counted when an image analysis succeeds.

export const CARD_LIMIT = parseInt(process.env.CARD_LIMIT, 10) || 3;
const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const useKV = !!(KV_URL && KV_TOKEN);
const mem = (globalThis.__pokefoodQuota ||= new Map());

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

export const validPid = pid => /^[A-Za-z0-9_-]{8,64}$/.test(pid || '');
export const LIMIT_MESSAGE = `You've already made your ${CARD_LIMIT} cards — thanks for playing!`;

export async function cardsUsed(pid) {
  if (useKV) return parseInt(await kv(['GET', `pf:quota:${pid}`]), 10) || 0;
  return mem.get(pid) || 0;
}

// Reserve one card; returns false (and reserves nothing) when the person is out of cards.
export async function reserveCard(pid) {
  const n = useKV ? await kv(['INCR', `pf:quota:${pid}`]) : (mem.set(pid, (mem.get(pid) || 0) + 1), mem.get(pid));
  if (n > CARD_LIMIT) { await releaseCard(pid); return false; }
  return true;
}

export async function releaseCard(pid) {
  if (useKV) await kv(['DECR', `pf:quota:${pid}`]);
  else mem.set(pid, Math.max(0, (mem.get(pid) || 0) - 1));
}
