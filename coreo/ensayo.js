/* ═══════════════════════════════════════════════════════════
   coreo/ensayo.js — Modo ensayo / clase
   Solo la canción: tempo, compás, conteo de ochos y velocidad
   sin cambiar el tono (preservesPitch del reproductor).
   Las canciones se guardan en este equipo (IndexedDB).
═══════════════════════════════════════════════════════════ */
const $ = s => document.querySelector(s);
const ENS = { c: null, url: null, arr: null, ondaClave: '', capas: null, ultimo: '', guardarT: null,
  ent: { on: false, desde: 70, hasta: 100, paso: 5, cada: 2, reps: 0 } };
const VEL_MIN = 0.4, VEL_MAX = 1.5;

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function fmtT(t) { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
function fmtBpm(v) { return (Math.round(v * 10) / 10).toString().replace('.', ','); }
let toastT = null;
function toast(msg, err) {
  const el = $('#toast'); el.textContent = msg; el.className = 'toast on' + (err ? ' err' : '');
  clearTimeout(toastT); toastT = setTimeout(() => { el.className = 'toast'; }, 2800);
}
function cargando(on, txt) { $('#cargando').hidden = !on; if (txt) $('#cargando-txt').textContent = txt; }
function grupoPara(n) { if (8 % n === 0) return 8; if (n >= 6) return n; return n * 2; }

/* ── Canciones guardadas en este equipo ── */
const BD = {
  _db: null,
  abrir() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((ok, mal) => {
      const r = indexedDB.open('ensayo', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('canciones', { keyPath: 'id' });
      r.onsuccess = () => ok(this._db = r.result);
      r.onerror = () => mal(r.error);
    });
  },
  async _tx(modo, f) {
    const db = await this.abrir();
    return new Promise((ok, mal) => {
      const tx = db.transaction('canciones', modo), r = f(tx.objectStore('canciones'));
      tx.oncomplete = () => ok(r && r.result); tx.onerror = () => mal(tx.error);
    });
  },
  todas() { return this._tx('readonly', st => st.getAll()); },
  guardar(c) { return this._tx('readwrite', st => st.put(c)); },
  borrar(id) { return this._tx('readwrite', st => st.delete(id)); }
};
function guardarLuego() {
  clearTimeout(ENS.guardarT);
  const c = ENS.c; if (!c) return;
  ENS.guardarT = setTimeout(() => BD.guardar(c).catch(() => toast('No se pudo guardar en este equipo.', true)), 500);
}

let PREFS = { musica: 1 };
try { Object.assign(PREFS, JSON.parse(localStorage.getItem('ensayo_prefs') || '{}')); } catch (_) {}
function guardarPrefs() { try { localStorage.setItem('ensayo_prefs', JSON.stringify(PREFS)); } catch (_) {} }

/* ── Lista ── */
async function mostrarLista() {
  Motor.pausar(); pararEntrenador(); pintarPlay();
  ENS.c = null; Motor.bucle = null;
  $('#v-ens').hidden = true; $('#v-vacio').hidden = false; $('#btn-lista').hidden = true;
  let lista = [];
  try { lista = await BD.todas(); } catch (_) {}
  lista.sort((a, b) => (b.usada || 0) - (a.usada || 0));
  $('#recientes').innerHTML = lista.length ? `
    <h2 class="sec-tit">Mis canciones</h2>
    <ul class="canciones">${lista.map(c => `
      <li>
        <button class="cancion" type="button" data-acc="abrir" data-id="${esc(c.id)}">
          <b>${esc(c.nombre)}</b>
          <span>${fmtBpm(c.bpm)} BPM · ${c.medida}/${c.unidad} · ${fmtT(c.duracion).replace(/\.\d$/, '')}${c.vel && c.vel !== 1 ? ` · al ${Math.round(c.vel * 100)}%` : ''}</span>
        </button>
        <button class="btn-icono" type="button" data-acc="borrar" data-id="${esc(c.id)}" aria-label="Borrar ${esc(c.nombre)}">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        </button>
      </li>`).join('')}
    </ul>
    <p class="nota">Las canciones se guardan solo en este equipo, con su tempo, compás y velocidad.</p>` : '';
}

async function nuevaCancion(file) {
  if (!file) return;
  if (!/^audio\//.test(file.type) && !/\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(file.name)) return toast('Elige un archivo de audio (MP3, M4A o WAV).', true);
  Motor.pausar(); pintarPlay();
  cargando(true, 'Escuchando la canción para encontrar el tempo y el compás…');
  let info;
  try { info = await analizarPista(file); }
  catch (e) { cargando(false); return toast('No se pudo leer ese audio.', true); }
  const medida = info.medida || 4, ahora = Date.now();
  const c = {
    id: ahora.toString(36) + Math.random().toString(36).slice(2, 6),
    nombre: file.name.replace(/\.[^.]+$/, ''), blob: file,
    duracion: info.duracion, picos: info.picos,
    bpm: info.bpm, offset: info.offset, medida, unidad: 4, grupo: grupoPara(medida),
    det: { bpm: info.bpm, offset: info.offset, medida, seguro: !!info.seguro },
    vel: 1, creada: ahora, usada: ahora
  };
  try { await BD.guardar(c); } catch (_) { toast('Suena aquí, pero no se pudo guardar en este equipo.', true); }
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (_) {}
  cargando(false);
  await abrirCancion(c);
  toast(`Tempo: ${fmtBpm(c.bpm)} BPM · compás ${medida}/4${c.det.seguro ? '' : ' (compruébalo con el conteo)'}`);
}

async function abrirCancion(c) {
  pararEntrenador();
  ENS.c = c; c.usada = Date.now(); guardarLuego();
  if (ENS.url) URL.revokeObjectURL(ENS.url);
  ENS.url = URL.createObjectURL(c.blob);
  Motor.bucle = null;
  await Motor.cargarUrl(ENS.url);
  Motor.duracion = c.duracion || Motor.audio.duration || 120;
  Motor.audio.volume = PREFS.musica;
  aplicarTempo();
  Motor.ponerVelocidad(c.vel || 1);
  Motor.ir(0);
  $('#v-vacio').hidden = true; $('#v-ens').hidden = false; $('#btn-lista').hidden = false;
  renderTodo();
}

function aplicarTempo() {
  const c = ENS.c;
  const P = 60 / c.bpm * c.grupo;               // el 1 más cercano al inicio (se mueve de a ochos enteros)
  c.offset = Math.round((((c.offset % P) + P) % P) * 1000) / 1000;
  Motor.tempo = { bpm: c.bpm, offset: c.offset, medida: c.medida, unidad: c.unidad, grupo: c.grupo };
  Motor._reiniciarMet();
  ENS.ondaClave = '';
}

/* ── Pantalla ── */
function renderTodo() {
  const c = ENS.c;
  $('#c-nombre').textContent = c.nombre;
  $('#duracion').textContent = fmtT(c.duracion).replace(/\.\d$/, '');
  renderInfo(); renderTempo(); renderVel(); renderMet(); renderConteoBase(); renderEnt(); pintarPlay(); pintarBucle();
}
function renderInfo() {
  const c = ENS.c;
  $('#c-info').textContent = `${fmtBpm(c.bpm)} BPM · compás ${c.medida}/${c.unidad} · se cuenta de a ${c.grupo}`;
  $('#btn-atras').textContent = '−' + c.grupo; $('#btn-adelante').textContent = '+' + c.grupo;
  $('#btn-atras').setAttribute('aria-label', `Retroceder ${c.grupo} tiempos`);
  $('#btn-adelante').setAttribute('aria-label', `Avanzar ${c.grupo} tiempos`);
  $('#btn-ocho').textContent = Motor.bucle && !Motor.bucle.ocho ? 'Quitar repetición' : (c.grupo === 8 ? 'Repetir ocho' : `Repetir ${c.grupo}`);
}

function renderTempo() {
  const c = ENS.c, d = c.det || {};
  const presets = [[2, 4], [3, 4], [4, 4], [6, 8]];
  const esPreset = presets.some(([m, u]) => m === c.medida && u === c.unidad);
  $('#tarjeta-tempo').innerHTML = `
    <h3>Tempo y compás</h3>
    <div class="bpm-fila">
      <button class="btn btn-mini" data-acc="bpm" data-d="-1" type="button" aria-label="Bajar 1 BPM">−1</button>
      <button class="btn btn-mini" data-acc="bpm" data-d="-0.1" type="button" aria-label="Bajar 0,1 BPM">−0,1</button>
      <input id="in-bpm" type="number" inputmode="decimal" min="20" max="320" step="0.01" value="${c.bpm}" aria-label="Tempo en BPM">
      <button class="btn btn-mini" data-acc="bpm" data-d="0.1" type="button" aria-label="Subir 0,1 BPM">+0,1</button>
      <button class="btn btn-mini" data-acc="bpm" data-d="1" type="button" aria-label="Subir 1 BPM">+1</button>
    </div>
    <div class="botones">
      <button class="btn btn-mini" data-acc="x2" type="button" title="Si el conteo va a la mitad de lo que bailas">×2</button>
      <button class="btn btn-mini" data-acc="d2" type="button" title="Si el conteo va el doble de rápido">÷2</button>
      ${d.bpm && (d.bpm !== c.bpm || d.medida !== c.medida || d.offset !== c.offset) ? '<button class="btn btn-mini btn-sutil" data-acc="detectado" type="button">Volver a lo detectado</button>' : ''}
    </div>
    <p class="det${d.seguro === false ? ' dudoso' : ''}">Detectado: <b>${fmtBpm(d.bpm || c.bpm)} BPM · ${d.medida || 4}/4</b>${d.seguro === false ? ' — el compás es dudoso, compruébalo con el conteo.' : ''}</p>
    <div class="botones"><button class="btn tap" data-acc="tap" id="btn-tap" type="button">TAP · toca al ritmo</button></div>

    <div class="sep-t"></div>
    <p class="eti-t">Compás</p>
    <div class="chips">
      ${presets.map(([m, u]) => `<button class="chip" type="button" data-acc="compas" data-m="${m}" data-u="${u}" aria-selected="${m === c.medida && u === c.unidad}">${m}/${u}</button>`).join('')}
      <button class="chip" type="button" data-acc="otro" aria-selected="${!esPreset}">Otro</button>
    </div>
    <div class="campos" style="margin-top:10px" ${esPreset && !ENS.otro ? 'hidden' : ''}>
      <label class="campo">Tiempos <input id="in-medida" type="number" min="1" max="32" value="${c.medida}"></label>
      <label class="campo">Figura <select id="in-unidad">${[2, 4, 8, 16].map(u => `<option ${u === c.unidad ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
    </div>
    <label class="campo" style="margin-top:10px">Contar de a <input id="in-grupo" type="number" min="1" max="32" value="${c.grupo}"> tiempos</label>

    <div class="sep-t"></div>
    <p class="eti-t">Dónde empieza el 1</p>
    <div class="botones" style="margin-top:0">
      <button class="btn btn-mini" data-acc="uno" type="button" title="El tiempo que está sonando pasa a ser el 1">El 1 es aquí</button>
      <button class="btn btn-mini" data-acc="corrida" data-d="-1" type="button" title="El 1 cae un tiempo antes">← 1 tiempo</button>
      <button class="btn btn-mini" data-acc="corrida" data-d="1" type="button" title="El 1 cae un tiempo después">1 tiempo →</button>
    </div>
    <div class="botones">
      <button class="btn btn-mini btn-sutil" data-acc="fino" data-d="-0.01" type="button">Adelantar 10 ms</button>
      <button class="btn btn-mini btn-sutil" data-acc="fino" data-d="0.01" type="button">Atrasar 10 ms</button>
    </div>
    <p class="nota">Primer 1 en ${fmtT(c.offset)}${c.offset ? ` (+${Math.round((c.offset % 1) * 1000)} ms)` : ''}. Si el metrónomo suena antes o después de la música, ajústalo con los 10 ms.</p>`;
}

function renderVel() {
  const c = ENS.c, v = c.vel || 1;
  $('#vel-pct').textContent = Math.round(v * 100) + '%';
  $('#vel-bpm').textContent = fmtBpm(c.bpm * v) + ' BPM';
  $('#in-vel').value = Math.round(v * 100);
  if (document.activeElement !== $('#in-vel-bpm')) $('#in-vel-bpm').value = Math.round(c.bpm * v * 10) / 10;
  $('#chips-vel').innerHTML = [50, 60, 70, 75, 80, 90, 100, 110].map(p =>
    `<button class="chip" type="button" data-acc="vel" data-v="${p}" aria-selected="${Math.round(v * 100) === p}">${p}%</button>`).join('');
}
function ponerVel(v) {
  v = Math.max(VEL_MIN, Math.min(VEL_MAX, Math.round(v * 1000) / 1000));
  ENS.c.vel = v; Motor.ponerVelocidad(v); renderVel(); guardarLuego();
}

function renderMet() {
  const m = Motor.met;
  ['#btn-met', '#btn-met2'].forEach(s => $(s).setAttribute('aria-pressed', String(!!m.on)));
  $('#btn-acento').setAttribute('aria-pressed', String(!!m.acento));
  document.querySelectorAll('#seg-sub button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.s === (m.sub || 1))));
  $('#in-vol-met').value = m.vol; $('#in-vol-mus').value = PREFS.musica;
}

function renderConteoBase() {
  const c = ENS.c, g = c.grupo, m = c.medida;
  const cel = $('#k-celdas');
  cel.hidden = g > 16;
  cel.style.gridTemplateColumns = `repeat(${g}, minmax(0, 1fr))`;
  cel.innerHTML = Array.from({ length: g }, (_, i) => `<i class="${i % m === 0 ? 'compas' : ''}">${i + 1}</i>`).join('');
  const luces = $('#k-luces');
  luces.hidden = m > 12;
  luces.innerHTML = Array.from({ length: m }, (_, i) => '<span class="luz"></span>').join('');
  ENS.ultimo = '';
}

function pintarPlay() {
  const b = $('#btn-play'); if (!b) return;
  b.innerHTML = Motor.tocando
    ? '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M8 5l12 7-12 7z" fill="currentColor"/></svg>';
  b.setAttribute('aria-label', Motor.tocando ? 'Pausar' : 'Reproducir');
}
function pintarBucle() {
  const on = !!Motor.bucle;
  $('#btn-ocho').setAttribute('aria-pressed', String(on));
  $('#onda-ayuda').textContent = on ? `Repitiendo ${fmtT(Motor.bucle.a)} – ${fmtT(Motor.bucle.b)}` : 'Toca para saltar · arrastra para repetir un tramo';
  renderInfo(); ENS.ondaClave = '';
}

/* ── Reloj en pantalla ── */
function tiempoVisible() {
  const lat = Motor.ctx && Motor.tocando ? (Motor.ctx.outputLatency || Motor.ctx.baseLatency || 0) : 0;
  return Math.max(0, Motor.tiempo() - lat * Motor.vel);
}
function beatEn(t) { return (t - Motor.tempo.offset) / (60 / Motor.tempo.bpm); }

function pintarConteo(beat) {
  const c = ENS.c, g = c.grupo, m = c.medida;
  const b = Math.floor(beat + 1e-6), frac = beat - b;
  const golpe = Motor.tocando && frac < 0.18;
  const clave = b + '|' + golpe;
  if (clave === ENS.ultimo) return;
  ENS.ultimo = clave;
  const n = mod(b, g), ocho = Math.floor(b / g) + 1;
  const num = $('#k-num');
  num.textContent = n + 1;
  num.className = 'cont-num' + (n === 0 ? ' uno' : '') + (golpe ? ' golpe' : '');
  $('#k-ocho').textContent = ocho >= 1 ? ocho : 'Entrada';
  $('#k-compas-eti').textContent = 'Compás ' + (Math.floor(b / m) + 1 >= 1 ? Math.floor(b / m) + 1 : '–');
  const enC = mod(b, m);
  document.querySelectorAll('#k-luces .luz').forEach((el, i) => {
    el.className = 'luz' + (i === enC ? ' actual' : '') + (i === enC && golpe ? ' on' : '') + (i === 0 ? ' uno' : '');
  });
  document.querySelectorAll('#k-celdas i').forEach((el, i) => {
    el.className = (i % m === 0 ? 'compas' : '') + (i === n ? ' on' : '') + (i === 0 ? ' uno' : '');
  });
}

/* ── Forma de onda ── */
function prepararOnda(W, H, dpr) {
  const c = ENS.c, picos = c.picos || [], dur = c.duracion || 1;
  const mk = () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; return cv; };
  const base = mk(), hecha = mk();
  const spb = 60 / c.bpm, pxS = W / dur;
  [[base, '#3a3f4e'], [hecha, '#f2c230']].forEach(([cv, color]) => {
    const x = cv.getContext('2d');
    x.fillStyle = color;
    const mid = H / 2 + 6 * dpr, alto = H / 2 - 14 * dpr, paso = Math.max(1, Math.round(2 * dpr));
    for (let px = 0; px < W; px += paso) {
      const i0 = Math.floor(px / W * picos.length), i1 = Math.max(i0 + 1, Math.floor((px + paso) / W * picos.length));
      let v = 0; for (let i = i0; i < i1 && i < picos.length; i++) if (picos[i] > v) v = picos[i];
      const h = Math.max(1, v / 100 * alto);
      x.fillRect(px, mid - h, Math.max(1, paso - dpr * 0.6), h * 2);
    }
  });
  // Rejilla: compases y ochos
  const x = base.getContext('2d');
  const pxCompas = c.medida * spb * pxS;
  x.font = `${11 * dpr}px Manrope, system-ui, sans-serif`; x.textBaseline = 'top';
  let ultimaEti = -Infinity;
  for (let k = Math.ceil(-c.offset / spb); c.offset + k * spb <= dur; k++) {
    const t = c.offset + k * spb, px = Math.round(t * pxS) + 0.5;
    if (mod(k, c.grupo) === 0) {
      x.fillStyle = 'rgba(242,194,48,.35)'; x.fillRect(px, 14 * dpr, dpr, H - 14 * dpr);
      if (px - ultimaEti > 26 * dpr) { x.fillStyle = '#a4a9b8'; x.fillText(String(Math.floor(k / c.grupo) + 1), px + 3 * dpr, 2 * dpr); ultimaEti = px; }
    } else if (pxCompas > 6 * dpr && mod(k, c.medida) === 0) {
      x.fillStyle = 'rgba(164,169,184,.18)'; x.fillRect(px, 14 * dpr, dpr, H - 14 * dpr);
    }
  }
  return { base, hecha };
}

function dibujarOnda(t) {
  const cv = $('#onda'), dpr = window.devicePixelRatio || 1;
  const W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
  if (!W || !H) return;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; ENS.ondaClave = ''; }
  const clave = [W, H, ENS.c.id, ENS.c.bpm, ENS.c.offset, ENS.c.medida, ENS.c.grupo].join('|');
  if (clave !== ENS.ondaClave) { ENS.capas = prepararOnda(W, H, dpr); ENS.ondaClave = clave; }
  const x = cv.getContext('2d'), dur = ENS.c.duracion || 1, pxS = W / dur;
  x.clearRect(0, 0, W, H);
  const bu = ENS.arr && ENS.arr.prev ? ENS.arr.prev : Motor.bucle;
  if (bu) { x.fillStyle = 'rgba(76,125,255,.20)'; x.fillRect(bu.a * pxS, 0, (bu.b - bu.a) * pxS, H); x.fillStyle = '#4c7dff'; x.fillRect(bu.a * pxS, 0, 2 * dpr, H); x.fillRect(bu.b * pxS - 2 * dpr, 0, 2 * dpr, H); }
  x.drawImage(ENS.capas.base, 0, 0);
  const xp = Math.round(t * pxS);
  if (xp > 0) x.drawImage(ENS.capas.hecha, 0, 0, xp, H, 0, 0, xp, H);
  x.fillStyle = '#eceef3'; x.fillRect(xp - dpr, 0, 2 * dpr, H);
}
function tiempoEnX(e) {
  const r = $('#onda').getBoundingClientRect();
  return Math.max(0, Math.min(ENS.c.duracion, (e.clientX - r.left) / r.width * ENS.c.duracion));
}
function tramoAjustado(t0, t1) {
  const spb = 60 / Motor.tempo.bpm, off = Motor.tempo.offset;
  let a = off + Math.floor((t0 - off) / spb) * spb, b = off + Math.ceil((t1 - off) / spb) * spb;
  if (b - a < spb) b = a + spb;
  return { a: Math.max(0, a), b: Math.min(ENS.c.duracion, b) };
}
function iniciarOnda() {
  const cv = $('#onda');
  cv.onpointerdown = e => { if (!ENS.c) return; cv.setPointerCapture(e.pointerId); ENS.arr = { x0: e.clientX, t0: tiempoEnX(e), mov: false, prev: null }; };
  cv.onpointermove = e => {
    const a = ENS.arr; if (!a) return;
    if (Math.abs(e.clientX - a.x0) > 8) a.mov = true;
    if (a.mov) { const t1 = tiempoEnX(e); a.prev = tramoAjustado(Math.min(a.t0, t1), Math.max(a.t0, t1)); }
  };
  cv.onpointerup = e => {
    const a = ENS.arr; ENS.arr = null; if (!a) return;
    if (!a.mov) { Motor.ir(tiempoEnX(e)); return; }
    Motor.bucle = a.prev; Motor.ir(a.prev.a); pintarBucle();
    toast('Repitiendo ese tramo. Toca «Quitar repetición» para seguir.');
  };
  cv.onpointercancel = () => { ENS.arr = null; };
}

/* ── Acciones ── */
function ponerBpm(v) {
  v = Math.max(20, Math.min(320, Math.round(v * 100) / 100));
  if (!isFinite(v)) return;
  ENS.c.bpm = v; aplicarTempo(); renderTempo(); renderInfo(); renderVel(); guardarLuego();
}
function ponerCompas(m, u) {
  const c = ENS.c; c.medida = m; c.unidad = u; c.grupo = grupoPara(m);
  aplicarTempo(); renderTempo(); renderInfo(); renderConteoBase(); guardarLuego();
}
function moverUno(segundos) {
  ENS.c.offset += segundos; aplicarTempo(); renderTempo(); guardarLuego(); ENS.ultimo = '';
}
function saltarOcho(dir) {
  const spb = 60 / Motor.tempo.bpm, g = Motor.tempo.grupo, off = Motor.tempo.offset;
  const b = beatEn(Motor.tiempo());
  let k = Math.floor((b + 0.25) / g) + dir;            // si estás recién empezando un ocho, «−8» va al anterior
  if (dir < 0 && b - (k + 1) * g > 1) k += 1;          // a mitad de un ocho, «−8» vuelve a su inicio
  Motor.ir(Math.max(0, off + k * g * spb));
  if (Motor.bucle && Motor.bucle.ocho) ponerOcho(true);
}
function ponerOcho(on) {
  if (!on) { Motor.bucle = null; pintarBucle(); return; }
  const spb = 60 / Motor.tempo.bpm, g = Motor.tempo.grupo, off = Motor.tempo.offset;
  const k = Math.floor(beatEn(Motor.tiempo()) / g + 1e-6);
  const a = Math.max(0, off + k * g * spb);
  Motor.bucle = { a, b: Math.min(ENS.c.duracion, off + (k + 1) * g * spb), ocho: true };
  pintarBucle();
}
async function alternarPlay() {
  if (Motor.tocando) Motor.pausar(); else await Motor.reproducir();
  pintarPlay();
}

/* Subir poco a poco */
function leerEnt() {
  const e = ENS.ent, n = (id, d) => { const v = +$(id).value; return isFinite(v) && v > 0 ? v : d; };
  e.desde = Math.max(40, Math.min(150, n('#ent-desde', 70)));
  e.hasta = Math.max(40, Math.min(150, n('#ent-hasta', 100)));
  e.paso = Math.max(1, Math.min(25, n('#ent-paso', 5)));
  e.cada = Math.max(1, Math.min(20, Math.round(n('#ent-cada', 2))));
}
function renderEnt() {
  const e = ENS.ent, est = $('#ent-estado');
  $('#btn-ent').textContent = e.on ? 'Detener' : 'Empezar';
  $('#btn-ent').className = 'btn btn-ancho' + (e.on ? ' btn-peligro' : ' btn-primario');
  est.hidden = !e.on;
  if (e.on) {
    const v = Math.round(Motor.vel * 100), faltan = e.cada - (e.reps % e.cada);
    est.textContent = v >= e.hasta ? `Ya vas al ${v}%.` : `Vas al ${v}%: sube a ${Math.min(e.hasta, v + e.paso)}% en ${faltan} ${faltan === 1 ? 'vuelta' : 'vueltas'}.`;
  }
}
function iniciarEntrenador() {
  leerEnt(); const e = ENS.ent;
  e.on = true; e.reps = 0;
  ponerVel(e.desde / 100);
  if (!Motor.bucle) ponerOcho(true);
  if (!Motor.tocando) Motor.reproducir().then(pintarPlay);
  renderEnt();
}
function pararEntrenador(msg) {
  if (!ENS.ent.on) return;
  ENS.ent.on = false; if (msg) toast(msg); if (ENS.c) renderEnt();
}
Motor.alRepetir = () => {
  const e = ENS.ent; if (!e.on) return;
  e.reps++;
  if (e.reps % e.cada === 0) {
    const v = Math.round(Motor.vel * 100);
    if (v >= e.hasta) { pararEntrenador(`¡Listo! Llegaste al ${v}%.`); return; }
    const nv = Math.min(e.hasta, v + e.paso);
    ponerVel(nv / 100); toast(`Subimos al ${nv}%`);
  }
  renderEnt();
};
Motor.alTerminar = () => { pintarPlay(); pararEntrenador(); };

/* ── Eventos (delegación, como en el resto de la app) ── */
document.onclick = async e => {
  const b = e.target.closest('[data-acc]'); if (!b) return;
  const acc = b.dataset.acc, c = ENS.c;
  switch (acc) {
    case 'lista': return mostrarLista();
    case 'abrir': {
      const lista = await BD.todas().catch(() => []);
      const x = lista.find(s => s.id === b.dataset.id);
      if (x) { cargando(true, 'Abriendo…'); try { await abrirCancion(x); } finally { cargando(false); } }
      return;
    }
    case 'borrar': {
      const lista = await BD.todas().catch(() => []);
      const x = lista.find(s => s.id === b.dataset.id); if (!x) return;
      if (!confirm(`¿Borrar «${x.nombre}» de este equipo? No se puede deshacer.`)) return;
      await BD.borrar(x.id).catch(() => {}); toast('Canción borrada'); return mostrarLista();
    }
  }
  if (!c) return;
  switch (acc) {
    case 'play': return alternarPlay();
    case 'inicio': Motor.ir(Motor.bucle ? Motor.bucle.a : 0); return;
    case 'atras': return saltarOcho(-1);
    case 'adelante': return saltarOcho(1);
    case 'ocho': return ponerOcho(!Motor.bucle);
    case 'met':
      Motor.met.on = !Motor.met.on; Motor._reiniciarMet(); renderMet();
      if (Motor.met.on && !Motor.tocando) toast('Metrónomo listo: dale ▶ para oírlo con la canción.');
      return;
    case 'acento': Motor.met.acento = !Motor.met.acento; guardarPrefsMet(); return renderMet();
    case 'sub': Motor.met.sub = +b.dataset.s; guardarPrefsMet(); Motor._reiniciarMet(); return renderMet();
    case 'vel': return ponerVel(+b.dataset.v / 100);
    case 'vel-d': return ponerVel((Math.round(c.vel * 100) + +b.dataset.d) / 100);
    case 'bpm': return ponerBpm(c.bpm + +b.dataset.d);
    case 'x2': return ponerBpm(c.bpm * 2);
    case 'd2': return ponerBpm(c.bpm / 2);
    case 'detectado':
      Object.assign(c, { bpm: c.det.bpm, offset: c.det.offset, medida: c.det.medida, unidad: 4, grupo: grupoPara(c.det.medida) });
      aplicarTempo(); renderTodo(); guardarLuego(); return;
    case 'tap': {
      const v = Tap.tocar();
      b.textContent = v ? `TAP · ${fmtBpm(v)} BPM` : 'TAP · sigue tocando…';
      if (v) { clearTimeout(ENS.tapT); ENS.tapT = setTimeout(() => { ponerBpm(v); toast(`Tempo: ${fmtBpm(v)} BPM`); }, 1300); }
      return;
    }
    case 'compas': ENS.otro = false; return ponerCompas(+b.dataset.m, +b.dataset.u);
    case 'otro': ENS.otro = true; return renderTempo();
    case 'uno': {
      const beat = beatEn(tiempoVisible());
      moverUno(Math.round(beat) * 60 / c.bpm); toast('Listo: ese tiempo ahora es el 1'); return;
    }
    case 'corrida': return moverUno(+b.dataset.d * 60 / c.bpm);
    case 'fino': return moverUno(+b.dataset.d);
    case 'ent': return ENS.ent.on ? pararEntrenador() : iniciarEntrenador();
  }
};

document.oninput = e => {
  const id = e.target.id, c = ENS.c; if (!c) return;
  if (id === 'in-vel') ponerVel(+e.target.value / 100);
  else if (id === 'in-vol-met') { Motor.met.vol = +e.target.value; guardarPrefsMet(); }
  else if (id === 'in-vol-mus') { PREFS.musica = +e.target.value; Motor.audio.volume = PREFS.musica; guardarPrefs(); }
};
document.onchange = e => {
  const t = e.target, c = ENS.c;
  if (t.id === 'in-cancion') { const f = t.files[0]; t.value = ''; return nuevaCancion(f); }
  if (!c) return;
  if (t.id === 'in-bpm') { const v = parseFloat(String(t.value).replace(',', '.')); if (v > 0) ponerBpm(v); else renderTempo(); }
  else if (t.id === 'in-vel-bpm') { const v = parseFloat(String(t.value).replace(',', '.')); if (v > 0) ponerVel(v / c.bpm); t.blur(); renderVel(); }
  else if (t.id === 'in-medida' || t.id === 'in-unidad') {
    const m = Math.round(+$('#in-medida').value), u = +$('#in-unidad').value;
    if (m >= 1 && m <= 32) ponerCompas(m, u); else renderTempo();
  }
  else if (t.id === 'in-grupo') {
    const g = Math.round(+t.value);
    if (g >= 1 && g <= 32) { c.grupo = g; aplicarTempo(); renderInfo(); renderConteoBase(); guardarLuego(); } else renderTempo();
  }
  else if (/^ent-/.test(t.id)) { leerEnt(); renderEnt(); }
};

document.onkeydown = e => {
  if (!ENS.c || e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if ((tag === 'input' && e.target.type !== 'range') || tag === 'select' || tag === 'textarea') return;
  const k = e.key;
  if (k === ' ' || e.code === 'Space') { e.preventDefault(); alternarPlay(); }
  else if (k === 'ArrowLeft') { e.preventDefault(); saltarOcho(-1); }
  else if (k === 'ArrowRight') { e.preventDefault(); saltarOcho(1); }
  else if (k === 'ArrowUp') { e.preventDefault(); ponerVel((Math.round(ENS.c.vel * 100) + 5) / 100); }
  else if (k === 'ArrowDown') { e.preventDefault(); ponerVel((Math.round(ENS.c.vel * 100) - 5) / 100); }
  else if (k === 't' || k === 'T') { const b = $('#btn-tap'); b && b.click(); }
  else if (k === 'm' || k === 'M') $('#btn-met').click();
  else if (k === 'r' || k === 'R') $('#btn-ocho').click();
};

// Arrastrar una canción sobre la página
document.ondragover = e => { e.preventDefault(); $('#soltar').classList.add('encima'); };
document.ondragleave = e => { if (!e.relatedTarget) $('#soltar').classList.remove('encima'); };
document.ondrop = e => {
  e.preventDefault(); $('#soltar').classList.remove('encima');
  const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) nuevaCancion(f);
};

function cuadro() {
  requestAnimationFrame(cuadro);
  if (!ENS.c || $('#v-ens').hidden) return;
  const t = tiempoVisible();
  pintarConteo(beatEn(t));
  const txt = fmtT(t);
  const el = $('#tiempo'); if (el.textContent !== txt) el.textContent = txt;
  dibujarOnda(t);
}

iniciarOnda();
mostrarLista();
requestAnimationFrame(cuadro);
