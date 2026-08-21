/* ═══════════════════════════════════════════════════════════
   sudaderas-admin.js
   Funciones que SOLO usa el panel de administración.
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca

   POR QUÉ ESTÁ APARTE
   sudaderas.js lo comparten el panel y la página de los papás
   (sudaderas.html). Este archivo se carga ÚNICAMENTE en el panel,
   así que sudaderas.js queda intacto y la página de los papás no
   corre ningún riesgo. Los QR ya repartidos siguen funcionando.

   NO DUPLICA NADA. En particular, no reimplementa abonoManual()
   ni asignarTalla(), que ya viven en sudaderas.js.

   COMPATIBILIDAD HACIA ATRÁS
   Los registros existentes no tienen el campo 'producto'. Todo
   lo de aquí los trata como 'sudadera'. No hay que migrar nada.
═══════════════════════════════════════════════════════════ */

if (typeof Sudaderas === 'undefined') {
  console.error('sudaderas-admin.js debe cargarse DESPUÉS de sudaderas.js');
}

Object.assign(Sudaderas, {

  /* ─────────────────────────────────────────────────────────
     CATÁLOGO DE PRODUCTOS

     La sudadera usa la tabla TALLAS que ya está en sudaderas.js.
     Para las demás piezas, mientras no tengas los precios
     oficiales, el panel te deja escribir el valor a mano.

     CUANDO TENGAS LOS PRECIOS, llénalos aquí y el formulario
     empezará a autocompletarlos solo. Dos formas:

       precioUnico: 45000            → mismo precio para toda talla
       precios: {'6':95000,'8':98000} → precio por talla

     Puedes usar cualquiera de las dos. Si dejas ambas vacías,
     simplemente escribes el valor cada vez.
     ───────────────────────────────────────────────────────── */
  PRODUCTOS: {
    sudadera: { nombre: 'Sudadera', icono: '👕', usaTablaTallas: true },
    chaqueta: { nombre: 'Chaqueta', icono: '🧥', precioUnico: null, precios: {} },
    camiseta: { nombre: 'Camiseta', icono: '👚', precioUnico: null, precios: {} },
    otra:     { nombre: 'Otra pieza', icono: '🎽', precioUnico: null, precios: {} }
  },

  /* Tallas que se ofrecen para las piezas que no son sudadera.
     Se usan solo como sugerencia en el desplegable; el valor del
     precio siempre se puede escribir a mano. */
  TALLAS_EXTRA: ['4','6','8','10','12','14','16','XS','S','M','L','XL'],

  /* Clave del producto de un registro. Los registros viejos no
     tienen el campo, así que se asumen sudadera. */
  productoDe(registro) {
    const p = registro && registro.producto;
    return (p && this.PRODUCTOS[p]) ? p : 'sudadera';
  },

  nombreProducto(registro) {
    return this.PRODUCTOS[this.productoDe(registro)].nombre;
  },

  iconoProducto(registro) {
    return this.PRODUCTOS[this.productoDe(registro)].icono || '👕';
  },

  esSudadera(registro) {
    return this.productoDe(registro) === 'sudadera';
  },

  /* Precio que el panel sugiere para un producto y talla.
     Devuelve 0 cuando todavía no hay precios configurados,
     y en ese caso el formulario deja el campo libre. */
  precioSugerido(producto, talla) {
    if (producto === 'sudadera') {
      const t = this.TALLAS[talla];
      return t ? t.total : 0;
    }
    const cfg = this.PRODUCTOS[producto];
    if (!cfg) return 0;
    if (cfg.precios && typeof cfg.precios[talla] === 'number') return cfg.precios[talla];
    if (typeof cfg.precioUnico === 'number' && cfg.precioUnico > 0) return cfg.precioUnico;
    return 0;
  },

  /* ¿El producto ya tiene precios cargados? Sirve para avisar
     en pantalla que hay que escribir el valor a mano. */
  tienePrecios(producto) {
    if (producto === 'sudadera') return true;
    const cfg = this.PRODUCTOS[producto];
    if (!cfg) return false;
    if (typeof cfg.precioUnico === 'number' && cfg.precioUnico > 0) return true;
    return !!(cfg.precios && Object.keys(cfg.precios).length);
  },

  /* Cuánto pagó DE MÁS. Aparece cuando se baja la talla a una
     más barata después de que ya había abonado.
     saldo() en sudaderas.js nunca baja de cero, así que sin esto
     el excedente quedaría invisible. */
  saldoAFavor(registro) {
    return Math.max(0, this.pagado(registro) - (Number(registro.total) || 0));
  },

  /* ─────────────────────────────────────────────────────────
     CAMBIAR TALLA Y/O PRECIO — solo desde el panel

     Distinto de asignarTalla() de sudaderas.js, que es el flujo
     del papá y siempre toma el precio de la tabla TALLAS.
     Aquí el precio se pasa explícito, porque:
       · las piezas extra todavía no tienen tabla de precios
       · a veces hay que corregir un valor puntual

     LOS ABONOS NO SE TOCAN. Solo se reescriben talla y total, y
     el saldo se recalcula solo a partir de los abonos que ya
     estaban. Si quedó pagando de más, saldoAFavor() lo muestra.
     ───────────────────────────────────────────────────────── */
  async fijarTallaYPrecio(registroId, talla, total) {
    const t = Math.round(Number(total) || 0);
    if (!talla) throw new Error('Debes indicar una talla');
    if (t <= 0) throw new Error('El valor debe ser mayor a cero');
    const db = firebase.firestore();
    await db.collection('sudaderas').doc(registroId).update({
      talla: String(talla),
      total: t,
      actualizadoEn: Date.now()
    });
  },

  /* ─────────────────────────────────────────────────────────
     PIEZA EXTRA — chaqueta, camiseta o una segunda sudadera

     Cada pieza es su PROPIO registro, con su propio QR y su
     propio saldo, tal como se definió. Puede ir enlazada a una
     alumna (alumnaId) o ser de un particular.
     ───────────────────────────────────────────────────────── */
  async crearRegistroExtra(alumnaId, nombre, producto, talla, total, particular = false) {
    if (!this.PRODUCTOS[producto]) throw new Error('Producto no válido');
    if (!nombre || !String(nombre).trim()) throw new Error('Falta el nombre');
    const t = Math.round(Number(total) || 0);
    if (t <= 0) throw new Error('Escribe el valor de la pieza');

    const db  = firebase.firestore();
    const ref = db.collection('sudaderas').doc();
    await ref.set({
      alumnaId: alumnaId ?? null,
      nombre: String(nombre).trim(),
      particular: !!particular,
      producto,                       // ← campo nuevo; los viejos no lo tienen
      talla: talla ? String(talla) : null,
      total: t,
      abonos: {},
      entregada: false,
      creadoEn: Date.now(),
      actualizadoEn: Date.now()
    });
    return ref.id;
  }

});
