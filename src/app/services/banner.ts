// src/services/banner.ts

/** =================== TYPES =================== **/

// API'nin beklediği/gönderdiği temel şema
export type BannerApiItem = {
  id: number | string;
  title: string;
  image_url: string;
  priority?: number;
  active?: boolean;
};

// Create/Update payload
export type BannerPayload = {
  id?: number | string;
  title: string;
  image_url: string;     // URL, relative path veya data:
  priority?: number;     // küçük olan önce gelir
  active?: boolean;      // varsayılan: true
};

/** =================== HELPERS =================== **/

function toDisplaySrc(raw?: string) {
  const s = (raw || "").trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:")) return s;
  // relative path → /yuksi prefix (rewrite kuralına uygun)
  return s.startsWith("/") ? `/yuksi${s}` : `/yuksi/${s}`;
}

async function readJson(res: Response) {
  const txt = await res.text().catch(() => "");
  try { return txt ? JSON.parse(txt) : {}; } catch { return txt; }
}

function throwIfNotOk(res: Response, data: any, fallback: string) {
  if (!res.ok) {
    const msg =
      (typeof data === "string" && data) ||
      data?.message || data?.title || data?.detail ||
      `HTTP ${res.status}`;
    throw new Error(msg || fallback);
  }
}

/** =================== CRUD =================== **/

// DİKKAT: Hepsi /yuksi/... — rewrite otomatik /api/... ekler
export async function getBanners() {
  const r = await fetch('https://www.yuksi.dev/api/Banner/get-banners', { cache: "no-store" });
  const data = await readJson(r);
  throwIfNotOk(r, data, "Bannerlar alınamadı");
  return data;
}

export async function createBanner(body: BannerPayload) {
  const r = await fetch("/yuksi/Banner/set-banner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJson(r);
  throwIfNotOk(r, data, "Oluşturma hatası");
  return data;
}

export async function updateBanner(body: BannerPayload) {
  const r = await fetch("/yuksi/Banner/update-banner", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJson(r);
  throwIfNotOk(r, data, "Güncelleme hatası");
  return data;
}

export async function deleteBanner(id: number | string) {
  const r = await fetch(`/yuksi/Banner/delete-banner/${id}`, { method: "DELETE" });
  const data = await readJson(r);
  throwIfNotOk(r, data, "Silme hatası");
  return data;
}

/** =================== UI MAPPING =================== **/

export async function fetchBanners(): Promise<
  { id: number | string; src: string; title?: string; priority: number }[]
> {
  // BURASI DA /yuksi/... olmalı; /api/... kullanma (server context'te base URL yok)
  const r = await fetch('https://www.yuksi.dev/api/Banner/get-banners', { cache: "no-store" });
  const data = await readJson(r);
  throwIfNotOk(r, data, "Bannerlar alınamadı");

  const arr: BannerApiItem[] = Array.isArray((data as any)?.data) ? (data as any).data
                         : Array.isArray(data as any) ? (data as any)
                         : [];

  return arr
    .map((b) => ({
      id: b.id,
      src: toDisplaySrc(b.image_url),
      title: b.title,
      priority: Number.isFinite(b.priority as any) ? Number(b.priority) : 0,
      active: b.active !== false,
    }))
    .filter((x) => !!x.src && x.active)
    .sort((a, b) => a.priority - b.priority)
    .map(({ active, ...rest }) => rest);
}
