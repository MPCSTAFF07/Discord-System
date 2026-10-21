'use strict';
const $=id=>document.getElementById(id);
const args=new URLSearchParams(location.hash.slice(1));
const token=args.get('token')||'',slot=args.get('slot')||'';
const mode=location.pathname.endsWith('/send')?'publisher':location.pathname.endsWith('/view')?'viewer':'admin';
// OBS may refresh the current document URL. Keep viewer credentials in the fragment.
if(mode!=='viewer')history.replaceState(null,'',location.pathname);
let ws=null,stream=null,iceServers=[],ready=false,sourcePeer=null,retry=null,stopped=false;
const peers=new Map();
function status(message){$('status').textContent=message;if(mode==='viewer')$('status').hidden=message==='カメラ受信中';}
function send(value){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(value));}
function closePeer(id){const state=peers.get(id);if(state){state.pc.close();peers.delete(id);}if(mode==='viewer'&&$('video'))$('video').srcObject=null;}
function clearPeers(){for(const id of [...peers.keys()])closePeer(id);sourcePeer=null;}
function peer(id){
 if(peers.has(id))return peers.get(id);
 const pc=new RTCPeerConnection({iceServers}),state={pc,pending:[]};peers.set(id,state);
 pc.onicecandidate=e=>{if(e.candidate)send({type:'ice',to:id,data:e.candidate.toJSON()});};
 pc.onconnectionstatechange=()=>{if(pc.connectionState==='connected'&&mode==='publisher')status('映像送信中');if(['failed','closed'].includes(pc.connectionState)){closePeer(id);status('映像接続が切れました。回線またはTURN設定を確認してください。');if(mode==='viewer')sourcePeer=null;}};
 if(mode==='publisher')for(const track of stream.getVideoTracks()){const sender=pc.addTrack(track,stream);const params=sender?.getParameters?.();if(params){params.encodings=[{maxBitrate:800000,maxFramerate:24}];sender.setParameters(params).catch(()=>{});}}
 else pc.ontrack=e=>{$('video').srcObject=e.streams[0];$('video').play().catch(()=>{});status('カメラ受信中');};
 return state;
}
async function description(id,data){const state=peer(id);await state.pc.setRemoteDescription(data);for(const c of state.pending)await state.pc.addIceCandidate(c);state.pending=[];return state.pc;}
async function connect(){
 stopped=false;
 const socket=ws=new WebSocket(location.origin.replace(/^http/,'ws')+'/camera/ws');
 socket.onopen=()=>socket.send(JSON.stringify({role:mode,token,slot}));
 let chain=Promise.resolve();
 socket.onmessage=e=>{chain=chain.then(async()=>{
  if(ws!==socket)return;
  const m=JSON.parse(e.data);
  if(m.type==='error'){status(m.error);stopped=true;return;}
  if(m.type==='ready'){ready=true;iceServers=m.iceServers||[];status(mode==='publisher'?'送信待機中。運営が表示すると映像接続が始まります。'+(m.discord_verified?' Discord認証済み':' 招待リンク方式（Discord未認証）'):'カメラ接続待ち');if(mode==='viewer'){sourcePeer='pending';send({type:'subscribe',slot});}}
  if(m.type==='roster'&&mode==='viewer'){const online=m.players.some(p=>p.slot===slot&&p.connected);if(online&&!sourcePeer){sourcePeer='pending';send({type:'subscribe',slot});}}
  if(m.type==='publisher')sourcePeer=m.peer;
  if(m.type==='offline'){clearPeers();status('選手のカメラは未接続です。');}
  if(m.type==='leave')closePeer(m.peer);
  if(m.type==='subscribe'&&mode==='publisher'){
   closePeer(m.peer);const pc=peer(m.peer).pc;const offer=await pc.createOffer();await pc.setLocalDescription(offer);send({type:'offer',to:m.peer,data:pc.localDescription});
  }
  if(m.type==='offer'&&mode==='viewer'){sourcePeer=m.peer;const pc=await description(m.peer,m.data);await pc.setLocalDescription(await pc.createAnswer());send({type:'answer',to:m.peer,data:pc.localDescription});}
  if(m.type==='answer'&&mode==='publisher')await description(m.peer,m.data);
  if(m.type==='ice'){const state=peer(m.peer);if(state.pc.remoteDescription)await state.pc.addIceCandidate(m.data);else state.pending.push(m.data);}
 }).catch(()=>{status('カメラの接続処理に失敗しました。送信停止してから接続し直してください。');});};
 socket.onclose=()=>{if(ws!==socket)return;ready=false;clearPeers();if(!stopped){status('接続が切れました。再接続しています。');retry=setTimeout(()=>connect(),3000);}};
 socket.onerror=()=>status('サーバーに接続できません。URL・HTTPS設定を確認してください。');
}
function stop(){stopped=true;clearTimeout(retry);ws?.close();ws=null;ready=false;clearPeers();if(stream)for(const track of stream.getTracks())track.stop();stream=null;if($('video'))$('video').srcObject=null;status('カメラを停止しました。');}
async function preview(){
 if(!navigator.mediaDevices?.getUserMedia)throw Error('カメラにはHTTPS、またはこのPCのlocalhostから接続してください。');
 if(stream)for(const track of stream.getTracks())track.stop();
 const deviceId=$('device').value;
 stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:640},height:{ideal:360},frameRate:{ideal:24,max:30},...(deviceId?{deviceId:{exact:deviceId}}:{})}});
 $('video').srcObject=stream;
 const devices=await navigator.mediaDevices.enumerateDevices();$('device').replaceChildren();
 for(const d of devices.filter(d=>d.kind==='videoinput'))$('device').append(new Option(d.label||'カメラ',d.deviceId));
 $('device').value=stream.getVideoTracks()[0].getSettings().deviceId||'';status('カメラ確認中。映像はまだ送信していません。');
}
async function admin(action){
 const response=await fetch('/camera/api/admin',{method:action?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(action?{body:JSON.stringify(action)}:{})});
 if(!response.ok)throw Error('管理画面をアプリから開き直してください。');
 const data=await response.json();$('players').replaceChildren();
 status(data.discord_oauth?'Discordログインが有効です。IDを指定すると本人だけが送信できます。':'招待リンク方式です（Discord未認証）。Discord IDによる本人確認にはサーバーのOAuth設定が必要です。');
 for(const p of data.players){
  const tr=document.createElement('tr');const cell=value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);return td;};
  const nameInput=document.createElement('input');nameInput.value=p.display_name;nameInput.setAttribute('aria-label',p.slot+' 選手名');cell(p.slot.toUpperCase()).append(nameInput);cell(p.connected?'接続中'+(p.discord_verified?' / Discord認証済み':' / 未認証'):'未接続');
  const input=document.createElement('input');input.value=p.discord_id;input.placeholder='DiscordユーザーID';cell('').append(input);
  const actions=cell('');
  for(const [label,fn]of [['名前保存',()=>admin({action:'name',slot:p.slot,display_name:nameInput.value})],['ID保存',()=>admin({action:'identity',slot:p.slot,discord_id:input.value})],['送信リンク',()=>navigator.clipboard.writeText(p.invite).then(()=>status('送信リンクをコピーしました。本人だけに渡してください。'))],['ブラウザで受信確認',()=>window.open(p.view,'_blank','noopener,noreferrer')],['OBS URL',()=>navigator.clipboard.writeText(p.view).then(()=>status('OBSのブラウザソースへ貼り付けてください。'))],['リンク再発行',()=>admin({action:'revoke',slot:p.slot})]]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>Promise.resolve(fn()).catch(e=>status(e.message));actions.append(b);}
  $('players').append(tr);
 }
}
if(mode==='admin'){$('refresh').onclick=()=>admin().catch(e=>status(e.message));admin().catch(e=>status(e.message));}
else if(mode==='publisher'){
 $('preview').onclick=()=>{if(ready){status('カメラを変更する前に送信停止してください。');return;}preview().catch(e=>status(e.message));};
 $('start').onclick=async()=>{try{if(ws){status('すでに接続中です。');return;}if(!stream)await preview();await connect();}catch(e){status(e.message);}};
 $('stop').onclick=stop;
 fetch('/camera/info').then(r=>r.json()).then(data=>{if(data.discord_oauth){$('login').hidden=false;$('login').elements.token.value=token;$('login').elements.slot.value=slot;}}).catch(()=>{});
}else connect().catch(e=>status(e.message));
addEventListener('beforeunload',()=>{stopped=true;ws?.close();if(stream)for(const track of stream.getTracks())track.stop();});
