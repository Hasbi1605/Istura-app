# SEO/GEO Content Cluster Plan

Tanggal: 2026-06-18

## Latar Belakang

Search Console menunjukkan `isturaiky.page` sudah kuat untuk kueri brand `istura`, tetapi belum kuat untuk kueri non-brand seperti `gedung agung`, `gedung agung yogyakarta`, `istana yogyakarta`, `istana jogja`, dan kueri wisata/museum. Produksi saat ini sudah sehat secara teknis: homepage 200, canonical benar, robots mengizinkan indexing, sitemap aktif, dan JSON-LD tersedia. Masalah utama bukan indexing teknis, tetapi kecocokan intent, kedalaman konten, dan otoritas.

Saat ini sitemap hanya memuat:

- `https://www.isturaiky.page/`
- `https://www.isturaiky.page/info/alur-kunjungan`

Homepage juga masih lebih kuat sebagai halaman booking/brand ISTURA daripada halaman informasi untuk intent "Gedung Agung", "Istana Yogyakarta", atau "wisata/museum gratis Jogja".

## Validasi Tambahan Opus

### Valid dan dimasukkan

- Domain baru kalah authority pada kueri generik: valid. Kueri seperti `gedung agung` dan `istana yogyakarta` bersaing dengan situs pemerintah, profil tempat, media sosial, situs wisata, dan domain lama.
- Intent mismatch: valid. Homepage saat ini menarget booking ISTURA, sedangkan query non-brand banyak yang bersifat informasional atau local discovery.
- Jumlah URL target terlalu sedikit: valid. Dua URL publik di sitemap belum cukup untuk menangkap variasi intent.
- Perlu halaman server-rendered khusus: valid. Halaman info harus punya HTML awal yang berisi konten utama, metadata unik, canonical sendiri, internal link, dan masuk sitemap.
- Meta tag saja tidak cukup: valid. Masalah utama bukan label title/description, tetapi relevansi konten per intent dan authority.
- Off-page link resmi tetap penting: valid, tetapi di luar scope implementasi kode jangka pendek.

### Valid sebagian dan dinuansakan

- "Konten utama client-side/noscript": valid sebagai risiko SEO jangka panjang bila dipakai untuk halaman target, tetapi bukan berarti Google tidak bisa membaca website sama sekali. Google dapat render JavaScript, namun untuk halaman SEO baru tetap lebih kuat bila konten utama tampil sebagai HTML server-rendered dan terlihat untuk user, bukan hanya fallback `<noscript>`.

### Tidak dimasukkan sebagai aksi utama

- SSR penuh untuk seluruh SPA: tidak disarankan. Effort besar dan risiko regresi tinggi, sementara kebutuhan saat ini cukup dengan halaman info Blade server-rendered.
- Keyword stuffing di homepage: tidak disarankan. Akan melemahkan kualitas dan tidak menyelesaikan perbedaan intent.
- Membuat banyak halaman tipis/duplikat untuk variasi keyword: tidak disarankan. Halaman harus berbasis intent yang berbeda.

## Tujuan

- Membuat cluster halaman informasi yang menarget kueri non-brand dan long-tail.
- Memperjelas relasi entitas: ISTURA, Gedung Agung, Istana Kepresidenan Yogyakarta, museum, wisata edukasi gratis, dan proses booking.
- Menambah halaman target yang bisa masuk sitemap, diinspeksi Search Console, dan dipakai Google/AI sebagai sumber yang lebih spesifik.
- Menjaga flow booking dan SPA publik tetap stabil.

## Ruang Lingkup

Buat 7 halaman prioritas:

1. `/info/cara-daftar-istura`
2. `/info/jadwal-kunjungan-istura`
3. `/info/syarat-kunjungan-istura`
4. `/info/gedung-agung-yogyakarta`
5. `/info/istana-kepresidenan-yogyakarta`
6. `/info/museum-istana-kepresidenan-yogyakarta`
7. `/info/wisata-edukasi-gratis-jogja`

Halaman opsional untuk fase berikutnya:

- `/info/museum-jogja-gratis`

Halaman opsional ini jangan dibuat dulu kecuali Search Console mulai menunjukkan impresi yang cukup untuk query `museum jogja gratis` atau `museum gratis jogja`, karena risiko konten tipis/duplikat lebih tinggi.

## Di Luar Scope

- Mengubah flow booking, admin, Istura Open, jadwal, atau API publik.
- Klaim atau edit Google Business Profile.
- Backlink dari domain `go.id`, Instagram, Maps, atau kanal resmi lain.
- SSR penuh untuk React SPA.
- CMS editor untuk halaman info baru. Fase awal sebaiknya statis/terkontrol dulu.
- Membuat halaman wisata umum yang tidak relevan langsung dengan Gedung Agung/ISTURA.

## Strategi Halaman

### 1. `/info/cara-daftar-istura`

- Intent: pengguna ingin tahu cara daftar/booking ISTURA.
- Target utama: `cara daftar istura`, `booking istura`, `pendaftaran istura`, `istura adalah`.
- Title: `Cara Daftar ISTURA Yogyakarta: Alur Booking Kunjungan Gedung Agung`
- H1: `Cara Daftar ISTURA Yogyakarta`
- Konten inti:
  - Apa itu ISTURA.
  - Siapa yang bisa mendaftar.
  - Langkah booking.
  - Dokumen yang harus disiapkan.
  - Setelah submit apa yang terjadi.
  - Link CTA ke mulai booking.
- Schema: `FAQPage`, `BreadcrumbList`, `HowTo` bila langkahnya stabil dan tidak berlebihan.

### 2. `/info/jadwal-kunjungan-istura`

- Intent: pengguna mencari jadwal kunjungan.
- Target utama: `jadwal kunjungan istura`, `jadwal istura yogyakarta`, `jadwal kunjungan gedung agung`.
- Title: `Jadwal Kunjungan ISTURA Yogyakarta dan Cara Cek Slot Gedung Agung`
- H1: `Jadwal Kunjungan ISTURA Yogyakarta`
- Konten inti:
  - Hari/jam layanan umum.
  - Cara membaca kalender slot.
  - Batas booking H+2 sampai 2 bulan, serta catatan booking dadakan bila relevan.
  - Hari libur/tutup.
  - CTA cek jadwal di homepage.
- Schema: `FAQPage`, `BreadcrumbList`.

### 3. `/info/syarat-kunjungan-istura`

- Intent: pengguna mencari syarat dan dokumen.
- Target utama: `syarat kunjungan istura`, `surat permohonan istura`, `syarat kunjungan gedung agung`.
- Title: `Syarat Kunjungan ISTURA Gedung Agung Yogyakarta`
- H1: `Syarat Kunjungan ISTURA`
- Konten inti:
  - Surat permohonan.
  - Data contact person.
  - Jumlah peserta.
  - Aturan kunjungan.
  - Format file upload.
  - Link contoh surat dan alur kunjungan.
- Schema: `FAQPage`, `BreadcrumbList`.

### 4. `/info/gedung-agung-yogyakarta`

- Intent: pengguna mencari entitas/tempat Gedung Agung.
- Target utama: `gedung agung`, `gedung agung yogyakarta`, `gedung agung jogja`, `kunjungan gedung agung`.
- Title: `Gedung Agung Yogyakarta: Lokasi Kunjungan ISTURA dan Cara Booking`
- H1: `Gedung Agung Yogyakarta`
- Konten inti:
  - Gedung Agung sebagai Istana Kepresidenan Yogyakarta.
  - Hubungan Gedung Agung dengan program ISTURA.
  - Lokasi dan akses.
  - Kunjungan edukasi dan museum.
  - Cara daftar kunjungan lewat ISTURA.
  - Catatan: halaman ini bukan situs utama institusi Gedung Agung, melainkan panduan kunjungan ISTURA.
- Schema: `TouristAttraction`, `Place`, `BreadcrumbList`, `FAQPage`.

### 5. `/info/istana-kepresidenan-yogyakarta`

- Intent: pengguna mencari entitas Istana Kepresidenan Yogyakarta.
- Target utama: `istana kepresidenan yogyakarta`, `istana yogyakarta`, `istana jogja`, `istana presiden jogja`.
- Title: `Istana Kepresidenan Yogyakarta: Kunjungan Gedung Agung melalui ISTURA`
- H1: `Istana Kepresidenan Yogyakarta`
- Konten inti:
  - Penjelasan singkat Istana Kepresidenan Yogyakarta/Gedung Agung.
  - Apa yang dapat dikunjungi masyarakat.
  - Program ISTURA sebagai jalur kunjungan.
  - Lokasi, jadwal, dan aturan umum.
  - Link ke halaman Gedung Agung dan cara daftar.
- Schema: `GovernmentBuilding` atau `TouristAttraction` bila `GovernmentBuilding` tidak cocok di library/struktur yang dipakai, `BreadcrumbList`, `FAQPage`.

### 6. `/info/museum-istana-kepresidenan-yogyakarta`

- Intent: pengguna mencari museum/kunjungan edukasi di area Istana.
- Target utama: `museum istana kepresidenan yogyakarta`, `museum gedung agung`, `museum istana jogja`.
- Title: `Museum Istana Kepresidenan Yogyakarta di Gedung Agung`
- H1: `Museum Istana Kepresidenan Yogyakarta`
- Konten inti:
  - Museum sebagai bagian pengalaman kunjungan ISTURA.
  - Apa yang dilihat pengunjung secara umum.
  - Apakah gratis.
  - Apakah bisa datang langsung atau harus daftar.
  - Cocok untuk sekolah, komunitas, keluarga, dan wisata edukasi.
  - Link ke cara daftar dan jadwal.
- Schema: `Museum` atau `TouristAttraction`, `BreadcrumbList`, `FAQPage`.

### 7. `/info/wisata-edukasi-gratis-jogja`

- Intent: pengguna mencari wisata edukasi/sejarah gratis di Jogja.
- Target utama: `wisata edukasi gratis jogja`, `wisata sejarah gratis jogja`, `wisata gratis jogja`, `kunjungan edukasi gedung agung`.
- Title: `Wisata Edukasi Gratis di Jogja: Kunjungan Gedung Agung melalui ISTURA`
- H1: `Wisata Edukasi Gratis di Jogja`
- Konten inti:
  - Gedung Agung sebagai opsi kunjungan edukasi gratis melalui ISTURA.
  - Gratis tetapi harus mengikuti alur pendaftaran.
  - Cocok untuk rombongan sekolah/instansi/komunitas.
  - Kegiatan kunjungan: sejarah, museum, tata tertib, dokumentasi bila tersedia.
  - Link ke jadwal, syarat, dan cara daftar.
- Schema: `TouristAttraction`, `FAQPage`, `BreadcrumbList`.

## Arsitektur Implementasi

### Route dan View

- Tambahkan route eksplisit di `routes/web.php` sebelum catch-all SPA.
- Gunakan pola seperti `/info/alur-kunjungan`, tetapi buat view yang lebih generik untuk halaman konten SEO.
- Kandidat view:
  - `resources/views/info/content-page.blade.php`
  - atau `resources/views/info/seo-page.blade.php`
- Konten utama harus tampil langsung di HTML awal sebagai `<main>`, bukan hanya di `<noscript>`.

### Metadata dan Konten

- Tambahkan registry halaman info di `app/Support/SeoMeta.php` atau file konfigurasi baru seperti `config/seo_pages.php`.
- Rekomendasi: gunakan config/array statis dulu agar mudah dites dan tidak bergantung DB.
- Tiap halaman minimal punya:
  - slug/path
  - title
  - description
  - canonical
  - h1
  - intro
  - sections
  - FAQ
  - schema types
  - internal links

### Sitemap

- Update `SeoMeta::sitemapXml()` agar memuat 7 URL baru.
- Prioritas awal:
  - Homepage: `1.0`
  - Cara daftar/jadwal/syarat: `0.8`
  - Gedung Agung/Istana/Museum/Wisata: `0.7`
- `lastmod` tetap tanggal saat generate seperti pola saat ini.

### Internal Link

- Tambahkan area "Panduan ISTURA" atau "Panduan Kunjungan Gedung Agung" di homepage/footer.
- Anchor text harus eksplisit:
  - `Cara Daftar ISTURA`
  - `Jadwal Kunjungan ISTURA`
  - `Syarat Kunjungan ISTURA`
  - `Gedung Agung Yogyakarta`
  - `Istana Kepresidenan Yogyakarta`
  - `Museum Istana Kepresidenan Yogyakarta`
  - `Wisata Edukasi Gratis di Jogja`
- Jangan hanya menaruh link di sitemap; internal link user-facing penting untuk relevansi dan crawl path.

### Structured Data

- Semua halaman: `BreadcrumbList`.
- Halaman instruksional: `FAQPage`; `HowTo` hanya untuk `/info/cara-daftar-istura` jika langkah final jelas dan tidak misleading.
- Halaman tempat:
  - `TouristAttraction` untuk Gedung Agung/wisata edukasi.
  - `Museum` untuk museum bila data faktualnya cukup.
  - `GovernmentOrganization` tetap di homepage, jangan dipaksakan di semua halaman.

## Risiko

- Risiko keyword stuffing jika halaman terlalu mengejar kata kunci. Mitigasi: tulis natural dan utamakan jawaban pengguna.
- Risiko thin content jika 7 halaman dibuat terlalu pendek. Mitigasi: tiap halaman minimal menjawab intent spesifik, punya FAQ unik, dan internal link relevan.
- Risiko klaim institusional berlebihan. Mitigasi: framing halaman sebagai "panduan kunjungan ISTURA", bukan situs utama Gedung Agung/Setneg.
- Risiko duplikasi antar halaman Gedung Agung, Istana, Museum, dan Wisata. Mitigasi: bedakan intent dan intro tiap halaman.
- Risiko regresi SPA jika catch-all route terganggu. Mitigasi: route eksplisit `/info/*` harus didefinisikan sebelum catch-all dan test route ditambah.

## Langkah Implementasi

1. Buat struktur data halaman info.
   - Pilih `config/seo_pages.php` atau registry method di `SeoMeta`.
   - Simpan 7 halaman prioritas dengan metadata, section, FAQ, dan schema hints.

2. Buat renderer halaman info server-rendered.
   - Tambahkan view Blade generik untuk halaman konten.
   - Pastikan tidak bergantung bundle React.
   - Gunakan CSS statis yang sudah ada untuk halaman info atau tambahkan CSS statis khusus bila perlu.

3. Tambahkan route.
   - Route untuk 7 slug di `routes/web.php`.
   - Unknown slug boleh 404, jangan jatuh ke homepage bila slug info salah.

4. Tambahkan metadata per halaman.
   - Title, description, canonical, OG, Twitter card.
   - Breadcrumb dan FAQ structured data.
   - JSON-LD harus tetap memakai flag escaping aman seperti implementasi structured data saat ini.

5. Update sitemap.
   - Tambahkan semua URL baru.
   - Tambah test yang memastikan sitemap memuat 9 URL total: homepage, alur kunjungan, dan 7 halaman baru.

6. Tambahkan internal link.
   - Tambahkan blok panduan di homepage/footer atau section publik yang paling natural.
   - Pastikan link benar-benar `<a href="/info/...">`, bukan hanya tombol state React.

7. Tambahkan test.
   - Test tiap halaman `200`.
   - Test canonical unik.
   - Test title/meta unik.
   - Test sitemap.
   - Test unknown info slug 404 bila route dibuat catch-all khusus.

8. Verifikasi manual production setelah deploy.
   - `curl -sSL https://www.isturaiky.page/info/gedung-agung-yogyakarta`
   - `view-source:` cek H1 dan paragraf ada tanpa JavaScript.
   - Search Console: submit sitemap dan request indexing halaman prioritas.

## Rencana Test

- `php artisan test --filter=SeoMetadataTest`
- Tambahkan/ubah test feature untuk halaman info baru.
- `php artisan test` bila route/view shared banyak disentuh.
- `npm run build` bila internal link homepage/footer menyentuh React.
- Scoped `pint --test` untuk file PHP/Blade terkait.
- `git diff --check`.

## Kriteria Selesai

- 7 halaman prioritas tersedia dan return 200.
- Semua halaman punya title, meta description, canonical, H1, dan konten HTML server-rendered.
- Sitemap memuat 7 halaman baru.
- Homepage atau footer punya internal link user-facing ke halaman cluster.
- Structured data JSON-LD valid dan escaped aman.
- Test relevan lulus.
- Setelah deploy, Search Console dapat menginspeksi URL tanpa 5xx/noindex/canonical mismatch.

## Catatan Operasional Setelah Deploy

- Submit sitemap ulang di Google Search Console.
- Request indexing manual untuk 7 halaman, mulai dari:
  1. `/info/gedung-agung-yogyakarta`
  2. `/info/cara-daftar-istura`
  3. `/info/jadwal-kunjungan-istura`
  4. `/info/museum-istana-kepresidenan-yogyakarta`
- Pantau 14-28 hari.
- Metrik awal bukan langsung klik, tetapi impresi dan posisi rata-rata membaik untuk query non-brand.
- Jika query `museum jogja gratis` mulai muncul dengan impresi cukup, baru evaluasi halaman opsional `/info/museum-jogja-gratis`.

