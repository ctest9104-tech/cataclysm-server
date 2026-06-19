/* CATACLYSM ARCADE — ONLINE TCG v2.5 | Fixed levels | Card images | All factions */
const SUPABASE_URL='https://mhvtcztuusjuzdjamnfo.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odnRjenR1dXNqdXpkamFtbmZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MzE1MDUsImV4cCI6MjA5NzQwNzUwNX0.b7fq9uditGv3rabTvYeAyGxJxhSAmoVK0TpyfuRBass';
let _db=null;
try{ if(typeof supabase!=='undefined') _db=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY); }catch(e){ console.error(e); }
let _ch=null;
function subscribeToRoom(code){
  if(!_db) return;
  if(_ch){ try{ _ch.unsubscribe(); }catch(e){} }
  _ch=_db.channel('room_'+code)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'rooms',filter:'code=eq.'+code},p=>{
      if(S.busy) return; const f=p.new&&p.new.payload; if(!f) return;
      if(!S.room||f.v>S.room.v){ S.room=f; render(); }
    }).subscribe();
}
function unsubscribeRoom(){ if(_ch){ try{ _ch.unsubscribe(); }catch(e){} _ch=null; } }
async function loadRoom(code){
  if(!_db) return null;
  try{ const{data,error}=await _db.from('rooms').select('payload').eq('code',code).maybeSingle();
    if(error){ console.error(error); return null; } return data?data.payload:null; }catch(e){ console.error(e); return null; }
}
async function saveRoom(room){
  if(!_db) return false; room.v=(room.v||0)+1;
  try{ const{error}=await _db.from('rooms').upsert({code:room.code,payload:room,v:room.v,updated_at:new Date().toISOString()},{onConflict:'code'});
    if(error){ console.error(error); return false; } return true; }catch(e){ console.error(e); return false; }
}
function getMyPid(c){ return localStorage.getItem('cc_pid_'+c); }
function setMyPid(c,pid){ localStorage.setItem('cc_pid_'+c,pid); }
async function act(mutator){
  if(!S.code) return; S.busy=true; render();
  const fresh=await loadRoom(S.code);
  if(!fresh){ S.busy=false; alert('Room not found.'); return; }
  mutator(fresh); const ok=await saveRoom(fresh);
  S.busy=false; if(ok){ S.room=fresh; render(); }
}

/* IMAGES */
/* ═══════════════════════════════════════════════════════
   CARD DATABASE — loaded from the real card set
   Source priority:
     1. window.CATA_CARDS  (cards-data.js — exported from Card Studio)
     2. localStorage 'ca_cards_db'  (in-progress Card Studio data)
   Each card: {id,img,name,faction,type,sub?,level?,hp?,atkCost?,atk?,cost?,keywords?,text?}
═══════════════════════════════════════════════════════ */
const IMG_BASE='https://raw.githubusercontent.com/ctest9104-tech/cataclysm-assets/main/images/';
const FBG={synth:'#1f0d02',mystic:'#0f0520',shifter:'#040c1a',survivor:'#050f08',apex:'#130d00',neutral:'#141414',token:'#0d0a07'};
const FCOL={synth:'#FF6D23',mystic:'#9B59B6',shifter:'#4A9EE8',survivor:'#76C442',apex:'#F0B429',neutral:'#aaa'};

const CARDS={};

function ingestCard(o){
  if(!o||!o.id)return;
  const c={
    id:o.id, img:o.img||(o.id+'.webp'), name:o.name||o.id,
    faction:o.faction||'neutral', type:o.type||'fighter',
    kind:(o.type==='boss'||o.type==='token')?(o.type==='boss'?'boss':'fighter'):(o.type==='fighter'?'fighter':o.type),
    sub:o.sub||'', text:o.text||'',
    keywords:o.keywords||[]
  };
  if(o.level!==undefined&&o.level!=='')c.level=Number(o.level);
  if(o.hp!==undefined&&o.hp!=='')c.hp=Number(o.hp);
  if(o.atkCost!==undefined&&o.atkCost!=='')c.atkCost=Number(o.atkCost);
  if(o.atk!==undefined&&o.atk!=='')c.atk=Number(o.atk);
  if(o.cost!==undefined&&o.cost!=='')c.cost=Number(o.cost);
  if(o.speed)c.speed=o.speed; else if(o.type==='response')c.speed='instant'; else if(o.type==='tactic')c.speed='sorcery';
  /* sensible defaults so the engine never breaks on missing numbers */
  if(c.kind==='fighter'||c.kind==='boss'){ if(c.hp===undefined)c.hp=1; if(c.atk===undefined)c.atk=0; if(c.atkCost===undefined)c.atkCost=0; }
  if(c.cost===undefined)c.cost=0;
  if(c.level===undefined&&(c.type==='fighter'||c.type==='weapon'))c.level=1;
  CARDS[c.id]=c;
}

function loadCardDatabase(){
  let arr=null;
  if(typeof window!=='undefined'&&Array.isArray(window.CATA_CARDS)&&window.CATA_CARDS.length){
    arr=window.CATA_CARDS;
  }else{
    try{
      const raw=localStorage.getItem('ca_cards_db');
      if(raw){const db=JSON.parse(raw);arr=Object.keys(db).filter(k=>db[k]&&db[k].name&&db[k].faction&&db[k].type&&!db[k]._skip).map(k=>Object.assign({id:k},db[k]));}
    }catch(e){console.error('card db load',e);}
  }
  if(arr&&arr.length){arr.forEach(ingestCard);console.log('Cataclysm: loaded '+Object.keys(CARDS).length+' cards.');}
  else{console.warn('Cataclysm: no card database found. Open card-studio.html to build it, or add cards-data.js.');}
}
loadCardDatabase();

/* Image element from a card's own img filename */
function artImg(cid,cls){
  const c=CARDS[cid];
  const src=c&&c.img?IMG_BASE+c.img:null;
  const fb=c&&FBG[c.faction]||'#0b0f14';
  return src
    ?`<img class="${cls}" src="${src}" loading="lazy" onerror="this.onerror=null;this.style.background='${fb}';this.removeAttribute('src')" alt="">`
    :`<div class="${cls}-fb" style="background:${fb}"></div>`;
}
const FACTION_META={synth:{name:'Synth',cls:'fc-synth'},mystic:{name:'Mystic',cls:'fc-mystic'},shifter:{name:'Shifter',cls:'fc-shifter'},survivor:{name:'Survivor',cls:'fc-survivor'},apex:{name:'Apex',cls:'fc-apex'}};
const KW_HELP={
  Enforcer:'Must be attacked before other Boss/Fighters on the team if able.',
  Block:'A Boss or Fighter attacks this Fighter instead (self-activated Response).',
  Fortify:'Instead of dying, placed under a non-Fortified Boss/Fighter, which gains HP equal to this card\'s Health.',
  Agility:'Can act (attack or activate) twice per level instead of once.',
  Stealthy:'Can\'t be attacked the level it enters play.',
  Armor:'Prevents a fixed amount of damage each level.',
  Stun:'Stunned cards can\'t tap or activate abilities this level.',
  Transform:'Destroy this Fighter, then search for and play a Fighter of equal or lower level with a different name; shuffle.'
};

/* UTILS */
function uid(n){n=n||8;const c='ABCDEFGHJKMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<n;i++)s+=c[Math.floor(Math.random()*c.length)];return s;}
function roomCode(){return uid(5);}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}return a;}
function poolForFactions(factions){return Object.values(CARDS).filter(c=>c.type!=='token'&&factions.includes(c.faction));}

/* CLIENT STATE */
let S={screen:'home',name:'',codeInput:'',code:null,myId:null,room:null,busy:false,helpOpen:false,attackPick:null,pendingCb:null,zoomCid:null};

/* ENGINE HELPERS */
function log(gp,msg){gp.log=gp.log||[];gp.log.push(msg);if(gp.log.length>80)gp.log.shift();}
function allBoard(gp){let r=[];Object.keys(gp.p).forEach(pid=>{r=r.concat(gp.p[pid].board);if(gp.p[pid].boss)r.push(gp.p[pid].boss);});return r;}
function weaponAtk(gp,uid){const i=gp.inst[uid];if(!i)return 0;const c=CARDS[i.cid];if(!c)return 0;let v=c.atkMod||0;if(c.dynamicAtk)v=c.dynamicAtk(gp,uid);return v;}
function hasWieldedAgility(gp,uid){return(gp.inst[uid].wielded||[]).some(wu=>gp.inst[wu]&&CARDS[gp.inst[wu].cid]&&CARDS[gp.inst[wu].cid].grantsKeyword==='agility');}

function instSummary(gp,uid){
  const i=gp.inst[uid];if(!i)return null;const c=CARDS[i.cid];if(!c)return null;
  let atk=0;
  if(i.kind==='fighter'||i.kind==='boss'){
    atk=(c.atk||0)+(i.counters&&i.counters.atk||0)+(i.tempAtk||0);
    if(c.dynamicAtkBonus)atk+=c.dynamicAtkBonus(gp,uid);
    (i.wielded||[]).forEach(wu=>{atk+=weaponAtk(gp,wu);});
  }
  const maxActs=(i.agilityLevel||c.grantsKeyword==='agility'||hasWieldedAgility(gp,uid))?2:1;
  return{uid,cid:i.cid,name:c.name,faction:c.faction,kind:i.kind,hp:i.hp,maxHp:i.maxHp,
    atk:Math.max(0,atk),tapped:(i.actedCount||0)>=maxActs,
    keywords:(c.keywords||[]).concat(i.stunned?['Stunned']:[]).concat(i.phantasmal?['Phantasmal']:[]),
    enterLevel:i.enterLevel,dead:i.hp<=0};
}
function resetInstance(gp,uid){
  const i=gp.inst[uid];if(!i)return;const c=CARDS[i.cid];if(!c)return;
  i.hp=c.hp||1;i.maxHp=c.hp||1;i.counters=Object.assign({},c.startCounters||{});
  i.tempAtk=0;i.actedCount=0;i.agilityLevel=false;i.stunned=false;
  i.wielded=[];i.wieldedBy=null;i.fortifiedUnder=null;i.dmgThisLevel=false;
  i.enterLevel=gp.level||1;i.phantasmal=false;i.costOverrideLevel=undefined;
}
function newInstance(gp,cardId,owner){
  const u=uid(10);const c=CARDS[cardId];
  gp.inst[u]={uid:u,cid:cardId,owner,kind:c.kind||c.type,counters:{},wielded:[]};
  resetInstance(gp,u);return u;
}
function moveZone(gp,pid,u,from,to){
  if(!gp.p[pid])return;
  const rm=arr=>arr.filter(x=>x!==u);
  if(from==='hand')gp.p[pid].hand=rm(gp.p[pid].hand);
  if(from==='board')gp.p[pid].board=rm(gp.p[pid].board);
  if(from==='grave')gp.p[pid].grave=rm(gp.p[pid].grave);
  if(from==='deck')gp.p[pid].deck=rm(gp.p[pid].deck);
  if(to==='hand')gp.p[pid].hand.push(u);
  if(to==='board')gp.p[pid].board.push(u);
  if(to==='grave')gp.p[pid].grave.push(u);
  if(to==='deck-top')gp.p[pid].deck.unshift(u);
}
function drawN(gp,pid,n){for(let i=0;i<n;i++){const d=gp.p[pid].deck;if(!d.length)continue;gp.p[pid].hand.push(d.shift());}}
function spendCoins(gp,pid,n){if(gp.p[pid].coins<n)return false;gp.p[pid].coins-=n;return true;}
function healInst(gp,uid,amt){const i=gp.inst[uid];if(!i)return;const c=CARDS[i.cid];if(!c)return;i.hp=Math.min(i.maxHp,i.hp+amt);log(gp,c.name+' heals '+amt+'.');}
function addCounter(gp,uid,type,amt){
  const i=gp.inst[uid];if(!i)return;const c=CARDS[i.cid];
  i.counters=i.counters||{};i.counters[type]=(i.counters[type]||0)+amt;
  if(type==='atk'&&amt>0){const pid=i.owner;(gp.p[pid].board.concat([gp.p[pid].boss])).forEach(u=>{if(u&&gp.inst[u]&&CARDS[gp.inst[u].cid]&&CARDS[gp.inst[u].cid].onCounterPlaced)CARDS[gp.inst[u].cid].onCounterPlaced(gp,pid);});}
  log(gp,(c?c.name:'?')+' gets '+type+' counter ('+(amt>0?'+':'')+amt+').');
}
function createToken(gp,pid,tokenId){const u=newInstance(gp,tokenId,pid);gp.p[pid].board.push(u);log(gp,gp.p[pid].name+' creates '+CARDS[tokenId].name+'.');return u;}
function wieldWeapon(gp,wUid,fUid){
  const w=gp.inst[wUid];if(!w||!gp.inst[fUid])return;
  w.wieldedBy=fUid;gp.inst[fUid].wielded=gp.inst[fUid].wielded||[];gp.inst[fUid].wielded.push(wUid);
  const c=CARDS[w.cid];if(c&&c.onWield)c.onWield(gp,{pid:w.owner,src:wUid});
  const owner=w.owner;if(gp.p[owner]&&gp.p[owner].boss&&gp.inst[gp.p[owner].boss]&&gp.inst[gp.p[owner].boss].cid==='toolshed')CARDS.toolshed.onWeaponEnter(gp,{pid:owner});
  log(gp,CARDS[w.cid].name+' wielded to '+CARDS[gp.inst[fUid].cid].name+'.');
}
function fireOnEnter(gp,uid,pid){const i=gp.inst[uid];if(!i)return;const c=CARDS[i.cid];if(c&&c.onEnter)c.onEnter(gp,{pid,src:uid});}
function destroyInstance(gp,uid,opts){
  const i=gp.inst[uid];if(!i)return;const c=CARDS[i.cid];if(!c)return;const pid=i.owner;
  if(c.fortifyInstead&&!(opts&&opts.skipFortify)){
    const cands=(gp.p[pid].board.concat([gp.p[pid].boss])).filter(u=>u&&u!==uid&&gp.inst[u]&&!gp.inst[u].fortifiedUnder&&(gp.inst[u].kind==='fighter'||gp.inst[u].kind==='boss')&&gp.inst[u].hp>0);
    if(cands.length){const t=cands[0];gp.inst[t].maxHp+=i.maxHp;gp.inst[t].hp+=i.maxHp;i.fortifiedUnder=t;gp.p[pid].board=gp.p[pid].board.filter(x=>x!==uid);log(gp,c.name+' Fortifies under '+CARDS[gp.inst[t].cid].name+'.');return;}
  }
  if(i.kind==='fighter')gp.fighterLeftThisLevel=true;
  moveZone(gp,pid,uid,'board','grave');
  if(c.onDeath)c.onDeath(gp,{pid});
  allBoard(gp).forEach(u=>{if(gp.inst[u]&&CARDS[gp.inst[u].cid]&&CARDS[gp.inst[u].cid].onAnyFighterDeath&&i.kind==='fighter')CARDS[gp.inst[u].cid].onAnyFighterDeath(gp,u);});
  log(gp,c.name+' is destroyed.');checkWin(gp);
}
function dealDamage(gp,uid,amt){
  const i=gp.inst[uid];if(!i||i.hp<=0)return;const c=CARDS[i.cid];if(!c)return;
  let reduced=amt;if(c.armor)reduced=Math.max(0,amt-c.armor);
  i.hp-=reduced;i.dmgThisLevel=true;
  log(gp,c.name+' takes '+reduced+' damage'+(c.armor&&reduced<amt?' (Armor)':'')+'.');
  if(i.hp<=0)destroyInstance(gp,uid);else checkWin(gp);
}
function pendTarget(gp,opts,cb){
  const valid=allBoard(gp).filter(u=>{const s=instSummary(gp,u);if(!s||s.dead)return false;return opts.filter(Object.assign({},s,{owner:gp.inst[u].owner,cid:gp.inst[u].cid}));});
  gp.pending={kind:'target',forId:opts.forId,prompt:opts.prompt,valid};S.pendingCb=cb;
}
function pendPick(gp,opts,cb){gp.pending={kind:'pick',forId:opts.forId,prompt:opts.prompt,options:opts.options};S.pendingCb=cb;}
function pendDiscardOptional(gp,ctx,prompt,cb){
  gp.pending={kind:'discard',forId:ctx.pid,prompt,options:gp.p[ctx.pid].hand.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})).concat([{label:'Skip',value:''}])};
  S.pendingCb=(gp2,v)=>cb(gp2,Object.assign({},ctx),v||null);
}
function cancelPendingAttack(gp){gp.pendingAttack=null;}
function resumeAttack(gp,ctx){finishAttackDamage(gp,ctx);}

/* GAME SETUP */
function startGame(room){
  const gp={level:1,order:room.players.map(p=>p.id),firstIdx:0,curIdx:0,passedSet:[],p:{},inst:{},pending:null,winner:null,log:[],fighterLeftThisLevel:false,ignoreStealthyLevel:false};
  room.players.forEach(pl=>{
    gp.p[pl.id]={name:pl.name,coins:0,hand:[],board:[],grave:[],deck:[],boss:null,mullUsed:false,defeated:false};
    const bossUid=newInstance(gp,pl.bossId,pl.id);gp.p[pl.id].boss=bossUid;
    const lib=[];Object.entries(pl.list||{}).forEach(([cid,n])=>{for(let i=0;i<n;i++)lib.push(newInstance(gp,cid,pl.id));});
    gp.p[pl.id].deck=shuffle(lib);drawN(gp,pl.id,room.settings.startHand);
  });
  dealLevelCoins(gp,room.settings);room.game=gp;room.phase='play';log(gp,'Game started. Level 1 begins.');
}
function dealLevelCoins(gp,settings){Object.keys(gp.p).forEach(pid=>{if(!gp.p[pid].defeated)gp.p[pid].coins+=gp.level;});}
function levelStart(gp,settings){
  gp.fighterLeftThisLevel=false;gp.ignoreStealthyLevel=false;
  Object.keys(gp.p).forEach(pid=>{
    if(gp.p[pid].defeated)return;
    gp.p[pid].board.concat([gp.p[pid].boss]).forEach(u=>{if(!u)return;const i=gp.inst[u];if(!i)return;i.actedCount=0;i.tempAtk=0;i.costOverrideLevel=undefined;if(i.stunned)i.stunned=false;});
    const hadNone=gp.p[pid].hand.length===0;
    drawN(gp,pid,settings.drawPerLevel||1);
    if(hadNone&&gp.inst[gp.p[pid].boss]&&gp.inst[gp.p[pid].boss].cid==='trapper')drawN(gp,pid,1);
    const bossDef=gp.inst[gp.p[pid].boss]&&CARDS[gp.inst[gp.p[pid].boss].cid];
    if(bossDef&&bossDef.onLevelStart)bossDef.onLevelStart(gp,pid);
    gp.p[pid].board.forEach(u=>{const c=gp.inst[u]&&CARDS[gp.inst[u].cid];if(c&&c.onLevelStart)c.onLevelStart(gp,pid);});
  });
  Object.keys(gp.p).forEach(pid=>{gp.p[pid].board.slice().forEach(u=>{if(gp.inst[u]&&CARDS[gp.inst[u].cid]&&CARDS[gp.inst[u].cid].diesEndOfLevel)destroyInstance(gp,u,{skipFortify:true});});});
  dealLevelCoins(gp,settings);
}
/* FIX: use passedSet — track WHO passed, not how many; only call nextTurn if NOT advancing */
function advanceLevel(gp,settings){
  Object.keys(gp.p).forEach(pid=>{gp.p[pid].coins=0;});
  gp.level++;
  gp.firstIdx=(gp.firstIdx+1)%gp.order.length;
  while(gp.p[gp.order[gp.firstIdx]].defeated)gp.firstIdx=(gp.firstIdx+1)%gp.order.length;
  gp.curIdx=gp.firstIdx;gp.passedSet=[];
  levelStart(gp,settings);log(gp,'\u2014 Level '+gp.level+' begins \u2014');
}
function activePlayers(gp){return gp.order.filter(p=>!gp.p[p].defeated);}
function nextTurn(gp){const ord=gp.order;let idx=gp.curIdx;do{idx=(idx+1)%ord.length;}while(gp.p[ord[idx]].defeated);gp.curIdx=idx;}
function checkWin(gp){
  Object.keys(gp.p).forEach(pid=>{if(!gp.p[pid].defeated&&gp.inst[gp.p[pid].boss]&&gp.inst[gp.p[pid].boss].hp<=0)gp.p[pid].defeated=true;});
  const left=activePlayers(gp);
  if(left.length<=1&&!gp.winner){gp.winner=left[0]||'draw';log(gp,left[0]?(gp.p[left[0]].name+' wins!'):'Draw!');}
}
function transformInstance(gp,uid){
  const i=gp.inst[uid];if(!i)return;const pid=i.owner;const lvl=CARDS[i.cid].level||0;const origName=CARDS[i.cid].name;
  destroyInstance(gp,uid,{skipFortify:true});
  const pool=gp.p[pid].deck.filter(u=>{const c=gp.inst[u]&&CARDS[gp.inst[u].cid];return c&&c.kind==='fighter'&&(c.level||0)<=lvl&&c.name!==origName;});
  if(!pool.length){log(gp,'Transform found no eligible Fighter.');return;}
  const pick=pool[Math.floor(Math.random()*pool.length)];
  gp.p[pid].deck=gp.p[pid].deck.filter(u=>u!==pick);gp.p[pid].board.push(pick);resetInstance(gp,pick);fireOnEnter(gp,pick,pid);
  gp.p[pid].deck=shuffle(gp.p[pid].deck);log(gp,'Transformed into '+CARDS[gp.inst[pick].cid].name+'.');
}

/* COMBAT */
function effectiveAtkCost(gp,uid){
  const i=gp.inst[uid];if(!i)return 0;const c=CARDS[i.cid];if(!c)return 0;
  let cost=i.costOverrideLevel!==undefined?i.costOverrideLevel:(c.atkCost||0);
  if(c.faction==='synth'&&i.cid!=='dreyver'&&gp.p[i.owner].board.some(u=>gp.inst[u]&&gp.inst[u].cid==='dreyver'&&gp.inst[u].hp>0))cost=Math.max(1,cost-1);
  return Math.max(0,cost);
}
function canAct(gp,uid){const i=gp.inst[uid];if(!i)return false;const c=CARDS[i.cid];if(!c)return false;const maxActs=(i.agilityLevel||c.grantsKeyword==='agility'||hasWieldedAgility(gp,uid))?2:1;if(i.stunned)return false;return(i.actedCount||0)<maxActs;}
function validDefenders(gp,attackerOwner,attackerCid){
  if(!attackerCid)return[];const c=CARDS[attackerCid];if(!c)return[];let targets=[];
  Object.keys(gp.p).forEach(pid=>{
    if(pid===attackerOwner||gp.p[pid].defeated)return;
    const enf=gp.p[pid].board.filter(u=>gp.inst[u]&&gp.inst[u].hp>0&&(CARDS[gp.inst[u].cid].keywords||[]).includes('Enforcer'));
    if(enf.length&&!(c.atkFlags&&c.atkFlags.ignoreEnforcer)){targets=targets.concat(enf);return;}
    gp.p[pid].board.forEach(u=>{
      const i=gp.inst[u];if(!i||i.hp<=0)return;const cc=CARDS[i.cid];if(!cc)return;
      if((cc.keywords||[]).includes('Stealthy')&&i.enterLevel===gp.level&&!gp.ignoreStealthyLevel)return;
      if(cc.cantBeAttackedIfTokenAlive&&gp.p[pid].board.some(u2=>gp.inst[u2]&&CARDS[gp.inst[u2].cid].id===cc.cantBeAttackedIfTokenAlive&&gp.inst[u2].hp>0))return;
      targets.push(u);
    });
    if(gp.p[pid].boss&&gp.inst[gp.p[pid].boss]&&gp.inst[gp.p[pid].boss].hp>0)targets.push(gp.p[pid].boss);
  });
  return targets;
}
function declareAttack(gp,atkUid,defUid,ctxPid){
  const cost=effectiveAtkCost(gp,atkUid);if(!spendCoins(gp,ctxPid,cost))return false;
  gp.inst[atkUid].actedCount=(gp.inst[atkUid].actedCount||0)+1;gp.passedSet=[];
  const ctx={pid:ctxPid,attacker:atkUid,defender:defUid};
  const c=CARDS[gp.inst[atkUid].cid];
  if(c.preAttack){c.preAttack(gp,ctx);return true;}
  finishAttackDamage(gp,ctx);return true;
}
function finishAttackDamage(gp,ctx){
  const s=instSummary(gp,ctx.attacker);if(!s)return;const dmg=s.atk;
  dealDamage(gp,ctx.defender,dmg);
  (gp.inst[ctx.attacker].wielded||[]).forEach(wu=>{const wc=CARDS[gp.inst[wu].cid];if(wc&&wc.onWielderDealtDamage)wc.onWielderDealtDamage(gp,ctx.attacker,dmg);});
  const ac=CARDS[gp.inst[ctx.attacker].cid];if(ac&&ac.onAttack)ac.onAttack(gp,{pid:ctx.pid,src:ctx.attacker});
  log(gp,ac.name+' attacks for '+dmg+' damage.');
}

/* UI ACTIONS */
window.createRoom=async function(){
  if(!S.name.trim())return alert('Enter a username first.');
  const code=roomCode();const pid=uid(8);
  const room={code,hostId:pid,phase:'lobby',settings:{startHand:5,drawPerLevel:1},players:[{id:pid,name:S.name,ready:false,factions:[],bossId:null,list:{}}],game:null,v:0,log:[]};
  S.busy=true;render();const ok=await saveRoom(room);S.busy=false;
  if(!ok)return alert('Could not connect to Supabase. Check credentials.');
  setMyPid(code,pid);S.code=code;S.myId=pid;S.room=room;S.screen='lobby';
  history.replaceState({},'','?room='+code);subscribeToRoom(code);render();
};
window.joinRoom=async function(){
  if(!S.name.trim())return alert('Enter a username first.');
  const code=S.codeInput.trim().toUpperCase();if(!code)return alert('Enter a room code.');
  S.busy=true;render();const room=await loadRoom(code);S.busy=false;
  if(!room)return alert('Room not found. Check the code.');
  let pid=getMyPid(code);const existing=pid&&room.players.find(p=>p.id===pid);
  if(!existing&&room.phase!=='lobby')return alert('That game has already started.');
  if(!existing){pid=uid(8);room.players.push({id:pid,name:S.name,ready:false,factions:[],bossId:null,list:{}});await saveRoom(room);setMyPid(code,pid);}
  S.code=code;S.myId=pid;S.room=room;S.screen='lobby';
  history.replaceState({},'','?room='+code);subscribeToRoom(code);render();
};
window.startBuild=async function(){await act(r=>{r.phase='build';});};
window.toggleFaction=async function(f){await act(r=>{const me=r.players.find(p=>p.id===S.myId);const i=me.factions.indexOf(f);if(i>=0)me.factions.splice(i,1);else{if(me.factions.length>=2)me.factions.shift();me.factions.push(f);}me.bossId=null;me.list={};});};
window.pickBoss=async function(cid){await act(r=>{r.players.find(p=>p.id===S.myId).bossId=cid;});};
window.adjustCard=async function(cid,delta){await act(r=>{const me=r.players.find(p=>p.id===S.myId);const cur=me.list[cid]||0;const next=Math.max(0,Math.min(3,cur+delta));const total=Object.entries(me.list).reduce((s,[k,v])=>s+(k===cid?0:v),0)+next;if(next>cur&&total>39)return;me.list[cid]=next;if(!me.list[cid])delete me.list[cid];});};
window.markReady=async function(){await act(r=>{const me=r.players.find(p=>p.id===S.myId);const total=Object.values(me.list).reduce((a,b)=>a+b,0);if(!me.bossId)return alert('Pick a Boss first.');if(total!==39)return alert('You need exactly 39 non-Boss cards (currently '+total+').');me.ready=true;});};
window.unready=async function(){await act(r=>{r.players.find(p=>p.id===S.myId).ready=false;});};
window.beginGame=async function(){await act(r=>{startGame(r);});};
window.doMulligan=async function(){await act(r=>{const gp=r.game;const pid=S.myId;if(gp.p[pid].mullUsed)return;const hand=gp.p[pid].hand.slice();gp.p[pid].deck=shuffle(gp.p[pid].deck.concat(hand));gp.p[pid].hand=[];drawN(gp,pid,r.settings.startHand);gp.p[pid].mullUsed=true;log(gp,gp.p[pid].name+' mulligans.');});};
window.playHandCard=async function(u){
  await act(r=>{const gp=r.game;const pid=S.myId;const c=CARDS[gp.inst[u].cid];
    if(gp.curIdx!==gp.order.indexOf(pid)&&c.speed!=='instant')return alert('Not your turn.');
    if(gp.p[pid].coins<(c.cost||0))return alert('Not enough coins.');
    if(c.type==='fighter'){if((c.level||0)>gp.level)return alert('Level requirement not met (need Lvl '+(c.level)+').');
      spendCoins(gp,pid,c.cost||0);moveZone(gp,pid,u,'hand','board');resetInstance(gp,u);fireOnEnter(gp,u,pid);gp.passedSet=[];}
    else if(c.type==='weapon'){if((c.level||0)>gp.level)return alert('Level requirement not met.');
      if(!gp.p[pid].board.filter(x=>gp.inst[x]&&gp.inst[x].kind==='fighter').length)return alert('No Fighter to wield this to.');
      spendCoins(gp,pid,c.cost||0);moveZone(gp,pid,u,'hand','board');gp.passedSet=[];
      pendTarget(gp,{forId:pid,prompt:'Wield '+c.name+' to which Fighter?',filter:i=>i.kind==='fighter'&&i.owner===pid},(gp2,fUid)=>wieldWeapon(gp2,u,fUid));}
    else{spendCoins(gp,pid,c.cost||0);moveZone(gp,pid,u,'hand','grave');gp.passedSet=[];
      if(c.run)c.run(gp,{pid});else log(gp,c.name+' played \u2014 resolve manually: "'+c.text+'"');}
    if(!gp.pending)nextTurn(gp);});
};
window.startAttack=function(u){S.attackPick=u;render();};
window.cancelAttackPick=function(){S.attackPick=null;render();};
window.confirmAttack=async function(defUid){
  const atkUid=S.attackPick;S.attackPick=null;
  await act(r=>{const gp=r.game;const pid=S.myId;
    if(gp.curIdx!==gp.order.indexOf(pid))return alert('Not your turn.');
    if(!canAct(gp,atkUid))return alert('That unit can\'t act again this level.');
    if(!declareAttack(gp,atkUid,defUid,pid))return alert('Not enough coins to attack.');
    if(!gp.pending)nextTurn(gp);});
};
window.useAbility=async function(u,idx){
  await act(r=>{const gp=r.game;const pid=S.myId;
    if(gp.curIdx!==gp.order.indexOf(pid))return alert('Not your turn.');
    const i=gp.inst[u];const c=CARDS[i.cid];let ab=(c.activated||[])[idx];let wAb=null;
    if(ab===undefined){(i.wielded||[]).forEach(wu=>{const wc=CARDS[gp.inst[wu].cid];([...(wc.weaponActivated||[]),(wc.grantsActivated||[])]).flat().forEach((a,ai)=>{if(('w'+wu+ai)===String(idx))wAb=a;});});}
    const useAb=ab||wAb;if(!useAb)return;
    if(useAb.cost.tap&&!canAct(gp,u))return alert('Already acted this level.');
    if(useAb.cost.coins&&!spendCoins(gp,pid,useAb.cost.coins))return alert('Not enough coins.');
    if(useAb.cost.tap)i.actedCount=(i.actedCount||0)+1;
    if(useAb.cost.sacrifice)destroyInstance(gp,u,{skipFortify:true});
    if(useAb.cost.selfDamage){i.hp-=useAb.cost.selfDamage;if(i.hp<=0)destroyInstance(gp,u);}
    gp.passedSet=[];useAb.run(gp,{pid,src:u});if(!gp.pending)nextTurn(gp);});
};
/* THE BIG FIX: passedSet tracks who passed; only nextTurn if NOT advancing */
window.passTurn=async function(){
  await act(r=>{const gp=r.game;const pid=S.myId;
    if(gp.curIdx!==gp.order.indexOf(pid))return alert('Not your turn.');
    if(!gp.passedSet)gp.passedSet=[];
    if(!gp.passedSet.includes(pid))gp.passedSet.push(pid);
    const active=activePlayers(gp);
    if(active.every(p=>gp.passedSet.includes(p))){
      advanceLevel(gp,r.settings); /* passedSet reset inside advanceLevel */
    }else{
      nextTurn(gp); /* Only move turn if NOT advancing level */
    }
  });
};
window.resolvePending=async function(val){
  await act(r=>{const gp=r.game;const cb=S.pendingCb;gp.pending=null;S.pendingCb=null;if(cb)cb(gp,val);});
};
window.returnToLobby=async function(){await act(r=>{r.phase='lobby';r.players.forEach(p=>p.ready=false);r.game=null;});};
window.leaveTable=function(){unsubscribeRoom();history.replaceState({},'',window.location.pathname);S.screen='home';S.code=null;S.room=null;S.myId=null;render();};
window.toggleHelp=function(){S.helpOpen=!S.helpOpen;render();};
window.copyCode=function(){const url=window.location.origin+window.location.pathname+'?room='+S.code;try{navigator.clipboard.writeText(url);}catch(e){const t=document.createElement('textarea');t.value=url;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);}};
window.showZoom=function(cid){S.zoomCid=cid;render();};
window.closeZoom=function(){S.zoomCid=null;render();};


/* ═══ RENDER — TCG ARENA TABLE STYLE ═══ */
function pendingForMe(gp){return gp.pending&&gp.pending.forId===S.myId?gp.pending:null;}

function bCard(gp,uid,opts){
  opts=opts||{};const{myTurn,pend,isOpp}=opts;
  const i=gp.inst[uid];if(!i)return'';
  const s=instSummary(gp,uid);if(!s||s.dead)return'';
  const c=CARDS[i.cid];const fCol=FCOL[c.faction]||'#888';
  const isAtkTgt=!!(S.attackPick&&gp.inst[S.attackPick]&&validDefenders(gp,gp.inst[S.attackPick].owner,gp.inst[S.attackPick].cid).includes(uid));
  const isPendTgt=!!(pend&&pend.kind==='target'&&(pend.valid||[]).includes(uid));
  const clickable=isAtkTgt||isPendTgt;
  let cls='bcard'+(s.kind==='boss'?' is-boss':'')+(s.tapped?' is-tapped':'')+(clickable?' is-target':'')+(s.keywords.includes('Stunned')?' is-stun':'');
  const clickFn=isAtkTgt?`confirmAttack('${uid}')`:(isPendTgt?`resolvePending('${uid}')`:null);
  const wNames=(i.wielded||[]).filter(wu=>gp.inst[wu]).map(wu=>CARDS[gp.inst[wu].cid].name).join(', ');
  let actBtns='';
  if(!isOpp&&myTurn&&!pend&&!S.attackPick){
    if(!s.tapped)actBtns+=`<button class="bcard-btn atk-btn" onclick="startAttack('${uid}')">&#9876; ATK</button>`;
    (c.activated||[]).forEach((ab,idx)=>{actBtns+=`<button class="bcard-btn ab-btn" onclick="useAbility('${uid}',${idx})" title="${ab.label}">${ab.label.slice(0,16)}</button>`;});
    (i.wielded||[]).filter(wu=>gp.inst[wu]).forEach(wu=>{const wc=CARDS[gp.inst[wu].cid];([...(wc.weaponActivated||[]),(wc.grantsActivated||[])]).flat().forEach((ab,ai)=>{actBtns+=`<button class="bcard-btn ab-btn" onclick="useAbility('${uid}','w${wu}${ai}')" title="${ab.label}">${ab.label.slice(0,16)}</button>`;});});
  }
  return`<div class="zone-wrap"><div class="${cls}" style="border-color:${clickable?'var(--ap)':fCol+'40'}"${clickFn?` onclick="${clickFn}"`:''}
    oncontextmenu="showZoom('${i.cid}');return false">
    ${artImg(i.cid,'bcard-art')}
    <div class="bcard-strip">
      <div class="bcard-name" style="color:${fCol}">${s.name}</div>
      <div class="bcard-stats"><span class="b-hp">&#10084;${s.hp}/${s.maxHp}</span><span class="b-atk">&#9876;${s.atk}</span></div>
      ${s.keywords.length?`<div class="bcard-kw">${s.keywords.map(k=>`<span class="bdg${k==='Enforcer'?' en':k==='Stunned'?' st':''}">${k.slice(0,3)}</span>`).join('')}</div>`:''}
      ${wNames?`<div class="bcard-wield">&#128481;${wNames}</div>`:''}
    </div>
    ${actBtns?`<div class="bcard-acts">${actBtns}</div>`:''}
  </div><div class="zone-tag">${s.kind==='boss'?'BOSS':c.type==='weapon'?'WPN':'FTR'}</div></div>`;
}

function hCard(gp,uid,myTurn,pend){
  const i=gp.inst[uid];if(!i)return'';const c=CARDS[i.cid];
  const fCol=FCOL[c.faction]||'#888';
  const canPlay=myTurn&&gp.p[S.myId].coins>=(c.cost||0)&&(!c.level||c.level<=gp.level)&&!pend&&!S.attackPick;
  const isInstant=c.speed==='instant'&&gp.p[S.myId].coins>=(c.cost||0)&&!pend;
  const playable=canPlay||isInstant;
  const typeChar=c.type==='fighter'?'F':c.type==='weapon'?'W':c.type==='tactic'?'T':'R';
  return`<div class="hcard${playable?'':' unplayable'}" style="border-color:${fCol}55"
    ${playable?`onclick="playHandCard('${uid}')"`:''}
    oncontextmenu="showZoom('${i.cid}');return false">
    ${artImg(i.cid,'hcard-art')}
    <div class="hcard-body">
      <div class="hcard-name" style="color:${fCol}">${c.name}</div>
      <div class="hcard-meta">${typeChar}${c.level?c.level:''} ${c.faction?c.faction.slice(0,3).toUpperCase():''}</div>
    </div>
    <div class="hcard-cost">${c.cost||0}</div>
    ${c.level?`<div class="hcard-level">L${c.level}</div>`:''}
    ${isInstant&&!canPlay?'<div class="hcard-instant">INST</div>':''}
  </div>`;
}

function bossHpPct(gp,pid){const b=gp.inst[gp.p[pid].boss];if(!b)return 0;return(b.hp/b.maxHp)*100;}

function playerStrip(gp,pid,isOpp){
  const p=gp.p[pid];const b=gp.inst[p.boss];
  const bBoss=b&&CARDS[b.cid];const bName=bBoss?bBoss.name:p.name;
  const isMyTurn=gp.curIdx===gp.order.indexOf(pid);
  const pct=bossHpPct(gp,pid);
  const hpLow=pct<35;
  return`<div class="player-strip${isOpp?' opp':''}">
    <div>
      <div class="player-name${isMyTurn?' is-turn':''}">${p.name}${p.defeated?' &#128128;':''}</div>
      <div class="small" style="font-size:8px;color:var(--dim)">${bName}</div>
    </div>
    <div class="hp-bar-wrap">
      <div class="hp-label">BOSS</div>
      <div class="hp-bar"><div class="hp-fill${hpLow?' low':pct===100?' full':''}" style="width:${pct}%"></div></div>
      <div class="hp-num">${b?b.hp:'?'}/${b?b.maxHp:'?'}</div>
    </div>
    ${!isOpp?`<div class="coin-badge">${p.coins}&#9711;</div>`:''}
    <div class="deck-count">&#127831;${p.deck.length}</div>
    <div class="hand-count">&#9997;${p.hand.length}</div>
    <div class="grv-count">&#128682;${p.grave.length}</div>
    ${isMyTurn&&!isOpp?'<div style="width:6px;height:6px;border-radius:50%;background:var(--ap);animation:tgt-pulse 1s infinite;flex-shrink:0"></div>':''}
  </div>`;
}

function renderZoom(){
  const cid=S.zoomCid;if(!cid||!CARDS[cid])return'';
  const c=CARDS[cid];const fCol=FCOL[c.faction]||'#888';
  const typeStr=c.type==='boss'?'BOSS':c.type==='fighter'?`FIGHTER L${c.level||'?'}`:c.type==='weapon'?`WEAPON L${c.level||'?'}`:c.type.toUpperCase()+(c.speed?' \u00b7 '+c.speed.toUpperCase():'');
  return`<div class="zoom-overlay" onclick="closeZoom()"><div class="zoom-card" onclick="event.stopPropagation()">
    ${artImg(cid,'zoom-art')}
    <div class="zoom-body">
      <div class="zoom-name" style="color:${fCol}">${c.name}</div>
      <div class="zoom-meta">${(c.faction||'').toUpperCase()} \u00b7 ${typeStr}${c.sub?' \u00b7 '+c.sub:''}</div>
      <div class="zoom-stats">
        ${c.hp?`<span class="z-hp">&#10084; ${c.hp}</span>`:''}
        ${c.atk!==undefined?`<span class="z-atk">&#9876; ${c.atk}</span>`:''}
        ${c.atkCost!==undefined?`<span class="z-cost">ATK ${c.atkCost}&#9711;</span>`:''}
        ${c.cost!==undefined&&c.type!=='boss'?`<span class="z-cost">COST ${c.cost}&#9711;</span>`:''}
      </div>
      <div class="zoom-text">${c.text||''}</div>
      ${(c.keywords||[]).length?`<div class="zoom-kw">Keywords: ${c.keywords.join(', ')}</div>`:''}
    </div>
    <div class="zoom-footer">
      <div class="small">Right-click any card to inspect</div>
      <button class="btn ghost sm" onclick="closeZoom()">&#10005; Close</button>
    </div>
  </div></div>`;
}

function renderHelp(){
  let h='<div class="overlay" onclick="if(event.target===this)toggleHelp()"><div class="modal"><h3>KEYWORD REFERENCE</h3>';
  Object.entries(KW_HELP).forEach(([k,v])=>{h+=`<div class="kw-entry"><b>${k}</b><p>${v}</p></div>`;});
  h+='<p style="margin-top:12px;font-size:9px;color:var(--dim)">Cards marked "(Manual)" resolve via group agreement. Right-click any card in-game for full details.</p>';
  h+='<button class="btn ghost sm" style="margin-top:12px" onclick="toggleHelp()">Close</button></div></div>';
  return h;
}

function renderHome(){
  return`<div class="center-box">
    <h1>CATACLYSM<br>ARCADE</h1>
    <div class="sub">Online Table</div>
    <div class="field"><label>USERNAME</label><input value="${S.name}" oninput="S.name=this.value" placeholder="Your name" style="width:100%"></div>
    <button class="btn" style="width:100%;margin-bottom:12px" onclick="createRoom()">HOST NEW TABLE</button>
    <div class="small" style="margin:10px 0">&#8212; or join existing &#8212;</div>
    <div class="field"><label>ROOM CODE</label><input value="${S.codeInput}" oninput="S.codeInput=this.value.toUpperCase()" placeholder="ABCDE" style="width:100%;text-transform:uppercase"></div>
    <button class="btn ghost" style="width:100%;margin-bottom:16px" onclick="joinRoom()">JOIN TABLE</button>
    <div class="small" style="line-height:1.8">2+ players &#8226; Pick 1&#8211;2 factions &#8226; Build 39-card deck &#8226; Destroy all opponents&#39; Bosses to win&#10;&#10;Right-click any card during gameplay for full details</div>
  </div>`;
}

function renderLobby(){
  const r=S.room;const isHost=r.hostId===S.myId;
  const url=window.location.origin+window.location.pathname+'?room='+r.code;
  let h=`<div class="wrap"><div class="center-box" style="margin-top:20px">
    <div class="small" style="margin-bottom:8px;letter-spacing:.2em">SEND THIS LINK TO YOUR PLAYERS</div>
    <div class="copyrow"><div class="codebox">${r.code}</div><button class="btn sm ghost" onclick="copyCode()">Copy Link</button></div>
    <div class="invite-url">${url}</div>
  </div>
  <div class="section-h">AT THE TABLE (${r.players.length})</div>`;
  r.players.forEach(p=>{h+=`<div class="player-row"><span>${p.name}${p.id===r.hostId?' &#128081;':''}</span><span class="small">${p.id===S.myId?'(you)':''}</span></div>`;});
  if(isHost)h+=`<div style="margin-top:14px">${r.players.length>=2?'<button class="btn" onclick="startBuild()">START DECK BUILDING</button>':'<div class="small">Need at least 2 players.</div>'}</div>`;
  else h+='<div class="small" style="margin-top:14px">Waiting for the host to start&#8230;</div>';
  return h+'</div>';
}

function renderBuild(){
  const r=S.room;const me=r.players.find(p=>p.id===S.myId);
  const pool=poolForFactions(me.factions||[]);
  const bosses=pool.filter(c=>c.type==='boss');const nonBoss=pool.filter(c=>c.type!=='boss');
  const total=Object.values(me.list||{}).reduce((a,b)=>a+b,0);
  let h=`<div class="wrap"><h2 style="font-size:18px;margin-bottom:12px">DECK BUILDER</h2>
    <div class="section-h">1. CHOOSE UP TO 2 FACTIONS</div><div style="margin-bottom:8px">`;
  Object.entries(FACTION_META).forEach(([f,m])=>{const on=(me.factions||[]).includes(f);h+=`<span class="faction-chip ${m.cls}${on?' on':' off'}" onclick="toggleFaction('${f}')">${m.name}</span>`;});
  h+='</div>';
  if((me.factions||[]).length){
    h+='<div class="section-h">2. CHOOSE YOUR BOSS</div>';
    if(!bosses.length)h+='<div class="small" style="padding:8px">No bosses for this faction combo — try Synth or Mystic.</div>';
    h+='<div class="boss-pick">';
    bosses.forEach(b=>{h+=`<div class="boss2${me.bossId===b.id?' sel':''}" onclick="pickBoss('${b.id}')">
      ${artImg(b.id,'boss2-art')}
      <div class="boss2-body">
        <div class="boss2-name">${b.name}</div>
        <div class="boss2-stats"><span class="b2hp">&#10084;${b.hp}</span><span class="b2atk">&#9876;${b.atk}</span><span class="b2cost">ATK:${b.atkCost}&#9711;</span></div>
        <div class="boss2-text">${(b.text||'').slice(0,120)}</div>
      </div></div>`;});
    h+='</div><div class="section-h">3. BUILD 39 CARDS (MAX 3 COPIES EACH)</div>';
    h+=`<div class="build-summary">${total}/39 cards &nbsp;&#8226;&nbsp; ${Object.values(me.list||{}).filter(v=>v>0).length} unique cards<div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100,total/39*100)}%"></div></div></div>`;
    h+='<div class="deck-grid">';
    nonBoss.forEach(c=>{const n=(me.list||{})[c.id]||0;const fCol=FCOL[c.faction]||'#888';
      const typeStr=c.type==='fighter'?`FIGHTER L${c.level||'?'}`:c.type==='weapon'?`WEAPON L${c.level||'?'}`:c.type.toUpperCase()+(c.cost!==undefined?' \u00b7 '+c.cost+'\u29bb':'');
      h+=`<div class="dcard2">
        <div class="dcard2-art-wrap">${artImg(c.id,'dcard2-art')}<div class="dcard2-ftag" style="color:${fCol}">${(c.faction||'').toUpperCase()}</div></div>
        <div class="dcard2-info">
          <div class="dcard2-name" style="color:${fCol}">${c.name}</div>
          <div class="dcard2-meta">${typeStr}</div>
          <div class="dcard2-text">${(c.text||'').slice(0,95)}</div>
          <div class="qty-ctl"><button onclick="adjustCard('${c.id}',-1)">&#8722;</button><span class="n${n>0?' has':''}">${n}</span><button onclick="adjustCard('${c.id}',1)">+</button></div>
        </div>
        <button class="dcard2-ibtn" onclick="showZoom('${c.id}')">&#9432;</button>
      </div>`;
    });
    h+='</div>';
    h+=`<div style="margin-top:14px">${me.ready?'<button class="btn ghost" onclick="unready()">Edit Deck</button> <span class="small">&#10003; Ready</span>':'<button class="btn" onclick="markReady()">MARK READY</button>'}</div>`;
  }
  if(r.hostId===S.myId){const ar=r.players.length>=2&&r.players.every(p=>p.ready);
    h+=`<div style="margin-top:18px;border-top:1px solid var(--border);padding-top:14px">${ar?'<button class="btn" onclick="beginGame()">START GAME</button>':'<div class="small">All players must mark Ready.</div>'}</div>`;}
  return h+'</div>';
}

function renderPlay(){
  const r=S.room;const gp=r.game;
  if(gp.winner)return renderWinner(gp);
  const myTurn=gp.curIdx===gp.order.indexOf(S.myId);
  const pend=pendingForMe(gp);
  const myP=gp.p[S.myId];
  const opps=Object.keys(gp.p).filter(pid=>pid!==S.myId);

  let h=`<div id="game-table">`;

  /* Opponent strips + fields */
  opps.forEach(pid=>{
    h+=playerStrip(gp,pid,true);
    h+=`<div class="opp-field">`;
    if(gp.p[pid].boss)h+=bCard(gp,gp.p[pid].boss,{myTurn,pend,isOpp:true});
    if(gp.p[pid].board.length)h+=`<div class="boss-sep"></div>`;
    gp.p[pid].board.forEach(u=>{h+=bCard(gp,u,{myTurn,pend,isOpp:true});});
    if(!gp.p[pid].board.length&&!gp.p[pid].boss)h+='<div class="empty-field">DEFEATED</div>';
    h+=`<div class="field-label">OPPONENT FIELD</div></div>`;
  });

  /* My field */
  h+=`<div class="my-field">`;
  if(myP.boss)h+=bCard(gp,myP.boss,{myTurn,pend,isOpp:false});
  if(myP.board.length)h+=`<div class="boss-sep"></div>`;
  myP.board.forEach(u=>{h+=bCard(gp,u,{myTurn,pend,isOpp:false});});
  if(!myP.board.length&&!myP.boss)h+='<div class="empty-field">NO CARDS IN PLAY</div>';
  h+=`<div class="field-label">YOUR FIELD</div></div>`;

  /* My player strip */
  h+=playerStrip(gp,S.myId,false);

  /* Pending / attack action bar */
  if(pend){
    h+=`<div class="action-bar">&#9650; ${pend.prompt}`;
    if(pend.kind==='pick'||pend.kind==='discard')
      h+=`<div class="action-opts">${(pend.options||[]).map(o=>`<button class="action-opt" onclick="resolvePending('${(o.value||'').replace(/'/g,"&#39;")}')">${o.label}</button>`).join('')}</div>`;
    h+=`</div>`;
  }
  if(S.attackPick&&gp.inst[S.attackPick]){
    h+=`<div class="action-bar atk">&#9876; Attacking with <b>${CARDS[gp.inst[S.attackPick].cid].name}</b> — click a target above &nbsp; <button class="btn ghost sm" onclick="cancelAttackPick()">Cancel</button></div>`;
  }

  /* Hand strip */
  h+=`<div class="hand-strip">`;
  if(!myP.hand.length)h+='<div class="small" style="margin:auto;color:var(--dim)">Hand is empty</div>';
  myP.hand.forEach(u=>{h+=hCard(gp,u,myTurn,pend);});
  h+=`</div>`;

  /* HUD overlay */
  h+=`<div class="game-hud">
    <div class="hud-pill">
      <div><div class="hud-lbl">LEVEL</div><div class="hud-level">${gp.level}</div></div>
    </div>
    <div class="hud-pill" style="flex-direction:column;gap:4px;align-items:flex-end">
      ${myTurn&&!pend?`<button class="btn sm" onclick="passTurn()">PASS TURN</button>`:''}
      ${!myP.mullUsed?`<button class="btn ghost sm" onclick="doMulligan()">Mulligan</button>`:''}
      <button class="btn ghost sm" onclick="toggleHelp()">Keywords</button>
    </div>
  </div>`;

  /* Log */
  h+=`<div class="log-panel"><div class="log-head">GAME LOG</div><div class="log-body">`;
  (gp.log||[]).slice(-20).reverse().forEach(l=>{h+=`<div>${l}</div>`;});
  h+=`</div></div>`;

  h+='</div>';
  return h;
}

function renderWinner(gp){
  return`<div id="game-table"><div class="winner-screen">
    <h1>${gp.winner==='draw'?'DRAW!':(gp.p[gp.winner]?gp.p[gp.winner].name:'???')+' WINS!'}</h1>
    <div class="winner-sub">${gp.winner==='draw'?'ALL BOSSES FELL SIMULTANEOUSLY':'ALL OPPONENTS BOSSES DEFEATED'}</div>
    <button class="btn" onclick="returnToLobby()">Return to Lobby</button>
  </div></div>`;
}

function render(){
  const app=document.getElementById('app');
  if(Object.keys(CARDS).length===0){
    app.innerHTML='<div class="center-box" style="margin-top:60px"><h1 style="font-size:20px;color:var(--ap)">CARD DATABASE NEEDED</h1><div class="small" style="line-height:2;margin-top:14px">No cards are loaded yet.<br><br>Open <b>card-studio.html</b> to enter the real Cataclysm Arcade cards (name, stats &amp; abilities), then click <b>Export cards-data.js</b> and save it into your <b>public/</b> folder.<br><br>The game loads <b>cards-data.js</b> automatically on refresh.</div></div>';
    return;
  }
  if(!_db){
    app.innerHTML='<div class="center-box" style="margin-top:60px"><h1 style="font-size:20px;color:var(--red)">SETUP REQUIRED</h1><div class="small" style="line-height:2;margin-top:14px">Edit <b>game.js</b> and set your Supabase credentials.<br>Run <b>setup.sql</b> in the Supabase SQL Editor.</div></div>';
    return;
  }
  if(S.screen==='home'){app.innerHTML=renderHome()+(S.zoomCid?renderZoom():'');return;}
  let h=`<div id="topbar"><div class="code">TABLE ${S.code||''}</div><div style="display:flex;gap:8px"><button class="btn ghost sm" onclick="toggleHelp()">Keywords</button><button class="btn ghost sm" onclick="leaveTable()">Leave</button></div></div>`;
  if(S.room){
    if(S.room.phase==='lobby')h+=renderLobby();
    else if(S.room.phase==='build')h+=renderBuild();
    else if(S.room.phase==='play')h+=renderPlay();
  }
  if(S.helpOpen)h+=renderHelp();
  if(S.zoomCid)h+=renderZoom();
  app.innerHTML=h;
}

/* BOOTSTRAP */
(()=>{
  const urlRoom=new URLSearchParams(window.location.search).get('room');
  if(urlRoom)S.codeInput=urlRoom.toUpperCase();
  /* Load any saved image mapping from image-mapper tool */
  /* Card DB is loaded at top from window.CATA_CARDS or localStorage */
  /* Preload images */
  Object.values(CARDS).forEach(c=>{if(c.img){const im=new Image();im.src=IMG_BASE+c.img;}});
  /* Fallback poll */
  setInterval(async()=>{if(!S.code||S.busy||!_db)return;const f=await loadRoom(S.code);if(f&&(!S.room||f.v>S.room.v)){S.room=f;render();}},8000);
  render();
})();
