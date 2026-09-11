# Community, Chat, dan Admin Bootstrap

Permintaan ini sangat besar (setara beberapa aplikasi). Saya pecah jadi 4 fase agar setiap fase bisa diuji dan tidak merusak yang sudah jalan. Fase 1 saya kerjakan langsung setelah rencana ini disetujui.

## Fase 1 — Fondasi & Admin (paling cepat terasa)

- **Bootstrap admin**: akun pertama yang mendaftar otomatis tercatat sebagai `admin` di tabel peran; akun berikutnya jadi `user`. Ditangani di sisi database saat pembuatan akun, jadi tidak bisa dimanipulasi dari browser.
- **Panel admin — tab Pengguna**: daftar akun, cari akun, angkat/cabut admin.
- **Mode maintenance**: satu tombol di panel admin. Saat aktif, semua pengunjung non-admin melihat halaman "sedang perbaikan"; admin tetap bisa masuk dan mematikannya.
- **QRIS penjual (opsional)**: penjual bisa unggah gambar QRIS di form jualan, tampil di halaman detail dengan tombol simpan gambar.

## Fase 2 — Profil sosial, cari user, pertemanan, DM

- **Username unik** per akun + deskripsi profil, dengan pencarian akurat (indeks pencarian di database, cocok sebagian & tepat).
- **Halaman profil publik** `/u/username`: foto, deskripsi, jualan miliknya, jumlah pengikut.
- **Follow / unfollow** (satu arah, tanpa persetujuan).
- **Pertemanan**: kirim permintaan → terima/tolak → muncul di inbox pertemanan. Blokir & buka blokir.
- **Chat pribadi antar teman** memakai komponen chat bersama (lihat di bawah).
- **Chat pembeli ↔ penjual** langsung dari halaman jualan, tanpa perlu berteman, dengan riwayat percakapan yang tersimpan (tombol WhatsApp tetap ada sebagai pilihan kedua).

## Fase 3 — Komponen chat bersama (dipakai semua chat)

Satu modul chat yang dipakai DM, chat penjual, dan grup komunitas:

- Teks + emoji picker, kirim tautan (pratinjau sederhana), foto, video, berkas.
- Kirim lokasi (peta + tautan Google Maps).
- Voice note (rekam dari mikrofon).
- Edit dan hapus pesan sendiri; status terkirim; realtime.
- Mention `@username`.
- Stiker (paket stiker bawaan).

## Fase 4 — Komunitas per daerah

- **Grup per daerah Indonesia** (provinsi/kota), user bergabung sesuai daerahnya.
- Di dalam grup: posting jualan (tautan produk, lokasi, foto, video) + chat grup penuh fitur Fase 3.
- **Total member** dan daftar member terlihat oleh semua anggota.
- **Voice chat perlu persetujuan**: anggota mengajukan izin bicara, admin/moderator menyetujui sebelum voice note bisa dikirim.
- **Hanya di panel admin**: ubah nama grup, foto grup, deskripsi, dan **jadwal buka/tutup** grup (di luar jadwal grup hanya bisa dibaca).

## Catatan teknis

- Seluruh data baru pakai tabel di Lovable Cloud dengan Row Level Security ketat: pesan hanya bisa dibaca peserta percakapan/anggota grup; peran admin diperiksa lewat fungsi `has_role`, bukan data dari browser.
- Berkas media chat masuk bucket privat (`chat-media`, `stickers`, `group-avatars`) dan disajikan lewat URL bertanda tangan, sama seperti gambar jualan sekarang.
- Realtime memakai kanal Postgres changes per percakapan/grup.
- Bootstrap admin dan mode maintenance dibaca dari server, sehingga tidak bisa dilewati dengan mengubah localStorage.
- Voice note direkam dengan MediaRecorder di browser (fallback: pesan teks bila mikrofon ditolak).

## Yang saya butuhkan dari Anda

Setujui rencana ini, dan saya mulai Fase 1. Setelah Fase 1 selesai dan Anda cek, bilang "lanjut fase 2" dan seterusnya — supaya kredit tidak habis di tengah satu fase besar.
