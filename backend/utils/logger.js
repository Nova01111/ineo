// utils/logger.js
const db = require("../config/db");

/**
 * Catat aktivitas pengguna ke tabel activity_log.
 * Dipanggil setelah setiap operasi mutasi (INSERT / UPDATE / DELETE) berhasil.
 *
 * @param {number} user_id    - ID pengguna yang melakukan aksi (dari req.user.id)
 * @param {string} aksi       - Label singkat aksi, contoh: "Tambah Teknisi"
 * @param {string|null} keterangan - Detail tambahan, contoh: "Nama: Budi (budi@email.com)"
 */
async function logActivity(user_id, aksi, keterangan = null) {
  try {
    await db.query(
      "INSERT INTO activity_log (user_id, aksi, keterangan) VALUES (?, ?, ?)",
      [user_id, aksi, keterangan || null]
    );
  } catch (err) {
    // Log gagal tidak boleh menghentikan response utama
    console.error("[logActivity] Gagal mencatat log:", err.message);
  }
}

module.exports = { logActivity };