# 🧩 Puzzle Kita ❤️ — Game Jigsaw Multiplayer Berdua

Website game **Real Jigsaw Puzzle** khusus untuk kejutan pasangan, di mana kalian berdua bisa merangkai ratusan kepingan foto kenangan secara bersamaan (*real-time*) dari 2 perangkat yang berbeda!

## ✨ Fitur Utama
1. **Pilihan Suasana & Background Meja Romantis (4 Tema):**
   - 🌌 **Malam Berbintang & Zodiak:** Langit kosmis dengan rasi bintang romantis (Sagittarius & Taurus) dan mode malam bercahaya lembut.
   - 🏖️ **Pantai Pasir & Ombak:** Hamparan pasir pantai tropis dengan deburan ombak dan kerang laut.
   - 🌲 **Kabin Kayu Pinus:** Meja kayu hangat dengan jendela menghadap hutan pinus dan pegunungan.
   - 🧺 **Piknik Rumput Hijau:** Tikar piknik di atas rumput segar bertabur bunga daisy.
   - *Bisa diganti kapan saja secara instan lewat tombol "🎨 Tema" di bar atas atau saat mengatur foto puzzle, dan otomatis tersinkronisasi ke layar pasanganmu!*
2. **Alas Puzzle Bersih & Elegan (Tanpa Bingkai Tebal):**
   - Kepingan puzzle tersusun di atas alas papan yang bersih, rapi, dan menyatu alami dengan suasana meja yang dipilih.
3. **Potongan Jigsaw Asli (Interlocking Bezier Curves):**
   - Foto otomatis dipotong menjadi kepingan puzzle dengan lekukan tonjolan (*tab*) dan cekungan (*blank*) serta efek timbul di atas meja.
4. **Pilihan Kesulitan Fleksibel (16 s/d 320 Keping):**
   - Preset **Santai (~35 pcs)**, **Seru (~100 pcs)**, **Tantangan (~200 pcs)**, **Master (~300 pcs)**, atau atur bebas lewat *Custom Slider*.
   - Preset **Santai (~35 pcs)**, **Seru (~100 pcs)**, **Tantangan (~200 pcs)**, **Master (~300 pcs)**, atau atur bebas lewat *Custom Slider*.
3. **Sistem *Magnetic Snap* Ganda:**
   - Kepingan bisa menempel ke **papan utama** maupun **menempel langsung dengan kepingan tetangganya di luar papan** menjadi satu kesatuan grup yang bisa digeser bersama-sama.
4. **Meja Virtual Luas (Zoom & Pan di Laptop & HP):**
   - *Scroll mouse* atau *pinch* 2 jari di HP untuk *zoom in/out*.
   - Dilengkapi tombol **Filter Pinggir** (untuk merangkai bingkai dulu), **Rapikan Meja**, dan **Kotak Referensi 3D**.
5. **Multiplayer Real-Time (Sistem Kode Room & Link Undangan):**
   - Menggunakan WebRTC (**PeerJS**) + *BroadcastChannel* tanpa perlu menyewa server berbayar.
   - Melihat pergerakan kursor pasangan secara *real-time* dan mengirim reaksi emoji melayang (`❤️`, `🥰`, `🔥`, `👏`, `😂`, `🎉`).
6. **Bumbu Kejutan Romantis:**
   - **Mode Foto Misteri:** Sembunyikan gambar di kotak referensi agar pacarmu penasaran foto apa yang sedang dirangkai.
   - **Amplop Surat Cinta & Voucher Hadiah:** Saat puzzle selesai 100%, muncul hujan konfeti dan amplop kejutan berisi pesan romantis serta *voucher* hadiah yang kamu tulis.

---

## 🚀 Cara Mencoba Sekarang di Laptopmu
Kamu tidak perlu menginstal aplikasi tambahan apa pun:
1. Buka folder proyek ini: `C:\Users\techn\.gemini\antigravity\scratch\couple-jigsaw-puzzle`
2. Klik 2x file **`index.html`** untuk membukanya langsung di browser (Chrome / Edge / Safari).
3. Untuk mengetes fitur **Multiplayer 2 Layar** di laptopmu sendiri:
   - Buka `index.html` di **Tab 1**, masukkan namamu, lalu klik **Buat Room Baru** (misal kode `KITA26`).
   - Buka `index.html` di **Tab 2**, masukkan kode `KITA26`, lalu klik **Gabung Sekarang**.
   - Coba geser kepingan atau kirim emoji, maka di kedua tab akan bergerak bersamaan!

---

## 🌐 Cara Meng-online-kan Website (Gratis 1 Menit) Agar Bisa Dibuka di HP Pacar
Agar bisa dibuka dari HP/laptop pacarmu dari jarak jauh menggunakan link internet:

### Cara Paling Mudah (Tanpa Koding / Tanpa Akun GitHub): **Netlify Drop** / **Tiiny.host**
1. Buka [app.netlify.com/drop](https://app.netlify.com/drop) di browser.
2. Tarik (*drag-and-drop*) seluruh folder **`couple-jigsaw-puzzle`** ke halaman tersebut.
3. Dalam beberapa detik, kamu akan mendapatkan link website aktif (contoh: `https://puzzle-kejutan-kita.netlify.app`) yang langsung bisa kamu kirimkan ke WhatsApp pacarmu!
