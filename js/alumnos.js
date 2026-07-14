/* ═══════════════════════════════════════════════════════════
   alumnos.js
   Alumnas: CRUD, ficha, historial de pagos
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== ALUMNAS =====================
let alumnasFotoTemp={};
function renderAlumnos(){
  const mk=mesSec.alumnos;
  document.getElementById('alumnos-mes-label').textContent=mesLabel(mk);
  // Badge cumpleaños — extraer mes directamente del string YYYY-MM-DD
  const mesMkStr=mk.split('-')[1]; // "04" para abril
  const cumpleMes=getAlumnasMes(mk).filter(a=>{
    if(!a.nacimiento||a.nacimiento.length<7) return false;
    return a.nacimiento.split('-')[1]===mesMkStr;
  });
  const bdayBadge=document.getElementById('badge-cumples');
  if(bdayBadge){
    bdayBadge.textContent='🎂 '+cumpleMes.length+' cumpleaños en '+mesLabel(mk);
    bdayBadge.style.display=cumpleMes.length>0?'inline-flex':'none';
  }
  const buscar=document.getElementById('alumnos-search')?.value.toLowerCase()||'';
  const cat=document.getElementById('alumnos-cat')?.value||'';
  const estado=document.getElementById('alumnos-estado')?.value||'';
  const todasActivas=getAlumnasMes(mk);
  let lista=todasActivas.filter(a=>{
    if(buscar&&!a.nombre.toLowerCase().includes(buscar)) return false;
    if(cat&&a.categoria!==cat) return false;
    if(estado==='pagado'&&!getPago(a.id,mk).pagado) return false;
    if(estado==='pendiente'&&getPago(a.id,mk).pagado) return false;
    return true;
  });

  // ── Gráfico de distribución por categoría ──
  const dist={Infantil:0,Juvenil:0,Adulto:0,'Adulto Mayor':0};
  todasActivas.forEach(a=>{ if(dist[a.categoria]!==undefined) dist[a.categoria]++; });
  const pagadasCnt=todasActivas.filter(a=>getPago(a.id,mk).pagado).length;
  const pendCnt=todasActivas.length-pagadasCnt;
  const chartWrap=document.getElementById('alumnos-charts');
  if(chartWrap){
    // Destruir charts previos
    ['ch-alumnos-cat','ch-alumnos-pagos'].forEach(id=>{
      const el=document.getElementById(id);
      if(el&&el._ch){el._ch.destroy();el._ch=null;}
    });
    chartWrap.innerHTML=`
      <div class="chart-card" style="flex:1;min-width:220px">
        <h4>Distribución por categoría</h4>
        <canvas id="ch-alumnos-cat" style="max-height:180px"></canvas>
      </div>
      <div class="chart-card" style="flex:1;min-width:220px">
        <h4>Estado de pagos del mes</h4>
        <canvas id="ch-alumnos-pagos" style="max-height:180px"></canvas>
      </div>`;
    setTimeout(()=>{
      const tc='#8a92a6';
      const elC=document.getElementById('ch-alumnos-cat');
      if(elC) elC._ch=new Chart(elC,{type:'doughnut',
        data:{labels:Object.keys(dist),datasets:[{data:Object.values(dist),
          backgroundColor:['rgba(214,0,106,.75)','rgba(26,153,0,.75)','rgba(201,80,0,.75)','rgba(0,119,182,.75)'],borderWidth:2,borderColor:'#fff'}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:tc,font:{size:11},boxWidth:12,padding:8}}}}
      });
      const elP=document.getElementById('ch-alumnos-pagos');
      if(elP) elP._ch=new Chart(elP,{type:'doughnut',
        data:{labels:['Pagadas','Pendientes'],datasets:[{data:[pagadasCnt,pendCnt],
          backgroundColor:['rgba(26,160,83,.8)','rgba(176,16,32,.6)'],borderWidth:2,borderColor:'#fff'}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:tc,font:{size:11},boxWidth:12,padding:8}}}}
      });
    },80);
  }

  const catColors={Infantil:'var(--inf)',Juvenil:'var(--juv)',Adulto:'var(--adu)','Adulto Mayor':'var(--adum)'};
  const container=document.getElementById('alumnos-list');
  if(vistaAlumnosAgrupada){
    let html=`<div style="display:grid;grid-template-columns:1fr;gap:16px">`;
    CATS.forEach(c=>{
      const grupo=lista.filter(a=>a.categoria===c);
      if(!grupo.length) return;
      html+=`<div class="table-card">
        <div class="table-card-header" style="border-left:3px solid ${catColors[c]}"><h3>${c} <span style="color:var(--muted);font-weight:400">(${grupo.length})</span></h3></div>
        ${tablaAlumnas(grupo,mk)}
      </div>`;
    });
    html+='</div>';
    container.innerHTML=html;
  } else {
    container.innerHTML=`<div class="table-card">${tablaAlumnas(lista,mk)}</div>`;
  }
}
function tablaAlumnas(lista,mk){
  const hoy=getHoyReal();
  const esPasado=mk<mesKey(hoy);
  return`<table>
    <thead><tr><th>Alumna</th><th>Categoría</th><th>F. Ingreso</th><th>Mensualidad</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody>${lista.map(a=>{
      const p=getPago(a.id,mk);
      const val=calcMensualidad(a,mk);
      const real=p.beca?Math.floor(val/2):val;
      const vencido=!p.pagado&&(esPasado||(hoy.getDate()>15&&mk===mesKey(hoy)));
      return`<tr>
        <td><div style="display:flex;align-items:center;gap:8px;cursor:pointer" onclick="verFichaAlumna(${a.id})">
          <div class="avatar">${a.foto?`<img src="${a.foto}">`:''}${!a.foto?iniciales(a.nombre):''}</div>
          <div>
            <div style="font-weight:600">${a.nombre} ${(()=>{if(!a.nacimiento||a.nacimiento.length<7)return'';return a.nacimiento.split('-')[1]===mk.split('-')[1]?'🎂':'';})()}</div>
            <div style="font-size:11px;color:var(--muted)">${a.familiar?'👨‍👩‍👧 Familiar':''}${(()=>{if(!a.nacimiento||a.nacimiento.length<7)return'';if(a.nacimiento.split('-')[1]!==mk.split('-')[1])return'';const partes=a.nacimiento.split('-');const dia=parseInt(partes[2]);const mesNom=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][parseInt(partes[1])-1];return(a.familiar?' · ':'')+'🎂 '+dia+' '+mesNom;})()}</div>
          </div>
        </div></td>
        <td>${catBadge(a.categoria)}</td>
        <td style="font-size:12px;color:var(--muted)">${a.fechaIngreso||'—'}</td>
        <td>${formatCOP(real)}</td>
        <td><span class="badge ${p.pagado?'badge-paid':'badge-unpaid'}">${vencido?'<span class="led-red"></span>':''}${p.pagado?'✓ Pagado':'Pendiente'}</span></td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalAlumna(${a.id})">✏️</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Historial pagos" onclick="verHistorialPagos(${a.id})">💰</button>
            <button class="btn btn-danger btn-sm btn-icon" title="Retirar" onclick="retirarAlumna(${a.id})">🚪</button>
          </div>
        </td>
      </tr>`;
    }).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">Sin alumnas en este período</td></tr>'}
    </tbody>
  </table>`;
}
function toggleVistaAlumnos(){
  vistaAlumnosAgrupada=!vistaAlumnosAgrupada;
  document.getElementById('vista-label').textContent=vistaAlumnosAgrupada?'Vista Lista':'Vista Agrupada';
  renderAlumnos();
}
function verFichaAlumna(id){
  abrirModalAlumna(id);
}
function calcEdad(){
  const nac=document.getElementById('a-nacimiento').value;
  if(!nac) return;
  const n=new Date(nac), h=getHoyReal();
  let y=h.getFullYear()-n.getFullYear(), m=h.getMonth()-n.getMonth();
  if(m<0){y--;m+=12;}
  document.getElementById('edad-display').textContent=`🎂 Edad: ${y} años, ${m} meses`;
}
function calcAntiguedad(){
  const fi=document.getElementById('a-fechaIngreso').value;
  if(!fi){document.getElementById('antiguedad-display').textContent='—';return;}
  const n=new Date(fi), h=getHoyReal();
  let y=h.getFullYear()-n.getFullYear(), m=h.getMonth()-n.getMonth();
  if(m<0){y--;m+=12;}
  document.getElementById('antiguedad-display').textContent=`🎓 ${y} año${y!==1?'s':''}, ${m} mes${m!==1?'es':''} en la academia`;
}
function cargarFoto(input){
  const f=input.files[0];
  if(!f)return;
  const r=new FileReader();
  r.onload=e=>{
    fotoTemp=e.target.result;
    const prev=document.getElementById('foto-preview');
    prev.innerHTML=`<img src="${fotoTemp}" style="width:100%;height:100%;object-fit:cover">`;
  };
  r.readAsDataURL(f);
}
function abrirModalAlumna(id=null){
  editAlumnaId=id;
  fotoTemp=null;
  document.getElementById('modal-alumna-title').textContent=id?'Editar Alumna':'Nueva Alumna';
  const campos=['nombre','nacimiento','categoria','fechaIngreso','direccion','barrio','pantalon','camiseta','calzado','peso','estatura','experiencia','repNombre','correo','telefono','conocio'];
  if(id){
    const a=DB.alumnos.find(x=>x.id===id);
    if(!a)return;
    campos.forEach(c=>{ const el=document.getElementById('a-'+c); if(el) el.value=a[c]||''; });
    document.getElementById('a-familiar').checked=!!a.familiar;
    const prev=document.getElementById('foto-preview');
    if(a.foto){ fotoTemp=a.foto; prev.innerHTML=`<img src="${a.foto}" style="width:100%;height:100%;object-fit:cover">`; }
    else { prev.innerHTML='👤'; fotoTemp=null; }
    calcEdad(); calcAntiguedad();
  } else {
    campos.forEach(c=>{ const el=document.getElementById('a-'+c); if(el) el.value=''; });
    document.getElementById('a-categoria').value='Adulto';
    document.getElementById('a-fechaIngreso').value=dateStr(getHoyReal());
    document.getElementById('a-familiar').checked=false;
    document.getElementById('foto-preview').innerHTML='👤';
    const edadEl=document.getElementById('edad-display');
    if(edadEl) edadEl.textContent='';
    const antEl=document.getElementById('antiguedad-display');
    if(antEl) antEl.textContent='—';
    calcAntiguedad();
  }
  abrirModal('modal-alumna');
}
async function guardarAlumna(){
  const nombre=document.getElementById('a-nombre').value.trim();
  if(!nombre){toast('El nombre es obligatorio','err');return;}
  const fiRaw=document.getElementById('a-fechaIngreso').value.trim();
  const fi=fiRaw||dateStr(getHoyReal());
  const datos={
    nombre,
    nacimiento:document.getElementById('a-nacimiento').value,
    categoria:document.getElementById('a-categoria').value,
    fechaIngreso:fi,
    direccion:document.getElementById('a-direccion').value,
    barrio:document.getElementById('a-barrio').value,
    pantalon:document.getElementById('a-pantalon').value,
    camiseta:document.getElementById('a-camiseta').value,
    calzado:document.getElementById('a-calzado').value,
    peso:document.getElementById('a-peso').value,
    estatura:document.getElementById('a-estatura').value,
    experiencia:document.getElementById('a-experiencia').value,
    repNombre:document.getElementById('a-repNombre').value,
    correo:document.getElementById('a-correo').value,
    telefono:document.getElementById('a-telefono').value,
    conocio:document.getElementById('a-conocio').value,
    familiar:document.getElementById('a-familiar').checked,
    foto:fotoTemp||null
  };
  if(editAlumnaId){
    const idx=DB.alumnos.findIndex(x=>x.id===editAlumnaId);
    if(idx>=0) DB.alumnos[idx]={...DB.alumnos[idx],...datos};
  } else {
    const nuevo={id:DB.nextId++,...datos};
    DB.alumnos.push(nuevo);
  }
  tsSeccion('alumnos');
  cerrarModal('modal-alumna');
  renderAlumnos();

  // Guardar con confirmación visual
  const ok = await saveAll();
  if(ok){
    toast(editAlumnaId?'✅ Alumna actualizada y guardada en Firebase':'✅ Alumna registrada y guardada en Firebase','ok');
  } else {
    toast('⚠️ Alumna registrada localmente — reintentando sincronizar...','info');
  }
}
function retirarAlumna(id){
  if(!confirm2('¿Retirar esta alumna? Se moverá al archivo.')) return;
  const idx=DB.alumnos.findIndex(x=>x.id===id);
  if(idx<0) return;
  DB.alumnosRetirados.push({...DB.alumnos[idx],fechaRetiro:dateStr(getHoyReal())});
  DB.alumnos.splice(idx,1);
  saveAll(); renderAlumnos(); toast('Alumna retirada');
}
function verHistorialPagos(id){
  const a=DB.alumnos.find(x=>x.id===id)||DB.alumnosRetirados.find(x=>x.id===id);
  if(!a) return;
  document.getElementById('modal-hist-title').textContent=`Pagos — ${a.nombre}`;
  const mks=Object.keys(DB.pagos[id]||{}).sort().reverse();
  let html='';
  if(!mks.length){ html='<p style="color:var(--muted);text-align:center">Sin registros de pago</p>'; }
  else {
    html=mks.map(mk=>{
      const p=DB.pagos[id][mk];
      const val=calcMensualidad(a,mk);
      const real=p.beca?Math.floor(val/2):val;
      return`<div class="hist-item">
        <div><div style="font-weight:600">${mesLabel(mk)}</div><div style="font-size:11px;color:var(--muted)">${p.beca?'½ Beca aplicada':''} ${a.familiar?'· Familiar':''}</div></div>
        <div style="text-align:right">
          <div style="font-weight:700">${formatCOP(real)}</div>
          <span class="badge ${p.pagado?'badge-paid':'badge-unpaid'}">${p.pagado?'✓ Pagado':'Pendiente'}</span>
          ${p.fechaPago?`<div style="font-size:10px;color:var(--muted)">${p.fechaPago}</div>`:''}
        </div>
      </div>`;
    }).join('');
  }
  document.getElementById('modal-hist-body').innerHTML=html;
  abrirModal('modal-hist-pagos');
}
