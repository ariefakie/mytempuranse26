// ===================================================
// SUPABASE CONFIG & HELPERS
// SE2026-Tempuran
// ===================================================

const SUPABASE_URL = 'https://ebyzqfvfursatmeqdlwc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVieXpxZnZmdXJzYXRtZXFkbHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTYxNzksImV4cCI6MjA5NzQ3MjE3OX0.JWJ1ZhaXmSabr0qZ5--pDG3exMj2RCViWjFFGFOAvwU';

// ===================================================
// FIELD MAPPING CONFIG (Single Source of Truth)
// ===================================================

const FIELD_MAPPING = {
  // Biodata Petugas: frontend → Supabase
  biodataToSupabase: {
    nama: 'nm_lengkap',
    posisi: 'jabatan',
    no_telp: 'nohp',
    email: 'email',
    alamat: 'alamat',
    alamat_desa: 'nmdesa',
    ttl: 'ttl',
    umur: 'umur',
    jenis_kelamin: 'kelamin',
    pendidikan: 'pendidikan',
    pekerjaan: 'pekerjaan',
    sobad_id: 'sobad_id',
    merk_hp: 'merk_hp',
    tipe_hp: 'tipe_hp',
    punya_hp_android: 'punya_hp_android',
    punya_kendaraan: 'punya_kendaraan',
    bisa_motor: 'bisa_motor',
    berpengalaman_capi: 'berpengalaman_capi',
    pernah_se: 'pernah_se',
    status_nik: 'status_nik',
  },

  // Biodata Petugas: Supabase → frontend
  supabaseToBiodata: {
    id: 'id',
    nm_lengkap: 'nama',
    jabatan: 'posisi',
    nohp: 'no_telp',
    email: 'email',
    alamat: 'alamat',
    nmdesa: 'alamat_desa',
    ttl: 'ttl',
    umur: 'umur',
    kelamin: 'jenis_kelamin',
    pendidikan: 'pendidikan',
    pekerjaan: 'pekerjaan',
    sobad_id: 'sobat_id',
    merk_hp: 'merk_hp',
    tipe_hp: 'tipe_hp',
    punya_hp_android: 'punya_hp_android',
    punya_kendaraan: 'punya_kendaraan',
    bisa_motor: 'bisa_motor',
    berpengalaman_capi: 'berpengalaman_capi',
    pernah_se: 'pernah_se',
    status_nik: 'status_nik',
  },

  // Alokasi Petugas: Supabase → frontend
  alokasiToFrontend: {
    'PML': 'pml',
    'PPL': 'ppl',
    'EMAIL PENCACAH': 'email_pencacah',
    'EMAIL PENGAWAS': 'email_pengawas',
    'Flag Perubahan': 'flag_perubahan',
    'Flag SLS Open PBI': 'flag_sls_open',
    'KK Open PBI': 'kk_open',
  },

  // Progres Lapangan: Supabase → frontend
  progresToFrontend: {
    email: 'petugas',
    kdsls: 'kode_sls',
    kddesa: 'kode_desa',
    nmsls: 'nama_sls',
    nmusaha: 'nama_usaha',
    nmalamat: 'alamat',
    jmlusaha: 'jumlah_usaha',
    skalausaha: 'skala_usaha',
    kdidentitas: 'kode_identitas',
    ket: 'keterangan',
    nmdesa: 'desa',
    nib: 'nib',
    mode: 'mode',
    status: 'status',
  }
};

// Map Supabase data to frontend format
function mapBiodataFromSupabase(data) {
  if (!Array.isArray(data)) return [];
  return data.map(row => ({
    id: row.id,
    nama: row.nm_lengkap || '',
    email: row.email || '',
    posisi: row.jabatan || '',
    no_telp: row.nohp || '',
    ttl: row.ttl || '',
    umur: row.umur || '',
    jenis_kelamin: row.kelamin || '',
    pendidikan: row.pendidikan || '',
    pekerjaan: row.pekerjaan || '',
    alamat: row.alamat || '',
    alamat_desa: getCleanDesa(row.nmdesa),
    sobad_id: row.sobad_id || '',
    merk_hp: row.merk_hp || '',
    tipe_hp: row.tipe_hp || '',
    punya_hp_android: row.punya_hp_android || '',
    punya_kendaraan: row.punya_kendaraan || '',
    bisa_motor: row.bisa_motor || '',
    berpengalaman_capi: row.berpengalaman_capi || '',
    pernah_se: row.pernah_se || '',
    status_nik: row.status_nik || '',
    // Original data for reference
    _original: row
  }));
}

// Map frontend data to Supabase format
function mapBiodataToSupabase(data) {
  return {
    nm_lengkap: data.nama,
    jabatan: data.posisi,
    nohp: formatPhoneNumber(data.no_telp),
    email: data.email,
    alamat: data.alamat,
    nmdesa: data.alamat_desa,
    ttl: data.ttl,
    umur: data.umur,
    kelamin: data.jenis_kelamin,
    pendidikan: data.pendidikan,
    pekerjaan: data.pekerjaan,
    sobad_id: data.sobad_id,
    merk_hp: data.merk_hp,
    tipe_hp: data.tipe_hp,
    punya_hp_android: data.punya_hp_android,
    punya_kendaraan: data.punya_kendaraan,
    bisa_motor: data.bisa_motor,
    berpengalaman_capi: data.berpengalaman_capi,
    pernah_se: data.pernah_se,
    status_nik: data.status_nik,
  };
}

// Map alokasi from Supabase
function mapAlokasiFromSupabase(data) {
  if (!Array.isArray(data)) return [];
  return data.map(row => ({
    id: row.id,
    idsubsls: row.idsubsls,
    pml: titleCase(row["PML"] || ''),
    ppl: titleCase(row["PPL"] || ''),
    email_pencacah: row["EMAIL PENCACAH"] || '',
    email_pengawas: row["EMAIL PENGAWAS"] || '',
    nmdes: getCleanDesa(row.nmdes),
    nmsls: row.nmsls || '',
    kddesa: row.kddesa || '',
    kdsls: row.kdsls || '',
    umkm: parseInt(row.umkm) || 0,
    fasih: parseInt(row.fasih) || 0,
    flag_perubahan: row["Flag Perubahan"] || false,
    flag_sls_open: row["Flag SLS Open PBI"] || false,
    kk_open: row["KK Open PBI"] || 0,
    _original: row
  }));
}

// Map progres from Supabase
function mapProgresFromSupabase(data) {
  if (!Array.isArray(data)) return [];
  return data.map(row => ({
    id: row.id,
    petugas: row.email || '',
    kode_sls: row.kdsls || '',
    kode_desa: row.kddesa || '',
    nama_sls: row.nmsls || '',
    nama_usaha: row.nmusaha || '',
    alamat: row.nmalamat || '',
    jumlah_usaha: row.jmlusaha || '',
    skala_usaha: row.skalausaha || '',
    kode_identitas: row.kdidentitas || '',
    keterangan: row.ket || '',
    desa: getCleanDesa(row.nmdesa),
    nib: row.nib || '',
    mode: row.mode || '',
    status: row.status || 'open',
    _original: row
  }));
}

// ===================================================
// DESA NAME STANDARDIZATION
// ===================================================

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

function getCleanDesa(name) {
  if (!name) return '-';
  const clean = name.toLowerCase().replace(/[^a-z]/g, '').trim();
  for (const key in DESA_MAP) {
    if (clean.includes(key) || key.includes(clean)) {
      return DESA_MAP[key];
    }
  }
  return name;
}

function titleCase(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim();
}

// ===================================================
// HELPER FUNCTIONS
// ===================================================

// Format nomor HP: +62xx → 08xx
function formatPhoneNumber(phone) {
  if (!phone) return '-';
  let num = String(phone).trim();
  num = num.replace(/[\s\-\(\)]/g, '');
  if (num.startsWith('+62')) {
    num = '0' + num.substring(3);
  }
  if (num.startsWith('62') && num.length > 10) {
    num = '0' + num.substring(2);
  }
  if (!num.match(/^08\d{8,12}$/)) {
    return num;
  }
  return num;
}

// ===================================================
// SUPABASE API CALLS
// ===================================================

async function supabaseGet(table, filters = '') {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${filters}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) {
      console.error(`Supabase GET error: ${res.status} ${res.statusText}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('Supabase GET error:', e);
    return null;
  }
}

async function supabasePost(table, data) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      console.error(`Supabase POST error: ${res.status} ${res.statusText}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('Supabase POST error:', e);
    return null;
  }
}

async function supabasePatch(table, data, filters) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${filters}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      console.error(`Supabase PATCH error: ${res.status} ${res.statusText}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('Supabase PATCH error:', e);
    return null;
  }
}

async function supabaseUpsert(table, data, matchingKey) {
  try {
    // First try to update
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${matchingKey}=eq.${encodeURIComponent(data[matchingKey])}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });

    // If no rows updated, insert
    if (res.ok) {
      const result = await res.json();
      if (!result || result.length === 0) {
        // Insert new
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(data)
        });
        if (!insertRes.ok) {
          console.error(`Supabase UPSERT POST error: ${insertRes.status}`);
          return null;
        }
        return await insertRes.json();
      }
      return result;
    }
    console.error(`Supabase UPSERT PATCH error: ${res.status}`);
    return null;
  } catch (e) {
    console.error('Supabase UPSERT error:', e);
    return null;
  }
}

// Batch upsert for multiple records
async function supabaseUpsertBatch(table, dataArray, matchKey) {
  const results = [];
  for (const data of dataArray) {
    const result = await supabaseUpsert(table, data, matchKey);
    results.push(result);
  }
  return results.every(r => r !== null);
}

// ===================================================
// BIODATA PETUGAS FUNCTIONS
// ===================================================

async function getAllBiodata() {
  return await supabaseGet('biodata_petugas', '?select=*&order=nm_lengkap.asc');
}

async function getBiodataById(id) {
  return await supabaseGet('biodata_petugas', `?id=eq.${id}&select=*`);
}

async function getBiodataByEmail(email) {
  return await supabaseGet('biodata_petugas', `?email=eq.${encodeURIComponent(email)}&select=*`);
}

// Update phone number with proper formatting
async function updateBiodataPhone(id, teleponBaru) {
  const teleponFormat = formatPhoneNumber(teleponBaru);
  return await supabasePatch('biodata_petugas', { nohp: teleponFormat }, `?id=eq.${id}`);
}

// Update biodata with field mapping
async function updateBiodata(id, data) {
  // Map frontend field names to Supabase column names
  const supabaseData = {};

  if (data.nama !== undefined) supabaseData.nm_lengkap = data.nama;
  if (data.no_telp !== undefined) supabaseData.nohp = formatPhoneNumber(data.no_telp);
  if (data.posisi !== undefined) supabaseData.jabatan = data.posisi;
  if (data.email !== undefined) supabaseData.email = data.email;
  if (data.alamat !== undefined) supabaseData.alamat = data.alamat;
  if (data.alamat_desa !== undefined) supabaseData.nmdesa = data.alamat_desa;
  if (data.ttl !== undefined) supabaseData.ttl = data.ttl;
  if (data.umur !== undefined) supabaseData.umur = data.umur;
  if (data.jenis_kelamin !== undefined) supabaseData.kelamin = data.jenis_kelamin;
  if (data.pendidikan !== undefined) supabaseData.pendidikan = data.pendidikan;
  if (data.pekerjaan !== undefined) supabaseData.pekerjaan = data.pekerjaan;
  if (data.sobat_id !== undefined) supabaseData.sobad_id = data.sobat_id;

  return await supabasePatch('biodata_petugas', supabaseData, `?id=eq.${id}`);
}

// ===================================================
// ALOKASI PETUGAS & PROGRES FUNCTIONS
// ===================================================

async function getAllAlokasi() {
  return await supabaseGet('alokasi_petugas', '?select=*&order=nmdes.asc');
}

async function getAlokasiByEmail(email) {
  return await supabaseGet('alokasi_petugas', `?"EMAIL PENCACAH"=eq.${encodeURIComponent(email)}&select=*`);
}

async function getAllProgres() {
  return await supabaseGet('progres_pendataan', '?select=*&limit=50000');
}

async function getProgresByPetugas(petugasEmail) {
  return await supabaseGet('progres_pendataan', `?email=eq.${encodeURIComponent(petugasEmail)}&select=*`);
}

// ===================================================
// ACTIVE SLS FUNCTIONS (Real-time monitoring)
// ===================================================

async function setActiveSLS(pplEmail, pplNama, slsInfo) {
  const data = {
    ppl_email: pplEmail.toLowerCase(),
    ppl_nama: pplNama,
    alokasi_id: slsInfo.id || slsInfo.idsubsls,
    idsubsls: slsInfo.idsubsls || slsInfo.id,
    nmkec: slsInfo.nmkec || '',
    nmdes: slsInfo.nmdes || slsInfo.nmdesa || '',
    nmsls: slsInfo.nmsls || slsInfo.nmsubsls || '',
    pml: slsInfo.pml || '',
    umkm: parseInt(slsInfo.umkm) || 0,
    fasih: parseInt(slsInfo.fasih) || 0,
    updated_at: new Date().toISOString()
  };

  // Upsert by email
  const result = await supabaseGet('active_sls', `?ppl_email=eq.${pplEmail.toLowerCase()}&select=*`);

  if (result && result.length > 0) {
    // Update existing
    return await supabasePatch('active_sls', data, `?ppl_email=eq.${pplEmail.toLowerCase()}`);
  } else {
    // Insert new
    return await supabasePost('active_sls', data);
  }
}

async function getAllActiveSLS() {
  return await supabaseGet('active_sls', '?select=*&order=ppl_nama.asc');
}

async function removeActiveSLS(pplEmail) {
  return await supabasePatch('active_sls', {
    alokasi_id: null,
    idsubsls: null,
    nmkec: '',
    nmdes: '',
    nmsls: '',
    pml: '',
    umkm: 0,
    fasih: 0,
    updated_at: new Date().toISOString()
  }, `?ppl_email=eq.${pplEmail.toLowerCase()}`);
}

// ===================================================
// DOWNLOAD FUNCTIONS
// ===================================================

function downloadBiodataCSV(data) {
  const headers = ['No', 'Nama', 'Email', 'Jabatan', 'Telepon', 'Alamat', 'Desa'];
  const rows = data.map((item, index) => [
    index + 1,
    item.nama || '-',
    item.email || '-',
    item.posisi || '-',
    formatPhoneNumber(item.no_telp),
    item.alamat || '-',
    item.alamat_desa || '-'
  ]);

  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(cell => `"${cell}"`).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Biodata_Petugas_SE2026_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

function downloadBiodataTXT(data) {
  let txt = 'BIODATA PETUGAS SE2026 TEMPURAN\n';
  txt += '='.repeat(50) + '\n\n';

  data.forEach((item, index) => {
    txt += `${index + 1}. ${item.nama || '-' }\n`;
    txt += `   Email   : ${item.email || '-'}\n`;
    txt += `   Jabatan : ${item.posisi || '-'}\n`;
    txt += `   Telepon : ${formatPhoneNumber(item.no_telp)}\n`;
    txt += `   Alamat  : ${item.alamat || '-'}\n`;
    txt += `   Desa    : ${item.alamat_desa || '-'}\n`;
    txt += '-'.repeat(30) + '\n\n';
  });

  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Biodata_Petugas_SE2026_${new Date().toISOString().split('T')[0]}.txt`;
  link.click();
}

// ===================================================
// EXPORT ALL FUNCTIONS GLOBALLY
// ===================================================

window.supabase = {
  // Config
  SUPABASE_URL,
  SUPABASE_KEY,

  // Mappers
  mapBiodataFromSupabase,
  mapBiodataToSupabase,
  mapAlokasiFromSupabase,
  mapProgresFromSupabase,
  getCleanDesa,
  titleCase,

  // API
  getAllBiodata,
  getBiodataById,
  getBiodataByEmail,
  updateBiodataPhone,
  updateBiodata,
  getAllAlokasi,
  getAlokasiByEmail,
  getAllProgres,
  getProgresByPetugas,

  // Active SLS
  setActiveSLS,
  getAllActiveSLS,
  removeActiveSLS,

  // Download
  downloadBiodataCSV,
  downloadBiodataTXT,

  // Utils
  formatPhoneNumber,
  supabaseGet,
  supabaseUpsertBatch
};
