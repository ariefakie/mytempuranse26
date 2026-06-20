// ===================================================
// SIMON-SE26TEMPURAN SE2026 – Landing Page JS
// ===================================================

// --- Supabase Config ---
const SUPABASE_URL = 'https://ebyzqfvfursatmeqdlwc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVieXpxZnZmdXJzYXRtZXFkbHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTYxNzksImV4cCI6MjA5NzQ3MjE3OX0.JWJ1ZhaXmSabr0qZ5--pDG3exMj2RCViWjFFGFOAvwU';

async function supabaseGet(table) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return await res.json();
  } catch (e) {
    console.error('Supabase error:', e);
    return null;
  }
}

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

// --- Login ---
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

// Static admin - Password: SE2026TEMPURAN
const STATIC_USERS = {
  'admin': { password: 'SE2026TEMPURAN', role: 'admin', name: 'Administrator' },
};

// Fallback biodata
const FALLBACK_BIODATA = [
  { nama: "Rifah Nur U.", email: "rifahnurulfah46@gmail.com", posisi: "PML" },
  { nama: "Cep Heri Yuswanto", email: "cephery5@gmail.com", posisi: "PML" },
  { nama: "Ujang Mulyana", email: "oedzhankdado@gmail.com", posisi: "PML" },
  { nama: "Taip Saepuloh", email: "taipsaepuloh01@gmail.com", posisi: "PML" },
  { nama: "Halim Darsono", email: "darsonohalim0@gmail.com", posisi: "PML" },
  { nama: "Iskandar Dinata", email: "iskandardinata594@gmail.com", posisi: "PML" },
];

let _biodataCache = null;

async function loadBiodata() {
  if (_biodataCache) return _biodataCache;

  // Try localStorage first
  try {
    const cached = localStorage.getItem('SIMON-SE26TEMPURAN-biodata-cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        _biodataCache = parsed;
        return _biodataCache;
      }
    }
  } catch(e) {}

  // Try Supabase
  try {
    const data = await supabaseGet('biodata');
    if (Array.isArray(data) && data.length > 0) {
      _biodataCache = data;
      localStorage.setItem('SIMON-SE26TEMPURAN-biodata-cache', JSON.stringify(data));
      return _biodataCache;
    }
  } catch(e) {}

  // Try local JSON
  try {
    const res = await fetch('/assets/data/data_biodata.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        _biodataCache = data;
        localStorage.setItem('SIMON-SE26TEMPURAN-biodata-cache', JSON.stringify(data));
        return _biodataCache;
      }
    }
  } catch(e) {}

  // Use fallback
  _biodataCache = FALLBACK_BIODATA;
  return _biodataCache;
}

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
    // Check admin
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

    // Check petugas from Supabase/local
    const biodata = await loadBiodata();
    const petugas = biodata.find(p =>
      (p.email?.toLowerCase() === email) ||
      (p.sobat_id?.toLowerCase() === email)
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
    errEl.classList.add('show');

  } catch(err) {
    btn.classList.remove('loading');
    errEl.textContent = '⚠ Terjadi kesalahan.';
    errEl.classList.add('show');
  }
}

function _saveAndRedirect(userData) {
  sessionStorage.setItem('SIMON-SE26TEMPURAN-user', JSON.stringify(userData));
  if (document.getElementById('rememberMe')?.checked) {
    localStorage.setItem('SIMON-SE26TEMPURAN-user', JSON.stringify(userData));
  }
  window.location.href = 'dashboard.html';
}

// Auto-login if saved
const saved = localStorage.getItem('SIMON-SE26TEMPURAN-user');
if (saved) {
  try {
    const u = JSON.parse(saved);
    if (u && u.email) window.location.href = 'dashboard.html';
  } catch(e) {}
}

// Progress ring
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