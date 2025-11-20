// src/components/auth/AdminLoginForm.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  decodeJwt,
  isExpired,
  roleSegment,
  type JwtClaims,
} from "@/src/utils/jwt";

function extractToken(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    if (raw.split(".").length === 3) return raw;
    try {
      return extractToken(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  return (
    raw.token ||
    raw.access_token ||
    raw.accessToken ||
    raw.jwt ||
    raw?.data?.accessToken ||
    raw?.data?.token ||
    raw?.result?.accessToken ||
    raw?.result?.token ||
    null
  );
}

function persistToken(token: string, exp?: number) {
  try {
    localStorage.setItem("auth_token", token);
  } catch {}

  fetch("/api/auth/set-cookie", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, exp }),
  }).catch(() => {});
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/yuksi/Auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = rawText;
      }

      if (!res.ok) {
        const msg =
          (typeof data === "object" && (data?.message || data?.error)) ||
          "Giriş başarısız.";
        setErr(msg);
        return;
      }

      const token = extractToken(data);
      if (!token) {
        setErr("Giriş yapılamadı.");
        return;
      }

      const claims = decodeJwt<JwtClaims>(token);
      if (!claims) {
        setErr("Token çözümlenemedi.");
        return;
      }
      if (isExpired(claims)) {
        setErr("Oturum süresi dolmuş.");
        return;
      }

      let userRole = String(roleSegment(claims.userType) || "").toLowerCase().trim();

      if (!userRole) {
        const firstRole = Array.isArray(data?.data?.roles) ? data.data.roles[0] : undefined;
        userRole = firstRole.toLowerCase().trim();
      }

      if (!userRole) {
        const anyClaimRole =
          (claims as any).role ||
          (claims as any)["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
        userRole = anyClaimRole.toLowerCase().trim();
      }

      if (userRole !== "restaurant") {
        setErr("Bu panele sadece restoran erişebilir.");
        return;
      }

      persistToken(token, claims.exp);

      
      const refreshToken =
        data?.refreshToken ||
        data?.data?.refreshToken ||
        data?.result?.refreshToken;

      if (refreshToken) {
        try {
          localStorage.setItem("refresh_token", refreshToken);
        } catch {}
        // istersen cookie de yazabilirsin
        document.cookie = `refresh_token=${encodeURIComponent(
          refreshToken
        )}; Path=/; SameSite=Lax`;
      }

      router.replace("/dashboard");
    } catch {
      setErr("Ağ hatası. Tekrar dene.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-orange-200">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-orange-600">Restoran Paneli</h1>
          <p className="text-gray-600 mt-2">Restoran giriş ekranı</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {err && (
            <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
              {err}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-700"
              placeholder="restaurant@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Şifre
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-700"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-orange-600 text-white font-semibold rounded-lg shadow-md hover:bg-orange-700 transition disabled:opacity-60"
          >
            {loading ? "Giriş yapılıyor..." : "Restoran Giriş"}
          </button>
        </form>

        <p className="text-xs text-center text-gray-500 mt-6">
          Bu panel sadece restoran kullanıcıları içindir.
        </p>
      </div>
    </div>
  );
}