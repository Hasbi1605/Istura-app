import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MessageCircle, PenLine, RotateCcw, Save, UploadCloud, X } from "lucide-react";
import type { CmsSyncStatus, FaqItem, FooterContact, LandingIconKey, SiteContent, WaTemplate } from "../../domain/types";
import { ASSETS } from "../../lib/assets";
import { INITIAL_WA_TEMPLATES, LANDING_ICON_OPTIONS, letterChecklist, storyWords, DEFAULT_SITE_CONTENT } from "../../constants";
import { ContactIcon } from "../icons/SocialIcons";
import {
  fetchAdminHero,
  fetchAdminLetter,
  updateAdminHero,
  updateAdminLetter,
  updateAdminSiteContent,
  type ApiHero,
  type ApiLetter,
} from "../../api/cms";
import { ApiError, ValidationError } from "../../api/client";
import { ButtonSpinner, SavingStatus, SectionSkeleton } from "../ui/LoadingStates";

const generateId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const MAX_ADMIN_LETTER_IMAGE_BYTES = 5 * 1024 * 1024;

const MAX_LANDING_QUICK_POINTS = 6;
const MAX_LANDING_QUICK_POINT_LENGTH = 120;
const WA_TEMPLATE_VARIABLES = [
  "{nama}",
  "{instansi}",
  "{kode}",
  "{tanggal}",
  "{tanggal_awal}",
  "{tanggal_usulan}",
  "{rombongan}",
  "{jam}",
  "{catatan}",
  "{link}",
];

function summarizeWaTemplate(template: string) {
  return template
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
}

function countWaTemplateLines(template: string) {
  if (!template) return 0;
  return template.split(/\r?\n/).length;
}

function normalizeLandingContentForSave(content: SiteContent): SiteContent {
  return {
    ...content,
    quickInfo: {
      ...content.quickInfo,
      cards: content.quickInfo.cards.map((card) => ({
        ...card,
        points: card.points.map((point) => point.trim()).filter(Boolean),
      })),
    },
  };
}

export function AdminFaqManager({
	faqs,
	syncStatus = "idle",
	onChange,
}: {
	faqs: FaqItem[];
	syncStatus?: CmsSyncStatus;
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
				<SavingStatus status={syncStatus} />
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
                placeholder="Mis. Kapan booking bisa dikirim?"
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
					disabled={!draft.question.trim() || !draft.answer.trim() || syncStatus === "saving"}
				>
					{syncStatus === "saving" ? <ButtonSpinner label="Menyimpan..." /> : "Simpan"}
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
	syncStatus = "idle",
	onChange,
}: {
	contacts: FooterContact[];
	syncStatus?: CmsSyncStatus;
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
				<SavingStatus status={syncStatus} />
			</div>
			<button type="button" className="button button-primary" onClick={save} disabled={syncStatus === "saving"}>
				{syncStatus === "saving" ? <ButtonSpinner label="Menyimpan..." /> : "Simpan perubahan"}
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
	syncStatus = "idle",
	onChange,
}: {
	templates: WaTemplate[];
	syncStatus?: CmsSyncStatus;
	onChange: (next: WaTemplate[]) => void;
}) {
  const [drafts, setDrafts] = useState<WaTemplate[]>(templates);
  const [selectedId, setSelectedId] = useState<WaTemplate["id"]>(
    templates[0]?.id ?? INITIAL_WA_TEMPLATES[0].id,
  );
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDrafts(templates);
    setSelectedId((current) =>
      templates.some((template) => template.id === current)
        ? current
        : templates[0]?.id ?? INITIAL_WA_TEMPLATES[0].id,
    );
  }, [templates]);

  const savedById = new Map(templates.map((template) => [template.id, template]));
  const dirtyIds = new Set(
    drafts
      .filter((draft) => draft.template !== savedById.get(draft.id)?.template)
      .map((draft) => draft.id),
  );
  const isDirty = dirtyIds.size > 0;
  const selectedDraft = drafts.find((draft) => draft.id === selectedId) ?? drafts[0];
  const selectedDirty = selectedDraft ? dirtyIds.has(selectedDraft.id) : false;

  const updateTemplate = (id: WaTemplate["id"], value: string) => {
    setDrafts((current) =>
      current.map((item) => (item.id === id ? { ...item, template: value } : item)),
    );
  };

  const reset = (id: WaTemplate["id"]) => {
    const original = INITIAL_WA_TEMPLATES.find((entry) => entry.id === id);
    if (!original) return;
    setDrafts((current) =>
      current.map((item) => (item.id === id ? { ...item, template: original.template } : item)),
    );
  };

  const insertVariable = (variable: string) => {
    if (!selectedDraft) return;
    const textarea = editorRef.current;
    const value = selectedDraft.template;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const needsLeadingSpace = start > 0 && Boolean(value[start - 1]) && !/\s/.test(value[start - 1]);
    const needsTrailingSpace = Boolean(value[end]) && !/\s/.test(value[end]);
    const inserted = `${needsLeadingSpace ? " " : ""}${variable}${needsTrailingSpace ? " " : ""}`;

    updateTemplate(selectedDraft.id, `${value.slice(0, start)}${inserted}${value.slice(end)}`);

    requestAnimationFrame(() => {
      const nextCursor = start + inserted.length;
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
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
				<SavingStatus status={syncStatus} />
			</div>
        <button
          type="button"
          className="button button-primary"
          onClick={save}
			disabled={!isDirty || syncStatus === "saving"}
		>
			{syncStatus === "saving" ? <ButtonSpinner label="Menyimpan..." /> : <><Save size={16} aria-hidden="true" /> Simpan perubahan</>}
		</button>
      </div>

      <div className="admin-wa-workspace">
        <aside className="admin-wa-template-list" aria-label="Daftar template WhatsApp">
          {drafts.map((draft) => {
            const isSelected = selectedDraft?.id === draft.id;
            const isTemplateDirty = dirtyIds.has(draft.id);
            return (
              <button
                key={draft.id}
                type="button"
                className={`admin-wa-template-card${isSelected ? " is-selected" : ""}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedId(draft.id)}
              >
                <span className="admin-wa-template-icon" aria-hidden="true">
                  <MessageCircle size={18} />
                </span>
                <span className="admin-wa-template-copy">
                  <span className="admin-wa-template-title">
                    <strong>{draft.label}</strong>
                    {isTemplateDirty && <em>Diubah</em>}
                  </span>
                  <small>{draft.description}</small>
                  <span className="admin-wa-template-preview">
                    {summarizeWaTemplate(draft.template) || "Template kosong."}
                  </span>
                </span>
              </button>
            );
          })}
        </aside>

        {selectedDraft ? (
          <section className="admin-wa-editor-panel" aria-labelledby="wa-template-title">
            <header className="admin-wa-editor-head">
              <div>
                <span>Template aktif</span>
                <h2 id="wa-template-title">{selectedDraft.label}</h2>
                <p>{selectedDraft.description}</p>
              </div>
              <button
                type="button"
                className="admin-card-link admin-wa-reset"
                onClick={() => reset(selectedDraft.id)}
              >
                <RotateCcw size={14} aria-hidden="true" />
                Pulihkan default
              </button>
            </header>

            {selectedDirty && (
              <div className="admin-wa-meta" aria-live="polite">
                <strong>Belum disimpan</strong>
              </div>
            )}

            <div className="admin-wa-variable-panel" aria-label="Variabel pesan">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Variabel</span>
                <span style={{ fontWeight: 'normal', fontSize: '0.72rem', color: 'rgba(16, 24, 47, 0.45)' }}>Klik untuk menyisipkan ke pesan</span>
              </div>
              <div>
                {WA_TEMPLATE_VARIABLES.map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    className="admin-wa-variable-chip"
                    title={`Sisipkan ${variable}`}
                    onClick={() => insertVariable(variable)}
                  >
                    {variable}
                  </button>
                ))}
              </div>
            </div>

            <label className="admin-wa-editor-label" htmlFor="wa-template-editor">
              Isi pesan
            </label>
            <textarea
              id="wa-template-editor"
              ref={editorRef}
              className="admin-wa-textarea"
              value={selectedDraft.template}
              onChange={(event) => updateTemplate(selectedDraft.id, event.target.value)}
            />

          </section>
        ) : (
          <p className="admin-card-empty">Belum ada template WhatsApp.</p>
        )}
      </div>

      {savedAt && (
        <small className="admin-cms-saved">Tersimpan terakhir pukul {savedAt}.</small>
      )}
    </div>
  );
}export function AdminLetterManager({ onChange }: { onChange?: (next: ApiLetter) => void }) {
  const [checklist, setChecklist] = useState<string[]>(letterChecklist);
  const [image, setImage] = useState<string>(ASSETS.letterExample);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [rulesDescription, setRulesDescription] = useState<string>("Setiap rombongan diwajibkan untuk memahami dan menaati seluruh peraturan tata tertib fisik kunjungan demi kenyamanan bersama dan menjaga kehormatan lingkungan Istana Kepresidenan Yogyakarta.");
  const [rulesImage, setRulesImage] = useState<string>("/assets/peraturan-kunjungan.webp");
  const [rulesFile, setRulesFile] = useState<File | null>(null);
  const [rulesPreview, setRulesPreview] = useState<string | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<"rules" | "letter">("rules");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAdminLetter()
      .then((data) => {
        if (cancelled) return;
        setChecklist(data.checklist.length ? data.checklist : letterChecklist);
        setImage(data.image || ASSETS.letterExample);
        setRulesDescription(data.rulesDescription || "Setiap rombongan diwajibkan untuk memahami dan menaati seluruh peraturan tata tertib fisik kunjungan demi kenyamanan bersama dan menjaga kehormatan lingkungan Istana Kepresidenan Yogyakarta.");
        setRulesImage(data.rulesImage || "/assets/peraturan-kunjungan.webp");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    return () => {
      if (rulesPreview) URL.revokeObjectURL(rulesPreview);
    };
  }, [rulesPreview]);

  const updateChecklistItem = (index: number, value: string) =>
    setChecklist((current) => current.map((item, idx) => (idx === index ? value : item)));

  const addChecklistItem = () => setChecklist((current) => [...current, ""]);

  const removeChecklistItem = (index: number) =>
    setChecklist((current) => current.filter((_, idx) => idx !== index));

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    if (!next) {
      setFile(null);
      setPreview(null);
      return;
    }

    const isSupportedImage = /\.(jpe?g|png|webp)$/i.test(next.name);
    if (!isSupportedImage) {
      event.currentTarget.value = "";
      setFile(null);
      setPreview(null);
      setError("Format gambar harus JPG, PNG, atau WebP.");
      return;
    }

    if (next.size > MAX_ADMIN_LETTER_IMAGE_BYTES) {
      event.currentTarget.value = "";
      setFile(null);
      setPreview(null);
      setError("Ukuran gambar maksimal 5 MB.");
      return;
    }

    setError(null);
    setFile(next);
    setPreview(URL.createObjectURL(next));
  };

  const onRulesFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    if (!next) {
      setRulesFile(null);
      setRulesPreview(null);
      return;
    }

    const isSupportedImage = /\.(jpe?g|png|webp)$/i.test(next.name);
    if (!isSupportedImage) {
      event.currentTarget.value = "";
      setRulesFile(null);
      setRulesPreview(null);
      setError("Format gambar harus JPG, PNG, atau WebP.");
      return;
    }

    if (next.size > MAX_ADMIN_LETTER_IMAGE_BYTES) {
      event.currentTarget.value = "";
      setRulesFile(null);
      setRulesPreview(null);
      setError("Ukuran gambar maksimal 5 MB.");
      return;
    }

    setError(null);
    setRulesFile(next);
    setRulesPreview(URL.createObjectURL(next));
  };

  const save = async () => {
    const cleanedChecklist = checklist.map((item) => item.trim()).filter(Boolean);
    const cleanedDescription = rulesDescription.trim();

    if (cleanedChecklist.length === 0) {
      setError("Minimal satu poin persyaratan contoh surat.");
      return;
    }
    if (!cleanedDescription) {
      setError("Deskripsi tata tertib kunjungan tidak boleh kosong.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const data = await updateAdminLetter(cleanedChecklist, file, cleanedDescription, rulesFile);
      setChecklist(data.checklist);
      setImage(data.image || ASSETS.letterExample);
      setRulesDescription(data.rulesDescription || "Setiap rombongan diwajibkan untuk memahami dan menaati seluruh peraturan tata tertib fisik kunjungan demi kenyamanan bersama dan menjaga kehormatan lingkungan Istana Kepresidenan Yogyakarta.");
      setRulesImage(data.rulesImage || "/assets/peraturan-kunjungan.webp");
      onChange?.(data);
      setFile(null);
      setPreview(null);
      setRulesFile(null);
      setRulesPreview(null);
      setSavedAt(
        new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      );
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(Object.values(err.errors)[0]?.[0] ?? "Validasi gagal.");
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Gagal menyimpan ketentuan kunjungan.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-cms-page">
      <div className="admin-heading">
        <div>
          <h1>Ketentuan Kunjungan</h1>
          <p>Kelola peraturan tata tertib fisik dan acuan contoh surat permohonan kunjungan.</p>
        </div>
        <button type="button" className="button button-primary" onClick={save} disabled={saving || loading}>
          {saving ? <ButtonSpinner label="Menyimpan..." /> : "Simpan perubahan"}
        </button>
      </div>

      <div className="admin-subtabs" style={{ display: "flex", gap: "12px", marginBottom: "24px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
        <button
          type="button"
          className={`button ${activeSubTab === "rules" ? "button-primary" : "button-ghost"}`}
          onClick={() => setActiveSubTab("rules")}
          style={{ minHeight: "40px", padding: "0 18px", fontSize: "0.95rem" }}
        >
          Tata Tertib Kunjungan
        </button>
        <button
          type="button"
          className={`button ${activeSubTab === "letter" ? "button-primary" : "button-ghost"}`}
          onClick={() => setActiveSubTab("letter")}
          style={{ minHeight: "40px", padding: "0 18px", fontSize: "0.95rem" }}
        >
          Contoh Surat Permohonan
        </button>
      </div>

      {loading ? (
        <SectionSkeleton rows={8} />
      ) : activeSubTab === "rules" ? (
        <div className="admin-cms-split">
          <section className="admin-card">
            <header className="admin-card-head">
              <div>
                <h2>Deskripsi Tata Tertib</h2>
                <p>Teks pengantar/deskripsi tata tertib fisik kunjungan yang ditampilkan di halaman publik.</p>
              </div>
            </header>
            <div className="admin-cms-form" style={{ marginTop: "20px" }}>
              <label className="form-field">
                <span>Teks Pengantar</span>
                <textarea
                  className="textarea"
                  value={rulesDescription}
                  onChange={(event) => setRulesDescription(event.target.value)}
                  rows={8}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    fontSize: "0.95rem",
                    lineHeight: "1.5",
                    fontFamily: "inherit",
                    resize: "vertical"
                  }}
                  placeholder="Masukkan kalimat pengantar tata tertib..."
                />
              </label>
            </div>
          </section>

          <section className="admin-card">
            <h2>Gambar/Infografis Peraturan</h2>
            <div className="admin-cms-form">
              <div className="admin-letter-preview">
                <img src={rulesPreview ?? rulesImage} alt="Pratinjau infografis tata tertib" />
              </div>
              <div className="admin-file-field">
                <span className="admin-file-field-label">Ganti gambar (JPG/PNG/WebP, maks 5 MB)</span>
                <div className="admin-file-row">
                  <label className="button button-ghost admin-file-button">
                    <UploadCloud size={16} aria-hidden="true" />
                    Pilih gambar
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={onRulesFileChange}
                      className="admin-file-input"
                    />
                  </label>
                  <span className="admin-file-name">
                    {rulesFile ? rulesFile.name : "Belum ada file dipilih"}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="admin-cms-split">
          <section className="admin-card">
            <header className="admin-card-head">
              <div>
                <h2>Persyaratan minimal</h2>
                <p>Daftar syarat kelengkapan isi surat permohonan.</p>
              </div>
              <button type="button" className="admin-card-link" onClick={addChecklistItem}>
                Tambah poin
              </button>
            </header>
            <div className="admin-letter-checklist">
              {checklist.map((item, index) => (
                <div key={index} className="admin-letter-checklist-row">
                  <label className="form-field">
                    <span>Poin {index + 1}</span>
                    <input value={item} onChange={(event) => updateChecklistItem(index, event.target.value)} />
                  </label>
                  <button
                    type="button"
                    className="admin-icon-btn admin-icon-btn--danger"
                    onClick={() => removeChecklistItem(index)}
                    aria-label={`Hapus poin ${index + 1}`}
                    disabled={checklist.length <= 1}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-card">
            <h2>Gambar Acuan Surat</h2>
            <div className="admin-cms-form">
              <div className="admin-letter-preview">
                <img src={preview ?? image} alt="Pratinjau contoh surat permohonan" />
              </div>
              <div className="admin-file-field">
                <span className="admin-file-field-label">Ganti gambar (JPG/PNG/WebP, maks 5 MB)</span>
                <div className="admin-file-row">
                  <label className="button button-ghost admin-file-button">
                    <UploadCloud size={16} aria-hidden="true" />
                    Pilih gambar
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={onFileChange}
                      className="admin-file-input"
                    />
                  </label>
                  <span className="admin-file-name">
                    {file ? file.name : "Belum ada file dipilih"}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {error && <p className="admin-form-error">{error}</p>}
      {savedAt && (
        <small className="admin-cms-saved" style={{ display: "block", marginTop: "12px" }}>
          Tersimpan terakhir pukul {savedAt}.
        </small>
      )}
    </div>
  );
}

export function AdminHeroManager({ onChange }: { onChange?: (next: ApiHero) => void }) {
  const [draft, setDraft] = useState<ApiHero>({
    headline: "ISTURA - Istana Untuk Rakyat",
    subheadline: "Booking Kunjungan Istana Kepresidenan Yogyakarta",
    primaryCta: "Mulai Booking",
    secondaryCta: "Cek Jadwal",
    story: storyWords.join(" "),
  });
	const [saving, setSaving] = useState(false);
	const [loading, setLoading] = useState(true);
	const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		fetchAdminHero()
			.then((data) => {
				if (!cancelled) setDraft(data);
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (field: keyof ApiHero, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await updateAdminHero({
        headline: draft.headline.trim(),
        subheadline: draft.subheadline.trim(),
        primaryCta: draft.primaryCta.trim(),
        secondaryCta: draft.secondaryCta.trim(),
        story: draft.story.trim(),
      });
      setDraft(data);
      onChange?.(data);
      setSavedAt(
        new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      );
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(Object.values(err.errors)[0]?.[0] ?? "Validasi gagal.");
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Gagal menyimpan hero & cerita.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-cms-page">
      <div className="admin-heading">
        <div>
          <h1>Hero & Cerita</h1>
          <p>Edit copy hero dan cerita pendek di halaman beranda.</p>
        </div>
		<button type="button" className="button button-primary" onClick={save} disabled={saving || loading}>
			{saving ? <ButtonSpinner label="Menyimpan..." /> : "Simpan perubahan"}
		</button>
      </div>

      <section className="admin-card">
        <header className="admin-card-head">
          <div>
            <h2>Hero</h2>
            <p>Headline utama dan ajakan booking.</p>
          </div>
        </header>
		{loading ? (
			<SectionSkeleton rows={6} />
		) : (
			<div className="admin-cms-form">
          <label className="form-field">
            <span>Headline</span>
            <input value={draft.headline} onChange={(event) => update("headline", event.target.value)} />
          </label>
          <label className="form-field">
            <span>Subheadline</span>
            <input
              value={draft.subheadline}
              onChange={(event) => update("subheadline", event.target.value)}
            />
          </label>
          <div className="admin-cms-link">
            <label className="form-field">
              <span>Tombol primer</span>
              <input
                value={draft.primaryCta}
                onChange={(event) => update("primaryCta", event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Tombol sekunder</span>
              <input
                value={draft.secondaryCta}
                onChange={(event) => update("secondaryCta", event.target.value)}
              />
			</label>
			</div>
			</div>
		)}
      </section>

      <section className="admin-card">
        <header className="admin-card-head">
          <div>
            <h2>Cerita pendek</h2>
            <p>Kalimat scrubbed yang muncul saat scroll.</p>
          </div>
        </header>
        <div className="admin-cms-form">
          <label className="form-field">
            <span>Teks cerita</span>
            <textarea
              rows={3}
              value={draft.story}
              onChange={(event) => update("story", event.target.value)}
            />
          </label>
        </div>
        {error && <p className="admin-form-error">{error}</p>}
        {savedAt && <small className="admin-cms-saved">Tersimpan terakhir pukul {savedAt}.</small>}
      </section>
    </div>
  );
}

export function AdminLandingManager({
  content,
  onChange,
}: {
  content: SiteContent;
  onChange?: (next: SiteContent) => void;
}) {
  const [draft, setDraft] = useState<SiteContent>(content);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(content);
  }, [content]);

  const updateNav = (field: keyof SiteContent["nav"], value: string) => {
    setDraft((current) => ({ ...current, nav: { ...current.nav, [field]: value } }));
  };

  const updateNavItem = (index: number, field: "label" | "target", value: string) => {
    setDraft((current) => ({
      ...current,
      nav: {
        ...current.nav,
        items: current.nav.items.map((item, idx) =>
          idx === index ? { ...item, [field]: value } : item,
        ),
      },
    }));
  };

  const addNavItem = () => {
    setDraft((current) => ({
      ...current,
      nav: { ...current.nav, items: [...current.nav.items, { label: "Menu baru", target: "#faq" }] },
    }));
  };

  const removeNavItem = (index: number) => {
    setDraft((current) => ({
      ...current,
      nav: { ...current.nav, items: current.nav.items.filter((_, idx) => idx !== index) },
    }));
  };

  const updateQuickInfo = (field: keyof SiteContent["quickInfo"], value: string) => {
    setDraft((current) => ({
      ...current,
      quickInfo: { ...current.quickInfo, [field]: value },
    }));
  };

  const updateQuickCard = (
    index: number,
    field: "iconKey" | "title" | "body",
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      quickInfo: {
        ...current.quickInfo,
        cards: current.quickInfo.cards.map((card, idx) =>
          idx === index ? { ...card, [field]: value } : card,
        ),
      },
    }));
  };

  const updateQuickPoints = (index: number, value: string) => {
    setDraft((current) => ({
      ...current,
      quickInfo: {
        ...current.quickInfo,
        cards: current.quickInfo.cards.map((card, idx) =>
          idx === index ? { ...card, points: value.split("\n") } : card,
        ),
      },
    }));
  };

  const addQuickCard = () => {
    setDraft((current) => ({
      ...current,
      quickInfo: {
        ...current.quickInfo,
        cards: [
          ...current.quickInfo.cards,
          { iconKey: "clock", title: "Judul kartu", body: "Deskripsi singkat", points: ["Poin utama"] },
        ],
      },
    }));
  };

  const removeQuickCard = (index: number) => {
    setDraft((current) => ({
      ...current,
      quickInfo: {
        ...current.quickInfo,
        cards: current.quickInfo.cards.filter((_, idx) => idx !== index),
      },
    }));
  };

  const updateSchedule = (field: keyof SiteContent["schedule"], value: string) => {
    setDraft((current) => ({ ...current, schedule: { ...current.schedule, [field]: value } }));
  };

  const updateVideo = (field: keyof SiteContent["video"], value: string) => {
    setDraft((current) => ({ ...current, video: { ...current.video, [field]: value } }));
  };

  const updateBookingSteps = (field: keyof SiteContent["bookingSteps"], value: string) => {
    setDraft((current) => ({
      ...current,
      bookingSteps: { ...current.bookingSteps, [field]: value },
    }));
  };

  const updateStepCard = (
    index: number,
    field: "iconKey" | "title" | "body",
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      bookingSteps: {
        ...current.bookingSteps,
        cards: current.bookingSteps.cards.map((card, idx) =>
          idx === index ? { ...card, [field]: value } : card,
        ),
      },
    }));
  };

  const addStepCard = () => {
    setDraft((current) => ({
      ...current,
      bookingSteps: {
        ...current.bookingSteps,
        cards: [
          ...current.bookingSteps.cards,
          { iconKey: "calendar", title: "Langkah baru", body: "Deskripsi langkah." },
        ],
      },
    }));
  };

  const removeStepCard = (index: number) => {
    setDraft((current) => ({
      ...current,
      bookingSteps: {
        ...current.bookingSteps,
        cards: current.bookingSteps.cards.filter((_, idx) => idx !== index),
      },
    }));
  };

  const updateActivities = (field: keyof SiteContent["activities"], value: string) => {
    setDraft((current) => ({
      ...current,
      activities: { ...current.activities, [field]: value },
    }));
  };

  const updateActivity = (
    index: number,
    field: "title" | "body" | "image",
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      activities: {
        ...current.activities,
        items: current.activities.items.map((item, idx) =>
          idx === index ? { ...item, [field]: value } : item,
        ),
      },
    }));
  };

  const addActivity = () => {
    setDraft((current) => ({
      ...current,
      activities: {
        ...current.activities,
        items: [
          ...current.activities.items,
          { title: "Aktivitas baru", body: "Deskripsi aktivitas.", image: "/assets/hero-istana.webp" },
        ],
      },
    }));
  };

  const removeActivity = (index: number) => {
    setDraft((current) => ({
      ...current,
      activities: {
        ...current.activities,
        items: current.activities.items.filter((_, idx) => idx !== index),
      },
    }));
  };

  const updateLetterSection = (field: keyof SiteContent["letterSection"], value: string) => {
    setDraft((current) => ({
      ...current,
      letterSection: { ...current.letterSection, [field]: value },
    }));
  };

  const updateRulesSection = (field: keyof SiteContent["rulesSection"], value: string) => {
    setDraft((current) => ({
      ...current,
      rulesSection: { ...current.rulesSection, [field]: value },
    }));
  };

  const updateRulesListItem = (index: number, value: string) => {
    setDraft((current) => ({
      ...current,
      rulesSection: {
        ...current.rulesSection,
        rulesList: current.rulesSection.rulesList.map((item, idx) =>
          idx === index ? value : item,
        ),
      },
    }));
  };

  const addRulesListItem = () => {
    setDraft((current) => ({
      ...current,
      rulesSection: {
        ...current.rulesSection,
        rulesList: [...current.rulesSection.rulesList, "Peraturan baru"],
      },
    }));
  };

  const removeRulesListItem = (index: number) => {
    setDraft((current) => ({
      ...current,
      rulesSection: {
        ...current.rulesSection,
        rulesList: current.rulesSection.rulesList.filter((_, idx) => idx !== index),
      },
    }));
  };

  const updateFaqSection = (field: keyof SiteContent["faq"], value: string) => {
    setDraft((current) => ({ ...current, faq: { ...current.faq, [field]: value } }));
  };

  const updateCta = (field: keyof SiteContent["cta"], value: string) => {
    setDraft((current) => ({ ...current, cta: { ...current.cta, [field]: value } }));
  };

  const updateFooter = (field: keyof SiteContent["footer"], value: string) => {
    setDraft((current) => ({ ...current, footer: { ...current.footer, [field]: value } }));
  };

  const save = async () => {
    const payload = normalizeLandingContentForSave(draft);
    const emptyPointsIndex = payload.quickInfo.cards.findIndex((card) => card.points.length === 0);
    if (emptyPointsIndex !== -1) {
      setError(`Kartu ${emptyPointsIndex + 1} harus punya minimal satu poin.`);
      return;
    }

    const tooManyPointsIndex = payload.quickInfo.cards.findIndex(
      (card) => card.points.length > MAX_LANDING_QUICK_POINTS,
    );
    if (tooManyPointsIndex !== -1) {
      setError(`Kartu ${tooManyPointsIndex + 1} maksimal ${MAX_LANDING_QUICK_POINTS} poin.`);
      return;
    }

    const tooLongPointIndex = payload.quickInfo.cards.findIndex((card) =>
      card.points.some((point) => point.length > MAX_LANDING_QUICK_POINT_LENGTH),
    );
    if (tooLongPointIndex !== -1) {
      setError(
        `Kartu ${tooLongPointIndex + 1} punya poin lebih dari ${MAX_LANDING_QUICK_POINT_LENGTH} karakter.`,
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const data = await updateAdminSiteContent(payload);
      setDraft(data);
      onChange?.(data);
      setSavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(Object.values(err.errors)[0]?.[0] ?? "Validasi gagal.");
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Gagal menyimpan konten landing page.");
      }
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedChanges =
    JSON.stringify(normalizeLandingContentForSave(draft)) !==
    JSON.stringify(normalizeLandingContentForSave(content));
  const saveStatus = saving
    ? "Menyimpan perubahan..."
    : error
      ? error
      : hasUnsavedChanges
        ? "Ada perubahan belum disimpan."
        : savedAt
          ? `Tersimpan pukul ${savedAt}.`
          : null;
  const saveStatusClass = saving ? "saving" : error ? "error" : hasUnsavedChanges ? "dirty" : "saved";

  return (
    <div className="admin-cms-page admin-landing-page">
      <div className="admin-heading">
        <div>
          <h1>Landing Page</h1>
          <p>Navbar, section utama, video, CTA, dan footer publik.</p>
        </div>
        <div className="admin-landing-save-actions">
          {saveStatus && (
            <small
              className={`admin-save-status admin-save-status--${saveStatusClass}`}
              role="status"
              aria-live="polite"
            >
              {saveStatus}
            </small>
          )}
          <button type="button" className="button button-primary" onClick={save} disabled={saving}>
            {saving ? <ButtonSpinner label="Menyimpan..." /> : "Simpan perubahan"}
          </button>
        </div>
      </div>

      <section className="admin-card">
        <AdminLandingSectionHead title="Navbar" actionLabel="Tambah menu" onAction={addNavItem} />
        <div className="admin-cms-form">
          <div className="admin-cms-link">
            <label className="form-field">
              <span>Logo</span>
              <input value={draft.nav.logoSrc} onChange={(event) => updateNav("logoSrc", event.target.value)} />
            </label>
            <label className="form-field">
              <span>Alt logo</span>
              <input value={draft.nav.logoAlt} onChange={(event) => updateNav("logoAlt", event.target.value)} />
            </label>
          </div>
          <div className="admin-cms-link">
            <label className="form-field">
              <span>Teks logo</span>
              <input value={draft.nav.brandText} onChange={(event) => updateNav("brandText", event.target.value)} />
            </label>
            <label className="form-field">
              <span>Tombol CTA</span>
              <input value={draft.nav.ctaLabel} onChange={(event) => updateNav("ctaLabel", event.target.value)} />
            </label>
          </div>
          <div className="admin-landing-list">
            {draft.nav.items.map((item, index) => (
              <div className="admin-landing-inline-row" key={`${item.label}-${index}`}>
                <label className="form-field">
                  <span>Label</span>
                  <input value={item.label} onChange={(event) => updateNavItem(index, "label", event.target.value)} />
                </label>
                <label className="form-field">
                  <span>Target</span>
                  <input value={item.target} onChange={(event) => updateNavItem(index, "target", event.target.value)} />
                </label>
                <button
                  type="button"
                  className="admin-icon-btn admin-icon-btn--danger"
                  onClick={() => removeNavItem(index)}
                  disabled={draft.nav.items.length <= 1}
                  aria-label="Hapus menu"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-card">
        <AdminLandingSectionHead title="Sebelum booking" actionLabel="Tambah kartu" onAction={addQuickCard} />
        <div className="admin-cms-form">
          <label className="form-field">
            <span>Judul section</span>
            <input value={draft.quickInfo.title} onChange={(event) => updateQuickInfo("title", event.target.value)} />
          </label>
          <label className="form-field">
            <span>Deskripsi</span>
            <textarea rows={2} value={draft.quickInfo.description} onChange={(event) => updateQuickInfo("description", event.target.value)} />
          </label>
          <div className="admin-landing-list">
            {draft.quickInfo.cards.map((card, index) => (
              <article className="admin-landing-subcard" key={`${card.title}-${index}`}>
                <div className="admin-landing-subcard-head">
                  <strong>Kartu {index + 1}</strong>
                  <button
                    type="button"
                    className="admin-icon-btn admin-icon-btn--danger"
                    onClick={() => removeQuickCard(index)}
                    disabled={draft.quickInfo.cards.length <= 1}
                    aria-label="Hapus kartu"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <LandingIconSelect value={card.iconKey} onChange={(value) => updateQuickCard(index, "iconKey", value)} />
                <label className="form-field">
                  <span>Judul</span>
                  <input value={card.title} onChange={(event) => updateQuickCard(index, "title", event.target.value)} />
                </label>
                <label className="form-field">
                  <span>Deskripsi</span>
                  <textarea rows={2} value={card.body} onChange={(event) => updateQuickCard(index, "body", event.target.value)} />
                </label>
                <label className="form-field">
                  <span>Poin (satu baris satu poin)</span>
                  <textarea rows={3} value={card.points.join("\n")} onChange={(event) => updateQuickPoints(index, event.target.value)} />
                </label>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-card">
        <AdminLandingSectionHead title="Jadwal Kunjungan" />
        <div className="admin-cms-form">
          <label className="form-field">
            <span>Judul section</span>
            <input value={draft.schedule.title} onChange={(event) => updateSchedule("title", event.target.value)} />
          </label>
          <label className="form-field">
            <span>Deskripsi</span>
            <textarea rows={2} value={draft.schedule.description} onChange={(event) => updateSchedule("description", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="admin-card">
        <AdminLandingSectionHead title="Video virtual" />
        <div className="admin-cms-link">
          <label className="form-field">
            <span>Judul iframe</span>
            <input value={draft.video.title} onChange={(event) => updateVideo("title", event.target.value)} />
          </label>
          <label className="form-field">
            <span>Link video</span>
            <input value={draft.video.url} onChange={(event) => updateVideo("url", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="admin-card">
        <AdminLandingSectionHead title="Booking dalam 4 langkah" actionLabel="Tambah langkah" onAction={addStepCard} />
        <div className="admin-cms-form">
          <label className="form-field">
            <span>Judul section</span>
            <input value={draft.bookingSteps.title} onChange={(event) => updateBookingSteps("title", event.target.value)} />
          </label>
          <label className="form-field">
            <span>Teks scroll</span>
            <textarea rows={2} value={draft.bookingSteps.story} onChange={(event) => updateBookingSteps("story", event.target.value)} />
          </label>
          <div className="admin-landing-list">
            {draft.bookingSteps.cards.map((card, index) => (
              <article className="admin-landing-subcard" key={`${card.title}-${index}`}>
                <div className="admin-landing-subcard-head">
                  <strong>Langkah {index + 1}</strong>
                  <button
                    type="button"
                    className="admin-icon-btn admin-icon-btn--danger"
                    onClick={() => removeStepCard(index)}
                    disabled={draft.bookingSteps.cards.length <= 1}
                    aria-label="Hapus langkah"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <LandingIconSelect value={card.iconKey} onChange={(value) => updateStepCard(index, "iconKey", value)} />
                <label className="form-field">
                  <span>Judul</span>
                  <input value={card.title} onChange={(event) => updateStepCard(index, "title", event.target.value)} />
                </label>
                <label className="form-field">
                  <span>Deskripsi</span>
                  <textarea rows={2} value={card.body} onChange={(event) => updateStepCard(index, "body", event.target.value)} />
                </label>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-card">
        <AdminLandingSectionHead title="Aktivitas di Istana" actionLabel="Tambah aktivitas" onAction={addActivity} />
        <div className="admin-cms-form">
          <label className="form-field">
            <span>Judul section</span>
            <input value={draft.activities.title} onChange={(event) => updateActivities("title", event.target.value)} />
          </label>
          <label className="form-field">
            <span>Deskripsi</span>
            <textarea rows={2} value={draft.activities.description} onChange={(event) => updateActivities("description", event.target.value)} />
          </label>
          <div className="admin-landing-list">
            {draft.activities.items.map((item, index) => (
              <article className="admin-landing-subcard" key={`${item.title}-${index}`}>
                <div className="admin-landing-subcard-head">
                  <strong>Panel {index + 1}</strong>
                  <button
                    type="button"
                    className="admin-icon-btn admin-icon-btn--danger"
                    onClick={() => removeActivity(index)}
                    disabled={draft.activities.items.length <= 1}
                    aria-label="Hapus aktivitas"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <label className="form-field">
                  <span>Judul</span>
                  <input value={item.title} onChange={(event) => updateActivity(index, "title", event.target.value)} />
                </label>
                <label className="form-field">
                  <span>Deskripsi</span>
                  <textarea rows={2} value={item.body} onChange={(event) => updateActivity(index, "body", event.target.value)} />
                </label>
                <label className="form-field">
                  <span>Gambar</span>
                  <input value={item.image} onChange={(event) => updateActivity(index, "image", event.target.value)} />
                </label>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-card">
        <AdminLandingSectionHead title="Contoh surat" />
        <div className="admin-cms-form">
          <label className="form-field">
            <span>Judul section</span>
            <input value={draft.letterSection.title} onChange={(event) => updateLetterSection("title", event.target.value)} />
          </label>
          <label className="form-field">
            <span>Deskripsi</span>
            <textarea rows={2} value={draft.letterSection.description} onChange={(event) => updateLetterSection("description", event.target.value)} />
          </label>
          <div className="admin-cms-link">
            <label className="form-field">
              <span>Kicker format</span>
              <input value={draft.letterSection.formatKicker} onChange={(event) => updateLetterSection("formatKicker", event.target.value)} />
            </label>
            <label className="form-field">
              <span>Judul format</span>
              <input value={draft.letterSection.formatTitle} onChange={(event) => updateLetterSection("formatTitle", event.target.value)} />
            </label>
          </div>
          <div className="admin-cms-link">
            <label className="form-field">
              <span>Catatan upload</span>
              <input value={draft.letterSection.uploadNote} onChange={(event) => updateLetterSection("uploadNote", event.target.value)} />
            </label>
            <label className="form-field">
              <span>Tombol</span>
              <input value={draft.letterSection.buttonLabel} onChange={(event) => updateLetterSection("buttonLabel", event.target.value)} />
            </label>
          </div>
        </div>
      </section>

      <section className="admin-card">
        <AdminLandingSectionHead title="Peraturan Kunjungan" />
        <div className="admin-cms-form">
          <label className="form-field">
            <span>Judul section</span>
            <input value={draft.rulesSection.title} onChange={(event) => updateRulesSection("title", event.target.value)} />
          </label>
          <label className="form-field">
            <span>Deskripsi</span>
            <textarea rows={2} value={draft.rulesSection.description} onChange={(event) => updateRulesSection("description", event.target.value)} />
          </label>
          <div className="admin-cms-link">
            <label className="form-field">
              <span>Kicker tata tertib</span>
              <input value={draft.rulesSection.rulesKicker} onChange={(event) => updateRulesSection("rulesKicker", event.target.value)} />
            </label>
            <label className="form-field">
              <span>Judul tata tertib</span>
              <input value={draft.rulesSection.rulesTitle} onChange={(event) => updateRulesSection("rulesTitle", event.target.value)} />
            </label>
          </div>
          <label className="form-field">
            <span>Tombol CTA</span>
            <input value={draft.rulesSection.buttonLabel} onChange={(event) => updateRulesSection("buttonLabel", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="admin-card">
        <AdminLandingSectionHead title="FAQ section" />
        <div className="admin-cms-form">
          <label className="form-field">
            <span>Judul section</span>
            <input value={draft.faq.title} onChange={(event) => updateFaqSection("title", event.target.value)} />
          </label>
          <label className="form-field">
            <span>Deskripsi</span>
            <textarea rows={2} value={draft.faq.description} onChange={(event) => updateFaqSection("description", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="admin-card">
        <AdminLandingSectionHead title="CTA booking" />
        <div className="admin-cms-form">
          <label className="form-field">
            <span>Judul</span>
            <input value={draft.cta.title} onChange={(event) => updateCta("title", event.target.value)} />
          </label>
          <label className="form-field">
            <span>Deskripsi</span>
            <textarea rows={2} value={draft.cta.body} onChange={(event) => updateCta("body", event.target.value)} />
          </label>
          <div className="admin-cms-link">
            <label className="form-field">
              <span>Teks tombol</span>
              <input value={draft.cta.buttonLabel} onChange={(event) => updateCta("buttonLabel", event.target.value)} />
            </label>
            <label className="form-field">
              <span>Gambar background</span>
              <input value={draft.cta.backgroundImage} onChange={(event) => updateCta("backgroundImage", event.target.value)} />
            </label>
          </div>
        </div>
      </section>

      <section className="admin-card">
        <AdminLandingSectionHead title="Footer" />
        <div className="admin-cms-form">
          <div className="admin-cms-link">
            <label className="form-field">
              <span>Logo footer</span>
              <input value={draft.footer.logoSrc} onChange={(event) => updateFooter("logoSrc", event.target.value)} />
            </label>
            <label className="form-field">
              <span>Alt logo</span>
              <input value={draft.footer.logoAlt} onChange={(event) => updateFooter("logoAlt", event.target.value)} />
            </label>
          </div>
          <div className="admin-cms-link">
            <label className="form-field">
              <span>Label jadwal</span>
              <input value={draft.footer.scheduleLabel} onChange={(event) => updateFooter("scheduleLabel", event.target.value)} />
            </label>
            <label className="form-field">
              <span>Hari buka</span>
              <input value={draft.footer.scheduleDays} onChange={(event) => updateFooter("scheduleDays", event.target.value)} />
            </label>
          </div>
          <label className="form-field">
            <span>Jam buka</span>
            <input value={draft.footer.scheduleHours} onChange={(event) => updateFooter("scheduleHours", event.target.value)} />
          </label>
          <div className="admin-cms-link">
            <label className="form-field">
              <span>Link Google Maps</span>
              <input value={draft.footer.mapUrl} onChange={(event) => updateFooter("mapUrl", event.target.value)} />
            </label>
            <label className="form-field">
              <span>Embed map</span>
              <input value={draft.footer.mapEmbedUrl} onChange={(event) => updateFooter("mapEmbedUrl", event.target.value)} />
            </label>
          </div>
          <label className="form-field">
            <span>Detail lokasi</span>
            <textarea rows={2} value={draft.footer.address} onChange={(event) => updateFooter("address", event.target.value)} />
          </label>
          <label className="form-field">
            <span>Copyright</span>
            <input value={draft.footer.copyright} onChange={(event) => updateFooter("copyright", event.target.value)} />
          </label>
        </div>
      </section>

      {error && <p className="admin-form-error">{error}</p>}
      {savedAt && <small className="admin-cms-saved">Tersimpan terakhir pukul {savedAt}.</small>}
    </div>
  );
}

function AdminLandingSectionHead({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <header className="admin-card-head">
      <div>
        <h2>{title}</h2>
      </div>
      {actionLabel && onAction && (
        <button type="button" className="admin-card-link" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </header>
  );
}

function LandingIconSelect({
  value,
  onChange,
}: {
  value: LandingIconKey;
  onChange: (value: LandingIconKey) => void;
}) {
  return (
    <label className="form-field">
      <span>Ikon</span>
      <select value={value} onChange={(event) => onChange(event.target.value as LandingIconKey)}>
        {LANDING_ICON_OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
