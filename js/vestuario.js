/* ═══════════════════════════════════════════════════════════
   vestuario.js
   Vestuarios, piezas codificadas y trazabilidad de uso
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

/*
  MODELO DE DATOS
  DB.vestuarios = [{ id, nombre, prefijo, color, desc,
                     piezas:[{ cod, tipo, talla, estado, nota }] }]
       estado pieza: 'buena' | 'dano' | 'reparacion' | 'baja'

  DB.usosVestuario = [{ id, presId, presTitulo, fecha, vestId, cod,
                        alumnaId, alumnaNombre, nota,
                        devuelto: null | 'buena' | 'dano' | 'perdida',
                        devNota, devFecha }]

  Una pieza está EN USO si tiene un uso con devuelto === null.
*/

let editVestId   = null;
let editPiezaVest = null, editPiezaCod = null;
let devUsoId     = null;
let vestFiltro   = '';

const EST_PIEZA = {
  buena:      { txt: '✅ Buena',          cls: 'libre' },
  dano:       { txt: '⚠️ Con daño',       cls: 'dano' },
  reparacion: { txt: '🔧 En reparación',  cls: 'reparacion' },
  baja:       { txt: '⛔ Dada de baja',   cls: 'baja' }
};
const EST_DEV = {
  buena:   { txt: '✅ Devuelta en buen estado', color: 'var(--success)' },
  dano:    { txt: '⚠️ Devuelta con daño',       color: 'var(--warning)' },
  perdida: { txt: '⛔ No devuelta / perdida',   color: 'var(--danger)' }
};

function _saveVest(){
  tsSeccion('vestuarios');      DB._ts_vestuarios    = Date.now();
  tsSeccion('usosVestuario');   DB._ts_usosVestuario = Date.now();
  snapLocal();
  _fbSave(DB).then(function(ok){
    if(ok){ desencolarGuardado(); _ultimoGuardado = Date.now(); }
    else  { encolarGuardado(); programarReintento(); }
  });
}

// Asigna id a presentaciones antiguas que no lo tengan (no rompe nada existente)
function _migrarIdsPresentaciones(){
  var cambio = false;
  (DB.presentaciones||[]).forEach(function(p,i){
    if(!p.id){ p.id = 'pres_'+i+'_'+(p.fecha||'').replace(/-/g,''); cambio = true; }
  });
  return cambio;
}

function _vest(id){ return (DB.vestuarios||[]).find(function(v){ return String(v.id)===String(id); }); }
function _pieza(vestId, cod){
  var v = _vest(vestId);
  if(!v) return null;
  return (v.piezas||[]).find(function(p){ return String(p.cod).toUpperCase()===String(cod).toUpperCase(); });
}
// Uso activo (sin devolver) de una pieza
function _usoActivo(vestId, cod){
  return (DB.usosVestuario||[]).find(function(u){
    return String(u.vestId)===String(vestId)
        && String(u.cod).toUpperCase()===String(cod).toUpperCase()
        && !u.devuelto;
  });
}
function _nombreAlumna(id){
  var a = todosLosAlumnos().find(function(x){ return String(x.id)===String(id); });
  return a ? a.nombre : 'Alumna retirada';
}

// ═════════════════ SUB-PESTAÑAS ═════════════════
function tabPres(tab){
  ['presentaciones','vestuario'].forEach(function(t){
    var cont = document.getElementById('tabpres-'+t);
    var btn  = document.getElementById('stab-'+t);
    if(cont) cont.style.display = (t===tab) ? 'block' : 'none';
    if(btn)  btn.classList.toggle('active', t===tab);
  });
  var bp = document.getElementById('btn-nueva-pres');
  var bv = document.getElementById('btn-nuevo-vest');
  var bu = document.getElementById('btn-nuevo-uso');
  if(bp) bp.style.display = (tab==='presentaciones') ? 'inline-flex' : 'none';
  if(bv) bv.style.display = (tab==='vestuario')      ? 'inline-flex' : 'none';
  if(bu) bu.style.display = (tab==='vestuario')      ? 'inline-flex' : 'none';
  if(tab==='vestuario') renderVestuario();
}

// ═════════════════ VESTUARIOS (CRUD) ═════════════════
function abrirModalVestuario(id){
  editVestId = id ? String(id) : null;
  var v = id ? _vest(id) : null;
  document.getElementById('modal-vestuario-title').textContent = v ? 'Editar Vestuario' : 'Nuevo Vestuario';
  document.getElementById('vest-nombre').value  = v ? v.nombre   : '';
  document.getElementById('vest-prefijo').value = v ? v.prefijo  : '';
  document.getElementById('vest-color').value   = v ? (v.color||'#3a57e8') : '#3a57e8';
  document.getElementById('vest-desc').value    = v ? (v.desc||'') : '';
  var bd = document.getElementById('btn-borrar-vest');
  if(bd) bd.style.display = v ? 'inline-flex' : 'none';
  abrirModal('modal-vestuario');
}

function guardarVestuario(){
  var nombre  = document.getElementById('vest-nombre').value.trim();
  var prefijo = document.getElementById('vest-prefijo').value.trim().toUpperCase();
  if(!nombre)  { toast('El nombre es obligatorio','err'); return; }
  if(!prefijo) { toast('El prefijo de código es obligatorio','err'); return; }
  if(!DB.vestuarios) DB.vestuarios = [];

  // El prefijo no puede repetirse entre vestuarios
  var choque = DB.vestuarios.find(function(v){
    return v.prefijo===prefijo && String(v.id)!==String(editVestId);
  });
  if(choque){ toast('El prefijo "'+prefijo+'" ya lo usa '+choque.nombre,'err'); return; }

  var datos = {
    nombre: nombre, prefijo: prefijo,
    color: document.getElementById('vest-color').value,
    desc:  document.getElementById('vest-desc').value.trim()
  };
  if(editVestId){
    var idx = DB.vestuarios.findIndex(function(v){ return String(v.id)===String(editVestId); });
    // Object.assign: NUNCA reconstruir el objeto, se perderían las piezas
    if(idx>=0) DB.vestuarios[idx] = Object.assign(DB.vestuarios[idx], datos);
  } else {
    datos.id = 'v_'+Date.now();
    datos.piezas = [];
    DB.vestuarios.push(datos);
  }
  cerrarModal('modal-vestuario');
  renderVestuario();
  _saveVest();
  toast('✅ Vestuario guardado');
}

function eliminarVestuario(){
  var v = _vest(editVestId);
  if(!v) return;
  var usos = (DB.usosVestuario||[]).filter(function(u){ return String(u.vestId)===String(v.id); }).length;
  if(!confirm('¿Eliminar el vestuario "'+v.nombre+'"?\n\nSe borrarán sus '+(v.piezas||[]).length+' pieza(s) y '+usos+' registro(s) de uso.')) return;
  DB.vestuarios    = (DB.vestuarios||[]).filter(function(x){ return String(x.id)!==String(v.id); });
  DB.usosVestuario = (DB.usosVestuario||[]).filter(function(u){ return String(u.vestId)!==String(v.id); });
  cerrarModal('modal-vestuario');
  renderVestuario();
  _saveVest();
  toast('Vestuario eliminado');
}

// ═════════════════ PIEZAS ═════════════════
function abrirModalPieza(vestId, cod){
  editPiezaVest = String(vestId);
  editPiezaCod  = cod ? String(cod) : null;
  var v = _vest(vestId);
  if(!v){ toast('Vestuario no encontrado','err'); return; }
  var p = cod ? _pieza(vestId, cod) : null;

  document.getElementById('modal-pieza-title').textContent = p ? 'Editar pieza '+p.cod : 'Nueva pieza';
  document.getElementById('pieza-vest-info').innerHTML =
    '<strong>'+v.nombre+'</strong> · prefijo <strong>'+v.prefijo+'</strong>'
    + (p ? '' : '<br><span style="font-size:11px;color:var(--text2)">Siguiente código sugerido: <strong>'+_sugerirCod(v)+'</strong></span>');

  document.getElementById('pieza-cod').value    = p ? p.cod : _sugerirCod(v);
  document.getElementById('pieza-tipo').value   = p ? p.tipo : 'Falda';
  document.getElementById('pieza-talla').value  = p ? (p.talla||'') : '';
  document.getElementById('pieza-estado').value = p ? (p.estado||'buena') : 'buena';
  document.getElementById('pieza-nota').value   = p ? (p.nota||'') : '';
  document.getElementById('pieza-lote').value   = '';

  var wrap = document.getElementById('pieza-lote-wrap');
  if(wrap) wrap.style.display = p ? 'none' : 'block';
  var bd = document.getElementById('btn-borrar-pieza');
  if(bd) bd.style.display = p ? 'inline-flex' : 'none';
  abrirModal('modal-pieza');
}

function _sugerirCod(v){
  var max = 0;
  (v.piezas||[]).forEach(function(p){
    var n = parseInt(String(p.cod).replace(v.prefijo,''), 10);
    if(!isNaN(n) && n>max) max = n;
  });
  return v.prefijo + (max+1);
}

function guardarPieza(){
  var v = _vest(editPiezaVest);
  if(!v) return;
  if(!v.piezas) v.piezas = [];

  var cod    = document.getElementById('pieza-cod').value.trim().toUpperCase();
  var tipo   = document.getElementById('pieza-tipo').value;
  var talla  = document.getElementById('pieza-talla').value.trim();
  var estado = document.getElementById('pieza-estado').value;
  var nota   = document.getElementById('pieza-nota').value.trim();
  if(!cod){ toast('El código es obligatorio','err'); return; }

  // Crear en lote
  var lote = parseInt(document.getElementById('pieza-lote').value, 10);
  if(!editPiezaCod && lote && lote>1){
    var base = parseInt(cod.replace(v.prefijo,''), 10);
    if(isNaN(base)){ toast('Para crear en lote el código debe terminar en número','err'); return; }
    var creadas = 0, saltadas = 0;
    for(var i=0; i<lote; i++){
      var c = v.prefijo + (base+i);
      if(_pieza(v.id, c)){ saltadas++; continue; }
      v.piezas.push({ cod:c, tipo:tipo, talla:talla, estado:'buena', nota:nota });
      creadas++;
    }
    cerrarModal('modal-pieza');
    renderVestuario();
    _saveVest();
    toast('✅ '+creadas+' piezas creadas'+(saltadas?' ('+saltadas+' ya existían)':''));
    return;
  }

  // Código duplicado dentro del mismo vestuario
  var dup = (v.piezas||[]).find(function(p){
    return String(p.cod).toUpperCase()===cod && String(p.cod).toUpperCase()!==String(editPiezaCod||'').toUpperCase();
  });
  if(dup){ toast('El código '+cod+' ya existe en este vestuario','err'); return; }

  if(editPiezaCod){
    var pz = _pieza(v.id, editPiezaCod);
    if(pz) Object.assign(pz, { cod:cod, tipo:tipo, talla:talla, estado:estado, nota:nota });
    // Si cambió el código, actualizar los usos históricos para no perder el rastro
    if(String(editPiezaCod).toUpperCase()!==cod){
      (DB.usosVestuario||[]).forEach(function(u){
        if(String(u.vestId)===String(v.id) && String(u.cod).toUpperCase()===String(editPiezaCod).toUpperCase()) u.cod = cod;
      });
    }
  } else {
    v.piezas.push({ cod:cod, tipo:tipo, talla:talla, estado:estado, nota:nota });
  }
  cerrarModal('modal-pieza');
  renderVestuario();
  _saveVest();
  toast('✅ Pieza guardada');
}

function eliminarPieza(){
  var v = _vest(editPiezaVest);
  if(!v || !editPiezaCod) return;
  var usos = (DB.usosVestuario||[]).filter(function(u){
    return String(u.vestId)===String(v.id) && String(u.cod).toUpperCase()===String(editPiezaCod).toUpperCase();
  }).length;
  if(!confirm('¿Eliminar la pieza '+editPiezaCod+'?'+(usos?'\n\nTiene '+usos+' registro(s) de uso que también se borrarán.':''))) return;
  v.piezas = (v.piezas||[]).filter(function(p){ return String(p.cod).toUpperCase()!==String(editPiezaCod).toUpperCase(); });
  DB.usosVestuario = (DB.usosVestuario||[]).filter(function(u){
    return !(String(u.vestId)===String(v.id) && String(u.cod).toUpperCase()===String(editPiezaCod).toUpperCase());
  });
  cerrarModal('modal-pieza');
  renderVestuario();
  _saveVest();
  toast('Pieza eliminada');
}

// ═════════════════ REGISTRO DE USO ═════════════════
function abrirModalUso(){
  if(!(DB.vestuarios||[]).length){ toast('Primero crea un vestuario','info'); return; }
  if(_migrarIdsPresentaciones()) snapLocal();

  // Presentaciones ordenadas de más reciente a más antigua
  var pres = (DB.presentaciones||[]).slice().sort(function(a,b){
    return String(b.fecha||'').localeCompare(String(a.fecha||''));
  });
  document.getElementById('uso-pres').innerHTML =
    '<option value="">— Sin presentación (uso suelto) —</option>'
    + pres.map(function(p){
        return '<option value="'+p.id+'">'+p.titulo+(p.fecha?' · '+p.fecha:'')+'</option>';
      }).join('');

  document.getElementById('uso-vest').innerHTML = (DB.vestuarios||[]).map(function(v){
    return '<option value="'+v.id+'">'+v.nombre+' ('+v.prefijo+')</option>';
  }).join('');

  document.getElementById('uso-alumna').innerHTML =
    '<option value="">— Selecciona alumna —</option>'
    + (DB.alumnos||[]).slice().sort(function(a,b){ return a.nombre.localeCompare(b.nombre); })
        .map(function(a){ return '<option value="'+a.id+'">'+a.nombre+'</option>'; }).join('');

  document.getElementById('uso-fecha').value = dateStr(getHoyReal());
  document.getElementById('uso-nota').value  = '';
  cargarPiezasUso();
  abrirModal('modal-uso');
}

function onCambioPresUso(){
  var pid = document.getElementById('uso-pres').value;
  var p = (DB.presentaciones||[]).find(function(x){ return String(x.id)===String(pid); });
  if(p && p.fecha) document.getElementById('uso-fecha').value = p.fecha;
}

function cargarPiezasUso(){
  var vestId = document.getElementById('uso-vest').value;
  var v = _vest(vestId);
  var cont = document.getElementById('uso-piezas');
  if(!v || !(v.piezas||[]).length){
    cont.innerHTML = '<p style="font-size:12px;color:var(--text2);text-align:center;padding:10px">Este vestuario no tiene piezas. Agrégalas primero.</p>';
    return;
  }
  var libres = v.piezas.filter(function(p){
    return p.estado!=='baja' && !_usoActivo(v.id, p.cod);
  });
  if(!libres.length){
    cont.innerHTML = '<p style="font-size:12px;color:var(--text2);text-align:center;padding:10px">Todas las piezas están entregadas o dadas de baja.</p>';
    return;
  }
  cont.innerHTML = libres.map(function(p){
    return '<label class="check-group" style="padding:5px 0">'
      + '<input type="checkbox" class="uso-pz-check" value="'+p.cod+'">'
      + '<span style="font-size:13px"><strong style="font-family:ui-monospace,monospace">'+p.cod+'</strong> · '+p.tipo
      + (p.talla?' · talla '+p.talla:'')
      + (p.estado==='dano'?' <span style="color:var(--warning);font-size:11px">⚠️ con daño</span>':'')
      + (p.estado==='reparacion'?' <span style="color:var(--info);font-size:11px">🔧 en reparación</span>':'')
      + '</span></label>';
  }).join('');
}

function guardarUso(){
  var vestId   = document.getElementById('uso-vest').value;
  var alumnaId = document.getElementById('uso-alumna').value;
  var fecha    = document.getElementById('uso-fecha').value;
  if(!alumnaId){ toast('Selecciona la alumna','err'); return; }
  if(!fecha){ toast('Indica la fecha','err'); return; }

  var cods = [].slice.call(document.querySelectorAll('.uso-pz-check:checked')).map(function(c){ return c.value; });
  if(!cods.length){ toast('Selecciona al menos una pieza','err'); return; }

  var presId = document.getElementById('uso-pres').value;
  var pres = (DB.presentaciones||[]).find(function(x){ return String(x.id)===String(presId); });
  var nota = document.getElementById('uso-nota').value.trim();
  if(!DB.usosVestuario) DB.usosVestuario = [];

  cods.forEach(function(cod, i){
    DB.usosVestuario.push({
      id: 'u_'+Date.now()+'_'+i,
      presId: presId || null,
      presTitulo: pres ? pres.titulo : '',
      fecha: fecha,
      vestId: vestId,
      cod: cod,
      alumnaId: alumnaId,
      alumnaNombre: _nombreAlumna(alumnaId),
      nota: nota,
      devuelto: null, devNota: '', devFecha: ''
    });
  });

  cerrarModal('modal-uso');
  renderVestuario();
  _saveVest();
  toast('✅ '+cods.length+' pieza(s) entregadas a '+_nombreAlumna(alumnaId).split(' ')[0]);
}

// ═════════════════ DEVOLUCIÓN ═════════════════
function abrirModalDevolucion(usoId){
  devUsoId = String(usoId);
  var u = (DB.usosVestuario||[]).find(function(x){ return String(x.id)===devUsoId; });
  if(!u) return;
  var v = _vest(u.vestId);
  document.getElementById('dev-info').innerHTML =
    '<strong style="font-family:ui-monospace,monospace">'+u.cod+'</strong> · '+(v?v.nombre:'')+'<br>'
    + 'Entregada a <strong>'+u.alumnaNombre+'</strong> el '+u.fecha
    + (u.presTitulo?'<br><span style="font-size:11px;color:var(--text2)">'+u.presTitulo+'</span>':'');
  document.getElementById('dev-estado').value = u.devuelto || 'buena';
  document.getElementById('dev-nota').value   = u.devNota || '';
  abrirModal('modal-devolucion');
}

function guardarDevolucion(){
  var u = (DB.usosVestuario||[]).find(function(x){ return String(x.id)===devUsoId; });
  if(!u) return;
  var estado = document.getElementById('dev-estado').value;
  u.devuelto = estado;
  u.devNota  = document.getElementById('dev-nota').value.trim();
  u.devFecha = dateStr(getHoyReal());

  // La devolución actualiza el estado de la pieza
  var pz = _pieza(u.vestId, u.cod);
  if(pz){
    if(estado==='dano')         pz.estado = 'dano';
    else if(estado==='perdida') pz.estado = 'baja';
    else if(pz.estado!=='reparacion') pz.estado = 'buena';
    if(u.devNota) pz.nota = u.devNota;
  }
  cerrarModal('modal-devolucion');
  renderVestuario();
  _saveVest();
  toast(estado==='buena' ? '✅ Devolución registrada' : '⚠️ Registrada con novedad');
}

function filtrarVestuario(v){ vestFiltro = (v||'').toLowerCase(); renderVestuario(); }

// ═════════════════ RENDER ═════════════════
function renderVestuario(){
 try{
  var cont = document.getElementById('vest-content');
  if(!cont) return;
  var vests = DB.vestuarios||[];
  var usos  = DB.usosVestuario||[];

  if(!vests.length){
    cont.innerHTML =
      '<div style="text-align:center;color:var(--text2);padding:60px 20px">'
      + '<div style="font-size:48px;margin-bottom:12px">👗</div>'
      + '<div style="font-size:15px;font-weight:600;margin-bottom:6px">Sin vestuarios registrados</div>'
      + '<div style="font-size:13px">Crea uno (Negro Tricolor, Amarillo, Rosado…) y agrégale sus piezas codificadas</div>'
      + '</div>';
    return;
  }

  // ── Totales ──
  var totPiezas=0, totUso=0, totDano=0;
  vests.forEach(function(v){
    (v.piezas||[]).forEach(function(p){
      totPiezas++;
      if(_usoActivo(v.id,p.cod)) totUso++;
      if(p.estado==='dano'||p.estado==='reparacion') totDano++;
    });
  });
  var pendientes = usos.filter(function(u){ return !u.devuelto; });

  var html =
    '<div class="cards-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">'
    + _statCard('👗','Piezas totales', totPiezas, 'var(--text)')
    + _statCard('📤','Entregadas ahora', totUso, 'var(--primary)')
    + _statCard('⚠️','Con daño / reparación', totDano, totDano?'var(--warning)':'var(--success)')
    + _statCard('🎭','Registros de uso', usos.length, 'var(--text)')
    + '</div>';

  // ── Pendientes de devolución ──
  if(pendientes.length){
    html += '<div class="table-card" style="margin-bottom:20px">'
      + '<div class="table-card-header"><h3>📤 Pendientes de devolución ('+pendientes.length+')</h3></div>'
      + '<div style="padding:6px 18px">'
      + pendientes.slice().sort(function(a,b){ return String(b.fecha).localeCompare(String(a.fecha)); }).map(function(u){
          var v = _vest(u.vestId);
          var dias = Math.floor((new Date(dateStr(getHoyReal())+'T12:00') - new Date(u.fecha+'T12:00'))/86400000);
          return '<div class="uso-row">'
            + '<span class="uso-cod">'+u.cod+'</span>'
            + '<span style="flex:1;min-width:150px;font-size:13px"><strong>'+u.alumnaNombre+'</strong>'
              + '<div style="font-size:11px;color:var(--text2)">'+(v?v.nombre:'')+(u.presTitulo?' · '+u.presTitulo:'')+'</div></span>'
            + '<span style="font-size:11px;color:'+(dias>14?'var(--danger)':'var(--text2)')+';white-space:nowrap">'
              + u.fecha + (dias>0 ? ' · hace '+dias+'d' : ' · hoy') + '</span>'
            + '<button class="btn btn-primary btn-sm" onclick="abrirModalDevolucion(\'' + u.id + '\')">↩️ Devolver</button>'
            + '</div>';
        }).join('')
      + '</div></div>';
  }

  // ── Tarjeta por vestuario ──
  vests.forEach(function(v){
    var piezas = (v.piezas||[]).slice().sort(function(a,b){
      var na=parseInt(String(a.cod).replace(v.prefijo,''),10), nb=parseInt(String(b.cod).replace(v.prefijo,''),10);
      if(!isNaN(na)&&!isNaN(nb)) return na-nb;
      return String(a.cod).localeCompare(String(b.cod));
    });
    var enUso = piezas.filter(function(p){ return !!_usoActivo(v.id,p.cod); }).length;

    html += '<div class="vest-card">'
      + '<div class="vest-header">'
        + '<span class="vest-dot" style="background:'+(v.color||'#3a57e8')+'"></span>'
        + '<div style="flex:1;min-width:160px">'
          + '<div style="font-size:15px;font-weight:800">'+v.nombre+' <span style="font-size:11px;color:var(--text2);font-weight:600">prefijo '+v.prefijo+'</span></div>'
          + '<div style="font-size:12px;color:var(--text2)">'+piezas.length+' pieza(s) · '+enUso+' entregada(s)'+(v.desc?' · '+v.desc:'')+'</div>'
        + '</div>'
        + '<button class="btn btn-ghost btn-sm" onclick="abrirModalPieza(\'' + v.id + '\')">➕ Pieza</button>'
        + '<button class="btn btn-ghost btn-sm btn-icon" onclick="abrirModalVestuario(\'' + v.id + '\')">✏️</button>'
      + '</div>'
      + '<div class="vest-body">';

    if(!piezas.length){
      html += '<p style="font-size:13px;color:var(--text2);text-align:center;padding:14px">Sin piezas. Usa «➕ Pieza» para agregarlas (puedes crear varias de una vez).</p>';
    } else {
      html += piezas.map(function(p){
        var act = _usoActivo(v.id, p.cod);
        var cls = act ? 'enuso' : (EST_PIEZA[p.estado]||EST_PIEZA.buena).cls;
        var tt  = p.tipo + (p.talla?' · talla '+p.talla:'')
                + ' · ' + (EST_PIEZA[p.estado]||EST_PIEZA.buena).txt
                + (act ? ' — la tiene '+act.alumnaNombre : '')
                + (p.nota?' · '+p.nota:'');
        return '<span class="pieza-chip '+cls+'" title="'+tt.replace(/"/g,'')+'" onclick="abrirModalPieza(\'' + v.id + '\',\'' + p.cod + '\')">'
          + p.cod
          + (act ? ' <span style="font-weight:600;font-size:10px">→ '+act.alumnaNombre.split(' ')[0]+'</span>' : '')
          + (p.estado==='dano' ? ' ⚠️' : p.estado==='reparacion' ? ' 🔧' : p.estado==='baja' ? ' ⛔' : '')
          + '</span>';
      }).join('')
      + '<div class="vest-leyenda">'
        + '<span><i style="background:var(--card2);border:1px solid var(--border)"></i>disponible</span>'
        + '<span><i style="background:var(--primary)"></i>entregada</span>'
        + '<span><i style="background:var(--warning)"></i>con daño</span>'
        + '<span><i style="background:var(--info)"></i>reparación</span>'
      + '</div>';
    }
    html += '</div></div>';
  });

  // ── Historial ──
  var filtro = vestFiltro;
  var hist = usos.slice().sort(function(a,b){ return String(b.fecha).localeCompare(String(a.fecha)); });
  if(filtro){
    hist = hist.filter(function(u){
      return (u.alumnaNombre||'').toLowerCase().indexOf(filtro)>=0
          || String(u.cod).toLowerCase().indexOf(filtro)>=0
          || (u.presTitulo||'').toLowerCase().indexOf(filtro)>=0;
    });
  }

  html += '<div class="table-card">'
    + '<div class="table-card-header">'
      + '<h3>📜 Historial de uso</h3>'
      + '<input type="text" class="search-input" placeholder="🔍 Buscar por alumna, código o presentación…" '
        + 'value="'+filtro+'" oninput="filtrarVestuario(this.value)" style="min-width:240px">'
    + '</div>';

  if(!hist.length){
    html += '<p style="text-align:center;color:var(--text2);padding:36px">'
      + (filtro ? 'Sin resultados para «'+filtro+'»' : 'Sin registros de uso todavía. Usa «📋 Registrar uso».')
      + '</p>';
  } else {
    html += '<table><thead><tr>'
      + '<th>Código</th><th>Alumna</th><th>Vestuario</th><th>Presentación</th><th>Fecha</th><th>Estado</th><th></th>'
      + '</tr></thead><tbody>'
      + hist.map(function(u){
          var v = _vest(u.vestId);
          var d = u.devuelto ? EST_DEV[u.devuelto] : null;
          return '<tr>'
            + '<td><span class="uso-cod">'+u.cod+'</span></td>'
            + '<td style="font-weight:600">'+u.alumnaNombre+'</td>'
            + '<td style="font-size:12px;color:var(--text2)">'+(v?v.nombre:'—')+'</td>'
            + '<td style="font-size:12px">'+(u.presTitulo||'—')+'</td>'
            + '<td style="font-size:12px;color:var(--text2)">'+u.fecha+'</td>'
            + '<td style="font-size:12px;font-weight:600;color:'+(d?d.color:'var(--primary)')+'">'
              + (d ? d.txt : '📤 Sin devolver')
              + (u.devNota ? '<div style="font-size:10px;font-weight:400;color:var(--text2)">'+u.devNota+'</div>' : '')
            + '</td>'
            + '<td><button class="btn btn-ghost btn-sm btn-icon" onclick="abrirModalDevolucion(\'' + u.id + '\')" title="Registrar o corregir devolución">↩️</button></td>'
            + '</tr>';
        }).join('')
      + '</tbody></table>';
  }
  html += '</div>';

  cont.innerHTML = html;

 }catch(err){
  console.error('renderVestuario:', err);
  var c = document.getElementById('vest-content');
  if(c) c.innerHTML = '<div style="background:var(--danger-lt);border-radius:10px;padding:20px;color:var(--danger)">'
    + '⚠️ Error mostrando vestuario: '+err.message+'<br><small>Los datos están seguros. Recarga la página.</small></div>';
 }
}

function _statCard(icono, label, valor, color){
  return '<div class="stat-card">'
    + '<div class="stat-icon-wrap" style="background:var(--card2)">'+icono+'</div>'
    + '<div class="stat-body"><div class="stat-label">'+label+'</div>'
    + '<div class="stat-val" style="color:'+color+'">'+valor+'</div></div></div>';
}
