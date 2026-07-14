/* ═══════════════════════════════════════════════════════════
   planificador.js
   Calendario, festivos, cumpleaños y eventos
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== PLANIFICADOR =====================
const FESTIVOS = {
  // 2025
  '2025-01-01':'Año Nuevo','2025-01-06':'Reyes Magos','2025-03-24':'Día de San José',
  '2025-04-17':'Jueves Santo','2025-04-18':'Viernes Santo','2025-05-01':'Día del Trabajo',
  '2025-06-02':'Ascensión del Señor','2025-06-23':'Corpus Christi','2025-06-30':'Sagrado Corazón / San Pedro y San Pablo',
  '2025-07-20':'Día de la Independencia','2025-08-07':'Batalla de Boyacá',
  '2025-08-18':'Asunción de la Virgen','2025-10-13':'Día de la Raza',
  '2025-11-03':'Todos los Santos','2025-11-17':'Independencia de Cartagena',
  '2025-12-08':'Inmaculada Concepción','2025-12-25':'Navidad',
  // 2026
  '2026-01-01':'Año Nuevo','2026-01-12':'Reyes Magos','2026-03-23':'Día de San José',
  '2026-04-02':'Jueves Santo','2026-04-03':'Viernes Santo','2026-05-01':'Día del Trabajo',
  '2026-05-18':'Ascensión del Señor','2026-06-08':'Corpus Christi',
  '2026-06-15':'Sagrado Corazón de Jesús','2026-06-29':'San Pedro y San Pablo',
  '2026-07-20':'Día de la Independencia','2026-08-07':'Batalla de Boyacá',
  '2026-08-17':'Asunción de la Virgen','2026-10-12':'Día de la Raza',
  '2026-11-02':'Todos los Santos','2026-11-16':'Independencia de Cartagena',
  '2026-12-08':'Inmaculada Concepción','2026-12-25':'Navidad',
};

let calOfs = 0; // offset de meses desde hoy
let editEventoId = null;

function getCalMes(){
  const hoy = getHoyReal();
  const d = new Date(hoy.getFullYear(), hoy.getMonth() + calOfs, 1);
  return d;
}

function cambiarMesCal(delta){ calOfs += delta; renderPlanificador(); }
function irHoyCal(){ calOfs = 0; renderPlanificador(); }

function renderPlanificador(){
  const mes = getCalMes();
  const año = mes.getFullYear();
  const mesIdx = mes.getMonth();
  const hoy = getHoyReal();
  const hoyStr = dateStr(hoy);

  document.getElementById('cal-label').textContent =
    ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][mesIdx]
    + ' ' + año;

  // ── Cumpleañeros del mes visible ──
  const mesMkStr = String(mesIdx+1).padStart(2,'0');
  const cumpleMesVis = todosLosAlumnos().filter(a=>{
    if(!a.nacimiento||a.nacimiento.length<7) return false;
    return a.nacimiento.split('-')[1]===mesMkStr;
  });
  // Mapa fecha → alumnas que cumplen ese día en el año visible
  const cumpleMap = {};
  cumpleMesVis.forEach(a=>{
    const dia = a.nacimiento.split('-')[2]; // "15"
    const fecha = año+'-'+mesMkStr+'-'+dia;
    if(!cumpleMap[fecha]) cumpleMap[fecha]=[];
    cumpleMap[fecha].push(a.nombre.split(' ')[0]);
  });

  // ── Alertas: festivos, eventos y cumpleaños próximos (14 días) ──
  const alertasDiv = document.getElementById('cal-alertas');
  const proximos = [];
  for(let d=0; d<14; d++){
    const f = new Date(hoy); f.setDate(hoy.getDate()+d);
    const fs = dateStr(f);
    if(FESTIVOS[fs]) proximos.push({tipo:'festivo', fecha:fs, texto:FESTIVOS[fs], dias:d});
    (DB.planificador||[]).filter(e=>e.fecha===fs).forEach(e=>{
      proximos.push({tipo:'evento', fecha:fs, texto:e.titulo, dias:d, tipo2:e.tipo});
    });
    if(cumpleMap[fs]) proximos.push({tipo:'cumple', fecha:fs, texto:'🎂 '+cumpleMap[fs].join(', '), dias:d});
  }
  alertasDiv.innerHTML = proximos.slice(0,5).map(p=>`
    <div class="cal-alerta ${p.tipo==='festivo'?'festivo':p.tipo==='cumple'?'cumple':'evento'}">
      <span style="font-size:18px">${p.tipo==='festivo'?'🇨🇴':p.tipo==='cumple'?'🎂':'📌'}</span>
      <div>
        <strong>${p.dias===0?'Hoy':p.dias===1?'Mañana':'En '+p.dias+' días'}</strong> —
        ${p.texto}
        <span style="font-size:11px;opacity:.7;margin-left:4px">${p.fecha}</span>
      </div>
    </div>
  `).join('') || '';

  // ── Grid del calendario ──
  // Primer día del mes y total de días
  const primerDia = new Date(año, mesIdx, 1).getDay(); // 0=dom
  const diasMes = new Date(año, mesIdx+1, 0).getDate();
  // Ajustar para que empiece el lunes (Colombia)
  const inicio = primerDia === 0 ? 6 : primerDia - 1;
  const diasAnt = new Date(año, mesIdx, 0).getDate();

  let celdasHTML = '';
  let totalCeldas = Math.ceil((inicio + diasMes) / 7) * 7;

  for(let i=0; i<totalCeldas; i++){
    let dia, esEsteMes = true;
    if(i < inicio){ dia = diasAnt - inicio + i + 1; esEsteMes = false; }
    else if(i >= inicio + diasMes){ dia = i - inicio - diasMes + 1; esEsteMes = false; }
    else dia = i - inicio + 1;

    const fechaCelda = esEsteMes
      ? `${año}-${String(mesIdx+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
      : '';

    const esFestivo = fechaCelda && FESTIVOS[fechaCelda];
    const esHoy = fechaCelda === hoyStr;
    const esDomingo = (i % 7 === 6); // columna 7 = domingo (lun=0...dom=6)
    const esSabado = (i % 7 === 5);
    const eventosDia = fechaCelda ? (DB.planificador||[]).filter(e=>e.fecha===fechaCelda) : [];
    const cumplesDia = fechaCelda && cumpleMap[fechaCelda] ? cumpleMap[fechaCelda] : [];

    let clases = 'cal-dia';
    if(!esEsteMes) clases += ' otro-mes';
    if(esHoy) clases += ' hoy';
    if(esFestivo) clases += ' festivo';
    if(esDomingo) clases += ' domingo';

    celdasHTML += `<div class="${clases}" onclick="${fechaCelda?`abrirModalEvento('${fechaCelda}')`:''}" style="${esSabado||esDomingo?'background:rgba(0,0,0,.015)':''}">
      <div class="cal-num">${dia}</div>
      ${esFestivo?`<span class="cal-festivo-tag">🇨🇴 ${FESTIVOS[fechaCelda].length>18?FESTIVOS[fechaCelda].substring(0,16)+'…':FESTIVOS[fechaCelda]}</span>`:''}
      ${cumplesDia.map(n=>'<span class="cal-evento-tag cumple">🎂 '+n+'</span>').join('')}
      ${eventosDia.map(e=>`
        <span class="cal-evento-tag ${e.tipo}" onclick="event.stopPropagation();editarEventoCal('${e.id}')">${e.titulo}</span>
      `).join('')}
    </div>`;
  }

  document.getElementById('cal-grid').innerHTML = `
    <div class="cal-header-dias">
      ${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>`<div class="cal-header-dia">${d}</div>`).join('')}
    </div>
    <div class="cal-grid">${celdasHTML}</div>
  `;

  // ── Lista de eventos del mes ──
  const eventosMes = (DB.planificador||[])
    .filter(e=>e.fecha&&e.fecha.startsWith(`${año}-${String(mesIdx+1).padStart(2,'0')}`))
    .sort((a,b)=>a.fecha.localeCompare(b.fecha));

  // Filas de cumpleaños para la tabla del mes
  const cumpleFilas = Object.entries(cumpleMap)
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([fecha,nombres])=>{
      const dd = new Date(fecha+'T12:00');
      return '<tr style="background:rgba(255,107,53,.04)">'
        +'<td style="font-size:12px">'+fecha+'</td>'
        +'<td style="font-size:12px">'+['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][dd.getDay()]+'</td>'
        +'<td style="font-size:13px;font-weight:600">🎂 '+nombres.join(' · ')+'</td>'
        +'<td><span style="background:rgba(255,107,53,.12);color:#c95000;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700">Cumpleaños</span></td>'
        +'<td></td>'
        +'</tr>';
    }).join('');

  const festivosMes = Object.entries(FESTIVOS)
    .filter(([f])=>f.startsWith(`${año}-${String(mesIdx+1).padStart(2,'0')}`))
    .sort(([a],[b])=>a.localeCompare(b));

  const listDiv = document.getElementById('cal-eventos-mes');
  if(!eventosMes.length && !festivosMes.length){
    listDiv.innerHTML=''; return;
  }

  listDiv.innerHTML = `
    <div class="table-card">
      <div class="table-card-header"><h3>Eventos y festivos del mes</h3></div>
      <table>
        <thead><tr><th>Fecha</th><th>Día</th><th>Evento</th><th>Tipo</th><th></th></tr></thead>
        <tbody>
          ${cumpleFilas}
          ${festivosMes.map(([f,n])=>`<tr>
            <td style="font-size:12px">${f}</td>
            <td style="font-size:12px">${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][new Date(f+'T12:00').getDay()]}</td>
            <td style="font-size:13px;font-weight:600">🇨🇴 ${n}</td>
            <td><span class="badge badge-unpaid" style="font-size:10px">Festivo</span></td>
            <td></td>
          </tr>`).join('')}
          ${eventosMes.map(e=>`<tr>
            <td style="font-size:12px">${e.fecha}</td>
            <td style="font-size:12px">${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][new Date(e.fecha+'T12:00').getDay()]}</td>
            <td style="font-size:13px;font-weight:600">${e.titulo}${e.desc?`<div style="font-size:11px;color:var(--text2);font-weight:400">${e.desc}</div>`:''}</td>
            <td><span class="cal-evento-tag ${e.tipo}" style="display:inline-block">${{academia:'🎭 Academia',ensayo:'💃 Ensayo',presentacion:'🏆 Presentación',pago:'💳 Cobro',otro:'📌 Otro'}[e.tipo]||e.tipo}</span></td>
            <td><div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="editarEventoCal('${e.id}')">✏️</button>
              <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarEventoCal('${e.id}')">🗑️</button>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function abrirModalEvento(fecha=''){
  editEventoId = null;
  document.getElementById('modal-evento-title').textContent = 'Nuevo Evento';
  document.getElementById('ev-cal-titulo').value = '';
  document.getElementById('ev-cal-fecha').value = fecha || dateStr(getHoyReal());
  document.getElementById('ev-cal-tipo').value = 'academia';
  document.getElementById('ev-cal-hora').value = '';
  document.getElementById('ev-cal-desc').value = '';
  abrirModal('modal-evento');
}

function editarEventoCal(id){
  const e = (DB.planificador||[]).find(x=>x.id===id);
  if(!e) return;
  editEventoId = id;
  document.getElementById('modal-evento-title').textContent = 'Editar Evento';
  document.getElementById('ev-cal-titulo').value = e.titulo;
  document.getElementById('ev-cal-fecha').value = e.fecha;
  document.getElementById('ev-cal-tipo').value = e.tipo;
  document.getElementById('ev-cal-hora').value = e.hora||'';
  document.getElementById('ev-cal-desc').value = e.desc||'';
  abrirModal('modal-evento');
}

function guardarEventoCal(){
  const titulo = document.getElementById('ev-cal-titulo').value.trim();
  const fecha  = document.getElementById('ev-cal-fecha').value;
  if(!titulo||!fecha){ toast('Título y fecha son obligatorios','err'); return; }
  if(!DB.planificador) DB.planificador=[];
  const ev = {
    id: editEventoId || String(Date.now()),
    titulo,fecha,
    hora: document.getElementById('ev-cal-hora').value||'',
    tipo: document.getElementById('ev-cal-tipo').value,
    desc: document.getElementById('ev-cal-desc').value.trim()
  };
  if(editEventoId){
    const idx = DB.planificador.findIndex(x=>x.id===editEventoId);
    if(idx>=0) DB.planificador[idx]=ev;
  } else {
    DB.planificador.push(ev);
  }
  tsSeccion('planificador');
  cerrarModal('modal-evento');
  saveBackground();
  renderPlanificador();
  toast('📅 Evento guardado ✓');
}

function eliminarEventoCal(id){
  if(!confirm('¿Eliminar este evento?')) return;
  DB.planificador=(DB.planificador||[]).filter(e=>e.id!==id);
  saveBackground(); renderPlanificador(); toast('Evento eliminado');
}




// ── Honorarios reales del mes calculados desde DB.clases (semanas) ──
function honorariosMes(mk){
  let total = 0;
  DB.profesores.forEach(p=>{
    Object.entries(DB.clases[p.id]||{}).forEach(([sk, clases])=>{
      // sk = "YYYY-MM-DD_YYYY-MM-DD" — usar el inicio de semana para filtrar
      const inicioSemana = sk.substring(0,7); // YYYY-MM
      if(inicioSemana === mk) total += Number(clases||0) * HONOR_POR_CLASE;
    });
  });
  return total;
}


// ── Total ingresos del mes (mensualidades pagadas + otros ingresos) ──
function totalIngresosMes(mk){
  let mens=0;
  getAlumnasMes(mk).forEach(a=>{
    const p=getPago(a.id,mk);
    if(p.pagado){
      const v=calcMensualidad(a,mk);
      mens+=p.beca?Math.floor(v/2):v;
    }
  });
  const otros=totalOtrosIngresosMes(mk);
  return mens+otros;
}

// ── Total gastos del mes (honorarios + gastos varios) ──
function totalGastosMes(mk){
  const gastosFinanzas=(DB.gastos||[]).filter(g=>g.mes===mk).reduce((s,g)=>s+Number(g.monto),0);
  const varios=(DB.gastosV||[]).filter(g=>g.mes===mk).reduce((s,g)=>s+Number(g.monto),0);
  const honor=honorariosMes(mk);
  return gastosFinanzas+varios+honor;
}
