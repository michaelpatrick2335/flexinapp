import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const envCheck = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    POSTGRES_URL: !!process.env.POSTGRES_URL,
    POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
    POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
    SESSION_SECRET: !!process.env.SESSION_SECRET,
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    NODE_ENV: process.env.NODE_ENV || null,
    VERCEL_ENV: process.env.VERCEL_ENV || null,
    pg_host_hint: (process.env.POSTGRES_URL || process.env.DATABASE_URL || "").split("@")[1]?.split("/")[0] || null,
  };
  return res.json({ ok: true, method: req.method, url: req.url, env: envCheck });
}
