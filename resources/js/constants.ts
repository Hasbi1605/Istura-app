import {
  BadgeCheck,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  MessageSquare,
  PenLine,
  Phone,
  ShieldCheck,
  Sparkles,
  Ticket,
  UploadCloud,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ASSETS } from "./lib/assets";
import type {
  AdminTab,
  BookingWizardContent,
  FaqItem,
  FeedbackWizardContent,
  FooterContact,
  LandingIconKey,
  SiteContent,
  WaTemplate,
} from "./domain/types";

export const INITIAL_FOOTER_CONTACTS: FooterContact[] = [
  {
    label: "Instagram",
    value: "istanakepresidenanyogyakarta",
    href: "https://www.instagram.com/istanakepresidenanyogyakarta/",
    iconKey: "instagram",
  },
  {
    label: "YouTube",
    value: "istanakepresidenanyogyakarta",
    href: "https://www.youtube.com/@istanakepresidenanyogyakarta",
    iconKey: "youtube",
  },
  {
    label: "WhatsApp",
    value: "0811 6030 0040",
    href: "https://wa.me/6281160300040",
    iconKey: "whatsapp",
  },
];

export const FEEDBACK_HIGHLIGHTS = [
  "Penyambutan",
  "Tur area",
  "Cerita sejarah",
  "Dokumentasi",
  "Penjelasan pemandu",
  "Fasilitas",
];

export const FEEDBACK_IMPROVEMENTS = [
  "Waktu kunjungan",
  "Akses informasi",
  "Penjelasan pemandu",
  "Fasilitas",
  "Dokumentasi",
  "Lainnya",
];

export const RATING_LABELS = [
  "Pilih rating",
  "Sangat kurang",
  "Kurang",
  "Cukup",
  "Baik",
  "Sangat baik",
];

export const storyWords = "Pilih jadwal, isi data, unggah surat, lalu tunggu konfirmasi WhatsApp.".split(" ");

export const wizardSteps = [
  {
    title: "Selamat Datang",
    helper: "Siapkan data contact person, nomor WhatsApp aktif, rencana tanggal, dan surat permohonan.",
    miky: "Halo! Aku MIKY. Kita akan mengisi pendaftaran kunjungan secara bertahap.",
    icon: Sparkles,
    image: ASSETS.mikyStep1,
  },
  {
    title: "Data Contact Person",
    helper: "Data ini digunakan admin untuk menghubungi perwakilan rombongan.",
    miky: "Pastikan nomor WhatsApp aktif karena konfirmasi akan dikirim melalui nomor ini.",
    icon: Users,
    image: ASSETS.mikyStep2,
  },
  {
    title: "Data Instansi",
    helper: "Tuliskan nama instansi dan estimasi jumlah rombongan yang akan hadir.",
    miky: "Nama instansi membantu admin memverifikasi permohonan kunjunganmu.",
    icon: ClipboardCheck,
    image: ASSETS.mikyStep3,
  },
  {
    title: "Pilih Jadwal",
    helper: "Pilih tanggal dan jam yang masih tersedia. Jadwal pending tetap terkunci.",
    miky: "Jadwal abu-abu sudah terisi atau belum dibuka. Pilih slot berwarna gold.",
    icon: CalendarDays,
    image: ASSETS.mikyStep4,
  },
  {
    title: "Upload Surat",
    helper: "Format yang didukung: PDF, JPG, JPEG, atau PNG dengan ukuran maksimal 5 MB.",
    miky: "Unggah surat permohonan resmi dari instansi agar admin bisa melakukan pengecekan.",
    icon: UploadCloud,
    image: ASSETS.mikyStep5,
  },
  {
    title: "Review Data",
    helper: "Periksa kembali semua data sebelum permohonan dikirim.",
    miky: "Cek ulang nama, jadwal, dan surat. Setelah submit, jadwal akan langsung terkunci.",
    icon: FileCheck2,
    image: ASSETS.mikyStep7,
  },
  {
    title: "Pernyataan",
    helper: "Setujui pernyataan kebenaran data dan kesediaan mengikuti aturan kunjungan.",
    miky: "Kalau datanya sudah benar, centang pernyataan lalu kirim permohonan.",
    icon: ShieldCheck,
    image: ASSETS.mikyStep6,
  },
  {
    title: "Selesai",
    helper: "Permohonan masuk ke dashboard admin dengan status Pending.",
    miky: "Permohonan berhasil dikirim. Admin akan menghubungi maksimal 1x24 jam.",
    icon: BadgeCheck,
    image: ASSETS.mikyStep8,
  },
];

export const DEFAULT_BOOKING_WIZARD_CONTENT: BookingWizardContent = {
  steps: wizardSteps.map(({ title, helper, miky }) => ({ title, helper, miky })),
  preparation: {
    items: ["Data contact person", "Nomor WhatsApp aktif", "Tanggal kunjungan", "Surat permohonan"],
    scheduleLinkLabel: "Cek jadwal",
    letterLinkLabel: "Lihat contoh",
  },
  fields: {
    contactNameLabel: "Nama Lengkap CP",
    nikLabel: "NIK KTP",
    whatsappLabel: "Nomor WhatsApp CP",
    whatsappHelper: "Contoh 08xxxxxxxxxx",
    institutionLabel: "Asal Instansi",
    groupSizeLabel: "Jumlah Rombongan",
  },
  schedule: {
    timeTitle: "Pilih Jam Kunjungan",
    emptyDateLabel: "Pilih tanggal terlebih dahulu",
    emptySlotLabel: "Tidak ada slot pada tanggal ini.",
    legendLabel: "Keterangan:",
  },
  upload: {
    readyLabel: "File siap dikirim",
    emptyTitle: "Unggah surat permohonan",
    selectedTitle: "Surat berhasil dipilih",
    helper: "PDF, JPG, JPEG, atau PNG. Maksimal 5 MB.",
    chooseLabel: "Pilih File",
    replaceLabel: "Ganti File",
  },
  agreementText:
    "Saya menyatakan data yang diisi benar dan rombongan bersedia mengikuti aturan kunjungan Istana Kepresidenan Yogyakarta.",
  successMessage:
    "Permohonan berhasil dikirim dengan status Pending. Admin akan menghubungi maksimal 1x24 jam melalui WhatsApp.",
  actions: {
    backLabel: "Kembali",
    nextLabel: "Lanjut",
    submitLabel: "Submit Booking",
    homeLabel: "Kembali ke Beranda",
  },
};

export const DEFAULT_FEEDBACK_WIZARD_CONTENT: FeedbackWizardContent = {
  intro: "Bagikan pengalaman kunjunganmu di Istana Kepresidenan Yogyakarta.",
  steps: {
    rating: {
      title: "Penilaian Inti",
      bubbleTitle: "Beri bintangmu",
      bubbleEmpty: "Halo! Bagaimana pengalaman kunjunganmu? Beri bintang di tiga aspek ini ya.",
      bubbleLow: "Maaf belum sesuai harapan. Lengkapi dulu, nanti kita ceritakan di langkah terakhir.",
      bubbleNeutral: "Cukup baik. Lanjut ke aspek yang lain ya.",
      bubbleHigh: "Senang mendengarnya! Lanjut sebentar.",
    },
    details: {
      title: "Detail Pengalaman",
      bubbleTitle: "Cerita lebih dalam",
      bubbleEmpty: "Sekarang, seberapa besar kamu mau merekomendasikan ISTURA?",
      bubbleHighlightsEmpty: "Mantap. Bagian mana yang paling berkesan?",
      bubbleDone: "Boleh juga sebut yang masih perlu diperbaiki, opsional saja.",
    },
    comment: {
      title: "Cerita & Kirim",
      bubbleTitle: "Tinggal sedikit lagi",
      bubbleEmpty: "Ceritakan momen yang paling berkesan, atau langsung kirim saja.",
      bubbleDone: "Terima kasih ceritanya. Tekan kirim kalau sudah siap.",
    },
  },
  fields: {
    ratingLabel: "Kepuasan keseluruhan",
    bookingEaseLabel: "Kemudahan proses booking online",
    serviceLabel: "Pelayanan petugas saat kunjungan",
    recommendLegend: "Akan merekomendasikan ke teman atau keluarga?",
    recommendLowLabel: "Tidak",
    recommendHighLabel: "Sangat mungkin",
    highlightsLabel: "Aspek terbaik",
    improvementsLabel: "Aspek yang perlu diperbaiki (opsional)",
    commentLabel: "Saran atau cerita pengalaman",
    commentPlaceholder: "Ceritakan momen yang berkesan atau saran spesifik...",
    publishConsent: "Saya mengizinkan kesan saya ditampilkan sebagai testimoni publik (tanpa data pribadi).",
    ratingLabels: RATING_LABELS,
  },
  options: {
    highlights: FEEDBACK_HIGHLIGHTS,
    improvements: FEEDBACK_IMPROVEMENTS,
  },
  gates: {
    loadingTitle: "Memuat feedback",
    loadingMessage: "Kami sedang memeriksa tautan feedback kunjunganmu. Mohon tunggu sebentar.",
    invalidTitle: "Link feedback tidak valid",
    invalidMessage:
      "Periksa kembali tautan dari WhatsApp resmi ISTURA. Pastikan kode booking dan token tidak terpotong.",
    alreadySubmittedTitle: "Feedback sudah tercatat",
    alreadySubmittedMessage: "Terima kasih, masukan untuk kode kunjungan ini sudah kami terima.",
    unavailableTitle: "Link aktif setelah kunjungan selesai",
    unavailableMessage:
      "Form feedback akan terbuka setelah petugas menandai kunjunganmu selesai. Terima kasih sudah menanti.",
    restrictedLoadingTitle: "Memuat akses feedback",
    restrictedTitle: "Akses feedback dibatasi",
    restrictedLoadingMessage: "Kami sedang memeriksa data kunjungan yang tersedia. Mohon tunggu sebentar.",
    restrictedMessage:
      "Tautan feedback dikirim melalui WhatsApp setelah kunjungan selesai. Silakan tunggu pesan resmi dari ISTURA.",
    busyLabel: "Mohon tunggu",
  },
  success: {
    eyebrow: "Terima kasih",
    title: "Feedback berhasil dikirim",
    message:
      "Cerita Bapak/Ibu membantu kami memperbaiki layanan ISTURA. Kunjungan dengan kode {kode} sudah terhubung dengan masukan ini.",
  },
  actions: {
    backLabel: "Kembali",
    nextLabel: "Lanjut",
    submitLabel: "Kirim Feedback",
    homeLabel: "Kembali ke Beranda",
  },
};

export const quickInfoCards: Array<{
  icon: LucideIcon;
  title: string;
  body: string;
  points: string[];
}> = [
  {
    icon: Clock3,
    title: "Jam Kunjungan",
    body: "Kunjungan dibuka pada hari kerja sesuai jadwal layanan ISTURA.",
    points: ["Senin - Kamis", "08.00 - 11.00 & 13.00 - 14.00 WIB", "Istirahat 12.00 - 13.00"],
  },
  {
    icon: FileCheck2,
    title: "Syarat Kunjungan",
    body: "Siapkan dokumen dan data utama sebelum mengisi form booking.",
    points: ["Surat permohonan resmi", "Data contact person", "Jadwal masih tersedia"],
  },
  {
    icon: MessageCircle,
    title: "Konfirmasi WhatsApp",
    body: "Admin akan menghubungi contact person setelah data permohonan masuk.",
    points: ["Maksimal 1x24 jam", "Gunakan nomor WhatsApp aktif"],
  },
];

export const bookingProcessCards: Array<{
  icon: LucideIcon;
  title: string;
  body: string;
}> = [
  {
    icon: CalendarDays,
    title: "Pilih jadwal",
    body: "Cek kalender dua bulan ke depan, lalu pilih tanggal dan jam yang masih tersedia.",
  },
  {
    icon: PenLine,
    title: "Isi data",
    body: "Masukkan nama contact person, NIK, WhatsApp aktif, asal instansi, dan jumlah rombongan.",
  },
  {
    icon: UploadCloud,
    title: "Unggah surat",
    body: "Lampirkan surat permohonan resmi dari instansi agar admin dapat melakukan verifikasi.",
  },
  {
    icon: MessageCircle,
    title: "Tunggu WhatsApp",
    body: "Admin mengirim keputusan, penolakan, atau opsi reschedule melalui WhatsApp.",
  },
];

export const letterChecklist = [
  "Kop surat resmi instansi atau organisasi.",
  "Perihal permohonan kunjungan dan tujuan surat yang jelas.",
  "Tanggal, waktu, jumlah peserta, nama koordinator, NIK, dan nomor HP.",
  "Tanda tangan kepala instansi atau penanggung jawab.",
];

export const INITIAL_FAQ_ITEMS: FaqItem[] = [
  {
    id: "faq-h5",
    question: "Apakah booking harus dilakukan minimal H-5?",
    answer:
      "Ya. Permohonan sebaiknya dikirim minimal H-5 dari tanggal kunjungan agar admin memiliki waktu untuk pengecekan jadwal dan surat.",
  },
  {
    id: "faq-individu",
    question: "Apakah pengunjung individu bisa mendaftar?",
    answer:
      "Bisa. Pendaftar individu atau kelompok biasa tetap dapat mengajukan kunjungan melalui form booking. Cukup isi data sebagai koordinator dan lampirkan surat permohonan bertanda tangan (tidak harus berkop resmi). Alur ini memang diprioritaskan untuk rombongan instansi/sekolah/komunitas, namun terbuka untuk siapa saja.",
  },
  {
    id: "faq-rombongan",
    question: "Berapa jumlah maksimal rombongan?",
    answer:
      "Kapasitas per kloter adalah 80 orang. Jika rombongan lebih besar, sistem akan membantu pembagian kloter saat booking dan contact person tetap bisa berdiskusi dengan admin melalui WhatsApp.",
  },
  {
    id: "faq-format-surat",
    question: "Format surat permohonan seperti apa?",
    answer:
      "Bagi instansi/organisasi resmi, wajib menggunakan surat berkop resmi. Untuk pendaftar individu atau kelompok biasa, cukup surat permohonan kunjungan bertanda tangan koordinator (tidak harus berkop). Semua surat wajib mencantumkan: tanggal kunjungan, waktu, jumlah peserta, data koordinator, dan tanda tangan penanggung jawab.",
    link: { label: "Lihat contoh surat", href: "#contoh-surat" },
  },
  {
    id: "faq-biaya",
    question: "Apakah ada biaya untuk berkunjung?",
    answer:
      "Tidak ada biaya. Istura merupakan program kunjungan Istana Untuk Rakyat yang dibuka gratis bagi seluruh masyarakat.",
  },
  {
    id: "faq-penuh",
    question: "Bagaimana jika jadwal yang diinginkan penuh?",
    answer:
      "Pilih slot lain yang masih tersedia. Jika admin menawarkan reschedule, konfirmasi akan dikirim melalui WhatsApp contact person.",
  },
];

export const accordionItems = [
  {
    title: "Penyambutan",
    body: "Arahan awal dan foto sambutan di pelataran wapres.",
    image: "/assets/penyambutan.webp",
  },
  {
    title: "Cerita Sejarah Gedung Agung",
    body: "Mengenal sejarah Gedung Agung sambil foto bersama di gedung induk.",
    image: "/assets/cerita-sejarah-gedung-agung.webp",
  },
  {
    title: "Tur Museum",
    body: "Berkeliling melihat koleksi lukisan dan benda seni Istana Kepresidenan Yogyakarta.",
    image: "/assets/museum.webp",
  },
  {
    title: "Perpustakaan",
    body: "Membaca koleksi buku Gedung Agung sambil beristirahat sejenak.",
    image: "/assets/perpustakaan.webp",
  },
];

export const LANDING_ICON_OPTIONS: Array<{ key: LandingIconKey; label: string }> = [
  { key: "clock", label: "Jam" },
  { key: "file-check", label: "Dokumen" },
  { key: "message-circle", label: "Pesan" },
  { key: "calendar", label: "Kalender" },
  { key: "pen", label: "Isi data" },
  { key: "upload", label: "Upload" },
  { key: "map-pin", label: "Lokasi" },
  { key: "image", label: "Gambar" },
];

export const DEFAULT_SITE_CONTENT: SiteContent = {
  nav: {
    logoSrc: ASSETS.logoGold,
    logoAlt: "Logo Gedung Agung",
    brandText: "ISTURA",
    ctaLabel: "Mulai Booking",
    items: [
      { label: "Beranda", target: "home" },
      { label: "Cek Jadwal", target: "#panduan" },
      { label: "Contoh Surat", target: "#contoh-surat" },
      { label: "Peraturan", target: "#peraturan" },
      { label: "FAQ", target: "#faq" },
    ],
  },
  quickInfo: {
    title: "Sebelum booking, siapkan tiga hal utama.",
    description:
      "Ringkasan ini membantu pengunjung tahu jadwal, syarat, dan kanal konfirmasi tanpa harus membaca formulir panjang.",
    cards: [
      {
        iconKey: "clock",
        title: "Jam Kunjungan",
        body: "Kunjungan dibuka pada hari kerja sesuai jadwal layanan ISTURA.",
        points: ["Senin - Kamis", "08.00 - 11.00 & 13.00 - 14.00 WIB", "Istirahat 12.00 - 13.00"],
      },
      {
        iconKey: "file-check",
        title: "Syarat Kunjungan",
        body: "Siapkan dokumen dan data utama sebelum mengisi form booking.",
        points: ["Surat permohonan resmi", "Data contact person", "Jadwal masih tersedia"],
      },
      {
        iconKey: "message-circle",
        title: "Konfirmasi WhatsApp",
        body: "Admin akan menghubungi contact person setelah data permohonan masuk.",
        points: ["Maksimal 1x24 jam", "Gunakan nomor WhatsApp aktif"],
      },
    ],
  },
  schedule: {
    title: "Jadwal Kunjungan ISTURA",
    description:
      "Cek slot tersedia sebelum booking. Kalender dibuka dua bulan ke depan; ikuti hari yang ditandai sebagai tersedia.",
  },
  video: {
    title: "Virtual Tour - Istana Kepresidenan Yogyakarta",
    url: "https://www.youtube.com/embed/YhE3H8mCFV4?start=4&rel=0&modestbranding=1",
  },
  bookingSteps: {
    title: "Booking dalam 4 langkah.",
    story: storyWords.join(" "),
    cards: [
      {
        iconKey: "calendar",
        title: "Pilih jadwal",
        body: "Cek kalender dua bulan ke depan, lalu pilih tanggal dan jam yang masih tersedia.",
      },
      {
        iconKey: "pen",
        title: "Isi data",
        body: "Masukkan nama contact person, NIK, WhatsApp aktif, asal instansi, dan jumlah rombongan.",
      },
      {
        iconKey: "upload",
        title: "Unggah surat",
        body: "Lampirkan surat permohonan resmi dari instansi agar admin dapat melakukan verifikasi.",
      },
      {
        iconKey: "message-circle",
        title: "Tunggu WhatsApp",
        body: "Admin mengirim keputusan, penolakan, atau opsi reschedule melalui WhatsApp.",
      },
    ],
  },
  activities: {
    title: "Hal apa saja yang akan kamu lakukan di Istana.",
    description: "Empat momen kunjungan diringkas menjadi panel visual yang mudah dipindai.",
    items: accordionItems,
  },
  rulesSection: {
    title: "Aturan & Tata Tertib Kunjungan ISTURA.",
    description:
      "Mohon patuhi seluruh peraturan di bawah ini agar kunjungan Anda di Istana Kepresidenan Yogyakarta berjalan dengan tertib, aman, dan nyaman.",
    rulesKicker: "Tata tertib",
    rulesTitle: "Peraturan Kunjungan Istana Kepresidenan Yogyakarta",
    rulesList: [
      "Berpakaian sopan, rapi, bersepatu",
      "Dilarang menggunakan kaos oblong, celana jeans, dan celana pendek",
      "Dilarang membawa makanan & minuman",
      "Dilarang parkir dalam Istana",
      "HP dan kamera profesional dititipkan koordinator kunjungan",
      "Dilarang mengambil gambar di dalam museum dan area dalam gedung induk",
      "Kunjungan akan didokumentasikan pihak istana dan link akan dikirimkan melalui koordinator kunjungan",
      "Dimohon mengisi kuisoner dan penilaian",
    ],
    buttonLabel: "Mulai Booking",
  },
  letterSection: {
    title: "Contoh surat permohonan ISTURA.",
    description: "Gunakan contoh ini sebagai acuan format surat resmi sebelum mengunggah dokumen booking.",
    formatKicker: "Format dokumen",
    formatTitle: "Yang perlu dicantumkan di surat.",
    uploadNote: "Upload mendukung PDF, JPG, JPEG, atau PNG. Maksimal 5 MB.",
    buttonLabel: "Mulai Booking",
  },
  faq: {
    title: "Pertanyaan yang paling sering muncul.",
    description: "Jawaban ringkas untuk hal yang biasanya ditanyakan sebelum pengunjung mengirim permohonan.",
  },
  cta: {
    title: "Siap mengajukan kunjungan ISTURA?",
    body: "Mulai dari jadwal yang tersedia, unggah surat permohonan, lalu tunggu konfirmasi admin maksimal 1x24 jam melalui WhatsApp.",
    buttonLabel: "Mulai Booking Sekarang",
    backgroundImage: "/assets/hero-istana.webp",
  },
  footer: {
    logoSrc: ASSETS.logoGold,
    logoAlt: "Gedung Agung",
    scheduleLabel: "Jadwal buka",
    scheduleDays: "Senin - Kamis",
    scheduleHours: "08.00 - 11.00 & 13.00 - 14.00 WIB (istirahat 12.00 - 13.00)",
    mapUrl: "https://maps.app.goo.gl/iuAhnPB1SkJLMaX9A",
    mapEmbedUrl: "https://www.google.com/maps?q=Gedung+Agung+Yogyakarta&output=embed",
    address:
      "Jl. Jend. Ahmad Yani, Ngupasan, Kec. Gondomanan, Kota Yogyakarta, Daerah Istimewa Yogyakarta 55122",
    copyright: "\u00a9 2026 Istana Kepresidenan Yogyakarta / Gedung Agung. Seluruh hak cipta dilindungi.",
  },
  floatingContact: {
    greeting: "Ada yang bisa kubantu soal kunjungan ISTURA? Pilih topik di bawah ya.",
    topics: [
      {
        label: "Tanya jadwal kunjungan",
        message:
          "Halo Admin ISTURA, saya ingin menanyakan jadwal kunjungan ke Istana Kepresidenan Yogyakarta.",
      },
      {
        label: "Bantuan proses booking",
        message: "Halo Admin ISTURA, saya butuh bantuan terkait proses booking kunjungan ISTURA.",
      },
      {
        label: "Informasi umum",
        message: "Halo Admin ISTURA, saya ingin menanyakan informasi umum seputar kunjungan ISTURA.",
      },
    ],
  },
  openBanner: {
    tickerText: "Pendaftaran kunjungan perorangan gratis, tanpa surat. Pilih harimu, siapa cepat dia dapat!",
  },
  bookingWizard: DEFAULT_BOOKING_WIZARD_CONTENT,
  feedbackWizard: DEFAULT_FEEDBACK_WIZARD_CONTENT,
};

export const HERO_MESSAGES: Array<{ text: string; image: string }> = [
  { text: "Halo! Aku MIKY, pemandu virtual Istana Kepresidenan Yogyakarta. Aku bantu pandu booking-mu ya.", image: ASSETS.mikyStep1 },
  { text: "Mau cek slot dulu? Klik Cek Jadwal ya.", image: ASSETS.mikyStep4 },
  { text: "Sudah siap? Yuk klik Mulai Booking.", image: ASSETS.mikyHero3 },
];

export const HERO_MESSAGES_MOBILE: Array<{ text: string; image: string }> = [
  { text: "Halo! Aku MIKY, pemandu Istana Yogyakarta.", image: ASSETS.mikyStep1 },
  { text: "Cek jadwal dulu yuk.", image: ASSETS.mikyStep4 },
  { text: "Siap? Klik Mulai Booking.", image: ASSETS.mikyHero3 },
];

export const INITIAL_WA_TEMPLATES: WaTemplate[] = [
  {
    id: "Accepted",
    label: "Booking disetujui",
    description: "Dikirim saat admin menyetujui permohonan kunjungan.",
    template: [
      "Halo Rencang Istana! \u{1F60A}",
      "salam Humas Gedung Agung",
      "",
      "Terkait surat permohonan kunjungan Istura (Istana Untuk Rakyat) atas nama *{nama}* dari *{instansi}* sudah kami terima dan disetujui. \u{1F389}",
      "",
      "Berikut jadwal kunjungan yang telah terjadwal:",
      "\u{1F4C6} Tanggal: *{tanggal}*",
      "\u23F0 Jam: {jam}",
      "\u{1F46B} Rombongan: *{rombongan}*",
      "",
      "Kode booking: *{kode}*",
      "",
      "Alur & peraturan kunjungan dapat dilihat di sini:",
      "{alur}",
      "",
      "NB: dimohon datang sesuai waktu jadwal kunjungan yang telah ditentukan, karena adanya jadwal kunjungan kelompok/instansi lainnya.",
      "",
      "Untuk update informasi seputar Gedung Agung, jangan lupa follow IG @istanakepresidenanyogyakarta \u{1F64F}\u{1F917}",
    ].join("\n"),
  },
  {
    id: "Rejected",
    label: "Booking ditolak",
    description: "Dikirim saat permohonan tidak disetujui.",
    template: [
      "Halo Rencang Istana! \u{1F60A}",
      "salam Humas Gedung Agung",
      "",
      "Terkait surat permohonan kunjungan Istura (Istana Untuk Rakyat) atas nama *{nama}* dari *{instansi}* dengan kode booking *{kode}*, mohon maaf permohonan belum dapat kami setujui saat ini. \u{1F64F}",
      "",
      "Alasan/catatan:",
      "*{catatan}*",
      "",
      "Silakan hubungi kami melalui WhatsApp ini apabila membutuhkan informasi lebih lanjut atau ingin mengajukan permohonan baru.",
      "",
      "Terima kasih atas pengertiannya,",
      "Humas Gedung Agung",
    ].join("\n"),
  },
  {
    id: "Reschedule",
    label: "Tawaran reschedule",
    description: "Dikirim saat admin menawarkan jadwal alternatif.",
    template: [
      "Halo Rencang Istana! \u{1F60A}",
      "salam Humas Gedung Agung",
      "",
      "Terkait surat permohonan kunjungan Istura (Istana Untuk Rakyat) atas nama *{nama}* dari *{instansi}* dengan kode booking *{kode}*, terdapat penyesuaian jadwal yang perlu kami sampaikan. \u{1F501}",
      "",
      "Berikut usulan jadwal kunjungan:",
      "\u{1F4C6} Tanggal: *{tanggal_usulan}*",
      "\u23F0 Jam: {jam}",
      "\u{1F46B} Rombongan: *{rombongan}*",
      "",
      "Catatan admin:",
      "*{catatan}*",
      "",
      "Mohon konfirmasi melalui WhatsApp ini apakah jadwal tersebut dapat diikuti.",
      "",
      "Terima kasih atas kerja samanya,",
      "Humas Gedung Agung",
    ].join("\n"),
  },
  {
    id: "Pending",
    label: "Reschedule dibatalkan",
    description: "Dikirim saat usulan reschedule dibatalkan dan booking kembali menunggu konfirmasi.",
    template: [
      "Halo Rencang Istana! \u{1F60A}",
      "salam Humas Gedung Agung",
      "",
      "Terkait booking kunjungan Istura (Istana Untuk Rakyat) atas nama *{nama}* dari *{instansi}* dengan kode booking *{kode}*, kami informasikan bahwa usulan perubahan jadwal belum dilanjutkan. \u{23F3}",
      "",
      "Status saat ini: *menunggu konfirmasi ulang dari admin*.",
      "",
      "\u{1F4C6} Tanggal kunjungan awal: *{tanggal_awal}*",
      "\u23F0 Jam: {jam}",
      "",
      "Catatan admin:",
      "*{catatan}*",
      "",
      "Kami akan mengirimkan konfirmasi lanjutan setelah jadwal final ditetapkan. Mohon ditunggu, ya.",
      "",
      "Terima kasih atas kesabarannya,",
      "Humas Gedung Agung",
    ].join("\n"),
  },
  {
    id: "Expired",
    label: "Booking kedaluwarsa",
    description: "Dikirim saat jadwal pending sudah terlewat tanpa keputusan admin.",
    template: [
      "Halo Rencang Istana! \u{1F60A}",
      "salam Humas Gedung Agung",
      "",
      "Terkait permohonan kunjungan Istura (Istana Untuk Rakyat) atas nama *{nama}* dari *{instansi}* dengan kode booking *{kode}*, kami informasikan bahwa jadwal yang diajukan telah terlewat tanpa konfirmasi. \u23F0",
      "",
      "\u{1F4C6} Tanggal awal: *{tanggal_awal}*",
      "\u23F0 Jam: {jam}",
      "",
      "Silakan menunggu tawaran jadwal baru dari kami atau melakukan booking ulang melalui website sesuai slot yang tersedia.",
      "",
      "Mohon maaf atas ketidaknyamanannya,",
      "Humas Gedung Agung",
    ].join("\n"),
  },
  {
    id: "Completed",
    label: "Tandai selesai & permintaan feedback",
    description: "Dikirim setelah kunjungan selesai. {dokumentasi} = link dokumentasi, {link} = tautan kuesioner/feedback unik.",
    template: [
      "Halo kak {nama} \u{1F64C}",
      "Salam dari Humas Istana Kepresidenan Yogyakarta (Gedung Agung)",
      "",
      "Terima kasih atas kunjungan {instansi} ke Gedung Agung. Berikut kami kirimkan link dokumentasi ISTURA (Istana Untuk Rakyat). Kami anjurkan untuk segera mengunduh foto karena dalam 2 hari ke depan link akan kami hapus. Dimohon juga untuk berkenan mengisi kuesioner kunjungan ISTURA di Gedung Agung.",
      "",
      "1. Link Dokumentasi \u{1F447}",
      "{dokumentasi}",
      "",
      "2. Link Kuesioner \u{1F447}",
      "{link}",
      "",
      "------------------------------------",
      "Silakan ikuti media sosial kami untuk update informasi dan kegiatan Istana Kepresidenan Yogyakarta \u{1F60A}",
      "Instagram: https://www.instagram.com/istanakepresidenanyogyakarta/",
      "YouTube: https://www.youtube.com/@istanakepresidenanyogyakarta",
      "",
      "#istanakepresidenanyogyakarta #gedungagung",
    ].join("\n"),
  },
];

export type AdminMenuItem = {
  key: AdminTab;
  label: string;
  icon: LucideIcon;
  group?: string;
  status?: "ready" | "soon";
};

export const ADMIN_MENU: AdminMenuItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, status: "ready" },
  { key: "bookings", label: "Booking", icon: ClipboardCheck, status: "ready" },
  { key: "schedule", label: "Jadwal Kunjungan", icon: CalendarDays, status: "ready" },
  { key: "istura-open", label: "Istura Open", icon: Ticket, status: "ready" },
  { key: "feedback", label: "Feedback", icon: Inbox, status: "ready" },
  { key: "cms-faq", label: "FAQ", icon: MessageSquare, group: "Konten Web", status: "ready" },
  { key: "cms-letter", label: "Ketentuan Kunjungan", icon: ClipboardCheck, group: "Konten Web", status: "ready" },
  { key: "cms-contacts", label: "Kontak Footer", icon: Phone, group: "Konten Web", status: "ready" },
  { key: "cms-hero", label: "Hero & Cerita", icon: ImageIcon, group: "Konten Web", status: "ready" },
  { key: "cms-landing", label: "Landing Page", icon: LayoutDashboard, group: "Konten Web", status: "ready" },
  { key: "cms-wa", label: "Template Pesan WA", icon: MessageCircle, group: "Konten Web", status: "ready" },
  { key: "users", label: "Pengguna Admin", icon: UserCog, group: "Sistem", status: "ready" },
  { key: "audit", label: "Riwayat Aktivitas", icon: ListChecks, group: "Sistem", status: "ready" },
];
