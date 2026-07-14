import{initializeApp}from'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import{getAuth,onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import{getFirestore,doc,getDoc,setDoc,addDoc,collection,serverTimestamp}from'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import{firebaseConfig}from'./firebase-config.js';
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),id=new URLSearchParams(location.search).get('mission');
let sup=[],$=s=>document.querySelector(s);
function draw(){$('#sup').innerHTML=sup.map((x,i)=>`<tr><td><input data-i="${i}" data-k="description" value="${x.description||''}"></td><td><input data-i="${i}" data-k="qty" type="number" value="${x.qty||1}"></td><td><input data-i="${i}" data-k="prix" type="number" step=".01" value="${x.prix||0}"></td><td><button data-del="${i}">×</button></td></tr>`).join('')}
function add(){sup.push({description:'',qty:1,prix:0});draw()}
function normalizeLine(x){const qty=Number(x.qty??x.quantite??1),prix=Number(x.prix??x.price??0),description=x.description||x.desc||'';return{description,desc:description,qty,prix,total:qty*prix}}
function compute(lines,tpsRate=5,tvqRate=9.975){const subtotal=lines.reduce((a,x)=>a+Number(x.total??(x.qty*x.prix)),0),tps=subtotal*Number(tpsRate||0)/100,tvq=subtotal*Number(tvqRate||0)/100,total=subtotal+tps+tvq;return{subtotal,tps,tvq,total}}
onAuthStateChanged(auth,u=>{if(!u)location.href='login.html'});
$('#add').onclick=add;
$('#sup').oninput=e=>{let i=e.target.dataset.i,k=e.target.dataset.k;if(i!==undefined)sup[i][k]=k==='description'?e.target.value:Number(e.target.value)};
$('#sup').onclick=e=>{if(e.target.dataset.del!==undefined){sup.splice(+e.target.dataset.del,1);draw()}};
$('#close').onclick=async()=>{
  try{
    $('#msg').textContent='Clôture en cours…';
    if(!id)throw new Error('Identifiant mission manquant.');
    const m=await getDoc(doc(db,'taches',id));
    if(!m.exists())throw new Error('Mission introuvable.');
    const o=m.data(),normalizedSup=sup.filter(x=>x.description&&Number(x.qty||0)>0).map(normalizeLine),extra=normalizedSup.reduce((a,x)=>a+x.total,0),acompte=Number($('#acompte').value||0);
    let activeFactureId=o.factureId||'',revisionId='';
    if(activeFactureId){
      const f=await getDoc(doc(db,'factures',activeFactureId));
      if(f.exists()){
        const old=f.data(),base=(old.services||old.lignes||[]).map(normalizeLine),lines=[...base,...normalizedSup],rates={tps:Number(old.tauxTps??5),tvq:Number(old.tauxTvq??9.975)},tot=compute(lines,rates.tps,rates.tvq),rev=Number(old.revision||0)+1,totalPaid=Number(old.montantPaye||0)+acompte;
        const revised={...old,numero:`${String(old.numero||'FAC').replace(/-R\d+$/,'')}-R${rev}`,revision:rev,parentFactureId:old.parentFactureId||activeFactureId,dossierId:old.dossierId||o.dossierId||'',lignes:lines,services:lines,sous:tot.subtotal.toFixed(2),subtotal:tot.subtotal,tps:tot.tps.toFixed(2),tvq:tot.tvq.toFixed(2),total:tot.total.toFixed(2),montantPaye:totalPaid,solde:Math.max(0,tot.total-totalPaid),modePaiement:$('#paiement').value,statut:totalPaid>=tot.total?'payée':totalPaid>0?'partiellement_payee':'brouillon_revision',revisionMotif:'Suppléments ajoutés à la clôture du déménagement',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
        const r=await addDoc(collection(db,'factures'),revised);revisionId=r.id;activeFactureId=r.id;
        await addDoc(collection(db,'historique'),{dossierId:revised.dossierId,type:'facture_revision',missionId:id,factureId:r.id,parentFactureId:revised.parentFactureId,numero:revised.numero,message:`Révision créée avec ${normalizedSup.length} supplément(s)`,montant:tot.total,supplementsTotal:extra,createdAt:serverTimestamp()});
      }
    }
    await setDoc(doc(db,'taches',id),{statut:'terminee',heureReelleDebut:$('#debut').value,heureReelleFin:$('#fin').value,supplements:normalizedSup,supplementsTotal:extra,modePaiement:$('#paiement').value,acompte,commentairesCloture:$('#commentaires').value,factureId:activeFactureId,revisionFactureId:revisionId,closedAt:serverTimestamp()},{merge:true});
    await addDoc(collection(db,'historique'),{dossierId:o.dossierId||'',type:'mission_terminee',missionId:id,factureId:activeFactureId,message:'Mission clôturée',supplementsTotal:extra,acompte,modePaiement:$('#paiement').value,createdAt:serverTimestamp()});
    $('#msg').textContent=`✅ Mission clôturée. Suppléments : ${extra.toFixed(2)} $.${revisionId?' Une nouvelle révision de facture a été créée.':''}`;
  }catch(e){console.error(e);$('#msg').textContent='❌ '+(e.message||e)}
};
add();
