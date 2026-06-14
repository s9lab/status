const cfg = window.S9LAB_STATUS_CONFIG || {};
const els = {
  overallCard: document.getElementById('overallCard'), overallTitle: document.getElementById('overallTitle'),
  overallDescription: document.getElementById('overallDescription'), lastUpdated: document.getElementById('lastUpdated'),
  availability: document.getElementById('availabilityValue'), serviceList: document.getElementById('serviceList'),
  historyGrid: document.getElementById('historyGrid'), incidentList: document.getElementById('incidentList'),
  refreshButton: document.getElementById('refreshButton')
};
const labels = { operational:'Operational', degraded:'Beeinträchtigt', outage:'Ausfall', unknown:'Unbekannt' };
const overallCopy = {
  operational:['Alle Systeme funktionieren','Alle überwachten S9Lab-Dienste sind erreichbar.'],
  degraded:['Teilweise Beeinträchtigung','Mindestens ein Dienst reagiert langsam oder fehlerhaft.'],
  outage:['Aktiver Ausfall','Mindestens ein zentraler Dienst ist aktuell nicht erreichbar.'],
  unknown:['Status unbekannt','Es liegen noch keine aktuellen Prüfdaten vor.']
};
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function fmtDate(v){if(!v)return '–'; const d=new Date(v); return Number.isNaN(d.getTime())?'–':new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short'}).format(d);}
function normalizeStatus(v){return ['operational','degraded','outage'].includes(v)?v:'unknown';}
function renderStatus(data){const status=normalizeStatus(data.overall); els.overallCard.className=`overall-card status-${status}`; els.overallTitle.textContent=overallCopy[status][0]; els.overallDescription.textContent=overallCopy[status][1]; els.lastUpdated.textContent=`Letzte Prüfung: ${fmtDate(data.generatedAt)}`; const valid=(data.history||[]).filter(x=>x.status&&x.status!=='unknown'); const up=valid.filter(x=>x.status==='operational').length; els.availability.textContent=valid.length?`${((up/valid.length)*100).toFixed(2)}%`:'–'; els.serviceList.innerHTML=(data.services||[]).map(s=>{const st=normalizeStatus(s.status);return `<article class="service-row"><div><span class="service-name">${esc(s.name)}</span><span class="service-message">${esc(s.message||'Keine Details')}</span></div><span class="latency">${Number.isFinite(s.latencyMs)?`${s.latencyMs} ms`:'–'}</span><span class="badge ${st}">${labels[st]}</span></article>`}).join('')||'<div class="empty-state">Keine Dienste konfiguriert.</div>'; renderHistory(data.history||[]);}
function renderHistory(history){const byDate=new Map(history.map(x=>[x.date,x])); const days=[]; for(let i=29;i>=0;i--){const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i); const key=d.toISOString().slice(0,10); const item=byDate.get(key); const st=item?normalizeStatus(item.status):'unknown'; days.push(`<div class="history-day ${st==='operational'?'up':st==='outage'?'down':st==='degraded'?'degraded':''}" data-label="${esc(new Intl.DateTimeFormat('de-DE',{dateStyle:'medium'}).format(d))}: ${labels[st]}"></div>`);} els.historyGrid.innerHTML=days.join('');}
function renderIncidents(data){const incidents=data.incidents||[]; if(!incidents.length){els.incidentList.innerHTML='<div class="empty-state">In der dokumentierten Historie wurden keine Ausfälle erkannt.</div>';return;} els.incidentList.innerHTML=incidents.slice().reverse().map(i=>`<article class="incident ${i.resolvedAt?'resolved':'active'}"><div class="incident-head"><div><h3>${esc(i.title)}</h3><p>${esc(i.message||'Automatisch erkannter Dienststatus.')}</p></div><time>${fmtDate(i.startedAt)}</time></div><p style="margin-top:12px">${i.resolvedAt?`Behoben: ${fmtDate(i.resolvedAt)}`:'Status: Wird untersucht'}</p></article>`).join('');}
async function load(){els.refreshButton.disabled=true; try{const stamp=Date.now(); const [s,i]=await Promise.all([fetch(`data/status.json?v=${stamp}`,{cache:'no-store'}),fetch(`data/incidents.json?v=${stamp}`,{cache:'no-store'})]); if(!s.ok||!i.ok)throw new Error('Statusdateien konnten nicht geladen werden'); renderStatus(await s.json()); renderIncidents(await i.json());}catch(e){renderStatus({overall:'unknown',services:[],history:[]}); els.overallDescription.textContent=e.message;}finally{els.refreshButton.disabled=false;}}
document.title=cfg.pageTitle||'S9Lab Status'; document.getElementById('year').textContent=new Date().getFullYear(); els.refreshButton.addEventListener('click',load); load(); setInterval(load,Number(cfg.refreshIntervalMs)||60000);
