const db  = require("../config/db");
const jwt = require("jsonwebtoken");

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ success: false, message: "Email dan password wajib diisi" });

  try {
    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = ? AND is_active = 1 LIMIT 1",
      [email]
    );

    if (rows.length === 0)
      return res.status(401).json({ success: false, message: "Email tidak ditemukan atau akun nonaktif" });

    const user = rows[0];

    const valid = password === user.password;
    if (!valid)
      return res.status(401).json({ success: false, message: "Password salah" });

    const payload = {
      id:        user.id,
      nama:      user.nama,
      role:      user.role,
      cabang_id: user.cabang_id,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    return res.json({
      success: true,
      message: "Login berhasil",
      data: {
        token,
        user: {
          id:        user.id,
          nama:      user.nama,
          email:     user.email,
          role:      user.role,
          cabang_id: user.cabang_id,
        },
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const me = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, nama, email, role, cabang_id, is_active FROM users WHERE id = ?",
      [req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "User tidak ditemukan" });

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { login, me };