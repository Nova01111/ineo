// routes/upload.js
const express  = require("express");
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
const router   = express.Router();

// ── Folder tujuan upload ──────────────────────────────────────────────────
// Struktur: INEO/backend/routes/upload.js → INEO/frontend/uploads/rekap-gaji/
const UPLOAD_DIR = path.join(__dirname, "../../frontend/uploads/rekap-gaji");

// Buat folder jika belum ada
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── Konfigurasi Multer (disk storage) ────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    // Format nama file: screenshot_<timestamp>_<random>.<ext>
    // Contoh: screenshot_1714000000000_a3f2.jpg
    const ext    = path.extname(file.originalname).toLowerCase();
    const random = Math.random().toString(36).slice(2, 6);
    const name   = `screenshot_${Date.now()}_${random}${ext}`;
    cb(null, name);
  },
});

// ── Validasi tipe file ────────────────────────────────────────────────────
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_EXT  = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

function fileFilter(_req, file, cb) {
  const ext  = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (ALLOWED_MIME.includes(mime) && ALLOWED_EXT.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Tipe file tidak diizinkan. Hanya ${ALLOWED_EXT.join(", ")} yang diterima.`
      ),
      false
    );
  }
}

// ── Instance Multer ───────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Maks 5 MB
    files: 1,                  // Hanya 1 file per request
  },
});

// ══════════════════════════════════════════════════════════════════════════
// POST /api/upload/screenshot
// Body (multipart/form-data): field "screenshot" berisi file gambar
// Response: { success, url, filename, size }
// ══════════════════════════════════════════════════════════════════════════
router.post(
  "/screenshot",
  (req, res, next) => {
    // Gunakan upload.single di dalam handler agar error Multer bisa ditangkap manual
    upload.single("screenshot")(req, res, (err) => {
      if (err) {
        // Error dari Multer (ukuran / tipe file)
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: "Ukuran file terlalu besar. Maksimal 5 MB.",
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || "Terjadi kesalahan saat upload.",
        });
      }
      next();
    });
  },
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Tidak ada file yang diupload. Sertakan field 'screenshot'.",
      });
    }

    // URL publik yang bisa diakses browser
    // File disimpan di frontend/uploads/rekap-gaji/<nama>
    // Express menyajikan /uploads/* dari folder frontend secara statis
    const publicUrl = `/uploads/rekap-gaji/${req.file.filename}`;

    return res.json({
      success  : true,
      message  : "Screenshot berhasil diupload.",
      url      : publicUrl,          // ← paste nilai ini ke field URL di form rekap gaji
      filename : req.file.filename,
      size     : req.file.size,      // dalam byte
    });
  }
);

// ══════════════════════════════════════════════════════════════════════════
// DELETE /api/upload/screenshot/:filename
// Hapus file screenshot (opsional — berguna jika user ganti file)
// ══════════════════════════════════════════════════════════════════════════
router.delete("/screenshot/:filename", (req, res) => {
  const { filename } = req.params;

  // Cegah path traversal (misalnya filename = "../../server.js")
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return res.status(400).json({ success: false, message: "Nama file tidak valid." });
  }

  const filePath = path.join(UPLOAD_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "File tidak ditemukan." });
  }

  try {
    fs.unlinkSync(filePath);
    return res.json({ success: true, message: "File berhasil dihapus." });
  } catch (err) {
    console.error("Gagal menghapus file:", err);
    return res.status(500).json({ success: false, message: "Gagal menghapus file." });
  }
});

module.exports = router;