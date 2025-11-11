// src/app/dashboards/[role]/restaurants/profile/page.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { decodeJwt, type JwtClaims } from '@/src/utils/jwt';
import MapPicker, { type GeoPoint } from '@/src/components/map/MapPicker';

/** -------- helpers (token) -------- */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const keys = ['auth_token', 'token', 'authToken', 'access_token', 'jwt'];
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v && v.trim()) return v.trim();
    }
  } catch {}
  if (typeof document !== 'undefined') {
    const m =
      document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/) ||
      document.cookie.match(/(?:^|;\s*)token=([^;]+)/) ||
      document.cookie.match(/(?:^|;\s*)authToken=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

function getUserIdFromToken(tok: string | null): string | null {
  const claims = decodeJwt<JwtClaims>(tok || undefined);
  if (!claims) return null;
  const raw = (claims.userId ?? claims.sub ?? (claims as any).userid) as any;
  return raw != null ? String(raw) : null;
}

/** --- API tipleri --- */
type ApiProfile = {
  email: string;
  phone: string;
  contactPerson: string;
  addressLine1: string;
  addressLine2: string;
  openingHour: string;
  closingHour: string;

  // konum
  latitude: string;   // input için string
  longitude: string;  // input için string
};

export default function RestaurantProfilePage() {
  const [token, setToken] = React.useState<string | null>(null);
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);

  const [form, setForm] = React.useState<ApiProfile>({
    email: '',
    phone: '',
    contactPerson: '',
    addressLine1: '',
    addressLine2: '',
    openingHour: '',
    closingHour: '',
    latitude: '',
    longitude: '',
  });

  const [editing, setEditing] = React.useState({
    email: false,
    phone: false,
    contactPerson: false,
    addressLine1: false,
    addressLine2: false,
    openingHour: false,
    closingHour: false,
    latitude: false,
    longitude: false,
  });

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [errMsg, setErrMsg] = React.useState<string | null>(null);

  const toggle = (k: keyof typeof editing) =>
    setEditing((s) => ({ ...s, [k]: !s[k] }));

  /** 1) token + userId çek */
  React.useEffect(() => {
    const t = getAuthToken();
    setToken(t);
    const uid = getUserIdFromToken(t);
    if (!uid) {
      setErrMsg('Kimlik doğrulama bulunamadı: token’da userId/sub yok.');
      setLoading(false);
      return;
    }
    setRestaurantId(uid);
  }, []);

  /** 2) profil yükle */
  React.useEffect(() => {
    if (!restaurantId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      setErrMsg(null);
      try {
        const res = await fetch(`/yuksi/Restaurant/${restaurantId}/profile`, {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const txt = await res.text();
        const j = txt ? JSON.parse(txt) : null;

        if (!res.ok || j?.success === false) {
          const msg = j?.message || j?.detail || j?.title || `HTTP ${res.status}`;
          throw new Error(msg);
        }

        const data = j?.data ?? j?.result ?? j ?? {};

        if (!alive) return;
        setForm({
          email: data.email ?? '',
          phone: data.phone ?? '',
          contactPerson: data.contactPerson ?? '',
          addressLine1: data.addressLine1 ?? '',
          addressLine2: data.addressLine2 ?? '',
          openingHour: data.openingHour ?? '',
          closingHour: data.closingHour ?? '',
          latitude: data.latitude != null ? String(data.latitude) : '',
          longitude: data.longitude != null ? String(data.longitude) : '',
        } as ApiProfile);
      } catch (e: any) {
        if (!alive) return;
        setErrMsg(e?.message || 'Profil bilgileri alınamadı.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [restaurantId, token]);

  /** ---- MapPicker senkronizasyonu ---- */
  // inputtaki string değerlerden MapPicker için GeoPoint üret
  const mapValue: GeoPoint | null = React.useMemo(() => {
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  }, [form.latitude, form.longitude]);

  // MapPicker'da bir konum seçilince (Nominatim display_name dahil gelir) inputlara ve adrese yaz
  const onPickFromMap = (p: GeoPoint) => {
    setForm((prev) => ({
      ...prev,
      latitude: String(Number(p.lat.toFixed(6))),
      longitude: String(Number(p.lng.toFixed(6))),
      // ✅ OSM reverse’den gelen display_name’i addressLine1’e bas
      addressLine1: p.address ? String(p.address) : prev.addressLine1,
    }));
  };

  /** 3) Kaydet */
  async function saveAll() {
    if (!restaurantId || saving) return;
    setSaving(true);
    setOkMsg(null);
    setErrMsg(null);
    try {
      const lat = form.latitude.trim();
      const lng = form.longitude.trim();
      const latNum = lat === '' ? undefined : Number(lat);
      const lngNum = lng === '' ? undefined : Number(lng);

      const body: any = {
        email: form.email,
        phone: form.phone,
        contactPerson: form.contactPerson,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2,
        openingHour: form.openingHour,
        closingHour: form.closingHour,
      };
      if (!Number.isNaN(latNum!)) body.latitude = latNum;
      if (!Number.isNaN(lngNum!)) body.longitude = lngNum;

      const res = await fetch(`/yuksi/Restaurant/${restaurantId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const txt = await res.text();
      const j = txt ? JSON.parse(txt) : null;

      if (!res.ok || j?.success === false) {
        const msg = j?.message || j?.detail || j?.title || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      setOkMsg('Profil başarıyla güncellendi.');
      setEditing({
        email: false,
        phone: false,
        contactPerson: false,
        addressLine1: false,
        addressLine2: false,
        openingHour: false,
        closingHour: false,
        latitude: false,
        longitude: false,
      });
    } catch (e: any) {
      setErrMsg(e?.message || 'Profil güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }

  const onChange =
    (k: keyof ApiProfile) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>

      {loading && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">Yükleniyor…</div>
      )}

      {!loading && (
        <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-neutral-200/70 bg-orange-50 p-4 sm:p-6">
            {okMsg && (
              <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
                {okMsg}
              </div>
            )}
            {errMsg && (
              <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                {errMsg}
              </div>
            )}

            <Block title="Adres">
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  value={form.addressLine1}
                  onChange={onChange('addressLine1')}
                  disabled={!editing.addressLine1}
                />
                <EditButton onClick={() => toggle('addressLine1')} active={editing.addressLine1} />
              </Row>
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  value={form.addressLine2}
                  onChange={onChange('addressLine2')}
                  disabled={!editing.addressLine2}
                />
                <EditButton onClick={() => toggle('addressLine2')} active={editing.addressLine2} />
              </Row>
            </Block>

            {/* Konum: input + harita (iki yönlü senkron) */}
            <Block title="Konum">
              <Row>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Enlem (örn: 36.480965)"
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  value={form.latitude}
                  onChange={onChange('latitude')}
                  disabled={!editing.latitude}
                />
                <EditButton onClick={() => toggle('latitude')} active={editing.latitude} />
              </Row>
              <Row>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Boylam (örn: 36.356617)"
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  value={form.longitude}
                  onChange={onChange('longitude')}
                  disabled={!editing.longitude}
                />
                <EditButton onClick={() => toggle('longitude')} active={editing.longitude} />
              </Row>

              {/* Harita seçimi — inputlar kilitli olsa da haritadan seçim yazılır */}
              <div className="mt-3">
                <MapPicker
                  label="Haritada Konum Seç"
                  value={mapValue}
                  onChange={onPickFromMap}
                  defaultCenter={{ lat: 41.015137, lng: 28.97953 }}
                />
              </div>
            </Block>

            <Block title="İletişim">
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  value={form.contactPerson}
                  onChange={onChange('contactPerson')}
                  disabled={!editing.contactPerson}
                />
                <EditButton onClick={() => toggle('contactPerson')} active={editing.contactPerson} />
              </Row>
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  value={form.phone}
                  onChange={onChange('phone')}
                  disabled={!editing.phone}
                />
                <EditButton onClick={() => toggle('phone')} active={editing.phone} />
              </Row>
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  value={form.email}
                  onChange={onChange('email')}
                  disabled={!editing.email}
                />
                <EditButton onClick={() => toggle('email')} active={editing.email} />
              </Row>
            </Block>

            <Block title="Çalışma Saatleri">
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  placeholder="Açılış (örn: 08:00)"
                  value={form.openingHour}
                  onChange={onChange('openingHour')}
                  disabled={!editing.openingHour}
                />
                <EditButton onClick={() => toggle('openingHour')} active={editing.openingHour} />
              </Row>
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  placeholder="Kapanış (örn: 23:00)"
                  value={form.closingHour}
                  onChange={onChange('closingHour')}
                  disabled={!editing.closingHour}
                />
                <EditButton onClick={() => toggle('closingHour')} active={editing.closingHour} />
              </Row>
            </Block>

            <div className="flex justify-center pt-2">
              <button
                onClick={saveAll}
                disabled={saving || !restaurantId}
                className="rounded-xl border border-orange-300 bg-white px-6 py-2.5 text-sm font-semibold text-orange-600 shadow-sm hover:bg-orange-50 disabled:opacity-60"
              >
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>

          <aside className="rounded-2xl border border-neutral-200/70 bg-white p-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative h-40 w-40">
                <Image
                  src="/Brand/yuksi.png"
                  alt="profile"
                  fill
                  className="rounded-full object-cover ring-4 ring-orange-500"
                />
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  <span className="font-semibold text-orange-600">Yetkili:</span>{' '}
                  {form.contactPerson || '—'}
                </p>
                <p>
                  <span className="font-semibold text-orange-600">Telefon:</span>{' '}
                  {form.phone || '—'}
                </p>
                <p>
                  <span className="font-semibold text-orange-600">E-posta:</span>{' '}
                  {form.email || '—'}
                </p>
                <p>
                  <span className="font-semibold text-orange-600">Saat:</span>{' '}
                  {form.openingHour || '—'} – {form.closingHour || '—'}
                </p>
              </div>
            </div>
          </aside>
        </section>
      )}
    </div>
  );
}

/* ---- küçük yardımcılar ---- */
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="mb-2 text-sm font-semibold text-neutral-800">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[1fr_auto] items-center gap-3">{children}</div>;
}
function EditButton({ onClick, active }: { onClick: () => void; active: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition
        ${active ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-500 hover:bg-emerald-600'}`}
    >
      DÜZENLE
    </button>
  );
}
