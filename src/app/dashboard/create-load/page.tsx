// src/app/dashboards/[role]/restaurants/create-load/page.tsx
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

// --- City prices DTO (GET /api/admin/city-prices) ---
type CityPriceDTO = {
  id: string;
  route_name: string;
  country_id: number;
  state_id: number;
  city_id: number;
  courier_price: number;
  minivan_price: number;
  panelvan_price: number;
  kamyonet_price: number;
  kamyon_price: number;
};

type CityPriceUI = {
  id: string;
  label: string;
  countryId: number;
  stateId: number;
  cityId: number;
  stateName: string;
  cityName: string;
  courier: number;
  minivan: number;
  panelvan: number;
  kamyonet: number;
  kamyon: number;
};

// --- Vehicle products DTO (GET /yuksi/admin/vehicles) ---
type VehicleProductDTO = {
  id: string;
  productName: string;
  productCode: string;
  productTemplate: string; // motorcycle|minivan|panelvan|kamyonet|kamyon
  vehicleFeatures?: string[];
  isActive?: boolean;
};

type VehicleProductUI = {
  id: string;
  name: string;
  code: string;
  template: string; // motorcycle|minivan|panelvan|kamyonet|kamyon
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

const toNum = (v: unknown) => {
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// city-prices satırından, seçilen taşıyıcı tipine göre km fiyatı çek
function pickCityBasePrice(p: CityPriceUI | undefined, carrierType: string): number {
  if (!p) return 0;
  switch (carrierType) {
    case 'courier':
      return p.courier;
    case 'minivan':
      return p.minivan;
    case 'panelvan':
      return p.panelvan;
    case 'truck':
      // truck için kamyonet fiyatını baz aldım, istersen kamyon yaparsın
      return p.kamyonet || p.kamyon;
    default:
      return 0;
  }
}

// vehicleTemplate varsa onu kullan; yoksa eski carrierType mantığına dön
function pickCityBasePriceByTemplate(
  p: CityPriceUI | undefined,
  vehicleTemplate: string | undefined,
  carrierType: string,
): number {
  if (!p) return 0;

  if (vehicleTemplate) {
    switch (vehicleTemplate) {
      case 'motorcycle':
        return p.courier;
      case 'minivan':
        return p.minivan;
      case 'panelvan':
        return p.panelvan;
      case 'kamyonet':
        return p.kamyonet;
      case 'kamyon':
        return p.kamyon;
    }
  }

  return pickCityBasePrice(p, carrierType);
}

const VEHICLE_TEMPLATE_LABEL: Record<string, string> = {
  motorcycle: 'Motorsiklet',
  minivan: 'Minivan',
  panelvan: 'Panelvan',
  kamyonet: 'Kamyonet',
  kamyon: 'Kamyon',
};

// Haversine mesafe hesabı (km) — lat/lng OSM’den geliyor
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ======= page ======= */
export default function CreateLoadPage() {
  // UI state
  const [deliveryType, setDeliveryType] = React.useState<DeliveryTypeUI>('today');
  const [schedDate, setSchedDate] = React.useState<string>(''); // randevulu ise
  const [schedTime, setSchedTime] = React.useState<string>('');

  const [carrierType, setCarrierType] = React.useState('courier'); // swagger 'courier'
  const [carrierVehicle, setCarrierVehicle] = React.useState('motorcycle'); // sadece UI’de

  // Araç ürünleri
  const [vehicleProducts, setVehicleProducts] = React.useState<VehicleProductUI[]>([]);
  const [vehicleProductsLoading, setVehicleProductsLoading] = React.useState(false);
  const [vehicleProductsError, setVehicleProductsError] = React.useState<string | null>(null);
  const [vehicleProductId, setVehicleProductId] = React.useState<string>('');

  const [pickup, setPickup] = React.useState('');
  const [pickupLat, setPickupLat] = React.useState<string>('');
  const [pickupLng, setPickupLng] = React.useState<string>('');
  const [pickupCityName, setPickupCityName] = React.useState<string>('');
  const [pickupStateName, setPickupStateName] = React.useState<string>('');

  const [dropoff, setDropoff] = React.useState('');
  const [dropLat, setDropLat] = React.useState<string>('');
  const [dropLng, setDropLng] = React.useState<string>('');
  const [dropCityName, setDropCityName] = React.useState<string>('');
  const [dropStateName, setDropStateName] = React.useState<string>('');

  const [note, setNote] = React.useState('');

  const [coupon, setCoupon] = React.useState('');
  const [couponApplied, setCouponApplied] = React.useState<string | null>(null);

  // --- Ek hizmetler (backend’ten) ---
  const [extraServices, setExtraServices] = React.useState<ExtraServiceUI[]>([]);
  const [extrasSelected, setExtrasSelected] = React.useState<Record<string, boolean>>({});
  const [extrasLoading, setExtrasLoading] = React.useState(false);

  // --- City prices (backend’ten) ---
  const [cityPrices, setCityPrices] = React.useState<CityPriceUI[]>([]);
  const [cityPricesLoading, setCityPricesLoading] = React.useState(false);
  const [cityPricesError, setCityPricesError] = React.useState<string | null>(null);

  // !!! allowed: 'cash' | 'card' | 'transfer'
  const [payMethod, setPayMethod] = React.useState<'cash' | 'card' | 'transfer' | ''>('');

  const [files, setFiles] = React.useState<File[]>([]);

  const [busy, setBusy] = React.useState(false);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [errMsg, setErrMsg] = React.useState<string | null>(null);

  const token = React.useMemo(getAuthToken, []);

  /* --------- Ek Hizmetler --------- */
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

  /* --------- Vehicle Products (Araç ürün listesi) --------- */
  React.useEffect(() => {
    let cancelled = false;

    async function loadVehicleProducts() {
      setVehicleProductsLoading(true);
      setVehicleProductsError(null);
      try {
        const res = await fetch('/yuksi/admin/vehicles', {
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

        const list: VehicleProductDTO[] = Array.isArray(j?.data)
          ? j.data
          : Array.isArray(j)
          ? j
          : [];

        if (cancelled) return;

        const mapped: VehicleProductUI[] = list
          .filter((v) => v.isActive !== false)
          .map((v) => ({
            id: String(v.id),
            name: v.productName,
            code: v.productCode,
            template: v.productTemplate,
          }));

        setVehicleProducts(mapped);

        // İlk gelişte bir tane seçili olsun
        if (!vehicleProductId && mapped.length) {
          setVehicleProductId(mapped[0].id);
        }
      } catch (e: any) {
        if (!cancelled) {
          setVehicleProductsError(e?.message || 'Araç ürünleri alınamadı.');
        }
      } finally {
        if (!cancelled) setVehicleProductsLoading(false);
      }
    }

    loadVehicleProducts();
    return () => {
      cancelled = true;
    };
  }, [token, vehicleProductId]);

  /* --------- City Prices (şehir bazlı km fiyatı) --------- */
  React.useEffect(() => {
    let cancelled = false;

    async function loadCityPrices() {
      setCityPricesLoading(true);
      setCityPricesError(null);
      try {
        // 1) city-prices listesi
        const res = await fetch('/yuksi/admin/city-prices', {
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

        const list: CityPriceDTO[] = Array.isArray(j?.data)
          ? j.data
          : Array.isArray(j)
          ? j
          : [];

        if (cancelled) return;

        // 2) hangi country/state id'leri var, topla
        const countryIds = new Set<number>();
        const stateIds = new Set<number>();

        for (const x of list) {
          if (Number.isFinite(Number(x.country_id))) countryIds.add(Number(x.country_id));
          if (Number.isFinite(Number(x.state_id))) stateIds.add(Number(x.state_id));
        }

        // 3) stateMap: id -> name
        const stateMap = new Map<number, string>();
        await Promise.all(
          Array.from(countryIds).map(async (cid) => {
            const url = new URL('/yuksi/geo/states', location.origin);
            url.searchParams.set('country_id', String(cid));
            url.searchParams.set('limit', '500');
            url.searchParams.set('offset', '0');
            const r = await fetch(url.toString(), { cache: 'no-store' });
            const d = await readJson(r);
            if (r.ok) {
              const arr: any[] = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
              for (const s of arr) {
                const sid = Number(s?.id);
                const name = String(s?.name ?? '');
                if (Number.isFinite(sid) && name) stateMap.set(sid, name);
              }
            }
          }),
        );

        // 4) cityMap: id -> name
        const cityMap = new Map<number, string>();
        await Promise.all(
          Array.from(stateIds).map(async (sid) => {
            const url = new URL('/yuksi/geo/cities', location.origin);
            url.searchParams.set('state_id', String(sid));
            url.searchParams.set('limit', '1000');
            url.searchParams.set('offset', '0');
            const r = await fetch(url.toString(), { cache: 'no-store' });
            const d = await readJson(r);
            if (r.ok) {
              const arr: any[] = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
              for (const c of arr) {
                const cid = Number(c?.id);
                const name = String(c?.name ?? '');
                if (Number.isFinite(cid) && name) cityMap.set(cid, name);
              }
            }
          }),
        );

        if (cancelled) return;

        // 5) UI modeli
        const mapped: CityPriceUI[] = list.map((x) => ({
          id: String(x.id),
          label: String(x.route_name ?? ''),
          countryId: Number(x.country_id),
          stateId: Number(x.state_id),
          cityId: Number(x.city_id),
          stateName: stateMap.get(Number(x.state_id)) ?? '',
          cityName: cityMap.get(Number(x.city_id)) ?? '',
          courier: Number(x.courier_price ?? 0),
          minivan: Number(x.minivan_price ?? 0),
          panelvan: Number(x.panelvan_price ?? 0),
          kamyonet: Number(x.kamyonet_price ?? 0),
          kamyon: Number(x.kamyon_price ?? 0),
        }));

        setCityPrices(mapped);
      } catch (e: any) {
        if (!cancelled) setCityPricesError(e?.message || 'Şehir fiyatları alınamadı.');
      } finally {
        if (!cancelled) setCityPricesLoading(false);
      }
    }

    loadCityPrices();
    return () => {
      cancelled = true;
    };
  }, [token]);

  /* --------- pickup/dropoff → mesafe km --------- */
  const distanceKm = React.useMemo(() => {
    if (!pickupLat || !pickupLng || !dropLat || !dropLng) return 0;
    const lat1 = toNum(pickupLat);
    const lon1 = toNum(pickupLng);
    const lat2 = toNum(dropLat);
    const lon2 = toNum(dropLng);
    if (
      !Number.isFinite(lat1) ||
      !Number.isFinite(lon1) ||
      !Number.isFinite(lat2) ||
      !Number.isFinite(lon2)
    ) {
      return 0;
    }
    return haversineKm(lat1, lon1, lat2, lon2);
  }, [pickupLat, pickupLng, dropLat, dropLng]);

  const selectedVehicle = React.useMemo(
    () => vehicleProducts.find((v) => v.id === vehicleProductId) || null,
    [vehicleProducts, vehicleProductId],
  );
  const vehicleTemplate = selectedVehicle?.template;

  /* --------- city + carrierType + araç ürünü → km başı fiyat & base price --------- */
  const baseKmPrice = React.useMemo(() => {
    if (!cityPrices.length) return 0;

    const city = (dropCityName || pickupCityName || '').toLowerCase().trim();
    const state = (dropStateName || pickupStateName || '').toLowerCase().trim();

    if (!city || !state) return 0;

    let match: CityPriceUI | undefined = cityPrices.find(
      (p) =>
        p.cityName.toLowerCase() === city &&
        p.stateName.toLowerCase() === state,
    );

    if (!match) {
      match = cityPrices.find((p) => p.cityName.toLowerCase() === city);
    }

    return pickCityBasePriceByTemplate(match, vehicleTemplate, carrierType);
  }, [
    cityPrices,
    carrierType,
    pickupCityName,
    pickupStateName,
    dropCityName,
    dropStateName,
    vehicleTemplate,
  ]);

  const basePrice = React.useMemo(() => {
    if (!distanceKm || !baseKmPrice) return 0;
    return Math.round(distanceKm * baseKmPrice);
  }, [distanceKm, baseKmPrice]);

  const extrasTotal = React.useMemo(
    () =>
      extraServices
        .filter((s) => extrasSelected[s.id])
        .reduce((sum, s) => sum + s.price, 0),
    [extraServices, extrasSelected],
  );

  const computedTotal = basePrice + extrasTotal;

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

    // basePrice hiçbir şekilde elle girilmedi; eşleşme yoksa göndermeyelim
    if (!basePrice || basePrice <= 0) {
      setErrMsg(
        'Seçilen şehir/ilçe, taşıyıcı tipi, araç ürünü veya mesafe için fiyat hesaplanamadı. Lütfen önce admin panelinden city-prices tanımlayın ve adres/konumları kontrol edin.',
      );
      return;
    }

    const selectedExtras = extraServices.filter((s) => extrasSelected[s.id]);

    const extraServicesPayload = selectedExtras.map((s, index) => ({
      // Backend int istediği için burada sıralı bir integer gönderiyoruz
      serviceId: index + 1,
      name: s.label,
      price: s.price,
    }));

    const pLatNum = Number(pickupLat),
      pLngNum = Number(pickupLng);
    const dLatNum = Number(dropLat),
      dLngNum = Number(dropLng);

    const deliveryDate =
      deliveryTypeApi === 'scheduled' ? (toTRDate(schedDate) || null) : null;
    const deliveryTime =
      deliveryTypeApi === 'scheduled' ? (toTRTime(schedTime) || null) : null;

    const body = {
      deliveryType: deliveryTypeApi,
      carrierType,
      vehicleProductId: vehicleProductId || undefined,

      pickupAddress: pickup,
      pickupCoordinates:
        Number.isFinite(pLatNum) && Number.isFinite(pLngNum)
          ? ([pLatNum, pLngNum] as [number, number])
          : undefined,
      dropoffAddress: dropoff,
      dropoffCoordinates:
        Number.isFinite(dLatNum) && Number.isFinite(dLngNum)
          ? ([dLatNum, dLngNum] as [number, number])
          : undefined,
      specialNotes: note || undefined,
      campaignCode: couponApplied || (coupon.trim() || undefined),
      extraServices: extraServicesPayload,
      extraServicesTotal: extrasTotal,
      totalPrice: computedTotal,
      paymentMethod: payMethod,
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
      setPickupCityName('');
      setPickupStateName('');
      setDropoff('');
      setDropLat('');
      setDropLng('');
      setDropCityName('');
      setDropStateName('');
      setNote('');
      setCoupon('');
      setCouponApplied(null);
      setExtrasSelected((prev) => {
        const next: Record<string, boolean> = {};
        for (const s of extraServices) next[s.id] = false;
        return next;
      });
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
        <div className="grid gap-5 md:grid-cols-3">
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
          {/* Araç Ürünü (vehicleProductId) */}
          <div>
            <label className="mb-2 block text-sm font-semibold">Araç Ürünü</label>
            <select
              value={vehicleProductId}
              onChange={(e) => setVehicleProductId(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
            >
              <option value="">Seçiniz</option>
              {vehicleProducts.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.code})
                </option>
              ))}
            </select>
            {vehicleProductsLoading && (
              <p className="mt-1 text-xs text-neutral-500">Araç ürünleri yükleniyor…</p>
            )}
            {vehicleProductsError && (
              <p className="mt-1 text-xs text-rose-600">{vehicleProductsError}</p>
            )}
            {selectedVehicle && (
              <p className="mt-1 text-xs text-neutral-500">
                Seçilen şablon:{' '}
                {VEHICLE_TEMPLATE_LABEL[selectedVehicle.template] ?? selectedVehicle.template}
              </p>
            )}
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
          onChange={(p: any) => {
            setPickupLat(String(p.lat));
            setPickupLng(String(p.lng));
            if (p.address) setPickup(p.address);
            if (p.cityName) setPickupCityName(String(p.cityName));
            if (p.stateName) setPickupStateName(String(p.stateName));
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
          onChange={(p: any) => {
            setDropLat(String(p.lat));
            setDropLng(String(p.lng));
            if (p.address) setDropoff(p.address);
            if (p.cityName) setDropCityName(String(p.cityName));
            if (p.stateName) setDropStateName(String(p.stateName));
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
          <div className="mb-2 text-sm text-neutral-500">Ek hizmetler yükleniyor…</div>
        )}

        {!extrasLoading && extraServices.length === 0 && (
          <div className="mb-4 text-sm text-neutral-500">
            Tanımlı ek hizmet bulunmuyor.
          </div>
        )}

        {extraServices.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {extraServices.map((s) => (
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
            <label className="mb-1 block text-sm font-semibold">
              Taban Ücret (mesafe × km fiyatı)
            </label>
            <div className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-900">
              {cityPricesLoading
                ? 'Şehir fiyatları yükleniyor…'
                : basePrice > 0
                ? `${basePrice}₺` +
                  (distanceKm && baseKmPrice
                    ? ` (≈ ${distanceKm.toFixed(1)} km × ${baseKmPrice.toFixed(0)}₺/km)`
                    : '')
                : cityPricesError
                ? `Hata: ${cityPricesError}`
                : 'Şehir/ilçe, taşıyıcı tipi, araç ürünü veya mesafe için fiyat bulunamadı.'}
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              Km başı fiyat admin panelindeki <code>city-prices</code> tablosundan,
              mesafe ise haritadaki pickup/dropoff konumları üzerinden otomatik hesaplanır.
            </div>
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
