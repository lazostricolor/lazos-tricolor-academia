/* ═══════════════════════════════════════════════════════════
   rifas.js
   Rifas: números, pagos individuales, sorteo y ganador
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== RIFAS =====================
let editRifaId = null;
let numsRifaId = null;
let numsAlumnaId = null;
let ganadorRifaId = null;


// ── Pagos por número individual ──
// Nueva estructura: asig.pagados = { 'numStr': 'YYYY-MM-DD' } (solo los pagados)
// Migración: si existe asig.pagado==='pagado' legacy, todos sus números cuentan como pagados
function _numsPagados(asig){
  if(asig.pagados) return asig.pagados;
  var out={};
  if(asig.pagado==='pagado'){
    (asig.numeros||[]).forEach(function(n){ out[String(n)] = asig.fechaPago||''; });
  }
  return out;
}

function togglePagoNumero(rifaId, key, num){
  var rifa=(DB.rifas||[]).find(function(r){return r.id===String(rifaId);});
  if(!rifa||!rifa.nums||!rifa.nums[key]) return;
  var asig=rifa.nums[key];
  if(!asig.pagados) asig.pagados=_numsPagados(asig);
  delete asig.pagado; delete asig.fechaPago; // limpiar legacy
  var k=String(num);
  if(asig.pagados[k]!==undefined){
    delete asig.pagados[k];
    toast('Nº '+k+' marcado como pendiente','info');
  } else {
    asig.pagados[k]=dateStr(getHoyReal());
    toast('✅ Nº '+k+' pagado');
  }
  _saveRifas();
  renderRifas();
}

function _saveRifas(){
  tsSeccion('rifas');
  DB._ts_rifas = Date.now();
  snapLocal();
  _fbSave(DB).then(function(ok){
    if(ok){ desencolarGuardado(); _ultimoGuardado=Date.now(); }
    else { encolarGuardado(); programarReintento(); }
  });
}

// ── CRUD Rifa ──
function abrirModalRifa(id){
  editRifaId = id ? String(id) : null;
  const hoy = dateStr(getHoyReal());
  if(id){
    const r = (DB.rifas||[]).find(function(x){return x.id===id;});
    if(!r) return;
    document.getElementById('modal-rifa-title').textContent = 'Editar Rifa';
    document.getElementById('rif-nombre').value   = r.nombre;
    document.getElementById('rif-premio').value   = r.premio||'';
    document.getElementById('rif-inicio').value   = r.inicio;
    document.getElementById('rif-sorteo').value   = r.sorteo;
    document.getElementById('rif-valor').value    = r.valorNum||'';
    document.getElementById('rif-total-nums').value = r.totalNums||'';
    document.getElementById('rif-meta').value     = r.meta||'';
    document.getElementById('rif-desc').value     = r.desc||'';
  } else {
    document.getElementById('modal-rifa-title').textContent = 'Nueva Rifa';
    document.getElementById('rif-nombre').value   = '';
    document.getElementById('rif-premio').value   = '';
    document.getElementById('rif-inicio').value   = hoy;
    document.getElementById('rif-sorteo').value   = '';
    document.getElementById('rif-valor').value    = '';
    document.getElementById('rif-total-nums').value = '';
    document.getElementById('rif-meta').value     = '';
    document.getElementById('rif-desc').value     = '';
  }
  abrirModal('modal-rifa');
}

function guardarRifa(){
  const nombre   = document.getElementById('rif-nombre').value.trim();
  const sorteo   = document.getElementById('rif-sorteo').value;
  const valorRaw = document.getElementById('rif-valor').value.trim();
  const valorNum = valorRaw !== '' ? Number(valorRaw) : 0;
  if(!nombre){ toast('El nombre de la rifa es obligatorio','err'); return; }
  if(!sorteo){ toast('La fecha del sorteo es obligatoria','err'); return; }
  if(!DB.rifas) DB.rifas=[];
  const totalNums = Number(document.getElementById('rif-total-nums').value)||0;
  const meta = Number(document.getElementById('rif-meta').value)||(totalNums*valorNum)||0;
  const obj = {
    nombre,
    premio:   document.getElementById('rif-premio').value.trim(),
    inicio:   document.getElementById('rif-inicio').value,
    sorteo,
    valorNum, totalNums, meta,
    desc:     document.getElementById('rif-desc').value.trim()
    // ⚠️ NUNCA incluir nums ni ganador aquí: al editar deben conservarse intactos
  };
  if(editRifaId){
    const idx = DB.rifas.findIndex(function(x){return x.id===editRifaId;});
    if(idx>=0) DB.rifas[idx] = Object.assign(DB.rifas[idx], obj);
  } else {
    obj.id = String(Date.now());
    obj.ganador = null;
    obj.nums = {};
    DB.rifas.push(obj);
  }
  cerrarModal('modal-rifa');
  renderRifas();
  // Guardar con confirmación explícita
  tsSeccion('rifas');
  DB._ts_rifas = Date.now();
  snapLocal();
  toast('⏳ Guardando rifa...');
  _fbSave(DB).then(function(ok){
    if(ok){
      desencolarGuardado();
      _ultimoGuardado = Date.now();
      toast('✅ Rifa guardada en Firebase');
    } else {
      encolarGuardado();
      programarReintento();
      toast('⚠️ Guardado local — reintentando...','info');
    }
  });
}

function eliminarRifa(id){
  if(!confirm('¿Eliminar esta rifa? Se perderán todos los números asignados.')) return;
  DB.rifas = (DB.rifas||[]).filter(function(r){return String(r.id)!==String(id);});
  _saveRifas();
  renderRifas();
  toast('Rifa eliminada');
}

// ── Números por alumna ──


// ── Números por alumna — edición individual con chips ──
var numsEnEdicion = [];   // array de strings, el estado del modal

function _renderChipsNums(){
  var cont = document.getElementById('nums-lista-chips');
  var cnt  = document.getElementById('nums-contador');
  if(cnt) cnt.textContent = numsEnEdicion.length;
  if(!cont) return;
  if(!numsEnEdicion.length){
    cont.innerHTML = '<span style="font-size:12px;color:var(--text2)">Aún sin números. Agrégalos arriba.</span>';
    return;
  }
  var ordenados = numsEnEdicion.slice().sort(function(a,b){
    var na=isNaN(a)?a:Number(a), nb=isNaN(b)?b:Number(b);
    return na>nb?1:na<nb?-1:0;
  });
  cont.innerHTML = ordenados.map(function(n){
    return '<span style="display:inline-flex;align-items:center;gap:5px;background:var(--card);border:1.5px solid var(--primary);color:var(--primary);border-radius:8px;padding:5px 8px;font-size:13px;font-weight:700">'
      + n
      + '<span style="cursor:pointer;font-size:12px;opacity:.7" onclick="quitarNumEdicion(\'' + n + '\')" title="Quitar">🗑️</span>'
      + '</span>';
  }).join('');
}

function agregarNumManual(){
  var el = document.getElementById('nums-nuevo');
  var raw = (el.value||'').trim();
  if(raw===''){ return; }
  if(numsEnEdicion.indexOf(raw)>=0){ toast('El número '+raw+' ya está en la lista','info'); el.value=''; return; }
  // ¿ya lo tiene otra persona en esta rifa?
  var dueno = _duenoDeNumero(numsRifaId, raw, numsAlumnaId);
  if(dueno){ toast('El número '+raw+' ya es de '+dueno,'err'); return; }
  numsEnEdicion.push(raw);
  el.value='';
  el.focus();
  _renderChipsNums();
}

function quitarNumEdicion(n){
  numsEnEdicion = numsEnEdicion.filter(function(x){ return String(x)!==String(n); });
  _renderChipsNums();
}

function agregarAleatorios(){
  var rifa = (DB.rifas||[]).find(function(r){return r.id===numsRifaId;});
  if(!rifa){ return; }
  var cant = parseInt(document.getElementById('nums-cantidad-rnd').value)||0;
  if(!cant){ toast('Indica cuántos números aleatorios','info'); return; }

  // Números ocupados por CUALQUIER persona + los que ya están en edición
  var usados = {};
  Object.entries(rifa.nums||{}).forEach(function(entry){
    if(entry[0]===numsAlumnaId) return; // los propios se reemplazan por la edición
    (entry[1].numeros||[]).forEach(function(n){ usados[String(n)]=true; });
  });
  numsEnEdicion.forEach(function(n){ usados[String(n)]=true; });

  var max = rifa.totalNums || 999;
  var disponibles = [];
  for(var n=1; n<=max; n++){ if(!usados[String(n)]) disponibles.push(String(n)); }
  if(disponibles.length < cant){ toast('Solo quedan '+disponibles.length+' números libres','err'); return; }

  var copia = disponibles.slice();
  for(var i=0;i<cant;i++){
    var idx = Math.floor(Math.random()*copia.length);
    numsEnEdicion.push(copia[idx]);
    copia.splice(idx,1);
  }
  document.getElementById('nums-cantidad-rnd').value='';
  _renderChipsNums();
  toast('🎲 '+cant+' números agregados');
}

// Devuelve el nombre del dueño de un número (o null), excluyendo a exceptId
function _duenoDeNumero(rifaId, num, exceptId){
  var rifa = (DB.rifas||[]).find(function(r){return r.id===String(rifaId);});
  if(!rifa) return null;
  var res = null;
  Object.entries(rifa.nums||{}).forEach(function(entry){
    if(entry[0]===exceptId) return;
    (entry[1].numeros||[]).forEach(function(n){
      if(String(n)===String(num)){
        var a = DB.alumnos.find(function(x){return String(x.id)===entry[0];});
        res = a ? a.nombre : (entry[1].nombreExt||'otra persona');
      }
    });
  });
  return res;
}

// ── Asignar números a persona externa (no alumna) ──
function abrirModalNumsExt(rifaId){
  numsRifaId   = String(rifaId);
  numsAlumnaId = 'ext_'+Date.now();
  var rifa = (DB.rifas||[]).find(function(r){return r.id===numsRifaId;});
  if(!rifa){ toast('Rifa no encontrada','err'); return; }

  document.getElementById('modal-nums-title').textContent = '👤 Asignar a persona externa';
  document.getElementById('modal-nums-info').innerHTML =
    'Rifa: <strong>'+rifa.nombre+'</strong><br>'
    +'Valor por número: <strong style="color:var(--primary)">$'+Number(rifa.valorNum||0).toLocaleString('es-CO')+'</strong><br>'
    +'<span style="font-size:11px;color:var(--text2)">Persona amiga o colaboradora externa a la academia</span>';

  numsEnEdicion = [];
  _renderChipsNums();
  document.getElementById('nums-nuevo').value = '';
  document.getElementById('nums-cantidad-rnd').value = '';
  document.getElementById('nums-nota').value = '';
  document.getElementById('nums-nombre-ext-wrap').style.display = 'block';
  document.getElementById('nums-nombre-ext').value = '';

  var btnQ = document.getElementById('btn-quitar-nums');
  if(btnQ) btnQ.style.display = 'none';
  abrirModal('modal-nums-alumna');
}

function abrirModalNums(rifaId, alumnaId){
  var isExt = String(alumnaId).startsWith('ext_');
  numsRifaId   = String(rifaId);
  numsAlumnaId = String(alumnaId);
  var rifa = (DB.rifas||[]).find(function(r){return r.id===numsRifaId;});
  if(!rifa){ toast('Rifa no encontrada','err'); return; }

  var wrapExt = document.getElementById('nums-nombre-ext-wrap');
  if(wrapExt) wrapExt.style.display = isExt ? 'block' : 'none';

  var asig = (rifa.nums&&rifa.nums[numsAlumnaId])||{numeros:[],nota:'',nombreExt:''};
  var tieneNums = asig.numeros && asig.numeros.length > 0;

  // Cargar el estado de edición con los números actuales (como strings)
  numsEnEdicion = (asig.numeros||[]).map(function(n){return String(n);});

  var titulo, info;
  if(isExt){
    titulo = tieneNums ? ('✏️ Editar externo: '+(asig.nombreExt||'sin nombre')) : '👤 Asignar a persona externa';
    info = 'Rifa: <strong>'+rifa.nombre+'</strong><br>'
      +'Valor por número: <strong style="color:var(--primary)">$'+Number(rifa.valorNum||0).toLocaleString('es-CO')+'</strong>';
    document.getElementById('nums-nombre-ext').value = asig.nombreExt||'';
  } else {
    var alumna = DB.alumnos.find(function(a){return String(a.id)===String(alumnaId);});
    if(!alumna){ toast('Alumna no encontrada','err'); return; }
    titulo = tieneNums ? ('✏️ Editar números de '+alumna.nombre.split(' ')[0])
                       : ('🎟️ Asignar números a '+alumna.nombre.split(' ')[0]);
    info = '<strong>'+alumna.nombre+'</strong> · Rifa: <strong>'+rifa.nombre+'</strong><br>'
      +'Valor por número: <strong style="color:var(--primary)">$'+Number(rifa.valorNum||0).toLocaleString('es-CO')+'</strong>';
    document.getElementById('nums-nombre-ext').value = '';
  }
  document.getElementById('modal-nums-title').textContent = titulo;
  document.getElementById('modal-nums-info').innerHTML = info;
  document.getElementById('nums-nuevo').value = '';
  document.getElementById('nums-cantidad-rnd').value = '';
  document.getElementById('nums-nota').value = asig.nota||'';
  _renderChipsNums();

  var btnQ = document.getElementById('btn-quitar-nums');
  if(btnQ) btnQ.style.display = tieneNums ? 'inline-flex' : 'none';
  abrirModal('modal-nums-alumna');
}

function guardarNumsAlumna(){
  var numeros = numsEnEdicion.slice();
  if(!numeros.length){ toast('Agrega al menos un número (o usa 🗑️ Quitar todos para vaciar)','err'); return; }

  var rifa = (DB.rifas||[]).find(function(r){return r.id===numsRifaId;});
  if(!rifa) return;

  // Verificar conflictos con otras personas
  var conflicto = null;
  numeros.forEach(function(num){
    var dueno = _duenoDeNumero(numsRifaId, num, numsAlumnaId);
    if(dueno) conflicto = 'El número '+num+' ya es de '+dueno;
  });
  if(conflicto){ toast(conflicto,'err'); return; }

  if(!rifa.nums) rifa.nums={};
  var isExt = String(numsAlumnaId).startsWith('ext_');
  var nombreExtVal = document.getElementById('nums-nombre-ext').value.trim();
  var keyId = numsAlumnaId;

  // Conservar los pagos ya registrados de los números que siguen asignados
  var prevAsig = rifa.nums[keyId]||{};
  var prevPagados = _numsPagados(prevAsig);
  var pagados = {};
  numeros.forEach(function(n){
    var k = String(n);
    if(prevPagados[k]!==undefined) pagados[k] = prevPagados[k];
  });

  rifa.nums[keyId] = {
    numeros: numeros.slice().sort(function(a,b){ var na=isNaN(a)?a:Number(a); var nb=isNaN(b)?b:Number(b); return na>nb?1:na<nb?-1:0; }),
    pagados: pagados,
    nota:    document.getElementById('nums-nota').value.trim(),
    nombreExt: isExt ? (nombreExtVal||'Externo') : undefined
  };

  cerrarModal('modal-nums-alumna');
  renderRifas();
  tsSeccion('rifas');
  DB._ts_rifas = Date.now();
  snapLocal();
  toast('⏳ Guardando...');
  _fbSave(DB).then(function(ok){
    if(ok){ desencolarGuardado(); _ultimoGuardado = Date.now(); toast('✅ Números guardados en Firebase'); }
    else  { encolarGuardado(); programarReintento(); toast('⚠️ Guardado local — reintentando...','info'); }
  });
}

function quitarNumsAlumna(){
  if(!confirm('¿Quitar TODOS los números de esta persona?')) return;
  var rifa = (DB.rifas||[]).find(function(r){return r.id===numsRifaId;});
  if(!rifa) return;
  if(rifa.nums) delete rifa.nums[numsAlumnaId];
  cerrarModal('modal-nums-alumna');
  _saveRifas();
  renderRifas();
  toast('Números eliminados');
}

function abrirModalGanador(rifaId){
  ganadorRifaId = String(rifaId);
  var rifa = (DB.rifas||[]).find(function(r){return r.id===ganadorRifaId;});
  if(!rifa) return;
  document.getElementById('ganador-rifa-info').innerHTML =
    '<strong>'+rifa.nombre+'</strong><br>'
    +'Sorteo: <strong>'+rifa.sorteo+'</strong> · Premio: <strong>'+rifa.premio+'</strong>'
    +(rifa.ganador!==null?'<br>Ganador actual: <strong style="color:var(--col)">Nº '+rifa.ganador+'</strong>':'');
  document.getElementById('ganador-num').value = rifa.ganador||'';
  document.getElementById('ganador-resultado').innerHTML = '';
  // Preview en tiempo real
  document.getElementById('ganador-num').oninput = function(){
    buscarNumGanador(rifaId, parseInt(this.value));
  };
  abrirModal('modal-ganador');
}

function buscarNumGanador(rifaId, num){
  if(!num||num<=0){ document.getElementById('ganador-resultado').innerHTML=''; return; }
  var rifa = (DB.rifas||[]).find(function(r){return r.id===String(rifaId);});
  if(!rifa){ return; }
  var dueno = null;
  Object.entries(rifa.nums||{}).forEach(function(entry){
    var numerosStr = (entry[1].numeros||[]).map(String);
    if(numerosStr.indexOf(String(num))>=0){
      var a = DB.alumnos.find(function(a){return String(a.id)===entry[0];});
      var pm = _numsPagados(entry[1]);
      dueno = {
        alumna:a,
        nombreExt:entry[1].nombreExt,
        pagado: pm[String(num)]!==undefined ? 'pagado' : 'pendiente',
        nota:entry[1].nota
      };
    }
  });
  var el = document.getElementById('ganador-resultado');
  if(dueno && (dueno.alumna||dueno.nombreExt)){
    var nombreG = dueno.alumna ? dueno.alumna.nombre : ('👤 '+dueno.nombreExt);
    el.innerHTML = '<div style="background:'+(dueno.pagado==='pagado'?'rgba(26,160,83,.1)':'rgba(192,50,33,.08)')+';border-radius:10px;padding:14px;text-align:center">'
      +'<div style="font-size:28px;margin-bottom:6px">'+(dueno.pagado==='pagado'?'🏆':'⛔')+'</div>'
      +'<div style="font-size:16px;font-weight:800">'+nombreG+'</div>'
      +'<div style="font-size:12px;margin-top:4px">'
        +(dueno.pagado==='pagado'
          ?'<span style="color:var(--success)">✅ Número pagado — GANA el premio</span>'
          :'<span style="color:var(--danger);font-weight:700">⛔ Número NO pagado — NO entra en juego</span>')
      +'</div>'
      +(dueno.nota?'<div style="font-size:11px;color:var(--text2);margin-top:2px">'+dueno.nota+'</div>':'')
      +'</div>';
  } else {
    el.innerHTML = '<div style="background:rgba(176,16,32,.08);border-radius:10px;padding:14px;text-align:center">'
      +'<div style="font-size:24px;margin-bottom:4px">❓</div>'
      +'<div style="font-size:14px;font-weight:600;color:var(--danger)">Número no asignado</div>'
      +'<div style="font-size:12px;color:var(--text2)">Este número está libre</div>'
      +'</div>';
  }
}

function guardarGanador(){
  var numRaw = document.getElementById('ganador-num').value.trim();
  if(numRaw===''){ toast('Ingresa el número ganador','err'); return; }
  var num = numRaw;
  var rifa = (DB.rifas||[]).find(function(r){return r.id===ganadorRifaId;});
  if(!rifa) return;
  // Verificar si el número está pagado — si no, advertir que no entra en juego
  var estaPagado=false, estaAsignado=false;
  Object.values(rifa.nums||{}).forEach(function(a){
    if((a.numeros||[]).map(String).indexOf(String(num))>=0){
      estaAsignado=true;
      if(_numsPagados(a)[String(num)]!==undefined) estaPagado=true;
    }
  });
  if(estaAsignado&&!estaPagado){
    if(!confirm('⛔ El número '+num+' NO está pagado y no entra en juego.\n\n¿Registrarlo de todas formas como número sorteado?')) return;
  }
  rifa.ganador = num;
  cerrarModal('modal-ganador');
  renderRifas();
  tsSeccion('rifas');
  DB._ts_rifas = Date.now();
  snapLocal();
  _fbSave(DB).then(function(ok){
    if(ok){ desencolarGuardado(); _ultimoGuardado=Date.now(); }
    else { encolarGuardado(); programarReintento(); }
  });
  toast('🏆 Número ganador registrado: '+num);
}

// ── Render principal ──
// ── Copiar aviso de números NO vendidos ──
function copiarNumerosLibres(rifaId){
  var rifa = (DB.rifas||[]).find(function(r){return r.id===String(rifaId);});
  if(!rifa){ return; }
  var totalNums = rifa.totalNums||0;
  if(!totalNums){ toast('Esta rifa no tiene número total definido','info'); return; }

  var asignados = {};
  Object.values(rifa.nums||{}).forEach(function(a){
    (a.numeros||[]).forEach(function(n){ asignados[String(n)]=true; });
  });
  var libres = [];
  for(var n=1;n<=totalNums;n++){ if(!asignados[String(n)]) libres.push(String(n)); }

  var texto;
  if(!libres.length){
    texto = '🎟️ *'+rifa.nombre+'*\n\n✅ ¡Todos los números están vendidos! No quedan boletas disponibles.';
  } else {
    texto = '🎟️ *'+rifa.nombre+'*'
      + (rifa.premio?'\n🏆 Premio: '+rifa.premio:'')
      + (rifa.sorteo?'\n📅 Sorteo: '+rifa.sorteo:'')
      + (rifa.valorNum?'\n💵 Valor por número: $'+Number(rifa.valorNum).toLocaleString('es-CO'):'')
      + '\n\n📋 *Números AÚN DISPONIBLES ('+libres.length+'):*\n'
      + libres.join(', ')
      + '\n\n¡Aparta el tuyo antes de que se agote! 🍀';
  }

  _copiarTexto(texto, libres.length ? '📋 Aviso copiado — '+libres.length+' números disponibles' : '📋 Aviso copiado');
}

function _copiarTexto(texto, msgOk){
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(texto).then(function(){ toast(msgOk||'📋 Copiado'); })
      .catch(function(){ _copiarFallback(texto, msgOk); });
  } else { _copiarFallback(texto, msgOk); }
}
function _copiarFallback(texto, msgOk){
  try{
    var ta=document.createElement('textarea');
    ta.value=texto; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    toast(msgOk||'📋 Copiado');
  }catch(e){ toast('No se pudo copiar automáticamente','err'); }
}

function renderRifas(){
 try{
  if(!DB.rifas||!DB.rifas.length){
    document.getElementById('rifas-lista').innerHTML =
      '<div style="text-align:center;color:var(--text2);padding:60px 20px">'
      +'<div style="font-size:48px;margin-bottom:12px">🎟️</div>'
      +'<div style="font-size:15px;font-weight:600;margin-bottom:6px">Sin rifas registradas</div>'
      +'<div style="font-size:13px">Crea una rifa para empezar a asignar números</div>'
      +'</div>';
    return;
  }

  var hoy = dateStr(getHoyReal());
  var html = '';

  var lista = [].concat(DB.rifas).sort(function(a,b){
    var aV=a.sorteo<hoy, bV=b.sorteo<hoy;
    if(aV!==bV) return aV?1:-1;
    return a.sorteo.localeCompare(b.sorteo);
  });

  lista.forEach(function(rifa){
    var realizada = rifa.sorteo <= hoy;
    var nums = rifa.nums||{};
    var totalNums = rifa.totalNums||0;
    // Urgencia: faltan 5 días o menos para el sorteo (y no se ha realizado)
    var diasFaltan = Math.ceil((new Date(rifa.sorteo+'T12:00')-new Date(hoy+'T12:00'))/86400000);
    var urgente = diasFaltan<=5 && diasFaltan>=0;

    // Calcular stats
    var numsAsignados=[], numsPagados=[], numsPendientes=[];
    Object.entries(nums).forEach(function(entry){
      var pagadosMap=_numsPagados(entry[1]);
      (entry[1].numeros||[]).forEach(function(n){
        numsAsignados.push(n);
        if(pagadosMap[String(n)]!==undefined) numsPagados.push(n);
        else numsPendientes.push(n);
      });
    });
    var numsLibres = totalNums>0 ? totalNums-numsAsignados.length : null;
    // Lista de números NO vendidos (como strings, respeta el 00)
    var asignadosSet = {}; numsAsignados.forEach(function(n){ asignadosSet[String(n)]=true; });
    var listaLibres = [];
    if(totalNums>0){ for(var _n=1; _n<=totalNums; _n++){ if(!asignadosSet[String(_n)]) listaLibres.push(String(_n)); } }
    var totalRecaudado = numsPagados.length * (rifa.valorNum||0);
    var meta = rifa.meta || (totalNums*(rifa.valorNum||0));
    var pct = meta>0 ? Math.min(100,Math.round(totalRecaudado/meta*100)) : 0;
    var barColor = pct>=100?'var(--success)':pct>=60?'#f4a916':'var(--primary)';

    // Quién tiene el número ganador
    var alumnaGanadora = null, ganadorPagado = false, ganadorNombre = '';
    if(rifa.ganador!==null&&rifa.ganador!==undefined&&rifa.ganador!==''){
      Object.entries(nums).forEach(function(entry){
        if((entry[1].numeros||[]).map(String).indexOf(String(rifa.ganador))>=0){
          var a = DB.alumnos.find(function(x){return String(x.id)===entry[0];});
          alumnaGanadora = a || {nombre:'👤 '+(entry[1].nombreExt||'Externo')};
          ganadorNombre = alumnaGanadora.nombre;
          ganadorPagado = _numsPagados(entry[1])[String(rifa.ganador)]!==undefined;
        }
      });
    }

    // Chips de números (grilla visual)
    var todosNums = {};
    Object.entries(nums).forEach(function(entry){
      var pmT=_numsPagados(entry[1]);
      (entry[1].numeros||[]).forEach(function(n){
        todosNums[n]={alumnaId:entry[0],pagado:pmT[String(n)]!==undefined};
      });
    });
    // Ordenar todos los números asignados
    var numsOrdenados = Object.keys(todosNums).sort(function(a,b){return (Number(a)-Number(b))||String(a).localeCompare(String(b));});

    var chipsHTML = numsOrdenados.map(function(n){
      var info = todosNums[n];
      var esGanador = String(rifa.ganador)===String(n);
      var cls = esGanador?'ganador':(info.pagado?'pagado':(urgente?'urgente':'pendiente'));
      var duenoInfo = nums[info.alumnaId]||{};
      var a = DB.alumnos.find(function(a){return String(a.id)===info.alumnaId;});
      var nombreDueno = a?a.nombre.split(' ')[0]:(duenoInfo.nombreExt||'?');
      var tooltip = nombreDueno+' · Nº'+n+(info.pagado?' ✅ pagado':' ⏳ pendiente — clic para marcar pagado')+(esGanador?' 🏆':'');
      return '<span class="num-chip '+cls+' rifa-chip-toggle" data-rid="'+rifa.id+'" data-aid="'+info.alumnaId+'" data-num="'+n+'" title="'+tooltip+'">'
        +n
        +(esGanador?'<span style="position:absolute;top:-4px;right:-4px;font-size:8px">🏆</span>':'')
        +'</span>';
    }).join('');

    // Tabla de alumnas
    var filasAlumnas = '';
    DB.alumnos.forEach(function(a){
      var ak = String(a.id);
      var asig = nums[ak]||{numeros:[]};
      var tieneNums = asig.numeros&&asig.numeros.length>0;
      var pmF = _numsPagados(asig);
      var pagCount = tieneNums ? asig.numeros.filter(function(n){return pmF[String(n)]!==undefined;}).length : 0;
      var totNums = tieneNums ? asig.numeros.length : 0;
      var montoPagado = pagCount*(Number(rifa.valorNum)||0);
      filasAlumnas += '<div class="rifa-alumna-row">'
        +'<span class="rifa-alumna-nombre">'+a.nombre.split(' ').slice(0,2).join(' ')+'</span>'
        +'<div class="rifa-nums-wrap">'
          +(tieneNums
            ? asig.numeros.map(function(n){
                var esG=String(rifa.ganador)===String(n);
                var pagN=pmF[String(n)]!==undefined;
                var clsF=esG?'ganador':(pagN?'pagado':(urgente?'urgente':'pendiente'));
                var tt='Nº'+n+(pagN?' ✅ pagado':' ⏳ pendiente — clic para pagar')+(esG?' ¡GANADOR!':'');
                return '<span class="num-chip '+clsF+' rifa-chip-toggle" data-rid="'+rifa.id+'" data-aid="'+ak+'" data-num="'+n+'" style="width:34px;height:34px;font-size:11px" title="'+tt+'">'+(n)+(esG?'🏆':'')+'</span>';
              }).join('')
            : '<span style="font-size:12px;color:var(--text2)">Sin números</span>')
        +'</div>'
        +(tieneNums?'<span class="badge '+(pagCount===totNums?'badge-paid':pagCount>0?'badge-partial':'badge-unpaid')+'" style="font-size:10px">'+pagCount+'/'+totNums+' pagados</span>':'')
        +(tieneNums&&montoPagado>0?'<span style="font-size:12px;font-weight:700;min-width:70px;text-align:right;color:var(--success)">$'+montoPagado.toLocaleString('es-CO')+'</span>':'')
        +'<button class="rec-alumna-btn rifa-btn-nums" data-rid="'+rifa.id+'" data-aid="'+a.id+'" style="flex-shrink:0">'
          +(tieneNums?'✏️':'➕')
        +'</button>'
        +'</div>';
    });
    // Externos
    Object.entries(nums).forEach(function(entry){
      if(!String(entry[0]).startsWith('ext_')) return;
      var asig = entry[1];
      var tieneNums = asig.numeros&&asig.numeros.length>0;
      var pmE = _numsPagados(asig);
      var pagE = tieneNums ? asig.numeros.filter(function(n){return pmE[String(n)]!==undefined;}).length : 0;
      var totE = tieneNums ? asig.numeros.length : 0;
      var montoE = pagE*(Number(rifa.valorNum)||0);
      filasAlumnas += '<div class="rifa-alumna-row" style="background:rgba(58,87,232,.03)">'
        +'<span class="rifa-alumna-nombre" style="color:var(--primary)">👤 '+(asig.nombreExt||'Externo')+'</span>'
        +'<div class="rifa-nums-wrap">'
          +(tieneNums
            ? asig.numeros.map(function(n){
                var esG=String(rifa.ganador)===String(n);
                var pagN=pmE[String(n)]!==undefined;
                var clsF=esG?'ganador':(pagN?'pagado':(urgente?'urgente':'pendiente'));
                var tt='Nº'+n+(pagN?' ✅ pagado':' ⏳ pendiente — clic para pagar')+(esG?' ¡GANADOR!':'');
                return '<span class="num-chip '+clsF+' rifa-chip-toggle" data-rid="'+rifa.id+'" data-aid="'+entry[0]+'" data-num="'+n+'" style="width:34px;height:34px;font-size:11px" title="'+tt+'">'+(n)+(esG?'🏆':'')+'</span>';
              }).join('')
            : '<span style="font-size:12px;color:var(--text2)">Sin números</span>')
        +'</div>'
        +(tieneNums?'<span class="badge '+(pagE===totE?'badge-paid':pagE>0?'badge-partial':'badge-unpaid')+'" style="font-size:10px">'+pagE+'/'+totE+' pagados</span>':'')
        +(tieneNums&&montoE>0?'<span style="font-size:12px;font-weight:700;min-width:70px;text-align:right;color:var(--success)">$'+montoE.toLocaleString('es-CO')+'</span>':'')
        +'<button class="rec-alumna-btn rifa-btn-nums" data-rid="'+rifa.id+'" data-aid="'+entry[0]+'" style="flex-shrink:0">✏️</button>'
        +'</div>';
    });

    html += '<div class="rifa-card">'
      // Header
      +'<div class="rifa-header">'
        +'<div>'
          +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
            +'<span style="font-size:20px">🎟️</span>'
            +'<span style="font-size:16px;font-weight:800">'+rifa.nombre+'</span>'
            +(realizada&&rifa.ganador!==null
              ?'<span class="rifa-badge-ganador">🏆 Realizada</span>'
              :realizada
              ?'<span class="rec-badge vencido">📅 Sorteada</span>'
              :'<span class="rec-badge activo">✅ Activa</span>')
          +'</div>'
          +'<div style="font-size:12px;color:var(--text2);display:flex;flex-wrap:wrap;gap:10px">'
            +'<span>🏆 Premio: <strong>'+rifa.premio+'</strong></span>'
            +'<span>📅 Inicio: '+rifa.inicio+'</span>'
            +'<span>🎯 Sorteo: <strong>'+rifa.sorteo+'</strong></span>'
            +'<span>💵 $'+Number(rifa.valorNum||0).toLocaleString('es-CO')+' / número</span>'
            +(rifa.desc?'<span>📝 '+rifa.desc+'</span>':'')
          +'</div>'
        +'</div>'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap">'
          +'<button class="btn btn-ghost btn-sm rifa-btn-editar" data-rid="'+rifa.id+'">✏️ Editar</button>'
          +'<button class="btn '+(rifa.ganador!==null?'btn-ghost':'btn-primary')+' btn-sm rifa-btn-ganador" data-rid="'+rifa.id+'">'
            +(rifa.ganador!==null?'🏆 Nº '+rifa.ganador+' ganó':'🏆 Registrar ganador')
          +'</button>'
          +'<button class="btn btn-danger btn-sm btn-icon rifa-btn-eliminar" data-rid="'+rifa.id+'">🗑️</button>'
        +'</div>'
      +'</div>'
      // Body
      +'<div class="rifa-body">'
        // Stats
        +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">'
          +'<div style="text-align:center;background:var(--card2);border-radius:10px;padding:10px">'
            +'<div style="font-size:10px;color:var(--text2);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Recaudado</div>'
            +'<div style="font-size:18px;font-weight:800;color:var(--success)">$'+totalRecaudado.toLocaleString('es-CO')+'</div>'
          +'</div>'
          +(meta>0?'<div style="text-align:center;background:var(--card2);border-radius:10px;padding:10px">'
            +'<div style="font-size:10px;color:var(--text2);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Meta</div>'
            +'<div style="font-size:18px;font-weight:800">$'+meta.toLocaleString('es-CO')+'</div>'
          +'</div>':'<div></div>')
          +'<div style="text-align:center;background:var(--card2);border-radius:10px;padding:10px">'
            +'<div style="font-size:10px;color:var(--text2);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Nº en juego</div>'
            +'<div style="font-size:18px;font-weight:800;color:var(--success)">'+numsPagados.length+'<span style="font-size:12px;color:var(--text2);font-weight:600">/'+numsAsignados.length+' asig.</span></div>'
            +(numsPendientes.length>0?'<div style="font-size:10px;color:var(--danger);font-weight:700;margin-top:2px">⛔ '+numsPendientes.length+' sin pagar</div>':'')
          +'</div>'
          +'<div style="text-align:center;background:var(--card2);border-radius:10px;padding:10px">'
            +'<div style="font-size:10px;color:var(--text2);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Nº libres</div>'
            +'<div style="font-size:18px;font-weight:800;color:'+(numsLibres===0?'var(--success)':'var(--warning)')+'">'+( numsLibres!==null?numsLibres:'—')+'</div>'
          +'</div>'
        +'</div>'
        // Barra progreso
        +(meta>0?'<div style="margin-bottom:16px">'
          +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:4px">'
            +'<span>Progreso</span><span style="font-weight:700;color:'+barColor+'">'+pct+'%</span>'
          +'</div>'
          +'<div class="rec-progress-wrap"><div class="rec-progress-bar" style="width:'+pct+'%;background:'+barColor+'"></div></div>'
        +'</div>':'')
        // Aviso urgente: números sin pagar a 5 días o menos del sorteo
        +(urgente&&numsPendientes.length>0
          ?'<div style="background:rgba(192,50,33,.08);border:1px solid rgba(192,50,33,.3);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px">'
            +'<span style="font-size:20px">🚨</span>'
            +'<div style="flex:1;font-size:13px;color:var(--danger)"><strong>'+(diasFaltan===0?'¡El sorteo es HOY!':diasFaltan===1?'¡El sorteo es MAÑANA!':'Faltan '+diasFaltan+' días para el sorteo')+'</strong> — '+numsPendientes.length+' número'+(numsPendientes.length>1?'s':'')+' sin pagar (marcados en rojo)</div>'
          +'</div>':'')
        // Gráfico progreso de pagos vs fecha
        +'<div style="margin-bottom:16px">'
          +'<div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">📈 Progreso de pagos hacia el sorteo</div>'
          +'<div style="background:var(--card2);border-radius:10px;padding:12px;height:180px"><canvas id="rifa-pgchart-'+String(rifa.id).replace(/[^a-z0-9]/gi,'_')+'"></canvas></div>'
        +'</div>'
        // Ganadora
        +(alumnaGanadora
          ? (ganadorPagado
            ?'<div style="background:linear-gradient(135deg,rgba(201,168,0,.15),rgba(244,169,22,.1));border:2px solid #c9a800;border-radius:12px;padding:16px;margin-bottom:16px;text-align:center">'
              +'<div style="font-size:24px;margin-bottom:4px">🏆</div>'
              +'<div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">NÚMERO GANADOR: '+rifa.ganador+'</div>'
              +'<div style="font-size:20px;font-weight:800;margin-top:4px">'+ganadorNombre+'</div>'
              +'<div style="font-size:12px;color:var(--text2);margin-top:2px">Premio: '+rifa.premio+'</div>'
            +'</div>'
            :'<div style="background:rgba(192,50,33,.08);border:2px solid var(--danger);border-radius:12px;padding:16px;margin-bottom:16px;text-align:center">'
              +'<div style="font-size:24px;margin-bottom:4px">⛔</div>'
              +'<div style="font-size:11px;font-weight:700;color:var(--danger);text-transform:uppercase;letter-spacing:.5px">Nº '+rifa.ganador+' SALIÓ, PERO NO ESTABA PAGADO</div>'
              +'<div style="font-size:18px;font-weight:800;margin-top:4px">'+ganadorNombre+'</div>'
              +'<div style="font-size:12px;color:var(--danger);margin-top:4px;font-weight:600">Este número no entra en juego — debe repetirse el sorteo</div>'
            +'</div>')
          :'')
        // Layout: chips + tabla
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
          // Grilla de números
          +'<div>'
            +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px">'
              +'<span style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">🎟️ Números — clic para pagar</span>'
              +'<span style="display:flex;gap:8px;font-size:10px;color:var(--text2)">'
                +'<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#1aa053"></span> pagado</span>'
                +'<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:'+(urgente?'#c03221':'#f4a916')+'"></span> pendiente</span>'
              +'</span>'
            +'</div>'
            +(chipsHTML?'<div style="display:flex;flex-wrap:wrap;gap:6px;background:var(--card2);border-radius:10px;padding:12px">'+chipsHTML+'</div>'
              :'<div style="background:var(--card2);border-radius:10px;padding:20px;text-align:center;color:var(--text2);font-size:13px">Sin números asignados aún</div>')
            // Números NO vendidos — lista completa + botón copiar
            +(totalNums>0&&listaLibres.length?'<div style="margin-top:12px;background:rgba(244,169,22,.06);border:1px solid rgba(244,169,22,.25);border-radius:10px;padding:12px">'
              +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;flex-wrap:wrap">'
                +'<span style="font-size:11px;font-weight:700;color:#a06d00;text-transform:uppercase;letter-spacing:.5px">📋 '+listaLibres.length+' números NO vendidos</span>'
                +'<button class="btn btn-ghost btn-sm rifa-btn-copiar-libres" data-rid="'+rifa.id+'">📋 Copiar aviso</button>'
              +'</div>'
              +'<div style="font-size:12px;color:var(--text);line-height:1.9;word-break:break-word">'+listaLibres.join(', ')+'</div>'
            +'</div>':(totalNums>0?'<div style="margin-top:12px;background:rgba(26,160,83,.08);border-radius:10px;padding:12px;text-align:center;font-size:12px;color:var(--success);font-weight:600">✅ Todos los números están vendidos</div>':''))
          +'</div>'
          // Tabla de alumnas
          +'<div>'
            +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'+'<div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">👥 Asignación por alumna</div>'+'<button class="btn btn-ghost btn-sm rifa-btn-ext" data-rid="'+rifa.id+'">➕ Externo</button>'+'</div>'
            +'<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">'
              +'<div style="padding:4px 12px">'+filasAlumnas+'</div>'
            +'</div>'
          +'</div>'
        +'</div>'
      +'</div>'
    +'</div>';
  });

  document.getElementById('rifas-lista').innerHTML = html;

  // Delegación de eventos — onclick property evita handlers duplicados en cada render
  document.getElementById('rifas-lista').onclick = function(e){
    var chipTog = e.target.closest('.rifa-chip-toggle');
    if(chipTog){ togglePagoNumero(chipTog.dataset.rid, chipTog.dataset.aid, chipTog.dataset.num); return; }
    var btnNums    = e.target.closest('.rifa-btn-nums');
    var btnEditar  = e.target.closest('.rifa-btn-editar');
    var btnGanador = e.target.closest('.rifa-btn-ganador');
    var btnElim    = e.target.closest('.rifa-btn-eliminar');
    var btnExt     = e.target.closest('.rifa-btn-ext');
    var btnCopiar  = e.target.closest('.rifa-btn-copiar-libres');
    if(btnCopiar){ copiarNumerosLibres(btnCopiar.dataset.rid); return; }
    if(btnNums)    abrirModalNums(btnNums.dataset.rid, btnNums.dataset.aid);
    else if(btnExt)     abrirModalNumsExt(btnExt.dataset.rid);
    else if(btnEditar)  abrirModalRifa(btnEditar.dataset.rid);
    else if(btnGanador) abrirModalGanador(btnGanador.dataset.rid);
    else if(btnElim)    eliminarRifa(btnElim.dataset.rid);
  };

  // ── Gráficos de progreso de pagos por rifa ──
  setTimeout(function(){
    try{
      lista.forEach(function(rifa){
        var cid = 'rifa-pgchart-'+String(rifa.id).replace(/[^a-z0-9]/gi,'_');
        var el = document.getElementById(cid);
        if(!el) return;
        if(el._ch){el._ch.destroy();el._ch=null;}

        var valor = Number(rifa.valorNum)||0;
        var meta2 = Number(rifa.meta)||(Number(rifa.totalNums)||0)*valor;

        // Pagos con fecha: cada asignación pagada aporta numeros.length*valor en su fechaPago
        var pagosPorFecha = {};
        Object.values(rifa.nums||{}).forEach(function(a){
          var pm = _numsPagados(a);
          Object.keys(pm).forEach(function(k){
            var f = pm[k] || rifa.inicio || dateStr(getHoyReal());
            pagosPorFecha[f] = (pagosPorFecha[f]||0) + valor; // cada número pagado suma su valor
          });
        });

        // Eje X: desde inicio hasta el sorteo (o hoy si es después)
        var hoyStr = dateStr(getHoyReal());
        var d0 = new Date((rifa.inicio||hoyStr)+'T12:00');
        var dFin = new Date((rifa.sorteo>hoyStr?rifa.sorteo:hoyStr)+'T12:00');
        var labels=[], acumulado=[], metaLine=[];
        var acum=0;
        for(var d=new Date(d0); d<=dFin; d.setDate(d.getDate()+1)){
          var ds = d.toISOString().substring(0,10);
          acum += (pagosPorFecha[ds]||0);
          labels.push(ds.substring(5)); // MM-DD
          // Después de hoy no hay datos: dejar null para cortar la línea
          acumulado.push(ds<=hoyStr ? Math.round(acum/1000) : null);
          metaLine.push(meta2>0 ? Math.round(meta2/1000) : null);
        }

        // Índice de la fecha del sorteo para marcarla
        var idxSorteo = labels.indexOf((rifa.sorteo||'').substring(5));
        var pointColors = labels.map(function(l,i){ return i===idxSorteo?'#c03221':'rgba(26,160,83,1)'; });

        var tc='#8a92a6', gc='rgba(0,0,0,.06)';
        el._ch = new Chart(el,{type:'line',
          data:{labels:labels,datasets:[
            {label:'Recaudado (miles $)',data:acumulado,
              borderColor:'rgba(26,160,83,1)',backgroundColor:'rgba(26,160,83,.1)',
              fill:true,tension:.25,pointRadius:2,borderWidth:2,spanGaps:false},
            {label:'Meta',data:metaLine,
              borderColor:'rgba(58,87,232,.7)',borderDash:[6,4],
              pointRadius:0,borderWidth:1.5,fill:false}
          ]},
          options:{responsive:true,maintainAspectRatio:false,
            plugins:{
              legend:{labels:{color:tc,font:{size:9},boxWidth:10,padding:6}},
              tooltip:{callbacks:{
                title:function(items){ var l=items[0].label; return l===(rifa.sorteo||'').substring(5)?l+' 🎯 DÍA DEL SORTEO':l; },
                label:function(ctx){ return ' $'+(Number(ctx.raw)*1000).toLocaleString('es-CO'); }
              }}
            },
            scales:{
              x:{ticks:{color:tc,font:{size:8},maxTicksLimit:12,callback:function(v,i){
                  // Resaltar el día del sorteo en el eje
                  return this.getLabelForValue(v);
                }},grid:{color:gc}},
              y:{ticks:{color:tc,font:{size:9}},grid:{color:gc},beginAtZero:true}
            }
          }
        });
      });
    }catch(e){ console.warn('Charts rifas:', e); }
  },150);
 }catch(err){
  console.error('renderRifas error:', err);
  var rl=document.getElementById('rifas-lista');
  if(rl) rl.innerHTML='<div style="background:var(--danger-lt);border-radius:10px;padding:20px;color:var(--danger)">⚠️ Error mostrando rifas: '+err.message+'<br><small>Los datos están seguros. Recarga la página.</small></div>';
 }
}
