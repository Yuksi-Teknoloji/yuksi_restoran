import { NextResponse } from "next/server";

const BACKEND_URL = process.env.AUTH_API ?? "http://40.90.226.14:8080/api/Auth/login";

export async function POST(req: Request) {
  try {
    const body = await req.json(); // { email, password }

    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Backend’in döndürdüğü hata mesajını yüzeye çıkar
      const message =
        (data && (data.message || data.error || data.title)) ||
        `Giriş başarısız (HTTP ${res.status})`;
      return NextResponse.json({ ok: false, message }, { status: res.status });
    }

    // Token alanı backend’e göre değişebilir:
    const token =
      data?.token || data?.accessToken || data?.jwt || data?.result?.token;

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Token bulunamadı." },
        { status: 500 }
      );
    }

    const resp = NextResponse.json({ ok: true });

    // 7 gün geçerli, HTTP-only cookie
    resp.cookies.set("auth_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return resp;
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: "Sunucuya bağlanılamadı." },
      { status: 500 }
    );
  }
}
