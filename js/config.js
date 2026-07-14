/* ═══════════════════════════════════════════════════════════
   config.js
   Configuración: exportar, importar, reparar
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== CONFIG =====================
function renderConfig(){
  document.getElementById('config-content').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:700px">
      <div class="table-card">
        <div class="table-card-header"><h3>💾 Exportar Datos</h3></div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-primary" onclick="exportarJSON()">⬇️ Exportar JSON</button>
          <button class="btn btn-ghost" onclick="exportarCSV()">📄 Exportar CSV Alumnas</button>
        </div>
      </div>
      <div class="table-card">
        <div class="table-card-header"><h3>📥 Importar / Sincronizar</h3></div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:10px">
          <input type="file" accept=".json" id="import-file" onchange="importarJSON(this)" style="font-size:12px">
          <button class="btn btn-ghost" onclick="_fbCargar().then(()=>{loadDB();renderSection(activeSection);toast('Sincronizado desde Firebase ✓')})">🔄 Descargar desde Firebase</button>
          <button class="btn btn-ghost" onclick="repararYResubir()">🔧 Reparar fechas y resubir</button>
        </div>
      </div>
      <div class="table-card" style="grid-column:1/-1">
        <div class="table-card-header"><h3>ℹ️ Información del Sistema</h3></div>
        <div style="padding:16px;font-size:13px;color:var(--muted);display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>🎓 <strong style="color:var(--text)">Alumnas activas:</strong> ${DB.alumnos.length}</div>
          <div>🗃️ <strong style="color:var(--text)">Alumnas en archivo:</strong> ${DB.alumnosRetirados.length}</div>
          <div>👨‍🏫 <strong style="color:var(--text)">Profesores:</strong> ${DB.profesores.length}</div>
          <div>🎭 <strong style="color:var(--text)">Presentaciones:</strong> ${DB.presentaciones.length}</div>
          <div>📅 <strong style="color:var(--text)">Fundación:</strong> 27 de abril de 2024</div>
          <div>📍 <strong style="color:var(--text)">Sede:</strong> Soacha, Cundinamarca 🇨🇴🇻🇪</div>
          <div>🔢 <strong style="color:var(--text)">Próximo ID:</strong> ${DB.nextId}</div>
          <div>💻 <strong style="color:var(--text)">Versión:</strong> 2.0 — GitHub Pages</div>
        </div>
      </div>
    </div>
  `;
}
function repararYResubir(){
  repararFechasIngreso();
  let reparadas=0;
  DB.alumnos.forEach(a=>{ if(a.fechaIngreso) reparadas++; });
  saveAll();
  toast(`✅ ${reparadas} alumnas con fecha válida — datos subidos a Firebase`,'ok');
  renderSection(activeSection);
}
async function subirFirebase(){
  await saveAll();
  toast('Subido a Firebase ✓');
}
function exportarJSON(){
  const sinFotos={...DB,alumnos:DB.alumnos.map(a=>({...a,foto:null}))};
  const blob=new Blob([JSON.stringify(sinFotos,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='lazos-tricolor-backup-'+dateStr(getHoyReal())+'.json';
  a.click(); URL.revokeObjectURL(url);
  toast('JSON exportado ✓');
}
function exportarCSV(){
  const cols=['id','nombre','nacimiento','categoria','fechaIngreso','barrio','telefono','correo','repNombre','familiar'];
  const rows=DB.alumnos.map(a=>cols.map(c=>'"'+(a[c]||'')+'"').join(','));
  const csv=[cols.join(','),...rows].join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='alumnas-'+dateStr(getHoyReal())+'.csv';
  a.click(); URL.revokeObjectURL(url);
  toast('CSV exportado ✓');
}
function importarJSON(input){
  const f=input.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=e=>{
    try{
      const j=JSON.parse(e.target.result);
      if(!j.alumnos) throw new Error('Formato inválido');
      DB=Object.assign(DB,j);
      saveAll(); renderSection(activeSection);
      toast('Importación exitosa ✓');
    }catch{toast('Error al importar JSON','err');}
  };
  r.readAsText(f);
}
