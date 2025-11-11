import { NextResponse } from "next/server";
import { API_BASE } from '@/src/configs/api'; 


export async function POST(req: Request) {
  const body = await req.json();
  const r = await fetch(`${API_BASE}/api/Banner/set-banner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}
