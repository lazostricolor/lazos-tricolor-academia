/* ═══════════════════════════════════════════════════════════
   coreo/app.js
   Interfaz: entrada, lista, escenario, conteos, línea de tiempo,
   video sincronizado y paneles del coreógrafo / alumna.
═══════════════════════════════════════════════════════════ */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const U = 100;                        // unidades SVG por cuadro del escenario
const COLORES = ['#ff5fa2', '#ff8a5c', '#f2c230', '#c77dff', '#ff4d6d', '#4c7dff', '#2ec4b6', '#3ccf8e', '#7aa2ff', '#e8e8ee'];
const SIMBOLO = {
  F: 'M0 -17 a11 11 0 1 0 0.01 0 M0 5 V23 M-8 15 H8',
  M: 'M-4 -6 m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 M3.8 -13.8 L15 -25 M5 -25 H15 V-15'
};
const ICO_PLAY = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
const ICO_PAUSA = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>';

const S = {
  sesion: null, st: null,
  lista: [], filtroCat: 'Todas', solicitudes: [], autorizados: [],
  coreo: null, sel: null, selForm: null, mio: null,
  vistaAlumna: false, tab: 'bailarines',
  iman: true, trayectorias: true, pps: 40,
  progreso: null, analisis: null, ajusteVideo: false, videoSonido: false, videoVisible: true,
  unsub: [], unsubCoreo: null, sucio: true, ultimoT: -1, ultimoBeat: null, arrastre: null
};

/* ═══════════════ Utilidades ═══════════════ */
let _tToast;
function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (err ? ' err' : '');
  clearTimeout(_tToast); _tToast = setTimeout(() => t.className = 'toast', err ? 5000 : 2600);
}
function fmtT(t) {
  t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}
function fmtFecha(ts) {
  if (!ts) return '';
  const d = new Date(ts), hoy = new Date();
  const hora = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === hoy.toDateString()) return 'hoy, ' + hora;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: d.getFullYear() === hoy.getFullYear() ? undefined : 'numeric' }) + ', ' + hora;
}
function modal({ titulo, html = '', si = 'Aceptar', no = 'Cancelar', peligro = false }) {
  return new Promise(ok => {
    const d = $('#modal');
    $('#modal-titulo').textContent = titulo;
    $('#modal-cuerpo').innerHTML = html;
    $('#modal-si').textContent = si;
    $('#modal-si').className = 'btn ' + (peligro ? 'btn-peligro' : 'btn-primario');
    $('#modal-no').hidden = !no; $('#modal-no').textContent = no || '';
    d.onclose = () => {
      const datos = {}; d.querySelectorAll('[name]').forEach(el => { datos[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'file' ? (el.files[0] || null) : el.value; });
      ok(d.returnValue === 'si' ? datos : null);
    };
    d.returnValue = ''; d.showModal();
    const primero = d.querySelector('#modal-cuerpo input, #modal-cuerpo select'); if (primero) primero.focus();
  });
}
const confirmar = (titulo, texto, si = 'Sí', peligro = false) => modal({ titulo, html: `<p class="muted">${esc(texto)}</p>`, si, peligro }).then(r => !!r);

/* ═══════════════ Vistas y sesión ═══════════════ */
function mostrar(v) { ['#v-login', '#v-lista', '#v-editor'].forEach(id => $(id).hidden = id !== v); }

function msgLogin(t) { $('#login-msg').textContent = t || ''; }

async function entrar(sesion) {
  S.sesion = sesion; S.st = sesion.modo === 'demo' ? Demo : Nube;
  if (sesion.rol === 'sin-acceso') {
    mostrar('#v-login');
    $('#login-opciones').hidden = true; $('#login-sin-acceso').hidden = false;
    $('#clave-sin-acceso').textContent = sesion.clave.replace(/^mail:|^tel:/, '');
    return;
  }
  $('#login-opciones').hidden = false; $('#login-sin-acceso').hidden = true;
  $('#usuario').textContent = sesion.nombre + (sesion.rol === 'coreografo' ? ' · coreógrafo' : '');
  $('#btn-nueva').hidden = sesion.rol !== 'coreografo';
  $('#panel-admin').hidden = sesion.rol !== 'coreografo';
  S.unsub.forEach(f => f()); S.unsub = [];
  S.unsub.push(S.st.escucharLista(sesion, l => { S.lista = l; renderLista(); }, e => toast('No se pudo leer la lista: ' + e.message, true)));
  S.unsub.push(S.st.escucharSolicitudes(sesion, l => { S.solicitudes = l; renderPanelAdmin(); if (S.coreo && S.tab === 'bailarines') renderPanel(); }));
  if (sesion.rol === 'coreografo') S.unsub.push(S.st.escucharAutorizados(l => { S.autorizados = l; renderPanelAdmin(); }));
  const ir = new URLSearchParams(location.hash.slice(1)).get('c');
  mostrar('#v-lista'); renderLista(); renderPanelAdmin();
  if (ir) abrirCoreo(ir);
}

async function salir() {
  await cerrarCoreo();
  S.unsub.forEach(f => f()); S.unsub = [];
  if (S.sesion?.modo === 'demo') { try { localStorage.removeItem('coreo_modo'); } catch (_) {} }
  else if (FB.ok) { try { await FB.auth.signOut(); } catch (_) {} }
  S.sesion = null; mostrar('#v-login'); $('#login-opciones').hidden = false; $('#login-sin-acceso').hidden = true;
}

function iniciarLogin() {
  $('#btn-google').onclick = async () => {
    if (!FB.ok) return msgLogin('Sin conexión con Firebase. Prueba el modo sin cuenta.');
    msgLogin('');
    const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    try { await FB.auth.signInWithPopup(p); }
    catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return FB.auth.signInWithRedirect(p);
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      msgLogin(e.code === 'auth/unauthorized-domain' ? 'Este dominio no está autorizado en Firebase → Authentication.' : 'No se pudo entrar con Google.');
    }
  };
  let confirmacion = null, verificador = null;
  $('#f-tel').onsubmit = async ev => {
    ev.preventDefault();
    if (!FB.ok) return msgLogin('Sin conexión con Firebase.');
    const tel = normalizarTel($('#in-tel').value);
    if (tel.length < 11) return msgLogin('Escribe tu número completo, por ejemplo 300 123 4567.');
    msgLogin('Enviando código…'); $('#btn-sms').disabled = true;
    try {
      if (!verificador) verificador = new firebase.auth.RecaptchaVerifier('recaptcha', { size: 'invisible' });
      confirmacion = await FB.auth.signInWithPhoneNumber(tel, verificador);
      $('#f-tel').hidden = true; $('#f-codigo').hidden = false; $('#in-codigo').focus();
      msgLogin('Te enviamos un SMS a ' + tel + '.');
    } catch (e) {
      msgLogin(e.code === 'auth/operation-not-allowed' ? 'El ingreso por celular no está activado en Firebase.' : e.code === 'auth/too-many-requests' ? 'Demasiados intentos. Espera un rato.' : 'No se pudo enviar el código.');
      try { verificador && verificador.clear(); } catch (_) {} verificador = null;
    } finally { $('#btn-sms').disabled = false; }
  };
  $('#f-codigo').onsubmit = async ev => {
    ev.preventDefault();
    if (!confirmacion) return;
    try { msgLogin('Verificando…'); await confirmacion.confirm($('#in-codigo').value.trim()); }
    catch (_) { msgLogin('El código no es correcto.'); }
  };
  $('#btn-demo').onclick = () => { try { localStorage.setItem('coreo_modo', 'demo'); } catch (_) {} entrar(sesionDemo()); };
  $('#btn-salir').onclick = salir;
  $('#btn-salir-sin').onclick = salir;
}

/* ═══════════════ Lista de coreografías ═══════════════ */
function renderLista() {
  const cats = ['Todas', ...(S.sesion?.rol === 'coreografo' ? CATEGORIAS : S.sesion?.categorias || [])];
  const ch = $('#chips-cat');
  ch.innerHTML = cats.map(c => `<button class="chip" role="tab" data-cat="${c}" aria-selected="${c === S.filtroCat}">${c}</button>`).join('');
  ch.onclick = e => { const b = e.target.closest('[data-cat]'); if (b) { S.filtroCat = b.dataset.cat; renderLista(); } };
  const l = S.lista.filter(c => S.filtroCat === 'Todas' || c.categoria === S.filtroCat)
    .sort((a, b) => (b.actualizadoEn || 0) - (a.actualizadoEn || 0));
  const g = $('#grid-coreos');
  if (!l.length) {
    g.innerHTML = `<div class="vacio">${S.sesion?.rol === 'coreografo' ? 'Aún no hay coreografías aquí. Crea la primera con “+ Nueva coreografía”.' : 'Todavía no hay coreografías publicadas para tu categoría.'}</div>`;
  } else {
    g.innerHTML = l.map(c => `
      <button class="tarjeta" data-id="${esc(c.id)}">
        ${miniEscenario(c)}
        <div class="tarjeta-cuerpo">
          <h3>${esc(c.titulo || 'Sin título')}</h3>
          <div class="meta">
            <span class="etq cat-${esc(c.categoria)}">${esc(c.categoria)}</span>
            <span class="etq">${(c.bailarines || []).length} bailarines</span>
            <span class="etq">${(c.formaciones || []).length} formaciones</span>
            ${c.sellada ? '<span class="etq sellada">Sellada</span>' : ''}
            ${c.musica?.nombre ? '<span class="etq">🎵 Con música</span>' : ''}
          </div>
          <small class="fecha">Actualizada ${fmtFecha(c.actualizadoEn)}${c.creadaEn ? ' · creada ' + new Date(c.creadaEn).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</small>
        </div>
      </button>`).join('');
  }
  g.onclick = e => { const t = e.target.closest('.tarjeta'); if (t) abrirCoreo(t.dataset.id); };
  $('#btn-nueva').onclick = nuevaCoreo;
}

function miniEscenario(c) {
  const cols = c.escenario?.cols || 8, filas = c.escenario?.filas || 6;
  const f = (c.formaciones || []).slice().sort((a, b) => a.beat - b.beat)[0];
  const pts = (c.bailarines || []).map(b => { const p = f?.pos?.[b.id]; return p ? `<circle cx="${p.x}" cy="${p.y}" r=".3" fill="${esc(b.color)}"/>` : ''; }).join('');
  return `<svg class="tarjeta-mini" viewBox="-.5 -.5 ${cols + 1} ${filas + 1}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <rect x="0" y="0" width="${cols}" height="${filas}" rx=".15" fill="#16181f" stroke="#2c303c" stroke-width=".04"/>${pts}</svg>`;
}

async function nuevaCoreo() {
  const r = await modal({
    titulo: 'Nueva coreografía', si: 'Crear',
    html: `
      <label class="campo"><span>Nombre</span><input name="titulo" maxlength="60" placeholder="Ej. Cumbia de la región Caribe" required></label>
      <label class="campo"><span>Categoría</span><select name="categoria">${CATEGORIAS.map(c => `<option>${c}</option>`).join('')}</select></label>
      <div class="dos">
        <label class="campo"><span>Mujeres ♀</span><input name="f" type="number" min="0" max="40" value="4"></label>
        <label class="campo"><span>Hombres ♂</span><input name="m" type="number" min="0" max="40" value="4"></label>
      </div>
      <label class="campo"><span>Música (MP3) — opcional, también puedes agregarla después</span><input name="pista" type="file" accept="audio/*,.mp3,.m4a,.wav"></label>`
  });
  if (!r) return;
  const nf = Math.max(0, Math.min(40, +r.f || 0)), nm = Math.max(0, Math.min(40, +r.m || 0));
  const cols = 8, filas = 6;
  const bailarines = [];
  for (let i = 0; i < nf; i++) bailarines.push({ id: uid('b'), genero: 'F', color: COLORES[i % 5], nombre: '' });
  for (let i = 0; i < nm; i++) bailarines.push({ id: uid('b'), genero: 'M', color: COLORES[5 + i % 5], nombre: '' });
  bailarines.forEach((b, i) => b.etiqueta = String(i + 1));
  const c = {
    id: uid('c'), titulo: (r.titulo || '').trim() || 'Nueva coreografía', categoria: CATEGORIAS.includes(r.categoria) ? r.categoria : 'Adulto',
    creadaEn: Date.now(), actualizadoEn: Date.now(), sellada: false,
    escenario: { cols, filas },
    musica: { bpm: 120, offset: 0, medida: 4, picos: [], duracion: 0, url: '', path: '', nombre: '' },
    duracionSinMusica: 128,
    video: null,
    bailarines,
    formaciones: [{ id: uid('f'), beat: 0, nombre: 'Inicio', transicion: 8, pos: formacionFilas(bailarines, cols, filas) }]
  };
  try {
    await S.st.guardarCoreo(c); await abrirCoreo(c.id);
    if (r.pista && S.coreo?.id === c.id) subirPista(r.pista);
  }
  catch (e) { toast('No se pudo crear: ' + e.message, true); }
}

function formacionFilas(bailarines, cols, filas) {
  const pos = {}; const porFila = Math.max(1, cols - 1);
  const nFilas = Math.ceil(bailarines.length / porFila);
  bailarines.forEach((b, i) => {
    const fila = Math.floor(i / porFila), enFila = Math.min(porFila, bailarines.length - fila * porFila), k = i - fila * porFila;
    pos[b.id] = { x: cols / 2 + (k - (enFila - 1) / 2), y: filas / 2 + (fila - (nFilas - 1) / 2) };
  });
  return pos;
}

/* ── Panel del coreógrafo en la lista: solicitudes y alumnas autorizadas ── */
let _tipoAut = 'mail';
function renderPanelAdmin() {
  const p = $('#panel-admin');
  if (!S.sesion || S.sesion.rol !== 'coreografo') { p.hidden = true; return; }
  p.hidden = false;
  const aut = S.autorizados.slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  p.innerHTML = `
    <section>
      <h2>Solicitudes de cambio ${S.solicitudes.length ? `<span class="badge">${S.solicitudes.length}</span>` : ''}</h2>
      ${htmlSolicitudes(S.solicitudes)}
    </section>
    <section>
      <h2>Alumnas autorizadas</h2>
      <p class="nota">Solo quien esté en esta lista puede entrar a ver las coreografías de su categoría.</p>
      <form id="f-aut" class="form-grid">
        <div class="seg" role="group" aria-label="Tipo de acceso">
          <button type="button" data-tipo="mail" aria-pressed="${_tipoAut === 'mail'}">Correo Google</button>
          <button type="button" data-tipo="tel" aria-pressed="${_tipoAut === 'tel'}">Celular</button>
        </div>
        <input name="valor" required ${_tipoAut === 'tel' ? 'type="tel" inputmode="tel" placeholder="300 123 4567"' : 'type="email" placeholder="alumna@gmail.com"'} aria-label="Correo o celular">
        <input name="nombre" placeholder="Nombre de la alumna" maxlength="50" aria-label="Nombre">
        <div class="checks">${CATEGORIAS.map(c => `<label><input type="checkbox" name="cat" value="${c}"> ${c}</label>`).join('')}</div>
        <button class="btn btn-primario" type="submit">Autorizar</button>
      </form>
      <div style="margin-top:10px">
        ${aut.length ? aut.map(a => `
          <div class="item">
            <div class="item-txt"><b>${esc(a.nombre || a.clave.replace(/^\w+:/, ''))}</b>
              <small>${esc(a.clave.replace(/^\w+:/, ''))} · ${esc((a.categorias || []).join(', ') || 'sin categoría')}</small></div>
            <button class="btn btn-mini btn-peligro" data-quitar-aut="${esc(a.clave)}" type="button">Quitar</button>
          </div>`).join('') : '<p class="nota">Nadie autorizado todavía.</p>'}
      </div>
    </section>`;
  p.onclick = async e => {
    const t = e.target.closest('[data-tipo]'); if (t) { _tipoAut = t.dataset.tipo; renderPanelAdmin(); return; }
    const q = e.target.closest('[data-quitar-aut]');
    if (q && await confirmar('Quitar acceso', 'Esta persona ya no podrá ver las coreografías.', 'Quitar', true)) {
      try { await S.st.borrarAutorizado(q.dataset.quitarAut); } catch (er) { toast(er.message, true); }
      return;
    }
    manejarSolicitudClick(e);
  };
  $('#f-aut').onsubmit = async e => {
    e.preventDefault();
    const f = e.target; const valor = f.valor.value.trim();
    const cats = [...f.querySelectorAll('[name=cat]:checked')].map(x => x.value);
    if (!valor) return;
    if (!cats.length) return toast('Elige al menos una categoría.', true);
    const clave = claveDe(_tipoAut, valor);
    try { await S.st.guardarAutorizado(clave, { nombre: f.nombre.value.trim(), categorias: cats, creadoEn: Date.now() }); toast('Autorizada ✓'); }
    catch (er) { toast('No se pudo guardar: ' + er.message, true); }
  };
}

function htmlSolicitudes(lista) {
  if (!lista.length) return '<p class="nota">No hay solicitudes pendientes.</p>';
  return lista.map(s => `
    <div class="item">
      <div class="item-txt"><b>${esc(s.nombreNuevo)}</b>
        <small>Quiere el circulito ${esc(s.etiqueta || '')}${s.nombreActual ? ` (hoy: ${esc(s.nombreActual)})` : ''} en “${esc(s.coreoTitulo || '')}”</small></div>
      <button class="btn btn-mini" data-sol="${esc(s.id)}" data-res="rechazada" type="button">No</button>
      <button class="btn btn-mini btn-primario" data-sol="${esc(s.id)}" data-res="aprobada" type="button">Aprobar</button>
    </div>`).join('');
}
async function manejarSolicitudClick(e) {
  const b = e.target.closest('[data-sol]'); if (!b) return;
  const s = S.solicitudes.find(x => x.id === b.dataset.sol); if (!s) return;
  b.disabled = true;
  try {
    if (b.dataset.res === 'aprobada') {
      const abierta = S.coreo && S.coreo.id === s.coreoId;
      const c = abierta ? S.coreo : await S.st.obtenerCoreo(s.coreoId);
      if (!c) throw new Error('La coreografía ya no existe.');
      if (c.sellada) { await S.st.resolverSolicitud(s.id, 'rechazada'); return toast('La coreografía está sellada: se conservan los nombres históricos.', true); }
      const bl = c.bailarines.find(x => x.id === s.bailarinId);
      if (!bl) throw new Error('Ese circulito ya no existe.');
      c.bailarines.forEach(x => { if (x.clave === s.clave) x.clave = null; });
      bl.nombre = s.nombreNuevo; bl.clave = s.clave;
      c.actualizadoEn = Date.now();
      if (abierta) { await guardarYa(); renderTodo(); } else await S.st.guardarCoreo(c);
    }
    await S.st.resolverSolicitud(s.id, b.dataset.res);
    toast(b.dataset.res === 'aprobada' ? 'Nombre actualizado ✓' : 'Solicitud rechazada');
  } catch (er) { toast(er.message, true); b.disabled = false; }
}

/* ═══════════════ Abrir / cerrar coreografía ═══════════════ */
const esCoreografo = () => S.sesion?.rol === 'coreografo';
const modoAlumna = () => !esCoreografo() || S.vistaAlumna;
const puedeEditar = () => esCoreografo() && !S.vistaAlumna && S.coreo && !S.coreo.sellada;

async function abrirCoreo(id) {
  await cerrarCoreo();
  const c = await S.st.obtenerCoreo(id).catch(e => { toast('No se pudo abrir: ' + e.message, true); return null; });
  if (!c) { history.replaceState(null, '', location.pathname); return; }
  normalizar(c);
  S.coreo = c; S.sel = null; S.selForm = null; S.bucle = null; Motor.bucle = null;
  try { S.mio = localStorage.getItem('coreo_mio_' + id); } catch (_) { S.mio = null; }
  const propio = c.bailarines.find(b => b.clave && b.clave === S.sesion.clave); if (propio) S.mio = propio.id;
  S.tab = 'bailarines'; S.analisis = null; S.ajusteVideo = false;
  history.replaceState(null, '', '#c=' + encodeURIComponent(id));
  mostrar('#v-editor');
  $('#sw-vista').hidden = !esCoreografo();
  $('#chk-vista-alumna').checked = S.vistaAlumna;
  await cargarMedios();
  if (!esCoreografo()) S.unsubCoreo = S.st.escucharCoreo(id, remoto => { if (remoto) aplicarRemoto(remoto); });
  renderTodo();
  requestAnimationFrame(() => { ajustarLinea(); S.sucio = true; });
}

function normalizar(c) {
  c.escenario = c.escenario || { cols: 8, filas: 6 };
  c.musica = Object.assign({ bpm: 120, offset: 0, medida: 4, picos: [], duracion: 0, url: '', path: '', nombre: '' }, c.musica || {});
  c.bailarines = c.bailarines || []; c.formaciones = c.formaciones || [];
  c.formaciones.forEach(f => { f.pos = f.pos || {}; if (f.transicion == null) f.transicion = 8; });
  c.duracionSinMusica = c.duracionSinMusica || 128;
}

async function aplicarRemoto(remoto) {
  normalizar(remoto);
  const antes = S.coreo;
  S.coreo = remoto;
  if (antes.musica.url !== remoto.musica.url || JSON.stringify(antes.video) !== JSON.stringify(remoto.video)) await cargarMedios();
  else aplicarTempo();
  renderTodo();
}

async function cerrarCoreo() {
  if (_tGuardar) await guardarYa();
  if (S.unsubCoreo) { S.unsubCoreo(); S.unsubCoreo = null; }
  Motor.pausar(); Motor.bucle = null; S.ent.on = false;
  const v = $('#video'); v.pause(); v.removeAttribute('src'); v.load();
  quitarYT();
  S.coreo = null;
}

async function cargarMedios() {
  const c = S.coreo;
  const url = c.musica.url ? await S.st.resolverUrl(c.musica.url) : null;
  await Motor.cargarUrl(url);
  if (url && (Motor.audio.error || !isFinite(Motor.audio.duration))) {
    Motor.tieneAudio = false;
    toast('No se pudo cargar la pista en este equipo.', true);
  }
  aplicarTempo();
  Motor.ir(0);
  const v = $('#video');
  const yt = c.video?.yt || null;
  const vurl = !yt && c.video?.url ? await S.st.resolverUrl(c.video.url) : null;
  if (vurl) { v.src = vurl; v.muted = !S.videoSonido; } else { v.removeAttribute('src'); v.load(); }
  v.hidden = !!yt;
  if (yt) prepararYT(yt); else quitarYT();
  $('#video-wrap').hidden = !(vurl || yt) || !S.videoVisible;
}

/* ── Video de YouTube (enlace «no listado»): se controla con la API del reproductor ── */
let _ytApi = null;
function cargarApiYT() {
  if (_ytApi) return _ytApi;
  _ytApi = new Promise(ok => {
    if (window.YT && YT.Player) return ok();
    const previo = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previo && previo(); ok(); };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
  });
  return _ytApi;
}
async function prepararYT(id) {
  if (S.yt && S.yt.id === id) return;
  quitarYT();
  const caja = document.createElement('div'); caja.id = 'yt-player';
  $('#video-wrap').insertBefore(caja, $('#video-info'));
  S.yt = { id, player: null, listo: false, ultSeek: 0 };
  const yo = S.yt;
  await cargarApiYT();
  if (S.yt !== yo) return;
  yo.player = new YT.Player('yt-player', {
    videoId: id,
    playerVars: { playsinline: 1, rel: 0, modestbranding: 1, controls: 1, disablekb: 1 },
    events: { onReady: e => { yo.listo = true; S.videoSonido ? e.target.unMute() : e.target.mute(); S.sucio = true; } }
  });
}
function quitarYT() {
  if (S.yt && S.yt.player) { try { S.yt.player.destroy(); } catch (_) {} }
  S.yt = null;
  const r = $('#yt-player'); if (r) r.remove();
}
function idYouTube(url) {
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}
function sincronizarYT(t) {
  const c = S.coreo, y = S.yt, p = y && y.listo && y.player;
  if (!p || $('#video-wrap').hidden || S.ajusteVideo) return;
  const rv = c.video.ritmo || 1, objetivo = (t - (c.video.offset || 0)) / rv, dur = p.getDuration() || Infinity;
  const info = $('#video-info'), ahora = performance.now(), estado = p.getPlayerState();
  if (objetivo < 0 || objetivo > dur) {
    if (estado === 1) p.pauseVideo();
    info.textContent = objetivo < 0 ? 'El video empieza en ' + fmtT(c.video.offset) : 'Fin del video';
    return;
  }
  info.textContent = '';
  if (Motor.tocando) {
    if (Math.abs(p.getPlaybackRate() - Motor.vel / rv) > .01) p.setPlaybackRate(Motor.vel / rv);
    if (estado !== 1 && estado !== 3) { if (ahora - y.ultSeek > 600) { p.seekTo(objetivo, true); p.playVideo(); y.ultSeek = ahora; } }
    else if (Math.abs(p.getCurrentTime() - objetivo) > 0.4 && ahora - y.ultSeek > 1500) { p.seekTo(objetivo, true); y.ultSeek = ahora; }
  } else {
    if (Math.abs(p.getCurrentTime() - objetivo) > 0.08 && ahora - y.ultSeek > 200) { p.seekTo(objetivo, true); y.ultSeek = ahora; }
    if (estado === 1 || estado === 3) p.pauseVideo();
  }
}

function aplicarTempo() {
  const m = S.coreo.musica;
  Motor.tempo = { bpm: Math.max(20, +m.bpm || 120), offset: +m.offset || 0, medida: +m.medida || 4, unidad: +m.unidad || 4, grupo: +m.grupo || 8 };
  actualizarTextosGrupo();
  Motor.duracion = Motor.tieneAudio && m.duracion ? m.duracion : (Motor.tieneAudio && isFinite(Motor.audio.duration) ? Motor.audio.duration : S.coreo.duracionSinMusica);
  Motor._reiniciarMet();
  if (S.bucle) ponerBucle(true);
  S.sucio = true;
}

/* ── Guardado (solo coreógrafo) ── */
let _tGuardar = null;
function estadoGuardado(t, err, boton) {
  const e = $('#estado-guardado'); e.textContent = t; e.classList.toggle('err', !!err);
  const b = $('#btn-guardar'); b.dataset.estado = boton || '';
  b.querySelector('span').textContent = boton === 'ok' ? 'Guardado' : boton === 'guardando' ? 'Guardando…' : 'Guardar';
}
function textoGuardado() { return 'Guardado ' + fmtFecha(S.coreo.actualizadoEn); }
function cambio() {
  if (!esCoreografo() || !S.coreo) return;
  S.coreo.actualizadoEn = Date.now(); S.sucio = true;
  estadoGuardado('Cambios sin guardar…', false, 'pendiente');
  clearTimeout(_tGuardar); _tGuardar = setTimeout(guardarYa, 900);
}
async function guardarYa() {
  clearTimeout(_tGuardar); _tGuardar = null;
  if (!S.coreo) return;
  estadoGuardado('Guardando…', false, 'guardando');
  try { await S.st.guardarCoreo(S.coreo); if (S.coreo) estadoGuardado(textoGuardado(), false, 'ok'); return true; }
  catch (e) { estadoGuardado('Sin guardar', true, 'pendiente'); toast('No se pudo guardar: ' + e.message, true); return false; }
}
window.addEventListener('beforeunload', e => { if (_tGuardar) { guardarYa(); e.preventDefault(); e.returnValue = ''; } });

/* ═══════════════ Tiempo musical ═══════════════ */
const spb = () => 60 / Motor.tempo.bpm;
const beatDeT = t => (t - Motor.tempo.offset) / spb();
const tDeBeat = b => Motor.tempo.offset + b * spb();
const formsOrd = () => S.coreo.formaciones.slice().sort((a, b) => a.beat - b.beat);
const EPS = 1e-3;
const suave = u => 0.5 - Math.cos(Math.PI * u) / 2;
// Conteos: grupos de G tiempos (8 = "ochos"; en 3/4 suele contarse de 6, etc.)
const G = () => Motor.tempo.grupo || 8;
const nombreGrupo = () => G() === 8 ? 'Ocho' : 'Grupo';
function nombreBeat(b) {
  const r = Math.round(b);
  return r < 0 ? `Intro ${r}` : `${nombreGrupo()} ${Math.floor(r / G()) + 1} · ${mod(r, G()) + 1}`;
}
// Compás sugerido → tamaño del grupo de conteo
function grupoSugerido(n) {
  if (8 % n === 0) return 8;
  if (n >= 6) return n;
  return n * 2;
}
function actualizarTextosGrupo() {
  const g = G();
  document.querySelector('[data-acc="atras"]').textContent = '−' + g;
  document.querySelector('[data-acc="adelante"]').textContent = '+' + g;
  document.querySelector('[data-acc="atras"]').setAttribute('aria-label', `Retroceder ${g} tiempos`);
  document.querySelector('[data-acc="adelante"]').setAttribute('aria-label', `Avanzar ${g} tiempos`);
  $('#btn-bucle').textContent = g === 8 ? 'Repetir ocho' : `Repetir ${g} tiempos`;
  document.querySelector('.conteo-ocho .eti').textContent = nombreGrupo();
}

function posicionesEn(beat) {
  const F = formsOrd(); const res = {};
  const { cols, filas } = S.coreo.escenario;
  for (const d of S.coreo.bailarines) {
    let prev = null, next = null;
    for (const f of F) { if (!f.pos[d.id]) continue; if (f.beat <= beat + EPS) prev = f; else { next = f; break; } }
    let p;
    if (!prev && !next) p = { x: cols / 2, y: filas / 2 };
    else if (!prev) p = next.pos[d.id];
    else if (!next) p = prev.pos[d.id];
    else {
      const tr = Math.max(0.0001, Math.min(next.transicion ?? 8, next.beat - prev.beat));
      const ini = next.beat - tr;
      if (beat <= ini) p = prev.pos[d.id];
      else {
        const u = suave(Math.min(1, (beat - ini) / tr)), a = prev.pos[d.id], b = next.pos[d.id];
        p = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
      }
    }
    res[d.id] = { x: p.x, y: p.y };
  }
  return res;
}
function siguientesPos(beat) {
  const F = formsOrd(); const res = {};
  for (const d of S.coreo.bailarines) {
    const next = F.find(f => f.beat > beat + EPS && f.pos[d.id]);
    if (next) res[d.id] = next.pos[d.id];
  }
  return res;
}
function formacionActual(beat) {
  const F = formsOrd(); let prev = null, next = null;
  for (const f of F) { if (f.beat <= beat + EPS) prev = f; else { next = f; break; } }
  return { prev, next };
}

function asegurarFormacionAqui() {
  const b = Math.round(beatDeT(Motor.tiempo()));
  let f = S.coreo.formaciones.find(x => Math.abs(x.beat - b) < EPS);
  if (!f) {
    const pos = posicionesEn(b);
    const { prev } = formacionActual(b);
    f = { id: uid('f'), beat: b, nombre: 'Formación ' + (S.coreo.formaciones.length + 1), transicion: Math.min(8, prev ? b - prev.beat : 8) || 8, pos };
    S.coreo.formaciones.push(f);
    Motor.ir(tDeBeat(b));
    cambio();
  }
  S.selForm = f.id;
  return f;
}

/* ═══════════════ Escenario ═══════════════ */
// Cuadrícula: tamaño del cuadro en unidades del escenario (2 = cuadros grandes … 0.25 = muy finos)
const DIVISIONES = [[2, 'Grande'], [1, 'Normal'], [0.5, 'Fina'], [0.25, 'Muy fina']];
const TAMANOS_B = [[0.6, 'S'], [0.8, 'M'], [1, 'L'], [1.25, 'XL']];
const division = () => S.coreo.escenario.division || 1;
const escalaB = () => S.coreo.escenario.tamB || 1;

function lineasCuadricula(W, H, cols, filas) {
  const d = division(); let g = '';
  const linea = (x1, y1, x2, y2, tipo) => {
    const st = tipo === 'centro' ? 'stroke="#3d4354" stroke-width="3" stroke-dasharray="10 10"'
      : tipo === 'mayor' ? 'stroke="#272b36" stroke-width="2"' : 'stroke="#222632" stroke-width="1.5"';
    g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${st}/>`;
  };
  const tipoDe = (v, total) => Math.abs(v - total / 2) < 1e-6 ? 'centro' : Math.abs(v - Math.round(v)) < 1e-6 && (d < 1 || Math.round(v) % d === 0) ? 'mayor' : 'menor';
  for (let v = d; v < cols - 1e-6; v += d) linea(v * U, 0, v * U, H, tipoDe(v, cols));
  for (let v = d; v < filas - 1e-6; v += d) linea(0, v * U, W, v * U, tipoDe(v, filas) === 'centro' ? 'mayor' : tipoDe(v, filas));
  if (cols % (2 * d) !== 0 && d > 1) linea(cols / 2 * U, 0, cols / 2 * U, H, 'centro');   // el centro siempre se marca
  return g;
}

function renderBarraEscenario() {
  const bar = $('#esc-barra'); const ed = puedeEditar();
  bar.hidden = !ed;
  if (!ed) return;
  const d = division(), t = escalaB();
  bar.innerHTML = `
    <div class="esc-grupo"><span>Cuadrícula</span><div class="seg seg-mini" role="group" aria-label="Tamaño de la cuadrícula">
      ${DIVISIONES.map(([v, n]) => `<button type="button" data-div="${v}" aria-pressed="${v === d}">${n}</button>`).join('')}</div></div>
    <div class="esc-grupo"><span>Circulitos</span><div class="seg seg-mini" role="group" aria-label="Tamaño de los circulitos">
      ${TAMANOS_B.map(([v, n]) => `<button type="button" data-tamb="${v}" aria-pressed="${v === t}">${n}</button>`).join('')}</div></div>
    <label class="esc-grupo esc-check"><input type="checkbox" id="chk-iman" ${S.iman ? 'checked' : ''}> <span>Imán</span></label>`;
  bar.onclick = e => {
    const dv = e.target.closest('[data-div]'), tb = e.target.closest('[data-tamb]');
    if (dv) { S.coreo.escenario.division = +dv.dataset.div; cambio(); renderEscenario(); }
    else if (tb) { S.coreo.escenario.tamB = +tb.dataset.tamb; cambio(); renderEscenario(); }
  };
  $('#chk-iman').onchange = e => { S.iman = e.target.checked; renderPanelSiTab('formaciones'); };
}

function renderEscenario() {
  const svg = $('#escenario'); const { cols, filas } = S.coreo.escenario;
  const W = cols * U, H = filas * U;
  svg.setAttribute('viewBox', `-30 -56 ${W + 60} ${H + 140}`);
  const g = lineasCuadricula(W, H, cols, filas);
  renderBarraEscenario();
  svg.innerHTML = `
    <text x="${W / 2}" y="-20" text-anchor="middle" fill="#6f7586" font-size="22" font-weight="700" letter-spacing="6">FONDO</text>
    <rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="#121419" stroke="#2c303c" stroke-width="3"/>
    ${g}
    <rect x="0" y="${H - 6}" width="${W}" height="6" fill="#f2c230" opacity=".55"/>
    <text x="${W / 2}" y="${H + 62}" text-anchor="middle" fill="#a4a9b8" font-size="30" font-weight="800" letter-spacing="10">PÚBLICO</text>
    <g id="capa-tray"></g><g id="capa-b"></g>`;
  const capa = svg.querySelector('#capa-b');
  capa.innerHTML = S.coreo.bailarines.map(b => `
    <g class="bailarin" data-id="${esc(b.id)}">
      <circle class="halo" r="48" fill="none" stroke="#f2c230" stroke-width="5"/>
      <circle class="sel-anillo" r="42" fill="none" stroke="#eceef3" stroke-width="3" stroke-dasharray="8 6"/>
      <circle r="32" fill="${esc(b.color)}" stroke="rgba(0,0,0,.35)" stroke-width="2"/>
      <path d="${SIMBOLO[b.genero === 'M' ? 'M' : 'F']}" fill="none" stroke="rgba(10,11,15,.85)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <text y="62" text-anchor="middle" font-size="24" font-weight="700" fill="#eceef3" stroke="#0e0f13" stroke-width="6" paint-order="stroke">${esc(b.nombre || b.etiqueta || '')}</text>
    </g>`).join('');
  svg.classList.toggle('puede-editar', !!puedeEditar());
  S.elsB = {}; capa.querySelectorAll('.bailarin').forEach(el => S.elsB[el.dataset.id] = el);
  marcarSeleccion();
  S.sucio = true;
}
function marcarSeleccion() {
  if (!S.elsB) return;
  const mioActivo = modoAlumna() && S.mio && S.elsB[S.mio];
  for (const [id, el] of Object.entries(S.elsB)) {
    el.classList.toggle('sel', id === S.sel);
    el.classList.toggle('mio', !!mioActivo && id === S.mio);
    el.classList.toggle('atenuado', !!mioActivo && id !== S.mio);
  }
}
function pintarPosiciones(beat) {
  const pos = posicionesEn(beat);
  const esc_ = escalaB();
  for (const [id, p] of Object.entries(pos)) { const el = S.elsB?.[id]; if (el) el.setAttribute('transform', `translate(${p.x * U} ${p.y * U}) scale(${esc_})`); }
  const capa = $('#capa-tray'); if (!capa) return;
  if (!S.trayectorias) { capa.innerHTML = ''; return; }
  const sig = siguientesPos(beat); let h = '';
  for (const [id, q] of Object.entries(sig)) {
    const p = pos[id]; if (!p || (Math.abs(p.x - q.x) < .01 && Math.abs(p.y - q.y) < .01)) continue;
    if (modoAlumna() && S.mio && id !== S.mio) continue;
    const col = S.coreo.bailarines.find(b => b.id === id)?.color || '#fff';
    h += `<line x1="${p.x * U}" y1="${p.y * U}" x2="${q.x * U}" y2="${q.y * U}" stroke="${esc(col)}" stroke-width="4" stroke-dasharray="6 9" opacity=".55" stroke-linecap="round"/>
          <circle cx="${q.x * U}" cy="${q.y * U}" r="14" fill="none" stroke="${esc(col)}" stroke-width="4" opacity=".6"/>`;
  }
  capa.innerHTML = h;
}

function iniciarEscenario() {
  const svg = $('#escenario');
  const punto = ev => { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  svg.onpointerdown = ev => {
    const g = ev.target.closest('.bailarin');
    if (!g) { if (S.sel) { S.sel = null; marcarSeleccion(); renderPanel(); } return; }
    const id = g.dataset.id;
    S.sel = id; marcarSeleccion();
    if (S.tab !== 'bailarines') S.tab = 'bailarines';
    renderPanel();
    if (!puedeEditar()) return;
    ev.preventDefault();
    Motor.pausar(); pintarPlay();
    const f = asegurarFormacionAqui();
    const p0 = punto(ev); const actual = posicionesEn(f.beat)[id];
    S.arrastre = { id, f, dx: actual.x - p0.x / U, dy: actual.y - p0.y / U, movio: false };
    g.classList.add('arrastrando');
    svg.setPointerCapture(ev.pointerId);
  };
  svg.onpointermove = ev => {
    const a = S.arrastre; if (!a) return;
    const p = punto(ev); const { cols, filas } = S.coreo.escenario;
    let x = p.x / U + a.dx, y = p.y / U + a.dy;
    // Imán: a las líneas y centros de la cuadrícula elegida (medio cuadro)
    if (S.iman) { const paso = division() / 2; x = Math.round(x / paso) * paso; y = Math.round(y / paso) * paso; }
    else { x = Math.round(x * 100) / 100; y = Math.round(y * 100) / 100; }
    x = Math.max(0.1, Math.min(cols - 0.1, x)); y = Math.max(0.1, Math.min(filas - 0.1, y));
    const prev = a.f.pos[a.id];
    if (!prev || prev.x !== x || prev.y !== y) { a.f.pos[a.id] = { x, y }; a.movio = true; S.sucio = true; }
  };
  const fin = () => {
    const a = S.arrastre; if (!a) return;
    S.arrastre = null; S.elsB?.[a.id]?.classList.remove('arrastrando');
    if (a.movio) cambio();
    renderPanel();
  };
  svg.onpointerup = fin; svg.onpointercancel = fin;
}

/* ═══════════════ Conteo y transporte ═══════════════ */
function renderConteo() {
  const cel = $('#cnt-celdas'); const med = Motor.tempo.medida, g = G();
  cel.style.gridTemplateColumns = `repeat(${g}, minmax(0, 40px))`; cel.classList.toggle("muchas", g > 10);
  cel.style.setProperty('--n', g);
  cel.innerHTML = Array.from({ length: g }, (_, i) => `<div class="celda${i % med === 0 ? ' compas' : ''}">${i + 1}</div>`).join('');
  S.ultimoBeat = null;
}
function pintarConteo(beat) {
  const b = Math.floor(beat + 1e-6);
  if (b === S.ultimoBeat) return;
  S.ultimoBeat = b;
  $('#cnt-ocho').textContent = b < 0 ? 'Intro' : Math.floor(b / G()) + 1;
  const i = mod(b, G());
  [...$('#cnt-celdas').children].forEach((c, k) => { const on = b >= 0 && k === i; c.classList.toggle('on', on); c.classList.toggle('uno', on && k === 0); });
  const { prev, next } = formacionActual(beat);
  let t = '';
  if (prev) t = `<b>${esc(prev.nombre)}</b>`;
  if (next) {
    const tr = Math.min(next.transicion ?? 8, next.beat - (prev ? prev.beat : -Infinity));
    const faltan = Math.ceil(next.beat - beat - 1e-6);
    t += (t ? ' → ' : '') + `${esc(next.nombre)} <span class="muted">${faltan <= tr ? `(llegan en ${faltan})` : `(en ${faltan} tiempos)`}</span>`;
  }
  $('#cnt-form').innerHTML = t || '<span class="muted">Sin formaciones</span>';
}
function pintarPlay() {
  const b = $('#btn-play'); b.innerHTML = Motor.tocando ? ICO_PAUSA : ICO_PLAY;
  b.setAttribute('aria-label', Motor.tocando ? 'Pausar' : 'Reproducir');
}
/* ── Metrónomo: encendido, luz y entrenador de velocidad ── */
function alternarMet(on) {
  Motor.met.on = on; Motor._asegurarCtx(); Motor._reiniciarMet();
  $('#btn-met').setAttribute('aria-pressed', String(on));
  if (!on) $('#met-luz').className = 'met-luz';
  else if (!Motor.tocando) toast('Metrónomo listo: dale ▶ para oírlo con la coreografía.');
  renderPanelSiTab('musica');
}
function mostrarVel(v) {
  const sel = $('#sel-vel'); const val = String(Math.round(v * 100) / 100);
  if (![...sel.options].some(o => o.value === val)) {
    const o = document.createElement('option'); o.value = val; o.textContent = Math.round(v * 100) + '%';
    const despues = [...sel.options].find(x => +x.value > v); sel.insertBefore(o, despues || null);
  }
  sel.value = val;
}
// Luz: se enciende al inicio de cada tiempo; otro color en el 1 y en el inicio de compás
function pintarLuz(beat) {
  const luz = $('#met-luz');
  if (!Motor.met.on || !Motor.met.luz || !Motor.tocando) { if (luz.className !== 'met-luz') luz.className = 'met-luz'; return; }
  const b = Math.floor(beat + 1e-6), frac = beat - b;
  const tipo = Motor.tipoTiempo(b);
  const clase = frac < 0.18 ? 'met-luz on t' + tipo : 'met-luz';
  if (luz.className !== clase) luz.className = clase;
}

S.ent = { on: false, desde: 60, paso: 5, cada: 2, meta: 100, reps: 0 };
function iniciarEntrenador() {
  const e = S.ent;
  e.on = true; e.reps = 0;
  Motor.ponerVelocidad(e.desde / 100); mostrarVel(e.desde / 100);
  if (!S.bucle) ponerBucle(true);
  if (!Motor.tocando) Motor.reproducir().then(pintarPlay);
  toast(`Practicando al ${e.desde}%: sube ${e.paso}% cada ${e.cada} ${e.cada === 1 ? 'vuelta' : 'vueltas'}`);
  renderPanelSiTab('musica');
}
function pararEntrenador(msg) {
  if (!S.ent.on) return;
  S.ent.on = false; if (msg) toast(msg); renderPanelSiTab('musica');
}
function alRepetirTramo() {
  const e = S.ent; if (!e.on) return;
  e.reps++;
  const actual = Math.round(Motor.vel * 100);
  if (e.reps % e.cada === 0 && actual < e.meta) {
    const nv = Math.min(e.meta, actual + e.paso);
    Motor.ponerVelocidad(nv / 100); mostrarVel(nv / 100);
    toast(nv >= e.meta ? `¡Llegaste al ${nv}%! Sigue repitiendo para afianzarlo.` : `Subiendo a ${nv}%`);
  }
  const est = document.querySelector('#ent-estado');
  if (est) est.textContent = textoEntrenador();
}
function textoEntrenador() {
  const e = S.ent;
  return e.on ? `Vuelta ${e.reps + 1} · velocidad ${Math.round(Motor.vel * 100)}% → meta ${e.meta}%` : '';
}

function ponerBucle(on) {
  if (!on && S.ent?.on) pararEntrenador('Entrenador detenido.');
  S.bucle = on;
  if (on) {
    const g = G(); const o = Math.floor(Math.floor(beatDeT(Motor.tiempo()) + 1e-6) / g) * g;
    Motor.bucle = { a: Math.max(0, tDeBeat(o)), b: Math.min(Motor.duracion, tDeBeat(o + g)) };
  } else Motor.bucle = null;
  $('#btn-bucle').setAttribute('aria-pressed', String(!!on));
  S.sucio = true;
}
function saltar(beats) {
  const b = Math.floor(beatDeT(Motor.tiempo()) + 1e-6);
  const g = G();
  const destino = beats === 'grupo+' ? (Math.floor(b / g) + 1) * g
    : beats === 'grupo-' ? (mod(b, g) === 0 || b < 0 ? Math.floor(b / g) - 1 : Math.floor(b / g)) * g
    : b + beats;
  Motor.ir(tDeBeat(destino)); if (S.bucle) ponerBucle(true); S.sucio = true;
}
function iniciarTransporte() {
  pintarPlay();
  document.querySelector('.transporte').onclick = e => {
    const b = e.target.closest('[data-acc]'); if (!b) return;
    const a = b.dataset.acc;
    if (a === 'play') { Motor.tocando ? Motor.pausar() : Motor.reproducir().then(pintarPlay); }
    else if (a === 'inicio') { Motor.ir(S.bucle ? Motor.bucle.a : 0); }
    else if (a === 'atras') saltar('grupo-');
    else if (a === 'adelante') saltar('grupo+');
    else if (a === 'bucle') ponerBucle(!S.bucle);
    else if (a === 'met') alternarMet(!Motor.met.on);
    pintarPlay(); S.sucio = true;
  };
  $('#sel-vel').onchange = e => { Motor.ponerVelocidad(+e.target.value); if (S.ent.on) pararEntrenador('Entrenador detenido: cambiaste la velocidad a mano.'); };
  Motor.alRepetir = alRepetirTramo;
  Motor.alTerminar = pintarPlay;
  Motor.audio.addEventListener('pause', pintarPlay);
  document.addEventListener('keydown', e => {
    if (!S.coreo || $('#v-editor').hidden || e.target.closest?.('input, select, textarea, dialog')) return;
    if (e.code === 'Space') { e.preventDefault(); Motor.tocando ? Motor.pausar() : Motor.reproducir().then(pintarPlay); pintarPlay(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); saltar(e.shiftKey ? 'grupo+' : 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); saltar(e.shiftKey ? 'grupo-' : -1); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && S.selForm && puedeEditar()) { e.preventDefault(); borrarFormacion(); }
    else if (e.key === 'Escape' && S.selForm) { S.selForm = null; renderPanelSiTab('formaciones'); S.sucio = true; }
  });
}

/* ═══════════════ Línea de tiempo ═══════════════ */
const LH = 148, FRANJA = 36, ONDA_Y = 80, ONDA_A = 32;
function ajustarLinea() {
  const sc = $('#linea-scroll'); if (!sc || !S.coreo) return;
  const W = sc.clientWidth;
  $('#linea-espacio').style.width = Math.max(W, Motor.duracion * S.pps + 60) + 'px';
  const cv = $('#linea-canvas'); const dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(LH * dpr); cv.style.width = W + 'px'; }
  S.sucio = true;
}
// Dónde cae cada formación en la línea: x del rombo, inicio de la transición (xi),
// tirador para alargarla (xh) y hasta dónde se mantiene (xFin, cuando empieza a moverse la siguiente)
function geoFormaciones(X, dur) {
  const F = formsOrd(), ed = puedeEditar();
  return F.map((f, i) => {
    const sig = F[i + 1], prevB = i ? F[i - 1].beat : -Infinity, tr = f.transicion ?? 8;
    const x = X(tDeBeat(f.beat)), xi = X(tDeBeat(Math.max(prevB, f.beat - tr)));
    const xFin = sig ? X(tDeBeat(sig.beat - Math.min(sig.transicion ?? 8, sig.beat - f.beat))) : X(dur);
    const sel = f.id === S.selForm, xPrev = i ? X(tDeBeat(prevB)) : -Infinity;
    // el tirador no puede quedar encima del rombo anterior ni del propio
    const xh = Math.min(Math.max(xi, xPrev + 12), x - 16);
    return { f, x, xi, xh, xFin, sel, tirador: ed && i > 0 && (tr > 0 || sel) };
  });
}
function dibujarLinea(t) {
  const sc = $('#linea-scroll'), cv = $('#linea-canvas');
  const W = sc.clientWidth, dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(W * dpr)) ajustarLinea();
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, LH);
  const pps = S.pps, x0 = sc.scrollLeft, dur = Motor.duracion;
  const X = s => s * pps - x0;
  // franja de formaciones
  ctx.fillStyle = '#161920'; ctx.fillRect(0, 0, W, FRANJA);
  // bucle
  if (Motor.bucle) { ctx.fillStyle = 'rgba(242,194,48,.08)'; ctx.fillRect(X(Motor.bucle.a), FRANJA, (Motor.bucle.b - Motor.bucle.a) * pps, LH - FRANJA); }
  // forma de onda
  const picos = S.coreo.musica.picos;
  if (Motor.tieneAudio && picos && picos.length) {
    const xFin = Math.min(W, X(dur));
    for (let px = Math.max(0, X(0)); px < xFin; px += 2) {
      const s = (x0 + px) / pps; const v = picos[Math.min(picos.length - 1, Math.floor(s / dur * picos.length))] / 100;
      const h = Math.max(1, v * ONDA_A);
      ctx.fillStyle = s <= t ? '#8b93ab' : '#3b4255';
      ctx.fillRect(px, ONDA_Y - h, 1.4, h * 2);
    }
  } else {
    ctx.fillStyle = '#20242e'; ctx.fillRect(Math.max(0, X(0)), ONDA_Y - 1, Math.min(W, X(dur)) - Math.max(0, X(0)), 2);
  }
  // tiempos y ochos
  const sp = spb(), pxB = sp * pps;
  const b0 = Math.floor((x0 / pps - Motor.tempo.offset) / sp) - 1, b1 = Math.ceil(((x0 + W) / pps - Motor.tempo.offset) / sp) + 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let b = b0; b <= b1; b++) {
    const s = tDeBeat(b); if (s < 0 || s > dur) continue;
    const x = Math.round(X(s)) + .5;
    const ocho = mod(b, G()) === 0;
    if (ocho) {
      ctx.fillStyle = '#4a5166'; ctx.fillRect(x - .5, FRANJA, 1.5, LH - FRANJA);
      ctx.fillStyle = b < 0 ? '#6f7586' : '#eceef3'; ctx.font = '800 12px Manrope, sans-serif';
      ctx.fillText(b < 0 ? 'i' : String(Math.floor(b / G()) + 1), x, LH - 12);
    } else if (pxB >= 6) {
      ctx.fillStyle = mod(b, Motor.tempo.medida) === 0 ? '#323849' : '#242832'; ctx.fillRect(x - .5, FRANJA, 1, LH - FRANJA - 24);
      if (pxB >= 18) { ctx.fillStyle = '#6f7586'; ctx.font = '600 10px Manrope, sans-serif'; ctx.fillText(String(mod(b, G()) + 1), x, LH - 12); }
    }
  }
  // formaciones: bloque (se mantiene) · barra de transición (se mueven) · tirador · rombo
  ctx.textBaseline = 'middle';
  for (const g of geoFormaciones(X, dur)) {
    const { f, x, xi, xh, xFin, sel } = g;
    if (xFin < -20 || Math.min(xi, xh) > W + 20) continue;
    ctx.fillStyle = sel ? 'rgba(236,238,243,.09)' : 'rgba(242,194,48,.07)';
    ctx.fillRect(x, 7, Math.max(0, xFin - x), 22);
    if (x - xi > 0.5) {
      const gr = ctx.createLinearGradient(xi, 0, x, 0);
      gr.addColorStop(0, 'rgba(242,194,48,.06)'); gr.addColorStop(1, sel ? 'rgba(236,238,243,.45)' : 'rgba(242,194,48,.45)');
      ctx.fillStyle = gr; ctx.fillRect(xi, 11, x - xi, 14);
    }
    if (g.tirador) {
      ctx.fillStyle = sel ? '#eceef3' : 'rgba(242,194,48,.75)';
      ctx.fillRect(Math.round(xh) - 1.5, 8, 3, 20);
      if (xh < xi - 1) { ctx.fillStyle = 'rgba(236,238,243,.35)'; ctx.fillRect(xh, 17.5, x - 8 - xh, 1); }
    }
    ctx.fillStyle = sel ? '#eceef3' : '#f2c230';
    ctx.beginPath(); ctx.moveTo(x, 9); ctx.lineTo(x + 8, 18); ctx.lineTo(x, 27); ctx.lineTo(x - 8, 18); ctx.closePath(); ctx.fill();
    const ancho = xFin - x - 14;
    if (ancho > 22) {
      ctx.save(); ctx.beginPath(); ctx.rect(x + 11, 0, ancho, FRANJA); ctx.clip();
      ctx.fillStyle = sel ? '#eceef3' : '#a4a9b8'; ctx.font = '700 11px Manrope, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(f.nombre, x + 12, 18.5); ctx.restore();
    }
  }
  if (S.etiLinea) {   // ayuda mientras se arrastra
    const x = X(tDeBeat(S.etiLinea.f.beat)); ctx.font = '700 11px Manrope, sans-serif'; ctx.textAlign = 'left';
    const w = ctx.measureText(S.etiLinea.txt).width + 14, xl = Math.max(4, Math.min(W - w - 4, x + 12));
    ctx.fillStyle = '#eceef3'; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(xl, FRANJA + 4, w, 20, 6); else ctx.rect(xl, FRANJA + 4, w, 20);
    ctx.fill();
    ctx.fillStyle = '#0e0f13'; ctx.fillText(S.etiLinea.txt, xl + 7, FRANJA + 14.5);
  }
  // cabezal
  const xp = X(t);
  ctx.fillStyle = '#f2c230'; ctx.fillRect(Math.round(xp) - 1, FRANJA - 2, 2, LH - FRANJA + 2);
}
function iniciarLinea() {
  const sc = $('#linea-scroll'), cv = $('#linea-canvas');
  sc.addEventListener('scroll', () => { S.sucio = true; }, { passive: true });
  let g = null;
  const franja = $('#linea-franja');
  const tEn = ev => (sc.scrollLeft + ev.clientX - cv.getBoundingClientRect().left) / S.pps;
  // Qué hay bajo el puntero en la franja de formaciones
  const zonaEn = ev => {
    if (!S.coreo) return null;
    const r = cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    if (y > FRANJA + 2) return null;
    const geo = geoFormaciones(s => s * S.pps - sc.scrollLeft, Motor.duracion);
    let mejor = null, d = 9;
    for (const q of geo) { const dd = Math.abs(q.x - x); if (dd < d) { d = dd; mejor = { f: q.f, modo: 'mover' }; } }
    if (mejor) return mejor;
    for (const q of geo) if (q.tirador && Math.abs(q.xh - x) < 8) return { f: q.f, modo: 'transicion' };
    for (const q of geo) if (x >= q.x && x <= q.xFin) return { f: q.f, modo: 'mover' };
    for (const q of geo) if (x >= q.xi && x < q.x) return { f: q.f, modo: 'mover' };
    return null;
  };
  const abajo = ev => {
    if (!S.coreo) return;
    const z = zonaEn(ev), enFranja = ev.currentTarget === franja;
    g = { x: ev.clientX, y: ev.clientY, z, f: z && z.f, enFranja, directo: ev.pointerType === 'mouse' || enFranja,
          b0: z ? z.f.beat : 0, t0: tEn(ev), tr0: z ? (z.f.transicion ?? 8) : 0, movio: false };
    if (!g.directo) return;
    ev.preventDefault(); ev.currentTarget.setPointerCapture(ev.pointerId);
    if (z) { S.selForm = z.f.id; if (z.modo === 'mover') Motor.ir(tDeBeat(z.f.beat)); renderPanelSiTab('formaciones'); }
    else { if (enFranja && S.selForm) { S.selForm = null; renderPanelSiTab('formaciones'); } Motor.ir(tEn(ev)); }
    S.sucio = true;
  };
  const mueve = ev => {
    if (!g) {
      const z = zonaEn(ev);
      ev.currentTarget.style.cursor = !z ? 'pointer' : z.modo === 'transicion' ? 'ew-resize' : puedeEditar() ? 'grab' : 'pointer';
      return;
    }
    if (!g.directo) return;
    if (Math.abs(ev.clientX - g.x) > 3) g.movio = true;
    if (g.f && puedeEditar()) {
      if (!g.movio) return;
      const db = Math.round(beatDeT(tEn(ev)) - beatDeT(g.t0));
      if (g.z.modo === 'transicion') {
        const F = formsOrd(), i = F.indexOf(g.f), prevB = i > 0 ? F[i - 1].beat : -Infinity;
        const nt = Math.max(0, Math.min(g.tr0 - db, g.f.beat - prevB, 64));
        if (nt !== (g.f.transicion ?? 8)) { g.f.transicion = nt; g.cambiado = true; }
        S.etiLinea = { f: g.f, txt: nt ? `Llegan en ${nt} ${nt === 1 ? 'tiempo' : 'tiempos'}` : 'Cambio inmediato' };
      } else {
        const nb = g.b0 + db;
        if (nb !== g.f.beat && !S.coreo.formaciones.some(o => o !== g.f && Math.abs(o.beat - nb) < EPS)) { g.f.beat = nb; g.cambiado = true; Motor.ir(tDeBeat(nb)); }
        S.etiLinea = { f: g.f, txt: nombreBeat(g.f.beat) };
        ev.currentTarget.style.cursor = 'grabbing';
      }
    } else if (!g.f) Motor.ir(tEn(ev));
    S.sucio = true;
  };
  const arriba = ev => {
    if (!g) return;
    if (!g.directo && Math.abs(ev.clientX - g.x) < 8 && Math.abs(ev.clientY - g.y) < 8) {
      if (g.f) { S.selForm = g.f.id; Motor.ir(tDeBeat(g.f.beat)); renderPanelSiTab('formaciones'); }
      else Motor.ir(tEn(ev));
    }
    if (g.cambiado) { cambio(); renderPanelSiTab('formaciones'); }
    if (S.bucle) ponerBucle(true);
    g = null; S.etiLinea = null; S.sucio = true;
  };
  [cv, franja].forEach(el => { el.onpointerdown = abajo; el.onpointermove = mueve; el.onpointerup = arriba; el.onpointercancel = () => { g = null; S.etiLinea = null; }; });
  franja.onpointerleave = () => { if (!g) franja.style.cursor = ''; };
  const rueda = e => {
    if (e.ctrlKey) { e.preventDefault(); zoom(e.deltaY < 0 ? 1 : -1); return; }
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); sc.scrollLeft += e.deltaY; }
    else if (e.currentTarget === franja) sc.scrollLeft += e.deltaX;
  };
  sc.addEventListener('wheel', rueda, { passive: false });
  franja.addEventListener('wheel', rueda, { passive: false });
  // Barra de la formación elegida (debajo de la línea)
  const fb = $('#form-barra');
  fb.onclick = async e => {
    const b = e.target.closest('[data-fb]'); if (!b || !puedeEditar()) return;
    const c = S.coreo, f = c.formaciones.find(x => x.id === S.selForm); if (!f) return;
    const a = b.dataset.fb;
    if (a === 'cerrar') { S.selForm = null; renderPanelSiTab('formaciones'); S.sucio = true; }
    else if (a === 'borrar') await borrarFormacion();
    else if (a === 'mover') {
      const nb = f.beat + (+b.dataset.d);
      if (c.formaciones.some(o => o !== f && Math.abs(o.beat - nb) < EPS)) return toast('Ya hay una formación en ese tiempo.', true);
      f.beat = nb; Motor.ir(tDeBeat(nb)); cambio(); renderPanelSiTab('formaciones'); S.sucio = true;
    }
    else if (a === 'copiar') {
      const nb = Math.round(beatDeT(Motor.tiempo()));
      if (c.formaciones.some(o => Math.abs(o.beat - nb) < EPS)) return toast('Mueve el cabezal a un tiempo sin formación para copiarla ahí.', true);
      const { prev } = formacionActual(nb);
      const n = { id: uid('f'), beat: nb, nombre: f.nombre + ' (copia)', transicion: Math.min(8, prev ? nb - prev.beat : 8) || 8, pos: JSON.parse(JSON.stringify(f.pos)) };
      c.formaciones.push(n); S.selForm = n.id; Motor.ir(tDeBeat(nb)); cambio(); renderPanelSiTab('formaciones'); S.sucio = true;
      toast('Formación copiada en ' + nombreBeat(nb));
    }
  };
  fb.onchange = e => {
    const el = e.target, f = S.coreo && S.coreo.formaciones.find(x => x.id === S.selForm); if (!f || !puedeEditar()) return;
    if (el.name === 'fb-nombre') { f.nombre = el.value.trim() || f.nombre; el.blur(); }
    else if (el.name === 'fb-tr') f.transicion = +el.value;
    cambio(); renderPanelSiTab('formaciones'); S.sucio = true;
  };
  fb.onkeydown = e => { if (e.key === 'Enter' && e.target.name === 'fb-nombre') e.target.blur(); };
  document.querySelector('.linea-zoom').onclick = e => { const b = e.target.closest('[data-zoom]'); if (b) zoom(+b.dataset.zoom); };
  window.addEventListener('resize', () => { if (S.coreo) ajustarLinea(); });
}
async function borrarFormacion() {
  const c = S.coreo, f = c && c.formaciones.find(x => x.id === S.selForm);
  if (!f || !puedeEditar()) return;
  if (!await confirmar(`Borrar «${f.nombre}»`, 'Los bailarines pasarán directo de la formación anterior a la siguiente.', 'Borrar', true)) return;
  c.formaciones = c.formaciones.filter(x => x.id !== f.id); S.selForm = null;
  cambio(); renderPanelSiTab('formaciones'); S.sucio = true; toast('Formación borrada');
}
// Barra con la formación elegida: se vuelve a pintar solo cuando algo cambia
function renderFormBarra() {
  const fb = $('#form-barra'), c = S.coreo;
  const f = c && puedeEditar() && c.formaciones.find(x => x.id === S.selForm);
  const clave = f ? [f.id, f.beat, f.transicion, f.nombre, G()].join('|') : '';
  if (clave === fb.dataset.clave) return;
  if (f && fb.dataset.id === f.id && document.activeElement && document.activeElement.name === 'fb-nombre') return;
  fb.dataset.clave = clave; fb.dataset.id = f ? f.id : '';
  fb.hidden = !f; if (!f) { fb.innerHTML = ''; return; }
  const tr = f.transicion ?? 8, ops = [0, 1, 2, 4, 6, 8, 12, 16, 24, 32];
  if (!ops.includes(tr)) { ops.push(tr); ops.sort((a, b) => a - b); }
  fb.innerHTML = `
    <span class="fb-rombo" aria-hidden="true"></span>
    <input name="fb-nombre" class="fb-nombre" value="${esc(f.nombre)}" maxlength="40" aria-label="Nombre de la formación">
    <span class="fb-cuando">${nombreBeat(f.beat)}</span>
    <label class="fb-tr">Llegan en <select name="fb-tr">${ops.map(n => `<option value="${n}" ${n === tr ? 'selected' : ''}>${n === 0 ? 'cambio inmediato' : n + (n === 1 ? ' tiempo' : ' tiempos')}</option>`).join('')}</select></label>
    <span class="espacio"></span>
    <button class="btn btn-mini" data-fb="mover" data-d="-1" type="button" aria-label="Un tiempo antes">−1</button>
    <button class="btn btn-mini" data-fb="mover" data-d="1" type="button" aria-label="Un tiempo después">+1</button>
    <button class="btn btn-mini" data-fb="copiar" type="button" title="Copia esta formación donde está el cabezal">Copiar al cabezal</button>
    <button class="btn btn-mini btn-peligro" data-fb="borrar" type="button">Borrar</button>
    <button class="btn-icono" data-fb="cerrar" type="button" aria-label="Cerrar">✕</button>`;
}
function zoom(dir) {
  const sc = $('#linea-scroll'); const t = Motor.tiempo();
  const xRel = t * S.pps - sc.scrollLeft;
  S.pps = Math.max(6, Math.min(320, S.pps * (dir > 0 ? 1.5 : 1 / 1.5)));
  ajustarLinea();
  sc.scrollLeft = t * S.pps - xRel;
}
function seguirCabezal(t) {
  const sc = $('#linea-scroll'); const W = sc.clientWidth; const x = t * S.pps - sc.scrollLeft;
  if (x > W * 0.85 || x < 0) sc.scrollLeft = t * S.pps - W * 0.25;
}

/* ═══════════════ Video sincronizado ═══════════════ */
function sincronizarVideo(t) {
  const v = $('#video'); const c = S.coreo;
  if (c.video?.yt) return sincronizarYT(t);
  if (!c.video || !v.src || $('#video-wrap').hidden || S.ajusteVideo) return;
  const rv = c.video.ritmo || 1, objetivo = (t - (c.video.offset || 0)) / rv;
  const dentro = objetivo >= 0 && (!isFinite(v.duration) || objetivo <= v.duration);
  const info = $('#video-info');
  if (!dentro) { if (!v.paused) v.pause(); info.textContent = objetivo < 0 ? 'El video empieza en ' + fmtT(c.video.offset) : 'Fin del video'; return; }
  info.textContent = '';
  if (Motor.tocando) {
    if (Math.abs(v.playbackRate - Motor.vel / rv) > .001) v.playbackRate = Motor.vel / rv;
    if (v.paused) { v.currentTime = objetivo; v.play().catch(() => {}); }
    else if (Math.abs(v.currentTime - objetivo) > 0.25) v.currentTime = objetivo;
  } else {
    if (!v.paused) v.pause();
    if (Math.abs(v.currentTime - objetivo) > 0.04 && !v.seeking) v.currentTime = objetivo;
  }
}

/* ═══════════════ Bucle de dibujo ═══════════════ */
function cuadro() {
  Motor.vigilar();
  if (S.coreo && !$('#v-editor').hidden) {
    const t = Motor.tiempo();
    if (t !== S.ultimoT || S.sucio || Motor.tocando) {
      const beat = beatDeT(t);
      pintarPosiciones(S.arrastre ? S.arrastre.f.beat : beat);
      pintarConteo(beat);
      pintarLuz(beat);
      if (Motor.tocando) seguirCabezal(t);
      dibujarLinea(t);
      $('#tiempo').textContent = fmtT(t);
      sincronizarVideo(t);
      renderFormBarra();
      S.ultimoT = t; S.sucio = false;
    } else if (S.yt && S.yt.listo) sincronizarYT(t);   // YouTube puede arrancar solo al buscar: mantenerlo en pausa
    if (!Motor.tocando && $('#btn-play').getAttribute('aria-label') === 'Pausar') pintarPlay();
  }
  requestAnimationFrame(cuadro);
}

/* ═══════════════ Encabezado del editor ═══════════════ */
function renderCabecera() {
  const c = S.coreo, ed = puedeEditar();
  const ti = $('#ed-titulo'); ti.value = c.titulo || ''; ti.readOnly = !ed;
  ti.onchange = () => { c.titulo = ti.value.trim() || 'Sin título'; cambio(); };
  const sel = $('#ed-cat'); sel.innerHTML = CATEGORIAS.map(k => `<option ${k === c.categoria ? 'selected' : ''}>${k}</option>`).join('');
  sel.disabled = !ed; sel.onchange = () => { c.categoria = sel.value; cambio(); };
  const se = $('#ed-sello'); se.hidden = !c.sellada;
  se.textContent = c.sellada ? 'Sellada' + (c.selladaEn ? ' · ' + new Date(c.selladaEn).toLocaleDateString('es-CO') : '') : '';
  $('#btn-guardar').hidden = !esCoreografo() || S.vistaAlumna;
  if (!esCoreografo() || S.vistaAlumna) estadoGuardado('Actualizada ' + fmtFecha(c.actualizadoEn));
  else if (!_tGuardar) estadoGuardado(textoGuardado(), false, 'ok');
}

// Botón de música y aviso en la línea de tiempo cuando aún no hay pista
function renderMusicaVisible() {
  const c = S.coreo, ed = puedeEditar(), sin = !c.musica.nombre;
  const bm = $('#btn-musica'); bm.hidden = !ed;
  bm.querySelector('span').textContent = sin ? 'Agregar música' : 'Cambiar música';
  const v = $('#linea-vacia');
  if (S.progreso?.tipo === 'pista') {
    v.hidden = false;
    v.innerHTML = `<div style="width:min(320px,80%)"><span>${esc(S.progreso.txt || 'Subiendo…')}</span><div class="progreso"><i style="width:${Math.round(S.progreso.v * 100)}%"></i></div></div>`;
    return;
  }
  v.hidden = !sin;
  v.innerHTML = ed
    ? '<span>Esta coreografía aún no tiene música.</span><label class="btn btn-primario" for="in-pista" style="cursor:pointer">🎵 Agregar música (MP3)</label>'
    : '<span>Sin música: el metrónomo marca los tiempos.</span>';
}

function renderTodo() {
  if (!S.coreo) return;
  renderCabecera(); renderMusicaVisible(); renderEscenario(); renderConteo(); renderTabs(); renderPanel(); ajustarLinea();
  $('#video-wrap').hidden = !(S.coreo.video?.url) || !S.videoVisible;
}

/* ═══════════════ Paneles ═══════════════ */
function tabsDisponibles() {
  const t = [['bailarines', 'Bailarines'], ['formaciones', 'Formaciones'], ['musica', 'Música'], ['video', 'Video']];
  if (esCoreografo() && !S.vistaAlumna) t.push(['ajustes', 'Ajustes']);
  return t;
}
function renderTabs() {
  const tabs = tabsDisponibles(); if (!tabs.some(t => t[0] === S.tab)) S.tab = 'bailarines';
  const nPend = S.solicitudes.filter(s => S.coreo && s.coreoId === S.coreo.id && s.estado === 'pendiente').length;
  $('#tabs').innerHTML = tabs.map(([k, n]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${k === S.tab}">${n}${k === 'bailarines' && esCoreografo() && nPend ? ` <span class="badge">${nPend}</span>` : ''}</button>`).join('');
  $('#tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { S.tab = b.dataset.tab; renderTabs(); renderPanel(); } };
}
function renderPanelSiTab(t) { if (S.tab === t) renderPanel(); }

function renderPanel() {
  if (!S.coreo) return;
  const p = $('#panel');
  const fn = { bailarines: panelBailarines, formaciones: panelFormaciones, musica: panelMusica, video: panelVideo, ajustes: panelAjustes }[S.tab];
  const activo = document.activeElement && p.contains(document.activeElement) && document.activeElement.matches('input[type=text], input:not([type]), input[type=number]') ? document.activeElement.name : null;
  p.innerHTML = fn ? fn() : '';
  if (activo) { const el = p.querySelector(`[name="${activo}"]`); if (el) { el.focus(); try { const n = el.value.length; el.setSelectionRange(n, n); } catch (_) {} } }
  p.onclick = clickPanel; p.onchange = cambioPanel; p.oninput = inputPanel;
  renderMusicaVisible();
  if (S.tab === 'bailarines') renderTabs();
}

function puntoHTML(b) {
  return `<span class="punto" style="background:${esc(b.color)}"><svg viewBox="-34 -34 68 68" width="16" height="16"><path d="${SIMBOLO[b.genero === 'M' ? 'M' : 'F']}" fill="none" stroke="rgba(10,11,15,.85)" stroke-width="6" stroke-linecap="round"/></svg></span>`;
}

function panelBailarines() {
  const c = S.coreo, ed = puedeEditar();
  const b = c.bailarines.find(x => x.id === S.sel);
  let h = '';
  if (esCoreografo() && !S.vistaAlumna) {
    const pend = S.solicitudes.filter(s => s.coreoId === c.id && s.estado === 'pendiente');
    if (pend.length) h += `<section><h3>Solicitudes de cambio de nombre</h3>${htmlSolicitudes(pend)}</section>`;
  }
  if (c.sellada) h += `<p class="nota aviso">Coreografía sellada: los nombres quedan como registro histórico.</p>`;
  if (b) {
    if (ed) {
      h += `<section><h3>Bailarín seleccionado</h3>
        <label class="campo"><span>Nombre</span><input name="nombre" value="${esc(b.nombre)}" maxlength="30" placeholder="Nombre de la alumna o alumno"></label>
        <div class="campo"><span>Tipo</span><div class="seg" role="group">
          <button type="button" data-genero="F" aria-pressed="${b.genero !== 'M'}">♀ Mujer</button>
          <button type="button" data-genero="M" aria-pressed="${b.genero === 'M'}">♂ Hombre</button></div></div>
        <div class="campo"><span>Color</span><div class="colores">${COLORES.map(k => `<button type="button" class="color" data-color="${k}" style="background:${k}" aria-label="Color ${k}" aria-pressed="${k === b.color}"></button>`).join('')}</div></div>
        <div class="botones"><button class="btn btn-mini btn-peligro" data-acc="quitar-b" type="button">Quitar bailarín</button></div>
        <p class="nota">Arrastra el circulito en el escenario: se guarda en la formación del tiempo actual (se crea una si no existe).</p>
      </section>`;
    } else {
      const esMio = S.mio === b.id;
      const miSol = S.solicitudes.find(s => s.coreoId === c.id && s.bailarinId === b.id && s.uid === S.sesion.uid && s.estado === 'pendiente');
      h += `<section><h3>${esc(b.nombre || 'Circulito ' + (b.etiqueta || ''))}</h3>
        <div class="botones">
          <button class="btn ${esMio ? '' : 'btn-primario'}" data-acc="mio" type="button">${esMio ? 'Dejar de resaltar' : 'Soy yo: resaltar mi camino'}</button>
          ${!c.sellada && modoAlumna() ? (miSol ? `<span class="nota">Solicitud enviada: “${esc(miSol.nombreNuevo)}”, esperando al coreógrafo.</span>` : `<button class="btn" data-acc="solicitar" type="button">Pedir este lugar con mi nombre</button>`) : ''}
        </div></section>`;
    }
  }
  h += `<section><h3>Bailarines (${c.bailarines.length})</h3>`;
  if (ed) h += `<div class="botones" style="margin-bottom:10px"><button class="btn btn-mini" data-acc="add-F" type="button">+ Mujer ♀</button><button class="btn btn-mini" data-acc="add-M" type="button">+ Hombre ♂</button></div>`;
  h += `<div class="lista-b">${c.bailarines.map(x => `
      <button class="fila-b${x.id === S.sel ? ' sel' : ''}" data-b="${esc(x.id)}" type="button">${puntoHTML(x)}
        <span class="nom">${esc(x.nombre || 'Sin nombre')}</span>${x.id === S.mio && modoAlumna() ? '<small>tú</small>' : ''}<small>#${esc(x.etiqueta || '')}</small></button>`).join('') || '<p class="nota">Sin bailarines.</p>'}</div>`;
  if (!ed && !b) h += `<p class="nota">Toca tu circulito para resaltar tu recorrido${c.sellada ? '' : ' o pedir que lleve tu nombre'}.</p>`;
  return h + '</section>';
}

function panelFormaciones() {
  const ed = puedeEditar(); const F = formsOrd();
  let h = '<section>';
  if (ed) h += `<div class="botones" style="margin-bottom:12px">
      <button class="btn btn-primario btn-mini" data-acc="form-aqui" type="button">+ Formación aquí</button>
      <button class="btn btn-mini" data-acc="form-mantener" type="button">Mantener la anterior hasta aquí</button></div>`;
  h += `<div class="checks" style="margin-bottom:12px">
      <label><input type="checkbox" name="tray" ${S.trayectorias ? 'checked' : ''}> Ver trayectorias</label>
      ${ed ? `<label><input type="checkbox" name="iman" ${S.iman ? 'checked' : ''}> Imán a la cuadrícula</label>` : ''}</div>`;
  h += `<h3>Formaciones (${F.length})</h3><div class="lista-b">`;
  for (const f of F) {
    const sel = f.id === S.selForm;
    h += `<button class="fila-b${sel ? ' sel' : ''}" data-form="${esc(f.id)}" type="button"><span class="nom">${esc(f.nombre)}</span><small>${nombreBeat(f.beat)}</small></button>`;
    if (sel && ed) h += `<div style="padding:4px 2px 10px">
        <label class="campo"><span>Nombre</span><input name="form-nombre" value="${esc(f.nombre)}" maxlength="40"></label>
        <label class="campo"><span>Tiempos para llegar a esta formación</span>
          <select name="form-tr">${[0, 1, 2, 4, 6, 8, 12, 16, 24, 32].map(n => `<option value="${n}" ${n === (f.transicion ?? 8) ? 'selected' : ''}>${n === 0 ? 'Cambio inmediato' : n + ' tiempos'}</option>`).join('')}</select></label>
        <div class="campo"><span>Mover en la música</span><div class="botones">
          <button class="btn btn-mini" data-mover="-8" type="button">−8</button><button class="btn btn-mini" data-mover="-1" type="button">−1</button>
          <button class="btn btn-mini" data-mover="1" type="button">+1</button><button class="btn btn-mini" data-mover="8" type="button">+8</button></div></div>
        <button class="btn btn-mini btn-peligro" data-acc="form-borrar" type="button">Borrar formación</button></div>`;
  }
  h += '</div>';
  if (!F.length) h += '<p class="nota">Aún no hay formaciones.</p>';
  if (ed) h += '<p class="nota">Pon la música en el tiempo deseado y mueve a los bailarines: la formación se crea sola en ese tiempo. En la línea de tiempo: arrastra el rombo (o su bloque) para moverla, el tirador de la izquierda para alargar o acortar el cambio, y con Supr la borras.</p>';
  return h + '</section>';
}

function panelMusica() {
  const m = S.coreo.musica, ed = puedeEditar();
  let h = '<section><h3>Pista</h3>';
  if (m.nombre) h += `<div class="archivo"><span>🎵 ${esc(m.nombre)}</span><small class="muted">${fmtT(m.duracion)}</small></div>`;
  if (m.nombre && !m.url && ed) h += '<p class="nota aviso">La pista todavía no está en la nube: las alumnas no la escucharán.</p>';
  if (S.progreso?.tipo === 'pista') h += `<div class="progreso"><i style="width:${Math.round(S.progreso.v * 100)}%"></i></div><p class="nota">${esc(S.progreso.txt || 'Subiendo…')}</p>`;
  if (ed) {
    h += `<label class="btn btn-mini" style="cursor:pointer">${m.nombre ? 'Cambiar pista' : 'Subir pista (MP3)'}<input type="file" name="pista" accept="audio/*,.mp3" hidden></label>
      ${m.nombre ? '<button class="btn btn-mini btn-peligro" data-acc="quitar-pista" type="button" style="margin-left:6px">Quitar</button>' : ''}`;
    if (!m.nombre) h += `<label class="campo" style="margin-top:12px"><span>Sin música: duración en grupos de ${G()} tiempos</span><input name="ochos" type="number" min="1" max="400" value="${Math.round((S.coreo.duracionSinMusica - m.offset) / spb() / G())}"></label>`;
  } else if (!m.nombre) h += '<p class="nota">Esta coreografía no tiene pista; el metrónomo marca los tiempos.</p>';
  const med = +m.medida || 4, uni = +m.unidad || 4, gr = +m.grupo || 8;
  h += '</section><section><h3>Tempo</h3>';
  h += `<div class="dos" style="align-items:end"><div><div class="bpm-grande">${(+m.bpm).toFixed(1).replace(/\.0$/, '')}</div><span class="nota">tiempos por minuto (BPM)</span></div>
        ${ed ? `<button class="btn" data-acc="tap" type="button">Tocar al ritmo</button>` : ''}</div>`;
  if (ed) {
    h += `<div class="botones" style="margin:10px 0">
        <button class="btn btn-mini" data-bpm="-5" type="button">−5</button><button class="btn btn-mini" data-bpm="-1" type="button">−1</button>
        <input name="bpm" class="in-bpm" type="number" min="20" max="320" step="0.1" value="${m.bpm}" aria-label="BPM">
        <button class="btn btn-mini" data-bpm="1" type="button">+1</button><button class="btn btn-mini" data-bpm="5" type="button">+5</button></div>
      <input class="rango" type="range" name="bpm-rango" min="40" max="240" step="0.5" value="${Math.min(240, Math.max(40, m.bpm))}" aria-label="Tempo">
      <div class="botones" style="margin-top:8px">${S.analisis ? `<button class="btn btn-mini" data-acc="detectar" type="button">Volver al detectado (${S.analisis.bpm})</button>` : ''}
        <button class="btn btn-mini" data-acc="mitad" type="button">Mitad (÷2)</button><button class="btn btn-mini" data-acc="doble" type="button">Doble (×2)</button></div>
    </section><section><h3>Compás</h3>
      <div class="chips compases">${['2/4', '3/4', '4/4', '5/4', '6/8', '5/8', '7/8', '9/8', '12/8'].map(k => `<button type="button" class="chip" data-compas="${k}" aria-selected="${k === med + '/' + uni}">${k}</button>`).join('')}</div>
      <div class="compas-libre">
        <label class="campo"><span>Tiempos</span><input name="medida" type="number" min="1" max="32" value="${med}"></label>
        <b class="barra-compas">/</b>
        <label class="campo"><span>Figura</span><input name="unidad" type="number" min="1" max="32" value="${uni}"></label>
        <label class="campo"><span>Contar en grupos de</span><select name="grupo">${Array.from({ length: 31 }, (_, i) => i + 2).map(n => `<option value="${n}" ${n === gr ? 'selected' : ''}>${n}${n === 8 ? ' (ochos)' : ''}</option>`).join('')}</select></label>
      </div>
      <p class="nota">Escribe cualquier compás (por ejemplo 5/8 o 7/4). El BPM cuenta la figura de abajo: en ${med}/${uni}, cada tiempo es 1/${uni}. Al cambiar el compás los conteos se agrupan solos (3/4 → de 6); puedes cambiar el grupo a mano.</p>
    </section><section><h3>Dónde empieza el 1</h3>
      <label class="campo"><span>El “1” del primer conteo empieza en (segundos)</span><input name="offset" type="number" step="0.01" min="0" value="${(+m.offset).toFixed(2)}"></label>
      <div class="botones"><button class="btn btn-mini btn-primario" data-acc="marcar-uno" type="button">Marcar el 1 aquí</button>
        <button class="btn btn-mini" data-acc="off-" type="button">−0,05 s</button><button class="btn btn-mini" data-acc="off+" type="button">+0,05 s</button></div>
      <p class="nota">Las formaciones están atadas a los conteos: si cambias el tempo o el 1, se mueven con la música.</p>`;
  } else {
    h += `<p class="nota">Compás ${med}/${uni} · conteos de ${gr} · el 1 empieza en ${fmtT(m.offset)}</p>`;
  }
  const mt = Motor.met, e = S.ent;
  const opts = (lista, val, fmt) => lista.map(n => `<option value="${n}" ${n === val ? 'selected' : ''}>${fmt(n)}</option>`).join('');
  h += `</section><section><h3>Metrónomo</h3>
      <p class="nota">Este metrónomo sigue la coreografía: suena al darle ▶, en el tempo y compás de la canción. Para practicar sin la coreografía usa el <a href="metronomo.html" style="color:var(--acento)">metrónomo libre</a>.</p>
      <label class="switch met-sw"><input type="checkbox" name="met-on" ${mt.on ? 'checked' : ''}><span>Metrónomo encendido</span></label>
      <div class="campo" style="margin-top:10px"><span>Subdividir cada tiempo</span>
        <div class="seg seg-sub" role="group" aria-label="Subdivisión">
          ${[[1, 'Sin', '♩'], [2, 'Corcheas', '♫'], [3, 'Tresillos', '3'], [4, 'Semicorcheas', '♬']].map(([v, n, s]) => `<button type="button" data-sub="${v}" aria-pressed="${(mt.sub || 1) === v}"><b>${s}</b> ${n}</button>`).join('')}
        </div></div>
      <div class="checks">
        <label><input type="checkbox" name="met-acento" ${mt.acento ? 'checked' : ''}> Acentuar el 1 y los compases</label>
        <label><input type="checkbox" name="met-luz" ${mt.luz ? 'checked' : ''}> Luz en cada tiempo</label>
      </div>
      <p class="nota">Sonidos: más agudo en el 1 del conteo, medio al empezar cada compás${(+m.unidad === 8 && (+m.medida) % 3 === 0 && +m.medida > 3) ? ', y acento cada 3 corcheas en este compás compuesto' : ''}; las subdivisiones suenan suaves.</p>
      <label class="campo"><span>Volumen del metrónomo</span><input class="rango" type="range" name="vol-met" min="0" max="1" step="0.05" value="${mt.vol}"></label>
      <label class="campo"><span>Volumen de la música</span><input class="rango" type="range" name="vol-musica" min="0" max="1" step="0.05" value="${Motor.audio.volume}"></label>
    </section>
    <section><h3>Subir la velocidad poco a poco</h3>
      <p class="nota">Repite el tramo actual empezando lento; la velocidad sube sola hasta la meta.</p>
      <div class="ent-grid">
        <label class="campo"><span>Empezar en</span><select name="ent-desde">${opts([40, 50, 60, 70, 75, 80, 90], e.desde, n => n + '%')}</select></label>
        <label class="campo"><span>Subir</span><select name="ent-paso">${opts([1, 2, 5, 10], e.paso, n => '+' + n + '%')}</select></label>
        <label class="campo"><span>Cada</span><select name="ent-cada">${opts([1, 2, 3, 4, 6, 8], e.cada, n => n + (n === 1 ? ' vuelta' : ' vueltas'))}</select></label>
        <label class="campo"><span>Hasta</span><select name="ent-meta">${opts([80, 90, 100, 110, 120], e.meta, n => n + '%')}</select></label>
      </div>
      <button class="btn ${e.on ? '' : 'btn-primario'}" data-acc="ent" type="button">${e.on ? 'Detener' : 'Empezar práctica'}</button>
      <p class="nota" id="ent-estado">${textoEntrenador()}</p>
      <p class="nota">Velocidad y metrónomo son tuyos: se guardan solo en este equipo.</p>
    </section>`;
  return h;
}

function panelVideo() {
  const v = S.coreo.video, ed = puedeEditar();
  let h = '<section><h3>Video del ensayo</h3>';
  if (v?.url) h += `<div class="archivo"><span>${v.yt ? '▶ YouTube · ' : '🎬 '}${esc(v.nombre || 'Video')}</span></div>`;
  if (S.progreso?.tipo === 'video') h += `<div class="progreso"><i style="width:${Math.round(S.progreso.v * 100)}%"></i></div><p class="nota">Subiendo video… ${Math.round(S.progreso.v * 100)}%</p>`;
  if (ed) {
    h += `<div class="botones">${S.st.subeVideos ? `<label class="btn btn-mini" style="cursor:pointer">${v?.url ? 'Cambiar video' : 'Subir video'}<input type="file" name="video" accept="video/*" hidden></label>` : ''}
        <button class="btn btn-mini${S.st.subeVideos ? '' : ' btn-primario'}" data-acc="video-enlace" type="button">${v?.url ? 'Cambiar enlace' : 'Pegar enlace de YouTube'}</button>
        ${v?.url ? '<button class="btn btn-mini btn-peligro" data-acc="quitar-video" type="button">Quitar</button>' : ''}</div>`;
  }
  if (!v?.url) return h + `<p class="nota">${ed ? (S.st.subeVideos ? 'Cuando termines la coreografía, sube el video del ensayo y sincronízalo con la música.' : 'Sube el video del ensayo a YouTube como «No listado» (solo lo ve quien tiene el enlace), pega aquí el enlace y sincronízalo con la música.') : 'Aún no hay video del ensayo.'}</p></section>`;
  h += `<div class="checks" style="margin:12px 0">
      <label><input type="checkbox" name="video-ver" ${S.videoVisible ? 'checked' : ''}> Mostrar video</label>
      <label><input type="checkbox" name="video-sonido" ${S.videoSonido ? 'checked' : ''}> Sonido del video</label></div></section>`;
  if (ed) {
    h += `<section><h3>Sincronización</h3>
      ${S.progreso?.tipo === 'sinc' ? '<div class="progreso"><i class="indef"></i></div><p class="nota">Escuchando el video y la canción para encontrar el punto exacto…</p>' : ''}
      <label class="btn btn-primario btn-mini" style="cursor:pointer;margin-bottom:8px">🎧 Sincronizar con el audio del video<input type="file" name="video-audio" accept="video/*,audio/*" hidden></label>
      <p class="nota">Elige el archivo del video que tienes en el PC o celular (el mismo que subiste${v.yt ? ' a YouTube' : ''}). No se sube a ningún lado: solo se escucha aquí para encontrar dónde coincide con la música.</p>
      <p class="nota">El video empieza en <b>${fmtT(v.offset || 0)}</b> de la canción${(v.offset || 0) < 0 ? ' (antes de la canción)' : ''}${v.ritmo && v.ritmo !== 1 ? ` · la música del video va al <b>${(v.ritmo * 100).toFixed(1).replace('.', ',')} %</b>` : ''}.</p>
      <div class="botones"><button class="btn btn-mini" data-voff="-1" type="button">−1 s</button><button class="btn btn-mini" data-voff="-0.1" type="button">−0,1 s</button>
        <button class="btn btn-mini" data-voff="0.1" type="button">+0,1 s</button><button class="btn btn-mini" data-voff="1" type="button">+1 s</button></div>
      ${S.ajusteVideo
        ? `<p class="nota aviso">Mueve el video (con sus controles) al mismo golpe en que está la canción${S.coreo.video.yt ? ', déjalo en pausa' : ''} y pulsa:</p><div class="botones"><button class="btn btn-primario" data-acc="video-fijar" type="button">Sincronizar aquí</button><button class="btn" data-acc="video-ajuste" type="button">Cancelar</button></div>`
        : `<button class="btn btn-mini" data-acc="video-ajuste" type="button" style="margin-top:8px">Ajustar a mano un golpe…</button>`}
    </section>`;
  }
  return h;
}

function panelAjustes() {
  const c = S.coreo;
  return `<section><h3>Escenario</h3>
      <div class="dos"><label class="campo"><span>Columnas</span><input name="cols" type="number" min="4" max="16" value="${c.escenario.cols}"></label>
      <label class="campo"><span>Filas</span><input name="filas" type="number" min="3" max="12" value="${c.escenario.filas}"></label></div></section>
    <section><h3>Sellar coreografía</h3>
      ${c.sellada
        ? `<p class="nota">Sellada el ${new Date(c.selladaEn || Date.now()).toLocaleDateString('es-CO')}. Nadie puede pedir cambios de nombre y los nombres quedan como registro histórico.</p><button class="btn btn-mini" data-acc="quitar-sello" type="button">Quitar el sello</button>`
        : `<p class="nota">Al sellarla se bloquean los cambios y las solicitudes de nombre: queda con los nombres de hoy para la posteridad.</p><button class="btn btn-primario" data-acc="sellar" type="button">Sellar coreografía</button>`}
    </section>
    <section><h3>Zona peligrosa</h3><button class="btn btn-peligro btn-mini" data-acc="borrar-coreo" type="button">Borrar coreografía</button></section>`;
}

/* ── Eventos del panel ── */
async function clickPanel(e) {
  if (e.target.closest('[data-sol]')) return manejarSolicitudClick(e);
  // Práctica (todos): subdivisión y entrenador de velocidad
  const sb = e.target.closest('[data-sub]');
  if (sb) { Motor.met.sub = +sb.dataset.sub; guardarPrefsMet(); Motor._reiniciarMet(); if (!Motor.met.on) alternarMet(true); else renderPanel(); return; }
  if (e.target.closest('[data-acc="ent"]')) { S.ent.on ? pararEntrenador('Práctica detenida.') : iniciarEntrenador(); return; }
  const c = S.coreo;
  const fb = e.target.closest('[data-b]');
  if (fb) { S.sel = S.sel === fb.dataset.b ? null : fb.dataset.b; marcarSeleccion(); renderPanel(); return; }
  const ff = e.target.closest('[data-form]');
  if (ff) {
    const f = c.formaciones.find(x => x.id === ff.dataset.form);
    S.selForm = f.id; Motor.pausar(); pintarPlay(); Motor.ir(tDeBeat(f.beat)); if (S.bucle) ponerBucle(true); S.sucio = true; renderPanel(); return;
  }
  const g = e.target.closest('[data-genero]');
  if (g && puedeEditar()) { const b = c.bailarines.find(x => x.id === S.sel); b.genero = g.dataset.genero; cambio(); renderEscenario(); renderPanel(); return; }
  const col = e.target.closest('[data-color]');
  if (col && puedeEditar()) { const b = c.bailarines.find(x => x.id === S.sel); b.color = col.dataset.color; cambio(); renderEscenario(); renderPanel(); return; }
  const mv = e.target.closest('[data-mover]');
  if (mv && puedeEditar()) {
    const f = c.formaciones.find(x => x.id === S.selForm); const nb = f.beat + (+mv.dataset.mover);
    if (c.formaciones.some(o => o !== f && Math.abs(o.beat - nb) < EPS)) return toast('Ya hay una formación en ese tiempo.', true);
    f.beat = nb; Motor.ir(tDeBeat(nb)); cambio(); renderPanel(); return;
  }
  const bp = e.target.closest('[data-bpm]');
  if (bp && puedeEditar()) return ponerBpm(+c.musica.bpm + (+bp.dataset.bpm));
  const cp = e.target.closest('[data-compas]');
  if (cp && puedeEditar()) { const [n, d] = cp.dataset.compas.split('/').map(Number); return ponerCompas(n, d); }
  const vo = e.target.closest('[data-voff]');
  if (vo && puedeEditar()) { c.video.offset = Math.round(((c.video.offset || 0) + (+vo.dataset.voff)) * 100) / 100; cambio(); renderPanel(); return; }
  const a = e.target.closest('[data-acc]')?.dataset.acc; if (!a) return;
  const m = c.musica;
  switch (a) {
    case 'add-F': case 'add-M': {
      const gen = a.slice(-1); const n = c.bailarines.filter(x => x.genero === gen).length;
      const b = { id: uid('b'), genero: gen, color: COLORES[(gen === 'F' ? 0 : 5) + n % 5], nombre: '', etiqueta: String(Math.max(0, ...c.bailarines.map(x => +x.etiqueta || 0)) + 1) };
      c.bailarines.push(b);
      const p = posicionesEn(beatDeT(Motor.tiempo())); const libre = puntoLibre(Object.values(p));
      if (!c.formaciones.length) c.formaciones.push({ id: uid('f'), beat: 0, nombre: 'Inicio', transicion: 8, pos: {} });
      c.formaciones.forEach(f => f.pos[b.id] = { ...libre });
      S.sel = b.id; cambio(); renderEscenario(); renderPanel(); break;
    }
    case 'quitar-b': {
      const b = c.bailarines.find(x => x.id === S.sel);
      if (!await confirmar('Quitar bailarín', `Se quitará “${b.nombre || '#' + b.etiqueta}” de todas las formaciones.`, 'Quitar', true)) return;
      c.bailarines = c.bailarines.filter(x => x.id !== b.id); c.formaciones.forEach(f => delete f.pos[b.id]);
      S.sel = null; cambio(); renderEscenario(); renderPanel(); break;
    }
    case 'mio': {
      S.mio = S.mio === S.sel ? null : S.sel;
      try { S.mio ? localStorage.setItem('coreo_mio_' + c.id, S.mio) : localStorage.removeItem('coreo_mio_' + c.id); } catch (_) {}
      marcarSeleccion(); S.sucio = true; renderPanel(); break;
    }
    case 'solicitar': {
      const b = c.bailarines.find(x => x.id === S.sel);
      const r = await modal({ titulo: 'Pedir este lugar', si: 'Enviar solicitud',
        html: `<p class="muted">El coreógrafo recibirá tu solicitud para que el circulito #${esc(b.etiqueta)}${b.nombre ? ` (hoy “${esc(b.nombre)}”)` : ''} lleve tu nombre.</p>
               <label class="campo"><span>Tu nombre como debe aparecer</span><input name="nombre" maxlength="30" value="${esc(S.sesion.rol === 'alumna' ? S.sesion.nombre : '')}"></label>` });
      if (!r || !r.nombre.trim()) return;
      try {
        await S.st.crearSolicitud({ coreoId: c.id, coreoTitulo: c.titulo, bailarinId: b.id, etiqueta: b.etiqueta || '', nombreActual: b.nombre || '',
          nombreNuevo: r.nombre.trim().slice(0, 30), uid: S.sesion.uid, clave: S.sesion.clave, estado: 'pendiente', creadoEn: Date.now() });
        toast('Solicitud enviada ✓');
      } catch (er) { toast('No se pudo enviar: ' + er.message, true); }
      break;
    }
    case 'form-aqui': {
      const b = Math.round(beatDeT(Motor.tiempo()));
      if (c.formaciones.some(f => Math.abs(f.beat - b) < EPS)) { S.selForm = c.formaciones.find(f => Math.abs(f.beat - b) < EPS).id; renderPanel(); return toast('Ya hay una formación en este tiempo.'); }
      asegurarFormacionAqui(); renderPanel(); break;
    }
    case 'form-mantener': {
      const b = Math.round(beatDeT(Motor.tiempo()));
      const { prev } = formacionActual(b - 1);
      if (!prev) return toast('No hay una formación anterior.', true);
      if (c.formaciones.some(f => Math.abs(f.beat - b) < EPS)) return toast('Ya hay una formación en este tiempo.', true);
      const f = { id: uid('f'), beat: b, nombre: prev.nombre + ' (sigue)', transicion: 0, pos: JSON.parse(JSON.stringify(prev.pos)) };
      c.formaciones.push(f); S.selForm = f.id; Motor.ir(tDeBeat(b)); cambio(); renderPanel(); break;
    }
    case 'form-borrar': await borrarFormacion(); break;
    case 'tap': {
      const bpm = Tap.tocar();
      if (bpm) { m.bpm = Math.max(20, Math.min(320, bpm)); aplicarTempo(); cambio(); renderConteo(); renderPanel(); }
      else toast('Sigue tocando al ritmo…');
      break;
    }
    case 'detectar': m.bpm = S.analisis.bpm; m.offset = S.analisis.offset; aplicarTempo(); cambio(); renderPanel(); break;
    case 'mitad': m.bpm = Math.max(20, Math.round(m.bpm / 2 * 10) / 10); aplicarTempo(); cambio(); renderPanel(); break;
    case 'doble': m.bpm = Math.min(320, Math.round(m.bpm * 2 * 10) / 10); aplicarTempo(); cambio(); renderPanel(); break;
    case 'marcar-uno': m.offset = Math.round(Motor.tiempo() * 1000) / 1000; aplicarTempo(); cambio(); renderPanel(); toast('El 1 quedó en ' + fmtT(m.offset)); break;
    case 'off-': case 'off+': m.offset = Math.max(0, Math.round((m.offset + (a === 'off+' ? .05 : -.05)) * 1000) / 1000); aplicarTempo(); cambio(); renderPanel(); break;
    case 'quitar-pista': {
      if (!await confirmar('Quitar pista', 'Se quitará la música de esta coreografía (las formaciones se conservan).', 'Quitar', true)) return;
      const viejo = m.path; Object.assign(m, { url: '', path: '', nombre: '', picos: [], duracion: 0 });
      S.analisis = null; await Motor.cargarUrl(null); aplicarTempo(); cambio(); ajustarLinea(); renderPanel();
      if (viejo) S.st.borrarArchivo(viejo);
      break;
    }
    case 'video-enlace': {
      const r = await modal({ titulo: 'Enlace del video', si: 'Usar enlace', html: '<p class="muted">Pega el enlace de YouTube (puede ser «No listado») o un enlace directo a un archivo .mp4.</p><label class="campo"><span>Enlace</span><input name="url" type="url" placeholder="https://youtu.be/…"></label>' });
      if (!r) return;
      const u = r.url.trim(), yt = idYouTube(u);
      if (!yt && !/^https?:\/\/.+\.(mp4|webm|mov)(\?|$)/i.test(u)) return toast('Ese enlace no es de YouTube ni de un archivo de video.', true);
      const viejo = c.video?.path, off = c.video?.offset || 0;
      c.video = yt ? { url: 'https://youtu.be/' + yt, yt, path: '', nombre: 'Video del ensayo', offset: off, ...(c.video?.ritmo ? { ritmo: c.video.ritmo } : {}) }
                   : { url: u, path: '', nombre: u.split('/').pop().split('?')[0], offset: off };
      cambio(); await cargarMedios(); renderTodo(); if (viejo) S.st.borrarArchivo(viejo); break;
    }
    case 'quitar-video': {
      if (!await confirmar('Quitar video', 'Se quitará el video del ensayo.', 'Quitar', true)) return;
      const viejo = c.video?.path; c.video = null; cambio(); await cargarMedios(); renderTodo(); if (viejo) S.st.borrarArchivo(viejo); break;
    }
    case 'video-ajuste': {
      S.ajusteVideo = !S.ajusteVideo; const v = $('#video'); v.controls = S.ajusteVideo; Motor.pausar(); pintarPlay(); v.pause();
      if (S.yt && S.yt.listo) S.yt.player.pauseVideo();
      renderPanel(); break;
    }
    case 'video-fijar': {
      const v = $('#video'), tv = c.video.yt ? (S.yt && S.yt.listo ? S.yt.player.getCurrentTime() : 0) : v.currentTime;
      c.video.offset = Math.round((Motor.tiempo() - tv * (c.video.ritmo || 1)) * 100) / 100;
      S.ajusteVideo = false; v.controls = false; cambio(); S.sucio = true; renderPanel(); toast('Video sincronizado ✓'); break;
    }
    case 'sellar': {
      if (!await confirmar('Sellar coreografía', 'Quedará bloqueada con los nombres actuales como registro histórico. Las alumnas ya no podrán pedir cambios.', 'Sellar')) return;
      c.sellada = true; c.selladaEn = Date.now(); c.actualizadoEn = Date.now(); await guardarYa(); renderTodo(); toast('Coreografía sellada'); break;
    }
    case 'quitar-sello': {
      if (!await confirmar('Quitar el sello', 'Se podrá volver a editar y cambiar nombres.', 'Quitar sello', true)) return;
      c.sellada = false; c.selladaEn = null; c.actualizadoEn = Date.now(); await guardarYa(); renderTodo(); break;
    }
    case 'borrar-coreo': {
      if (!await confirmar('Borrar coreografía', `“${c.titulo}” se borrará para todos, con su música y video. No se puede deshacer.`, 'Borrar', true)) return;
      const rutas = [m.path, c.video?.path].filter(Boolean); const id = c.id;
      S.coreo = null; clearTimeout(_tGuardar); _tGuardar = null;
      await cerrarCoreo();
      try { await S.st.borrarCoreo(id); rutas.forEach(r => S.st.borrarArchivo(r)); toast('Coreografía borrada'); } catch (er) { toast(er.message, true); }
      volverLista(); break;
    }
  }
}

function puntoLibre(ocupados) {
  const { cols, filas } = S.coreo.escenario;
  for (let y = filas - 0.5; y > 0; y--) for (let x = 0.5; x < cols; x++) {
    if (!ocupados.some(p => Math.abs(p.x - x) < .6 && Math.abs(p.y - y) < .6)) return { x, y };
  }
  return { x: cols / 2, y: filas / 2 };
}

async function cambioPanel(e) {
  const el = e.target, c = S.coreo, n = el.name;
  if (n === 'tray') { S.trayectorias = el.checked; S.sucio = true; return; }
  if (n === 'iman') { S.iman = el.checked; return; }
  if (n === 'video-ver') { S.videoVisible = el.checked; $('#video-wrap').hidden = !el.checked; S.sucio = true; return; }
  if (n === 'video-sonido') {
    S.videoSonido = el.checked; $('#video').muted = !el.checked;
    if (S.yt && S.yt.listo) el.checked ? S.yt.player.unMute() : S.yt.player.mute();
    return;
  }
  if (n === 'met-on') return alternarMet(el.checked);
  if (n === 'met-acento') { Motor.met.acento = el.checked; guardarPrefsMet(); Motor._reiniciarMet(); return; }
  if (n === 'met-luz') { Motor.met.luz = el.checked; guardarPrefsMet(); return; }
  if (n && n.startsWith('ent-')) {
    S.ent[n.slice(4)] = +el.value;
    if (n === 'ent-meta' && S.ent.desde > S.ent.meta) S.ent.desde = S.ent.meta;
    const est = document.querySelector('#ent-estado'); if (est) est.textContent = textoEntrenador();
    return;
  }
  if (n === 'pista' && el.files[0]) return subirPista(el.files[0]);
  if (n === 'video' && el.files[0]) return subirVideo(el.files[0]);
  if (n === 'video-audio' && el.files[0]) { const f = el.files[0]; el.value = ''; return sincronizarConAudio(f); }
  if (!puedeEditar()) return;
  const m = c.musica;
  if (n === 'nombre') { const b = c.bailarines.find(x => x.id === S.sel); if (b) { b.nombre = el.value.trim(); cambio(); renderEscenario(); renderPanel(); } }
  else if (n === 'form-nombre') { const f = c.formaciones.find(x => x.id === S.selForm); f.nombre = el.value.trim() || f.nombre; cambio(); renderPanel(); }
  else if (n === 'form-tr') { const f = c.formaciones.find(x => x.id === S.selForm); f.transicion = +el.value; cambio(); }
  else if (n === 'bpm' || n === 'bpm-rango') ponerBpm(+el.value);
  else if (n === 'medida' || n === 'unidad') {
    const v = Math.round(+el.value);
    if (v >= 1 && v <= 32) ponerCompas(n === 'medida' ? v : +m.medida || 4, n === 'unidad' ? v : +m.unidad || 4);
    else renderPanel();
  }
  else if (n === 'grupo') { m.grupo = +el.value; aplicarTempo(); renderConteo(); cambio(); S.sucio = true; renderPanel(); }
  else if (n === 'offset') { const v = +el.value; if (v >= 0) { m.offset = v; aplicarTempo(); cambio(); } }
  else if (n === 'ochos') { const v = +el.value; if (v > 0) { c.duracionSinMusica = m.offset + v * G() * spb(); aplicarTempo(); ajustarLinea(); cambio(); } }
  else if (n === 'cols' || n === 'filas') {
    const v = Math.round(+el.value); const lim = n === 'cols' ? [4, 16] : [3, 12];
    if (v >= lim[0] && v <= lim[1]) { c.escenario[n] = v; cambio(); renderEscenario(); }
  }
}
function ponerBpm(v) {
  v = Math.round(v * 100) / 100;
  if (!(v >= 20 && v <= 320)) return renderPanel();
  S.coreo.musica.bpm = v; aplicarTempo(); cambio(); renderPanel();
}
function ponerCompas(n, d) {
  const m = S.coreo.musica;
  m.medida = n; m.unidad = d; m.grupo = grupoSugerido(n);
  aplicarTempo(); renderConteo(); cambio(); S.sucio = true; renderPanel();
  toast(`Compás ${n}/${d} · conteos de ${m.grupo}`);
}
function inputPanel(e) {
  const el = e.target;
  if (el.name === 'bpm-rango') {   // vista previa mientras se arrastra
    const g = document.querySelector('.bpm-grande'); if (g) g.textContent = (+el.value).toFixed(1).replace(/\.0$/, '');
    const i = document.querySelector('.in-bpm'); if (i) i.value = el.value;
  }
  if (el.name === 'vol-musica') Motor.audio.volume = +el.value;
  if (el.name === 'vol-met') { Motor.met.vol = +el.value; guardarPrefsMet(); }
}

/* ── Subida de archivos ── */
async function subirPista(file) {
  if (!/^audio\//.test(file.type) && !/\.(mp3|m4a|wav|ogg|aac)$/i.test(file.name)) return toast('Elige un archivo de audio (MP3).', true);
  const c = S.coreo, m = c.musica;
  S.progreso = { tipo: 'pista', v: 0, txt: 'Analizando el tempo…' };
  S.tab = 'musica'; renderTabs(); renderPanel();
  let info;
  try { info = await analizarPista(file); }
  catch (e) { S.progreso = null; renderPanel(); return toast('No se pudo leer ese audio.', true); }
  const viejo = m.path;
  Object.assign(m, { nombre: file.name, duracion: info.duracion, picos: info.picos, bpm: info.bpm, offset: info.offset, url: '', path: '' });
  S.analisis = { bpm: info.bpm, offset: info.offset };
  await Motor.cargarUrl(URL.createObjectURL(file));
  aplicarTempo(); Motor.ir(0); renderConteo(); ajustarLinea();
  toast(`Tempo detectado: ${info.bpm} BPM`);
  S.progreso.txt = 'Subiendo la pista…'; renderPanel();
  try {
    const ext = (file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '');
    const r = await S.st.subirArchivo(file, `coreografias/${c.id}/pista-${Date.now()}.${ext}`, v => { S.progreso && (S.progreso.v = v); document.querySelectorAll('.progreso i').forEach(i => i.style.width = Math.round(v * 100) + '%'); });
    if (S.coreo !== c) return;
    m.url = r.url; m.path = r.path; cambio();
    if (viejo && viejo !== r.path) S.st.borrarArchivo(viejo);
    toast('Pista guardada ✓');
  } catch (e) {
    cambio();
    toast('La pista suena aquí, pero no se pudo subir: ' + (e.code === 'storage/unauthorized' ? 'sin permiso en Storage' : e.message), true);
  }
  S.progreso = null; renderPanel();
}

// Sincroniza el video con la canción comparando sus audios (el archivo no se sube)
async function sincronizarConAudio(file) {
  const c = S.coreo;
  if (!c.video) return toast('Primero agrega el video.', true);
  if (!c.musica.url) return toast('Primero agrega la música de la coreografía.', true);
  S.progreso = { tipo: 'sinc' }; renderPanel();
  let r;
  try {
    const ctx = Motor._asegurarCtx();
    const urlM = await S.st.resolverUrl(c.musica.url);
    const bufM = await ctx.decodeAudioData(await (await fetch(urlM)).arrayBuffer());
    let bufV;
    try { bufV = await ctx.decodeAudioData(await file.arrayBuffer()); }
    catch (_) { throw new Error('No pude leer el audio de ese archivo. Prueba con el video original (MP4) o solo su audio.'); }
    await new Promise(ok => setTimeout(ok, 30));   // deja pintar el aviso antes del cálculo
    r = alinearAudios(bufM, bufV);
  } catch (e) { S.progreso = null; renderPanel(); return toast(e.message || 'No se pudo sincronizar.', true); }
  S.progreso = null;
  if (r.seguridad === 'baja') {
    renderPanel();
    if (!await confirmar('No encontré una coincidencia clara', 'El audio del video no se parece lo suficiente a la canción (mucho ruido, otra versión de la música o un video distinto). ¿Aplicar de todos modos el mejor punto que encontré? Luego lo puedes ajustar a mano.', 'Aplicar', false)) return;
  }
  c.video.offset = Math.round(r.offset * 100) / 100;
  if (r.ritmo && Math.abs(r.ritmo - 1) > 0.001) c.video.ritmo = r.ritmo; else delete c.video.ritmo;
  cambio(); S.sucio = true; renderPanel();
  toast(`Video sincronizado ✓${r.seguridad === 'alta' ? '' : ' (revísalo)'}${c.video.ritmo ? ` · la música del video va al ${(r.ritmo * 100).toFixed(1).replace('.', ',')} %` : ''}${r.cortes ? ' · el video parece tener cortes' : ''}`);
}

async function subirVideo(file) {
  if (!/^video\//.test(file.type)) return toast('Elige un archivo de video.', true);
  const c = S.coreo;
  S.progreso = { tipo: 'video', v: 0 }; renderPanel();
  try {
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
    const r = await S.st.subirArchivo(file, `coreografias/${c.id}/video-${Date.now()}.${ext}`, v => { S.progreso && (S.progreso.v = v); document.querySelectorAll('.progreso i').forEach(i => i.style.width = Math.round(v * 100) + '%'); });
    if (S.coreo !== c) return;
    const viejo = c.video?.path;
    c.video = { url: r.url, path: r.path, nombre: file.name, offset: c.video?.offset || 0 };
    cambio(); S.progreso = null; await cargarMedios(); renderTodo();
    if (viejo && viejo !== r.path) S.st.borrarArchivo(viejo);
    toast('Video guardado ✓. Ahora sincronízalo.');
  } catch (e) {
    S.progreso = null; renderPanel();
    toast('No se pudo subir el video: ' + (e.code === 'storage/unauthorized' ? 'sin permiso en Storage' : e.message), true);
  }
}

/* ═══════════════ Arranque ═══════════════ */
async function volverLista() {
  await cerrarCoreo();
  history.replaceState(null, '', location.pathname);
  mostrar('#v-lista'); renderLista();
}

function iniciar() {
  iniciarLogin(); iniciarEscenario(); iniciarTransporte(); iniciarLinea();
  $('#btn-volver').onclick = volverLista;
  $('#btn-guardar').onclick = async () => { if (await guardarYa()) toast('Guardado ✓'); };
  $('#in-pista').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f && puedeEditar()) subirPista(f); };
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && S.coreo && esCoreografo()) { e.preventDefault(); $('#btn-guardar').click(); }
  });
  $('#chk-vista-alumna').onchange = e => { S.vistaAlumna = e.target.checked; S.sel = null; renderTodo(); };
  requestAnimationFrame(cuadro);

  let modo = null; try { modo = localStorage.getItem('coreo_modo'); } catch (_) {}
  if (modo === 'demo') entrar(sesionDemo());
  if (!FB.ok) { if (modo !== 'demo') msgLogin('Sin conexión con Firebase: puedes usar el modo en este equipo.'); return; }
  if (modo !== 'demo') msgLogin('Cargando…');
  FB.auth.getRedirectResult().catch(() => {});
  FB.auth.onAuthStateChanged(async u => {
    if (!u) { if (S.sesion?.modo !== 'demo') { msgLogin(''); mostrar('#v-login'); } return; }
    if (S.sesion?.modo === 'demo') {   // entró con una cuenta real después de probar
      try { localStorage.removeItem('coreo_modo'); } catch (_) {}
      await cerrarCoreo(); S.unsub.forEach(f => f()); S.unsub = [];
    }
    msgLogin('Entrando…');
    const ses = await resolverSesion(u);
    msgLogin('');
    entrar(ses);
  });
}
iniciar();
