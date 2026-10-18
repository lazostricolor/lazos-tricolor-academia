/* ═══════════════════════════════════════════════════════════
   auth.js
   Login con Google (Firebase Authentication) y token de sesión
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca

   Solo la cuenta ADMIN_EMAIL entra. Cada petición a Firestore lleva
   el token de esa sesión; las reglas de Firestore rechazan el resto.
═══════════════════════════════════════════════════════════ */

// ===================== AUTH =====================
firebase.initializeApp(FB_CONFIG);
const fbAuth = firebase.auth();

// Último token conocido — lo usa fbHeadersSync() en pagehide, donde no se puede esperar.
// onIdTokenChanged también mantiene el token renovado en segundo plano.
let _fbToken = '';
fbAuth.onIdTokenChanged(u => {
  if(!u){ _fbToken = ''; return; }
  u.getIdToken().then(t => { _fbToken = t; }).catch(()=>{});
});

function esAdmin(u){
  return !!u && u.emailVerified && (u.email||'').toLowerCase() === ADMIN_EMAIL;
}

// Encabezados para fetch a Firestore: token fresco (el SDK lo renueva si expiró)
async function fbHeaders(extra){
  const h = Object.assign({}, extra||{});
  const u = fbAuth.currentUser;
  if(u){
    try{ _fbToken = await u.getIdToken(); }catch(e){ console.warn('Token no disponible:', e.message); }
  }
  if(_fbToken) h.Authorization = 'Bearer ' + _fbToken;
  return h;
}
// Versión síncrona para cuando no se puede esperar (pagehide)
function fbHeadersSync(extra){
  const h = Object.assign({}, extra||{});
  if(_fbToken) h.Authorization = 'Bearer ' + _fbToken;
  return h;
}

function mostrarLoginError(msg){
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

async function doLogin(){
  document.getElementById('login-error').style.display = 'none';
  try{
    const prov = new firebase.auth.GoogleAuthProvider();
    prov.setCustomParameters({ prompt: 'select_account', login_hint: ADMIN_EMAIL });
    await fbAuth.signInWithPopup(prov);
    // onAuthStateChanged (app.js) se encarga de abrir el panel
  }catch(e){
    if(e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
    mostrarLoginError(e.code === 'auth/unauthorized-domain'
      ? 'Dominio no autorizado. Agrégalo en Firebase → Authentication → Configuración → Dominios autorizados.'
      : 'No se pudo entrar con Google. Intenta de nuevo.');
  }
}

async function doLogout(){
  try{ await fbAuth.signOut(); }catch(_){}
  location.reload();
}
