/* ═══════════════════════════════════════════════════════════
   preinscripciones.js
   Preinscripciones recibidas del formulario web
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== PREINSCRIPCIONES =====================
const FB_PREINSC_URL = `https://firestore.googleapis.com/v1/projects/lazos-tricolor-academia/databases/(default)/documents/inscripciones`;
let _preinscripciones = [];

async function cargarPreinscripciones() {
  try {
    setSyncStatus('syncing');
    const r = await fetch(`${FB_PREINSC_URL}?key=${FB_KEY}&pageSize=200`);
    if (!r.ok) throw new Error('Error cargando preinscripciones');
    const j = await r.json();
    _preinscripciones = (j.documents || []).map(doc => {
      const f = doc.fields || {};
      const get = k => f[k]?.stringValue || '';
      return {
        _id:             doc.name,
        nombre:          get('nombre_estudiante'),
        fecha_nacimiento:get('fecha_nacimiento'),
        edad:            get('edad'),
        categoria:       get('categoria'),
        experiencia:     get('experiencia'),
        acudiente:       get('acudiente'),
        telefono:        get('telefono'),
        correo:          get('correo'),
        direccion:       get('direccion'),
        barrio:          get('barrio'),
        conocio:         get('conocio'),
        pantalon:        get('pantalon'),
        camiseta:        get('camiseta'),
        calzado:         get('calzado'),
        peso:            get('peso'),
        estatura:        get('estatura'),
        fecha_envio:     get('fecha_envio'),
        estado:          get('estado') || 'pendiente',
        timestamp:       get('timestamp')
      };
    }).sort((a,b) => Number(b.timestamp||0) - Number(a.timestamp||0));
    setSyncStatus('ok');
    renderPreinscripciones();
    // Actualizar badge en sidebar
    const pend = _preinscripciones.filter(p=>p.estado==='pendiente').length;
    const badge = document.getElementById('badge-preinsc');
    if(badge){ badge.textContent=pend; badge.style.display=pend>0?'inline':'none'; }
  } catch(e) {
    setSyncStatus('error');
    toast('Error cargando preinscripciones: '+e.message, 'err');
  }
}

function renderPreinscripciones() {
  const filtro = document.getElementById('preinsc-filtro')?.value || '';
  const lista = filtro ? _preinscripciones.filter(p => p.estado === filtro) : _preinscripciones;

  const pendientes = _preinscripciones.filter(p => p.estado === 'pendiente').length;
  const aprobadas  = _preinscripciones.filter(p => p.estado === 'aprobada').length;
  const rechazadas = _preinscripciones.filter(p => p.estado === 'rechazada').length;

  document.getElementById('preinsc-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:rgba(244,169,22,.12)">⏳</div>
      <div class="stat-body"><div class="stat-label">Pendientes</div><div class="stat-val" style="color:var(--warning)">${pendientes}</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:rgba(26,160,83,.12)">✅</div>
      <div class="stat-body"><div class="stat-label">Aprobadas</div><div class="stat-val" style="color:var(--success)">${aprobadas}</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:rgba(192,50,33,.12)">❌</div>
      <div class="stat-body"><div class="stat-label">Rechazadas</div><div class="stat-val" style="color:var(--danger)">${rechazadas}</div></div>
    </div>
  `;

  if (!lista.length) {
    document.getElementById('preinsc-tabla').innerHTML = `<p style="text-align:center;color:var(--text2);padding:40px">Sin preinscripciones${filtro?' en este estado':''}</p>`;
    return;
  }

  const estadoBadge = e => e==='aprobada'
    ? '<span class="badge badge-paid">✅ Aprobada</span>'
    : e==='rechazada'
    ? '<span class="badge badge-unpaid">❌ Rechazada</span>'
    : '<span class="badge badge-partial">⏳ Pendiente</span>';

  document.getElementById('preinsc-tabla').innerHTML = `
    <table>
      <thead><tr>
        <th>Nombre</th><th>Edad</th><th>Categoría</th><th>Teléfono</th>
        <th>Barrio</th><th>Acudiente</th><th>Fecha</th><th>Estado</th><th>Acciones</th>
      </tr></thead>
      <tbody>
        ${lista.map(p => `<tr>
          <td>
            <div style="font-weight:600">${p.nombre}</div>
            ${p.fecha_nacimiento?`<div style="font-size:11px;color:var(--text2)">${p.fecha_nacimiento}</div>`:''}
          </td>
          <td>${p.edad?p.edad+' años':'—'}</td>
          <td><span class="badge badge-inf" style="font-size:10px">${p.categoria||'—'}</span></td>
          <td>
            <a href="https://wa.me/57${p.telefono.replace(/\D/g,'')}" target="_blank"
               style="color:var(--success);font-weight:600;text-decoration:none">📲 ${p.telefono}</a>
          </td>
          <td style="font-size:12px">${p.barrio||'—'}</td>
          <td style="font-size:12px">${p.acudiente||'—'}</td>
          <td style="font-size:11px;color:var(--text2)">${p.fecha_envio||'—'}</td>
          <td>${estadoBadge(p.estado)}</td>
          <td>
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              <button class="btn btn-ghost btn-sm btn-icon" title="Ver detalles" onclick="verDetallePreinsc(${lista.indexOf(p)})">👁️</button>
              ${p.estado==='pendiente'?`
                <button class="btn btn-primary btn-sm" onclick="cambiarEstadoPreinsc('${p._id}','aprobada')" title="Aprobar">✅</button>
                <button class="btn btn-danger btn-sm" onclick="cambiarEstadoPreinsc('${p._id}','rechazada')" title="Rechazar">❌</button>
              `:''}
              ${p.estado==='aprobada'?`
                <button class="btn btn-primary btn-sm" onclick="convertirAAlumna(${lista.indexOf(p)})" title="Inscribir como nueva alumna">🎓 Nueva</button>
                <button class="btn btn-ghost btn-sm" onclick="actualizarAlumnaExistente(${lista.indexOf(p)})" title="Actualizar alumna ya registrada">🔄 Actualizar</button>
              `:''}
              <button class="btn btn-ghost btn-sm btn-icon" onclick="eliminarPreinscripcion('${p._id}')" title="Eliminar definitivamente" style="color:var(--danger)">🗑️</button>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}

async function eliminarPreinscripcion(docId) {
  if (!confirm('¿Eliminar esta preinscripción definitivamente? Esta acción no se puede deshacer.')) return;
  try {
    const url = `https://firestore.googleapis.com/v1/${docId}?key=${FB_KEY}`;
    const r = await fetch(url, { method: 'DELETE' });
    if (!r.ok) {
      const errBody = await r.json().catch(()=>({}));
      throw new Error(errBody?.error?.message || 'Error eliminando');
    }
    _preinscripciones = _preinscripciones.filter(x => x._id !== docId);
    renderPreinscripciones();
    toast('🗑️ Preinscripción eliminada');
  } catch(e) {
    toast('Error: ' + e.message, 'err');
  }
}

async function cambiarEstadoPreinsc(docId, nuevoEstado) {
  try {
    // docId viene como ruta completa de Firestore: projects/.../documents/inscripciones/XXXX
    // Construir URL correcta para la REST API
    const url = `https://firestore.googleapis.com/v1/${docId}?key=${FB_KEY}&updateMask.fieldPaths=estado`;
    const r = await fetch(url, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({fields:{estado:{stringValue:nuevoEstado}}})
    });
    if (!r.ok) {
      const errBody = await r.json();
      throw new Error(errBody?.error?.message || 'Error actualizando estado');
    }
    // Actualizar local
    const p = _preinscripciones.find(x => x._id === docId);
    if (p) p.estado = nuevoEstado;
    renderPreinscripciones();
    toast(nuevoEstado === 'aprobada' ? '✅ Preinscripción aprobada' : '❌ Preinscripción rechazada');
  } catch(e) {
    toast('Error: '+e.message, 'err');
  }
}

function verDetallePreinsc(idx) {
  const lista = document.getElementById('preinsc-filtro')?.value
    ? _preinscripciones.filter(p => p.estado === document.getElementById('preinsc-filtro').value)
    : _preinscripciones;
  const p = lista[idx];
  if (!p) return;

  // Usar modal de historial pagos como detalle (reutilizar)
  document.getElementById('modal-hist-title').textContent = '📋 ' + p.nombre;
  document.getElementById('modal-hist-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      ${[
        ['Fecha nac.', p.fecha_nacimiento||'—'],
        ['Edad', p.edad?p.edad+' años':'—'],
        ['Categoría', p.categoria||'—'],
        ['Experiencia', p.experiencia||'—'],
        ['Teléfono', p.telefono],
        ['Correo', p.correo||'—'],
        ['Dirección', p.direccion||'—'],
        ['Barrio', p.barrio||'—'],
        ['Acudiente', p.acudiente||'—'],
        ['Cómo nos conoció', p.conocio||'—'],
        ['Pantalón', p.pantalon||'—'],
        ['Camiseta', p.camiseta||'—'],
        ['Calzado', p.calzado||'—'],
        ['Peso', p.peso?p.peso+' kg':'—'],
        ['Estatura', p.estatura?p.estatura+' cm':'—'],
        ['Enviado', p.fecha_envio||'—'],
      ].map(([k,v])=>`
        <div style="background:var(--card2);border-radius:8px;padding:10px">
          <div style="font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">${k}</div>
          <div style="font-size:13px;font-weight:600">${v}</div>
        </div>
      `).join('')}
    </div>
        <div style="margin-top:14px;display:flex;gap:8px">
      <a href="https://wa.me/57${p.telefono.replace(/\D/g,'')}" target="_blank" class="btn btn-wa btn-sm">📲 WhatsApp</a>
      ${p.correo?`<a href="mailto:${p.correo}" class="btn btn-ghost btn-sm">✉️ Email</a>`:''}
    </div>
  `;
  abrirModal('modal-hist-pagos');
}

function actualizarAlumnaExistente(idx) {
  const lista = document.getElementById('preinsc-filtro')?.value
    ? _preinscripciones.filter(p => p.estado === document.getElementById('preinsc-filtro').value)
    : _preinscripciones;
  const p = lista[idx];
  if (!p) return;

  // Crear selector de alumnas existentes
  const opciones = DB.alumnos.map(a =>
    `<option value="${a.id}">${a.nombre} (${a.categoria})</option>`
  ).join('');

  if(!opciones){ toast('No hay alumnas registradas aún','info'); return; }

  document.getElementById('modal-hist-title').textContent = '🔄 Actualizar datos de alumna existente';
  document.getElementById('modal-hist-body').innerHTML = `
    <p style="font-size:13px;color:var(--text2);margin-bottom:16px">
      Selecciona la alumna cuyo perfil quieres actualizar con los datos de <strong>${p.nombre}</strong>.
      Solo se actualizarán los campos que llegaron en la preinscripción.
    </p>
    <div class="form-group" style="margin-bottom:20px">
      <label>Alumna a actualizar</label>
      <select id="sel-alumna-actualizar" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:14px">
        ${opciones}
      </select>
    </div>
    <div style="background:var(--card2);border-radius:8px;padding:12px;font-size:12px;color:var(--text2);margin-bottom:16px">
      <strong style="color:var(--text)">Campos que se actualizarán:</strong><br>
      Fecha de nacimiento, Categoría, Teléfono, Correo, Dirección, Barrio,
      Representante, Cómo nos conoció, Tallas (pantalón, camiseta, calzado, peso, estatura), Experiencia
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="cerrarModal('modal-hist-pagos')">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarActualizarAlumna('${p._id}',${idx})">🔄 Actualizar alumna</button>
    </div>
  `;
  abrirModal('modal-hist-pagos');
}

function confirmarActualizarAlumna(preinscId, preinscIdx) {
  const alumnaId = parseInt(document.getElementById('sel-alumna-actualizar').value);
  const alumna = DB.alumnos.find(a => a.id === alumnaId);
  const lista = document.getElementById('preinsc-filtro')?.value
    ? _preinscripciones.filter(p => p.estado === document.getElementById('preinsc-filtro').value)
    : _preinscripciones;
  const p = lista[preinscIdx];
  if (!alumna || !p) return;

  if(!confirm('¿Actualizar los datos de '+alumna.nombre+' con la información de la preinscripción?')) return;

  // Actualizar solo campos que llegaron en la preinscripción (no sobreescribir foto ni id ni pagos)
  if(p.fecha_nacimiento) alumna.nacimiento = p.fecha_nacimiento;
  if(p.categoria && ['Infantil','Juvenil','Adulto','Adulto Mayor'].includes(p.categoria)) alumna.categoria = p.categoria;
  if(p.telefono)   alumna.telefono   = p.telefono;
  if(p.correo)     alumna.correo     = p.correo;
  if(p.direccion)  alumna.direccion  = p.direccion;
  if(p.barrio)     alumna.barrio     = p.barrio;
  if(p.acudiente)  alumna.repNombre  = p.acudiente;
  if(p.conocio)    alumna.conocio    = p.conocio;
  if(p.pantalon)   alumna.pantalon   = p.pantalon;
  if(p.camiseta)   alumna.camiseta   = p.camiseta;
  if(p.calzado)    alumna.calzado    = p.calzado;
  if(p.peso)       alumna.peso       = p.peso;
  if(p.estatura)   alumna.estatura   = p.estatura;
  if(p.experiencia) alumna.experiencia = p.experiencia;

  // Marcar preinscripción como procesada
  cambiarEstadoPreinsc(preinscId, 'aprobada');

  cerrarModal('modal-hist-pagos');
  saveAll();
  toast('✅ Datos de '+alumna.nombre+' actualizados correctamente');
}

function convertirAAlumna(idx) {
  // idx viene de la lista renderizada (filtrada o completa según filtro activo)
  const filtro = document.getElementById('preinsc-filtro')?.value || '';
  const listaActual = filtro ? _preinscripciones.filter(p=>p.estado===filtro) : _preinscripciones;
  const p = listaActual[idx] || _preinscripciones[idx];
  if (!p) return;
  if (!confirm('¿Convertir a ' + p.nombre + ' en alumna activa?')) return;

  // Pre-llenar modal de nueva alumna con los datos de la preinscripción
  editAlumnaId = null;
  fotoTemp = null;
  document.getElementById('modal-alumna-title').textContent = 'Nueva Alumna — desde preinscripción';
  document.getElementById('a-nombre').value   = p.nombre;
  document.getElementById('a-nacimiento').value = p.fecha_nacimiento||'';
  document.getElementById('a-categoria').value  = ['Infantil','Juvenil','Adulto','Adulto Mayor'].includes(p.categoria||p.grupo)?( p.categoria||p.grupo):'Adulto';
  document.getElementById('a-telefono').value   = p.telefono;
  document.getElementById('a-correo').value     = p.correo;
  document.getElementById('a-direccion').value  = p.direccion||'';
  document.getElementById('a-barrio').value     = p.barrio||p.municipio||'';
  document.getElementById('a-conocio').value    = p.conocio||'';
  document.getElementById('a-pantalon').value   = p.pantalon||'';
  document.getElementById('a-camiseta').value   = p.camiseta||'';
  document.getElementById('a-calzado').value    = p.calzado||'';
  document.getElementById('a-peso').value       = p.peso||'';
  document.getElementById('a-estatura').value   = p.estatura||'';
  document.getElementById('a-experiencia').value= p.experiencia==='Sí'?'Sí':'No';
  document.getElementById('a-repNombre').value  = p.acudiente;
  document.getElementById('a-fechaIngreso').value = dateStr(getHoyReal());
  document.getElementById('a-familiar').checked = false;
  document.getElementById('foto-preview').innerHTML = '👤';
  document.getElementById('edad-display').textContent = '';
  calcAntiguedad();

  cerrarModal('modal-hist-pagos');
  abrirModal('modal-alumna');
}
