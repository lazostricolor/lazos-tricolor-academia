/* ═══════════════════════════════════════════════════════════
   navegacion.js
   Sidebar, cambio de sección y navegación de meses
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== NAVEGACION =====================
function showSection(name){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  document.getElementById('sec-'+name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b=>{
    if(b.textContent.toLowerCase().includes(name.substring(0,5))) b.classList.add('active');
  });
  activeSection=name;
  const titles={dashboard:'Dashboard',alumnos:'Alumnas',pagos:'Mensualidades',asistencias:'Asistencias',profesores:'Profesores',finanzas:'Finanzas',presentaciones:'Presentaciones',archivo:'Archivo',config:'Configuración',preinscripciones:'📥 Preinscripciones',planificador:'📅 Planificador',gastos:'🧾 Gastos Varios',ingresos:'💰 Otros Ingresos',recaudos:'🎯 Recaudos',rifas:'🎟️ Rifas'};
  document.getElementById('header-title').innerHTML=titles[name]||name;
  closeSidebar();
  renderSection(name);
}
function renderSection(name){
  if(name==='dashboard') renderDashboard();
  else if(name==='alumnos') renderAlumnos();
  else if(name==='pagos') renderPagos();
  else if(name==='asistencias') renderAsistencias();
  else if(name==='profesores') renderProfesores();
  else if(name==='finanzas') renderFinanzas();
  else if(name==='presentaciones') renderPresentaciones();
  else if(name==='archivo') renderArchivo();
  else if(name==='config') renderConfig();
  else if(name==='planificador'){ renderPlanificador(); }
  else if(name==='gastos'){ renderGastosV(); }
  else if(name==='ingresos'){ renderOtrosIngresos(); }
  else if(name==='recaudos'){ renderRecaudos(); }
  else if(name==='rifas'){ renderRifas(); }
  else if(name==='preinscripciones'){ cargarPreinscripciones(); }
}
function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

// ===================== CAMBIAR MES =====================
function cambiarMes(seccion,delta){
  if(!mesSec[seccion]) mesSec[seccion]=getMesHoy();
  mesSec[seccion]=sumarMes(mesSec[seccion],delta);
  const labelMap={dash:'dash-mes-label',alumnos:'alumnos-mes-label',pagos:'pagos-mes-label',
    asist:'asist-mes-label',fin:'fin-mes-label',gastos:'gastos-mes-label',ingresos:'ingresos-mes-label'};
  const el=document.getElementById(labelMap[seccion]);
  if(el) el.textContent=mesLabel(mesSec[seccion]);
  if(seccion==='dash') renderDashboard();
  else if(seccion==='alumnos') renderAlumnos();
  else if(seccion==='pagos') renderPagos();
  else if(seccion==='asist') renderAsistencias();
  else if(seccion==='fin') renderFinanzas();
  else if(seccion==='gastos') renderGastosV();
  else if(seccion==='ingresos') renderOtrosIngresos();
}
function cambiarSemana(d){ semanaOfs+=d; renderProfesores(); }
