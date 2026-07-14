/* ═══════════════════════════════════════════════════════════
   gastos.js
   Gastos varios por categoría
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== GASTOS VARIOS =====================
let editGastoVId = null;

function abrirModalGastoV(id=null){
  editGastoVId = id;
  const hoy = getHoyReal();
  if(id){
    const g = (DB.gastosV||[]).find(x=>x.id===id);
    if(!g) return;
    document.getElementById('modal-gasto-v-title').textContent = 'Editar Gasto';
    document.getElementById('gv-concepto').value = g.concepto;
    document.getElementById('gv-fecha').value    = g.fecha;
    document.getElementById('gv-hora').value     = g.hora||'';
    document.getElementById('gv-monto').value    = g.monto;
    document.getElementById('gv-cat').value      = g.cat||'Otro';
    document.getElementById('gv-nota').value     = g.nota||'';
  } else {
    document.getElementById('modal-gasto-v-title').textContent = 'Nuevo Gasto';
    document.getElementById('gv-concepto').value = '';
    document.getElementById('gv-fecha').value    = dateStr(hoy);
    document.getElementById('gv-hora').value     = hoy.getHours().toString().padStart(2,'0')+':'+hoy.getMinutes().toString().padStart(2,'0');
    document.getElementById('gv-monto').value    = '';
    document.getElementById('gv-cat').value      = 'Servicios';
    document.getElementById('gv-nota').value     = '';
  }
  abrirModal('modal-gasto-v');
}

function guardarGastoV(){
  const concepto = document.getElementById('gv-concepto').value.trim();
  const fecha    = document.getElementById('gv-fecha').value;
  const monto    = Number(document.getElementById('gv-monto').value);
  if(!concepto||!fecha||!monto){ toast('Concepto, fecha y monto son obligatorios','err'); return; }
  if(!DB.gastosV) DB.gastosV=[];
  const g = {
    id:      editGastoVId || String(Date.now()),
    concepto, fecha,
    hora:    document.getElementById('gv-hora').value||'',
    monto,
    cat:     document.getElementById('gv-cat').value,
    nota:    document.getElementById('gv-nota').value.trim(),
    mes:     fecha.substring(0,7)
  };
  if(editGastoVId){
    const idx = DB.gastosV.findIndex(x=>x.id===editGastoVId);
    if(idx>=0) DB.gastosV[idx]=g;
  } else {
    DB.gastosV.push(g);
  }
  tsSeccion('gastosV');
  DB._ts_gastosV = Date.now(); // asegurar que Firebase guarda el timestamp
  snapLocal();
  cerrarModal('modal-gasto-v');
  renderGastosV();
  toast('⏳ Guardando...');
  _fbSave(DB).then(ok=>{
    if(ok){
      desencolarGuardado();
      _ultimoGuardado = Date.now();
      toast('✅ Gasto guardado');
    } else {
      encolarGuardado();
      programarReintento();
      toast('⚠️ Guardado local — reintentando...','info');
    }
  });
}

function eliminarGastoV(id){
  if(!confirm('¿Eliminar este gasto?')) return;
  DB.gastosV=(DB.gastosV||[]).filter(g=>g.id!==id);
  tsSeccion('gastosV');
  snapLocal();
  renderGastosV();
  _fbSave(DB).then(ok=>{
    if(ok){ desencolarGuardado(); _ultimoGuardado=Date.now(); }
    else { encolarGuardado(); programarReintento(); }
  });
  toast('Gasto eliminado');
}

function renderGastosV(){
  const mk = mesSec.gastos||getMesHoy();
  document.getElementById('gastos-mes-label').textContent = mesLabel(mk);
  const catFiltro = document.getElementById('gastos-cat-filtro')?.value||'';
  const todos = (DB.gastosV||[]).filter(g=>g.mes===mk);
  const lista = catFiltro ? todos.filter(g=>g.cat===catFiltro) : todos;
  lista.sort((a,b)=>((b.fecha+b.hora)||(b.fecha)).localeCompare((a.fecha+a.hora)||(a.fecha)));

  // Stats
  const totalMes = todos.reduce((s,g)=>s+Number(g.monto),0);
  const catTotales = {};
  todos.forEach(g=>{ catTotales[g.cat]=(catTotales[g.cat]||0)+Number(g.monto); });
  const catMax = Object.entries(catTotales).sort((a,b)=>b[1]-a[1])[0];

  document.getElementById('gastos-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:rgba(176,16,32,.1)">🧾</div>
      <div class="stat-body">
        <div class="stat-label">Total gastos del mes</div>
        <div class="stat-val" style="color:var(--danger)">$${totalMes.toLocaleString('es-CO')}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:rgba(58,87,232,.1)">📋</div>
      <div class="stat-body">
        <div class="stat-label">Registros del mes</div>
        <div class="stat-val">${todos.length}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:rgba(201,168,0,.1)">📊</div>
      <div class="stat-body">
        <div class="stat-label">Mayor categoría</div>
        <div class="stat-val" style="font-size:14px">${catMax?catMax[0]+' ($'+Number(catMax[1]).toLocaleString('es-CO')+')':'—'}</div>
      </div>
    </div>
  `;

  // Gráfico por categoría
  const chartDiv = document.getElementById('gastos-chart');
  const elGV = document.getElementById('ch-gastos-cat');
  if(elGV&&elGV._ch){elGV._ch.destroy();elGV._ch=null;}
  if(Object.keys(catTotales).length>0){
    chartDiv.innerHTML='<div class="chart-card"><h4>Gastos por categoría — '+mesLabel(mk)+'</h4><canvas id="ch-gastos-cat" style="max-height:180px"></canvas></div>';
    setTimeout(()=>{
      const el=document.getElementById('ch-gastos-cat');
      if(!el) return;
      const tc='#8a92a6';
      el._ch=new Chart(el,{type:'doughnut',
        data:{labels:Object.keys(catTotales),
          datasets:[{data:Object.values(catTotales),
            backgroundColor:['rgba(58,87,232,.7)','rgba(26,160,83,.7)','rgba(214,0,106,.7)','rgba(201,168,0,.7)','rgba(176,16,32,.7)','rgba(100,100,100,.5)'],
            borderWidth:2,borderColor:'#fff'}]},
        options:{responsive:true,maintainAspectRatio:false,
          plugins:{legend:{position:'right',labels:{color:tc,font:{size:11},boxWidth:12,padding:8}},
          tooltip:{callbacks:{label:ctx=>' $'+Number(ctx.raw).toLocaleString('es-CO')}}}}
      });
    },80);
  } else {
    chartDiv.innerHTML='';
  }

  // Tabla
  const catIconos={Servicios:'💡',Limpieza:'🧹',Vestuario:'👗',Logística:'📦',Imprevistos:'⚡',Otro:'📌'};
  if(!lista.length){
    document.getElementById('gastos-tabla').innerHTML=
      '<p style="text-align:center;color:var(--text2);padding:40px">Sin gastos registrados en este mes</p>';
    return;
  }
  document.getElementById('gastos-tabla').innerHTML=`
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
          <td><span class="badge badge-partial" style="font-size:10px">${catIconos[g.cat]||'📌'} ${g.cat}</span></td>
          <td style="text-align:right;font-weight:700;color:var(--danger)">$${Number(g.monto).toLocaleString('es-CO')}</td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="abrirModalGastoV('${g.id}')">✏️</button>
              <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarGastoV('${g.id}')">🗑️</button>
            </div>
          </td>
        </tr>`).join('')}
        <tr style="background:var(--card2);font-weight:700">
          <td colspan="4" style="text-align:right;font-size:13px">Total:</td>
          <td style="text-align:right;color:var(--danger)">$${lista.reduce((s,g)=>s+Number(g.monto),0).toLocaleString('es-CO')}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;
}
