/* ═══════════════════════════════════════════════════════════
   pagos.js
   Mensualidades, becas y recordatorios WhatsApp
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== PAGOS =====================
function renderPagos(){
  const mk=mesSec.pagos;
  document.getElementById('pagos-mes-label').textContent=mesLabel(mk);
  const activas=getAlumnasMes(mk);
  const hoy=getHoyReal();
  const esPasado=mk<mesKey(hoy);
  let pendientesWA=[];
  let totalRec=0,totalProy=0;

  let rows=activas.map(a=>{
    const p=getPago(a.id,mk);
    const base=calcMensualidad(a,mk);
    const real=p.beca?Math.floor(base/2):base;
    const vencido=!p.pagado&&(esPasado||(hoy.getDate()>15&&mk===mesKey(hoy)));
    totalProy+=real;
    if(p.pagado) totalRec+=real;
    else if(a.telefono) pendientesWA.push(a);
    return`<tr class="pago-row${vencido?' vencido':''}">
      <td><div style="display:flex;align-items:center;gap:8px"><div class="avatar">${a.foto?`<img src="${a.foto}">`:''}${!a.foto?iniciales(a.nombre):''}</div>${a.nombre}</div></td>
      <td>${catBadge(a.categoria)}</td>
      <td>${formatCOP(base)}</td>
      <td style="text-align:center">
        <input type="checkbox" ${p.beca?'checked':''} onchange="toggleBeca(${a.id},'${mk}',this.checked)" style="accent-color:var(--col);cursor:pointer">
      </td>
      <td style="text-align:center">${a.familiar?'<span style="color:var(--col)">✓</span>':'—'}</td>
      <td style="font-weight:700">${formatCOP(real)}</td>
      <td><span class="badge ${p.pagado?'badge-paid':'badge-unpaid'}">${vencido?'<span class="led-red"></span>':''}${p.pagado?'✓ Pagado':'Pendiente'}</span></td>
      <td>
        ${p.pagado
          ?`<button class="btn btn-ghost btn-sm" onclick="togglePago(${a.id},'${mk}',false)">↩ Revertir</button>`
          :`<button class="btn btn-primary btn-sm" onclick="togglePago(${a.id},'${mk}',true)">✓ Marcar Pagado</button>`
        }
        ${!p.pagado&&a.telefono?`<a href="https://wa.me/57${a.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${a.nombre.split(' ')[0]}! 👋 Te recordamos que tu mensualidad de *${mesLabel(mk)}* por *${formatCOP(real)}* está pendiente. Academia de Danzas Lazos Tricolor 💃🎭`)}" target="_blank" class="btn btn-wa btn-sm btn-icon" title="WhatsApp">📲</a>`:''}
      </td>
    </tr>`;
  }).join('');

  document.getElementById('pagos-resumen').textContent=`Recibido: ${formatCOP(totalRec)} / ${formatCOP(totalProy)} proyectado`;
  document.getElementById('pagos-table').innerHTML=`
    <table>
      <thead><tr><th>Alumna</th><th>Categoría</th><th>Valor Base</th><th>½ Beca</th><th>Familiar</th><th>A Pagar</th><th>Estado</th><th>Acción</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">Sin alumnas en este período</td></tr>'}</tbody>
    </table>
  `;

  // Banner WA
  const banner=document.getElementById('wa-banner-pagos');
  if(pendientesWA.length>0){
    banner.style.display='flex';
    document.getElementById('wa-banner-text').textContent=`${pendientesWA.length} alumna${pendientesWA.length>1?'s con pagos':'con pago'} pendiente${pendientesWA.length>1?'s':''} en ${mesLabel(mk)}`;
    banner._pendientes=pendientesWA;
    banner._mk=mk;
  } else {
    banner.style.display='none';
  }

  // ── Gráfico ingresos del mes ──
  const chartPagos=document.getElementById('pagos-charts');
  if(chartPagos){
    const elPP=document.getElementById('ch-pagos-bar');
    if(elPP&&elPP._ch){elPP._ch.destroy();elPP._ch=null;}
    const mesesP=[],recP=[],proyP=[];
    for(let i=5;i>=0;i--){
      const key=sumarMes(mk,-i);
      mesesP.push(mesLabel(key).substring(0,3));
      const als=getAlumnasMes(key);
      let r=0,pr=0;
      als.forEach(a=>{const p2=getPago(a.id,key);const v=calcMensualidad(a,key);const rv=p2.beca?Math.floor(v/2):v;pr+=rv;if(p2.pagado)r+=rv;});
      recP.push(Math.round(r/1000)); proyP.push(Math.round(pr/1000));
    }
    chartPagos.innerHTML=`<div class="chart-card"><h4>💳 Ingresos últimos 6 meses (miles $)</h4><canvas id="ch-pagos-bar" style="max-height:200px"></canvas></div>`;
    setTimeout(()=>{
      const tc='#8a92a6',gc='rgba(0,0,0,.06)';
      const el=document.getElementById('ch-pagos-bar');
      if(el) el._ch=new Chart(el,{type:'bar',
        data:{labels:mesesP,datasets:[
          {label:'Recibido',data:recP,backgroundColor:'rgba(26,160,83,.8)',borderRadius:4},
          {label:'Proyectado',data:proyP,backgroundColor:'rgba(58,87,232,.25)',borderRadius:4}
        ]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:tc,font:{size:10},boxWidth:10}}},
          scales:{x:{ticks:{color:tc,font:{size:9}},grid:{color:gc}},y:{ticks:{color:tc,font:{size:9}},grid:{color:gc},beginAtZero:true}}}
      });
    },80);
  }
}
function togglePago(id,mk,pagado){
  const p=getPago(id,mk);
  setPago(id,mk,{...p,pagado,fechaPago:pagado?dateStr(getHoyReal()):null});
  tsSeccion('pagos');
  saveBackground(); renderPagos();
  if(activeSection==='dashboard') renderDashboard();
  toast(pagado?'Pago registrado ✓':'Pago revertido');
}
function toggleBeca(id,mk,beca){
  const p=getPago(id,mk);
  setPago(id,mk,{...p,beca});
  saveAll(); renderPagos();
}
function enviarRecordatoriosWA(){
  const banner=document.getElementById('wa-banner-pagos');
  const pendientes=banner._pendientes||[];
  const mk=banner._mk;
  if(!pendientes.length){toast('Sin pendientes con WhatsApp','info');return;}
  const a=pendientes[0];
  const val=calcMensualidad(a,mk);
  const p=getPago(a.id,mk);
  const real=p.beca?Math.floor(val/2):val;
  const msg=`Hola ${a.nombre.split(' ')[0]}! 👋\n\nTe recordamos tu mensualidad de *${mesLabel(mk)}* por *${formatCOP(real)}* está pendiente.\n\n💃 Academia de Danzas Lazos Tricolor\n📍 Soacha, Cundinamarca`;
  window.open(`https://wa.me/57${a.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`,'_blank');
}
