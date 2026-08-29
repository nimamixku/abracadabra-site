import { NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(req) {
  const raw = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  await destroySession(raw);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
