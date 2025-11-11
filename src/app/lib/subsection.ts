// src/lib/subsection.ts
// Yeni API: snake_case alanlar ve content_type = number | string (label gelebilir)

export type ApiSubSection = {
  id: number;
  title: string;
  content_type: number | string;
  show_in_menu?: boolean;
  show_in_footer?: boolean;
  content: string;
  created_at?: string;
  updated_at?: string;
};

// Hem enum etiketleri (kod içi) hem de ekranda görülen Türkçe adlar:
export const CONTENT_TYPES = [
  { value: 1, label: 'Destek',                display: 'Destek' },
  { value: 2, label: 'Hakkimizda',            display: 'Hakkımızda' },
  { value: 3, label: 'Iletisim',              display: 'İletişim' },
  { value: 4, label: 'GizlilikPolitikasi',    display: 'Gizlilik Politikası' },
  { value: 5, label: 'KullanimKosullari',     display: 'Kullanım Koşulları' },
  { value: 6, label: 'KuryeGizlilikSözlesmesi', display: 'Kurye Gizlilik Sözleşmesi' },
  { value: 7, label: 'KuryeTasiyiciSözlesmesi', display: 'Kurye Taşıyıcı Sözleşmesi' },
] as const;

// Türkçe karakter, aksan ve boşlukları eşitle
function norm(s: string) {
  return String(s || '')
    .trim()
    .toLowerCase()
    // unicode normalize: İ/ı/ş/ğ/ç/ö/ü vs.
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/\s+/g, '')        // boşlukları at
    .replace(/[^a-z0-9]/g, ''); // işaretleri at
}

export function enumToLabel(v: number) {
  // Tercihen ekranda görünür Türkçe adı döndür
  return CONTENT_TYPES.find(x => x.value === v)?.display ?? `İçerik #${v}`;
}

export function labelToEnum(lbl: string) {
  const n = norm(lbl);
  const hit = CONTENT_TYPES.find(
    x => norm(x.label) === n || norm(x.display) === n
  );
  return hit?.value ?? 1;
}

function toInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : null;
}

// ---- FETCH ----
import { API_BASE } from '@/src/configs/api'; // ör: https://www.yuksi.dev/api

async function readJson(res: Response) {
  const t = await res.text();
  try { return t ? JSON.parse(t) : null; } catch { return null; }
}
const pickMsg = (d: any, fb: string) => d?.message || d?.title || d?.detail || d?.error?.message || fb;

export async function fetchSubSectionByType(typeValue: number): Promise<ApiSubSection | null> {
  // ✅ mutlak URL kullan
  const res = await fetch(`${API_BASE}/SubSection/all?offset=0`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    // @ts-ignore
    next: { revalidate: 0 },
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(pickMsg(json, `HTTP ${res.status}`));

  const list: ApiSubSection[] = Array.isArray(json?.data) ? json.data : [];

  // content_type -> önce int, değilse labelToEnum ile sayıya dönüştür
  const found = list.find((it) => {
    const raw = (it as any).content_type ?? (it as any).contentType;
    const ct = toInt(raw) ?? labelToEnum(String(raw));
    return ct === typeValue;
  }) ?? null;

  return found;
}

export async function fetchActiveSubSectionsByType(typeValue: number): Promise<ApiSubSection[]> {
  const res = await fetch(`${API_BASE}/SubSection/all?offset=0`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    // @ts-ignore
    next: { revalidate: 0 },
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(pickMsg(json, `HTTP ${res.status}`));
  const list: ApiSubSection[] = Array.isArray(json?.data) ? json.data : [];

  return list.filter((it) => {
    const raw = (it as any).content_type ?? (it as any).contentType;
    const ct = toInt(raw) ?? labelToEnum(String(raw));
    return ct === typeValue;
  });
}
