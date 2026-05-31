// controllers/teknisiController.js
const db = require("../config/db");
// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// GET /api/teknisi/dashboard
// ════════════════════════════════════════════════════════════════════════════
const getDashboard = async (req, res) => {
  const { id: teknisi_id } = req.user;
  const now   = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();

  try {
    // Gaji bersih bulan ini
    const [[gaji_bulan_ini]] = await db.query(
      `SELECT 
         rg.total_gaji, rg.total_potongan, rg.gaji_bersih,
         rg.tgl_transfer, rg.status AS status_pembayaran,
         lw.status AS status_laporan,
         sp.nama_sub AS sub_project,
         sp.tipe_pembayaran,
         p.nama_provider,
         pr.nama_project
       FROM rekap_gaji rg
       JOIN laporan_wo lw  ON rg.laporan_wo_id  = lw.id
       JOIN sub_project sp ON lw.sub_project_id = sp.id
       JOIN provider p     ON lw.provider_id    = p.id
       JOIN project pr     ON lw.project_id     = pr.id
       WHERE rg.teknisi_id = ? AND lw.bulan = ? AND lw.tahun = ?
       LIMIT 1`,
      [teknisi_id, bulan, tahun]
    );

    // Total gaji diterima tahun ini
    const [[{ total_gaji_tahun }]] = await db.query(
      `SELECT COALESCE(SUM(rg.gaji_bersih), 0) AS total_gaji_tahun
       FROM rekap_gaji rg
       JOIN laporan_wo lw ON rg.laporan_wo_id = lw.id
       WHERE rg.teknisi_id = ? AND lw.tahun = ? AND rg.status = 'dibayar'`,
      [teknisi_id, tahun]
    );

    // Total potongan tahun ini
    const [[{ total_potongan_tahun }]] = await db.query(
      `SELECT COALESCE(SUM(rg.total_potongan), 0) AS total_potongan_tahun
       FROM rekap_gaji rg
       JOIN laporan_wo lw ON rg.laporan_wo_id = lw.id
       WHERE rg.teknisi_id = ? AND lw.tahun = ? AND rg.status = 'dibayar'`,
      [teknisi_id, tahun]
    );

    // Bulan terbayar tahun ini
    const [[{ bulan_terbayar }]] = await db.query(
      `SELECT COUNT(*) AS bulan_terbayar
       FROM rekap_gaji rg
       JOIN laporan_wo lw ON rg.laporan_wo_id = lw.id
       WHERE rg.teknisi_id = ? AND lw.tahun = ? AND rg.status = 'dibayar'`,
      [teknisi_id, tahun]
    );

    // Timeline status laporan bulan ini
    const [timeline] = await db.query(
      `SELECT 
         lw.status, lw.created_at, lw.update_at,
         ac.nama AS nama_admin_cabang,
         ap.nama AS nama_admin_pusat
       FROM laporan_wo lw
       LEFT JOIN users ac ON lw.admin_cabang_id = ac.id
       LEFT JOIN users ap ON lw.admin_pusat_id  = ap.id
       WHERE lw.teknisi_id = ? AND lw.bulan = ? AND lw.tahun = ?
       LIMIT 1`,
      [teknisi_id, bulan, tahun]
    );

    return res.json({
      success: true,
      data: {
        gaji_bulan_ini: gaji_bulan_ini || null,
        total_gaji_tahun,
        total_potongan_tahun,
        bulan_terbayar,
        timeline: timeline[0] || null,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// SLIP GAJI
// GET /api/teknisi/slip-gaji
// ════════════════════════════════════════════════════════════════════════════
const getSlipGaji = async (req, res) => {
  const { id: teknisi_id } = req.user;
  const { bulan, tahun } = req.query;

  try {
    let query = `
      SELECT
        rg.id AS rekap_gaji_id,
        rg.total_gaji, rg.total_potongan, rg.gaji_bersih,
        rg.screenshot_path, rg.tgl_transfer, rg.status,
        lw.bulan, lw.tahun,
        sp.nama_sub AS sub_project,
        sp.tipe_pembayaran,
        sp.upah_per_wo,
        p.nama_provider,
        pr.nama_project,
        c.nama_cabang
      FROM rekap_gaji rg
      JOIN laporan_wo lw  ON rg.laporan_wo_id  = lw.id
      JOIN sub_project sp ON lw.sub_project_id = sp.id
      JOIN provider p     ON lw.provider_id    = p.id
      JOIN project pr     ON lw.project_id     = pr.id
      JOIN cabang c       ON lw.cabang_id      = c.id
      WHERE rg.teknisi_id = ?
    `;
    const params = [teknisi_id];

    if (bulan) { query += " AND lw.bulan = ?"; params.push(bulan); }
    if (tahun) { query += " AND lw.tahun = ?"; params.push(tahun); }

    query += " ORDER BY lw.tahun DESC, lw.bulan DESC";

    const [rows] = await db.query(query, params);

    // Jika tidak ada data
    if (rows.length === 0)
      return res.json({ success: true, data: [] });

    // Ambil detail WO dan potongan untuk setiap rekap
    const result = await Promise.all(rows.map(async (rekap) => {
      const [detail_wo] = await db.query(
        "SELECT * FROM detail_wo WHERE laporan_wo_id = (SELECT laporan_wo_id FROM rekap_gaji WHERE id = ?)",
        [rekap.rekap_gaji_id]
      );

      const [detail_potongan] = await db.query(
        `SELECT dp.*, jp.nama AS nama_jenis_potongan
         FROM detail_potongan dp
         JOIN jenis_potongan jp ON dp.jenis_potongan_id = jp.id
         WHERE dp.rekap_gaji_id = ?`,
        [rekap.rekap_gaji_id]
      );

      return { ...rekap, detail_wo, detail_potongan };
    }));

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// RIWAYAT GAJI
// GET /api/teknisi/riwayat-gaji
// ════════════════════════════════════════════════════════════════════════════
const getRiwayatGaji = async (req, res) => {
  const { id: teknisi_id } = req.user;
  const { tahun } = req.query;
  const now = new Date();

  try {
    let query = `
      SELECT
        rg.id AS rekap_gaji_id,
        rg.total_gaji, rg.total_potongan, rg.gaji_bersih,
        rg.tgl_transfer, rg.status,
        lw.bulan, lw.tahun,
        sp.nama_sub AS sub_project,
        sp.tipe_pembayaran,
        p.nama_provider,
        pr.nama_project
      FROM rekap_gaji rg
      JOIN laporan_wo lw  ON rg.laporan_wo_id  = lw.id
      JOIN sub_project sp ON lw.sub_project_id = sp.id
      JOIN provider p     ON lw.provider_id    = p.id
      JOIN project pr     ON lw.project_id     = pr.id
      WHERE rg.teknisi_id = ?
    `;
    const params = [teknisi_id];

    if (tahun) { query += " AND lw.tahun = ?"; params.push(tahun); }

    query += " ORDER BY lw.tahun DESC, lw.bulan DESC";

    const [rows] = await db.query(query, params);

    // Ringkasan tahun
    const filterTahun = tahun || now.getFullYear();
    const [[ringkasan]] = await db.query(
      `SELECT
         COALESCE(SUM(rg.total_gaji), 0)    AS total_gaji_kotor,
         COALESCE(SUM(rg.total_potongan), 0) AS total_potongan,
         COALESCE(SUM(rg.gaji_bersih), 0)   AS total_gaji_bersih,
         COUNT(*) AS bulan_terbayar
       FROM rekap_gaji rg
       JOIN laporan_wo lw ON rg.laporan_wo_id = lw.id
       WHERE rg.teknisi_id = ? AND lw.tahun = ? AND rg.status = 'dibayar'`,
      [teknisi_id, filterTahun]
    );

    return res.json({ success: true, data: { riwayat: rows, ringkasan } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// PROFIL
// GET /api/teknisi/profil
// ════════════════════════════════════════════════════════════════════════════
const getProfil = async (req, res) => {
  const { id: teknisi_id } = req.user;

  try {
    const [[profil]] = await db.query(
      `SELECT
         u.id, u.nama, u.email, u.role, u.is_active,
         c.nama_cabang, c.wilayah
       FROM users u
       LEFT JOIN cabang c ON u.cabang_id = c.id
       WHERE u.id = ?`,
      [teknisi_id]
    );

    if (!profil)
      return res.status(404).json({ success: false, message: "Profil tidak ditemukan" });

    return res.json({ success: true, data: profil });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getDashboard,
  getSlipGaji,
  getRiwayatGaji,
  getProfil,
};