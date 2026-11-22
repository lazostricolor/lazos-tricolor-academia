/* ═══════════════════════════════════════════════════════════
   recaudos.js
   Recaudos para actividades y aportes por alumna
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== RECAUDOS =====================
let editRecaudoId = null;
let aporteRecaudoId = null;
let aporteAlumnaId = null;

// Alumnas que participan de un recaudo: si tiene catDanza, solo esa categoría; si no, todas.
// Además incluye a RETIRADAS que ya tienen un aporte registrado, para conservar su historial.
function _alumnasRecaudo(rec){
  let activas;
  if(rec && rec.catDanza){
    activas = DB.alumnos.filter(function(a){ return a.categoria===rec.catDanza; });
  } else {
    activas = DB.alumnos.slice();
  }
  const idsActivas = {};
  activas.forEach(function(a){ idsActivas[String(a.id)]=true; });
  // Retiradas con aporte (monto > 0) o con boletas pedidas → conservarlas en la lista
  const aportes = (rec && rec.aportes) || {};
  const retiradasConAporte = (DB.alumnosRetirados||[]).filter(function(a){
    if(idsActivas[String(a.id)]) return false;
    const ap = aportes[String(a.id)] || aportes[a.id];
    return ap && (Number(ap.monto) > 0 || Number(ap.cantidad) > 0);
  });
  return activas.concat(retiradasConAporte);
}

// Modalidad boletería: cada alumna pide N boletas a un valor fijo del evento
function _esBoleteria(rec){ return !!rec && rec.modo==='boleteria'; }
function _aporteDe(rec, id){ const ap=(rec.aportes||{}); return ap[String(id)]||ap[id]||{monto:0,cantidad:0}; }

function onCambioModoRecaudo(){
  const el=document.querySelector('input[name=rec-modo]:checked');
  const bol = el && el.value==='boleteria';
  document.querySelectorAll('#modal-recaudo .rec-solo-aporte').forEach(function(x){ x.style.display = bol?'none':''; });
  document.querySelectorAll('#modal-recaudo .rec-solo-boleteria').forEach(function(x){ x.style.display = bol?'':'none'; });
}

function cerrarRecaudo(id){
  const rec=(DB.recaudos||[]).find(function(r){return String(r.id)===String(id);});
  if(!rec) return;
  if(!confirm('¿Cerrar el recaudo "'+rec.nombre+'"? Quedará tal como está y ya no se podrán registrar aportes.')) return;
  rec.cerrado=true; rec.fechaCerrado=dateStr(getHoyReal()); rec._editTs=Date.now();
  _saveRecaudos(); renderRecaudos(); toast('🔒 Recaudo cerrado');
}
function reabrirRecaudo(id){
  const rec=(DB.recaudos||[]).find(function(r){return String(r.id)===String(id);});
  if(!rec) return;
  if(!confirm('¿Reabrir el recaudo "'+rec.nombre+'"?')) return;
  rec.cerrado=false; rec.fechaCerrado=''; rec._editTs=Date.now();
  _saveRecaudos(); renderRecaudos(); toast('🔓 Recaudo reabierto');
}

function _saveRecaudos(){
  tsSeccion('recaudos');
  DB._ts_recaudos = Date.now();
  snapLocal();
  _fbSave(DB).then(function(ok){
    if(ok){ desencolarGuardado(); _ultimoGuardado=Date.now(); }
    else { encolarGuardado(); programarReintento(); }
  });
}

function abrirModalRecaudo(id){
  editRecaudoId = id ? String(id) : null;
  const hoy = dateStr(getHoyReal());
  if(id){
    const r = (DB.recaudos||[]).find(function(x){return x.id===id;});
    if(!r) return;
    document.getElementById('modal-recaudo-title').textContent = 'Editar Recaudo';
    document.getElementById('rec-nombre').value    = r.nombre;
    document.getElementById('rec-inicio').value    = r.inicio;
    document.getElementById('rec-cierre').value    = r.cierre;
    document.getElementById('rec-meta-alumna').value = r.metaAlumna||'';
    document.getElementById('rec-meta-total').value  = r.metaTotal||'';
    document.getElementById('rec-desc').value      = r.desc||'';
    document.getElementById('rec-cat').value       = r.cat||'Otro';
    document.getElementById('rec-catDanza').value  = r.catDanza||'';
    document.getElementById('rec-valor-boleta').value = r.valorBoleta||'';
    const rm=document.querySelector('input[name=rec-modo][value='+(_esBoleteria(r)?'boleteria':'aporte')+']');
    if(rm) rm.checked=true;
  } else {
    document.getElementById('modal-recaudo-title').textContent = 'Nuevo Recaudo';
    document.getElementById('rec-nombre').value    = '';
    document.getElementById('rec-inicio').value    = hoy;
    document.getElementById('rec-cierre').value    = '';
    document.getElementById('rec-meta-alumna').value = '';
    document.getElementById('rec-meta-total').value  = '';
    document.getElementById('rec-desc').value      = '';
    document.getElementById('rec-cat').value       = 'Vestuario';
    document.getElementById('rec-catDanza').value  = '';
    document.getElementById('rec-valor-boleta').value = '';
    const rm=document.querySelector('input[name=rec-modo][value=aporte]');
    if(rm) rm.checked=true;
  }
  onCambioModoRecaudo();
  abrirModal('modal-recaudo');
}

function guardarRecaudo(){
  const nombre = document.getElementById('rec-nombre').value.trim();
  const inicio = document.getElementById('rec-inicio').value;
  const cierre = document.getElementById('rec-cierre').value;
  if(!nombre||!inicio||!cierre){ toast('Nombre, inicio y cierre son obligatorios','err'); return; }
  if(!DB.recaudos) DB.recaudos=[];
  const modoEl = document.querySelector('input[name=rec-modo]:checked');
  const modo = modoEl && modoEl.value==='boleteria' ? 'boleteria' : 'aporte';
  const valorBoleta = Number(document.getElementById('rec-valor-boleta').value)||0;
  if(modo==='boleteria' && valorBoleta<=0){ toast('Indica el valor por boleta','err'); return; }
  const catDanza = document.getElementById('rec-catDanza').value;
  const metaAlumna = Number(document.getElementById('rec-meta-alumna').value)||0;
  const alumnasDelRecaudo = catDanza ? DB.alumnos.filter(function(a){return a.categoria===catDanza;}) : DB.alumnos;
  const alumnasTotales = alumnasDelRecaudo.length;
  const metaTotal = Number(document.getElementById('rec-meta-total').value)||
    (metaAlumna>0 ? metaAlumna*alumnasTotales : 0);

  if(editRecaudoId){
    const idx = DB.recaudos.findIndex(function(x){return x.id===editRecaudoId;});
    if(idx>=0){
      DB.recaudos[idx] = Object.assign(DB.recaudos[idx],{
        nombre,inicio,cierre,metaAlumna,metaTotal,
        desc:document.getElementById('rec-desc').value.trim(),
        cat:document.getElementById('rec-cat').value,
        catDanza:document.getElementById('rec-catDanza').value,
        modo:modo, valorBoleta:valorBoleta, _editTs:Date.now()
      });
    }
  } else {
    // Inicializar aportes vacíos solo para las alumnas de la categoría del recaudo
    const aportes = {};
    alumnasDelRecaudo.forEach(function(a){ aportes[String(a.id)]={monto:0,cantidad:0,fecha:'',nota:'',pagado:false}; });
    DB.recaudos.push({
      id:String(Date.now()),
      nombre,inicio,cierre,metaAlumna,metaTotal,
      desc:document.getElementById('rec-desc').value.trim(),
      cat:document.getElementById('rec-cat').value,
      catDanza:catDanza,
      modo:modo, valorBoleta:valorBoleta,
      aportes:aportes, _editTs:Date.now()
    });
  }
  cerrarModal('modal-recaudo');
  _saveRecaudos();
  renderRecaudos();
  toast('✅ Recaudo guardado');
}

function eliminarRecaudo(id){
  if(!confirm('¿Eliminar este recaudo? Se perderán todos los aportes registrados.')) return;
  DB.recaudos=(DB.recaudos||[]).filter(function(r){ return String(r.id)!==String(id); });
  _saveRecaudos();
  renderRecaudos();
  toast('Recaudo eliminado');
}

function abrirModalAporte(recaudoId, alumnaId){
  aporteRecaudoId = String(recaudoId);
  aporteAlumnaId  = String(alumnaId);
  const rec = (DB.recaudos||[]).find(function(r){ return r.id===aporteRecaudoId; });
  const alumna = (typeof alumnaPorId==='function' ? alumnaPorId(alumnaId) : null)
    || DB.alumnos.find(function(a){ return String(a.id)===String(alumnaId); });
  if(!rec||!alumna){ toast('Error: recaudo o alumna no encontrada','err'); return; }
  const bol = _esBoleteria(rec);
  const aporte = _aporteDe(rec, aporteAlumnaId);
  const tieneAporte = Number(aporte.monto) > 0 || (bol && Number(aporte.cantidad) > 0);
  const nombre1 = alumna.nombre.split(' ')[0];
  document.getElementById('modal-aporte-title').textContent = bol
    ? '🎟️ Boletas de '+nombre1
    : (tieneAporte ? '✏️ Modificar aporte de '+nombre1 : '💰 Registrar aporte de '+nombre1);
  document.getElementById('aporte-alumna-info').innerHTML =
    '<strong>'+esc(alumna.nombre)+'</strong><br>'
    +'Recaudo: <strong>'+esc(rec.nombre)+'</strong><br>'
    +(bol
      ? 'Valor por boleta: <strong style="color:var(--primary)">$'+Number(rec.valorBoleta||0).toLocaleString('es-CO')+'</strong>'
      : (rec.metaAlumna>0?'Aporte sugerido: <strong style="color:var(--primary)">$'+rec.metaAlumna.toLocaleString('es-CO')+'</strong>':'')
        +(tieneAporte?'<br><span style="color:var(--success);font-size:12px">✅ Aporte actual: $'+Number(aporte.monto).toLocaleString('es-CO')+'</span>':''));
  document.getElementById('aporte-cantidad-wrap').style.display = bol ? '' : 'none';
  document.getElementById('aporte-cantidad').value = bol && Number(aporte.cantidad)>0 ? aporte.cantidad : '';
  document.getElementById('aporte-monto-label').textContent = bol ? 'Monto pagado ($)' : 'Monto aportado ($) *';
  document.getElementById('aporte-monto').value = Number(aporte.monto)>0 ? aporte.monto : '';
  document.getElementById('aporte-fecha').value = aporte.fecha||dateStr(getHoyReal());
  document.getElementById('aporte-nota').value  = aporte.nota||'';
  calcBoletasAporte();
  // Mostrar botón borrar solo si ya tiene aporte
  const btnBorrar = document.getElementById('btn-borrar-aporte');
  if(btnBorrar) btnBorrar.style.display = tieneAporte ? 'inline-flex' : 'none';
  abrirModal('modal-aporte');
}

// Boletería: muestra en vivo "cantidad × valor = total · saldo"
function calcBoletasAporte(){
  const out=document.getElementById('aporte-calc');
  const rec=(DB.recaudos||[]).find(function(r){ return r.id===aporteRecaudoId; });
  if(!out) return;
  if(!_esBoleteria(rec)){ out.textContent=''; return; }
  const cant=Number(document.getElementById('aporte-cantidad').value)||0;
  const pagado=Number(document.getElementById('aporte-monto').value)||0;
  const total=cant*(Number(rec.valorBoleta)||0);
  const saldo=Math.max(0,total-pagado);
  out.textContent = cant
    ? cant+' × $'+Number(rec.valorBoleta).toLocaleString('es-CO')+' = $'+total.toLocaleString('es-CO')
      +(saldo>0?' · debe $'+saldo.toLocaleString('es-CO'):' · ✅ pagado completo')
    : '';
}

function borrarAporte(){
  if(!confirm('¿Borrar el aporte de esta alumna?')) return;
  const rec = (DB.recaudos||[]).find(function(r){return r.id===aporteRecaudoId;});
  if(!rec) return;
  if(rec.aportes) {
    rec.aportes[String(aporteAlumnaId)] = {monto:0,cantidad:0,fecha:'',nota:'',pagado:false};
  }
  cerrarModal('modal-aporte');
  _saveRecaudos();
  renderRecaudos();
  toast('🗑️ Aporte eliminado');
}

function guardarAporte(){
  const rec = (DB.recaudos||[]).find(function(r){return r.id===aporteRecaudoId;});
  if(!rec) return;
  const bol = _esBoleteria(rec);
  const monto = Number(document.getElementById('aporte-monto').value)||0;
  const cantidad = bol ? (parseInt(document.getElementById('aporte-cantidad').value,10)||0) : 0;
  if(bol){
    if(cantidad<=0){ toast('Indica cuántas boletas pide','err'); return; }
  } else if(!monto){ toast('Ingresa un monto','err'); return; }
  if(!rec.aportes) rec.aportes={};
  // Guardar con clave string (consistente con JS que usa objetos con keys string)
  const total = bol ? cantidad*(Number(rec.valorBoleta)||0) : 0;
  rec.aportes[String(aporteAlumnaId)] = {
    monto:monto,
    cantidad:cantidad,
    fecha:document.getElementById('aporte-fecha').value,
    nota:document.getElementById('aporte-nota').value.trim(),
    pagado: bol ? (monto>=total && total>0) : monto>0,
    _editTs:Date.now()
  };
  cerrarModal('modal-aporte');
  _saveRecaudos();
  renderRecaudos();
  toast(bol
    ? '🎟️ '+cantidad+' boleta'+(cantidad>1?'s':'')+' registrada'+(cantidad>1?'s':'')
    : '✅ Aporte registrado — $'+monto.toLocaleString('es-CO'));
}

function renderRecaudos(){
  if(!DB.recaudos||!DB.recaudos.length){
    document.getElementById('recaudos-lista').innerHTML=
      '<div style="text-align:center;color:var(--text2);padding:60px 20px">'
      +'<div style="font-size:48px;margin-bottom:12px">🎯</div>'
      +'<div style="font-size:15px;font-weight:600;margin-bottom:6px">Sin recaudos activos</div>'
      +'<div style="font-size:13px">Crea un recaudo para empezar a registrar aportes</div>'
      +'</div>';
    return;
  }

  const hoy = dateStr(getHoyReal());
  const soloPendientes = !!(document.getElementById('rec-solo-pendientes') && document.getElementById('rec-solo-pendientes').checked);
  const catIconos={Vestuario:'👗',Transporte:'🚌',Accesorios:'💃',Escenografía:'🎭',Alimentación:'🍱',Otro:'📌'};
  const $$ = function(n){ return '$'+Number(n||0).toLocaleString('es-CO'); };
  const stat = function(lbl,val,color){
    return '<div style="text-align:center;background:var(--card2);border-radius:10px;padding:10px">'
      +'<div style="font-size:10px;color:var(--text2);font-weight:700;text-transform:uppercase;letter-spacing:.5px">'+lbl+'</div>'
      +'<div style="font-size:18px;font-weight:800'+(color?';color:'+color:'')+'">'+val+'</div></div>';
  };

  // Orden: abiertos vigentes → abiertos vencidos → cerrados
  const peso = function(r){ return r.cerrado ? 2 : (r.cierre<hoy ? 1 : 0); };
  const lista=[].concat(DB.recaudos).sort(function(a,b){
    return (peso(a)-peso(b)) || String(a.cierre).localeCompare(String(b.cierre));
  });

  var html='';
  lista.forEach(function(rec){
    var bol = _esBoleteria(rec);
    var cerrado = !!rec.cerrado;
    var vencido = !cerrado && rec.cierre < hoy;
    var valorB = Number(rec.valorBoleta)||0;
    var alumnas = _alumnasRecaudo(rec);

    // Totales
    var totalRec=0, countPagaron=0, boletas=0, totalPedido=0, pidieron=0;
    alumnas.forEach(function(a){
      var ap=_aporteDe(rec,a.id), m=Number(ap.monto)||0, c=Number(ap.cantidad)||0;
      totalRec+=m;
      if(m>0) countPagaron++;
      if(bol && c>0){ boletas+=c; totalPedido+=c*valorB; pidieron++; }
    });
    var porCobrar = Math.max(0,totalPedido-totalRec);
    var metaTotal = bol ? totalPedido
      : (Number(rec.metaTotal)||(rec.metaAlumna>0?Number(rec.metaAlumna)*alumnas.length:0));
    var pctTotal=metaTotal>0?Math.min(100,Math.round(totalRec/metaTotal*100)):0;
    var barColor=pctTotal>=100?'var(--success)':pctTotal>=60?'#f4a916':'var(--primary)';
    var badge = cerrado ? '<span class="rec-badge cerrado">🔒 Cerrado'+(rec.fechaCerrado?' '+rec.fechaCerrado:'')+'</span>'
      : vencido ? '<span class="rec-badge vencido">⏰ Vencido</span>'
      : '<span class="rec-badge activo">✅ Activo</span>';

    var canvasId = 'rec-chart-'+rec.id.replace(/[^a-z0-9]/gi,'_');

    // Filas: en boletería, primero quienes pidieron; filtro de pendientes = deben algo
    var debe = function(a){
      var ap=_aporteDe(rec,a.id), m=Number(ap.monto)||0;
      if(bol){ var c=Number(ap.cantidad)||0; return c>0 && m < c*valorB; }
      return !(m>0);
    };
    var alumnasFilas = soloPendientes ? alumnas.filter(debe) : alumnas.slice();
    if(bol){
      alumnasFilas.sort(function(x,y){
        return ((Number(_aporteDe(rec,y.id).cantidad)||0)>0) - ((Number(_aporteDe(rec,x.id).cantidad)||0)>0);
      });
    }

    var filasAlumnas='';
    alumnasFilas.forEach(function(a){
      var ap=_aporteDe(rec,a.id);
      var monto=Number(ap.monto)||0, cant=Number(ap.cantidad)||0;
      var nombre=a.nombre.split(' ').slice(0,2).join(' ');
      var btn = cerrado ? '' : '<button class="rec-alumna-btn rec-btn-aporte" data-rid="'+rec.id+'" data-aid="'+a.id+'">'+(bol&&!cant?'➕':'✏️')+'</button>';
      var nota = ap.nota?'<span style="font-size:10px;color:var(--text2);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(ap.nota)+'">'+esc(ap.nota)+'</span>':'';
      if(bol){
        var tot=cant*valorB, saldo=Math.max(0,tot-monto);
        var est = !cant ? '<span style="font-size:11px;color:var(--text2)">—</span>'
          : saldo<=0 ? '<span style="font-size:11px;font-weight:700;color:var(--success)">✅ '+$$(monto)+'</span>'
          : '<span style="font-size:11px;font-weight:700;color:var(--danger)">debe '+$$(saldo)+'</span>';
        filasAlumnas+='<div class="rec-alumna-row"'+(cant?'':' style="opacity:.55"')+'>'
          +'<span class="rec-alumna-nombre">'+esc(nombre)+'</span>'
          +'<span style="font-size:12px;font-weight:800;min-width:52px;text-align:center">'+(cant?'🎟️ '+cant:'')+'</span>'
          +'<span style="min-width:96px;text-align:right">'+est+'</span>'
          +nota+btn
          +'</div>';
      } else {
        var aportoPct=rec.metaAlumna>0?Math.min(100,Math.round(monto/Number(rec.metaAlumna)*100)):0;
        var apColor=monto>0?'var(--success)':'var(--card2)';
        filasAlumnas+='<div class="rec-alumna-row">'
          +'<span class="rec-alumna-nombre">'+esc(nombre)+'</span>'
          +(rec.metaAlumna>0?'<div class="rec-alumna-bar-wrap"><div class="rec-alumna-bar" style="width:'+aportoPct+'%;background:'+apColor+'"></div></div>':'')
          +'<span class="rec-alumna-monto">'+(monto>0?$$(monto):'—')+'</span>'
          +nota+btn
          +'</div>';
      }
    });

    var vacio = soloPendientes
      ? (bol?'✅ Nadie debe boletas':'✅ Todas han aportado')
      : 'Sin alumnas en este recaudo';

    var stats = bol
      ? '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">'
          +stat('Boletas pedidas', boletas+' <small style="font-size:11px;font-weight:600;color:var(--text2)">('+pidieron+' alumnas)</small>','var(--primary)')
          +stat('Enviar a organizadores', $$(totalPedido))
          +stat('Recaudado', $$(totalRec),'var(--success)')
          +stat('Por cobrar', $$(porCobrar), porCobrar>0?'var(--danger)':'var(--success)')
        +'</div>'
      : '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">'
          +stat('Recaudado', $$(totalRec),'var(--success)')
          +(metaTotal>0?stat('Meta', $$(metaTotal)):'<div></div>')
          +stat('Participación', countPagaron+'/'+alumnas.length,'var(--primary)')
        +'</div>';

    var acciones = cerrado
      ? '<button class="btn btn-ghost btn-sm rec-btn-reabrir" data-rid="'+rec.id+'" title="Reabrir recaudo">🔓 Reabrir</button>'
      : (vencido?'<button class="btn btn-primary btn-sm rec-btn-cerrar" data-rid="'+rec.id+'" title="Cerrar recaudo">🔒 Cerrar</button>':'')
        +'<button class="btn btn-ghost btn-sm btn-icon rec-btn-editar" data-rid="'+rec.id+'">✏️</button>';

    html+='<div class="rec-card"'+(cerrado?' style="opacity:.85"':'')+'>'
      +'<div class="rec-card-header">'
        +'<div>'
          +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">'
            +'<span style="font-size:18px">'+(bol?'🎟️':(catIconos[rec.cat]||'📌'))+'</span>'
            +'<span style="font-size:15px;font-weight:800">'+esc(rec.nombre)+'</span>'
            +badge
          +'</div>'
          +'<div style="font-size:12px;color:var(--text2)">📅 '+rec.inicio+' → '+rec.cierre
            +(bol?' · 🎟️ '+$$(valorB)+' c/u':'')
            +(rec.desc?' · '+esc(rec.desc):'')+'</div>'
        +'</div>'
        +'<div style="display:flex;gap:6px;align-items:center">'
          +acciones
          +'<button class="btn btn-danger btn-sm btn-icon rec-btn-eliminar" data-rid="'+rec.id+'">🗑️</button>'
        +'</div>'
      +'</div>'
      +'<div class="rec-card-body">'
        +stats
        +(metaTotal>0
          ?'<div style="margin-bottom:16px">'
            +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:4px">'
              +'<span>'+(bol?'Cobrado de lo pedido':'Progreso total')+'</span><span style="font-weight:700;color:'+barColor+'">'+pctTotal+'%</span>'
            +'</div>'
            +'<div class="rec-progress-wrap"><div class="rec-progress-bar" style="width:'+pctTotal+'%;background:'+barColor+'"></div></div>'
          +'</div>'
          :'')
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">'
          +'<div>'
            +'<div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">'+(bol?'📊 Boletas por alumna':'📊 Aportes por alumna')+'</div>'
            +'<div style="background:var(--card2);border-radius:10px;padding:12px">'
              +'<canvas id="'+canvasId+'" style="max-height:'+Math.min((bol?Math.max(pidieron,1):alumnas.length)*28+20,280)+'px"></canvas>'
            +'</div>'
          +'</div>'
          +'<div>'
            +'<div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">'
              +(cerrado?'🔒 Registro final':soloPendientes?('⏳ Pendientes de pago ('+alumnasFilas.length+')'):(bol?'🎟️ Pedidos de boletas':'✏️ Registrar / modificar'))+'</div>'
            +'<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">'
              +'<div style="padding:4px 14px">'+(filasAlumnas||'<div style="padding:16px;text-align:center;color:var(--success);font-size:13px;font-weight:600">'+vacio+'</div>')+'</div>'
            +'</div>'
          +'</div>'
        +'</div>'
      +'</div>'
    +'</div>';
  });

  document.getElementById('recaudos-lista').innerHTML=html;

  // Delegación de eventos
  document.getElementById('recaudos-lista').onclick = function(e){
    var t = function(c){ return e.target.closest(c); };
    var b;
    if((b=t('.rec-btn-aporte')))   abrirModalAporte(b.dataset.rid, b.dataset.aid);
    else if((b=t('.rec-btn-editar')))  abrirModalRecaudo(b.dataset.rid);
    else if((b=t('.rec-btn-cerrar')))  cerrarRecaudo(b.dataset.rid);
    else if((b=t('.rec-btn-reabrir'))) reabrirRecaudo(b.dataset.rid);
    else if((b=t('.rec-btn-eliminar'))) eliminarRecaudo(b.dataset.rid);
  };

  // Gráficos de barras horizontales por recaudo
  setTimeout(function(){
    lista.forEach(function(rec){
      var canvasId = 'rec-chart-'+rec.id.replace(/[^a-z0-9]/gi,'_');
      var el = document.getElementById(canvasId);
      if(!el) return;
      if(el._ch){el._ch.destroy();el._ch=null;}
      var bol=_esBoleteria(rec), valorB=Number(rec.valorBoleta)||0;
      var labels=[], datos=[], colores=[];
      _alumnasRecaudo(rec).forEach(function(a){
        var ap=_aporteDe(rec,a.id), monto=Number(ap.monto)||0, cant=Number(ap.cantidad)||0;
        if(bol){
          if(!cant) return;
          labels.push(a.nombre.split(' ').slice(0,2).join(' '));
          datos.push(cant);
          colores.push(monto>=cant*valorB?'rgba(26,160,83,.75)':monto>0?'rgba(244,169,22,.8)':'rgba(176,16,32,.6)');
        } else {
          labels.push(a.nombre.split(' ').slice(0,2).join(' '));
          datos.push(monto);
          colores.push(monto>0?'rgba(26,160,83,.75)':'rgba(200,200,200,.4)');
        }
      });
      var tc='#8a92a6';
      el._ch=new Chart(el,{type:'bar',
        data:{labels:labels,datasets:[{
          label:bol?'Boletas':'Aporte',data:datos,
          backgroundColor:colores,
          borderRadius:4,borderSkipped:false
        }]},
        options:{
          indexAxis:'y',
          responsive:true,
          maintainAspectRatio:false,
          plugins:{
            legend:{display:false},
            tooltip:{callbacks:{
              label:function(ctx){ return bol ? ' '+ctx.raw+' boleta'+(ctx.raw>1?'s':'') : ' $'+Number(ctx.raw).toLocaleString('es-CO'); }
            }}
          },
          scales:{
            x:{
              ticks:{color:tc,font:{size:9},precision:0,callback:function(v){ return bol ? v : '$'+Number(v/1000).toFixed(0)+'k'; }},
              grid:{color:'rgba(0,0,0,.05)'},beginAtZero:true
            },
            y:{ticks:{color:tc,font:{size:10}},grid:{display:false}}
          }
        }
      });
    });
  },150);
}


// ── OCULTAR/MOSTRAR INGRESOS ──
let _ingOculto = false;
function toggleOjoIngresos(){
  _ingOculto = !_ingOculto;
  const val = document.getElementById('ing-valor');
  const sub = document.getElementById('ing-sub');
  const btn = document.getElementById('btn-ojo-ing');
  if(val) val.classList.toggle('ing-oculto', _ingOculto);
  if(sub) sub.classList.toggle('ing-oculto', _ingOculto);
  if(btn) btn.textContent = _ingOculto ? '🙈' : '👁️';
}
