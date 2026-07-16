(function(){
 const items=[
  ['admin.html','🏠','Tableau de bord'],['soumissions.html','📋','Soumissions'],['clients.html','👥','Clients'],['facturation.html','🧾','Factures'],['calendrier.html','📅','Calendrier'],['dispatch.html','👷','Dispatch'],['employes.html','👨‍💼','Employés'],['notification-test.html','🔔','Notifications'],['promotions.html','🎉','Promotions'],['parametres.html','⚙️','Paramètres']
 ];
 const current=(location.pathname.split('/').pop()||'admin.html');
 const activeFor=href=>current===href.split('#')[0];
 const logout=async()=>{try{sessionStorage.removeItem('moventra_admin_verified');localStorage.removeItem('moventra_admin_verified');const m=await import('./firebase-config.js');const a=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');await a.signOut(m.auth)}catch(e){}location.href='login.html'};
 const buildLinks=(parent)=>{items.forEach(([href,icon,label])=>{const a=document.createElement('a');a.href=href;a.className='moventraNavLink'+(activeFor(href)?' active':'');a.innerHTML=`<span>${icon}</span><span>${label}</span>`;parent.appendChild(a)});const b=document.createElement('button');b.className='moventraNavLink moventraNavLogout';b.type='button';b.innerHTML='🚪 Déconnexion';b.onclick=logout;parent.appendChild(b)};
 const top=document.createElement('header');top.className='moventraTopbar';top.innerHTML='<div class="moventraTopbarInner"><button class="moventraMenuBtn" aria-label="Ouvrir le menu">☰</button><a class="moventraBrand" href="admin.html"><img src="logo.jpeg" alt="Moventra"><span>Moventra Admin<small>Transport & déménagement</small></span></a><nav class="moventraNavLinks"></nav><a class="moventraPwaBell" href="notification-test.html" aria-label="Ouvrir les notifications" title="Notifications"><span class="moventraPwaBellIcon">🔔</span><span class="moventraPwaBellBadge" aria-label="0 notification non lue">0</span></a></div>';
 buildLinks(top.querySelector('.moventraNavLinks'));

 const isInstalledWebApp=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
 const bell=top.querySelector('.moventraPwaBell');
 const badge=top.querySelector('.moventraPwaBellBadge');
 if(isInstalledWebApp()){
   bell.classList.add('is-visible');
   // Synchronise le nombre de notifications non lues uniquement dans l'app installée.
   (async()=>{
     try{
       const appMod=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
       const fsMod=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
       const cfg=await import('./firebase-config.js');
       const app=appMod.getApps().length?appMod.getApp():appMod.initializeApp(cfg.firebaseConfig);
       const db=fsMod.getFirestore(app);
       fsMod.onSnapshot(fsMod.collection(db,'notifications'),snap=>{
         let unread=0;
         snap.forEach(doc=>{const n=doc.data()||{};if(n.read!==true&&n.lu!==true&&String(n.status||'').toLowerCase()!=='read')unread++});
         badge.textContent=unread>99?'99+':String(unread);
         badge.setAttribute('aria-label',`${unread} notification${unread>1?'s':''} non lue${unread>1?'s':''}`);
         badge.classList.toggle('is-empty',unread===0);
         bell.classList.toggle('has-unread',unread>0);
       },()=>{badge.textContent='0';badge.classList.add('is-empty')});
     }catch(e){console.warn('Cloche notifications indisponible:',e);badge.textContent='0';badge.classList.add('is-empty')}
   })();
 }
 const backdrop=document.createElement('div');backdrop.className='moventraBackdrop';
 const drawer=document.createElement('aside');drawer.className='moventraDrawer';drawer.innerHTML='<div class="moventraDrawerHeader"><a class="moventraBrand" href="admin.html"><img src="logo.jpeg" alt="Moventra"><span>Moventra Admin<small>Menu principal</small></span></a><button class="crmClose" aria-label="Fermer">×</button></div><nav></nav>';
 buildLinks(drawer.querySelector('nav'));
 const open=()=>{drawer.classList.add('open');backdrop.classList.add('open');document.body.classList.add('menu-open')};const close=()=>{drawer.classList.remove('open');backdrop.classList.remove('open');document.body.classList.remove('menu-open');document.body.style.overflow='';document.body.style.overflowY='auto'};
 top.querySelector('.moventraMenuBtn').onclick=open;drawer.querySelector('.crmClose').onclick=close;backdrop.onclick=close;drawer.querySelectorAll('a').forEach(a=>a.onclick=close);
 document.body.prepend(backdrop);document.body.prepend(drawer);document.body.prepend(top);
})();

window.addEventListener('pageshow',()=>{document.body.classList.remove('menu-open');document.body.style.overflow='';document.body.style.overflowY='auto'});
