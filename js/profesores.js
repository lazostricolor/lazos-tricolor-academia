/* ═══════════════════════════════════════════════════════════
   profesores.js
   Profesores, clases semanales y honorarios
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== PROFESORES =====================
function renderProfesores(){
  const dias=getDiasSemana(semanaOfs);
  const sk=semKey(semanaOfs);
  const d0=dias[0].toLocaleDateString('es-CO',{day:'2-digit',month:'short'});
  const d6=dias[6].toLocaleDateString('es-CO',{day:'2-digit',month:'short'});
  document.getElementById('semana-label').textContent=`${d0} – ${d6}`;

  let html=`<div class="table-card"><table>
    <thead><tr><th>Profesor</th><th>Especialidad</th><th>Teléfono</th><th>Clases Semana</th><th>Honorario Semana</th><th>Acciones</th></tr></thead>
    <tbody>${DB.profesores.map(p=>{
      const clases=(DB.clases[p.id]&&DB.clases[p.id][sk])||0;
      return`<tr>
        <td><span style="cursor:pointer;font-weight:600;color:var(--col)" onclick="verFichaProfesor(${p.id})">${p.nombre}</span></td>
        <td style="color:var(--muted);font-size:12px">${p.especialidad||'—'}</td>
        <td style="font-size:12px">${p.telefono||'—'}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <button class="btn btn-ghost btn-sm btn-icon" onclick="cambiarClases(${p.id},'${sk}',-1)">−</button>
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;min-width:24px;text-align:center">${clases}</span>
            <button class="btn btn-primary btn-sm btn-icon" onclick="cambiarClases(${p.id},'${sk}',1)">+</button>
          </div>
        </td>
        <td style="font-weight:700;color:var(--col)">${formatCOP(clases*HONOR_POR_CLASE)}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm btn-icon" onclick="abrirModalProfesor(${p.id})">✏️</button>
            ${p.telefono?`<a href="https://wa.me/57${p.telefono.replace(/\D/g,'')}" target="_blank" class="btn btn-wa btn-sm btn-icon">📲</a>`:''}
          </div>
        </td>
      </tr>`;
    }).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">Sin profesores registrados</td></tr>'}
    </tbody>
  </table></div>`;
  document.getElementById('prof-table').innerHTML=html;
}
function cambiarClases(profId,sk,delta){
  if(!DB.clases[profId]) DB.clases[profId]={};
  const actual=(DB.clases[profId][sk]||0)+delta;
  DB.clases[profId][sk]=Math.max(0,actual);
  saveAll(); renderProfesores();
}
function abrirModalProfesor(id=null){
  editProfId=id;
  document.getElementById('modal-prof-title').textContent=id?'Editar Profesor':'Nuevo Profesor';
  if(id){
    const p=DB.profesores.find(x=>x.id===id);
    if(!p)return;
    document.getElementById('p-nombre').value=p.nombre||'';
    document.getElementById('p-telefono').value=p.telefono||'';
    document.getElementById('p-correo').value=p.correo||'';
    document.getElementById('p-especialidad').value=p.especialidad||'';
  } else {
    ['p-nombre','p-telefono','p-correo','p-especialidad'].forEach(id2=>document.getElementById(id2).value='');
  }
  abrirModal('modal-profesor');
}
function guardarProfesor(){
  const nombre=document.getElementById('p-nombre').value.trim();
  if(!nombre){toast('El nombre es obligatorio','err');return;}
  const datos={nombre,telefono:document.getElementById('p-telefono').value,correo:document.getElementById('p-correo').value,especialidad:document.getElementById('p-especialidad').value};
  if(editProfId){
    const idx=DB.profesores.findIndex(x=>x.id===editProfId);
    if(idx>=0) DB.profesores[idx]={...DB.profesores[idx],...datos};
    toast('Profesor actualizado ✓');
  } else {
    DB.profesores.push({id:DB.nextId++,...datos});
    toast('Profesor registrado ✓');
  }
  cerrarModal('modal-profesor');
  saveAll(); renderProfesores();
}
function verFichaProfesor(id){
  const p=DB.profesores.find(x=>x.id===id);
  if(!p) return;
  document.getElementById('modal-ficha-prof-title').textContent=p.nombre;
  // Calcular stats
  let totalClases=0;
  Object.values(DB.clases[id]||{}).forEach(c=>totalClases+=c);
  const sk=semKey(semanaOfs);
  const clasesSemana=(DB.clases[id]&&DB.clases[id][sk])||0;
  // Historial semanas
  const semanas=Object.keys(DB.clases[id]||{}).sort().reverse().slice(0,8);
  let histHtml=semanas.map(s=>{
    const [d0,d1]=s.split('_');
    return`<div class="hist-item"><span style="font-size:12px">${d0} → ${d1}</span><span style="font-weight:700;color:var(--col)">${DB.clases[id][s]} clases — ${formatCOP(DB.clases[id][s]*HONOR_POR_CLASE)}</span></div>`;
  }).join('') || '<p style="color:var(--muted);font-size:12px">Sin historial</p>';

  document.getElementById('modal-ficha-prof-body').innerHTML=`
    <div class="prof-stats-grid">
      <div class="prof-stat"><div class="val">${totalClases}</div><div class="lab">Total Clases</div></div>
      <div class="prof-stat"><div class="val">${formatCOP(totalClases*HONOR_POR_CLASE)}</div><div class="lab">Honorarios Totales</div></div>
      <div class="prof-stat"><div class="val">${clasesSemana}</div><div class="lab">Clases Esta Semana</div></div>
    </div>
    <div style="margin-bottom:12px">
      ${p.telefono?`<div style="font-size:13px;margin-bottom:4px">📱 ${p.telefono}</div>`:''}
      ${p.correo?`<div style="font-size:13px;margin-bottom:4px">✉️ ${p.correo}</div>`:''}
      ${p.especialidad?`<div style="font-size:13px;color:var(--muted)">🎭 ${p.especialidad}</div>`:''}
    </div>
    <h4 style="font-size:13px;margin-bottom:10px">Historial semanal</h4>
    ${histHtml}
  `;
  document.getElementById('btn-retirar-prof').onclick=()=>{
    if(!confirm2('¿Retirar a '+p.nombre+'?')) return;
    DB.profesoresRetirados.push({...p,fechaRetiro:dateStr(getHoyReal())});
    DB.profesores=DB.profesores.filter(x=>x.id!==id);
    cerrarModal('modal-ficha-prof');
    saveAll(); renderProfesores(); toast('Profesor retirado');
  };
  abrirModal('modal-ficha-prof');
}
