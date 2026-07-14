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

// ── Merge por timestamp — el más reciente gana sección a sección ──
function mergeDB(local, remoto){
  // Defaults seguros — garantiza que ninguna clave queda undefined
  const defaults = {
    alumnos:[],alumnosRetirados:[],profesores:[],profesoresRetirados:[],
    pagos:{},asistencias:{},clases:{},gastos:[],gastosV:[],otrosIngresos:[],recaudos:[],extraDias:{},
    presentaciones:[],planificador:[],rifas:[],nextId:1
  };

  // Base: defaults + remoto, pero NUNCA reemplazar un array local con undefined/null
  const base = {...defaults};
  Object.keys(defaults).forEach(k=>{
    if(remoto[k] !== undefined && remoto[k] !== null) base[k] = remoto[k];
    // Si remoto no tiene la clave, queda el default (protege gastosV, planificador, etc.)
  });
  // Copiar _ts_* y _version del remoto
  Object.keys(remoto).forEach(k=>{ if(k.startsWith('_')) base[k]=remoto[k]; });

  const secciones=['alumnos','alumnosRetirados','profesores','profesoresRetirados',
    'pagos','asistencias','clases','gastos','extraDias','presentaciones','planificador','gastosV','otrosIngresos','recaudos','rifas'];

  secciones.forEach(s=>{
    // SIN fallback a _version: una sección sin timestamp propio NUNCA debe
    // ganar por tener _version global alto (causó pérdida de rifas 2026-07-11)
    const tsL = local['_ts_'+s]  || 0;
    const tsR = remoto['_ts_'+s] || 0;
    const localVal  = local[s]  ?? defaults[s];
    const remotoVal = remoto[s] ?? defaults[s]; // nunca undefined

    // Protección especial: si remoto no tiene timestamp propio para esta sección
    // y local tiene datos, local gana siempre
    const remotoTieneTs = !!remoto['_ts_'+s];
    const localTieneDatos = Array.isArray(localVal) ? localVal.length > 0
      : (localVal && Object.keys(localVal).length > 0);

    if(!remotoTieneTs && localTieneDatos){
      // Remoto nunca tuvo este campo con timestamp propio — conservar local
      base[s] = localVal;
      base['_ts_'+s] = tsL;
      const sz = Array.isArray(localVal) ? localVal.length+' items' : Object.keys(localVal).length+' keys';
      console.log('🛡️ '+s+': remoto sin timestamp propio — conservando local ('+sz+')');
      return;
    }

    if(tsL > tsR){
      // Local más reciente — siempre ganar
      base[s] = localVal;
      base['_ts_'+s] = tsL;
      console.log('📌 '+s+': local gana ts='+new Date(tsL).toLocaleTimeString());
    } else if(tsR > tsL){
      // Remoto más reciente — PERO nunca aceptar un array vacío que borre datos locales
      const remotoVacio = Array.isArray(remotoVal) && remotoVal.length===0;
      const localConDatos = Array.isArray(localVal) && localVal.length>0;
      if(remotoVacio && localConDatos){
        base[s] = localVal;
        base['_ts_'+s] = Date.now(); // marcar local como más nuevo para resubir
        console.warn('🛡️ '+s+': remoto vacío intentó borrar '+localVal.length+' items locales — BLOQUEADO, conservando local');
      } else {
        console.log('☁️ '+s+': remoto gana ts='+new Date(tsR).toLocaleTimeString());
      }
    } else {
      // Mismo timestamp — fusión segura sin perder datos
      if(s==='asistencias'){
        const ids=new Set([...Object.keys(localVal||{}),...Object.keys(remotoVal||{})]);
        const m={};
        ids.forEach(id=>{ m[id]=Object.assign({},localVal?.[id]||{},remotoVal?.[id]||{}); });
        base[s]=m;
      } else if(s==='pagos'){
        const pg=Object.assign({},remotoVal||{});
        Object.keys(localVal||{}).forEach(id=>{
          if(!pg[id]) pg[id]={};
          Object.keys(localVal[id]||{}).forEach(mk=>{
            if(!pg[id][mk]) pg[id][mk]=localVal[id][mk];
            else if(localVal[id][mk]?.pagado&&!pg[id][mk]?.pagado) pg[id][mk]=localVal[id][mk];
          });
        });
        base[s]=pg;
      } else if(Array.isArray(localVal)&&Array.isArray(remotoVal)){
        // Para arrays: el más largo O el local si tiene datos que el remoto no tiene
        base[s] = localVal.length >= remotoVal.length ? localVal : remotoVal;
      } else if(Array.isArray(localVal) && !Array.isArray(remotoVal)){
        base[s] = localVal;
        console.log('🛡️ '+s+': remoto no tiene este campo, conservando local ('+localVal.length+' items)');
      } else if(s==='extraDias' || s==='clases'){
        // Objetos indexados: fusionar mes a mes / semana a semana
        const merged = Object.assign({}, remotoVal||{});
        Object.keys(localVal||{}).forEach(k=>{
          if(!merged[k]) merged[k] = localVal[k];
          else if(Array.isArray(localVal[k]) && Array.isArray(merged[k])){
            // Para arrays dentro del objeto, usar el más largo
            if(localVal[k].length > merged[k].length) merged[k] = localVal[k];
          }
        });
        base[s] = merged;
      }
    }
  });

  base.nextId=Math.max(local.nextId||1,remoto.nextId||1);
  return base;
}
async function _fbCargar(){
  if(_guardandoAhora){
    console.log('⏸ _fbCargar pausada — esperando guardado en curso...');
    await new Promise(r=>setTimeout(r,3000));
  }
  setSyncStatus('syncing');
  try{
    const r = await fetch(`${FB_URL}?key=${FB_KEY}`);
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
      const merged = mergeDB(DB, parsed);
      const hayDifsLocal  = localVersion > fbVersion;
      const hayDifsRemoto = fbVersion > localVersion;

      DB = merged;
      // La versión global es la más alta de ambas
      _localVersion = Math.max(localVersion, fbVersion);

      const fotos = JSON.parse(localStorage.getItem('_fotos')||'{}');
      DB.alumnos.forEach(a=>{ if(!a.foto&&fotos[a.id]) a.foto=fotos[a.id]; });
      snapLocal();

      if(hayDifsLocal){
        // Local tenía cambios que Firebase no tiene — subir
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

function encolarGuardado(){ localStorage.setItem(COLA_KEY, String(Date.now())); }
function desencolarGuardado(){ localStorage.removeItem(COLA_KEY); }
function hayGuardadoPendiente(){ return !!localStorage.getItem(COLA_KEY); }

async function saveAll(){
  _localVersion = Date.now();
  snapLocal();                                         // 1. local al instante
  localStorage.setItem('_db_version', String(_localVersion));
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

async function _fbSave(datos){
  setSyncStatus('syncing');
  _guardandoAhora = true;
  const fotos = {};
  datos.alumnos?.forEach(a=>{ if(a.foto) fotos[a.id]=a.foto; });
  localStorage.setItem('_fotos', JSON.stringify(fotos));
  const sinFotos = {...datos, alumnos: datos.alumnos?.map(a=>({...a,foto:null})), _version: _localVersion};
  const payload = JSON.stringify({fields:{data:{stringValue:JSON.stringify(sinFotos)}}});

  for(let intento=1; intento<=3; intento++){
    try{
      const ctrl = new AbortController();
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      const timeoutMs = isMobile ? 30000 : 15000; // más tiempo en mobile
      const tmout = setTimeout(()=>ctrl.abort(), timeoutMs);
      const fetchOpts = {
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body: payload,
        signal: ctrl.signal,
        keepalive: true // crucial en mobile — sobrevive a cambios de pestaña
      };
      const r = await fetch(`${FB_URL}?key=${FB_KEY}&updateMask.fieldPaths=data`, fetchOpts);
      clearTimeout(tmout);
      if(!r.ok){
        const eb = await r.json().catch(()=>({}));
        throw new Error('HTTP '+r.status+': '+(eb?.error?.message||''));
      }
      _guardandoAhora = false;
      _ultimoGuardado = Date.now();
      setSyncStatus('ok');
      console.log('✅ Firebase verificado OK (intento '+intento+')');
      return true;
    }catch(e){
      console.warn('⚠️ Firebase intento '+intento+'/3:', e.message);
      if(intento < 3) await new Promise(res=>setTimeout(res, 2000*intento));
    }
  }

  _guardandoAhora = false;
  setSyncStatus('error');
  toast('⚠️ Sin conexión — datos seguros localmente, reintentando...','info');
  return false;
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

function actualizarIndicadorGuardado(ok){
  const btn = document.querySelector('.btn-guardar');
  if(!btn) return;
  if(ok){
    btn.style.background=''; btn.innerHTML='💾 Guardar';
  } else {
    btn.style.background='var(--warning)'; btn.innerHTML='⚠️ Pendiente';
    setTimeout(()=>{ btn.style.background=''; btn.innerHTML='💾 Guardar'; }, 8000);
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
