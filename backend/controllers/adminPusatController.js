// controllers/adminPusatController.js
const db = require("../config/db");

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// GET /api/admin-pusat/dashboard
// ════════════════════════════════════════════════════════════════════════════
const getDashboard = async (req, res) => {
  const { id: admin_pusat_id } = req.user;
  const now   = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();

  try {
    // Total laporan masuk (terkirim) ke admin pusat ini
    const [[{ laporan_masuk }]] = await db.query(
      `SELECT COUNT(*) AS laporan_masuk 
       FROM laporan_wo 
       WHERE admin_pusat_id = ? AND status = 'terkirim'`,
      [admin_pusat_id]
    );

    // Total gaji dibayar bulan ini
    const [[{ total_gaji_dibayar }]] = await db.query(
      `SELECT COALESCE(SUM(rg.gaji_bersih), 0) AS total_gaji_dibayar
       FROM rekap_gaji rg
       JOIN laporan_wo lw ON rg.laporan_wo_id = lw.id
       WHERE rg.admin_pusat_id = ? AND lw.bulan = ? AND lw.tahun = ?
         AND rg.status = 'dibayar'`,
      [admin_pusat_id, bulan, tahun]
    );

    // Total teknisi dibayar bulan ini
    const [[{ teknisi_dibayar }]] = await db.query(
      `SELECT COUNT(*) AS teknisi_dibayar
       FROM rekap_gaji rg
       JOIN laporan_wo lw ON rg.laporan_wo_id = lw.id
       WHERE rg.admin_pusat_id = ? AND lw.bulan = ? AND lw.tahun = ?
         AND rg.status = 'dibayar'`,
      [admin_pusat_id, bulan, tahun]
    );

    // Menunggu konfirmasi admin cabang
    const [[{ menunggu_konfirmasi }]] = await db.query(
      `SELECT COUNT(*) AS menunggu_konfirmasi
       FROM notifikasi_gaji
       WHERE admin_pusat_id = ? AND is_dikonfirmasi = 0`,
      [admin_pusat_id]
    );

    // Ringkasan laporan bulan ini
    const [ringkasan] = await db.query(
      `SELECT
         u.nama AS nama_teknisi,
         c.nama_cabang,
         sp.nama_sub AS sub_project,
         rg.total_gaji,
         rg.gaji_bersih,
         rg.status AS status_pembayaran,
         lw.status AS status_laporan
       FROM laporan_wo lw
       JOIN users u        ON lw.teknisi_id     = u.id
       JOIN cabang c       ON lw.cabang_id      = c.id
       JOIN sub_project sp ON lw.sub_project_id = sp.id
       LEFT JOIN rekap_gaji rg ON lw.id         = rg.laporan_wo_id
       WHERE lw.admin_pusat_id = ? AND lw.bulan = ? AND lw.tahun = ?
       ORDER BY u.nama`,
      [admin_pusat_id, bulan, tahun]
    );

    // Status konfirmasi per cabang
    const [status_cabang] = await db.query(
      `SELECT
         c.nama_cabang,
         COUNT(ng.id) AS total_notifikasi,
         SUM(ng.is_dikonfirmasi) AS sudah_konfirmasi
       FROM notifikasi_gaji ng
       JOIN users ac ON ng.admin_cabang_id = ac.id
       JOIN cabang c ON ac.cabang_id = c.id
       WHERE ng.admin_pusat_id = ?
       GROUP BY c.id, c.nama_cabang`,
      [admin_pusat_id]
    );

    return res.json({
      success: true,
      data: {
        laporan_masuk,
        total_gaji_dibayar,
        teknisi_dibayar,
        menunggu_konfirmasi,
        ringkasan,
        status_cabang,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// LAPORAN MASUK
// ════════════════════════════════════════════════════════════════════════════

// GET /api/admin-pusat/laporan-masuk
const getLaporanMasuk = async (req, res) => {
  const { id: admin_pusat_id } = req.user;
  const { bulan, tahun, status, cabang_id } = req.query;

  try {
    let query = `
      SELECT
        lw.id, lw.bulan, lw.tahun, lw.status,
        u.nama AS nama_teknisi,
        ac.nama AS nama_admin_cabang,
        c.nama_cabang,
        p.nama_provider,
        pr.nama_project,
        sp.nama_sub AS sub_project,
        sp.tipe_pembayaran,
        COALESCE(SUM(dw.upah_dihitung), 0) AS total_upah
      FROM laporan_wo lw
      JOIN users u        ON lw.teknisi_id      = u.id
      JOIN users ac       ON lw.admin_cabang_id = ac.id
      JOIN cabang c       ON lw.cabang_id       = c.id
      JOIN provider p     ON lw.provider_id     = p.id
      JOIN project pr     ON lw.project_id      = pr.id
      JOIN sub_project sp ON lw.sub_project_id  = sp.id
      LEFT JOIN detail_wo dw ON lw.id           = dw.laporan_wo_id
      WHERE lw.admin_pusat_id = ?
    `;
    const params = [admin_pusat_id];

    if (bulan)     { query += " AND lw.bulan = ?";    params.push(bulan); }
    if (tahun)     { query += " AND lw.tahun = ?";    params.push(tahun); }
    if (status)    { query += " AND lw.status = ?";   params.push(status); }
    if (cabang_id) { query += " AND lw.cabang_id = ?";params.push(cabang_id); }

    query += " GROUP BY lw.id ORDER BY lw.tahun DESC, lw.bulan DESC";

    const [rows] = await db.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin-pusat/laporan-masuk/:id
const getLaporanMasukDetail = async (req, res) => {
  const { id: admin_pusat_id } = req.user;
  const { id } = req.params;

  try {
    const [[laporan]] = await db.query(
      `SELECT
         lw.*,
         u.nama AS nama_teknisi,
         ac.nama AS nama_admin_cabang,
         c.nama_cabang,
         p.nama_provider,
         pr.nama_project,
         sp.nama_sub AS sub_project,
         sp.tipe_pembayaran,
         sp.upah_per_wo,
         sp.gaji_tetap
       FROM laporan_wo lw
       JOIN users u        ON lw.teknisi_id      = u.id
       JOIN users ac       ON lw.admin_cabang_id = ac.id
       JOIN cabang c       ON lw.cabang_id       = c.id
       JOIN provider p     ON lw.provider_id     = p.id
       JOIN project pr     ON lw.project_id      = pr.id
       JOIN sub_project sp ON lw.sub_project_id  = sp.id
       WHERE lw.id = ? AND lw.admin_pusat_id = ?`,
      [id, admin_pusat_id]
    );

    if (!laporan)
      return res.status(404).json({ success: false, message: "Laporan tidak ditemukan" });

    // Detail WO
    const [detail] = await db.query(
      "SELECT * FROM detail_wo WHERE laporan_wo_id = ?",
      [id]
    );

    // Hitung total gaji kotor
    const [[{ total_gaji }]] = await db.query(
      "SELECT COALESCE(SUM(upah_dihitung), 0) AS total_gaji FROM detail_wo WHERE laporan_wo_id = ?",
      [id]
    );

    return res.json({ success: true, data: { laporan, detail, total_gaji } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// PATCH /api/admin-pusat/laporan-masuk/:id/proses
const prosesLaporan = async (req, res) => {
  const { id: admin_pusat_id } = req.user;
  const { id } = req.params;

  try {
    const [[laporan]] = await db.query(
      "SELECT * FROM laporan_wo WHERE id = ? AND admin_pusat_id = ?",
      [id, admin_pusat_id]
    );

    if (!laporan)
      return res.status(404).json({ success: false, message: "Laporan tidak ditemukan" });

    if (laporan.status !== "terkirim")
      return res.status(400).json({ success: false, message: "Hanya laporan berstatus terkirim yang dapat diproses" });

    await db.query(
      "UPDATE laporan_wo SET status = 'diproses', update_at = NOW() WHERE id = ?",
      [id]
    );

    return res.json({ success: true, message: "Laporan berhasil diproses" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// REKAP GAJI
// ════════════════════════════════════════════════════════════════════════════

// POST /api/admin-pusat/rekap-gaji
const createRekapGaji = async (req, res) => {
  const { id: admin_pusat_id } = req.user;
  const { laporan_wo_id, potongan, tgl_transfer, screenshot_path } = req.body;

  if (!laporan_wo_id)
    return res.status(400).json({ success: false, message: "laporan_wo_id wajib diisi" });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Cek laporan ada & milik admin pusat ini
    const [[laporan]] = await conn.query(
      "SELECT * FROM laporan_wo WHERE id = ? AND admin_pusat_id = ?",
      [laporan_wo_id, admin_pusat_id]
    );
    if (!laporan) throw new Error("Laporan tidak ditemukan");
    if (laporan.status !== "diproses")
      throw new Error("Laporan harus berstatus diproses sebelum dibuat rekap gaji");

    // Cek rekap gaji belum ada
    const [[existing]] = await conn.query(
      "SELECT id FROM rekap_gaji WHERE laporan_wo_id = ?",
      [laporan_wo_id]
    );
    if (existing) throw new Error("Rekap gaji untuk laporan ini sudah dibuat");

    // Hitung total gaji dari detail_wo
    const [[{ total_gaji }]] = await conn.query(
      "SELECT COALESCE(SUM(upah_dihitung), 0) AS total_gaji FROM detail_wo WHERE laporan_wo_id = ?",
      [laporan_wo_id]
    );

    // Hitung total potongan
    let total_potongan = 0;
    if (Array.isArray(potongan) && potongan.length > 0) {
      total_potongan = potongan.reduce((sum, p) => sum + (parseFloat(p.nominal) || 0), 0);
    }

    const gaji_bersih = total_gaji - total_potongan;

    // Insert rekap_gaji
    const [result] = await conn.query(
      `INSERT INTO rekap_gaji 
         (laporan_wo_id, teknisi_id, admin_pusat_id, total_gaji, total_potongan, gaji_bersih, screenshot_path, tgl_transfer, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'dibayar')`,
      [laporan_wo_id, laporan.teknisi_id, admin_pusat_id,
       total_gaji, total_potongan, gaji_bersih,
       screenshot_path || null, tgl_transfer || null]
    );
    const rekap_gaji_id = result.insertId;

    // Insert detail potongan
    if (Array.isArray(potongan) && potongan.length > 0) {
      for (const p of potongan) {
        if (!p.jenis_potongan_id || !p.nominal)
          throw new Error("jenis_potongan_id dan nominal wajib diisi untuk setiap potongan");

        await conn.query(
          `INSERT INTO detail_potongan (rekap_gaji_id, jenis_potongan_id, keterangan, nominal)
           VALUES (?, ?, ?, ?)`,
          [rekap_gaji_id, p.jenis_potongan_id, p.keterangan || null, p.nominal]
        );
      }
    }

    await conn.query(
      "UPDATE laporan_wo SET status = 'selesai', update_at = NOW() WHERE id = ?",
      [laporan_wo_id]
    );

    await conn.commit();
    return res.status(201).json({
      success: true,
      message: "Rekap gaji berhasil dibuat",
      data: { rekap_gaji_id, total_gaji, total_potongan, gaji_bersih },
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return res.status(400).json({ success: false, message: err.message || "Gagal membuat rekap gaji" });
  } finally {
    conn.release();
  }
};

// GET /api/admin-pusat/rekap-gaji
const getRekapGaji = async (req, res) => {
  const { id: admin_pusat_id } = req.user;
  const { bulan, tahun, cabang_id } = req.query;

  try {
    let query = `
      SELECT
        rg.id, rg.total_gaji, rg.total_potongan, rg.gaji_bersih,
        rg.tgl_transfer, rg.screenshot_path, rg.status,
        lw.bulan, lw.tahun,
        u.nama AS nama_teknisi,
        c.nama_cabang,
        sp.nama_sub AS sub_project,
        sp.tipe_pembayaran,
        p.nama_provider
      FROM rekap_gaji rg
      JOIN laporan_wo lw  ON rg.laporan_wo_id  = lw.id
      JOIN users u        ON lw.teknisi_id     = u.id
      JOIN cabang c       ON lw.cabang_id      = c.id
      JOIN sub_project sp ON lw.sub_project_id = sp.id
      JOIN provider p     ON lw.provider_id    = p.id
      WHERE rg.admin_pusat_id = ?
    `;
    const params = [admin_pusat_id];

    if (bulan)     { query += " AND lw.bulan = ?";     params.push(bulan); }
    if (tahun)     { query += " AND lw.tahun = ?";     params.push(tahun); }
    if (cabang_id) { query += " AND lw.cabang_id = ?"; params.push(cabang_id); }

    query += " ORDER BY lw.tahun DESC, lw.bulan DESC";

    const [rows] = await db.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin-pusat/rekap-gaji/:id
const getRekapGajiDetail = async (req, res) => {
  const { id: admin_pusat_id } = req.user;
  const { id } = req.params;

  try {
    const [[rekap]] = await db.query(
      `SELECT
         rg.*,
         u.nama AS nama_teknisi,
         c.nama_cabang,
         sp.nama_sub AS sub_project,
         sp.tipe_pembayaran,
         p.nama_provider,
         pr.nama_project,
         lw.bulan, lw.tahun
       FROM rekap_gaji rg
       JOIN laporan_wo lw  ON rg.laporan_wo_id  = lw.id
       JOIN users u        ON lw.teknisi_id     = u.id
       JOIN cabang c       ON lw.cabang_id      = c.id
       JOIN sub_project sp ON lw.sub_project_id = sp.id
       JOIN provider p     ON lw.provider_id    = p.id
       JOIN project pr     ON lw.project_id     = pr.id
       WHERE rg.id = ? AND rg.admin_pusat_id = ?`,
      [id, admin_pusat_id]
    );
    // const [rows] = await db.query(
    //   `SELECT
    //      ng.id,
    //      ng.rekap_gaji_id, -- 🔥 TAMBAHKAN INI
    //      ng.is_dibaca,
    //      ng.is_dikonfirmasi,
    //      ng.tgl_konfirmasi,
    //      ng.created_at,
    //      u.nama AS nama_teknisi,
    //      ac.nama AS nama_admin_cabang,
    //      c.nama_cabang,
    //      rg.total_gaji,
    //      rg.gaji_bersih,
    //      rg.tgl_transfer
    //    FROM notifikasi_gaji ng
    //    JOIN users u        ON ng.teknisi_id      = u.id
    //    JOIN users ac       ON ng.admin_cabang_id = ac.id
    //    JOIN cabang c       ON ac.cabang_id       = c.id
    //    JOIN rekap_gaji rg  ON ng.rekap_gaji_id   = rg.id
    //    WHERE ng.admin_pusat_id = ?
    //    ORDER BY ng.created_at DESC`,
    //   [admin_pusat_id]
    // );

    if (!rekap)
      return res.status(404).json({ success: false, message: "Rekap gaji tidak ditemukan" });

    // Detail WO
    const [detail_wo] = await db.query(
      "SELECT * FROM detail_wo WHERE laporan_wo_id = ?",
      [rekap.laporan_wo_id]
    );

    // Detail potongan
    const [detail_potongan] = await db.query(
      `SELECT dp.*, jp.nama AS nama_jenis_potongan
       FROM detail_potongan dp
       JOIN jenis_potongan jp ON dp.jenis_potongan_id = jp.id
       WHERE dp.rekap_gaji_id = ?`,
      [id]
    );

    return res.json({ success: true, data: { rekap, detail_wo, detail_potongan } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// NOTIFIKASI
// ════════════════════════════════════════════════════════════════════════════

// POST /api/admin-pusat/notifikasi
const kirimNotifikasi = async (req, res) => {
  const { id: admin_pusat_id } = req.user;
  const { rekap_gaji_id } = req.body;

  if (!rekap_gaji_id)
    return res.status(400).json({ success: false, message: "rekap_gaji_id wajib diisi" });

  try {
    // Cek rekap gaji
    const [[rekap]] = await db.query(
      `SELECT rg.*, lw.teknisi_id, lw.admin_cabang_id
       FROM rekap_gaji rg
       JOIN laporan_wo lw ON rg.laporan_wo_id = lw.id
       WHERE rg.id = ? AND rg.admin_pusat_id = ?`,
      [rekap_gaji_id, admin_pusat_id]
    );
    if (!rekap)
      return res.status(404).json({ success: false, message: "Rekap gaji tidak ditemukan" });

    if (rekap.status !== "dibayar")
      return res.status(400).json({ success: false, message: "Rekap gaji harus berstatus dibayar" });

    // Cek notifikasi belum pernah dikirim
    const [[existing]] = await db.query(
      "SELECT id FROM notifikasi_gaji WHERE rekap_gaji_id = ?",
      [rekap_gaji_id]
    );
    if (existing)
      return res.status(400).json({ success: false, message: "Notifikasi untuk rekap gaji ini sudah pernah dikirim" });

    // Insert notifikasi
    await db.query(
      `INSERT INTO notifikasi_gaji 
         (rekap_gaji_id, admin_pusat_id, admin_cabang_id, teknisi_id)
       VALUES (?, ?, ?, ?)`,
      [rekap_gaji_id, admin_pusat_id, rekap.admin_cabang_id, rekap.teknisi_id]
    );

    return res.status(201).json({ success: true, message: "Notifikasi berhasil dikirim ke admin cabang" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin-pusat/notifikasi
const getNotifikasi = async (req, res) => {
  const { id: admin_pusat_id } = req.user;

  try {
    const [rows] = await db.query(
      `SELECT
         ng.id, ng.is_dibaca, ng.is_dikonfirmasi, ng.tgl_konfirmasi, ng.created_at,
         u.nama AS nama_teknisi,
         ac.nama AS nama_admin_cabang,
         c.nama_cabang,
         rg.total_gaji, rg.gaji_bersih, rg.tgl_transfer
       FROM notifikasi_gaji ng
       JOIN users u        ON ng.teknisi_id      = u.id
       JOIN users ac       ON ng.admin_cabang_id = ac.id
       JOIN cabang c       ON ac.cabang_id       = c.id
       JOIN rekap_gaji rg  ON ng.rekap_gaji_id   = rg.id
       WHERE ng.admin_pusat_id = ?
       ORDER BY ng.created_at DESC`,
      [admin_pusat_id]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// MASTER DATA
// ════════════════════════════════════════════════════════════════════════════

// GET /api/admin-pusat/master/jenis-potongan
const getJenisPotongan = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, nama, is_wajib FROM jenis_potongan ORDER BY is_wajib DESC, nama"
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin-pusat/master/cabang
const getCabang = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, nama_cabang, wilayah FROM cabang ORDER BY nama_cabang"
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getDashboard,
  getLaporanMasuk, getLaporanMasukDetail, prosesLaporan,
  createRekapGaji, getRekapGaji, getRekapGajiDetail,
  kirimNotifikasi, getNotifikasi,
  getJenisPotongan, getCabang,
};