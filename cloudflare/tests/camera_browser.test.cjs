const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/camera/camera.js','utf8');
function browser(mode){
 const historyChanges=[];const sent=[],sockets=[],tracks=[{stop(){this.stopped=true},getSettings(){return {deviceId:'cam'}}}],elements={};
 const element=id=>elements[id]??=( {textContent:'',value:'',hidden:true,srcObject:null,elements:{token:{},slot:{}},replaceChildren(){},append(){},play:()=>Promise.resolve()});
 class Socket{static OPEN=1;constructor(){this.readyState=1;sockets.push(this)}send(s){sent.push(JSON.parse(s))}close(){this.readyState=3;this.onclose?.()}}
 class Peer{constructor(){this.remoteDescription=null;this.localDescription=null;this.connectionState='new';this.candidates=[]}addTrack(){}async setRemoteDescription(v){this.remoteDescription=v}async setLocalDescription(v){this.localDescription=v}async createAnswer(){return {type:'answer',sdp:'answer'}}async createOffer(){return {type:'offer',sdp:'offer'}}async addIceCandidate(v){assert.ok(this.remoteDescription);this.candidates.push(v)}close(){this.connectionState='closed'}}
 const ctx=vm.createContext({document:{getElementById:element},location:{pathname:'/camera/'+mode,hash:'#token=key&slot=a1',origin:'http://127.0.0.1:17720'},history:{replaceState(...args){historyChanges.push(args)}},URLSearchParams,WebSocket:Socket,RTCPeerConnection:Peer,setTimeout,clearTimeout,addEventListener(){},Option:class{},fetch:async()=>({json:async()=>({discord_oauth:false})}),navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>tracks,getVideoTracks:()=>tracks}),enumerateDevices:async()=>[]}}});
 vm.runInContext(source,ctx);
 const tick=()=>new Promise(setImmediate);
 return {ctx,elements,sockets,sent,tracks,tick,historyChanges,async message(value){sockets.at(-1).onmessage({data:JSON.stringify(value)});await tick();await tick()}};
}
test('viewer subscribes once across ready and initial roster',async()=>{
 const b=browser('view');await b.message({type:'ready',id:'v',iceServers:[]});await b.message({type:'roster',players:[{slot:'a1',connected:true}]});
 assert.equal(b.sent.filter(m=>m.type==='subscribe').length,1);
});
test('viewer queues ICE before remote SDP and answers after offer',async()=>{
 const b=browser('view');await b.message({type:'ready'});await b.message({type:'ice',peer:'p',data:{candidate:'c'}});await b.message({type:'offer',peer:'p',data:{type:'offer',sdp:'s'}});
 assert.equal(b.sent.filter(m=>m.type==='answer').length,1);assert.equal(vm.runInContext("peers.get('p').pc.candidates.length",b.ctx),1);
 await b.message({type:'offline',slot:'a1'});assert.equal(vm.runInContext('peers.size',b.ctx),0);
});
test('publisher opens camera only by button, sends no subscription, and stops tracks',async()=>{
 const b=browser('send');assert.equal(b.sockets.length,0);await b.elements.start.onclick();await b.message({type:'ready',id:'p'});
 assert.equal(b.sent.filter(m=>m.type==='subscribe').length,0);await b.message({type:'subscribe',peer:'v'});assert.equal(b.sent.filter(m=>m.type==='offer').length,1);
 b.elements.stop.onclick();assert.ok(b.tracks[0].stopped);
});

test('OBS viewer keeps URL fragment when reloaded; sender removes it',()=>{assert.equal(browser('view').historyChanges.length,0);assert.equal(browser('send').historyChanges.length,1);});
