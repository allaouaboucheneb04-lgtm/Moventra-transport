(function(){
 const items=[
  ['admin.html','🏠','Tableau de bord'],['admin.html#soumissions','📋','Soumissions'],['clients.html','👥','Clients'],['facturation.html','🧾','Factures'],['calendrier.html','📅','Calendrier'],['dispatch.html','👷','Dispatch'],['employes.html','👨‍💼','Employés'],['notification-test.html','🔔','Notifications'],['promotions.html','🎉','Promotions'],['parametres.html','⚙️','Paramètres']
 ];
 const current=(location.pathname.split('/').pop()||'admin.html');
 const bar=document.createElement('nav');bar.className='moventraNavBar';bar.setAttribute('aria-label','Navigation administration');
 const inner=document.createElement('div');inner.className='moventraNavInner';
 items.forEach(([href,icon,label])=>{const a=document.createElement('a');a.href=href;a.className='moventraNavLink'+(current===href.split('#')[0]?' active':'');a.innerHTML=`<span>${icon}</span><span>${label}</span>`;inner.appendChild(a)});
 const spacer=document.createElement('span');spacer.className='moventraNavSpacer';inner.appendChild(spacer);
 const out=document.createElement('button');out.className='moventraNavLink moventraNavLogout';out.type='button';out.innerHTML='🚪 Déconnexion';out.onclick=async()=>{try{sessionStorage.removeItem('moventra_admin_verified');localStorage.removeItem('moventra_admin_verified');if(window.firebaseAuthSignOut)await window.firebaseAuthSignOut()}catch(e){}location.href='login.html'};inner.appendChild(out);
 bar.appendChild(inner);document.body.insertBefore(bar,document.body.firstChild);
})();
