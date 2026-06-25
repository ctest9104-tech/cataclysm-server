/* CATACLYSM ARCADE Community Project */
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
  /* Weapon attack bonus — accepts numbers or "X" (variable, treated as 0 base) */
  if(o.atkMod!==undefined&&o.atkMod!==''){
    const n=Number(o.atkMod);
    c.atkMod=isNaN(n)?0:n;        /* "X" parses to NaN → 0 base, players adjust via GM panel */
    if(isNaN(n))c.atkModVariable=true;
  }
  if(o.speed)c.speed=o.speed; else if(o.type==='response')c.speed='instant'; else if(o.type==='tactic')c.speed='sorcery';
  /* sensible defaults so the engine never breaks on missing numbers */
  if(c.kind==='fighter'||c.kind==='boss'){ if(c.hp===undefined)c.hp=1; if(c.atk===undefined)c.atk=0; if(c.atkCost===undefined)c.atkCost=0; }
  if(c.cost===undefined)c.cost=0;
  if(c.level===undefined&&(c.type==='fighter'||c.type==='weapon'))c.level=1;

  /* Strip out text that describes a token this card creates. Token rules text
     (after "Create a ... token") describes the spawned token's keywords, NOT the
     parent card's — e.g. Trapper's "It has Enforcer" applies to Bear Trap, not Trapper. */
  let scanText = c.text || '';
  const tokenStart = scanText.search(/Create\s[^.]{0,80}\btoken\b/i);
  if (tokenStart >= 0) scanText = scanText.slice(0, tokenStart);
  /* Quoted segments (curly or straight) also typically wrap token-rules — strip those too */
  scanText = scanText.replace(/"[^"]*"/g, '').replace(/\u201C[^\u201D]*\u201D/g, '');
  scanText += ' ' + (c.keywords||[]).join(' ');

  const text = scanText;
  const lowText = text.toLowerCase();
  /* Armor N - parse number after "Armor" */
  const armorMatch=text.match(/Armor\s+(\d+)/i);
  if(armorMatch){ c.armor=Number(armorMatch[1]); if(!c.keywords.includes('Armor'))c.keywords.push('Armor'); }
  if(/\bDetermination\b/.test(text)){ c.determination=true; if(!c.keywords.includes('Determination'))c.keywords.push('Determination'); }
  if(/\bPhantasmal\b/.test(text)){ c.canPhantasmal=true; if(!c.keywords.includes('Phantasmal')&&/be(comes?|come)\s+Phantasmal/i.test(text))c.keywords.push('Phantasmal'); }
  if(/\bAgility\b/.test(text)&&!c.keywords.includes('Agility')){ c.keywords.push('Agility'); }
  if(/\bStealthy\b/.test(text)&&!c.keywords.includes('Stealthy')){ c.keywords.push('Stealthy'); }
  if(/\bEnforcer\b/.test(text)&&!c.keywords.includes('Enforcer')){ c.keywords.push('Enforcer'); }
  if(/\bFortify\b/.test(text)){ c.fortifyInstead=true; if(!c.keywords.includes('Fortify'))c.keywords.push('Fortify'); }
  if(/\bBlock\b/.test(text)&&!c.keywords.includes('Block')){ c.keywords.push('Block'); }
  if(/can attack as though.*(?:do(?:es)? not|do(?:es)?n['\u2019]?t) have Enforcer/i.test(text)){ c.atkFlags=c.atkFlags||{}; c.atkFlags.ignoreEnforcer=true; }
  if(/can.t be blocked/i.test(text)){ c.atkFlags=c.atkFlags||{}; c.atkFlags.unblockable=true; }

  if(o.id==='render-mq83vajo')c.diesEndOfLevel=true;
  if(o.id==='render-mq838ccz')c.createsTempToken=true;
  if(o.id==='render-mq83cnop')c.armor=Math.max(c.armor||0,1);

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
  applyAbilities();
}

/* Attach per-card behaviors from window.CATA_ABILITIES into the CARDS registry.
   ABILITIES is keyed by card id; each entry can have any of:
     run(gp,ctx)        — tactic/response on play
     onEnter(gp,ctx)    — fighter enters play
     onDeath(gp,ctx)    — unit dies
     onAttack(gp,ctx)   — unit declares attack
     onWield(gp,ctx)    — weapon becomes wielded
     activated:[...]    — activated abilities visible as buttons
     dynamicAtk(gp,uid) — variable Attack
     dynamicAtkBonus(gp,uid) — extra atk added on top of base
     staticBuff(gp,uid) — re-evaluated each instSummary; should return number for atk bonus to allies
     atkFlags, fortifyInstead, determination, canPhantasmal, armor — passive flags */
function applyAbilities(){
  const A=(typeof window!=='undefined'&&window.CATA_ABILITIES)||{};
  let attached=0;
  Object.keys(A).forEach(id=>{
    if(!CARDS[id])return;
    Object.assign(CARDS[id],A[id]);
    CARDS[id]._auto=true;attached++;
  });
  console.log('Cataclysm: '+attached+'/'+Object.keys(CARDS).length+' cards have automated abilities.');
}

/* Helpers used by ability definitions */
function gainKwLevel(gp,uid,kw){const i=gp.inst[uid];if(!i)return;i._gainedKw=i._gainedKw||{};i._gainedKw[kw]=gp.level;log(gp,(CARDS[i.cid]||{}).name+' gains '+kw+' this level.');}
function hasGainedKw(gp,uid,kw){const i=gp.inst[uid];if(!i)return false;return i._gainedKw&&i._gainedKw[kw]===gp.level;}
function unwieldWeapon(gp,wUid){const w=gp.inst[wUid];if(!w||!w.wieldedBy)return;const holder=gp.inst[w.wieldedBy];if(holder)holder.wielded=(holder.wielded||[]).filter(x=>x!==wUid);w.wieldedBy=null;}
function eachOpponent(gp,myPid,cb){gp.order.forEach(pid=>{if(pid!==myPid&&!gp.p[pid].defeated)cb(pid);});}
function eachAlly(gp,pid,cb){gp.p[pid].board.concat([gp.p[pid].boss]).forEach(u=>{if(u&&gp.inst[u])cb(u);});}
function myFighters(gp,pid){return gp.p[pid].board.filter(u=>gp.inst[u]&&gp.inst[u].kind==='fighter'&&gp.inst[u].hp>0);}
function allyAndOppUnits(gp){return allBoard(gp).filter(u=>gp.inst[u]&&gp.inst[u].hp>0);}
function fighterTargetFilter(){return i=>i.kind==='fighter';}
function bossOrFighterFilter(){return i=>i.kind==='fighter'||i.kind==='boss';}
function opposingFighterFilter(pid){return i=>i.kind==='fighter'&&i.owner!==pid;}
function setTempAtk(gp,uid,amt){const i=gp.inst[uid];if(!i)return;i.tempAtk=(i.tempAtk||0)+amt;log(gp,(CARDS[i.cid]||{}).name+' gets +'+amt+' Attack this level.');}
function stopAttack(gp){if(gp.pendingAttack){log(gp,'Attack stopped!');gp.pendingAttack=null;}}
function rollDie(n){return 1+Math.floor(Math.random()*(n||6));}

/* Visible dice roll — animated die that displays a tumbling result, then calls cb(result).
   Used by Lacey/Sage automatically; also available via GM "Roll Die" button. */
function rollDieVisible(sides,reason,cb){
  sides=sides||6;
  if(typeof document==='undefined'||typeof window==='undefined'){cb&&cb(rollDie(sides));return;}
  const result=rollDie(sides);
  const ov=document.createElement('div');ov.className='fx-dice-overlay';
  const die=document.createElement('div');die.className='fx-die';die.textContent='?';
  const lbl=document.createElement('div');lbl.className='fx-die-lbl';lbl.textContent=reason||'Rolling d'+sides+'...';
  ov.appendChild(die);ov.appendChild(lbl);document.body.appendChild(ov);
  let frame=0;const iv=setInterval(()=>{die.textContent=1+Math.floor(Math.random()*sides);frame++;if(frame>=14){clearInterval(iv);die.textContent=result;die.classList.add('fx-die-settled');lbl.textContent=(reason?reason+' \u2014 ':'')+'rolled '+result;setTimeout(()=>{ov.remove();cb&&cb(result);},900);}},70);
}

function transformInstance(gp,uid,maxLevel,opts){
  const i=gp.inst[uid];if(!i)return;
  const oldC=CARDS[i.cid]||{};
  const pid=i.owner;const oldName=oldC.name;

  const cap=(maxLevel!==undefined&&maxLevel!==null)?maxLevel:(oldC.level||0);

  const onBoard=new Set(gp.p[pid].board.map(u=>{const ii=gp.inst[u];return ii&&CARDS[ii.cid]?CARDS[ii.cid].name:null;}).filter(Boolean));
  destroyInstance(gp,uid,{skipFortify:true});
  const deck=gp.p[pid].deck;const skipped=[];let found=null;
  while(deck.length){
    const u=deck.shift();const c=CARDS[gp.inst[u].cid];
    if(c&&c.type==='fighter'&&(c.level||1)<=cap&&c.name!==oldName&&!onBoard.has(c.name)){found=u;break;}
    skipped.push(u);
  }
  gp.p[pid].deck=shuffle(deck.concat(skipped));
  if(found){gp.p[pid].board.push(found);resetInstance(gp,found);fireOnEnter(gp,found,pid);log(gp,'Transform \u2192 '+CARDS[gp.inst[found].cid].name+' (L'+(CARDS[gp.inst[found].cid].level||'?')+' or lower).');}
  else log(gp,'Transform: no eligible Fighter (L'+cap+' or lower) in deck.');
}
function unstunUnit(gp,uid){const i=gp.inst[uid];if(!i)return;i.stunned=false;log(gp,(CARDS[i.cid]||{}).name+' unstunned.');}
function untapUnit(gp,uid){const i=gp.inst[uid];if(!i)return;i.actedCount=0;log(gp,(CARDS[i.cid]||{}).name+' untapped.');}
function revealTopN(gp,pid,n){return gp.p[pid].deck.slice(0,n);}
function bottomShuffle(gp,pid,uids){gp.p[pid].deck=gp.p[pid].deck.filter(x=>!uids.includes(x)).concat(shuffle(uids));}

function copyStatsOnto(gp,srcUid,modelUid){
  const sI=gp.inst[srcUid];const mI=gp.inst[modelUid];if(!sI||!mI)return;
  const mC=CARDS[mI.cid];if(!mC)return;
  sI._copyOf=mI.cid;sI.maxHp=mI.maxHp;sI.hp=mI.maxHp;
  sI.counters=Object.assign({},mI.counters||{});
  log(gp,(CARDS[sI.cid]||{}).name+' enters as a copy of '+mC.name+' (HP '+sI.hp+', stats inherited).');
}

function diffinCanAttack(gp,uid){
  const i=gp.inst[uid];if(!i)return true;
  const c=CARDS[i.cid];if(!c||c.id!=='render-mq82up5x')return true;
  return myFighters(gp,i.owner).some(u=>gp.inst[u].hp>=5);
}

window.rollDieManual=function(sides){
  sides=sides||6;
  rollDieVisible(sides,'Manual roll (d'+sides+')',(r)=>{
    if(S.room&&S.room.game){
      act(rm=>{const myName=(rm.game.p[S.myId]&&rm.game.p[S.myId].name)||'Player';log(rm.game,'[Die] '+myName+' rolled '+r+' on a d'+sides+'.');});
    }
  });
};

function fireDiscardHooks(gp,discarderPid,uids){
  if(!uids||!uids.length)return;
  allBoard(gp).forEach(u=>{const i=gp.inst[u];if(!i)return;const c=CARDS[i.cid];
    if(c&&c.onAnyDiscard)c.onAnyDiscard(gp,{pid:i.owner,src:u,discarderPid,discardedUids:uids});});
}
function fireReveal(gp,pid,uid){
  /* Called from every reveal-from-deck point (Spot, Phern, Hot Mike, Sky, Vermingus, Give The Signal, Videotape) */
  const i=gp.inst[uid];if(!i)return;
  const c=CARDS[i.cid];if(c&&c.onReveal)c.onReveal(gp,{pid,src:uid});
}
function fireFighterEnterFromDeck(gp,pid,uid){
  /* Vermingus and similar: trigger when a Fighter enters play from a deck-reveal */
  allBoard(gp).forEach(u=>{const i=gp.inst[u];if(!i)return;const c=CARDS[i.cid];
    if(c&&c.onAnyFighterEnterFromDeck)c.onAnyFighterEnterFromDeck(gp,{pid:i.owner,src:u,enteringUid:uid,enteringPid:pid});});
}

/* Cost modifier — adjust an attack/ability cost by board state. */
function effectiveCost(gp,pid,baseCost,kind){
  let cost=baseCost||0;
  /* Trouble, Forerunner: other players' atks & activations cost ① more */
  allBoard(gp).forEach(u=>{const i=gp.inst[u];if(!i||i.hp<=0)return;if(i.cid==='render-mq83senr'&&i.owner!==pid)cost+=1;});
  /* Dreyver, Terminarch: other Synth allies pay ① less */
  if(kind==='atk'||kind==='ability'){
    const myDreyver=gp.p[pid].board.concat([gp.p[pid].boss]).some(u=>u&&gp.inst[u]&&gp.inst[u].cid==='render-mq82vipj');
    if(myDreyver){cost-=1;}
  }
  /* EVee: other Survivors pay ① less to attack */
  if(kind==='atk'){
    const myEvee=gp.p[pid].board.some(u=>u&&gp.inst[u]&&gp.inst[u].cid==='render-mq82xys2');
    if(myEvee){cost-=1;}
  }
  return Math.max(0,cost);
}

function isUntargetable(gp,uid,attackerPid){
  const i=gp.inst[uid];if(!i)return false;const c=CARDS[i.cid];if(!c)return false;
  /* Stealthy on the level it entered (existing rule handled by validDefenders) */
  /* Seeya, Later Gator — can't be attacked if 5+ Fighters on your team */
  if(c.id==='render-mq83jdnu'&&myFighters(gp,i.owner).length>=5)return true;
  /* Zanni, Nobody's Fool — can't be attacked, period */
  if(c.id==='render-mq83wcyl')return true;
  /* Flank, Packleader — can't be attacked if 4+ Fighters on team */
  if(c.id==='render-mq82yz0l'&&myFighters(gp,i.owner).length>=4)return true;
  /* Tantrum + Whump! on same team */
  if(c.id==='render-mq83ph11'){
    const hasWhump=gp.p[i.owner].board.some(u=>(CARDS[gp.inst[u].cid]||{}).name==='Whump!');
    if(hasWhump)return true;
  }
  return false;
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

    if(c.dynamicAtk){
      const dv=c.dynamicAtk(gp,uid);
      if(dv!==undefined&&dv!==null)atk=dv+(i.counters&&i.counters.atk||0)+(i.tempAtk||0);
      else atk=(c.atk||0)+(i.counters&&i.counters.atk||0)+(i.tempAtk||0);
    } else {
      atk=(c.atk||0)+(i.counters&&i.counters.atk||0)+(i.tempAtk||0);
    }
    if(c.dynamicAtkBonus)atk+=c.dynamicAtkBonus(gp,uid);
    (i.wielded||[]).forEach(wu=>{
      const wc=CARDS[gp.inst[wu].cid];
      atk+=weaponAtk(gp,wu);

      if(wc&&wc.atkBonusForWielder)atk+=(wc.atkBonusForWielder(gp,uid)||0);
    });

    if(i.owner&&gp.p[i.owner]){
      (gp.p[i.owner].board.concat([gp.p[i.owner].boss])).forEach(au=>{
        if(!au||au===uid)return;const ai=gp.inst[au];if(!ai)return;const ac=CARDS[ai.cid];
        if(ac&&ac.staticBuff)atk+=(ac.staticBuff(gp,uid,au)||0);
      });
    }
  }

  const gained=(i._gainedKw&&Object.keys(i._gainedKw).filter(k=>i._gainedKw[k]===gp.level))||[];
  const allKw=(c.keywords||[]).slice();
  gained.forEach(k=>{if(!allKw.includes(k))allKw.push(k);});
  const hasAgility=allKw.includes('Agility')||c.grantsKeyword==='agility'||hasWieldedAgility(gp,uid);
  const maxActs=(i.agilityLevel||hasAgility)?2:1;
  return{uid,cid:i.cid,name:c.name,faction:c.faction,kind:i.kind,hp:i.hp,maxHp:i.maxHp,
    atk:Math.max(0,atk),tapped:(i.actedCount||0)>=maxActs,
    keywords:allKw.concat(i.stunned?['Stunned']:[]).concat(i.phantasmal?['Phantasmal']:[]),
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
function healInst(gp,uid,amt){const i=gp.inst[uid];if(!i)return;const c=CARDS[i.cid];if(!c)return;const before=i.hp;i.hp=Math.min(i.maxHp,i.hp+amt);const real=i.hp-before;if(real>0){log(gp,c.name+' heals '+real+'.');showDamageNumber(uid,real,'heal');showHealEffect(uid);}}
function gainHealth(gp,uid,amt){const i=gp.inst[uid];if(!i)return;const c=CARDS[i.cid];if(!c)return;i.maxHp+=amt;i.hp+=amt;log(gp,c.name+' gains '+amt+' Health (now '+i.hp+'/'+i.maxHp+').');showDamageNumber(uid,amt,'heal');showHealEffect(uid);}
function addCounter(gp,uid,type,amt){
  const i=gp.inst[uid];if(!i)return;const c=CARDS[i.cid];
  i.counters=i.counters||{};i.counters[type]=(i.counters[type]||0)+amt;
  if(amt>0)showCounterEffect(uid);
  if(type==='atk'&&amt>0){const pid=i.owner;(gp.p[pid].board.concat([gp.p[pid].boss])).forEach(u=>{if(u&&gp.inst[u]&&CARDS[gp.inst[u].cid]&&CARDS[gp.inst[u].cid].onCounterPlaced)CARDS[gp.inst[u].cid].onCounterPlaced(gp,pid);});}
  log(gp,(c?c.name:'?')+' gets '+type+' counter ('+(amt>0?'+':'')+amt+').');
}
function stunInstance(gp,uid){const i=gp.inst[uid];if(!i)return;i.stunned=true;i.actedCount=99;log(gp,(CARDS[i.cid]||{}).name+' is stunned.');showStunEffect(uid);}
function createToken(gp,pid,tokenId){const u=newInstance(gp,tokenId,pid);gp.p[pid].board.push(u);log(gp,gp.p[pid].name+' creates '+CARDS[tokenId].name+'.');return u;}
function wieldWeapon(gp,wUid,fUid){
  const w=gp.inst[wUid];if(!w||!gp.inst[fUid])return;
  w.wieldedBy=fUid;gp.inst[fUid].wielded=gp.inst[fUid].wielded||[];gp.inst[fUid].wielded.push(wUid);
  const c=CARDS[w.cid];if(c&&c.onWield)c.onWield(gp,{pid:w.owner,src:wUid});
  const owner=w.owner;if(gp.p[owner]&&gp.p[owner].boss&&gp.inst[gp.p[owner].boss]&&gp.inst[gp.p[owner].boss].cid==='toolshed')CARDS.toolshed.onWeaponEnter(gp,{pid:owner});
  log(gp,CARDS[w.cid].name+' wielded to '+CARDS[gp.inst[fUid].cid].name+'.');
}
function fireOnEnter(gp,uid,pid){
  const i=gp.inst[uid];if(!i)return;const c=CARDS[i.cid];if(!c)return;

  enforceSameNameRule(gp,uid,pid);
  if(!gp.inst[uid])return;
  if(c.onEnter)c.onEnter(gp,{pid,src:uid});
}

function enforceSameNameRule(gp,uid,pid){
  const i=gp.inst[uid];if(!i)return;const c=CARDS[i.cid];if(!c)return;
  if(c.type!=='fighter'&&c.type!=='weapon')return;
  if(c.kind==='token'||c.type==='token')return;

  if(c.id==='render-mq831kn8')return;
  const name=c.name;if(!name)return;
  const dupes=gp.p[pid].board.filter(u=>{
    if(u===uid)return false;
    const o=gp.inst[u];return o&&CARDS[o.cid]&&CARDS[o.cid].name===name;
  });
  if(dupes.length){
    dupes.forEach(u=>{log(gp,'Same-name rule: older '+name+' destroyed.');destroyInstance(gp,u,{skipFortify:true});});
  }
}
function destroyInstance(gp,uid,opts){
  const i=gp.inst[uid];if(!i)return;const c=CARDS[i.cid];if(!c)return;const pid=i.owner;
  if(c.fortifyInstead&&!(opts&&opts.skipFortify)){
    const cands=(gp.p[pid].board.concat([gp.p[pid].boss])).filter(u=>u&&u!==uid&&gp.inst[u]&&!gp.inst[u].fortifiedUnder&&(gp.inst[u].kind==='fighter'||gp.inst[u].kind==='boss')&&gp.inst[u].hp>0);
    if(cands.length){const t=cands[0];gp.inst[t].maxHp+=i.maxHp;gp.inst[t].hp+=i.maxHp;i.fortifiedUnder=t;gp.p[pid].board=gp.p[pid].board.filter(x=>x!==uid);log(gp,c.name+' Fortifies under '+CARDS[gp.inst[t].cid].name+'.');return;}
  }
  showDestroyEffect(uid);
  if(i.kind==='fighter')gp.fighterLeftThisLevel=true;
  moveZone(gp,pid,uid,'board','grave');
  if(c.onDeath)c.onDeath(gp,{pid});
  allBoard(gp).forEach(u=>{if(gp.inst[u]&&CARDS[gp.inst[u].cid]&&CARDS[gp.inst[u].cid].onAnyFighterDeath&&i.kind==='fighter')CARDS[gp.inst[u].cid].onAnyFighterDeath(gp,u);});
  log(gp,c.name+' is destroyed.');checkWin(gp);
}
function dealDamage(gp,uid,amt){
  const i=gp.inst[uid];if(!i||i.hp<=0)return;const c=CARDS[i.cid];if(!c)return;
  let reduced=amt;

  if(c.armor){
    const armorLeft=c.armor-(i.armorUsedThisLevel||0);
    if(armorLeft>0){
      const blocked=Math.min(armorLeft,amt);
      reduced=Math.max(0,amt-blocked);
      i.armorUsedThisLevel=(i.armorUsedThisLevel||0)+blocked;
      if(blocked>0)log(gp,c.name+' Armor blocks '+blocked+' damage.');
    }
  }
  i.hp-=reduced;i.dmgThisLevel=true;
  if(reduced>0){log(gp,c.name+' takes '+reduced+' damage.');showDamageNumber(uid,-reduced,'dmg');}
  if(i.hp<=0){
    /* Determination: if would die without a +1 Attack counter, set to 1 HP and give counter */
    if(c.determination&&!(i.counters&&i.counters.atk>0)){
      i.hp=1;
      i.counters=i.counters||{};i.counters.atk=(i.counters.atk||0)+1;
      log(gp,c.name+' uses Determination (set to 1 HP, +1 Attack counter).');
      return;
    }
    /* Phantasmal: dies on damage taken, but Phantasmal status removes counter and survives */
    if(i.phantasmal){
      i.phantasmal=false;i.hp=1;
      if(i.counters&&i.counters.atk>0)i.counters.atk-=1;
      log(gp,c.name+' is no longer Phantasmal.');
      return;
    }
    destroyInstance(gp,uid);
  } else checkWin(gp);
}
function pendTarget(gp,opts,cb){
  const valid=allBoard(gp).filter(u=>{const s=instSummary(gp,u);if(!s||s.dead)return false;return opts.filter(Object.assign({},s,{owner:gp.inst[u].owner,cid:gp.inst[u].cid}));});
  gp.pending={kind:'target',forId:opts.forId,prompt:opts.prompt,valid};S.pendingCb=cb;
}
function pendPick(gp,opts,cb){gp.pending={kind:'pick',forId:opts.forId,prompt:opts.prompt,options:opts.options};S.pendingCb=cb;}
function pendDiscardOptional(gp,ctx,prompt,cb){
  gp.pending={kind:'discard',forId:ctx.pid,prompt,options:gp.p[ctx.pid].hand.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})).concat([{label:'Skip',value:''}])};
  S.pendingCb=(gp2,v)=>{
    if(v&&gp2.p[ctx.pid].hand.includes(v)){
      moveZone(gp2,ctx.pid,v,'hand','grave');
      log(gp2,gp2.p[ctx.pid].name+' discards '+CARDS[gp2.inst[v].cid].name+'.');
      fireDiscardHooks(gp2,ctx.pid,[v]);
    }
    cb(gp2,Object.assign({},ctx),v||null);
  };
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
    gp.p[pid].board.concat([gp.p[pid].boss]).forEach(u=>{if(!u)return;const i=gp.inst[u];if(!i)return;i.actedCount=0;i.tempAtk=0;i.costOverrideLevel=undefined;i.armorUsedThisLevel=0;i.tempFaction=null;i._costOverride=null;if(i.stunned)i.stunned=false;});
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
function _transformInstanceFallback(gp,uid){
  /* Superseded by the rules-compliant transformInstance defined earlier in this file.
     Kept as a stub so any stray callers won't crash. */
  console.warn('Old transformInstance fallback hit — should never run.');
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
    const enf=gp.p[pid].board.filter(u=>gp.inst[u]&&gp.inst[u].hp>0&&(CARDS[gp.inst[u].cid].keywords||[]).includes('Enforcer')&&!isUntargetable(gp,u,attackerOwner));
    if(enf.length&&!(c.atkFlags&&c.atkFlags.ignoreEnforcer)){targets=targets.concat(enf);return;}
    gp.p[pid].board.forEach(u=>{
      const i=gp.inst[u];if(!i||i.hp<=0)return;const cc=CARDS[i.cid];if(!cc)return;
      if((cc.keywords||[]).includes('Stealthy')&&i.enterLevel===gp.level&&!gp.ignoreStealthyLevel)return;
      if(cc.cantBeAttackedIfTokenAlive&&gp.p[pid].board.some(u2=>gp.inst[u2]&&CARDS[gp.inst[u2].cid].id===cc.cantBeAttackedIfTokenAlive&&gp.inst[u2].hp>0))return;
      if(isUntargetable(gp,u,attackerOwner))return;
      targets.push(u);
    });
    if(gp.p[pid].boss&&gp.inst[gp.p[pid].boss]&&gp.inst[gp.p[pid].boss].hp>0){
      if(!isUntargetable(gp,gp.p[pid].boss,attackerOwner))targets.push(gp.p[pid].boss);
    }
  });
  return targets;
}
function canPossiblyRespond(gp,pid){
  const ppl=gp.p[pid];if(!ppl||ppl.defeated)return false;
  const coins=ppl.coins;
  if(ppl.hand.some(u=>{const c=CARDS[gp.inst[u].cid];return c&&c.type==='response'&&(c.cost||0)<=coins;}))return true;
  return ppl.board.concat([ppl.boss]).some(u=>{
    if(!u)return false;const i=gp.inst[u];if(!i)return false;
    const c=CARDS[i.cid];if(!c)return false;
    return(c.activated||[]).some(ab=>{
      if(!ab.label||!/response/i.test(ab.label))return false;
      const cost=ab.cost||{};
      if(cost.coins&&cost.coins>coins)return false;
      if(cost.tap&&!canAct(gp,u))return false;
      return true;
    });
  });
}

function autoSkipNoResponders(gp){
  while(gp.responseWindow){
    const pri=gp.responseWindow.priority;
    if(canPossiblyRespond(gp,pri))break;
    log(gp,gp.p[pri].name+' has no responses, auto-passing.');
    gp.responseWindow.passed.push(pri);
    const next=nextResponsePriority(gp,gp.responseWindow.attackerPid,gp.responseWindow.passed);
    if(!next){resolvePendingAttack(gp);return;}
    gp.responseWindow.priority=next;
  }
}

function nextResponsePriority(gp,attackerPid,passed){
  const order=gp.order.filter(p=>!gp.p[p].defeated);
  const startIdx=order.indexOf(attackerPid);
  if(startIdx<0)return null;
  for(let i=1;i<=order.length;i++){
    const pid=order[(startIdx+i)%order.length];
    if(pid===attackerPid)continue;
    if(passed.includes(pid))continue;
    return pid;
  }
  return null;
}

function declareAttack(gp,atkUid,defUid,ctxPid){
  const cost=effectiveAtkCost(gp,atkUid);if(!spendCoins(gp,ctxPid,cost))return false;
  gp.inst[atkUid].actedCount=(gp.inst[atkUid].actedCount||0)+1;gp.passedSet=[];
  gp.pendingAttack={attacker:atkUid,defender:defUid,attackerOwner:ctxPid};
  showAttackFlash(atkUid,defUid);
  fireOnAttacked(gp,defUid,atkUid);
  const nextPri=nextResponsePriority(gp,ctxPid,[]);
  if(!nextPri)return resolvePendingAttack(gp);
  const defenderPid=gp.inst[defUid]?gp.inst[defUid].owner:null;
  gp.responseWindow={
    type:'attack',
    attackerUid:atkUid,defenderUid:defUid,
    attackerPid:ctxPid,defenderPid,
    priority:nextPri,passed:[]
  };
  autoSkipNoResponders(gp);
  return true;
}

function resolvePendingAttack(gp){
  if(gp.responseWindow)gp.responseWindow=null;
  if(!gp.pendingAttack)return true;
  const ctx={pid:gp.pendingAttack.attackerOwner,attacker:gp.pendingAttack.attacker,defender:gp.pendingAttack.defender};
  gp.pendingAttack=null;
  const ai=gp.inst[ctx.attacker];if(!ai||ai.hp<=0)return true;
  const di=gp.inst[ctx.defender];if(!di||di.hp<=0)return true;
  const ac=CARDS[ai.cid];
  if(ac&&ac.preAttack){ac.preAttack(gp,ctx);return true;}
  finishAttackDamage(gp,ctx);return true;
}

window.passResponse=async function(){
  await act(r=>{
    const gp=r.game;
    if(!gp.responseWindow)return;
    if(gp.responseWindow.priority!==S.myId)return;
    gp.responseWindow.passed.push(S.myId);
    const next=nextResponsePriority(gp,gp.responseWindow.attackerPid,gp.responseWindow.passed);
    if(!next){
      resolvePendingAttack(gp);
      if(!gp.pending&&!gp.responseWindow)nextTurn(gp);
    } else {
      gp.responseWindow.priority=next;
    }
  });
};
function combatDamage(gp,atkUid,defUid){
  const s=instSummary(gp,atkUid);if(!s)return 0;
  let dmg=s.atk;
  const ac=CARDS[gp.inst[atkUid].cid];const dc=CARDS[gp.inst[defUid].cid];
  const aInst=gp.inst[atkUid];const dInst=gp.inst[defUid];
  const aFac=aInst.tempFaction||(ac&&ac.faction);
  const dFac=dInst.tempFaction||(dc&&dc.faction);
  /* Attacker-side conditional: card's attackerMod(gp,atkUid,defUid) -> number */
  if(ac&&ac.attackerMod){dmg+=ac.attackerMod(gp,atkUid,defUid,{aFac,dFac})||0;}
  /* Defender-side conditional: defender card may reduce damage by faction match */
  if(dc&&dc.defenderMod){dmg+=dc.defenderMod(gp,atkUid,defUid,{aFac,dFac})||0;}
  return Math.max(0,dmg);
}
function finishAttackDamage(gp,ctx){
  const dmg=combatDamage(gp,ctx.attacker,ctx.defender);
  const defenderCidBefore=gp.inst[ctx.defender]?gp.inst[ctx.defender].cid:null;
  dealDamage(gp,ctx.defender,dmg);
  (gp.inst[ctx.attacker]&&gp.inst[ctx.attacker].wielded||[]).forEach(wu=>{const wc=CARDS[gp.inst[wu].cid];if(wc&&wc.onWielderDealtDamage)wc.onWielderDealtDamage(gp,ctx.attacker,dmg);});
  const ac=CARDS[(gp.inst[ctx.attacker]||{}).cid];if(ac&&ac.onAttack)ac.onAttack(gp,{pid:ctx.pid,src:ctx.attacker});
  if(ac)log(gp,ac.name+' attacks for '+dmg+' damage.');
  /* Did the attacker kill the defender? Fire onAttackKill (Trouble, Muck, Charlotte). */
  const defGone=!gp.inst[ctx.defender]||gp.inst[ctx.defender].hp<=0;
  if(defGone&&gp.inst[ctx.attacker]&&ac&&ac.onAttackKill){
    ac.onAttackKill(gp,{pid:ctx.pid,src:ctx.attacker,defenderCid:defenderCidBefore,defenderUid:ctx.defender});
  }
}

/* UI ACTIONS */
window.createRoom=async function(){
  if(!S.name.trim())return alert('Enter a username first.');
  const code=roomCode();const pid=uid(8);
  const room={code,hostId:pid,phase:'lobby',settings:{startHand:4,drawPerLevel:1},players:[{id:pid,name:S.name,ready:false,factions:[],bossId:null,list:{}}],game:null,v:0,log:[]};
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
  if(!existing&&room.players.length>=8)return alert('Table is full (8 player max).');
  if(!existing){pid=uid(8);room.players.push({id:pid,name:S.name,ready:false,factions:[],bossId:null,list:{}});await saveRoom(room);setMyPid(code,pid);}
  S.code=code;S.myId=pid;S.room=room;S.screen='lobby';
  history.replaceState({},'','?room='+code);subscribeToRoom(code);render();
};
window.startBuild=async function(){await act(r=>{r.phase='build';});};
window.toggleFaction=async function(f){await act(r=>{const me=r.players.find(p=>p.id===S.myId);const i=me.factions.indexOf(f);if(i>=0)me.factions.splice(i,1);else{if(me.factions.length>=2)me.factions.shift();me.factions.push(f);}me.bossId=null;me.list={};});};
window.pickBoss=async function(cid){await act(r=>{r.players.find(p=>p.id===S.myId).bossId=cid;});};
window.adjustCard=async function(cid,delta){await act(r=>{const me=r.players.find(p=>p.id===S.myId);const cur=me.list[cid]||0;const next=Math.max(0,Math.min(3,cur+delta));me.list[cid]=next;if(!me.list[cid])delete me.list[cid];});};
window.markReady=async function(){await act(r=>{const me=r.players.find(p=>p.id===S.myId);const total=Object.values(me.list).reduce((a,b)=>a+b,0);if(!me.bossId)return alert('Pick a Boss first.');if(total<40)return alert('You need at least 40 non-Boss cards (currently '+total+'). Max 3 copies per card. No upper limit on deck size.');me.ready=true;});};
window.unready=async function(){await act(r=>{r.players.find(p=>p.id===S.myId).ready=false;});};
window.beginGame=async function(){await act(r=>{startGame(r);});};
window.doMulligan=function(){

  if(!S.room||!S.room.game)return;
  const gp=S.room.game;const me=gp.p[S.myId];if(!me)return;
  if(me.mullUsed)return alert('You already mulliganed.');
  if(gp.level!==1)return alert('Mulligan only available at Level 1.');
  if(me.hasActed)return alert('You\u2019ve already taken an action this game.');
  S.mullSel=new Set();S.mullOpen=true;render();
};
window.toggleMullCard=function(uid){
  if(!S.mullSel)S.mullSel=new Set();
  if(S.mullSel.has(uid))S.mullSel.delete(uid);else S.mullSel.add(uid);
  render();
};
window.confirmMulligan=async function(){
  const sel=Array.from(S.mullSel||[]);
  await act(r=>{const gp=r.game;const me=gp.p[S.myId];if(!me||me.mullUsed)return;

    sel.forEach(u=>{const idx=me.hand.indexOf(u);if(idx>=0)me.hand.splice(idx,1);me.deck.push(u);});
    drawN(gp,S.myId,sel.length);
    me.deck=shuffle(me.deck);
    me.mullUsed=true;
    log(gp,me.name+' mulligans '+sel.length+' card(s).');
  });
  S.mullSel=null;S.mullOpen=false;render();
};
window.cancelMulligan=function(){S.mullSel=null;S.mullOpen=false;render();};
window.playHandCard=async function(u){
  await act(r=>{const gp=r.game;const pid=S.myId;const c=CARDS[gp.inst[u].cid];
    if(gp.responseWindow){
      if(gp.responseWindow.priority!==pid)return alert('Another player has response priority.');
      if(c.type!=='response')return alert('Only Response cards can be played during an attack response window.');
    } else if(gp.curIdx!==gp.order.indexOf(pid)&&c.speed!=='instant'){
      return alert('Not your turn.');
    }
    const playCost=(c.type==='fighter'||c.type==='weapon')?0:(c.cost||0);
    if(gp.p[pid].coins<playCost)return alert('Not enough coins.');
    if(c.type==='fighter'){if((c.level||0)>gp.level)return alert('Level requirement not met (need Lvl '+(c.level)+').');
      moveZone(gp,pid,u,'hand','board');resetInstance(gp,u);
      fireOnEnter(gp,u,pid);
      gp.passedSet=[];}
    else if(c.type==='weapon'){if((c.level||0)>gp.level)return alert('Level requirement not met.');
      if(!gp.p[pid].board.filter(x=>gp.inst[x]&&gp.inst[x].kind==='fighter').length)return alert('No Fighter to wield this to.');
      moveZone(gp,pid,u,'hand','board');
      enforceSameNameRule(gp,u,pid);
      if(gp.inst[u]){
        gp.passedSet=[];
        pendTarget(gp,{forId:pid,prompt:'Wield '+c.name+' to which Fighter?',filter:i=>i.kind==='fighter'&&i.owner===pid},(gp2,fUid)=>wieldWeapon(gp2,u,fUid));
      }}
    else{spendCoins(gp,pid,playCost);moveZone(gp,pid,u,'hand','grave');gp.passedSet=[];
      if(c.run){log(gp,gp.p[pid].name+' plays '+c.name+'.');c.run(gp,{pid,src:u});}
      else log(gp,gp.p[pid].name+' plays '+c.name+' \u2014 GM mode for manual effects, or right-click card to read.');}
    if(gp.responseWindow&&c.type==='response'){
      if(!gp.pendingAttack){gp.responseWindow=null;}
      else if(!gp.pending){resolvePendingAttack(gp);}
    }
    gp.p[pid].hasActed=true;
    if(!gp.pending&&!gp.responseWindow)nextTurn(gp);});
};
window.startAttack=function(u){S.attackPick=u;render();};
window.cancelAttackPick=function(){S.attackPick=null;render();};
window.confirmAttack=async function(defUid){
  const atkUid=S.attackPick;S.attackPick=null;
  await act(r=>{const gp=r.game;const pid=S.myId;
    if(gp.curIdx!==gp.order.indexOf(pid))return alert('Not your turn.');
    if(!canAct(gp,atkUid))return alert('That unit can\'t act again this level.');
    if(!diffinCanAttack(gp,atkUid))return alert('Diffin can only attack if you have a Fighter with 5+ Health on your team.');
    if(!declareAttack(gp,atkUid,defUid,pid))return alert('Not enough coins to attack.');
    gp.p[pid].hasActed=true;
    if(!gp.pending&&!gp.responseWindow)nextTurn(gp);});
};
window.useAbility=async function(u,idx){
  await act(r=>{const gp=r.game;const pid=S.myId;
    const i=gp.inst[u];const c=CARDS[i.cid];let ab=(c.activated||[])[idx];let wAb=null;
    if(ab===undefined){(i.wielded||[]).forEach(wu=>{const wc=CARDS[gp.inst[wu].cid];([...(wc.weaponActivated||[]),(wc.grantsActivated||[])]).flat().forEach((a,ai)=>{if(('w'+wu+ai)===String(idx))wAb=a;});});}
    const useAb=ab||wAb;if(!useAb)return;
    if(gp.responseWindow){
      if(gp.responseWindow.priority!==pid)return alert('Another player has response priority.');
      if(!useAb.label||!/response/i.test(useAb.label))return alert('Only Response abilities can be activated right now.');
      if(i.owner!==pid)return alert('You can only activate your own abilities.');
    } else if(gp.curIdx!==gp.order.indexOf(pid)){
      return alert('Not your turn.');
    }
    if(useAb.cost.tap&&!canAct(gp,u))return alert('Already acted this level.');
    if(useAb.cost.coins&&!spendCoins(gp,pid,useAb.cost.coins))return alert('Not enough coins.');
    if(useAb.cost.tap)i.actedCount=(i.actedCount||0)+1;
    if(useAb.cost.sacrifice)destroyInstance(gp,u,{skipFortify:true});
    if(useAb.cost.selfDamage){i.hp-=useAb.cost.selfDamage;if(i.hp<=0)destroyInstance(gp,u);}
    gp.passedSet=[];useAb.run(gp,{pid,src:u});gp.p[pid].hasActed=true;
    if(gp.responseWindow){
      if(!gp.pendingAttack){gp.responseWindow=null;}
      else if(!gp.pending){resolvePendingAttack(gp);if(!gp.responseWindow)nextTurn(gp);}
    } else if(!gp.pending){nextTurn(gp);}
  });
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
window.toggleLog=function(){S.logOpen=!S.logOpen;render();};
window.toggleGm=function(){S.gmMode=!S.gmMode;S.gmEditUid=null;render();};
window.viewPile=function(pid,zone){
  if(zone==='deck'&&!S.gmMode){
    alert('Decks are hidden. Only a card ability that lets you search your deck can reveal it (or enable GM Mode).');
    return;
  }
  S.pileView={pid,zone,filter:''};render();
};
window.closePileView=function(){S.pileView=null;render();};
window.pileFilter=function(v){if(S.pileView){S.pileView.filter=v;render();}};
window.shuffleDeck=async function(pid){
  if(pid!==S.myId&&!S.gmMode){alert('GM mode required to shuffle opponents\u2019 decks.');return;}
  await act(r=>{r.game.p[pid].deck=shuffle(r.game.p[pid].deck);log(r.game,r.game.p[pid].name+'\u2019s deck shuffled.');});
};
window.loadPreset=async function(presetId){
  const preset=(window.CATA_PRESET_DECKS||[]).find(d=>d.id===presetId);
  if(!preset)return alert('Preset not found.');
  await act(r=>{
    const me=r.players.find(p=>p.id===S.myId);if(!me)return;
    me.factions=preset.factions.slice();
    me.bossId=preset.bossId;
    me.list=Object.assign({},preset.cards);
    me.ready=false;
  });
};
window.showPresetDetail=function(presetId){
  const preset=(window.CATA_PRESET_DECKS||[]).find(d=>d.id===presetId);
  if(!preset)return;
  S.presetDetail=preset;render();
};
window.closePresetDetail=function(){S.presetDetail=null;render();};
window.pileMove=async function(uid,dest){
  if(!S.pileView)return;const pid=S.pileView.pid,zone=S.pileView.zone;
  /* Only allow moves on YOUR OWN piles unless GM mode is on */
  if(pid!==S.myId&&!S.gmMode){alert('You can only move cards in your own piles (or enable GM mode).');return;}
  await act(r=>{const gp=r.game;
    moveZone(gp,pid,uid,zone,dest);
    if(dest==='board'){resetInstance(gp,uid);fireOnEnter(gp,uid,pid);}
    log(gp,'['+(pid===S.myId?'You':gp.p[pid].name)+'] moved '+CARDS[gp.inst[uid].cid].name+' from '+zone+' → '+dest+'.');
    /* If they took a card out of deck or back, shuffle deck */
    if(zone==='deck'||dest==='deck'){gp.p[pid].deck=shuffle(gp.p[pid].deck);log(gp,gp.p[pid].name+'\u2019s deck shuffled.');}
  });
  /* Refresh pile view if still relevant */
  if(S.pileView){render();}
};
window.gmEdit=function(uid){S.gmEditUid=uid;render();};
window.gmCloseEdit=function(){S.gmEditUid=null;render();};
window.gmAdjustHp=async function(uid,delta){
  await act(r=>{const gp=r.game;const i=gp.inst[uid];if(!i)return;const c=CARDS[i.cid];
    i.hp=Math.max(0,Math.min((i.maxHp||c.hp||1)+10,i.hp+delta));
    log(gp,'[GM] '+c.name+' HP '+(delta>0?'+':'')+delta+' \u2192 '+i.hp);
    if(i.hp<=0){destroyInstance(gp,uid,{skipFortify:true});S.gmEditUid=null;}
    checkWin(gp);});
};
window.gmAdjustMaxHp=async function(uid,delta){
  await act(r=>{const gp=r.game;const i=gp.inst[uid];if(!i)return;const c=CARDS[i.cid];
    i.maxHp=Math.max(1,i.maxHp+delta);if(i.hp>i.maxHp)i.hp=i.maxHp;
    log(gp,'[GM] '+c.name+' Max HP \u2192 '+i.maxHp);});
};
window.gmAdjustAtk=async function(uid,delta){
  await act(r=>{const gp=r.game;const i=gp.inst[uid];if(!i)return;const c=CARDS[i.cid];
    i.counters=i.counters||{};i.counters.atk=(i.counters.atk||0)+delta;
    log(gp,'[GM] '+c.name+' +1 Atk counters: '+(i.counters.atk));});
};
window.gmToggleStun=async function(uid){
  await act(r=>{const gp=r.game;const i=gp.inst[uid];if(!i)return;
    i.stunned=!i.stunned;log(gp,'[GM] '+CARDS[i.cid].name+' '+(i.stunned?'STUNNED':'unstunned')+'.');});
};
window.gmTogglePhantasmal=async function(uid){
  await act(r=>{const gp=r.game;const i=gp.inst[uid];if(!i)return;
    i.phantasmal=!i.phantasmal;log(gp,'[GM] '+CARDS[i.cid].name+' Phantasmal: '+i.phantasmal);});
};
window.gmUntap=async function(uid){
  await act(r=>{const gp=r.game;const i=gp.inst[uid];if(!i)return;
    i.actedCount=0;log(gp,'[GM] '+CARDS[i.cid].name+' untapped (can act again).');});
};
window.gmHealFull=async function(uid){
  await act(r=>{const gp=r.game;const i=gp.inst[uid];if(!i)return;
    i.hp=i.maxHp;log(gp,'[GM] '+CARDS[i.cid].name+' healed to full.');});
};
window.gmDestroy=async function(uid){
  if(!confirm('Destroy this card (move to graveyard)?'))return;
  await act(r=>{const gp=r.game;destroyInstance(gp,uid,{skipFortify:true});S.gmEditUid=null;});
};
window.gmAdjustCoins=async function(pid,delta){
  await act(r=>{const gp=r.game;gp.p[pid].coins=Math.max(0,gp.p[pid].coins+delta);
    log(gp,'[GM] '+gp.p[pid].name+' coins '+(delta>0?'+':'')+delta+' \u2192 '+gp.p[pid].coins);});
};
window.gmDraw=async function(pid){
  await act(r=>{const gp=r.game;drawN(gp,pid,1);log(gp,'[GM] '+gp.p[pid].name+' draws a card.');});
};
window.gmDiscard=async function(pid){
  await act(r=>{const gp=r.game;const hand=gp.p[pid].hand;if(!hand.length)return;
    const u=hand[hand.length-1];moveZone(gp,pid,u,'hand','grave');
    log(gp,'[GM] '+gp.p[pid].name+' discards '+CARDS[gp.inst[u].cid].name+'.');
    fireDiscardHooks(gp,pid,[u]);});
};
window.gmAdvanceLevel=async function(){
  if(!confirm('Force advance to next level?'))return;
  await act(r=>{advanceLevel(r.game,r.settings);log(r.game,'[GM] Level forced.');});
};
window.gmRetap=async function(pid){
  await act(r=>{const gp=r.game;gp.p[pid].board.concat([gp.p[pid].boss]).forEach(u=>{if(u&&gp.inst[u]){gp.inst[u].actedCount=0;gp.inst[u].armorUsedThisLevel=0;}});
    log(gp,'[GM] All '+gp.p[pid].name+'\u2019s units untapped.');});
};
window.copyCode=function(){const url=window.location.origin+window.location.pathname+'?room='+S.code;try{navigator.clipboard.writeText(url);}catch(e){const t=document.createElement('textarea');t.value=url;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);}};
window.showZoom=function(cid){S.zoomCid=cid;render();};
window.closeZoom=function(){S.zoomCid=null;render();};

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
  const wielded=(i.wielded||[]).filter(wu=>gp.inst[wu]);
  const baseAtk=c.atk||0;
  const counterAtk=(i.counters&&i.counters.atk)||0;
  const tempAtk=i.tempAtk||0;
  const weaponBonus=wielded.reduce((sum,wu)=>{const wc=CARDS[gp.inst[wu].cid];return sum+(wc&&wc.atkMod||0);},0);
  const printedHp=c.hp||0;
  const buffedHp=i.maxHp>printedHp;
  const hpClass=i.hp<i.maxHp*0.35?'b-hp low':(buffedHp?'b-hp boosted':'b-hp');
  const atkBoosted=(counterAtk+tempAtk+weaponBonus)>0;
  const atkClass=atkBoosted?'b-atk boosted':'b-atk';

  const isToken=(c.kind==='token'||c.type==='token');
  if(isToken)cls+=' is-token';
  if(wielded.length)cls+=' has-wielded';

  let actBtns='';
  if(!isOpp&&myTurn&&!pend&&!S.attackPick){
    if(!s.tapped&&canAct(gp,uid))actBtns+=`<button class="bcard-btn atk-btn" onclick="startAttack('${uid}')">&#9876; ATK ${effectiveAtkCost(gp,uid)}&#9711;</button>`;
    (c.activated||[]).forEach((ab,idx)=>{
      const myCoins=gp.p[S.myId].coins;
      const needCoins=(ab.cost&&ab.cost.coins)||0;
      const needsTap=!!(ab.cost&&ab.cost.tap);
      const disabled=(needCoins>myCoins)||(needsTap&&!canAct(gp,uid))||i.stunned;
      actBtns+=`<button class="bcard-btn ab-btn${disabled?' disabled':''}" ${disabled?'disabled':`onclick="useAbility('${uid}',${idx})"`} title="${ab.label}${disabled?' (cannot use)':''}">${ab.label.slice(0,18)}</button>`;
    });
    wielded.forEach(wu=>{const wc=CARDS[gp.inst[wu].cid];([...(wc.weaponActivated||[]),(wc.grantsActivated||[])]).flat().forEach((ab,ai)=>{
      const myCoins=gp.p[S.myId].coins;
      const needCoins=(ab.cost&&ab.cost.coins)||0;
      const needsTap=!!(ab.cost&&ab.cost.tap);
      const disabled=(needCoins>myCoins)||(needsTap&&!canAct(gp,uid))||i.stunned;
      actBtns+=`<button class="bcard-btn ab-btn${disabled?' disabled':''}" ${disabled?'disabled':`onclick="useAbility('${uid}','w${wu}${ai}')"`} title="${ab.label}${disabled?' (cannot use)':''}">${ab.label.slice(0,18)}</button>`;
    });});
  }

  /* MTGA-style corner stats: ATK bottom-left, HP bottom-right, both colored when boosted */
  const ptHtml=(s.kind==='fighter'||s.kind==='boss')?
    `<div class="bcard-pt-atk ${atkClass}" title="Attack${atkBoosted?' (base '+baseAtk+(counterAtk?' +'+counterAtk+' counters':'')+(weaponBonus?' +'+weaponBonus+' weapon':'')+(tempAtk?' +'+tempAtk+' temp':'')+')':''}">${s.atk}</div>
     <div class="bcard-pt-hp ${hpClass}" title="${s.hp}/${i.maxHp} HP${buffedHp?' (boosted from '+printedHp+')':''}">${s.hp}<span class="bcard-pt-max">/${i.maxHp}</span></div>`:'';

  const weaponHtml=wielded.length?
    `<div class="bcard-weapons">${wielded.map(wu=>{const wc=CARDS[gp.inst[wu].cid]||{};return `<div class="bcard-weapon-chip" title="${wc.name||''}${wc.atkMod?' (+'+wc.atkMod+' atk)':''}" onclick="event.stopPropagation();showZoom('${gp.inst[wu].cid}')">${artImg(gp.inst[wu].cid,'bcard-weapon-img')}${wc.atkMod?`<span class="bcard-weapon-bonus">+${wc.atkMod}</span>`:''}</div>`;}).join('')}</div>`:'';

  const badges=[];
  if(counterAtk>0)badges.push(`<span class="bdg ctr" title="+${counterAtk} attack counter${counterAtk>1?'s':''}">+${counterAtk}&#9876;</span>`);
  if(buffedHp)badges.push(`<span class="bdg buff" title="Fortified (+${i.maxHp-printedHp} HP)">+${i.maxHp-printedHp}&#10084;</span>`);
  s.keywords.forEach(k=>{
    if(k==='Stunned')badges.push(`<span class="bdg st" title="Stunned">STUN</span>`);
    else if(k==='Enforcer')badges.push(`<span class="bdg en" title="Enforcer — must be attacked before others">ENF</span>`);
    else if(k==='Stealthy')badges.push(`<span class="bdg sty" title="Stealthy — cannot be attacked the level it enters">STL</span>`);
    else if(k==='Agility')badges.push(`<span class="bdg ag" title="Agility — 2 actions per level">AGI</span>`);
    else if(k==='Phantasmal')badges.push(`<span class="bdg ph" title="Phantasmal">PHA</span>`);
    else if(k==='Determination')badges.push(`<span class="bdg det" title="Determination — survives lethal damage once at 1 HP">DET</span>`);
  });
  const badgesHtml=badges.length?`<div class="bcard-badges">${badges.join('')}</div>`:'';

  return`<div class="zone-wrap"><div class="${cls}" data-uid="${uid}" style="border-color:${clickable?'var(--ap)':fCol+'40'}"${clickFn?` onclick="${clickFn}"`:''}
    oncontextmenu="showZoom('${i.cid}');return false">
    ${artImg(i.cid,'bcard-art')}
    ${badgesHtml}
    ${isToken?'<div class="bcard-token-ribbon">TOKEN</div>':''}
    ${S.gmMode?`<button class="bcard-gm" onclick="event.stopPropagation();gmEdit('${uid}')" title="GM edit">&#9881;</button>`:''}
    <div class="bcard-namestrip" style="background:linear-gradient(0deg,${fCol}dd,${fCol}77 60%,transparent)">
      <span class="bcard-name">${s.name}</span>
    </div>
    ${ptHtml}
  </div>
  ${weaponHtml}
  ${actBtns?`<div class="bcard-acts">${actBtns}</div>`:''}
  </div>`;
}

function hCard(gp,uid,myTurn,pend,fanOpts){
  const i=gp.inst[uid];if(!i)return'';const c=CARDS[i.cid];
  const fCol=FCOL[c.faction]||'#888';
  const canPlay=myTurn&&gp.p[S.myId].coins>=(c.cost||0)&&(!c.level||c.level<=gp.level)&&!pend&&!S.attackPick;
  const isInstant=c.speed==='instant'&&gp.p[S.myId].coins>=(c.cost||0)&&!pend;
  const playable=canPlay||isInstant;
  const typeChar=c.type==='fighter'?'F':c.type==='weapon'?'W':c.type==='tactic'?'T':'R';
  const fanStyle=fanOpts?`--hand-rot:${fanOpts.rot};--hand-lift:${fanOpts.lift};`:'';
  const canFortifyHand=myTurn&&!pend&&!S.attackPick&&c.type==='fighter'&&c.fortifyInstead&&c.faction==='synth'&&gp.p[S.myId].coins>=2&&hasFortifyHost(gp,S.myId,uid);
  return`<div class="hcard${playable?'':' unplayable'}" ${fanOpts?`data-hand-pos="${fanOpts.idx}"`:''} style="border-color:${fCol}55;${fanStyle}"
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
    ${canFortifyHand?`<button class="hcard-fortify" onclick="event.stopPropagation();fortifyFromHand('${uid}')" title="Place under a Synth ally, that Synth gains this card's Health">FORTIFY 2&#9711;</button>`:''}
  </div>`;
}

function hasFortifyHost(gp,pid,excludeUid){
  return gp.p[pid].board.concat([gp.p[pid].boss]).some(u=>{
    if(!u||u===excludeUid)return false;
    const i=gp.inst[u];if(!i||i.hp<=0||i.fortifiedUnder)return false;
    const oc=CARDS[i.cid];
    return oc&&oc.faction==='synth'&&(oc.type==='fighter'||oc.type==='boss');
  });
}

window.fortifyFromHand=async function(u){
  await act(r=>{
    const gp=r.game;const pid=S.myId;
    if(gp.curIdx!==gp.order.indexOf(pid))return alert('Not your turn.');
    const card=gp.inst[u];if(!card)return;
    const c=CARDS[card.cid];
    if(!c.fortifyInstead||c.faction!=='synth')return alert('This card has no Fortify ability.');
    if(gp.p[pid].coins<2)return alert('Need 2 coins to Fortify.');
    const hosts=gp.p[pid].board.concat([gp.p[pid].boss]).filter(au=>{
      if(!au||au===u)return false;
      const ai=gp.inst[au];if(!ai||ai.hp<=0||ai.fortifiedUnder)return false;
      const ac=CARDS[ai.cid];
      return ac&&ac.faction==='synth'&&(ac.type==='fighter'||ac.type==='boss');
    });
    if(!hosts.length)return alert('No Synth ally available to Fortify under.');
    spendCoins(gp,pid,2);
    pendPick(gp,{forId:pid,prompt:'Fortify '+c.name+' under which Synth ally?',
      options:hosts.map(au=>({label:CARDS[gp.inst[au].cid].name+' ('+gp.inst[au].hp+'/'+gp.inst[au].maxHp+')',value:au}))},
      (g,host)=>{
        if(!host)return;
        const hostI=g.inst[host];const addHp=c.hp||0;
        hostI.maxHp+=addHp;hostI.hp+=addHp;
        g.p[pid].hand=g.p[pid].hand.filter(x=>x!==u);
        g.inst[u].fortifiedUnder=host;
        log(g,c.name+' Fortifies from hand under '+CARDS[hostI.cid].name+' (+'+addHp+' HP).');
      });
    gp.p[pid].hasActed=true;
    if(!gp.pending)nextTurn(gp);
  });
};

function bossHpPct(gp,pid){const b=gp.inst[gp.p[pid].boss];if(!b)return 0;return(b.hp/b.maxHp)*100;}

function playerStrip(gp,pid,isOpp){
  const p=gp.p[pid];const b=gp.inst[p.boss];
  const bBoss=b&&CARDS[b.cid];const bName=bBoss?bBoss.name:p.name;
  const isMyTurn=gp.curIdx===gp.order.indexOf(pid);
  const pct=bossHpPct(gp,pid);
  const hpLow=pct<35;
  const isMe=pid===S.myId;
  /* mulligan allowed only at L1, before any action */
  const canMull=isMe&&!p.mullUsed&&gp.level===1&&!p.hasActed;
  const pendForMe=isMe?pendingForMe(gp):null;
  const canEndTurn=isMe&&isMyTurn&&!pendForMe&&!S.attackPick;
  return`<div class="player-strip${isOpp?' opp':''}${isMyTurn?' active':''}">
    <div class="ps-id">
      <div class="player-name${isMyTurn?' is-turn':''}">${p.name}${p.defeated?' &#128128;':''}</div>
      <div class="ps-bossname">${bName}</div>
    </div>
    <div class="hp-bar-wrap">
      <div class="hp-label">BOSS</div>
      <div class="hp-bar"><div class="hp-fill${hpLow?' low':pct===100?' full':''}" style="width:${pct}%"></div></div>
      <div class="hp-num">${b?b.hp:'?'}/${b?b.maxHp:'?'}</div>
    </div>
    <div class="ps-piles">
      <div class="pile deck-pile${p.deck.length?'':' pile-empty'}${S.gmMode?' clickable':''}"
           title="${p.deck.length} card${p.deck.length===1?'':'s'} in deck — hidden (GM mode required to view)"
           ${S.gmMode?`onclick="viewPile('${pid}','deck')"`:''}>
        <div class="pile-stack"></div>
        ${p.deck.length?`<div class="pile-count">${p.deck.length}</div>`:''}
        <div class="pile-label">DECK</div>
      </div>
      ${p.topRevealed&&p.deck.length?`<div class="pile-revealed" title="Top of deck revealed" onclick="showZoom('${gp.inst[p.deck[0]].cid}')">${artImg(gp.inst[p.deck[0]].cid,'pile-revealed-img')}<span class="pile-revealed-lbl">TOP</span></div>`:''}
      <div class="pile grave-pile${p.grave.length?' clickable':' pile-empty'}"
           title="${p.grave.length} card${p.grave.length===1?'':'s'} in discard — click to view"
           ${p.grave.length?`onclick="viewPile('${pid}','grave')"`:''}>
        <div class="pile-stack"></div>
        ${p.grave.length?`<div class="pile-count">${p.grave.length}</div>`:''}
        <div class="pile-label">DSCRD</div>
      </div>
      <div class="pile hand-pile" title="${isOpp?'Opponent':'Your'} hand: ${p.hand.length} card${p.hand.length===1?'':'s'}">
        ${p.hand.length}
        <div class="pile-count">${p.hand.length}</div>
        <div class="pile-label">HAND</div>
      </div>
    </div>
    ${!isOpp?`<div class="ps-coins"><span class="coin-badge">${p.coins} &#9711;</span></div>`:`<div class="ps-coins"><span class="coin-badge opp">${p.coins} &#9711;</span></div>`}
    ${!isOpp?`<div class="ps-controls">
      <div class="level-pill"><span class="level-pill-l">LVL</span><span class="level-pill-n">${gp.level}</span></div>
      ${canMull?`<button class="btn ghost sm" onclick="doMulligan()" title="Redraw your starting hand (Level 1 only, before any action)">MULL</button>`:''}
      ${canEndTurn?`<button class="btn end-turn-btn" onclick="passTurn()">END TURN</button>`:''}
    </div>`:''}
  </div>`;
}

function renderZoom(){
  const cid=S.zoomCid;if(!cid||!CARDS[cid])return'';
  const c=CARDS[cid];
  /* Full card image only — every detail is printed on the card itself */
  return`<div class="zoom-overlay" onclick="closeZoom()">
    <div class="zoom-full" onclick="event.stopPropagation()">
      ${artImg(cid,'zoom-full-img')}
      <button class="zoom-close" onclick="closeZoom()" aria-label="Close">&#10005;</button>
    </div>
  </div>`;
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
  let h=`<div class="wrap"><h2 style="font-size:18px;margin-bottom:12px">DECK BUILDER</h2>`;

  const presets=(typeof window!=='undefined'&&window.CATA_PRESET_DECKS)||[];
  if(presets.length){
    h+=`<div class="section-h">QUICK START — PRE-BUILT DECKS</div>`;
    h+=`<div class="preset-grid">`;
    presets.forEach(d=>{
      const bossCard=CARDS[d.bossId];
      const facBadges=(d.factions||[]).map(f=>{const m=FACTION_META[f]||{};return`<span class="preset-fac ${m.cls||''}">${m.name||f}</span>`;}).join('');
      h+=`<div class="preset-tile">
        ${bossCard?artImg(d.bossId,'preset-boss-img'):'<div class="preset-boss-img-fb" style="aspect-ratio:5/7;background:#000"></div>'}
        <div class="preset-body">
          <div class="preset-name">${d.name}</div>
          <div class="preset-sub">${d.subtitle}</div>
          <div class="preset-facs">${facBadges}</div>
          <div class="preset-tagline">${d.tagline}</div>
          <div class="preset-actions">
            <button class="btn sm preset-pick" onclick="loadPreset('${d.id}')">USE THIS DECK</button>
            <button class="btn ghost sm" onclick="showPresetDetail('${d.id}')">Details</button>
          </div>
        </div>
      </div>`;
    });
    h+=`</div>`;
  }

  h+=`<div class="section-h">OR BUILD YOUR OWN — 1. CHOOSE UP TO 2 FACTIONS</div><div style="margin-bottom:8px">`;
  Object.entries(FACTION_META).forEach(([f,m])=>{const on=(me.factions||[]).includes(f);h+=`<span class="faction-chip ${m.cls}${on?' on':' off'}" onclick="toggleFaction('${f}')">${m.name}</span>`;});
  h+='</div>';
  if((me.factions||[]).length){
    h+='<div class="section-h">2. CHOOSE YOUR BOSS</div>';
    if(!bosses.length)h+='<div class="small" style="padding:8px">No bosses for this faction combo — try Synth or Mystic.</div>';
    h+='<div class="boss-pick">';
    bosses.forEach(b=>{h+=`<div class="boss-tile${me.bossId===b.id?' sel':''}" onclick="pickBoss('${b.id}')" oncontextmenu="showZoom('${b.id}');return false" title="${b.name}">
      ${artImg(b.id,'boss-tile-img')}
      <div class="boss-tile-cap">${b.name}${me.bossId===b.id?' <span style="color:var(--ap)">&#10003;</span>':''}</div>
    </div>`;});
    h+='</div><div class="section-h">3. BUILD AT LEAST 40 CARDS (MAX 3 COPIES EACH \u2014 NO UPPER LIMIT)</div>';
    const meetMin=total>=40;
    h+=`<div class="build-summary${meetMin?' ready':''}">${total} cards &nbsp;&#8226;&nbsp; ${Object.values(me.list||{}).filter(v=>v>0).length} unique &nbsp;&#8226;&nbsp; <span style="color:${meetMin?'var(--su)':'var(--dim)'}">${meetMin?'\u2713 meets 40-card minimum':'need '+(40-total)+' more'}</span><div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100,total/40*100)}%"></div></div></div>`;
    h+='<div class="deck-grid">';
    nonBoss.forEach(c=>{const n=(me.list||{})[c.id]||0;
      h+=`<div class="dtile${n>0?' has':''}${n>=3?' max':''}" oncontextmenu="showZoom('${c.id}');return false" title="${c.name} \u2014 right-click for details">
        ${artImg(c.id,'dtile-img')}
        ${n>0?`<div class="dtile-count">&#215;${n}</div>`:''}
        <div class="dtile-bar">
          <button class="dtile-btn" onclick="adjustCard('${c.id}',-1)" ${n===0?'disabled':''}>&#8722;</button>
          <span class="dtile-n">${n}/3</span>
          <button class="dtile-btn" onclick="adjustCard('${c.id}',1)" ${n>=3?'disabled':''}>+</button>
        </div>
        <button class="dtile-info" onclick="showZoom('${c.id}')" title="View card details">i</button>
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

  let h=`<div id="game-table" data-opp-count="${opps.length}">`;

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

  if(pend){
    h+=`<div class="action-bar">&#9650; ${pend.prompt}`;
    if(pend.kind==='pick'||pend.kind==='discard'){

      const opts=pend.options||[];
      const cardOpts=opts.filter(o=>o.value&&gp.inst[o.value]);
      const plainOpts=opts.filter(o=>!o.value||!gp.inst[o.value]);
      if(cardOpts.length){

        h+=`<div class="action-card-grid">${cardOpts.map(o=>{const u=o.value;const i=gp.inst[u];const c=CARDS[i.cid]||{};const fc=FCOL[c.faction]||'#888';return `<div class="action-card-pick" style="border-color:${fc}80" onclick="resolvePending('${u}')" title="${c.name||''}">${artImg(i.cid,'action-card-pick-img')}<div class="action-card-pick-cap">${(c.name||'?').slice(0,20)}</div></div>`;}).join('')}</div>`;
      }
      if(plainOpts.length){
        h+=`<div class="action-opts">${plainOpts.map(o=>`<button class="action-opt" onclick="resolvePending('${(o.value||'').replace(/'/g,"&#39;")}')">${o.label}</button>`).join('')}</div>`;
      }
      if(!cardOpts.length&&!plainOpts.length)
        h+=`<div class="action-opts">${opts.map(o=>`<button class="action-opt" onclick="resolvePending('${(o.value||'').replace(/'/g,"&#39;")}')">${o.label}</button>`).join('')}</div>`;
    }
    h+=`</div>`;
  }
  if(S.attackPick&&gp.inst[S.attackPick]){
    h+=`<div class="action-bar atk">&#9876; Attacking with <b>${CARDS[gp.inst[S.attackPick].cid].name}</b> — click a target above &nbsp; <button class="btn ghost sm" onclick="cancelAttackPick()">Cancel</button></div>`;
  }

  h+=`<div class="hand-strip">`;
  if(!myP.hand.length)h+='<div class="small" style="margin:auto;color:var(--dim)">Hand is empty</div>';
  const hn=myP.hand.length;const center=(hn-1)/2;const maxRot=hn>1?Math.min(22,hn*3.5):0;
  myP.hand.forEach((u,idx)=>{
    const off=hn>1?(idx-center)/center:0; /* -1..1 */
    const rot=(off*maxRot).toFixed(2)+'deg';
    const lift=(Math.abs(off)*Math.abs(off)*16).toFixed(1)+'px'; /* parabolic lift, edges higher */
    h+=hCard(gp,u,myTurn,pend,{idx,rot,lift});
  });
  h+=`</div>`;

  /* Log (collapsible, opens via button) */
  if(S.logOpen){
    h+=`<div class="log-panel"><div class="log-head">GAME LOG <button class="log-x" onclick="toggleLog()">&#10005;</button></div><div class="log-body">`;
    (gp.log||[]).slice(-30).reverse().forEach(l=>{h+=`<div>${l}</div>`;});
    h+=`</div></div>`;
  } else {
    h+=`<button class="log-fab" onclick="toggleLog()" title="Show game log">&#9776;</button>`;
  }
  /* Always-available dice button, just below the log fab */
  h+=`<div class="dice-fab-group">
    <button class="dice-fab" onclick="rollDieManual(6)" title="Roll a d6 (key game rule!)">&#9860; d6</button>
    <button class="dice-fab small" onclick="rollDieManual(20)" title="Roll a d20">d20</button>
  </div>`;

  h+=renderGmPanel(gp);

  h+='</div>';
  h+=renderGmEdit(gp);
  h+=renderPileView(gp);
  return h;
}

function renderGmPanel(gp){
  if(!S.gmMode)return'';
  let h='<div class="gm-panel"><div class="gm-panel-head">GM TOOLS</div><div class="gm-panel-body">';
  h+='<div class="gm-row"><span class="gm-row-lbl">LEVEL '+gp.level+'</span><button class="gm-mini" onclick="gmAdvanceLevel()" title="Force next level">&#187; Next Level</button></div>';
  gp.order.forEach(pid=>{const p=gp.p[pid];
    h+=`<div class="gm-player">
      <div class="gm-player-name">${p.name}${p.defeated?' &#128128;':''}</div>
      <div class="gm-row">
        <span class="gm-row-lbl">${p.coins} \u{1F4B0}</span>
        <button class="gm-mini" onclick="gmAdjustCoins('${pid}',-1)">&#8722;1</button>
        <button class="gm-mini" onclick="gmAdjustCoins('${pid}',1)">+1</button>
      </div>
      <div class="gm-row">
        <span class="gm-row-lbl">Hand ${p.hand.length}</span>
        <button class="gm-mini" onclick="gmDraw('${pid}')" title="Draw card">+Draw</button>
        <button class="gm-mini" onclick="gmDiscard('${pid}')" title="Discard last card">-Discard</button>
      </div>
      <div class="gm-row"><button class="gm-mini wide" onclick="gmRetap('${pid}')" title="Untap all units">Untap All</button></div>
    </div>`;
  });
  h+='<div class="gm-foot">Click &#9881; on any board card to edit its HP / counters / status.</div>';
  h+='<div class="gm-foot" style="margin-top:6px;border-top:1px solid rgba(240,180,41,0.15);padding-top:8px">ROLL DIE</div>';
  h+='<div class="gm-row gm-dice-row">';
  [4,6,8,10,12,20].forEach(s=>{h+=`<button class="gm-mini" onclick="rollDieManual(${s})" title="Roll a d${s}">d${s}</button>`;});
  h+='</div>';
  h+='</div></div>';
  return h;
}

function renderGmEdit(gp){
  if(!S.gmMode||!S.gmEditUid)return'';
  const uid=S.gmEditUid;const i=gp.inst[uid];if(!i)return'';
  const c=CARDS[i.cid];if(!c)return'';
  const counterAtk=(i.counters&&i.counters.atk)||0;
  return`<div class="overlay" onclick="if(event.target===this)gmCloseEdit()">
    <div class="gm-edit">
      <div class="gm-edit-head">
        <div>
          <div class="gm-edit-name">${c.name}</div>
          <div class="gm-edit-sub">${c.type.toUpperCase()}${c.sub?' \u00b7 '+c.sub:''}</div>
        </div>
        <button class="gm-edit-x" onclick="gmCloseEdit()">&#10005;</button>
      </div>
      <div class="gm-edit-body">
        <div class="gm-edit-stat">
          <div class="gm-edit-lbl">HEALTH</div>
          <div class="gm-edit-val">${i.hp} / ${i.maxHp}</div>
          <div class="gm-edit-ctl">
            <button class="gm-mini" onclick="gmAdjustHp('${uid}',-1)">&#8722;1</button>
            <button class="gm-mini" onclick="gmAdjustHp('${uid}',1)">+1</button>
            <button class="gm-mini" onclick="gmHealFull('${uid}')">Heal Full</button>
          </div>
        </div>
        <div class="gm-edit-stat">
          <div class="gm-edit-lbl">MAX HP</div>
          <div class="gm-edit-val">${i.maxHp}</div>
          <div class="gm-edit-ctl">
            <button class="gm-mini" onclick="gmAdjustMaxHp('${uid}',-1)">&#8722;1</button>
            <button class="gm-mini" onclick="gmAdjustMaxHp('${uid}',1)">+1</button>
          </div>
        </div>
        <div class="gm-edit-stat">
          <div class="gm-edit-lbl">+1 ATTACK COUNTERS</div>
          <div class="gm-edit-val">${counterAtk}</div>
          <div class="gm-edit-ctl">
            <button class="gm-mini" onclick="gmAdjustAtk('${uid}',-1)">&#8722;1</button>
            <button class="gm-mini" onclick="gmAdjustAtk('${uid}',1)">+1</button>
          </div>
        </div>
        <div class="gm-edit-stat">
          <div class="gm-edit-lbl">STATUS</div>
          <div class="gm-edit-ctl">
            <button class="gm-mini${i.stunned?' on':''}" onclick="gmToggleStun('${uid}')">${i.stunned?'\u2713 Stunned':'Stun'}</button>
            <button class="gm-mini${i.phantasmal?' on':''}" onclick="gmTogglePhantasmal('${uid}')">${i.phantasmal?'\u2713 Phantasmal':'Phantasmal'}</button>
            <button class="gm-mini" onclick="gmUntap('${uid}')">Untap</button>
          </div>
        </div>
        <div class="gm-edit-stat">
          <div class="gm-edit-ctl">
            <button class="gm-mini danger" onclick="gmDestroy('${uid}')">&#9760; Destroy (\u2192 Discard)</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function renderPileView(gp){
  if(!S.pileView)return'';
  const {pid,zone,filter}=S.pileView;
  if(!gp.p[pid])return'';
  const list=gp.p[pid][zone]||[];
  const isMine=pid===S.myId;
  const isDeck=zone==='deck';
  const zoneLabel=isDeck?'DECK':zone==='grave'?'DISCARD':'HAND';
  const filt=(filter||'').toLowerCase();
  const filtered=list.map(u=>({uid:u,c:CARDS[gp.inst[u].cid]})).filter(o=>!filt||(o.c&&o.c.name.toLowerCase().includes(filt))||(o.c&&(o.c.type||'').toLowerCase().includes(filt))||(o.c&&(o.c.faction||'').toLowerCase().includes(filt)));
  /* Sort deck view alphabetically for searchability; discard chronological (last on top) */
  const sorted=isDeck?filtered.slice().sort((a,b)=>(a.c.name||'').localeCompare(b.c.name||'')):filtered.slice().reverse();
  return`<div class="overlay" onclick="if(event.target===this)closePileView()">
    <div class="pile-view">
      <div class="pile-view-head">
        <div>
          <div class="pile-view-title">${gp.p[pid].name}\u2019s ${zoneLabel}</div>
          <div class="pile-view-sub">${list.length} card${list.length===1?'':'s'}${isDeck?' \u00b7 sorted by name (hidden from opponents in real play)':''}</div>
        </div>
        <button class="pile-view-x" onclick="closePileView()">&#10005;</button>
      </div>
      <div class="pile-view-search">
        <input type="text" placeholder="Filter by name / type / faction\u2026" value="${filter||''}" oninput="pileFilter(this.value)" autofocus>
        ${(isMine||S.gmMode)&&isDeck?`<button class="btn ghost sm" onclick="shuffleDeck('${pid}')">Shuffle</button>`:''}
      </div>
      <div class="pile-view-body">
        ${sorted.length?sorted.map(o=>{const cl=o.c||{};const fc=FCOL[cl.faction]||'#888';
          const canAct=isMine||S.gmMode;
          const actions=canAct?`<div class="pv-actions">
            ${zone==='grave'?`<button class="gm-mini" onclick="pileMove('${o.uid}','hand')" title="To hand">\u2191 Hand</button>`:''}
            ${zone==='deck'?`<button class="gm-mini" onclick="pileMove('${o.uid}','hand')" title="Pull to hand (search)">\u2192 Hand</button>`:''}
            ${zone==='deck'?`<button class="gm-mini" onclick="pileMove('${o.uid}','grave')" title="To discard">\u2192 Discard</button>`:''}
            ${zone==='grave'?`<button class="gm-mini" onclick="pileMove('${o.uid}','deck-top')" title="To top of deck">\u2191 Deck top</button>`:''}
          </div>`:'';
          return`<div class="pv-row">
            <div class="pv-thumb" oncontextmenu="showZoom('${o.uid&&gp.inst[o.uid]?gp.inst[o.uid].cid:''}');return false" onclick="showZoom('${o.uid&&gp.inst[o.uid]?gp.inst[o.uid].cid:''}')">${artImg(gp.inst[o.uid].cid,'pv-thumb-img')}</div>
            <div class="pv-info">
              <div class="pv-name" style="color:${fc}">${cl.name||'?'}</div>
              <div class="pv-meta">${(cl.faction||'').toUpperCase()} \u00b7 ${(cl.type||'').toUpperCase()}${cl.level?' L'+cl.level:''}${cl.cost!==undefined?' \u00b7 '+cl.cost+'\u2299':''}</div>
              ${actions}
            </div>
          </div>`;
        }).join(''):'<div class="pv-empty">No cards match.</div>'}
      </div>
      <div class="pile-view-foot">
        ${isMine||S.gmMode?'Tip: in real play, "search your deck" effects let you find a specific card. Click an action above. The deck auto-shuffles after.':'<span style="color:var(--dim)">Read-only \u2014 GM mode required to move opponents\u2019 cards.</span>'}
      </div>
    </div>
  </div>`;
}

function renderPresetDetail(){
  const p=S.presetDetail;if(!p)return'';
  const bossCard=CARDS[p.bossId];
  /* Build the card list grouped by type */
  const groups={fighter:[],weapon:[],tactic:[],response:[]};
  Object.entries(p.cards).forEach(([cid,q])=>{
    const c=CARDS[cid];if(!c)return;
    if(groups[c.type])groups[c.type].push({c,q});
  });
  Object.values(groups).forEach(g=>g.sort((a,b)=>(a.c.faction||'').localeCompare(b.c.faction||'')||a.c.name.localeCompare(b.c.name)));
  const sectionHtml=(title,arr)=>{
    if(!arr.length)return'';
    return`<div class="pd-section"><div class="pd-section-h">${title} (${arr.reduce((s,o)=>s+o.q,0)})</div><div class="pd-cards">${arr.map(o=>{const fc=FCOL[o.c.faction]||'#888';return`<div class="pd-card" style="border-left-color:${fc}" onclick="showZoom('${o.c.id}')"><div class="pd-card-q">\u00d7${o.q}</div><div class="pd-card-name" style="color:${fc}">${o.c.name}</div><div class="pd-card-meta">${(o.c.faction||'').toUpperCase()}${o.c.level?' L'+o.c.level:''}${o.c.cost!==undefined?' \u00b7 '+o.c.cost+'\u2299':''}</div></div>`;}).join('')}</div></div>`;
  };
  return`<div class="overlay" onclick="if(event.target===this)closePresetDetail()">
    <div class="preset-detail">
      <div class="preset-detail-head">
        <div>
          <div class="preset-detail-name">${p.name}</div>
          <div class="preset-detail-sub">${p.subtitle}</div>
        </div>
        <button class="zoom-close" style="position:relative;top:0;right:0" onclick="closePresetDetail()">&#10005;</button>
      </div>
      <div class="preset-detail-body">
        <div class="preset-detail-row">
          ${bossCard?`<div class="preset-detail-boss">${artImg(p.bossId,'preset-detail-boss-img')}<div class="preset-detail-boss-cap">BOSS: ${bossCard.name}</div></div>`:''}
          <div class="preset-detail-txt">
            <div class="pd-h">Strategy</div><div class="pd-p">${p.strategy}</div>
            <div class="pd-h">Level Gameplan</div>
            <ul class="pd-list">${(p.gameplan||[]).map(g=>`<li>${g}</li>`).join('')}</ul>
          </div>
        </div>
        ${sectionHtml('Fighters',groups.fighter)}
        ${sectionHtml('Weapons',groups.weapon)}
        ${sectionHtml('Tactics',groups.tactic)}
        ${sectionHtml('Responses',groups.response)}
      </div>
      <div class="preset-detail-foot">
        <button class="btn" onclick="loadPreset('${p.id}');closePresetDetail()">USE THIS DECK</button>
        <button class="btn ghost" onclick="closePresetDetail()">Close</button>
      </div>
    </div>
  </div>`;
}

function renderMulligan(){
  if(!S.mullOpen||!S.room||!S.room.game)return'';
  const gp=S.room.game;const me=gp.p[S.myId];if(!me)return'';
  const sel=S.mullSel||new Set();
  return`<div class="overlay" onclick="if(event.target===this)cancelMulligan()">
    <div class="mull-modal">
      <div class="mull-head">
        <div>
          <div class="mull-title">Mulligan</div>
          <div class="mull-sub">Tap any cards to set aside. You'll draw that many replacements, then the set-aside cards shuffle back into your deck.</div>
        </div>
        <button class="zoom-close" style="position:relative;top:0;right:0" onclick="cancelMulligan()">&#10005;</button>
      </div>
      <div class="mull-body">
        ${me.hand.map(u=>{const c=CARDS[gp.inst[u].cid]||{};const picked=sel.has(u);const fc=FCOL[c.faction]||'#888';
          return`<div class="mull-card${picked?' picked':''}" style="border-color:${picked?'var(--ap)':fc+'80'}" onclick="toggleMullCard('${u}')">
            ${artImg(gp.inst[u].cid,'mull-card-img')}
            <div class="mull-card-cap">${c.name||'?'}</div>
            ${picked?'<div class="mull-card-x">SET ASIDE</div>':''}
          </div>`;
        }).join('')}
      </div>
      <div class="mull-foot">
        <span class="mull-stat">${sel.size} of ${me.hand.length} selected</span>
        <div style="flex:1"></div>
        <button class="btn ghost sm" onclick="cancelMulligan()">Cancel</button>
        <button class="btn sm" onclick="confirmMulligan()">${sel.size?'Mulligan '+sel.size+' card'+(sel.size===1?'':'s'):'Keep all (skip)'}</button>
      </div>
    </div>
  </div>`;
}

function renderResponseWindow(){
  const gp=S.room.game;const rw=gp.responseWindow;if(!rw)return'';
  const ai=gp.inst[rw.attackerUid];const di=gp.inst[rw.defenderUid];
  if(!ai||!di)return'';
  const ac=CARDS[ai.cid];const dc=CARDS[di.cid];
  const aPlayer=gp.p[ai.owner]&&gp.p[ai.owner].name||'?';
  const dPlayer=gp.p[di.owner]&&gp.p[di.owner].name||'?';
  const projDmg=combatDamage(gp,rw.attackerUid,rw.defenderUid);
  const isMyPriority=rw.priority===S.myId;
  const isMeInvolved=ai.owner===S.myId||di.owner===S.myId;
  const me=gp.p[S.myId];
  const myCoins=me?me.coins:0;
  const myHand=me?me.hand:[];
  const responses=myHand.filter(u=>{const c=CARDS[gp.inst[u].cid];return c&&c.type==='response'&&(c.cost||0)<=myCoins;});

  /* Find Response activated abilities on the priority holder's board: Block on Tube Steak/Gizzard,
     Pia's Response Fortify, etc. — anything whose label includes "Response". */
  const respAbilities=[];
  if(me){
    me.board.concat([me.boss]).forEach(u=>{
      if(!u)return;
      const i=gp.inst[u];if(!i||i.stunned||i.hp<=0)return;
      const c=CARDS[i.cid];if(!c)return;
      (c.activated||[]).forEach((ab,idx)=>{
        if(!ab.label||!/response/i.test(ab.label))return;
        const needCoins=(ab.cost&&ab.cost.coins)||0;
        const needsTap=!!(ab.cost&&ab.cost.tap);
        const affordable=needCoins<=myCoins;
        const untapped=!needsTap||(i.actedCount||0)<1;
        respAbilities.push({uid:u,abilityIdx:idx,label:ab.label,coinCost:needCoins,affordable,untapped,disabled:!affordable||!untapped,card:c,inst:i});
      });
    });
  }

  const priorityName=gp.p[rw.priority]&&gp.p[rw.priority].name||'?';
  return`<div class="overlay resp-overlay">
    <div class="resp-modal${isMeInvolved?' me-involved':''}">
      <div class="resp-header"><span class="resp-header-ico">&#9876;</span>ATTACK DECLARED</div>
      <div class="resp-vs">
        <div class="resp-side resp-attacker">
          <div class="resp-side-card">${artImg(ai.cid,'resp-side-img')}</div>
          <div class="resp-side-meta">
            <div class="resp-side-name">${ac.name}</div>
            <div class="resp-side-owner">${aPlayer}</div>
            <div class="resp-side-stats"><span class="resp-atk">&#9876; ${projDmg}</span></div>
          </div>
        </div>
        <div class="resp-arrow">
          <span class="resp-arrow-line"></span>
          <span class="resp-dmg-tag">-${projDmg} DMG</span>
        </div>
        <div class="resp-side resp-defender">
          <div class="resp-side-card">${artImg(di.cid,'resp-side-img')}</div>
          <div class="resp-side-meta">
            <div class="resp-side-name">${dc.name}</div>
            <div class="resp-side-owner">${dPlayer}</div>
            <div class="resp-side-stats"><span class="resp-hp">&#10084; ${di.hp}/${di.maxHp}</span></div>
          </div>
        </div>
      </div>
      ${isMyPriority?`
        <div class="resp-prompt">Your priority. Play a Response from hand, activate a Response ability on the board, or allow the attack.</div>
        ${respAbilities.length?`
          <div class="resp-cards-label">RESPONSE ABILITIES ON YOUR BOARD</div>
          <div class="resp-cards">${respAbilities.map(r=>`<div class="resp-card resp-board-ability${r.disabled?' disabled':''}" ${r.disabled?'':`onclick="useAbility('${r.uid}',${r.abilityIdx})"`} title="${r.card.name}: ${r.label}${r.disabled?' (cannot use)':''}">
            ${artImg(r.inst.cid,'resp-card-img')}
            <div class="resp-card-foot">
              <div class="resp-card-name">${r.card.name}</div>
              <div class="resp-card-cost">${r.coinCost}&#9711;</div>
            </div>
            <div class="resp-board-tag">${r.label.replace(/response\s*/i,'').slice(0,18)}</div>
          </div>`).join('')}</div>
        `:''}
        ${responses.length?`
          <div class="resp-cards-label">RESPONSE CARDS IN YOUR HAND</div>
          <div class="resp-cards">${responses.map(u=>{const c=CARDS[gp.inst[u].cid];return `<div class="resp-card" onclick="playHandCard('${u}')">
            ${artImg(gp.inst[u].cid,'resp-card-img')}
            <div class="resp-card-foot">
              <div class="resp-card-name">${c.name}</div>
              <div class="resp-card-cost">${c.cost||0}&#9711;</div>
            </div>
          </div>`;}).join('')}</div>
        `:''}
        ${!responses.length&&!respAbilities.length?'<div class="resp-no-cards">You have no Response cards in hand and no Response abilities on the board.</div>':''}
        <div class="resp-buttons">
          <button class="btn lg" onclick="passResponse()">ALLOW ATTACK</button>
        </div>
      `:`
        <div class="resp-waiting">
          <div class="resp-waiting-pulse"></div>
          Waiting for <b>${priorityName}</b> to respond&hellip;
        </div>
      `}
    </div>
  </div>`;
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
  const inGame=S.room&&S.room.phase==='play';
  let h=`<div id="topbar"><div class="code">TABLE ${S.code||''}</div><div style="display:flex;gap:8px">${inGame?`<button class="btn ghost sm${S.gmMode?' gm-on':''}" onclick="toggleGm()" title="Toggle Game Master mode: manual overrides for HP, counters, status, coins, etc.">GM ${S.gmMode?'ON':'OFF'}</button>`:''}<button class="btn ghost sm" onclick="toggleHelp()">Keywords</button><button class="btn ghost sm" onclick="leaveTable()">Leave</button></div></div>`;
  if(S.room){
    if(S.room.phase==='lobby')h+=renderLobby();
    else if(S.room.phase==='build')h+=renderBuild();
    else if(S.room.phase==='play')h+=renderPlay();
  }
  if(S.helpOpen)h+=renderHelp();
  if(S.zoomCid)h+=renderZoom();
  if(S.presetDetail)h+=renderPresetDetail();
  if(S.mullOpen)h+=renderMulligan();
  if(S.room&&S.room.game&&S.room.game.responseWindow)h+=renderResponseWindow();
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

function rollDieVisible(sides,reason,cb){
  sides=sides||6;const result=1+Math.floor(Math.random()*sides);

  try{
    const ov=document.createElement('div');ov.className='fx-dice-overlay';
    ov.innerHTML='<div class="fx-die fx-die-rolling"><span class="fx-die-face">?</span></div><div class="fx-die-lbl">'+(reason||'Rolling d'+sides)+'</div>';
    document.body.appendChild(ov);
    let tick=0;const id=setInterval(()=>{
      tick++;
      ov.querySelector('.fx-die-face').textContent=1+Math.floor(Math.random()*sides);
      if(tick>=14){clearInterval(id);
        ov.querySelector('.fx-die').classList.remove('fx-die-rolling');
        ov.querySelector('.fx-die').classList.add('fx-die-settled');
        ov.querySelector('.fx-die-face').textContent=result;
        setTimeout(()=>{try{ov.remove();}catch(e){}cb&&cb(result);},900);}
    },70);
  }catch(e){cb&&cb(result);}
  return result;
}

function effectiveAtkCost(gp,uid){
  const i=gp.inst[uid];if(!i)return 0;const c=CARDS[i.cid];if(!c)return 0;
  let cost=c.atkCost||0;

  if(i._costOverride!==undefined&&i._costOverride!==null)cost=i._costOverride;
  const pid=i.owner;

  (i.wielded||[]).forEach(wu=>{const wc=CARDS[gp.inst[wu].cid];
    if(wc&&wc.id==='render-mq82wrmk')cost-=1;

    if(wc&&wc.wielderAtkCostMod)cost+=wc.wielderAtkCostMod;
  });

  if(c.id==='render-mq83m92b'){
    const surv=myFighters(gp,pid).filter(u=>(CARDS[gp.inst[u].cid]||{}).faction==='survivor').length;
    cost-=surv;
  }

  gp.p[pid].board.concat([gp.p[pid].boss]).forEach(au=>{
    if(!au||au===uid)return;const ai=gp.inst[au];if(!ai)return;const ac=CARDS[ai.cid];if(!ac)return;
    if(ac.atkCostModForAlly){cost+=ac.atkCostModForAlly(gp,uid,au);}
  });

  eachOpponent(gp,pid,oppPid=>{
    gp.p[oppPid].board.concat([gp.p[oppPid].boss]).forEach(u=>{
      if(u&&(CARDS[(gp.inst[u]||{}).cid]||{}).id==='render-mq83senr')cost+=1;
    });
  });
  return Math.max(0,cost);
}

function isUntargetable(gp,uid,attackerPid){
  const i=gp.inst[uid];if(!i)return false;const c=CARDS[i.cid];if(!c)return false;
  /* Seeya: untargetable if 5+ Fighters on team */
  if(c.id==='render-mq83jdnu'&&myFighters(gp,i.owner).length>=5)return true;
  /* Zanni: can't be attacked */
  if(c.id==='render-mq83wcyl')return true;
  /* Flank: can't be attacked if 4+ Fighters on team */
  if(c.id==='render-mq82yz0l'&&myFighters(gp,i.owner).length>=4)return true;
  /* Tantrum: can't be attacked if Whump! is alive on team */
  if(c.id==='render-mq83ph11'){
    const hasWhump=gp.p[i.owner].board.some(u=>(CARDS[(gp.inst[u]||{}).cid]||{}).id==='render-mq83vajo'&&gp.inst[u].hp>0);
    if(hasWhump)return true;
  }
  return false;
}

function fireOnAttacked(gp,defUid,atkUid){
  const di=gp.inst[defUid];if(!di)return;const dc=CARDS[di.cid];
  if(dc&&dc.onAttacked)dc.onAttacked(gp,{pid:di.owner,src:defUid,attacker:atkUid});
}

function showDamageNumber(uid,amt,kind){
  try{
    const el=document.querySelector('[data-uid="'+uid+'"]');if(!el)return;
    const fx=document.createElement('div');fx.className='fx-damage '+(kind||'dmg');
    fx.textContent=(amt>0&&kind==='heal'?'+':'')+amt;
    const r=el.getBoundingClientRect();
    fx.style.left=(r.left+r.width/2)+'px';fx.style.top=(r.top+r.height*0.25)+'px';
    document.body.appendChild(fx);
    setTimeout(()=>{try{fx.remove();}catch(e){}},1100);
  }catch(e){}
}

function showAttackFlash(atkUid,defUid){

  const a=document.querySelector('[data-uid="'+atkUid+'"]');
  const d=document.querySelector('[data-uid="'+defUid+'"]');
  if(!a||!d)return;
  const ar=a.getBoundingClientRect(),dr=d.getBoundingClientRect();
  const ax=ar.left+ar.width/2,ay=ar.top+ar.height/2;
  const dx=dr.left+dr.width/2,dy=dr.top+dr.height/2;
  const len=Math.hypot(dx-ax,dy-ay);
  const ang=Math.atan2(dy-ay,dx-ax)*180/Math.PI;

  requestAnimationFrame(()=>{
    try{

      const beam=document.createElement('div');beam.className='fx-attack-beam';
      beam.style.left=ax+'px';beam.style.top=ay+'px';
      beam.style.width=len+'px';
      beam.style.transform='translateY(-50%) rotate('+ang+'deg)';
      document.body.appendChild(beam);

      const crackle=document.createElement('div');crackle.className='fx-attack-crackle';
      crackle.style.left=ax+'px';crackle.style.top=ay+'px';
      crackle.style.width=len+'px';
      crackle.style.transform='translateY(-50%) rotate('+ang+'deg)';
      document.body.appendChild(crackle);

      const burst=document.createElement('div');burst.className='fx-impact-burst';
      burst.style.left=dx+'px';burst.style.top=dy+'px';
      document.body.appendChild(burst);

      const target=document.querySelector('[data-uid="'+defUid+'"]');
      if(target)target.classList.add('fx-shake');

      setTimeout(()=>{
        try{beam.remove();crackle.remove();burst.remove();}catch(e){}
        if(target)target.classList.remove('fx-shake');
      },900);
    }catch(e){console.warn('attack flash failed:',e);}
  });
}

function showStunEffect(uid){
  requestAnimationFrame(()=>{
    try{
      const el=document.querySelector('[data-uid="'+uid+'"]');if(!el)return;
      const r=el.getBoundingClientRect();
      const fx=document.createElement('div');fx.className='fx-stun-burst';
      fx.style.left=(r.left+r.width/2)+'px';fx.style.top=(r.top+r.height/2)+'px';
      document.body.appendChild(fx);
      setTimeout(()=>{try{fx.remove();}catch(e){}},1500);
    }catch(e){}
  });
}

function showHealEffect(uid){
  requestAnimationFrame(()=>{
    try{
      const el=document.querySelector('[data-uid="'+uid+'"]');if(!el)return;
      const r=el.getBoundingClientRect();

      for(let i=0;i<5;i++){
        const fx=document.createElement('div');fx.className='fx-heal-spark';
        fx.style.left=(r.left+r.width*0.2+Math.random()*r.width*0.6)+'px';
        fx.style.top=(r.top+r.height*0.7)+'px';
        fx.style.animationDelay=(i*60)+'ms';
        document.body.appendChild(fx);
        setTimeout(()=>{try{fx.remove();}catch(e){}},1400);
      }
    }catch(e){}
  });
}

function showCounterEffect(uid){
  requestAnimationFrame(()=>{
    try{
      const el=document.querySelector('[data-uid="'+uid+'"]');if(!el)return;
      const r=el.getBoundingClientRect();
      const fx=document.createElement('div');fx.className='fx-counter-pulse';
      fx.style.left=(r.left+r.width/2)+'px';fx.style.top=(r.top+r.height/2)+'px';
      document.body.appendChild(fx);
      setTimeout(()=>{try{fx.remove();}catch(e){}},900);
    }catch(e){}
  });
}

function showDestroyEffect(uid){

  const el=document.querySelector('[data-uid="'+uid+'"]');if(!el)return;
  const r=el.getBoundingClientRect();
  requestAnimationFrame(()=>{
    try{
      const fx=document.createElement('div');fx.className='fx-destroy-burst';
      fx.style.left=(r.left+r.width/2)+'px';fx.style.top=(r.top+r.height/2)+'px';
      fx.style.width=r.width+'px';fx.style.height=r.height+'px';
      document.body.appendChild(fx);
      setTimeout(()=>{try{fx.remove();}catch(e){}},1100);
    }catch(e){}
  });
}
