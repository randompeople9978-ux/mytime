import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Syarat Layanan — MAUJAJAN INDONESIA" },
      { name: "description", content: "Syarat dan ketentuan penggunaan MAUJAJAN INDONESIA untuk pembeli dan penjual." },
      { property: "og:title", content: "Syarat Layanan — MAUJAJAN" },
      { property: "og:description", content: "Syarat layanan MAUJAJAN INDONESIA." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <Shell>
      <article style={{ padding: "26px 20px 40px", maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 26 }}>Syarat Layanan</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 12.5, margin: "0 0 22px" }}>Terakhir diperbarui: 26 Juli 2026</p>

        <p>Dengan menggunakan MAUJAJAN INDONESIA, kamu setuju pada syarat di bawah ini.</p>

        <h2>1. Akun</h2>
        <ul>
          <li>Satu orang boleh punya lebih dari satu akun, tetapi setiap akun tunduk pada aturan yang sama.</li>
          <li>Kamu bertanggung jawab menjaga kerahasiaan kata sandi.</li>
        </ul>

        <h2>2. Batas Jualan</h2>
        <p>Setiap akun maksimal boleh memiliki <strong>3 jualan aktif</strong>. Untuk menambah lebih banyak, gunakan akun berbeda.</p>

        <h2>3. Konten yang Dilarang</h2>
        <ul>
          <li>Penipuan, deskripsi bohong, atau barang berbahaya. Laporan pada alasan ini otomatis diteruskan ke admin dan bisa berujung penghapusan.</li>
          <li>SARA, kekerasan, atau konten dewasa.</li>
        </ul>

        <h2>4. Reaksi Like & Dislike</h2>
        <p>Pengguna bisa memberi like atau dislike pada jualan. Jumlah dislike tidak ditampilkan publik, tetapi memengaruhi peringkat dan rekomendasi.</p>

        <h2>5. Peringkat "Ter Worth It"</h2>
        <p>Jualan dengan 110+ like otomatis masuk daftar rekomendasi teratas. Peringkat bisa berubah sewaktu-waktu.</p>

        <h2>6. Tanggung Jawab</h2>
        <p>MAUJAJAN adalah platform pertemuan pembeli dan penjual. Transaksi terjadi langsung antara keduanya. Kami tidak bertanggung jawab atas kualitas produk atau layanan penjual.</p>

        <h2>7. Penutupan Akun</h2>
        <p>Kami dapat menutup akun yang melanggar aturan, tanpa pemberitahuan sebelumnya.</p>

        <h2>8. Perubahan</h2>
        <p>Syarat ini bisa diubah sewaktu-waktu. Versi terbaru selalu berlaku.</p>

        <p style={{ marginTop: 30, fontSize: 13, color: "var(--ink-soft)" }}>Baca juga <Link to="/privacy" style={{ color: "var(--gold)" }}>Kebijakan Privasi</Link>.</p>
      </article>
    </Shell>
  );
}
