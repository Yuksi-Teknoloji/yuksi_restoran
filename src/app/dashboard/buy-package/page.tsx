// src/app/dashboards/[role]/restaurants/buy-package/page.tsx
'use client';

import * as React from 'react';
import { getAuthToken } from '@/src/utils/auth';

/* ===== API tipleri ===== */
type ApiMyPrice = {
  id: number;
  restaurant_id: string;
  unit_price: number;
  min_package?: number | null;
  max_package?: number | null;
  note?: string | null;
  updated_at?: string | null;
};
type ApiMyPriceResponse =
  | { success: true; message?: string; data: ApiMyPrice }
  | { success: false; message?: string };

type NegotiatedPrice = {
  unitPriceTRY: number;
  minPackages?: number | null;
  maxPackages?: number | null;
  note?: string | null;
  updatedAt?: string | null;
};

enum PaymentMethod {
  CreditCard = 'credit_card',
  Transfer = 'bank_transfer',
  Cash = 'cash',
}

/* ===== util ===== */
const fmtTRY = (n: number) =>
  n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
const fmtISO = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR') : '-');

async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text();
  try { return t ? JSON.parse(t) : (null as any); } catch { return (t as any); }
}
const pickMsg = (d: any, fb: string) =>
  d?.error?.message || d?.message || d?.detail || d?.title || fb;

function buildPaytrUrl(token: string) {
  const path = token.startsWith('/') ? token.slice(1) : token; // "paytr/....html"
  return `https://www.yuksi.dev/${path}`;
}

/* ===== Page ===== */
export default function BuyPackagePage() {
  // token’ı yalnızca client’ta oku
  const [token, setToken] = React.useState<string | null>(null);
  React.useEffect(() => { setToken(getAuthToken()); }, []);
  const authHeaders = React.useMemo<HeadersInit>(() => {
    const h: HeadersInit = { Accept: 'application/json' };
    if (token) (h as any).Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  // fiyat
  const [pricing, setPricing] = React.useState<NegotiatedPrice | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // form
  const [count, setCount] = React.useState<number>(1);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>(PaymentMethod.CreditCard);

  // kart + fatura bilgileri (PayTR/Init body için)
  const [email, setEmail] = React.useState('');
  const [nameOnCard, setNameOnCard] = React.useState('');
  const [cardNo, setCardNo] = React.useState('');
  const [expMonth, setExpMonth] = React.useState('');
  const [expYear, setExpYear] = React.useState('');
  const [cvv, setCvv] = React.useState('');
  const [userName, setUserName] = React.useState('');
  const [userAddress, setUserAddress] = React.useState('');
  const [userPhone, setUserPhone] = React.useState('');

  const [submitting, setSubmitting] = React.useState(false);
  const [info, setInfo] = React.useState<string | null>(null);

  function toast(s: string) {
    setInfo(s);
    setTimeout(() => setInfo(null), 4000);
  }

  /* ---- fiyatı çek ---- */
  const loadMyPrice = React.useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch('/yuksi/PackagePrice/my-price', { headers: authHeaders, cache: 'no-store' });
      const j = await readJson<ApiMyPriceResponse>(res);
      if (!res.ok || (j && (j as any).success === false)) throw new Error(pickMsg(j, `HTTP ${res.status}`));

      const d = (j as any).data as ApiMyPrice;
      setPricing({
        unitPriceTRY: d.unit_price,
        minPackages: d.min_package ?? null,
        maxPackages: d.max_package ?? null,
        note: d.note ?? null,
        updatedAt: d.updated_at ?? null,
      });

      // başlangıç adetini gelen sınırlara oturt
      const start = (d.max_package ?? null) ?? (d.min_package ?? null) ?? 1;
      setCount((prev) => {
        if (prev === 1) return Math.max(d.min_package ?? 1, Math.min(start, d.max_package ?? start));
        return Math.max(d.min_package ?? 1, Math.min(prev, d.max_package ?? prev));
      });
    } catch (e: any) {
      setPricing(null);
      setError(e?.message || 'Fiyat bilgisi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, token]);

  React.useEffect(() => { loadMyPrice(); }, [loadMyPrice]);

  const unit = pricing?.unitPriceTRY ?? 0;
  const total = unit * count;

  /* ---- PayTR Init (✅ /yuksi/Paytr/Init) ---- */
  async function startPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!pricing) return;

    // min/max doğrulama
    if (pricing.minPackages && count < pricing.minPackages) {
      toast(`En az ${pricing.minPackages} paket satın alabilirsiniz.`);
      return;
    }
    if (pricing.maxPackages && count > pricing.maxPackages) {
      toast(`En fazla ${pricing.maxPackages} paket satın alabilirsiniz.`);
      return;
    }

    if (paymentMethod !== PaymentMethod.CreditCard) {
      toast('Şimdilik PayTR entegrasyonu için kredi kartı seçeneğini kullanıyoruz.');
      return;
    }

    // basit alan doğrulamaları
    if (!email || !nameOnCard || !cardNo || !expMonth || !expYear || !cvv) {
      toast('Lütfen kart ve iletişim bilgilerini doldurun.');
      return;
    }

    setSubmitting(true);
    try {
      // sepet formatı: [["Ürün", "1.00", 1]]
      const basket_json = JSON.stringify([[`Paket Kredisi (${count})`, String(unit), count]]);

      const body = {
        merchant_oid: `PKT${Date.now()}`,
        email,
        payment_amount: total,  // backend örneğine göre TL (gerekirse kuruşa çevir: total*100)
        currency: 'TL',
        user_ip: '127.0.0.1',
        installment_count: 0,
        no_installment: 1,
        basket_json,
        lang: 'tr',
        test_mode: 1,
        non_3d: 0,

        cc_owner: nameOnCard,
        card_number: cardNo.replace(/\s+/g, ''),
        expiry_month: expMonth,
        expiry_year: expYear,
        cvv,

        user_name: userName || nameOnCard,
        user_address: userAddress || 'Türkiye',
        user_phone: userPhone || '',
      };

      // Proxy edilmiş backend endpointi
      const res = await fetch('/yuksi/Paytr/Init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body),
      });
      const j = await readJson<any>(res);
      if (!res.ok) throw new Error(pickMsg(j, `HTTP ${res.status}`));

      // Beklenen yanıt: { status: "success", token: "paytr/..html", reason: null }
      if (j?.status !== 'success') {
        const reason = j?.reason || 'Ödeme başlatılamadı.';
        throw new Error(String(reason));
      }

      const tokenPath = j?.token;
      if (!tokenPath || typeof tokenPath !== 'string') {
        throw new Error('Ödeme token alınamadı.');
      }

      // paytr sayfasını aç
      const url = buildPaytrUrl(tokenPath);
       window.open(url, '_blank');
      toast('Ödeme sayfası açıldı. Ödeme sonucunuz kısa süre sonra yansıyacaktır.');
    } catch (e: any) {
      toast(e?.message || 'Ödeme başlatılamadı.');
    } finally {
      setSubmitting(false);
    }
  }

  const formDisabled = loading || !!error || !pricing;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Paket Satın Al</h1>

      {/* fiyat paneli */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
        {loading && <div className="text-sm text-neutral-600">Fiyat yükleniyor…</div>}
        {!loading && error && <div className="text-sm text-rose-600">{error}</div>}
        {!loading && !error && pricing && (
          <div className="flex flex-col gap-1">
            <div className="text-sm text-neutral-600">Anlaşmalı birim fiyat</div>
            <div className="text-2xl font-bold">
              {fmtTRY(pricing.unitPriceTRY)} <span className="text-sm font-medium text-neutral-500">/ paket</span>
            </div>
            <div className="text-xs text-neutral-600">
              {pricing.minPackages ? <>En az <b>{pricing.minPackages}</b> paket</> : 'En az sınır yok'}
              {pricing.maxPackages ? <> • En fazla <b>{pricing.maxPackages}</b> paket</> : null}
            </div>
            {(pricing.note || pricing.updatedAt) && (
              <div className="text-xs text-neutral-500">
                {pricing.note ? <>Not: {pricing.note} • </> : null}
                Güncelleme: {fmtISO(pricing.updatedAt)}
              </div>
            )}
          </div>
        )}
      </section>

      {/* satın alma formu */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Satın Alma</h2>

        <form onSubmit={startPayment} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Paket Adedi</label>
              <input
                type="number"
                min={pricing?.minPackages || 1}
                max={pricing?.maxPackages ?? undefined}
                value={count}
                onChange={(e) => {
                  const raw = Number(e.target.value || 0);
                  const min = pricing?.minPackages || 1;
                  const max = pricing?.maxPackages ?? Infinity;
                  setCount(Math.max(min, Math.min(raw, max)));
                }}
                disabled={formDisabled}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-neutral-100"
              />
              <div className="mt-1 text-xs text-neutral-600">
                Toplam: <b>{fmtTRY(unit * count)}</b>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-neutral-700">Ödeme Yöntemi</label>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="pay"
                    checked={paymentMethod === PaymentMethod.CreditCard}
                    onChange={() => setPaymentMethod(PaymentMethod.CreditCard)}
                    disabled={formDisabled}
                  />
                  <span>Kredi Kartı (PayTR)</span>
                </label>
                <label className="flex items-center gap-2 text-sm opacity-60">
                  <input type="radio" name="pay" disabled />
                  <span>Havale/EFT</span>
                </label>
                <label className="flex items-center gap-2 text-sm opacity-60">
                  <input type="radio" name="pay" disabled />
                  <span>Nakit</span>
                </label>
              </div>
            </div>
          </div>

          {/* PayTR için gerekli alanlar */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">E-posta</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@mail.com"
                disabled={formDisabled}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-neutral-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Kart Üzerindeki İsim</label>
              <input
                value={nameOnCard}
                onChange={(e) => setNameOnCard(e.target.value)}
                disabled={formDisabled}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-neutral-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Kart Numarası</label>
              <input
                value={cardNo}
                onChange={(e) => setCardNo(e.target.value)}
                placeholder="4111 1111 1111 1111"
                disabled={formDisabled}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-neutral-100"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">Ay (AA)</label>
                <input
                  value={expMonth}
                  onChange={(e) => setExpMonth(e.target.value)}
                  placeholder="12"
                  disabled={formDisabled}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-neutral-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">Yıl (YY)</label>
                <input
                  value={expYear}
                  onChange={(e) => setExpYear(e.target.value)}
                  placeholder="27"
                  disabled={formDisabled}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-neutral-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">CVV</label>
                <input
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  placeholder="000"
                  disabled={formDisabled}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-neutral-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Ad Soyad</label>
              <input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                disabled={formDisabled}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-neutral-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Telefon</label>
              <input
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                placeholder="05xx xxx xx xx"
                disabled={formDisabled}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-neutral-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-neutral-700">Adres</label>
              <input
                value={userAddress}
                onChange={(e) => setUserAddress(e.target.value)}
                disabled={formDisabled}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-neutral-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={formDisabled || submitting || count <= 0}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? 'İşlem yapılıyor…' : `Öde (${fmtTRY(total)})`}
          </button>

          {info && (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
              {info}
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
