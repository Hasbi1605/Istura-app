import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, PenLine, X } from "lucide-react";
import type { FaqItem, FooterContact, WaTemplate } from "../../domain/types";
import { ASSETS } from "../../lib/assets";
import { INITIAL_WA_TEMPLATES, letterChecklist, storyWords } from "../../constants";
import { ContactIcon } from "../icons/SocialIcons";

const generateId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function AdminFaqManager({
  faqs,
  onChange,
}: {
  faqs: FaqItem[];
  onChange: (next: FaqItem[]) => void;
}) {
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [draft, setDraft] = useState<FaqItem>({
    id: "",
    question: "",
    answer: "",
  });
  const [linkLabel, setLinkLabel] = useState("");
  const [linkHref, setLinkHref] = useState("");

  const startCreate = () => {
    setEditing(null);
    setDraft({ id: generateId("faq"), question: "", answer: "" });
    setLinkLabel("");
    setLinkHref("");
  };

  const startEdit = (item: FaqItem) => {
    setEditing(item);
    setDraft({ ...item });
    setLinkLabel(item.link?.label ?? "");
    setLinkHref(item.link?.href ?? "");
  };

  const cancel = () => {
    setEditing(null);
    setDraft({ id: "", question: "", answer: "" });
    setLinkLabel("");
    setLinkHref("");
  };

  const save = () => {
    if (!draft.question.trim() || !draft.answer.trim()) return;
    const link =
      linkLabel.trim() && linkHref.trim()
        ? { label: linkLabel.trim(), href: linkHref.trim() }
        : undefined;
    const item: FaqItem = {
      id: draft.id || generateId("faq"),
      question: draft.question.trim(),
      answer: draft.answer.trim(),
      link,
    };
    const exists = faqs.some((entry) => entry.id === item.id);
    onChange(exists ? faqs.map((entry) => (entry.id === item.id ? item : entry)) : [...faqs, item]);
    cancel();
  };

  const remove = (id: string) => {
    if (!window.confirm("Hapus pertanyaan ini?")) return;
    onChange(faqs.filter((entry) => entry.id !== id));
    if (draft.id === id) cancel();
  };

  const move = (id: string, direction: -1 | 1) => {
    const idx = faqs.findIndex((entry) => entry.id === id);
    if (idx === -1) return;
    const target = idx + direction;
    if (target < 0 || target >= faqs.length) return;
    const next = [...faqs];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const isFormOpen = Boolean(draft.id);

  return (
    <div className="admin-cms-page">
      <div className="admin-heading">
        <div>
          <h1>Kelola FAQ</h1>
          <p>Pertanyaan dan jawaban yang muncul di halaman publik.</p>
        </div>
        {!isFormOpen && (
          <button type="button" className="button button-primary" onClick={startCreate}>
            <PenLine size={16} aria-hidden="true" />
            Tambah pertanyaan
          </button>
        )}
      </div>

      {isFormOpen && (
        <section className="admin-card">
          <header className="admin-card-head">
            <div>
              <h2>{editing ? "Edit pertanyaan" : "Tambah pertanyaan baru"}</h2>
              <p>Perubahan langsung muncul di halaman publik.</p>
            </div>
          </header>
          <div className="admin-cms-form">
            <label className="form-field">
              <span>Pertanyaan</span>
              <input
                value={draft.question}
                onChange={(event) => setDraft({ ...draft, question: event.target.value })}
                placeholder="Mis. Apakah booking harus minimal H-5?"
              />
            </label>
            <label className="form-field">
              <span>Jawaban</span>
              <textarea
                rows={4}
                value={draft.answer}
                onChange={(event) => setDraft({ ...draft, answer: event.target.value })}
              />
            </label>
            <div className="admin-cms-link">
              <label className="form-field">
                <span>Label tautan (opsional)</span>
                <input
                  value={linkLabel}
                  onChange={(event) => setLinkLabel(event.target.value)}
                  placeholder="Mis. Lihat contoh surat"
                />
              </label>
              <label className="form-field">
                <span>URL tautan (opsional)</span>
                <input
                  value={linkHref}
                  onChange={(event) => setLinkHref(event.target.value)}
                  placeholder="#contoh-surat atau https://..."
                />
              </label>
            </div>
            <div className="admin-cms-actions">
              <button type="button" className="button button-ghost" onClick={cancel}>
                Batal
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={save}
                disabled={!draft.question.trim() || !draft.answer.trim()}
              >
                Simpan
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="admin-cms-list">
        {faqs.map((item, index) => (
          <article key={item.id} className="admin-cms-row">
            <div className="admin-cms-row-body">
              <strong>{item.question}</strong>
              <p>{item.answer}</p>
              {item.link && (
                <small>
                  Tautan: {item.link.label} → {item.link.href}
                </small>
              )}
            </div>
            <div className="admin-cms-row-actions">
              <button
                type="button"
                className="admin-icon-btn"
                onClick={() => move(item.id, -1)}
                disabled={index === 0}
                aria-label="Pindahkan ke atas"
              >
                <ChevronLeft size={16} style={{ transform: "rotate(90deg)" }} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="admin-icon-btn"
                onClick={() => move(item.id, 1)}
                disabled={index === faqs.length - 1}
                aria-label="Pindahkan ke bawah"
              >
                <ChevronRight size={16} style={{ transform: "rotate(90deg)" }} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="admin-icon-btn"
                onClick={() => startEdit(item)}
                aria-label="Edit"
              >
                <PenLine size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="admin-icon-btn admin-icon-btn--danger"
                onClick={() => remove(item.id)}
                aria-label="Hapus"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function AdminContactsManager({
  contacts,
  onChange,
}: {
  contacts: FooterContact[];
  onChange: (next: FooterContact[]) => void;
}) {
  const [drafts, setDrafts] = useState<FooterContact[]>(contacts);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(contacts);
  }, [contacts]);

  const updateField = (index: number, field: keyof FooterContact, value: string) => {
    setDrafts((current) =>
      current.map((item, idx) =>
        idx === index ? ({ ...item, [field]: value } as FooterContact) : item,
      ),
    );
  };

  const save = () => {
    onChange(drafts);
    setSavedAt(
      new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    );
  };

  return (
    <div className="admin-cms-page">
      <div className="admin-heading">
        <div>
          <h1>Kontak Footer</h1>
          <p>Tautan kontak resmi yang ditampilkan di footer publik.</p>
        </div>
        <button type="button" className="button button-primary" onClick={save}>
          Simpan perubahan
        </button>
      </div>

      <div className="admin-cms-list">
        {drafts.map((contact, index) => (
          <article key={contact.iconKey} className="admin-cms-row admin-cms-row--form">
            <div className="admin-cms-row-icon">
              <ContactIcon iconKey={contact.iconKey} />
            </div>
            <div className="admin-cms-fields">
              <label className="form-field">
                <span>Nama platform</span>
                <input
                  value={contact.label}
                  onChange={(event) => updateField(index, "label", event.target.value)}
                />
              </label>
              <label className="form-field">
                <span>Handle / nomor</span>
                <input
                  value={contact.value}
                  onChange={(event) => updateField(index, "value", event.target.value)}
                />
              </label>
              <label className="form-field admin-cms-fields-full">
                <span>Tautan</span>
                <input
                  value={contact.href}
                  onChange={(event) => updateField(index, "href", event.target.value)}
                  placeholder="https://..."
                />
              </label>
            </div>
          </article>
        ))}
      </div>
      {savedAt && (
        <small className="admin-cms-saved">Tersimpan terakhir pukul {savedAt}.</small>
      )}
    </div>
  );
}

export function AdminWaTemplates({
  templates,
  onChange,
}: {
  templates: WaTemplate[];
  onChange: (next: WaTemplate[]) => void;
}) {
  const [drafts, setDrafts] = useState<WaTemplate[]>(templates);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(templates);
  }, [templates]);

  const isDirty = drafts.some(
    (draft, idx) => draft.template !== templates[idx]?.template,
  );

  const updateField = (index: number, value: string) => {
    setDrafts((current) =>
      current.map((item, idx) => (idx === index ? { ...item, template: value } : item)),
    );
  };

  const reset = (index: number) => {
    const original = INITIAL_WA_TEMPLATES.find((entry) => entry.id === drafts[index].id);
    if (!original) return;
    setDrafts((current) =>
      current.map((item, idx) => (idx === index ? { ...item, template: original.template } : item)),
    );
  };

  const save = () => {
    onChange(drafts);
    setSavedAt(
      new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    );
  };

  return (
    <div className="admin-cms-page">
      <div className="admin-page-head">
        <div>
          <h1>Template Pesan WhatsApp</h1>
          <p>Pesan otomatis yang dikirim ke pengunjung lewat WhatsApp.</p>
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={save}
          disabled={!isDirty}
        >
          Simpan perubahan
        </button>
      </div>

      <div className="admin-info-note">
        Variabel yang bisa dipakai:
        <code> {"{nama}"} </code>
        <code> {"{instansi}"} </code>
        <code> {"{kode}"} </code>
        <code> {"{tanggal}"} </code>
        <code> {"{jam}"} </code>
        <code> {"{catatan}"} </code>
        <code> {"{link}"} </code>
        <span> akan otomatis diisi saat pesan dikirim.</span>
      </div>

      <div className="admin-cms-list">
        {drafts.map((draft, index) => (
          <article key={draft.id} className="admin-card admin-wa-card">
            <header className="admin-card-head">
              <div>
                <h2>{draft.label}</h2>
                <p>{draft.description}</p>
              </div>
              <button
                type="button"
                className="admin-card-link"
                onClick={() => reset(index)}
              >
                Pulihkan default
              </button>
            </header>
            <textarea
              className="admin-wa-textarea"
              rows={5}
              value={draft.template}
              onChange={(event) => updateField(index, event.target.value)}
            />
          </article>
        ))}
      </div>

      {savedAt && (
        <small className="admin-cms-saved">Tersimpan terakhir pukul {savedAt}.</small>
      )}
    </div>
  );
}

export function AdminLetterPreview() {
  return (
    <div className="admin-cms-page">
      <div className="admin-heading">
        <div>
          <h1>Contoh Surat Permohonan</h1>
          <p>Pratinjau template yang ditampilkan di halaman publik.</p>
        </div>
        <span className="admin-placeholder-badge">Read-only · backend</span>
      </div>

      <section className="admin-card">
        <header className="admin-card-head">
          <div>
            <h2>Template aktif</h2>
            <p>Berkas yang dilampirkan di halaman publik.</p>
          </div>
        </header>
        <div className="admin-letter-preview">
          <img src={ASSETS.letterExample} alt="Pratinjau contoh surat permohonan" />
        </div>
      </section>

      <section className="admin-card">
        <header className="admin-card-head">
          <div>
            <h2>Persyaratan minimal</h2>
            <p>Daftar yang dipakai untuk validasi surat.</p>
          </div>
        </header>
        <ul className="admin-checklist">
          {letterChecklist.map((item) => (
            <li key={item}>
              <Check size={14} aria-hidden="true" /> {item}
            </li>
          ))}
        </ul>
        <p className="admin-info-note">
          Upload template baru dan editor persyaratan akan tersedia setelah backend siap.
        </p>
      </section>
    </div>
  );
}

export function AdminHeroPreview() {
  return (
    <div className="admin-cms-page">
      <div className="admin-heading">
        <div>
          <h1>Hero & Cerita</h1>
          <p>Pratinjau copy hero dan cerita pendek di halaman beranda.</p>
        </div>
        <span className="admin-placeholder-badge">Read-only · backend</span>
      </div>

      <section className="admin-card">
        <header className="admin-card-head">
          <div>
            <h2>Hero</h2>
            <p>Headline utama dan ajakan booking.</p>
          </div>
        </header>
        <dl className="admin-kv-list">
          <div>
            <dt>Headline</dt>
            <dd>ISTURA - Istana Untuk Rakyat</dd>
          </div>
          <div>
            <dt>Subheadline</dt>
            <dd>Booking Kunjungan Istana Kepresidenan Yogyakarta</dd>
          </div>
          <div>
            <dt>Tombol primer</dt>
            <dd>Mulai Booking</dd>
          </div>
          <div>
            <dt>Tombol sekunder</dt>
            <dd>Cek Jadwal</dd>
          </div>
        </dl>
      </section>

      <section className="admin-card">
        <header className="admin-card-head">
          <div>
            <h2>Cerita pendek</h2>
            <p>Kalimat scrubbed yang muncul saat scroll.</p>
          </div>
        </header>
        <p className="admin-quote">"{storyWords.join(" ")}"</p>
      </section>

      <p className="admin-info-note">
        Editor copy hero dan cerita akan tersedia setelah CMS terhubung.
      </p>
    </div>
  );
}
