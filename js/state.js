/* ═══════════════════════════════════════════════════════════
   state.js
   Configuración, constantes y estado global (DB)
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== CONFIG =====================
const FB_URL = 'https://firestore.googleapis.com/v1/projects/lazos-tricolor-academia/databases/(default)/documents/academias/lazos-tricolor/datos/principal';
const FB_KEY = 'AIzaSyCIj32zyCreKyCGJSMo6T5yTDhMeqctpG4';
const ADMIN_EMAIL = 'academialazostricolor@gmail.com';
// Config pública de Firebase (la misma de panel-sudaderas.html). Solo se usa para el login;
// los datos se siguen leyendo y guardando por REST, ahora con el token de la sesión.
const FB_CONFIG = {
  apiKey: FB_KEY,
  authDomain: 'lazos-tricolor-academia.firebaseapp.com',
  projectId: 'lazos-tricolor-academia',
  appId: '1:284048193120:web:96cacf134a537c9ad57505'
};
// ── Tarifas de mensualidad por vigencia ──
// Para SUBIR la mensualidad: agrega una fila NUEVA al final con el mes desde
// el que aplica (ej. '2027-01'). Nunca edites una fila existente: cada mes se
// cobra y se reporta con la tarifa vigente ESE mes, así subir el precio no
// cambia la contabilidad ni las deudas de meses pasados.
//   base: mensualidad normal · familiar: tarifa familiar
//   medio / medioFamiliar: enero y diciembre (medio mes)
const TARIFAS = [
  { desde:'2024-04', base:70000, familiar:50000, medio:35000, medioFamiliar:25000 },
];
const PRECIO_BASE = 70000, PRECIO_FAMI = 50000, PRECIO_MEDIO = 35000; // solo referencia: se usa TARIFAS
const HONOR_POR_CLASE = 50000;
const DIAS_CLASE = {
  'Infantil': [4,6], 'Juvenil': [3,6], 'Adulto': [1,6], 'Adulto Mayor': [1,6]
};
const CATS = ['Infantil','Juvenil','Adulto','Adulto Mayor'];

// ===================== STATE =====================
let DB = { alumnos:[], alumnosRetirados:[], profesores:[], profesoresRetirados:[], pagos:{}, asistencias:{}, clases:{}, gastos:[], gastosV:[], extraDias:{}, presentaciones:[], planificador:[], otrosIngresos:[], recaudos:[], rifas:[], vestuarios:[], usosVestuario:[], nextId:1 };
// Mes activo por sección — se inicializa en init() con el mes real
let mesSec={dash:'',alumnos:'',pagos:'',asist:'',fin:'',gastos:'',ingresos:''};
let semanaOfs=0;
let editAlumnaId=null, editProfId=null, editPresId=null;
let dashPagPag=0, vistaAlumnosAgrupada=false;
let syncTimeout=null, fechaActual=new Date(), _clockBase=Date.now();
let fotoTemp=null;
let activeSection='dashboard';

// Sin backup — datos se cargan exclusivamente desde Firebase y localStorage
const BACKUP_ALUMNOS = [];
const BACKUP_PROFESORES = [];
