/* ═══════════════════════════════════════════════════════════
   coreo/audio.js
   Motor de reproducción: reloj (con o sin pista), velocidad,
   metrónomo, detección de tempo, forma de onda y tap tempo.
═══════════════════════════════════════════════════════════ */

// Temporizador en un Worker: sigue a 25 ms aunque la pestaña quede en segundo plano
// (los setInterval normales se frenan a 1 por segundo y el metrónomo se cortaría).
const Tic = (() => {
  let w = null, id = null, fn = null;
  try {
    const src = 'let i=null;onmessage=e=>{clearInterval(i);if(e.data>0)i=setInterval(()=>postMessage(0),e.data)}';
    w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = () => fn && fn();
  } catch (_) { w = null; }
  return {
    iniciar(f, ms = 25) { fn = f; if (w) w.postMessage(ms); else { clearInterval(id); id = setInterval(f, ms); } },
    parar() { fn = null; if (w) w.postMessage(0); else clearInterval(id); }
  };
})();

const Motor = {
  ctx: null,
  audio: new Audio(),
  tieneAudio: false,
  tocando: false,
  vel: 1,                 // velocidad de práctica (1 = normal)
  duracion: 120,          // segundos (de la pista o de la coreografía sin música)
  tempo: { bpm: 120, offset: 0, medida: 4 },
  met: { on: false, vol: 0.7 },
  bucle: null,            // {a, b} en segundos
  _vInicio: 0, _vT0: 0,   // reloj virtual (sin pista)
  _ultimoBeat: -Infinity,
  _timer: null,
  alTerminar: null,

  _asegurarCtx() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      this.ctx = new C();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  cargarUrl(url) {
    this.pausar();
    this.tieneAudio = !!url;
    if (!url) { this.audio.removeAttribute('src'); this.audio.load(); return Promise.resolve(); }
    this.audio.preload = 'auto';
    this.audio.src = url;
    this.audio.preservesPitch = true; this.audio.mozPreservesPitch = true; this.audio.webkitPreservesPitch = true;
    return new Promise(ok => {
      setTimeout(() => fin(), 10000);   // red lenta: no bloquear la apertura
      const fin = () => { this.audio.removeEventListener('loadedmetadata', fin); this.audio.removeEventListener('error', fin); ok(); };
      this.audio.addEventListener('loadedmetadata', fin); this.audio.addEventListener('error', fin);
    });
  },

  // ── Reloj ──
  // El tiempo de la canción se calcula con el reloj de audio (ctx.currentTime), que es
  // exacto al milisegundo. audio.currentTime avanza "a saltos", así que solo se usa
  // para corregir suavemente la deriva (o de golpe si la pista se detuvo a cargar).
  _ahora() { return this.ctx ? this.ctx.currentTime : performance.now() / 1000; },
  _anclar(t) { this._vInicio = t; this._vT0 = this._ahora(); },
  tiempo() {
    if (!this.tocando) return this.tieneAudio ? (this.audio.currentTime || 0) : this._vInicio;
    const est = this._vInicio + (this._ahora() - this._vT0) * this.vel;
    if (this.tieneAudio) {
      const real = this.audio.currentTime || 0, dif = real - est;
      if (Math.abs(dif) > 0.15) { this._anclar(real); return real; }   // pausa de red, salto, etc.
      if (Math.abs(dif) > 0.03) this._vInicio += dif * 0.02;            // corrección suave
    }
    return est;
  },

  async reproducir() {
    const ctx = this._asegurarCtx();
    try { await ctx.resume(); } catch (_) {}
    if (this.tiempo() >= this.duracion - 0.05) this.ir(this.bucle ? this.bucle.a : 0);
    if (this.tieneAudio) {
      this.audio.playbackRate = this.vel;
      try { await this.audio.play(); } catch (e) { console.warn(e); return; }
      this._anclar(this.audio.currentTime || 0);
    } else {
      this._anclar(this._vInicio);
    }
    this.tocando = true;
    this._reiniciarMet();
    Tic.iniciar(() => { this.vigilar(); this._programar(); });
  },

  pausar() {
    if (!this.tocando) return;
    if (this.tieneAudio) { this.audio.pause(); this._vInicio = this.audio.currentTime || 0; }
    else this._vInicio = this.tiempo();
    this.tocando = false;
    Tic.parar();
    this._cancelarClicks();
  },

  ir(t) {
    t = Math.max(0, Math.min(this.duracion, t));
    if (this.tieneAudio) { try { this.audio.currentTime = t; } catch (_) {} }
    this._anclar(t);
    this._reiniciarMet();
  },

  ponerVelocidad(v) {
    const t = this.tiempo();
    this.vel = v;
    if (this.tieneAudio) this.audio.playbackRate = v;
    this._anclar(t);
    this._reiniciarMet();
  },

  // Llamado en cada cuadro por la interfaz: bucle y fin de la canción
  vigilar() {
    if (!this.tocando) return;
    const t = this.tiempo();
    if (this.bucle && t >= this.bucle.b) { this.ir(this.bucle.a); this.alRepetir && this.alRepetir(); return; }
    if (t >= this.duracion || (this.tieneAudio && this.audio.ended)) {
      this.pausar(); this.ir(this.duracion);
      this.alTerminar && this.alTerminar();
    }
  },

  // ── Metrónomo con programación anticipada (no depende del ritmo de pantalla) ──
  _reiniciarMet() {
    const { bpm, offset } = this.tempo; const spb = 60 / bpm;
    this._ultimoBeat = Math.ceil((this.tiempo() - 0.05 * this.vel - offset) / spb - 1e-6) - 1;
    this._cancelarClicks();
  },
  // Clicks ya programados (para callarlos al pausar o saltar)
  _clicks: [],
  _cancelarClicks() {
    if (!this.ctx) return;
    const ahora = this.ctx.currentTime;
    this._clicks.forEach(c => { if (c.t > ahora) { try { c.o.stop(); } catch (_) {} } });
    if (this._ultClick && this._ultClick.t > ahora) this._ultClick = null;   // se canceló: que pueda volver a sonar
    this._clicks = this._clicks.filter(c => c.t <= ahora && c.t > ahora - 1);
  },

  // Tipo de golpe: 3 = el 1 del conteo · 2 = inicio de compás · 1 = acento secundario · 0 = tiempo · -1 = subdivisión
  tipoTiempo(b) {
    const { medida, unidad, grupo } = this.tempo;
    if (!this.met.acento) return 0;
    if (mod(b, grupo || 8) === 0) return 3;
    const enCompas = mod(b, medida);
    if (enCompas === 0) return 2;
    // Compases compuestos (6/8, 9/8, 12/8): acento cada 3 corcheas
    if (unidad === 8 && medida % 3 === 0 && medida > 3 && enCompas % 3 === 0) return 1;
    return 0;
  },
  _programar() {
    if (!this.tocando || !this.met.on || !this.ctx) return;
    const { bpm, offset } = this.tempo; const spb = 60 / bpm;
    const sub = Math.max(1, this.met.sub || 1);
    const ahora = this.tiempo();
    const horizonte = ahora + 0.15 * this.vel;
    let b = this._ultimoBeat + 1;
    // Tolera ~50 ms de retraso: al dar play justo sobre un tiempo, ese golpe también suena
    const minimo = Math.ceil((ahora - 0.05 * this.vel - offset) / spb - 1e-6);
    if (b < minimo) b = minimo;
    while (offset + b * spb < horizonte) {
      const tb = offset + b * spb;
      const cuando = Math.max(this.ctx.currentTime, this.ctx.currentTime + (tb - ahora) / this.vel);
      const repetido = this._ultClick && this._ultClick.b === b && Math.abs(this._ultClick.t - cuando) < 0.12;
      if (tb >= 0 && tb <= this.duracion && !repetido) {
        this._ultClick = { b, t: cuando };
        this.click(cuando, this.tipoTiempo(b));
        for (let k = 1; k < sub; k++) this.click(cuando + k * spb / sub / this.vel, -1);
      }
      this._ultimoBeat = b; b++;
    }
  },
  click(cuando, tipo) {
    const ctx = this._asegurarCtx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    // 1 del conteo 1500 Hz · inicio de compás 1000 Hz · acento secundario 800 Hz · tiempo 600 Hz · subdivisión 450 Hz
    o.frequency.value = { 3: 1500, 2: 1000, 1: 800, 0: 600, '-1': 450 }[tipo];
    o.type = 'sine';
    const v = Math.max(0.0002, this.met.vol * { 3: 1, 2: 0.85, 1: 0.7, 0: 0.6, '-1': 0.3 }[tipo]);
    g.gain.setValueAtTime(0, cuando);
    g.gain.linearRampToValueAtTime(v, cuando + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, cuando + (tipo === -1 ? 0.03 : 0.05));
    o.connect(g).connect(ctx.destination);
    o.start(cuando); o.stop(cuando + 0.08);
    this._clicks.push({ o, t: cuando });
    if (this._clicks.length > 200) this._clicks.splice(0, 100);
  }
};

// Preferencias del metrónomo: son de cada persona, se guardan en su equipo
try { Object.assign(Motor.met, { sub: 1, acento: true, luz: true }, JSON.parse(localStorage.getItem('coreo_met') || '{}'), { on: false }); }
catch (_) { Object.assign(Motor.met, { sub: 1, acento: true, luz: true }); }
function guardarPrefsMet() {
  try { const { vol, sub, acento, luz } = Motor.met; localStorage.setItem('coreo_met', JSON.stringify({ vol, sub, acento, luz })); } catch (_) {}
}

function mod(a, n) { return ((a % n) + n) % n; }

/* ── Análisis de la pista (se hace una sola vez, en el equipo del coreógrafo) ── */
async function analizarPista(file) {
  const ctx = Motor._asegurarCtx();
  const buf = await ctx.decodeAudioData(await file.arrayBuffer());
  const t = detectarTempo(buf), c = detectarCompas(buf, t.bpm, t.offset);
  return { duracion: buf.duration, picos: calcularPicos(buf), bpm: t.bpm, offset: c.offset, medida: c.medida, seguro: c.seguro };
}

// Compás probable (3 o 4 tiempos) y en qué tiempo cae el 1: busca cada cuántos tiempos
// se repite el golpe de bajo más fuerte. Es una sugerencia; siempre se puede cambiar.
function detectarCompas(buf, bpm, offset) {
  const sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
  const lim = Math.min(L.length, sr * 150), hop = Math.round(sr / 100), n = Math.floor(lim / hop);
  const a = 1 - Math.exp(-2 * Math.PI * 150 / sr);       // filtro de bajos (~150 Hz)
  const bajo = new Float32Array(n), total = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < n; i++) {
    let eb = 0, et = 0; const ini = i * hop;
    for (let j = 0; j < hop; j++) {
      const x = R ? (L[ini + j] + R[ini + j]) * 0.5 : L[ini + j];
      y += a * (x - y); eb += y * y; et += x * x;
    }
    bajo[i] = Math.log(1 + 1000 * eb / hop); total[i] = Math.log(1 + 1000 * et / hop);
  }
  // Fuerza de cada tiempo: pico de bajo y de volumen justo en el golpe, menos lo que sonaba antes
  const spb = 60 / bpm, fb = [], ft = [];
  for (let k = 0; ; k++) {
    const c = Math.round((offset + k * spb) * 100);
    if (c + 10 >= n) break;
    if (c < 12) { fb.push(NaN); ft.push(NaN); continue; }
    let pb = 0, pt = 0, mb = 0, mt = 0;
    for (let i = c - 2; i <= c + 8; i++) { if (bajo[i] > pb) pb = bajo[i]; if (total[i] > pt) pt = total[i]; }
    for (let i = c - 12; i < c - 3; i++) { mb += bajo[i]; mt += total[i]; }
    fb.push(pb * 0.7 + (pb - mb / 9) * 0.3); ft.push(pt - mt / 9);
  }
  const z = v => {
    const ok = v.filter(x => !isNaN(x)), m = ok.reduce((s, x) => s + x, 0) / (ok.length || 1);
    const sd = Math.sqrt(ok.reduce((s, x) => s + (x - m) * (x - m), 0) / (ok.length || 1)) || 1;
    return v.map(x => (x - m) / sd);
  };
  const zb = z(fb), zt = z(ft), f = zb.map((v, i) => v + 0.5 * zt[i]);
  const puntaje = m => {
    let mejor = -Infinity, fase = 0;
    for (let p = 0; p < m; p++) {
      let s = 0, k = 0;
      for (let i = p; i < f.length; i += m) if (!isNaN(f[i])) { s += f[i]; k++; }
      s = k ? s / k : -Infinity;
      if (s > mejor) { mejor = s; fase = p; }
    }
    return { s: mejor, fase };
  };
  const p3 = puntaje(3), p4 = puntaje(4);
  const tres = p3.s > p4.s * 1.2 && p3.s > 0.3;
  const elegido = tres ? p3 : p4, otro = tres ? p4 : p3;
  return {
    medida: tres ? 3 : 4,
    offset: Math.round((offset + elegido.fase * spb) * 1000) / 1000,
    seguro: elegido.s > 0.35 && elegido.s > otro.s * 1.5
  };
}

// Forma de onda: ~20 valores por segundo, enteros 0–100 (ligero para guardar en la nube)
function calcularPicos(buf) {
  const n = Math.min(6000, Math.max(200, Math.round(buf.duration * 20)));
  const ch = [buf.getChannelData(0), buf.numberOfChannels > 1 ? buf.getChannelData(1) : null];
  const tam = Math.floor(ch[0].length / n);
  const picos = new Array(n);
  let max = 0;
  for (let i = 0; i < n; i++) {
    let m = 0; const ini = i * tam;
    for (let j = 0; j < tam; j += 4) {
      const v = Math.abs(ch[0][ini + j]) + (ch[1] ? Math.abs(ch[1][ini + j]) : 0);
      if (v > m) m = v;
    }
    picos[i] = m; if (m > max) max = m;
  }
  return picos.map(v => Math.round(v / (max || 1) * 100));
}

// Tempo por autocorrelación de la envolvente de ataques + fase del primer tiempo
function detectarTempo(buf) {
  const sr = buf.sampleRate, d = buf.getChannelData(0);
  const hop = Math.round(sr / 100);                // cuadros de 10 ms
  const limite = Math.min(d.length, sr * 150);       // los primeros 2:30 bastan
  const n = Math.floor(limite / hop);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let e = 0; const ini = i * hop;
    for (let j = 0; j < hop; j += 2) e += d[ini + j] * d[ini + j];
    env[i] = Math.log(1 + 1000 * e / hop);
  }
  const on = new Float32Array(n);
  for (let i = 1; i < n; i++) on[i] = Math.max(0, env[i] - env[i - 1]);
  // quitar la media local (realza los golpes)
  const w = 25; let acc = 0; const media = new Float32Array(n);
  for (let i = 0; i < n; i++) { acc += on[i]; if (i >= w) acc -= on[i - w]; media[i] = acc / Math.min(i + 1, w); }
  for (let i = 0; i < n; i++) on[i] = Math.max(0, on[i] - media[i]);

  const val = x => { const i = Math.floor(x), f = x - i; return i + 1 < n ? on[i] * (1 - f) + on[i + 1] * f : 0; };
  let mejor = 120, mejorS = -1;
  for (let bpm = 60; bpm <= 200; bpm += 0.25) {
    const P = 6000 / bpm; let s = 0;
    for (let i = 0; i + 2 * P < n; i++) if (on[i]) s += on[i] * (val(i + P) + 0.5 * val(i + 2 * P));
    const oct = Math.log2(bpm / 115);
    s *= Math.exp(-oct * oct / (2 * 0.6 * 0.6));     // preferencia suave por tempos de baile (~115)
    if (s > mejorS) { mejorS = s; mejor = bpm; }
  }
  // Afinado: "peine" de tiempos sobre toda la pista (tempo y fase a la vez).
  // Se suaviza la envolvente para que los golpes no caigan entre cuadros.
  const sv = new Float32Array(n);
  for (let i = 2; i < n - 2; i++) sv[i] = (on[i - 2] + 2 * on[i - 1] + 3 * on[i] + 2 * on[i + 1] + on[i + 2]) / 9;
  const vs = x => { const i = Math.floor(x), f = x - i; return i + 1 < n ? sv[i] * (1 - f) + sv[i + 1] * f : 0; };
  const grueso = mejor; let fase = 0, mejorC = -1;
  for (let bpm = grueso - 0.6; bpm <= grueso + 0.6; bpm += 0.01) {
    const P = 6000 / bpm;
    for (let f = 0; f < P; f += 0.25) {
      let s = 0, k = 0; for (let x = f; x < n; x += P) { s += vs(x); k++; }
      s /= k;
      if (s > mejorC) { mejorC = s; mejor = bpm; fase = f; }
    }
  }
  return { bpm: Math.round(mejor * 100) / 100, offset: Math.round(fase * hop / sr * 1000) / 1000 };
}

/* ── Sincronizar el video con la canción escuchando su audio ──
   Se compara la "envolvente de ataques" (dónde suenan los golpes) de la canción y del
   audio del video. Correlación por FFT para el punto global y luego por ventanas de 20 s
   para detectar si el video va a otra velocidad (ritmo) o tiene cortes.
   Resultado: tiempoCanción = offset + ritmo × tiempoVideo. */
function envolventeAtaques(buf, maxSeg) {
  const sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
  const hop = Math.round(sr / 100), n = Math.floor(Math.min(L.length, sr * maxSeg) / hop);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let e = 0; const ini = i * hop;
    for (let j = 0; j < hop; j += 2) { const x = R ? (L[ini + j] + R[ini + j]) * 0.5 : L[ini + j]; e += x * x; }
    env[i] = Math.log(1e-6 + e / hop);
  }
  const on = new Float32Array(n);
  for (let i = 1; i < n; i++) on[i] = Math.max(0, env[i] - env[i - 1]);
  // quitar la media local y normalizar (así el ruido de la sala pesa menos)
  const w = 30; let acc = 0; const out = new Float32Array(n);
  for (let i = 0; i < n; i++) { acc += on[i]; if (i >= w) acc -= on[i - w]; out[i] = Math.max(0, on[i] - acc / Math.min(i + 1, w)); }
  let m = 0; for (let i = 0; i < n; i++) m += out[i]; m /= n || 1;
  let v = 0; for (let i = 0; i < n; i++) { out[i] -= m; v += out[i] * out[i]; }
  const sd = Math.sqrt(v / (n || 1)) || 1;
  for (let i = 0; i < n; i++) out[i] /= sd;
  return out;
}
function _fft(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = 2 * Math.PI / len * (inv ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
// r[L] = Σ a[i+L]·b[i]  para L en [-(b.length-1), a.length-1]
function _correlacion(a, b) {
  let N = 1; while (N < a.length + b.length) N <<= 1;
  const ar = new Float64Array(N), ai = new Float64Array(N), br = new Float64Array(N), bi = new Float64Array(N);
  ar.set(a); br.set(b);
  _fft(ar, ai, false); _fft(br, bi, false);
  for (let i = 0; i < N; i++) { const r = ar[i] * br[i] + ai[i] * bi[i], im = ai[i] * br[i] - ar[i] * bi[i]; ar[i] = r; ai[i] = im; }
  _fft(ar, ai, true);
  return { r: ar, N, en: L => ar[((L % N) + N) % N] };
}
function _picoFino(f, L) {   // interpolación parabólica alrededor del máximo
  const y0 = f(L - 1), y1 = f(L), y2 = f(L + 1), d = y0 - 2 * y1 + y2;
  return d < 0 ? L + 0.5 * (y0 - y2) / d : L;
}
// Video "estirado" a la escala de tiempo de la canción: b'[k] = b(k / ritmo)
function _estirar(b, ritmo) {
  if (ritmo === 1) return b;
  const n = Math.floor(b.length * ritmo), out = new Float32Array(n);
  for (let k = 0; k < n; k++) { const x = k / ritmo, i = Math.floor(x), f = x - i; out[k] = i + 1 < b.length ? b[i] * (1 - f) + b[i + 1] * f : b[b.length - 1]; }
  return out;
}
function _mejorPico(a, b) {
  const C = _correlacion(a, b);
  const solape = L => Math.max(1, Math.min(a.length, L + b.length) - Math.max(0, L));
  const minSol = Math.min(1000, Math.floor(Math.min(a.length, b.length) * 0.5));   // al menos 10 s en común
  let L0 = 0, mejor = -Infinity;
  for (let L = -(b.length - 1); L < a.length; L++) {
    if (solape(L) < minSol) continue;
    const v = C.en(L) / solape(L); if (v > mejor) { mejor = v; L0 = L; }
  }
  let segundo = -Infinity;
  for (let L = -(b.length - 1); L < a.length; L++) {
    if (solape(L) < minSol || Math.abs(L - L0) < 60) continue;   // otro pico a más de 0,6 s
    const v = C.en(L) / solape(L); if (v > segundo) segundo = v;
  }
  return { L0, mejor, segundo, fino: _picoFino(L => C.en(L) / solape(L), L0) };
}
function alinearAudios(bufCancion, bufVideo) {
  const H = 0.01;
  const a = envolventeAtaques(bufCancion, 900), b = envolventeAtaques(bufVideo, 900);
  if (a.length < 300 || b.length < 300) return { seguridad: 'baja', motivo: 'corto' };
  // 1) velocidad y punto global: se prueba el video a 80 %…120 % de velocidad
  let g = null, rho = 1;
  for (let r = 0.80; r <= 1.2001; r += 0.01) {
    const rr = Math.round(r * 100) / 100, p = _mejorPico(a, _estirar(b, rr));
    if (!g || p.mejor > g.mejor * (rr === 1 ? 0.97 : 1)) { g = p; rho = rr; }   // ante empate, velocidad normal
  }
  if (rho !== 1) {   // afinar la velocidad de a 0,1 %
    for (let r = rho - 0.009; r <= rho + 0.0091; r += 0.001) {
      const rr = Math.round(r * 1000) / 1000, p = _mejorPico(a, _estirar(b, rr));
      if (p.mejor > g.mejor) { g = p; rho = rr; }
    }
  }
  const bs = _estirar(b, rho);
  // 2) ventanas de 20 s: confirma el punto, detecta pequeños cambios de velocidad o cortes
  const W = 2000, PASO = 1000, BUSCA = 300, crudos = [];
  for (let s0 = 0; s0 + W <= bs.length; s0 += PASO) {
    let mb = -Infinity, ml = 0; const vals = {};
    for (let d = -BUSCA; d <= BUSCA; d++) {
      const L = g.L0 + d; let sum = 0, k = 0;
      for (let i = s0; i < s0 + W; i++) { const j = i + L; if (j >= 0 && j < a.length) { sum += a[j] * bs[i]; k++; } }
      if (k < W * 0.8) continue;
      const v = sum / k; vals[L] = v; if (v > mb) { mb = v; ml = L; }
    }
    if (!isFinite(mb)) continue;
    const f = L => vals[L] ?? -Infinity, fino = isFinite(f(ml - 1)) && isFinite(f(ml + 1)) ? _picoFino(f, ml) : ml;
    crudos.push({ x: (s0 + W / 2) * H / rho, y: (s0 + W / 2 + fino) * H, q: mb });   // x: tiempo del video · y: tiempo de la canción
  }
  const qs = crudos.map(p => p.q).sort((u, v) => u - v), qMed = qs.length ? qs[Math.floor(qs.length / 2)] : 0;
  const puntos = crudos.filter(p => p.q > Math.max(0.15, qMed * 0.5));   // fuera ventanas con silencio, aplausos, etc.
  let ritmo = rho, offset = g.fino * H, cortes = false;
  const ajustar = ps => {
    const n = ps.length, mx = ps.reduce((s, p) => s + p.x, 0) / n, my = ps.reduce((s, p) => s + p.y, 0) / n;
    let sxy = 0, sxx = 0; for (const p of ps) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; }
    const pend = sxx ? sxy / sxx : rho; return { pend, off: my - pend * mx };
  };
  if (puntos.length >= 3) {
    let f1 = ajustar(puntos);
    const buenos = puntos.filter(p => Math.abs(p.y - (f1.off + f1.pend * p.x)) < 0.15);
    if (buenos.length >= 3) f1 = ajustar(buenos);
    cortes = buenos.length < puntos.length * 0.7;
    if (Math.abs(f1.pend - 1) < 0.004) {   // misma velocidad: desfase = mediana
      ritmo = 1; const ds = (buenos.length >= 3 ? buenos : puntos).map(p => p.y - p.x).sort((u, v) => u - v); offset = ds[Math.floor(ds.length / 2)];
    } else if (Math.abs(f1.pend - rho) < 0.02) { ritmo = f1.pend; offset = f1.off; }
  }
  const relacion = g.segundo > 0 ? g.mejor / g.segundo : 9;
  const seguridad = g.mejor > 0.3 && relacion > 1.4 ? 'alta' : g.mejor > 0.15 && relacion > 1.15 ? 'media' : 'baja';
  return { offset: Math.round(offset * 1000) / 1000, ritmo: Math.round(ritmo * 10000) / 10000, seguridad, r: Math.round(g.mejor * 100) / 100, relacion: Math.round(relacion * 100) / 100, ventanas: puntos.length, cortes };
}

/* ── Tap tempo ── */
const Tap = {
  toques: [],
  tocar() {
    const t = performance.now();
    if (this.toques.length && t - this.toques[this.toques.length - 1] > 2000) this.toques = [];
    this.toques.push(t); if (this.toques.length > 9) this.toques.shift();
    if (this.toques.length < 3) return null;
    const dif = []; for (let i = 1; i < this.toques.length; i++) dif.push(this.toques[i] - this.toques[i - 1]);
    const prom = dif.reduce((a, b) => a + b, 0) / dif.length;
    return Math.round(60000 / prom * 10) / 10;
  }
};
