// middleware/auth.js
const jwt = require("jsonwebtoken");

// ── Verifikasi token JWT ─────────────────────────────────────────────────────
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader)
    return res.status(401).json({ success: false, message: "Token tidak ditemukan" });

  const token = authHeader.split(" ")[1]; // Format: "Bearer <token>"
  if (!token)
    return res.status(401).json({ success: false, message: "Token tidak valid" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, nama, role, cabang_id }
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: "Token kadaluarsa atau tidak valid" });
  }
};

// ── Cek role tertentu ────────────────────────────────────────────────────────
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak. Hanya untuk: ${roles.join(", ")}`,
      });
    }
    next();
  };
};

module.exports = { verifyToken, requireRole };