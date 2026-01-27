// src/components/dashboard/Header.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { type JwtClaims, decodeJwt } from "@/src/utils/jwt";
import { getAuthToken } from "@/src/utils/auth";
import Image from "next/image";
import { Menu } from "lucide-react";

const token = getAuthToken();
const claims: JwtClaims | null = token ? (decodeJwt(token) as JwtClaims) : null;
const exp = claims && claims.exp ? claims.exp : undefined;

type ApiNotif = {
  id: string;
  target_type?: string | null;
  target_id?: string | null;
  title?: string | null;
  message?: string | null;
  logo_uri?: string | null;
  clickable?: boolean | null;
  related_id?: string | null;
  related_type?: string | null;
  delivered?: boolean | null;
  seen?: boolean | null;
  created_at?: string | null;
  delivered_at?: string | null;
  seen_at?: string | null;
};

export default function Header({
  title,
  titleClass = "",
  headerClass = "",
  userLabel = "Hesabım",
  onSidebarToggle,
}: {
  title: string;
  titleClass?: string;
  headerClass?: string;
  userLabel?: string;
  onSidebarToggle?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ===== Notifications =====
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifErr, setNotifErr] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<ApiNotif[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const readJson = async <T,>(res: Response): Promise<T> => {
    const t = await res.text();
    try {
      return (t ? JSON.parse(t) : (null as any)) as T;
    } catch {
      return (t as any) as T;
    }
  };

  const getBearerToken = () => {
    try {
      return (
        getAuthToken() ||
        localStorage.getItem("auth_token") ||
        sessionStorage.getItem("auth_token") ||
        ""
      );
    } catch {
      return getAuthToken() || "";
    }
  };

  const apiGetNotifications = async () => {
    const bearer = getBearerToken();
    if (!bearer) return;

    setNotifLoading(true);
    setNotifErr(null);

    try {
      const res = await fetch("/yuksi/notifications", {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${bearer}`,
        },
      });

      const json: any = await readJson(res);
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || json?.detail || `HTTP ${res.status}`);
      }

      const arr: ApiNotif[] = Array.isArray(json?.data) ? json.data : [];
      // sadece listeyi basıyoruz. burada delivered/seen dokunmuyoruz.
      setNotifs(arr);
    } catch (e: any) {
      setNotifErr(e?.message || "Bildirimler alınamadı.");
    } finally {
      setNotifLoading(false);
    }
  };

  // Bildirime tıklayınca:
  // - delivered + seen POST
  // - UI’dan bildirimi uçur
  const consumeNotification = async (n: ApiNotif) => {
    const bearer = getBearerToken();
    if (!bearer || !n?.id) return;

    const id = n.id;

    // UI: anında uçur
    setNotifs((prev) => prev.filter((x) => x.id !== id));

    // Network: sırayla işaretle
    // (ikisi de body istemiyor, swagger’da -d {} yok)
    await fetch(`/yuksi/notifications/${encodeURIComponent(id)}/delivered`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${bearer}`,
      },
    }).catch(() => null);

    await fetch(`/yuksi/notifications/${encodeURIComponent(id)}/seen`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${bearer}`,
      },
    }).catch(() => null);
  };

  // Badge: “delivered olmayanları getiriyor” demiştin,
  // ama biz güvenli olsun diye seen=false veya delivered=false olanları sayalım.
  const unreadCount = notifs.filter((x) => x && (x.seen === false || x.delivered === false)).length;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    // ilk yükle + periyodik (badge güncel kalsın)
    apiGetNotifications().catch(() => null);
    const t = window.setInterval(() => {
      apiGetNotifications().catch(() => null);
    }, 30000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // panel açılınca listeyi çek
    if (notifOpen) apiGetNotifications().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifOpen]);

  const getCookie = (name: string) => {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  };

  const clearCookie = (name: string) => {
    try {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; Path=/`;
    } catch { }
  };

  const clientCleanup = () => {
    try {
      // new keys
      localStorage.removeItem("auth_token");
      localStorage.removeItem("refresh_token");

      sessionStorage.removeItem("auth_token");

      clearCookie("auth_token");
      clearCookie("refresh_token");
    } catch { }
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

      await fetch("/api/auth/set-cookie", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, exp }),
      }).catch(() => { });
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
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {onSidebarToggle && (
            <button
              type="button"
              onClick={onSidebarToggle}
              className="shrink-0 flex items-center justify-center h-10 w-10 rounded-lg hover:bg-black/10 -ml-1"
              title="Menü"
              aria-label="Menüyü aç veya kapat"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <h1 className={["text-lg font-semibold truncate", titleClass].join(" ")}>
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((s) => !s)}
              className="relative flex items-center justify-center h-10 w-10 rounded-lg hover:bg-black/5"
              title="Bildirimler"
            >
              {/* Bell icon (inline SVG) */}
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-80"
                aria-hidden="true"
              >
                <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>

              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[11px] font-semibold flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-96 max-w-[90vw] rounded-xl border border-neutral-200 bg-white text-neutral-800 shadow-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100">
                  <div className="text-sm font-semibold">Bildirimler</div>
                  <button
                    type="button"
                    onClick={() => apiGetNotifications().catch(() => null)}
                    className="text-xs font-semibold rounded-lg px-2 py-1 border border-neutral-200 hover:bg-neutral-50"
                    disabled={notifLoading}
                  >
                    {notifLoading ? "Yükleniyor…" : "Yenile"}
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-auto">
                  {notifErr && (
                    <div className="px-3 py-2 text-sm text-rose-700 bg-rose-50 border-b border-rose-100">
                      {notifErr}
                    </div>
                  )}

                  {notifLoading && (
                    <div className="px-3 py-6 text-sm text-neutral-500">
                      Yükleniyor…
                    </div>
                  )}

                  {!notifLoading && !notifErr && notifs.length === 0 && (
                    <div className="px-3 py-6 text-sm text-neutral-500">
                      Bildirim yok.
                    </div>
                  )}

                  {!notifLoading &&
                    notifs.map((n) => {
                      const isUnread = n.seen === false || n.delivered === false;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => consumeNotification(n)}
                          className={[
                            "w-full text-left px-3 py-3 border-b border-neutral-100 hover:bg-neutral-50",
                            isUnread ? "bg-indigo-50/40" : "bg-white",
                          ].join(" ")}
                          title="Tıkla: delivered + seen işaretlenir ve bildirim kaldırılır"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0 opacity-90"
                              style={{ visibility: isUnread ? "visible" : "hidden" }}
                            />
                            {/* LOGO (yuvarlak + tamamen doldursun) */}
                            {n.logo_uri ? (
                              <div className="h-12 w-12 rounded-full overflow-hidden shrink-0 bg-white border border-neutral-200">
                                <img
                                  src={n.logo_uri}
                                  alt={`${n.title || "notification"} logo`}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ) : (
                              <div className="h-12 w-12 rounded-full shrink-0 bg-neutral-100 border border-neutral-200 flex items-center justify-center text-xs text-neutral-500">
                                🏷️
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-neutral-900 truncate">
                                {n.title || "(Başlıksız)"}
                              </div>
                              {n.message ? (
                                <div className="mt-0.5 text-xs text-neutral-600 line-clamp-3 whitespace-pre-line">
                                  {n.message}
                                </div>
                              ) : null}
                              {n.created_at ? (
                                <div className="mt-1 text-[11px] text-neutral-500">
                                  {String(n.created_at)}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen((s) => !s)}
              className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-white/10"
              title={userLabel}
            >
              <span className="text-sm opacity-80">{userLabel}</span>
              <Image
                src="/Brand/logo.png"
                alt="Yuksi"
                width={52}
                height={52}
                className="h-9 w-9 rounded-full bg-orange p-0 object-contain"
              />
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
      </div>
    </header>
  );
}
