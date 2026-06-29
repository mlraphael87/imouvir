import { cookies } from "next/headers";
import crypto from "node:crypto";

const COOKIE_NAME = "imouvir_crm_session";

function secret() {
  return process.env.SESSION_SECRET || "dev-secret-change-me";
}

export function signSession(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export function createSessionValue() {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${signSession(issuedAt)}`;
}

export function isValidSession(value) {
  if (!value || !value.includes(".")) return false;
  const [issuedAt, signature] = value.split(".");
  const expected = signSession(issuedAt);
  if (!signature || signature.length !== expected.length) return false;
  const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  const ageMs = Date.now() - Number(issuedAt);
  return valid && ageMs < 1000 * 60 * 60 * 12;
}

export async function requireAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME)?.value;
  return isValidSession(session);
}

export async function setSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
