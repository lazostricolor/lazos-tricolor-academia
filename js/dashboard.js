/* ═══════════════════════════════════════════════════════════
   dashboard.js
   Dashboard: stats, donuts, torta de salud y gráficos
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== DASHBOARD =====================
function renderDashboard(){
  if(!mesSec.dash) return; // Esperar a que init() inicialice los meses
  const mk=mesSec.dash;
  document.getElementById('dash-mes-label').textContent=mesLabel(mk);
  const activas=getAlumnasMes(mk);
  let ing=0,pend=0,pagadasCnt=0;
  activas.forEach(a=>{
    const p=getPago(a.id,mk);
    const val=calcMensualidad(a,mk);
    const real=p.beca?Math.floor(val/2):val;
    if(p.pagado){ing+=real;pagadasCnt++;}
    else pend++;
  });
  ing+=totalOtrosIngresosMes(mk); // otros ingresos del mes
  const pct_pago=activas.length?Math.round(pagadasCnt/activas.length*100):0;

  // Asistencia promedio del mes
  let totalPres=0,totalDias=0;
  activas.forEach(a=>{
    const dias=getDiasClaseMes(a,mk);
    dias.forEach(d=>{
      totalDias++;
      const as=(DB.asistencias[a.id]&&DB.asistencias[a.id][d]);
      if(as==='P') totalPres++;
    });
  });
  const pct_asist=totalDias?Math.round(totalPres/totalDias*100):0;
  const salud=Math.round((pct_pago+pct_asist)/2); // balance se muestra por separado en el texto

  // Balance financiero — gastos totales vs ingresos
  const gastosTotal=totalGastosMes(mk);
  const pct_balance=ing>0?Math.min(100,Math.round(Math.max(0,(ing-gastosTotal)/ing*100))):0;

  // ── Indicadores adicionales para radar de salud ──
  // Ocupación: alumnas activas este mes vs máximo histórico
  const maxAlumnas=Math.max(DB.alumnos.length+(DB.alumnosRetirados||[]).length,1);
  const pct_ocupacion=Math.min(100,Math.round(activas.length/maxAlumnas*100));

  // Crecimiento: alumnas nuevas este mes vs retiradas (0-100)
  const nuevasEste=DB.alumnos.filter(a=>a.fechaIngreso&&a.fechaIngreso.substring(0,7)===mk).length;
  const retirasEste=(DB.alumnosRetirados||[]).filter(a=>a.fechaRetiro&&a.fechaRetiro.substring(0,7)===mk).length;
  const pct_crecimiento=Math.min(100,Math.max(0,50+((nuevasEste-retirasEste)*10)));

  // Profesores activos (25 por profe, máx 100)
  const pct_profesores=Math.min(100,DB.profesores.length*25);

  // Presentaciones del año (cada una vale 10 puntos, máx 100)
  const presAño=DB.presentaciones.filter(p=>p.fecha&&p.fecha.startsWith(mk.substring(0,4))).length;
  const pct_presentaciones=Math.min(100,presAño*10);

  // Diversificación de ingresos: otros ingresos vs total ingresos
  const otrosMes=totalOtrosIngresosMes(mk);
  const pct_diversif=ing>0?Math.min(100,Math.round(otrosMes/ing*100*3)):0; // x3 para amplificar

  // Días extra de ensayo este mes
  const extrasMes=(DB.extraDias&&DB.extraDias[mk])||[];
  const pct_extras=Math.min(100,extrasMes.length*20); // cada día extra vale 20 pts

  // Calcular alumnas totales en DB para referencia
  const totalDB=DB.alumnos.length;
  const esMesPasado=mk<getMesHoy();
  const esMesFuturo=mk>getMesHoy();
  const contextoMes=esMesPasado?'📅 Historial: '+mesLabel(mk):esMesFuturo?'🔮 Proyección: '+mesLabel(mk):'📅 Mes actual: '+mesLabel(mk);

  // Stats
  const porCobrar=activas.filter(a=>!getPago(a.id,mk).pagado).reduce((s,a)=>{const v=calcMensualidad(a,mk);return s+(getPago(a.id,mk).beca?Math.floor(v/2):v);},0);
  document.getElementById('dash-stats').innerHTML=`
    <div class="stat-card">
      <div class="stat-icon-wrap col">🎓</div>
      <div class="stat-body"><div class="stat-label">Alumnas Inscritas</div><div class="stat-val">${activas.length}</div><div class="stat-sub">de ${totalDB} · ${contextoMes}</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap suc">💰</div>
      <div class="stat-body">
        <div class="stat-label" style="display:flex;align-items:center;justify-content:space-between">
          Ingresos del Mes
          <button class="btn-ojo" onclick="toggleOjoIngresos()" id="btn-ojo-ing" title="Mostrar/ocultar">👁️</button>
        </div>
        <div class="stat-val" id="ing-valor">${formatCOP(ing)}</div>
        <div class="stat-sub" id="ing-sub">${pagadasCnt} pagadas · ${pend} pendientes</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap ven">${pend>0?'<span class="led-red"></span>':''}💳</div>
      <div class="stat-body"><div class="stat-label">Pagos Pendientes</div><div class="stat-val" style="color:${pend>0?'var(--danger)':'var(--success)'}">${pend}</div><div class="stat-sub">${formatCOP(porCobrar)} por cobrar</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap inf">👨‍🏫</div>
      <div class="stat-body"><div class="stat-label">Profesores</div><div class="stat-val">${DB.profesores.length}</div><div class="stat-sub">activos</div></div>
    </div>
  `;

  // Destruir donuts previos
  ['donut-pagos','donut-asist','donut-salud'].forEach(id=>{
    const el=document.getElementById(id);
    if(el&&el._ch){el._ch.destroy();el._ch=null;}
  });
  // Donuts
  const saludColor=salud>=70?'#1aa053':salud>=40?'#f4a916':'#c03221';
  document.getElementById('dash-donuts').innerHTML=`
    <div class="donut-card">
      <h4>💳 Pagos Recibidos</h4>
      <div class="donut-wrap"><canvas id="donut-pagos"></canvas><div class="donut-center"><span class="donut-pct" style="color:#1aa053">${pct_pago}%</span><span class="donut-sub">pagados</span></div></div>
      <p style="font-size:11px;color:var(--text2);margin-top:6px">${pagadasCnt} de ${activas.length} alumnas</p>
    </div>
    <div class="donut-card">
      <h4>📋 Asistencia Promedio</h4>
      <div class="donut-wrap"><canvas id="donut-asist"></canvas><div class="donut-center"><span class="donut-pct" style="color:#3a57e8">${pct_asist}%</span><span class="donut-sub">asistencia</span></div></div>
      <p style="font-size:11px;color:var(--text2);margin-top:6px">${totalPres} de ${totalDias} días</p>
    </div>
    <div class="donut-card" style="min-width:300px">
      <h4>🏥 Salud General</h4>
      <div style="position:relative;width:240px;height:240px;margin:0 auto">
        <canvas id="donut-salud"></canvas>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">
          <span id="salud-pct-txt" style="font-size:30px;font-weight:900">—</span>
          <span style="font-size:10px;color:var(--text2);font-weight:600">SALUD</span>
        </div>
      </div>
    </div>
  `;
  setTimeout(()=>{
    // Donut pagos
    const cp=document.getElementById('donut-pagos');
    if(cp){ cp._ch=new Chart(cp,{type:'doughnut',data:{datasets:[{data:[pct_pago,100-pct_pago],backgroundColor:['#1aa053','#e8f5ee'],borderWidth:0,hoverOffset:4}]},options:{cutout:'78%',plugins:{legend:{display:false},tooltip:{enabled:false}},animation:{duration:700}}}); }
    // Donut asistencia
    const ca=document.getElementById('donut-asist');
    if(ca){ ca._ch=new Chart(ca,{type:'doughnut',data:{datasets:[{data:[pct_asist,100-pct_asist],backgroundColor:['#3a57e8','#eef0fd'],borderWidth:0,hoverOffset:4}]},options:{cutout:'78%',plugins:{legend:{display:false},tooltip:{enabled:false}},animation:{duration:700}}}); }
    // TORTA — Salud General (8 indicadores)
    const cs=document.getElementById('donut-salud');
    if(cs){
      if(cs._ch){cs._ch.destroy();cs._ch=null;}
      const inds=[
        {l:'Pagos',          v:pct_pago,           c:'#1aa053'},
        {l:'Asistencia',     v:pct_asist,          c:'#3a57e8'},
        {l:'Balance',        v:pct_balance,        c:'#c98000'},
        {l:'Ocupación',      v:pct_ocupacion,      c:'#d6006a'},
        {l:'Crecimiento',    v:pct_crecimiento,    c:'#1a9900'},
        {l:'Profesores',     v:pct_profesores,     c:'#c95000'},
        {l:'Presentaciones', v:pct_presentaciones, c:'#c9a800'},
        {l:'Otros ingresos', v:pct_diversif,       c:'#0077b6'},
      ];
      const prom=Math.round(inds.reduce(function(s,i){return s+i.v;},0)/inds.length);
      const elS=document.getElementById('salud-pct-txt');
      if(elS){elS.textContent=prom+'%';elS.style.color=prom>=70?'#1aa053':prom>=40?'#f4a916':'#c03221';}
      cs._ch=new Chart(cs,{type:'doughnut',
        data:{
          labels:inds.map(function(i){return i.l+' ('+i.v+'%)';}),
          datasets:[{
            data:inds.map(function(i){return Math.max(i.v,2);}),
            backgroundColor:inds.map(function(i){return i.c+'cc';}),
            borderColor:inds.map(function(i){return i.c;}),
            borderWidth:2,hoverOffset:10
          }]
        },
        options:{responsive:true,maintainAspectRatio:true,cutout:'55%',
          plugins:{legend:{display:false},
            tooltip:{callbacks:{label:function(ctx){return ' '+ctx.label;}},
              backgroundColor:'rgba(30,41,59,.95)',padding:10,cornerRadius:8}},
          animation:{duration:800}}
      });
    }
  },80);

  // Charts
  renderDashCharts(mk,activas);

  // Restaurar estado del ojo si estaba oculto
  if(_ingOculto){
    const val=document.getElementById('ing-valor');
    const sub=document.getElementById('ing-sub');
    const btn=document.getElementById('btn-ojo-ing');
    if(val) val.classList.add('ing-oculto');
    if(sub) sub.classList.add('ing-oculto');
    if(btn) btn.textContent='🙈';
  }

  // Dist categorías
  const dist={};
  CATS.forEach(c=>dist[c]=0);
  activas.forEach(a=>dist[a.categoria]=(dist[a.categoria]||0)+1);
  const catColors={Infantil:'var(--inf)',Juvenil:'var(--juv)',Adulto:'var(--adu)','Adulto Mayor':'var(--adum)'};
  document.getElementById('dash-dist').innerHTML=CATS.map(c=>`
    <div class="dist-item">
      <div class="cat-num" style="color:${catColors[c]}">${dist[c]}</div>
      <div class="cat-name">${c}</div>
    </div>
  `).join('');

  // Pagos del mes con paginación
  renderDashPagos(mk,activas);
}
function buildDonut(id,pct,color){
  const canvas=document.getElementById(id);
  if(!canvas)return;
  if(canvas._chart)canvas._chart.destroy();
  canvas._chart=new Chart(canvas,{
    type:'doughnut',
    data:{datasets:[{data:[pct,100-pct],backgroundColor:[color,'rgba(255,255,255,0.05)'],borderWidth:0}]},
    options:{cutout:'75%',plugins:{legend:{display:false},tooltip:{enabled:false}},animation:{duration:600}}
  });
}
function renderDashCharts(mk,activas){
  const hoyMk = getMesHoy();
  const tc='#8a92a6', gc='rgba(0,0,0,.06)';
  const baseScales={
    x:{ticks:{color:tc,font:{size:9}},grid:{color:gc}},
    y:{ticks:{color:tc,font:{size:9}},grid:{color:gc},beginAtZero:true}
  };
  const baseLegend={position:'top',labels:{color:tc,font:{size:10},boxWidth:10,padding:8}};

  // ── Asistencia por semana — semanas del mes navegado ──
  const [y,m]=mk.split('-').map(Number);
  const primerDiaMes=new Date(y,m-1,1);
  const ultimoDiaMes=new Date(y,m,0);
  const semanas=[];
  const catDatasets={};
  CATS.forEach(c=>{catDatasets[c]=[];});

  // Dividir el mes en semanas (lunes a domingo)
  let cursor=new Date(primerDiaMes);
  // Retroceder al lunes de la semana que contiene el primer día
  const dow=cursor.getDay();
  cursor.setDate(cursor.getDate()-(dow===0?6:dow-1));

  // Datasets separados: días normales y días extra (para colorear diferente)
  const catDatasetsExtra={};
  CATS.forEach(c=>{catDatasetsExtra[c]=[];});

  while(cursor<=ultimoDiaMes){
    const wStart=new Date(cursor);
    const wEnd=new Date(cursor); wEnd.setDate(cursor.getDate()+6);
    const label=wStart.toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit'});
    semanas.push(label);
    const extrasMk=(DB.extraDias&&DB.extraDias[mk])||[];
    CATS.forEach(c=>{
      let presNorm=0,totNorm=0,presExtra=0,totExtra=0;
      activas.filter(a=>a.categoria===c).forEach(a=>{
        for(let d=new Date(wStart);d<=wEnd;d.setDate(d.getDate()+1)){
          if(d.getFullYear()===y&&d.getMonth()===m-1){
            const ds=dateStr(new Date(d));
            const esDiaFijo=DIAS_CLASE[c]&&DIAS_CLASE[c].includes(d.getDay());
            const esDiaExtra=extrasMk.some(function(e){
              const fecha=typeof e==='string'?e:e.fecha;
              const cats=typeof e==='string'?null:e.cats;
              return fecha===ds&&(!cats||cats.includes(c));
            });
            const asistio=DB.asistencias[a.id]&&DB.asistencias[a.id][ds]==='P';
            if(esDiaFijo){ totNorm++; if(asistio) presNorm++; }
            else if(esDiaExtra){ totExtra++; if(asistio) presExtra++; }
          }
        }
      });
      catDatasets[c].push(totNorm?Math.round(presNorm/totNorm*100):0);
      catDatasetsExtra[c].push(totExtra?Math.round(presExtra/totExtra*100):0);
    });
    cursor.setDate(cursor.getDate()+7);
  }

  // ── Pagos/Gastos: 6 meses centrados en mk ──
  const mesesBar=[];
  const mensualidadesBar=[],otrosIngBar=[],proyectadosBar=[],honorariosBar=[],variosBar=[];
  for(let i=5;i>=0;i--){
    const key=sumarMes(mk,-i);
    mesesBar.push(mesLabel(key).substring(0,3)+' '+key.substring(2,4));
    const als=getAlumnasMes(key);
    let mens=0,proy=0;
    als.forEach(a=>{
      const p=getPago(a.id,key);
      const val=calcMensualidad(a,key);
      const real=p.beca?Math.floor(val/2):val;
      proy+=real;
      if(p.pagado) mens+=real;
    });
    const otros=totalOtrosIngresosMes(key);
    mensualidadesBar.push(Math.round(mens/1000));
    otrosIngBar.push(Math.round(otros/1000));
    proyectadosBar.push(Math.round(proy/1000));
    const hon=honorariosMes(key);
    const var_=(DB.gastosV||[]).filter(g=>g.mes===key).reduce((s,g)=>s+Number(g.monto),0);
    honorariosBar.push(Math.round(hon/1000));
    variosBar.push(Math.round(var_/1000));
  }

  // ── Destruir instancias previas ──
  ['chart-asist','chart-pagos','chart-gastos'].forEach(id=>{
    const el=document.getElementById(id);
    if(el&&el._ch){el._ch.destroy();el._ch=null;}
  });

  // ── Render HTML ──
  document.getElementById('dash-charts').innerHTML=`
    <div class="chart-card"><h4>📋 Asistencia por Semana — ${mesLabel(mk)} (%)</h4><canvas id="chart-asist" style="max-height:200px"></canvas></div>
    <div class="chart-card"><h4>💳 Ingresos vs Proyectado — 6 meses (miles $)</h4><canvas id="chart-pagos" style="max-height:200px"></canvas></div>
    <div class="chart-card"><h4>💸 Gastos por Mes — 6 meses (miles $)</h4><canvas id="chart-gastos" style="max-height:200px"></canvas></div>
  `;

  setTimeout(()=>{
    // Asistencia semanal — barras apiladas: normal (sólido) + extra (rayado/claro)
    const elA=document.getElementById('chart-asist');
    if(elA){
      const coloresCat=['rgba(214,0,106,.75)','rgba(26,153,0,.75)','rgba(201,80,0,.75)','rgba(0,119,182,.75)'];
      const coloresExtra=['rgba(214,0,106,.25)','rgba(26,153,0,.25)','rgba(201,80,0,.25)','rgba(0,119,182,.25)'];
      const dsNorm=CATS.map((c,i)=>({
        label:c, data:catDatasets[c],
        backgroundColor:coloresCat[i],
        borderRadius:0, borderSkipped:false, stack:c
      }));
      const dsExtra=CATS.map((c,i)=>({
        label:c+' (día extra)', data:catDatasetsExtra[c],
        backgroundColor:coloresExtra[i],
        borderColor:coloresCat[i],
        borderWidth:1.5,
        borderDash:[4,3],
        borderRadius:4, borderSkipped:false, stack:c
      }));
      elA._ch=new Chart(elA,{type:'bar',
        data:{labels:semanas,datasets:[...dsNorm,...dsExtra]},
        options:{responsive:true,maintainAspectRatio:false,
          plugins:{legend:{
            position:'top',
            labels:{
              color:tc,font:{size:9},boxWidth:10,padding:6,
              filter:function(item){
                // Mostrar solo categorías con días extra este mes
                if(item.text.includes('día extra')){
                  const cat=item.text.replace(' (día extra)','');
                  const idx=CATS.indexOf(cat);
                  return catDatasetsExtra[cat]&&catDatasetsExtra[cat].some(v=>v>0);
                }
                return true;
              }
            }
          }},
          scales:{
            x:{ticks:{color:tc,font:{size:9}},grid:{color:gc},stacked:true},
            y:{ticks:{color:tc,font:{size:9}},grid:{color:gc},beginAtZero:true,max:100,stacked:false}
          }
        }
      });
    }

    // Ingresos vs proyectado — apilado: mensualidades + otros ingresos
    const elP=document.getElementById('chart-pagos');
    if(elP) elP._ch=new Chart(elP,{type:'bar',
      data:{labels:mesesBar,datasets:[
        {label:'Mensualidades',data:mensualidadesBar,backgroundColor:'rgba(26,160,83,.85)',borderRadius:0,borderSkipped:false,stack:'ing'},
        {label:'Otros ingresos',data:otrosIngBar,backgroundColor:'rgba(201,168,0,.85)',borderRadius:4,borderSkipped:false,stack:'ing'},
        {label:'Proyectado',data:proyectadosBar,backgroundColor:'rgba(58,87,232,.2)',borderRadius:4,borderSkipped:false,stack:'proy'}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:baseLegend},
        scales:{
          x:{ticks:{color:tc,font:{size:9}},grid:{color:gc},stacked:true},
          y:{ticks:{color:tc,font:{size:9}},grid:{color:gc},beginAtZero:true}
        }
      }
    });

    // Gastos apilados — profesores + varios
    const elG=document.getElementById('chart-gastos');
    if(elG) elG._ch=new Chart(elG,{type:'bar',
      data:{labels:mesesBar,datasets:[
        {label:'Profesores',data:honorariosBar,backgroundColor:'rgba(58,87,232,.75)',borderRadius:0,borderSkipped:false,stack:'g'},
        {label:'Gastos Varios',data:variosBar,backgroundColor:'rgba(176,16,32,.7)',borderRadius:4,borderSkipped:false,stack:'g'}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:baseLegend},
        scales:{
          x:{ticks:{color:tc,font:{size:9}},grid:{color:gc},stacked:true},
          y:{ticks:{color:tc,font:{size:9}},grid:{color:gc},beginAtZero:true,stacked:true}
        }}
    });
  },100);
}
function renderDashPagos(mk,activas){
  const ppp=6;
  const pendientes=activas.filter(a=>!getPago(a.id,mk).pagado);
  const total=Math.ceil(pendientes.length/ppp);
  const pag=Math.min(dashPagPag,Math.max(0,total-1));
  const slice=pendientes.slice(pag*ppp,(pag+1)*ppp);
  const hoy=getHoyReal();
  const esPasado=mk<mesKey(hoy);
  document.getElementById('dash-pagos-table').innerHTML=`
    <table>
      <thead><tr><th>Alumna</th><th>Categoría</th><th>Valor</th><th>Estado</th></tr></thead>
      <tbody>${slice.map(a=>{
        const p=getPago(a.id,mk);
        const val=calcMensualidad(a,mk);
        const real=p.beca?Math.floor(val/2):val;
        const vencido=esPasado||(hoy.getDate()>15&&mk===mesKey(hoy));
        return`<tr class="${vencido?'pago-row vencido':''}">
          <td><div style="display:flex;align-items:center;gap:8px"><div class="avatar">${a.foto?`<img src="${a.foto}">`:''}${!a.foto?iniciales(a.nombre):''}</div>${a.nombre}</div></td>
          <td>${catBadge(a.categoria)}</td>
          <td>${formatCOP(real)}</td>
          <td><span class="badge badge-unpaid">${vencido?'<span class="led-red"></span>':''}Pendiente</span></td>
        </tr>`;
      }).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">✅ Sin pagos pendientes</td></tr>'}
      </tbody>
    </table>
  `;
  // Paginacion
  let pags='';
  if(total>1){
    pags=`<button onclick="dashPagPag=Math.max(0,dashPagPag-1);renderDashboard()" ${pag===0?'disabled':''}>◀</button>`;
    for(let i=0;i<total;i++) pags+=`<button class="${i===pag?'active':''}" onclick="dashPagPag=${i};renderDashboard()">${i+1}</button>`;
    pags+=`<button onclick="dashPagPag=Math.min(${total-1},dashPagPag+1);renderDashboard()" ${pag===total-1?'disabled':''}>▶</button>`;
  }
  document.getElementById('dash-pagos-pag').innerHTML=pags;
}
