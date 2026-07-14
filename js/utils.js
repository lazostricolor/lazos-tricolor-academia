/* ═══════════════════════════════════════════════════════════
   utils.js
   Helpers: fechas, formato, modales, reloj, toast
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== HELPERS =====================
function mesKey(date){
  return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');
}
function mesLabel(mk){
  if(!mk) return '—';
  const [y,m]=mk.split('-');
  const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return meses[parseInt(m)-1]+' '+y;
}
// Suma delta meses a un string "YYYY-MM" y devuelve otro "YYYY-MM"
function sumarMes(mk,delta){
  let [y,m]=mk.split('-').map(Number);
  m+=delta;
  while(m>12){m-=12;y++;}
  while(m<1){m+=12;y--;}
  return y+'-'+String(m).padStart(2,'0');
}
function getMesHoy(){
  return mesKey(getHoyReal());
}
function getHoyReal(){
  return new Date(fechaActual.getTime()+(Date.now()-_clockBase));
}
function alumnaActivaEnMes(alumna,mk){
  if(!mk||mk<'2024-04') return false;
  let fi=alumna.fechaIngreso||'';
  if(!fi||fi==='undefined'||fi==='null'){
    // Sin fecha conocida: usar mes actual local como fallback
    const n=new Date();
    fi=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');
  } else {
    fi=fi.trim().substring(0,7);
  }
  return fi<=mk;
}
function calcMensualidad(alumna,mk){
  const mes=parseInt(mk.split('-')[1]);
  const esMedio=mes===1||mes===12;
  if(alumna.familiar) return esMedio?25000:PRECIO_FAMI;
  return esMedio?PRECIO_MEDIO:PRECIO_BASE;
}
function getAlumnasMes(mk){ return DB.alumnos.filter(a=>alumnaActivaEnMes(a,mk)); }
// Incluye activas Y retiradas — para registros históricos como presentaciones
function todosLosAlumnos(){ return [...(DB.alumnos||[]),...(DB.alumnosRetirados||[])]; }
function formatCOP(n){ return '$'+n.toLocaleString('es-CO'); }
function iniciales(n){ return n.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase(); }
function catBadge(c){
  const m={Infantil:'inf',Juvenil:'juv','Adulto':'adu','Adulto Mayor':'adum'};
  return `<span class="badge badge-${m[c]||'inf'}">${c}</span>`;
}
function getPago(id,mk){ return (DB.pagos[id]&&DB.pagos[id][mk])||{pagado:false,beca:false,fechaPago:null}; }
function setPago(id,mk,data){
  if(!DB.pagos[id]) DB.pagos[id]={};
  DB.pagos[id][mk]=data;
}
function getDiasSemana(ofs){
  const d=getHoyReal();
  const day=d.getDay();
  const lunes=new Date(d);
  lunes.setDate(d.getDate()-(day===0?6:day-1));
  lunes.setDate(lunes.getDate()+ofs*7);
  const dias=[];
  for(let i=0;i<7;i++){
    const dd=new Date(lunes);
    dd.setDate(lunes.getDate()+i);
    dias.push(dd);
  }
  return dias;
}
function semKey(ofs){
  const dias=getDiasSemana(ofs);
  return dias[0].toISOString().substring(0,10)+'_'+dias[6].toISOString().substring(0,10);
}
function dateStr(d){ return d.toISOString().substring(0,10); }
function toast(msg,type='ok'){
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`<span>${type==='ok'?'✅':type==='err'?'❌':'ℹ️'}</span> ${msg}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>{el.style.animation='slideOut .3s ease forwards';setTimeout(()=>el.remove(),300)},3000);
}
function confirm2(msg){ return confirm(msg); }

// ===================== FECHA/RELOJ =====================
async function sincronizarFecha(){
  try{
    const r=await fetch('https://worldtimeapi.org/api/timezone/America/Bogota');
    if(!r.ok) throw new Error('worldtime error');
    const j=await r.json();
    fechaActual=new Date(j.datetime);
    _clockBase=Date.now();
    console.log('Fecha sincronizada con WorldTime:', fechaActual.toISOString());
  }catch(e){
    fechaActual=new Date();
    _clockBase=Date.now();
    console.warn('WorldTime no disponible, usando fecha local:', fechaActual.toISOString());
  }
}
function startClock(){
  setInterval(()=>{
    const now=getHoyReal();
    const el=document.getElementById('clock');
    if(el) el.textContent=now.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  },1000);
}

// ===================== MODAL HELPERS =====================
function abrirModal(id){ document.getElementById(id).classList.add('show'); }
function cerrarModal(id){ document.getElementById(id).classList.remove('show'); }
// Cerrar modal al click fuera
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('show'); });
});
