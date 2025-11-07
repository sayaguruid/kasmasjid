# Aplikasi Kas Masjid (Google Apps Script)

Aplikasi web sederhana berbasis Google Apps Script dan Google Sheets untuk mengelola dan menampilkan transaksi keuangan masjid.

## ✨ Fitur

* **Dashboard Publik:** Tampilan `read-only` untuk siapa saja melihat ringkasan saldo dari setiap pos keuangan.
* **Login Admin:** Panel admin dilindungi oleh password yang diatur langsung dari Google Sheet.
* **Manajemen Transaksi (Admin):**
    * **Tambah** transaksi pemasukan dan pengeluaran.
    * **Edit** transaksi yang sudah ada (tanggal, jumlah, keterangan).
    * **Hapus** transaksi.
* **Riwayat Transaksi:** Tampilan riwayat per kategori dengan *pagination* (data terbaru tampil di atas).
* **Kategori Virtual:** Logika khusus untuk kategori seperti "Sodaqoh Harian" atau "Sodaqoh Lemparan" yang otomatis tercatat di "Kas Masjid" namun tetap terdata di log utama dengan kategori aslinya.
* **Pembuatan Sheet Otomatis:** Script akan otomatis membuat sheet baru jika nama sheet di konfigurasi belum ada.

## 🚀 Instalasi & Setup

Untuk menggunakan proyek ini, ikuti langkah-langkah berikut:

1.  **Buat Google Sheet Baru:**
    * Buka [sheets.google.com](https://sheets.google.com) dan buat Spreadsheet baru. Beri nama (misalnya: "Kas Masjid").

2.  **Buka Apps Script Editor:**
    * Klik **Extensions** > **Apps Script**.

3.  **Salin Kode:**
    * **`Code.gs`**: Hapus semua kode default di file `Code.gs` dan tempelkan semua isi dari file `Code.gs` di repositori ini.
    * **`index.html`**: Klik ikon **+** (Tambah file) > **HTML**. Beri nama file `index` (pastikan namanya `index.html`). Hapus isi defaultnya dan tempelkan semua isi dari file `index.html` di repositori ini.

4.  **Konfigurasi Password (Wajib):**
    * Kembali ke Google Sheet Anda.
    * Buat sheet baru (tab baru di bagian bawah) dan beri nama **`Admin`**. (Nama ini harus sama persis).
    * Di dalam sheet `Admin`, klik sel **B2** dan ketikkan password yang Anda inginkan.
    * 

5.  **Simpan Proyek:**
    * Klik ikon **Simpan Proyek** (disket) di editor Apps Script.

6.  **Deploy sebagai Web App:**
    * Di editor Apps Script, klik tombol **Deploy** > **New deployment**.
    * Klik ikon **Gigi Roda** (Select type) di sebelah kiri, dan pilih **Web app**.
    * Pada bagian **Configuration**:
        * **Description**: (Opsional) Tulis deskripsi, misal "Aplikasi Kas v1".
        * **Execute as**: Pilih **Me**.
        * **Who has access**: Pilih **Anyone**. (Ini penting agar dashboard bisa dilihat publik).
    * Klik **Deploy**.
    * **Otorisasi:** Google akan meminta Anda untuk "Authorize access". Klik, pilih akun Google Anda, klik "Advanced", lalu "Go to (unsafe)...", dan "Allow".
    * **Selesai!** Salin **Web app URL** yang diberikan. Itulah link ke aplikasi Anda.

## 📂 Struktur Kode

* **`Code.gs` (Server-side):**
    * `doGet(e)`: Menyajikan `index.html`.
    * Fungsi Otorisasi (`getPassword_`, `checkPassword_`, `verifyPassword`): Menangani logika login.
    * Fungsi Publik (`getDashboardData`): Mengambil data untuk dashboard (tanpa login).
    * Fungsi Admin (`getCategories`, `getHistoryData`, `getTransactionForEdit`, `updateTransaction`, `deleteTransaction`, `addNewTransaction`): Logika inti aplikasi yang memerlukan password.
    * Fungsi Helper (`calculateSheetBalance_`, `findRowByTrxId_`, dll.): Fungsi internal untuk membantu logika utama.

* **`index.html` (Client-side):**
    * Berisi semua HTML (Bootstrap), CSS (inline), dan JavaScript (di dalam tag `<script>`).
    * JavaScript di sisi klien menangani semua interaksi UI, menampilkan data, dan memanggil fungsi di `Code.gs` menggunakan `google.script.run`.
