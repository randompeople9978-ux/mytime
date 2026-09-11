import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Kebijakan Privasi — MAUJAJAN INDONESIA" },
      { name: "description", content: "Bagaimana MAUJAJAN INDONESIA mengumpulkan, menggunakan, dan melindungi data pengguna." },
      { property: "og:title", content: "Kebijakan Privasi — MAUJAJAN" },
      { property: "og:description", content: "Kebijakan privasi MAUJAJAN INDONESIA." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <Shell>
      <article style={{ padding: "26px 20px 40px", maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 26 }}>Kebijakan Privasi</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 12.5, margin: "0 0 22px" }}>Terakhir diperbarui: 26 Juli 2026</p>

        <p>Halaman ini dikelola oleh pemilik aplikasi MAUJAJAN INDONESIA untuk menjelaskan bagaimana data pengguna dikumpulkan dan digunakan. Halaman ini bukan sertifikasi independen.</p>

        <h2>1. Data yang Kami Kumpulkan</h2>
        <ul>
          <li>Data akun: email, nama tampilan, foto profil (jika kamu isi).</li>
          <li>Data profil opsional: nomor WhatsApp, lokasi, bio.</li>
          <li>Data jualan yang kamu buat: nama, kategori, alamat, menu, jam buka.</li>
          <li>Interaksi: like/dislike, laporan, dan bug yang kamu kirim.</li>
        </ul>

        <h2>2. Bagaimana Data Digunakan</h2>
        <ul>
          <li>Menampilkan profil dan jualanmu ke pengguna lain.</li>
          <li>Menghubungkan pembeli dengan penjual lewat WhatsApp.</li>
          <li>Menjaga keamanan lewat sistem laporan dan tinjauan admin.</li>
        </ul>

        <h2>3. Berbagi Data</h2>
        <p>Kami tidak menjual data kamu. Nama tampilan, foto, dan info jualan bersifat publik agar bisa ditemukan pembeli. Nomor WhatsApp hanya dibagikan lewat tombol Hubungi.</p>

        <h2>4. Penyimpanan & Penghapusan</h2>
        <p>Data akun disimpan selama akun aktif. Kamu bisa meminta penghapusan akun dengan mengirim laporan bug atau menghubungi admin.</p>

        <h2>5. Autentikasi Pihak Ketiga</h2>
        <p>Kami mendukung masuk lewat Google. Google memiliki kebijakan privasi tersendiri.</p>

        <h2>6. Perubahan Kebijakan</h2>
        <p>Kebijakan bisa diperbarui sewaktu-waktu. Perubahan akan diumumkan di halaman ini.</p>

        <p style={{ marginTop: 30, fontSize: 13, color: "var(--ink-soft)" }}>Baca juga <Link to="/terms" style={{ color: "var(--gold)" }}>Syarat Layanan</Link>.</p>
      </article>
    </Shell>
  );
}
