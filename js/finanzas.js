/* ═══════════════════════════════════════════════════════════
   finanzas.js
   Finanzas: ingresos, gastos, balance y totales
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== FINANZAS =====================
function renderFinanzas(){
  const mk=mesSec.fin;
  document.getElementById('fin-mes-label').textContent=mesLabel(mk);
  const activas=getAlumnasMes(mk);
  let ingTotal=0,pendTotal=0;
  activas.forEach(a=>{
    const p=getPago(a.id,mk);
    const val=calcMensualidad(a,mk);
    const real=p.beca?Math.floor(val/2):val;
    if(p.pagado) ingTotal+=real; else pendTotal+=real;
  });
  ingTotal+=totalOtrosIngresosMes(mk); // sumar otros ingresos del mes
  const gastosMes=DB.gastos.filter(g=>g.mes===mk);
  const gastosTotal=gastosMes.reduce((s,g)=>s+Number(g.monto),0)+(DB.gastosV||[]).filter(g=>g.mes===mk).reduce((s,g)=>s+Number(g.monto),0);
  // Honorarios semana actual
  const sk=semKey(0);
  let honorSemana=0;
  DB.profesores.forEach(p=>{ honorSemana+=((DB.clases[p.id]&&DB.clases[p.id][sk])||0)*HONOR_POR_CLASE; });
  const balance=ingTotal-gastosTotal;

  document.getElementById('fin-content').innerHTML=`
    <div class="fin-summary">
      <div class="fin-card pos"><div class="label">Ingresos</div><div class="val">${formatCOP(ingTotal)}</div></div>
      <div class="fin-card neg"><div class="label">Gastos</div><div class="val">${formatCOP(gastosTotal)}</div></div>
      <div class="fin-card ${balance>=0?'pos':'neg'}"><div class="label">Balance</div><div class="val">${formatCOP(balance)}</div></div>
      <div class="fin-card col"><div class="label">Honor. Semana Actual</div><div class="val">${formatCOP(honorSemana)}</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="table-card">
        <div class="table-card-header"><h3>💰 Ingresos del Mes</h3></div>
        <table>
          <thead><tr><th>Alumna</th><th>Valor</th><th>Estado</th></tr></thead>
          <tbody>${activas.map(a=>{
            const p=getPago(a.id,mk);
            const val=calcMensualidad(a,mk);
            const real=p.beca?Math.floor(val/2):val;
            return`<tr><td style="font-size:12px">${a.nombre}</td><td style="font-size:12px">${formatCOP(real)}</td><td><span class="badge ${p.pagado?'badge-paid':'badge-unpaid'}" style="font-size:10px">${p.pagado?'✓':'Pend.'}</span></td></tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>

      <div class="table-card">
        <div class="table-card-header"><h3>📉 Gastos del Mes</h3><button class="btn btn-primary btn-sm" onclick="abrirModal('modal-gasto');document.getElementById('g-concepto').dataset.mes='${mk}'">➕</button></div>
        <table>
          <thead><tr><th>Concepto</th><th>Monto</th><th></th></tr></thead>
          <tbody>${gastosMes.map((g,i)=>`
            <tr><td style="font-size:12px">${g.concepto}</td><td style="font-size:12px">${formatCOP(Number(g.monto))}</td>
            <td><button class="btn btn-danger btn-sm btn-icon" onclick="eliminarGasto('${mk}',${DB.gastos.indexOf(g)})">🗑️</button></td></tr>
          `).join('')||'<tr><td colspan="3" style="text-align:center;color:var(--muted);font-size:12px;padding:12px">Sin gastos registrados</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
  renderFinanzasChart(mk);
}

// ── Gráfico Finanzas — inyectado después de render ──
function renderFinanzasChart(mk){
  setTimeout(()=>{
    const old=document.getElementById('ch-fin-wrap');
    if(old){const c=old.querySelector('canvas');if(c&&c._ch){c._ch.destroy();c._ch=null;}old.remove();}
    const mesesF=[],ingF=[],gastF=[],balF=[];
    for(let i=5;i>=0;i--){
      const key=sumarMes(mk,-i);
      mesesF.push(mesLabel(key).substring(0,3));
      let ing2=0,gst2=0;
      getAlumnasMes(key).forEach(a2=>{const p2=getPago(a2.id,key);const v2=calcMensualidad(a2,key);const rv2=p2.beca?Math.floor(v2/2):v2;if(p2.pagado)ing2+=rv2;});
      gst2=totalGastosMes(key);
      ingF.push(Math.round(ing2/1000)); gastF.push(Math.round(gst2/1000)); balF.push(Math.round((ing2-gst2)/1000));
    }
    const fc=document.getElementById('fin-content');
    if(!fc) return;
    const wrap=document.createElement('div');
    wrap.id='ch-fin-wrap'; wrap.className='chart-card'; wrap.style.marginTop='16px';
    wrap.innerHTML='<h4>📈 Evolución financiera — últimos 6 meses (miles $)</h4><canvas id="ch-fin-line" style="max-height:220px"></canvas>';
    fc.appendChild(wrap);
    const el=document.getElementById('ch-fin-line');
    if(el) el._ch=new Chart(el,{type:'line',
      data:{labels:mesesF,datasets:[
        {label:'Ingresos',data:ingF,borderColor:'rgba(26,160,83,1)',backgroundColor:'rgba(26,160,83,.1)',tension:.3,fill:true,pointRadius:4,borderWidth:2},
        {label:'Gastos',data:gastF,borderColor:'rgba(176,16,32,1)',backgroundColor:'rgba(176,16,32,.08)',tension:.3,fill:true,pointRadius:4,borderWidth:2},
        {label:'Balance',data:balF,borderColor:'rgba(58,87,232,1)',backgroundColor:'transparent',tension:.3,borderDash:[5,3],pointRadius:4,borderWidth:2}
      ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{labels:{color:'#8a92a6',font:{size:11},boxWidth:10,padding:10}}},
        scales:{x:{ticks:{color:'#8a92a6',font:{size:9}},grid:{color:'rgba(0,0,0,.06)'}},
          y:{ticks:{color:'#8a92a6',font:{size:9}},grid:{color:'rgba(0,0,0,.06)'},beginAtZero:true}}}
    });
  },120);
}

function guardarGasto(){
  const concepto=document.getElementById('g-concepto').value.trim();
  const monto=Number(document.getElementById('g-monto').value);
  if(!concepto||!monto){toast('Completa los campos','err');return;}
  const mk=mesSec.fin;
  DB.gastos.push({mes:mk,concepto,monto});
  tsSeccion('gastos');
  cerrarModal('modal-gasto');
  snapLocal();
  saveAll(); renderFinanzas(); toast('Gasto registrado ✓');
}
function eliminarGasto(mk,idx){
  if(!confirm2('¿Eliminar este gasto?')) return;
  DB.gastos.splice(idx,1);
  saveAll(); renderFinanzas(); toast('Gasto eliminado');
}
