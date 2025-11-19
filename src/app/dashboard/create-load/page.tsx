'use client';

import * as React from 'react';
import { getAuthToken } from '@/src/utils/auth';
import dynamic from 'next/dynamic';

const MapPicker = dynamic(() => import('@/src/components/map/MapPicker'), { ssr: false });

/* ======= types & helpers ======= */
type DeliveryTypeUI = 'today' | 'appointment';
type DeliveryTypeAPI = 'immediate' | 'scheduled';

// --- Extra services DTO (GET /api/admin/extra-services) ---
type ExtraServiceDTO = {
  id: string;
  service_name: string;
  price: number;
  carrier_type: string;
  created_at?: string;
};

type ExtraServiceUI = {
  id: string;
  label: string;
  price: number;
  carrierType: string;
};

async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text();
  try {
    return t ? JSON.parse(t) : (null as any);
  } catch {
    return t as any;
  }
}
const pickMsg = (d: any, fb: string) =>
  d?.error?.message || d?.message || d?.detail || d?.title || fb;

// API hata toplayıcı
function collectErrors(x: any): string {
  const msgs: string[] = [];
  if (x?.message) msgs.push(String(x.message));
  if (x?.data?.message) msgs.push(String(x.data.message));
  const err = x?.errors || x?.error || x?.detail;

  if (Array.isArray(err)) {
    for (const it of err) {
      if (typeof it === 'string') msgs.push(it);
      else if (it && typeof it === 'object') {
        const loc = Array.isArray((it as any).loc) ? (it as any).loc.join('.') : (it as any).loc ?? '';
        const m = (it as any).msg || (it as any).message || (it as any).detail;
        if (loc && m) msgs.push(`${loc}: ${m}`);
        else if (m) msgs.push(String(m));
      }
    }
  } else if (err && typeof err === 'object') {
    for (const [k, v] of Object.entries(err)) {
      if (Array.isArray(v)) (v as any[]).forEach((m) => msgs.push(`${k}: ${m}`));
      else if (v) msgs.push(`${k}: ${v}`);
    }
  }
  return msgs.join('\n');
}

// HTML date (YYYY-MM-DD) -> "DD.MM.YYYY"
function toTRDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}
// HTML time (HH:mm) -> "HH:mm"
function toTRTime(t: string) {
  return t || '';
}

/* ======= page ======= */
export default function CreateLoadPage() {
  // UI state
  const [deliveryType, setDeliveryType] = React.useState<DeliveryTypeUI>('today');
  const [schedDate, setSchedDate] = React.useState<string>(''); // randevulu ise
  const [schedTime, setSchedTime] = React.useState<string>('');

  const [carrierType, setCarrierType] = React.useState('courier'); // swagger 'courier'
  const [carrierVehicle, setCarrierVehicle] = React.useState('motorcycle'); // 'motorcycle'

  const [loadType, setLoadType] = React.useState(''); // UI etiketi, API’ye gönderilmeyecek

  const [pickup, setPickup] = React.useState('');
  const [pickupLat, setPickupLat] = React.useState<string>('');
  const [pickupLng, setPickupLng] = React.useState<string>('');

  const [dropoff, setDropoff] = React.useState('');
  const [dropLat, setDropLat] = React.useState<string>('');
  const [dropLng, setDropLng] = React.useState<string>('');

  const [note, setNote] = React.useState('');

  const [coupon, setCoupon] = React.useState('');
  const [couponApplied, setCouponApplied] = React.useState<string | null>(null);

  // --- Ek hizmetler (backend’ten) ---
  const [extraServices, setExtraServices] = React.useState<ExtraServiceUI[]>([]);
  const [extrasSelected, setExtrasSelected] = React.useState<Record<string, boolean>>({});
  const [extrasLoading, setExtrasLoading] = React.useState(false);

  const [basePrice, setBasePrice] = React.useState<number | ''>(''); // manuel taban ücret

  // !!! allowed: 'cash' | 'card' | 'transfer'
  const [payMethod, setPayMethod] = React.useState<'cash' | 'card' | 'transfer' | ''>('');

  const [files, setFiles] = React.useState<File[]>([]);

  const [busy, setBusy] = React.useState(false);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [errMsg, setErrMsg] = React.useState<string | null>(null);

  const token = React.useMemo(getAuthToken, []);

  // Ek hizmetleri /api/admin/extra-services endpointinden çek
  React.useEffect(() => {
    let cancelled = false;

    async function loadExtraServices() {
      setExtrasLoading(true);
      try {
        const res = await fetch('/yuksi/admin/extra-services', {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const j: any = await readJson(res);
        if (!res.ok || j?.success === false) {
          throw new Error(pickMsg(j, `HTTP ${res.status}`));
        }

        const list: ExtraServiceDTO[] = Array.isArray(j?.data)
          ? j.data
          : Array.isArray(j)
            ? j
            : [];

        if (cancelled) return;

        const mapped: ExtraServiceUI[] = list.map((x) => ({
          id: String(x.id),
          label: x.service_name,
          price: Number(x.price) || 0,
          carrierType: x.carrier_type,
        }));

        setExtraServices(mapped);
        // mevcut seçili state içine yeni id’leri ekle
        setExtrasSelected((prev) => {
          const next = { ...prev };
          for (const s of mapped) {
            if (next[s.id] === undefined) next[s.id] = false;
          }
          return next;
        });
      } catch (e: any) {
        if (!cancelled) {
          setErrMsg((prev) => prev || e?.message || 'Ek hizmetler yüklenemedi.');
        }
      } finally {
        if (!cancelled) setExtrasLoading(false);
      }
    }

    loadExtraServices();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Şimdilik tüm ek hizmetleri göster (carrierType’a göre filtre yok)
  const visibleExtras = React.useMemo(
    () => extraServices,
    [extraServices],
  );

  const extrasTotal = React.useMemo(
    () =>
      extraServices
        .filter((s) => extrasSelected[s.id])
        .reduce((sum, s) => sum + s.price, 0),
    [extraServices, extrasSelected],
  );

  const computedTotal = Number(basePrice || 0) + extrasTotal;

  function toggleExtra(id: string) {
    setExtrasSelected((p) => ({ ...p, [id]: !p[id] }));
  }
  function applyCoupon() {
    if (coupon.trim()) setCouponApplied(coupon.trim());
  }
  function onUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files ? Array.from(e.target.files) : [];
    if (list.length) setFiles((p) => [...p, ...list]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setOkMsg(null);
    setErrMsg(null);

    if (!pickup || !dropoff) {
      setErrMsg('Adresleri girin.');
      return;
    }
    if (!payMethod) {
      setErrMsg('Ödeme yöntemi seçin.');
      return;
    }

    const deliveryTypeApi: DeliveryTypeAPI =
      deliveryType === 'today' ? 'immediate' : 'scheduled';

    // scheduled ise tarih/saat zorunlu
    if (deliveryTypeApi === 'scheduled' && (!schedDate || !schedTime)) {
      setErrMsg('Randevulu teslimatlar için tarih ve saat seçin.');
      return;
    }

    const selectedExtras = extraServices.filter((s) => extrasSelected[s.id]);

    const extraServicesPayload = selectedExtras.map((s, index) => ({
      // Backend int istediği için burada sıralı bir integer gönderiyoruz
      serviceId: index + 1,
      name: s.label,
      price: s.price,
    }));

    const pLat = Number(pickupLat),
      pLng = Number(pickupLng);
    const dLat = Number(dropLat),
      dLng = Number(dropLng);

    const deliveryDate =
      deliveryTypeApi === 'scheduled' ? (toTRDate(schedDate) || null) : null;
    const deliveryTime =
      deliveryTypeApi === 'scheduled' ? (toTRTime(schedTime) || null) : null;

    // ---> loadType API'ye GÖNDERİLMİYOR <---
    const body = {
      deliveryType: deliveryTypeApi,
      carrierType,
      vehicleType: carrierVehicle,
      pickupAddress: pickup,
      pickupCoordinates:
        Number.isFinite(pLat) && Number.isFinite(pLng)
          ? ([pLat, pLng] as [number, number])
          : undefined,
      dropoffAddress: dropoff,
      dropoffCoordinates:
        Number.isFinite(dLat) && Number.isFinite(dLng)
          ? ([dLat, dLng] as [number, number])
          : undefined,
      specialNotes: note || undefined,
      campaignCode: couponApplied || (coupon.trim() || undefined),
      extraServices: extraServicesPayload,
      extraServicesTotal: extrasTotal,
      totalPrice: computedTotal,
      paymentMethod: payMethod, // 'cash' | 'card' | 'transfer'
      imageFileIds: [],

      // randevu alanları (immediate ise null)
      deliveryDate,
      deliveryTime,
    };

    setBusy(true);
    try {
      const res = await fetch('/yuksi/Restaurant/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const j = await readJson(res);
      if (!res.ok || (j && j.success === false)) {
        throw new Error(collectErrors(j) || pickMsg(j, `HTTP ${res.status}`));
      }

      setOkMsg(collectErrors(j) || 'Gönderi oluşturuldu.');
      // reset
      setPickup('');
      setPickupLat('');
      setPickupLng('');
      setDropoff('');
      setDropLat('');
      setDropLng('');
      setNote('');
      setCoupon('');
      setCouponApplied(null);
      setExtrasSelected((prev) => {
        const next: Record<string, boolean> = {};
        for (const s of extraServices) next[s.id] = false;
        return next;
      });
      setBasePrice('');
      setPayMethod('');
      setFiles([]);
      setSchedDate('');
      setSchedTime('');
      setDeliveryType('today');
    } catch (e: any) {
      setErrMsg(e?.message || 'Gönderi oluşturulamadı.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Yeni Gönderi</h1>
      </div>

      {okMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 whitespace-pre-line">
          {okMsg}
        </div>
      )}
      {errMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 whitespace-pre-line">
          {errMsg}
        </div>
      )}

      {/* Gönderim Tipi */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm soft-card">
        <h2 className="mb-4 text-lg font-semibold">Gönderim Tipi</h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setDeliveryType('today')}
            className={[
              'rounded-xl px-5 py-2 text-sm font-semibold shadow-sm border',
              deliveryType === 'today'
                ? 'bg-indigo-500 text-white border-indigo-500'
                : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50',
            ].join(' ')}
          >
            Bugün (immediate)
          </button>
          <button
            type="button"
            onClick={() => setDeliveryType('appointment')}
            className={[
              'rounded-xl px-5 py-2 text-sm font-semibold shadow-sm border',
              deliveryType === 'appointment'
                ? 'bg-indigo-500 text-white border-indigo-500'
                : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50',
            ].join(' ')}
          >
            Randevulu (scheduled)
          </button>
        </div>

        {deliveryType === 'appointment' && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold">Teslim Tarihi</label>
              <input
                type="date"
                value={schedDate}
                onChange={(e) => setSchedDate(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">Teslim Saati</label>
              <input
                type="time"
                value={schedTime}
                onChange={(e) => setSchedTime(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
              />
            </div>
          </div>
        )}
      </section>

      {/* Üst alanlar */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm soft-card">
        <div className="grid gap-5 md:grid-cols-2">
          {/* Taşıyıcı Tipi */}
          <div>
            <label className="mb-2 block text-sm font-semibold">Taşıyıcı Tipi</label>
            <select
              value={carrierType}
              onChange={(e) => setCarrierType(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
            >
              <option value="courier">Kurye</option>
              <option value="minivan">Minivan</option>
              <option value="panelvan">Panelvan</option>
              <option value="truck">Kamyonet</option>
            </select>
          </div>

          {/* Taşıyıcı Aracı */}
          <div>
            <label className="mb-2 block text-sm font-semibold">Taşıyıcı Aracı</label>
            <select
              value={carrierVehicle}
              onChange={(e) => setCarrierVehicle(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
            >
              <option value="motorcycle">2 Teker (Motosiklet)</option>
              <option value="threewheeler">3 Teker</option>
              <option value="hatchback">Hatchback</option>
              <option value="boxvan">Kapalı Kasa</option>
            </select>
          </div>
        </div>

        {/* === GÖNDERİCİ (PICKUP) === */}
        <MapPicker
          label="Gönderici Konumu"
          value={
            pickupLat && pickupLng
              ? {
                lat: Number(pickupLat),
                lng: Number(pickupLng),
                address: pickup || undefined,
              }
              : null
          }
          onChange={(p) => {
            setPickupLat(String(p.lat));
            setPickupLng(String(p.lng));
            if (p.address) setPickup(p.address);
          }}
        />

        {/* === TESLİMAT (DROPOFF) === */}
        <MapPicker
          label="Teslimat Konumu"
          value={
            dropLat && dropLng
              ? {
                lat: Number(dropLat),
                lng: Number(dropLng),
                address: dropoff || undefined,
              }
              : null
          }
          onChange={(p) => {
            setDropLat(String(p.lat));
            setDropLng(String(p.lng));
            if (p.address) setDropoff(p.address);
          }}
        />

        {/* Notlar */}
        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold">Özel Notlar</label>
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Örn: Paket sıcak kalmalı…"
            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
          />
        </div>
      </section>

      {/* Alt alanlar */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm soft-card">
        {/* Kupon */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold">Kampanya Kodu</label>
          <div className="flex overflow-hidden rounded-xl border border-neutral-300">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder="Kodu yazın"
              className="w-full bg-neutral-100 px-3 py-2 outline-none"
            />
            <button
              type="button"
              onClick={applyCoupon}
              className="bg-rose-50 px-4 text-rose-600 hover:bg-rose-100"
            >
              Uygula
            </button>
          </div>
          {couponApplied && (
            <div className="mt-2 text-sm text-emerald-600">
              “{couponApplied}” kuponu uygulandı.
            </div>
          )}
        </div>

        {/* Ek Hizmetler */}
        <div className="mb-2 text-sm font-semibold">Ek Hizmetler</div>

        {extrasLoading && (
          <div className="mb-2 text-sm text-neutral-500">
            Ek hizmetler yükleniyor…
          </div>
        )}

        {!extrasLoading && visibleExtras.length === 0 && (
          <div className="mb-4 text-sm text-neutral-500">
            Tanımlı ek hizmet bulunmuyor.
          </div>
        )}

        {visibleExtras.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleExtras.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 hover:bg-neutral-50"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!extrasSelected[s.id]}
                    onChange={() => toggleExtra(s.id)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">
                    {s.label} ({s.carrierType})
                  </span>
                </div>
                <span className="text-sm font-semibold">
                  {s.price.toFixed(0)}₺
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-semibold">Taban Ücret (₺)</label>
            <input
              type="number"
              min={0}
              value={basePrice}
              onChange={(e) =>
                setBasePrice(
                  e.target.value === '' ? '' : Math.max(0, Number(e.target.value)),
                )
              }
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <div className="self-end text-sm">
            <div>
              <span className="font-semibold">Ek Hizmet Toplamı: </span>
              {extrasTotal}₺
            </div>
            <div>
              <span className="font-semibold">Genel Toplam: </span>
              {computedTotal}₺
            </div>
          </div>
        </div>

        {/* Ödeme yöntemi (cash/card/transfer) */}
        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold">Ödeme Yöntemi</label>
          <select
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value as any)}
            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
          >
            <option value="">Seçiniz</option>
            <option value="cash">Nakit (cash)</option>
            <option value="card">Kart (card)</option>
            <option value="transfer">Havale/EFT (transfer)</option>
          </select>
        </div>

        {/* Resim ekle (ID servisi yok -> boş dizi) */}
        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold">Resim Ekle</label>
          <input type="file" accept="image/*" multiple onChange={onUploadChange} />
          {files.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs shadow-sm"
                >
                  {f.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-2xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 disabled:opacity-60"
        >
          {busy ? 'Gönderiliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  );
}
