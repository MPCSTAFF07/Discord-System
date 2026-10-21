export function secret(){const bytes=crypto.getRandomValues(new Uint8Array(32));return Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');}
export function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;let difference=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)difference|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return difference===0;}
export function newConfig(){return {viewer:secret(),slots:Object.fromEntries(['a','b'].flatMap(t=>Array.from({length:5},(_,i)=>[t+(i+1),{name:'Player'+t.toUpperCase()+(i+1),token:secret(),discord_id:''}])))};}
export function authorizedAdmin(request,key){return !!key&&equal(request.headers.get('Authorization'),'Bearer '+key);}
export async function turnCredentials(env,request=fetch){
 if(!env.TURN_KEY_ID||!env.TURN_KEY_API_TOKEN)throw Error('CloudflareのTURN設定が未完了です。');
 const response=await request('https://rtc.live.cloudflare.com/v1/turn/keys/'+encodeURIComponent(env.TURN_KEY_ID)+'/credentials/generate-ice-servers',{method:'POST',headers:{'Authorization':'Bearer '+env.TURN_KEY_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({ttl:43200}),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Cloudflare TURNの認証に失敗しました。TURNキーの設定を確認してください。');
 const data=await response.json();
 if(!Array.isArray(data.iceServers)||!data.iceServers.some(e=>(Array.isArray(e.urls)?e.urls:[e.urls]).some(u=>typeof u==='string'&&u.startsWith('turn'))))throw Error('Cloudflare TURNの応答が不正です。');
 return data.iceServers;
}
export function canSignal(sender,target){return sender?.role==='publisher'&&target?.role==='viewer'&&target.publisher===sender.id||sender?.role==='viewer'&&target?.role==='publisher'&&sender.publisher===target.id;}
export function mutate(config,value){const slot=config.slots[value.slot];if(!slot)throw Error('選手枠がありません。');if(value.action==='name'){const name=String(value.display_name||'').trim();if(!name||name.length>100)throw Error('選手名は1〜100文字で入力してください。');slot.name=name;}else if(value.action==='revoke'){slot.token=secret();}else if(value.action==='identity'){if(value.discord_id)throw Error('このCloudflare版のDiscord本人認証は未対応です。今は招待リンク方式をご利用ください。');slot.discord_id='';}else throw Error('操作が不正です。');}
