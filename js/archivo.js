/* ═══════════════════════════════════════════════════════════
   archivo.js
   Archivo: alumnas y profesores retirados
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== ARCHIVO =====================
function renderArchivo(){
  // Autocuración: nadie puede estar a la vez en activas y en el archivo,
  // ni repetida dentro del archivo.
  if(typeof coherenciaAlumnas==='function' && coherenciaAlumnas(DB)){
    tsSeccion('alumnos'); tsSeccion('alumnosRetirados'); saveBackground();
  }
  document.getElementById('archivo-content').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="table-card">
        <div class="table-card-header"><h3>🎓 Alumnas Retiradas (${DB.alumnosRetirados.length})</h3></div>
        <table>
          <thead><tr><th>Nombre</th><th>Categoría</th><th>Retiro</th><th></th></tr></thead>
          <tbody>${DB.alumnosRetirados.map((a,i)=>`<tr>
            <td style="font-weight:600"><span style="cursor:pointer;color:var(--col)" onclick="verFichaAlumna(${a.id})">${a.nombre}</span></td>
            <td>${catBadge(a.categoria)}</td>
            <td style="font-size:11px;color:var(--muted)">${a.fechaRetiro||'—'}</td>
            <td>
              <div style="display:flex;gap:4px">
                <button class="btn btn-ghost btn-sm btn-icon" title="Ver historial de pagos" onclick="verHistorialPagos(${a.id})">📋</button>
                <button class="btn btn-ghost btn-sm btn-icon" title="Reactivar alumna" onclick="reactivarAlumna(${i})">♻️</button>
                <button class="btn btn-danger btn-sm btn-icon" title="Quitar del archivo (conserva historial)" onclick="eliminarAlumnaDefinitivo(${i})">🗑️</button>
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

async function reactivarAlumna(idx){
  const a = DB.alumnosRetirados[idx];
  if(!a) return;
  if(!confirm('¿Reactivar a '+a.nombre+' como alumna activa?')) return;
  const activa={...a, _movTs:Date.now()};
  delete activa.fechaRetiro;
  // Sin duplicados: si ya estaba en activas, se reemplaza su copia
  DB.alumnos=(DB.alumnos||[]).filter(x=>String(x.id)!==String(a.id));
  DB.alumnos.push(activa);
  DB.alumnosRetirados=DB.alumnosRetirados.filter(x=>String(x.id)!==String(a.id));
  // Sellos de tiempo: sin esto la sincronización deshacía la reactivación
  tsSeccion('alumnos');
  tsSeccion('alumnosRetirados');
  renderArchivo();
  const ok=await saveAll();
  toast(ok?'♻️ '+a.nombre+' reactivada y guardada en Firebase'
          :'⚠️ '+a.nombre+' reactivada localmente — reintentando sincronizar...', ok?'ok':'info');
}

function eliminarAlumnaDefinitivo(idx){
  const a = DB.alumnosRetirados[idx];
  if(!a) return;
  if(!confirm('⚠️ ¿Quitar a '+a.nombre+' del archivo de retiradas?\n\nSu historial de pagos, asistencias, aportes a recaudos y números de rifa SE CONSERVA para el registro contable. Solo se quita de la lista de retiradas.')) return;
  // Conservamos TODO el historial (pagos, asistencias, aportes, números de rifa).
  // Solo la sacamos de la lista de retiradas. Su nombre ya quedó guardado como texto
  // en presentaciones; en recaudos/rifas su id sigue enlazando el registro histórico.
  // Guardamos una copia mínima de su identidad por si algún registro la referencia por id.
  if(!DB.alumnosHistoricas) DB.alumnosHistoricas = [];
  if(!DB.alumnosHistoricas.some(x=>String(x.id)===String(a.id))){
    DB.alumnosHistoricas.push({ id:a.id, nombre:a.nombre, categoria:a.categoria, fechaIngreso:a.fechaIngreso, fechaRetiro:a.fechaRetiro });
  }
  DB.alumnosRetirados.splice(idx,1);
  tsSeccion('alumnosRetirados');
  saveBackground(); renderArchivo(); toast('🗑️ '+a.nombre+' quitada del archivo — su historial se conservó');
}

function eliminarProfesorDefinitivo(idx){
  const p = DB.profesoresRetirados[idx];
  if(!p) return;
  if(!confirm('⚠️ ¿Eliminar DEFINITIVAMENTE a '+p.nombre+'? Esta acción no se puede deshacer.')) return;
  DB.profesoresRetirados.splice(idx,1);
  saveBackground(); renderArchivo(); toast('🗑️ Profesor eliminado definitivamente');
}
