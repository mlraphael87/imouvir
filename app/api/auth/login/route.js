import { NextResponse } from "next/server";
import { setSession } from "@/lib/auth";

export async function POST(request) {
  const { password } = await request.json();
  const expected = process.env.CRM_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  }

  await setSession();
  return NextResponse.json({ ok: true });
}
