import {DurableObject} from 'cloudflare:workers';
import {secret,equal,newConfig,authorizedAdmin,turnCredentials,canSignal,mutate} from './core.js';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
export default {async fetch(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/camera/ws'||path==='/camera/api/admin')return env.CAMERAS.getByName('mpc').fetch(request);
 if(path==='/camera/info')return json({discord_oauth:false});
 const pages={'/':'admin','/camera':'admin','/camera/admin':'admin','/camera/send':'send','/camera/view':'view'};
 if(pages[path]){url.pathname='/camera/'+pages[path]+'.html';return env.ASSETS.fetch(new Request(url,request));}
 if(path==='/camera/camera.js'||/^\/camera\/(admin|send|view)\.html$/.test(path))return env.ASSETS.fetch(request);
 return json({error:'Not found'},404);
}};
export class CameraRoom extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;this.sessions=new Map();ctx.getWebSockets().forEach(ws=>{const state=ws.deserializeAttachment();if(state)this.sessions.set(ws,state);});ctx.blockConcurrencyWhile(async()=>{this.config=await ctx.storage.get('config');if(!this.config){this.config=newConfig();await ctx.storage.put('config',this.config);}});}
 roster(){return Object.entries(this.config.slots).map(([slot,s])=>({slot,display_name:s.name,discord_id:'',discord_verified:false,connected:[...this.sessions.values()].some(p=>p.role==='publisher'&&p.ready&&p.slot===slot)}));}
 send(ws,data){try{ws.send(JSON.stringify(data));}catch{}}
 attach(ws,value){this.sessions.set(ws,value);ws.serializeAttachment(value);}
 notify(){for(const [ws,s]of this.sessions)if(s.role==='viewer')this.send(ws,{type:'roster',players:this.roster()});}
 async fetch(request){
  const url=new URL(request.url),origin=request.headers.get('Origin');
  if(!this.env.ADMIN_KEY||this.env.ADMIN_KEY.length<32)return json({error:'管理キーが未設定です。32文字以上のADMIN_KEYをWorkerのSecretへ設定してください。'},503);
  if(url.pathname==='/camera/api/admin'){
   if(!authorizedAdmin(request,this.env.ADMIN_KEY))return json({error:'管理キーが一致しません。'},401);
   if(request.method==='POST'){
    if(origin!==url.origin)return json({error:'Invalid origin'},403);
    if(Number(request.headers.get('Content-Length')||0)>4096)return json({error:'Request too large'},413);
    try{const raw=await request.text();if(raw.length>4096)return json({error:'Request too large'},413);const value=JSON.parse(raw);mutate(this.config,value);await this.ctx.storage.put('config',this.config);if(value.action==='revoke'){for(const [ws,p]of this.sessions)if(p.role==='publisher'&&p.slot===value.slot){ws.close(1008,'Invitation changed');this.drop(ws);}}}catch(e){return json({error:e.message},400);}
   }else if(request.method!=='GET')return json({error:'Method not allowed'},405);
   const players=this.roster().map(p=>({...p,invite:url.origin+'/camera/send#'+new URLSearchParams({slot:p.slot,token:this.config.slots[p.slot].token}),view:url.origin+'/camera/view#'+new URLSearchParams({slot:p.slot,token:this.config.viewer})}));
   return json({players,discord_oauth:false,base:url.origin});
  }
  if(origin!==url.origin)return json({error:'Invalid origin'},403);
  if(request.method!=='GET'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket required'},426);
  if(this.sessions.size>=100)return json({error:'接続が多すぎます。'},429);
  const pair=new WebSocketPair(),[client,server]=Object.values(pair);
  this.ctx.acceptWebSocket(server);this.attach(server,{id:secret(),created:Date.now(),authenticated:false});
  await this.ctx.storage.setAlarm(Date.now()+15000);
  return new Response(null,{status:101,webSocket:client});
 }
 async webSocketMessage(ws,message){
  const session=this.sessions.get(ws);if(!session)return;
  try{
   if(typeof message!=='string'||message.length>131072)throw Error('メッセージが不正です。');const data=JSON.parse(message);
   if(!session.authenticated){
    if(Date.now()-session.created>15000)throw Error('認証がタイムアウトしました。');
    if(data.role==='viewer'&&equal(data.token,this.config.viewer)){session.role='viewer';}
    else if(data.role==='publisher'&&this.config.slots[data.slot]&&equal(data.token,this.config.slots[data.slot].token)){
     if([...this.sessions.values()].some(p=>p.role==='publisher'&&p.slot===data.slot))throw Error('同じ選手のカメラが既に接続中です。');session.role='publisher';session.slot=data.slot;
    }else throw Error('招待リンクまたは閲覧キーが無効です。');
    // Persist an authenticating reservation before yielding to the TURN API.
    session.authenticated=true;this.attach(ws,session);
    const iceServers=await turnCredentials(this.env);
    if(!this.sessions.has(ws))return;
    session.ready=true;this.attach(ws,session);
    this.send(ws,{type:'ready',id:session.id,iceServers,discord_verified:false});this.notify();return;
   }
   if(!session.ready)throw Error('接続準備中です。');
   if(data.type==='subscribe'&&session.role==='viewer'){
    const old=[...this.sessions].find(([,p])=>p.id===session.publisher);if(old)this.send(old[0],{type:'leave',peer:session.id});
    const publisher=[...this.sessions].find(([,p])=>p.role==='publisher'&&p.ready&&p.slot===data.slot);
    session.publisher=publisher?.[1].id||null;this.attach(ws,session);
    if(publisher){this.send(ws,{type:'publisher',peer:publisher[1].id,slot:data.slot});this.send(publisher[0],{type:'subscribe',peer:session.id});}else this.send(ws,{type:'offline',slot:data.slot});return;
   }
   if(['offer','answer','ice'].includes(data.type)){
    const target=[...this.sessions].find(([,p])=>p.id===data.to);if(!target)return;
    if(!canSignal(session,target[1])){if(session.role==='publisher'||data.type==='ice')return;throw Error('選択していないカメラへは接続できません。');}
    this.send(target[0],{type:data.type,peer:session.id,data:data.data});
   }
  }catch(e){this.send(ws,{type:'error',error:e.message});try{ws.close(1008,'Connection rejected');}catch{}this.drop(ws);}
 }
 drop(ws){const gone=this.sessions.get(ws);if(!gone)return;this.sessions.delete(ws);for(const [target,s]of this.sessions){if(s.role==='viewer'&&s.publisher===gone.id){s.publisher=null;this.attach(target,s);this.send(target,{type:'offline',slot:gone.slot});}if(gone.role==='viewer'&&s.id===gone.publisher)this.send(target,{type:'leave',peer:gone.id});}this.notify();}
 async alarm(){for(const [ws,s]of this.sessions)if(!s.authenticated&&Date.now()-s.created>10000){ws.close(1008,'Authentication timeout');this.drop(ws);}if([...this.sessions.values()].some(s=>!s.authenticated))await this.ctx.storage.setAlarm(Date.now()+15000);}
 webSocketClose(ws){this.drop(ws);}
 webSocketError(ws){this.drop(ws);}
}
