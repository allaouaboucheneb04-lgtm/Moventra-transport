(function(){
 const items=[
  ['admin.html','🏠','Tableau de bord'],['soumissions.html','📋','Soumissions'],['clients.html','👥','Clients'],['facturation.html','🧾','Factures'],['calendrier.html?v=admin-sync-20260719-1','📅','Calendrier'],['dispatch.html','👷','Dispatch'],['employes.html','👨‍💼','Employés'],['notification-test.html','🔔','Notifications'],['promotions.html','🎉','Promotions'],['parametres.html','⚙️','Paramètres']
 ];
 const current=(location.pathname.split('/').pop()||'admin.html');
 const activeFor=href=>current===href.split('#')[0];
 const logout=async()=>{try{sessionStorage.removeItem('moventra_admin_verified');localStorage.removeItem('moventra_admin_verified');const m=await import('./firebase-config.js');const a=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');await a.signOut(m.auth)}catch(e){}location.href='login.html'};
 const buildLinks=(parent)=>{items.forEach(([href,icon,label])=>{const a=document.createElement('a');a.href=href;a.className='moventraNavLink'+(activeFor(href)?' active':'');a.innerHTML=`<span>${icon}</span><span>${label}</span>`;parent.appendChild(a)});const b=document.createElement('button');b.className='moventraNavLink moventraNavLogout';b.type='button';b.innerHTML='🚪 Déconnexion';b.onclick=logout;parent.appendChild(b)};

 const top=document.createElement('header');
 top.className='moventraTopbar';
 top.innerHTML='<div class="moventraTopbarInner"><button class="moventraMenuBtn" aria-label="Ouvrir le menu">☰</button><a class="moventraBrand" href="admin.html"><img src="logo.jpeg" alt="Moventra"><span>Moventra Admin<small>Transport & déménagement</small></span></a><nav class="moventraNavLinks"></nav><button class="moventraPwaBell" type="button" aria-label="Activer les notifications" title="Notifications"><span class="moventraPwaBellIcon">🔔</span><span class="moventraPwaBellBadge">!</span></button></div>';
 buildLinks(top.querySelector('.moventraNavLinks'));

 const isInstalledWebApp=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
 const bell=top.querySelector('.moventraPwaBell');
 const badge=top.querySelector('.moventraPwaBellBadge');
 const icon=top.querySelector('.moventraPwaBellIcon');
 let pushActive=false;
 let unreadUnsubscribe=null;
 let pushScriptPromise=null;

 const showToast=(message,ok=true)=>{
   let toast=document.getElementById('moventraBellToast');
   if(!toast){toast=document.createElement('div');toast.id='moventraBellToast';toast.className='moventraBellToast';document.body.appendChild(toast)}
   toast.textContent=message;toast.className='moventraBellToast show '+(ok?'ok':'error');
   clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),3600);
 };

 const setInactive=()=>{
   pushActive=false;
   bell.classList.remove('is-active','has-unread','is-loading');
   bell.classList.add('needs-permission');
   icon.textContent='🔔';
   badge.textContent='!';
   badge.classList.remove('is-empty');
   bell.setAttribute('aria-label','Activer les notifications du téléphone');
   bell.title='Activer les notifications du téléphone';
 };

 const setActive=(unread=0)=>{
   pushActive=true;
   bell.classList.remove('needs-permission','is-loading');
   bell.classList.add('is-active');
   icon.textContent='🔔';
   badge.textContent=unread>99?'99+':String(unread);
   badge.classList.toggle('is-empty',unread===0);
   bell.classList.toggle('has-unread',unread>0);
   bell.setAttribute('aria-label',unread?`${unread} notification${unread>1?'s':''} non lue${unread>1?'s':''}`:'Ouvrir les notifications');
   bell.title='Ouvrir les notifications Moventra';
 };

 const loadPushScript=()=>{
   if(typeof window.moventraEnablePush==='function')return Promise.resolve();
   if(pushScriptPromise)return pushScriptPromise;
   pushScriptPromise=new Promise((resolve,reject)=>{
     const existing=document.querySelector('script[data-moventra-push],script[src^="push.js"]');
     if(existing){
       const wait=()=>typeof window.moventraEnablePush==='function'?resolve():setTimeout(wait,100);wait();
       setTimeout(()=>reject(new Error('Le module de notifications ne répond pas.')),12000);return;
     }
     const script=document.createElement('script');script.src='push.js?v=onesignal-clean-20260719-1';script.defer=true;script.dataset.moventraPush='1';
     script.onload=()=>{const wait=()=>typeof window.moventraEnablePush==='function'?resolve():setTimeout(wait,100);wait()};
     script.onerror=()=>reject(new Error('Impossible de charger le module OneSignal.'));
     document.head.appendChild(script);
   });
   return pushScriptPromise;
 };

 const checkPushActive=async()=>{
   try{
     await loadPushScript();
     if(typeof window.moventraGetPushState==='function'){
       const state=await window.moventraGetPushState();
       return state.permission==='granted' && (state.optedIn || Boolean(state.subscriptionId));
     }
     return false;
   }catch(e){console.warn('[Moventra cloche] Vérification OneSignal:',e);return false}
 };

 const startUnreadListener=async()=>{
   if(unreadUnsubscribe)return;
   try{
     const appMod=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
     const fsMod=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
     const cfg=await import('./firebase-config.js');
     const app=appMod.getApps().length?appMod.getApp():appMod.initializeApp(cfg.firebaseConfig);
     const db=fsMod.getFirestore(app);
     unreadUnsubscribe=fsMod.onSnapshot(fsMod.collection(db,'notifications'),snap=>{
       let unread=0;
       snap.forEach(doc=>{const n=doc.data()||{};if(n.read!==true&&n.lu!==true&&String(n.status||'').toLowerCase()!=='read')unread++});
       if(pushActive)setActive(unread);
     },e=>{console.warn('[Moventra cloche] Notifications internes:',e);if(pushActive)setActive(0)});
   }catch(e){console.warn('[Moventra cloche] Firestore:',e);if(pushActive)setActive(0)}
 };

 const refreshBell=async()=>{
   if(!isInstalledWebApp())return;
   bell.classList.add('is-visible');
   bell.classList.add('is-loading');
   const active=await checkPushActive();
   if(active){setActive(0);startUnreadListener()}else setInactive();
 };

 bell.addEventListener('click',async()=>{
   if(!isInstalledWebApp())return;
   if(pushActive){location.href='notification-test.html';return}
   bell.disabled=true;bell.classList.add('is-loading');badge.textContent='…';badge.classList.remove('is-empty');
   try{
     await loadPushScript();
     if(typeof window.moventraEnablePush!=='function')throw new Error('Activation OneSignal indisponible.');
     const activationOk=await window.moventraEnablePush();
     const active=activationOk || await checkPushActive();
     if(active){setActive(0);startUnreadListener();showToast('Notifications du téléphone activées.',true)}
     else{
       setInactive();
       if(Notification.permission==='denied')showToast('Notifications bloquées. Ouvre Réglages iPhone > Notifications > Moventra Admin.',false);
       else if(Notification.permission==='default')showToast('La demande iPhone ne s’est pas ouverte. Ferme complètement l’app, rouvre-la depuis l’icône et réessaie.',false);
       else showToast('Permission iPhone accordée, mais abonnement OneSignal non créé. Vérifie le domaine www.moventratransport.ca dans OneSignal.',false);
     }
   }catch(e){console.error(e);setInactive();showToast(e.message||'Impossible d’activer les notifications.',false)}
   finally{bell.disabled=false;bell.classList.remove('is-loading')}
 });

 if(isInstalledWebApp())refreshBell();
 window.addEventListener('focus',refreshBell);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshBell()});

 const backdrop=document.createElement('div');backdrop.className='moventraBackdrop';
 const drawer=document.createElement('aside');drawer.className='moventraDrawer';drawer.innerHTML='<div class="moventraDrawerHeader"><a class="moventraBrand" href="admin.html"><img src="logo.jpeg" alt="Moventra"><span>Moventra Admin<small>Menu principal</small></span></a><button class="crmClose" aria-label="Fermer">×</button></div><nav></nav>';
 buildLinks(drawer.querySelector('nav'));
 const open=()=>{drawer.classList.add('open');backdrop.classList.add('open');document.body.classList.add('menu-open')};
 const close=()=>{drawer.classList.remove('open');backdrop.classList.remove('open');document.body.classList.remove('menu-open');document.body.style.overflow='';document.body.style.overflowY='auto'};
 top.querySelector('.moventraMenuBtn').onclick=open;drawer.querySelector('.crmClose').onclick=close;backdrop.onclick=close;drawer.querySelectorAll('a').forEach(a=>a.onclick=close);
 document.body.prepend(backdrop);document.body.prepend(drawer);document.body.prepend(top);
})();

window.addEventListener('pageshow',()=>{document.body.classList.remove('menu-open');document.body.style.overflow='';document.body.style.overflowY='auto'});
