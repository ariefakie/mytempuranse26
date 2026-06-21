// ===================================================
// SIMON-SE26TEMPURAN SE2026 – Landing Page JS
// ===================================================

// --- Theme Toggle ---
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

function setTheme(mode) {
  body.className = mode === 'light' ? 'light-mode' : 'dark-mode';
  localStorage.setItem('SIMON-SE26TEMPURAN-theme', mode);
}

const savedTheme = localStorage.getItem('SIMON-SE26TEMPURAN-theme') || 'dark';
setTheme(savedTheme);

themeToggle?.addEventListener('click', () => {
  const current = body.classList.contains('light-mode') ? 'light' : 'dark';
  setTheme(current === 'light' ? 'dark' : 'light');
});

// --- Navbar scroll ---
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (nav) {
    nav.style.background = window.scrollY > 20
      ? (body.classList.contains('light-mode') ? 'rgba(248,250,252,0.97)' : 'rgba(10,10,15,0.95)')
      : '';
  }
});

// --- Simple Counter Animation ---
function animateCounters() {
  const counters = document.querySelectorAll('.stat-value[data-target]');
  counters.forEach(counter => {
    const targetStr = counter.getAttribute('data-target');
    const target = parseInt(targetStr);
    if (!target || isNaN(target)) return;
    let current = 0;
    const step = Math.ceil(target / 60);
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(interval);
      }
      counter.textContent = current.toLocaleString('id-ID');
    }, 33);
  });
}

window.addEventListener('load', () => {
  setTimeout(animateCounters, 500);
});

// --- Particles ---
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.style.cssText = `
      position:absolute;
      width:${Math.random()*3+1}px; height:${Math.random()*3+1}px;
      background:rgba(${Math.random()>0.5?'99,102,241':'139,92,246'},${Math.random()*0.4+0.1});
      border-radius:50%;
      left:${Math.random()*100}%; top:${Math.random()*100}%;
      animation:particleFloat ${Math.random()*15+10}s ease-in-out infinite;
      animation-delay:-${Math.random()*20}s;
    `;
    container.appendChild(p);
  }
  const style = document.createElement('style');
  style.textContent = `
    @keyframes particleFloat {
      0%,100%{transform:translate(0,0) scale(1);opacity:0.3}
      33%{transform:translate(15px,-15px) scale(1.2);opacity:0.7}
      66%{transform:translate(-15px,15px) scale(0.8);opacity:0.4}
    }
  `;
  document.head.appendChild(style);
}
createParticles();

// --- Password Toggle ---
function togglePassword() {
  const pwd = document.getElementById('loginPassword');
  const icon = document.getElementById('eyeIcon');
  if (pwd.type === 'password') {
    pwd.type = 'text';
    icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    pwd.type = 'password';
    icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
}

// --- Static Admin User ---
const STATIC_USERS = {
  'admin': { password: 'SE2026TEMPURAN', role: 'admin', name: 'Administrator' },
};

// --- Fallback Biodata (hardcoded backup) ---
const FALLBACK_BIODATA = [
  { nama: "Rifah Nur U.", email: "rifahnurulfah46@gmail.com", posisi: "PML" },
  { nama: "Cep Heri Yuswanto", email: "cephery5@gmail.com", posisi: "PML" },
  { nama: "Ujang Mulyana", email: "oedzhankdado@gmail.com", posisi: "PML" },
  { nama: "Taip Saepuloh", email: "taipsaepuloh01@gmail.com", posisi: "PML" },
  { nama: "Halim Darsono", email: "darsonohalim0@gmail.com", posisi: "PML" },
  { nama: "Iskandar Dinata", email: "iskandardinata594@gmail.com", posisi: "PML" },
];

// Cache with timestamp (NO CACHE - always fetch fresh from Supabase)
const CACHE_KEY = 'SIMON-SE26TEMPURAN-biodata-cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (still useful for rapid page switches)

let _biodataCache = null;
let _cacheTimestamp = 0;

// --- Load Biodata from Supabase (NO PERSISTENT CACHE) ---
async function loadBiodata() {
  // Use in-memory cache if fresh (within TTL)
  if (_biodataCache && (Date.now() - _cacheTimestamp) < CACHE_TTL) {
    return _biodataCache;
  }

  // Always fetch fresh from Supabase
  try {
    const rawData = await window.supabase.supabaseGet('biodata_petugas');
    if (Array.isArray(rawData) && rawData.length > 0) {
      // Map using unified field mapping from supabase.js
      _biodataCache = rawData.map(p => ({
        nama: p.nm_lengkap,
        email: p.email,
        posisi: p.jabatan,
        no_telp: p.nohp,
        sobad_id: p.sobad_id,
        ttl: p.ttl,
        umur: p.umur,
        jenis_kelamin: p.kelamin,
        pendidikan: p.pendidikan,
        pekerjaan: p.pekerjaan,
        alamat: p.alamat,
        alamat_desa: p.nmdesa
      }));
      _cacheTimestamp = Date.now();
      return _biodataCache;
    }
  } catch(e) {
    console.warn('Failed to fetch from Supabase:', e);
  }

  // Fallback to hardcoded data
  _biodataCache = FALLBACK_BIODATA;
  return _biodataCache;
}

// --- Login Handler ---
async function handleLogin(e) {
  e.preventDefault();
  const emailRaw = document.getElementById('loginEmail').value.trim();
  const email = emailRaw.toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('btnLogin');
  const errEl = document.getElementById('loginError');

  if (!emailRaw) {
    errEl.textContent = '⚠ Email/username belum diisi.';
    errEl.classList.add('show');
    return;
  }
  if (!password) {
    errEl.textContent = '⚠ Password belum diisi.';
    errEl.classList.add('show');
    return;
  }

  btn.classList.add('loading');
  errEl.classList.remove('show');

  try {
    // Check admin first (static user)
    const staticUser = STATIC_USERS[email] || STATIC_USERS[email.split('@')[0]];
    if (staticUser && staticUser.password === password) {
      const userData = {
        email: 'admin',
        name: 'Administrator',
        role: 'admin',
        loginTime: new Date().toISOString()
      };
      _saveAndRedirect(userData);
      return;
    }

    // Check petugas from Supabase
    const biodata = await loadBiodata();
    const petugas = biodata.find(p =>
      (p.email?.toLowerCase() === email) ||
      (p.sobad_id?.toLowerCase() === email)
    );

    if (petugas) {
      const isPML = petugas.posisi?.toUpperCase().includes('PML');
      const expectedPassword = isPML ? 'PML2026Tempuran' : 'PPL2026Tempuran';

      if (password === expectedPassword) {
        const userData = {
          email: petugas.email?.toLowerCase() || email,
          name: petugas.nama,
          role: isPML ? 'pml' : 'ppl',
          loginTime: new Date().toISOString()
        };
        _saveAndRedirect(userData);
        return;
      } else {
        btn.classList.remove('loading');
        errEl.textContent = `⚠ Password salah. Gunakan: ${isPML ? 'PML2026Tempuran' : 'PPL2026Tempuran'}`;
        errEl.classList.add('show');
        return;
      }
    }

    btn.classList.remove('loading');
    errEl.textContent = '⚠ Akun tidak ditemukan.';

  } catch(err) {
    btn.classList.remove('loading');
    errEl.textContent = '⚠ Terjadi kesalahan koneksi.';
  }
}

function _saveAndRedirect(userData) {
  sessionStorage.setItem('SIMON-SE26TEMPURAN-user', JSON.stringify(userData));
  if (document.getElementById('rememberMe')?.checked) {
    localStorage.setItem('SIMON-SE26TEMPURAN-user', JSON.stringify(userData));
  }
  window.location.href = 'dashboard.html';
}

// --- Auto-login if saved user exists ---
const saved = sessionStorage.getItem('SIMON-SE26TEMPURAN-user') || localStorage.getItem('SIMON-SE26TEMPURAN-user');
if (saved) {
  try {
    const u = JSON.parse(saved);
    if (u && u.email) window.location.href = 'dashboard.html';
  } catch(e) {}
}

// --- Progress Ring Animation ---
document.addEventListener('DOMContentLoaded', () => {
  const ring = document.getElementById('progressRing');
  if (ring) {
    const total = 314;
    const pct = 1.88 / 100;
    const offset = total - (total * pct);
    setTimeout(() => {
      ring.style.transition = 'stroke-dashoffset 2s ease';
      ring.style.strokeDashoffset = offset;
    }, 500);
  }
});
