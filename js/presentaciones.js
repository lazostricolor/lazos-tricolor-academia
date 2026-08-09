/* ═══════════════════════════════════════════════════════════
   presentaciones.js
   Presentaciones y elenco participante
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== PRESENTACIONES =====================
function renderPresentaciones(){
  const lista=DB.presentaciones.sort((a,b)=>b.fecha?.localeCompare(a.fecha||'')||0);

  const añoActual=getHoyReal().getFullYear();
  const mesesNom=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const porMes=Array(12).fill(0);
  DB.presentaciones.filter(p=>p.fecha&&p.fecha.startsWith(String(añoActual))).forEach(p=>{
    const m=parseInt(p.fecha.split('-')[1])-1;
    if(m>=0&&m<12) porMes[m]++;
  });
  const maxMes=Math.max(...porMes);
  const mesMasActivo=porMes.indexOf(maxMes);

  const top5=DB.presentaciones
    .filter(p=>((p.elenco&&p.elenco.length)||(p.alumnas||[]).length)>0)
    .map(p=>({...p,asistentes:(p.elenco&&p.elenco.length)||(p.alumnas||[]).length}))
    .sort((a,b)=>b.asistentes-a.asistentes).slice(0,5); // cuenta retiradas también

  ['ch-pres-meses'].forEach(id=>{const el=document.getElementById(id);if(el&&el._ch){el._ch.destroy();el._ch=null;}});

  // Top 5 HTML — sin template literals anidados
  const cols=['#c9a800','#8a92a6','#c95000','var(--primary)','var(--success)'];
  let top5HTML='';
  if(top5.length){
    top5.forEach((p,i)=>{
      const pct=DB.alumnos.length?Math.round(p.asistentes/DB.alumnos.length*100):0;
      top5HTML+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
        +'<span style="font-size:14px;font-weight:800;color:'+cols[i]+';min-width:18px">'+(i+1)+'</span>'
        +'<div style="flex:1;min-width:0">'
          +'<div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+p.titulo+'</div>'
          +'<div style="height:5px;background:var(--card2);border-radius:3px;margin-top:3px">'
            +'<div style="height:100%;width:'+pct+'%;background:'+cols[i]+';border-radius:3px"></div>'
          +'</div>'
        +'</div>'
        +'<span style="font-size:12px;font-weight:800;color:'+cols[i]+';min-width:24px;text-align:right">'+p.asistentes+'</span>'
      +'</div>';
    });
  } else {
    top5HTML='<p style="font-size:12px;color:var(--text2);text-align:center;margin-top:20px">Sin datos de asistencia aún</p>';
  }

  const etiquetaMes=maxMes>0?' <span style="font-size:11px;font-weight:400;color:var(--text2)">· Más activo: <strong style=\'color:var(--col)\'>'+mesesNom[mesMasActivo]+'</strong> ('+maxMes+')</span>':'';

  const chartsHTML='<div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:24px">'
    +'<div class="chart-card">'
      +'<h4>📊 Presentaciones por mes — '+añoActual+etiquetaMes+'</h4>'
      +'<canvas id="ch-pres-meses" style="max-height:200px"></canvas>'
    +'</div>'
    +'<div class="chart-card">'
      +'<h4>🏆 Mayor asistencia</h4>'
      +top5HTML
    +'</div>'
  +'</div>';

  let html=lista.map(ev=>{
    // El elenco guardado (nombre+categoría) es la fuente de verdad y conserva a las retiradas.
    // Para presentaciones viejas sin elenco guardado, reconstruir desde ids (retrocompatible).
    let elenco = Array.isArray(ev.elenco) && ev.elenco.length
      ? ev.elenco
      : todosLosAlumnos().filter(a=>(ev.alumnas||[]).includes(a.id)).map(a=>({id:a.id,nombre:a.nombre,categoria:a.categoria}));
    const asistentes=elenco.length;
    const total=DB.alumnos.length;
    const pct=total?Math.round(asistentes/total*100):0;
    const catEtiqueta = ev.categoria ? '<span class="badge" style="background:var(--card2);color:var(--text2);font-size:10px;margin-left:6px">'+ev.categoria+'</span>' : '';
    return'<div class="pres-card">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">'
        +'<div>'
          +'<h4>'+ev.titulo+catEtiqueta+'</h4>'
          +'<div class="meta">📅 '+(ev.fecha||'—')+(ev.hora?' · 🕐 '+ev.hora:'')+(ev.lugar?' · 📍 '+ev.lugar:'')+'</div>'
          +(ev.descripcion?'<p style="font-size:12px;color:var(--muted);margin-bottom:8px">'+ev.descripcion+'</p>':'')
        +'</div>'
        +'<div style="display:flex;gap:6px">'
          +'<button class="btn btn-ghost btn-sm btn-icon" onclick="abrirModalPresentacion('+lista.indexOf(ev)+')">✏️</button>'
          +'<button class="btn btn-danger btn-sm btn-icon" onclick="eliminarPresentacion('+DB.presentaciones.indexOf(ev)+')">🗑️</button>'
        +'</div>'
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
        +'<span style="font-size:12px;color:var(--muted)">'+asistentes+' alumnas · '+pct+'% del elenco</span>'
        +'<div style="flex:1;height:5px;background:var(--card2);border-radius:3px">'
          +'<div style="height:100%;width:'+pct+'%;background:var(--primary);border-radius:3px"></div>'
        +'</div>'
      +'</div>'
      +'<div class="pres-alumnas">'+elenco.map(function(a){return '<span class="badge badge-paid" style="font-size:10px">'+String(a.nombre||'').split(' ')[0]+'</span>';}).join('')+'</div>'
    +'</div>';
  }).join('')||'<div style="text-align:center;color:var(--muted);padding:40px"><div style="font-size:48px;margin-bottom:12px">🎭</div>Sin presentaciones registradas</div>';

  document.getElementById('pres-list').innerHTML=chartsHTML+html;

  setTimeout(()=>{
    const el=document.getElementById('ch-pres-meses');
    if(!el) return;
    const tc='#8a92a6',gc='rgba(0,0,0,.06)';
    el._ch=new Chart(el,{type:'bar',
      data:{labels:mesesNom,datasets:[{label:'Presentaciones',data:porMes,
        backgroundColor:porMes.map((v,i)=>i===mesMasActivo&&v>0?'rgba(201,168,0,.9)':'rgba(58,87,232,.65)'),
        borderRadius:5,borderSkipped:false}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+ctx.raw}}},
        scales:{x:{ticks:{color:tc,font:{size:10}},grid:{color:gc}},
          y:{ticks:{color:tc,font:{size:10},stepSize:1},grid:{color:gc},beginAtZero:true}}}
    });
  },80);
}
function abrirModalPresentacion(idx=null){
  editPresId=idx;
  document.getElementById('modal-pres-title').textContent=idx!==null?'Editar Presentación':'Nueva Presentación';
  const filtro=document.getElementById('ev-catFiltro'); if(filtro) filtro.value='';
  if(idx!==null){
    const ev=DB.presentaciones[idx];
    document.getElementById('ev-titulo').value=ev.titulo||'';
    document.getElementById('ev-fecha').value=ev.fecha||'';
    document.getElementById('ev-hora').value=ev.hora||'';
    document.getElementById('ev-lugar').value=ev.lugar||'';
    document.getElementById('ev-desc').value=ev.descripcion||'';
    _elencoPreseleccion = ev.alumnas||[];
  } else {
    ['ev-titulo','ev-fecha','ev-hora','ev-lugar','ev-desc'].forEach(id=>{document.getElementById(id).value='';});
    _elencoPreseleccion = [];
  }
  _renderElencoCheck();
  abrirModal('modal-presentacion');
}

// IDs preseleccionados al abrir el modal (se conservan al cambiar de filtro)
let _elencoPreseleccion = [];

// Dibuja la lista de checkboxes del elenco, respetando el filtro de categoría.
// SOLO alumnas activas para elegir; las retiradas ya no aparecen para presentaciones nuevas.
// Pero si al editar una presentación había una alumna ya retirada marcada, se conserva su marca.
function _renderElencoCheck(){
  const filtro = (document.getElementById('ev-catFiltro')||{}).value || '';
  // Capturar el estado actual de los checks ya dibujados (para no perder selección al filtrar)
  const marcadosAhora = {};
  document.querySelectorAll('#ev-alumnas-check input[type=checkbox]').forEach(function(chk){
    marcadosAhora[chk.value] = chk.checked;
  });
  const estaMarcado = function(id){
    if(id in marcadosAhora) return marcadosAhora[id];
    return _elencoPreseleccion.map(String).includes(String(id));
  };

  let activas = DB.alumnos.slice();
  if(filtro) activas = activas.filter(function(a){ return a.categoria===filtro; });

  // Alumnas retiradas que YA estaban en el elenco (al editar) — se muestran para no perderlas
  const retiradasEnElenco = (DB.alumnosRetirados||[]).filter(function(a){
    return _elencoPreseleccion.map(String).includes(String(a.id)) && (!filtro || a.categoria===filtro);
  });

  const html = activas.map(function(a){
    return '<div class="check-group"><input type="checkbox" id="ev-a-'+a.id+'" value="'+a.id+'"'+(estaMarcado(a.id)?' checked':'')+'>'
      +'<label for="ev-a-'+a.id+'">'+a.nombre+' <span style="color:var(--muted);font-size:11px">('+a.categoria+')</span></label></div>';
  }).join('')
  + retiradasEnElenco.map(function(a){
    return '<div class="check-group"><input type="checkbox" id="ev-a-'+a.id+'" value="'+a.id+'"'+(estaMarcado(a.id)?' checked':'')+'>'
      +'<label for="ev-a-'+a.id+'">'+a.nombre+' <span style="color:var(--danger);font-size:11px">(retirada)</span></label></div>';
  }).join('');

  const cont = document.getElementById('ev-alumnas-check');
  cont.innerHTML = html || '<p style="font-size:12px;color:var(--muted);text-align:center;padding:10px">Sin alumnas en esta categoría</p>';
  cont.onclick = function(e){ if(e.target && e.target.type==='checkbox') _actualizarConteoElenco(); };
  _actualizarConteoElenco();
}

function filtrarElencoPres(){ _renderElencoCheck(); }

function _actualizarConteoElenco(){
  const n = document.querySelectorAll('#ev-alumnas-check input[type=checkbox]:checked').length;
  const el = document.getElementById('ev-elenco-conteo');
  if(el) el.textContent = n ? '· '+n+' seleccionada'+(n>1?'s':'') : '';
}
function guardarPresentacion(){
  const titulo=document.getElementById('ev-titulo').value.trim();
  if(!titulo){toast('El título es obligatorio','err');return;}
  // Elenco: guardamos los ids (para vínculos) Y una foto de nombre+categoría como TEXTO.
  // Así, si una alumna se retira después, su participación queda registrada para siempre.
  const seleccion = todosLosAlumnos().filter(a=>document.getElementById('ev-a-'+a.id)?.checked);
  const alumnas = seleccion.map(a=>a.id);
  const elenco  = seleccion.map(a=>({ id:a.id, nombre:a.nombre, categoria:a.categoria }));
  const catFiltro = (document.getElementById('ev-catFiltro')||{}).value || '';
  const ev={titulo,fecha:document.getElementById('ev-fecha').value,hora:document.getElementById('ev-hora').value,lugar:document.getElementById('ev-lugar').value,descripcion:document.getElementById('ev-desc').value,alumnas,elenco,categoria:catFiltro};
  // id estable para poder vincular el uso de vestuario
  if(editPresId!==null){
    ev.id = DB.presentaciones[editPresId] && DB.presentaciones[editPresId].id
          ? DB.presentaciones[editPresId].id : 'pres_'+Date.now();
    ev._editTs = Date.now();
    DB.presentaciones[editPresId]=Object.assign(DB.presentaciones[editPresId]||{}, ev);
  }
  else { ev.id = 'pres_'+Date.now(); ev._editTs = Date.now(); DB.presentaciones.push(ev); }
  tsSeccion('presentaciones'); DB._ts_presentaciones=Date.now();
  cerrarModal('modal-presentacion');
  renderPresentaciones();
  toast('⏳ Guardando...');
  saveAll().then(function(ok){ toast(ok?'✅ Presentación guardada':'⚠️ Guardado local — reintentando...', ok?'ok':'info'); });
}
function eliminarPresentacion(idx){
  if(!confirm2('¿Eliminar esta presentación?')) return;
  DB.presentaciones.splice(idx,1);
  saveBackground(); renderPresentaciones(); toast('Presentación eliminada');
}
