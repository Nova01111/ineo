// controllers/operatorController.js
const db = require("../config/db");

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// GET /api/operator/dashboard
// ════════════════════════════════════════════════════════════════════════════
const getDashboard = async (req, res) => {
  try {
    const [[{ total_teknisi }]] = await db.query(
      "SELECT COUNT(*) AS total_teknisi FROM users WHERE role = 'teknisi' AND is_active = 1"
    );

    const [[{ total_admin_cabang }]] = await db.query(
      "SELECT COUNT(*) AS total_admin_cabang FROM users WHERE role = 'admin_cabang' AND is_active = 1"
    );

    const [[{ total_admin_pusat }]] = await db.query(
      "SELECT COUNT(*) AS total_admin_pusat FROM users WHERE role = 'admin_pusat' AND is_active = 1"
    );

    const [[{ total_cabang }]] = await db.query(
      "SELECT COUNT(*) AS total_cabang FROM cabang WHERE is_active = 1"
    );

    const [[{ total_provider }]] = await db.query(
      "SELECT COUNT(*) AS total_provider FROM provider WHERE is_active = 1"
    );

    const [[{ total_pengguna_nonaktif }]] = await db.query(
      "SELECT COUNT(*) AS total_pengguna_nonaktif FROM users WHERE is_active = 0 AND role != 'operator'"
    );

    // Teknisi terbaru (5 terakhir ditambahkan)
    const [teknisi_terbaru] = await db.query(
      `SELECT u.id, u.nama, u.email, u.is_active, c.nama_cabang, u.created_at
       FROM users u
       LEFT JOIN cabang c ON u.cabang_id = c.id
       WHERE u.role = 'teknisi'
       ORDER BY u.created_at DESC
       LIMIT 5`
    );

    return res.json({
      success: true,
      data: {
        total_teknisi,
        total_admin_cabang,
        total_admin_pusat,
        total_cabang,
        total_provider,
        total_pengguna_nonaktif,
        teknisi_terbaru,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// MANAJEMEN TEKNISI
// ════════════════════════════════════════════════════════════════════════════

const getTeknisi = async (req, res) => {
  const { cabang_id, is_active, search } = req.query;

  try {
    let query = `
      SELECT
        u.id, u.nama, u.email, u.no_hp, u.is_active, u.created_at,
        c.id AS cabang_id, c.nama_cabang
      FROM users u
      LEFT JOIN cabang c ON u.cabang_id = c.id
      WHERE u.role = 'teknisi'
    `;
    const params = [];

    if (cabang_id)          { query += " AND u.cabang_id = ?";        params.push(cabang_id); }
    if (is_active !== undefined && is_active !== "") {
                              query += " AND u.is_active = ?";         params.push(is_active); }
    if (search)             { query += " AND u.nama LIKE ?";           params.push(`%${search}%`); }

    query += " ORDER BY u.nama";

    const [rows] = await db.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getTeknisiById = async (req, res) => {
  const { id } = req.params;

  try {
    const [[teknisi]] = await db.query(
      `SELECT u.id, u.nama, u.email, u.no_hp, u.is_active, u.created_at,
              c.id AS cabang_id, c.nama_cabang
       FROM users u
       LEFT JOIN cabang c ON u.cabang_id = c.id
       WHERE u.id = ? AND u.role = 'teknisi'`,
      [id]
    );

    if (!teknisi)
      return res.status(404).json({ success: false, message: "Teknisi tidak ditemukan" });

    return res.json({ success: true, data: teknisi });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const createTeknisi = async (req, res) => {
  const { nama, email, password, no_hp, cabang_id } = req.body;

  if (!nama || !email || !password)
    return res.status(400).json({ success: false, message: "nama, email, dan password wajib diisi" });

  try {
    const [[existing]] = await db.query(
      "SELECT id FROM users WHERE email = ?", [email]
    );
    if (existing)
      return res.status(400).json({ success: false, message: "Email sudah terdaftar" });

    const bcrypt = require("bcryptjs");
    const hashed = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO users (nama, email, password, no_hp, role, cabang_id, is_active)
       VALUES (?, ?, ?, ?, 'teknisi', ?, 1)`,
      [nama, email, hashed, no_hp || null, cabang_id || null]
    );

    return res.status(201).json({
      success: true,
      message: "Teknisi berhasil ditambahkan",
      data: { id: result.insertId },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateTeknisi = async (req, res) => {
  const { id } = req.params;
  const { nama, email, no_hp, cabang_id, password } = req.body;

  try {
    const [[teknisi]] = await db.query(
      "SELECT id FROM users WHERE id = ? AND role = 'teknisi'", [id]
    );
    if (!teknisi)
      return res.status(404).json({ success: false, message: "Teknisi tidak ditemukan" });

    // Cek email duplikat (selain diri sendiri)
    if (email) {
      const [[duplikat]] = await db.query(
        "SELECT id FROM users WHERE email = ? AND id != ?", [email, id]
      );
      if (duplikat)
        return res.status(400).json({ success: false, message: "Email sudah digunakan pengguna lain" });
    }

    let query = "UPDATE users SET nama = ?, email = ?, no_hp = ?, cabang_id = ?";
    const params = [nama, email, no_hp || null, cabang_id || null];

    if (password) {
      const bcrypt = require("bcryptjs");
      const hashed = await bcrypt.hash(password, 10);
      query += ", password = ?";
      params.push(hashed);
    }

    query += " WHERE id = ?";
    params.push(id);

    await db.query(query, params);

    return res.json({ success: true, message: "Data teknisi berhasil diperbarui" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const toggleAktifTeknisi = async (req, res) => {
  const { id } = req.params;

  try {
    const [[teknisi]] = await db.query(
      "SELECT id, is_active FROM users WHERE id = ? AND role = 'teknisi'", [id]
    );
    if (!teknisi)
      return res.status(404).json({ success: false, message: "Teknisi tidak ditemukan" });

    const newStatus = teknisi.is_active ? 0 : 1;
    await db.query("UPDATE users SET is_active = ? WHERE id = ?", [newStatus, id]);

    return res.json({
      success: true,
      message: `Teknisi berhasil ${newStatus ? "diaktifkan" : "dinonaktifkan"}`,
      data: { is_active: newStatus },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// MANAJEMEN PENGGUNA (Admin Cabang & Admin Pusat)
// ════════════════════════════════════════════════════════════════════════════

const getPengguna = async (req, res) => {
  const { role, is_active, search } = req.query;

  try {
    let query = `
      SELECT
        u.id, u.nama, u.email, u.no_hp, u.role, u.is_active, u.created_at,
        c.id AS cabang_id, c.nama_cabang
      FROM users u
      LEFT JOIN cabang c ON u.cabang_id = c.id
      WHERE u.role IN ('admin_cabang', 'admin_pusat')
    `;
    const params = [];

    if (role)                               { query += " AND u.role = ?";       params.push(role); }
    if (is_active !== undefined && is_active !== "") {
                                              query += " AND u.is_active = ?";  params.push(is_active); }
    if (search)                             { query += " AND u.nama LIKE ?";    params.push(`%${search}%`); }

    query += " ORDER BY u.role, u.nama";

    const [rows] = await db.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const createPengguna = async (req, res) => {
  const { nama, email, password, no_hp, role, cabang_id } = req.body;

  if (!nama || !email || !password || !role)
    return res.status(400).json({ success: false, message: "nama, email, password, dan role wajib diisi" });

  if (!["admin_cabang", "admin_pusat"].includes(role))
    return res.status(400).json({ success: false, message: "Role tidak valid" });

  if (role === "admin_cabang" && !cabang_id)
    return res.status(400).json({ success: false, message: "cabang_id wajib diisi untuk admin cabang" });

  try {
    const [[existing]] = await db.query(
      "SELECT id FROM users WHERE email = ?", [email]
    );
    if (existing)
      return res.status(400).json({ success: false, message: "Email sudah terdaftar" });

    const bcrypt = require("bcryptjs");
    const hashed = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO users (nama, email, password, no_hp, role, cabang_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [nama, email, hashed, no_hp || null, role, cabang_id || null]
    );

    return res.status(201).json({
      success: true,
      message: `${role === "admin_cabang" ? "Admin cabang" : "Admin pusat"} berhasil ditambahkan`,
      data: { id: result.insertId },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const updatePengguna = async (req, res) => {
  const { id } = req.params;
  const { nama, email, no_hp, cabang_id, password } = req.body;

  try {
    const [[pengguna]] = await db.query(
      "SELECT id, role FROM users WHERE id = ? AND role IN ('admin_cabang', 'admin_pusat')", [id]
    );
    if (!pengguna)
      return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan" });

    if (email) {
      const [[duplikat]] = await db.query(
        "SELECT id FROM users WHERE email = ? AND id != ?", [email, id]
      );
      if (duplikat)
        return res.status(400).json({ success: false, message: "Email sudah digunakan pengguna lain" });
    }

    let query = "UPDATE users SET nama = ?, email = ?, no_hp = ?, cabang_id = ?";
    const params = [nama, email, no_hp || null, cabang_id || null];

    if (password) {
      const bcrypt = require("bcryptjs");
      const hashed = await bcrypt.hash(password, 10);
      query += ", password = ?";
      params.push(hashed);
    }

    query += " WHERE id = ?";
    params.push(id);

    await db.query(query, params);

    return res.json({ success: true, message: "Data pengguna berhasil diperbarui" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const toggleAktifPengguna = async (req, res) => {
  const { id } = req.params;

  try {
    const [[pengguna]] = await db.query(
      "SELECT id, nama, role, is_active FROM users WHERE id = ? AND role IN ('admin_cabang', 'admin_pusat')",
      [id]
    );
    if (!pengguna)
      return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan" });

    const newStatus = pengguna.is_active ? 0 : 1;
    await db.query("UPDATE users SET is_active = ? WHERE id = ?", [newStatus, id]);

    return res.json({
      success: true,
      message: `${pengguna.nama} berhasil ${newStatus ? "diaktifkan" : "dinonaktifkan"}`,
      data: { is_active: newStatus },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// MANAJEMEN CABANG
// ════════════════════════════════════════════════════════════════════════════

const getCabang = async (req, res) => {
  const { is_active, search } = req.query;

  try {
    let query = `
      SELECT
        c.id, c.nama_cabang, c.wilayah, c.is_active, c.created_at,
        u.nama AS nama_admin_cabang
      FROM cabang c
      LEFT JOIN users u ON u.cabang_id = c.id AND u.role = 'admin_cabang' AND u.is_active = 1
      WHERE 1=1
    `;
    const params = [];

    if (is_active !== undefined && is_active !== "") { query += " AND c.is_active = ?"; params.push(is_active); }
    if (search)                                      { query += " AND c.nama_cabang LIKE ?"; params.push(`%${search}%`); }

    query += " ORDER BY c.nama_cabang";

    const [rows] = await db.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const createCabang = async (req, res) => {
  const { nama_cabang, wilayah } = req.body;

  if (!nama_cabang)
    return res.status(400).json({ success: false, message: "nama_cabang wajib diisi" });

  try {
    const [[existing]] = await db.query(
      "SELECT id FROM cabang WHERE nama_cabang = ?", [nama_cabang]
    );
    if (existing)
      return res.status(400).json({ success: false, message: "Nama cabang sudah terdaftar" });

    const [result] = await db.query(
      "INSERT INTO cabang (nama_cabang, wilayah, is_active) VALUES (?, ?, 1)",
      [nama_cabang, wilayah || null]
    );

    return res.status(201).json({
      success: true,
      message: "Cabang berhasil ditambahkan",
      data: { id: result.insertId },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateCabang = async (req, res) => {
  const { id } = req.params;
  const { nama_cabang, wilayah } = req.body;

  try {
    const [[cabang]] = await db.query("SELECT id FROM cabang WHERE id = ?", [id]);
    if (!cabang)
      return res.status(404).json({ success: false, message: "Cabang tidak ditemukan" });

    await db.query(
      "UPDATE cabang SET nama_cabang = ?, wilayah = ? WHERE id = ?",
      [nama_cabang, wilayah || null, id]
    );

    return res.json({ success: true, message: "Cabang berhasil diperbarui" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const toggleAktifCabang = async (req, res) => {
  const { id } = req.params;

  try {
    const [[cabang]] = await db.query(
      "SELECT id, nama_cabang, is_active FROM cabang WHERE id = ?", [id]
    );
    if (!cabang)
      return res.status(404).json({ success: false, message: "Cabang tidak ditemukan" });

    const newStatus = cabang.is_active ? 0 : 1;
    await db.query("UPDATE cabang SET is_active = ? WHERE id = ?", [newStatus, id]);

    return res.json({
      success: true,
      message: `Cabang ${cabang.nama_cabang} berhasil ${newStatus ? "diaktifkan" : "dinonaktifkan"}`,
      data: { is_active: newStatus },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// MANAJEMEN PROVIDER + PROJECT + SUB PROJECT
// ════════════════════════════════════════════════════════════════════════════

const getProvider = async (req, res) => {
  const { is_active, search } = req.query;

  try {
    let query = `
      SELECT
        p.id, p.nama_provider, p.kode, p.is_active, p.created_at,
        COUNT(DISTINCT pr.id) AS total_project
      FROM provider p
      LEFT JOIN project pr ON pr.provider_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (is_active !== undefined && is_active !== "") { query += " AND p.is_active = ?";       params.push(is_active); }
    if (search)                                      { query += " AND p.nama_provider LIKE ?"; params.push(`%${search}%`); }

    query += " GROUP BY p.id ORDER BY p.nama_provider";

    const [rows] = await db.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const createProvider = async (req, res) => {
  const { nama_provider, kode } = req.body;

  if (!nama_provider || !kode)
    return res.status(400).json({ success: false, message: "nama_provider dan kode wajib diisi" });

  try {
    const [[existingNama]] = await db.query(
      "SELECT id FROM provider WHERE nama_provider = ?", [nama_provider]
    );
    if (existingNama)
      return res.status(400).json({ success: false, message: "Nama provider sudah terdaftar" });

    const [[existingKode]] = await db.query(
      "SELECT id FROM provider WHERE kode = ?", [kode]
    );
    if (existingKode)
      return res.status(400).json({ success: false, message: "Kode provider sudah digunakan" });

    const [result] = await db.query(
      "INSERT INTO provider (nama_provider, kode, is_active) VALUES (?, ?, 1)",
      [nama_provider, kode]
    );

    return res.status(201).json({
      success: true,
      message: "Provider berhasil ditambahkan",
      data: { id: result.insertId },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateProvider = async (req, res) => {
  const { id } = req.params;
  const { nama_provider, kode } = req.body;

  try {
    const [[provider]] = await db.query("SELECT id FROM provider WHERE id = ?", [id]);
    if (!provider)
      return res.status(404).json({ success: false, message: "Provider tidak ditemukan" });

    // Cek duplikat kode (selain diri sendiri)
    if (kode) {
      const [[duplikatKode]] = await db.query(
        "SELECT id FROM provider WHERE kode = ? AND id != ?", [kode, id]
      );
      if (duplikatKode)
        return res.status(400).json({ success: false, message: "Kode provider sudah digunakan" });
    }

    await db.query(
      "UPDATE provider SET nama_provider = ?, kode = ? WHERE id = ?",
      [nama_provider, kode, id]
    );

    return res.json({ success: true, message: "Provider berhasil diperbarui" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const toggleAktifProvider = async (req, res) => {
  const { id } = req.params;

  try {
    const [[provider]] = await db.query(
      "SELECT id, nama_provider, is_active FROM provider WHERE id = ?", [id]
    );
    if (!provider)
      return res.status(404).json({ success: false, message: "Provider tidak ditemukan" });

    const newStatus = provider.is_active ? 0 : 1;
    await db.query("UPDATE provider SET is_active = ? WHERE id = ?", [newStatus, id]);

    return res.json({
      success: true,
      message: `Provider ${provider.nama_provider} berhasil ${newStatus ? "diaktifkan" : "dinonaktifkan"}`,
      data: { is_active: newStatus },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Project ────────────────────────────────────────────────────────────────

const getProject = async (req, res) => {
  const { provider_id } = req.query;

  try {
    let query = `
      SELECT pr.id, pr.nama_project, pr.provider_id, pr.is_active,
             p.nama_provider
      FROM project pr
      JOIN provider p ON pr.provider_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (provider_id) { query += " AND pr.provider_id = ?"; params.push(provider_id); }

    query += " ORDER BY p.nama_provider, pr.nama_project";

    const [rows] = await db.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const createProject = async (req, res) => {
  const { nama_project, provider_id } = req.body;

  if (!nama_project || !provider_id)
    return res.status(400).json({ success: false, message: "nama_project dan provider_id wajib diisi" });

  try {
    const [result] = await db.query(
      "INSERT INTO project (nama_project, provider_id, is_active) VALUES (?, ?, 1)",
      [nama_project, provider_id]
    );

    return res.status(201).json({
      success: true,
      message: "Project berhasil ditambahkan",
      data: { id: result.insertId },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateProject = async (req, res) => {
  const { id } = req.params;
  const { nama_project } = req.body;

  try {
    const [[project]] = await db.query("SELECT id FROM project WHERE id = ?", [id]);
    if (!project)
      return res.status(404).json({ success: false, message: "Project tidak ditemukan" });

    await db.query("UPDATE project SET nama_project = ? WHERE id = ?", [nama_project, id]);

    return res.json({ success: true, message: "Project berhasil diperbarui" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Sub Project ────────────────────────────────────────────────────────────

const getSubProject = async (req, res) => {
  const { project_id, provider_id } = req.query;

  try {
    let query = `
      SELECT
        sp.id, sp.nama_sub, sp.tipe_pembayaran, sp.upah_per_wo,
        sp.gaji_tetap, sp.is_active,
        pr.id AS project_id, pr.nama_project,
        p.id  AS provider_id, p.nama_provider
      FROM sub_project sp
      JOIN project  pr ON sp.project_id  = pr.id
      JOIN provider p  ON pr.provider_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id)  { query += " AND sp.project_id = ?";  params.push(project_id); }
    if (provider_id) { query += " AND p.id = ?";           params.push(provider_id); }

    query += " ORDER BY p.nama_provider, pr.nama_project, sp.nama_sub";

    const [rows] = await db.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const createSubProject = async (req, res) => {
  const { nama_sub, project_id, tipe_pembayaran, upah_per_wo, gaji_tetap } = req.body;

  if (!nama_sub || !project_id || !tipe_pembayaran)
    return res.status(400).json({ success: false, message: "nama_sub, project_id, dan tipe_pembayaran wajib diisi" });

  if (!["per_wo", "gaji_tetap"].includes(tipe_pembayaran))
    return res.status(400).json({ success: false, message: "tipe_pembayaran harus 'per_wo' atau 'gaji_tetap'" });

  try {
    const [result] = await db.query(
      `INSERT INTO sub_project (nama_sub, project_id, tipe_pembayaran, upah_per_wo, gaji_tetap, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [nama_sub, project_id, tipe_pembayaran, upah_per_wo || null, gaji_tetap || null]
    );

    return res.status(201).json({
      success: true,
      message: "Sub project berhasil ditambahkan",
      data: { id: result.insertId },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateSubProject = async (req, res) => {
  const { id } = req.params;
  const { nama_sub, tipe_pembayaran, upah_per_wo, gaji_tetap } = req.body;

  try {
    const [[sp]] = await db.query("SELECT id FROM sub_project WHERE id = ?", [id]);
    if (!sp)
      return res.status(404).json({ success: false, message: "Sub project tidak ditemukan" });

    await db.query(
      `UPDATE sub_project SET nama_sub = ?, tipe_pembayaran = ?, upah_per_wo = ?, gaji_tetap = ? WHERE id = ?`,
      [nama_sub, tipe_pembayaran, upah_per_wo || null, gaji_tetap || null, id]
    );

    return res.json({ success: true, message: "Sub project berhasil diperbarui" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// MANAJEMEN JENIS POTONGAN
// ════════════════════════════════════════════════════════════════════════════

const getJenisPotongan = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, nama, is_wajib, created_at FROM jenis_potongan ORDER BY is_wajib DESC, nama"
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const createJenisPotongan = async (req, res) => {
  const { nama, is_wajib } = req.body;

  if (!nama)
    return res.status(400).json({ success: false, message: "nama wajib diisi" });

  try {
    const [[existing]] = await db.query(
      "SELECT id FROM jenis_potongan WHERE nama = ?", [nama]
    );
    if (existing)
      return res.status(400).json({ success: false, message: "Jenis potongan sudah terdaftar" });

    const [result] = await db.query(
      "INSERT INTO jenis_potongan (nama, is_wajib) VALUES (?, ?)",
      [nama, is_wajib ? 1 : 0]
    );

    return res.status(201).json({
      success: true,
      message: "Jenis potongan berhasil ditambahkan",
      data: { id: result.insertId },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateJenisPotongan = async (req, res) => {
  const { id } = req.params;
  const { nama, is_wajib } = req.body;

  try {
    const [[jp]] = await db.query("SELECT id FROM jenis_potongan WHERE id = ?", [id]);
    if (!jp)
      return res.status(404).json({ success: false, message: "Jenis potongan tidak ditemukan" });

    await db.query(
      "UPDATE jenis_potongan SET nama = ?, is_wajib = ? WHERE id = ?",
      [nama, is_wajib ? 1 : 0, id]
    );

    return res.json({ success: true, message: "Jenis potongan berhasil diperbarui" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteJenisPotongan = async (req, res) => {
  const { id } = req.params;

  try {
    const [[jp]] = await db.query("SELECT id FROM jenis_potongan WHERE id = ?", [id]);
    if (!jp)
      return res.status(404).json({ success: false, message: "Jenis potongan tidak ditemukan" });

    // Cek apakah sudah dipakai di detail_potongan
    const [[{ dipakai }]] = await db.query(
      "SELECT COUNT(*) AS dipakai FROM detail_potongan WHERE jenis_potongan_id = ?", [id]
    );
    if (dipakai > 0)
      return res.status(400).json({
        success: false,
        message: "Jenis potongan tidak dapat dihapus karena sudah digunakan di rekap gaji",
      });

    await db.query("DELETE FROM jenis_potongan WHERE id = ?", [id]);

    return res.json({ success: true, message: "Jenis potongan berhasil dihapus" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// MONITOR LAPORAN (Read-only lintas cabang)
// GET /api/operator/monitor/laporan?bulan=&tahun=&cabang_id=&status=
// ════════════════════════════════════════════════════════════════════════════

const getMonitorLaporan = async (req, res) => {
  const { bulan, tahun, cabang_id, status } = req.query;

  try {
    let query = `
      SELECT
        lw.id, lw.bulan, lw.tahun, lw.status,
        u.nama  AS nama_teknisi,
        ac.nama AS nama_admin_cabang,
        ap.nama AS nama_admin_pusat,
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
      LEFT JOIN users ap  ON lw.admin_pusat_id  = ap.id
      LEFT JOIN detail_wo dw ON lw.id           = dw.laporan_wo_id
      WHERE 1=1
    `;
    const params = [];

    if (bulan)     { query += " AND lw.bulan = ?";     params.push(bulan); }
    if (tahun)     { query += " AND lw.tahun = ?";     params.push(tahun); }
    if (cabang_id) { query += " AND lw.cabang_id = ?"; params.push(cabang_id); }
    if (status)    { query += " AND lw.status = ?";    params.push(status); }

    query += " GROUP BY lw.id ORDER BY lw.tahun DESC, lw.bulan DESC, c.nama_cabang";

    const [rows] = await db.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// MONITOR GAJI (Read-only lintas cabang)
// GET /api/operator/monitor/gaji?bulan=&tahun=&cabang_id=&status=
// ════════════════════════════════════════════════════════════════════════════

const getMonitorGaji = async (req, res) => {
  const { bulan, tahun, cabang_id, status } = req.query;

  try {
    let query = `
      SELECT
        rg.id, rg.total_gaji, rg.total_potongan, rg.gaji_bersih,
        rg.tgl_transfer, rg.status AS status_pembayaran,
        lw.bulan, lw.tahun, lw.status AS status_laporan,
        u.nama  AS nama_teknisi,
        c.nama_cabang,
        p.nama_provider,
        sp.nama_sub  AS sub_project,
        sp.tipe_pembayaran,
        ap.nama AS nama_admin_pusat,
        ng.is_dikonfirmasi
      FROM rekap_gaji rg
      JOIN laporan_wo lw  ON rg.laporan_wo_id  = lw.id
      JOIN users u        ON lw.teknisi_id     = u.id
      JOIN cabang c       ON lw.cabang_id      = c.id
      JOIN provider p     ON lw.provider_id    = p.id
      JOIN sub_project sp ON lw.sub_project_id = sp.id
      LEFT JOIN users ap          ON rg.admin_pusat_id  = ap.id
      LEFT JOIN notifikasi_gaji ng ON rg.id             = ng.rekap_gaji_id
      WHERE 1=1
    `;
    const params = [];

    if (bulan)     { query += " AND lw.bulan = ?";     params.push(bulan); }
    if (tahun)     { query += " AND lw.tahun = ?";     params.push(tahun); }
    if (cabang_id) { query += " AND lw.cabang_id = ?"; params.push(cabang_id); }
    if (status)    { query += " AND rg.status = ?";    params.push(status); }

    query += " ORDER BY lw.tahun DESC, lw.bulan DESC, c.nama_cabang";

    const [rows] = await db.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// LOG AKTIVITAS
// GET /api/operator/log?user_id=&aksi=&dari=&sampai=
// ════════════════════════════════════════════════════════════════════════════

const getLog = async (req, res) => {
  const { user_id, aksi, dari, sampai } = req.query;

  try {
    let query = `
      SELECT
        al.id, al.aksi, al.keterangan, al.created_at,
        u.nama AS nama_user, u.role
      FROM activity_log al
      JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (user_id) { query += " AND al.user_id = ?";               params.push(user_id); }
    if (aksi)    { query += " AND al.aksi LIKE ?";                params.push(`%${aksi}%`); }
    if (dari)    { query += " AND DATE(al.created_at) >= ?";      params.push(dari); }
    if (sampai)  { query += " AND DATE(al.created_at) <= ?";      params.push(sampai); }

    query += " ORDER BY al.created_at DESC LIMIT 200";

    const [rows] = await db.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// MASTER DATA (untuk dropdown di frontend)
// ════════════════════════════════════════════════════════════════════════════

const getMasterCabang = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, nama_cabang, wilayah FROM cabang WHERE is_active = 1 ORDER BY nama_cabang"
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getMasterProvider = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, nama_provider FROM provider WHERE is_active = 1 ORDER BY nama_provider"
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  // Dashboard
  getDashboard,

  // Teknisi
  getTeknisi, getTeknisiById, createTeknisi, updateTeknisi, toggleAktifTeknisi,

  // Pengguna
  getPengguna, createPengguna, updatePengguna, toggleAktifPengguna,

  // Cabang
  getCabang, createCabang, updateCabang, toggleAktifCabang,

  // Provider
  getProvider, createProvider, updateProvider, toggleAktifProvider,

  // Project
  getProject, createProject, updateProject,

  // Sub Project
  getSubProject, createSubProject, updateSubProject,

  // Jenis Potongan
  getJenisPotongan, createJenisPotongan, updateJenisPotongan, deleteJenisPotongan,

  // Monitor
  getMonitorLaporan, getMonitorGaji,

  // Log
  getLog,

  // Master (dropdown)
  getMasterCabang, getMasterProvider,
};