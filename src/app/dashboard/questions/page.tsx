// src/app/Help/Content/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type ApiSubSection = {
  id: number;
  title: string;
  content_type: string | number; // GET: label ("Destek") gelebilir, bazen sayı da olabilir
  show_in_menu: boolean;
  show_in_footer: boolean;
  content: string;
  created_at?: string;
  updated_at?: string;
};

type Faq = { question: string; answer: string };

const DESTEK_LABEL = 'Destek';

export default function HelpContentPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        // CORS sorununa düşmemek için proxy kullan
        const res = await fetch('/yuksi/SubSection/all?offset=0', { cache: 'no-store' });
        const text = await res.text();
        const json = text ? JSON.parse(text) : null;
        if (!res.ok) throw new Error(json?.message || json?.title || `HTTP ${res.status}`);

        const all: ApiSubSection[] = Array.isArray(json?.data) ? json.data : [];

        // Sadece "Destek" tipindekiler (label ya da 1 sayısı gelebilir)
        const onlyHelp = all.filter((it) => {
          const v = it.content_type;
          if (typeof v === 'number') return v === 1;
          return String(v).trim().toLowerCase() === DESTEK_LABEL.toLowerCase();
        });

        // (opsiyonel) en yeni üstte
        onlyHelp.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

        const mapped: Faq[] = onlyHelp.map((it) => ({
          question: (it.title ?? '').trim() || '—',
          answer: (it.content ?? '').trim() || '—',
        }));

        if (!alive) return;
        setFaqs(mapped);
        setOpenIndex(mapped.length ? 0 : null);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || 'Kayıtlar alınamadı.');
        setFaqs([]);
        setOpenIndex(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, []);

  const hasData = useMemo(() => faqs.length > 0, [faqs]);
  const toggleFAQ = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <div className="bg-white min-h-screen overflow-x-hidden">
      <header className="bg-gradient-to-b from-orange-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Sıkça Sorulan Sorular</h1>
        </div>
      </header>

      <section className="py-10 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {loading && (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 text-neutral-600 shadow-sm">
              Yükleniyor…
            </div>
          )}

          {!loading && err && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
              {err}
            </div>
          )}

          {!loading && !err && !hasData && (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 text-neutral-600 shadow-sm">
              Bu başlık için içerik bulunamadı.
            </div>
          )}

          {!loading && !err && hasData && (
            <div className="space-y-5">
              {faqs.map((faq, index) => {
                const open = openIndex === index;
                return (
                  <div key={`${index}-${faq.question}`} className="overflow-hidden rounded-xl border border-orange-500 shadow-sm">
                    <button
                      onClick={() => toggleFAQ(index)}
                      className={`flex w-full items-center justify-between px-5 sm:px-6 py-4 sm:py-3 text-left text-base sm:text-lg font-semibold transition ${
                        open ? 'bg-orange-600 text-white' : 'bg-orange-500 text-white'
                      }`}
                    >
                      <span className="pr-4">{faq.question}</span>
                      <span
                        className={`ml-3 inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
                          open ? 'border-white/40 bg-white/10' : 'border-white/30 bg-white/10'
                        }`}
                        aria-hidden
                      >
                        {open ? '−' : '+'}
                      </span>
                    </button>

                    {open && (
                      <div className="bg-yellow-50 px-5 sm:px-6 py-5 text-neutral-800">
                        <article
                          className="prose max-w-none prose-p:leading-7"
                          dangerouslySetInnerHTML={{ __html: faq.answer }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
