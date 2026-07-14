/* ═══════════════════════════════════════════════════════════
   auth.js
   Login y control de sesión
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== AUTH =====================
function doLogin(){
  const e=document.getElementById('login-email').value.trim().toLowerCase();
  if(e===ADMIN_EMAIL){
    localStorage.setItem('_session',JSON.stringify({email:e,exp:Date.now()+30*86400000}));
    document.getElementById('login-screen').style.display='none';
    document.getElementById('app').style.visibility='visible';
    init();
  } else {
    document.getElementById('login-error').style.display='block';
  }
}
function checkSession(){
  const s=localStorage.getItem('_session');
  if(!s) return false;
  try{
    const j=JSON.parse(s);
    return j.email===ADMIN_EMAIL&&j.exp>Date.now();
  }catch{return false;}
}
function doLogout(){
  localStorage.removeItem('_session');
  location.reload();
}
