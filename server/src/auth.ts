import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Context, Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

const COOKIE = 'admin_token';

function secret() {
  return process.env.JWT_SECRET || 'dev-secret-change-me';
}

function adminPassword() {
  return process.env.ADMIN_PASSWORD || 'admin123';
}

function sign(payload: string): string {
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verify(token: string): boolean {
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) && payload.startsWith('admin:');
  } catch {
    return false;
  }
}

export function checkAdminPassword(password: string): boolean {
  const a = Buffer.from(password);
  const b = Buffer.from(adminPassword());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function setAdminSession(c: Context) {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const token = sign(`admin:${exp}`);
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function clearAdminSession(c: Context) {
  deleteCookie(c, COOKIE, { path: '/' });
}

export function isAdmin(c: Context): boolean {
  const token = getCookie(c, COOKIE);
  if (!token) return false;
  if (!verify(token)) return false;
  const payload = token.slice(0, token.lastIndexOf('.'));
  const exp = Number(payload.split(':')[1]);
  return Number.isFinite(exp) && exp > Date.now();
}

export async function requireAdmin(c: Context, next: Next) {
  if (!isAdmin(c)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
}
