import { NextResponse } from "next/server";
import { API_BASE } from '@/src/configs/api'; 


export async function PATCH(req: Request) {
  const body = await req.json();
  const r = await fetch(`${API_BASE}/api/Banner/update-banner`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}
