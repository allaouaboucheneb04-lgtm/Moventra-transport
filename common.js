(function(){
  firebase.initializeApp(window.MOVENTRA_FIREBASE_CONFIG);
  window.auth=firebase.auth(); window.db=firebase.firestore();
  const b=document.getElementById('menuBtn'),d=document.getElementById('drawer'); if(b&&d)b.onclick=()=>d.classList.toggle('open');
  window.logout=()=>auth.signOut().then(()=>location.href='login.html');
})();
