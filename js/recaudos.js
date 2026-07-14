/* ═══════════════════════════════════════════════════════════
   recaudos.js
   Recaudos para actividades y aportes por alumna
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== RECAUDOS =====================
let editRecaudoId = null;
let aporteRecaudoId = null;
let aporteAlumnaId = null;

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
  } else {
    document.getElementById('modal-recaudo-title').textContent = 'Nuevo Recaudo';
    document.getElementById('rec-nombre').value    = '';
    document.getElementById('rec-inicio').value    = hoy;
    document.getElementById('rec-cierre').value    = '';
    document.getElementById('rec-meta-alumna').value = '';
    document.getElementById('rec-meta-total').value  = '';
    document.getElementById('rec-desc').value      = '';
    document.getElementById('rec-cat').value       = 'Vestuario';
  }
  abrirModal('modal-recaudo');
}

function guardarRecaudo(){
  const nombre = document.getElementById('rec-nombre').value.trim();
  const inicio = document.getElementById('rec-inicio').value;
  const cierre = document.getElementById('rec-cierre').value;
  if(!nombre||!inicio||!cierre){ toast('Nombre, inicio y cierre son obligatorios','err'); return; }
  if(!DB.recaudos) DB.recaudos=[];
  const metaAlumna = Number(document.getElementById('rec-meta-alumna').value)||0;
  const alumnasTotales = DB.alumnos.length;
  const metaTotal = Number(document.getElementById('rec-meta-total').value)||
    (metaAlumna>0 ? metaAlumna*alumnasTotales : 0);

  if(editRecaudoId){
    const idx = DB.recaudos.findIndex(function(x){return x.id===editRecaudoId;});
    if(idx>=0){
      DB.recaudos[idx] = Object.assign(DB.recaudos[idx],{
        nombre,inicio,cierre,metaAlumna,metaTotal,
        desc:document.getElementById('rec-desc').value.trim(),
        cat:document.getElementById('rec-cat').value
      });
    }
  } else {
    // Inicializar aportes vacíos para todas las alumnas activas
    const aportes = {};
    DB.alumnos.forEach(function(a){ aportes[String(a.id)]={monto:0,fecha:'',nota:'',pagado:false}; });
    DB.recaudos.push({
      id:String(Date.now()),
      nombre,inicio,cierre,metaAlumna,metaTotal,
      desc:document.getElementById('rec-desc').value.trim(),
      cat:document.getElementById('rec-cat').value,
      aportes:aportes
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
  const alumna = DB.alumnos.find(function(a){ return a.id===Number(alumnaId)||String(a.id)===String(alumnaId); });
  if(!rec||!alumna){ toast('Error: recaudo o alumna no encontrada','err'); return; }
  const aporte = (rec.aportes&&(rec.aportes[aporteAlumnaId]||rec.aportes[Number(alumnaId)]))||{monto:0,fecha:'',nota:''};
  const tieneAporte = aporte.monto && Number(aporte.monto) > 0;
  document.getElementById('modal-aporte-title').textContent =
    tieneAporte ? '✏️ Modificar aporte de '+alumna.nombre.split(' ')[0]
                : '💰 Registrar aporte de '+alumna.nombre.split(' ')[0];
  document.getElementById('aporte-alumna-info').innerHTML =
    '<strong>'+alumna.nombre+'</strong><br>'
    +'Recaudo: <strong>'+rec.nombre+'</strong><br>'
    +(rec.metaAlumna>0?'Aporte sugerido: <strong style="color:var(--primary)">$'+rec.metaAlumna.toLocaleString('es-CO')+'</strong>':'')
    +(tieneAporte?'<br><span style="color:var(--success);font-size:12px">✅ Aporte actual: $'+Number(aporte.monto).toLocaleString('es-CO')+'</span>':'');
  document.getElementById('aporte-monto').value = tieneAporte ? aporte.monto : '';
  document.getElementById('aporte-fecha').value = aporte.fecha||dateStr(getHoyReal());
  document.getElementById('aporte-nota').value  = aporte.nota||'';
  // Mostrar botón borrar solo si ya tiene aporte
  const btnBorrar = document.getElementById('btn-borrar-aporte');
  if(btnBorrar) btnBorrar.style.display = tieneAporte ? 'inline-flex' : 'none';
  abrirModal('modal-aporte');
}

function borrarAporte(){
  if(!confirm('¿Borrar el aporte de esta alumna?')) return;
  const rec = (DB.recaudos||[]).find(function(r){return r.id===aporteRecaudoId;});
  if(!rec) return;
  if(rec.aportes) {
    rec.aportes[String(aporteAlumnaId)] = {monto:0,fecha:'',nota:'',pagado:false};
  }
  cerrarModal('modal-aporte');
  _saveRecaudos();
  renderRecaudos();
  toast('🗑️ Aporte eliminado');
}

function guardarAporte(){
  const monto = Number(document.getElementById('aporte-monto').value);
  if(!monto){ toast('Ingresa un monto','err'); return; }
  const rec = (DB.recaudos||[]).find(function(r){return r.id===aporteRecaudoId;});
  if(!rec) return;
  if(!rec.aportes) rec.aportes={};
  // Guardar con clave string (consistente con JS que usa objetos con keys string)
  rec.aportes[String(aporteAlumnaId)] = {
    monto:monto,
    fecha:document.getElementById('aporte-fecha').value,
    nota:document.getElementById('aporte-nota').value.trim(),
    pagado:monto>0
  };
  cerrarModal('modal-aporte');
  _saveRecaudos();
  renderRecaudos();
  toast('✅ Aporte registrado — $'+monto.toLocaleString('es-CO'));
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
  const catIconos={Vestuario:'👗',Transporte:'🚌',Accesorios:'💃',Escenografía:'🎭',Alimentación:'🍱',Otro:'📌'};

  const lista=[].concat(DB.recaudos).sort(function(a,b){
    var aV=a.cierre<hoy, bV=b.cierre<hoy;
    if(aV!==bV) return aV?1:-1;
    return a.cierre.localeCompare(b.cierre);
  });

  var html='';
  lista.forEach(function(rec){
    var vencido = rec.cierre < hoy;
    var aportes = rec.aportes||{};
    var alumnas = DB.alumnos;
    var totalRec=0, countPagaron=0;
    alumnas.forEach(function(a){
      var k=String(a.id);
      var ap=aportes[k]||aportes[a.id];
      if(ap&&Number(ap.monto)>0){ totalRec+=Number(ap.monto); countPagaron++; }
    });
    var metaTotal=Number(rec.metaTotal)||(rec.metaAlumna>0?Number(rec.metaAlumna)*alumnas.length:0);
    var pctTotal=metaTotal>0?Math.min(100,Math.round(totalRec/metaTotal*100)):0;
    var barColor=pctTotal>=100?'var(--success)':pctTotal>=60?'#f4a916':'var(--primary)';
    var badge=vencido
      ?'<span class="rec-badge vencido">⏰ Vencido</span>'
      :'<span class="rec-badge activo">✅ Activo</span>';

    // ID único para el canvas de este recaudo
    var canvasId = 'rec-chart-'+rec.id.replace(/[^a-z0-9]/gi,'_');

    var filasAlumnas='';
    alumnas.forEach(function(a){
      var k=String(a.id);
      var ap=aportes[k]||aportes[a.id]||{monto:0};
      var monto=Number(ap.monto)||0;
      var aportoPct=rec.metaAlumna>0?Math.min(100,Math.round(monto/Number(rec.metaAlumna)*100)):0;
      var apColor=monto>0?'var(--success)':'var(--card2)';
      var nombre=a.nombre.split(' ').slice(0,2).join(' ');
      filasAlumnas+='<div class="rec-alumna-row">'
        +'<span class="rec-alumna-nombre">'+nombre+'</span>'
        +(rec.metaAlumna>0?'<div class="rec-alumna-bar-wrap"><div class="rec-alumna-bar" style="width:'+aportoPct+'%;background:'+apColor+'"></div></div>':'')
        +'<span class="rec-alumna-monto">'+(monto>0?'$'+monto.toLocaleString('es-CO'):'—')+'</span>'
        +(ap.nota?'<span style="font-size:10px;color:var(--text2);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+ap.nota+'">'+ap.nota+'</span>':'')
        +'<button class="rec-alumna-btn rec-btn-aporte" data-rid="'+rec.id+'" data-aid="'+a.id+'">✏️</button>'
        +'</div>';
    });

    html+='<div class="rec-card">'
      // Header
      +'<div class="rec-card-header">'
        +'<div>'
          +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
            +'<span style="font-size:18px">'+(catIconos[rec.cat]||'📌')+'</span>'
            +'<span style="font-size:15px;font-weight:800">'+rec.nombre+'</span>'
            +badge
          +'</div>'
          +'<div style="font-size:12px;color:var(--text2)">📅 '+rec.inicio+' → '+rec.cierre+(rec.desc?' · '+rec.desc:'')+'</div>'
        +'</div>'
        +'<div style="display:flex;gap:6px">'
          +'<button class="btn btn-ghost btn-sm btn-icon rec-btn-editar" data-rid="'+rec.id+'">✏️</button>'
          +'<button class="btn btn-danger btn-sm btn-icon rec-btn-eliminar" data-rid="'+rec.id+'">🗑️</button>'
        +'</div>'
      +'</div>'
      // Body
      +'<div class="rec-card-body">'
        // Stats rápidas
        +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">'
          +'<div style="text-align:center;background:var(--card2);border-radius:10px;padding:10px">'
            +'<div style="font-size:10px;color:var(--text2);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Recaudado</div>'
            +'<div style="font-size:18px;font-weight:800;color:var(--success)">$'+totalRec.toLocaleString('es-CO')+'</div>'
          +'</div>'
          +(metaTotal>0
            ?'<div style="text-align:center;background:var(--card2);border-radius:10px;padding:10px">'
              +'<div style="font-size:10px;color:var(--text2);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Meta</div>'
              +'<div style="font-size:18px;font-weight:800">$'+metaTotal.toLocaleString('es-CO')+'</div>'
            +'</div>'
            :'<div></div>')
          +'<div style="text-align:center;background:var(--card2);border-radius:10px;padding:10px">'
            +'<div style="font-size:10px;color:var(--text2);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Participación</div>'
            +'<div style="font-size:18px;font-weight:800;color:var(--primary)">'+countPagaron+'/'+alumnas.length+'</div>'
          +'</div>'
        +'</div>'
        // Barra de progreso total
        +(metaTotal>0
          ?'<div style="margin-bottom:16px">'
            +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:4px">'
              +'<span>Progreso total</span><span style="font-weight:700;color:'+barColor+'">'+pctTotal+'%</span>'
            +'</div>'
            +'<div class="rec-progress-wrap"><div class="rec-progress-bar" style="width:'+pctTotal+'%;background:'+barColor+'"></div></div>'
          +'</div>'
          :'')
        // Layout: gráfico + tabla de alumnas lado a lado
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">'
          // Gráfico de barras horizontales por alumna
          +'<div>'
            +'<div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">📊 Aportes por alumna</div>'
            +'<div style="background:var(--card2);border-radius:10px;padding:12px">'
              +'<canvas id="'+canvasId+'" style="max-height:'+Math.min(alumnas.length*28+20,280)+'px"></canvas>'
            +'</div>'
          +'</div>'
          // Tabla de alumnas
          +'<div>'
            +'<div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">✏️ Registrar / modificar</div>'
            +'<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">'
              +'<div style="padding:4px 14px">'+filasAlumnas+'</div>'
            +'</div>'
          +'</div>'
        +'</div>'
      +'</div>'
    +'</div>';
  });

  document.getElementById('recaudos-lista').innerHTML=html;

  // Delegación de eventos
  document.getElementById('recaudos-lista').onclick = function(e){
    var btnAporte  = e.target.closest('.rec-btn-aporte');
    var btnEditar  = e.target.closest('.rec-btn-editar');
    var btnEliminar= e.target.closest('.rec-btn-eliminar');
    if(btnAporte){
      abrirModalAporte(btnAporte.dataset.rid, Number(btnAporte.dataset.aid));
    } else if(btnEditar){
      abrirModalRecaudo(btnEditar.dataset.rid);
    } else if(btnEliminar){
      eliminarRecaudo(btnEliminar.dataset.rid);
    }
  };

  // Renderizar gráficos de barras horizontales por recaudo
  setTimeout(function(){
    lista.forEach(function(rec){
      var canvasId = 'rec-chart-'+rec.id.replace(/[^a-z0-9]/gi,'_');
      var el = document.getElementById(canvasId);
      if(!el) return;
      if(el._ch){el._ch.destroy();el._ch=null;}
      var aportes = rec.aportes||{};
      var labels=[], datos=[], colores=[];
      DB.alumnos.forEach(function(a){
        var k=String(a.id);
        var ap=aportes[k]||aportes[a.id]||{monto:0};
        var monto=Number(ap.monto)||0;
        labels.push(a.nombre.split(' ').slice(0,2).join(' '));
        datos.push(monto);
        colores.push(monto>0?'rgba(26,160,83,.75)':'rgba(200,200,200,.4)');
      });
      var tc='#8a92a6';
      el._ch=new Chart(el,{type:'bar',
        data:{labels:labels,datasets:[{
          label:'Aporte',data:datos,
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
              label:function(ctx){return ' $'+Number(ctx.raw).toLocaleString('es-CO');}
            }}
          },
          scales:{
            x:{
              ticks:{color:tc,font:{size:9},callback:function(v){return '$'+Number(v/1000).toFixed(0)+'k';}},
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
