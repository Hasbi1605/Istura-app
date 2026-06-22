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
                'logoSrc' => '/assets/gedung-agung-gold.webp',
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
                'rulesKicker' => 'Tata tertib',
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
                'logoSrc' => '/assets/gedung-agung-gold.webp',
                'logoAlt' => 'Gedung Agung',
                'scheduleLabel' => 'Jadwal buka',
                'scheduleDays' => 'Senin - Kamis',
                'scheduleHours' => '08.00 - 11.00 & 13.00 - 14.00 WIB (istirahat 12.00 - 13.00)',
                'mapUrl' => 'https://maps.app.goo.gl/iuAhnPB1SkJLMaX9A',
                'mapEmbedUrl' => 'https://www.google.com/maps?q=Gedung+Agung+Yogyakarta&output=embed',
                'address' => 'Jl. Jend. Ahmad Yani, Ngupasan, Kec. Gondomanan, Kota Yogyakarta, Daerah Istimewa Yogyakarta 55122',
                'copyright' => "\u{00A9} 2026 Istana Kepresidenan Yogyakarta / Gedung Agung. Seluruh hak cipta dilindungi.",
            ],
            'floatingContact' => [
                'greeting' => 'Ada yang bisa kubantu soal kunjungan ISTURA? Pilih topik di bawah ya.',
                'topics' => [
                    ['label' => 'Tanya jadwal kunjungan', 'message' => 'Halo Admin ISTURA, saya ingin menanyakan jadwal kunjungan ke Istana Kepresidenan Yogyakarta.'],
                    ['label' => 'Bantuan proses booking', 'message' => 'Halo Admin ISTURA, saya butuh bantuan terkait proses booking kunjungan ISTURA.'],
                    ['label' => 'Informasi umum', 'message' => 'Halo Admin ISTURA, saya ingin menanyakan informasi umum seputar kunjungan ISTURA.'],
                ],
            ],
            'openBanner' => [
                'tickerText' => 'Pendaftaran kunjungan perorangan gratis, tanpa surat. Pilih harimu, siapa cepat dia dapat!',
            ],
            'bookingWizard' => [
                'steps' => [
                    [
                        'title' => 'Selamat Datang',
                        'helper' => 'Siapkan data contact person, nomor WhatsApp aktif, rencana tanggal, dan surat permohonan.',
                        'miky' => 'Halo! Aku MIKY. Kita akan mengisi pendaftaran kunjungan secara bertahap.',
                    ],
                    [
                        'title' => 'Data Contact Person',
                        'helper' => 'Data ini digunakan admin untuk menghubungi perwakilan rombongan.',
                        'miky' => 'Pastikan nomor WhatsApp aktif karena konfirmasi akan dikirim melalui nomor ini.',
                    ],
                    [
                        'title' => 'Data Instansi',
                        'helper' => 'Tuliskan nama instansi dan estimasi jumlah rombongan yang akan hadir.',
                        'miky' => 'Nama instansi membantu admin memverifikasi permohonan kunjunganmu.',
                    ],
                    [
                        'title' => 'Pilih Jadwal',
                        'helper' => 'Pilih tanggal dan jam yang masih tersedia. Jadwal pending tetap terkunci.',
                        'miky' => 'Jadwal abu-abu sudah terisi atau belum dibuka. Pilih slot berwarna gold.',
                    ],
                    [
                        'title' => 'Upload Surat',
                        'helper' => 'Format yang didukung: PDF, JPG, JPEG, atau PNG dengan ukuran maksimal 5 MB.',
                        'miky' => 'Unggah surat permohonan resmi dari instansi agar admin bisa melakukan pengecekan.',
                    ],
                    [
                        'title' => 'Review Data',
                        'helper' => 'Periksa kembali semua data sebelum permohonan dikirim.',
                        'miky' => 'Cek ulang nama, jadwal, dan surat. Setelah submit, jadwal akan langsung terkunci.',
                    ],
                    [
                        'title' => 'Pernyataan',
                        'helper' => 'Setujui pernyataan kebenaran data dan kesediaan mengikuti aturan kunjungan.',
                        'miky' => 'Kalau datanya sudah benar, centang pernyataan lalu kirim permohonan.',
                    ],
                    [
                        'title' => 'Selesai',
                        'helper' => 'Permohonan masuk ke dashboard admin dengan status Pending.',
                        'miky' => 'Permohonan berhasil dikirim. Admin akan menghubungi maksimal 1x24 jam.',
                    ],
                ],
                'preparation' => [
                    'items' => ['Data contact person', 'Nomor WhatsApp aktif', 'Tanggal kunjungan', 'Surat permohonan'],
                    'scheduleLinkLabel' => 'Cek jadwal',
                    'letterLinkLabel' => 'Lihat contoh',
                ],
                'fields' => [
                    'contactNameLabel' => 'Nama Lengkap CP',
                    'nikLabel' => 'NIK KTP',
                    'whatsappLabel' => 'Nomor WhatsApp CP',
                    'whatsappHelper' => 'Contoh 08xxxxxxxxxx',
                    'institutionLabel' => 'Asal Instansi',
                    'groupSizeLabel' => 'Jumlah Rombongan',
                ],
                'schedule' => [
                    'timeTitle' => 'Pilih Jam Kunjungan',
                    'emptyDateLabel' => 'Pilih tanggal terlebih dahulu',
                    'emptySlotLabel' => 'Tidak ada slot pada tanggal ini.',
                    'legendLabel' => 'Keterangan:',
                    'largeGroupTitle' => 'Perlu penyesuaian jadwal?',
                    'largeGroupBody' => 'Jadwal rombongan dibagi menjadi {jumlahKloter} kloter. Diskusikan penyesuaian dengan Admin ISTURA sesuai ketersediaan layanan.',
                    'largeGroupActionLabel' => 'Diskusi dengan Admin',
                ],
                'upload' => [
                    'readyLabel' => 'File siap dikirim',
                    'emptyTitle' => 'Unggah surat permohonan',
                    'selectedTitle' => 'Surat berhasil dipilih',
                    'helper' => 'PDF, JPG, JPEG, atau PNG. Maksimal 5 MB.',
                    'chooseLabel' => 'Pilih File',
                    'replaceLabel' => 'Ganti File',
                ],
                'agreementText' => 'Saya menyatakan data yang diisi benar dan rombongan bersedia mengikuti aturan kunjungan Istana Kepresidenan Yogyakarta.',
                'successTitle' => 'Terima kasih, booking telah kami terima',
                'successMessage' => 'Permohonan dengan kode booking {kode} berhasil diterima dengan status menunggu persetujuan. Admin akan menghubungi maksimal 1x24 jam melalui WhatsApp.',
                'actions' => [
                    'backLabel' => 'Kembali',
                    'nextLabel' => 'Lanjut',
                    'submitLabel' => 'Submit Booking',
                    'homeLabel' => 'Kembali ke Beranda',
                ],
            ],
            'feedbackWizard' => [
                'intro' => 'Bagikan pengalaman kunjunganmu di Istana Kepresidenan Yogyakarta.',
                'steps' => [
                    'rating' => [
                        'title' => 'Survei Kunjungan Istura',
                        'bubbleTitle' => 'Kenalan dulu yuk',
                        'bubbleEmpty' => 'Halo! Sebelum bercerita, isi data dirimu dulu ya.',
                        'bubbleLow' => 'Lengkapi data dirimu dulu ya sebelum lanjut.',
                        'bubbleNeutral' => 'Sip, datanya mulai lengkap. Lanjut sebentar.',
                        'bubbleHigh' => 'Mantap, data dirimu sudah lengkap. Lanjut ya.',
                    ],
                    'visit' => [
                        'title' => 'Tentang Kunjungan',
                        'bubbleTitle' => 'Kenali pengalamanmu',
                        'bubbleEmpty' => 'Ceritakan dulu bagaimana kamu mengenal ISTURA dan nilai prosesnya.',
                        'bubbleDone' => 'Terima kasih. Informasi ini membantu kami memahami pengalaman pengunjung.',
                    ],
                    'details' => [
                        'title' => 'Penilaian Kunjungan',
                        'bubbleTitle' => 'Beri penilaianmu',
                        'bubbleEmpty' => 'Nilai pemanduan dan fasilitas, lalu seberapa besar kamu mau merekomendasikan ISTURA.',
                        'bubbleHighlightsEmpty' => 'Mantap. Bagian mana yang paling berkesan?',
                        'bubbleDone' => 'Sebutkan juga aspek yang masih perlu diperbaiki ya.',
                    ],
                    'comment' => [
                        'title' => 'Cerita & Kirim',
                        'bubbleTitle' => 'Tinggal sedikit lagi',
                        'bubbleEmpty' => 'Ceritakan momen yang paling berkesan, atau langsung kirim saja.',
                        'bubbleDone' => 'Terima kasih ceritanya. Tekan kirim kalau sudah siap.',
                    ],
                ],
                'fields' => [
                    'visitorNameLabel' => 'Nama',
                    'visitorNamePlaceholder' => 'Nama lengkap',
                    'genderLabel' => 'Jenis kelamin',
                    'genderPlaceholder' => 'Pilih jenis kelamin',
                    'genderMaleLabel' => 'Laki-laki',
                    'genderFemaleLabel' => 'Perempuan',
                    'ageLabel' => 'Usia',
                    'agePlaceholder' => 'Usia (tahun)',
                    'originLabel' => 'Alamat / Asal',
                    'originPlaceholder' => 'Kota atau asal instansi',
                    'ratingLabel' => 'Kepuasan keseluruhan',
                    'bookingEaseLabel' => 'Kemudahan proses booking online',
                    'serviceLabel' => 'Pelayanan petugas saat kunjungan',
                    'guideQualityLabel' => 'Kualitas penjelasan dan pendampingan pemandu',
                    'facilityComfortLabel' => 'Kebersihan lingkungan dan kenyamanan fasilitas',
                    'visitedBeforeLegend' => 'Apakah sudah pernah berkunjung ke Gedung Agung?',
                    'visitedBeforeFirstLabel' => 'Belum, ini pertama kali',
                    'visitedBeforeReturnLabel' => 'Ya, pernah',
                    'discoverySourceLabel' => 'Dari mana Bapak/Ibu mengetahui Istana Kepresidenan Yogyakarta?',
                    'discoverySourcePlaceholder' => 'Pilih sumber informasi',
                    'discoverySourceOtherLabel' => 'Sumber informasi lainnya',
                    'discoverySourceOtherPlaceholder' => 'Tuliskan sumber informasi...',
                    'recommendLegend' => 'Akan merekomendasikan ke teman atau keluarga?',
                    'recommendLowLabel' => 'Tidak',
                    'recommendHighLabel' => 'Sangat mungkin',
                    'highlightsLabel' => 'Aspek terbaik',
                    'improvementsLabel' => 'Aspek yang perlu diperbaiki',
                    'commentLabel' => 'Saran atau cerita pengalaman',
                    'commentPlaceholder' => 'Ceritakan momen yang berkesan atau saran spesifik...',
                    'publishConsent' => 'Saya mengizinkan kesan saya ditampilkan sebagai testimoni publik (tanpa data pribadi).',
                    'ratingLabels' => ['Pilih rating', 'Sangat kurang', 'Kurang', 'Cukup', 'Baik', 'Sangat baik'],
                ],
                'options' => [
                    'discoverySources' => [
                        ['value' => 'social_media', 'label' => 'Media sosial'],
                        ['value' => 'friends_family', 'label' => 'Teman atau keluarga'],
                        ['value' => 'school_institution', 'label' => 'Sekolah atau instansi'],
                        ['value' => 'web_search', 'label' => 'Situs web atau Google'],
                        ['value' => 'previous_visit', 'label' => 'Kunjungan sebelumnya'],
                        ['value' => 'other', 'label' => 'Lainnya'],
                    ],
                    'highlights' => ['Penyambutan', 'Tur area', 'Cerita sejarah', 'Dokumentasi', 'Penjelasan pemandu', 'Fasilitas'],
                    'improvements' => ['Waktu kunjungan', 'Akses informasi', 'Penjelasan pemandu', 'Fasilitas', 'Dokumentasi'],
                ],
                'gates' => [
                    'loadingTitle' => 'Memuat feedback',
                    'loadingMessage' => 'Kami sedang memeriksa tautan feedback kunjunganmu. Mohon tunggu sebentar.',
                    'invalidTitle' => 'Link feedback tidak valid',
                    'invalidMessage' => 'Periksa kembali tautan dari WhatsApp resmi ISTURA. Pastikan kode booking dan token tidak terpotong.',
                    'alreadySubmittedTitle' => 'Feedback sudah tercatat',
                    'alreadySubmittedMessage' => 'Terima kasih, masukan untuk kode kunjungan ini sudah kami terima.',
                    'unavailableTitle' => 'Link aktif setelah kunjungan selesai',
                    'unavailableMessage' => 'Form feedback akan terbuka setelah petugas menandai kunjunganmu selesai. Terima kasih sudah menanti.',
                    'restrictedLoadingTitle' => 'Memuat akses feedback',
                    'restrictedTitle' => 'Akses feedback dibatasi',
                    'restrictedLoadingMessage' => 'Kami sedang memeriksa data kunjungan yang tersedia. Mohon tunggu sebentar.',
                    'restrictedMessage' => 'Tautan feedback dikirim melalui WhatsApp setelah kunjungan selesai. Silakan tunggu pesan resmi dari ISTURA.',
                    'busyLabel' => 'Mohon tunggu',
                ],
                'success' => [
                    'eyebrow' => 'Terima kasih',
                    'title' => 'Feedback berhasil dikirim',
                    'message' => 'Cerita Bapak/Ibu membantu kami memperbaiki layanan ISTURA. Kunjungan dengan kode {kode} sudah terhubung dengan masukan ini.',
                ],
                'actions' => [
                    'backLabel' => 'Kembali',
                    'nextLabel' => 'Lanjut',
                    'submitLabel' => 'Kirim Feedback',
                    'homeLabel' => 'Kembali ke Beranda',
                ],
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
