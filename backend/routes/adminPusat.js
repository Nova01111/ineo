// routes/adminPusat.js
const express = require("express");
const router  = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/adminPusatController");

// Semua route wajib login & role admin_pusat
router.use(verifyToken);
router.use(requireRole("admin_pusat"));

// ── Dashboard ─────────────────────────────────────────────────────────────
router.get("/dashboard", ctrl.getDashboard);

// ── Laporan Masuk ─────────────────────────────────────────────────────────
router.get("/laporan-masuk",              ctrl.getLaporanMasuk);
router.get("/laporan-masuk/:id",          ctrl.getLaporanMasukDetail);
router.patch("/laporan-masuk/:id/proses", ctrl.prosesLaporan);

// ── Rekap Gaji ────────────────────────────────────────────────────────────
router.post("/rekap-gaji",      ctrl.createRekapGaji);
router.get("/rekap-gaji",       ctrl.getRekapGaji);
router.get("/rekap-gaji/:id",   ctrl.getRekapGajiDetail);

// ── Notifikasi ────────────────────────────────────────────────────────────
router.post("/notifikasi",  ctrl.kirimNotifikasi);
router.get("/notifikasi",   ctrl.getNotifikasi);

// ── Master Data ───────────────────────────────────────────────────────────
router.get("/master/jenis-potongan", ctrl.getJenisPotongan);
router.get("/master/cabang",         ctrl.getCabang);

module.exports = router;