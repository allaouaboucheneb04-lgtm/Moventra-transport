window.OneSignalDeferred=window.OneSignalDeferred||[];
OneSignalDeferred.push(async function(OneSignal){
  try{
    await OneSignal.init({appId:"b7dc3eab-b127-47dd-9ad4-71295880fd34",serviceWorkerPath:'OneSignalSDKWorker.js',serviceWorkerParam:{scope:'/Moventra-transport/'},allowLocalhostAsSecureOrigin:true});
    window.MoventraOneSignal=OneSignal;
  }catch(e){console.error('OneSignal Moventra',e)}
});
async function enableMoventraNotifications(){
  try{const O=window.MoventraOneSignal;if(!O)throw new Error('OneSignal n’est pas encore prêt. Recharge la page.');await O.Notifications.requestPermission();const ok=O.Notifications.permission;alert(ok?'Notifications Moventra activées.':'Autorisation refusée.');}catch(e){alert(e.message||e)}
}
