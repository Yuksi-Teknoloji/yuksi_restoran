// src/components/subsect/MiniRTE.tsx
'use client';

import React from 'react';

type Props = {
  value: string;                       // HTML
  onChange: (html: string) => void;    // HTML geri verilir
  height?: number;                     // px
  placeholder?: string;
};

function sanitizeHtml(html: string) {
  // basit/temel temizlik: script/style etiketleri ve on* atributları uçurulur
  // (ileri seviye sanitization için yine de server tarafında sanitize etmen önerilir)
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\son\w+=\S+/gi, '');
}

export default function MiniRTE({
  value,
  onChange,
  height = 280,
  placeholder = 'İçerik yazın…',
}: Props) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInternalSet = React.useRef(false);

  // dışarıdan value değiştiğinde editor’ü güncelle (sonsuz döngü önlemek için flag)
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!isInternalSet.current && el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
    isInternalSet.current = false;
  }, [value]);

  // common exec
  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    triggerChange();
  };

  const triggerChange = () => {
    const el = ref.current;
    if (!el) return;
    // minimal temizlik
    const clean = sanitizeHtml(el.innerHTML);
    if (clean !== value) {
      isInternalSet.current = true;
      onChange(clean);
    }
  };

  // paste -> düz metin yapıştır (format kaosu yaşamamak için)
  const onPaste: React.ClipboardEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  // placeholder görünümü
  const showPlaceholder = !value || value.replace(/<[^>]+>/g, '').trim() === '';

  // toolbar actions
  const onCreateLink = () => {
    const url = prompt('Bağlantı adresi (https://...)');
    if (!url) return;
    exec('createLink', url);
  };

  const onInsertImage = () => {
    const url = prompt('Görsel URL');
    if (!url) return;
    exec('insertImage', url);
  };

  // block format (p, h1, h2, h3)
  const setBlock = (tag: 'p'|'h1'|'h2'|'h3'|'blockquote') => {
    // 'formatBlock' çoğu tarayıcıda çalışır; Safari için <tag> ister
    document.execCommand('formatBlock', false, tag === 'p' ? 'P' : tag.toUpperCase());
    triggerChange();
  };

  // klavye ile her içerik değişiminde güncelle
  const onInput: React.FormEventHandler<HTMLDivElement> = () => triggerChange();

  return (
    <div className="rounded-xl border border-neutral-300 overflow-visible">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b bg-neutral-50 px-2 py-1 text-sm">
        <select
          className="rounded-md border bg-white px-2 py-1"
          onChange={(e) => setBlock(e.target.value as any)}
          defaultValue="p"
          aria-label="Biçim"
          title="Biçim"
        >
          <option value="p">Paragraf</option>
          <option value="h1">Başlık 1</option>
          <option value="h2">Başlık 2</option>
          <option value="h3">Başlık 3</option>
          <option value="blockquote">Alıntı</option>
        </select>

        <button type="button" className="px-2 py-1 hover:bg-neutral-100 rounded" onClick={() => exec('bold')} title="Kalın (Ctrl+B)">
          <b>B</b>
        </button>
        <button type="button" className="px-2 py-1 hover:bg-neutral-100 rounded italic" onClick={() => exec('italic')} title="İtalik (Ctrl+I)">
          I
        </button>
        <button type="button" className="px-2 py-1 hover:bg-neutral-100 rounded underline" onClick={() => exec('underline')} title="Altı Çizili (Ctrl+U)">
          U
        </button>

        <span className="mx-1 select-none text-neutral-300">|</span>

        <button type="button" className="px-2 py-1 hover:bg-neutral-100 rounded" onClick={onCreateLink} title="Bağlantı">
          🔗
        </button>
        <button type="button" className="px-2 py-1 hover:bg-neutral-100 rounded" onClick={() => exec('unlink')} title="Bağlantıyı Kaldır">
          ⛓️‍💥
        </button>

        <span className="mx-1 select-none text-neutral-300">|</span>

        <button type="button" className="px-2 py-1 hover:bg-neutral-100 rounded" onClick={() => exec('insertUnorderedList')} title="Sırasız Liste">
          • List
        </button>
        <button type="button" className="px-2 py-1 hover:bg-neutral-100 rounded" onClick={() => exec('insertOrderedList')} title="Sıralı Liste">
          1. List
        </button>
        <button type="button" className="px-2 py-1 hover:bg-neutral-100 rounded" onClick={() => exec('outdent')} title="Girintiyi Azalt">
          ⇤
        </button>
        <button type="button" className="px-2 py-1 hover:bg-neutral-100 rounded" onClick={() => exec('indent')} title="Girintiyi Artır">
          ⇥
        </button>

        <span className="mx-1 select-none text-neutral-300">|</span>

        <button type="button" className="px-2 py-1 hover:bg-neutral-100 rounded" onClick={onInsertImage} title="Görsel Ekle (URL)">
          🖼️
        </button>

        <span className="mx-1 select-none text-neutral-300">|</span>

        <button type="button" className="px-2 py-1 hover:bg-neutral-100 rounded" onClick={() => document.execCommand('undo')} title="Geri Al">
          ↶
        </button>
        <button type="button" className="px-2 py-1 hover:bg-neutral-100 rounded" onClick={() => document.execCommand('redo')} title="İleri Al">
          ↷
        </button>
      </div>

      {/* Editör alanı */}
      <div
        ref={ref}
        className="cklite-editor px-3 py-2 outline-none"
        contentEditable
        onInput={onInput}
        onPaste={onPaste}
        suppressContentEditableWarning
        style={{ minHeight: height }}
        data-placeholder={placeholder}
      />

      <style jsx global>{`
        .cklite-editor:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af; /* neutral-400 */
        }
        .cklite-editor img {
          max-width: 100%;
          height: auto;
        }
        .cklite-editor blockquote {
          border-left: 3px solid #e5e7eb;
          margin: 0.5rem 0;
          padding: 0.25rem 0.75rem;
          color: #4b5563;
          background: #f9fafb;
        }
        .cklite-editor table {
          border-collapse: collapse;
          width: 100%;
        }
        .cklite-editor th,
        .cklite-editor td {
          border: 1px solid #e5e7eb;
          padding: 4px 6px;
        }
      `}</style>
    </div>
  );
}
