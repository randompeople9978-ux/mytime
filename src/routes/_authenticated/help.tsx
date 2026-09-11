import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Shell } from "@/components/Shell";

export const Route = createFileRoute("/_authenticated/help")({
  component: HelpPage,
});

interface Step {
  title: string;
  steps: string[];
}

const GUIDES: Step[] = [
  {
    title: "Cara berteman (kirim, terima, tolak)",
    steps: [
      "Buka menu Cari akun, lalu ketik username (mis. @budi) atau nama tampilan.",
      "Klik akunnya untuk membuka profil publik /u/username.",
      "Tekan tombol Tambah teman — permintaan terkirim dan berstatus 'Menunggu'.",
      "Orang yang dituju membuka halaman Pertemanan > tab Permintaan, lalu tekan centang untuk Terima atau X untuk Tolak.",
      "Setelah diterima, kalian muncul di tab Teman dan inbox pertemanan aktif untuk chat cepat.",
    ],
  },
  {
    title: "Chat penjual/pembeli tanpa harus berteman",
    steps: [
      "Buka halaman detail jualan atau profil penjual.",
      "Tekan Chat. Kamu langsung masuk ke ruang percakapan pribadi.",
      "Kirim teks atau gambar dari galeri lewat ikon gambar.",
      "Tekan ikon pensil pada pesanmu untuk mengedit, ikon tong sampah untuk menghapus.",
      "Semua riwayat chat tersimpan dan bisa dibuka lagi dari menu Pesan.",
    ],
  },
  {
    title: "Blokir & buka blokir",
    steps: [
      "Di ruang chat, tekan ikon larangan (Ban) untuk memblokir.",
      "Setelah diblokir, kedua pihak tidak bisa saling kirim pesan, permintaan teman, atau panggilan.",
      "Buka Pertemanan > tab Diblokir, lalu tekan Buka blokir untuk membatalkan.",
    ],
  },
  {
    title: "Follow, followers, dan mengikuti",
    steps: [
      "Buka profil publik akun mana pun.",
      "Tekan Ikuti untuk mengikuti; tekan lagi untuk berhenti mengikuti.",
      "Angka Pengikut dan Mengikuti di profil bisa ditekan untuk melihat daftarnya.",
      "Follow tidak butuh persetujuan — beda dengan pertemanan.",
    ],
  },
  {
    title: "Panggilan suara (voice call) di website",
    steps: [
      "Buka ruang chat dengan orang yang ingin ditelepon, tekan ikon telepon.",
      "Izinkan akses mikrofon saat browser meminta.",
      "Penerima akan melihat kartu panggilan masuk dengan tombol Terima / Tolak.",
      "Setelah tersambung, timer durasi berjalan otomatis.",
      "Untuk merekam, KEDUA pihak harus mencentang 'Saya setuju direkam'. Rekaman baru mulai saat dua-duanya setuju.",
      "Saat panggilan berakhir, hasil rekaman bisa diputar dan diunduh.",
    ],
  },
  {
    title: "Membuka lapak & mengedit jualan",
    steps: [
      "Tekan tombol + di navigasi bawah untuk membuat jualan.",
      "Unggah foto dari galeri, isi kategori, jam buka, produk, dan lokasi.",
      "Jualan yang sudah tayang tetap bisa diubah: buka Profil > Jualanku > ikon pensil.",
      "Maksimal 3 jualan per akun.",
    ],
  },
  {
    title: "Wishlist & jualan terdekat",
    steps: [
      "Tekan ikon hati pada jualan untuk menyimpan sebagai rencana beli lain hari.",
      "Lihat semuanya di menu Wishlist.",
      "Aktifkan lokasi di Pengaturan untuk melihat jarak dan daftar jualan di sekitarmu.",
    ],
  },
];

function HelpPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Shell>
      <div style={{ padding: "18px 18px 6px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 22, margin: "0 0 4px" }}>Tutorial Pemakaian</h1>
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 12px" }}>
          Panduan singkat semua fitur: pertemanan, chat, panggilan suara, jualan, wishlist, dan lokasi.
        </p>
        <div className="chip-row" style={{ padding: 0 }}>
          <Link to="/settings" className="chip">Pengaturan</Link>
          <Link to="/profile" className="chip">Profil</Link>
        </div>
      </div>

      <div style={{ padding: "6px 18px 24px", display: "grid", gap: 10 }}>
        {GUIDES.map((g, i) => (
          <div key={g.title} className="card" style={{ padding: 0, overflow: "hidden" }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "13px 14px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 600,
                fontSize: 13.5,
                textAlign: "left",
              }}
              aria-expanded={open === i}
            >
              <span style={{ flex: 1 }}>{g.title}</span>
              <ChevronDown size={16} style={{ transform: open === i ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </button>
            {open === i && (
              <ol style={{ margin: 0, padding: "0 18px 16px 34px", display: "grid", gap: 7, fontSize: 12.8, color: "var(--ink-soft)" }}>
                {g.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}
