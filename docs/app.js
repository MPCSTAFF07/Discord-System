'use strict';
function serverOrigin(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw Error('HTTPSのサーバーURLを入力してください。例：https://camera.example.com');
 return url.origin;
}
function previewAddress(value,origin){
 const url=new URL(value);
 if(url.origin!==origin||url.pathname!=='/camera/view'||!new URLSearchParams(url.hash.slice(1)).get('token'))throw Error('接続中のカメラサーバーからコピーしたOBS URLを入力してください。');
 return url.href;
}
if(typeof module!=='undefined')module.exports={serverOrigin,previewAddress};
if(typeof document!=='undefined'){
 const $=id=>document.getElementById(id);
 const storageKey='mpc-camera-connection';let connection=null;
 function message(value,error=false){$('message').textContent=value;$('message').classList.toggle('error',error);}
 function managerUrl(){return connection.origin+'/camera#'+new URLSearchParams({token:connection.key});}
 function stopPreview(){$('preview').removeAttribute('src');$('preview').hidden=true;$('previewUrl').value='';}
 function show(){
  $('manager').src=managerUrl();$('connectedServer').textContent=connection.origin;$('workspace').hidden=false;$('connectPanel').hidden=true;$('key').value='';
  $('badge').textContent='接続先設定済み';message('管理画面を開いています。カメラの接続状態は下の選手一覧で確認してください。表示されない場合は「別タブで開く」から確認してください。');
 }
 $('connectForm').onsubmit=event=>{
  event.preventDefault();
  try{const origin=serverOrigin($('server').value.trim()),key=$('key').value.trim();if(!key||key.length>256)throw Error('管理キーを確認してください。');
   connection={origin,key};sessionStorage.setItem(storageKey,JSON.stringify(connection));stopPreview();show();
  }catch(error){message(error.message,true);}
 };
 function disconnect(){sessionStorage.removeItem(storageKey);connection=null;stopPreview();$('manager').removeAttribute('src');$('workspace').hidden=true;$('connectPanel').hidden=false;$('key').value='';$('badge').textContent='未接続';message('接続を解除しました。選手の送信を止める場合は管理画面でリンクを再発行するか、選手側で送信停止してください。');}
 $('clear').onclick=()=>{disconnect();$('server').value='';};$('disconnect').onclick=disconnect;
 $('reload').onclick=()=>{if(connection){$('manager').src=managerUrl();message('管理画面を再読込しています。');}};
 $('openDirect').onclick=()=>{if(connection)window.open(managerUrl(),'_blank','noopener,noreferrer');};
 $('previewForm').onsubmit=event=>{event.preventDefault();try{$('preview').src=previewAddress($('previewUrl').value.trim(),connection.origin);$('preview').hidden=false;}catch(error){message(error.message,true);}};
 $('stopPreview').onclick=stopPreview;
 // No secrets are written to the repository, localStorage, or the page URL.
 try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(saved&&typeof saved.key==='string'&&saved.key&&saved.key.length<=256){connection={origin:serverOrigin(saved.origin),key:saved.key};show();}}catch{sessionStorage.removeItem(storageKey);}
}
