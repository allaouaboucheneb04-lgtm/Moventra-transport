(function () {
  'use strict';
  const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const hiddenPages = new Set(['index.html', 'login.html', 'admin.html', 'invite.html']);
  if (hiddenPages.has(current)) return;

  function goBack() {
    let sameOriginReferrer = false;
    if (document.referrer) {
      try { sameOriginReferrer = new URL(document.referrer).origin === location.origin; }
      catch (_) { sameOriginReferrer = false; }
    }
    if (sameOriginReferrer && history.length > 1) history.back();
    else location.href = 'admin.html';
  }

  function mount() {
    if (document.getElementById('moventraAppBack')) return;
    const button = document.createElement('button');
    button.id = 'moventraAppBack';
    button.type = 'button';
    button.setAttribute('aria-label', 'Retour au tableau de bord');
    button.innerHTML = '<span aria-hidden="true">←</span><span>Retour</span>';
    button.addEventListener('click', goBack);

    const style = document.createElement('style');
    style.textContent = `
      #moventraAppBack{position:fixed;left:max(14px,env(safe-area-inset-left));bottom:calc(18px + env(safe-area-inset-bottom));z-index:2147483000;display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:12px 17px;border:1px solid rgba(255,255,255,.75);border-radius:999px;background:rgba(4,40,87,.94);color:#fff;font:800 15px/1 Arial,Helvetica,sans-serif;box-shadow:0 10px 28px rgba(0,35,78,.30);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);cursor:pointer;-webkit-tap-highlight-color:transparent}
      #moventraAppBack:active{transform:scale(.97)}
      #moventraAppBack>span:first-child{font-size:24px;line-height:1}
      @media(min-width:900px){#moventraAppBack{bottom:24px;left:24px}}
    `;
    document.head.appendChild(style);
    document.body.appendChild(button);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
