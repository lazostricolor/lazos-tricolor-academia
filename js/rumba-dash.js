/* ═══════════════════════════════════════════════════════════
   rumba-dash.js
   Indicadores de Rumba en el Dashboard principal
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca

   SOLO LECTURA: lee las colecciones rumba_alumnas, rumba_pagos y
   rumba_asistencias (las que llena rumba.html). No escribe en DB, no
   llama saveAll() ni toca el documento de la academia.
   Usa el mismo FB_URL / FB_KEY y el token de sesión (fbHeaders).
═══════════════════════════════════════════════════════════ */

const RUMBA_DASH = {
  honorarioSemanal: 100000,
  diasClase: [1, 3, 5],            // lunes, miércoles, viernes
  vigenciaMs: 60000,               // vuelve a leer Firestore cada minuto como máximo
  datos: null, leidoEn: 0, cargando: null, error: ''
};

// ── Lectura REST ──
function rumbaDashBase(){
  const m = String(FB_URL).match(/^(.*\/documents)(\/|$)/);
  return m ? m[1] : '';
}
function rumbaDashValor(v){
  if(!v) return null;
  if('integerValue'   in v) return Number(v.integerValue);
  if('doubleValue'    in v) return Number(v.doubleValue);
  if('stringValue'    in v) return v.stringValue;
  if('booleanValue'   in v) return v.booleanValue;
  if('timestampValue' in v) return v.timestampValue;
  if('nullValue'      in v) return null;
  if('arrayValue'     in v) return (v.arrayValue.values || []).map(rumbaDashValor);
  if('mapValue'       in v){
    const o = {}, f = v.mapValue.fields || {};
    Object.keys(f).forEach(k => { o[k] = rumbaDashValor(f[k]); });
    return o;
  }
  return null;
}
async function rumbaDashColeccion(nombre){
  const docs = [];
  let token = '';
  for(let vuelta = 0; vuelta < 20; vuelta++){
    const url = rumbaDashBase() + '/' + nombre + '?key=' + FB_KEY + '&pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : '');
    const r = await fetch(url, { headers: await fbHeaders() });
    if(r.status === 403) throw new Error('Firestore no permitió leer los datos de rumba con esta cuenta.');
    if(!r.ok) throw new Error('No se pudieron leer los datos de rumba (' + r.status + ').');
    const j = await r.json();
    (j.documents || []).forEach(d => {
      const o = rumbaDashValor({ mapValue: { fields: d.fields || {} } });
      o.id = d.name.split('/').pop();
      docs.push(o);
    });
    token = j.nextPageToken || '';
    if(!token) break;
  }
  return docs;
}
function rumbaDashCargar(){
  if(RUMBA_DASH.cargando) return RUMBA_DASH.cargando;
  RUMBA_DASH.cargando = Promise.all([
    rumbaDashColeccion('rumba_alumnas'),
    rumbaDashColeccion('rumba_pagos'),
    rumbaDashColeccion('rumba_asistencias')
  ]).then(([alumnas, pagos, asistencias]) => {
    RUMBA_DASH.datos = { alumnas, pagos: pagos.filter(p => !p.anulado), asistencias };
    RUMBA_DASH.leidoEn = Date.now(); RUMBA_DASH.error = '';
  }).catch(e => { RUMBA_DASH.error = e.message; })
    .finally(() => { RUMBA_DASH.cargando = null; });
  return RUMBA_DASH.cargando;
}

// ── Cálculos ──
function rumbaDashFinMes(mk){
  const [y, m] = mk.split('-').map(Number);
  return mk + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
}
function rumbaDashActivas(mk){
  const fin = rumbaDashFinMes(mk), ini = mk + '-01';
  return RUMBA_DASH.datos.alumnas.filter(a =>
    (a.fechaIngreso || '') <= fin && (a.activa !== false || (a._retiroFecha || '9999') >= ini));
}
// Lunes de la semana en que empezó la rumba (primera inscripción o primer pago)
function rumbaDashInicio(){
  const D = RUMBA_DASH.datos;
  const fechas = D.alumnas.map(a => a.fechaIngreso).concat(D.pagos.map(p => p.fecha)).filter(Boolean).sort();
  if(!fechas.length) return null;
  const [y, m, d] = fechas[0].split('-').map(Number), f = new Date(y, m - 1, d);
  f.setDate(f.getDate() - ((f.getDay() + 6) % 7));
  return f;
}
// Semanas de honorario del mes = lunes del mes desde el inicio de la rumba (hasta hoy si es el mes actual)
function rumbaDashSemanas(mk){
  const hoy = new Date(), inicio = rumbaDashInicio(), [y, m] = mk.split('-').map(Number);
  if(!inicio) return 0;
  let n = 0;
  for(let d = new Date(y, m - 1, 1); d.getMonth() === m - 1; d.setDate(d.getDate() + 1)){
    if(d > hoy) break;
    if(d >= inicio && d.getDay() === 1) n++;
  }
  return n;
}
function rumbaDashMes(mk){
  const D = RUMBA_DASH.datos;
  const activas = rumbaDashActivas(mk);
  const pagosMes = D.pagos.filter(p => (p.fecha || '').slice(0, 7) === mk);
  const efectivo = pagosMes.filter(p => p.metodo === 'efectivo').reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const transferencia = pagosMes.filter(p => p.metodo === 'transferencia').reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const ingresos = efectivo + transferencia;
  const pagaron = new Set(pagosMes.map(p => p.alumnaId));
  const conPago = activas.filter(a => pagaron.has(a.id)).length;
  const regs = D.asistencias.filter(r => (r.fecha || r.id || '').slice(0, 7) === mk).sort((a, b) => (a.fecha || a.id).localeCompare(b.fecha || b.id));
  const presentes = regs.reduce((s, r) => s + (r.presentes || []).length, 0);
  const posibles = regs.reduce((s, r) => s + (Number(r.total) || 0), 0);
  const semanas = rumbaDashSemanas(mk);
  const honorarios = semanas * RUMBA_DASH.honorarioSemanal;
  const nuevas = D.alumnas.filter(a => (a.fechaIngreso || '').slice(0, 7) === mk).length;
  const retiradas = D.alumnas.filter(a => (a._retiroFecha || '').slice(0, 7) === mk).length;

  const pct_pago = activas.length ? Math.round(conPago / activas.length * 100) : 0;
  const pct_asist = posibles ? Math.round(presentes / posibles * 100) : 0;
  const pct_balance = ingresos > 0 ? Math.min(100, Math.round(Math.max(0, (ingresos - honorarios) / ingresos * 100))) : 0;
  const pct_crec = Math.min(100, Math.max(0, 50 + (nuevas - retiradas) * 10));
  return { activas, efectivo, transferencia, ingresos, conPago, regs, presentes, posibles, semanas, honorarios,
           nuevas, pct_pago, pct_asist, pct_balance, pct_crec,
           salud: Math.round((pct_pago + pct_asist + pct_balance + pct_crec) / 4) };
}

// ── Pintar ──
function renderRumbaDash(mk){
  const cont = document.getElementById('dash-rumba');
  if(!cont || !mk) return;
  const fresco = RUMBA_DASH.datos && (Date.now() - RUMBA_DASH.leidoEn) < RUMBA_DASH.vigenciaMs;
  if(!fresco){
    if(!RUMBA_DASH.datos) cont.innerHTML = rumbaDashTitulo(mk) + '<div class="table-card"><div style="padding:30px;text-align:center;color:var(--text2)">⏳ Cargando rumba…</div></div>';
    rumbaDashCargar().then(() => { if(mesSec.dash === mk) rumbaDashPintar(mk); });
    if(!RUMBA_DASH.datos) return;
  }
  rumbaDashPintar(mk);
}
function rumbaDashTitulo(mk){
  return `<div class="section-header" style="margin-top:8px">
    <div class="section-title">💃 Rumba — ${mesLabel(mk)}</div>
    <button class="btn-guardar" onclick="location.href='rumba.html'">Abrir Rumba</button>
  </div>`;
}
function rumbaDashPintar(mk){
  const cont = document.getElementById('dash-rumba');
  if(!cont) return;
  ['rumba-donut-pagos','rumba-donut-asist','rumba-donut-salud','rumba-chart-asist','rumba-chart-ing','rumba-chart-gastos'].forEach(id => {
    const el = document.getElementById(id);
    if(el && el._ch){ el._ch.destroy(); el._ch = null; }
  });
  if(RUMBA_DASH.error && !RUMBA_DASH.datos){
    cont.innerHTML = rumbaDashTitulo(mk) + `<div class="table-card"><div style="padding:24px;text-align:center;color:var(--danger)">${RUMBA_DASH.error}</div></div>`;
    return;
  }
  const r = rumbaDashMes(mk);
  const resultado = r.ingresos - r.honorarios;
  cont.innerHTML = rumbaDashTitulo(mk) + `
    <div class="cards-grid">
      <div class="stat-card"><div class="stat-icon-wrap col">💃</div><div class="stat-body"><div class="stat-label">Alumnas Rumba</div><div class="stat-val">${r.activas.length}</div><div class="stat-sub">${r.nuevas} nuevas este mes</div></div></div>
      <div class="stat-card"><div class="stat-icon-wrap suc">💰</div><div class="stat-body"><div class="stat-label">Ingresos Rumba</div><div class="stat-val">${formatCOP(r.ingresos)}</div><div class="stat-sub">Efectivo ${formatCOP(r.efectivo)} · Transf. ${formatCOP(r.transferencia)}</div></div></div>
      <div class="stat-card"><div class="stat-icon-wrap ven">🧾</div><div class="stat-body"><div class="stat-label">Gastos Rumba</div><div class="stat-val">${formatCOP(r.honorarios)}</div><div class="stat-sub">Honorarios: ${r.semanas} × ${formatCOP(RUMBA_DASH.honorarioSemanal)}</div></div></div>
      <div class="stat-card"><div class="stat-icon-wrap inf">📈</div><div class="stat-body"><div class="stat-label">Resultado Rumba</div><div class="stat-val" style="color:${resultado < 0 ? 'var(--danger)' : 'var(--success)'}">${resultado < 0 ? '−' : ''}${formatCOP(Math.abs(resultado))}</div><div class="stat-sub">Ingresos menos honorarios</div></div></div>
    </div>
    <div class="donuts-row">
      <div class="donut-card">
        <h4>💳 Pagos Recibidos</h4>
        <div class="donut-wrap"><canvas id="rumba-donut-pagos"></canvas><div class="donut-center"><span class="donut-pct" style="color:#1aa053">${r.pct_pago}%</span><span class="donut-sub">pagaron</span></div></div>
        <p style="font-size:11px;color:var(--text2);margin-top:6px">${r.conPago} de ${r.activas.length} alumnas con pago en el mes</p>
      </div>
      <div class="donut-card">
        <h4>📋 Asistencia Promedio</h4>
        <div class="donut-wrap"><canvas id="rumba-donut-asist"></canvas><div class="donut-center"><span class="donut-pct" style="color:#3a57e8">${r.pct_asist}%</span><span class="donut-sub">asistencia</span></div></div>
        <p style="font-size:11px;color:var(--text2);margin-top:6px">${r.presentes} de ${r.posibles} en ${r.regs.length} clases</p>
      </div>
      <div class="donut-card">
        <h4>🏥 Salud Rumba</h4>
        <div style="position:relative;width:200px;height:200px;margin:0 auto">
          <canvas id="rumba-donut-salud"></canvas>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">
            <span style="font-size:26px;font-weight:900;color:${r.salud >= 70 ? '#1aa053' : r.salud >= 40 ? '#f4a916' : '#c03221'}">${r.salud}%</span>
            <span style="font-size:10px;color:var(--text2);font-weight:600">SALUD</span>
          </div>
        </div>
      </div>
    </div>
    <div class="charts-row">
      <div class="chart-card"><h4>📋 Asistencia por Clase — ${mesLabel(mk)} (%)</h4><canvas id="rumba-chart-asist" style="max-height:200px"></canvas></div>
      <div class="chart-card"><h4>💰 Ingresos Rumba — 6 meses (miles $)</h4><canvas id="rumba-chart-ing" style="max-height:200px"></canvas></div>
      <div class="chart-card"><h4>💸 Gastos Rumba — 6 meses (miles $)</h4><canvas id="rumba-chart-gastos" style="max-height:200px"></canvas></div>
    </div>`;

  // Datos de 6 meses
  const meses = [], ingEf = [], ingTr = [], honor = [];
  for(let i = 5; i >= 0; i--){
    const k = sumarMes(mk, -i), x = rumbaDashMes(k);
    meses.push(mesLabel(k).slice(0, 3) + ' ' + k.slice(2, 4));
    ingEf.push(Math.round(x.efectivo / 1000)); ingTr.push(Math.round(x.transferencia / 1000)); honor.push(Math.round(x.honorarios / 1000));
  }
  const tc = '#8a92a6', gc = 'rgba(0,0,0,.06)';
  const leyenda = { position: 'top', labels: { color: tc, font: { size: 10 }, boxWidth: 10, padding: 8 } };
  const ejes = apilado => ({
    x: { ticks: { color: tc, font: { size: 9 } }, grid: { color: gc }, stacked: apilado },
    y: { ticks: { color: tc, font: { size: 9 } }, grid: { color: gc }, beginAtZero: true, stacked: apilado }
  });

  setTimeout(() => {
    const anillo = (id, pct, color, fondo) => {
      const el = document.getElementById(id);
      if(el) el._ch = new Chart(el, { type: 'doughnut', data: { datasets: [{ data: [pct, 100 - pct], backgroundColor: [color, fondo], borderWidth: 0 }] },
        options: { cutout: '78%', plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { duration: 700 } } });
    };
    anillo('rumba-donut-pagos', r.pct_pago, '#1aa053', '#e8f5ee');
    anillo('rumba-donut-asist', r.pct_asist, '#3a57e8', '#eef0fd');

    const cs = document.getElementById('rumba-donut-salud');
    if(cs){
      const inds = [
        { l: 'Pagos', v: r.pct_pago, c: '#1aa053' },
        { l: 'Asistencia', v: r.pct_asist, c: '#3a57e8' },
        { l: 'Balance', v: r.pct_balance, c: '#c98000' },
        { l: 'Crecimiento', v: r.pct_crec, c: '#d6006a' }
      ];
      cs._ch = new Chart(cs, { type: 'doughnut',
        data: { labels: inds.map(i => i.l + ' (' + i.v + '%)'), datasets: [{ data: inds.map(i => Math.max(i.v, 2)),
          backgroundColor: inds.map(i => i.c + 'cc'), borderColor: inds.map(i => i.c), borderWidth: 2, hoverOffset: 8 }] },
        options: { responsive: true, maintainAspectRatio: true, cutout: '55%',
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + c.label } } }, animation: { duration: 800 } } });
    }

    const ea = document.getElementById('rumba-chart-asist');
    if(ea) ea._ch = new Chart(ea, { type: 'bar',
      data: { labels: r.regs.map(x => { const f = (x.fecha || x.id).split('-'); return f[2] + '/' + f[1]; }),
        datasets: [{ label: 'Asistencia %', data: r.regs.map(x => x.total ? Math.round((x.presentes || []).length / x.total * 100) : 0), backgroundColor: 'rgba(58,87,232,.75)' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: leyenda },
        scales: { x: ejes(false).x, y: Object.assign(ejes(false).y, { max: 100 }) } } });

    const ei = document.getElementById('rumba-chart-ing');
    if(ei) ei._ch = new Chart(ei, { type: 'bar',
      data: { labels: meses, datasets: [
        { label: 'Efectivo', data: ingEf, backgroundColor: 'rgba(201,168,0,.85)', stack: 'i' },
        { label: 'Transferencia', data: ingTr, backgroundColor: 'rgba(26,160,83,.85)', stack: 'i' }
      ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: leyenda }, scales: ejes(true) } });

    const eg = document.getElementById('rumba-chart-gastos');
    if(eg) eg._ch = new Chart(eg, { type: 'bar',
      data: { labels: meses, datasets: [{ label: 'Honorarios profesor', data: honor, backgroundColor: 'rgba(58,87,232,.75)' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: leyenda }, scales: ejes(false) } });
  }, 120);
}
