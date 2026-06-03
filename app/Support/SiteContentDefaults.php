<?php

namespace App\Support;

class SiteContentDefaults
{
    public static function mergeSiteContent(array $value): array
    {
        return self::mergeDefaults(self::siteContent(), $value);
    }

    public static function siteContent(): array
    {
        return [
            'nav' => [
                'logoSrc' => '/assets/gedung-agung-white.webp',
                'logoAlt' => 'Logo Gedung Agung',
                'brandText' => 'ISTURA',
                'ctaLabel' => 'Mulai Booking',
                'items' => [
                    ['label' => 'Beranda', 'target' => 'home'],
                    ['label' => 'Cek Jadwal', 'target' => '#panduan'],
                    ['label' => 'Contoh Surat', 'target' => '#contoh-surat'],
                    ['label' => 'Peraturan', 'target' => '#peraturan'],
                    ['label' => 'FAQ', 'target' => '#faq'],
                ],
            ],
            'quickInfo' => [
                'title' => 'Sebelum booking, siapkan tiga hal utama.',
                'description' => 'Ringkasan ini membantu pengunjung tahu jadwal, syarat, dan kanal konfirmasi tanpa harus membaca formulir panjang.',
                'cards' => [
                    [
                        'iconKey' => 'clock',
                        'title' => 'Jam Kunjungan',
                        'body' => 'Kunjungan dibuka pada hari kerja sesuai jadwal layanan ISTURA.',
                        'points' => ['Senin - Kamis', '08.00 - 11.00 & 13.00 - 14.00 WIB', 'Istirahat 12.00 - 13.00'],
                    ],
                    [
                        'iconKey' => 'file-check',
                        'title' => 'Syarat Kunjungan',
                        'body' => 'Siapkan dokumen dan data utama sebelum mengisi form booking.',
                        'points' => ['Surat permohonan resmi', 'Data contact person', 'Jadwal masih tersedia'],
                    ],
                    [
                        'iconKey' => 'message-circle',
                        'title' => 'Konfirmasi WhatsApp',
                        'body' => 'Admin akan menghubungi contact person setelah data permohonan masuk.',
                        'points' => ['Maksimal 1x24 jam', 'Gunakan nomor WhatsApp aktif'],
                    ],
                ],
            ],
            'schedule' => [
                'title' => 'Jadwal Kunjungan ISTURA',
                'description' => 'Cek slot tersedia sebelum booking. Kalender dibuka dua bulan ke depan; ikuti hari yang ditandai sebagai tersedia.',
            ],
            'video' => [
                'title' => 'Virtual Tour - Istana Kepresidenan Yogyakarta',
                'url' => 'https://www.youtube.com/embed/YhE3H8mCFV4?start=4&rel=0&modestbranding=1',
            ],
            'bookingSteps' => [
                'title' => 'Booking dalam 4 langkah.',
                'story' => 'Pilih jadwal, isi data, unggah surat, lalu tunggu konfirmasi WhatsApp.',
                'cards' => [
                    [
                        'iconKey' => 'calendar',
                        'title' => 'Pilih jadwal',
                        'body' => 'Cek kalender dua bulan ke depan, lalu pilih tanggal dan jam yang masih tersedia.',
                    ],
                    [
                        'iconKey' => 'pen',
                        'title' => 'Isi data',
                        'body' => 'Masukkan nama contact person, NIK, WhatsApp aktif, asal instansi, dan jumlah rombongan.',
                    ],
                    [
                        'iconKey' => 'upload',
                        'title' => 'Unggah surat',
                        'body' => 'Lampirkan surat permohonan resmi dari instansi agar admin dapat melakukan verifikasi.',
                    ],
                    [
                        'iconKey' => 'message-circle',
                        'title' => 'Tunggu WhatsApp',
                        'body' => 'Admin mengirim keputusan, penolakan, atau opsi reschedule melalui WhatsApp.',
                    ],
                ],
            ],
            'activities' => [
                'title' => 'Hal apa saja yang akan kamu lakukan di Istana.',
                'description' => 'Empat momen kunjungan diringkas menjadi panel visual yang mudah dipindai.',
                'items' => [
                    [
                        'title' => 'Penyambutan',
                        'body' => 'Arahan awal dan foto sambutan di pelataran wapres.',
                        'image' => '/assets/penyambutan.webp',
                    ],
                    [
                        'title' => 'Cerita Sejarah Gedung Agung',
                        'body' => 'Mengenal sejarah Gedung Agung sambil foto bersama di gedung induk.',
                        'image' => '/assets/cerita-sejarah-gedung-agung.webp',
                    ],
                    [
                        'title' => 'Tur Museum',
                        'body' => 'Berkeliling melihat koleksi lukisan dan benda seni Istana Kepresidenan Yogyakarta.',
                        'image' => '/assets/museum.webp',
                    ],
                    [
                        'title' => 'Perpustakaan',
                        'body' => 'Membaca koleksi buku Gedung Agung sambil beristirahat sejenak.',
                        'image' => '/assets/perpustakaan.webp',
                    ],
                ],
            ],
            'rulesSection' => [
                'title' => 'Aturan & Tata Tertib Kunjungan ISTURA.',
                'description' => 'Mohon patuhi seluruh peraturan di bawah ini agar kunjungan Anda di Istana Kepresidenan Yogyakarta berjalan dengan tertib, aman, dan nyaman.',
                'rulesKicker' => 'Tata tertib fisik',
                'rulesTitle' => 'Peraturan Kunjungan Istana Kepresidenan Yogyakarta',
                'rulesList' => [
                    'Berpakaian sopan, rapi, bersepatu',
                    'Dilarang menggunakan kaos oblong, celana jeans, dan celana pendek',
                    'Dilarang membawa makanan & minuman',
                    'Dilarang parkir dalam Istana',
                    'HP dan kamera profesional dititipkan koordinator kunjungan',
                    'Dilarang mengambil gambar di dalam museum dan area dalam gedung induk',
                    'Kunjungan akan didokumentasikan pihak istana dan link akan dikirimkan melalui koordinator kunjungan',
                    'Dimohon mengisi kuisoner dan penilaian',
                ],
                'buttonLabel' => 'Mulai Booking',
            ],
            'letterSection' => [
                'title' => 'Contoh surat permohonan ISTURA.',
                'description' => 'Gunakan contoh ini sebagai acuan format surat resmi sebelum mengunggah dokumen booking.',
                'formatKicker' => 'Format dokumen',
                'formatTitle' => 'Yang perlu dicantumkan di surat.',
                'uploadNote' => 'Upload mendukung PDF, JPG, JPEG, atau PNG. Maksimal 5 MB.',
                'buttonLabel' => 'Mulai Booking',
            ],
            'faq' => [
                'title' => 'Pertanyaan yang paling sering muncul.',
                'description' => 'Jawaban ringkas untuk hal yang biasanya ditanyakan sebelum pengunjung mengirim permohonan.',
            ],
            'cta' => [
                'title' => 'Siap mengajukan kunjungan ISTURA?',
                'body' => 'Mulai dari jadwal yang tersedia, unggah surat permohonan, lalu tunggu konfirmasi admin maksimal 1x24 jam melalui WhatsApp.',
                'buttonLabel' => 'Mulai Booking Sekarang',
                'backgroundImage' => '/assets/hero-istana.webp',
            ],
            'footer' => [
                'logoSrc' => '/assets/gedung-agung-white.webp',
                'logoAlt' => 'Gedung Agung',
                'scheduleLabel' => 'Jadwal buka',
                'scheduleDays' => 'Senin - Kamis',
                'scheduleHours' => '08.00 - 11.00 & 13.00 - 14.00 WIB (istirahat 12.00 - 13.00)',
                'mapUrl' => 'https://maps.app.goo.gl/iuAhnPB1SkJLMaX9A',
                'mapEmbedUrl' => 'https://www.google.com/maps?q=Gedung+Agung+Yogyakarta&output=embed',
                'address' => 'Jl. Jend. Ahmad Yani, Ngupasan, Kec. Gondomanan, Kota Yogyakarta, Daerah Istimewa Yogyakarta 55122',
                'copyright' => "\u{00A9} 2026 Istana Kepresidenan Yogyakarta / Gedung Agung. Seluruh hak cipta dilindungi.",
            ],
        ];
    }

    private static function mergeDefaults(array $defaults, array $value): array
    {
        $merged = $value;

        foreach ($defaults as $key => $defaultValue) {
            if (! array_key_exists($key, $value)) {
                $merged[$key] = $defaultValue;

                continue;
            }

            if (is_array($defaultValue) && is_array($value[$key]) && ! array_is_list($defaultValue)) {
                $merged[$key] = self::mergeDefaults($defaultValue, $value[$key]);
            }
        }

        return $merged;
    }
}
