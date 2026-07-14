/* ═══════════════════════════════════════════════════════════
   asistencias.js
   Asistencias, días extra y ranking mensual
   Academia de Danzas Lazos Tricolor — Soacha, Cundinamarca
═══════════════════════════════════════════════════════════ */

// ===================== ASISTENCIAS =====================
function getDiasClaseMes(alumna,mk){
  const [y,m]=mk.split('-').map(Number);
  const diasSemana=DIAS_CLASE[alumna.categoria]||[];
  // Normalizar extraDias — soporta formato legacy (string[]) y nuevo ({fecha,cats}[])
  const rawExtras=DB.extraDias[mk]||[];
  const extrasFiltrados=rawExtras
    .filter(e=>{
      if(typeof e==='string') return true; // legacy: aplica a todos
      return !e.cats||e.cats.includes(alumna.categoria||''); // nuevo: filtrar por cat
    })
    .map(e=>typeof e==='string'?e:e.fecha);
  const dias=[];
  const ultimo=new Date(y,m,0).getDate();
  for(let d=1;d<=ultimo;d++){
    const fecha=new Date(y,m-1,d);
    const ds=dateStr(fecha);
    if(diasSemana.includes(fecha.getDay())||extrasFiltrados.includes(ds)) dias.push(ds);
  }
  return dias;
}
function renderAsistencias(){
  const mk=mesSec.asist;
  document.getElementById('asist-mes-label').textContent=mesLabel(mk);
  const activas=getAlumnasMes(mk);
  if(!activas.length){
    document.getElementById('asist-content').innerHTML='<p style="color:var(--muted);text-align:center;padding:40px">Sin alumnas en este período</p>';
    const ac=document.getElementById('asist-charts'); if(ac) ac.innerHTML='';
    const ar=document.getElementById('asist-ranking'); if(ar) ar.innerHTML='';
    return;
  }
  // ── Ranking top 3 por categoría ──
  generarRanking(mk);

  // ── Gráfico de asistencia ──
  {
    let totPres=0,totDias=0;
    const catPres={Infantil:0,Juvenil:0,Adulto:0,'Adulto Mayor':0};
    const catTot={Infantil:0,Juvenil:0,Adulto:0,'Adulto Mayor':0};
    activas.forEach(a=>{
      getDiasClaseMes(a,mk).forEach(d=>{
        catTot[a.categoria]=(catTot[a.categoria]||0)+1; totDias++;
        if(DB.asistencias[a.id]&&DB.asistencias[a.id][d]==='P'){catPres[a.categoria]=(catPres[a.categoria]||0)+1;totPres++;}
      });
    });
    const pctG=totDias?Math.round(totPres/totDias*100):0;
    const pctsCat=[catTot.Infantil,catTot.Juvenil,catTot.Adulto,catTot['Adulto Mayor']].map((t,i)=>{
      const keys=['Infantil','Juvenil','Adulto','Adulto Mayor'];
      return t?Math.round((catPres[keys[i]]||0)/t*100):0;
    });
    const chartAsist=document.getElementById('asist-charts');
    if(chartAsist){
      ['ch-asist-bar','ch-asist-donut'].forEach(id=>{const el=document.getElementById(id);if(el&&el._ch){el._ch.destroy();el._ch=null;}});
      chartAsist.innerHTML=`
        <div class="chart-card" style="flex:1;min-width:220px">
          <h4>% Asistencia por categoría — ${mesLabel(mk)}</h4>
          <canvas id="ch-asist-bar" style="max-height:180px"></canvas>
        </div>
        <div class="chart-card" style="flex:1;min-width:180px;text-align:center">
          <h4>Asistencia general</h4>
          <div style="position:relative;width:120px;height:120px;margin:8px auto">
            <canvas id="ch-asist-donut"></canvas>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
              <span style="font-size:24px;font-weight:800;color:var(--primary)">${pctG}%</span>
              <span style="font-size:10px;color:var(--text2)">general</span>
            </div>
          </div>
          <p style="font-size:12px;color:var(--text2)">${totPres}/${totDias} presencias</p>
        </div>`;
      setTimeout(()=>{
        const tc='#8a92a6',gc='rgba(0,0,0,.06)';
        const elB=document.getElementById('ch-asist-bar');
        if(elB) elB._ch=new Chart(elB,{type:'bar',
          data:{labels:['Infantil','Juvenil','Adulto','Ad.Mayor'],
            datasets:[{label:'%',data:pctsCat,backgroundColor:['rgba(214,0,106,.75)','rgba(26,153,0,.75)','rgba(201,80,0,.75)','rgba(0,119,182,.75)'],borderRadius:4}]},
          options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
            scales:{x:{ticks:{color:tc,font:{size:9}},grid:{color:gc}},y:{ticks:{color:tc,font:{size:9}},grid:{color:gc},beginAtZero:true,max:100}}}
        });
        const elD=document.getElementById('ch-asist-donut');
        if(elD) elD._ch=new Chart(elD,{type:'doughnut',
          data:{datasets:[{data:[pctG,100-pctG],backgroundColor:['#3a57e8','#eef0fd'],borderWidth:0}]},
          options:{cutout:'75%',plugins:{legend:{display:false},tooltip:{enabled:false}}}
        });
      },80);
    }
  }

  // Agrupar por categoría
  let html='';
  const catColors={Infantil:'var(--inf)',Juvenil:'var(--juv)',Adulto:'var(--adu)','Adulto Mayor':'var(--adum)'};
  CATS.forEach(cat=>{
    const grupo=activas.filter(a=>a.categoria===cat);
    if(!grupo.length) return;
    const diasCat=getDiasClaseMes({categoria:cat},mk);
    const extras=DB.extraDias[mk]||[];
    html+=`<div class="table-card" style="margin-bottom:16px">
      <div class="table-card-header" style="border-left:3px solid ${catColors[cat]}">
        <h3>${cat} <span style="color:var(--muted);font-weight:400">(${grupo.length})</span></h3>
        <small style="color:var(--muted);font-size:11px">Días de clase: ${diasCat.length}</small>
      </div>
      <div style="overflow-x:auto">
        <table class="asist-table">
          <thead><tr>
            <th style="min-width:140px;text-align:left">Alumna</th>
            ${diasCat.map(d=>{
              const dd=new Date(d+'T12:00:00');
              const esExtra=(DB.extraDias[mk]||[]).some(e=>(typeof e==='string'?e:e.fecha)===d);
              return`<th title="${d}">${dd.getDate()}<br><span style="font-size:9px">${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][dd.getDay()]}</span>${esExtra?'<br>⭐':''}</th>`;
            }).join('')}
            <th>P</th><th>A</th><th>%</th>
          </tr></thead>
          <tbody>${grupo.map(a=>{
            let pres=0,aus=0;
            const celdas=diasCat.map(d=>{
              const est=DB.asistencias[a.id]&&DB.asistencias[a.id][d];
              if(est==='P') pres++;
              if(est==='A') aus++;
              const cls=est==='P'?'pres':est==='A'?'ause':'';
              const emoji=est==='P'?'✅':est==='A'?'❌':'·';
              return`<td><button class="asist-cell ${cls}" data-aid="${a.id}" data-fecha="${d}" onclick="toggleAsistencia(${a.id},'${d}')">${emoji}</button></td>`;
            }).join('');
            const total=diasCat.length, pct=total?Math.round(pres/total*100):0;
            return`<tr>
              <td style="font-size:12px;font-weight:500">${a.nombre.split(' ').slice(0,2).join(' ')}</td>
              ${celdas}
              <td style="color:var(--paid);font-weight:700;font-size:12px">${pres}</td>
              <td style="color:var(--unpaid);font-size:12px">${aus}</td>
              <td style="font-size:12px;font-weight:600;color:${pct>=80?'var(--paid)':pct>=50?'var(--col)':'var(--unpaid)'}">${pct}%</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  });
  document.getElementById('asist-content').innerHTML=html;
}
function toggleAsistencia(alumnaId,fecha){
  if(!DB.asistencias[alumnaId]) DB.asistencias[alumnaId]={};
  const actual=DB.asistencias[alumnaId][fecha];
  if(!actual) DB.asistencias[alumnaId][fecha]='P';
  else if(actual==='P') DB.asistencias[alumnaId][fecha]='A';
  else delete DB.asistencias[alumnaId][fecha];
  // Guardar versión sin re-renderizar ni disparar polling
  _localVersion = Date.now();
  tsSeccion('asistencias');
  DB._ts_asistencias = Date.now(); // forzar timestamp explícito en Firebase
  snapLocal();
  encolarGuardado();
  _fbSave(DB).then(ok=>{
    if(ok){ desencolarGuardado(); _ultimoGuardado=Date.now(); }
    else programarReintento();
  });
  // Re-renderizar solo los botones de asistencia, no toda la sección
  actualizarBotonesAsistencia(alumnaId, fecha);
}

function actualizarBotonesAsistencia(alumnaId, fecha){
  const estado = DB.asistencias[alumnaId] ? DB.asistencias[alumnaId][fecha] : undefined;
  const emoji = estado==='P' ? '✅' : estado==='A' ? '❌' : '·';
  const cls   = estado==='P' ? 'pres' : estado==='A' ? 'ause' : '';
  const btn = document.querySelector('button[data-aid="'+alumnaId+'"][data-fecha="'+fecha+'"]');
  if(btn){
    btn.textContent = emoji;
    btn.className = 'asist-cell ' + cls;
  } else {
    renderAsistencias();
  }
}
function todasPresentes(){
  const mk=mesSec.asist;
  const hoy=dateStr(getHoyReal());
  const activas=getAlumnasMes(mk);
  activas.forEach(a=>{
    const diasCat=getDiasClaseMes(a,mk);
    if(diasCat.includes(hoy)){
      if(!DB.asistencias[a.id]) DB.asistencias[a.id]={};
      DB.asistencias[a.id][hoy]='P';
    }
  });
  saveAll(); renderAsistencias(); toast('Asistencia registrada ✓');
}
function agregarDiaExtra(){
  // Pre-llenar con el mes activo
  const mk = mesSec.asist;
  const [y,m] = mk.split('-');
  document.getElementById('extra-fecha').value = mk+'-01';
  document.getElementById('extra-cats').querySelectorAll('input[type=checkbox]')
    .forEach(cb=>cb.checked=true); // todas marcadas por defecto
  abrirModal('modal-dia-extra');
}

function guardarDiaExtra(){
  const fecha = document.getElementById('extra-fecha').value;
  if(!fecha){ toast('Selecciona una fecha','err'); return; }
  const cats = [...document.getElementById('extra-cats')
    .querySelectorAll('input[type=checkbox]:checked')]
    .map(cb=>cb.value);
  if(!cats.length){ toast('Selecciona al menos una categoría','err'); return; }
  const mk = fecha.substring(0,7);
  if(!DB.extraDias) DB.extraDias={};
  // Nuevo formato: extraDias[mk] = [ {fecha, cats:[...]} ] o string legacy
  // Migrar si es array legacy de strings
  if(Array.isArray(DB.extraDias[mk]) && DB.extraDias[mk].length>0 && typeof DB.extraDias[mk][0]==='string'){
    DB.extraDias[mk] = DB.extraDias[mk].map(f=>({fecha:f, cats:['Infantil','Juvenil','Adulto','Adulto Mayor']}));
  }
  if(!Array.isArray(DB.extraDias[mk])) DB.extraDias[mk]=[];
  // Quitar si ya existe esa fecha para esas categorías y reemplazar
  DB.extraDias[mk] = DB.extraDias[mk].filter(e=>(e.fecha||e)!==fecha);
  DB.extraDias[mk].push({fecha, cats});
  tsSeccion('extraDias');
  DB._ts_extraDias = Date.now();
  snapLocal();
  cerrarModal('modal-dia-extra');
  renderAsistencias();
  toast('⏳ Guardando día extra...');
  _fbSave(DB).then(function(ok){
    if(ok){ desencolarGuardado(); _ultimoGuardado=Date.now(); toast('✅ Día extra guardado — '+cats.join(', ')); }
    else { encolarGuardado(); programarReintento(); toast('⚠️ Guardado local — reintentando...','info'); }
  });
}

// ===================== RANKING ASISTENCIAS =====================
const MENSAJES_RANK = [
  function(top,mes){ return '🌟 *¡Reconocimiento de Asistencia — '+mes+'!* 🌟\n\n¡Qué mes tan hermoso ha sido este! Celebramos con orgullo a quienes brillaron con su constancia y dedicación.\n\n'+top+'\n\n✨ A quienes no aparecen en este reconocimiento: ¡su momento llegará! Cada clase que no vienen es una oportunidad de crecer que se escapa. La danza nos enseña que la disciplina es el camino más bonito hacia los sueños. Los esperamos con los brazos abiertos. 💃🕺\n\n#LazosTricol or #DanzaConAmor #Soacha'; },
  function(top,mes){ return '🏆 *Estrellas de Asistencia — '+mes+'* 🏆\n\nLa Academia de Danzas Lazos Tricolor celebra a sus alumnas más comprometidas este mes:\n\n'+top+'\n\n💛 Para el resto de nuestra familia artística: cada paso cuenta, cada clase suma. La danza no espera, ¡nosotros sí los esperamos! Vengan, que aquí siempre hay un lugar para ustedes. Con cariño y disciplina se construyen grandes bailarines. 🎶\n\n#RecordDeAsistencia #LazosTricol or'; },
  function(top,mes){ return '💃 *¡Aplausos para nuestras alumnas del mes de '+mes+'!* 💃\n\nLa constancia tiene nombre y apellido:\n\n'+top+'\n\n🌺 Y a todas las demás: el arte de la danza se construye día a día, ensayo a ensayo. No dejen que la rutina les robe el ritmo. Cada vez que llegan a clase, invierten en su talento. Los queremos y los esperamos. ¡Juntos somos más fuertes! 💪\n\n#Comprometidas #AcademiaDeDanzas #Soacha'; },
  function(top,mes){ return '🎭 *¡Reconocemos la entrega de nuestras alumnas — '+mes+'!* 🎭\n\nEste mes, estas estrellas demostraron que la disciplina es el mejor ritmo:\n\n'+top+'\n\n🌸 A quienes todavía están encontrando su camino: la danza nos enseña que caer y levantarse también es parte del baile. No se rindan, el escenario los espera. Con amor y perseverancia, todo es posible en nuestra academia. ¡Los necesitamos a todos! ❤️\n\n#DanzaYVida #LazosTricol or #Perseverancia'; },
];

function generarRanking(mk){
  const CATS=['Infantil','Juvenil','Adulto','Adulto Mayor'];
  const activas=getAlumnasMes(mk);
  if(!activas.length){ var ar=document.getElementById('asist-ranking'); if(ar) ar.innerHTML=''; return; }

  const stats=activas.map(function(a){
    var dias=getDiasClaseMes(a,mk);
    var pres=dias.filter(function(d){return DB.asistencias[a.id]&&DB.asistencias[a.id][d]==='P';}).length;
    return {id:a.id,nombre:a.nombre,categoria:a.categoria,pres:pres,total:dias.length,
      pct:dias.length?Math.round(pres/dias.length*100):0};
  }).filter(function(a){return a.total>0;});

  var rankingPorCat={};
  CATS.forEach(function(cat){
    rankingPorCat[cat]=stats.filter(function(a){return a.categoria===cat;})
      .sort(function(a,b){return b.pct-a.pct||b.pres-a.pres;}).slice(0,3);
  });

  var catColores={Infantil:'#d6006a',Juvenil:'#1a9900',Adulto:'#c95000','Adulto Mayor':'#0077b6'};
  var catIconos={Infantil:'💃',Juvenil:'🎭',Adulto:'🌟','Adulto Mayor':'⭐'};
  var medallas=['🥇','🥈','🥉'];
  var mesNom=mesLabel(mk);

  // Texto para el mensaje
  var topTexto='';
  CATS.forEach(function(cat){
    var top=rankingPorCat[cat];
    if(!top.length) return;
    topTexto+='*'+cat+':*\n';
    top.forEach(function(a,i){ topTexto+='  '+medallas[i]+' '+a.nombre+' — '+a.pct+'% ('+a.pres+'/'+a.total+' clases)\n'; });
    topTexto+='\n';
  });

  var msgIdx=parseInt(mk.replace('-',''))%MENSAJES_RANK.length;
  var mensaje=MENSAJES_RANK[msgIdx](topTexto.trim(),mesNom);

  // Tarjetas por categoría
  var catConDatos=CATS.filter(function(c){return rankingPorCat[c].length>0;});
  var tarjetas='';
  catConDatos.forEach(function(cat){
    var top=rankingPorCat[cat];
    var color=catColores[cat];
    var filas='';
    top.forEach(function(a,i){
      var barWidth=a.pct;
      filas+='<div class="ranking-row">'
        +'<span class="ranking-medal">'+medallas[i]+'</span>'
        +'<span class="ranking-nombre">'+a.nombre.split(' ').slice(0,2).join(' ')+'</span>'
        +'<div class="ranking-bar-wrap"><div class="ranking-bar" style="width:'+barWidth+'%;background:'+color+'"></div></div>'
        +'<span class="ranking-pct" style="color:'+color+'">'+a.pct+'%</span>'
        +'</div>';
    });
    tarjetas+='<div style="background:var(--card2);border-radius:12px;padding:14px">'
      +'<div class="ranking-cat-title" style="color:'+color+'">'+catIconos[cat]+' '+cat+'</div>'
      +filas
      +'</div>';
  });

  var html='<div class="ranking-card">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">'
      +'<div style="font-size:15px;font-weight:800">🏆 Ranking de Asistencia — '+mesNom+'</div>'
      +'<button class="ranking-copy-btn" onclick="copiarMensajeRanking()">📋 Copiar mensaje</button>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px;margin-bottom:16px">'+tarjetas+'</div>'
    +'<div class="ranking-msg-box" id="ranking-mensaje">'+mensaje+'</div>'
    +'</div>';

  var ar=document.getElementById('asist-ranking');
  if(ar) ar.innerHTML=html;
}

function copiarMensajeRanking(){
  var box=document.getElementById('ranking-mensaje');
  if(!box) return;
  var texto=box.textContent||box.innerText;
  if(navigator.clipboard){
    navigator.clipboard.writeText(texto).then(function(){ toast('📋 Mensaje copiado ✓'); })
    .catch(function(){ _copiarFallback(texto); });
  } else { _copiarFallback(texto); }
}
function _copiarFallback(texto){
  var ta=document.createElement('textarea');
  ta.value=texto; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); toast('📋 Mensaje copiado ✓'); }
  catch(e){ toast('No se pudo copiar','err'); }
  document.body.removeChild(ta);
}
