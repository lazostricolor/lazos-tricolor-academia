/* ═══════════════════════════════════════════════════════════
   merge.js
   ⚠️ NÚCLEO CRÍTICO — fusión de la base local con la de Firebase
   Movido sin cambios desde firebase.js para poder probarlo con
   `npm test` (tests/merge.test.js). Funciones puras: no tocan DB,
   pantalla ni localStorage.
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ── Merge por timestamp — el más reciente gana sección a sección ──
// Fusiona dos arrays de objetos por su campo `id`, sin perder items ni revivir borrados.
// - Cada id que exista en cualquiera de los dos queda en el resultado.
// - Si un id está en ambos, se combinan sus campos; si los items llevan _editTs,
//   gana el más reciente (para ediciones); si no, prioriza el array `prioritario`.
// - Items SIN id (raros) se conservan del array prioritario, o del más largo si no se indica.
// Nota sobre borrados: dos dispositivos que sincronizan seguido comparten el mismo
// conjunto de ids; un borrado real se propaga porque el item desaparece de ambos antes
// de que diverjan. Esta fusión evita el bug opuesto y más común: perder altas/ediciones.
function _fusionarArrayPorId(prioritario, secundario, priorEsBase){
  prioritario = Array.isArray(prioritario) ? prioritario : [];
  secundario  = Array.isArray(secundario)  ? secundario  : [];
  // Si los items no tienen id, no podemos fusionar con seguridad → el más largo
  const tienenId = a => a.length===0 || a[0] && a[0].id!==undefined;
  if(!tienenId(prioritario) || !tienenId(secundario)){
    return prioritario.length >= secundario.length ? prioritario : secundario;
  }
  const porId = {};
  const orden = [];
  // Primero el secundario (base), luego el prioritario lo sobrescribe/combina
  secundario.forEach(it=>{ if(it && it.id!==undefined){ porId[it.id]=it; orden.push(it.id); } });
  prioritario.forEach(it=>{
    if(!it || it.id===undefined) return;
    const prev = porId[it.id];
    if(!prev){ porId[it.id]=it; orden.push(it.id); return; }
    // Ambos tienen este id: combinar por recencia si hay _editTs, si no priorizar
    const pt = it._editTs||0, st = prev._editTs||0;
    if(pt||st){
      porId[it.id] = pt>=st ? it : prev;
    } else {
      porId[it.id] = priorEsBase ? it : Object.assign({}, prev, it);
    }
  });
  return orden.map(id=>porId[id]);
}

// ── Coherencia entre alumnas activas y archivadas ──────────────────────────
// Una alumna NO puede estar en las dos listas: la fusión por id une los dos
// arrays y, sin esto, una alumna retirada revivía como activa en cada
// sincronización (y volvía a aparecer al final de la lista de Alumnas).
// Gana el último movimiento real: `_movTs` lo graban retirarAlumna() y
// reactivarAlumna(). Si ninguna de las dos copias lo trae (datos viejos),
// manda el archivo — que es lo que el usuario pidió explícitamente.
function _movTsAl(a){ return (a && a._movTs) || 0; }

function coherenciaAlumnas(db){
  if(!db || !Array.isArray(db.alumnos) || !Array.isArray(db.alumnosRetirados)) return false;
  let cambio=false;

  // 1) Sin repetidas dentro del archivo (conservando la fecha de retiro más antigua)
  const porId={}; const retiradas=[];
  db.alumnosRetirados.forEach(a=>{
    if(!a || a.id===undefined){ retiradas.push(a); return; }
    const k=String(a.id), prev=porId[k];
    if(!prev){ porId[k]=a; retiradas.push(a); return; }
    cambio=true;                                  // copia repetida → se descarta
    const frViejo = (prev.fechaRetiro && a.fechaRetiro)
      ? (prev.fechaRetiro < a.fechaRetiro ? prev.fechaRetiro : a.fechaRetiro)
      : (prev.fechaRetiro || a.fechaRetiro);
    if(_movTsAl(a) > _movTsAl(prev)) Object.assign(prev, a);
    prev.fechaRetiro = frViejo;
  });
  if(cambio) db.alumnosRetirados = retiradas;

  // 2) Nadie a la vez activa y archivada
  const activas=[]; const vuelvenAActivas=new Set();
  db.alumnos.forEach(a=>{
    if(!a || a.id===undefined){ activas.push(a); return; }
    const ret = porId[String(a.id)];
    if(!ret){ activas.push(a); return; }
    cambio = true;
    if(_movTsAl(a) > _movTsAl(ret)){               // la reactivación es más reciente
      activas.push(a);
      vuelvenAActivas.add(String(a.id));
    }                                              // si no, manda el retiro: se descarta de activas
  });
  db.alumnos = activas;
  if(vuelvenAActivas.size){
    db.alumnosRetirados = db.alumnosRetirados.filter(a=>!(a && a.id!==undefined && vuelvenAActivas.has(String(a.id))));
  }
  if(cambio) console.log('🧹 Coherencia alumnas: activas='+db.alumnos.length+' · archivo='+db.alumnosRetirados.length);
  return cambio;
}

// ── Pagos y asistencias: fusión entrada por entrada ─────────────────────────
// Son objetos (no arrays), y antes el lado con _ts_ más nuevo los reemplazaba
// ENTEROS: si dos equipos marcaban pagos casi a la vez, el último en guardar
// borraba el pago que había marcado el otro. Ahora se combinan alumna por
// alumna y mes por mes.
// ganaLocal: true/false = qué lado tiene la sección más reciente; null = empate.
function _fusionarPagos(local, remoto, ganaLocal){
  local = local || {}; remoto = remoto || {};
  const r = {};
  new Set([...Object.keys(remoto), ...Object.keys(local)]).forEach(id=>{
    const Lm = local[id] || {}, Rm = remoto[id] || {};
    const o = {};
    new Set([...Object.keys(Rm), ...Object.keys(Lm)]).forEach(mk=>{
      const L = Lm[mk], R = Rm[mk];
      if(R === undefined){ o[mk] = L; return; }          // solo lo tiene local
      if(L === undefined){ o[mk] = R; return; }          // solo lo tiene remoto
      const lt = L && L._editTs || 0, rt = R && R._editTs || 0;
      if(lt || rt){                                      // gana la edición más reciente
        o[mk] = lt > rt ? L : rt > lt ? R : (ganaLocal === false ? R : L);
      } else if(ganaLocal === null){                     // pagos viejos sin sello, empate:
        o[mk] = (L && L.pagado && !(R && R.pagado)) ? L : R;   // gana "pagado"
      } else {
        o[mk] = ganaLocal ? L : R;
      }
    });
    r[id] = o;
  });
  return r;
}
// Asistencias: alumna → { fecha: 'P' | 'A' | '' }. Sin sello por celda: se unen
// las celdas de los dos lados y, si ambos tocaron la misma, gana el lado con la
// sección más reciente (en empate, el remoto, como antes).
function _fusionarAsistencias(local, remoto, ganaLocal){
  local = local || {}; remoto = remoto || {};
  const r = {};
  new Set([...Object.keys(remoto), ...Object.keys(local)]).forEach(id=>{
    r[id] = ganaLocal === true
      ? Object.assign({}, remoto[id] || {}, local[id] || {})
      : Object.assign({}, local[id] || {}, remoto[id] || {});
  });
  return r;
}

function mergeDB(local, remoto){
  // Defaults seguros — garantiza que ninguna clave queda undefined
  const defaults = {
    alumnos:[],alumnosRetirados:[],profesores:[],profesoresRetirados:[],
    pagos:{},asistencias:{},clases:{},gastos:[],gastosV:[],otrosIngresos:[],recaudos:[],extraDias:{},
    presentaciones:[],planificador:[],rifas:[],vestuarios:[],usosVestuario:[],nextId:1
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
    'pagos','asistencias','clases','gastos','extraDias','presentaciones','planificador','gastosV','otrosIngresos','recaudos','rifas','vestuarios','usosVestuario'];

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

    if(s==='pagos' || s==='asistencias'){
      const ganaLocal = tsL > tsR ? true : tsR > tsL ? false : null;
      base[s] = s==='pagos'
        ? _fusionarPagos(localVal, remotoVal, ganaLocal)
        : _fusionarAsistencias(localVal, remotoVal, ganaLocal);
      base['_ts_'+s] = Math.max(tsL, tsR);
      return;
    }

    if(tsL > tsR){
      // Local más reciente — gana, PERO si son arrays fusionamos por id para no
      // perder items que el otro dispositivo agregó y este local no alcanzó a ver.
      if(Array.isArray(localVal) && Array.isArray(remotoVal)){
        base[s] = _fusionarArrayPorId(localVal, remotoVal, true); // local prioritario
      } else {
        base[s] = localVal;
      }
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
      } else if(Array.isArray(localVal) && Array.isArray(remotoVal)){
        // Remoto gana, pero fusionamos por id para no perder items que solo tiene local
        base[s] = _fusionarArrayPorId(remotoVal, localVal, true); // remoto prioritario
        console.log('☁️ '+s+': remoto gana ts (fusionado por id)');
      } else {
        console.log('☁️ '+s+': remoto gana ts='+new Date(tsR).toLocaleTimeString());
      }
    } else {
      // Mismo timestamp — fusión segura sin perder datos
      // (pagos y asistencias ya se resolvieron arriba, entrada por entrada)
      if(Array.isArray(localVal)&&Array.isArray(remotoVal)){
        // Arrays de objetos con id → fusionar por id (no "el más largo", que revive borrados
        // o pierde ediciones). Cada id conserva la versión de quien lo tenga; si ambos, se
        // combinan sus campos. Los items sin id caen al respaldo "más largo".
        base[s] = _fusionarArrayPorId(localVal, remotoVal);
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
  base.reciboSeq=Math.max(local.reciboSeq||0,remoto.reciboSeq||0);  // consecutivo de recibos

  // Claves que no están en la lista de secciones (p. ej. alumnosHistoricas):
  // conservarlas siempre — antes la fusión las borraba en silencio.
  Object.keys(local||{}).concat(Object.keys(remoto||{})).forEach(k=>{
    if(k.startsWith('_') || base[k]!==undefined) return;
    const lv=local?.[k], rv=remoto?.[k];
    if(Array.isArray(lv) && Array.isArray(rv)) base[k]=_fusionarArrayPorId(lv,rv);
    else base[k] = (lv!==undefined && lv!==null) ? lv : rv;
  });

  // Una alumna archivada nunca debe revivir como activa por efecto de la fusión
  coherenciaAlumnas(base);
  return base;
}

// En el navegador todo queda global (script clásico); en Node se exporta para los tests.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mergeDB, _fusionarArrayPorId, coherenciaAlumnas, _movTsAl, _fusionarPagos, _fusionarAsistencias };
}
