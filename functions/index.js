const {onDocumentCreated}=require('firebase-functions/v2/firestore');
const {defineSecret}=require('firebase-functions/params');
const admin=require('firebase-admin');admin.initializeApp();
const oneSignalKey=defineSecret('ONESIGNAL_REST_API_KEY');
exports.notifyNewQuote=onDocumentCreated({document:'demandes_soumission/{id}',secrets:[oneSignalKey]},async event=>{
 const x=event.data.data();
 const body={app_id:'a6edf32a-9d3b-4fce-ad98-0c5ccfc43672',included_segments:['Subscribed Users'],headings:{fr:'Nouvelle soumission Moventra',en:'New Moventra quote'},contents:{fr:`${x.nom||'Client'} — ${x.service||'Service'} — ${x.telephone||''}`,en:`${x.nom||'Client'} — ${x.service||'Service'} — ${x.telephone||''}`},url:'https://www.moventratransport.ca/admin.html'};
 const r=await fetch('https://api.onesignal.com/notifications',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Key '+oneSignalKey.value()},body:JSON.stringify(body)});if(!r.ok)throw new Error(await r.text());
});
