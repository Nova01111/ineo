const express = require("express");
const router  = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/adminCabangController");

router.use(verifyToken);
router.use(requireRole("admin_cabang"));

router.get("/dashboard", ctrl.getDashboard);

router.get("/laporan",             ctrl.getLaporan);
router.get("/laporan/:id",         ctrl.getLaporanDetail);
router.post("/laporan",            ctrl.createLaporan);
router.patch("/laporan/:id/kirim", ctrl.kirimLaporan);
router.delete("/laporan/:id",      ctrl.deleteLaporan);

router.get("/notifikasi",                     ctrl.getNotifikasi);
router.patch("/notifikasi/:id/konfirmasi",    ctrl.konfirmasiNotifikasi);

router.get("/master/teknisi",                 ctrl.getTeknisi);
router.get("/master/provider",                ctrl.getProvider);
router.get("/master/project/:provider_id",    ctrl.getProject);
router.get("/master/sub-project/:project_id", ctrl.getSubProject);
router.get("/master/admin-pusat",             ctrl.getAdminPusat);

router.get("/slip-gaji/:teknisi_id",          ctrl.getSlipGaji);

module.exports = router;