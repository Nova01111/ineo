// shared/auth.js
// Helper bersama untuk semua halaman frontend

// ── Ambil data dari localStorage ────────────────────────────────────────
function getToken()    { return localStorage.getItem("token"); }
function getNama()     { return localStorage.getItem("nama"); }
function getRole()     { return localStorage.getItem("role"); }
function getId()       { return localStorage.getItem("id"); }
function getCabangId() { return localStorage.getItem("cabang_id"); }

// ── Cek autentikasi & role ───────────────────────────────────────────────
function requireAuth(expectedRole) {
  const token = getToken();
  const role  = getRole();
  if (!token) {
    window.location.href = "/login.html";
    return false;
  }
  if (expectedRole && role !== expectedRole) {
    alert("Akses ditolak! Role Anda tidak sesuai.");
    window.location.href = "/login.html";
    return false;
  }
  return true;
}

// ── Logout ───────────────────────────────────────────────────────────────
function logout() {
  localStorage.clear();
  window.location.href = "/login.html";
}

// ── Fetch helper dengan token otomatis ──────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  try {
    const res  = await fetch(`/api${endpoint}`, { ...options, headers, cache: "no-store" });
    const data = await res.json();
    // Token expired / tidak valid → redirect login
    if (res.status === 401 || res.status === 403) {
      localStorage.clear();
      window.location.href = "/login.html";
      return null;
    }
    return data;
  } catch (err) {
    console.error("apiFetch error:", err);
    return null;
  }
}

// ── Format Rupiah ────────────────────────────────────────────────────────
function rupiah(n) {
  if (n === null || n === undefined || n === "") return "Rp 0";
  return "Rp " + Number(n).toLocaleString("id-ID");
}

// ── Format Tanggal (tanpa jam) ───────────────────────────────────────────
// Contoh output: "12 Januari 2025"
function tglFormat(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });
}

// ── Format Tanggal + Jam ─────────────────────────────────────────────────
// Contoh output: "12 Jan 2025, 14:30"
function tglJamFormat(d) {
  if (!d) return "-";
  return new Date(d).toLocaleString("id-ID", {
    day:    "numeric",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

// ── Nama Bulan ───────────────────────────────────────────────────────────
const BULAN = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// ── Set info user di sidebar ─────────────────────────────────────────────
function initUserInfo() {
  const nama     = getNama();
  const elNama   = document.getElementById("user-nama");
  const elAvatar = document.getElementById("user-avatar");
  if (elNama)   elNama.textContent   = nama || "-";
  if (elAvatar) elAvatar.textContent = nama ? nama.substring(0, 2).toUpperCase() : "?";
}

// ── Toast notifikasi ringan ──────────────────────────────────────────────
// Memanggil elemen <div class="toast" id="toast"> yang harus ada di setiap halaman.
// success = true  → warna hijau
// success = false → warna merah
let _toastTimer = null;
function showToast(msg, success = true) {
  const el = document.getElementById("toast");
  if (!el) return;

  el.textContent      = msg;
  el.style.display    = "block";
  el.style.background = success ? "#16a34a" : "#dc2626";

  // Reset timer jika toast sebelumnya belum hilang
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.style.display = "none";
  }, 3500);
}