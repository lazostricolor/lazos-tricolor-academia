/* ═══════════════════════════════════════════════════════════
   encuestas.js
   Resultados de la Medición Interna 2026 (alumnas y acudientes)
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca

   ⚠️ IMPORTANTE — ESTE MÓDULO ES DE SOLO LECTURA
   • NO escribe en DB, no llama saveAll(), saveBackground() ni tsSeccion().
   • NO toca el documento único de Firebase donde vive la academia.
   • Lee una colección aparte de Firestore ('respuestas') por REST,
     usando el mismo FB_URL / FB_KEY que ya usa firebase.js.
   • NUNCA lee la colección 'participantes' (correos). El panel solo
     muestra resultados agregados y comentarios anónimos.

   Todas las funciones y variables empiezan por enc / ENC_ para no
   chocar con nada existente (regla 1 de mantenimiento).
═══════════════════════════════════════════════════════════ */

// ===================== CONFIGURACIÓN =====================
var ENC_COLECCION = 'respuestas';   // colección de Firestore con las respuestas
var ENC_PAGINA    = 300;            // documentos por página al leer

// Colores de datos (tomados de la paleta del panel)
var ENC_C = {
  primary:'#3a57e8', primaryLt:'#eef0fd',
  ok:'#1aa053', warn:'#f4a916', bad:'#c03221',
  // Escala 1–5: divergente rojo → gris → índigo (validada para daltonismo)
  d1:'#c03221', d2:'#e08a80', d3:'#c9ced8', d4:'#8098f0', d5:'#3a57e8'
};

// Nombres visibles de cada área
var ENC_CATEGORIAS = {
  // Módulo de bienestar comunitario (lo responde el ALUMNO)
  bienestar:'Bienestar percibido',
  pertenencia:'Sentido de pertenencia',
  seguridad:'Seguridad y confianza',
  relaciones:'Relaciones y compañerismo',
  equilibrio:'Equilibrio y exigencia',
  motivacion:'Motivación',
  apoyo:'Comunicación y apoyo',
  // Percepción de las familias
  bienestar_familia:'Bienestar visto por las familias',
  // Encuesta general
  profesores:'Profesores',
  contenidos:'Contenidos y metodología',
  horarios:'Horarios',
  instalaciones:'Instalaciones',
  comunicacion:'Comunicación de la academia',
  presentaciones:'Presentaciones y eventos',
  administrativo:'Administración (acudientes)',
  continuidad:'Intención de continuidad'
};

// Índices que componen el Índice de Bienestar Comunitario
var ENC_INDICES_BC = ['bienestar','pertenencia','seguridad','relaciones','equilibrio','motivacion','apoyo'];

// Mínimo de respuestas para mostrar resultados.
// Protege la reserva: con muy pocas respuestas se podría deducir quién contestó.
var ENC_MINIMO = 5;

/* Catálogo de preguntas.
   Si agregas o cambias una pregunta en encuesta.html, agrega o cambia
   aquí la línea correspondiente (mismo id).
     id = identificador · t = texto · c = área · k = tipo · b = bloque   */
var ENC_PREGUNTAS = [
  // Bloque C · Profesores
  {id:'c_general', t:'¿Cómo calificas en general a los profesores de Lazos Tricolor?', c:'profesores', k:'escala5', b:'C'},
  {id:'c_respeto', t:'¿Consideras que los profesores tienen un trato respetuoso con los alumnos?', c:'profesores', k:'escala5', b:'C'},
  {id:'c_explican', t:'¿Consideras que explican adecuadamente los ejercicios y contenidos?', c:'profesores', k:'escala5', b:'C'},
  {id:'c_progreso', t:'¿Sientes que se preocupan por el progreso de los alumnos?', c:'profesores', k:'escala5', b:'C'},
  {id:'c_disciplina', t:'¿Consideras adecuada la disciplina durante las clases?', c:'profesores', k:'escala5', b:'C'},
  {id:'c_nivel', t:'¿Cómo calificas el nivel técnico y artístico de las clases?', c:'profesores', k:'escala5', b:'C'},
  {id:'c_aprendizaje', t:'¿Sientes que estás aprendiendo y mejorando?', c:'profesores', k:'escala5', b:'C'},
  {id:'c_destacar', t:'¿Hay algún aspecto de nuestros profesores que quieras destacar?', c:'abierta', k:'texto', b:'C'},
  {id:'c_mejorar_ensenanza', t:'¿Hay algún aspecto de la enseñanza que consideres que podemos mejorar?', c:'abierta', k:'texto', b:'C'},
  // Bloque D · Contenidos y metodología
  {id:'d_contenidos', t:'¿Qué tan satisfecho(a) estás con los contenidos trabajados?', c:'contenidos', k:'escala5', b:'D'},
  {id:'d_variedad', t:'¿Consideras que existe suficiente variedad de danzas y estilos?', c:'contenidos', k:'escala5', b:'D'},
  {id:'d_dinamicas', t:'¿Las clases son dinámicas y entretenidas?', c:'contenidos', k:'escala5', b:'D'},
  {id:'d_equilibrio', t:'¿Existe un buen equilibrio entre técnica, expresión artística y diversión?', c:'contenidos', k:'escala5', b:'D'},
  {id:'d_favorito', t:'¿Cuál de estos contenidos disfrutas más?', c:'contenidos', k:'unica', b:'D'},
  {id:'d_incorporar', t:'¿Qué contenido, actividad o estilo te gustaría que incorporáramos?', c:'abierta', k:'texto', b:'D'},
  // Bloque E · Horarios e instalaciones
  {id:'e_horarios', t:'¿Cómo calificas los horarios?', c:'horarios', k:'escala5', b:'E'},
  {id:'e_duracion', t:'¿Cómo calificas la duración de las clases?', c:'horarios', k:'escala5', b:'E'},
  {id:'e_frecuencia', t:'¿Cómo calificas la frecuencia semanal?', c:'horarios', k:'escala5', b:'E'},
  {id:'e_espacio', t:'¿Cómo calificas el espacio donde se realizan las clases?', c:'instalaciones', k:'escala5', b:'E'},
  {id:'e_comodidad', t:'¿Cómo calificas la comodidad de las instalaciones?', c:'instalaciones', k:'escala5', b:'E'},
  {id:'e_limpieza', t:'¿Cómo calificas la limpieza?', c:'instalaciones', k:'escala5', b:'E'},
  {id:'e_seguridad', t:'¿Cómo calificas la seguridad del lugar?', c:'instalaciones', k:'escala5', b:'E'},
  // Bloque F · Comunicación y organización
  {id:'f_comunicacion', t:'¿Cómo calificas la comunicación de la academia?', c:'comunicacion', k:'escala5', b:'F'},
  {id:'f_oportuna', t:'¿La información sobre actividades llega oportunamente?', c:'comunicacion', k:'escala5', b:'F'},
  {id:'f_org_presentaciones', t:'¿Cómo calificas la organización de las presentaciones?', c:'presentaciones', k:'escala5', b:'F'},
  {id:'f_org_actividades', t:'¿Cómo calificas la organización de actividades especiales?', c:'presentaciones', k:'escala5', b:'F'},
  {id:'f_uniformes', t:'¿Cómo calificas la información relacionada con uniformes, vestuario y elementos necesarios?', c:'comunicacion', k:'escala5', b:'F'},
  {id:'f_escucha', t:'¿Consideras que la academia escucha las inquietudes de alumnos y familias?', c:'comunicacion', k:'escala5', b:'F'},
  // Bloque G · Presentaciones y pertenencia
  {id:'g_satisfaccion', t:'¿Qué tan satisfecho(a) estás con las presentaciones y eventos?', c:'presentaciones', k:'escala5', b:'G'},
  {id:'g_muestran', t:'¿Consideras que las presentaciones permiten mostrar lo aprendido?', c:'presentaciones', k:'escala5', b:'G'},
  {id:'g_mas_eventos', t:'¿Te gustaría que Lazos Tricolor participara en más eventos?', c:'presentaciones', k:'unica', b:'G'},
  // ¿Cómo estamos como comunidad?
  {id:'bc_bien', t:'Cuando estoy en Lazos Tricolor, generalmente me siento bien.', c:'bienestar', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_positivo', t:'Salgo de las clases con una sensación positiva.', c:'bienestar', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_aporta', t:'Siento que pertenecer a la academia aporta cosas buenas a mi vida.', c:'bienestar', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_dia_dificil', t:'Cuando tengo un día difícil, venir a la academia puede ayudarme a sentirme mejor.', c:'bienestar', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_disfrutar', t:'Siento que puedo disfrutar de la danza sin importar si mi desempeño es perfecto.', c:'bienestar', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_parte', t:'Siento que soy parte importante de Lazos Tricolor.', c:'pertenencia', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_ser_yo', t:'Siento que puedo ser yo mismo(a) dentro de la academia.', c:'pertenencia', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_valoran', t:'Siento que hay personas dentro de la academia que valoran mi presencia.', c:'pertenencia', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_apoyo_mutuo', t:'Siento que los integrantes de Lazos Tricolor se apoyan entre sí.', c:'pertenencia', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_orgullo', t:'Siento orgullo de pertenecer a Lazos Tricolor.', c:'pertenencia', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_opinar', t:'Me siento tranquilo(a) expresando mi opinión dentro de la academia.', c:'seguridad', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_equivocarme', t:'Siento que puedo equivocarme durante una clase sin sentirme mal por ello.', c:'seguridad', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_incomoda', t:'Siento que puedo expresar algo que me incomoda sin temor a ser juzgado(a).', c:'seguridad', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_respeto', t:'Considero que existe respeto entre las personas que hacen parte de la academia.', c:'seguridad', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_diferencias', t:'Siento que las diferencias entre las personas son respetadas.', c:'seguridad', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_companerismo', t:'Siento que existe compañerismo entre los integrantes de la academia.', c:'relaciones', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_nuevos', t:'Considero que los nuevos integrantes son recibidos adecuadamente.', c:'relaciones', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_relacion', t:'Siento que puedo relacionarme con mis compañeros de manera positiva.', c:'relaciones', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_dialogo', t:'Cuando existe un conflicto, considero que puede solucionarse mediante el diálogo.', c:'relaciones', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_pensar_distinto', t:'Considero que en Lazos Tricolor nos tratamos con respeto incluso cuando pensamos diferente.', c:'relaciones', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_exigencia', t:'Siento que las exigencias de la academia me ayudan a crecer.', c:'equilibrio', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_presion', t:'A veces siento demasiada presión por mi desempeño dentro de la academia.', c:'equilibrio', k:'escala5', b:'BC', inv:true, solo:'alumno'},
  {id:'bc_ritmo', t:'Siento que puedo aprender a mi propio ritmo.', c:'equilibrio', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_errores', t:'Siento que cometer errores es una parte normal del aprendizaje.', c:'equilibrio', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_present_motivan', t:'Las presentaciones y actividades especiales me generan principalmente motivación.', c:'equilibrio', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_equilibrio', t:'Siento que existe un equilibrio adecuado entre disciplina, exigencia y bienestar.', c:'equilibrio', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_entusiasmo', t:'Espero con entusiasmo las clases.', c:'motivacion', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_progreso', t:'Siento que estoy progresando.', c:'motivacion', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_seguir', t:'Tengo ganas de seguir aprendiendo.', c:'motivacion', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_actividades', t:'Las actividades de la academia me motivan.', c:'motivacion', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_esfuerzo', t:'Siento que mi esfuerzo es valorado.', c:'motivacion', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_decirlo', t:'Cuando algo no me gusta o me preocupa dentro de la academia, siento que puedo decirlo.', c:'apoyo', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_escuchado', t:'Siento que mis opiniones son escuchadas.', c:'apoyo', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_acudir', t:'Si estuviera pasando por un momento difícil relacionado con mi experiencia en la academia, sabría a quién acudir.', c:'apoyo', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_hablar_antes', t:'Siento que en Lazos Tricolor podemos hablar de los problemas antes de que se conviertan en conflictos mayores.', c:'apoyo', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bc_estar_bien', t:'Siento que en la academia nos preocupamos no solamente por bailar bien, sino también por estar bien.', c:'apoyo', k:'escala5', b:'BC', solo:'alumno'},
  {id:'bca_disfruta', t:'¿Percibe que el alumno disfruta asistir a Lazos Tricolor?', c:'bienestar_familia', k:'escala5', b:'BC', solo:'acudiente'},
  {id:'bca_confianza', t:'¿Ha observado cambios positivos en la confianza o seguridad personal del alumno?', c:'bienestar_familia', k:'escala5', b:'BC', solo:'acudiente'},
  {id:'bca_ambiente', t:'¿Considera que el ambiente de la academia favorece relaciones saludables entre los alumnos?', c:'bienestar_familia', k:'escala5', b:'BC', solo:'acudiente'},
  {id:'bca_equilibrio', t:'¿Considera que existe un equilibrio adecuado entre disciplina, exigencia y bienestar?', c:'bienestar_familia', k:'escala5', b:'BC', solo:'acudiente'},
  {id:'bca_comunicar', t:'¿Siente que podría comunicar una preocupación relacionada con el bienestar del alumno?', c:'bienestar_familia', k:'escala5', b:'BC', solo:'acudiente'},
  {id:'bca_escucha', t:'¿Considera que la academia escucha adecuadamente las preocupaciones de las familias?', c:'bienestar_familia', k:'escala5', b:'BC', solo:'acudiente'},
  // Cuidarnos como comunidad
  {id:'bc_ab_contribuye', t:'¿Qué es lo que más contribuye a que te sientas bien dentro de Lazos Tricolor?', c:'abierta', k:'texto', b:'BCJ'},
  {id:'bc_ab_cuidar', t:'¿Qué consideras que deberíamos cuidar mejor como comunidad?', c:'abierta', k:'texto', b:'BCJ'},
  {id:'bc_ab_propuesta', t:'Si pudieras hacer algo para que Lazos Tricolor fuera un espacio emocionalmente mejor para todos, ¿qué propondrías?', c:'abierta', k:'texto', b:'BCJ'},
  {id:'bc_ab_revisar', t:'¿Hay alguna situación dentro de la academia que consideres importante que revisemos o mejoremos?', c:'abierta', k:'texto', b:'BCJ'},
  {id:'bc_ab_comunidad', t:'¿Hay algo que quieras decirnos sobre cómo estamos viviendo como comunidad?', c:'abierta', k:'texto', b:'BCJ'},
  {id:'bca_ab_cuidar', t:'Desde su perspectiva como acudiente, ¿qué deberíamos cuidar para que Lazos Tricolor siga siendo un espacio positivo para nuestros alumnos?', c:'abierta', k:'texto', b:'BCJ', solo:'acudiente'},
  // Bloque H · Evaluación general
  {id:'h_experiencia', t:'Pensando en tu experiencia durante estos primeros meses de 2026, ¿cómo calificas a Lazos Tricolor?', c:'experiencia', k:'escala10', b:'H'},
  {id:'h_expectativas', t:'¿La academia ha cumplido tus expectativas?', c:'experiencia', k:'unica', b:'H'},
  {id:'h_mejora2026', t:'¿Consideras que Lazos Tricolor ha mejorado durante 2026?', c:'experiencia', k:'unica', b:'H'},
  // Bloque I · Familias y acudientes
  {id:'i_inversion', t:'¿Considera que la inversión económica corresponde al valor recibido?', c:'administrativo', k:'escala5', b:'I', solo:'acudiente'},
  {id:'i_comunicacion_familias', t:'¿Cómo califica la comunicación de la academia con las familias?', c:'administrativo', k:'escala5', b:'I', solo:'acudiente'},
  {id:'i_cambios', t:'¿Ha observado cambios positivos en el alumno desde que ingresó a Lazos Tricolor?', c:'impacto', k:'multiple', b:'I', solo:'acudiente'},
  {id:'i_escuchado', t:'¿Se siente escuchado(a) cuando presenta una inquietud?', c:'administrativo', k:'escala5', b:'I', solo:'acudiente'},
  {id:'i_administrativa', t:'¿Cómo califica la organización administrativa de la academia?', c:'administrativo', k:'escala5', b:'I', solo:'acudiente'},
  // Continuidad y recomendación
  {id:'k_continuidad', t:'Pensando en los próximos meses, ¿qué tan interesado(a) estás en continuar haciendo parte de Lazos Tricolor?', c:'continuidad', k:'escala5', b:'K'},
  {id:'k_nps', t:'¿Qué tan probable es que recomiendes Lazos Tricolor a otra persona?', c:'nps', k:'nps', b:'K'},
  // Bloque J · Tu voz
  {id:'j_gusta', t:'¿Qué es lo que más te gusta de Lazos Tricolor?', c:'abierta', k:'texto', b:'J'},
  {id:'j_mejor2026', t:'¿Qué consideras que hemos hecho mejor durante este 2026?', c:'abierta', k:'texto', b:'J'},
  {id:'j_mejorar', t:'¿Qué consideras que podemos mejorar durante los próximos meses?', c:'abierta', k:'texto', b:'J'},
  {id:'j_cambiaria', t:'Si pudieras cambiar una sola cosa de Lazos Tricolor, ¿qué cambiarías?', c:'abierta', k:'texto', b:'J'},
  {id:'j_logro', t:'¿Qué te gustaría que Lazos Tricolor lograra antes de terminar 2026?', c:'abierta', k:'texto', b:'J'},
  {id:'j_libre', t:'¿Hay algo que quieras decirnos y que no hayas podido expresar en las preguntas anteriores?', c:'abierta', k:'texto', b:'J'},];

// ===================== ESTADO DEL MÓDULO =====================
var ENC_DATOS   = [];                                   // respuestas leídas (sin correos)
var ENC_FILTRO  = { perfil:'', grupo:'' };
var ENC_CARGADO = false;
var ENC_CARGANDO= false;

// ===================== UTILIDADES =====================
function encEsc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(m){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
}
function enc1(x){ return (Math.round(x*10)/10).toFixed(1); }
function encPregunta(id){
  for(var i=0;i<ENC_PREGUNTAS.length;i++) if(ENC_PREGUNTAS[i].id===id) return ENC_PREGUNTAS[i];
  return null;
}
function encIdsArea(cat){
  return ENC_PREGUNTAS.filter(function(p){ return p.c===cat && p.k==='escala5'; })
                      .map(function(p){ return p.id; });
}

// ── Base REST de Firestore, derivada del FB_URL que ya usa firebase.js ──
function encBaseURL(){
  var m = String(typeof FB_URL !== 'undefined' ? FB_URL : '').match(/^(.*\/documents)(\/|$)/);
  return m ? m[1] : '';
}

// ── Convertir el formato de valores de la API REST de Firestore ──
function encValor(v){
  if(!v) return null;
  if('integerValue'  in v) return Number(v.integerValue);
  if('doubleValue'   in v) return Number(v.doubleValue);
  if('stringValue'   in v) return v.stringValue;
  if('booleanValue'  in v) return v.booleanValue;
  if('timestampValue'in v) return v.timestampValue;
  if('nullValue'     in v) return null;
  if('arrayValue'    in v) return (v.arrayValue.values||[]).map(encValor);
  if('mapValue'      in v) return encCampos(v.mapValue.fields||{});
  return null;
}
function encCampos(f){
  var o = {};
  Object.keys(f).forEach(function(k){ o[k] = encValor(f[k]); });
  return o;
}

// ===================== CARGA DESDE FIRESTORE =====================
async function cargarEncuestas(){
  if(ENC_CARGANDO) return;
  ENC_CARGANDO = true;

  var cont = document.getElementById('encuestas-content');
  if(cont) cont.innerHTML = '<div class="table-card"><div style="padding:40px;text-align:center;color:var(--text2)">⏳ Cargando respuestas…</div></div>';

  var base = encBaseURL();
  if(!base || typeof FB_KEY === 'undefined'){
    ENC_CARGANDO = false;
    if(cont) cont.innerHTML = encAvisoError('No se encontró la configuración de Firebase (FB_URL / FB_KEY).');
    return;
  }

  try{
    var todas = [], token = '', vueltas = 0;
    do{
      var url = base + '/' + ENC_COLECCION + '?key=' + FB_KEY + '&pageSize=' + ENC_PAGINA +
                (token ? '&pageToken=' + encodeURIComponent(token) : '');
      var r = await fetch(url);
      if(!r.ok) throw new Error('HTTP ' + r.status);
      var j = await r.json();
      (j.documents || []).forEach(function(d){
        var x = encCampos(d.fields || {});
        delete x.email; delete x.correo;      // blindaje: jamás mostrar correos
        todas.push(x);
      });
      token = j.nextPageToken || '';
      vueltas++;
    } while(token && vueltas < 20);

    ENC_DATOS = todas;
    ENC_CARGADO = true;
    ENC_CARGANDO = false;
    renderEncuestas();
    if(typeof toast === 'function') toast('✅ ' + todas.length + ' respuestas cargadas','ok');

  }catch(e){
    ENC_CARGANDO = false;
    console.warn('Encuestas — error al leer:', e.message);
    if(cont) cont.innerHTML = encAvisoError('No se pudieron leer las respuestas: ' + encEsc(e.message) +
      '<br><br>Revisa que exista la colección <b>' + ENC_COLECCION + '</b> y que las reglas de Firestore permitan leerla.');
    if(typeof toast === 'function') toast('⚠️ No se pudieron cargar las encuestas','err');
  }
}
function encAvisoError(msg){
  return '<div class="table-card"><div style="padding:28px;text-align:center;color:var(--text2);font-size:13px">⚠️ ' + msg + '</div></div>';
}

// ===================== CÁLCULOS =====================
function encFiltradas(){
  return ENC_DATOS.filter(function(r){
    return (!ENC_FILTRO.perfil || r.respondentType === ENC_FILTRO.perfil) &&
           (!ENC_FILTRO.grupo  || r.group === ENC_FILTRO.grupo);
  });
}
/* Promedio de un conjunto de preguntas.
   Las marcadas con inv:true se invierten (6 - valor) antes de promediar,
   para que "más presión" no suba artificialmente el índice de equilibrio. */
function encPromedio(datos, ids){
  var s=0, n=0;
  ids.forEach(function(id){
    var def = encPregunta(id);
    var invertir = !!(def && def.inv);
    datos.forEach(function(r){
      var v = r.answers && r.answers[id];
      if(typeof v === 'number'){ s += invertir ? (6 - v) : v; n++; }
    });
  });
  return { prom: n ? s/n : null, n: n };
}

/* Promedio SIN invertir — para mostrar la presión percibida tal cual */
function encPromedioCrudo(datos, id){
  var s=0, n=0;
  datos.forEach(function(r){
    var v = r.answers && r.answers[id];
    if(typeof v === 'number'){ s+=v; n++; }
  });
  return { prom: n ? s/n : null, n: n };
}
function encDistribucion(datos, id){
  var c={1:0,2:0,3:0,4:0,5:0}, s=0, n=0;
  datos.forEach(function(r){
    var v = r.answers && r.answers[id];
    if(typeof v === 'number' && c[v] !== undefined){ c[v]++; s+=v; n++; }
  });
  return { c:c, n:n, prom: n ? s/n : null };
}
function encConteo(datos, campo){
  var m = {};
  datos.forEach(function(r){
    var v = r.answers ? r.answers[campo] : null;
    if(v === undefined || v === null || v === '') return;
    (Array.isArray(v) ? v : [v]).forEach(function(x){ m[x] = (m[x]||0)+1; });
  });
  return m;
}
function encNPS(datos){
  var det=0, pas=0, pro=0;
  datos.forEach(function(r){
    var v = r.answers && r.answers.k_nps;
    if(typeof v !== 'number') return;
    if(v>=9) pro++; else if(v>=7) pas++; else det++;
  });
  var t = det+pas+pro;
  return { det:det, pas:pas, pro:pro, t:t, nps: t ? Math.round(pro/t*100 - det/t*100) : null };
}

// ===================== RENDER =====================
function renderEncuestas(){
  var cont = document.getElementById('encuestas-content');
  if(!cont) return;
  encInyectarEstilos();

  if(!ENC_CARGADO){ cargarEncuestas(); return; }

  var datos = encFiltradas();
  var total = datos.length;

  if(!ENC_DATOS.length){
    cont.innerHTML = '<div class="table-card"><div style="padding:40px;text-align:center;color:var(--text2)">' +
      '📭 Todavía no hay respuestas registradas.<br><span style="font-size:12px">Comparte el enlace de la encuesta y vuelve a actualizar.</span></div></div>';
    return;
  }

  // Reserva: con muy pocas respuestas se podría deducir quién contestó
  if(total > 0 && total < ENC_MINIMO){
    cont.innerHTML = encHTMLFiltros() +
      '<div class="table-card"><div style="padding:40px 24px;text-align:center;color:var(--text2)">' +
      '<div style="font-size:34px;margin-bottom:10px">🔒</div>' +
      '<b style="color:var(--text);font-size:15px">Solo ' + total + ' respuesta(s) con este filtro</b><br>' +
      '<span style="font-size:13px">Para proteger la reserva no mostramos resultados de grupos con menos de ' +
      ENC_MINIMO + ' respuestas: sería posible deducir quién contestó.<br>' +
      'Amplía el filtro o espera a que lleguen más respuestas.</span>' +
      '</div></div>';
    encConectarFiltros();
    return;
  }

  var alumnas    = datos.filter(function(r){ return r.respondentType==='alumno'; }).length;
  var acudientes = datos.filter(function(r){ return r.respondentType==='acudiente'; }).length;
  var ids5       = ENC_PREGUNTAS.filter(function(p){ return p.k==='escala5'; }).map(function(p){ return p.id; });
  var general    = encPromedio(datos, ids5);
  var experiencia= encPromedio(datos, ['h_experiencia']);
  var continuidad= encPromedio(datos, ['k_continuidad']);
  var nps        = encNPS(datos);
  var pctGeneral = general.prom !== null ? Math.round(general.prom/5*100) : 0;

  var areas = Object.keys(ENC_CATEGORIAS).map(function(c){
    var r = encPromedio(datos, encIdsArea(c));
    return { nombre: ENC_CATEGORIAS[c], valor: r.prom, n: r.n };
  }).filter(function(a){ return a.n > 0; }).sort(function(a,b){ return b.valor - a.valor; });

  var grupos = encConteo(datos, 'grupo');

  cont.innerHTML =
    encHTMLFiltros() +
    (total === 0
      ? '<div class="table-card"><div style="padding:40px;text-align:center;color:var(--text2)">Sin respuestas para este filtro.</div></div>'
      : (
        // Sub-pestañas (mismo componente que usa Presentaciones)
        '<div class="subtabs">' +
          '<button class="subtab active" id="enc-tab-resumen"     onclick="encTab(\'resumen\')">📊 Resumen</button>' +
          '<button class="subtab"        id="enc-tab-detalle"     onclick="encTab(\'detalle\')">📋 Detalle por pregunta</button>' +
          '<button class="subtab"        id="enc-tab-comentarios" onclick="encTab(\'comentarios\')">💬 Comentarios</button>' +
        '</div>' +
        '<div id="enc-pane-resumen">' +
          encHTMLStats(total, alumnas, acudientes, general, experiencia, nps) +
          encHTMLDonuts(pctGeneral, general, nps, continuidad) +
          encHTMLBienestar(datos) +
          encHTMLCharts() +
        '</div>' +
        '<div id="enc-pane-detalle" style="display:none">' +
          encHTMLDetalle(datos) +
          encHTMLSeleccion(datos) +
        '</div>' +
        '<div id="enc-pane-comentarios" style="display:none">' +
          encHTMLComentarios(datos) +
        '</div>'
      ));

  encConectarFiltros();

  if(total > 0) setTimeout(function(){ encPintarGraficos(pctGeneral, nps, areas, grupos); }, 80);
}

function encFiltrar(campo, valor){ ENC_FILTRO[campo] = valor; renderEncuestas(); }

// Deja los dos selectores con el valor actual y escuchando cambios
function encConectarFiltros(){
  var fp = document.getElementById('enc-filtro-perfil');
  var fg = document.getElementById('enc-filtro-grupo');
  if(fp){ fp.value = ENC_FILTRO.perfil; fp.onchange = function(){ encFiltrar('perfil', this.value); }; }
  if(fg){ fg.value = ENC_FILTRO.grupo;  fg.onchange = function(){ encFiltrar('grupo',  this.value); }; }
}

// ── Sub-pestañas ──
var ENC_TAB = 'resumen';
function encTab(nombre){
  ENC_TAB = nombre;
  ['resumen','detalle','comentarios'].forEach(function(t){
    var pane = document.getElementById('enc-pane-' + t);
    var tab  = document.getElementById('enc-tab-' + t);
    if(pane) pane.style.display = (t === nombre) ? '' : 'none';
    if(tab)  tab.className = 'subtab' + (t === nombre ? ' active' : '');
  });
}

// ── Mostrar / ocultar el resto de comentarios de una pregunta ──
function encVerComentarios(id, btn){
  var caja = document.getElementById('enc-mas-' + id);
  if(!caja) return;
  var abierto = caja.style.display !== 'none';
  caja.style.display = abierto ? 'none' : '';
  if(btn) btn.textContent = abierto ? btn.dataset.txt : '▲ Ver menos';
}

function encHTMLFiltros(){
  var gruposLista = ['Preinfantil','Infantil','Juvenil','Adulto','Senior'];
  return '' +
  '<div class="wa-banner" style="background:linear-gradient(135deg,rgba(58,87,232,.07),rgba(58,87,232,.02));border-color:rgba(58,87,232,.25)">' +
    '<span style="font-size:20px">🔒</span>' +
    '<p><b>Medición interna y reservada.</b> Esta sección muestra únicamente resultados agregados y comentarios anónimos. ' +
    'No contiene correos, nombres ni respuestas atribuibles a una persona.</p>' +
  '</div>' +
  '<div class="filters">' +
    '<select class="filter-select" id="enc-filtro-perfil" style="width:auto;min-width:170px" onchange="encFiltrar(\'perfil\',this.value)">' +
      '<option value="">👥 Todos los perfiles</option>' +
      '<option value="alumno">🎓 Alumnas</option>' +
      '<option value="acudiente">👨‍👩‍👧 Acudientes</option>' +
    '</select>' +
    '<select class="filter-select" id="enc-filtro-grupo" style="width:auto;min-width:170px" onchange="encFiltrar(\'grupo\',this.value)">' +
      '<option value="">🎭 Todos los grupos</option>' +
      gruposLista.map(function(g){ return '<option value="'+g+'">'+g+'</option>'; }).join('') +
    '</select>' +
    '<button class="btn btn-ghost btn-sm" onclick="encFiltrar(\'perfil\',\'\');encFiltrar(\'grupo\',\'\')">Limpiar</button>' +
    '<div style="flex:1"></div>' +
    '<button class="btn btn-ghost btn-sm" onclick="encExportarCSV()">⬇️ CSV</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="window.print()">🖨️ Imprimir</button>' +
  '</div>';
}

function encHTMLStats(total, alumnas, acudientes, general, experiencia, nps){
  var colorNPS = nps.nps === null ? 'var(--text2)' : nps.nps >= 50 ? 'var(--success)' : nps.nps >= 0 ? 'var(--warning)' : 'var(--danger)';
  return '<div class="cards-grid">' +
    '<div class="stat-card">' +
      '<div class="stat-icon-wrap inf">📝</div>' +
      '<div class="stat-body"><div class="stat-label">Respuestas</div><div class="stat-val">'+total+'</div>' +
      '<div class="stat-sub">'+alumnas+' alumnas · '+acudientes+' acudientes</div></div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-icon-wrap suc">⭐</div>' +
      '<div class="stat-body"><div class="stat-label">Promedio General</div>' +
      '<div class="stat-val">'+(general.prom!==null?enc1(general.prom):'—')+'<span style="font-size:14px;color:var(--text2)"> /5</span></div>' +
      '<div class="stat-sub">'+general.n+' valoraciones</div></div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-icon-wrap col">🎯</div>' +
      '<div class="stat-body"><div class="stat-label">Experiencia 2026</div>' +
      '<div class="stat-val">'+(experiencia.prom!==null?enc1(experiencia.prom):'—')+'<span style="font-size:14px;color:var(--text2)"> /10</span></div>' +
      '<div class="stat-sub">calificación general</div></div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-icon-wrap ven">📣</div>' +
      '<div class="stat-body"><div class="stat-label">NPS</div>' +
      '<div class="stat-val" style="color:'+colorNPS+'">'+(nps.nps===null?'—':(nps.nps>0?'+':'')+nps.nps)+'</div>' +
      '<div class="stat-sub">'+nps.pro+' promotores · '+nps.det+' detractores</div></div>' +
    '</div>' +
  '</div>';
}

function encHTMLDonuts(pctGeneral, general, nps, continuidad){
  return '<div class="donuts-row">' +
    '<div class="donut-card">' +
      '<h4>⭐ Satisfacción General</h4>' +
      '<div class="donut-wrap"><canvas id="enc-donut-sat"></canvas>' +
      '<div class="donut-center"><span class="donut-pct" style="color:'+ENC_C.ok+'">'+pctGeneral+'%</span><span class="donut-sub">promedio</span></div></div>' +
      '<p style="font-size:11px;color:var(--text2);margin-top:6px">'+(general.prom!==null?enc1(general.prom):'—')+' de 5 · '+general.n+' valoraciones</p>' +
    '</div>' +
    '<div class="donut-card">' +
      '<h4>📣 Recomendación (NPS)</h4>' +
      '<div class="donut-wrap"><canvas id="enc-donut-nps"></canvas>' +
      '<div class="donut-center"><span class="donut-pct" style="color:'+ENC_C.primary+'">'+(nps.nps===null?'—':(nps.nps>0?'+':'')+nps.nps)+'</span><span class="donut-sub">NPS</span></div></div>' +
      '<p style="font-size:11px;color:var(--text2);margin-top:6px">▲'+nps.pro+' promotores · ●'+nps.pas+' pasivos · ▼'+nps.det+' detractores</p>' +
    '</div>' +
    '<div class="donut-card">' +
      '<h4>🚀 Intención de Continuidad</h4>' +
      '<div class="donut-wrap"><canvas id="enc-donut-cont"></canvas>' +
      '<div class="donut-center"><span class="donut-pct" style="color:'+ENC_C.primary+'">'+(continuidad.prom!==null?enc1(continuidad.prom):'—')+'</span><span class="donut-sub">de 5</span></div></div>' +
      '<p style="font-size:11px;color:var(--text2);margin-top:6px">quieren seguir en la academia</p>' +
    '</div>' +
  '</div>';
}

// Estilos propios del módulo (se inyectan una sola vez; no se toca styles.css)
function encInyectarEstilos(){
  if(document.getElementById('enc-estilos')) return;
  var st = document.createElement('style');
  st.id = 'enc-estilos';
  st.textContent =
    '.enc-charts{display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:24px}' +
    '@media(max-width:900px){.enc-charts{grid-template-columns:1fr}}' +
    '.enc-q{padding:9px 0;border-bottom:1px solid #f0f2f5}' +
    '.enc-q:last-child{border-bottom:none}' +
    '.enc-q-top{display:flex;justify-content:space-between;gap:14px;align-items:baseline;margin-bottom:6px}' +
    '@media(max-width:560px){.enc-q-top{flex-direction:column;gap:2px}}' +
    // En celular las tarjetas van a una sola columna (solo dentro de esta sección)
    '@media(max-width:600px){#sec-encuestas .cards-grid,#sec-encuestas .donuts-row{grid-template-columns:1fr}}';
  document.head.appendChild(st);
}

/* ───────────────────────────────────────────────────────────────
   BIENESTAR Y SALUD DE LA COMUNIDAD
   Índices agregados. NO es un diagnóstico ni una evaluación
   psicológica: es la percepción del grupo sobre su convivencia.
   ─────────────────────────────────────────────────────────────── */
function encHTMLBienestar(datos){
  var indices = ENC_INDICES_BC.map(function(c){
    var r = encPromedio(datos, encIdsArea(c));
    return { clave:c, nombre:ENC_CATEGORIAS[c], valor:r.prom, n:r.n };
  }).filter(function(x){ return x.n > 0; });

  var familias = encPromedio(datos, encIdsArea('bienestar_familia'));
  var presion  = encPromedioCrudo(datos, 'bc_presion');

  if(!indices.length && !familias.n) return '';

  // Índice general = promedio de los índices (la presión ya entra invertida)
  var general = indices.length
    ? indices.reduce(function(a,b){ return a + b.valor; }, 0) / indices.length
    : null;

  var color = function(v){ return v >= 4.2 ? 'var(--success)' : v >= 3.5 ? 'var(--warning)' : 'var(--danger)'; };
  var ordenados = indices.slice().sort(function(a,b){ return b.valor - a.valor; });

  var barras = ordenados.map(function(i){
    return '<div style="display:flex;align-items:center;gap:10px;padding:5px 0">' +
      '<span style="font-size:12.5px;color:var(--text2);min-width:170px;flex:0 0 auto">' + encEsc(i.nombre) + '</span>' +
      '<div style="flex:1;height:12px;background:var(--card2);border-radius:6px;overflow:hidden">' +
        '<div style="height:100%;width:' + (i.valor/5*100) + '%;background:' + ENC_C.primary + ';border-radius:0 5px 5px 0"></div></div>' +
      '<span style="font-size:13px;font-weight:800;min-width:44px;text-align:right;color:' + color(i.valor) + '">' + enc1(i.valor) + '</span>' +
    '</div>';
  }).join('');

  // La presión se lee al revés: puntaje alto = más presión percibida
  var colorPresion = presion.prom === null ? 'var(--text2)'
                   : presion.prom <= 2.5 ? 'var(--success)'
                   : presion.prom <= 3.5 ? 'var(--warning)' : 'var(--danger)';

  return '<div class="table-card">' +
    '<div class="table-card-header">' +
      '<h3>💛 Bienestar y salud de la comunidad</h3>' +
      '<span style="font-size:11px;color:var(--text2)">percepción del grupo · no es un diagnóstico</span>' +
    '</div>' +
    '<div style="padding:18px 20px">' +
      '<div class="prof-stats-grid" style="grid-template-columns:repeat(3,1fr)">' +
        '<div class="prof-stat">' +
          '<div class="val" style="color:' + (general===null?'var(--text2)':color(general)) + '">' +
            (general===null ? '—' : enc1(general)) + '<span style="font-size:13px;color:var(--text2)"> /5</span></div>' +
          '<div class="lab">Índice de bienestar comunitario</div>' +
        '</div>' +
        '<div class="prof-stat" style="background:var(--card2)">' +
          '<div class="val" style="color:' + colorPresion + '">' +
            (presion.prom===null ? '—' : enc1(presion.prom)) + '<span style="font-size:13px;color:var(--text2)"> /5</span></div>' +
          '<div class="lab">Presión percibida · alto = más presión</div>' +
        '</div>' +
        '<div class="prof-stat">' +
          '<div class="val" style="color:' + (familias.prom===null?'var(--text2)':color(familias.prom)) + '">' +
            (familias.prom===null ? '—' : enc1(familias.prom)) + '<span style="font-size:13px;color:var(--text2)"> /5</span></div>' +
          '<div class="lab">Bienestar visto por las familias</div>' +
        '</div>' +
      '</div>' +
      (barras ? '<div style="margin-top:16px">' + barras + '</div>' : '') +
      '<p style="font-size:12px;color:var(--text2);margin-top:14px;line-height:1.6">' +
        'Los índices resumen la percepción de la comunidad sobre su propia convivencia. ' +
        'No identifican ni evalúan a ninguna persona. La pregunta de presión se cuenta invertida dentro del ' +
        'índice de equilibrio y se muestra aparte tal como se respondió.' +
        (indices.length ? '<br>Las siete áreas las responden los alumnos; el bloque de familias lo responden los acudientes.' : '') +
      '</p>' +
    '</div></div>';
}

function encHTMLCharts(){
  return '<div class="enc-charts">' +
    '<div class="chart-card"><h4>📊 Promedio por Área (1 a 5)</h4><canvas id="enc-chart-areas" style="max-height:280px"></canvas></div>' +
    '<div class="chart-card"><h4>🎭 Respuestas por Grupo</h4><canvas id="enc-chart-grupos" style="max-height:280px"></canvas></div>' +
  '</div>';
}

// ── Detalle pregunta por pregunta, con barra apilada 1–5 en HTML ──
function encHTMLDetalle(datos){
  var bloques = {};
  ENC_PREGUNTAS.forEach(function(p){
    if(p.k !== 'escala5') return;
    var d = encDistribucion(datos, p.id);
    if(!d.n) return;                                  // oculta lo que no aplica al filtro
    if(!bloques[p.b]) bloques[p.b] = [];
    bloques[p.b].push({ p:p, d:d });
  });

  // El orden de esta lista es el orden en que aparecen los bloques en el detalle
  var titulos = { C:'🩰 Profesores', D:'🎶 Contenidos y metodología',
                  E:'🏫 Horarios e instalaciones', F:'📣 Comunicación y organización',
                  G:'🎪 Presentaciones y eventos', BC:'💛 ¿Cómo estamos como comunidad?',
                  I:'👨‍👩‍👧 Familias y acudientes', K:'🚀 Continuidad' };

  var html = '<div class="table-card"><div class="table-card-header">' +
      '<h3>Detalle por pregunta</h3>' +
      '<span style="font-size:11px;color:var(--text2)">' +
        '<i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:'+ENC_C.d1+';margin-right:3px"></i>1 ' +
        '<i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:'+ENC_C.d2+';margin:0 3px 0 8px"></i>2 ' +
        '<i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:'+ENC_C.d3+';margin:0 3px 0 8px"></i>3 ' +
        '<i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:'+ENC_C.d4+';margin:0 3px 0 8px"></i>4 ' +
        '<i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:'+ENC_C.d5+';margin:0 3px 0 8px"></i>5' +
      '</span></div><div style="padding:6px 20px 18px">';

  Object.keys(titulos).forEach(function(b){
    if(!bloques[b]) return;
    html += '<div style="font-size:13px;font-weight:800;color:var(--primary);margin:18px 0 8px">'+titulos[b]+'</div>';
    bloques[b].forEach(function(x){
      // En una pregunta inversa (ej. presión percibida) un puntaje alto es señal de alerta
      var color = x.p.inv
        ? (x.d.prom <= 2.5 ? 'var(--success)' : x.d.prom <= 3.5 ? 'var(--warning)' : 'var(--danger)')
        : (x.d.prom >= 4.2 ? 'var(--success)' : x.d.prom >= 3.5 ? 'var(--warning)' : 'var(--danger)');
      var marca = x.p.inv ? ' <span class="badge" style="background:var(--warning-lt);color:#a06d00;font-size:10px">INVERSA</span>' : '';
      html += '<div class="enc-q">' +
        '<div class="enc-q-top">' +
          '<span style="font-size:12.5px;color:var(--text)">'+encEsc(x.p.t)+marca+'</span>' +
          '<span style="font-weight:800;font-size:13px;color:'+color+';white-space:nowrap">'+enc1(x.d.prom)+' /5 ' +
          '<span style="color:var(--text2);font-weight:600">('+x.d.n+')</span></span>' +
        '</div>' + encBarraApilada(x.d) + '</div>';
    });
  });

  return html + '</div></div>';
}

function encBarraApilada(d){
  var cols = [ENC_C.d1, ENC_C.d2, ENC_C.d3, ENC_C.d4, ENC_C.d5];
  var s = '<div style="display:flex;height:20px;border-radius:5px;overflow:hidden;gap:2px;background:#f0f2f5">';
  for(var v=1; v<=5; v++){
    var pct = d.c[v]/d.n*100;
    if(pct <= 0) continue;
    s += '<span title="Calificación '+v+': '+d.c[v]+' ('+Math.round(pct)+'%)" ' +
         'style="flex:0 0 calc('+pct+'% - 2px);background:'+cols[v-1]+';color:'+(v===3?'#5a6072':'#fff')+';' +
         'font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center">' +
         (pct >= 10 ? Math.round(pct)+'%' : '') + '</span>';
  }
  return s + '</div>';
}

// ── Preguntas de selección (opción única y múltiple) ──
function encHTMLSeleccion(datos){
  var preguntas = ENC_PREGUNTAS.filter(function(p){ return p.k==='unica' || p.k==='multiple'; });
  var html = '';
  preguntas.forEach(function(p){
    var m = encConteo(datos, p.id);
    var claves = Object.keys(m);
    if(!claves.length) return;
    var totalResp = p.k==='multiple' ? datos.length : claves.reduce(function(s,k){ return s+m[k]; },0);
    var mayor = Math.max.apply(null, claves.map(function(k){ return m[k]; }));
    claves.sort(function(a,b){ return m[b]-m[a]; });
    html += '<div style="margin-bottom:20px"><div style="font-size:12.5px;font-weight:700;color:var(--text);margin-bottom:8px">'+encEsc(p.t)+'</div>' +
      claves.map(function(k){
        var pct = Math.round(m[k]/totalResp*100);
        return '<div style="display:flex;align-items:center;gap:10px;padding:4px 0">' +
          '<span style="font-size:12px;color:var(--text2);min-width:150px;flex:0 0 auto">'+encEsc(k)+'</span>' +
          '<div style="flex:1;height:10px;background:var(--card2);border-radius:5px;overflow:hidden">' +
            '<div style="height:100%;width:'+(m[k]/mayor*100)+'%;background:'+ENC_C.primary+';border-radius:0 4px 4px 0"></div></div>' +
          '<span style="font-size:12px;font-weight:700;min-width:56px;text-align:right">'+m[k]+' · '+pct+'%</span>' +
        '</div>';
      }).join('') + '</div>';
  });
  if(!html) return '';
  return '<div class="table-card"><div class="table-card-header"><h3>Preguntas de selección</h3></div>' +
         '<div style="padding:18px 20px">'+html+'</div></div>';
}

// ── Comentarios abiertos, anónimos ──
function encHTMLComentarios(datos){
  var abiertas = ENC_PREGUNTAS.filter(function(p){ return p.k==='texto'; });
  var html = '', totalCom = 0;

  abiertas.forEach(function(p){
    var items = datos.map(function(r){
      return { txt: r.answers && r.answers[p.id], tipo: r.respondentType, grupo: r.group };
    }).filter(function(x){ return x.txt && String(x.txt).trim(); });
    if(!items.length) return;
    totalCom += items.length;
    html += '<div style="font-size:12.5px;font-weight:800;color:var(--primary);margin:20px 0 10px">'+encEsc(p.t)+
            ' <span style="color:var(--text2);font-weight:600">· '+items.length+'</span></div>';

    var tarjeta = function(i){
      return '<div style="background:var(--card2);border-left:3px solid var(--primary);border-radius:6px;padding:11px 14px;margin-bottom:8px">' +
        '<div style="font-size:13px;color:var(--text)">'+encEsc(i.txt)+'</div>' +
        '<div style="margin-top:7px;display:flex;gap:6px;flex-wrap:wrap">' +
          '<span class="badge" style="background:var(--primary-lt);color:var(--primary)">'+(i.tipo==='alumno'?'🎓 Alumna':'👨‍👩‍👧 Acudiente')+'</span>' +
          '<span class="badge" style="background:var(--card2);color:var(--text2);border:1px solid var(--border)">'+encEsc(i.grupo||'Sin grupo')+'</span>' +
        '</div></div>';
    };

    // Muestra los primeros 5 y esconde el resto tras un botón
    html += items.slice(0,5).map(tarjeta).join('');
    if(items.length > 5){
      var resto = items.length - 5;
      html += '<div id="enc-mas-'+p.id+'" style="display:none">' + items.slice(5).map(tarjeta).join('') + '</div>' +
              '<button class="btn btn-ghost btn-sm" data-txt="▼ Ver los otros '+resto+'" ' +
              'onclick="encVerComentarios(\''+p.id+'\',this)" style="margin-bottom:6px">▼ Ver los otros '+resto+'</button>';
    }
  });

  if(!html) html = '<p style="color:var(--text2);font-size:13px;padding:10px 0">Todavía no hay comentarios escritos.</p>';
  return '<div class="table-card"><div class="table-card-header"><h3>💬 Comentarios abiertos</h3>' +
         '<span style="font-size:11px;color:var(--text2)">'+totalCom+' comentarios · anónimos</span></div>' +
         '<div style="padding:6px 20px 20px">'+html+'</div></div>';
}

// ===================== GRÁFICOS (Chart.js) =====================
function encPintarGraficos(pctGeneral, nps, areas, grupos){
  ['enc-donut-sat','enc-donut-nps','enc-donut-cont','enc-chart-areas','enc-chart-grupos'].forEach(function(id){
    var el = document.getElementById(id);
    if(el && el._ch){ el._ch.destroy(); el._ch = null; }
  });
  if(typeof Chart === 'undefined') return;

  var tc = '#8a92a6', gc = 'rgba(0,0,0,.06)';
  var donutOpts = { cutout:'78%', plugins:{ legend:{display:false}, tooltip:{enabled:false} }, animation:{duration:700} };

  var s = document.getElementById('enc-donut-sat');
  if(s) s._ch = new Chart(s, { type:'doughnut',
    data:{ datasets:[{ data:[pctGeneral, 100-pctGeneral], backgroundColor:[ENC_C.ok,'#e8f5ee'], borderWidth:0, hoverOffset:4 }] },
    options: donutOpts });

  var np = document.getElementById('enc-donut-nps');
  if(np) np._ch = new Chart(np, { type:'doughnut',
    data:{ labels:['Promotores','Pasivos','Detractores'],
           datasets:[{ data:[nps.pro, nps.pas, nps.det],
                       backgroundColor:[ENC_C.ok, ENC_C.warn, ENC_C.bad], borderWidth:0, hoverOffset:5 }] },
    options:{ cutout:'70%', plugins:{ legend:{display:false},
      tooltip:{ backgroundColor:'rgba(35,45,66,.95)', padding:10, cornerRadius:8 } }, animation:{duration:700} } });

  var cont = document.getElementById('enc-donut-cont');
  var contPct = 0, contArea = areas.filter(function(a){ return a.nombre === ENC_CATEGORIAS.continuidad; })[0];
  if(contArea) contPct = Math.round(contArea.valor/5*100);
  if(cont) cont._ch = new Chart(cont, { type:'doughnut',
    data:{ datasets:[{ data:[contPct, 100-contPct], backgroundColor:[ENC_C.primary, ENC_C.primaryLt], borderWidth:0, hoverOffset:4 }] },
    options: donutOpts });

  // Barras horizontales — promedio por área (una sola tonalidad)
  var ea = document.getElementById('enc-chart-areas');
  if(ea) ea._ch = new Chart(ea, { type:'bar',
    data:{ labels: areas.map(function(a){ return a.nombre; }),
           datasets:[{ label:'Promedio', data: areas.map(function(a){ return Number(enc1(a.valor)); }),
                       backgroundColor:'rgba(58,87,232,.85)', borderRadius:4, borderSkipped:false, barThickness:14 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false},
        tooltip:{ backgroundColor:'rgba(35,45,66,.95)', padding:10, cornerRadius:8,
          callbacks:{ label:function(ctx){ return ' ' + ctx.parsed.x + ' de 5 · ' + areas[ctx.dataIndex].n + ' valoraciones'; } } } },
      scales:{ x:{ min:0, max:5, ticks:{color:tc,font:{size:9}}, grid:{color:gc} },
               y:{ ticks:{color:tc,font:{size:10}}, grid:{display:false} } } } });

  // Respuestas por grupo
  var eg = document.getElementById('enc-chart-grupos');
  var claves = Object.keys(grupos);
  if(eg && claves.length) eg._ch = new Chart(eg, { type:'bar',
    data:{ labels: claves,
           datasets:[{ label:'Respuestas', data: claves.map(function(k){ return grupos[k]; }),
                       backgroundColor:['rgba(214,0,106,.75)','rgba(26,153,0,.75)','rgba(201,80,0,.75)','rgba(0,119,182,.75)','rgba(58,87,232,.75)'],
                       borderRadius:4, borderSkipped:false }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false},
        tooltip:{ backgroundColor:'rgba(35,45,66,.95)', padding:10, cornerRadius:8 } },
      scales:{ x:{ ticks:{color:tc,font:{size:9}}, grid:{display:false} },
               y:{ beginAtZero:true, ticks:{color:tc,font:{size:9},precision:0}, grid:{color:gc} } } } });
}

// ===================== EXPORTAR CSV (sin correos) =====================
function encExportarCSV(){
  var datos = encFiltradas();
  if(!datos.length){ if(typeof toast==='function') toast('No hay datos para exportar','info'); return; }

  var ids = ENC_PREGUNTAS.map(function(p){ return p.id; });
  var fila = function(a){
    return a.map(function(v){
      var s = (v === undefined || v === null) ? '' : String(Array.isArray(v) ? v.join(' | ') : v);
      return '"' + s.replace(/"/g,'""') + '"';
    }).join(',');
  };
  var lineas = [ fila(['fecha','perfil','grupo','antiguedad'].concat(ids)) ];
  datos.forEach(function(r){
    lineas.push(fila([ (r.timestamp||'').substring(0,10), r.respondentType, r.group, r.membershipDuration ]
      .concat(ids.map(function(id){ return r.answers ? r.answers[id] : ''; }))));
  });

  var blob = new Blob(['﻿' + lineas.join('\n')], {type:'text/csv;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'medicion-lazos-2026.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  if(typeof toast === 'function') toast('⬇️ CSV descargado (sin correos)','ok');
}
