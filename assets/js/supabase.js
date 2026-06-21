// ===================================================
// SUPABASE CONFIG & HELPERS
// SE2026-Tempuran
// ===================================================

const SUPABASE_URL = 'https://ebyzqfvfursatmeqdlwc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVieXpxZnZmdXJzYXRtZXFkbHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTYxNzksImV4cCI6MjA5NzQ3MjE3OX0.JWJ1ZhaXmSabr0qZ5--pDG3exMj2RCViWjFFGFOAvwU';

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
    return await res.json();
  } catch (e) {
    console.error('Supabase PATCH error:', e);
    return null;
  }
}

async function supabaseUpsert(table, data, matchingKey) {
  try {
    // First try to update
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${matchingKey}=eq.${data[matchingKey]}`, {
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
        return await insertRes.json();
      }
      return result;
    }
    return null;
  } catch (e) {
    console.error('Supabase UPSERT error:', e);
    return null;
  }
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

async function updateBiodataPhone(id, teleponBaru) {
  const teleponFormat = formatPhoneNumber(teleponBaru);
  return await supabasePatch('biodata_petugas', { nohp: teleponFormat }, `?id=eq.${id}`);
}

async function updateBiodata(id, data) {
  return await supabasePatch('biodata_petugas', data, `?id=eq.${id}`);
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
  return await supabaseGet('progres_lapangan', '?select=*&limit=50000');
}

async function getProgresByPetugas(petugasEmail) {
  return await supabaseGet('progres_lapangan', `?email=eq.${encodeURIComponent(petugasEmail)}&select=*`);
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
    item.nm_lengkap || '-',
    item.email || '-',
    item.jabatan || '-',
    formatPhoneNumber(item.nohp),
    item.alamat || '-',
    item.nmdesa || '-'
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
    txt += `${index + 1}. ${item.nm_lengkap || '-' }\n`;
    txt += `   Email   : ${item.email || '-'}\n`;
    txt += `   Jabatan : ${item.jabatan || '-'}\n`;
    txt += `   Telepon : ${formatPhoneNumber(item.nohp)}\n`;
    txt += `   Alamat  : ${item.alamat || '-'}\n`;
    txt += `   Desa    : ${item.nmdesa || '-'}\n`;
    txt += '-'.repeat(30) + '\n\n';
  });

  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Biodata_Petugas_SE2026_${new Date().toISOString().split('T')[0]}.txt`;
  link.click();
}

// Export supabase functions globally
window.supabase = {
  getAllBiodata,
  getBiodataById,
  getBiodataByEmail,
  updateBiodataPhone,
  updateBiodata,
  getAllAlokasi,
  getAlokasiByEmail,
  getAllProgres,
  getProgresByPetugas,
  setActiveSLS,
  getAllActiveSLS,
  removeActiveSLS,
  downloadBiodataCSV,
  downloadBiodataTXT,
  formatPhoneNumber
};
