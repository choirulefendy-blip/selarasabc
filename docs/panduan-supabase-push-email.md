# ABC Selaras — Panduan Deploy

Paket ini berisi:

- `index.html` — aplikasi Sistem HR & Penggajian (front-end lengkap, siap deploy).
- `sw.js` — Service Worker, wajib ikut di-upload satu folder dengan
  `index.html` (dipakai fitur notifikasi push ke perangkat & PWA).
- `manifest.json`, `icon-192.png`, `icon-512.png`,
  `icon-512-maskable.png` — wajib ikut di-upload satu folder dengan
  `index.html`, supaya aplikasi bisa "diinstal" ke layar utama HP
  (lihat bagian "Pasang Sebagai Aplikasi di HP").
- `schema.sql` — setup database untuk backend **Supabase** (disarankan, lebih cepat).
- `supabase-functions/send-push/index.ts` — Edge Function untuk notifikasi
  push ke perangkat (opsional, lihat bagian "Notifikasi Push ke Perangkat").
- `supabase-functions/send-email/index.ts` — Edge Function untuk notifikasi
  email (opsional, lihat bagian "Notifikasi Email").
- `Code.gs` — backend alternatif berbasis **Google Apps Script + Spreadsheet**.
- `README.md` — panduan ini.

Datanya sudah **dikosongkan** (belum ada karyawan) — HR yang login pertama kali
yang akan menginput data karyawan, jadwal, dan absensi secara manual.

Ikuti urutan ini: **Langkah 1 (siapkan database) dulu, baru Langkah 2 & 3
(konfigurasi + Netlify)** — karena kunci/URL dari Langkah 1 perlu ditempel ke
`index.html` sebelum di-upload.

Ada 2 pilihan backend database — pilih salah satu:

| | Supabase (disarankan) | Google Apps Script |
|---|---|---|
| Kecepatan | Cepat — satu panggilan API biasa, foto/dokumen diunggah langsung | Lebih lambat — foto/dokumen dipecah jadi banyak potongan kecil karena batas ukuran sel Google Sheets |
| Setup awal | Buat project Supabase gratis, jalankan 1 file SQL | Sudah tidak perlu app terpisah, tapi lewat Apps Script editor Google |
| Cocok untuk | Pemakaian sehari-hari, banyak foto absen | Kalau tim sudah familiar dengan Google Sheets dan ingin datanya juga terlihat sebagai spreadsheet |

---

## Langkah 1 — Siapkan Database

### Opsi A — Supabase (disarankan)

1. Buka [supabase.com](https://supabase.com), daftar/masuk (gratis).
2. **New project** — beri nama bebas, buat password database (simpan baik-baik,
   jarang dipakai langsung tapi penting), pilih region terdekat (misal
   Singapore), klik **Create new project**. Tunggu 1-2 menit sampai selesai.
3. Di sidebar kiri, buka **SQL Editor** > **New query**.
4. Buka file `schema.sql` dari paket ini, salin **seluruh isinya**, tempel ke
   editor, klik **Run**. Ini otomatis membuat tabel penyimpanan data dan
   folder (bucket) untuk foto/dokumen.
5. Buka **Project Settings** (ikon gear) > **API**. Salin dua hal:
   - **Project URL** (bentuknya `https://xxxxxxxx.supabase.co`)
   - **Project API keys > anon public** (kunci panjang berawalan `eyJ...`)

Simpan dua nilai itu, dipakai di Langkah 2.

### Opsi B — Google Apps Script (alternatif)

Ini yang membuat data HR, HOD, dan Staff tersimpan bersama lewat Google
Spreadsheet (bukan hanya di satu browser/komputer saja).

1. Buka [sheets.google.com](https://sheets.google.com), buat Spreadsheet baru.
   Nama bebas, misal "ABC Selaras - Database".
2. Di menu Spreadsheet: **Extensions > Apps Script**.
3. Hapus kode contoh (`function myFunction() {...}`) di editor yang terbuka.
4. Buka file `Code.gs` dari paket ini, salin **seluruh isinya**, tempel ke
   editor Apps Script tadi.
5. Klik ikon disket (Simpan project). Beri nama project bebas.
6. Klik tombol biru **Deploy > New deployment**.
7. Klik ikon gear di sebelah "Select type", pilih **Web app**.
8. Isi:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
9. Klik **Deploy**. Google akan minta otorisasi — pilih akun Google-mu,
   kalau muncul peringatan "Google hasn't verified this app", klik
   **Advanced > Go to project (unsafe)** lalu **Allow**. Ini normal untuk
   skrip buatan sendiri, bukan tanda bahaya.
10. Setelah selesai, salin **Web app URL** yang muncul — bentuknya seperti:
    `https://script.google.com/macros/s/AKfycbx.../exec`

> Setiap kali `Code.gs` diedit lagi di kemudian hari, buat deployment baru
> lewat **Deploy > Manage deployments > ikon pensil > Version: New version
> > Deploy** supaya perubahan aktif.

---

## Langkah 2 — Tempel konfigurasi ke index.html

1. Buka `index.html` dengan text editor (Notepad, VS Code, dll — jangan
   Word). Cari (Ctrl+F) `BACKEND` di bagian atas file.

**Kalau pakai Supabase (Opsi A):**
```js
var BACKEND = 'supabase';   // sudah default, tidak perlu diubah
var SUPABASE_URL = '';      // <-- tempel Project URL di sini
var SUPABASE_ANON_KEY = ''; // <-- tempel anon public key di sini
```
Jadi misalnya:
```js
var SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**Kalau pakai Google Apps Script (Opsi B):**
```js
var BACKEND = 'appsscript'; // ganti dari 'supabase' ke ini
...
var REMOTE_API_URL = '';    // <-- tempel Web app URL dari Langkah 1 di sini
```

2. Simpan file.

---

## Langkah 3 — Deploy ke Netlify

Cara paling mudah, tanpa command line:


1. Buka [app.netlify.com/drop](https://app.netlify.com/drop) (perlu login/daftar
   akun Netlify dulu, gratis).
2. Seret **folder** yang berisi `index.html` (folder ini, bukan cuma
   file-nya) ke halaman tersebut.
3. Tunggu beberapa detik — Netlify akan memberi alamat situs otomatis,
   misalnya `https://abc-selaras-xyz.netlify.app`.
4. (Opsional) Ganti nama situsnya lewat **Site settings > Change site name**
   agar alamatnya lebih rapi, misal `abc-selaras.netlify.app`.

Alamat itu yang dibagikan ke HR, HOD, dan staff untuk login.

---

## Langkah 4 — Login pertama kali & mulai input data

Buka situsnya, login sebagai HR dengan akun bawaan:

- **Username**: `ilin`
- **Password**: `hr123`

Lalu, di halaman **Pengaturan**, periksa kartu "Status Penyimpanan" — kalau
sudah muncul **"Google Spreadsheet (bersama, lintas perangkat)"** berwarna
hijau, berarti sambungan ke Apps Script sudah benar dan semua orang akan
melihat data yang sama.

Urutan input data yang disarankan:

1. **Pengaturan** — segera ganti password akun HR (jangan pakai `hr123`
   bawaan lagi), sesuaikan nama perusahaan, persentase BPJS, dan aturan
   potongan telat.
2. **Karyawan** — tambahkan seluruh karyawan (Adit, Evan, Niken, Arif,
   Reyhan, atau siapa pun sesuai kebutuhan), isi gaji pokok dan
   username/password masing-masing, lalu klik **"Jadikan HOD"** pada baris
   karyawan yang akan jadi HOD (misalnya Adit).
   > HOD **tidak** punya akun terpisah — dia login lewat tab **"Staff / HOD"**
   > di halaman login, pakai username/password miliknya sendiri. Sistem
   > otomatis memberi akses HOD (atur jadwal tim, dashboard absensi tim)
   > kalau dia yang sedang ditunjuk sebagai HOD di halaman Karyawan.
3. Beri tahu Adit untuk login lewat tab **"Staff / HOD"** dengan akunnya
   sendiri — dia akan otomatis melihat menu **Atur Jadwal Tim** dan
   **Dashboard**.
4. Bagikan akun Staff masing-masing (nama karyawan + password) ke
   Evan/Niken/Arif/Reyhan untuk cek jadwal, absensi, dan slip gaji sendiri
   — login lewat tab yang sama ("Staff / HOD").
5. Setiap akhir bulan: HR impor hasil tarikan absensi lewat menu
   **Absensi & Pencocokan > Impor Absensi dari Spreadsheet**, lalu cek
   halaman **Penggajian** untuk slip gaji tiap orang.

### Pengajuan Cuti / Izin (2 Tahap: HOD lalu HR)

- Staff mengajukan lewat menu **Pengajuan Cuti** (pilih tanggal, jenis:
  Cuti Tahunan/Sakit/Izin/Lainnya, keterangan opsional). Pengajuan staf
  masuk ke **HOD dulu** untuk disetujui/ditolak (bagian "Persetujuan Tim"
  di halaman yang sama saat login sebagai HOD).
- Setelah HOD menyetujui, pengajuan diteruskan ke **HR** untuk persetujuan
  final di menu **Pengajuan Cuti** (ada juga pintasan di Dashboard HR
  kalau ada yang menunggu).
- Kalau HOD **menolak**, pengajuan berhenti di situ — tidak diteruskan ke
  HR. Kalau HR yang menolak (di tahap final), begitu juga.
- Pengajuan dari **HOD sendiri** langsung ke HR (tidak ada tahap HOD,
  karena tidak ada yang di atasnya). Kalau belum ada HOD yang ditunjuk
  sama sekali, semua pengajuan staf juga otomatis langsung ke HR.
- Setiap tahap penolakan bisa diberi alasan (opsional), dan alasannya
  akan terlihat oleh karyawan yang mengajukan beserta siapa yang menolak
  (HOD atau HR).
- Begitu disetujui **final oleh HR**, tanggal tersebut otomatis ditandai
  **Cuti** di jadwal karyawan itu — tidak akan tercatat Alpha maupun kena
  potongan telat.

### Notifikasi

Setiap peran punya tombol **Notifikasi** di pojok kanan atas (dengan angka
jumlah yang belum dibaca). Notifikasi muncul otomatis saat:

- Staff/HOD mengajukan cuti &rarr; HR dapat notifikasi.
- HR menyetujui/menolak pengajuan &rarr; karyawan yang bersangkutan dapat
  notifikasi (lengkap dengan alasan kalau ditolak).
- HOD mengubah jadwal seorang karyawan &rarr; karyawan itu dapat notifikasi.
- HR menambah/menghapus potongan di slip gaji seseorang &rarr; karyawan itu
  dapat notifikasi.

Klik salah satu notifikasi untuk langsung membukanya dan menandainya sudah
dibaca, atau klik "Tandai semua dibaca" untuk membersihkan semuanya
sekaligus. Notifikasi tersimpan di database yang sama (Supabase atau Google
Spreadsheet, tergantung yang dipakai), jadi tetap muncul walau ganti perangkat.

### Data Karyawan Lengkap & Tunjangan

- Form Tambah/Edit Karyawan sekarang juga punya field **Alamat, Nomor
  Telepon, Email**, serta **Uang Makan** dan **Transportasi** (tunjangan
  bulanan tetap) di bawah Gaji Pokok.
- Uang Makan dan Transportasi otomatis ditambahkan sebagai **Pendapatan**
  di slip gaji (menambah Take Home Pay), terpisah dari Gaji Pokok — BPJS
  tetap dihitung dari Gaji Pokok saja.

### Branding

- Logo ABC Selaras ditampilkan di layar login, sidebar aplikasi, dan
  sebagai favicon (ikon tab browser).
- Teks "Aplikasi ini diproduksi dan dikembangkan oleh Neotone Creative"
  ditampilkan di layar login dan di bagian bawah setiap halaman aplikasi,
  lengkap dengan logo Neotone dan tautan WhatsApp (wa.me/6285155499204)
  pada tulisan "Neotone Creative".

### Departemen & Properti

- **Departemen** default: Marketing, Finance, Administration, Service,
  Kitchen, Front Office, Public Area, Engineering, Housekeeping — bisa
  ditambah lewat halaman Karyawan (lihat "Departemen & Properti Bisa
  Ditambah" di bawah).
- **Properti** default: Kaly, Padi Heritage, Briggs Inn Surabaya, Briggs
  Inn Batu — bisa dicentang lebih dari satu per karyawan (misalnya staf
  Marketing Communication yang menangani beberapa properti sekaligus),
  dan daftarnya juga bisa ditambah.

---

### Absen Masuk/Pulang (Selfie + Lokasi)

- Staff dan HOD punya menu **Absen** untuk mencatat jam masuk & pulang
  sendiri. Halaman ini langsung membuka **kamera depan** (bukan pilih file
  dari galeri) — karyawan mengambil foto langsung di tempat sebagai bukti,
  lalu lokasi GPS terekam otomatis. Tanggal & jam tercatat otomatis oleh
  sistem (tidak bisa diketik manual, supaya lebih akurat).
- Kalau lokasi tidak bisa diakses (izin ditolak, GPS mati, dll), absen
  tetap bisa dikirim tanpa lokasi — tidak memblokir karyawan. Kalau akses
  kamera ditolak/gagal, ada tombol "Coba Lagi" untuk meminta izin ulang.
- HR bisa melihat bukti ini di menu **Absensi & Pencocokan**: kolom
  **Bukti** muncul tombol "Lihat" untuk hari yang punya foto, menampilkan
  foto dan tautan lokasi di Google Maps.
- Foto otomatis dikompres kecil sebelum disimpan supaya tidak membebani
  penyimpanan.
- Kamera perlu izin browser (akan muncul prompt saat pertama kali dipakai)
  dan hanya berfungsi di halaman yang diakses lewat HTTPS — situs Netlify
  otomatis HTTPS, jadi aman.

### Toggle HOD (Jadikan / Lepas)

- Di halaman **Karyawan**, HR bisa **Jadikan HOD** siapa pun, dan kalau
  ingin melepas jabatan itu tanpa langsung menunjuk penggantinya, klik
  **Lepas HOD** pada baris HOD yang sedang menjabat.

### Form & Approval

- Staff dan HOD punya menu **Form & Approval** untuk mengajukan apa saja
  (klaim, permohonan, dsb.) dengan deskripsi bebas dan lampiran dokumen
  opsional (gambar, PDF, dll — maksimal 1.5MB).
- HR meninjau semua pengajuan di menu **Form & Approval**, bisa membuka
  lampirannya langsung, lalu **Setujui** atau **Tolak** (dengan alasan
  opsional).

> **Catatan teknis**: kalau pakai backend **Supabase**, foto & dokumen
> diunggah langsung ke Supabase Storage (satu proses upload, cepat). Kalau
> pakai backend **Google Apps Script**, file dipecah jadi beberapa bagian
> kecil dulu (karena satu sel Google Spreadsheet dibatasi ~50.000 karakter)
> lalu disambung kembali otomatis saat dibuka — ini yang membuat opsi Apps
> Script terasa lebih lambat untuk upload foto/dokumen dibanding Supabase.

### Riwayat Aktivitas & Riwayat Keputusan HOD

- Menu **Riwayat Aktivitas** (khusus HR) mencatat perubahan yang dilakukan
  HR, HOD, maupun Staff — tambah/ubah/hapus karyawan, jadikan/lepas HOD,
  perubahan jadwal, keputusan cuti & Form Approval, impor absensi,
  perubahan potongan gaji, sampai perubahan pengaturan — lengkap dengan
  waktu dan siapa pelakunya.
- Keputusan cuti yang sudah diambil HOD **tidak hilang** dari
  penglihatannya — ada bagian **"Riwayat Keputusan Saya"** di halaman
  Pengajuan Cuti milik HOD, menampilkan semua pengajuan tim yang pernah
  mereka setujui/tolak beserta status terkininya (termasuk yang sudah
  diteruskan atau diputuskan final oleh HR).

### Pengumuman

- HR punya menu **Pengumuman** untuk menulis pesan bebas dan
  melampirkan file (opsional, maks. 1.5MB), lalu memilih penerimanya:
  **Semua Staff & HOD**, atau centang orang-orang tertentu saja.
  Riwayat pengumuman yang pernah dikirim juga tersimpan di halaman yang
  sama.
- Staff dan HOD melihat pengumuman yang ditujukan untuk mereka (atau
  yang ditujukan ke semua orang) di menu **Pengumuman** masing-masing,
  lengkap dengan lampiran kalau ada, dan dapat notifikasi otomatis saat
  ada pengumuman baru.

### ID Karyawan Otomatis

Setiap karyawan baru otomatis dapat **ID Karyawan** dengan format:
```
{Kode Properti}-{Tahun Gabung}-{Tanggal+Bulan Lahir}-{Urutan}
```
Contoh: `KLY-24-2005-003` = properti Kaly, gabung 2024, lahir 20 Mei, karyawan
ke-3 yang terdaftar. ID ini muncul di tabel Karyawan, jendela Profil, dan
slip gaji — dibuat sekali saat karyawan ditambahkan dan tidak berubah lagi
setelahnya (meski data lain diedit).

### Departemen & Properti Bisa Ditambah

Di halaman Karyawan sekarang ada tombol **"+ Tambah Departemen Baru"** dan
**"+ Tambah Properti Baru"** — tidak lagi terbatas pada daftar bawaan.
Departemen/properti baru langsung bisa dipilih di form Tambah/Edit
Karyawan begitu ditambahkan.

### Filter Tabel Karyawan

Selain filter Departemen & Properti yang sudah ada, sekarang ada juga
filter **Peran** (Semua/HOD/Staff) dan **Status** (Semua/Aktif/Nonaktif) —
semua filter bisa digabung sekaligus.

### Filter Penerima Pengumuman

Saat membuat pengumuman dan mematikan "Semua Staff & HOD", muncul alat
bantu memilih penerima:
- **"Pilih HOD Saja"** — langsung memilih HOD yang sedang menjabat.
- **Pilih Departemen + "Tambah dari Departemen Ini"** — menambahkan semua
  karyawan di satu departemen ke daftar penerima (bisa digabung dengan
  pilihan lain, tidak menghapus yang sudah dicentang).
- **Kotak pencarian nama** — mempersempit daftar centang kalau jumlah
  karyawan banyak.

### Login Staff/HOD (Username & Password)

Login di tab "Staff / HOD" sekarang murni username + password (sama seperti
tab HR) — tidak ada lagi dropdown pilih nama. Ketik username & password
akun karyawan; sistem otomatis mendeteksi apakah dia HOD (dan departemen
mana saja yang dijabat) atau Staff biasa.

### HOD per Departemen (Bukan Satu HOD Global)

- HOD sekarang **ditunjuk per departemen**, bukan satu orang untuk seluruh
  perusahaan. Atur lewat halaman Karyawan &rarr; tombol **"Kelola HOD"** —
  centang departemen mana saja yang dijabat orang itu sebagai HOD.
- **Satu departemen boleh punya lebih dari satu HOD** (misal Marketing
  punya 2 HOD yang saling backup), dan **satu orang boleh menjabat HOD di
  lebih dari satu departemen sekaligus**.
- HOD hanya melihat & mengelola jadwal, absensi, dan persetujuan cuti
  untuk staf **di departemen yang dia jabat** — bukan seluruh karyawan
  perusahaan.
- Semua HOD di sebuah departemen menerima notifikasi yang sama (misal
  saat ada staf mengajukan cuti) — siapa pun boleh memprosesnya duluan.
- Ringkasan siapa HOD di tiap departemen bisa dilihat HR di menu
  Pengaturan &rarr; "HOD per Departemen".

### Kalender Jadwal Klik-Tanggal & Persetujuan per Departemen ke HR

- Halaman **Atur Jadwal Tim** (HOD) sekarang berbasis kalender penuh:
  tiap kotak tanggal menampilkan ringkasan jumlah staf Kerja/Libur/Cuti
  hari itu. **Klik tanggalnya langsung** untuk membuka pengatur jadwal —
  pilih tipe (Kerja/Libur + jam), rentang tanggal (opsional), dan staf
  mana saja yang kena (bisa pilih sebagian, tidak harus semua tim).
- Untuk isi cepat satu bulan penuh, masih ada **"Isi Cepat Pola
  Mingguan"** yang menerapkan pola Senin&ndash;Minggu ke seluruh tim
  departemen sekaligus — hasilnya tetap bisa disesuaikan lagi lewat
  kalender.
- Kalau HOD menjabat lebih dari satu departemen, ada pemilih departemen
  di atas kalender untuk berpindah tim.
- Jadwal Staf sendiri ("Jadwal Saya") tetap menampilkan kalender bulanan
  visual pribadi seperti sebelumnya.
- **Pengajuan ke HR sekarang per departemen**, bukan satu-satu staf:
  klik **"Ajukan Jadwal Departemen ke HR"** untuk mengajukan seluruh tim
  satu departemen sekaligus, atau **"Ajukan Semua Departemen Saya"**
  kalau HOD menjabat lebih dari satu departemen.
- HR meninjau di menu **Persetujuan Jadwal**: tiap baris menunjukkan
  nama departemen dan siapa saja HOD-nya, plus tombol **"Lihat
  Kalender"** untuk pratinjau kalender tim sebelum **Setujui**/**Tolak**
  (boleh disertai catatan). Semua HOD departemen itu dapat notifikasi
  begitu HR memutuskan.
- Jadwal tetap berfungsi normal untuk pencocokan absensi berapa pun
  status persetujuannya — ini murni lapisan pengawasan administratif.

### Preset Shift

- HR bisa mengatur daftar preset shift di menu Pengaturan &rarr; kartu
  "Preset Shift" — bawaan sistem: **Shift 1** (07:00&ndash;15:00),
  **Shift 2** (15:00&ndash;23:00), **Shift 3** (23:00&ndash;07:00), dan
  **Shift Back Office** (09:00&ndash;17:00). HR bebas **menambah** shift
  baru (nama + jam masuk/pulang) atau **menghapus** yang tidak dipakai.
  Menghapus preset tidak mengubah jadwal yang sudah terlanjur memakai
  jam itu.
- Preset ini muncul sebagai pilihan cepat saat HOD mengatur jadwal —
  baik di "Isi Cepat Pola Mingguan" maupun saat klik tanggal di
  kalender. Memilih preset otomatis mengisi jam masuk/pulang (tetap
  bisa diubah manual sesudahnya kalau perlu penyesuaian).

### Absen Cepat dari Dashboard

- Dashboard Staff dan HOD sekarang punya kartu **"Jadwal Hari Ini"**
  yang menampilkan jam kerja hari itu dan status absen terkini. Kalau
  belum absen masuk, ada tombol **"Absen Masuk Sekarang"**; kalau sudah
  masuk tapi belum pulang, tombolnya berganti **"Absen Pulang
  Sekarang"** — keduanya langsung membawa ke halaman Absen tanpa perlu
  mencari menu.

### Lampiran Foto di Pengajuan Cuti & Tarik Pengajuan

- Form pengajuan Cuti/Izin/Sakit sekarang punya kolom lampiran foto
  (opsional, mis. surat dokter) — sama seperti Form & Approval. HOD
  dan HR bisa membuka lampiran ini langsung dari daftar pengajuan
  lewat tombol "Lampiran".
- Pengajuan yang **sudah disetujui** sekarang bisa **ditarik kembali**
  oleh karyawan lewat tombol "Tarik Pengajuan" — begitu ditarik, hari
  yang tadinya otomatis ditandai Cuti di jadwal **langsung dikembalikan
  ke status belum diatur**, supaya HOD bisa menjadwalkan ulang hari itu.

### Absensi Tim untuk HOD

- HOD sekarang punya menu **Absensi Tim** sendiri: ringkasan hari ini
  (Hadir/Telat/Alpha/Cuti&ndash;Libur) untuk seluruh tim di
  departemen yang dijabat, dengan tiga filter yang bisa digabung:
  **Departemen** (kalau HOD menjabat lebih dari satu), **Properti**,
  dan **cari nama staf**.

## Desain UI — Material You (Material Design 3)

Seluruh tampilan aplikasi mengikuti bahasa desain **Google Material
You**, tetap dengan identitas warna hijau ABC Selaras:

- **Palet warna tonal** — bukan sekadar satu warna hijau, tapi
  sistem lengkap ala M3 (`primary`, `primary-container`,
  `on-primary-container`, `surface-container` bertingkat low/high/
  highest) yang otomatis punya versi terang & gelap masing-masing.
- **Bentuk membulat besar** — tombol berbentuk pil penuh, kartu &
  modal bersudut sangat membulat (16&ndash;28px), chip/badge status
  berbentuk pil, konsisten di seluruh halaman termasuk dropdown
  filter dan pratinjau foto.
- **Tombol bertingkat** — Filled (aksi utama), Tonal/Secondary,
  Outlined (bahaya), dan Text/Ghost, masing-masing dengan warna latar
  tonal alih-alih solid, sesuai konvensi M3.
- **Navigasi ala M3** — item menu sidebar terpilih mendapat highlight
  berbentuk pil, tombol ikon (mode gelap, notifikasi) berbentuk
  lingkaran tonal.
- **Konsisten di kedua tema** — termasuk perbaikan kontras teks pada
  tombol sekunder/ghost dan judul kategori KPI di mode gelap, yang
  sebelumnya redup karena memakai warna teks tetap alih-alih token
  yang menyesuaikan tema.

## Geofencing — Cocokkan Absen dengan Lokasi Kantor

Saat karyawan absen masuk/pulang, lokasi HP-nya otomatis dicocokkan
dengan 3 titik lokasi properti berikut (sudah diisi otomatis, siap
pakai):

| Lokasi | Alamat |
|---|---|
| Briggs Inn Batu | Jl. Ir. Soekarno No. 377, Mojorejo, Kec. Junrejo, Kota Batu, Jawa Timur 65326 |
| Padi Heritage & Kaly | Jl. Regulus No. 9, Perum. Tata Surya, Tlogomas, Kec. Lowokwaru, Kota Malang, Jawa Timur 65144 |
| Briggs Inn Surabaya | Jl. Cisadane No. 18, Darmo, Kec. Wonokromo, Kota Surabaya, Jawa Timur 60241 |

- Begitu lokasi HP terdeteksi di halaman Absen, sistem otomatis mencari
  lokasi kantor **terdekat** dan menampilkan kotak status: **"Dalam
  jangkauan"** (hijau, radius default 150m) lengkap nama & alamatnya,
  atau **"Di luar jangkauan"** (kuning) beserta jarak ke lokasi
  terdekat.
- **Tidak memblokir absen** &mdash; karyawan tetap bisa mengirim absen
  meski di luar jangkauan (misal sedang dinas luar), tapi statusnya
  otomatis ditandai supaya HOD/HR bisa meninjau lewat tombol "Lihat
  Bukti".
- **HR bisa mengatur lokasi** lewat Pengaturan &rarr; kartu "Lokasi
  Kantor (Geofencing)" &mdash; tambah lokasi baru (nama, koordinat,
  alamat, radius) atau hapus yang tidak dipakai. Koordinat bisa
  didapat dengan klik kanan titik di Google Maps.

## Branding Sidebar, Tunjangan Lain, & Filter Penggajian

- **Teks sidebar diperbaiki**: judul besar sekarang "ABC Selaras" (nama
  aplikasi), subjudul di bawahnya menampilkan nama perusahaan (mis.
  "ABC Hospitality Group") — sebelumnya terbalik.
- **Dashboard lebih seimbang**: tombol KPI dihapus dari baris aksi
  cepat (sekarang rapi 4 tombol: Absen/Cuti/Lembur/Slip Gaji) supaya
  tidak ada tombol menggantung sendirian di baris baru. KPI tetap
  bisa diakses lewat menu "KPI Tim" di sidebar.
- **Tunjangan Lain** (pasangan dari Potongan Lain yang sudah ada): HR
  bisa menambahkan tunjangan/bonus tambahan (mis. Bonus, THR, Tunjangan
  Jabatan) per karyawan per bulan lewat tombol "+ Tunjangan Lain" di
  slip gaji — otomatis menambah ke Total Pendapatan, tampil di tabel
  Pendapatan slip (layar & PDF), dan kolom "Tunj. Lain" ikut muncul di
  tabel ringkasan Penggajian HR.
- **Filter Penggajian ada di HR, bukan HOD**: menu "Penggajian Tim"
  untuk HOD sudah dihapus. Filter **Departemen** dan **cari Nama Staf**
  sekarang tersedia di halaman **Penggajian** milik HR saja (HOD tetap
  hanya bisa melihat slip gaji miliknya sendiri lewat "Slip Gaji
  Saya").

## Perbaikan Mode Gelap, Multi-Akun HR, Kondisi Absen, & Pengajuan Lembur

- **Bug mode gelap diperbaiki**: beberapa elemen (tombol sekunder/bahaya,
  kotak isian, modal, kalender, panel notifikasi) sebelumnya memakai
  warna putih yang "dipaksakan" sehingga tulisannya nyaris tak
  terbaca di mode gelap. Sekarang semuanya ikut menyesuaikan tema
  secara otomatis. Slip gaji & tampilan cetak sengaja tetap putih
  (meniru kertas asli).
- **Multi-Akun HR**: di Pengaturan &rarr; kartu "Akun HR Tambahan", HR
  utama bisa menambahkan admin/staf HR lain (nama, username, password,
  email) yang login penuh lewat tab HR dengan kredensial masing-masing
  &mdash; aksesnya sama seperti akun HR utama. Notifikasi email
  terkirim ke semua akun HR sekaligus.
- **Kondisi kesehatan saat absen masuk**: setelah foto selfie diambil
  (khusus absen masuk), muncul 3 pilihan kartu &mdash; Sehat, Kurang
  Sehat, Sakit. Sifatnya opsional (tidak memblokir pengiriman absen),
  tersimpan di data absensi, dan terlihat HOD/HR lewat tombol "Lihat"
  bukti absensi.
- **Jenis pengajuan cuti jadi kartu ikon**: dropdown lama diganti
  kartu visual (Cuti Tahunan/Sakit/Izin/Lainnya) yang bisa langsung
  diklik.
- **Pengajuan Lembur** (menu baru "Pengajuan Lembur" untuk Staff/HOD,
  "Persetujuan Lembur" untuk HR): isi tanggal, jam mulai & jam akhir
  (durasi otomatis terhitung), uraian pekerjaan, dan lampiran
  foto/gambar opsional. Alurnya identik dengan Pengajuan Cuti: Staff
  &rarr; HOD &rarr; HR, atau langsung HOD &rarr; HR kalau yang
  mengajukan adalah HOD sendiri.
- **Dashboard Staff & HOD dirombak** jadi lebih menarik: kartu profil
  bergaya gradasi warna brand, dua kotak status "Masuk"/"Pulang"
  berwarna (hijau kalau sudah absen), dan baris tombol pintas
  (Absen/Cuti/Lembur/Slip Gaji, ditambah KPI khusus untuk HOD).

## Mode Gelap, Sesi Tetap Login, & Absensi Lebih Lengkap

- **Mode Gelap**: tombol ikon matahari/bulan di topbar (semua peran) untuk
  beralih terang/gelap. Pilihan tersimpan per perangkat, tetap sama tiap
  buka aplikasi lagi.
- **Refresh tidak logout**: sesi login sekarang tersimpan per perangkat —
  me-refresh halaman atau menutup-buka tab tidak lagi memaksa login
  ulang. Tetap otomatis logout kalau memang klik tombol Keluar, atau
  kalau akun karyawan yang bersangkutan dinonaktifkan HR.
- **Peta lokasi saat absen**: begitu lokasi HP terdeteksi, langsung
  tampil pratinjau peta (OpenStreetMap, tanpa perlu API key) di halaman
  Absen — baik saat masuk maupun pulang.
- **Catatan pekerjaan saat absen pulang**: kolom opsional untuk
  meringkas apa saja yang dikerjakan hari itu, ikut tersimpan dan
  terlihat HOD/HR lewat tombol "Lihat" pada bukti absensi.
- **Absensi Tim HOD lebih lengkap**: selain ringkasan hari ini, sekarang
  ada juga tabel detail sebulan penuh per staf (pilih nama + bulan),
  lengkap dengan tombol "Lihat" bukti foto/lokasi/catatan tiap hari.
- **Kalender jadwal tim menampilkan inisial & jam kerja tiap staf**
  (bukan cuma jumlah agregat) — misalnya "AS 07:00", "EV 08:30" —
  begitu diarahkan/di-tap terlihat nama lengkapnya.

## KPI Performance

Modul penilaian kinerja per karyawan, dengan indikator KPI awal sudah
terisi dari file `KPI_Departemen_ABC_Hospitality_Group.xlsx` yang
diberikan (9 departemen, termasuk Housekeeping dengan 14 indikator
dalam 5 kategori).

- **HR & HOD bisa menambah/menghapus indikator KPI** per departemen
  (nama, definisi, satuan, arah Maksimal/Minimal, bobot %, target) —
  tombol "Kelola KPI" muncul di halaman KPI Tim (HOD, terbatas
  departemen sendiri) dan Persetujuan KPI (HR, semua departemen).
  Kartu menampilkan peringatan kalau total bobot belum 100%.
- **HOD mengisi Realisasi** tiap indikator per staf per bulan (menu
  **KPI Tim**) — Pencapaian (%), Skor Tertimbang, dan Status
  (Tercapai/Mendekati Target/Perlu Perhatian) terhitung otomatis
  persis seperti rumus di file Excel aslinya, termasuk kasus KPI
  zero-tolerance (target = 0, seperti LTI Rate).
- Bisa **"Simpan Sementara"** (draf, belum masuk ke HR) atau
  **"Ajukan ke HR"** langsung.
- **HR meninjau di menu Persetujuan KPI**: filter per departemen,
  lihat detail lengkap, **Setujui/Tolak** (boleh disertai catatan).
  Sekali diajukan, form terkunci (tidak bisa diubah HOD) sampai HR
  memutuskan; kalau ditolak, HOD bisa merevisi dan mengajukan ulang.
- **Unduh PDF** laporan KPI per karyawan per periode — tersedia untuk
  HR maupun HOD, dari halaman KPI Tim, Riwayat KPI, maupun Persetujuan
  KPI.
- **Dashboard**: HOD melihat chart skor KPI seluruh timnya bulan
  berjalan; HR melihat chart rata-rata skor KPI per departemen
  (dari data yang sudah disetujui), plus jumlah KPI yang masih
  menunggu persetujuan.

## Pasang Sebagai Aplikasi di HP (PWA)

ABC Selaras sekarang sudah **PWA (Progressive Web App)** — bisa
"diinstal" ke layar utama HP/laptop dan berjalan seperti aplikasi asli
(ikon sendiri, layar penuh tanpa address bar), tanpa perlu Play Store.

File tambahan untuk fitur ini (**wajib ikut di-upload** satu folder
dengan `index.html`, sudah termasuk di `abc-selaras-netlify.zip`):
`manifest.json`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`.

**Cara pasang di Android (Chrome):**
1. Buka situsnya di Chrome.
2. Akan muncul notifikasi "Tambahkan ABC Selaras ke layar utama" — atau
   buka menu titik tiga &rarr; **"Instal aplikasi"** / **"Add to Home
   Screen"**.
3. Ikon ABC Selaras muncul di layar utama seperti aplikasi biasa.

**Cara pasang di iPhone (Safari):** buka situsnya di Safari &rarr; tombol
Share &rarr; **"Add to Home Screen"**. Catatan: notifikasi push di
iPhone *hanya* aktif kalau dipasang lewat cara ini (bukan sekadar
dibuka di tab Safari biasa) — lihat bagian Notifikasi Push di bawah.

**Mau naik ke Google Play Store (APK resmi)?** Bisa pakai
[pwabuilder.com](https://www.pwabuilder.com) — masukkan URL situs
Netlify-nya, generate APK/AAB otomatis, lalu unggah ke akun Google
Play Developer (berbayar sekali, ±US$25). Di luar cakupan paket ini,
tapi situsnya menuntun langkah demi langkah.

## Notifikasi Push ke Perangkat (Opsional)

Selain notifikasi dalam aplikasi (ikon lonceng), ABC Selaras bisa juga
mengirim **notifikasi ke layar kunci HP/laptop** seperti WhatsApp — HR,
HOD, dan Staff akan tetap dapat notifikasi walau tidak sedang membuka
situsnya. Fitur ini **opsional** dan **hanya berjalan dengan backend
Supabase** (tidak didukung di backend Google Apps Script, karena Apps
Script tidak punya kemampuan enkripsi yang dibutuhkan protokol Web Push).

**Keterbatasan penting di iPhone**: Safari baru bisa terima push kalau
situsnya sudah di-**"Add to Home Screen"** (dipasang seperti aplikasi) —
kalau cuma dibuka lewat tab Safari biasa, push tidak akan berfungsi. Di
Android dan laptop/PC (Chrome/Edge), langsung bisa jalan di browser tanpa
perlu instal apa-apa.

File tambahan yang disertakan untuk fitur ini:
- `sw.js` — Service Worker, **harus ikut di-upload ke Netlify satu folder
  dengan `index.html`** (sudah ada di dalam `abc-selaras-netlify.zip`).
- `supabase-functions/send-push/index.ts` — kode Edge Function Supabase
  yang benar-benar mengirim notifikasinya.

### Langkah 1 — Tambahkan tabel push_subscriptions

Kalau kamu sudah menjalankan `schema.sql` versi lama, jalankan lagi
seluruh isi `schema.sql` yang baru ini di SQL Editor Supabase — aman
dijalankan ulang, akan menambahkan tabel `push_subscriptions` yang belum
ada tanpa mengubah data yang sudah ada.

### Langkah 2 — Deploy Edge Function

**Update:** Supabase sekarang juga punya editor Edge Function langsung
di dashboard browser (Edge Functions &rarr; Create a new function),
jadi bagian ini sebenarnya **tidak lagi wajib** butuh Terminal — bisa
copy-paste isi `supabase-functions/send-push/index.ts` langsung di
sana, set secrets-nya, klik Deploy. Kalau caramu berjalan lancar lewat
dashboard, langsung lanjut ke Langkah 3.

Kalau lebih suka Terminal (atau dashboard-mu tidak menampilkan opsi
itu), ikuti CLI di bawah ini:

1. Pastikan [Node.js](https://nodejs.org) sudah terpasang di komputer
   (kalau belum, unduh & instal versi LTS dulu).
2. Buka Terminal (Mac) atau Command Prompt/PowerShell (Windows), lalu
   pasang Supabase CLI:
   ```
   npm install -g supabase
   ```
3. Login ke akun Supabase-mu:
   ```
   supabase login
   ```
   (akan membuka browser untuk konfirmasi login)
4. Pindah ke folder yang berisi file `supabase-functions`, lalu hubungkan
   ke project Supabase-mu (`project-ref` dilihat dari URL dashboard
   Supabase-mu, contoh: `abcdefghijklmnop`):
   ```
   supabase link --project-ref PROJECT_REF_KAMU
   ```
5. Set kunci VAPID (dipakai untuk menandatangani notifikasi) — pakai
   nilai ini persis (sudah dibuatkan, aman dipakai langsung):
   ```
   supabase secrets set VAPID_PUBLIC_KEY=BMPhKJL68Parug2W_JsJRztuIQjDxd6Pd-OLngatqOWeaxLCj4qkr40_FDyUxsaukvqNTl6YgabVLLHwevtx6rg
   supabase secrets set VAPID_PRIVATE_KEY=ISI_KUNCI_PRIVAT_ANDA_DI_SINI
   ```
   > Ingin kunci sendiri (opsional, lebih aman)? Jalankan
   > `npx web-push generate-vapid-keys`, lalu ganti nilai di atas DAN
   > ganti juga `VAPID_PUBLIC_KEY` di bagian atas `index.html` dengan
   > public key yang baru.
6. Set juga URL & anon key Supabase-mu (yang sama seperti di
   `index.html`):
   ```
   supabase secrets set SB_URL=https://xxxxxxxx.supabase.co
   supabase secrets set SB_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
7. Deploy fungsinya:
   ```
   supabase functions deploy send-push --no-verify-jwt
   ```
8. Setelah selesai, URL fungsinya adalah:
   ```
   https://PROJECT_REF_KAMU.supabase.co/functions/v1/send-push
   ```

### Langkah 3 — Tempel URL fungsi ke index.html

Cari `PUSH_FUNCTION_URL` di bagian atas `index.html`, isi dengan URL dari
langkah sebelumnya:
```js
var PUSH_FUNCTION_URL = 'https://PROJECT_REF_KAMU.supabase.co/functions/v1/send-push';
```
Simpan, lalu upload ulang ke Netlify seperti biasa (dengan `sw.js` di
folder yang sama).

### Langkah 4 — Aktifkan di tiap perangkat

Setelah semua di atas selesai, tombol **"Aktifkan Notifikasi Perangkat"**
akan muncul di pojok kanan atas untuk HR, HOD, dan Staff. Setiap orang
tinggal klik tombol itu **dari perangkat masing-masing** (HP atau
laptop) dan mengizinkan permintaan izin notifikasi dari browser — sekali
per perangkat. Kalau tidak ingin dipakai, tombolnya cukup diabaikan saja
(notifikasi dalam aplikasi tetap jalan seperti biasa).

## Notifikasi Email (Opsional)

Selain notifikasi dalam aplikasi dan push ke perangkat, ABC Selaras juga
bisa mengirim **notifikasi ke email** — HR, HOD, dan Staff dapat email
setiap kali ada kejadian yang biasanya memicu notifikasi (pengajuan
cuti, persetujuan jadwal, pengumuman, dll). Fitur ini **opsional** dan
**hanya berjalan dengan backend Supabase**.

File tambahan untuk fitur ini: `supabase-functions/send-email/index.ts`.

### Langkah 1 — Buat akun Resend (gratis)

1. Daftar gratis di [resend.com](https://resend.com) (tier gratis: ~3.000
   email/bulan, cukup untuk kebutuhan internal perusahaan kecil-menengah).
2. Di dashboard Resend, buka **API Keys** &rarr; buat API key baru, salin
   nilainya (formatnya `re_xxxxxxxx`).
3. Untuk mulai cepat, **tidak perlu** verifikasi domain dulu — Resend
   menyediakan alamat pengirim testing `onboarding@resend.dev` yang bisa
   langsung dipakai. Nanti kalau mau pengirimnya pakai domain sendiri
   (mis. `noreply@abchospitality.com`), verifikasi domain itu dulu di
   dashboard Resend baru ganti `FROM_EMAIL` di langkah berikutnya.

### Langkah 2 — Deploy Edge Function

**Cara termudah (tanpa CLI/Terminal sama sekali)** — Supabase sekarang
punya editor Edge Function langsung di dashboard browser:

1. Login ke [supabase.com/dashboard](https://supabase.com/dashboard),
   pilih project-mu, buka menu **Edge Functions** di sidebar kiri.
2. Klik **Create a new function** / **Deploy a new function**, beri
   nama persis: `send-email`.
3. Hapus kode contoh bawaan, tempel isi file
   `supabase-functions/send-email/index.ts` yang sudah disediakan.
4. Di halaman yang sama (atau di Project Settings &rarr; Edge
   Functions &rarr; Secrets), tambahkan dua secret:
   - `RESEND_API_KEY` &rarr; isi dengan API key dari Resend.
   - `FROM_EMAIL` &rarr; isi dengan `ABC Selaras <onboarding@resend.dev>`
5. Klik **Deploy**. Setelah aktif, salin URL fungsinya (bentuknya
   `https://PROJECT_REF_KAMU.supabase.co/functions/v1/send-email`).

**Alternatif lewat CLI** (kalau lebih suka Terminal, atau dashboard-mu
tidak menampilkan opsi di atas) — sama seperti setup `send-push`:
```
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
supabase secrets set FROM_EMAIL="ABC Selaras <onboarding@resend.dev>"
supabase functions deploy send-email --no-verify-jwt
```

### Langkah 3 — Tempel URL fungsi & isi alamat email

1. Cari `EMAIL_FUNCTION_URL` di bagian atas `index.html`, isi dengan URL
   dari langkah sebelumnya:
   ```js
   var EMAIL_FUNCTION_URL = 'https://PROJECT_REF_KAMU.supabase.co/functions/v1/send-email';
   ```
2. Simpan, lalu upload ulang ke Netlify.
3. Pastikan alamat email terisi:
   - **HR**: Pengaturan &rarr; kartu "Akun HR" &rarr; isi kolom Email.
   - **Staff/HOD**: HR mengisi kolom Email saat menambah/mengedit data
     karyawan di halaman Karyawan.

Begitu ketiga langkah ini selesai, notifikasi otomatis terkirim ke email
tanpa perlu aktivasi tambahan dari pengguna (beda dengan push yang butuh
klik "Aktifkan" per perangkat) — selama alamat emailnya terisi.

## Catatan penting

- Ini tetap aplikasi sederhana (front-end + database eksternal), bukan
  sistem tingkat enterprise — cukup untuk tim kecil, tapi **bukan**
  pengganti sistem payroll berlisensi untuk kebutuhan skala besar atau
  audit resmi.
- Password disimpan apa adanya (tidak dienkripsi) di database yang dipakai
  (Supabase atau Google Spreadsheet) — jangan pakai password yang sama
  dengan akun penting lain, dan batasi siapa saja yang punya akses langsung
  ke project Supabase / Spreadsheet-nya (terpisah dari siapa yang boleh
  login ke situs web-nya).
- Kunci `anon` Supabase (atau URL Apps Script) ada di source code
  `index.html` yang bisa dilihat siapa saja yang membuka situsnya — ini
  sudah diperhitungkan lewat kebijakan akses di `schema.sql`, tapi tetap
  jangan pernah menaruh kunci "service_role" Supabase di file ini.
- Kalau lupa password HR: buka tabel `kv_store` di Supabase (Table Editor)
  atau sheet "Data" di Google Spreadsheet, cari baris dengan key `hrdb`,
  isinya JSON berisi seluruh data termasuk `"hr":{"username":...,
  "password":...}` — bisa diedit manual dari sana kalau kepepet.
