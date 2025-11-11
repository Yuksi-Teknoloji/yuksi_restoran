import { NextResponse } from "next/server";
import { API_BASE } from '@/src/configs/api'; 


export async function POST(req: Request) {
  try {
    const body = await req.json();

    const upstream = await fetch(`${API_BASE}/api/Restaurant/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!upstream.ok) {
      return NextResponse.json(
        { ok: false, status: upstream.status, error: data?.message || data },
        { status: upstream.status }
      );
    }

    // Her zaman aynı şekil dön
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Proxy error" },
      { status: 500 }
    );
  }
}
