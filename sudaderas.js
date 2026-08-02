/* ============================================================
   SUDADERAS — Control de pago de uniformes (3 cuotas)
   Módulo autónomo. NO toca el documento principal.
   Los datos viven en una colección aparte: "sudaderas".

   Respeta las reglas de mantenimiento del proyecto:
   (1) nombres únicos, agrupados en el objeto Sudaderas (sin duplicar funciones)
   (2) al editar, se actualizan SOLO los campos que cambian
   (3) se marca sello de tiempo (actualizadoEn) en cada guardado
   (4) "guardado" solo se muestra cuando la nube confirma
   ============================================================ */

const Sudaderas = {

  // --- Configúralo UNA vez (solo si usas la Opción A, Cloudinary) ---
  CLOUDINARY_CLOUD:  'TU_CLOUD_NAME',        // <- tu "Cloud name" de Cloudinary
  CLOUDINARY_PRESET: 'sudaderas_unsigned',   // <- nombre del "upload preset" (Unsigned)

  // Tabla talla -> total y cuota (total ÷ 3). Puedes moverla a state.js.
  TALLAS: {
    '6':  { total: 118650, cuota: 39550 },
    '8':  { total: 122850, cuota: 40950 },
    '10': { total: 127050, cuota: 42350 },
    '12': { total: 131250, cuota: 43750 },
    '14': { total: 135450, cuota: 45150 },
    '16': { total: 139650, cuota: 46550 },
    'S':  { total: 143850, cuota: 47950 },
    'M':  { total: 148050, cuota: 49350 },
    'L':  { total: 152250, cuota: 50750 },
  },

  FECHAS_CUOTAS: ['2026-08-15', '2026-09-15', '2026-10-15'],

  // Documento donde vive la base principal de la academia (SOLO LECTURA para sudaderas).
  // La base entera está en el campo "data" como un JSON de texto.
  DOC_ACADEMIA: 'academias/lazos-tricolor/datos/principal',

  /* Comprime la foto EN EL NAVEGADOR antes de subirla.
     Hace tres cosas para bajar el peso de forma significativa:
       1) reduce las dimensiones (lado máximo),
       2) baja la calidad EN PASOS hasta llegar a un tamaño objetivo (maxKB),
       3) corrige la orientación (fotos de celular que suben giradas).
     Devuelve un objeto con el blob ya comprimido y un reporte de tamaños.

     Opciones (todas con valor por defecto):
       maxLado        lado máximo en píxeles          (def. 1280)
       maxKB          tamaño objetivo en KB            (def. 150)
       calidadInicial calidad de arranque 0–1          (def. 0.8)
       calidadMinima  piso para no dejarla ilegible    (def. 0.4)
       formato        'image/jpeg' o 'image/webp'      (def. jpeg)
  */
  async comprimirImagen(file, opciones = {}) {
    const {
      maxLado = 1280,
      maxKB = 150,
      calidadInicial = 0.8,
      calidadMinima = 0.4,
      formato = 'image/jpeg'
    } = opciones;

    if (!file || !file.type || !file.type.startsWith('image/')) {
      throw new Error('El archivo no es una imagen');
    }

    // 1) Cargar respetando la orientación EXIF del celular.
    const fuente = await this._cargarImagen(file);
    const anchoOrig  = fuente.width;
    const altoOrig   = fuente.height;

    // 2) Redimensionar manteniendo la proporción (nunca agranda).
    const escala = Math.min(1, maxLado / Math.max(anchoOrig, altoOrig));
    const ancho  = Math.max(1, Math.round(anchoOrig * escala));
    const alto   = Math.max(1, Math.round(altoOrig  * escala));

    const canvas = document.createElement('canvas');
    canvas.width = ancho;  canvas.height = alto;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';               // fondo blanco por si viene PNG transparente
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(fuente, 0, 0, ancho, alto);
    if (fuente.close) fuente.close();        // liberar el bitmap si aplica

    // 3) Bajar la calidad en pasos hasta cumplir el tamaño objetivo.
    const objetivoBytes = maxKB * 1024;
    let calidad = calidadInicial;
    let blob = await this._canvasABlob(canvas, formato, calidad);
    while (blob.size > objetivoBytes && calidad > calidadMinima) {
      calidad = Math.max(calidadMinima, Math.round((calidad - 0.1) * 100) / 100);
      blob = await this._canvasABlob(canvas, formato, calidad);
    }

    return {
      blob,
      tamanoOriginalKB: Math.round(file.size / 1024),
      tamanoFinalKB:    Math.round(blob.size / 1024),
      ancho, alto, calidad,
      // % que se logró reducir respecto al original (útil para mostrar al papá)
      reduccionPct: file.size ? Math.round((1 - blob.size / file.size) * 100) : 0
    };
  },

  /* Carga la imagen respetando su orientación EXIF.
     createImageBitmap con 'from-image' evita que las fotos de celular
     salgan giradas; si el navegador no lo soporta, cae al método clásico. */
  async _cargarImagen(file) {
    if ('createImageBitmap' in window) {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (_) { /* fallback abajo */ }
    }
    return await new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload  = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Imagen inválida')); };
      img.src = url;
    });
  },

  _canvasABlob(canvas, tipo, calidad) {
    return new Promise((res, rej) =>
      canvas.toBlob(b => b ? res(b) : rej(new Error('No se pudo comprimir')), tipo, calidad)
    );
  },

  /* OPCIÓN A (recomendada): sube la foto a Cloudinary (gratis, sin tarjeta)
     y devuelve una URL que guardas en Firestore. */
  async subirSoporteCloudinary(file) {
    const { blob } = await this.comprimirImagen(file);   // objetivo ~150 KB
    const fd = new FormData();
    fd.append('file', blob);
    fd.append('upload_preset', this.CLOUDINARY_PRESET);
    const url = `https://api.cloudinary.com/v1_1/${this.CLOUDINARY_CLOUD}/image/upload`;
    const resp = await fetch(url, { method: 'POST', body: fd });
    if (!resp.ok) throw new Error('Falló la subida del soporte');
    const data = await resp.json();
    return data.secure_url;   // <- esto es lo que se guarda en el registro
  },

  /* OPCIÓN B (sin ningún servicio nuevo): guarda la foto como texto
     dentro del propio registro de Firestore. Va MUY comprimida porque
     un documento no puede pasar de ~1 MB. */
  async soporteComoBase64(file) {
    // Más agresivo: debe caber holgado dentro del documento de Firestore (~1 MB).
    const { blob } = await this.comprimirImagen(file, { maxLado: 1000, maxKB: 120 });
    if (blob.size > 700 * 1024) {
      throw new Error('La foto es muy pesada. Pide una imagen más liviana.');
    }
    return await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result);   // "data:image/jpeg;base64,...."
      r.onerror = () => rej(new Error('No se pudo procesar la imagen'));
      r.readAsDataURL(blob);
    });
  },

  /* Crea el registro de una niña (esto lo haces TÚ desde el panel, con sesión).
     El ID es una clave aleatoria imposible de adivinar: es lo que va en el
     enlace personalizado que le mandas al representante por WhatsApp. */
  async crearRegistro(alumnaId, nombre, talla) {
    const precio = this.TALLAS[talla];
    if (!precio) throw new Error('Talla no válida');
    const db  = firebase.firestore();
    const ref = db.collection('sudaderas').doc();   // <- ID aleatorio automático
    const cuotas = {};
    ['1', '2', '3'].forEach((n, i) => {
      cuotas[n] = { valor: precio.cuota, fecha: this.FECHAS_CUOTAS[i], estado: 'pendiente' };
    });
    await ref.set({
      alumnaId: alumnaId || null, nombre, talla,
      total: precio.total,
      cuotas,
      entregada: false,
      creadoEn: Date.now(),
      actualizadoEn: Date.now()
    });
    return ref.id;   // guárdalo: es la clave del enlace ...?id=<ref.id>
  },

  /* --- LADO DEL PAPÁ (página del QR) --- */

  /* Trae UN registro por su clave. Lo usa la página del papá. */
  async obtenerRegistro(registroId) {
    const db  = firebase.firestore();
    const doc = await db.collection('sudaderas').doc(registroId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  /* El papá sube el soporte de una cuota. Queda en 'por_verificar':
     NO cuenta como pagada hasta que tú la apruebes (regla 4: la nube confirma).
     Actualiza solo esa cuota (regla 2) y marca sello de tiempo (regla 3). */
  async subirSoporteCuota(registroId, numeroCuota, soporte) {
    const db  = firebase.firestore();
    const ref = db.collection('sudaderas').doc(registroId);
    await ref.update({
      [`cuotas.${numeroCuota}.estado`]:   'por_verificar',
      [`cuotas.${numeroCuota}.soporte`]:  soporte,
      [`cuotas.${numeroCuota}.subidoEn`]: Date.now(),
      actualizadoEn: Date.now()
    });
  },

  /* --- LADO TUYO (panel, con sesión) --- */

  /* Trae TODOS los registros para el panel. */
  async listarRegistros() {
    const db   = firebase.firestore();
    const snap = await db.collection('sudaderas').orderBy('nombre').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /* Lee las alumnas ACTIVAS desde la base principal (solo lectura).
     No trae fotos ni datos pesados: solo id, nombre y categoría.
     Ignora a las retiradas (esas viven en alumnosRetirados). */
  async listarAlumnasActivas() {
    const db   = firebase.firestore();
    const snap = await db.doc(this.DOC_ACADEMIA).get();
    if (!snap.exists) return [];
    let base = {};
    try { base = JSON.parse(snap.data().data || '{}'); } catch (_) { return []; }
    return (base.alumnos || [])
      .filter(a => a && a.id != null && a.nombre)
      .map(a => ({ id: a.id, nombre: a.nombre, categoria: a.categoria || '' }))
      .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
  },

  /* Apruebas una cuota tras ver el soporte -> 'pagado'. */
  async aprobarCuota(registroId, numeroCuota) {
    const db = firebase.firestore();
    await db.collection('sudaderas').doc(registroId).update({
      [`cuotas.${numeroCuota}.estado`]:     'pagado',
      [`cuotas.${numeroCuota}.aprobadoEn`]: Date.now(),
      actualizadoEn: Date.now()
    });
  },

  /* Si el soporte no sirve, la devuelves a 'pendiente' para que vuelva a subir. */
  async rechazarCuota(registroId, numeroCuota) {
    const db = firebase.firestore();
    await db.collection('sudaderas').doc(registroId).update({
      [`cuotas.${numeroCuota}.estado`]:  'pendiente',
      [`cuotas.${numeroCuota}.soporte`]: firebase.firestore.FieldValue.delete(),
      actualizadoEn: Date.now()
    });
  },

  /* Marca la sudadera como entregada (primera quincena de noviembre). */
  async marcarEntregada(registroId, entregada = true) {
    const db = firebase.firestore();
    await db.collection('sudaderas').doc(registroId).update({
      entregada, actualizadoEn: Date.now()
    });
  },

  /* Elimina por completo un registro (útil para las alumnas de prueba). */
  async eliminarRegistro(registroId) {
    const db = firebase.firestore();
    await db.collection('sudaderas').doc(registroId).delete();
  },

  /* --- HELPERS --- */

  /* Enlace personalizado del papá, relativo a donde estén alojadas las páginas.
     No hay que escribir ningún dominio: se arma solo según dónde lo abras. */
  enlacePapa(registroId) {
    return new URL('sudaderas.html?id=' + encodeURIComponent(registroId), window.location.href).href;
  },

  /* Formato de dinero colombiano: 127050 -> "$127.050". */
  formatoDinero(n) {
    return '$' + Number(n || 0).toLocaleString('es-CO');
  },

  /* Estado "vivo" de una cuota: calcula 'vencida' según la fecha (no se guarda). */
  estadoCuota(cuota) {
    if (!cuota) return 'pendiente';
    if (cuota.estado === 'pagado' || cuota.estado === 'por_verificar') return cuota.estado;
    const hoy = new Date().toISOString().slice(0, 10);
    if (cuota.fecha && cuota.fecha < hoy) return 'vencida';
    return 'pendiente';
  },

  /* Primera cuota que el papá puede pagar ahora (pendiente o vencida). */
  siguienteAccionable(registro) {
    for (const n of ['1', '2', '3']) {
      const e = this.estadoCuota(registro.cuotas?.[n]);
      if (e === 'pendiente' || e === 'vencida') return Number(n);
    }
    return null; // nada por hacer (todo pagado o en verificación)
  }

};
