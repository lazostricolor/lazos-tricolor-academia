/* ═══════════════════════════════════════════════════════════
   state.js
   Configuración, constantes y estado global (DB)
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== CONFIG =====================
const FB_URL = 'https://firestore.googleapis.com/v1/projects/lazos-tricolor-academia/databases/(default)/documents/academias/lazos-tricolor/datos/principal';
const FB_KEY = 'AIzaSyCIj32zyCreKyCGJSMo6T5yTDhMeqctpG4';
const ADMIN_EMAIL = 'academialazostricolor@gmail.com';
const PRECIO_BASE = 70000, PRECIO_FAMI = 50000, PRECIO_MEDIO = 35000;
const HONOR_POR_CLASE = 50000;
const DIAS_CLASE = {
  'Infantil': [4,6], 'Juvenil': [3,6], 'Adulto': [1,6], 'Adulto Mayor': [1,6]
};
const CATS = ['Infantil','Juvenil','Adulto','Adulto Mayor'];

// ===================== STATE =====================
let DB = { alumnos:[], alumnosRetirados:[], profesores:[], profesoresRetirados:[], pagos:{}, asistencias:{}, clases:{}, gastos:[], gastosV:[], extraDias:{}, presentaciones:[], planificador:[], otrosIngresos:[], recaudos:[], rifas:[], nextId:1 };
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
