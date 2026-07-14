/* ═══════════════════════════════════════════════════════════
   app.js
   Arranque, init, polling y eventos del ciclo de vida
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== INIT =====================
async function init(){
  try{
    // 1. Fecha real de Colombia — timeout 3s para no bloquear
    await Promise.race([sincronizarFecha(), new Promise(r=>setTimeout(r,3000))]);
    startClock();

    // 2. Mes activo de cada sección = hoy real
    const hoy=getMesHoy();
    Object.keys(mesSec).forEach(s=>{ mesSec[s]=hoy; });
    const labelMap={dash:'dash-mes-label',alumnos:'alumnos-mes-label',pagos:'pagos-mes-label',asist:'asist-mes-label',fin:'fin-mes-label',gastos:'gastos-mes-label',ingresos:'ingresos-mes-label'};
    Object.keys(labelMap).forEach(s=>{
      const el=document.getElementById(labelMap[s]);
      if(el) el.textContent=mesLabel(mesSec[s]);
    });

    // 3. Cargar datos locales primero (el más reciente entre los snapshots)
    loadDB();
    renderDashboard();

    // 4. Sincronizar con Firebase — la versión más reciente gana
    const fbOk = await _fbCargar();
    if(fbOk){
      repararFechasIngreso();
      renderDashboard();
    }

    // 5. Si había guardados pendientes de sesión anterior, reintentarlos
    if(hayGuardadoPendiente()){
      console.log('🔄 Guardado pendiente detectado al arrancar — sincronizando...');
      toast('🔄 Sincronizando datos pendientes...','info');
      setTimeout(async ()=>{
        const ok = await _fbSave(DB);
        if(ok){ desencolarGuardado(); toast('✅ Datos sincronizados','ok'); }
        else { programarReintento(); }
      }, 3000);
    }

    // 6. Autosave cada 2 minutos
    setInterval(saveAll, 2*60*1000);

    // 5. Polling a Firebase cada 30s — detecta cambios desde OTROS dispositivos
    setInterval(async () => {
      // Pausar si hay guardado en curso
      if(_guardandoAhora){ return; }
      // Pausar si guardamos hace menos de 90 segundos — dar tiempo a Firebase de propagar
      if(_ultimoGuardado && (Date.now()-_ultimoGuardado) < 90000){ return; }
      try {
        const r = await fetch(`${FB_URL}?key=${FB_KEY}`);
        if (!r.ok) return;
        const j = await r.json();
        const raw = j.fields?.data?.stringValue;
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const fbVersion = parsed._version || 0;
        const localV = _localVersion || 0;
        console.log('🔄 Poll: FB v'+fbVersion+' | Local v'+localV);
        // Comparar versiones y hacer merge si hay diferencias
        if(fbVersion !== localV){
          console.log('🔄 Poll: versiones distintas — haciendo merge...');
          const merged = mergeDB(DB, parsed);
          const cambio = JSON.stringify(merged) !== JSON.stringify(DB);
          DB = merged;
          _localVersion = Math.max(localV, fbVersion);
          repararFechasIngreso();
          const fotos = JSON.parse(localStorage.getItem('_fotos')||'{}');
          DB.alumnos?.forEach(a=>{ if(!a.foto&&fotos[a.id]) a.foto=fotos[a.id]; });
          snapLocal();
          if(fbVersion > localV){
            // Firebase tenía cambios que local no tenía — actualizar pantalla
            if(cambio){
              renderSection(activeSection);
              toast('🌐 Actualizado desde otro dispositivo','info');
            }
            setSyncStatus('ok');
          } else {
            // Local tenía cambios que Firebase no tenía — subir
            console.log('⬆️ Subiendo cambios locales a Firebase...');
            await _fbSave(DB);
          }
        }
      } catch(e) { console.warn('Poll error:', e.message); }
    }, 15000); // 15s — sincronización más rápida entre dispositivos

  }catch(err){
    console.error('Error en init():', err);
    toast('Error al iniciar: '+err.message, 'err');
  }
}


// ===================== EVENTOS MOBILE Y CICLO DE VIDA =====================

// Cuando la app vuelve al frente (tab visible de nuevo)
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'visible'){
    console.log('👁 App visible — verificando datos pendientes...');
    // Si hay guardado pendiente, reintentarlo
    if(hayGuardadoPendiente() && !_guardandoAhora){
      toast('🔄 Sincronizando...','info');
      _fbSave(DB).then(function(ok){
        if(ok){ desencolarGuardado(); actualizarIndicadorGuardado(true); toast('✅ Datos sincronizados','ok'); }
        else programarReintento();
      });
    }
    // Si llevamos más de 2 min sin ver Firebase, cargar cambios de otros dispositivos
    if(!_guardandoAhora && (Date.now() - _ultimoGuardado) > 120000){
      _fbCargar().then(function(ok){
        if(ok){ repararFechasIngreso(); renderSection(activeSection); }
      });
    }
  } else {
    // App va a background — guardar local de inmediato
    if(_localVersion > 0) snapLocal();
    console.log('🌑 App en background — snapshot local guardado');
  }
});

// Cuando recupera conexión a internet
window.addEventListener('online', function(){
  console.log('🌐 Conexión recuperada');
  setSyncStatus('syncing');
  if(hayGuardadoPendiente() && !_guardandoAhora){
    toast('🌐 Conexión recuperada — sincronizando...','info');
    setTimeout(function(){
      _fbSave(DB).then(function(ok){
        if(ok){ desencolarGuardado(); actualizarIndicadorGuardado(true); toast('✅ Datos guardados','ok'); }
        else programarReintento();
      });
    }, 1000); // pequeña espera para que la conexión estabilice
  }
});

// Cuando pierde conexión
window.addEventListener('offline', function(){
  console.log('📵 Sin conexión');
  setSyncStatus('error');
  toast('📵 Sin conexión — cambios guardados localmente','info');
});

// Antes de cerrar o navegar fuera — guardar todo
window.addEventListener('pagehide', function(){
  if(_localVersion > 0){
    snapLocal();
    // Intento final con keepalive=true (el único que funciona en pagehide)
    if(hayGuardadoPendiente()){
      const sinFotos = {...DB, alumnos: DB.alumnos?.map(a=>({...a,foto:null})), _version: _localVersion};
      const payload = JSON.stringify({fields:{data:{stringValue:JSON.stringify(sinFotos)}}});
      navigator.sendBeacon
        ? fetch(`${FB_URL}?key=${FB_KEY}&updateMask.fieldPaths=data`, {
            method:'PATCH', headers:{'Content-Type':'application/json'},
            body: payload, keepalive: true
          }).catch(()=>{})
        : null;
    }
  }
});

// También beforeunload como respaldo
window.addEventListener('beforeunload', function(){
  if(_localVersion > 0) snapLocal();
});

// Arrancar
if(checkSession()){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.visibility='visible';
  init();
} else {
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('app').style.visibility='hidden';
  document.getElementById('login-email').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });
}
