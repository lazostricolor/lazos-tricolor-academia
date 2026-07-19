/* ═══════════════════════════════════════════════════════════
   vestuario.js
   Vestuarios, conjuntos codificados y trazabilidad de uso
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

/*
  MODELO DE DATOS

  Un CONJUNTO es el traje completo de una bailarina.
  Todas sus prendas llevan el MISMO código: falda A12 + blusa A12 = conjunto A12.

  DB.vestuarios = [{ id, nombre, prefijo, color, desc,
                     prendas: ['Falda','Blusa','Cinta'],        // qué compone un conjunto
                     conjuntos: [{ cod, talla, estado, nota, fija }] }]
       estado: 'buena' | 'dano' | 'reparacion' | 'baja'
       fija:   id de la alumna a la que suele asignarse (opcional)

  DB.usosVestuario = [{ id, presId, presTitulo, fecha, vestId, cod,
                        alumnaId, alumnaNombre, nota,
                        devuelto: null|'buena'|'dano'|'perdida',
                        devNota, devPrendas:[], devFecha }]

  Un conjunto está ENTREGADO si tiene un uso con devuelto === null.
*/

let editVestId    = null;
let editPiezaVest = null, editPiezaCod = null;
let devUsoId      = null;
let vestFiltro    = '';
let usoPreVest    = null, usoPreCod = null;   // preselección al asignar desde una fila

const EST_PIEZA = {
  buena:      { txt: '✅ Bueno',          cls: 'libre',      badge: 'badge-paid'    },
  dano:       { txt: '⚠️ Con daño',       cls: 'dano',       badge: 'badge-partial' },
  reparacion: { txt: '🔧 En reparación',  cls: 'reparacion', badge: 'badge-partial' },
  baja:       { txt: '⛔ Dado de baja',   cls: 'baja',       badge: 'badge-unpaid'  }
};
const EST_DEV = {
  buena:   { txt: '✅ Devuelto en buen estado', color: 'var(--success)' },
  dano:    { txt: '⚠️ Devuelto con daño',       color: 'var(--warning)' },
  perdida: { txt: '⛔ No devuelto / perdido',   color: 'var(--danger)'  }
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

// Migra el formato anterior (piezas sueltas por tipo) a conjuntos completos
function _migrarVestuarios(){
  var cambio = false;
  (DB.vestuarios||[]).forEach(function(v){
    if(v.piezas && !v.conjuntos){
      var tipos = [];
      v.piezas.forEach(function(p){ if(p.tipo && tipos.indexOf(p.tipo)<0) tipos.push(p.tipo); });
      v.prendas   = tipos.length ? tipos : ['Falda','Blusa'];
      v.conjuntos = v.piezas.map(function(p){
        return { cod:p.cod, talla:p.talla||'', estado:p.estado||'buena', nota:p.nota||'', fija:null };
      });
      delete v.piezas;
      cambio = true;
    }
    if(!v.conjuntos){ v.conjuntos = []; }
    if(!v.prendas || !v.prendas.length){ v.prendas = ['Falda','Blusa']; cambio = true; }
  });
  return cambio;
}

// Asigna id a presentaciones antiguas para poder vincular el uso
function _migrarIdsPresentaciones(){
  var cambio = false;
  (DB.presentaciones||[]).forEach(function(p,i){
    if(!p.id){ p.id = 'pres_'+i+'_'+String(p.fecha||'').replace(/-/g,''); cambio = true; }
  });
  return cambio;
}

function _vest(id){ return (DB.vestuarios||[]).find(function(v){ return String(v.id)===String(id); }); }
function _conj(vestId, cod){
  var v = _vest(vestId);
  if(!v) return null;
  return (v.conjuntos||[]).find(function(c){ return String(c.cod).toUpperCase()===String(cod).toUpperCase(); });
}

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
function _ordenarConj(v, lista){
  return lista.slice().sort(function(a,b){
    var na = parseInt(String(a.cod).replace(v.prefijo,''),10),
        nb = parseInt(String(b.cod).replace(v.prefijo,''),10);
    if(!isNaN(na) && !isNaN(nb)) return na-nb;
    return String(a.cod).localeCompare(String(b.cod));
  });
}
function _optsAlumnas(sel){
  return '<option value="">— Sin asignación fija —</option>'
    + (DB.alumnos||[]).slice().sort(function(a,b){ return a.nombre.localeCompare(b.nombre); })
        .map(function(a){
          return '<option value="'+a.id+'"'+(String(sel)===String(a.id)?' selected':'')+'>'+a.nombre+'</option>';
        }).join('');
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

// ═════════════════ VESTUARIOS ═════════════════
function abrirModalVestuario(id){
  editVestId = id ? String(id) : null;
  var v = id ? _vest(id) : null;
  document.getElementById('modal-vestuario-title').textContent = v ? 'Editar Vestuario' : 'Nuevo Vestuario';
  document.getElementById('vest-nombre').value  = v ? v.nombre  : '';
  document.getElementById('vest-prefijo').value = v ? v.prefijo : '';
  document.getElementById('vest-color').value   = v ? (v.color||'#3a57e8') : '#3a57e8';
  document.getElementById('vest-desc').value    = v ? (v.desc||'') : '';
  document.getElementById('vest-prendas').value = v ? (v.prendas||[]).join(', ') : 'Falda, Blusa';
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

  var choque = DB.vestuarios.find(function(v){
    return v.prefijo===prefijo && String(v.id)!==String(editVestId);
  });
  if(choque){ toast('El prefijo "'+prefijo+'" ya lo usa '+choque.nombre,'err'); return; }

  var prendas = document.getElementById('vest-prendas').value
        .split(',').map(function(s){ return s.trim(); }).filter(Boolean);
  if(!prendas.length) prendas = ['Falda','Blusa'];

  var datos = {
    nombre: nombre, prefijo: prefijo,
    color:   document.getElementById('vest-color').value,
    desc:    document.getElementById('vest-desc').value.trim(),
    prendas: prendas
  };
  if(editVestId){
    var idx = DB.vestuarios.findIndex(function(v){ return String(v.id)===String(editVestId); });
    // Object.assign: NUNCA reconstruir el objeto o se perderían los conjuntos
    if(idx>=0) DB.vestuarios[idx] = Object.assign(DB.vestuarios[idx], datos);
  } else {
    datos.id = 'v_'+Date.now();
    datos.conjuntos = [];
    DB.vestuarios.push(datos);
  }
  var eraNuevo = !editVestId;
  cerrarModal('modal-vestuario');
  renderVestuario();
  _saveVest();
  toast(eraNuevo ? '✅ Vestuario creado — ahora agrégale sus conjuntos' : '✅ Vestuario actualizado');
}

function eliminarVestuario(){
  var v = _vest(editVestId);
  if(!v) return;
  var usos = (DB.usosVestuario||[]).filter(function(u){ return String(u.vestId)===String(v.id); }).length;
  if(!confirm('¿Eliminar el vestuario "'+v.nombre+'"?\n\nSe borrarán sus '+(v.conjuntos||[]).length+' conjunto(s) y '+usos+' registro(s) de uso.')) return;
  DB.vestuarios    = (DB.vestuarios||[]).filter(function(x){ return String(x.id)!==String(v.id); });
  DB.usosVestuario = (DB.usosVestuario||[]).filter(function(u){ return String(u.vestId)!==String(v.id); });
  cerrarModal('modal-vestuario');
  renderVestuario();
  _saveVest();
  toast('Vestuario eliminado');
}

// ═════════════════ CONJUNTOS ═════════════════
function abrirModalPieza(vestId, cod){
  editPiezaVest = String(vestId);
  editPiezaCod  = cod ? String(cod) : null;
  var v = _vest(vestId);
  if(!v){ toast('Vestuario no encontrado','err'); return; }
  _migrarVestuarios();
  var c = cod ? _conj(vestId, cod) : null;

  document.getElementById('modal-pieza-title').textContent = c ? 'Conjunto '+c.cod : 'Nuevo conjunto';
  document.getElementById('pieza-vest-info').innerHTML =
    '<strong>'+v.nombre+'</strong> · prefijo <strong>'+v.prefijo+'</strong><br>'
    + '<span style="font-size:11px;color:var(--text2)">Cada conjunto incluye: <strong>'+(v.prendas||[]).join(' + ')+'</strong>'
    + (c ? '' : ' · siguiente código sugerido: <strong>'+_sugerirCod(v)+'</strong>') + '</span>';

  document.getElementById('pieza-cod').value    = c ? c.cod : _sugerirCod(v);
  document.getElementById('pieza-talla').value  = c ? (c.talla||'') : '';
  document.getElementById('pieza-estado').value = c ? (c.estado||'buena') : 'buena';
  document.getElementById('pieza-nota').value   = c ? (c.nota||'') : '';
  document.getElementById('pieza-fija').innerHTML = _optsAlumnas(c ? c.fija : '');
  document.getElementById('pieza-lote').value   = '';

  var wrap = document.getElementById('pieza-lote-wrap');
  if(wrap) wrap.style.display = c ? 'none' : 'block';
  var bd = document.getElementById('btn-borrar-pieza');
  if(bd) bd.style.display = c ? 'inline-flex' : 'none';
  abrirModal('modal-pieza');
}

function _sugerirCod(v){
  var max = 0;
  (v.conjuntos||[]).forEach(function(c){
    var n = parseInt(String(c.cod).replace(v.prefijo,''), 10);
    if(!isNaN(n) && n>max) max = n;
  });
  return v.prefijo + (max+1);
}

function guardarPieza(){
  var v = _vest(editPiezaVest);
  if(!v) return;
  if(!v.conjuntos) v.conjuntos = [];

  var cod    = document.getElementById('pieza-cod').value.trim().toUpperCase();
  var talla  = document.getElementById('pieza-talla').value.trim();
  var estado = document.getElementById('pieza-estado').value;
  var nota   = document.getElementById('pieza-nota').value.trim();
  var fija   = document.getElementById('pieza-fija').value || null;
  if(!cod){ toast('El código es obligatorio','err'); return; }

  // Crear varios de una vez
  var lote = parseInt(document.getElementById('pieza-lote').value, 10);
  if(!editPiezaCod && lote && lote>1){
    var base = parseInt(cod.replace(v.prefijo,''), 10);
    if(isNaN(base)){ toast('Para crear en lote el código debe terminar en número','err'); return; }
    var creados = 0, saltados = 0;
    for(var i=0; i<lote; i++){
      var cc = v.prefijo + (base+i);
      if(_conj(v.id, cc)){ saltados++; continue; }
      v.conjuntos.push({ cod:cc, talla:talla, estado:'buena', nota:nota, fija:null });
      creados++;
    }
    cerrarModal('modal-pieza');
    renderVestuario();
    _saveVest();
    toast('✅ '+creados+' conjuntos creados'+(saltados?' ('+saltados+' ya existían)':''));
    return;
  }

  var dup = (v.conjuntos||[]).find(function(c){
    return String(c.cod).toUpperCase()===cod
        && String(c.cod).toUpperCase()!==String(editPiezaCod||'').toUpperCase();
  });
  if(dup){ toast('El código '+cod+' ya existe en este vestuario','err'); return; }

  if(editPiezaCod){
    var cj = _conj(v.id, editPiezaCod);
    if(cj) Object.assign(cj, { cod:cod, talla:talla, estado:estado, nota:nota, fija:fija });
    // Si cambió el código, arrastrar el historial para no perder el rastro
    if(String(editPiezaCod).toUpperCase()!==cod){
      (DB.usosVestuario||[]).forEach(function(u){
        if(String(u.vestId)===String(v.id) && String(u.cod).toUpperCase()===String(editPiezaCod).toUpperCase()) u.cod = cod;
      });
    }
  } else {
    v.conjuntos.push({ cod:cod, talla:talla, estado:estado, nota:nota, fija:fija });
  }
  cerrarModal('modal-pieza');
  renderVestuario();
  _saveVest();
  toast('✅ Conjunto guardado');
}

function eliminarPieza(){
  var v = _vest(editPiezaVest);
  if(!v || !editPiezaCod) return;
  var usos = (DB.usosVestuario||[]).filter(function(u){
    return String(u.vestId)===String(v.id) && String(u.cod).toUpperCase()===String(editPiezaCod).toUpperCase();
  }).length;
  if(!confirm('¿Eliminar el conjunto '+editPiezaCod+'?'+(usos?'\n\nTiene '+usos+' registro(s) de uso que también se borrarán.':''))) return;
  v.conjuntos = (v.conjuntos||[]).filter(function(c){ return String(c.cod).toUpperCase()!==String(editPiezaCod).toUpperCase(); });
  DB.usosVestuario = (DB.usosVestuario||[]).filter(function(u){
    return !(String(u.vestId)===String(v.id) && String(u.cod).toUpperCase()===String(editPiezaCod).toUpperCase());
  });
  cerrarModal('modal-pieza');
  renderVestuario();
  _saveVest();
  toast('Conjunto eliminado');
}

// ═════════════════ ASIGNAR CONJUNTO ═════════════════
function asignarConjunto(vestId, cod){
  usoPreVest = String(vestId);
  usoPreCod  = String(cod);
  abrirModalUso();
}

function abrirModalUso(){
  _migrarVestuarios();
  if(!(DB.vestuarios||[]).length){ toast('Primero crea un vestuario','info'); return; }
  var hayConj = (DB.vestuarios||[]).some(function(v){ return (v.conjuntos||[]).length>0; });
  if(!hayConj){ toast('Primero agrega conjuntos con «➕ Conjunto»','info'); return; }
  if(_migrarIdsPresentaciones()) snapLocal();

  var pres = (DB.presentaciones||[]).slice().sort(function(a,b){
    return String(b.fecha||'').localeCompare(String(a.fecha||''));
  });
  document.getElementById('uso-pres').innerHTML =
    '<option value="">— Sin presentación (ensayo o uso suelto) —</option>'
    + pres.map(function(p){ return '<option value="'+p.id+'">'+p.titulo+(p.fecha?' · '+p.fecha:'')+'</option>'; }).join('');

  document.getElementById('uso-vest').innerHTML = (DB.vestuarios||[]).map(function(v){
    return '<option value="'+v.id+'"'+(usoPreVest&&String(v.id)===usoPreVest?' selected':'')+'>'+v.nombre+' ('+v.prefijo+')</option>';
  }).join('');

  document.getElementById('uso-alumna').innerHTML =
    '<option value="">— Selecciona alumna —</option>'
    + (DB.alumnos||[]).slice().sort(function(a,b){ return a.nombre.localeCompare(b.nombre); })
        .map(function(a){ return '<option value="'+a.id+'">'+a.nombre+'</option>'; }).join('');

  document.getElementById('uso-fecha').value = dateStr(getHoyReal());
  document.getElementById('uso-nota').value  = '';
  cargarPiezasUso();

  // Si vino desde una fila concreta: marcar ese conjunto y sugerir su alumna habitual
  if(usoPreCod){
    var chk = document.querySelectorAll('.uso-pz-check');
    for(var i=0;i<chk.length;i++){ if(chk[i].value===usoPreCod) chk[i].checked = true; }
    var cj = _conj(usoPreVest, usoPreCod);
    if(cj && cj.fija) document.getElementById('uso-alumna').value = cj.fija;
  }
  usoPreVest = null; usoPreCod = null;
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
  if(!v || !(v.conjuntos||[]).length){
    cont.innerHTML = '<p style="font-size:12px;color:var(--text2);text-align:center;padding:10px">Este vestuario no tiene conjuntos. Agrégalos con «➕ Conjunto».</p>';
    return;
  }
  var libres = _ordenarConj(v, v.conjuntos.filter(function(c){
    return c.estado!=='baja' && !_usoActivo(v.id, c.cod);
  }));
  if(!libres.length){
    cont.innerHTML = '<p style="font-size:12px;color:var(--text2);text-align:center;padding:10px">Todos los conjuntos están entregados o dados de baja.</p>';
    return;
  }
  cont.innerHTML = libres.map(function(c){
    return '<label class="check-group" style="padding:5px 0">'
      + '<input type="checkbox" class="uso-pz-check" value="'+c.cod+'">'
      + '<span style="font-size:13px"><strong style="font-family:ui-monospace,monospace">'+c.cod+'</strong>'
      + (c.talla?' · talla '+c.talla:'')
      + (c.fija?' · <span style="color:var(--primary);font-size:11px">habitual: '+_nombreAlumna(c.fija).split(' ')[0]+'</span>':'')
      + (c.estado==='dano'?' <span style="color:var(--warning);font-size:11px">⚠️ con daño</span>':'')
      + (c.estado==='reparacion'?' <span style="color:var(--info);font-size:11px">🔧 en reparación</span>':'')
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
  if(!cods.length){ toast('Selecciona al menos un conjunto','err'); return; }

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
      devuelto: null, devNota: '', devPrendas: [], devFecha: ''
    });
  });

  cerrarModal('modal-uso');
  renderVestuario();
  _saveVest();
  toast('✅ '+cods.join(', ')+' → '+_nombreAlumna(alumnaId).split(' ')[0]);
}

// ═════════════════ DEVOLUCIÓN ═════════════════
function abrirModalDevolucion(usoId){
  devUsoId = String(usoId);
  var u = (DB.usosVestuario||[]).find(function(x){ return String(x.id)===devUsoId; });
  if(!u) return;
  var v = _vest(u.vestId);

  document.getElementById('dev-info').innerHTML =
    '<strong style="font-family:ui-monospace,monospace;font-size:15px">'+u.cod+'</strong> · '+(v?v.nombre:'')+'<br>'
    + 'Lo tiene <strong>'+u.alumnaNombre+'</strong> desde el '+u.fecha
    + (u.presTitulo?'<br><span style="font-size:11px;color:var(--text2)">'+u.presTitulo+'</span>':'')
    + (v&&v.prendas?'<br><span style="font-size:11px;color:var(--text2)">Incluye: '+v.prendas.join(' + ')+'</span>':'');

  document.getElementById('dev-estado').value = u.devuelto || 'buena';
  document.getElementById('dev-nota').value   = u.devNota || '';

  // Checkboxes de prendas con novedad
  var wrap = document.getElementById('dev-prendas-wrap');
  var cont = document.getElementById('dev-prendas');
  if(v && v.prendas && v.prendas.length){
    cont.innerHTML = v.prendas.map(function(pr){
      var marc = (u.devPrendas||[]).indexOf(pr)>=0 ? ' checked' : '';
      return '<label class="check-group" style="padding:3px 0">'
        + '<input type="checkbox" class="dev-pr-check" value="'+pr+'"'+marc+'>'
        + '<span style="font-size:13px">'+pr+'</span></label>';
    }).join('');
  } else { cont.innerHTML = ''; }

  var sel = document.getElementById('dev-estado');
  if(wrap) wrap.style.display = (sel.value!=='buena') ? 'block' : 'none';
  sel.onchange = function(){ if(wrap) wrap.style.display = (this.value!=='buena') ? 'block' : 'none'; };

  abrirModal('modal-devolucion');
}

function guardarDevolucion(){
  var u = (DB.usosVestuario||[]).find(function(x){ return String(x.id)===devUsoId; });
  if(!u) return;
  var estado = document.getElementById('dev-estado').value;
  u.devuelto   = estado;
  u.devNota    = document.getElementById('dev-nota').value.trim();
  u.devPrendas = [].slice.call(document.querySelectorAll('.dev-pr-check:checked')).map(function(c){ return c.value; });
  u.devFecha   = dateStr(getHoyReal());

  var cj = _conj(u.vestId, u.cod);
  if(cj){
    if(estado==='dano')         cj.estado = 'dano';
    else if(estado==='perdida') cj.estado = 'baja';
    else if(cj.estado!=='reparacion') cj.estado = 'buena';
    if(estado!=='buena'){
      cj.nota = (u.devPrendas.length ? u.devPrendas.join(', ')+': ' : '') + (u.devNota||'novedad sin detalle');
    }
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
  if(_migrarVestuarios()) snapLocal();

  var vests = DB.vestuarios||[];
  var usos  = DB.usosVestuario||[];

  if(!vests.length){
    cont.innerHTML =
      '<div style="text-align:center;color:var(--text2);padding:60px 20px">'
      + '<div style="font-size:48px;margin-bottom:12px">👗</div>'
      + '<div style="font-size:15px;font-weight:600;margin-bottom:6px">Sin vestuarios registrados</div>'
      + '<div style="font-size:13px">Crea uno (Negro Tricolor, Amarillo, Rosado…) y luego agrégale sus conjuntos numerados</div>'
      + '</div>';
    return;
  }

  var totConj=0, totUso=0, totDano=0;
  vests.forEach(function(v){
    (v.conjuntos||[]).forEach(function(c){
      totConj++;
      if(_usoActivo(v.id,c.cod)) totUso++;
      if(c.estado==='dano'||c.estado==='reparacion') totDano++;
    });
  });
  var pendientes = usos.filter(function(u){ return !u.devuelto; });

  var html =
    '<div class="cards-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">'
    + _statCard('👗','Conjuntos totales', totConj, 'var(--text)')
    + _statCard('📤','Entregados ahora', totUso, totUso?'var(--primary)':'var(--text2)')
    + _statCard('⚠️','Con daño / reparación', totDano, totDano?'var(--warning)':'var(--success)')
    + _statCard('🎭','Registros de uso', usos.length, 'var(--text)')
    + '</div>';

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
            + '<button class="btn btn-primary btn-sm" onclick="abrirModalDevolucion(\'' + u.id + '\')">↩️ Recibir</button>'
            + '</div>';
        }).join('')
      + '</div></div>';
  }

  // ── Tabla de conjuntos por vestuario ──
  vests.forEach(function(v){
    var conj  = _ordenarConj(v, v.conjuntos||[]);
    var enUso = conj.filter(function(c){ return !!_usoActivo(v.id,c.cod); }).length;

    html += '<div class="vest-card">'
      + '<div class="vest-header">'
        + '<span class="vest-dot" style="background:'+(v.color||'#3a57e8')+'"></span>'
        + '<div style="flex:1;min-width:160px">'
          + '<div style="font-size:15px;font-weight:800">'+v.nombre+' <span style="font-size:11px;color:var(--text2);font-weight:600">prefijo '+v.prefijo+'</span></div>'
          + '<div style="font-size:12px;color:var(--text2)">'
            + conj.length+' conjunto(s) · '+enUso+' entregado(s) · incluye <strong>'+(v.prendas||[]).join(' + ')+'</strong>'
            + (v.desc?' · '+v.desc:'') + '</div>'
        + '</div>'
        + '<button class="btn btn-primary btn-sm" onclick="abrirModalPieza(\'' + v.id + '\')">➕ Conjunto</button>'
        + '<button class="btn btn-ghost btn-sm btn-icon" onclick="abrirModalVestuario(\'' + v.id + '\')" title="Editar vestuario">✏️</button>'
      + '</div>';

    if(!conj.length){
      html += '<div class="vest-body"><p style="font-size:13px;color:var(--text2);text-align:center;padding:16px">'
        + 'Sin conjuntos todavía. Usa <strong>«➕ Conjunto»</strong> — puedes crear varios de una vez (A1, A2, A3…).'
        + '</p></div>';
    } else {
      html += '<table><thead><tr>'
        + '<th>Código</th><th>Talla</th><th>Estado</th><th>Lo tiene ahora</th><th style="text-align:right">Acción</th>'
        + '</tr></thead><tbody>'
        + conj.map(function(c){
            var act = _usoActivo(v.id, c.cod);
            var e   = EST_PIEZA[c.estado] || EST_PIEZA.buena;
            return '<tr>'
              + '<td><span class="uso-cod" style="font-size:13px">'+c.cod+'</span></td>'
              + '<td style="font-size:12px;color:var(--text2)">'+(c.talla||'—')+'</td>'
              + '<td><span class="badge '+e.badge+'" style="font-size:10px">'+e.txt+'</span>'
                + (c.nota?'<div style="font-size:10px;color:var(--text2);margin-top:2px">'+c.nota+'</div>':'')+'</td>'
              + '<td style="font-size:12px">'
                + (act
                    ? '<strong style="color:var(--primary)">'+act.alumnaNombre+'</strong>'
                      + '<div style="font-size:10px;color:var(--text2)">desde '+act.fecha+'</div>'
                    : (c.fija
                        ? '<span style="color:var(--text2)">habitual: '+_nombreAlumna(c.fija)+'</span>'
                        : '<span style="color:var(--text2)">disponible</span>'))
              + '</td>'
              + '<td style="text-align:right;white-space:nowrap">'
                + (act
                    ? '<button class="btn btn-primary btn-sm" onclick="abrirModalDevolucion(\'' + act.id + '\')">↩️ Recibir</button>'
                    : (c.estado==='baja'
                        ? '<span style="font-size:11px;color:var(--text2)">dado de baja</span>'
                        : '<button class="btn btn-ghost btn-sm" onclick="asignarConjunto(\'' + v.id + '\',\'' + c.cod + '\')">👤 Asignar</button>'))
                + ' <button class="btn btn-ghost btn-sm btn-icon" onclick="abrirModalPieza(\'' + v.id + '\',\'' + c.cod + '\')" title="Editar conjunto">✏️</button>'
              + '</td>'
              + '</tr>';
          }).join('')
        + '</tbody></table>';
    }
    html += '</div>';
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
      + (filtro ? 'Sin resultados para «'+filtro+'»' : 'Sin registros de uso todavía. Asigna un conjunto desde la tabla de arriba.')
      + '</p>';
  } else {
    html += '<table><thead><tr>'
      + '<th>Código</th><th>Alumna</th><th>Vestuario</th><th>Presentación</th><th>Fecha</th><th>Devolución</th><th></th>'
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
              + ((u.devPrendas&&u.devPrendas.length)?'<div style="font-size:10px;font-weight:600;color:var(--text2)">'+u.devPrendas.join(', ')+'</div>':'')
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
