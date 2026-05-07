// routes/teknisi.js
const express = require("express");
const router  = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/teknisiController");

// Semua route wajib login & role teknisi
router.use(verifyToken);
router.use(requireRole("teknisi"));

// ── Dashboard ─────────────────────────────────────────────────────────────
router.get("/dashboard", ctrl.getDashboard);

// ── Slip Gaji ─────────────────────────────────────────────────────────────
router.get("/slip-gaji", ctrl.getSlipGaji);

// ── Riwayat Gaji ──────────────────────────────────────────────────────────
router.get("/riwayat-gaji", ctrl.getRiwayatGaji);

// ── Profil ────────────────────────────────────────────────────────────────
router.get("/profil", ctrl.getProfil);

module.exports = router;