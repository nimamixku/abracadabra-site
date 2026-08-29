import { NextResponse } from "next/server";
import { requestLoginLink } from "@/lib/auth";

// Starts the sign-in flow. Always returns a generic success response
// regardless of whether the email matched an existing user -- findOrCreateUser
// makes that moot anyway, but it also avoids the classic "confirm which
// emails have accounts" leak for free.
export async function POST(req) {
  try {
    const { email } = await req.json();
    const origin = new URL(req.url).origin;
    await requestLoginLink({ email, origin });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Something went wrong." }, { status: 400 });
  }
}
