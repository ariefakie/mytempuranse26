// ====================================================
// SLS STATISTICS (Optimized with Caching)
// ====================================================
var _slsCache = null, _slsTime = 0;

function getSLSStats() {
  var now = Date.now();
  if (!_slsCache || (now - _slsTime) > 30000) {
    var map = {};
    // Build lookup from alokasi
    AppData.alokasi.forEach(function(a) {
      var key = a.kddesa + '-' + a.kdsls;
      if (!map[key]) {
        map[key] = {idsubsls:a.idsubsls, nmdes:a.nmdes, nmsls:a.nmsls, ppl:a.ppl, umkm_t:a.umkm||0, fasih_t:a.fasih||0, total:0, open:0, umkm_a:0, fasih_a:0};
      }
    });
    // Match progres
    AppData.progres.forEach(function(pr) {
      var key = pr.kode_desa + '-' + pr.kode_sls;
      var s = map[key];
      if (s) {
        s.total++;
        var skala = (pr.skala_usaha||'').toLowerCase();
        if (skala.indexOf('keluarga') >= 0) s.fasih_a++; else s.umkm_a++;
        var status = (pr.status||'').toLowerCase();
        if (status === 'open') s.open++;
      }
    });
    // Convert and sort
    _slsCache = Object.values(map).filter(function(x){return x.total>0;}).map(function(x){
      var pct = x.total > 0 ? ((x.total - x.open) / x.total * 100).toFixed(1) : '0';
      return {idsubsls:x.idsubsls, nmdes:x.nmdes, nmsls:x.nmsls, ppl:x.ppl, umkm_t:x.umkm_t, fasih_t:x.fasih_t, umkm_a:x.umkm_a, fasih_a:x.fasih_a, total:x.total, open:x.open, pct:pct};
    }).sort(function(a,b){return parseFloat(b.pct)-parseFloat(a.pct);});
    _slsTime = now;
    console.log('[SLS] Cached ' + _slsCache.length + ' SLS');
  }
  return _slsCache;
}

function renderSLSStats() {
  var el = document.getElementById('slsStatsContainer');
  if (!el) return;
  el.innerHTML = '<div style="padding:40px;text-align:center"><div class="spinner" style="margin:0 auto"></div><p style="margin-top:12px">Memuat...</p></div>';
  setTimeout(function() {
    var list = getSLSStats();
    if (!list || !list.length) { el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-dim)"><p>Belum ada data</p></div>'; return; }
    var html = '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--bg-2)"><th style="padding:10px 6px;text-align:left">SLS</th><th style="padding:10px 6px;text-align:center">PPL</th><th style="padding:10px 6px;text-align:center">UMKM</th><th style="padding:10px 6px;text-align:center">FASIH</th><th style="padding:10px 6px;text-align:center">Open</th><th style="padding:10px 6px;text-align:center">%</th></tr></thead><tbody>';
    list.slice(0,30).forEach(function(s) {
      html += '<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="showSLSDetail(\''+s.idsubsls+'\')">';
      html += '<td style="padding:8px 6px"><div style="font-weight:600">'+(s.nmsls||'-').substring(0,18)+'</div><div style="font-size:10px;color:var(--text-dim)">'+s.nmdes+'</div></td>';
      html += '<td style="padding:8px 6px;text-align:center"><span class="badge badge-info" style="font-size:9px">'+(s.ppl||'-').split(' ')[0]+'</span></td>';
      html += '<td style="padding:8px 6px;text-align:center;font-weight:700;color:'+(s.umkm_t>0&&s.umkm_a/s.umkm_t>=1?'#10b981':s.umkm_t>0&&s.umkm_a/s.umkm_t>=0.5?'#f59e0b':'#ef4444')+'">'+s.umkm_a+'/'+s.umkm_t+'</td>';
      html += '<td style="padding:8px 6px;text-align:center;font-weight:700;color:'+(s.fasih_t>0&&s.fasih_a/s.fasih_t>=1?'#10b981':s.fasih_t>0&&s.fasih_a/s.fasih_t>=0.5?'#f59e0b':'#ef4444')+'">'+s.fasih_a+'/'+s.fasih_t+'</td>';
      html += '<td style="padding:8px 6px;text-align:center;color:#64748b">'+s.open+'</td>';
      html += '<td style="padding:8px 6px;text-align:center;font-weight:700">'+(parseFloat(s.pct)>=50?'<span style="color:#10b981">':'<span style="color:#f59e0b">')+s.pct+'%</span></td></tr>';
    });
    html += '</tbody></table>';
    if (list.length > 30) html += '<div style="padding:12px;text-align:center;color:var(--text-dim);font-size:12px;border-top:1px solid var(--border)">30/'+list.length+' SLS</div>';
    el.innerHTML = html;
  }, 50);
}

// Modal detail
window.showSLSDetail = function(id) {
  var alok = AppData.alokasi.find(function(a){return a.idsubsls===id;});
  if (!alok) return;
  var prog = AppData.progres.filter(function(r){return r.kode_sls.trim()===alok.kdsls.trim()&&r.kode_desa.trim()===alok.kddesa.trim();});
  var sc = {open:0}, ua=0, fa=0;
  prog.forEach(function(p) {
    if ((p.status||'').toLowerCase()==='open') sc.open++;
    if ((p.skala_usaha||'').toLowerCase().indexOf('keluarga')>=0) fa++; else ua++;
  });
  var tot=prog.length, done=tot-sc.open, pct=tot>0?(done/tot*100).toFixed(1):'0';
  var ut=alok.umkm||0, ft=alok.fasih||0;
  var up=ut>0?Math.min(100,Math.round(ua/ut*100)):0, fp=ft>0?Math.min(100,Math.round(fa/ft*100)):0;
  openModal('<div class="modal-title">'+alok.nmsls+'</div>'+
    '<div class="modal-section"><div class="modal-section-title">Target vs Actual</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
    '<div style="padding:16px;background:rgba(245,158,11,0.1);border-radius:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:#f59e0b">'+ua+'/'+ut+'</div><div style="font-size:11px;color:var(--text-dim)">UMKM ('+up+'%)</div></div>'+
    '<div style="padding:16px;background:rgba(16,185,129,0.1);border-radius:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:#10b981">'+fa+'/'+ft+'</div><div style="font-size:11px;color:var(--text-dim)">FASIH ('+fp+'%)</div></div></div></div>'+
    '<div class="modal-section"><div class="modal-section-title">Progres: '+done+'/'+tot+' ('+pct+'%)</div></div>');
};
