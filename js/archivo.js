/* ═══════════════════════════════════════════════════════════
   archivo.js
   Archivo: alumnas y profesores retirados
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== ARCHIVO =====================
function renderArchivo(){
  document.getElementById('archivo-content').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="table-card">
        <div class="table-card-header"><h3>🎓 Alumnas Retiradas (${DB.alumnosRetirados.length})</h3></div>
        <table>
          <thead><tr><th>Nombre</th><th>Categoría</th><th>Retiro</th><th></th></tr></thead>
          <tbody>${DB.alumnosRetirados.map((a,i)=>`<tr>
            <td style="font-weight:600">${a.nombre}</td>
            <td>${catBadge(a.categoria)}</td>
            <td style="font-size:11px;color:var(--muted)">${a.fechaRetiro||'—'}</td>
            <td>
              <div style="display:flex;gap:4px">
                <button class="btn btn-ghost btn-sm btn-icon" title="Reactivar alumna" onclick="reactivarAlumna(${i})">♻️</button>
                <button class="btn btn-danger btn-sm btn-icon" title="Eliminar definitivamente" onclick="eliminarAlumnaDefinitivo(${i})">🗑️</button>
              </div>
            </td>
          </tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:16px">Sin registros</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="table-card">
        <div class="table-card-header"><h3>👨‍🏫 Profesores Retirados (${DB.profesoresRetirados.length})</h3></div>
        <table>
          <thead><tr><th>Nombre</th><th>Especialidad</th><th>Retiro</th><th></th></tr></thead>
          <tbody>${DB.profesoresRetirados.map((p,i)=>`<tr>
            <td style="font-weight:600">${p.nombre}</td>
            <td style="font-size:11px;color:var(--muted)">${p.especialidad||'—'}</td>
            <td style="font-size:11px;color:var(--muted)">${p.fechaRetiro||'—'}</td>
            <td><button class="btn btn-danger btn-sm btn-icon" title="Eliminar definitivamente" onclick="eliminarProfesorDefinitivo(${i})">🗑️</button></td>
          </tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:16px">Sin registros</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function reactivarAlumna(idx){
  const a = DB.alumnosRetirados[idx];
  if(!a) return;
  if(!confirm('¿Reactivar a '+a.nombre+' como alumna activa?')) return;
  DB.alumnos.push({...a, fechaRetiro:undefined});
  DB.alumnosRetirados.splice(idx,1);
  saveBackground(); renderArchivo(); toast('♻️ '+a.nombre+' reactivada como alumna activa');
}

function eliminarAlumnaDefinitivo(idx){
  const a = DB.alumnosRetirados[idx];
  if(!a) return;
  if(!confirm('⚠️ ¿Eliminar DEFINITIVAMENTE a '+a.nombre+'? Esta acción no se puede deshacer y borrará todos sus registros.')) return;
  // Borrar también pagos y asistencias
  delete DB.pagos[a.id];
  delete DB.asistencias[a.id];
  DB.alumnosRetirados.splice(idx,1);
  saveBackground(); renderArchivo(); toast('🗑️ Alumna eliminada definitivamente');
}

function eliminarProfesorDefinitivo(idx){
  const p = DB.profesoresRetirados[idx];
  if(!p) return;
  if(!confirm('⚠️ ¿Eliminar DEFINITIVAMENTE a '+p.nombre+'? Esta acción no se puede deshacer.')) return;
  DB.profesoresRetirados.splice(idx,1);
  saveBackground(); renderArchivo(); toast('🗑️ Profesor eliminado definitivamente');
}
