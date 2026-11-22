/* ═══════════════════════════════════════════════════════════
   coreo/datos.js
   Sesión (Google / celular / modo práctica) y almacenamiento.
   Dos "almacenes" con la misma interfaz:
     Nube  → Firestore (proyecto lazos-tricolor-academia). La música se guarda en
             Firestore por partes (plan gratis); el video va por enlace (YouTube o .mp4).
             Si algún día se activa Storage (plan Blaze), poner STORAGE_ACTIVO = true.
     Demo  → localStorage + IndexedDB (solo en este equipo)
═══════════════════════════════════════════════════════════ */

// Misma configuración pública que js/state.js (no se carga aquí para no traer el DB del panel).
const FB_CONFIG_COREO = {
  apiKey: 'AIzaSyCIj32zyCreKyCGJSMo6T5yTDhMeqctpG4',
  authDomain: 'lazos-tricolor-academia.firebaseapp.com',
  projectId: 'lazos-tricolor-academia',
  // Si en Firebase → Storage el bucket aparece como ...firebasestorage.app, cámbialo aquí.
  storageBucket: 'lazos-tricolor-academia.appspot.com',
  appId: '1:284048193120:web:96cacf134a537c9ad57505'
};

// Storage necesita el plan de pago Blaze. Mientras sea false, la pista va a Firestore
// (coreografias/{id}/pista/*) y los videos se agregan con un enlace.
const STORAGE_ACTIVO = false;
const PISTA_MAX_MB = 20;              // ~23 documentos de 900 KB
const PISTA_PARTE = 900 * 1024;

// Cuentas que pueden crear y modificar coreografías (deben coincidir con firestore.rules y storage.rules)
const COREOGRAFOS = ['academialazostricolor@gmail.com', 'alfredomariara@gmail.com'];
const CATEGORIAS = ['Infantil', 'Juvenil', 'Adulto'];

let FB = { ok: false, auth: null, db: null, st: null };
try {
  firebase.initializeApp(FB_CONFIG_COREO);
  FB.auth = firebase.auth();
  FB.db = firebase.firestore();
  FB.st = firebase.storage ? firebase.storage() : null;
  FB.auth.languageCode = 'es';
  FB.ok = true;
} catch (e) { console.warn('Firebase no disponible:', e.message); }

// ── Claves de alumna: "mail:correo" o "tel:+57..." (mismo formato que firestore.rules) ──
function normalizarTel(v) {
  let t = String(v || '').replace(/[^\d+]/g, '');
  if (!t) return '';
  if (t.startsWith('+')) return t;
  if (t.length === 10 && t[0] === '3') return '+57' + t;   // celular colombiano
  if (t.startsWith('57') && t.length === 12) return '+' + t;
  return '+' + t;
}
function claveDe(tipo, valor) {
  return tipo === 'tel' ? 'tel:' + normalizarTel(valor) : 'mail:' + String(valor || '').trim().toLowerCase();
}
function claveDeUsuario(u) {
  if (!u) return '';
  if (u.phoneNumber) return 'tel:' + u.phoneNumber;
  return 'mail:' + (u.email || '').toLowerCase();
}
const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

/* ═══════════════ ALMACÉN NUBE ═══════════════ */
const Nube = {
  nombre: 'nube',
  _col: n => FB.db.collection(n),

  escucharLista(sesion, cb, err) {
    const aLista = s => s.docs.map(d => Object.assign({ id: d.id }, d.data()));
    if (sesion.rol === 'coreografo') return this._col('coreografias').onSnapshot(s => cb(aLista(s)), err);
    // Alumna: una consulta por categoría (así las reglas pueden comprobar cada una)
    const partes = {};
    const subs = sesion.categorias.map(cat => this._col('coreografias').where('categoria', '==', cat)
      .onSnapshot(s => { partes[cat] = aLista(s); cb([].concat(...Object.values(partes))); }, err));
    if (!subs.length) cb([]);
    return () => subs.forEach(f => f());
  },
  escucharCoreo(id, cb, err) {
    return this._col('coreografias').doc(id).onSnapshot(d => cb(d.exists ? Object.assign({ id: d.id }, d.data()) : null), err);
  },
  async obtenerCoreo(id) {
    const d = await this._col('coreografias').doc(id).get();
    return d.exists ? Object.assign({ id: d.id }, d.data()) : null;
  },
  async guardarCoreo(c) {
    const datos = JSON.parse(JSON.stringify(c)); delete datos.id;
    await this._col('coreografias').doc(c.id).set(datos);
  },
  async borrarCoreo(id) {
    const partes = await this._col('coreografias').doc(id).collection('pista').get().catch(() => null);
    if (partes) await Promise.all(partes.docs.map(d => d.ref.delete()));
    await this._col('coreografias').doc(id).delete();
  },

  subeVideos: STORAGE_ACTIVO,
  subirArchivo(file, ruta, alProgreso) {
    const esAudio = /^audio\//.test(file.type) || /\.(mp3|m4a|wav|ogg|aac)$/i.test(file.name);
    if (!STORAGE_ACTIVO) {
      if (esAudio) return this._subirPista(file, ruta, alProgreso);
      return Promise.reject(new Error('para el video usa un enlace de YouTube'));
    }
    return new Promise((ok, mal) => {
      if (!FB.st) return mal(new Error('Firebase Storage no está activado.'));
      const ref = FB.st.ref(ruta);
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const tipo = file.type || { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' }[ext] || 'application/octet-stream';
      const tarea = ref.put(file, { contentType: tipo });
      tarea.on('state_changed',
        s => alProgreso && alProgreso(s.bytesTransferred / (s.totalBytes || 1)),
        mal,
        async () => ok({ url: await ref.getDownloadURL(), path: ruta }));
    });
  },
  // Pista en Firestore: documentos coreografias/{coreo}/pista/{archivo}_{n} con los bytes.
  // url y path quedan como "fs:{coreo}/{archivo}".
  async _subirPista(file, ruta, alProgreso) {
    if (file.size > PISTA_MAX_MB * 1024 * 1024) throw new Error(`la pista pesa más de ${PISTA_MAX_MB} MB; usa un MP3 más liviano`);
    const coreo = ruta.split('/')[1], archivo = 'p' + Date.now().toString(36);
    const total = Math.ceil(file.size / PISTA_PARTE) || 1;
    const tipo = file.type || 'audio/mpeg';
    const col = this._col('coreografias').doc(coreo).collection('pista');
    for (let n = 0; n < total; n++) {
      const bytes = new Uint8Array(await file.slice(n * PISTA_PARTE, (n + 1) * PISTA_PARTE).arrayBuffer());
      await col.doc(archivo + '_' + String(n).padStart(3, '0')).set({ archivo, n, total, tipo, datos: firebase.firestore.Blob.fromUint8Array(bytes) });
      alProgreso && alProgreso((n + 1) / total);
    }
    const ref = 'fs:' + coreo + '/' + archivo;
    return { url: ref, path: ref };
  },
  _partes(ref) {
    const [coreo, archivo] = ref.slice(3).split('/');
    return this._col('coreografias').doc(coreo).collection('pista').where('archivo', '==', archivo).get();
  },
  async borrarArchivo(path) {
    try {
      if (path && path.startsWith('fs:')) { const s = await this._partes(path); await Promise.all(s.docs.map(d => d.ref.delete())); }
      else if (path && FB.st && STORAGE_ACTIVO) await FB.st.ref(path).delete();
    } catch (_) {}
  },
  _urls: new Map(),
  async resolverUrl(url) {
    if (!url || !url.startsWith('fs:')) return url;
    if (this._urls.has(url)) return this._urls.get(url);
    const s = await this._partes(url);
    const docs = s.docs.map(d => d.data()).sort((a, b) => a.n - b.n);
    if (!docs.length || docs.length !== docs[0].total) return null;
    const blob = new Blob(docs.map(d => d.datos.toUint8Array()), { type: docs[0].tipo || 'audio/mpeg' });
    const u = URL.createObjectURL(blob); this._urls.set(url, u); return u;
  },

  // Solicitudes de cambio de nombre
  async crearSolicitud(s) { await this._col('solicitudes').add(s); },
  escucharSolicitudes(sesion, cb) {
    let q = this._col('solicitudes');
    q = sesion.rol === 'coreografo' ? q.where('estado', '==', 'pendiente') : q.where('uid', '==', sesion.uid);
    return q.onSnapshot(s => cb(s.docs.map(d => Object.assign({ id: d.id }, d.data()))), () => cb([]));
  },
  async resolverSolicitud(id, estado) { await this._col('solicitudes').doc(id).update({ estado, resueltaEn: Date.now() }); },

  // Alumnas autorizadas
  escucharAutorizados(cb) {
    return this._col('autorizados').onSnapshot(s => cb(s.docs.map(d => Object.assign({ clave: d.id }, d.data()))), () => cb([]));
  },
  async guardarAutorizado(clave, datos) { await this._col('autorizados').doc(clave).set(datos); },
  async borrarAutorizado(clave) { await this._col('autorizados').doc(clave).delete(); },
  async leerAutorizado(clave) {
    const d = await this._col('autorizados').doc(clave).get();
    return d.exists ? d.data() : null;
  }
};

/* ═══════════════ ALMACÉN DEMO (este equipo) ═══════════════ */
const Demo = {
  nombre: 'demo',
  subeVideos: true,
  _k: 'coreo_demo_v1',
  _oy: { lista: new Set(), coreo: new Map(), solic: new Set(), aut: new Set() },
  _leer() {
    try { return Object.assign({ coreos: {}, solicitudes: {}, autorizados: {} }, JSON.parse(localStorage.getItem(this._k) || '{}')); }
    catch (_) { return { coreos: {}, solicitudes: {}, autorizados: {} }; }
  },
  _escribir(d) {
    try { localStorage.setItem(this._k, JSON.stringify(d)); }
    catch (e) { throw new Error('No hay espacio en este equipo para guardar.'); }
    const lista = Object.entries(d.coreos).map(([id, c]) => Object.assign({ id }, c));
    this._oy.lista.forEach(f => f(lista));
    this._oy.coreo.forEach((fs, id) => fs.forEach(f => f(d.coreos[id] ? Object.assign({ id }, d.coreos[id]) : null)));
    const sol = Object.entries(d.solicitudes).map(([id, s]) => Object.assign({ id }, s)).filter(s => s.estado === 'pendiente');
    this._oy.solic.forEach(f => f(sol));
    const aut = Object.entries(d.autorizados).map(([clave, a]) => Object.assign({ clave }, a));
    this._oy.aut.forEach(f => f(aut));
  },
  _sub(set, f, inicial) { set.add(f); setTimeout(() => f(inicial()), 0); return () => set.delete(f); },

  escucharLista(_s, cb) {
    return this._sub(this._oy.lista, cb, () => Object.entries(this._leer().coreos).map(([id, c]) => Object.assign({ id }, c)));
  },
  escucharCoreo(id, cb) {
    if (!this._oy.coreo.has(id)) this._oy.coreo.set(id, new Set());
    return this._sub(this._oy.coreo.get(id), cb, () => { const c = this._leer().coreos[id]; return c ? Object.assign({ id }, c) : null; });
  },
  async obtenerCoreo(id) { const c = this._leer().coreos[id]; return c ? Object.assign({ id }, JSON.parse(JSON.stringify(c))) : null; },
  async guardarCoreo(c) {
    const d = this._leer(); const datos = JSON.parse(JSON.stringify(c)); delete datos.id;
    d.coreos[c.id] = datos; this._escribir(d);
  },
  async borrarCoreo(id) { const d = this._leer(); delete d.coreos[id]; this._escribir(d); },

  // Archivos en IndexedDB → url "idb:ruta"
  _idb() {
    return new Promise((ok, mal) => {
      const r = indexedDB.open('coreo_archivos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('f');
      r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error);
    });
  },
  async subirArchivo(file, ruta, alProgreso) {
    const db = await this._idb();
    await new Promise((ok, mal) => { const tx = db.transaction('f', 'readwrite'); tx.objectStore('f').put(file, ruta); tx.oncomplete = ok; tx.onerror = () => mal(tx.error); });
    alProgreso && alProgreso(1);
    return { url: 'idb:' + ruta, path: ruta };
  },
  async borrarArchivo(path) {
    try { const db = await this._idb(); db.transaction('f', 'readwrite').objectStore('f').delete(path); } catch (_) {}
  },
  _urls: new Map(),
  async resolverUrl(url) {
    if (!url || !url.startsWith('idb:')) return url;
    if (this._urls.has(url)) return this._urls.get(url);
    const db = await this._idb();
    const blob = await new Promise(ok => { const r = db.transaction('f').objectStore('f').get(url.slice(4)); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); });
    if (!blob) return null;
    const u = URL.createObjectURL(blob); this._urls.set(url, u); return u;
  },

  async crearSolicitud(s) { const d = this._leer(); d.solicitudes[uid('s')] = s; this._escribir(d); },
  escucharSolicitudes(_s, cb) {
    return this._sub(this._oy.solic, cb, () => Object.entries(this._leer().solicitudes).map(([id, s]) => Object.assign({ id }, s)).filter(s => s.estado === 'pendiente'));
  },
  async resolverSolicitud(id, estado) { const d = this._leer(); if (d.solicitudes[id]) { d.solicitudes[id].estado = estado; this._escribir(d); } },
  escucharAutorizados(cb) { return this._sub(this._oy.aut, cb, () => Object.entries(this._leer().autorizados).map(([clave, a]) => Object.assign({ clave }, a))); },
  async guardarAutorizado(clave, datos) { const d = this._leer(); d.autorizados[clave] = datos; this._escribir(d); },
  async borrarAutorizado(clave) { const d = this._leer(); delete d.autorizados[clave]; this._escribir(d); },
  async leerAutorizado(clave) { return this._leer().autorizados[clave] || null; }
};

/* ═══════════════ SESIÓN ═══════════════ */
// Resuelve el rol de un usuario de Firebase: coreógrafo, alumna autorizada o sin acceso.
async function resolverSesion(u) {
  const correo = (u.email || '').toLowerCase();
  const base = { modo: 'nube', uid: u.uid, user: u, clave: claveDeUsuario(u), nombre: u.displayName || u.phoneNumber || correo, categorias: [] };
  if (correo && u.emailVerified && COREOGRAFOS.includes(correo)) {
    return Object.assign(base, { rol: 'coreografo', categorias: CATEGORIAS.slice() });
  }
  let aut = null;
  try { aut = await Nube.leerAutorizado(base.clave); } catch (_) { aut = null; }
  if (!aut) return Object.assign(base, { rol: 'sin-acceso' });
  return Object.assign(base, { rol: 'alumna', nombre: aut.nombre || base.nombre, categorias: (aut.categorias || []).filter(c => CATEGORIAS.includes(c)) });
}

function sesionDemo() {
  return { modo: 'demo', uid: 'demo', clave: 'demo', nombre: 'Modo práctica', rol: 'coreografo', categorias: CATEGORIAS.slice() };
}
