---
name: review-pr
description: >
  Gunakan untuk review GitHub PR terhadap issue markdown/plan: cek scope, correctness,
  regression risk, maintainability, security/data risk, dan kecukupan test. Posting satu
  komentar final biasa ke PR via GitHub CLI, bukan formal approve/request changes.
---

# Review PR untuk Antigravity

Skill ini dipakai saat user meminta review PR siap ditinjau dan komentar final dipost ke PR.

## Aturan

- Issue markdown/plan adalah acuan scope utama.
- Lead with findings: bug, risiko regresi, blocker, test gap.
- Pisahkan blocker, saran opsional, catatan kecil.
- Jangan gunakan GitHub formal approval/review state. Posting komentar biasa saja.
- Jika lolos, komentar final wajib diawali `✅ Approve`.
- Jika belum lolos, jangan tulis approve.
- Jaga komentar PR singkat, konkret, dan actionable.

## Workflow

1. Baca issue markdown/plan dan konteks PR.
2. Ambil diff dan file berubah.
3. Cek scope vs issue.
4. Cek correctness dan regression risk, terutama auth, data penting, file handling, integration, business logic, shared utility.
5. Cek test: apakah verifikasi benar-benar menutup perilaku yang berubah.
6. Jalankan test/lint relevan jika aman dan diminta/masuk akal.
7. Susun satu komentar final.
8. Post dengan GitHub CLI:
   - `gh pr comment <pr> --body-file <file>` untuk multiline.
   - Jika gagal auth/network, tampilkan komentar final sebagai fallback.

## Template Belum Lolos

```markdown
Saya sudah review PR ini terhadap [issue markdown] dan perubahan terbaru di branch ini.

Masih ada beberapa hal yang perlu dibereskan sebelum lanjut:

- **Blocker:** ...

Verifikasi / test yang masih perlu perhatian:
- ...

Tindak lanjut yang saya sarankan:
- ...

Setelah itu, saya review ulang lagi.
```

## Template Lolos

```markdown
✅ Approve

Saya sudah review PR ini terhadap [issue markdown] dan perubahan terbaru di branch ini.

Hasilnya:
- Tidak ada blocker utama yang tersisa
- Perubahan tetap sesuai scope
- Risiko regresi utama sudah tertangani / tidak ada isu mayor yang tersisa
- Verifikasi yang relevan sudah memadai

Verifikasi yang saya cek:
- `...`

PR ini aman untuk dilanjutkan ke tahap merge jika tidak ada konteks tambahan di luar thread ini.
```

