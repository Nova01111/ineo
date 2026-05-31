// controllers/adminCabangController.js
const db = require("../config/db");
const { logActivity } = require("../utils/logger");

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// GET /api/admin-cabang/dashboard
// ════════════════════════════════════════════════════════════════════════════
const getDashboard = async (req, res) => {
  // ✅ Hanya cabang_id yang dipakai sebagai filter di seluruh fungsi ini
  const { cabang_id } = req.user;
  try {
    // Total teknisi di cabang ini — sudah benar, pakai cabang_id
    const [[{ total_teknisi }]] = await db.query(
      "SELECT COUNT(*) AS total_teknisi FROM users WHERE cabang_id = ? AND role = 'teknisi' AND is_active = 1",
      [cabang_id]
    );

    // Baca bulan & tahun dari query param, fallback ke tanggal sekarang
    const now   = new Date();
    const bulan = req.query.bulan ? parseInt(req.query.bulan) : now.getMonth() + 1;
    const tahun = req.query.tahun ? parseInt(req.query.tahun) : now.getFullYear();

    // ✅ DIPERBAIKI: ganti admin_cabang_id → cabang_id
    // Agar semua admin di cabang yang sama melihat jumlah laporan yang sama
    const [[{ total_laporan }]] = await db.query(
      "SELECT COUNT(*) AS total_laporan FROM laporan_wo WHERE cabang_id = ? AND bulan = ? AND tahun = ?",
      [cabang_id, bulan, tahun]
    );

    // ✅ DIPERBAIKI: ganti admin_cabang_id → cabang_id
    const [[{ sudah_dibayar }]] = await db.query(
      `SELECT COUNT(*) AS sudah_dibayar 
       FROM laporan_wo lw
       JOIN rekap_gaji rg ON lw.id = rg.laporan_wo_id
       WHERE lw.cabang_id = ? AND lw.bulan = ? AND lw.tahun = ?
         AND rg.status = 'dibayar'`,
      [cabang_id, bulan, tahun]
    );

    // ✅ DIPERBAIKI: filter pakai cabang_id via JOIN agar konsisten
    // dengan getNotifikasi — semua admin satu cabang lihat angka yang sama
    const [[{ perlu_konfirmasi }]] = await db.query(
      `SELECT COUNT(*) AS perlu_konfirmasi
       FROM notifikasi_gaji ng
       JOIN rekap_gaji rg ON ng.rekap_gaji_id = rg.id
       JOIN laporan_wo lw ON rg.laporan_wo_id  = lw.id
       WHERE lw.cabang_id = ? AND ng.is_dikonfirmasi = 0`,
      [cabang_id]
    );

    // ✅ DIPERBAIKI: ganti admin_cabang_id → cabang_id pada JOIN laporan_wo
    // Agar tabel status menampilkan semua laporan dari cabang, bukan hanya
    // laporan yang dibuat oleh admin yang sedang login
    const [status_teknisi] = await db.query(
      `SELECT 
         u.id AS teknisi_id,
         u.nama AS nama_teknisi,
         sp.nama_sub AS sub_project,
         sp.tipe_pembayaran,
         rg.total_gaji,
         rg.gaji_bersih,
         rg.status AS status_pembayaran,
         lw.status AS status_laporan,
         ng.is_dikonfirmasi
       FROM users u
       LEFT JOIN laporan_wo lw 
         ON lw.teknisi_id = u.id 
         AND lw.cabang_id = ?
         AND lw.bulan = ? AND lw.tahun = ?
       LEFT JOIN sub_project sp ON lw.sub_project_id = sp.id
       LEFT JOIN rekap_gaji rg ON lw.id = rg.laporan_wo_id
       LEFT JOIN notifikasi_gaji ng ON rg.id = ng.rekap_gaji_id
       WHERE u.cabang_id = ? AND u.role = 'teknisi' AND u.is_active = 1
       ORDER BY u.nama`,
      [cabang_id, bulan, tahun, cabang_id]
    );

    return res.json({
      success: true,
      data: { total_teknisi, total_laporan, sudah_dibayar, perlu_konfirmasi, status_teknisi },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// LAPORAN WO
// ════════════════════════════════════════════════════════════════════════════

// GET /api/admin-cabang/laporan
const getLaporan = async (req, res) => {
  // ✅ DIPERBAIKI: ambil cabang_id sebagai filter utama
  const { cabang_id } = req.user;
  const { bulan, tahun, status } = req.query;

  try {
    let query = `
      SELECT 
        lw.id, lw.bulan, lw.tahun, lw.status,
        u.nama AS nama_teknisi,
        p.nama_provider,
        pr.nama_project,
        sp.nama_sub AS sub_project,
        sp.tipe_pembayaran,
        COALESCE(SUM(dw.upah_dihitung), 0) AS total_upah
      FROM laporan_wo lw
      JOIN users u        ON lw.teknisi_id     = u.id
      JOIN provider p     ON lw.provider_id    = p.id
      JOIN project pr     ON lw.project_id     = pr.id
      JOIN sub_project sp ON lw.sub_project_id = sp.id
      LEFT JOIN detail_wo dw ON lw.id          = dw.laporan_wo_id
      WHERE lw.cabang_id = ?
    `;
    // ✅ DIPERBAIKI: filter pakai cabang_id bukan admin_cabang_id
    const params = [cabang_id];

    if (bulan)  { query += " AND lw.bulan = ?";  params.push(bulan); }
    if (tahun)  { query += " AND lw.tahun = ?";  params.push(tahun); }
    if (status) { query += " AND lw.status = ?"; params.push(status); }

    query += " GROUP BY lw.id ORDER BY lw.tahun DESC, lw.bulan DESC";

    const [rows] = await db.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin-cabang/laporan/:id
const getLaporanDetail = async (req, res) => {
  // ✅ DIPERBAIKI: validasi pakai cabang_id bukan admin_cabang_id
  // Agar semua admin di cabang yang sama bisa melihat detail laporan
  const { cabang_id } = req.user;
  const { id } = req.params;

  try {
    const [[laporan]] = await db.query(
      `SELECT 
         lw.*, 
         u.nama AS nama_teknisi,
         p.nama_provider,
         pr.nama_project,
         sp.nama_sub AS sub_project,
         sp.tipe_pembayaran,
         sp.upah_per_wo,
         sp.gaji_tetap,
         c.nama_cabang
       FROM laporan_wo lw
       JOIN users u        ON lw.teknisi_id     = u.id
       JOIN provider p     ON lw.provider_id    = p.id
       JOIN project pr     ON lw.project_id     = pr.id
       JOIN sub_project sp ON lw.sub_project_id = sp.id
       JOIN cabang c       ON lw.cabang_id      = c.id
       WHERE lw.id = ? AND lw.cabang_id = ?`,
      [id, cabang_id]
    );

    if (!laporan)
      return res.status(404).json({ success: false, message: "Laporan tidak ditemukan" });

    const [detail] = await db.query(
      "SELECT * FROM detail_wo WHERE laporan_wo_id = ?",
      [id]
    );

    return res.json({ success: true, data: { laporan, detail } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/admin-cabang/laporan
const createLaporan = async (req, res) => {
  // createLaporan tetap menyimpan admin_cabang_id (siapa yang input)
  // dan cabang_id (cabang mana) — keduanya tetap diperlukan
  const { id: admin_cabang_id, cabang_id } = req.user;
  const {
    teknisi_id, provider_id, project_id,
    sub_project_id, bulan, tahun, detail_wo,
  } = req.body;

  if (!teknisi_id || !provider_id || !project_id || !sub_project_id || !bulan || !tahun || !detail_wo)
    return res.status(400).json({ success: false, message: "Semua field wajib diisi" });

  if (!Array.isArray(detail_wo) || detail_wo.length === 0)
    return res.status(400).json({ success: false, message: "Detail WO tidak boleh kosong" });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[sp]] = await conn.query(
      "SELECT * FROM sub_project WHERE id = ?",
      [sub_project_id]
    );
    if (!sp) throw new Error("Sub project tidak ditemukan");

    const [[duplikat]] = await conn.query(
      "SELECT id FROM laporan_wo WHERE teknisi_id = ? AND sub_project_id = ? AND bulan = ? AND tahun = ?",
      [teknisi_id, sub_project_id, bulan, tahun]
    );
    if (duplikat)
      throw new Error("Laporan untuk teknisi, sub project, dan periode ini sudah ada");

    const [result] = await conn.query(
      `INSERT INTO laporan_wo 
         (admin_cabang_id, teknisi_id, cabang_id, provider_id, project_id, sub_project_id, bulan, tahun, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [admin_cabang_id, teknisi_id, cabang_id, provider_id, project_id, sub_project_id, bulan, tahun]
    );
    const laporan_wo_id = result.insertId;

    for (const d of detail_wo) {
      let upah_dihitung = 0;

      if (sp.tipe_pembayaran === "per_wo") {
        if (!d.jumlah_wo || !d.jumlah_teknisi)
          throw new Error("jumlah_wo dan jumlah_teknisi wajib diisi untuk tipe per_wo");
        upah_dihitung = (sp.upah_per_wo / d.jumlah_teknisi) * d.jumlah_wo;

        await conn.query(
          `INSERT INTO detail_wo (laporan_wo_id, jumlah_wo, jumlah_teknisi, gaji_tetap, upah_dihitung, keterangan)
           VALUES (?, ?, ?, NULL, ?, ?)`,
          [laporan_wo_id, d.jumlah_wo, d.jumlah_teknisi, upah_dihitung, d.keterangan || null]
        );
      } else {
        upah_dihitung = sp.gaji_tetap;

        await conn.query(
          `INSERT INTO detail_wo (laporan_wo_id, jumlah_wo, jumlah_teknisi, gaji_tetap, upah_dihitung, keterangan)
           VALUES (?, NULL, NULL, ?, ?, ?)`,
          [laporan_wo_id, sp.gaji_tetap, upah_dihitung, d.keterangan || null]
        );
      }
    }

    await conn.commit();
    await logActivity(req.user.id, "Buat Laporan", `Laporan WO ID ${laporan_wo_id} dibuat (draft)`);
    return res.status(201).json({
      success: true,
      message: "Laporan berhasil dibuat (draft)",
      data: { laporan_wo_id },
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return res.status(400).json({ success: false, message: err.message || "Gagal membuat laporan" });
  } finally {
    conn.release();
  }
};

// PATCH /api/admin-cabang/laporan/:id/kirim
const kirimLaporan = async (req, res) => {
  // ✅ DIPERBAIKI: validasi pakai cabang_id
  // Semua admin di cabang yang sama boleh mengirim laporan cabangnya
  const { cabang_id } = req.user;
  const { id } = req.params;
  const { admin_pusat_id } = req.body;

  if (!admin_pusat_id)
    return res.status(400).json({ success: false, message: "admin_pusat_id wajib diisi" });

  try {
    const [[laporan]] = await db.query(
      "SELECT * FROM laporan_wo WHERE id = ? AND cabang_id = ?",
      [id, cabang_id]
    );

    if (!laporan)
      return res.status(404).json({ success: false, message: "Laporan tidak ditemukan" });

    if (laporan.status !== "draft")
      return res.status(400).json({ success: false, message: "Hanya laporan berstatus draft yang dapat dikirim" });

    const [[adminPusat]] = await db.query(
      "SELECT id FROM users WHERE id = ? AND role = 'admin_pusat' AND is_active = 1",
      [admin_pusat_id]
    );
    if (!adminPusat)
      return res.status(400).json({ success: false, message: "Admin pusat tidak ditemukan" });

    await db.query(
      "UPDATE laporan_wo SET admin_pusat_id = ?, status = 'terkirim', update_at = NOW() WHERE id = ?",
      [admin_pusat_id, id]
    );
    await logActivity(req.user.id, "Kirim Laporan", `Laporan ID ${id} dikirim ke admin pusat`);

    return res.json({ success: true, message: "Laporan berhasil dikirim ke admin pusat" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE /api/admin-cabang/laporan/:id  (hanya draft)
const deleteLaporan = async (req, res) => {
  // ✅ DIPERBAIKI: validasi pakai cabang_id
  // Semua admin di cabang yang sama boleh menghapus laporan draft cabangnya
  const { cabang_id } = req.user;
  const { id } = req.params;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[laporan]] = await conn.query(
      "SELECT * FROM laporan_wo WHERE id = ? AND cabang_id = ?",
      [id, cabang_id]
    );

    if (!laporan)
      throw new Error("Laporan tidak ditemukan");

    if (laporan.status !== "draft")
      throw new Error("Hanya laporan berstatus draft yang dapat dihapus");

    await conn.query("DELETE FROM detail_wo WHERE laporan_wo_id = ?", [id]);
    await conn.query("DELETE FROM laporan_wo WHERE id = ?", [id]);

    await conn.commit();
    await logActivity(req.user.id, "Hapus Laporan", `Laporan ID ${id} dihapus`);
    return res.json({ success: true, message: "Laporan berhasil dihapus" });
  } catch (err) {
    await conn.rollback();
    return res.status(400).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

// ════════════════════════════════════════════════════════════════════════════
// NOTIFIKASI
// ✅ DIPERBAIKI: filter pakai cabang_id via JOIN ke laporan_wo
// Agar semua admin di cabang yang sama bisa melihat semua notifikasi cabang
// ════════════════════════════════════════════════════════════════════════════

// GET /api/admin-cabang/notifikasi
const getNotifikasi = async (req, res) => {
  // ✅ Gunakan cabang_id sebagai filter utama
  const { cabang_id } = req.user;
  try {
    const [rows] = await db.query(
      `SELECT 
         ng.id, ng.is_dibaca, ng.is_dikonfirmasi, ng.tgl_konfirmasi, ng.created_at,
         u.nama  AS nama_teknisi,
         rg.total_gaji, rg.total_potongan, rg.gaji_bersih, rg.tgl_transfer, rg.screenshot_path,
         ap.nama AS nama_admin_pusat
       FROM notifikasi_gaji ng
       JOIN users u         ON ng.teknisi_id    = u.id
       JOIN rekap_gaji rg   ON ng.rekap_gaji_id = rg.id
       JOIN laporan_wo lw   ON rg.laporan_wo_id = lw.id
       JOIN users ap        ON ng.admin_pusat_id = ap.id
       WHERE lw.cabang_id = ?
       ORDER BY ng.created_at DESC`,
      [cabang_id]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// PATCH /api/admin-cabang/notifikasi/:id/konfirmasi
const konfirmasiNotifikasi = async (req, res) => {
  // ✅ Validasi pakai cabang_id via JOIN — semua admin satu cabang
  //    bisa mengkonfirmasi notifikasi cabang mereka
  const { cabang_id } = req.user;
  const { id } = req.params;
  try {
    const [[notif]] = await db.query(
      `SELECT ng.*
       FROM notifikasi_gaji ng
       JOIN rekap_gaji rg ON ng.rekap_gaji_id = rg.id
       JOIN laporan_wo lw ON rg.laporan_wo_id  = lw.id
       WHERE ng.id = ? AND lw.cabang_id = ?`,
      [id, cabang_id]
    );

    if (!notif)
      return res.status(404).json({ success: false, message: "Notifikasi tidak ditemukan" });

    if (notif.is_dikonfirmasi === 1)
      return res.status(400).json({ success: false, message: "Notifikasi sudah dikonfirmasi sebelumnya" });

    await db.query(
      "UPDATE notifikasi_gaji SET is_dibaca = 1, is_dikonfirmasi = 1, tgl_konfirmasi = NOW() WHERE id = ?",
      [id]
    );

    await db.query(
      `UPDATE laporan_wo lw
       JOIN rekap_gaji rg    ON lw.id  = rg.laporan_wo_id
       JOIN notifikasi_gaji ng ON rg.id = ng.rekap_gaji_id
       SET lw.status = 'selesai', lw.update_at = NOW()
       WHERE ng.id = ?`,
      [id]
    );
    await logActivity(req.user.id, "Konfirmasi Notifikasi", `Notifikasi ID ${id} dikonfirmasi`);

    return res.json({ success: true, message: "Konfirmasi berhasil disimpan" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// MASTER DATA (untuk kebutuhan form dropdown)
// ════════════════════════════════════════════════════════════════════════════

// GET /api/admin-cabang/master/teknisi
const getTeknisi = async (req, res) => {
  const { cabang_id } = req.user;
  try {
    const [rows] = await db.query(
      "SELECT id, nama, email FROM users WHERE cabang_id = ? AND role = 'teknisi' AND is_active = 1 ORDER BY nama",
      [cabang_id]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin-cabang/master/provider
const getProvider = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, nama_provider, kode FROM provider ORDER BY nama_provider");
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin-cabang/master/project/:provider_id
const getProject = async (req, res) => {
  const { provider_id } = req.params;
  try {
    const [rows] = await db.query(
      "SELECT id, nama_project, deskripsi FROM project WHERE provider_id = ? ORDER BY nama_project",
      [provider_id]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin-cabang/master/sub-project/:project_id
const getSubProject = async (req, res) => {
  const { project_id } = req.params;
  try {
    const [rows] = await db.query(
      "SELECT id, nama_sub, tipe_pembayaran, upah_per_wo, gaji_tetap FROM sub_project WHERE project_id = ? ORDER BY nama_sub",
      [project_id]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin-cabang/master/admin-pusat
const getAdminPusat = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, nama, email FROM users WHERE role = 'admin_pusat' AND is_active = 1 ORDER BY nama"
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin-cabang/slip-gaji/:teknisi_id
const getSlipGaji = async (req, res) => {
  // ✅ DIPERBAIKI: filter pakai cabang_id bukan admin_cabang_id
  // Agar semua admin di cabang yang sama bisa melihat slip gaji teknisinya
  const { cabang_id } = req.user;
  const { teknisi_id } = req.params;
  const { bulan, tahun } = req.query;

  try {
    const [rows] = await db.query(
      `SELECT 
         rg.total_gaji, rg.total_potongan, rg.gaji_bersih,
         rg.screenshot_path, rg.tgl_transfer, rg.status,
         lw.bulan, lw.tahun,
         u.nama AS nama_teknisi,
         sp.nama_sub AS sub_project,
         sp.tipe_pembayaran,
         p.nama_provider,
         pr.nama_project
       FROM rekap_gaji rg
       JOIN laporan_wo lw  ON rg.laporan_wo_id  = lw.id
       JOIN users u        ON lw.teknisi_id     = u.id
       JOIN sub_project sp ON lw.sub_project_id = sp.id
       JOIN provider p     ON lw.provider_id    = p.id
       JOIN project pr     ON lw.project_id     = pr.id
       WHERE lw.cabang_id = ? AND lw.teknisi_id = ?
         ${bulan ? "AND lw.bulan = ?" : ""}
         ${tahun ? "AND lw.tahun = ?" : ""}
       ORDER BY lw.tahun DESC, lw.bulan DESC`,
      [cabang_id, teknisi_id, ...(bulan ? [bulan] : []), ...(tahun ? [tahun] : [])]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getDashboard,
  getLaporan, getLaporanDetail, createLaporan, kirimLaporan, deleteLaporan,
  getNotifikasi, konfirmasiNotifikasi,
  getTeknisi, getProvider, getProject, getSubProject, getAdminPusat,
  getSlipGaji,
};