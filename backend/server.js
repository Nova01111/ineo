// server.js
const express = require("express");
const cors    = require("cors");
const path    = require("path");
require("dotenv").config();

const app = express();

// ── Middleware global ─────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Sajikan folder frontend sebagai file statis ───────────────────────────
// Posisi folder: INEO/backend/server.js → INEO/frontend/
// Maka path-nya naik satu level dulu dengan "../frontend"
app.use(express.static(path.join(__dirname, "../frontend")));

// ── Routes API ────────────────────────────────────────────────────────────
app.use("/api/auth",         require("./routes/auth"));
app.use("/api/admin-cabang", require("./routes/adminCabang"));
app.use("/api/admin-pusat",  require("./routes/adminPusat"));
app.use("/api/teknisi",      require("./routes/teknisi"));
app.use("/api/upload",       require("./routes/upload"));
app.use("/api/operator", require("./routes/operator"));

// ── Health check API ──────────────────────────────────────────────────────
// Dipindah ke /api/health agar tidak bentrok dengan route "/" frontend
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Rekap Gaji API berjalan" });
});

// ── Fallback: semua route non-API yang tidak ditemukan → login.html ───────
// Ini diperlukan agar saat user refresh halaman seperti /admin-cabang/dashboard.html
// tidak mendapat 404 dari Express, melainkan tetap dilayani oleh frontend
app.get("*", (req, res, next) => {
  // Hanya tangkap route non-API
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "../frontend/login.html"));
});

// ── 404 handler (hanya untuk /api/* yang tidak ditemukan) ─────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Endpoint tidak ditemukan" });
});

// ── Error handler ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

// ── Start server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Buka browser: http://localhost:${PORT}/login.html`);
});