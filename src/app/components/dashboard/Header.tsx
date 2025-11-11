// src/components/dashboard/Header.tsx
"use client";

import { useEffect, useRef, useState } from "react";


export default function Header({
  title,
  titleClass = "",
  headerClass = "",
  userLabel = "Hesabım",
}: {
  title: string;
  titleClass?: string;
  headerClass?: string;
  userLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const getCookie = (name: string) => {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  };

  const clearCookie = (name: string) => {
    try {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; Path=/`;
    } catch {}
  };

  const clientCleanup = () => {
    try {
      // new keys
      localStorage.removeItem("auth_token");
      localStorage.removeItem("refresh_token");

      sessionStorage.removeItem("auth_token");

      clearCookie("auth_token");
      clearCookie("refresh_token");
    } catch {}
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      const refreshToken =
        localStorage.getItem("refresh_token") || getCookie("refresh_token") || "";

      // elde JWT varsa Authorization header ekleyelim
      const bearer =
        localStorage.getItem("auth_token") ||
        sessionStorage.getItem("auth_token") ||
        "";

      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (bearer) (headers as any).Authorization = `Bearer ${bearer}`;

      await fetch("https://www.yuksi.dev/api/Auth/logout", {
        method: "POST",
        headers,
        body: JSON.stringify({ refreshToken }), // ← swagger’daki body
      }).catch(() => {
        /* ağ hatası olsa bile aşağıda temizleyeceğiz */
      });
    } finally {
      clientCleanup();
      window.location.href = "/"; // ana sayfa
    }
  };

  return (
    <header
      className={[
        "sticky top-0 z-10 px-4 py-3 border-b",
        headerClass || "bg-white border-neutral-200 text-neutral-900",
      ].join(" ")}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <h1 className={["text-lg font-semibold", titleClass].join(" ")}>{title}</h1>

        <div className="relative" ref={menuRef}>
          <button
          type="button" 
            onClick={() => setOpen((s) => !s)}
            className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-white/10"
            title={userLabel}
          >
            <span className="text-sm opacity-80">{userLabel}</span>
            <div className="h-8 w-8 rounded-full bg-white/30" />
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-44 rounded-xl border border-neutral-200 bg-white text-neutral-800 shadow-lg">
              <button
              type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full px-3 py-2 text-left rounded-t-xl hover:bg-neutral-50 disabled:opacity-60"
              >
                {loggingOut ? "Çıkış yapılıyor…" : "Çıkış Yap"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
