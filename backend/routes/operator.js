// routes/operator.js
const express    = require("express");
const router     = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const c          = require("../controllers/operatorController");

// Semua route operator wajib login dan memiliki role 'operator'
router.use(verifyToken);
router.use(requireRole("operator"));

// ── Dashboard ─────────────────────────────────────────────────────────────
router.get("/dashboard", c.getDashboard);

// ── Teknisi ───────────────────────────────────────────────────────────────
router.get   ("/teknisi",              c.getTeknisi);
router.get   ("/teknisi/:id",          c.getTeknisiById);
router.post  ("/teknisi",              c.createTeknisi);
router.put   ("/teknisi/:id",          c.updateTeknisi);
router.patch ("/teknisi/:id/toggle",   c.toggleAktifTeknisi);

// ── Pengguna (Admin Cabang & Admin Pusat) ─────────────────────────────────
router.get   ("/pengguna",             c.getPengguna);
router.post  ("/pengguna",             c.createPengguna);
router.put   ("/pengguna/:id",         c.updatePengguna);
router.patch ("/pengguna/:id/toggle",  c.toggleAktifPengguna);

// ── Cabang ────────────────────────────────────────────────────────────────
router.get   ("/cabang",               c.getCabang);
router.post  ("/cabang",               c.createCabang);
router.put   ("/cabang/:id",           c.updateCabang);
router.patch ("/cabang/:id/toggle",    c.toggleAktifCabang);

// ── Provider ──────────────────────────────────────────────────────────────
router.get   ("/provider",             c.getProvider);
router.post  ("/provider",             c.createProvider);
router.put   ("/provider/:id",         c.updateProvider);
router.patch ("/provider/:id/toggle",  c.toggleAktifProvider);

// ── Project ───────────────────────────────────────────────────────────────
router.get   ("/project",              c.getProject);
router.post  ("/project",              c.createProject);
router.put   ("/project/:id",          c.updateProject);

// ── Sub Project ───────────────────────────────────────────────────────────
router.get   ("/sub-project",          c.getSubProject);
router.post  ("/sub-project",          c.createSubProject);
router.put   ("/sub-project/:id",      c.updateSubProject);

// ── Jenis Potongan ────────────────────────────────────────────────────────
router.get   ("/jenis-potongan",       c.getJenisPotongan);
router.post  ("/jenis-potongan",       c.createJenisPotongan);
router.put   ("/jenis-potongan/:id",   c.updateJenisPotongan);
router.delete("/jenis-potongan/:id",   c.deleteJenisPotongan);

// ── Monitor ───────────────────────────────────────────────────────────────
router.get("/monitor/laporan",         c.getMonitorLaporan);
router.get("/monitor/gaji",            c.getMonitorGaji);

// ── Log Aktivitas ─────────────────────────────────────────────────────────
router.get("/log",                     c.getLog);

// ── Master (dropdown) ─────────────────────────────────────────────────────
router.get("/master/cabang",           c.getMasterCabang);
router.get("/master/provider",         c.getMasterProvider);

module.exports = router;