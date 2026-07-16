import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, arrayUnion, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { firebaseConfig, QUOTES_COLLECTION, TASKS_COLLECTION } from './firebase-config.js';

const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app), db=getFirestore(app);
const $=id=>document.getElementById(id);
let all=[], devisByQuote=new Map(), activeStatus='all', acceptingId=null;
const statusLabels={nouvelle:'🟡 Nouvelle',devis_envoye:'🔵 Devis envoyé',acceptee:'🟢 Acceptée',refusee:'🔴 Refusée',archivee:'⚫ Archivée'};
const val=(o,...ks)=>{for(const k of ks){const v=o?.[k];if(v!==undefined&&v!==null&&String(v).trim()!=='')return String(v).trim()}return''};
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const normStatus=q=>{const s=String(q.status||q.statut||'nouvelle').toLowerCase().replace(/[éèê]/g,'e');if(['nouveau','new','a_analyser'].includes(s))return'nouvelle';if(['devis envoye','devis_envoyé','quote_sent'].includes(s))return'devis_envoye';if(['accepte','acceptée','accepted','assigne','assigné'].includes(s))return'acceptee';if(['refuse','refusée','cancelled','annule','annulé'].includes(s))return'refusee';if(['archive','archivé'].includes(s))return'archivee';return s||'nouvelle'};
const dateObj=v=>{if(!v)return null;if(v.toDate)return v.toDate();if(v.seconds)return new Date(v.seconds*1000);const d=new Date(v);return isNaN(d)?null:d};
const fmt=v=>{const d=dateObj(v);return d?new Intl.DateTimeFormat('fr-CA',{dateStyle:'medium',timeStyle:'short'}).format(d):'—'};
const serviceDate=q=>val(q,'date','dateSouhaitee','desiredDate');
const inventoryEntries=q=>Object.values(q?.inventory||{}).filter(x=>Number(x?.qty)>0);
const inventorySummary=q=>inventoryEntries(q).map(x=>`${Number(x.qty)} × ${x.label||'Article'}`).join(', ');
const estimateText=q=>{const e=q?.inventoryEstimate||{};return e.volumeM3?`${e.volumeM3} m³ · ${e.truck||''} · ${e.crew||''} déménageurs · ${e.duration||''}`:''};
const contactKey=q=>(val(q,'email','courriel').toLowerCase()||val(q,'phone','telephone').replace(/\D/g,'')||val(q,'name','nom').toLowerCase());

onAuthStateChanged(auth,user=>{if(!user){location.replace('login.html?required=1');return} load();});

async function load(){
  $('loadingState').hidden=false;$('errorState').hidden=true;$('emptyState').hidden=true;$('submissionsList').hidden=true;
  try{
    let snap;try{snap=await getDocs(query(collection(db,QUOTES_COLLECTION),orderBy('createdAt','desc')))}catch{snap=await getDocs(collection(db,QUOTES_COLLECTION))}
    all=snap.docs.map(d=>({id:d.id,...d.data()}));
    try{const ds=await getDocs(collection(db,'devis'));devisByQuote=new Map(ds.docs.map(d=>{const x={id:d.id,...d.data()};return[x.quoteId,x]}).filter(x=>x[0]))}catch(e){console.warn('Devis non chargés',e)}
    render();
  }catch(e){console.error(e);$('loadingState').hidden=true;$('errorState').hidden=false;$('errorState').innerHTML=`Impossible de charger les soumissions.<br><small>${esc(e.code||e.message)}</small>`}
}

function filtered(){
 const q=$('searchInput').value.trim().toLowerCase(), period=$('periodFilter').value, now=new Date(), start=new Date(now);
 if(period==='today')start.setHours(0,0,0,0);if(period==='week'){start.setDate(now.getDate()-6);start.setHours(0,0,0,0)}if(period==='month')start.setDate(1),start.setHours(0,0,0,0);
 let arr=all.filter(x=>activeStatus==='all'||normStatus(x)===activeStatus).filter(x=>{
   if(!q)return true;return [val(x,'name','nom'),val(x,'phone','telephone'),val(x,'email','courriel'),val(x,'service'),val(x,'address','depart'),val(x,'destination','adresseArrivee'),val(x,'message','details'),x.id].join(' ').toLowerCase().includes(q)
 }).filter(x=>period==='all'||((dateObj(x.createdAt)||new Date(0))>=start));
 const sort=$('sortFilter').value;
 arr.sort((a,b)=>sort==='oldest'?(dateObj(a.createdAt)-dateObj(b.createdAt)):sort==='date'?serviceDate(a).localeCompare(serviceDate(b)):sort==='name'?val(a,'name','nom').localeCompare(val(b,'name','nom')):(dateObj(b.createdAt)-dateObj(a.createdAt)));
 return arr;
}
function updateStats(){
 const counts={nouvelle:0,devis_envoye:0,acceptee:0,refusee:0,archivee:0};all.forEach(x=>counts[normStatus(x)]++);
 $('statNew').textContent=$('countNew').textContent=counts.nouvelle;$('statSent').textContent=$('countSent').textContent=counts.devis_envoye;$('statAccepted').textContent=$('countAccepted').textContent=counts.acceptee;$('statRefused').textContent=$('countRefused').textContent=counts.refusee;$('countArchived').textContent=counts.archivee;$('countAll').textContent=all.length;
}
function render(){
 updateStats();const arr=filtered();$('loadingState').hidden=true;$('emptyState').hidden=arr.length>0;$('submissionsList').hidden=arr.length===0;
 $('submissionsList').innerHTML=arr.map(card).join('');bindActions();
}
function clientHistory(q){const key=contactKey(q);if(!key)return{count:1,existing:false};const group=all.filter(x=>contactKey(x)===key);return{count:group.length,existing:group.length>1}}
function card(q){
 const s=normStatus(q),name=val(q,'name','nom')||'Client sans nom',phone=val(q,'phone','telephone'),email=val(q,'email','courriel'),service=val(q,'service')||'Service non précisé',depart=val(q,'address','depart'),dest=val(q,'destination','adresseArrivee','arrivalAddress'),d=serviceDate(q),hist=clientHistory(q),timeline=Array.isArray(q.timeline)?q.timeline:[];
 const latest=timeline[timeline.length-1];
 return `<article class="submissionCard" data-id="${q.id}"><div class="submissionCardTop"><div class="clientIdentity"><h2>${esc(name)}</h2><p>${phone?`📞 ${esc(phone)}`:''}${phone&&email?' · ':''}${email?`✉️ ${esc(email)}`:''}</p></div><span class="statusPill status-${s}">${statusLabels[s]||esc(s)}</span></div>
 <div class="submissionMeta"><span class="metaChip ${hist.existing?'clientType':''}">${hist.existing?`⭐ Client existant · ${hist.count} demandes`:'🆕 Nouveau client'}</span><span class="metaChip">🕓 Reçue ${fmt(q.createdAt)}</span><span class="metaChip">#${esc(q.id.slice(0,8).toUpperCase())}</span></div>
 <div class="submissionMainGrid"><div class="infoBox"><small>📦 Service</small><b>${esc(service)}</b></div><div class="infoBox"><small>📅 Date souhaitée</small><b>${esc(d||'À confirmer')}</b></div><div class="infoBox routeBox"><small>📍 Itinéraire</small><b>${esc(depart||'—')} → ${esc(dest||'—')}</b></div></div>
 ${estimateText(q)?`<div class="timelinePreview"><b>Estimation inventaire :</b> ${esc(estimateText(q))}</div>`:""}
 ${latest?`<div class="timelinePreview"><b>Dernière activité :</b> ${esc(latest.label||latest.action||'Mise à jour')} · ${esc(fmt(latest.at||latest.date))}</div>`:''}
 <div class="submissionActions"><button class="actionBtn blue" data-view="${q.id}">👁 Voir</button>${phone?`<a class="actionBtn" href="tel:${esc(phone)}">📞 Appeler</a>`:''}${email?`<a class="actionBtn" href="mailto:${esc(email)}?subject=${encodeURIComponent('Votre demande Moventra Transport')}">✉️ Courriel</a>`:''}
 ${(()=>{const d=devisByQuote.get(q.id);return d?`<a class="actionBtn blue" href="devis.html?devisId=${d.id}&quoteId=${q.id}">✏️ Modifier devis</a><a class="actionBtn" href="devis.html?devisId=${d.id}&quoteId=${q.id}&action=print">📄 PDF</a><a class="actionBtn green" href="devis.html?devisId=${d.id}&quoteId=${q.id}&action=share">✉️ Envoyer</a>`:`<a class="actionBtn blue" href="devis.html?quoteId=${q.id}">💲 Créer un devis</a>`})()}
 ${['nouvelle','devis_envoye'].includes(s)?`<button class="actionBtn green" data-accept="${q.id}">✅ Accepter</button><button class="actionBtn red" data-status-change="refusee" data-id="${q.id}">❌ Refuser</button>`:''}
 ${s==='refusee'?`<button class="actionBtn" data-status-change="archivee" data-id="${q.id}">📦 Archiver</button>`:''}
 ${s==='acceptee'?`<a class="actionBtn green" href="dispatch.html?quoteId=${q.id}">👷 Voir dans Dispatch</a>`:''}</div></article>`
}
function bindActions(){
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>openDetails(b.dataset.view));
 document.querySelectorAll('[data-status-change]').forEach(b=>b.onclick=()=>changeStatus(b.dataset.id,b.dataset.statusChange));
 document.querySelectorAll('[data-accept]').forEach(b=>b.onclick=()=>openAccept(b.dataset.accept));
}
async function changeStatus(id,status){
 const labels={devis_envoye:'Devis marqué comme envoyé',refusee:'Soumission refusée',archivee:'Soumission archivée'};try{await updateDoc(doc(db,QUOTES_COLLECTION,id),{status,updatedAt:serverTimestamp(),timeline:arrayUnion({label:labels[status],at:new Date().toISOString()})});const x=all.find(v=>v.id===id);x.status=status;x.timeline=[...(x.timeline||[]),{label:labels[status],at:new Date().toISOString()}];render()}catch(e){alert('Erreur : '+(e.message||e.code))}
}
function openAccept(id){acceptingId=id;const q=all.find(x=>x.id===id);$('acceptedDate').value=serviceDate(q)||'';$('acceptedTime').value='';$('acceptedNote').value='';$('acceptDialog').showModal()}
$('cancelAccept').onclick=()=>$('acceptDialog').close();
$('acceptForm').onsubmit=async e=>{e.preventDefault();const q=all.find(x=>x.id===acceptingId);if(!q)return;const btn=e.submitter;btn.disabled=true;btn.textContent='Création…';try{
 const date=$('acceptedDate').value||serviceDate(q)||'',time=$('acceptedTime').value,note=$('acceptedNote').value.trim();
 const task={quoteId:q.id,submissionId:q.id,clientName:val(q,'name','nom'),name:val(q,'name','nom'),phone:val(q,'phone','telephone'),email:val(q,'email','courriel'),service:val(q,'service'),address:val(q,'address','depart'),depart:val(q,'address','depart'),destination:val(q,'destination','adresseArrivee','arrivalAddress'),date,time,propertyType:val(q,'propertyType','typeLogement'),startFloor:val(q,'startFloor','etageDepart'),endFloor:val(q,'endFloor','etageArrivee'),message:val(q,'message','details'),inventory:q.inventory||{},inventoryEstimate:q.inventoryEstimate||{},inventoryOther:val(q,'inventoryOther'),photos:Array.isArray(q.photos)?q.photos:[],rooms:Number(q.rooms)||0,startElevator:val(q,'startElevator'),endElevator:val(q,'endElevator'),doorDistance:val(q,'doorDistance'),noteAdmin:note,status:'a_planifier',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
 const taskRef=await addDoc(collection(db,TASKS_COLLECTION),task);await updateDoc(doc(db,QUOTES_COLLECTION,q.id),{status:'acceptee',acceptedAt:serverTimestamp(),taskId:taskRef.id,confirmedDate:date,confirmedTime:time,updatedAt:serverTimestamp(),timeline:arrayUnion({label:'Client accepté — mission créée',at:new Date().toISOString()})});q.status='acceptee';q.taskId=taskRef.id;q.timeline=[...(q.timeline||[]),{label:'Client accepté — mission créée',at:new Date().toISOString()}];$('acceptDialog').close();render();
 }catch(err){console.error(err);alert('Impossible de créer la mission : '+(err.message||err.code))}finally{btn.disabled=false;btn.textContent='✅ Confirmer et créer la mission'}};
function openDetails(id){const q=all.find(x=>x.id===id);if(!q)return;const s=normStatus(q),fields=[['Client',val(q,'name','nom')],['Téléphone',val(q,'phone','telephone')],['Courriel',val(q,'email','courriel')],['Service',val(q,'service')],['Date souhaitée',serviceDate(q)],['Type de logement',val(q,'propertyType','typeLogement')],['Étage au départ',val(q,'startFloor','etageDepart')],['Étage à l’arrivée',val(q,'endFloor','etageArrivee')],['Ascenseur au départ',val(q,'startElevator','elevator','ascenseur')],['Ascenseur à l’arrivée',val(q,'endElevator')],['Nombre de pièces',val(q,'rooms')],['Distance camion → porte',val(q,'doorDistance')],['Estimation inventaire',estimateText(q)],['Adresse de départ',val(q,'address','depart')],['Adresse d’arrivée',val(q,'destination','adresseArrivee','arrivalAddress')],['Montant estimé',val(q,'montantAdmin','estimation')?val(q,'montantAdmin','estimation')+' $':''],['Détails',val(q,'message','details')],['Note interne',val(q,'noteAdmin')],['Numéro de soumission',q.id]];
 $('dialogStatus').className=`statusPill status-${s}`;$('dialogStatus').textContent=statusLabels[s]||s;$('dialogTitle').textContent=val(q,'name','nom')||'Soumission';
 const timeline=[{label:'Soumission créée',at:q.createdAt},...(Array.isArray(q.timeline)?q.timeline:[])];
 const d=devisByQuote.get(q.id); const quoteActions=d?`<div class="submissionActions" style="margin-top:16px"><a class="actionBtn blue" href="devis.html?devisId=${d.id}&quoteId=${q.id}">✏️ Modifier le devis</a><a class="actionBtn" href="devis.html?devisId=${d.id}&quoteId=${q.id}&action=print">📄 Télécharger PDF</a><a class="actionBtn green" href="devis.html?devisId=${d.id}&quoteId=${q.id}&action=share">✉️ Envoyer par courriel</a></div>`:`<div class="submissionActions" style="margin-top:16px"><a class="actionBtn blue" href="devis.html?quoteId=${q.id}">💲 Créer un devis</a></div>`; const inv=inventoryEntries(q);const photos=Array.isArray(q.photos)?q.photos:[];const inventoryHtml=inv.length?`<section class="timeline"><h3>📦 Inventaire du client</h3><div class="detailsGrid">${inv.map(x=>`<div class="detailItem"><small>${esc(x.label||'Article')}</small><p>${Number(x.qty)}</p></div>`).join('')}${val(q,'inventoryOther')?`<div class="detailItem full"><small>Autres objets</small><p>${esc(val(q,'inventoryOther'))}</p></div>`:''}</div></section>`:'';const photosHtml=photos.length?`<section class="timeline"><h3>📷 Photos</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px">${photos.map(u=>`<a href="${esc(u)}" target="_blank"><img src="${esc(u)}" alt="Photo de la soumission" style="width:100%;height:120px;object-fit:cover;border-radius:12px"></a>`).join('')}</div></section>`:'';$('dialogContent').innerHTML=`<div class="detailsGrid">${fields.filter(x=>x[1]).map(([k,v])=>`<div class="detailItem ${['Détails','Note interne'].includes(k)?'full':''}"><small>${esc(k)}</small><p>${esc(v)}</p></div>`).join('')}</div>${inventoryHtml}${photosHtml}${quoteActions}<section class="timeline"><h3>Historique</h3>${timeline.map(t=>`<div class="timelineItem"><b>${esc(t.label||t.action||'Mise à jour')}</b><small>${fmt(t.at||t.date)}</small></div>`).join('')}</section>`;$('detailsDialog').showModal()}

document.querySelectorAll('.statusTabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.statusTabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');activeStatus=b.dataset.status;render()});
['searchInput','periodFilter','sortFilter'].forEach(id=>$(id).addEventListener(id==='searchInput'?'input':'change',render));$('refreshBtn').onclick=load;
