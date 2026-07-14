/* ═══════════════════════════════════════════════════════════
   ingresos.js
   Otros ingresos (donaciones, ventas, patrocinios)
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== OTROS INGRESOS =====================
let editIngresoId = null;

function totalOtrosIngresosMes(mk){
  return (DB.otrosIngresos||[]).filter(g=>g.mes===mk).reduce((s,g)=>s+Number(g.monto),0);
}

function abrirModalIngreso(id=null){
  editIngresoId = id;
  const hoy = getHoyReal();
  const horaStr = hoy.getHours().toString().padStart(2,'0')+':'+hoy.getMinutes().toString().padStart(2,'0');
  if(id){
    const g = (DB.otrosIngresos||[]).find(x=>x.id===id);
    if(!g) return;
    document.getElementById('modal-ingreso-title').textContent = 'Editar Ingreso';
    document.getElementById('ing-concepto').value = g.concepto;
    document.getElementById('ing-fecha').value    = g.fecha;
    document.getElementById('ing-hora').value     = g.hora||'';
    document.getElementById('ing-monto').value    = g.monto;
    document.getElementById('ing-cat').value      = g.cat||'Otro';
    document.getElementById('ing-nota').value     = g.nota||'';
  } else {
    document.getElementById('modal-ingreso-title').textContent = 'Nuevo Ingreso';
    document.getElementById('ing-concepto').value = '';
    document.getElementById('ing-fecha').value    = dateStr(hoy);
    document.getElementById('ing-hora').value     = horaStr;
    document.getElementById('ing-monto').value    = '';
    document.getElementById('ing-cat').value      = 'Donación';
    document.getElementById('ing-nota').value     = '';
  }
  abrirModal('modal-ingreso');
}

function guardarIngreso(){
  const concepto = document.getElementById('ing-concepto').value.trim();
  const fecha    = document.getElementById('ing-fecha').value;
  const monto    = Number(document.getElementById('ing-monto').value);
  if(!concepto||!fecha||!monto){ toast('Concepto, fecha y monto son obligatorios','err'); return; }
  if(!DB.otrosIngresos) DB.otrosIngresos=[];
  const g = {
    id:      editIngresoId || String(Date.now()),
    concepto, fecha,
    hora:    document.getElementById('ing-hora').value||'',
    monto,
    cat:     document.getElementById('ing-cat').value,
    nota:    document.getElementById('ing-nota').value.trim(),
    mes:     fecha.substring(0,7)
  };
  if(editIngresoId){
    const idx = DB.otrosIngresos.findIndex(x=>x.id===editIngresoId);
    if(idx>=0) DB.otrosIngresos[idx]=g;
  } else {
    DB.otrosIngresos.push(g);
  }
  tsSeccion('otrosIngresos');
  DB._ts_otrosIngresos = Date.now();
  snapLocal();
  cerrarModal('modal-ingreso');
  renderOtrosIngresos();
  toast('⏳ Guardando...');
  _fbSave(DB).then(ok=>{
    if(ok){ desencolarGuardado(); _ultimoGuardado=Date.now(); toast('✅ Ingreso guardado'); }
    else { encolarGuardado(); programarReintento(); toast('⚠️ Guardado local — reintentando...','info'); }
  });
}

function eliminarIngreso(id){
  if(!confirm('¿Eliminar este ingreso?')) return;
  DB.otrosIngresos=(DB.otrosIngresos||[]).filter(g=>g.id!==id);
  tsSeccion('otrosIngresos');
  DB._ts_otrosIngresos = Date.now();
  snapLocal();
  renderOtrosIngresos();
  _fbSave(DB).then(ok=>{
    if(ok){ desencolarGuardado(); _ultimoGuardado=Date.now(); }
    else { encolarGuardado(); programarReintento(); }
  });
  toast('Ingreso eliminado');
}

function renderOtrosIngresos(){
  const mk = mesSec.ingresos||getMesHoy();
  document.getElementById('ingresos-mes-label').textContent = mesLabel(mk);
  const catFiltro = document.getElementById('ingresos-cat-filtro')?.value||'';
  const todos = (DB.otrosIngresos||[]).filter(g=>g.mes===mk);
  const lista = catFiltro ? todos.filter(g=>g.cat===catFiltro) : todos;
  lista.sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora));

  const totalMes = todos.reduce((s,g)=>s+Number(g.monto),0);
  const catTotales = {};
  todos.forEach(g=>{ catTotales[g.cat]=(catTotales[g.cat]||0)+Number(g.monto); });
  const catMax = Object.entries(catTotales).sort((a,b)=>b[1]-a[1])[0];

  document.getElementById('ingresos-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:rgba(26,160,83,.12)">💰</div>
      <div class="stat-body">
        <div class="stat-label">Total otros ingresos</div>
        <div class="stat-val" style="color:var(--success)">$${totalMes.toLocaleString('es-CO')}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:rgba(58,87,232,.12)">📋</div>
      <div class="stat-body">
        <div class="stat-label">Registros del mes</div>
        <div class="stat-val">${todos.length}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:rgba(201,168,0,.12)">📊</div>
      <div class="stat-body">
        <div class="stat-label">Mayor fuente</div>
        <div class="stat-val" style="font-size:14px">${catMax?catMax[0]+' ($'+Number(catMax[1]).toLocaleString('es-CO')+')':'—'}</div>
      </div>
    </div>
  `;

  // Gráfico
  const chartDiv = document.getElementById('ingresos-chart');
  const elOI = document.getElementById('ch-ingresos-cat');
  if(elOI&&elOI._ch){elOI._ch.destroy();elOI._ch=null;}
  if(Object.keys(catTotales).length>0){
    chartDiv.innerHTML='<div class="chart-card"><h4>Ingresos por categoría — '+mesLabel(mk)+'</h4><canvas id="ch-ingresos-cat" style="max-height:180px"></canvas></div>';
    setTimeout(()=>{
      const el=document.getElementById('ch-ingresos-cat');
      if(!el) return;
      el._ch=new Chart(el,{type:'doughnut',
        data:{labels:Object.keys(catTotales),
          datasets:[{data:Object.values(catTotales),
            backgroundColor:['rgba(26,160,83,.8)','rgba(58,87,232,.7)','rgba(201,168,0,.7)','rgba(214,0,106,.7)','rgba(0,119,182,.7)','rgba(100,100,100,.5)'],
            borderWidth:2,borderColor:'#fff'}]},
        options:{responsive:true,maintainAspectRatio:false,
          plugins:{legend:{position:'right',labels:{color:'#8a92a6',font:{size:11},boxWidth:12,padding:8}},
          tooltip:{callbacks:{label:ctx=>' $'+Number(ctx.raw).toLocaleString('es-CO')}}}}
      });
    },80);
  } else {
    chartDiv.innerHTML='';
  }

  // Tabla
  const catIconos={Donación:'🎁',Evento:'🎭',Venta:'🛍️',Patrocinio:'🤝',Subsidio:'🏛️',Otro:'📌'};
  if(!lista.length){
    document.getElementById('ingresos-tabla').innerHTML=
      '<p style="text-align:center;color:var(--text2);padding:40px">Sin otros ingresos en este mes</p>';
    return;
  }
  document.getElementById('ingresos-tabla').innerHTML=`
    <table>
      <thead><tr>
        <th>Fecha</th><th>Hora</th><th>Concepto</th><th>Categoría</th>
        <th style="text-align:right">Monto</th><th></th>
      </tr></thead>
      <tbody>
        ${lista.map(g=>`<tr>
          <td style="font-size:12px">${g.fecha}</td>
          <td style="font-size:12px;color:var(--text2)">${g.hora||'—'}</td>
          <td>
            <div style="font-weight:600">${g.concepto}</div>
            ${g.nota?'<div style="font-size:11px;color:var(--text2)">'+g.nota+'</div>':''}
          </td>
          <td><span class="badge badge-paid" style="font-size:10px">${catIconos[g.cat]||'📌'} ${g.cat}</span></td>
          <td style="text-align:right;font-weight:700;color:var(--success)">$${Number(g.monto).toLocaleString('es-CO')}</td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="abrirModalIngreso('${g.id}')">✏️</button>
              <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarIngreso('${g.id}')">🗑️</button>
            </div>
          </td>
        </tr>`).join('')}
        <tr style="background:var(--card2);font-weight:700">
          <td colspan="4" style="text-align:right;font-size:13px">Total:</td>
          <td style="text-align:right;color:var(--success)">$${lista.reduce((s,g)=>s+Number(g.monto),0).toLocaleString('es-CO')}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;
}
