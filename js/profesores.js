/* ═══════════════════════════════════════════════════════════
   profesores.js
   Profesores, clases semanales y honorarios
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== PROFESORES =====================
function renderProfesores(){
  const dias=getDiasSemana(semanaOfs);
  const sk=semKey(semanaOfs);
  const d0=dias[0].toLocaleDateString('es-CO',{day:'2-digit',month:'short'});
  const d6=dias[6].toLocaleDateString('es-CO',{day:'2-digit',month:'short'});
  document.getElementById('semana-label').textContent=`${d0} – ${d6}`;

  let html=`<div class="table-card"><table>
    <thead><tr><th>Profesor</th><th>Especialidad</th><th>Clases Semana</th><th>Valor/clase</th><th>Total pagado</th><th>Acciones</th></tr></thead>
    <tbody>${DB.profesores.map(p=>{
      const clases=(DB.clases[p.id]&&DB.clases[p.id][sk])||0;
      const vc=_valorClaseProf(p);
      const totalPag=_totalPagadoProf(p);
      return`<tr>
        <td><span style="cursor:pointer;font-weight:600;color:var(--col)" onclick="verFichaProfesor(${p.id})">${p.nombre}</span></td>
        <td style="color:var(--muted);font-size:12px">${p.especialidad||'—'}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <button class="btn btn-ghost btn-sm btn-icon" onclick="cambiarClases(${p.id},'${sk}',-1)">−</button>
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;min-width:24px;text-align:center">${clases}</span>
            <button class="btn btn-primary btn-sm btn-icon" onclick="cambiarClases(${p.id},'${sk}',1)">+</button>
          </div>
        </td>
        <td style="font-size:12px;color:var(--muted)">${vc?formatCOP(vc):'—'}</td>
        <td style="font-weight:700;color:var(--paid)">${formatCOP(totalPag)}</td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="abrirModalPagoProf(${p.id})" title="Registrar pago">💵 Pagar</button>
            <button class="btn btn-ghost btn-sm" onclick="estadoCuentaProf(${p.id})" title="Estado de cuenta">🧾</button>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="abrirModalProfesor(${p.id})">✏️</button>
          </div>
        </td>
      </tr>`;
    }).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">Sin profesores registrados</td></tr>'}
    </tbody>
  </table></div>`;
  document.getElementById('prof-table').innerHTML=html;
}
function cambiarClases(profId,sk,delta){
  if(!DB.clases[profId]) DB.clases[profId]={};
  const actual=(DB.clases[profId][sk]||0)+delta;
  DB.clases[profId][sk]=Math.max(0,actual);
  saveAll(); renderProfesores();
}
function abrirModalProfesor(id=null){
  editProfId=id;
  document.getElementById('modal-prof-title').textContent=id?'Editar Profesor':'Nuevo Profesor';
  if(id){
    const p=DB.profesores.find(x=>x.id===id);
    if(!p)return;
    document.getElementById('p-nombre').value=p.nombre||'';
    document.getElementById('p-telefono').value=p.telefono||'';
    document.getElementById('p-correo').value=p.correo||'';
    document.getElementById('p-especialidad').value=p.especialidad||'';
    document.getElementById('p-valorClase').value=p.valorClase||'';
  } else {
    ['p-nombre','p-telefono','p-correo','p-especialidad','p-valorClase'].forEach(id2=>document.getElementById(id2).value='');
  }
  abrirModal('modal-profesor');
}
function guardarProfesor(){
  const nombre=document.getElementById('p-nombre').value.trim();
  if(!nombre){toast('El nombre es obligatorio','err');return;}
  const vc=parseInt(document.getElementById('p-valorClase').value)||0;
  const datos={nombre,telefono:document.getElementById('p-telefono').value,correo:document.getElementById('p-correo').value,especialidad:document.getElementById('p-especialidad').value,valorClase:vc};
  if(editProfId){
    const idx=DB.profesores.findIndex(x=>x.id===editProfId);
    if(idx>=0) DB.profesores[idx]={...DB.profesores[idx],...datos};
    toast('Profesor actualizado ✓');
  } else {
    DB.profesores.push({id:DB.nextId++,...datos});
    toast('Profesor registrado ✓');
  }
  cerrarModal('modal-profesor');
  saveAll(); renderProfesores();
}
function verFichaProfesor(id){
  const p=DB.profesores.find(x=>x.id===id);
  if(!p) return;
  document.getElementById('modal-ficha-prof-title').textContent=p.nombre;
  // Calcular stats
  let totalClases=0;
  Object.values(DB.clases[id]||{}).forEach(c=>totalClases+=c);
  const sk=semKey(semanaOfs);
  const clasesSemana=(DB.clases[id]&&DB.clases[id][sk])||0;
  // Historial semanas
  const semanas=Object.keys(DB.clases[id]||{}).sort().reverse().slice(0,8);
  let histHtml=semanas.map(s=>{
    const [d0,d1]=s.split('_');
    return`<div class="hist-item"><span style="font-size:12px">${d0} → ${d1}</span><span style="font-weight:700;color:var(--col)">${DB.clases[id][s]} clases — ${formatCOP(DB.clases[id][s]*HONOR_POR_CLASE)}</span></div>`;
  }).join('') || '<p style="color:var(--muted);font-size:12px">Sin historial</p>';

  document.getElementById('modal-ficha-prof-body').innerHTML=`
    <div class="prof-stats-grid">
      <div class="prof-stat"><div class="val">${totalClases}</div><div class="lab">Total Clases</div></div>
      <div class="prof-stat"><div class="val">${formatCOP(totalClases*HONOR_POR_CLASE)}</div><div class="lab">Honorarios Totales</div></div>
      <div class="prof-stat"><div class="val">${clasesSemana}</div><div class="lab">Clases Esta Semana</div></div>
    </div>
    <div style="margin-bottom:12px">
      ${p.telefono?`<div style="font-size:13px;margin-bottom:4px">📱 ${p.telefono}</div>`:''}
      ${p.correo?`<div style="font-size:13px;margin-bottom:4px">✉️ ${p.correo}</div>`:''}
      ${p.especialidad?`<div style="font-size:13px;color:var(--muted)">🎭 ${p.especialidad}</div>`:''}
    </div>
    <h4 style="font-size:13px;margin-bottom:10px">Historial semanal (clases)</h4>
    ${histHtml}
    ${_seccionPagosFicha(p)}
  `;
  document.getElementById('btn-retirar-prof').onclick=()=>{
    if(!confirm2('¿Retirar a '+p.nombre+'?')) return;
    DB.profesoresRetirados.push({...p,fechaRetiro:dateStr(getHoyReal())});
    DB.profesores=DB.profesores.filter(x=>x.id!==id);
    cerrarModal('modal-ficha-prof');
    saveAll(); renderProfesores(); toast('Profesor retirado');
  };
  abrirModal('modal-ficha-prof');
}


// Sección de pagos dentro de la ficha del profesor
function _seccionPagosFicha(p){
  const pagos = _pagosProf(p).slice().sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
  const total = _totalPagadoProf(p);
  let items;
  if(pagos.length){
    items = pagos.map((pg)=>{
      const realIdx = p.pagos.indexOf(pg);
      return '<div class="hist-item" style="cursor:pointer" onclick="abrirModalPagoProf('+p.id+','+realIdx+')">'
        +'<span style="font-size:12px">'+pg.fecha+(pg.clases?' · '+pg.clases+' clases':'')+(pg.nota?' · '+pg.nota:'')+'</span>'
        +'<span style="font-weight:700;color:var(--paid)">'+formatCOP(pg.monto||0)+'</span>'
        +'</div>';
    }).join('');
  } else {
    items = '<p style="color:var(--muted);font-size:12px">Sin pagos registrados</p>';
  }
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin:18px 0 10px">'
    +'<h4 style="font-size:13px">Historial de pagos</h4>'
    +'<div style="display:flex;gap:6px">'
      +'<button class="btn btn-primary btn-sm" onclick="abrirModalPagoProf('+p.id+')">💵 Nuevo pago</button>'
      +'<button class="btn btn-ghost btn-sm" onclick="estadoCuentaProf('+p.id+')">🧾 Estado de cuenta</button>'
    +'</div></div>'
    +'<div style="background:var(--paid-lt,rgba(26,153,0,.08));border-radius:8px;padding:10px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">'
      +'<span style="font-size:12px;color:var(--muted)">Total pagado</span>'
      +'<span style="font-size:18px;font-weight:800;color:var(--paid)">'+formatCOP(total)+'</span>'
    +'</div>'
    +items;
}

// ═══════════════════════════════════════════════
//   PAGOS A PROFESORES
// ═══════════════════════════════════════════════

let pagoProfId = null;      // profesor al que se le registra el pago
let editPagoProfIdx = null; // índice del pago en edición (null = nuevo)

function _valorClaseProf(p){
  return (p && p.valorClase) ? p.valorClase : (typeof HONOR_POR_CLASE!=='undefined'?HONOR_POR_CLASE:0);
}
function _pagosProf(p){ return (p && Array.isArray(p.pagos)) ? p.pagos : []; }
function _totalPagadoProf(p){ return _pagosProf(p).reduce((s,pg)=>s+(Number(pg.monto)||0),0); }

function abrirModalPagoProf(profId, idx){
  const p = DB.profesores.find(x=>x.id===profId) || DB.profesoresRetirados.find(x=>x.id===profId);
  if(!p){ toast('Profesor no encontrado','err'); return; }
  pagoProfId = profId;
  editPagoProfIdx = (idx!==undefined && idx!==null) ? idx : null;

  const vc = _valorClaseProf(p);
  document.getElementById('modal-pago-prof-title').textContent = editPagoProfIdx!==null ? 'Editar pago' : 'Registrar pago';
  document.getElementById('pago-prof-info').innerHTML =
    '<strong>'+p.nombre+'</strong>'
    + (vc?'<br>Valor por clase: <strong style="color:var(--col)">'+formatCOP(vc)+'</strong>':'<br><span style="color:var(--muted)">Sin valor por clase definido — puedes escribir el monto directamente</span>');

  if(editPagoProfIdx!==null){
    const pg = _pagosProf(p)[editPagoProfIdx] || {};
    document.getElementById('pp-fecha').value  = pg.fecha || dateStr(getHoyReal());
    document.getElementById('pp-clases').value = pg.clases || '';
    document.getElementById('pp-monto').value  = pg.monto || '';
    document.getElementById('pp-nota').value   = pg.nota || '';
    document.getElementById('btn-borrar-pago-prof').style.display='inline-flex';
  } else {
    document.getElementById('pp-fecha').value  = dateStr(getHoyReal());
    document.getElementById('pp-clases').value = '';
    document.getElementById('pp-monto').value  = '';
    document.getElementById('pp-nota').value   = '';
    document.getElementById('btn-borrar-pago-prof').style.display='none';
  }
  document.getElementById('pp-sugerencia').textContent='';
  abrirModal('modal-pago-prof');
}

// Al escribir el n.º de clases, sugerir el monto = clases × valorClase (editable)
function calcMontoPagoProf(){
  const p = DB.profesores.find(x=>x.id===pagoProfId) || DB.profesoresRetirados.find(x=>x.id===pagoProfId);
  if(!p) return;
  const vc = _valorClaseProf(p);
  const clases = parseInt(document.getElementById('pp-clases').value)||0;
  const sug = document.getElementById('pp-sugerencia');
  if(vc && clases){
    const monto = clases*vc;
    document.getElementById('pp-monto').value = monto;
    sug.textContent = clases+' × '+formatCOP(vc)+' = '+formatCOP(monto)+' (puedes ajustarlo)';
  } else {
    sug.textContent='';
  }
}

async function guardarPagoProf(){
  const p = DB.profesores.find(x=>x.id===pagoProfId) || DB.profesoresRetirados.find(x=>x.id===pagoProfId);
  if(!p) return;
  const fecha = document.getElementById('pp-fecha').value;
  const monto = parseInt(document.getElementById('pp-monto').value)||0;
  if(!fecha){ toast('La fecha es obligatoria','err'); return; }
  if(!monto){ toast('El monto es obligatorio','err'); return; }

  const registro = {
    fecha: fecha,
    clases: parseInt(document.getElementById('pp-clases').value)||0,
    monto: monto,
    nota: document.getElementById('pp-nota').value.trim(),
    _editTs: Date.now()
  };

  if(!Array.isArray(p.pagos)) p.pagos=[];
  if(editPagoProfIdx!==null){ p.pagos[editPagoProfIdx] = registro; }
  else { p.pagos.push(registro); }

  tsSeccion('profesores'); DB._ts_profesores=Date.now();
  cerrarModal('modal-pago-prof');
  renderProfesores();
  if(document.getElementById('modal-ficha-prof').classList.contains('active')) verFichaProfesor(pagoProfId);
  toast('⏳ Guardando...');
  const ok = await saveAll();
  toast(ok ? '✅ Pago guardado en Firebase' : '⚠️ Guardado local — reintentando...', ok?'ok':'info');
}

async function eliminarPagoProf(){
  const p = DB.profesores.find(x=>x.id===pagoProfId) || DB.profesoresRetirados.find(x=>x.id===pagoProfId);
  if(!p || editPagoProfIdx===null) return;
  if(!confirm2('¿Eliminar este pago?')) return;
  p.pagos.splice(editPagoProfIdx,1);
  tsSeccion('profesores'); DB._ts_profesores=Date.now();
  cerrarModal('modal-pago-prof');
  renderProfesores();
  if(document.getElementById('modal-ficha-prof').classList.contains('active')) verFichaProfesor(pagoProfId);
  const ok = await saveAll();
  toast(ok ? 'Pago eliminado' : '⚠️ Guardado local — reintentando...', ok?'ok':'info');
}

// ═══════════════════════════════════════════════
//   ESTADO DE CUENTA IMPRIMIBLE (PDF vía navegador)
// ═══════════════════════════════════════════════
function estadoCuentaProf(profId){
  const p = DB.profesores.find(x=>x.id===profId) || DB.profesoresRetirados.find(x=>x.id===profId);
  if(!p){ toast('Profesor no encontrado','err'); return; }
  const pagos = _pagosProf(p).slice().sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
  const total = _totalPagadoProf(p);
  const vc = _valorClaseProf(p);
  const hoy = dateStr(getHoyReal());

  const filas = pagos.length ? pagos.map((pg,i)=>
    '<tr>'
    +'<td style="text-align:center">'+(i+1)+'</td>'
    +'<td>'+pg.fecha+'</td>'
    +'<td style="text-align:center">'+(pg.clases||'—')+'</td>'
    +'<td>'+(pg.nota||'—')+'</td>'
    +'<td style="text-align:right;font-weight:700">'+formatCOP(pg.monto||0)+'</td>'
    +'</tr>'
  ).join('') : '<tr><td colspan="5" style="text-align:center;color:#888;padding:20px">Sin pagos registrados</td></tr>';

  const win = window.open('', '_blank');
  win.document.write(
'<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Estado de cuenta — '+p.nombre+'</title>'
+'<style>'
+'*{margin:0;padding:0;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}'
+'body{padding:40px;color:#1a1a2e;font-size:13px}'
+'.enc{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #3a57e8;padding-bottom:16px;margin-bottom:24px}'
+'.enc h1{font-size:22px;color:#3a57e8;margin-bottom:4px}'
+'.enc .sub{font-size:12px;color:#666}'
+'.enc .fecha{text-align:right;font-size:12px;color:#666}'
+'.datos{background:#f4f6fb;border-radius:8px;padding:16px;margin-bottom:24px}'
+'.datos h2{font-size:15px;margin-bottom:8px;color:#1a1a2e}'
+'.datos .linea{font-size:13px;margin-bottom:3px;color:#444}'
+'table{width:100%;border-collapse:collapse;margin-bottom:20px}'
+'th{background:#3a57e8;color:#fff;padding:10px 8px;text-align:left;font-size:12px}'
+'th:first-child,td:first-child{text-align:center}'
+'td{padding:9px 8px;border-bottom:1px solid #e5e8f0}'
+'tr:nth-child(even) td{background:#f9fafd}'
+'.total{display:flex;justify-content:flex-end;margin-top:10px}'
+'.total-box{background:#3a57e8;color:#fff;padding:14px 28px;border-radius:8px;font-size:16px;font-weight:800}'
+'.pie{margin-top:40px;border-top:1px solid #ddd;padding-top:16px;font-size:11px;color:#999;text-align:center}'
+'.firma{margin-top:60px;display:flex;justify-content:space-around;text-align:center}'
+'.firma div{border-top:1px solid #333;padding-top:6px;width:200px;font-size:12px}'
+'@media print{body{padding:20px}.noprint{display:none}}'
+'.btn-print{background:#3a57e8;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:20px}'
+'</style></head><body>'
+'<button class="btn-print noprint" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>'
+'<div class="enc"><div><h1>Academia de Danzas Lazos Tricolor</h1><div class="sub">Soacha, Cundinamarca · Estado de cuenta de profesor</div></div>'
+'<div class="fecha">Generado:<br><strong>'+hoy+'</strong></div></div>'
+'<div class="datos"><h2>'+p.nombre+'</h2>'
+(p.especialidad?'<div class="linea">🎭 '+p.especialidad+'</div>':'')
+(p.telefono?'<div class="linea">📱 '+p.telefono+'</div>':'')
+(p.correo?'<div class="linea">✉️ '+p.correo+'</div>':'')
+(vc?'<div class="linea">💵 Valor por clase: <strong>'+formatCOP(vc)+'</strong></div>':'')
+'<div class="linea">📋 Total de pagos registrados: <strong>'+pagos.length+'</strong></div>'
+'</div>'
+'<table><thead><tr><th>#</th><th>Fecha</th><th>Clases</th><th>Concepto</th><th style="text-align:right">Monto</th></tr></thead>'
+'<tbody>'+filas+'</tbody></table>'
+'<div class="total"><div class="total-box">TOTAL PAGADO: '+formatCOP(total)+'</div></div>'
+'<div class="firma"><div>Firma profesor</div><div>Firma dirección</div></div>'
+'<div class="pie">Documento generado por el sistema administrativo de la Academia de Danzas Lazos Tricolor · '+hoy+'</div>'
+'</body></html>'
  );
  win.document.close();
}
