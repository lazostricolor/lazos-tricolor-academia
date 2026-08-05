/* ═══════════════════════════════════════════════════════════
   estado-cuenta.js
   Estado de cuenta anual por alumna — abonos en cascada y PDF
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca

   MODELO DE DATOS
   Los abonos viven DENTRO del registro de la alumna:
       alumna.abonos = { [abonoId]: {fecha, monto, nota, _editTs} }
   Se eligió así a propósito: DB.alumnos ya se fusiona registro por
   registro con _fusionarArrayPorId + _editTs en firebase.js, de modo
   que los abonos heredan una ruta de merge ya probada en producción.
   No se agrega ninguna llave nueva al objeto DB.

   REGLAS QUE RESPETA
   - Nombres de función únicos: todo va con prefijo ec*
   - Al editar se actualiza SOLO el campo que cambia (abonos / _editTs)
   - Marca sello de tiempo con tsSeccion('alumnos') en cada guardado
   - No dice "guardado" hasta que saveAll() confirme
═══════════════════════════════════════════════════════════ */

// ===================== CONSTANTES =====================
/* Logo del encabezado del PDF.
   Puede ser una ruta del repositorio ('logo.png') o una imagen incrustada
   en base64 ('data:image/png;base64,...'). Si queda vacío, el PDF sale
   igual pero sin logo. La base64 es más confiable: no depende de la red
   ni de permisos CORS al momento de renderizar.                          */
const EC_LOGO = 'logo.png';
const EC_MESES_NOM = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

let ecAlumnaId = null;
let ecAnio = null;

// ===================== HELPERS =====================
function ecBuscarAlumna(id){
  return (DB.alumnos||[]).find(x=>x.id===id) || (DB.alumnosRetirados||[]).find(x=>x.id===id) || null;
}
function ecMesNombre(mk){
  return EC_MESES_NOM[parseInt(mk.split('-')[1],10)-1] || mk;
}
function ecFechaLarga(f){
  if(!f || f.length<10) return f||'—';
  const [y,m,d]=f.split('-');
  return parseInt(d,10)+' de '+EC_MESES_NOM[parseInt(m,10)-1].toLowerCase()+' de '+y;
}
// Nombre de archivo seguro: quita tildes y caracteres raros sin usar
// rangos Unicode en la expresión regular (más portable entre navegadores)
function ecNombreArchivo(nombre){
  const con = 'áàäâãÁÀÄÂÃéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑçÇ';
  const sin = 'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcC';
  let r = '';
  for(const ch of String(nombre||'')){
    const i = con.indexOf(ch);
    r += i >= 0 ? sin[i] : ch;
  }
  r = r.replace(/[^A-Za-z0-9 _-]/g,'').trim().replace(/\s+/g,'-');
  return r || 'alumna';
}
function ecEscapar(s){
  return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// Lista ordenada de abonos de una alumna, filtrada por año
function ecListarAbonos(id, anio){
  const a = ecBuscarAlumna(id);
  if(!a || !a.abonos) return [];
  const mapa = a.abonos;
  return Object.keys(mapa)
    .map(k=>({...mapa[k], _key:k}))
    .filter(x=> x && x.fecha && Number(x.monto)>0 && (!anio || x.fecha.substring(0,4)===String(anio)))
    .sort((p,q)=> p.fecha===q.fecha ? String(p._key).localeCompare(String(q._key)) : (p.fecha<q.fecha?-1:1));
}
// Años con actividad (ingreso, pagos o abonos) para el selector
function ecAniosDisponibles(id){
  const a = ecBuscarAlumna(id);
  const set = new Set();
  const anioHoy = parseInt(getMesHoy().split('-')[0],10);
  set.add(anioHoy);
  if(a && a.fechaIngreso && a.fechaIngreso.length>=4) set.add(parseInt(a.fechaIngreso.substring(0,4),10));
  Object.keys((DB.pagos&&DB.pagos[id])||{}).forEach(mk=>set.add(parseInt(mk.substring(0,4),10)));
  if(a && a.abonos) Object.keys(a.abonos).forEach(k=>{
    const f=a.abonos[k] && a.abonos[k].fecha;
    if(f) set.add(parseInt(f.substring(0,4),10));
  });
  const ini = Math.min(...set), fin = Math.max(anioHoy, ...set);
  const out=[];
  for(let y=fin; y>=ini; y--) out.push(y);
  return out;
}

// ===================== MOTOR DE CÁLCULO =====================
/* Devuelve el estado de cuenta anual completo.
   - Recorre enero..mes actual del año pedido
   - Salta meses anteriores a la fechaIngreso (alumnaActivaEnMes)
   - Valor del mes: calcMensualidad() + regla de beca de pagos.js
   - Los meses con p.pagado === true quedan SALDADOS y fuera del reparto
   - Los abonos se aplican en cascada al mes más antiguo con saldo    */
function ecCalcularEstado(id, anio){
  const a = ecBuscarAlumna(id);
  if(!a) return null;

  const mkHoy = getMesHoy();
  const meses = [];

  for(let m=1; m<=12; m++){
    const mk = anio+'-'+String(m).padStart(2,'0');
    if(mk > mkHoy) break;                    // solo hasta el mes actual
    if(!alumnaActivaEnMes(a, mk)) continue;  // respeta la fecha de ingreso
    const p    = getPago(a.id, mk);
    const base = calcMensualidad(a, mk);
    const real = p.beca ? Math.floor(base/2) : base;
    meses.push({
      mk, base, valor: real,
      beca: !!p.beca,
      saldado: !!p.pagado,
      fechaPago: p.fechaPago || null,
      abonado: p.pagado ? real : 0,
      aplicaciones: []
    });
  }

  // Reparto en cascada sobre los meses NO saldados
  const abonos = ecListarAbonos(id, anio).map(ab=>({
    key: ab._key,
    fecha: ab.fecha,
    monto: Number(ab.monto),
    nota: ab.nota || '',
    destino: [],
    excedente: 0
  }));

  const pendientes = meses.filter(m=>!m.saldado);
  let idx = 0;
  abonos.forEach(pg=>{
    let resto = pg.monto;
    while(resto > 0 && idx < pendientes.length){
      const m = pendientes[idx];
      const falta = m.valor - m.abonado;
      if(falta <= 0){ idx++; continue; }
      const aplica = Math.min(resto, falta);
      m.abonado += aplica;
      resto -= aplica;
      m.aplicaciones.push({fecha: pg.fecha, monto: aplica});
      pg.destino.push({mk: m.mk, monto: aplica});
      if(m.abonado >= m.valor) idx++;
    }
    if(resto > 0) pg.excedente = resto;   // saldo a favor
  });

  // Estado de cada mes
  meses.forEach(m=>{
    m.saldo = Math.max(0, m.valor - m.abonado);
    if(m.saldado)               m.estado = 'Pagado';
    else if(m.abonado >= m.valor) m.estado = 'Pagado';
    else if(m.abonado > 0)        m.estado = 'Abono parcial';
    else                          m.estado = 'Pendiente';
  });

  const totalCausado = meses.reduce((s,m)=>s+m.valor, 0);
  const totalAbonado = meses.reduce((s,m)=>s+m.abonado, 0);
  const totalAbonos  = abonos.reduce((s,p)=>s+p.monto, 0);
  const aFavor       = abonos.reduce((s,p)=>s+p.excedente, 0);

  return {
    alumna: a, anio, meses, abonos,
    totalCausado, totalAbonado, totalAbonos, aFavor,
    saldo: Math.max(0, totalCausado - totalAbonado),
    mesCorte: mkHoy
  };
}

// ===================== MODAL =====================
function abrirEstadoCuenta(id){
  const a = ecBuscarAlumna(id);
  if(!a){ toast('Alumna no encontrada','err'); return; }
  ecAlumnaId = id;
  ecAnio = parseInt(getMesHoy().split('-')[0],10);
  ecRenderEstadoCuenta();
  abrirModal('modal-estado-cuenta');
}
function ecCambiarAnio(v){
  ecAnio = parseInt(v,10);
  ecRenderEstadoCuenta();
}
function ecRenderEstadoCuenta(){
  const est = ecCalcularEstado(ecAlumnaId, ecAnio);
  if(!est) return;
  const a = est.alumna;

  document.getElementById('modal-ec-title').textContent = 'Estado de cuenta — '+a.nombre;

  const anios = ecAniosDisponibles(ecAlumnaId);
  const selAnio = `<select id="ec-anio" onchange="ecCambiarAnio(this.value)"
      style="padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-weight:600">
      ${anios.map(y=>`<option value="${y}" ${y===ecAnio?'selected':''}>${y}</option>`).join('')}
    </select>`;

  const condiciones = [];
  if(a.familiar) condiciones.push('👨‍👩‍👧 Descuento familiar');
  if(est.meses.some(m=>m.beca)) condiciones.push('🎓 Media beca (en meses marcados)');
  if(!condiciones.length) condiciones.push('Tarifa plena');

  // ── Formulario de abono ──
  const formAbono = `
    <div style="background:rgba(58,87,232,.05);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:14px">
      <div style="font-weight:700;font-size:13px;margin-bottom:8px">➕ Registrar abono</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
        <div style="flex:1;min-width:130px">
          <label style="font-size:11px;color:var(--muted)">Fecha del pago</label>
          <input type="date" id="ec-abono-fecha" value="${dateStr(getHoyReal())}"
            style="width:100%;padding:7px;border:1px solid var(--border);border-radius:8px">
        </div>
        <div style="flex:1;min-width:110px">
          <label style="font-size:11px;color:var(--muted)">Monto</label>
          <input type="number" id="ec-abono-monto" placeholder="100000" min="1" step="1000"
            style="width:100%;padding:7px;border:1px solid var(--border);border-radius:8px">
        </div>
        <div style="flex:1.4;min-width:140px">
          <label style="font-size:11px;color:var(--muted)">Nota (opcional)</label>
          <input type="text" id="ec-abono-nota" placeholder="Nequi, efectivo…"
            style="width:100%;padding:7px;border:1px solid var(--border);border-radius:8px">
        </div>
        <button class="btn btn-primary btn-sm" onclick="ecGuardarAbono()">💾 Agregar</button>
      </div>
    </div>`;

  // ── Tabla de abonos registrados ──
  const filasAbonos = est.abonos.length
    ? est.abonos.map(p=>{
        const destino = p.destino.length
          ? p.destino.map(d=>`${ecMesNombre(d.mk)} (${formatCOP(d.monto)})`).join(' · ')
          : '—';
        return `<tr>
          <td style="white-space:nowrap">${ecFechaLarga(p.fecha)}</td>
          <td style="text-align:right;font-weight:700">${formatCOP(p.monto)}</td>
          <td style="font-size:12px">${destino}${p.excedente?` <span style="color:var(--muted)">· a favor ${formatCOP(p.excedente)}</span>`:''}</td>
          <td style="font-size:12px;color:var(--muted)">${ecEscapar(p.nota)}</td>
          <td><button class="btn btn-danger btn-sm btn-icon" title="Eliminar abono"
                onclick="ecEliminarAbono('${p.key}')">🗑️</button></td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:14px">Sin abonos registrados en ${est.anio}</td></tr>`;

  // ── Tabla mes a mes ──
  const colorEstado = e => e==='Pagado' ? '#1aa053' : e==='Abono parcial' ? '#b45309' : '#b01020';
  const filasMeses = est.meses.length
    ? est.meses.map(m=>`<tr>
        <td style="font-weight:600">${ecMesNombre(m.mk)}</td>
        <td style="text-align:right">${formatCOP(m.valor)}${m.beca?' <span style="font-size:10px;color:var(--muted)">½</span>':''}</td>
        <td style="text-align:right">${formatCOP(m.abonado)}</td>
        <td style="text-align:right;font-weight:700">${formatCOP(m.saldo)}</td>
        <td><span style="font-size:12px;font-weight:700;color:${colorEstado(m.estado)}">${m.estado}</span>
          ${m.saldado&&m.fechaPago?`<div style="font-size:10px;color:var(--muted)">${m.fechaPago}</div>`:''}</td>
      </tr>`).join('')
    : `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:14px">Sin meses causados en ${est.anio}</td></tr>`;

  document.getElementById('modal-ec-body').innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <div style="flex:1;min-width:180px">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Alumna</div>
        <div style="font-weight:700">${ecEscapar(a.nombre)}</div>
        <div style="font-size:12px;color:var(--muted)">
          ${ecEscapar(a.categoria||'—')} · Ingreso: ${a.fechaIngreso||'—'}
        </div>
        <div style="font-size:12px;color:var(--muted)">${condiciones.join(' · ')}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Año</div>
        ${selAnio}
      </div>
    </div>

    ${formAbono}

    <div style="font-weight:700;font-size:13px;margin:14px 0 6px">📅 Mensualidades causadas (hasta ${mesLabel(est.mesCorte)})</div>
    <table style="width:100%;font-size:13px">
      <thead><tr>
        <th>Mes</th><th style="text-align:right">Valor</th>
        <th style="text-align:right">Abonado</th><th style="text-align:right">Saldo</th><th>Estado</th>
      </tr></thead>
      <tbody>${filasMeses}</tbody>
    </table>

    <div style="font-weight:700;font-size:13px;margin:18px 0 6px">💵 Pagos y abonos recibidos</div>
    <table style="width:100%;font-size:13px">
      <thead><tr>
        <th>Fecha</th><th style="text-align:right">Valor</th>
        <th>Aplicado a</th><th>Nota</th><th></th>
      </tr></thead>
      <tbody>${filasAbonos}</tbody>
    </table>

    <div style="margin-top:18px;border:1px solid var(--border);border-radius:10px;overflow:hidden">
      <div style="display:flex;justify-content:space-between;padding:9px 14px;border-bottom:1px solid var(--border)">
        <span>Total causado ${est.anio}</span><strong>${formatCOP(est.totalCausado)}</strong></div>
      <div style="display:flex;justify-content:space-between;padding:9px 14px;border-bottom:1px solid var(--border)">
        <span>Total abonado</span><strong>${formatCOP(est.totalAbonado)}</strong></div>
      ${est.aFavor?`<div style="display:flex;justify-content:space-between;padding:9px 14px;border-bottom:1px solid var(--border);color:#1aa053">
        <span>Saldo a favor (sin aplicar)</span><strong>${formatCOP(est.aFavor)}</strong></div>`:''}
      <div style="display:flex;justify-content:space-between;padding:12px 14px;background:var(--primary);color:#fff;font-size:17px;font-weight:800">
        <span>SALDO PENDIENTE</span><span>${formatCOP(est.saldo)}</span></div>
    </div>

    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="ecVistaImpresion()">📄 Generar PDF</button>
      ${a.telefono?`<button class="btn btn-wa" onclick="ecEnviarWA()">📲 Enviar por WhatsApp</button>`:''}
    </div>
  `;
}

// ===================== ABONOS: CRUD =====================
async function ecGuardarAbono(){
  const fecha = document.getElementById('ec-abono-fecha').value;
  const monto = parseInt(document.getElementById('ec-abono-monto').value, 10);
  const nota  = document.getElementById('ec-abono-nota').value.trim();

  if(!fecha){ toast('Falta la fecha del pago','err'); return; }
  if(!monto || monto<=0){ toast('El monto debe ser mayor a cero','err'); return; }

  const a = ecBuscarAlumna(ecAlumnaId);
  if(!a){ toast('Alumna no encontrada','err'); return; }

  const key = 'ab'+Date.now()+String(Math.floor(Math.random()*1000)).padStart(3,'0');
  // Regla: actualizar SOLO los campos que cambian, nunca reconstruir el registro
  a.abonos = {...(a.abonos||{}), [key]: {fecha, monto, nota, _editTs: Date.now()}};
  a._editTs = Date.now();

  tsSeccion('alumnos');
  ecRenderEstadoCuenta();
  toast('⏳ Guardando...');
  const ok = await saveAll();
  toast(ok ? '✅ Abono registrado y guardado' : '⚠️ Guardado local — reintentando sincronizar...', ok?'ok':'info');
}

async function ecEliminarAbono(key){
  if(!confirm2('¿Eliminar este abono? El reparto se recalcula.')) return;
  const a = ecBuscarAlumna(ecAlumnaId);
  if(!a || !a.abonos || !a.abonos[key]) return;

  const copia = {...a.abonos};
  delete copia[key];
  a.abonos = copia;
  a._editTs = Date.now();

  tsSeccion('alumnos');
  ecRenderEstadoCuenta();
  toast('⏳ Guardando...');
  const ok = await saveAll();
  toast(ok ? '✅ Abono eliminado y guardado' : '⚠️ Guardado local — reintentando sincronizar...', ok?'ok':'info');
}

// ===================== WHATSAPP =====================
function ecEnviarWA(){
  const est = ecCalcularEstado(ecAlumnaId, ecAnio);
  if(!est) return;
  const a = est.alumna;
  if(!a.telefono){ toast('La alumna no tiene teléfono registrado','info'); return; }

  const pend = est.meses.filter(m=>m.saldo>0)
    .map(m=>`• ${ecMesNombre(m.mk)}: ${formatCOP(m.saldo)}`).join('\n');

  const msg = `Hola ${a.nombre.split(' ')[0]}! 👋\n\n`+
    `Estado de cuenta ${est.anio} (corte ${mesLabel(est.mesCorte)}):\n\n`+
    `Total causado: ${formatCOP(est.totalCausado)}\n`+
    `Total abonado: ${formatCOP(est.totalAbonado)}\n`+
    `*Saldo pendiente: ${formatCOP(est.saldo)}*\n`+
    (pend?`\nMeses con saldo:\n${pend}\n`:'')+
    `\n💃 Academia de Danzas Lazos Tricolor\n📍 Soacha, Cundinamarca`;

  window.open(`https://wa.me/57${a.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`,'_blank');
}

// ===================== PDF =====================
function ecHtmlPDF(est, logoSrc){
  const a = est.alumna;
  const logo = logoSrc !== undefined ? logoSrc : EC_LOGO;
  const cond = [];
  if(a.familiar) cond.push('Descuento familiar');
  if(est.meses.some(m=>m.beca)) cond.push('Media beca');
  if(!cond.length) cond.push('Tarifa plena');

  const colorEstado = e => e==='Pagado' ? '#15803d' : e==='Abono parcial' ? '#b45309' : '#b91c1c';

  const filasMeses = est.meses.map(m=>`
    <tr>
      <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb">${ecMesNombre(m.mk)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;text-align:right">${formatCOP(m.valor)}${m.beca?' <span style="font-size:9px;color:#6b7280">½ beca</span>':''}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;text-align:right">${formatCOP(m.abonado)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${formatCOP(m.saldo)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;font-size:11px;font-weight:700;color:${colorEstado(m.estado)}">
        ${m.estado}${m.saldado&&m.fechaPago?`<div style="font-weight:400;color:#6b7280;font-size:9.5px">${m.fechaPago}</div>`:''}
      </td>
    </tr>`).join('') || `<tr><td colspan="5" style="padding:14px;text-align:center;color:#6b7280">Sin meses causados</td></tr>`;

  const filasAbonos = est.abonos.map(p=>{
    const destino = p.destino.length
      ? p.destino.map(d=>`${ecMesNombre(d.mk)} (${formatCOP(d.monto)})`).join(' · ')
      : '—';
    return `<tr>
      <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;white-space:nowrap">${ecFechaLarga(p.fecha)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${formatCOP(p.monto)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;font-size:11px">${destino}${p.excedente?` · <em>a favor ${formatCOP(p.excedente)}</em>`:''}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#6b7280">${ecEscapar(p.nota)}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="4" style="padding:14px;text-align:center;color:#6b7280">Sin abonos registrados</td></tr>`;

  const th = 'background:#3a57e8;color:#fff;text-align:left;padding:8px 9px;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px';

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:12.5px;line-height:1.45;padding:4px">

    <table style="width:100%;border-collapse:collapse;border-bottom:3px solid #3a57e8;margin-bottom:16px">
      <tr>
        ${logo?`<td style="width:78px;padding:0 12px 12px 0;vertical-align:middle">
          <img src="${logo}" style="width:70px;height:70px;object-fit:contain;display:block">
        </td>`:''}
        <td style="padding-bottom:12px;vertical-align:middle">
          <div style="font-size:20px;font-weight:800;color:#3a57e8;letter-spacing:.5px">ESTADO DE CUENTA</div>
          <div style="font-size:12px;color:#6b7280">Academia de Danzas Lazos Tricolor · Soacha, Cundinamarca</div>
          <div style="font-size:12px;color:#6b7280">Mensualidades ${est.anio} · Corte a ${mesLabel(est.mesCorte)}</div>
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr>
        <td style="width:33%;background:#f3f4f6;border-left:3px solid #3a57e8;padding:8px 11px;vertical-align:top">
          <div style="font-size:9.5px;text-transform:uppercase;color:#6b7280;letter-spacing:.6px">Alumna</div>
          <div style="font-weight:700">${ecEscapar(a.nombre)}</div>
          <div style="font-size:11px;color:#6b7280">${ecEscapar(a.categoria||'—')}</div>
        </td>
        <td style="width:6px"></td>
        <td style="width:33%;background:#f3f4f6;border-left:3px solid #3a57e8;padding:8px 11px;vertical-align:top">
          <div style="font-size:9.5px;text-transform:uppercase;color:#6b7280;letter-spacing:.6px">Acudiente</div>
          <div style="font-weight:700">${ecEscapar(a.repNombre||'—')}</div>
          <div style="font-size:11px;color:#6b7280">${ecEscapar(a.telefono||'')}</div>
        </td>
        <td style="width:6px"></td>
        <td style="width:33%;background:#f3f4f6;border-left:3px solid #3a57e8;padding:8px 11px;vertical-align:top">
          <div style="font-size:9.5px;text-transform:uppercase;color:#6b7280;letter-spacing:.6px">Ingreso / Condición</div>
          <div style="font-weight:700">${a.fechaIngreso||'—'}</div>
          <div style="font-size:11px;color:#6b7280">${cond.join(' · ')}</div>
        </td>
      </tr>
    </table>

    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:#374151;font-weight:700;
      border-bottom:1px solid #d1d5db;padding-bottom:4px;margin-bottom:6px">1. Mensualidades causadas</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
      <thead><tr>
        <th style="${th}">Mes</th>
        <th style="${th};text-align:right">Valor</th>
        <th style="${th};text-align:right">Abonado</th>
        <th style="${th};text-align:right">Saldo</th>
        <th style="${th}">Estado</th>
      </tr></thead>
      <tbody>${filasMeses}</tbody>
      <tfoot><tr style="background:#eef2ff;font-weight:800">
        <td style="padding:8px 9px;border-top:2px solid #3a57e8">TOTALES</td>
        <td style="padding:8px 9px;border-top:2px solid #3a57e8;text-align:right">${formatCOP(est.totalCausado)}</td>
        <td style="padding:8px 9px;border-top:2px solid #3a57e8;text-align:right">${formatCOP(est.totalAbonado)}</td>
        <td style="padding:8px 9px;border-top:2px solid #3a57e8;text-align:right">${formatCOP(est.saldo)}</td>
        <td style="padding:8px 9px;border-top:2px solid #3a57e8"></td>
      </tr></tfoot>
    </table>

    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:#374151;font-weight:700;
      border-bottom:1px solid #d1d5db;padding-bottom:4px;margin-bottom:6px">2. Pagos y abonos recibidos</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
      <thead><tr>
        <th style="${th}">Fecha</th>
        <th style="${th};text-align:right">Valor</th>
        <th style="${th}">Aplicado a</th>
        <th style="${th}">Nota</th>
      </tr></thead>
      <tbody>${filasAbonos}</tbody>
      <tfoot><tr style="background:#eef2ff;font-weight:800">
        <td style="padding:8px 9px;border-top:2px solid #3a57e8">TOTAL RECIBIDO</td>
        <td style="padding:8px 9px;border-top:2px solid #3a57e8;text-align:right">${formatCOP(est.totalAbonos)}</td>
        <td style="padding:8px 9px;border-top:2px solid #3a57e8" colspan="2"></td>
      </tr></tfoot>
    </table>

    <table style="width:100%;border-collapse:collapse;border:1px solid #d1d5db">
      <tr><td style="padding:8px 13px;border-bottom:1px solid #e5e7eb">Total causado ${est.anio}</td>
          <td style="padding:8px 13px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${formatCOP(est.totalCausado)}</td></tr>
      <tr><td style="padding:8px 13px;border-bottom:1px solid #e5e7eb">Total abonado</td>
          <td style="padding:8px 13px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${formatCOP(est.totalAbonado)}</td></tr>
      ${est.aFavor?`<tr><td style="padding:8px 13px;border-bottom:1px solid #e5e7eb;color:#15803d">Saldo a favor (sin aplicar)</td>
          <td style="padding:8px 13px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#15803d">${formatCOP(est.aFavor)}</td></tr>`:''}
      <tr style="background:#3a57e8;color:#fff">
        <td style="padding:11px 13px;font-size:15px;font-weight:800">SALDO PENDIENTE</td>
        <td style="padding:11px 13px;text-align:right;font-size:17px;font-weight:800">${formatCOP(est.saldo)}</td></tr>
    </table>

    <div style="margin-top:14px;font-size:10.5px;color:#4b5563;background:#fffbeb;border-left:3px solid #f59e0b;padding:9px 12px">
      Los abonos se aplican en orden cronológico a las mensualidades más antiguas con saldo.
      Las mensualidades registradas como pagadas en el sistema se muestran saldadas con su fecha de pago
      y no entran en el reparto de abonos.
    </div>

    <table style="width:100%;margin-top:38px;border-collapse:collapse">
      <tr>
        <td style="width:45%;border-top:1px solid #9ca3af;padding-top:5px;font-size:10.5px;color:#6b7280;text-align:center">
          Firma responsable academia</td>
        <td style="width:10%"></td>
        <td style="width:45%;border-top:1px solid #9ca3af;padding-top:5px;font-size:10.5px;color:#6b7280;text-align:center">
          Recibido por ${ecEscapar(a.repNombre||'acudiente')}</td>
      </tr>
    </table>
  </div>`;
}

/* Abre el estado de cuenta en una ventana limpia y lanza el diálogo de
   impresión del navegador, donde se elige "Guardar como PDF".

   Se descartó html2pdf/html2canvas a propósito: rasteriza la página como
   imagen, lo que producía PDFs en blanco o deformes, pesa más y deja el
   texto no seleccionable. El motor de impresión del navegador no necesita
   librerías, funciona sin conexión y genera texto real.                   */
function ecVistaImpresion(){
  const est = ecCalcularEstado(ecAlumnaId, ecAnio);
  if(!est) return;

  // Ruta absoluta del logo: la ventana nueva no hereda la base del panel
  let logoAbs = '';
  if(EC_LOGO){
    try{ logoAbs = new URL(EC_LOGO, location.href).href; }
    catch(e){ logoAbs = ''; }
  }

  const titulo = 'Estado de cuenta - '+ecNombreArchivo(est.alumna.nombre)+' - '+est.anio;

  const doc = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>${ecEscapar(titulo)}</title>
<style>
  @page { size: letter; margin: 14mm; }
  body { margin:0; padding:18px; background:#fff; }
  @media print { body{padding:0} .ec-noprint{display:none !important} }
  .ec-noprint {
    background:#eef2ff; border:1px dashed #3a57e8; border-radius:8px;
    padding:12px 16px; margin-bottom:18px; font-family:Arial,Helvetica,sans-serif;
    font-size:13px; color:#1f2937; display:flex; align-items:center;
    justify-content:space-between; gap:12px; flex-wrap:wrap;
  }
  .ec-noprint button {
    background:#3a57e8; color:#fff; border:0; border-radius:8px;
    padding:9px 18px; font-size:14px; font-weight:700; cursor:pointer;
  }
  table { page-break-inside:auto }
  tr    { page-break-inside:avoid; page-break-after:auto }
  thead { display:table-header-group }
</style></head>
<body>
  <div class="ec-noprint">
    <span>Elige <strong>Destino: Guardar como PDF</strong> en el cuadro de impresión.</span>
    <button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  </div>
  ${ecHtmlPDF(est, logoAbs)}
</body></html>`;

  const w = window.open('', '_blank');
  if(!w){
    toast('El navegador bloqueó la ventana. Permite ventanas emergentes para este sitio.','err');
    return;
  }
  w.document.open();
  w.document.write(doc);
  w.document.close();

  // Espera a que cargue el logo antes de abrir el diálogo de impresión
  w.onload = function(){
    setTimeout(function(){ try{ w.focus(); w.print(); }catch(e){} }, 350);
  };
}
