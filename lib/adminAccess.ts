import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const adminCookieName = "driveline_admin";
const adminSessionMaxAgeSeconds = 8 * 60 * 60;

type AdminSessionPayload = {
  email: string;
  exp: number;
};

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;

  return adminEmails().includes(email.toLowerCase());
}

export function hasAdminPasswordConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function verifyAdminPassword(password: string) {
  return Boolean(process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD);
}

export async function hasValidAdminSession(email: string | null | undefined) {
  if (!isAdminEmail(email)) return false;

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(adminCookieName)?.value;
  if (!cookieValue) return false;

  const payload = verifySessionCookie(cookieValue);
  return Boolean(payload && payload.email === email?.toLowerCase() && payload.exp > Date.now());
}

export async function setAdminSession(email: string) {
  const cookieStore = await cookies();
  cookieStore.set(adminCookieName, createSessionCookie(email.toLowerCase()), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: adminSessionMaxAgeSeconds
  });
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function createSessionCookie(email: string) {
  const payload = Buffer.from(
    JSON.stringify({
      email,
      exp: Date.now() + adminSessionMaxAgeSeconds * 1000
    } satisfies AdminSessionPayload)
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

function verifySessionCookie(value: string): AdminSessionPayload | null {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = sign(payload);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.email === "string" &&
      typeof parsed.exp === "number"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function sign(payload: string) {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "dev-admin-secret";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
