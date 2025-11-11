import { NextResponse } from "next/server";
import { API_BASE } from '@/src/configs/api'; 


export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await fetch(`${API_BASE}/api/Banner/delete-banner/${(await params).id}`, { method: "DELETE" });
  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}
