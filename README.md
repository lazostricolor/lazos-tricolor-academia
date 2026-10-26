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
  merge.js          ⚠️ NÚCLEO CRÍTICO — mergeDB y fusión por id (probado con npm test)
  firebase.js       ⚠️ NÚCLEO CRÍTICO — sync, guardado con control de versión, snapshots
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
`state` → `utils` → `merge` → `auth` → `firebase` → módulos → `app`. No lo cambies.

Para probar en local: `python3 -m http.server 8000` y abrir `http://localhost:8000`.

## Pruebas

- `npm test` — tests de `mergeDB` (Node 18+, sin instalar nada). Si uno falla,
  no cambies el test: revisa qué cambió en `js/merge.js`.
- `npm run revisar` — sintaxis de todo `js/` y funciones definidas dos veces.
- GitHub corre las dos cosas en cada PR y en cada cambio a `main` (pestaña
  **Actions**). Si sale en rojo, no fusiones.
- `TEST-E~1.HTM` — arnés de `estado-cuenta.js`; se abre en el navegador.

## Reglas de oro

1. **Nunca definas una función dos veces.** Antes de añadir una, búscala en todo `js/`.
   Duplicar funciones ya destruyó datos en producción.

2. **Al editar un registro, nunca reconstruyas el objeto entero.** Usa `Object.assign`
   solo con los campos del formulario. Si incluyes `nums:{}` o `aportes:{}` en el objeto
   de edición, borras todos los datos asociados. Pasó con las rifas.

3. **En `mergeDB` (merge.js), una sección sin `_ts_` propio nunca debe ganar.**
   No reintroduzcas el fallback a `_version` global: causó la pérdida de una rifa completa.

4. **Toda escritura sigue el mismo patrón:**
   ```js
   tsSeccion('rifas');
   DB._ts_rifas = Date.now();
   snapLocal();
   _fbSave(DB).then(ok => { /* toast solo si ok === true */ });
   ```
   No muestres "guardado" antes de que Firebase confirme.
   **Sin `tsSeccion()` el cambio se puede perder**: cada guardado lleva la versión
   (`updateTime`) que este equipo conoce; si otro equipo escribió entretanto,
   se fusiona con `mergeDB` antes de reintentar, y ahí gana el `_ts_` más nuevo.
   El autosave de 2 minutos solo sube si `hayCambiosSinSubir()`.
   Ojo: en esa fusión un borrado todavía puede revivir si el otro equipo aún
   tenía el registro (falta un sistema de "lápidas").

5. **Nada de `onclick` inline con IDs interpolados.** Usa `data-*` + delegación
   (`elemento.onclick = ...`, no `addEventListener`, que se acumula en cada render).

6. **Texto que escribió otra persona se pinta con `esc()`** (utils.js). Sobre todo
   lo que llega del formulario público de preinscripción. Las fechas de negocio se
   sacan con `dateStr()`, que ya es hora local de Colombia (nunca `toISOString()`).

7. **Exporta el JSON desde Configuración antes de cualquier cambio grande.**

## Seguridad

Solo entra la cuenta de Google `ADMIN_EMAIL`. Toda petición a Firestore lleva
`headers: await fbHeaders()` (o `fbHeadersSync()` en pagehide): **sin ese encabezado
la petición falla**, porque `firestore.rules` solo deja leer/escribir a esa cuenta.
Si cambias las reglas, pégalas en Firebase → Firestore Database → Reglas.

## Subir la mensualidad

En `js/state.js`, agrega una fila **nueva** al final de `TARIFAS` con el mes desde
el que aplica; no edites las filas existentes:

```js
const TARIFAS = [
  { desde:'2024-04', base:70000, familiar:50000, medio:35000, medioFamiliar:25000 },
  { desde:'2027-02', base:80000, familiar:60000, medio:40000, medioFamiliar:30000 },
];
```

Cada mes se cobra y se reporta con la tarifa vigente ese mes, así que los
reportes, recibos y deudas de meses anteriores no cambian. `npm test` lo verifica.

## Datos

Documento único en Firestore:
`academias/lazos-tricolor/datos/principal`, campo `data` (JSON en string).

Respaldos locales: `localStorage._db` + 3 snapshots rotativos.

Las fotos de las alumnas (activas **y retiradas**) **no se sincronizan**: viven solo
en el navegador que las subió (`localStorage._fotos`), reducidas a 480 px en JPEG.

El documento tiene un **límite de 1 MB** en Firestore. Configuración muestra el
peso actual; por encima de 800 KB el panel avisa al guardar.
