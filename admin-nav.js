(function(){
 const items=[
  ['admin.html','🏠','Tableau de bord'],['admin.html#soumissions','📋','Soumissions'],['clients.html','👥','Clients'],['facturation.html','🧾','Factures'],['calendrier.html','📅','Calendrier'],['dispatch.html','👷','Dispatch'],['employes.html','👨‍💼','Employés'],['notification-test.html','🔔','Notifications'],['promotions.html','🎉','Promotions'],['parametres.html','⚙️','Paramètres']
 ];
 const current=(location.pathname.split('/').pop()||'admin.html');
 const activeFor=href=>current===href.split('#')[0];
 const logout=async()=>{try{sessionStorage.removeItem('moventra_admin_verified');localStorage.removeItem('moventra_admin_verified');const m=await import('./firebase-config.js');const a=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');await a.signOut(m.auth)}catch(e){}location.href='login.html'};
 const buildLinks=(parent)=>{items.forEach(([href,icon,label])=>{const a=document.createElement('a');a.href=href;a.className='moventraNavLink'+(activeFor(href)?' active':'');a.innerHTML=`<span>${icon}</span><span>${label}</span>`;parent.appendChild(a)});const b=document.createElement('button');b.className='moventraNavLink moventraNavLogout';b.type='button';b.innerHTML='🚪 Déconnexion';b.onclick=logout;parent.appendChild(b)};
 const top=document.createElement('header');top.className='moventraTopbar';top.innerHTML='<div class="moventraTopbarInner"><button class="moventraMenuBtn" aria-label="Ouvrir le menu">☰</button><a class="moventraBrand" href="admin.html"><img src="logo.jpeg" alt="Moventra"><span>Moventra Admin<small>Transport & déménagement</small></span></a><nav class="moventraNavLinks"></nav></div>';
 buildLinks(top.querySelector('.moventraNavLinks'));
 const backdrop=document.createElement('div');backdrop.className='moventraBackdrop';
 const drawer=document.createElement('aside');drawer.className='moventraDrawer';drawer.innerHTML='<div class="moventraDrawerHeader"><a class="moventraBrand" href="admin.html"><img src="logo.jpeg" alt="Moventra"><span>Moventra Admin<small>Menu principal</small></span></a><button class="crmClose" aria-label="Fermer">×</button></div><nav></nav>';
 buildLinks(drawer.querySelector('nav'));
 const open=()=>{drawer.classList.add('open');backdrop.classList.add('open');document.body.style.overflow='hidden'};const close=()=>{drawer.classList.remove('open');backdrop.classList.remove('open');document.body.style.overflow=''};
 top.querySelector('.moventraMenuBtn').onclick=open;drawer.querySelector('.crmClose').onclick=close;backdrop.onclick=close;drawer.querySelectorAll('a').forEach(a=>a.onclick=close);
 document.body.prepend(backdrop);document.body.prepend(drawer);document.body.prepend(top);
})();
