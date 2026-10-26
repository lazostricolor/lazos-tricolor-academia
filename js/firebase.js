/* ═══════════════════════════════════════════════════════════
   firebase.js
   ⚠️ NÚCLEO CRÍTICO — sincronización, mergeDB, guardado
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== FIREBASE =====================

// ── Versión local — empieza en 0 para que Firebase siempre gane al arrancar ──
let _localVersion = 0;

// ── BroadcastChannel — sync instantáneo entre pestañas del mismo navegador ──
let _bc = null;
try {
  _bc = new BroadcastChannel('lazos_sync');
  _bc.onmessage = (e) => {
    if (e.data && e.data.type === 'DB_UPDATED' && e.data.version > _localVersion) {
      _localVersion = e.data.version;
      if (e.data.db) {
        DB = e.data.db;
        repararFechasIngreso();
        const fotos = JSON.parse(localStorage.getItem('_fotos') || '{}');
        DB.alumnos?.forEach(a => { if (!a.foto && fotos[a.id]) a.foto = fotos[a.id]; });
        renderSection(activeSection);
        setSyncStatus('ok');
        toast('🔄 Datos actualizados desde otra pestaña','info');
      }
    }
  };
} catch(e) { console.warn('BroadcastChannel no disponible:', e.message); }

// ── storage event — fallback para detectar cambios entre pestañas ──
window.addEventListener('storage', (e) => {
  if (e.key === '_db_version') {
    const remoteVersion = Number(e.newValue || 0);
    if (remoteVersion > _localVersion) {
      _localVersion = remoteVersion;
      _fbCargar(true).then(ok => {
        if (ok) { repararFechasIngreso(); renderSection(activeSection); toast('🔄 Datos sincronizados','info'); }
      });
    }
  }
});


// ── Timestamps por sección — se actualizan al tocar cada sección ──
function tsSeccion(campo){ DB['_ts_'+campo] = Date.now(); }

// mergeDB, _fusionarArrayPorId y coherenciaAlumnas viven en js/merge.js

// ── Escritura optimista (oct-2026) ──────────────────────────────────────────
// Antes cada guardado subía el documento completo SIN mirar la nube: un equipo
// con datos viejos (pestaña en segundo plano, autosave cada 2 min) pisaba lo
// que otro había guardado hacía un minuto. Ahora cada PATCH lleva el
// `updateTime` del documento que este equipo ya conoce: si alguien escribió
// entretanto, Firestore lo rechaza, se lee la nube, se fusiona con mergeDB y
// se reintenta. Regla: _fbUpdateTime solo se actualiza cuando DB ya incorporó
// el contenido de esa versión de la nube.
let _fbUpdateTime = null;
// Firma de lo que sabemos que ya está en la nube (para no subir si no cambió nada)
let _firmaSubida = null;
// Si Firestore no entendiera la precondición, se desactiva en esta sesión
// en vez de dejar el panel sin poder guardar.
let _sinPrecondicion = false;

// JSON con claves ordenadas, sin fotos ni sellos de versión: dos bases con el
// mismo contenido dan la misma firma aunque sus claves vengan en otro orden.
function _firmaDatos(d){
  const limpio = v => {
    if(Array.isArray(v)) return v.map(limpio);
    if(v && typeof v === 'object'){
      const o = {};
      Object.keys(v).sort().forEach(k => {
        if(k === '_version' || k === '_snap' || k === 'foto') return;
        o[k] = limpio(v[k]);
      });
      return o;
    }
    return v;
  };
  try{ return JSON.stringify(limpio(d)); }catch(e){ return null; }
}
function hayCambiosSinSubir(){
  return hayGuardadoPendiente() || _firmaSubida === null || _firmaDatos(DB) !== _firmaSubida;
}
// Tras fusionar con la nube: si DB quedó igual a lo que hay allá, no hay nada que subir
function _marcarSiIgualANube(parsed){
  // mergeDB completa claves por defecto (gastos:[], reciboSeq…): se compara
  // contra la nube pasada por el mismo molde para no ver diferencias falsas.
  let molde;
  try{ const c = JSON.parse(JSON.stringify(parsed)); molde = mergeDB(c, JSON.parse(JSON.stringify(parsed))); }
  catch(e){ return; }
  const f = _firmaDatos(molde);
  if(f !== null && f === _firmaDatos(DB)) _firmaSubida = f;
}
function _restaurarFotos(){
  let fotos = {};
  try{ fotos = JSON.parse(localStorage.getItem('_fotos')||'{}'); }catch(e){}
  DB.alumnos?.forEach(a=>{ if(!a.foto&&fotos[a.id]) a.foto=fotos[a.id]; });
}

// Lee la nube y la fusiona en DB (sin subir nada). Se usa cuando un guardado
// choca con una escritura de otro equipo. Devuelve 'no-existe' | 'vacio' | 'fusionado'.
async function _fbLeerYFusionar(){
  const r = await fetch(`${FB_URL}?key=${FB_KEY}`, { headers: await fbHeaders() });
  if(r.status === 404){ _fbUpdateTime = null; return 'no-existe'; }
  if(!r.ok) throw new Error('lectura HTTP '+r.status);
  const j = await r.json();
  _fbUpdateTime = j.updateTime || null;
  const raw = j.fields?.data?.stringValue;
  if(!raw) return 'vacio';
  const parsed = JSON.parse(raw);
  const antes = _firmaDatos(DB);
  DB = mergeDB(DB, parsed);
  _restaurarFotos();
  repararFechasIngreso();
  _localVersion = Math.max(_localVersion||0, parsed._version||0);
  snapLocal();
  if(_firmaDatos(DB) !== antes){
    console.log('🔀 Se fusionaron cambios de otro dispositivo antes de guardar');
    try{ renderSection(activeSection); }catch(e){}
    toast('🔀 Se combinaron cambios de otro dispositivo','info');
  }
  return 'fusionado';
}

// Firestore responde así cuando el documento cambió desde el updateTime enviado
function _esConflictoVersion(r, eb){
  const st = eb?.error?.status;
  return r.status === 409 || r.status === 412 || st === 'FAILED_PRECONDITION' || st === 'ABORTED';
}

async function _fbCargar(){
  if(_guardandoAhora){
    console.log('⏸ _fbCargar pausada — esperando guardado en curso...');
    await new Promise(r=>setTimeout(r,3000));
  }
  setSyncStatus('syncing');
  try{
    const r = await fetch(`${FB_URL}?key=${FB_KEY}`, { headers: await fbHeaders() });
    if(!r.ok) throw new Error('FB error '+r.status);
    const j = await r.json();
    const raw = j.fields?.data?.stringValue;
    if(raw){
      const parsed = JSON.parse(raw);
      const fbVersion = parsed._version || 0;
      const localVersion = _localVersion || 0;

      console.log('📊 Firebase v'+fbVersion+' | Local v'+localVersion);

      // ── FUSIÓN SIEMPRE por timestamps de sección ──
      // mergeDB compara _ts_ de cada sección individualmente.
      // El "ganador" no es quien tiene _version más alto,
      // sino quien modificó cada sección más recientemente.
      // Esto resuelve el bug de multi-dispositivo donde el PC de casa
      // tenía _localVersion alto (timestamps locales) pero datos viejos.
      // ── Detectar si ALGUNA sección local es más nueva que la de la nube ──
      // Antes solo se miraba `_version` global. Cuando el snapshot local tenía
      // más de 24 h, loadDB() ponía _localVersion = 0 a propósito, así que
      // `localVersion > fbVersion` daba falso y los cambios locales — aunque
      // mergeDB sí los conservaba — NUNCA se subían: se quedaban en ese equipo
      // hasta el siguiente guardado manual. Ese era el bug de "trabajo en la
      // academia, vuelvo días después y no está".
      const _SECCIONES_TS = ['alumnos','alumnosRetirados','profesores','profesoresRetirados',
        'pagos','asistencias','clases','gastos','extraDias','presentaciones','planificador',
        'gastosV','otrosIngresos','recaudos','rifas','vestuarios','usosVestuario'];
      const seccionesLocalesNuevas = _SECCIONES_TS.filter(s =>
        (DB['_ts_'+s] || 0) > (parsed['_ts_'+s] || 0));

      const merged = mergeDB(DB, parsed);
      const hayDifsLocal  = localVersion > fbVersion || seccionesLocalesNuevas.length > 0;
      const hayDifsRemoto = fbVersion > localVersion;

      DB = merged;
      _fbUpdateTime = j.updateTime || null;   // DB ya incorporó esta versión de la nube
      _marcarSiIgualANube(parsed);
      // La versión global es la más alta de ambas
      _localVersion = Math.max(localVersion, fbVersion);

      const fotos = JSON.parse(localStorage.getItem('_fotos')||'{}');
      DB.alumnos.forEach(a=>{ if(!a.foto&&fotos[a.id]) a.foto=fotos[a.id]; });
      snapLocal();

      if(hayDifsLocal){
        // Local tenía cambios que Firebase no tiene — subir
        if(seccionesLocalesNuevas.length){
          console.log('⬆️ Secciones locales más nuevas que la nube: '+seccionesLocalesNuevas.join(', '));
          // Sellar con la hora actual para que la nube quede con versión nueva
          // y los demás dispositivos se enteren de que hay cambios.
          _localVersion = Date.now();
          try{ localStorage.setItem('_db_version', String(_localVersion)); }catch(e){}
          snapLocal();
          toast('⬆️ Subiendo cambios pendientes de este equipo...','info');
        }
        console.log('⬆️ Local más nuevo — subiendo a Firebase...');
        encolarGuardado();
        const ok = await _fbSave(DB);
        if(ok) desencolarGuardado();
        else programarReintento();
      } else if(hayDifsRemoto){
        console.log('✅ Firebase más nuevo — datos actualizados desde otro dispositivo');
      } else {
        console.log('✓ En sincronía');
      }

    } else {
      // Firebase vacío
      _fbUpdateTime = j.updateTime || null;
      if(DB.alumnos && DB.alumnos.length > 0){
        console.log('⬆️ Firebase vacío — subiendo datos locales...');
        await _fbSave(DB);
      } else {
        cargarBackup();
      }
    }
    setSyncStatus('ok');
    return true;
  }catch(e){
    console.warn('Firebase no disponible:', e.message);
    setSyncStatus('error');
    return false;
  }
}

// ===================== SISTEMA DE GUARDADO ROBUSTO =====================
const COLA_KEY = '_cola_guardado';
let _guardandoAhora = false;
let _reintentosTimer = null;
let _ultimoGuardado = 0; // timestamp del último guardado exitoso

function snapLocal(){
  try{
    const copia = {...DB, alumnos: DB.alumnos.map(a=>({...a,foto:null})), _version: _localVersion, _snap: Date.now()};
    localStorage.setItem('_db', JSON.stringify(copia));
    // 3 copias de seguridad rotativas
    localStorage.setItem('_snap_' + (Date.now() % 3), JSON.stringify(copia));
  }catch(e){ console.warn('snapLocal error:', e); }
}

function encolarGuardado(){
  try{ localStorage.setItem(COLA_KEY, String(Date.now())); }catch(e){ console.warn('Cola de guardado no cabe en localStorage:', e); }
}
function desencolarGuardado(){ localStorage.removeItem(COLA_KEY); }
function hayGuardadoPendiente(){ return !!localStorage.getItem(COLA_KEY); }

async function saveAll(){
  _localVersion = Date.now();
  snapLocal();                                         // 1. local al instante
  try{ localStorage.setItem('_db_version', String(_localVersion)); }catch(e){ console.warn('_db_version no cabe en localStorage:', e); }
  encolarGuardado();                                   // 2. marcar pendiente
  if(_bc){
    try{
      const sf={...DB,alumnos:DB.alumnos.map(a=>({...a,foto:null}))};
      _bc.postMessage({type:'DB_UPDATED',version:_localVersion,db:sf});
    }catch(e){}
  }
  const ok = await _fbSave(DB);                       // 3. subir a Firebase
  if(ok){
    desencolarGuardado();
    actualizarIndicadorGuardado(true);
  } else {
    actualizarIndicadorGuardado(false);
    programarReintento();
  }
  return ok;
}

// Guardar sin bloquear UI — para acciones rápidas como toggles
function saveBackground(){
  _localVersion = Date.now();
  snapLocal();
  encolarGuardado();
  _fbSave(DB).then(ok=>{
    if(ok){ desencolarGuardado(); _ultimoGuardado=Date.now(); actualizarIndicadorGuardado(true); }
    else { actualizarIndicadorGuardado(false); programarReintento(); }
  });
}

// ── Un solo guardado a la vez ──
// autosave, polling, reintentos y acciones del usuario podían disparar varios
// PATCH a la vez. Ahora van en fila, y si ya hay uno esperando turno no se
// encola otro: ese, al arrancar, sube el DB más reciente igual.
let _guardadoEnCurso = null, _guardadoEsperando = null;
function _fbSave(datos){
  const correr = () => {
    _guardadoEnCurso = _fbSaveInterno().finally(() => { _guardadoEnCurso = null; });
    return _guardadoEnCurso;
  };
  if(_guardadoEsperando) return _guardadoEsperando;
  if(!_guardadoEnCurso) return correr();
  _guardadoEsperando = _guardadoEnCurso.catch(() => {}).then(() => {
    _guardadoEsperando = null;
    return correr();
  });
  return _guardadoEsperando;
}

// Sube siempre el DB global vigente (todos los llamadores pasaban DB).
async function _fbSaveInterno(){
  setSyncStatus('syncing');
  _guardandoAhora = true;
  // try/finally: si algo lanza antes de terminar, _guardandoAhora se quedaba
  // en true para siempre y el panel dejaba de guardar y sincronizar sin avisar.
  try{
  const fotos = {};
  DB.alumnos?.forEach(a=>{ if(a.foto) fotos[a.id]=a.foto; });
  // Las fotos solo viven en este navegador. Si no caben, se sigue guardando
  // la base en Firebase, que es lo importante.
  try{ localStorage.setItem('_fotos', JSON.stringify(fotos)); }
  catch(e){ console.warn('📷 Las fotos no caben en localStorage:', e); }
  // ── Límite de 64 KB de `keepalive` ────────────────────────────────────────
  // Chrome rechaza cualquier fetch con keepalive:true cuyo cuerpo pase de
  // 64 KB, y lo hace ANTES de salir a internet: el error que llega es un
  // "Failed to fetch" idéntico al de estar sin señal. Cuando la base creció
  // y el paquete pasó de 64 KB, TODOS los guardados empezaron a fallar en
  // silencio mientras la lectura seguía funcionando. Por eso keepalive solo
  // se usa cuando el cuerpo cabe; por encima, se envía sin él (sin límite).
  let conflictos = 0;
  for(let intento=1; intento<=3; intento++){
    try{
      // Sin versión conocida (p. ej. arrancó sin internet): leer y fusionar primero
      if(!_fbUpdateTime && !_sinPrecondicion) await _fbLeerYFusionar();
      // El payload se arma en cada vuelta: tras una fusión DB cambió
      const sinFotos = {...DB, alumnos: DB.alumnos?.map(a=>({...a,foto:null})), _version: _localVersion};
      const payload = JSON.stringify({fields:{data:{stringValue:JSON.stringify(sinFotos)}}});
      const _bytesPayload = (typeof TextEncoder !== 'undefined')
        ? new TextEncoder().encode(payload).length
        : payload.length;
      const _cabeKeepalive = _bytesPayload < 60000;   // margen de seguridad
      if(!_cabeKeepalive) console.log('📦 Paquete de '+(_bytesPayload/1024).toFixed(1)+' KB — enviando sin keepalive');

      const ctrl = new AbortController();
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      const timeoutMs = isMobile ? 30000 : 15000; // más tiempo en mobile
      const tmout = setTimeout(()=>ctrl.abort(), timeoutMs);
      const fetchOpts = {
        method:'PATCH',
        headers: await fbHeaders({'Content-Type':'application/json'}),
        body: payload,
        signal: ctrl.signal,
        // keepalive ayuda en móvil (sobrevive a cambios de pestaña), pero solo
        // es válido por debajo de 64 KB. Ver la nota de arriba.
        keepalive: _cabeKeepalive
      };
      // mask.fieldPaths=v (campo que no existe): la respuesta trae solo el
      // updateTime, no los cientos de KB del documento.
      let url = `${FB_URL}?key=${FB_KEY}&updateMask.fieldPaths=data&mask.fieldPaths=v`;
      if(_fbUpdateTime && !_sinPrecondicion) url += '&currentDocument.updateTime='+encodeURIComponent(_fbUpdateTime);
      const r = await fetch(url, fetchOpts);
      clearTimeout(tmout);
      if(!r.ok){
        const eb = await r.json().catch(()=>({}));
        if(_fbUpdateTime && !_sinPrecondicion && _esConflictoVersion(r, eb) && conflictos < 3){
          // Otro equipo escribió desde nuestra última lectura: fusionar y reintentar
          conflictos++;
          console.log('🔀 La nube cambió desde la última lectura — fusionando ('+conflictos+'/3)');
          await _fbLeerYFusionar();
          intento--;            // un choque de versiones no es un fallo de red
          continue;
        }
        if(r.status === 400 && /currentDocument|update_?time|precondition/i.test(eb?.error?.message||'')){
          console.error('Firestore no aceptó la precondición; se guarda sin ella en esta sesión:', eb?.error?.message);
          _sinPrecondicion = true;
        }
        throw new Error('HTTP '+r.status+': '+(eb?.error?.message||''));
      }
      const doc = await r.json().catch(()=>({}));
      _fbUpdateTime = doc.updateTime || null;
      _firmaSubida = _firmaDatos(sinFotos);
      _ultimoGuardado = Date.now();
      setSyncStatus('ok');
      console.log('✅ Firebase verificado OK (intento '+intento+')');
      return true;
    }catch(e){
      console.warn('⚠️ Firebase intento '+intento+'/3:', e.message);
      if(intento < 3) await new Promise(res=>setTimeout(res, 2000*intento));
    }
  }

  setSyncStatus('error');
  toast('⚠️ Sin conexión — datos seguros localmente, reintentando...','info');
  return false;
  }catch(e){
    console.error('❌ _fbSave falló antes de enviar:', e);
    setSyncStatus('error');
    return false;
  }finally{
    _guardandoAhora = false;
  }
}

function programarReintento(){
  clearTimeout(_reintentosTimer);
  _reintentosTimer = setTimeout(async ()=>{
    if(hayGuardadoPendiente() && !_guardandoAhora){
      console.log('🔄 Reintentando guardado pendiente...');
      const ok = await _fbSave(DB);
      if(ok){ desencolarGuardado(); actualizarIndicadorGuardado(true); toast('✅ Datos sincronizados con Firebase','ok'); }
      else { programarReintento(); }
    }
  }, 15000); // 15s — sincronización más rápida entre dispositivos
}

// Fuerza un reintento INMEDIATO del guardado pendiente (sin esperar los 15s).
// Se dispara al recuperar conexión o al volver a la app.
async function reintentarPendienteAhora(motivo){
  if(!hayGuardadoPendiente() || _guardandoAhora) return;
  console.log('🔄 Reintento inmediato ('+motivo+')...');
  const ok = await _fbSave(DB);
  if(ok){ desencolarGuardado(); actualizarIndicadorGuardado(true); toast('✅ Datos sincronizados con Firebase','ok'); }
  else { programarReintento(); }
}

// Disparadores de resincronización: al volver internet y al reabrir la app.
// Sin esto, un guardado hecho sin señal quedaba esperando el temporizador (que muere
// si se cierra la página) y no se subía hasta el siguiente cambio manual.
if(typeof window !== 'undefined'){
  window.addEventListener('online', function(){ reintentarPendienteAhora('volvió internet'); });
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState==='visible') reintentarPendienteAhora('app visible');
  });

  // ── Reintento AL ARRANCAR ──────────────────────────────────────────────
  // 'visibilitychange' no se dispara al abrir la página con la pestaña ya
  // visible, y el temporizador de programarReintento() muere al cerrar el
  // navegador. Sin esto, un guardado que quedó pendiente ayer no se subía
  // hasta que el usuario volviera a guardar algo a mano.
  window.addEventListener('load', function(){
    setTimeout(function(){
      if(typeof DB!=='undefined' && DB && DB.alumnos) reintentarPendienteAhora('arranque');
    }, 6000);
  });

  // ── Aviso al cerrar si quedó algo sin subir ────────────────────────────
  window.addEventListener('beforeunload', function(e){
    if(hayGuardadoPendiente()){
      e.preventDefault();
      e.returnValue = 'Hay cambios que aún no se han subido a la nube. Si cierras ahora, no los verás en otro computador.';
      return e.returnValue;
    }
  });
}

function actualizarIndicadorGuardado(ok){
  const btn = document.querySelector('.btn-guardar');
  if(!btn) return;
  if(ok){
    btn.style.background=''; btn.innerHTML='💾 Guardar';
  } else {
    // El aviso NO se borra solo a los 8 s: queda visible mientras haya algo
    // sin subir, para que nadie apague el equipo creyendo que ya se guardó.
    btn.style.background='var(--warning)'; btn.innerHTML='⚠️ Sin subir';
    btn.title='Hay cambios guardados solo en este equipo. No cierres hasta que diga 💾 Guardar.';
  }
}

function setSyncStatus(s){
  const d=document.getElementById('sync-dot');
  if(!d) return;
  d.className='sync-status '+s;
  d.title = s==='ok'?'Sincronizado ✅': s==='syncing'?'Guardando...':'⚠️ Error — datos seguros en local';
}
function cargarBackup(){
  // Firebase vacío — iniciar con DB limpio
  DB={alumnos:[],alumnosRetirados:[],profesores:[],profesoresRetirados:[],
      pagos:{},asistencias:{},clases:{},gastos:[],extraDias:{},presentaciones:[],nextId:1};
  saveAll();
}
function autosave(){
  clearTimeout(syncTimeout);
  syncTimeout=setTimeout(saveAll,2*60*1000);
}

// ===================== CARGA LOCAL =====================
function repararFechasIngreso(){
  const backupMap={};
  BACKUP_ALUMNOS.forEach(a=>{ backupMap[a.id]=a; });
  const ahora=new Date();
  const hoyStr=ahora.getFullYear()+'-'+String(ahora.getMonth()+1).padStart(2,'0')+'-'+String(ahora.getDate()).padStart(2,'0');
  (DB.alumnos||[]).forEach(a=>{
    const fi=a.fechaIngreso;
    const invalido=!fi||fi===''||fi==='undefined'||fi==='null';
    if(invalido){
      a.fechaIngreso=backupMap[a.id]?backupMap[a.id].fechaIngreso:hoyStr;
    }
    if(a.fechaIngreso) a.fechaIngreso=String(a.fechaIngreso).trim().substring(0,10);
  });
}

function loadDB(){
  const claves = ['_db','_snap_0','_snap_1','_snap_2'];
  let mejorSnap = null, mejorVersion = 0;
  claves.forEach(k=>{
    try{
      const raw = localStorage.getItem(k);
      if(!raw) return;
      const p = JSON.parse(raw);
      const v = p._version || p._snap || 0;
      if(v > mejorVersion){ mejorVersion=v; mejorSnap=p; }
    }catch(e){}
  });
  if(mejorSnap){
    DB = mejorSnap;
    _localVersion = mejorVersion;
    console.log('📂 Snapshot local cargado v'+mejorVersion);
    // Si el snapshot es muy viejo (más de 24h sin guardar), no confiar en la versión
    const ahoraMs = Date.now();
    if(mejorVersion > 0 && (ahoraMs - mejorVersion) > 24*60*60*1000){
      console.warn('⚠️ Snapshot local tiene más de 24h — Firebase tendrá prioridad al arrancar');
      _localVersion = 0; // forzar que Firebase gane en la comparación inicial
    }
  }
  repararFechasIngreso();
  const fotos = JSON.parse(localStorage.getItem('_fotos')||'{}');
  DB.alumnos?.forEach(a=>{ if(!a.foto&&fotos[a.id]) a.foto=fotos[a.id]; });
}
