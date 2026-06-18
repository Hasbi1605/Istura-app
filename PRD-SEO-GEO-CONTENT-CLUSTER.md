# PRD SEO/GEO Content Cluster ISTURA

Tanggal: 2026-06-18
Status: Siap implementasi
Scope: dokumentasi eksekusi untuk 7 halaman info server-rendered
Target pembaca: model AI eksekutor yang lebih murah, developer Laravel/React, reviewer

## 1. Ringkasan

`isturaiky.page` sudah mulai muncul untuk kueri brand `istura`, tetapi belum kuat untuk kueri non-brand seperti `gedung agung`, `gedung agung yogyakarta`, `istana yogyakarta`, `istana jogja`, `museum istana kepresidenan yogyakarta`, `wisata edukasi gratis jogja`, dan variasi museum/wisata gratis. Masalah utamanya bukan lagi indexing dasar, melainkan:

- intent halaman utama masih terlalu berat ke booking/brand ISTURA;
- jumlah URL publik di sitemap masih terlalu sedikit;
- belum ada halaman server-rendered yang menjawab intent non-brand satu per satu;
- otoritas domain baru masih kalah dari domain pemerintah, profil tempat, Instagram, dan situs wisata lama.

Solusi fase ini adalah membuat 7 halaman info yang benar-benar terlihat untuk user, server-rendered, masuk sitemap, punya metadata unik, punya internal link dari halaman publik, dan punya structured data yang aman. Halaman ini bukan halaman tersembunyi untuk Google. Semua halaman harus bisa dibuka dan dibaca oleh user biasa.

## 2. Tujuan Produk

1. Menambah cakupan kueri non-brand tanpa mengganggu flow booking.
2. Membantu Google Search, AI Overview, Gemini, ChatGPT Search, dan crawler retrieval lain memahami relasi entitas:
   - ISTURA;
   - Istana Untuk Rakyat;
   - Gedung Agung Yogyakarta;
   - Istana Kepresidenan Yogyakarta;
   - Museum Istana Kepresidenan Yogyakarta;
   - wisata edukasi gratis di Jogja;
   - booking kunjungan resmi melalui ISTURA.
3. Memberi jawaban yang jelas untuk user yang belum tahu ISTURA tetapi mencari Gedung Agung, Istana Yogyakarta, museum, atau wisata edukasi gratis.
4. Menambah halaman yang dapat diinspeksi di Google Search Console dan dimonitor per kueri.

## 3. Non-Tujuan

Jangan lakukan hal berikut pada implementasi PRD ini:

- Jangan mengubah flow booking publik.
- Jangan mengubah admin, API booking, feedback, jadwal, Istura Open, auth, 2FA, atau realtime.
- Jangan membuat full SSR untuk seluruh React SPA.
- Jangan membuat halaman khusus crawler yang tidak terlihat user.
- Jangan menyembunyikan konten utama di `<noscript>` saja.
- Jangan keyword stuffing di homepage.
- Jangan membuat halaman tipis/duplikat untuk setiap variasi keyword.
- Jangan membuat CMS editor untuk halaman info pada fase ini.
- Jangan menambahkan halaman opsional `/info/museum-jogja-gratis` pada fase ini.
- Jangan mengubah atau mengembalikan `PRD-ISTURA-APP-EN.md` bila file itu sedang terhapus di worktree user.

## 4. Bukti Kondisi Saat Ini

Sumber bukti dari repo saat dokumen ini dibuat:

- `routes/web.php` sudah punya route server-rendered `/info/alur-kunjungan` sebelum catch-all SPA.
- `routes/web.php` masih menyerahkan rute non-API lain ke view `app` React SPA.
- `app/Support/SeoMeta.php` sudah menyediakan:
  - canonical URL;
  - robots.txt policy untuk search dan AI retrieval;
  - sitemap XML;
  - metadata homepage;
  - structured data JSON-LD dengan escaping aman.
- `SeoMeta::sitemapXml()` saat ini hanya memuat:
  - `/`;
  - `/info/alur-kunjungan`.
- `resources/views/info/visit-flow.blade.php` membuktikan pola halaman info server-rendered sudah ada dan tidak perlu bundle React.
- `tests/Feature/SeoMetadataTest.php` sudah menjadi tempat test SEO, robots, sitemap, canonical, dan halaman info.

Bukti dari Search Console yang diberikan user:

- `istura` sudah mendapat klik.
- Query non-brand seperti `gedung agung`, `gedung agung yogyakarta`, `istana yogyakarta`, `istana jogja`, dan `istura adalah` sudah punya impresi tetapi klik masih 0.
- Ini menunjukkan Google mulai menguji relevansi domain, tetapi belum ada landing page yang cukup tepat untuk intent tersebut.

## 5. Prinsip Implementasi

1. Halaman harus user-facing.
   Konten utama harus ada di HTML awal, dapat dibaca user, dan bukan cloaking.

2. Server-rendered cukup untuk halaman info.
   Gunakan Blade seperti `/info/alur-kunjungan`. Jangan ubah seluruh SPA menjadi SSR.

3. Satu halaman untuk satu intent.
   Bedakan intent "cara daftar", "jadwal", "syarat", "Gedung Agung", "Istana Kepresidenan", "museum", dan "wisata edukasi gratis".

4. Data statis dulu.
   Gunakan config/array PHP, bukan database/CMS, agar scope kecil dan mudah dites.

5. Internal link wajib.
   Sitemap saja tidak cukup. Tambahkan link publik yang terlihat dari homepage/footer.

6. Unknown `/info/{slug}` harus 404.
   Jangan biarkan slug info yang salah jatuh ke homepage SPA karena itu membingungkan crawler dan user.

7. Pertahankan escaping JSON-LD.
   Semua JSON-LD baru harus memakai flag `JSON_HEX_TAG`, `JSON_HEX_AMP`, `JSON_HEX_APOS`, dan `JSON_HEX_QUOT`.

## 6. Daftar Halaman Final

Implementasikan tepat 7 halaman berikut.

### 6.1 `/info/cara-daftar-istura`

Target intent:
User ingin tahu cara daftar, booking, atau mendaftar ISTURA.

Target query:
- `cara daftar istura`
- `booking istura`
- `pendaftaran istura`
- `istura adalah`
- `cara booking gedung agung`

Title:
`Cara Daftar ISTURA Yogyakarta: Alur Booking Gedung Agung`

Meta description:
`Panduan cara daftar ISTURA Yogyakarta untuk kunjungan Gedung Agung: cek jadwal, siapkan surat permohonan, isi data, dan tunggu konfirmasi admin.`

H1:
`Cara Daftar ISTURA Yogyakarta`

Section wajib:
1. Apa itu ISTURA.
2. Siapa yang dapat mendaftar.
3. Langkah booking kunjungan.
4. Dokumen dan data yang perlu disiapkan.
5. Setelah formulir dikirim.
6. Link ke jadwal, syarat, alur kunjungan, dan CTA booking.

FAQ wajib:
- Apakah daftar ISTURA berbayar?
- Apakah harus memakai surat permohonan?
- Apakah bisa memilih tanggal kunjungan sendiri?
- Setelah daftar, kapan mendapat konfirmasi?

CTA utama:
`Mulai Booking ISTURA` menuju `/#booking` bila anchor tersedia, atau `/` bila aplikasi memakai state navigation.

Structured data:
- `BreadcrumbList`
- `FAQPage`
- `HowTo` hanya bila langkah dibuat stabil, ringkas, dan tidak misleading.

### 6.2 `/info/jadwal-kunjungan-istura`

Target intent:
User ingin tahu jadwal, slot, hari buka, dan cara mengecek ketersediaan.

Target query:
- `jadwal kunjungan istura`
- `jadwal istura yogyakarta`
- `jadwal kunjungan gedung agung`
- `jam kunjungan istura`
- `cek slot istura`

Title:
`Jadwal Kunjungan ISTURA Yogyakarta dan Cek Slot Gedung Agung`

Meta description:
`Lihat panduan jadwal kunjungan ISTURA Yogyakarta, cara cek slot Gedung Agung, jam kunjungan, hari tersedia, dan batas waktu booking online.`

H1:
`Jadwal Kunjungan ISTURA Yogyakarta`

Section wajib:
1. Cara membaca jadwal kunjungan.
2. Jam kunjungan umum.
3. Cara cek slot tersedia.
4. Batas booking dan catatan tanggal tutup.
5. Apa yang terjadi bila slot penuh.
6. Link ke cara daftar, syarat, dan CTA cek jadwal.

FAQ wajib:
- Kapan kalender ISTURA dibuka?
- Bagaimana cara tahu slot masih tersedia?
- Apakah jadwal bisa berubah?
- Bagaimana jika tanggal yang diinginkan penuh?

CTA utama:
`Cek Jadwal Kunjungan` menuju homepage/booking flow.

Structured data:
- `BreadcrumbList`
- `FAQPage`

### 6.3 `/info/syarat-kunjungan-istura`

Target intent:
User ingin tahu syarat, dokumen, tata tertib, dan format surat.

Target query:
- `syarat kunjungan istura`
- `syarat kunjungan gedung agung`
- `surat permohonan istura`
- `tata tertib istura`
- `dokumen booking istura`

Title:
`Syarat Kunjungan ISTURA Gedung Agung Yogyakarta`

Meta description:
`Rangkuman syarat kunjungan ISTURA Gedung Agung Yogyakarta: surat permohonan, data rombongan, contact person, tata tertib, dan upload dokumen.`

H1:
`Syarat Kunjungan ISTURA`

Section wajib:
1. Syarat utama pendaftaran.
2. Surat permohonan kunjungan.
3. Data contact person dan rombongan.
4. Aturan umum selama kunjungan.
5. Format upload dokumen.
6. Link ke alur kunjungan dan cara daftar.

FAQ wajib:
- Apa saja syarat utama kunjungan ISTURA?
- Apakah surat permohonan wajib?
- Format file apa yang dapat diunggah?
- Apakah peserta perorangan bisa ikut?

CTA utama:
`Lihat Cara Daftar`

Structured data:
- `BreadcrumbList`
- `FAQPage`

### 6.4 `/info/gedung-agung-yogyakarta`

Target intent:
User mencari entitas/tempat Gedung Agung, bukan hanya aplikasi booking.

Target query:
- `gedung agung`
- `gedung agung yogyakarta`
- `gedung agung jogja`
- `kunjungan gedung agung`
- `booking gedung agung`

Title:
`Gedung Agung Yogyakarta: Kunjungan ISTURA dan Cara Booking`

Meta description:
`Gedung Agung Yogyakarta adalah Istana Kepresidenan Yogyakarta. Ketahui lokasi, kunjungan edukasi, museum, dan cara booking melalui ISTURA.`

H1:
`Gedung Agung Yogyakarta`

Section wajib:
1. Apa itu Gedung Agung Yogyakarta.
2. Hubungan Gedung Agung dengan Istana Kepresidenan Yogyakarta.
3. Kunjungan masyarakat melalui ISTURA.
4. Lokasi dan akses umum.
5. Museum dan pengalaman edukasi.
6. Cara booking kunjungan Gedung Agung.
7. Disclaimer halus: halaman ini adalah panduan kunjungan ISTURA, bukan situs institusional utama.

FAQ wajib:
- Apakah Gedung Agung bisa dikunjungi masyarakat?
- Apakah kunjungan Gedung Agung berbayar?
- Bagaimana cara daftar kunjungan Gedung Agung?
- Apakah Gedung Agung sama dengan Istana Kepresidenan Yogyakarta?

CTA utama:
`Booking Kunjungan Gedung Agung`

Structured data:
- `BreadcrumbList`
- `FAQPage`
- `TouristAttraction`
- `Place`

Catatan keyword:
Halaman ini harus mencakup query `gedung agung` tanpa harus membuat slug `/info/gedung-agung`. Pakai frase "Gedung Agung" secara natural di title, H1, paragraf pembuka, FAQ, dan internal anchor. Jangan mengulang frase secara paksa.

### 6.5 `/info/istana-kepresidenan-yogyakarta`

Target intent:
User mencari Istana Kepresidenan Yogyakarta, Istana Yogyakarta, atau Istana Presiden Jogja.

Target query:
- `istana kepresidenan yogyakarta`
- `istana yogyakarta`
- `istana jogja`
- `istana presiden jogja`
- `kunjungan istana yogyakarta`

Title:
`Istana Kepresidenan Yogyakarta: Kunjungan Gedung Agung via ISTURA`

Meta description:
`Panduan kunjungan Istana Kepresidenan Yogyakarta atau Gedung Agung melalui ISTURA, termasuk jadwal, syarat, lokasi, dan cara daftar online.`

H1:
`Istana Kepresidenan Yogyakarta`

Section wajib:
1. Penjelasan Istana Kepresidenan Yogyakarta/Gedung Agung.
2. Kunjungan masyarakat melalui program ISTURA.
3. Lokasi dan konteks kawasan.
4. Jadwal, syarat, dan alur booking.
5. Hubungan dengan halaman Gedung Agung, museum, dan cara daftar.

FAQ wajib:
- Apakah Istana Kepresidenan Yogyakarta bisa dikunjungi?
- Apa hubungan Istana Kepresidenan Yogyakarta dan Gedung Agung?
- Apakah harus daftar sebelum datang?
- Apa saja yang perlu disiapkan?

CTA utama:
`Daftar Kunjungan Istana Yogyakarta`

Structured data:
- `BreadcrumbList`
- `FAQPage`
- `TouristAttraction` atau `GovernmentBuilding` bila struktur schema dibuat eksplisit.

### 6.6 `/info/museum-istana-kepresidenan-yogyakarta`

Target intent:
User mencari museum di area Istana/Gedung Agung dan pengalaman edukasi.

Target query:
- `museum istana kepresidenan yogyakarta`
- `museum gedung agung`
- `museum istana jogja`
- `museum kepresidenan yogyakarta`
- `museum jogja`

Title:
`Museum Istana Kepresidenan Yogyakarta di Gedung Agung`

Meta description:
`Kenali Museum Istana Kepresidenan Yogyakarta di kawasan Gedung Agung, pengalaman edukasi yang bisa dikunjungi melalui pendaftaran ISTURA.`

H1:
`Museum Istana Kepresidenan Yogyakarta`

Section wajib:
1. Museum sebagai bagian dari pengalaman kunjungan ISTURA.
2. Apa yang dapat dipelajari pengunjung secara umum.
3. Apakah kunjungan gratis.
4. Apakah bisa datang langsung atau harus daftar.
5. Cocok untuk sekolah, komunitas, keluarga, dan wisata edukasi.
6. Link ke jadwal, syarat, Gedung Agung, dan cara daftar.

FAQ wajib:
- Apakah Museum Istana Kepresidenan Yogyakarta bisa dikunjungi umum?
- Apakah museum ini gratis?
- Apakah harus daftar melalui ISTURA?
- Cocok untuk siapa kunjungan museum ini?

CTA utama:
`Cek Jadwal Museum melalui ISTURA`

Structured data:
- `BreadcrumbList`
- `FAQPage`
- `Museum` atau `TouristAttraction`

Catatan keyword:
Halaman ini boleh membantu query broad seperti `museum jogja`, tetapi jangan menulis seolah-olah ini direktori semua museum Jogja. Fokus tetap pada museum di kawasan Istana/Gedung Agung.

### 6.7 `/info/wisata-edukasi-gratis-jogja`

Target intent:
User mencari aktivitas wisata edukasi/sejarah gratis di Jogja.

Target query:
- `wisata edukasi gratis jogja`
- `wisata sejarah gratis jogja`
- `wisata gratis jogja`
- `museum jogja gratis`
- `museum gratis jogja`
- `kunjungan edukasi gedung agung`

Title:
`Wisata Edukasi Gratis di Jogja: Kunjungan Gedung Agung ISTURA`

Meta description:
`ISTURA menjadi pilihan wisata edukasi gratis di Jogja melalui kunjungan Gedung Agung. Pelajari syarat, jadwal, dan cara daftar kunjungan.`

H1:
`Wisata Edukasi Gratis di Jogja`

Section wajib:
1. Gedung Agung sebagai opsi wisata edukasi gratis melalui ISTURA.
2. Gratis tetapi tetap harus mengikuti alur pendaftaran.
3. Cocok untuk sekolah, instansi, komunitas, dan keluarga.
4. Pengalaman edukasi: sejarah, tata tertib, dan museum.
5. Cara merencanakan kunjungan.
6. Link ke museum, jadwal, syarat, dan cara daftar.

FAQ wajib:
- Apakah ISTURA termasuk wisata edukasi gratis di Jogja?
- Apakah bisa datang langsung tanpa daftar?
- Apakah cocok untuk rombongan sekolah?
- Apa yang perlu disiapkan sebelum kunjungan?

CTA utama:
`Rencanakan Kunjungan Edukasi`

Structured data:
- `BreadcrumbList`
- `FAQPage`
- `TouristAttraction`

Catatan keyword:
Halaman ini menjadi jembatan untuk query `wisata jogja`, `wisata gratis jogja`, dan `museum jogja gratis`, tetapi jangan menarget terlalu luas seperti artikel daftar rekomendasi tempat wisata Jogja. Tetap kaitkan ke ISTURA/Gedung Agung.

## 7. Halaman yang Sengaja Tidak Dibuat Sekarang

Jangan buat halaman ini pada fase pertama:

- `/info/museum-jogja-gratis`

Alasan:

- Intent terlalu dekat dengan `/info/wisata-edukasi-gratis-jogja` dan `/info/museum-istana-kepresidenan-yogyakarta`.
- Risiko thin/duplicate content tinggi bila dibuat sebelum data Search Console menunjukkan impresi cukup.
- Bisa dievaluasi ulang 14-28 hari setelah 7 halaman utama terindeks.

## 8. Kontrak Konten Per Halaman

Setiap halaman wajib punya elemen berikut:

- `<title>` unik.
- `<meta name="description">` unik.
- `<link rel="canonical">` sesuai URL halaman.
- `og:title`, `og:description`, `og:url`, `og:image`.
- `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`.
- Satu `<h1>`.
- Minimal 4 section dengan `<h2>`.
- Minimal 3 FAQ.
- Link internal ke minimal 3 halaman info lain yang relevan.
- Link balik ke homepage/booking.
- Structured data JSON-LD.
- Konten utama berada di `<main>` dan terlihat tanpa JavaScript.

Konten tidak boleh:

- Berisi klaim bahwa `isturaiky.page` adalah situs institusional utama Gedung Agung/Setneg bila itu tidak dibuktikan di repo.
- Mengatakan semua orang bisa datang langsung bila flow membutuhkan pendaftaran.
- Menggunakan teks keyword berulang tanpa konteks.
- Menyalin paragraf yang sama mentah-mentah antar halaman.
- Menyembunyikan paragraf untuk crawler saja.

## 9. Rancangan Teknis

### 9.1 File yang Dibuat

Tambahkan:

- `config/seo_pages.php`
- `resources/views/info/seo-page.blade.php`

Opsional bila style existing belum cukup:

- update `public/assets/info-page.css`

### 9.2 File yang Diubah

Ubah:

- `routes/web.php`
- `app/Support/SeoMeta.php`
- `tests/Feature/SeoMetadataTest.php`
- `resources/js/components/layout/Footer.tsx` atau lokasi homepage/footer yang paling natural untuk internal link
- `resources/js/styles.css` bila internal link footer/homepage butuh styling
- `AGENTS.md` untuk changelog

Jangan ubah kecuali benar-benar diperlukan:

- `resources/js/App.tsx`
- `resources/js/components/booking/*`
- `resources/js/components/admin/*`
- `routes/api.php`
- migration/database
- service booking/jadwal

## 10. Struktur Data yang Disarankan

Gunakan `config/seo_pages.php` agar data mudah dites dan tidak mengikat ke database.

Contoh shape:

```php
<?php

return [
    'cara-daftar-istura' => [
        'path' => '/info/cara-daftar-istura',
        'title' => 'Cara Daftar ISTURA Yogyakarta: Alur Booking Gedung Agung',
        'description' => 'Panduan cara daftar ISTURA Yogyakarta untuk kunjungan Gedung Agung: cek jadwal, siapkan surat permohonan, isi data, dan tunggu konfirmasi admin.',
        'h1' => 'Cara Daftar ISTURA Yogyakarta',
        'intro' => '...',
        'keywords' => [
            'cara daftar istura',
            'booking istura',
        ],
        'sections' => [
            [
                'heading' => 'Apa itu ISTURA?',
                'body' => ['Paragraf 1.', 'Paragraf 2.'],
                'items' => [],
            ],
        ],
        'faqs' => [
            [
                'question' => 'Apakah daftar ISTURA berbayar?',
                'answer' => 'Tidak. Kunjungan ISTURA tidak dipungut biaya.',
            ],
        ],
        'links' => [
            [
                'label' => 'Jadwal Kunjungan ISTURA',
                'href' => '/info/jadwal-kunjungan-istura',
            ],
        ],
        'schema' => ['FAQPage', 'BreadcrumbList'],
        'sitemap' => [
            'changefreq' => 'monthly',
            'priority' => '0.8',
        ],
    ],
];
```

Catatan:

- `body` disarankan array paragraf agar Blade tidak perlu parsing newline.
- `items` opsional untuk bullet list.
- Semua string harus dirender escaped default Blade `{{ }}` kecuali JSON-LD yang sudah dihasilkan aman oleh helper.
- Jika butuh HTML sederhana, buat field terstruktur, bukan raw HTML dari config.

## 11. API Internal `SeoMeta` yang Disarankan

Tambahkan method publik di `App\Support\SeoMeta`:

```php
/**
 * @return array<string, array<string, mixed>>
 */
public static function infoPages(): array;

/**
 * @return array<string, mixed>
 */
public static function infoPage(string $slug): array;

/**
 * @return array<string, mixed>
 */
public static function infoPageViewData(string $slug): array;

public static function infoPageStructuredDataJson(array $page): string;
```

Perilaku:

- `infoPages()` membaca `config('seo_pages')`.
- `infoPage($slug)` mengembalikan satu halaman atau melempar 404.
- `infoPageViewData($slug)` menyiapkan data untuk Blade:
  - `page`
  - `seo`
  - `structuredDataJson`
  - `relatedPages`
- `infoPageStructuredDataJson()` memakai flag JSON encoding yang sama dengan structured data homepage.

Untuk sitemap:

- Update `sitemapXml()` agar memasukkan halaman dari `infoPages()`.
- Total URL setelah implementasi: 9 URL.
  1. `/`
  2. `/info/alur-kunjungan`
  3. `/info/cara-daftar-istura`
  4. `/info/jadwal-kunjungan-istura`
  5. `/info/syarat-kunjungan-istura`
  6. `/info/gedung-agung-yogyakarta`
  7. `/info/istana-kepresidenan-yogyakarta`
  8. `/info/museum-istana-kepresidenan-yogyakarta`
  9. `/info/wisata-edukasi-gratis-jogja`

## 12. Route Behavior

Tambahkan route sebelum catch-all SPA.

Pseudocode:

```php
Route::get('/info/{slug}', function (Request $request, string $slug) {
    if ($redirect = SeoMeta::canonicalRedirect($request)) {
        return $redirect;
    }

    return view('info.seo-page', SeoMeta::infoPageViewData($slug));
})
    ->whereIn('slug', array_keys(SeoMeta::infoPages()))
    ->name('info.seo-page');
```

Pertahankan route existing:

- `/info/alur-kunjungan` tetap memakai `info.visit-flow`.
- `/info/alur-kunjungan` tidak boleh berubah preview OG image-nya.

Unknown slug:

- `/info/slug-tidak-ada` harus 404.
- Jangan fallback ke React homepage.

## 13. View Blade

`resources/views/info/seo-page.blade.php` harus:

- memakai `lang="id"`;
- render metadata lengkap;
- memakai favicon existing `/assets/gedung-agung-gold.webp`;
- memakai CSS statis `/assets/info-page.css`;
- tidak memuat bundle React;
- render `<main>`;
- render breadcrumb visual sederhana;
- render semua section;
- render FAQ;
- render internal link;
- render CTA ke homepage/booking;
- render `<script type="application/ld+json">` dengan `{!! $structuredDataJson !!}` hanya dari helper yang sudah escaping aman.

Jangan inline style bila CSP tidak mengizinkan. Reuse `public/assets/info-page.css` atau tambahkan class di file itu.

## 14. Internal Link Publik

Tambahkan blok user-facing di footer atau homepage. Pilihan paling kecil:

- Update `resources/js/components/layout/Footer.tsx`.
- Tambahkan kolom/section kecil "Panduan" atau "Panduan Kunjungan".
- Gunakan `<a href="/info/...">` biasa, bukan button state React.

Anchor text final:

- `Cara Daftar ISTURA`
- `Jadwal Kunjungan ISTURA`
- `Syarat Kunjungan ISTURA`
- `Gedung Agung Yogyakarta`
- `Istana Kepresidenan Yogyakarta`
- `Museum Istana Kepresidenan Yogyakarta`
- `Wisata Edukasi Gratis di Jogja`

Catatan:

- Link harus bisa diklik user.
- Jangan hanya menaruh link di sitemap.
- Jika footer menjadi terlalu penuh di mobile, gunakan grid responsif dan styling ringkas.

## 15. Structured Data

Semua halaman:

- `WebPage`
- `BreadcrumbList`
- `FAQPage`

Halaman instruksional:

- `/info/cara-daftar-istura`: boleh tambahkan `HowTo` bila langkahnya benar-benar stabil.

Halaman tempat:

- `/info/gedung-agung-yogyakarta`: `TouristAttraction` dan/atau `Place`.
- `/info/istana-kepresidenan-yogyakarta`: `TouristAttraction` atau `GovernmentBuilding`.
- `/info/museum-istana-kepresidenan-yogyakarta`: `Museum` atau `TouristAttraction`.
- `/info/wisata-edukasi-gratis-jogja`: `TouristAttraction`.

Encoding JSON-LD wajib:

```php
JSON_UNESCAPED_SLASHES
    | JSON_UNESCAPED_UNICODE
    | JSON_PRETTY_PRINT
    | JSON_HEX_TAG
    | JSON_HEX_AMP
    | JSON_HEX_APOS
    | JSON_HEX_QUOT
```

Test harus membuktikan payload berbahaya tidak keluar dari blok JSON-LD bila ada data dinamis. Jika semua data statis dari config, minimal pastikan helper tetap memakai flag yang sama.

## 16. Acceptance Criteria

Implementasi dianggap selesai bila semua poin berikut terpenuhi:

1. Tujuh URL baru return 200.
2. `/info/alur-kunjungan` tetap return 200 dan metadata preview lama tidak berubah.
3. `/info/slug-tidak-ada` return 404.
4. Setiap halaman punya title, meta description, canonical, H1, section, FAQ, CTA, dan internal links.
5. Konten utama muncul di HTML awal tanpa JavaScript.
6. Sitemap memuat total 9 URL canonical.
7. Footer/homepage punya link user-facing ke 7 halaman.
8. Structured data JSON-LD ada dan valid JSON.
9. Tidak ada perubahan behavior booking, admin, Istura Open, API, atau database.
10. Test dan build relevan lulus.
11. Changelog `AGENTS.md` ditambahkan di paling atas.

## 17. Test yang Wajib Ditambahkan

Tambah test di `tests/Feature/SeoMetadataTest.php`.

Test minimal:

1. `test_seo_info_pages_render_server_side_content`
   - loop 7 slug;
   - assert 200;
   - assert `<title>`;
   - assert canonical;
   - assert H1;
   - assert salah satu section body;
   - assert `<script type="application/ld+json">`;
   - assert tidak ada root React-only content sebagai satu-satunya isi.

2. `test_sitemap_xml_lists_seo_content_cluster_urls`
   - assert semua 9 loc ada;
   - assert `lastmod` tetap mengikuti `Carbon::setTestNow`;
   - assert priority sesuai config.

3. `test_unknown_info_slug_returns_404`
   - GET `/info/tidak-ada`;
   - assert 404.

4. `test_visit_flow_page_is_not_replaced_by_generic_seo_page`
   - assert `/info/alur-kunjungan` masih punya OG image `peraturan-kunjungan.jpg`;
   - assert tidak memakai H1 halaman generic.

5. `test_footer_links_to_seo_info_pages`
   - GET `/`;
   - assert href ke 7 halaman muncul di HTML bundle/server output bila footer server-rendered.
   - Jika link footer hanya muncul setelah React render dan sulit dites di feature test, gunakan `npm run build` plus unit/grep tidak cukup. Lebih baik taruh link cluster juga di server-rendered fallback homepage (`seoContent`) atau view agar bisa dites.

Catatan untuk test nomor 5:

- Karena homepage adalah SPA, internal link React belum tentu terlihat di HTML awal.
- Untuk SEO, link yang paling kuat adalah link yang ada di HTML awal.
- Implementasi terbaik: tambahkan daftar link panduan di server-rendered homepage fallback dan juga di footer React bila perlu.

## 18. Perintah Verifikasi

Jalankan setelah implementasi:

```bash
php artisan test --filter=SeoMetadataTest
php artisan test
npm run build
./vendor/bin/pint --test app/Support/SeoMeta.php routes/web.php tests/Feature/SeoMetadataTest.php
git diff --check
```

Jika tidak menyentuh React sama sekali, `npm run build` tetap disarankan karena footer/homepage kemungkinan disentuh untuk internal link.

## 19. Manual QA Lokal

Jalankan server lokal:

```bash
php artisan serve
```

Cek dengan curl:

```bash
curl -sS http://127.0.0.1:8000/info/gedung-agung-yogyakarta | rg "<h1|canonical|application/ld\\+json"
curl -sS http://127.0.0.1:8000/info/museum-istana-kepresidenan-yogyakarta | rg "Museum Istana Kepresidenan Yogyakarta"
curl -sS http://127.0.0.1:8000/sitemap.xml | rg "gedung-agung-yogyakarta|wisata-edukasi-gratis-jogja"
curl -I http://127.0.0.1:8000/info/tidak-ada
```

Manual browser:

- Buka setiap halaman `/info/...`.
- Pastikan halaman terlihat layak untuk user, bukan halaman kosong/teks mentah.
- Pastikan CTA balik ke booking dapat dipahami.
- Pastikan footer/homepage menampilkan link panduan tanpa merusak layout mobile.

## 20. Deployment dan Search Console

Setelah implementasi di-merge/deploy:

1. Cek production:
   - `https://www.isturaiky.page/info/gedung-agung-yogyakarta`
   - `https://www.isturaiky.page/info/cara-daftar-istura`
   - `https://www.isturaiky.page/info/museum-istana-kepresidenan-yogyakarta`
   - `https://www.isturaiky.page/sitemap.xml`

2. Di Google Search Console:
   - submit ulang sitemap;
   - request indexing untuk 7 URL baru;
   - prioritas inspeksi:
     1. `/info/gedung-agung-yogyakarta`
     2. `/info/istana-kepresidenan-yogyakarta`
     3. `/info/museum-istana-kepresidenan-yogyakarta`
     4. `/info/cara-daftar-istura`
     5. `/info/jadwal-kunjungan-istura`
     6. `/info/syarat-kunjungan-istura`
     7. `/info/wisata-edukasi-gratis-jogja`

3. Pantau 14-28 hari:
   - impresi per halaman;
   - average position untuk query non-brand;
   - CTR;
   - apakah AI Overview/Gemini mulai mengambil domain sebagai salah satu sumber.

Metrik awal yang realistis:

- impresi naik lebih dulu;
- posisi rata-rata membaik bertahap;
- klik bisa menyusul setelah snippet/posisi stabil.

Jangan menganggap gagal bila belum langsung rank 1 dalam 1-3 hari.

## 21. Risiko dan Mitigasi

Risiko: halaman terlalu mirip.
Mitigasi: tiap halaman harus punya intro, FAQ, dan CTA yang berbeda sesuai intent.

Risiko: konten terlalu umum untuk query wisata Jogja.
Mitigasi: framing tetap "wisata edukasi gratis melalui ISTURA/Gedung Agung", bukan artikel rekomendasi wisata Jogja umum.

Risiko: route `/info/{slug}` mengganggu `/info/alur-kunjungan`.
Mitigasi: pertahankan route `/info/alur-kunjungan` di atas route generic dan tambahkan regression test.

Risiko: crawler tidak menemukan link karena hanya ada di React footer.
Mitigasi: tambahkan link di HTML awal homepage atau fallback server-rendered selain React footer.

Risiko: JSON-LD breakout.
Mitigasi: gunakan encoding flag existing dan jangan render raw HTML dari config.

Risiko: model eksekutor melebar ke refactor.
Mitigasi: ikuti daftar file di PRD ini dan jangan sentuh modul booking/admin.

## 22. Prompt Eksekusi untuk Model AI Murah

Gunakan prompt ini bila menyerahkan implementasi ke model lain:

```text
Implementasikan PRD-SEO-GEO-CONTENT-CLUSTER.md di repo /Users/macbookair/istura-app.

Fokus hanya pada 7 halaman info server-rendered yang disebut di PRD.
Jangan ubah flow booking, admin, API, database, Istura Open, auth, atau realtime.
Jangan buat full SSR React.
Jangan buat halaman tersembunyi untuk crawler; semua halaman harus terlihat user.

Ikuti file target:
- config/seo_pages.php
- app/Support/SeoMeta.php
- routes/web.php
- resources/views/info/seo-page.blade.php
- resources/js/components/layout/Footer.tsx atau fallback homepage untuk internal link
- tests/Feature/SeoMetadataTest.php
- AGENTS.md changelog

Pastikan:
- 7 URL baru return 200.
- /info/alur-kunjungan tetap sama.
- /info/slug-tidak-ada return 404.
- sitemap berisi 9 URL.
- konten utama ada di HTML awal tanpa JavaScript.
- JSON-LD escaped aman.
- test dan build relevan lulus.

Verifikasi:
php artisan test --filter=SeoMetadataTest
php artisan test
npm run build
git diff --check
```

## 23. Catatan untuk Reviewer

Reviewer perlu memeriksa:

- Apakah semua halaman benar-benar user-facing.
- Apakah internal link berada di HTML awal atau setidaknya mudah ditemukan crawler.
- Apakah copy tidak membuat klaim institusional berlebihan.
- Apakah structured data valid dan tidak raw-unescaped.
- Apakah route catch-all SPA tidak membuat unknown `/info/*` menjadi homepage.
- Apakah test mencakup sitemap, slug 404, dan `/info/alur-kunjungan`.

