// ===================================================
// SIMON-SE26TEMPURAN SE2026 – Main Application JS
// ===================================================

'use strict';

// ---- State ----
let AppData   = { biodata: [], alokasi: [], progres: [], pml_map: {} };
let ScopedData = { biodata: [], alokasi: [], progres: [], pml_map: {} }; // filtered by role
let CurrentPage = 'dashboard';
let CurrentUser = null;

// ---- Palette ----
const COLORS = ['#6366f1','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16','#f97316','#0ea5e9'];

// ====================================================
// INIT
// ====================================================

// const API_BASE = 'http://localhost:8787'; // LOCAL DEVELOPMENT ONLY

async function init() {
  // Auth check
  CurrentUser = JSON.parse(sessionStorage.getItem('SIMON-SE26TEMPURAN-user') || localStorage.getItem('SIMON-SE26TEMPURAN-user') || 'null');
  if (!CurrentUser) { window.location.href = 'index.html'; return; }

  // Apply saved theme
  const theme = localStorage.getItem('SIMON-SE26TEMPURAN-theme') || 'dark';
  document.body.className = theme === 'light' ? 'light-mode' : 'dark-mode';

  // Set user info
  updateUserInfo();

  // Start datetime clock
  updateClock();
  setInterval(updateClock, 1000);

  // Load data from Supabase
  try {
    await loadAllData();
    navigateTo(CurrentPage);
  } catch(e) {
    document.getElementById('pageContent').innerHTML = `
      <div class="loading-state">
        <p style="color:var(--danger)">⚠ Gagal memuat data: ${e.message}</p>
        <button class="btn-sm btn-primary-sm" onclick="location.reload()">Coba Lagi</button>
      </div>
    `;
  }
}

async function loadAllData() {
  // Load from Supabase directly (Vercel compatible)
  try {
    const [bio, alok, prog] = await Promise.all([
      supabase.getAllBiodata(),
      supabase.getAllAlokasi(),
      supabase.getAllProgres()
    ]);
    AppData.biodata = bio || [];
    AppData.alokasi = alok || [];
    AppData.progres = prog || [];
  } catch(e) {
    console.warn('Supabase fetch failed:', e);
    AppData.biodata = [];
    AppData.alokasi = [];
    AppData.progres = [];
  }

  // Standardization helpers
  const DESA_MAP = {
    'dayeuhluhur': '001 Desa Dayeuhluhur',
    'lemahkarya': '002 Desa Lemahkarya',
    'lemahduhur': '003 Desa Lemahduhur',
    'lemahsubur': '004 Desa Lemahsubur',
    'lemahmakmur': '005 Desa Lemahmakmur',
    'pagadungan': '006 Desa Pagadungan',
    'purwajaya': '007 Desa Purwajaya',
    'jayanegara': '008 Desa Jayanegara',
    'tempuran': '009 Desa Tempuran',
    'ciparagejaya': '010 Desa Ciparagejaya',
    'cikuntul': '011 Desa Cikuntul',
    'sumberjaya': '012 Desa Sumberjaya',
    'pancakarya': '013 Desa Pancakarya',
    'tanjungjaya': '014 Desa Tanjungjaya'
  };

  const getCleanDesa = (name) => {
    if (!name) return '-';
    const clean = name.toLowerCase().replace(/[^a-z]/g, '').trim();
    for (const key in DESA_MAP) {
      if (clean.includes(key) || key.includes(clean)) {
        return DESA_MAP[key];
      }
    }
    return name;
  };

  const titleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim();
  };

  // Expose helpers globally so other parts can use them if needed
  window.getCleanDesa = getCleanDesa;
  window.titleCase = titleCase;

  // Format all PML/PPL names and villages
  AppData.biodata.forEach(p => {
    // Map biodata_petugas columns to internal fields
    p.nama = titleCase(p.nm_lengkap);
    p.posisi = p.jabatan;
    p.no_telp = p.nohp;
    p.jenis_kelamin = p.kelamin;
    p.alamat_desa = getCleanDesa(p.nmdesa);
    p.sobat_id = p.sobad_id;
    p.merk_hp = p.merk_hp || '';
    p.tipe_hp = p.tipe_hp || '';
  });
  AppData.alokasi.forEach(a => {
    // Map alokasi_petugas columns to internal fields
    a.pml = titleCase(a["PML"]);
    a.ppl = titleCase(a["PPL"]);
    a.email_pencacah = a["EMAIL PENCACAH"];
    a.email_pengawas = a["EMAIL PENGAWAS"];
    a.nmdes = getCleanDesa(a.nmdes);
    a.flag_perubahan = a["Flag Perubahan"];
    a.flag_sls_open = a["Flag SLS Open PBI"];
    a.kk_open = a["KK Open PBI"];
  });
  AppData.progres.forEach(pr => {
    // Map progres_lapangan columns to internal fields
    pr.desa = getCleanDesa(pr.nmdesa);
    pr.petugas = pr.email;
    pr.kode_sls = pr.kdsls;
    pr.kode_desa = pr.kddesa;
    pr.nama_sls = pr.nmsls;
    pr.nama_usaha = pr.nmusaha;
    pr.alamat = pr.nmalamat;
    pr.jumlah_usaha = pr.jmlusaha;
    pr.skala_usaha = pr.skalausaha;
    pr.kode_identitas = pr.kdidentitas;
    pr.keterangan = pr.ket;
  });

  // Build relasi: attach PPL email from alokasi to biodata
  AppData.biodata.forEach(p => {
    const email = p.email?.toLowerCase();
    const alok_rows = AppData.alokasi.filter(a => a.email_pencacah?.toLowerCase() === email || a.email_pengawas?.toLowerCase() === email);
    p._alokasi = alok_rows;
    const prog_rows = AppData.progres.filter(pr => {
      const pe = pr.petugas?.toLowerCase() || '';
      return pe.includes(email || '###');
    });
    p._progres_count = prog_rows.length;
    p._progres_done = prog_rows.filter(r => r.status === 'approved by pengawas' || r.status === 'submitted by pencacah').length;
  });

  // PML relasi
  AppData.pml_map = {};
  AppData.biodata.filter(b => b.posisi?.includes('PML')).forEach(pml => {
    const ppls = AppData.alokasi
      .filter(a => a.pml === pml.nama)
      .map(a => a.ppl)
      .filter((v,i,arr) => arr.indexOf(v) === i);
    AppData.pml_map[pml.nama] = ppls;
    pml._ppls = ppls;
  });

  // Init scoped data based on login role
  initScopedData();

  // Update sidebar badges dynamically
  try {
    const bProg = document.querySelector('.nav-item[data-page="progres"] .nav-badge');
    const bBio = document.querySelector('.nav-item[data-page="biodata"] .nav-badge');
    const bAlok = document.querySelector('.nav-item[data-page="alokasi"] .nav-badge');
    if (bProg) bProg.textContent = AppData.progres.length.toLocaleString('id-ID');
    if (bBio) bBio.textContent = AppData.biodata.length.toLocaleString('id-ID');
    if (bAlok) bAlok.textContent = AppData.alokasi.length.toLocaleString('id-ID');
  } catch(e) { console.error("Error updating sidebar badges:", e); }
}

// ====================================================
// SCOPED DATA – filter sesuai role user
// ====================================================
function initScopedData() {
  const role = CurrentUser?.role || 'admin';
  const email = CurrentUser?.email?.toLowerCase() || '';

  if (role === 'admin' || !email) {
    // Admin melihat semua data
    ScopedData = {
      biodata: AppData.biodata,
      alokasi: AppData.alokasi,
      progres: AppData.progres,
      pml_map: AppData.pml_map,
      isFiltered: false,
      scopeLabel: null
    };
    return;
  }

  if (role === 'pml') {
    // PML: hanya wilayah tugasnya
    const myAlokasi = AppData.alokasi.filter(a => a.email_pengawas?.toLowerCase() === email);
    const myPPLEmails = [...new Set(myAlokasi.map(a => a.email_pencacah?.toLowerCase()).filter(Boolean))];
    const myPPLNames  = [...new Set(myAlokasi.map(a => a.ppl).filter(Boolean))];
    // Progres: listing milik PPL-nya atau dirinya sendiri
    const myProgres = AppData.progres.filter(r => {
      const pe = r.petugas?.toLowerCase() || '';
      return pe.includes(email) || myPPLEmails.some(e => pe.includes(e));
    });
    // Biodata: dirinya + semua PPL-nya
    const myBiodata = AppData.biodata.filter(b =>
      b.email?.toLowerCase() === email ||
      myPPLEmails.includes(b.email?.toLowerCase()) ||
      myPPLNames.includes(b.nama)
    );
    // pml_map hanya untuk dirinya
    const myPmlMap = {};
    const selfBio = AppData.biodata.find(b => b.email?.toLowerCase() === email);
    if (selfBio) myPmlMap[selfBio.nama] = myPPLNames;

    ScopedData = {
      biodata: myBiodata,
      alokasi: myAlokasi,
      progres: myProgres,
      pml_map: myPmlMap,
      isFiltered: true,
      scopeLabel: `PML: ${CurrentUser.name || email}`,
      scopeInfo: `${myAlokasi.length} SLS · ${myPPLNames.length} PPL · ${myProgres.length} listing`
    };
    return;
  }

  if (role === 'ppl') {
    // PPL: hanya SLS dan listing miliknya
    const myAlokasi = AppData.alokasi.filter(a => a.email_pencacah?.toLowerCase() === email);
    const myProgres = AppData.progres.filter(r => r.petugas?.toLowerCase().includes(email));
    const myBiodata = AppData.biodata.filter(b => b.email?.toLowerCase() === email);
    // Tambahkan PML-nya ke biodata
    const myPmlName = myAlokasi[0]?.pml || null;
    if (myPmlName) {
      const pmlBio = AppData.biodata.find(b => b.nama === myPmlName);
      if (pmlBio && !myBiodata.find(b => b.nama === myPmlName)) myBiodata.push(pmlBio);
    }

    ScopedData = {
      biodata: myBiodata,
      alokasi: myAlokasi,
      progres: myProgres,
      pml_map: {},
      isFiltered: true,
      scopeLabel: `PPL: ${CurrentUser.name || email}`,
      scopeInfo: `${myAlokasi.length} SLS · ${myProgres.length} listing ditugaskan`
    };
    return;
  }

  // fallback
  ScopedData = { ...AppData, isFiltered: false, scopeLabel: null };
}

// ---- Render scope banner ----
function getScopeBanner() {
  if (!ScopedData.isFiltered) return '';
  return `
    <div style="display:flex;align-items:center;gap:8px;padding:10px 16px;margin-bottom:16px;
      background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:10px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2"
        style="flex-shrink:0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <div>
        <span style="font-size:12px;font-weight:700;color:#818cf8">${ScopedData.scopeLabel}</span>
        <span style="font-size:11px;color:var(--text-dim);margin-left:8px">${ScopedData.scopeInfo || ''}</span>
      </div>
      <span style="margin-left:auto;font-size:11px;color:var(--text-dim)">Data dibatasi sesuai wilayah tugas</span>
    </div>`;
}

// ====================================================
// NAVIGATION
// ====================================================
function navigateTo(page, e) {
  if (e) e.preventDefault();
  CurrentPage = page;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Update topbar
  const titles = {
    dashboard: { title: 'Dashboard', sub: ScopedData.isFiltered ? `Wilayah Tugas: ${ScopedData.scopeLabel}` : 'Ringkasan Progres SE2026 Kecamatan Tempuran' },
    progres:   { title: 'Progres Lapangan', sub: ScopedData.isFiltered ? `Data terbatas sesuai wilayah tugas Anda` : 'Detail status pendataan per listing' },
    biodata:   { title: 'Biodata Petugas', sub: ScopedData.isFiltered ? `Data petugas di wilayah Anda` : 'Data lengkap PML dan PPL' },
    alokasi:   { title: 'Alokasi Petugas', sub: ScopedData.isFiltered ? `Alokasi SLS wilayah Anda` : 'Peta alokasi SLS per petugas' },
    users:     { title: 'Manajemen User', sub: 'Kelola kewenangan login dan daftar petugas sensus' },
    config:    { title: 'Konfigurasi Sistem', sub: 'Unggah berkas data mentah (CSV/Excel) dan sinkronisasi database' },
  };
  const t = titles[page] || titles.dashboard;
  document.getElementById('pageTitle').textContent = t.title;
  document.getElementById('pageSub').textContent = t.sub;

  // Close sidebar on mobile
  closeSidebar();

  // Render page
  const content = document.getElementById('pageContent');
  content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Memuat...</p></div>';

  setTimeout(() => {
    switch(page) {
      case 'dashboard': renderDashboard(); break;
      case 'progres': renderProgres(); break;
      case 'biodata': renderBiodata(); break;
      case 'alokasi': renderAlokasi(); break;
      case 'users': renderUsers(); break;
      case 'config': renderConfig(); break;
      case 'profil': renderProfil(); break;
    }
  }, 100);
}

// ====================================================
// DASHBOARD PAGE
// ====================================================
function renderDashboard() {
  const prog = ScopedData.progres;
  const total = prog.length;

  const statusCount = {};
  prog.forEach(r => { statusCount[r.status] = (statusCount[r.status]||0)+1; });

  const open = statusCount['open'] || 0;
  const draft = statusCount['draft'] || 0;
  const submitted = statusCount['submitted by pencacah'] || 0;
  const approved = statusCount['approved by pengawas'] || 0;
  const rejected = statusCount['rejected by pengawas'] || 0;
  const revoked = statusCount['revoked by pengawas'] || 0;
  const selesai = submitted + approved;
  const pctSelesai = ((selesai / total)*100).toFixed(1);

  // Per desa stats
  const desaMap = {};
  prog.forEach(r => {
    const d = r.desa;
    if (!desaMap[d]) desaMap[d] = { total:0, selesai:0 };
    desaMap[d].total++;
    if (r.status !== 'open') desaMap[d].selesai++;
  });
  const desaList = Object.entries(desaMap).sort((a,b) => b[1].total - a[1].total);

  // Per PPL stats from alokasi (scoped)
  const pplMap = {};
  ScopedData.alokasi.forEach(a => {
    if (!pplMap[a.ppl]) pplMap[a.ppl] = { umkm:0, fasih:0, sls:0 };
    pplMap[a.ppl].umkm += (a.umkm||0);
    pplMap[a.ppl].fasih += (a.fasih||0);
    pplMap[a.ppl].sls++;
  });

  const totalUMKM = ScopedData.alokasi.reduce((s,a) => s+(a.umkm||0),0);
  const totalFASIH = ScopedData.alokasi.reduce((s,a) => s+(a.fasih||0),0);
  const totalPetugas = ScopedData.biodata.length;
  const totalSLS = ScopedData.alokasi.length;

  let activeSlsHtml = '';

  // ========== PPL: Monitoring SLS Aktif Sendiri ==========
  if (CurrentUser?.role === 'ppl') {
    const activeSlsId = localStorage.getItem(`active-sls-${CurrentUser.email?.toLowerCase()}`);
    if (activeSlsId) {
      const slsInfo = AppData.alokasi.find(a => a.idsubsls === activeSlsId);
      if (slsInfo) {
        const slsProg = AppData.progres.filter(r => String(r.kode_sls).trim() === String(slsInfo.kdsls).trim() && String(r.kode_desa).trim() === String(slsInfo.kddesa).trim());
        const totalProg = slsProg.length;
        const doneProg = slsProg.filter(r => r.status !== 'open').length;
        const pct = totalProg ? ((doneProg / totalProg) * 100).toFixed(0) : 0;

        activeSlsHtml = `
          <div class="card" style="margin-bottom:20px;background:linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08));border:1px solid rgba(99,102,241,0.25);">
            <div class="card-header" style="margin-bottom:12px;gap:12px">
              <div style="flex:1">
                <div class="card-title" style="color:var(--primary-light);display:flex;align-items:center;gap:8px">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                  Target SLS Sedang Dikerjakan (Workspace)
                </div>
                <div class="card-sub">SLS aktif ini dapat dipantau di menu Konfigurasi (Admin).</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;">
              <div style="flex:1;min-width:260px">
                <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">${slsInfo.nmdes} – ${slsInfo.nmsls}</div>
                <div style="font-size:12px;color:var(--text-muted);font-family:monospace">ID SLS: ${slsInfo.idsubsls} | PML Pengawas: ${slsInfo.pml}</div>
              </div>
              <div style="width:280px;max-width:100%">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
                  <span style="color:var(--text-muted)">Progress Listing SLS</span>
                  <span style="font-weight:700;color:var(--primary-light)">${doneProg}/${totalProg} SLS Prelist (${pct}%)</span>
                </div>
                <div class="progress-track" style="height:6px">
                  <div class="progress-fill" style="width:${pct}%"></div>
                </div>
              </div>
              <div style="display:flex;gap:12px;flex-wrap:wrap">
                <div style="background:var(--bg-2);padding:6px 14px;border-radius:var(--radius-xs);text-align:center">
                  <div style="font-size:14px;font-weight:700;color:var(--warning)">${slsInfo.umkm || 0}</div>
                  <div style="font-size:10px;color:var(--text-dim)">UMKM</div>
                </div>
                <div style="background:var(--bg-2);padding:6px 14px;border-radius:var(--radius-xs);text-align:center">
                  <div style="font-size:14px;font-weight:700;color:var(--success)">${slsInfo.fasih || 0}</div>
                  <div style="font-size:10px;color:var(--text-dim)">FASIH</div>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    } else {
      activeSlsHtml = `
        <div class="card" style="margin-bottom:20px;background:rgba(245,158,11,0.04);border:1px dashed var(--warning);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:12px">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div>
                <div style="font-size:14px;font-weight:700;color:var(--text)">Belum ada SLS aktif yang dikerjakan</div>
                <div style="font-size:12px;color:var(--text-muted)">Silakan tentukan SLS yang sedang Anda kerjakan di menu Alokasi Petugas untuk mengaktifkan Workspace dan unduh template.</div>
              </div>
            </div>
            <button class="btn-sm btn-ghost-sm" onclick="navigateTo('alokasi')" style="font-size:12px;padding:6px 12px;border-color:var(--warning);color:var(--warning)">Pilih SLS Aktif</button>
          </div>
        </div>
      `;
    }
  }

  // ========== PML: Monitoring Semua SLS Aktif PPL di Bawah Pengawasannya ==========
  if (CurrentUser?.role === 'pml') {
    const myPPLs = ScopedData.biodata.filter(b => b.posisi?.includes('PPL'));
    const activeSLSList = [];

    myPPLs.forEach(ppl => {
      const key = `active-sls-${ppl.email?.toLowerCase()}`;
      const activeId = localStorage.getItem(key);
      if (activeId) {
        const slsInfo = AppData.alokasi.find(a => a.idsubsls === activeId);
        if (slsInfo) {
          const slsProg = AppData.progres.filter(r =>
            String(r.kode_sls).trim() === String(slsInfo.kdsls).trim() &&
            String(r.kode_desa).trim() === String(slsInfo.kddesa).trim()
          );
          const totalProg = slsProg.length;
          const doneProg = slsProg.filter(r => r.status !== 'open').length;
          const pct = totalProg ? ((doneProg / totalProg) * 100).toFixed(0) : 0;

          activeSLSList.push({
            ppl: ppl.nama,
            pplEmail: ppl.email,
            slsInfo,
            slsProg,
            totalProg,
            doneProg,
            pct
          });
        }
      }
    });

    if (activeSLSList.length > 0) {
      activeSlsHtml = `
        <div class="card" style="margin-bottom:20px;background:linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.06));border:1px solid rgba(99,102,241,0.2);">
          <div class="card-header" style="margin-bottom:16px">
            <div>
              <div class="card-title" style="color:var(--primary-light);display:flex;align-items:center;gap:8px">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                Monitoring SLS Aktif PPL Binaan (${activeSLSList.length})
              </div>
              <div class="card-sub">Pantau progres SLS yang sedang dikerjakan oleh PPL di bawah pengawasan Anda</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px">
            ${activeSLSList.map(item => `
              <div style="padding:14px;background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
                <div style="flex:1;min-width:200px">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    <div style="width:28px;height:28px;border-radius:6px;background:var(--primary);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:12px">${item.ppl[0]}</div>
                    <div>
                      <div style="font-size:13px;font-weight:700;color:var(--text)">${item.ppl}</div>
                      <div style="font-size:11px;color:var(--text-muted)">${item.slsInfo.nmdes} – ${item.slsInfo.nmsls}</div>
                    </div>
                  </div>
                  <div style="font-size:11px;color:var(--text-dim);font-family:monospace">ID: ${item.slsInfo.idsubsls}</div>
                </div>
                <div style="width:200px;max-width:100%">
                  <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
                    <span style="color:var(--text-muted)">Progress</span>
                    <span style="font-weight:700;color:${item.pct >= 50 ? 'var(--success)' : 'var(--warning)'}">${item.doneProg}/${item.totalProg} (${item.pct}%)</span>
                  </div>
                  <div class="progress-track" style="height:5px">
                    <div class="progress-fill" style="width:${item.pct}%;${item.pct >= 50 ? 'background:var(--success)' : ''}"></div>
                  </div>
                </div>
                <div style="display:flex;gap:8px">
                  <div style="background:rgba(245,158,11,0.1);padding:4px 10px;border-radius:4px;text-align:center">
                    <div style="font-size:12px;font-weight:700;color:var(--warning)">${item.slsInfo.umkm || 0}</div>
                    <div style="font-size:9px;color:var(--text-dim)">UMKM</div>
                  </div>
                  <div style="background:rgba(16,185,129,0.1);padding:4px 10px;border-radius:4px;text-align:center">
                    <div style="font-size:12px;font-weight:700;color:var(--success)">${item.slsInfo.fasih || 0}</div>
                    <div style="font-size:9px;color:var(--text-dim)">FASIH</div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      activeSlsHtml = `
        <div class="card" style="margin-bottom:20px;background:rgba(245,158,11,0.04);border:1px dashed var(--warning);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:12px">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div>
                <div style="font-size:14px;font-weight:700;color:var(--text)">Belum ada PPL yang mengaktifkan SLS</div>
                <div style="font-size:12px;color:var(--text-muted)">PPL di bawah pengawasan Anda belum memilih SLS aktif. Monitoring akan muncul setelah PPL memilih SLS.</div>
              </div>
            </div>
            <button class="btn-sm btn-ghost-sm" onclick="navigateTo('alokasi')" style="font-size:12px;padding:6px 12px;border-color:var(--warning);color:var(--warning)">Lihat Alokasi PPL</button>
          </div>
        </div>
      `;
    }
  }

  document.getElementById('pageContent').innerHTML = `
    ${getScopeBanner()}
    ${activeSlsHtml}
    <!-- STATS GRID -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(99,102,241,0.15);color:#818cf8">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value" id="ctr-total">0</div>
          <div class="stat-label">Total Listing</div>
          <div class="stat-change change-up">↑ ${total.toLocaleString('id-ID')} prelist</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(16,185,129,0.15);color:#4ade80">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value" id="ctr-selesai">0</div>
          <div class="stat-label">Sudah Diproses</div>
          <div class="stat-change change-up">↑ ${pctSelesai}% dari wilayah</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(245,158,11,0.15);color:#fbbf24">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value" id="ctr-open">0</div>
          <div class="stat-label">Belum Diproses</div>
          <div class="stat-change change-down">● Masih open</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(6,182,212,0.15);color:#22d3ee">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value" id="ctr-petugas">0</div>
          <div class="stat-label">${ScopedData.isFiltered ? 'Petugas Wilayah' : 'Total Petugas'}</div>
          <div class="stat-change change-up">↑ ${ScopedData.isFiltered ? 'Sesuai alokasi' : '6 PML + 46 PPL'}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(139,92,246,0.15);color:#a78bfa">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value">${totalUMKM.toLocaleString('id-ID')}</div>
          <div class="stat-label">Total UMKM</div>
          <div class="stat-change change-up">↑ Dari alokasi SLS</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(236,72,153,0.15);color:#f472b6">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value">${totalSLS}</div>
          <div class="stat-label">Total SLS</div>
          <div class="stat-change change-up">↑ ${ScopedData.isFiltered ? 'Wilayah tugas' : '14 Desa/Kelurahan'}</div>
        </div>
      </div>
    </div>

    <!-- ROW: Progress Chart + Status Donut -->
    <div class="grid-2" style="margin-bottom:20px">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Progress per Desa</div>
            <div class="card-sub">Persentase listing diproses vs total</div>
          </div>
        </div>
        <div class="desa-progress-list" id="desaProgressList"></div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Status Pendataan</div>
            <div class="card-sub">Distribusi status seluruh listing</div>
          </div>
        </div>
        <div class="donut-wrap">
          <svg viewBox="0 0 120 120" width="120" height="120" style="flex-shrink:0">
            ${buildDonut([
              { val: open, color: '#64748b' },
              { val: submitted, color: '#f59e0b' },
              { val: draft, color: '#6366f1' },
              { val: approved, color: '#10b981' },
              { val: rejected, color: '#ef4444' },
              { val: revoked, color: '#8b5cf6' },
            ], total)}
          </svg>
          <div class="donut-legend">
            ${[
              {label:'Open', val:open, color:'#64748b'},
              {label:'Submitted', val:submitted, color:'#f59e0b'},
              {label:'Draft', val:draft, color:'#6366f1'},
              {label:'Approved', val:approved, color:'#10b981'},
              {label:'Rejected', val:rejected, color:'#ef4444'},
              {label:'Revoked', val:revoked, color:'#8b5cf6'},
            ].map(l => `
              <div class="legend-item">
                <span class="legend-dot" style="background:${l.color}"></span>
                <span>${l.label}</span>
                <span class="legend-val">${l.val.toLocaleString('id-ID')}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- ROW: PML Summary Table (Admin only - not for PPL or PML) -->
    ${CurrentUser?.role === 'admin' ? `
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div>
          <div class="card-title">Rekapitulasi per PML</div>
          <div class="card-sub">Beban tugas 6 Pemeriksa Lapangan Sensus</div>
        </div>
        <button class="btn-sm btn-ghost-sm" onclick="navigateTo('alokasi')">Lihat Detail →</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>Nama PML</th><th>Jumlah PPL</th><th>Total SLS</th><th>Total UMKM</th><th>Total FASIH</th><th>Aksi</th>
          </tr></thead>
          <tbody id="pmlSummaryBody"></tbody>
        </table>
      </div>
    </div>
    ` : ''}

    <!-- ROW: Recent Activity -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Aktivitas Terbaru</div>
          <div class="card-sub">Listing yang sudah diproses</div>
        </div>
        <button class="btn-sm btn-ghost-sm" onclick="navigateTo('progres')">Lihat Semua →</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Desa</th><th>SLS</th><th>Nama</th><th>Skala</th><th>Status</th><th>Petugas</th>
          </tr></thead>
          <tbody id="recentBody"></tbody>
        </table>
      </div>
    </div>
  `;

  // Animate counters
  animateValue('ctr-total', total);
  animateValue('ctr-selesai', selesai);
  animateValue('ctr-open', open);
  animateValue('ctr-petugas', ScopedData.biodata.length);

  // Desa progress list
  const desaProgressEl = document.getElementById('desaProgressList');
  desaProgressEl.innerHTML = desaList.map(([ desa, d ], i) => {
    const pct = ((d.selesai / d.total)*100).toFixed(1);
    return `
      <div class="desa-item">
        <div class="desa-header">
          <span class="desa-name">${desa}</span>
          <span class="desa-counts">${d.selesai}/${d.total} <span style="color:var(--text-dim)">(${pct}%)</span></span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:0%;background:${COLORS[i%COLORS.length]}" data-w="${pct}"></div>
        </div>
      </div>`;
  }).join('');

  // Animate progress bars
  setTimeout(() => {
    document.querySelectorAll('.progress-fill[data-w]').forEach(el => {
      el.style.width = el.dataset.w + '%';
    });
  }, 100);

  // PML summary (Admin only)
  if (CurrentUser?.role === 'admin') {
    const pmlList = ScopedData.biodata.filter(b => b.posisi?.includes('PML'));
    const pmlBody = document.getElementById('pmlSummaryBody');
    if (pmlBody) {
      pmlBody.innerHTML = pmlList.length ? pmlList.map((pml, i) => {
    const ppls = AppData.pml_map[pml.nama] || [];
    const pmlAlok = ScopedData.alokasi.filter(a => a.pml === pml.nama);
    const umkm = pmlAlok.reduce((s,a)=>s+(a.umkm||0),0);
    const fasih = pmlAlok.reduce((s,a)=>s+(a.fasih||0),0);
    return `<tr>
      <td><span class="badge badge-primary">${i+1}</span></td>
      <td class="td-primary">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:32px;height:32px;border-radius:8px;background:${COLORS[i%COLORS.length]};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;flex-shrink:0">${pml.nama[0]}</div>
          <div>
            <div>${pml.nama}</div>
            <div style="font-size:11px;color:var(--text-dim);font-weight:400">${pml.email||''}</div>
          </div>
        </div>
      </td>
      <td><span class="badge badge-info">${ppls.length}</span></td>
      <td><strong>${pmlAlok.length}</strong></td>
      <td><span class="badge badge-warning">${umkm.toLocaleString('id-ID')}</span></td>
      <td>${fasih.toLocaleString('id-ID')}</td>
      <td><button class="btn-sm btn-ghost-sm" onclick="showPMLDetail('${pml.nama.replace(/'/g,"\\'")}')">Detail</button></td>
      </tr>`;
      }).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:20px">Tidak ada data PML di wilayah ini</td></tr>';
    }
  }

  // Recent activity: non-open first (scoped)
  const nonOpen = ScopedData.progres.filter(r => r.status !== 'open').slice(0, 20);
  const recentBody = document.getElementById('recentBody');
  recentBody.innerHTML = nonOpen.map(r => `
    <tr>
      <td class="td-primary">${r.desa}</td>
      <td style="font-size:11px;color:var(--text-dim)">${r.nama_sls?.substring(0,30)||'-'}</td>
      <td>${r.nama_usaha?.substring(0,25)||'-'}</td>
      <td><span class="badge badge-info">${r.skala_usaha?.split('/')[0]?.trim()||'-'}</span></td>
      <td>${getStatusBadge(r.status)}</td>
      <td style="font-size:11px;color:var(--text-dim)">${formatPetugas(r.petugas)}</td>
    </tr>
  `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-dim)">Belum ada aktivitas</td></tr>';
}

// ====================================================
// PROGRES LAPANGAN PAGE
// ====================================================
let ProgresState = { page: 1, perPage: 50, filtered: [], search: '', desa: '', status: '', skala: '' };

function renderProgres() {
  const desas   = [...new Set(ScopedData.progres.map(r => r.desa))].sort();
  const statuses = [...new Set(ScopedData.progres.map(r => r.status))].sort();
  const skalas  = [...new Set(ScopedData.progres.map(r => r.skala_usaha?.split('/')[0]?.trim()||'-'))].filter(s=>s&&s!=='-').sort();

  document.getElementById('pageContent').innerHTML = `
    ${getScopeBanner()}
    <!-- Status pills -->
    <div class="stats-grid" style="margin-bottom:20px">
      ${[
        {label:'Total',      val:ScopedData.progres.length, color:'#6366f1', status:''},
        {label:'Open',       val:ScopedData.progres.filter(r=>r.status==='open').length, color:'#64748b', status:'open'},
        {label:'Draft',      val:ScopedData.progres.filter(r=>r.status==='draft').length, color:'#6366f1', status:'draft'},
        {label:'Submitted',  val:ScopedData.progres.filter(r=>r.status==='submitted by pencacah').length, color:'#f59e0b', status:'submitted by pencacah'},
        {label:'Approved',   val:ScopedData.progres.filter(r=>r.status==='approved by pengawas').length, color:'#10b981', status:'approved by pengawas'},
        {label:'Rejected',   val:ScopedData.progres.filter(r=>r.status==='rejected by pengawas').length, color:'#ef4444', status:'rejected by pengawas'},
      ].map(s => `
        <div class="stat-card" style="cursor:pointer" onclick="filterProgresStatus('${s.status}')">
          <div class="stat-icon" style="background:${s.color}20;color:${s.color}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
          </div>
          <div class="stat-info">
            <div class="stat-value" style="font-size:22px">${s.val.toLocaleString('id-ID')}</div>
            <div class="stat-label">${s.label}</div>
          </div>
        </div>`).join('')}
    </div>

    <div class="card">
      <div class="card-header">
        <div><div class="card-title">Data Progres Lapangan</div><div class="card-sub" id="progresSubLabel">Menampilkan semua data</div></div>
        ${CurrentUser?.role === 'admin' ? `
        <button class="btn-sm btn-ghost-sm" onclick="exportProgresCSV()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV
        </button>` : ''}
      </div>
      <div class="search-filter-row">
        <div class="search-wrap">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="search-input" id="progresSearch" placeholder="Cari nama, alamat, NIB..." oninput="applyProgresFilter()" />
        </div>
        <select class="filter-select" id="progresDesa" onchange="applyProgresFilter()">
          <option value="">Semua Desa</option>
          ${desas.map(d=>`<option value="${d}">${d}</option>`).join('')}
        </select>
        <select class="filter-select" id="progresStatus" onchange="applyProgresFilter()">
          <option value="">Semua Status</option>
          ${statuses.map(s=>`<option value="${s}">${getStatusLabel(s)}</option>`).join('')}
        </select>
        <select class="filter-select" id="progresSkala" onchange="applyProgresFilter()">
          <option value="">Semua Skala</option>
          ${skalas.map(s=>`<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>Desa</th><th>SLS</th><th>Nama</th><th>Alamat</th><th>Skala</th><th>Status</th><th>Petugas</th><th>Aksi</th>
          </tr></thead>
          <tbody id="progresBody"></tbody>
        </table>
      </div>
      <div class="pagination" id="progresPagination"></div>
    </div>
  `;

  applyProgresFilter();
}

function filterProgresStatus(status) {
  document.getElementById('progresStatus').value = status;
  applyProgresFilter();
}

function applyProgresFilter() {
  const search = document.getElementById('progresSearch')?.value.toLowerCase() || '';
  const desa   = document.getElementById('progresDesa')?.value || '';
  const status = document.getElementById('progresStatus')?.value || '';
  const skala  = document.getElementById('progresSkala')?.value || '';

  ProgresState.filtered = ScopedData.progres.filter(r => {
    const matchSearch = !search || [r.nama_usaha, r.alamat, r.nib, r.kode_identitas, r.nama_sls].some(v => v?.toLowerCase().includes(search));
    const matchDesa   = !desa   || r.desa === desa;
    const matchStatus = !status || r.status === status;
    const matchSkala  = !skala  || r.skala_usaha?.split('/')[0]?.trim() === skala;
    return matchSearch && matchDesa && matchStatus && matchSkala;
  });

  ProgresState.page = 1;
  const scopeTotal = ScopedData.progres.length;
  document.getElementById('progresSubLabel').textContent =
    `Menampilkan ${ProgresState.filtered.length.toLocaleString('id-ID')} dari ${scopeTotal.toLocaleString('id-ID')} data${ScopedData.isFiltered?' (wilayah tugas Anda)':''}`;
  renderProgresTable();
}

function renderProgresTable() {
  const { page, perPage, filtered } = ProgresState;
  const start = (page-1)*perPage;
  const slice = filtered.slice(start, start+perPage);

  document.getElementById('progresBody').innerHTML = slice.length ? slice.map((r, i) => `
    <tr>
      <td style="color:var(--text-dim)">${(start+i+1).toLocaleString('id-ID')}</td>
      <td class="td-primary">${r.desa}</td>
      <td style="font-size:11px;color:var(--text-dim);max-width:140px">${r.nama_sls?.substring(0,35)||'-'}</td>
      <td style="max-width:160px">${r.nama_usaha?.substring(0,30)||'-'}</td>
      <td style="font-size:11px;color:var(--text-dim);max-width:160px">${r.alamat?.substring(0,30)||'-'}</td>
      <td>${getSkalaChip(r.skala_usaha)}</td>
      <td>${getStatusBadge(r.status)}</td>
      <td style="font-size:11px;color:var(--text-dim)">${formatPetugas(r.petugas)}</td>
      <td><button class="btn-sm btn-ghost-sm" style="padding:6px 10px" onclick="showProgresDetail(${start+i})">Detail</button></td>
    </tr>
  `).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--text-dim);padding:32px">Tidak ada data yang cocok</td></tr>';

  renderPagination('progresPagination', page, Math.ceil(filtered.length/perPage), p => {
    ProgresState.page = p;
    renderProgresTable();
  });
}

function showProgresDetail(idx) {
  const r = ProgresState.filtered[idx];
  if (!r) return;
  openModal(`
    <div class="modal-title">Detail Listing</div>
    <div class="modal-section">
      <div class="modal-section-title">Identitas</div>
      ${modalRow('Kode Identitas', r.kode_identitas)}
      ${modalRow('Nama', r.nama_usaha)}
      ${modalRow('Alamat', r.alamat)}
      ${modalRow('Desa', r.desa)}
      ${modalRow('SLS', r.nama_sls)}
      ${modalRow('NIB', r.nib||'-')}
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Usaha & Pendataan</div>
      ${modalRow('Skala Usaha', r.skala_usaha)}
      ${modalRow('Jumlah Usaha', r.jumlah_usaha||'-')}
      ${modalRow('Mode', r.mode)}
      ${modalRow('Status', getStatusBadge(r.status))}
      ${modalRow('Petugas', formatPetugas(r.petugas))}
      ${modalRow('Keterangan', r.keterangan||'-')}
    </div>
  `);
}

// ====================================================
// BIODATA PETUGAS PAGE
// ====================================================
let BiodataState = { page: 1, perPage: 20, filtered: [], search: '', posisi: '' };

function renderBiodata() {
  const scopedPML = ScopedData.biodata.filter(b=>b.posisi?.includes('PML'));
  const scopedPPL = ScopedData.biodata.filter(b=>b.posisi?.includes('PPL'));
  const isAdmin = CurrentUser?.role === 'admin';

  document.getElementById('pageContent').innerHTML = `
    ${getScopeBanner()}
    <!-- Stats -->
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(99,102,241,0.15);color:#818cf8">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        </div>
        <div class="stat-info"><div class="stat-value">${ScopedData.biodata.length}</div><div class="stat-label">${ScopedData.isFiltered?'Petugas Wilayah':'Total Petugas'}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(16,185,129,0.15);color:#4ade80">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
        </div>
        <div class="stat-info"><div class="stat-value">${scopedPML.length}</div><div class="stat-label">PML Aktif</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(245,158,11,0.15);color:#fbbf24">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="stat-info"><div class="stat-value">${scopedPPL.length}</div><div class="stat-label">${ScopedData.isFiltered?'PPL Wilayah':'PPL Aktif'}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(6,182,212,0.15);color:#22d3ee">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
        </div>
        <div class="stat-info"><div class="stat-value">${ScopedData.biodata.filter(b=>b.punya_hp_android==='Ya').length}</div><div class="stat-label">Punya HP Android</div></div>
      </div>
    </div>

    ${isAdmin ? `
    <!-- Admin Actions -->
    <div class="card" style="margin-bottom:20px;background:linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.08));border:1px solid rgba(99,102,241,0.2)">
      <div class="card-header">
        <div>
          <div class="card-title">Menu Administrator</div>
          <div class="card-sub">Kelola data petugas</div>
        </div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn-sm btn-primary-sm" onclick="downloadBiodataCSV(ScopedData.biodata)" style="display:flex;align-items:center;gap:6px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download CSV
        </button>
        <button class="btn-sm btn-secondary-sm" onclick="downloadBiodataTXT(ScopedData.biodata)" style="display:flex;align-items:center;gap:6px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Download TXT
        </button>
        <button class="btn-sm btn-secondary-sm" onclick="showEditPhoneModal()" style="display:flex;align-items:center;gap:6px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit No. HP
        </button>
      </div>
    </div>
    ` : ''}

    <!-- PML Section -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div>
          <div class="card-title">Pemeriksa Lapangan (PML)</div>
          <div class="card-sub">${ScopedData.isFiltered ? 'PML di wilayah tugas Anda' : '6 PML beserta PPL di bawah pengawasannya'}</div>
        </div>
      </div>
      <div class="pml-grid" id="pmlGrid"></div>
    </div>

    <!-- PPL Table -->
    <div class="card">
      <div class="card-header">
        <div><div class="card-title">Daftar Seluruh Petugas</div><div class="card-sub" id="biodataSubLabel">Semua petugas</div></div>
      </div>
      <div class="search-filter-row">
        <div class="search-wrap">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="search-input" id="biodataSearch" placeholder="Cari nama, email, telp..." oninput="applyBiodataFilter()" />
        </div>
        <select class="filter-select" id="biodataPosisi" onchange="applyBiodataFilter()">
          <option value="">Semua Posisi</option>
          <option value="PML">PML</option>
          <option value="PPL">PPL</option>
        </select>
      </div>
      <div class="petugas-grid" id="petugasGrid"></div>
      <div class="pagination" id="biodataPagination"></div>
    </div>
  `;

  // Render PML cards (scoped)
  const pmls = ScopedData.biodata.filter(b => b.posisi?.includes('PML'));
  pmls.sort((a, b) => a.nama.localeCompare(b.nama));
  document.getElementById('pmlGrid').innerHTML = pmls.length ? pmls.map((pml, i) => {
    const ppls = ScopedData.pml_map[pml.nama] || [];
    const pmlAlok = ScopedData.alokasi.filter(a => a.pml === pml.nama);
    const umkm = pmlAlok.reduce((s,a)=>s+(a.umkm||0),0);
    return `
      <div class="pml-card" onclick="showBiodataDetail('${pml.email?.replace(/'/g,"\\'") || pml.nama.replace(/'/g,"\\'")}')">
        <div class="pml-card-header">
          <div class="pml-avatar" style="background:${COLORS[i%COLORS.length]}">${pml.nama[0]}</div>
          <div>
            <div class="pml-name">${pml.nama}</div>
            <div class="pml-email">${pml.email||'-'}</div>
            <span class="badge badge-primary" style="margin-top:4px">PML</span>
          </div>
        </div>
        <div class="pml-stats-row">
          <div class="pml-stat-item"><div class="pml-stat-val">${ppls.length}</div><div class="pml-stat-lbl">PPL</div></div>
          <div class="pml-stat-item"><div class="pml-stat-val">${pmlAlok.length}</div><div class="pml-stat-lbl">SLS</div></div>
          <div class="pml-stat-item"><div class="pml-stat-val">${umkm}</div><div class="pml-stat-lbl">UMKM</div></div>
          <div class="pml-stat-item"><div class="pml-stat-val">${pml.jenis_kelamin==='Pr'?'♀':'♂'}</div><div class="pml-stat-lbl">Gender</div></div>
        </div>
      </div>`;
  }).join('') : `<div style="grid-column:1/-1;padding:20px;color:var(--text-dim);text-align:center">Tidak ada PML di wilayah ini</div>`;

  BiodataState.filtered = ScopedData.biodata;
  applyBiodataFilter();
}

function applyBiodataFilter() {
  const search = document.getElementById('biodataSearch')?.value.toLowerCase() || '';
  const posisi = document.getElementById('biodataPosisi')?.value || '';
  BiodataState.filtered = ScopedData.biodata.filter(p => {
    const matchSearch = !search || [p.nama, p.email, p.no_telp, p.sobat_id].some(v => v?.toLowerCase().includes(search));
    const matchPosisi = !posisi || p.posisi?.includes(posisi);
    return matchSearch && matchPosisi;
  });

  // Sort PML first, then PPL. Within each role, sort alphabetically.
  BiodataState.filtered.sort((a, b) => {
    const aIsPml = a.posisi?.includes('PML') || a.posisi?.includes('Pemeriksa') ? 1 : 0;
    const bIsPml = b.posisi?.includes('PML') || b.posisi?.includes('Pemeriksa') ? 1 : 0;
    if (aIsPml !== bIsPml) return bIsPml - aIsPml;
    return a.nama.localeCompare(b.nama);
  });

  BiodataState.page = 1;
  document.getElementById('biodataSubLabel').textContent =
    `${BiodataState.filtered.length} dari ${ScopedData.biodata.length} petugas${ScopedData.isFiltered?' (wilayah tugas Anda)':''}`;
  renderPetugasGrid();
}

function renderPetugasGrid() {
  const { page, perPage, filtered } = BiodataState;
  const start = (page-1)*perPage;
  const slice = filtered.slice(start, start+perPage);
  const isPML = p => p.posisi?.includes('PML');

  document.getElementById('petugasGrid').innerHTML = slice.map((p, i) => {
    const color = COLORS[(start+i)%COLORS.length];
    const ppls = p._ppls || [];
    return `
      <div class="petugas-card" onclick="showBiodataDetail('${(p.email||p.nama).replace(/'/g,"\\'")}')">
        <div class="petugas-card-header">
          <div class="petugas-avatar" style="background:${color}">${p.nama[0]}</div>
          <div>
            <div class="petugas-name">${p.nama}</div>
            <div class="petugas-pos">${isPML(p)?'PML – Pemeriksa Lapangan':'PPL – Pencacah Lapangan'}</div>
            <span class="badge ${isPML(p)?'badge-primary':'badge-info'}" style="margin-top:4px">${isPML(p)?'PML':'PPL'}</span>
          </div>
        </div>
        <div class="petugas-info-row">
          <div class="petugas-info-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
            ${p.email||'-'}
          </div>
          <div class="petugas-info-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.7h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.42 17z"/></svg>
            ${p.no_telp||'-'}
          </div>
          <div class="petugas-info-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${p.alamat_desa||'-'}
          </div>
          ${isPML(p) ? `<div class="petugas-info-item" style="color:var(--primary-light)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Membawahi ${ppls.length} PPL
          </div>` : `<div class="petugas-info-item" style="opacity: 0; pointer-events: none;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/></svg>
            -
          </div>`}
        </div>
      </div>`;
  }).join('') || '<div style="grid-column:1/-1;text-align:center;color:var(--text-dim);padding:40px">Tidak ada data</div>';

  renderPagination('biodataPagination', page, Math.ceil(filtered.length/perPage), p => {
    BiodataState.page = p;
    renderPetugasGrid();
  });
}

function showBiodataDetail(emailOrNama) {
  const p = AppData.biodata.find(b => b.email === emailOrNama || b.nama === emailOrNama || b.nama.replace(/'/g,"\\'") === emailOrNama);
  if (!p) return;
  const isPML = p.posisi?.includes('PML');
  const ppls = p._ppls || [];
  const alok = AppData.alokasi.filter(a => isPML ? a.pml === p.nama : a.email_pencacah?.toLowerCase() === p.email?.toLowerCase());
  const pmlName = isPML ? null : AppData.alokasi.find(a => a.email_pencacah?.toLowerCase() === p.email?.toLowerCase())?.pml;

  openModal(`
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
      <div style="width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:800">${p.nama[0]}</div>
      <div>
        <div class="modal-title" style="margin-bottom:4px">${p.nama}</div>
        <span class="badge ${isPML?'badge-primary':'badge-info'}">${isPML?'PML – Pemeriksa Lapangan':'PPL – Pencacah Lapangan'}</span>
      </div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Data Pribadi</div>
      ${modalRow('TTL', p.ttl||'-')}
      ${modalRow('Umur', p.umur ? p.umur+' tahun' : '-')}
      ${modalRow('Jenis Kelamin', p.jenis_kelamin==='Pr'?'Perempuan':'Laki-laki')}
      ${modalRow('Pendidikan', p.pendidikan||'-')}
      ${modalRow('Pekerjaan', p.pekerjaan||'-')}
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Kontak</div>
      ${modalRow('No. Telp', p.no_telp||'-')}
      ${modalRow('Email', p.email||'-')}
      ${modalRow('SOBAT ID', p.sobat_id||'-')}
      ${modalRow('Alamat Desa', p.alamat_desa||'-')}
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Kompetensi & Peralatan</div>
      ${modalRow('Punya Kendaraan', p.punya_kendaraan||'-')}
      ${modalRow('Bisa Motor', p.bisa_motor||'-')}
      ${modalRow('HP Android', p.punya_hp_android||'-')}
      ${modalRow('Merk/Tipe HP', (p.merk_hp||'-')+' '+(p.tipe_hp||''))}
      ${modalRow('Berpengalaman CAPI', p.berpengalaman_capi||'-')}
      ${modalRow('Pernah SE', p.pernah_se||'-')}
      ${modalRow('Status NIK', p.status_nik||'-')}
    </div>
    ${isPML ? `
    <div class="modal-section">
      <div class="modal-section-title">PPL di Bawah Pengawasan (${ppls.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${ppls.map(n => `<span class="badge badge-info">${n}</span>`).join('')}
      </div>
    </div>` : `
    <div class="modal-section">
      <div class="modal-section-title">Pengawas (PML)</div>
      ${modalRow('PML', pmlName||'-')}
    </div>`}
    <div class="modal-section">
      <div class="modal-section-title">Alokasi SLS (${alok.length} SLS)</div>
      <div style="max-height:160px;overflow-y:auto">
        ${alok.slice(0,20).map(a=>`<div style="font-size:12px;padding:6px 0;border-bottom:1px solid var(--border);color:var(--text-muted)">${a.nmdes} – ${a.nmsls} <span class="badge badge-muted">UMKM:${a.umkm}</span></div>`).join('')}
        ${alok.length>20?`<div style="font-size:11px;color:var(--text-dim);padding-top:6px">...dan ${alok.length-20} SLS lainnya</div>`:''}
      </div>
    </div>
  `);
}

// ====================================================
// ALOKASI PETUGAS PAGE
// ====================================================
let AlokasiState = { page: 1, perPage: 50, filtered: [], search: '', desa: '', pml: '', ppl: '' };

function renderAlokasi() {
  const desas = [...new Set(ScopedData.alokasi.map(a=>a.nmdes))].sort();
  const pmls  = [...new Set(ScopedData.alokasi.map(a=>a.pml))].sort();
  const ppls  = [...new Set(ScopedData.alokasi.map(a=>a.ppl))].sort();

  document.getElementById('pageContent').innerHTML = `
    ${getScopeBanner()}
    <!-- Stats -->
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(99,102,241,0.15);color:#818cf8">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div class="stat-info"><div class="stat-value">${ScopedData.alokasi.length}</div><div class="stat-label">${ScopedData.isFiltered?'SLS Wilayah':'Total SLS'}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(16,185,129,0.15);color:#4ade80">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        </div>
        <div class="stat-info"><div class="stat-value">${desas.length}</div><div class="stat-label">Desa / Kelurahan</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(245,158,11,0.15);color:#fbbf24">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        </div>
        <div class="stat-info"><div class="stat-value">${ScopedData.alokasi.reduce((s,a)=>s+(a.umkm||0),0).toLocaleString('id-ID')}</div><div class="stat-label">Total UMKM</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(6,182,212,0.15);color:#22d3ee">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
        </div>
        <div class="stat-info"><div class="stat-value">${ScopedData.alokasi.reduce((s,a)=>s+(a.fasih||0),0).toLocaleString('id-ID')}</div><div class="stat-label">Total FASIH</div></div>
      </div>
    </div>

    <!-- Relasi PML-PPL Visual -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div>
          <div class="card-title">Relasi PML – PPL</div>
          <div class="card-sub">${ScopedData.isFiltered ? 'Wilayah tugas Anda' : 'Struktur pengawasan 6 PML terhadap 46 PPL'}</div>
        </div>
      </div>
      <div id="relasiGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px"></div>
    </div>

    <!-- Alokasi Table -->
    <div class="card">
      <div class="card-header">
        <div><div class="card-title">Detail Alokasi SLS</div><div class="card-sub" id="alokasiSubLabel">Semua SLS</div></div>
      </div>
      <div class="search-filter-row">
        <div class="search-wrap">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="search-input" id="alokasiSearch" placeholder="Cari SLS, desa, nama petugas..." oninput="applyAlokasiFilter()" />
        </div>
        <select class="filter-select" id="alokasiDesa" onchange="applyAlokasiFilter()">
          <option value="">Semua Desa</option>
          ${desas.map(d=>`<option value="${d}">${d}</option>`).join('')}
        </select>
        <select class="filter-select" id="alokasiPML" onchange="applyAlokasiFilter()">
          <option value="">Semua PML</option>
          ${pmls.map(p=>`<option value="${p}">${p}</option>`).join('')}
        </select>
        <select class="filter-select" id="alokasiPPL" onchange="applyAlokasiFilter()">
          <option value="">Semua PPL</option>
          ${ppls.map(p=>`<option value="${p}">${p}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>Desa</th><th>SLS</th><th>PML</th><th>PPL</th><th>UMKM</th><th>FASIH</th><th>Flag</th><th>Aksi</th>
          </tr></thead>
          <tbody id="alokasiBody"></tbody>
        </table>
      </div>
      <div class="pagination" id="alokasiPagination"></div>
    </div>
  `;

  // Render relasi PML-PPL (scoped)
  const pmlList = ScopedData.biodata.filter(b=>b.posisi?.includes('PML'));
  document.getElementById('relasiGrid').innerHTML = pmlList.length ? pmlList.map((pml,i) => {
    const ppls = AppData.pml_map[pml.nama] || [];
    const pmlAlok = ScopedData.alokasi.filter(a=>a.pml===pml.nama);
    return `
      <div class="pml-card" onclick="filterByPML('${pml.nama.replace(/'/g,"\\'")}")">
        <div class="pml-card-header">
          <div class="pml-avatar" style="background:${COLORS[i%COLORS.length]}">${pml.nama[0]}</div>
          <div>
            <div class="pml-name">${pml.nama}</div>
            <div class="pml-email">${pml.email||''}</div>
            <span class="badge badge-primary" style="margin-top:4px">PML</span>
          </div>
        </div>
        <div class="pml-stats-row" style="margin-bottom:10px">
          <div class="pml-stat-item"><div class="pml-stat-val">${ppls.length}</div><div class="pml-stat-lbl">PPL</div></div>
          <div class="pml-stat-item"><div class="pml-stat-val">${pmlAlok.length}</div><div class="pml-stat-lbl">SLS</div></div>
          <div class="pml-stat-item"><div class="pml-stat-val">${pmlAlok.reduce((s,a)=>s+(a.umkm||0),0)}</div><div class="pml-stat-lbl">UMKM</div></div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
          ${ppls.map(n=>`<span class="badge badge-muted" style="font-size:10px;line-height:1.2;padding:4px 8px">${n}</span>`).join('')}
        </div>
      </div>`;
  }).join('') : `<div style="grid-column:1/-1;padding:20px;color:var(--text-dim);text-align:center">Tidak ada data relasi</div>`;

  AlokasiState.filtered = ScopedData.alokasi;
  applyAlokasiFilter();
}

function filterByPML(pml) {
  document.getElementById('alokasiPML').value = pml;
  applyAlokasiFilter();
}

function applyAlokasiFilter() {
  const search = document.getElementById('alokasiSearch')?.value.toLowerCase()||'';
  const desa = document.getElementById('alokasiDesa')?.value||'';
  const pml  = document.getElementById('alokasiPML')?.value||'';
  const ppl  = document.getElementById('alokasiPPL')?.value||'';
  AlokasiState.filtered = ScopedData.alokasi.filter(a => {
    const ms = !search || [a.nmsls, a.nmdes, a.pml, a.ppl, a.idsubsls].some(v=>v?.toLowerCase().includes(search));
    return ms && (!desa||a.nmdes===desa) && (!pml||a.pml===pml) && (!ppl||a.ppl===ppl);
  });
  AlokasiState.page = 1;
  document.getElementById('alokasiSubLabel').textContent =
    `${AlokasiState.filtered.length} dari ${ScopedData.alokasi.length} SLS${ScopedData.isFiltered?' (wilayah tugas Anda)':''}`;
  renderAlokasiTable();
}

function renderAlokasiTable() {
  const { page, perPage, filtered } = AlokasiState;
  const start = (page-1)*perPage;
  const slice = filtered.slice(start, start+perPage);

  document.getElementById('alokasiBody').innerHTML = slice.length ? slice.map((a,i) => `
    <tr>
      <td style="color:var(--text-dim)">${start+i+1}</td>
      <td class="td-primary">${a.nmdes||'-'}</td>
      <td style="font-size:12px;color:var(--text-muted)">${a.nmsls?.substring(0,35)||'-'}</td>
      <td>
        <span class="badge badge-primary">${(a.pml||'-').split(' ')[0]}</span>
      </td>
      <td style="font-size:12px">
        <span class="badge badge-info">${(a.ppl||'-').split(' ')[0]}</span>
      </td>
      <td><span class="badge ${a.umkm>0?'badge-warning':'badge-muted'}">${a.umkm||0}</span></td>
      <td>${(a.fasih||0).toLocaleString('id-ID')}</td>
      <td>${a.flag_perubahan?'<span class="badge badge-danger">Ubah</span>':'<span class="badge badge-muted">-</span>'}</td>
      <td>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn-sm btn-ghost-sm" style="padding:6px 10px" onclick="showAlokasiDetail(${start+i})">Detail</button>
          ${CurrentUser?.role === 'ppl' ? `
            <button class="btn-sm ${localStorage.getItem('active-sls-' + CurrentUser.email?.toLowerCase()) === a.idsubsls ? 'btn-primary-sm' : 'btn-ghost-sm'}" 
              style="padding:6px 10px; font-size:11px; ${localStorage.getItem('active-sls-' + CurrentUser.email?.toLowerCase()) === a.idsubsls ? 'background:#10b981;box-shadow:none;border-color:#10b981;' : ''}" 
              onclick="toggleActiveSLS('${a.idsubsls}', event)">
              ${localStorage.getItem('active-sls-' + CurrentUser.email?.toLowerCase()) === a.idsubsls ? '✓ Aktif' : 'Set Aktif'}
            </button>

          ` : ''}
        </div>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--text-dim);padding:32px">Tidak ada data</td></tr>';

  renderPagination('alokasiPagination', page, Math.ceil(filtered.length/perPage), p => {
    AlokasiState.page = p;
    renderAlokasiTable();
  });
}

function showAlokasiDetail(idx) {
  const a = AlokasiState.filtered[idx];
  if (!a) return;
  // Find PPL biodata
  const pplBio = AppData.biodata.find(b => b.nama === a.ppl || b.email?.toLowerCase() === a.email_pencacah?.toLowerCase());
  const pmlBio = AppData.biodata.find(b => b.nama === a.pml || b.email?.toLowerCase() === a.email_pengawas?.toLowerCase());
  // Progres on this SLS
  const slsProg = AppData.progres.filter(r => r.kode_sls === a.kdsls && r.kode_desa === a.kddesa);
  const done = slsProg.filter(r => r.status !== 'open').length;

  openModal(`
    <div class="modal-title">Detail Alokasi SLS</div>
    <div class="modal-section">
      <div class="modal-section-title">Lokasi SLS</div>
      ${modalRow('Kode Identitas', a.idsubsls)}
      ${modalRow('Desa', a.nmdes)}
      ${modalRow('SLS', a.nmsls)}
      ${modalRow('Kode Desa', a.kddesa)}
      ${modalRow('Kode SLS', a.kdsls)}
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Petugas</div>
      ${modalRow('PML (Pengawas)', `<span class="badge badge-primary">${a.pml||'-'}</span> <span style="font-size:11px;color:var(--text-dim)">${pmlBio?.no_telp||''}</span>`)}
      ${modalRow('PPL (Pencacah)', `<span class="badge badge-info">${a.ppl||'-'}</span> <span style="font-size:11px;color:var(--text-dim)">${pplBio?.no_telp||''}</span>`)}
      ${modalRow('Email PML', a.email_pengawas||'-')}
      ${modalRow('Email PPL', a.email_pencacah||'-')}
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Beban Tugas</div>
      ${modalRow('UMKM', a.umkm||0)}
      ${modalRow('FASIH (KK)', (a.fasih||0).toLocaleString('id-ID'))}
      ${modalRow('Flag Perubahan', a.flag_perubahan?'Ya':'Tidak')}
      ${modalRow('Flag SLS Open PBI', a.flag_sls_open?'Ya':'Tidak')}
      ${modalRow('KK Open PBI', a.kk_open||0)}
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Progres Pendataan (${done}/${slsProg.length})</div>
      <div class="progress-track" style="margin-bottom:12px">
        <div class="progress-fill" style="width:${slsProg.length?((done/slsProg.length)*100).toFixed(0):0}%"></div>
      </div>
      ${slsProg.slice(0,8).map(r=>`<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);color:var(--text-muted);display:flex;justify-content:space-between"><span>${r.nama_usaha?.substring(0,30)||'-'}</span>${getStatusBadge(r.status)}</div>`).join('')}
      ${slsProg.length>8?`<div style="font-size:11px;color:var(--text-dim);margin-top:6px">...dan ${slsProg.length-8} listing lainnya</div>`:''}
    </div>
  `);
}

// ====================================================
// HELPERS
// ====================================================
function getStatusLabel(status) {
  const map = {
    'open': 'Open',
    'draft': 'Draft',
    'submitted by pencacah': 'Submitted',
    'approved by pengawas': 'Approved',
    'rejected by pengawas': 'Rejected',
    'revoked by pengawas': 'Revoked',
  };
  return map[status] || status;
}
window.getStatusLabel = getStatusLabel;

function getStatusBadge(status) {
  const map = {
    'open': ['badge-muted','Open'],
    'draft': ['badge-primary','Draft'],
    'submitted by pencacah': ['badge-warning','Submitted'],
    'approved by pengawas': ['badge-success','Approved'],
    'rejected by pengawas': ['badge-danger','Rejected'],
    'revoked by pengawas': ['badge-info','Revoked'],
  };
  const [cls, label] = map[status] || ['badge-muted', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function getSkalaChip(skala) {
  if (!skala) return '-';
  const s = skala.split('/')[0]?.trim();
  if (s === 'UMK') return `<span class="badge badge-warning">UMK</span>`;
  if (s === 'UM' || s === 'UB') return `<span class="badge badge-success">${s}</span>`;
  if (s === 'KELUARGA') return `<span class="badge badge-muted">KEL</span>`;
  return `<span class="badge badge-info">${s}</span>`;
}

function formatPetugas(str) {
  if (!str) return '-';
  const email = str.replace('Pencacah', '').replace('Pengawas', '').trim().toLowerCase();
  const p = AppData.biodata.find(b => (b.email || '').toLowerCase() === email);
  if (p && p.nama) {
    return window.titleCase ? window.titleCase(p.nama) : p.nama;
  }
  const prefix = email.split('@')[0];
  return window.titleCase ? window.titleCase(prefix.replace(/[^a-zA-Z]/g, ' ')) : prefix;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function animateValue(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const duration = 1500;
  const start = Date.now();
  const tick = () => {
    const elapsed = Date.now() - start;
    const pct = Math.min(elapsed/duration, 1);
    const eased = 1 - Math.pow(1-pct, 3);
    el.textContent = Math.floor(eased * target).toLocaleString('id-ID');
    if (pct < 1) requestAnimationFrame(tick);
    else el.textContent = target.toLocaleString('id-ID');
  };
  tick();
}

function buildDonut(items, total) {
  const r = 50; const cx = 60; const cy = 60;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const paths = items.map(item => {
    const pct = item.val / total;
    const dash = pct * circ;
    const gap = circ - dash;
    const path = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${item.color}" stroke-width="16"
      stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" opacity="0.9"/>`;
    offset += dash;
    return path;
  });
  return paths.join('');
}

function modalRow(label, value) {
  return `<div class="modal-row"><span class="modal-row-label">${label}</span><span class="modal-row-value">${value||'-'}</span></div>`;
}

function renderPagination(containerId, current, total, onPage) {
  const el = document.getElementById(containerId);
  if (!el || total <= 1) { if(el) el.innerHTML=''; return; }
  const pages = [];
  if (current > 1) pages.push({ label: '←', page: current-1 });
  const start = Math.max(1, current-2); const end = Math.min(total, current+2);
  for (let p = start; p <= end; p++) pages.push({ label: p, page: p });
  if (current < total) pages.push({ label: '→', page: current+1 });

  el.innerHTML = `
    <span class="pagination-info">Halaman ${current} dari ${total}</span>
    <div class="pagination-btns">
      ${pages.map(p => `<button class="page-btn ${p.page===current&&p.label!==' ←'&&p.label!=='→'?'active':''}" onclick="(${onPage.toString()})(${p.page})">${p.label}</button>`).join('')}
    </div>`;
}

function openModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('show');
  // Animate progress bars inside modal
  setTimeout(() => {
    document.querySelectorAll('#modalContent .progress-fill[data-w]').forEach(el => {
      el.style.width = el.dataset.w + '%';
    });
    document.querySelectorAll('#modalContent .progress-fill').forEach(el => {
      if (!el.dataset.w) el.style.transition = 'width 0.8s ease';
    });
  }, 50);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

function showToast(msg, type='success') {
  const tc = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  tc.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ====================================================
// EDIT PHONE MODAL (Admin Only)
// ====================================================

function showEditPhoneModal() {
  const biodata = ScopedData.biodata;

  let tableRows = biodata.map(p => `
    <tr>
      <td>${p.nama || '-'}</td>
      <td>${p.posisi || '-'}</td>
      <td>${supabase.formatPhoneNumber(p.no_telp) || '-'}</td>
      <td>
        <button class="btn-xs btn-secondary-sm" onclick="showEditPhoneForm(${p.id}, '${(p.nama||'').replace(/'/g, "\\'")}', '${supabase.formatPhoneNumber(p.no_telp) || ''}')">
          Edit
        </button>
      </td>
    </tr>
  `).join('');

  document.getElementById('modalContent').innerHTML = `
    <h3 style="margin-bottom:16px">Edit Nomor HP Petugas</h3>
    <p style="color:var(--text-dim);margin-bottom:16px;font-size:13px">
      Format: 08xx (contoh: 081234567890)<br>
      Format +62 akan dikonversi otomatis.
    </p>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:var(--bg-2)">
            <th style="padding:10px;text-align:left">Nama</th>
            <th style="padding:10px;text-align:left">Posisi</th>
            <th style="padding:10px;text-align:left">No. HP</th>
            <th style="padding:10px;text-align:left">Aksi</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;
  document.getElementById('modalOverlay').classList.add('show');
}

function showEditPhoneForm(id, nama, teleponLama) {
  document.getElementById('modalContent').innerHTML = `
    <h3 style="margin-bottom:16px">Edit Nomor HP</h3>
    <p><strong>${nama}</strong></p>
    <p style="color:var(--text-dim);margin-bottom:16px;font-size:13px">
      No. HP Lama: ${teleponLama || '-'}<br>
      Format: 08xxxxxxxxxx
    </p>
    <div style="margin-bottom:16px">
      <label style="display:block;margin-bottom:6px;font-size:13px">Nomor HP Baru</label>
      <input type="text" id="editPhoneInput" class="search-input" placeholder="08xxxxxxxxxx" value="${teleponLama || ''}" />
    </div>
    <div style="display:flex;gap:12px">
      <button class="btn-sm btn-primary-sm" onclick="savePhoneNumber(${id})">
        Simpan
      </button>
      <button class="btn-sm btn-ghost-sm" onclick="showEditPhoneModal()">
        Batal
      </button>
    </div>
  `;
}

async function savePhoneNumber(id) {
  const teleponBaru = document.getElementById('editPhoneInput').value.trim();

  if (!teleponBaru) {
    showToast('⚠ Nomor HP tidak boleh kosong', 'error');
    return;
  }

  try {
    const result = await supabase.updateBiodataPhone(id, teleponBaru);

    if (result) {
      // Update local data
      const idx = AppData.biodata.findIndex(b => b.id === id);
      if (idx !== -1) {
        AppData.biodata[idx].no_telp = supabase.formatPhoneNumber(teleponBaru);
      }
      const scopedIdx = ScopedData.biodata.findIndex(b => b.id === id);
      if (scopedIdx !== -1) {
        ScopedData.biodata[scopedIdx].no_telp = supabase.formatPhoneNumber(teleponBaru);
      }

      showToast('✓ Nomor HP berhasil diupdate!');
      showEditPhoneModal(); // Refresh table
    } else {
      showToast('⚠ Gagal update nomor HP', 'error');
    }
  } catch(e) {
    showToast('⚠ Error: ' + e.message, 'error');
  }
}

// ====================================================
// PROFIL PAGE (For PML & PPL to edit their own profile)
// ====================================================

function renderProfil() {
  const user = CurrentUser;
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  // Find user's biodata
  const myData = AppData.biodata.find(b =>
    b.email?.toLowerCase() === user.email?.toLowerCase()
  );

  const isPML = myData?.posisi?.toUpperCase().includes('PML');

  document.getElementById('pageContent').innerHTML = `
    <div class="card" style="max-width:600px">
      <div class="card-header">
        <div>
          <div class="card-title">Profil Saya</div>
          <div class="card-sub">Edit informasi pribadi Anda</div>
        </div>
      </div>

      ${myData ? `
      <div style="padding:20px">
        <!-- Avatar -->
        <div style="text-align:center;margin-bottom:24px">
          <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;color:white;margin:0 auto 12px">
            ${(myData.nama || user.name || 'U')[0].toUpperCase()}
          </div>
          <div style="font-size:18px;font-weight:600">${myData.nama || user.name}</div>
          <div style="color:var(--text-muted);font-size:14px">${isPML ? 'PML - Pemeriksa Lapangan' : 'PPL - Pencacah Lapangan'}</div>
        </div>

        <!-- Info Fields -->
        <div style="display:grid;gap:16px">
          <div>
            <label style="display:block;font-size:12px;color:var(--text-dim);margin-bottom:6px">Nama Lengkap</label>
            <input type="text" id="profilNama" class="search-input" value="${myData.nama || ''}" placeholder="Nama lengkap" />
          </div>

          <div>
            <label style="display:block;font-size:12px;color:var(--text-dim);margin-bottom:6px">Email</label>
            <input type="email" id="profilEmail" class="search-input" value="${myData.email || ''}" placeholder="Email" readonly style="opacity:0.6" />
            <div style="font-size:11px;color:var(--text-dim);margin-top:4px">Email tidak dapat diubah</div>
          </div>

          <div>
            <label style="display:block;font-size:12px;color:var(--text-dim);margin-bottom:6px">Nomor HP</label>
            <div style="display:flex;gap:8px">
              <input type="text" id="profilTelepon" class="search-input" value="${supabase.formatPhoneNumber(myData.no_telp) || ''}" placeholder="08xxxxxxxxxx" style="flex:1" />
            </div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:4px">Format: 08xxxxxxxxxx</div>
          </div>

          <div>
            <label style="display:block;font-size:12px;color:var(--text-dim);margin-bottom:6px">Alamat</label>
            <input type="text" id="profilAlamat" class="search-input" value="${myData.alamat || ''}" placeholder="Alamat lengkap" />
          </div>

          <div>
            <label style="display:block;font-size:12px;color:var(--text-dim);margin-bottom:6px">Desa/Kelurahan</label>
            <input type="text" id="profilDesa" class="search-input" value="${myData.desa || ''}" placeholder="Desa/Kelurahan" />
          </div>
        </div>

        <!-- Save Button -->
        <div style="margin-top:24px">
          <button class="btn-sm btn-primary-sm" onclick="saveProfil(${myData.id})" style="width:100%">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>
            Simpan Perubahan
          </button>
        </div>
      </div>
      ` : `
      <div style="padding:40px;text-align:center;color:var(--text-dim)">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:16px;opacity:0.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <p>Data profil tidak ditemukan.</p>
        <p style="font-size:13px">Hubungi administrator jika ada masalah.</p>
      </div>
      `}
    </div>
  `;
}

async function saveProfil(id) {
  const nama = document.getElementById('profilNama').value.trim();
  const telepon = document.getElementById('profilTelepon').value.trim();
  const alamat = document.getElementById('profilAlamat').value.trim();
  const desa = document.getElementById('profilDesa').value.trim();

  if (!nama) {
    showToast('⚠ Nama tidak boleh kosong', 'error');
    return;
  }

  try {
    const data = {
      nama: nama,
      no_telp: supabase.formatPhoneNumber(telepon),
      alamat: alamat,
      desa: desa
    };

    const result = await supabase.updateBiodata(id, data);

    if (result) {
      // Update local data
      const idx = AppData.biodata.findIndex(b => b.id === id);
      if (idx !== -1) {
        AppData.biodata[idx] = { ...AppData.biodata[idx], ...data };
      }

      // Update session
      const userData = JSON.parse(sessionStorage.getItem('SIMON-SE26TEMPURAN-user') || '{}');
      if (userData) {
        userData.name = nama;
        sessionStorage.setItem('SIMON-SE26TEMPURAN-user', JSON.stringify(userData));
        localStorage.setItem('SIMON-SE26TEMPURAN-user', JSON.stringify(userData));
      }

      // Update UI
      const userNameEl = document.getElementById('userName');
      const userAvatarEl = document.getElementById('userAvatar');
      if (userNameEl) userNameEl.textContent = nama;
      if (userAvatarEl) userAvatarEl.textContent = (nama || 'U')[0].toUpperCase();

      showToast('✓ Profil berhasil disimpan!');
    } else {
      showToast('⚠ Gagal menyimpan profil', 'error');
    }
  } catch(e) {
    showToast('⚠ Error: ' + e.message, 'error');
  }
}

// PML Detail
function showPMLDetail(nama) {
  showBiodataDetail(nama);
}

// Export CSV
function exportProgresCSV() {
  const { filtered } = ProgresState;
  const headers = ['No','Desa','SLS','Nama','Alamat','Skala Usaha','Status','Petugas'];
  const rows = filtered.map((r,i) => [i+1,r.desa,r.nama_sls,r.nama_usaha,r.alamat,r.skala_usaha,r.status,formatPetugas(r.petugas)]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='progres_lapangan.csv'; a.click();
  showToast('✓ Data berhasil diexport!');
}

// ====================================================
// UI FUNCTIONS
// ====================================================
function updateUserInfo() {
  if (!CurrentUser) return;
  const name = CurrentUser.name || CurrentUser.email || 'User';
  const role = CurrentUser.role || 'user';
  const initial = name[0]?.toUpperCase() || 'U';
  document.getElementById('userName').textContent = name.split(' ').slice(0,2).join(' ');
  document.getElementById('userRole').textContent = role === 'admin' ? 'Administrator' : role === 'pml' ? 'PML' : 'PPL';
  document.getElementById('userAvatar').textContent = initial;

  // Dynamic admin sidebar links
  if (role === 'admin') {
    const nav = document.querySelector('.sidebar-nav');
    if (nav && !nav.querySelector('[data-page="users"]')) {
      const usersLink = document.createElement('a');
      usersLink.href = "#";
      usersLink.className = "nav-item";
      usersLink.setAttribute('data-page', 'users');
      usersLink.setAttribute('onclick', "navigateTo('users',event)");
      usersLink.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span>Manajemen User</span>
      `;
      
      const configLink = document.createElement('a');
      configLink.href = "#";
      configLink.className = "nav-item";
      configLink.setAttribute('data-page', 'config');
      configLink.setAttribute('onclick', "navigateTo('config',event)");
      configLink.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        <span>Konfigurasi</span>
      `;
      
      nav.appendChild(usersLink);
      nav.appendChild(configLink);
    }
  }
}

function updateClock() {
  const el = document.getElementById('topbarDatetime');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('id-ID', {weekday:'short',day:'numeric',month:'short'}) + ' ' + now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

function toggleTheme() {
  const isLight = document.body.classList.contains('light-mode');
  document.body.className = isLight ? 'dark-mode' : 'light-mode';
  localStorage.setItem('SIMON-SE26TEMPURAN-theme', isLight ? 'dark' : 'light');
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('show');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

document.getElementById('sidebarClose')?.addEventListener('click', closeSidebar);

function handleLogout() {
  sessionStorage.removeItem('SIMON-SE26TEMPURAN-user');
  localStorage.removeItem('SIMON-SE26TEMPURAN-user');
  window.location.href = 'index.html';
}

// ====================================================
// KONFIGURASI / UPLOAD PAGE
// ====================================================
function renderConfig() {
  if (CurrentUser?.role !== 'admin') {
    document.getElementById('pageContent').innerHTML = `<div style="padding:40px;text-align:center;color:var(--danger)">⚠ Akses ditolak. Hanya Administrator yang dapat mengakses halaman ini.</div>`;
    return;
  }

  document.getElementById('pageContent').innerHTML = `
    <!-- Link to Import Page -->
    <div class="card" style="margin-bottom:20px;background:linear-gradient(135deg, rgba(16,185,129,0.1), rgba(6,182,212,0.1));border:1px solid rgba(16,185,129,0.3)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px;flex-wrap:wrap;gap:16px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg, #10b981, #06b6d4);display:flex;align-items:center;justify-content:center;font-size:24px">📥</div>
          <div>
            <div style="font-size:16px;font-weight:700;color:var(--text)">Import Data dari CSV</div>
            <div style="font-size:13px;color:var(--text-muted)">Upload file CSV untuk import data ke database Supabase</div>
          </div>
        </div>
        <a href="import.html" target="_blank" class="btn-sm btn-primary-sm" style="text-decoration:none;padding:10px 20px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Buka Halaman Import
        </a>
      </div>
    </div>

    <div class="grid-3" style="margin-bottom:24px">
      <!-- Card 1: Progres Lapangan -->
      <div class="card" style="display:flex;flex-direction:column;justify-content:space-between;min-height:260px">
        <div>
          <div class="card-title" style="display:flex;align-items:center;gap:8px">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" stroke-width="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>
            Progres Lapangan (CSV)
          </div>
          <p class="card-sub" style="margin-top:8px;line-height:1.6">Unggah berkas <strong>Progres Lapangan.csv</strong> terbaru untuk memperbarui status progres pendataan.</p>
        </div>
        <div style="margin-top:16px">
          <input type="file" id="fileProgres" accept=".csv" style="display:none" onchange="updateFileLabel('fileProgres', 'lblProgres')" />
          <button class="btn-sm btn-ghost-sm" style="width:100%;justify-content:center;margin-bottom:8px" onclick="document.getElementById('fileProgres').click()">
            <span id="lblProgres">Pilih Berkas CSV</span>
          </button>
          <button class="btn-sm btn-primary-sm" style="width:100%;justify-content:center" onclick="uploadDataFile('progres', 'fileProgres')">Unggah & Sinkronkan</button>
        </div>
      </div>

      <!-- Card 2: Biodata Petugas -->
      <div class="card" style="display:flex;flex-direction:column;justify-content:space-between;min-height:260px">
        <div>
          <div class="card-title" style="display:flex;align-items:center;gap:8px">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            Biodata Petugas (XLSX)
          </div>
          <p class="card-sub" style="margin-top:8px;line-height:1.6">Unghah berkas <strong>Biodata Petugas.xlsx</strong> terbaru untuk memperbarui data biodata PML dan PPL.</p>
        </div>
        <div style="margin-top:16px">
          <input type="file" id="fileBiodata" accept=".xlsx" style="display:none" onchange="updateFileLabel('fileBiodata', 'lblBiodata')" />
          <button class="btn-sm btn-ghost-sm" style="width:100%;justify-content:center;margin-bottom:8px" onclick="document.getElementById('fileBiodata').click()">
            <span id="lblBiodata">Pilih Berkas Excel</span>
          </button>
          <button class="btn-sm btn-primary-sm" style="width:100%;justify-content:center" onclick="uploadDataFile('biodata', 'fileBiodata')">Unggah & Sinkronkan</button>
        </div>
      </div>

      <!-- Card 3: Alokasi Petugas -->
      <div class="card" style="display:flex;flex-direction:column;justify-content:space-between;min-height:260px">
        <div>
          <div class="card-title" style="display:flex;align-items:center;gap:8px">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Alokasi Petugas (XLSX)
          </div>
          <p class="card-sub" style="margin-top:8px;line-height:1.6">Unggah berkas <strong>Alokasi Petugas.xlsx</strong> terbaru untuk memperbarui wilayah tugas SLS.</p>
        </div>
        <div style="margin-top:16px">
          <input type="file" id="fileAlokasi" accept=".xlsx" style="display:none" onchange="updateFileLabel('fileAlokasi', 'lblAlokasi')" />
          <button class="btn-sm btn-ghost-sm" style="width:100%;justify-content:center;margin-bottom:8px" onclick="document.getElementById('fileAlokasi').click()">
            <span id="lblAlokasi">Pilih Berkas Excel</span>
          </button>
          <button class="btn-sm btn-primary-sm" style="width:100%;justify-content:center" onclick="uploadDataFile('alokasi', 'fileAlokasi')">Unggah & Sinkronkan</button>
        </div>
      </div>
    </div>

    <!-- Template Target Download (Admin) - Monitoring SLS Aktif -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div>
          <div class="card-title" style="display:flex;align-items:center;gap:8px">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
            Monitoring SLS Aktif PPL
          </div>
          <div class="card-sub" style="margin-top:4px">Menampilkan SLS yang sedang aktif/dikerjakan oleh PPL saat ini.</div>
        </div>
      </div>
      <div id="activeSLSMonitor" style="display:flex;flex-direction:column;gap:12px">
        <div style="padding:24px;text-align:center;color:var(--text-dim)">
          <div class="spinner" style="margin:0 auto 12px"></div>
          <p style="font-size:13px">Memuat data SLS aktif...</p>
        </div>
      </div>
    </div>

    <!-- Status & Logs -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Log Sinkronisasi Terakhir</div>
          <div class="card-sub">Keluaran konsol sistem saat berkas data dikonversi</div>
        </div>
      </div>
      <pre id="syncLogs" style="background:var(--bg-2);padding:16px;border-radius:var(--radius-sm);border:1px solid var(--border);color:var(--text-muted);font-family:monospace;font-size:12px;overflow-x:auto;max-height:300px;white-space:pre-wrap">Belum ada aktivitas.</pre>
    </div>
  `;
  renderActiveSLSMonitor();
}

function updateFileLabel(inputId, labelId) {
  const input = document.getElementById(inputId);
  const label = document.getElementById(labelId);
  if (input?.files?.[0]) {
    label.textContent = input.files[0].name;
    label.style.fontWeight = '700';
    label.style.color = 'var(--primary-light)';
  }
}

async function uploadDataFile(fileType, inputId) {
  const input = document.getElementById(inputId);
  const file = input?.files?.[0];
  const logs = document.getElementById('syncLogs');

  if (!file) {
    showToast('⚠ Silakan pilih berkas terlebih dahulu!', 'error');
    return;
  }

  if (logs) logs.textContent = `[*] Sedang memproses berkas ${file.name}...\n`;
  showToast('[*] Sedang memproses berkas...', 'info');

  try {
    // Read file and parse based on type
    const text = await file.text();
    let data = [];

    if (file.name.endsWith('.csv')) {
      data = parseCSV(text);
    } else if (file.name.endsWith('.xlsx')) {
      showToast('⚠ File XLSX tidak didukung browser. Gunakan CSV atau upload via Supabase Dashboard.', 'error');
      if (logs) logs.textContent = '[!] GAGAL!\n\nFormat XLSX tidak bisa diproses langsung di browser.\nGunakan Supabase Dashboard untuk import data.';
      return;
    }

    if (data.length === 0) {
      showToast('⚠ Tidak ada data yang bisa diparse dari file ini', 'error');
      return;
    }

    // Show preview
    if (logs) logs.textContent = `[*] Data parsed: ${data.length} rows\n\n[*] Preview:\n${JSON.stringify(data.slice(0, 3), null, 2)}\n\n[*] Mengirim ke Supabase...`;

    // Note: Untuk upload besar-besaran, gunakan Supabase Dashboard langsung
    showToast(`✓ Data berhasil diparse! ${data.length} rows.\nUntuk update database, gunakan Supabase Dashboard.`, 'info');
    if (logs) {
      logs.textContent = `[✓] BERHASIL!\n\nFile: ${file.name}\nRows: ${data.length}\n\nUntuk update data ke Supabase:\n1. Buka Supabase Dashboard\n2. Table Editor > pilih tabel\n3. Import CSV\n\natau gunakan script Python untuk bulk upsert.`;
      logs.style.color = '#4ade80';
    }

    await loadAllData();
  } catch(e) {
    showToast(`⚠ Gagal memproses file: ${e.message}`, 'error');
    if (logs) {
      logs.textContent = `[!] ERROR!\n\n${e.message}`;
      logs.style.color = '#f87171';
    }
  }
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((h, idx) => row[h] = values[idx] || '');
    data.push(row);
  }
  return data;
}

// ====================================================
// MANAJEMEN USER PAGE
// ====================================================
function renderUsers() {
  if (CurrentUser?.role !== 'admin') {
    document.getElementById('pageContent').innerHTML = `<div style="padding:40px;text-align:center;color:var(--danger)">⚠ Akses ditolak. Hanya Administrator yang dapat mengakses halaman ini.</div>`;
    return;
  }

  document.getElementById('pageContent').innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Daftar Pengguna Sistem (Petugas Sensus)</div>
          <div class="card-sub" id="usersSubLabel">Mengelola akun login petugas PML & PPL</div>
        </div>
        <button class="btn-sm btn-primary-sm" onclick="showAddUserModal()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tambah User Baru
        </button>
      </div>
      <div class="search-filter-row">
        <div class="search-wrap">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="search-input" id="userManageSearch" placeholder="Cari nama, email, SOBAT ID..." oninput="applyUserManageFilter()" />
        </div>
        <select class="filter-select" id="userManagePosisi" onchange="applyUserManageFilter()">
          <option value="">Semua Peran</option>
          <option value="PML">PML (Pemeriksa)</option>
          <option value="PPL">PPL (Pencacah)</option>
        </select>
        <button class="btn-sm btn-primary-sm" style="margin-left:auto;background:#10b981;box-shadow:0 4px 15px rgba(16,185,129,0.3)" onclick="saveUsersToDatabase()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>
          Simpan Perubahan User
        </button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Nama Lengkap</th>
              <th>Email / Username</th>
              <th>SOBAT ID</th>
              <th>Peran</th>
              <th>Password Default</th>
              <th>No. Telp</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="userManageBody"></tbody>
        </table>
      </div>
    </div>
  `;

  applyUserManageFilter();
}

function applyUserManageFilter() {
  const search = document.getElementById('userManageSearch')?.value.toLowerCase() || '';
  const posisi = document.getElementById('userManagePosisi')?.value || '';
  
  const filtered = AppData.biodata.filter(u => {
    const mSearch = !search || [u.nama, u.email, u.sobat_id].some(v => v?.toLowerCase().includes(search));
    const mPos = !posisi || u.posisi?.includes(posisi);
    return mSearch && mPos;
  });

  document.getElementById('usersSubLabel').textContent = `Menampilkan ${filtered.length} dari ${AppData.biodata.length} user terdaftar`;
  
  const body = document.getElementById('userManageBody');
  if (!body) return;

  body.innerHTML = filtered.length ? filtered.map((u, i) => {
    const isPML = u.posisi?.includes('PML');
    const pwd = isPML ? 'PML2026Tempuran' : 'PPL2026Tempuran';
    return `
      <tr>
        <td><span class="badge badge-primary">${i+1}</span></td>
        <td class="td-primary">${u.nama}</td>
        <td>${u.email || '-'}</td>
        <td style="font-family:monospace">${u.sobat_id || '-'}</td>
        <td>
          <span class="badge ${isPML ? 'badge-primary' : 'badge-info'}">${isPML ? 'PML' : 'PPL'}</span>
        </td>
        <td><code style="background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;font-size:11px">${pwd}</code></td>
        <td>${u.no_telp || '-'}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn-sm btn-ghost-sm" style="padding:6px 8px;border-color:var(--primary)" onclick="showEditUserModal('${u.email || u.nama}')">Edit</button>
            <button class="btn-sm btn-ghost-sm" style="padding:6px 8px;color:var(--danger);border-color:rgba(239,68,68,0.2)" onclick="deleteUser('${u.email || u.nama}')">Hapus</button>
          </div>
        </td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="8" style="text-align:center;color:var(--text-dim);padding:32px">Tidak ada user ditemukan</td></tr>`;
}

function showAddUserModal() {
  openModal(`
    <div class="modal-title" style="margin-bottom:20px">Tambah User Baru</div>
    <form id="addUserForm" onsubmit="addUserSubmit(event)" style="display:flex;flex-direction:column;gap:16px">
      <div class="form-group">
        <label>Nama Lengkap</label>
        <div class="input-wrap">
          <input type="text" id="addUserName" required placeholder="Nama lengkap petugas..." style="padding:10px 14px" />
        </div>
      </div>
      <div class="form-group">
        <label>Email (Username)</label>
        <div class="input-wrap">
          <input type="email" id="addUserEmail" required placeholder="email@gmail.com" style="padding:10px 14px" />
        </div>
      </div>
      <div class="form-group">
        <label>SOBAT ID</label>
        <div class="input-wrap">
          <input type="text" id="addUserSobat" required placeholder="ID SOBAT BPS..." style="padding:10px 14px" />
        </div>
      </div>
      <div class="form-group">
        <label>No. Telp</label>
        <div class="input-wrap">
          <input type="text" id="addUserTelp" placeholder="+62 8xx-xxxx-xxxx" style="padding:10px 14px" />
        </div>
      </div>
      <div class="form-group">
        <label>Peran (Posisi)</label>
        <select class="filter-select" id="addUserPosisi" style="width:100%;padding:10px 14px">
          <option value="Petugas Lapangan Sensus (PPL Sensus)">PPL (Pencacah Lapangan)</option>
          <option value="Pemeriksa Lapangan Sensus (PML Sensus)">PML Sensus (Pengawas)</option>
        </select>
      </div>
      <button class="btn-sm btn-primary-sm" type="submit" style="width:100%;justify-content:center;margin-top:8px">Tambah Petugas</button>
    </form>
  `);
}

function addUserSubmit(e) {
  e.preventDefault();
  const nama = document.getElementById('addUserName').value.trim();
  const email = document.getElementById('addUserEmail').value.trim();
  const sobat_id = document.getElementById('addUserSobat').value.trim();
  const no_telp = document.getElementById('addUserTelp').value.trim();
  const posisi = document.getElementById('addUserPosisi').value;

  if (AppData.biodata.some(u => (u.email || '').toLowerCase() === email.toLowerCase())) {
    showToast('⚠ Email tersebut sudah terdaftar!', 'error');
    return;
  }

  const newUser = {
    nama,
    email,
    sobat_id,
    no_telp,
    posisi,
    status_seleksi: 'Diterima',
    alamat_detail: '',
    alamat_desa: '',
    ttl: '',
    umur: 25,
    jenis_kelamin: 'Lk',
    pendidikan: 'SMA',
    pekerjaan: 'Lainnya',
    punya_hp_android: 'Ya',
    status_nik: 'terverifikasi',
    verifikasi_pada: new Date().toISOString().slice(0, 19).replace('T', ' ')
  };

  AppData.biodata.push(newUser);
  closeModal();
  applyUserManageFilter();
  showToast('✓ Akun baru ditambahkan. Klik "Simpan Perubahan User" untuk menyimpan permanen!', 'info');
}

function showEditUserModal(emailOrNama) {
  const u = AppData.biodata.find(u => u.email === emailOrNama || u.nama === emailOrNama);
  if (!u) return;

  const isPML = u.posisi?.includes('PML');

  openModal(`
    <div class="modal-title" style="margin-bottom:20px">Edit User</div>
    <form id="editUserForm" onsubmit="editUserSubmit(event, '${emailOrNama}')" style="display:flex;flex-direction:column;gap:16px">
      <div class="form-group">
        <label>Nama Lengkap</label>
        <div class="input-wrap">
          <input type="text" id="editUserName" value="${u.nama}" required style="padding:10px 14px" />
        </div>
      </div>
      <div class="form-group">
        <label>Email (Username)</label>
        <div class="input-wrap">
          <input type="email" id="editUserEmail" value="${u.email || ''}" required style="padding:10px 14px" />
        </div>
      </div>
      <div class="form-group">
        <label>SOBAT ID</label>
        <div class="input-wrap">
          <input type="text" id="editUserSobat" value="${u.sobat_id || ''}" required style="padding:10px 14px" />
        </div>
      </div>
      <div class="form-group">
        <label>No. Telp</label>
        <div class="input-wrap">
          <input type="text" id="editUserTelp" value="${u.no_telp || ''}" style="padding:10px 14px" />
        </div>
      </div>
      <div class="form-group">
        <label>Peran (Posisi)</label>
        <select class="filter-select" id="editUserPosisi" style="width:100%;padding:10px 14px">
          <option value="Petugas Lapangan Sensus (PPL Sensus)" ${!isPML ? 'selected' : ''}>PPL (Pencacah Lapangan)</option>
          <option value="Pemeriksa Lapangan Sensus (PML Sensus)" ${isPML ? 'selected' : ''}>PML Sensus (Pengawas)</option>
        </select>
      </div>
      <button class="btn-sm btn-primary-sm" type="submit" style="width:100%;justify-content:center;margin-top:8px">Simpan Perubahan</button>
    </form>
  `);
}

function editUserSubmit(e, oldEmailOrNama) {
  e.preventDefault();
  const idx = AppData.biodata.findIndex(u => u.email === oldEmailOrNama || u.nama === oldEmailOrNama);
  if (idx === -1) return;

  const nama = document.getElementById('editUserName').value.trim();
  const email = document.getElementById('editUserEmail').value.trim();
  const sobat_id = document.getElementById('editUserSobat').value.trim();
  const no_telp = document.getElementById('editUserTelp').value.trim();
  const posisi = document.getElementById('editUserPosisi').value;

  // Check email conflict
  if (email.toLowerCase() !== (AppData.biodata[idx].email || '').toLowerCase()) {
    if (AppData.biodata.some(u => (u.email || '').toLowerCase() === email.toLowerCase())) {
      showToast('⚠ Email tersebut sudah terdaftar!', 'error');
      return;
    }
  }

  AppData.biodata[idx].nama = nama;
  AppData.biodata[idx].email = email;
  AppData.biodata[idx].sobat_id = sobat_id;
  AppData.biodata[idx].no_telp = no_telp;
  AppData.biodata[idx].posisi = posisi;

  closeModal();
  applyUserManageFilter();
  showToast('✓ Perubahan disimpan sementara. Klik "Simpan Perubahan User" untuk menyimpan permanen!', 'info');
}

function deleteUser(emailOrNama) {
  if (!confirm('Apakah Anda yakin ingin menghapus petugas ini?')) return;
  const idx = AppData.biodata.findIndex(u => u.email === emailOrNama || u.nama === emailOrNama);
  if (idx === -1) return;

  AppData.biodata.splice(idx, 1);
  applyUserManageFilter();
  showToast('✓ Petugas dihapus sementara. Klik "Simpan Perubahan User" untuk menyimpan permanen!', 'info');
}

async function saveUsersToDatabase() {
  showToast('[*] Menyimpan data user ke Supabase...', 'info');
  try {
    const cleanBio = AppData.biodata.map(u => {
      const copy = { ...u };
      delete copy._alokasi;
      delete copy._progres_count;
      delete copy._progres_done;
      delete copy._ppls;
      return copy;
    });

    // Batch upsert to Supabase
    const result = await supabaseUpsertBatch('biodata', cleanBio, 'email');

    if (result) {
      showToast('✓ Seluruh data user berhasil disimpan ke Supabase!', 'success');
      await loadAllData();
    } else {
      showToast('⚠ Gagal menyimpan data. Coba lagi.', 'error');
    }
  } catch(e) {
    showToast(`⚠ Error: ${e.message}`, 'error');
  }
}

async function supabaseUpsertBatch(table, data, matchKey) {
  let success = true;
  for (const item of data) {
    const result = await supabase.supabaseUpsert(table, item, matchKey);
    if (!result) success = false;
  }
  return success;
}

// ====================================================
// PPL ACTIVE SLS WORKSPACE HELPERS
// ====================================================
window.toggleActiveSLS = async function(idsubsls, event) {
  if (event) event.stopPropagation();
  if (!CurrentUser) return;

  const pplEmail = (CurrentUser.email || '').toLowerCase().trim();
  if (!pplEmail) {
    showToast('⚠ Email user tidak ditemukan!', 'error');
    return;
  }

  const key = `active-sls-${pplEmail}`;
  const currentActive = localStorage.getItem(key);

  if (currentActive === idsubsls) {
    // Nonaktifkan
    localStorage.removeItem(key);
    // Hapus dari Supabase juga
    await supabase.removeActiveSLS(pplEmail);
    showToast('SLS aktif dinonaktifkan.', 'info');
  } else {
    // Aktifkan
    localStorage.setItem(key, idsubsls);
    localStorage.setItem(`${key}_updated`, new Date().toISOString());
    const slsInfo = AppData.alokasi.find(a => a.idsubsls === idsubsls);
    if (slsInfo) {
      // Simpan juga ke Supabase untuk monitoring Admin
      await supabase.setActiveSLS(pplEmail, CurrentUser.name || pplEmail, slsInfo);
    }
    showToast(`✓ SLS ${slsInfo ? slsInfo.nmsls : idsubsls} diatur sebagai SLS aktif!`, 'success');
    // Refresh monitoring jika di halaman config
    if (typeof renderActiveSLSMonitor === 'function') {
      renderActiveSLSMonitor();
    }
  }
  renderAlokasiTable();
  // Refresh dashboard monitoring
  initScopedData();
  renderDashboard();
};

window.downloadSLSTemplate = function(idsubsls, event) {
  if (event) event.stopPropagation();
  const slsInfo = AppData.alokasi.find(a => a.idsubsls === idsubsls);
  if (!slsInfo) {
    showToast('⚠ Informasi SLS tidak ditemukan!', 'error');
    return;
  }
  const slsProg = AppData.progres.filter(r => String(r.kode_sls).trim() === String(slsInfo.kdsls).trim() && String(r.kode_desa).trim() === String(slsInfo.kddesa).trim());
  if (!slsProg.length) {
    showToast('⚠ Tidak ada data prelist untuk SLS ini!', 'error');
    return;
  }
  
  const headers = ['No', 'Nama SLS', 'Nama Usaha', 'Alamat', 'NIB', 'Skala Usaha', 'Status', 'Keterangan'];
  const rows = slsProg.map((r, i) => [
    i + 1,
    r.nama_sls || '-',
    r.nama_usaha || '-',
    r.alamat || '-',
    r.nib || '-',
    r.skala_usaha || '-',
    r.status || 'open',
    r.keterangan || '-'
  ]);
  
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
    
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Template_Target_SLS_${idsubsls}.csv`;
  a.click();
  showToast('✓ Template target SLS berhasil diunduh!');
};

// ====================================================
// TEMPLATE TARGET ADMIN HELPERS
// ====================================================

// Helper untuk menemukan progres berdasarkan idsubsls
function findProgresByIdsubsls(idsubsls) {
  if (!AppData || !AppData.progres) return [];

  // Method 1: Cari berdasarkan kode_identitas (mengandung idsubsls)
  const byIdentitas = AppData.progres.filter(r =>
    (r.kode_identitas || '').includes(idsubsls)
  );
  if (byIdentitas.length > 0) return byIdentitas;

  // Method 2: Parse idsubsls (format: 321513KDESAKDSLSKDSUBSLS)
  // Contoh: 3215130001000100 -> kddesa=01, kdsls=0001, kdsubsls=00
  if (idsubsls.length >= 12) {
    const kddesa = idsubsls.substring(6, 8);
    const kdsls = idsubsls.substring(8, 12);
    const kdsubsls = idsubsls.substring(12, 14) || '00';

    const byKode = AppData.progres.filter(r => {
      const rd = String(r.kode_desa || '').padStart(3, '0');
      const rs = String(r.kode_sls || '').padStart(4, '0');
      const rsub = String(r.kode_subsls || '').padStart(2, '0');
      return rd === kddesa && rs === kdsls && rsub === kdsubsls;
    });
    if (byKode.length > 0) return byKode;
  }

  // Method 3: Flexible match (cari di semua field)
  return AppData.progres.filter(r =>
    (r.kode_identitas || '').includes(idsubsls.substring(0, 10)) ||
    (r.desa || '').toLowerCase().includes(idsubsls.substring(6, 8)) ||
    (r.nama_sls || '').includes(idsubsls.substring(8, 12))
  );
}

// Download template untuk satu SLS aktif
window.downloadActiveSLSTemplate = function(idsubsls, event) {
  if (event) event.stopPropagation();

  // Cek apakah data sudah dimuat
  if (!AppData || !AppData.alokasi || !AppData.progres) {
    showToast('⚠ Data belum dimuat. Silakan refresh halaman.', 'error');
    return;
  }

  const slsInfo = AppData.alokasi.find(a => a.idsubsls === idsubsls);
  if (!slsInfo) {
    showToast('⚠ Informasi SLS tidak ditemukan di alokasi!', 'error');
    return;
  }

  const slsProg = findProgresByIdsubsls(idsubsls);

  if (!slsProg.length) {
    showToast('⚠ Tidak ada data prelist untuk SLS ini!', 'error');
    return;
  }

  // Template sesuai format: 8 kolom
  const headers = ['No', 'Nama SLS', 'Nama Usaha', 'Alamat', 'NIB', 'Skala Usaha', 'Status', 'Keterangan'];
  const rows = slsProg.map((r, i) => [
    i + 1,
    r.nama_sls || slsInfo.nmsls || '-',
    r.nama_usaha || '-',
    r.alamat || '-',
    r.nib || '-',
    r.skala_usaha || '-',
    r.status || 'open',
    r.keterangan || '-'
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Template_Target_${slsInfo.nmsls?.replace(/\s+/g, '_') || idsubsls}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`✓ Template SLS "${slsInfo.nmsls}" berhasil diunduh!`, 'success');
};

// Download semua template untuk SLS aktif PPL
window.downloadAllActiveTemplates = function() {
  // Cek apakah data sudah dimuat
  if (!AppData || !AppData.biodata || !AppData.alokasi || !AppData.progres) {
    showToast('⚠ Data belum dimuat. Silakan refresh halaman.', 'error');
    return;
  }

  const allRows = [];
  // Template header sesuai format: 10 kolom
  const headers = ['No', 'Nama SLS', 'Nama Usaha', 'Alamat', 'NIB', 'Skala Usaha', 'Status', 'Keterangan', 'PPL', 'Desa'];

  let foundCount = 0;
  AppData.biodata.filter(b => b.posisi?.includes('PPL')).forEach(ppl => {
    const pplEmail = (ppl.email || '').toLowerCase().trim();
    if (!pplEmail) return;

    const key = `active-sls-${pplEmail}`;
    const activeId = localStorage.getItem(key);

    if (activeId) {
      const slsInfo = AppData.alokasi.find(a => a.idsubsls === activeId);
      if (slsInfo) {
        const slsProg = findProgresByIdsubsls(activeId);

        if (slsProg.length) {
          foundCount++;
          slsProg.forEach(r => {
            allRows.push([
              allRows.length + 1,
              r.nama_sls || slsInfo.nmsls || '-',
              r.nama_usaha || '-',
              r.alamat || '-',
              r.nib || '-',
              r.skala_usaha || '-',
              r.status || 'open',
              r.keterangan || '-',
              ppl.nama || '-',
              slsInfo.nmdes || '-'
            ]);
          });
        }
      }
    }
  });

  if (!allRows.length) {
    showToast('⚠ Tidak ada data prelist untuk SLS aktif PPL!', 'error');
    return;
  }

  const csv = [headers, ...allRows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Template_Target_Semua_SLS_Aktif_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`✓ Template semua SLS aktif berhasil diunduh! (${allRows.length} data)`, 'success');
};

window.downloadAllTemplates = function() {
  const allRows = [];
  const headers = ['No', 'PPL', 'Desa', 'Nama SLS', 'ID SLS', 'Nama Usaha', 'Alamat', 'NIB', 'Skala Usaha', 'Status', 'Keterangan'];
  AppData.alokasi.forEach(a => {
    const slsProg = AppData.progres.filter(r =>
      String(r.kode_sls).trim() === String(a.kdsls).trim() &&
      String(r.kode_desa).trim() === String(a.kddesa).trim()
    );
    slsProg.forEach(r => {
      allRows.push([
        allRows.length + 1,
        a.ppl || '-',
        a.nmdes || '-',
        a.nmsls || '-',
        a.idsubsls || '-',
        r.nama_usaha || '-',
        r.alamat || '-',
        r.nib || '-',
        r.skala_usaha || '-',
        r.status || 'open',
        r.keterangan || '-'
      ]);
    });
  });
  if (!allRows.length) {
    showToast('\u26a0 Tidak ada data prelist yang tersedia!', 'error');
    return;
  }
  const csv = [headers, ...allRows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Template_Target_Semua_SLS_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast('\u2713 Template target semua SLS berhasil diunduh!');
};

// ====================================================
// MONITORING SLS AKTIF PPL (ADMIN) - REAL-TIME FROM SUPABASE + LOCALSTORAGE
// ====================================================
async function renderActiveSLSMonitor() {
  const monitor = document.getElementById('activeSLSMonitor');
  if (!monitor) return;

  // Loading state
  monitor.innerHTML = `
    <div style="padding:24px;text-align:center;color:var(--text-dim)">
      <div class="spinner" style="margin:0 auto 12px"></div>
      <p style="font-size:13px">Memuat data SLS aktif...</p>
    </div>
  `;

  let activeList = [];

  // Method 1: Fetch dari Supabase
  try {
    const activeSLSFromDB = await supabase.getAllActiveSLS();
    if (activeSLSFromDB && Array.isArray(activeSLSFromDB) && activeSLSFromDB.length > 0) {
      activeList = activeSLSFromDB.filter(s => s.idsubsls && s.ppl_email);
    }
  } catch(e) {
    console.warn('Supabase fetch failed, using localStorage fallback:', e);
  }

  // Method 2: Fallback - Baca dari localStorage semua PPL
  if (activeList.length === 0) {
    const pplList = AppData.biodata.filter(b => b.posisi?.includes('PPL'));
    pplList.forEach(ppl => {
      const pplEmail = (ppl.email || '').toLowerCase().trim();
      if (!pplEmail) return;

      const key = `active-sls-${pplEmail}`;
      const activeId = localStorage.getItem(key);

      if (activeId) {
        const slsInfo = AppData.alokasi.find(a => a.idsubsls === activeId);
        if (slsInfo) {
          activeList.push({
            ppl_email: pplEmail,
            ppl_nama: ppl.nama,
            idsubsls: activeId,
            nmdes: slsInfo.nmdes,
            nmsls: slsInfo.nmsls,
            pml: slsInfo.pml,
            umkm: slsInfo.umkm,
            fasih: slsInfo.fasih,
            updated_at: localStorage.getItem(`${key}_updated`) || new Date().toISOString()
          });
        }
      }
    });
  }

  if (!activeList.length) {
    monitor.innerHTML = `
      <div style="padding:24px;text-align:center;color:var(--text-dim)">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.5" style="margin-bottom:12px;opacity:0.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style="font-size:13px">Belum ada PPL yang memilih SLS aktif</p>
        <p style="font-size:11px;margin-top:8px">PPL harus memilih SLS aktif di menu Alokasi Petugas</p>
      </div>
    `;
    return;
  }

  // Render list
  monitor.innerHTML = `
    <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
      <span style="background:var(--success);color:white;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600">
        ${activeList.length} PPL aktif
      </span>
      <button class="btn-sm btn-primary-sm" onclick="downloadAllActiveTemplates()" style="display:flex;align-items:center;gap:6px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download Template
      </button>
    </div>
    ${activeList.map((sls) => `
      <div style="padding:16px;background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;color:white;font-weight:700">
            ${(sls.ppl_nama || 'U')[0].toUpperCase()}
          </div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">${sls.ppl_nama || '-'}</div>
            <div style="font-size:11px;color:var(--text-muted)">${sls.ppl_email || '-'}</div>
          </div>
          <span style="background:rgba(16,185,129,0.15);color:var(--success);padding:4px 10px;border-radius:4px;font-size:11px;font-weight:600">
            AKTIF
          </span>
        </div>
        <div style="font-size:13px;color:var(--text);margin-bottom:8px">
          <strong>${sls.nmdes || '-'}</strong> - ${sls.nmsls || '-'}
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">
          ID: ${sls.idsubsls} | PML: ${sls.pml || '-'}
        </div>
        <div style="display:flex;gap:12px;margin-bottom:12px">
          <div style="background:rgba(245,158,11,0.15);padding:6px 12px;border-radius:6px;text-align:center;flex:1">
            <div style="font-size:16px;font-weight:700;color:var(--warning)">${sls.umkm || 0}</div>
            <div style="font-size:10px;color:var(--text-muted)">UMKM</div>
          </div>
          <div style="background:rgba(16,185,129,0.15);padding:6px 12px;border-radius:6px;text-align:center;flex:1">
            <div style="font-size:16px;font-weight:700;color:var(--success)">${sls.fasih || 0}</div>
            <div style="font-size:10px;color:var(--text-muted)">FASIH</div>
          </div>
          <button class="btn-sm btn-ghost-sm" onclick="downloadActiveSLSTemplate('${sls.idsubsls}')" style="display:flex;align-items:center;gap:4px;padding:6px 12px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Template
          </button>
        </div>
        <div style="font-size:10px;color:var(--text-dim)">
          Update: ${sls.updated_at ? new Date(sls.updated_at).toLocaleString('id-ID') : '-'}
        </div>
      </div>
    `).join('')}
  `;
}

// ====================================================

// ====================================================
// START
// ====================================================
init();
