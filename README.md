# Academia de Danzas Lazos Tricolor — Panel Administrativo

Aplicación web modular. Firebase Firestore (REST) + Chart.js + GitHub Pages.

## Estructura

```
index.html          Estructura HTML: login, sidebar, secciones y modales
styles.css          Todos los estilos
js/
  state.js          Constantes (precios, categorías, URLs) y el objeto DB
  utils.js          Fechas, formato COP, toast, helpers de modales, reloj
  auth.js           Login con Google (Firebase Auth) y token para Firestore
  firebase.js       ⚠️ NÚCLEO CRÍTICO — sync, mergeDB, guardado, snapshots
  navegacion.js     Cambio de sección y navegación de meses
  dashboard.js      Dashboard
  alumnos.js        Alumnas
  pagos.js          Mensualidades
  asistencias.js    Asistencias y ranking
  profesores.js     Profesores y honorarios
  finanzas.js       Finanzas
  presentaciones.js Presentaciones
  gastos.js         Gastos varios
  ingresos.js       Otros ingresos
  recaudos.js       Recaudos para actividades
  rifas.js          Rifas
  planificador.js   Calendario
  preinscripciones.js
  archivo.js        Retirados
  config.js         Exportar / importar
  app.js            init(), polling y arranque — SIEMPRE el último
```

## Cómo cargar

Scripts clásicos (no módulos ES). Todas las funciones son globales, por eso los
`onclick="..."` del HTML funcionan. **El orden de los `<script>` en index.html importa**:
`state` → `utils` → módulos → `app`. No lo cambies.

Para probar en local: `python3 -m http.server 8000` y abrir `http://localhost:8000`.

## Reglas de oro

1. **Nunca definas una función dos veces.** Antes de añadir una, búscala en todo `js/`.
   Duplicar funciones ya destruyó datos en producción.

2. **Al editar un registro, nunca reconstruyas el objeto entero.** Usa `Object.assign`
   solo con los campos del formulario. Si incluyes `nums:{}` o `aportes:{}` en el objeto
   de edición, borras todos los datos asociados. Pasó con las rifas.

3. **En `mergeDB` (firebase.js), una sección sin `_ts_` propio nunca debe ganar.**
   No reintroduzcas el fallback a `_version` global: causó la pérdida de una rifa completa.

4. **Toda escritura sigue el mismo patrón:**
   ```js
   tsSeccion('rifas');
   DB._ts_rifas = Date.now();
   snapLocal();
   _fbSave(DB).then(ok => { /* toast solo si ok === true */ });
   ```
   No muestres "guardado" antes de que Firebase confirme.

5. **Nada de `onclick` inline con IDs interpolados.** Usa `data-*` + delegación
   (`elemento.onclick = ...`, no `addEventListener`, que se acumula en cada render).

7. **Texto que escribió otra persona se pinta con `esc()`** (utils.js). Sobre todo
   lo que llega del formulario público de preinscripción. Las fechas de negocio se
   sacan con `dateStr()`, que ya es hora local de Colombia (nunca `toISOString()`).

6. **Exporta el JSON desde Configuración antes de cualquier cambio grande.**

## Seguridad

Solo entra la cuenta de Google `ADMIN_EMAIL`. Toda petición a Firestore lleva
`headers: await fbHeaders()` (o `fbHeadersSync()` en pagehide): **sin ese encabezado
la petición falla**, porque `firestore.rules` solo deja leer/escribir a esa cuenta.
Si cambias las reglas, pégalas en Firebase → Firestore Database → Reglas.

## Datos

Documento único en Firestore:
`academias/lazos-tricolor/datos/principal`, campo `data` (JSON en string).

Respaldos locales: `localStorage._db` + 3 snapshots rotativos.

Las fotos de las alumnas **no se sincronizan**: viven solo en el navegador que
las subió (`localStorage._fotos`), reducidas a 480 px en JPEG.
