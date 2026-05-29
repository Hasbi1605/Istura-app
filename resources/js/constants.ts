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
  UploadCloud,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ASSETS } from "./lib/assets";
import type { AdminTab, FaqItem, FooterContact, WaTemplate } from "./domain/types";

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
    helper: "Tuliskan nama instansi dan jumlah rombongan yang akan hadir.",
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
    helper: "Format yang didukung: PDF, JPG, JPEG, atau PNG dengan ukuran maksimal 10 MB.",
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
    points: ["Senin - Jumat", "08.00 - 14.00 WIB"],
  },
  {
    icon: FileCheck2,
    title: "Syarat Kunjungan",
    body: "Siapkan dokumen dan data utama sebelum mengisi form booking.",
    points: ["Surat permohonan resmi", "Data contact person", "Booking minimal H-5"],
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
      "Alur ini diprioritaskan untuk perwakilan instansi, sekolah, komunitas, atau organisasi yang mengajukan kunjungan rombongan.",
  },
  {
    id: "faq-rombongan",
    question: "Berapa jumlah maksimal rombongan?",
    answer:
      "Setiap kloter menampung maksimal 75 orang. Jika rombongan lebih dari 75 orang, tetap kirim booking terlebih dahulu, lalu admin akan menghubungi via WhatsApp untuk membicarakan pembagian kloter.",
  },
  {
    id: "faq-format-surat",
    question: "Format surat permohonan seperti apa?",
    answer:
      "Gunakan surat resmi berkop instansi, mencantumkan tanggal kunjungan, waktu, jumlah peserta, data koordinator, dan tanda tangan penanggung jawab.",
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
    image: "/assets/penyambutan.jpg",
  },
  {
    title: "Cerita Sejarah Gedung Agung",
    body: "Mengenal sejarah Gedung Agung sambil foto bersama di gedung induk.",
    image: "/assets/cerita-sejarah-gedung-agung.jpg",
  },
  {
    title: "Tur Museum",
    body: "Berkeliling melihat koleksi lukisan dan benda seni Istana Kepresidenan Yogyakarta.",
    image: "/assets/museum.jpg",
  },
  {
    title: "Perpustakaan",
    body: "Membaca koleksi buku Gedung Agung sambil beristirahat sejenak.",
    image: "/assets/perpustakaan.jpg",
  },
];

export const HERO_MESSAGES: Array<{ text: string; image: string }> = [
  { text: "Halo! Aku MIKY. Aku bantu pandu booking kunjunganmu.", image: ASSETS.mikyHero },
  { text: "Mau cek slot dulu? Klik Cek Jadwal ya.", image: ASSETS.mikyStep4 },
  { text: "Sudah siap? Yuk klik Mulai Booking.", image: ASSETS.mikyHero3 },
];

export const HERO_MESSAGES_MOBILE: Array<{ text: string; image: string }> = [
  { text: "Halo! Aku MIKY, pemandumu.", image: ASSETS.mikyHero },
  { text: "Cek jadwal dulu yuk.", image: ASSETS.mikyStep4 },
  { text: "Siap? Klik Mulai Booking.", image: ASSETS.mikyHero3 },
];

export const INITIAL_WA_TEMPLATES: WaTemplate[] = [
  {
    id: "Accepted",
    label: "Booking disetujui",
    description: "Dikirim saat admin menyetujui permohonan kunjungan.",
    template:
      "Yth. {nama}, permohonan kunjungan {instansi} dengan kode {kode} disetujui untuk {tanggal} pukul {jam} WIB. Mohon hadir 15 menit lebih awal dengan menunjukkan kode ini di pintu masuk. Terima kasih.",
  },
  {
    id: "Rejected",
    label: "Booking ditolak",
    description: "Dikirim saat permohonan tidak disetujui.",
    template:
      "Yth. {nama}, mohon maaf permohonan kunjungan {instansi} dengan kode {kode} belum dapat disetujui. Alasan: {catatan}",
  },
  {
    id: "Reschedule",
    label: "Tawaran reschedule",
    description: "Dikirim saat admin menawarkan jadwal alternatif.",
    template:
      "Yth. {nama}, permohonan {kode} perlu penyesuaian jadwal. Usulan jadwal: {catatan}. Mohon konfirmasi melalui WhatsApp ini.",
  },
  {
    id: "Completed",
    label: "Tandai selesai & permintaan feedback",
    description: "Dikirim setelah kunjungan selesai. {link} adalah tautan feedback unik.",
    template:
      "Yth. {nama}, terima kasih telah berkunjung ke Istana Kepresidenan Yogyakarta pada {tanggal}. Setelah melakukan ISTURA, Bapak/Ibu kami mohon untuk mengisi feedback pada link berikut: {link} agar kami dapat memperbaiki pelayanan kami setiap saat. Terima kasih.",
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
  { key: "feedback", label: "Feedback", icon: Inbox, status: "ready" },
  { key: "cms-faq", label: "FAQ", icon: MessageSquare, group: "Konten Web", status: "ready" },
  { key: "cms-letter", label: "Contoh Surat", icon: FileCheck2, group: "Konten Web", status: "ready" },
  { key: "cms-contacts", label: "Kontak Footer", icon: Phone, group: "Konten Web", status: "ready" },
  { key: "cms-hero", label: "Hero & Cerita", icon: ImageIcon, group: "Konten Web", status: "ready" },
  { key: "cms-wa", label: "Template Pesan WA", icon: MessageCircle, group: "Konten Web", status: "ready" },
  { key: "users", label: "Pengguna Admin", icon: UserCog, group: "Sistem", status: "ready" },
  { key: "audit", label: "Riwayat Aktivitas", icon: ListChecks, group: "Sistem", status: "ready" },
];
