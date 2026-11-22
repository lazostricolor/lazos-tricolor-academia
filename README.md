# Academia de Danzas Lazos Tricolor — Panel Administrativo

Aplicación web modular. Firebase Firestore (REST) + Chart.js + GitHub Pages.

## Dirección

Publicado con GitHub Pages en **https://app.academialazostricolor.com** (archivo `CNAME`).

- `/` (`index.html`) solo redirige: a **Coreografías**, o al panel si el enlace trae
  una sección (`#pagos`, `#alumnos`…), para que los enlaces viejos sigan sirviendo.
- `/admin.html` → panel administrativo · `/coreografias.html` · `/ensayo.html` · `/metronomo.html`

Configuración (una sola vez):
1. DNS del dominio: registro **CNAME** `app` → `lazostricolor.github.io`.
2. GitHub → Settings → Pages → Custom domain `app.academialazostricolor.com` + **Enforce HTTPS**.
3. Firebase → Authentication → Configuración → Dominios autorizados: agregar
   `app.academialazostricolor.com` (si no, falla el login con Google y con celular).

## Estructura

```
index.html          Entrada del sitio: redirige a Coreografías o al panel
admin.html          Panel: login, sidebar, secciones y modales
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
`onclick="..."` del HTML funcionan. **El orden de los `<script>` en admin.html importa**:
`state` → `utils` → módulos → `app`. No lo cambies.

Para probar en local: `python3 -m http.server 8000` y abrir `http://localhost:8000/admin.html`.

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

6. **Exporta el JSON desde Configuración antes de cualquier cambio grande.**

## Seguridad

Solo entra la cuenta de Google `ADMIN_EMAIL`. Toda petición a Firestore lleva
`headers: await fbHeaders()` (o `fbHeadersSync()` en pagehide): **sin ese encabezado
la petición falla**, porque `firestore.rules` solo deja leer/escribir a esa cuenta.
Si cambias las reglas, pégalas en Firebase → Firestore Database → Reglas.

## Coreografías (`coreografias.html`)

App aparte (PC y celular, tono oscuro) para guardar y estudiar coreografías.
Código en `coreo/`: `datos.js` (sesión y Firebase), `audio.js` (reloj, metrónomo,
detección de tempo), `app.js` (escenario, línea de tiempo, paneles), `coreo.css`.

- **Coreógrafos** (`COREOGRAFOS` en `coreo/datos.js`): crean y editan todo.
- **Alumnas**: entran con Google o celular si están en *Alumnas autorizadas*
  (panel de la lista) y solo ven sus categorías. Pueden pedir que un circulito
  lleve su nombre; el coreógrafo aprueba. Una coreografía **sellada** ya no acepta cambios.
- **Modo práctica**: “Probar en este equipo sin cuenta” guarda solo en ese navegador.
- **Metrónomo libre** (`metronomo.html`, un solo archivo, sin cuenta): BPM 30–260, compás
  2/4 · 3/4 · 4/4 · 6/8, acento de 1000 Hz en el 1 y 600 Hz en el resto, luces, tap tempo y
  barra espaciadora. El metrónomo del editor sigue a la canción (suena con ▶).
- **Ensayo / clase** (`ensayo.html` + `coreo/ensayo.js`, sin cuenta): solo la canción. Detecta
  tempo, compás (3 o 4, con aviso si es dudoso) y dónde cae el 1; conteo de ochos grande,
  velocidad 40–150 % sin cambiar el tono (`preservesPitch`), repetir ocho o tramo, metrónomo
  y subida gradual. Las canciones quedan en IndexedDB del equipo (base `ensayo`).

Firestore: `coreografias/{id}`, `autorizados/{mail:correo | tel:+57…}`, `solicitudes/{id}`.
La forma de onda y el tempo se calculan al subir la pista y se guardan en el documento.

Para activarla en Firebase (una sola vez):
1. Pegar `firestore.rules` (Firestore → Reglas) y `storage.rules` (Storage → Reglas).
2. Activar **Storage** (guarda MP3 y videos). Si el bucket termina en
   `.firebasestorage.app`, cambiar `storageBucket` en `coreo/datos.js`.
3. Authentication → Método de acceso → activar **Teléfono** (Google ya está).

## Datos

Documento único en Firestore:
`academias/lazos-tricolor/datos/principal`, campo `data` (JSON en string).

Respaldos locales: `localStorage._db` + 3 snapshots rotativos.
