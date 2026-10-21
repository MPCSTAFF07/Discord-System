import {test} from 'node:test';import assert from 'node:assert/strict';import {Miniflare} from 'miniflare';
const origin='https://camera.example';const key='a'.repeat(40);
function runtime(){return new Miniflare({modules:true,modulesRules:[{type:'ESModule',include:['**/*.js']}],scriptPath:new URL('../src/worker.js',import.meta.url).pathname,compatibilityDate:'2026-08-06',durableObjects:{CAMERAS:{className:'CameraRoom',useSQLite:true}},bindings:{ADMIN_KEY:key,TURN_KEY_ID:'test-id',TURN_KEY_API_TOKEN:'test-api-token'},serviceBindings:{ASSETS:()=>new Response('test asset')},outboundService:()=>Response.json({iceServers:[{urls:['turn:turn.cloudflare.com:3478'],username:'temporary',credential:'temporary'}]},{status:201})});}
async function message(ws,kind){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.removeEventListener('message',handle);reject(Error('No '+kind));},5000);function handle(e){const data=JSON.parse(e.data);if(data.type===kind){clearTimeout(timer);ws.removeEventListener('message',handle);resolve(data);}}ws.addEventListener('message',handle);});}
test('Workers runtime: admin auth, persistence, WebSocket signaling and invite revocation',{timeout:30000},async()=>{
 const mf=runtime();const sockets=[];
 try{
  let r=await mf.dispatchFetch(origin+'/camera/api/admin');assert.equal(r.status,401);
  const headers={Authorization:'Bearer '+key,Origin:origin};r=await mf.dispatchFetch(origin+'/camera/api/admin',{headers});assert.equal(r.status,200);let listing=await r.json();const first=listing.players[0];
  r=await mf.dispatchFetch(origin+'/camera/api/admin',{method:'POST',headers,body:JSON.stringify({slot:'a1',action:'name',display_name:'るちる'})});assert.equal(r.status,200);
  r=await mf.dispatchFetch(origin+'/camera/api/admin',{headers});assert.equal((await r.json()).players[0].display_name,'るちる');
  const invite=new URLSearchParams(new URL(first.invite).hash.slice(1)).get('token'),view=new URLSearchParams(new URL(first.view).hash.slice(1)).get('token');
  r=await mf.dispatchFetch(origin+'/camera/ws',{headers:{Upgrade:'websocket',Origin:origin}});const pub=r.webSocket;pub.accept();sockets.push(pub);let wait=message(pub,'ready');pub.send(JSON.stringify({role:'publisher',slot:'a1',token:invite}));const p=await wait;assert.ok(p.iceServers.length);
  r=await mf.dispatchFetch(origin+'/camera/ws',{headers:{Upgrade:'websocket',Origin:origin}});const viewer=r.webSocket;viewer.accept();sockets.push(viewer);wait=message(viewer,'ready');viewer.send(JSON.stringify({role:'viewer',token:view}));const v=await wait;
  wait=message(pub,'subscribe');viewer.send(JSON.stringify({type:'subscribe',slot:'a1'}));assert.equal((await wait).peer,v.id);
  wait=message(viewer,'offer');pub.send(JSON.stringify({type:'offer',to:v.id,data:{sdp:'test',type:'offer'}}));assert.equal((await wait).peer,p.id);
  wait=message(viewer,'offline');r=await mf.dispatchFetch(origin+'/camera/api/admin',{method:'POST',headers,body:JSON.stringify({slot:'a1',action:'revoke'})});assert.equal(r.status,200);await wait;
  r=await mf.dispatchFetch(origin+'/camera/api/admin',{headers});listing=await r.json();assert.notEqual(listing.players[0].invite,first.invite);assert.equal(listing.players[0].connected,false);
 }finally{for(const ws of sockets)try{ws.close();}catch{}await mf.dispose();}
});
