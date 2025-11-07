// ====== KONFIGURASI ======
const SS = SpreadsheetApp.getActiveSpreadsheet();

const NAMA_SHEET = {
  LOG: "Semua Transaksi",
  KAS: "Kas Masjid",
  QURBAN: "Tabungan Qurban",
  GSG: "Pembangunan GSG",
  SAHAM: "Saham",
  SNACK: "Snack Caberawit",
  HARIAN: "Sodaqoh Harian Kelompok",
  JUMAT: "Sodaqoh Jumatan",
  JATAH: "Jatah Drh/Ds",
  KEMATIAN: "Dana Kematian",
  LEMPARAN: "Sodaqoh Lemparan"
};

const HEADERS_LOG = ["ID Transaksi", "Tanggal", "Jenis", "Kategori", "Keterangan", "Pemasukan", "Pengeluaran"];
const HEADERS_KATEGORI = ["ID Transaksi", "Tanggal", "Keterangan", "Pemasukan", "Pengeluaran"];
// =========================


/**
 * [MODIFIKASI] doGet sekarang bersifat publik
 * Menyajikan file index.html ke siapa saja (Tamu atau Admin).
 * @param {GoogleAppsScript.Events.AppsScriptHttpRequest} e Objek event dari request HTTP.
 * @returns {GoogleAppsScript.HTML.HtmlOutput} Output HTML yang akan disajikan.
 */
function doGet(e) {
  let html = HtmlService.createTemplateFromFile("index").evaluate();
  html.setTitle("Aplikasi Kas Masjid");
  return html;
}

// ==========================================================
// [BARU] FUNGSI OTORISASI (Login dengan Password)
// ==========================================================

/**
 * [BARU] [INTERNAL] Mengambil password utama dari Sheet "Admin" sel B2.
 * @private
 * @returns {string|null} Password admin, atau null jika terjadi error.
 */
function getPassword_() {
  try {
    const sheet = SS.getSheetByName("Admin");
    if (!sheet) throw new Error("Sheet 'Admin' tidak ditemukan.");
    const password = sheet.getRange("B2").getValue();
    if (!password) throw new Error("Password di 'Admin!B2' belum diatur.");
    return password.toString().trim();
  } catch (e) {
    Logger.log(e);
    return null; // Mengembalikan null jika ada error
  }
}

/**
 * [BARU] [INTERNAL] Helper internal untuk mengecek password.
 * @private
 * @param {string} password Password yang diberikan oleh user.
 * @returns {boolean} True jika password cocok.
 */
function checkPassword_(password) {
  const correctPassword = getPassword_();
  if (!correctPassword) return false; // Gagal jika password server tidak ada
  return password === correctPassword;
}

/**
 * [BARU] Fungsi yang dipanggil dari client untuk memverifikasi password.
 * @param {string} userPassword Password yang diinput oleh user.
 * @returns {object} Objek status {status: "success"} or {status: "error", message: "..."}.
 */
function verifyPassword(userPassword) {
  if (!userPassword) {
    return { status: "error", message: "Password tidak boleh kosong." };
  }
  if (checkPassword_(userPassword)) {
    return { status: "success" };
  } else {
    return { status: "error", message: "Password salah." };
  }
}


// ==========================================================
// FUNGSI PUBLIK (Dapat diakses oleh Tamu)
// ==========================================================

/**
 * [PUBLIK] getDashboardData tidak memerlukan password.
 * Mengambil saldo dari setiap sheet kategori.
 * @returns {object} Objek dengan key nama sheet dan value saldonya.
 */
function getDashboardData() {
  const dashboardData = {};
  for (const key in NAMA_SHEET) {
    // **MODIFIKASI**: Lewati LOG, HARIAN, dan LEMPARAN.
    if (key === 'LOG' || key === 'HARIAN' || key === 'LEMPARAN') continue;
    
    const sheetName = NAMA_SHEET[key];
    const sheet = SS.getSheetByName(sheetName);
    let balance = 0;
    if (sheet) {
      balance = calculateSheetBalance_(sheet);
    }
    dashboardData[sheetName] = balance;
  }
  return dashboardData;
}

// ==========================================================
// FUNGSI ADMIN (Memerlukan Password)
// ==========================================================

/**
 * [MODIFIKASI] Memerlukan password untuk mengambil kategori.
 * @param {string} password Password admin.
 * @returns {object} Objek NAMA_SHEET jika otorisasi berhasil, jika tidak, objek kosong.
 */
function getCategories(password) {
  if (!checkPassword_(password)) {
    Logger.log("Otorisasi Gagal: getCategories");
    return {}; // Kembalikan objek kosong jika otorisasi gagal
  }

  const categories = {};
  for (const key in NAMA_SHEET) {
    categories[key] = NAMA_SHEET[key];
  }
  return categories;
}


/**
 * [ADMIN] Mengambil data riwayat transaksi dengan pagination.
 * @param {string} sheetName Nama sheet kategori.
 * @param {number} page Nomor halaman yang diminta.
 * @param {number} itemsPerPage Jumlah item per halaman.
 * @param {string} adminPassword Password admin.
 * @returns {object} Objek data yang sudah dipaginasi.
 */
function getHistoryData(sheetName, page = 1, itemsPerPage = 20, adminPassword) {
  try {
    if (!checkPassword_(adminPassword)) {
      return { error: "Otorisasi Gagal. Silakan login kembali." };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet;
    let allData;
    let headers;

    // Cek apakah ini kategori virtual (HARIAN / LEMPARAN)
    const isVirtualCategory = (sheetName === NAMA_SHEET.HARIAN || sheetName === NAMA_SHEET.LEMPARAN);

    if (isVirtualCategory) {
      // Jika virtual, ambil data dari LOG dan filter
      sheet = ss.getSheetByName(NAMA_SHEET.LOG);
      if (!sheet) {
        return { error: `Sheet LOG "${NAMA_SHEET.LOG}" tidak ditemukan.` };
      }
      
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        return { headers: [], data: [], page: 1, totalPages: 1, totalItems: 0 };
      }

      const logData = sheet.getRange(2, 1, lastRow - 1, HEADERS_LOG.length).getDisplayValues();
      const filteredData = logData.filter(row => row[3] === sheetName);
      
      allData = filteredData.map(row => [
        row[0], // ID Transaksi
        row[1], // Tanggal
        row[4], // Keterangan
        row[5], // Pemasukan
        row[6]  // Pengeluaran
      ]);
      
      headers = HEADERS_KATEGORI;

    } else {
      // Jika BUKAN virtual, ambil data seperti biasa
      sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        return { error: `Sheet "${sheetName}" tidak ditemukan.` };
      }
      
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        return { headers: [], data: [], page: 1, totalPages: 1, totalItems: 0 };
      }
      
      const dataRange = sheet.getRange(2, 1, lastRow - 1, 5);
      allData = dataRange.getDisplayValues();
      headers = sheet.getRange(1, 1, 1, 5).getDisplayValues()[0];
    }

    // --- INI BAGIAN PENTINGNYA ---
    
    const totalItems = allData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // **1. TRANSAKSI TERBARU DI ATAS**
    const reversedData = allData.reverse();

    // **2. PAGINATION (PAGINASI)**
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    const paginatedData = reversedData.slice(startIndex, endIndex);

    return {
      headers: headers,
      data: paginatedData,
      page: page,
      totalPages: totalPages,
      totalItems: totalItems
    };

  } catch (e) {
    return { error: `Terjadi kesalahan di server: ${e.message}` };
  }
}
/**
 * [MODIFIKASI] Memerlukan password untuk mengambil data edit.
 * @param {string} trxId ID Transaksi yang akan diedit.
 * @param {string} password Password admin.
 * @returns {object} Objek status {status: "success", data: {...}} or {status: "error", message: "..."}.
 */
function getTransactionForEdit(trxId, password) {
  try {
    if (!checkPassword_(password)) {
      throw new Error("Otorisasi Gagal. Silakan login kembali.");
    }

    const logSheet = SS.getSheetByName(NAMA_SHEET.LOG);
    const rowNum = findRowByTrxId_(logSheet, trxId);

    if (!rowNum) {
      throw new Error("Transaksi tidak ditemukan di log utama.");
    }

    const data = logSheet.getRange(rowNum, 1, 1, HEADERS_LOG.length).getValues()[0];

    return {
      status: "success",
      data: {
        trxId: data[0],
        tanggal: new Date(data[1]).toISOString(),
        jenis: data[2],
        kategori: data[3],
        keterangan: data[4],
        pemasukan: data[5] || 0,
        pengeluaran: data[6] || 0
      }
    };
  } catch (error) {
    Logger.log(error);
    return { status: "error", message: error.message };
  }
}

/**
 * [MODIFIKASI] Memerlukan password untuk update transaksi.
 * @param {object} formData Data dari form edit (trxId, tanggal, jumlah, keterangan).
 * @param {string} password Password admin.
 * @returns {object} Objek status {status: "success", message: "..."} or {status: "error", message: "..."}.
 */
function updateTransaction(formData, password) {
  try {
    if (!checkPassword_(password)) {
      throw new Error("Otorisasi Gagal. Silakan login kembali.");
    }

    const { trxId, tanggal, jumlah, keterangan } = formData;
    const tanggalObj = new Date(tanggal);
    const jumlahNum = parseFloat(jumlah);

    const logSheet = SS.getSheetByName(NAMA_SHEET.LOG);
    const logRowNum = findRowByTrxId_(logSheet, trxId);
    if (!logRowNum) throw new Error("Gagal menemukan transaksi di LOG untuk di-update.");

    const logData = logSheet.getRange(logRowNum, 1, 1, HEADERS_LOG.length).getValues()[0];
    const originalJenis = logData[2];
    const originalKategoriNama = logData[3];

    const isKategoriAsliVirtual = (originalKategoriNama === NAMA_SHEET.HARIAN || originalKategoriNama === NAMA_SHEET.LEMPARAN);

    let pemasukan = 0, pengeluaran = 0, keteranganFinal = "";

    if (originalJenis === "Pemasukan") {
      pemasukan = jumlahNum;
      if (originalKategoriNama === NAMA_SHEET.KAS || isKategoriAsliVirtual) {
        keteranganFinal = keterangan;
      } else {
        keteranganFinal = "Pemasukan " + originalKategoriNama;
      }
    } else {
      pengeluaran = jumlahNum;
      keteranganFinal = keterangan;
    }

    const logRowData = [
      trxId, tanggalObj, originalJenis, originalKategoriNama, keteranganFinal,
      pemasukan, pengeluaran
    ];
    logSheet.getRange(logRowNum, 1, 1, logRowData.length).setValues([logRowData]);
    formatNewRow_(logSheet, HEADERS_LOG);

    let sheetTujuanNama = originalKategoriNama;
    if (isKategoriAsliVirtual) {
      sheetTujuanNama = NAMA_SHEET.KAS;
    }

    const kategoriSheet = SS.getSheetByName(sheetTujuanNama);
    if (kategoriSheet) {
      const kategoriRowNum = findRowByTrxId_(kategoriSheet, trxId);
      if (kategoriRowNum) {
        const kategoriRowData = [
          trxId, tanggalObj, keteranganFinal, pemasukan, pengeluaran
        ];
        kategoriSheet.getRange(kategoriRowNum, 1, 1, kategoriRowData.length).setValues([kategoriRowData]);
        formatNewRow_(kategoriSheet, HEADERS_KATEGORI);
      }
    }

    return { status: "success", message: "Transaksi berhasil diperbarui." };

  } catch (error) {
    Logger.log(error);
    return { status: "error", message: error.message };
  }
}

/**
 * [MODIFIKASI] Memerlukan password untuk hapus transaksi.
 * @param {string} trxId ID Transaksi yang akan dihapus.
 * @param {string} kategoriKey Key kategori (cth: "HARIAN").
 * @param {string} sheetName Nama sheet kategori (cth: "Sodaqoh Harian Kelompok").
 * @param {string} password Password admin.
 * @returns {object} Objek status {status: "success", message: "..."} or {status: "error", message: "..."}.
 */
function deleteTransaction(trxId, kategoriKey, sheetName, password) {
  try {
    if (!checkPassword_(password)) {
      throw new Error("Otorisasi Gagal. Silakan login kembali.");
    }

    // Hapus dari LOG (Selalu)
    deleteRowByTrxId_(NAMA_SHEET.LOG, trxId);
    
    let sheetTujuanNama = sheetName;
    if (kategoriKey === "HARIAN" || kategoriKey === "LEMPARAN") {
      sheetTujuanNama = NAMA_SHEET.KAS;
    }

    // Hapus dari sheet fisik
    deleteRowByTrxId_(sheetTujuanNama, trxId);

    return { status: "success", message: `Transaksi ${trxId} berhasil dihapus.` };
  } catch (error) {
    Logger.log(error);
    return { status: "error", message: error.message };
  }
}

/**
 * [MODIFIKASI] Memerlukan password untuk menambah transaksi baru.
 * @param {object} formData Data dari form input.
 * @param {string} password Password admin.
 * @returns {object} Objek status {status: "success", message: "..."} or {status: "error", message: "..."}.
 */
function addNewTransaction(formData, password) {
  try {
    if (!checkPassword_(password)) {
      throw new Error("Otorisasi Gagal. Silakan login kembali.");
    }

    const { tanggal, jenis, kategoriKey, jumlah, keterangan_input } = formData;

    if (!tanggal || !jenis || !kategoriKey || !jumlah) {
      throw new Error("Data tidak lengkap.");
    }
    if (kategoriKey === "LOG") {
      throw new Error("Tidak bisa input langsung ke 'Semua Transaksi'.");
    }

    const kategoriNama = NAMA_SHEET[kategoriKey];
    if (!kategoriNama) throw new Error("Kategori tidak valid.");

    let sheetTujuanNama = kategoriNama;
    let keteranganOtomatis = false;
    
    const isKategoriKasVirtual = (kategoriKey === 'HARIAN' || kategoriKey === 'LEMPARAN');
    
    if (isKategoriKasVirtual) {
      if (jenis === 'Pengeluaran') {
        throw new Error(`Kategori "${kategoriNama}" hanya bisa untuk Pemasukan.`);
      }
      sheetTujuanNama = NAMA_SHEET.KAS; // Alihkan ke Kas Masjid
      if (jenis === "Pemasukan" && !keterangan_input) {
        keteranganOtomatis = true; 
      }
    }

    const tanggalObj = new Date(tanggal);
    const jumlahNum = parseFloat(jumlah);
    const trxId = Utilities.getUuid();

    let pemasukan = 0, pengeluaran = 0, keteranganFinal = "";

    if (jenis === "Pemasukan") {
      pemasukan = jumlahNum;
      
      if (kategoriKey === 'KAS' || isKategoriKasVirtual) {
        if (keteranganOtomatis) {
          keteranganFinal = "Pemasukan " + kategoriNama;
        } else {
          keteranganFinal = keterangan_input;
        }
        
        if (!keteranganFinal) {
          throw new Error(`Keterangan wajib diisi untuk Pemasukan "${kategoriNama}".`);
        }
      } else {
        keteranganFinal = "Pemasukan " + kategoriNama;
      }
    } else { // Jenis "Pengeluaran"
      pengeluaran = jumlahNum;
      keteranganFinal = keterangan_input;
      if (!keteranganFinal) {
        throw new Error("Keterangan wajib diisi untuk pengeluaran.");
      }
    }

    // Tulis ke LOG
    const logSheet = getOrCreateSheet_(NAMA_SHEET.LOG, HEADERS_LOG);
    const logRow = [
      trxId, tanggalObj, jenis, kategoriNama, keteranganFinal,
      pemasukan, pengeluaran
    ];
    logSheet.appendRow(logRow);
    formatNewRow_(logSheet, HEADERS_LOG);

    // Tulis ke Sheet Fisik Tujuan
    const kategoriSheet = getOrCreateSheet_(sheetTujuanNama, HEADERS_KATEGORI);
    const kategoriRow = [
      trxId, tanggalObj, keteranganFinal, pemasukan, pengeluaran
    ];
    kategoriSheet.appendRow(kategoriRow);
    formatNewRow_(kategoriSheet, HEADERS_KATEGORI);
    
    return { status: "success", message: `Transaksi ${kategoriNama} (Rp ${jumlahNum.toLocaleString('id-ID')}) berhasil dicatat.` };

  } catch (error) {
    Logger.log(error);
    return { status: "error", message: error.message };
  }
}
// ==========================================================
// FUNGSI HELPER INTERNAL (Tidak Perlu Diubah)
// ==========================================================

/**
 * [HELPER] Menghitung saldo sheet (dipanggil oleh getDashboardData).
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Objek sheet.
 * @returns {number} Total saldo sheet.
 */
function calculateSheetBalance_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const data = sheet.getRange(2, 4, lastRow - 1, 2).getValues();
  let totalPemasukan = 0;
  let totalPengeluaran = 0;

  for (const row of data) {
    if (typeof row[0] === 'number') totalPemasukan += row[0];
    if (typeof row[1] === 'number') totalPengeluaran += row[1];
  }
  return totalPemasukan - totalPengeluaran;
}

/**
 * [HELPER] Memformat mata uang (dipanggil oleh getHistoryData).
 * @param {number} number Angka yang akan diformat.
 * @returns {string} String mata uang (cth: "Rp 10.000").
 */
function formatCurrency(number) {
  if (typeof number !== 'number' || number === 0) {
    return "Rp 0";
  }
  return "Rp " + number.toLocaleString('id-ID');
}

/**
 * [HELPER] Mencari baris berdasarkan ID Transaksi.
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Objek sheet.
 * @param {string} trxId ID Transaksi yang dicari.
 * @returns {number|null} Nomor baris, atau null jika tidak ditemukan.
 */
function findRowByTrxId_(sheet, trxId) {
  if (!sheet) return null;
  const textFinder = sheet.createTextFinder(trxId);
  const range = textFinder.findNext();

  if (range) {
    return range.getRow();
  }
  return null;
}

/**
 * [HELPER] Menghapus baris berdasarkan ID Transaksi.
 * @private
 * @param {string} sheetName Nama sheet.
 * @param {string} trxId ID Transaksi yang akan dihapus.
 */
function deleteRowByTrxId_(sheetName, trxId) {
  const sheet = SS.getSheetByName(sheetName);
  const rowNum = findRowByTrxId_(sheet, trxId);
  if (rowNum) {
    sheet.deleteRow(rowNum);
  }
}

/**
 * [HELPER] Membuat sheet baru jika belum ada, lalu mengatur header & format.
 * @private
 * @param {string} sheetName Nama sheet yang akan dibuat/dicari.
 * @param {string[]} headers Array string untuk header.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} Objek sheet.
 */
function getOrCreateSheet_(sheetName, headers) {
  let sheet = SS.getSheetByName(sheetName);
  if (!sheet) {
    sheet = SS.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setHorizontalAlignment("center");

    sheet.setColumnWidth(1, 150); // ID Transaksi
    sheet.setColumnWidth(2, 150); // Tanggal

    if (headers.length === HEADERS_LOG.length) { // Log Sheet (7 cols)
      sheet.setColumnWidth(3, 100);
      sheet.setColumnWidth(4, 180);
      sheet.setColumnWidth(5, 250);
      sheet.setColumnWidths(6, 2, 130);
    } else { // Kategori Sheet (5 cols)
      sheet.setColumnWidth(3, 250);
      sheet.setColumnWidths(4, 2, 130);
    }
  }
  return sheet;
}

/**
 * [HELPER] Memformat baris baru yang ditambahkan (format tanggal & mata uang).
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Objek sheet.
 * @param {string[]} headers Array header (untuk menentukan kolom mata uang).
 */
function formatNewRow_(sheet, headers) {
  const newRow = sheet.getLastRow();
  sheet.getRange(newRow, 2).setNumberFormat("dd/MM/yyyy");

  let moneyColumnStart = (headers.length === HEADERS_LOG.length) ? 6 : 4;
  sheet.getRange(newRow, moneyColumnStart, 1, 2).setNumberFormat("Rp #,##0");
}
