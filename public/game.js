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
const IMG_BASE='https://raw.githubusercontent.com/ctest9104-tech/cataclysm-assets/main/images/';
const CIMG={
  decommissioner:'DS1-023.webp',toolshed:'DS1-030.webp',trapper:'DS1-038.webp',dreyver:'DS1-071.webp',
  prox:'render-mq82m6em.webp',quarters:'render-mq82m6zt.webp',father:'render-mq82mt2o.webp',motreina:'render-mq82mtls.webp',
  fishhooks:'render-mq82n30v.webp',bluegelati:'render-mq82n695.webp',notamotua:'render-mq82noow.webp',bleargh:'render-mq82ns08.webp',
  dataspike:'render-mq82ocja.webp',swiftpack:'render-mq82od0q.webp',blastscanner:'render-mq82oy4v.webp',jackedhammer:'render-mq82ozdt.webp',
  givethesignal:'render-mq82pliu.webp',bestoffense:'render-mq82pls1.webp',powerplay:'render-mq82qaar.webp',boom:'render-mq82qb03.webp',
  autopilot:'render-mq82qx7k.webp',signaljam:'render-mq82qy7i.webp',effwithmeammo:'render-mq82rj1b.webp',mothermayeye:'render-mq82rkj2.webp',
  tantrum:'render-mq82rspr.webp',flecks:'render-mq82ry0b.webp',shaman:'render-mq82se55.webp',ebb:'render-mq82smh7.webp',
  gates:'render-mq82ssqb.webp',clief:'render-mq82szo4.webp',shadowstriker:'render-mq82tevl.webp',reika:'render-mq82tt5b.webp',
  darby:'render-mq82u1ed.webp',minka:'render-mq82ueab.webp',slider:'render-mq82up5x.webp',intersentinel:'render-mq82uuz1.webp',
  freevector:'render-mq82v2l0.webp',vector:'render-mq82vipj.webp',mechtorsuit:'render-mq82vp7e.webp',swordfromnowhere:'render-mq82w5xo.webp',
  theurgicthrashing:'render-mq82wdi3.webp',rollcall:'render-mq82wrmk.webp',malefice:'render-mq82x31a.webp',voltagesnap:'render-mq82xhjm.webp',
  sludged:'render-mq82xttd.webp',rats:'render-mq82xys2.webp',fullheal:'render-mq82yd7b.webp',echofade:'render-mq82yhl3.webp',
  evanesce:'render-mq82yuv1.webp',marrowpiercer:'render-mq82yz0l.webp',murkgodpendant:'render-mq82zd5k.webp',trackersfrenzy:'render-mq82zkhm.webp',
  undertowed:'render-mq83035u.webp',steelswipe:'render-mq830569.webp',toothextraction:'render-mq830mwk.webp',catchcard:'render-mq830owo.webp',
  pushcard:'render-mq83191n.webp',derail:'render-mq831dlh.webp',emergencybrake:'render-mq831kn8.webp',flippingout:'render-mq831q38.webp',
  nightvision:'render-mq8327ej.webp',ahacard:'render-mq832cs4.webp',outlast:'render-mq832sdi.webp',
  beartrap:'render-mq832yx4.webp',toolbox:'render-mq833gl9.webp',headrat:'render-mq833kln.webp',whump:'render-mq833z75.webp'
};
function cimg(cid){ return CIMG[cid]?IMG_BASE+CIMG[cid]:null; }
const FBG={synth:'#1f0d02',mystic:'#0f0520',shifter:'#040c1a',survivor:'#050f08',apex:'#130d00',token:'#0d0a07'};
const FCOL={synth:'#FF6D23',mystic:'#9B59B6',shifter:'#4A9EE8',survivor:'#76C442',apex:'#F0B429'};
function artImg(cid,cls){
  const src=cimg(cid); const c=CARDS[cid]; const fb=c?FBG[c.faction]||'#0d0a07':'#0d0a07';
  return src?`<img class="${cls}" src="${src}" loading="lazy" onerror="this.style.background='${fb}';this.removeAttribute('src')" alt="">`
    :`<div class="${cls}-fb" style="background:${fb}"></div>`;
}

/* META */
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

/* CARDS DATABASE */
const CARDS={
/* SYNTH BOSSES */
decommissioner:{id:'decommissioner',name:'The Decommissioner',faction:'synth',type:'boss',sub:'Champion',hp:17,atk:2,atkCost:3,
  text:'When attacking, you may discard a card: deal 2 dmg to target Fighter. \u2463\u2299: Return a Synth Fighter from your graveyard to play.',
  onAttack(gp,ctx){pendDiscardOptional(gp,ctx,'Discard a card to deal 2 dmg to a Fighter?',(gp2,ctx2,dUid)=>{if(!dUid)return;moveZone(gp2,ctx2.pid,dUid,'hand','grave');pendTarget(gp2,{forId:ctx2.pid,prompt:'Choose a Fighter to deal 2 damage',filter:i=>i.kind==='fighter'},(gp3,uid)=>dealDamage(gp3,uid,2));});},
  activated:[{label:'Return Synth Fighter from grave',cost:{coins:3,tap:true},run(gp,ctx){const opts=gp.p[ctx.pid].grave.filter(u=>{const i=gp.inst[u];return i&&CARDS[i.cid].faction==='synth'&&CARDS[i.cid].type==='fighter';});if(!opts.length){log(gp,'No Synth Fighters in graveyard.');return;}pendPick(gp,{forId:ctx.pid,prompt:'Return which Fighter?',options:opts.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},(gp2,uid)=>{moveZone(gp2,ctx.pid,uid,'grave','board');resetInstance(gp2,uid);fireOnEnter(gp2,uid,ctx.pid);});}}]},
toolshed:{id:'toolshed',name:'Toolshed',faction:'synth',type:'boss',sub:'Weaponsmith',hp:17,atk:2,atkCost:2,
  text:'Whenever a Weapon enters play under your control, you may pay \u2460 to draw a card. \u2463\u2299: Create a "Toolbox" Synth Fighter token (1/1/3).',
  onWeaponEnter(gp,ctx){pendPick(gp,{forId:ctx.pid,prompt:'Pay \u2460 to draw?',options:[{label:'Pay \u2460 \u2014 Draw',value:'y'},{label:'Skip',value:'n'}]},(gp2,v)=>{if(v==='y'&&spendCoins(gp2,ctx.pid,1))drawN(gp2,ctx.pid,1);});},
  activated:[{label:'Create Toolbox token',cost:{coins:3,tap:true},run(gp,ctx){createToken(gp,ctx.pid,'toolbox');}}]},
trapper:{id:'trapper',name:'Trapper, Hunter of the Pack',faction:'synth',type:'boss',sub:'Hunter',hp:16,atk:3,atkCost:3,
  text:'At the start of a level, if you have no cards in hand, draw an additional card. \u2462\u2299: Create a "Bear Trap" token.',
  activated:[{label:'Create Bear Trap token',cost:{coins:2,tap:true},run(gp,ctx){createToken(gp,ctx.pid,'beartrap');}}]},
/* MYSTIC BOSSES */
effwithmeammo:{id:'effwithmeammo',name:'Eff with me Ammo',faction:'mystic',type:'boss',hp:17,atk:2,atkCost:2,
  text:'Has Agility while you control a Rat. \u2462\u2299: Create a "Head Rat" Mystic token (1/0/2).',
  activated:[{label:'Create Head Rat token',cost:{coins:2,tap:true},run(gp,ctx){createToken(gp,ctx.pid,'headrat');}}]},
mothermayeye:{id:'mothermayeye',name:'Mother May Eye',faction:'mystic',type:'boss',sub:'Tracker',hp:16,atk:1,atkCost:1,
  text:'Gets +1 Attack per Tactic/Response played this level. \u2299: play with top of deck revealed. (Manual.)'},
tantrum:{id:'tantrum',name:'Tantrum, World Ender',faction:'mystic',type:'boss',sub:'Illusionist',hp:16,atk:2,atkCost:2,
  text:'Can\'t be attacked while you control a "Whump!" token. \u2463\u2299, deal 1 dmg to self: Create a "Whump!" token.',
  cantBeAttackedIfTokenAlive:'whump',
  activated:[{label:'Create Whump! (1 self dmg)',cost:{coins:3,tap:true,selfDamage:1},run(gp,ctx){createToken(gp,ctx.pid,'whump');}}]},
/* SHIFTER BOSS */
shapechanger:{id:'shapechanger',name:'The Shapechanger',faction:'shifter',type:'boss',sub:'Chameleon',hp:16,atk:2,atkCost:2,
  text:'When a Fighter you control dies, you may Transform a Fighter you control for free. \u2462\u2299: Draw a card if you have fewer cards in hand than any opponent.',
  activated:[{label:'Draw if fewest cards in hand',cost:{coins:2,tap:true},run(gp,ctx){const myH=gp.p[ctx.pid].hand.length;const oppMax=Object.keys(gp.p).filter(p=>p!==ctx.pid&&!gp.p[p].defeated).reduce((m,p)=>Math.max(m,gp.p[p].hand.length),0);if(myH<oppMax)drawN(gp,ctx.pid,1);else log(gp,'Shapechanger: no draw.');}}]},
/* SURVIVOR BOSS */
ironforager:{id:'ironforager',name:'Iron Forager',faction:'survivor',type:'boss',sub:'Scavenger',hp:18,atk:1,atkCost:1,
  text:'At the start of each level, if your Boss has less than half its max Health, it heals 2. \u2463\u2299: All your Fighters heal 1.',
  onLevelStart(gp,pid){const b=gp.inst[gp.p[pid].boss];if(b&&b.hp<b.maxHp/2)healInst(gp,gp.p[pid].boss,2);},
  activated:[{label:'Heal all your Fighters by 1',cost:{coins:3,tap:true},run(gp,ctx){gp.p[ctx.pid].board.forEach(u=>{if(gp.inst[u]&&gp.inst[u].kind==='fighter')healInst(gp,u,1);});}}]},
/* APEX BOSS */
apexpredator:{id:'apexpredator',name:'The Apex Predator',faction:'apex',type:'boss',sub:'Predator',hp:17,atk:3,atkCost:3,
  text:'When attacking, if you have more Fighters than all opponents, deal +2 damage. \u2462\u2299: Give target Fighter a +1 Attack counter.',
  activated:[{label:'Give Fighter +1 Attack counter',cost:{coins:2,tap:true},run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Give +1 Atk counter to which Fighter?',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(gp2,uid)=>addCounter(gp2,uid,'atk',1));}}]},
/* SYNTH FIGHTERS */
dreyver:{id:'dreyver',name:'Dreyver, Terminarch',faction:'synth',type:'fighter',kind:'fighter',sub:'Endlings',level:1,hp:3,atk:1,atkCost:2,cost:2,
  text:'Other Synth Fighters/Bosses cost \u2460 less to attack/activate. \u2462\u2299: Target Synth gains Agility this level.',
  activated:[{label:'Grant Agility to a Synth',cost:{coins:2,tap:true},run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Grant Agility to which Synth?',filter:i=>CARDS[i.cid]&&CARDS[i.cid].faction==='synth'&&i.owner===ctx.pid},(gp2,uid)=>{gp2.inst[uid].agilityLevel=true;});}}]},
prox:{id:'prox',name:'ProX',faction:'synth',type:'fighter',kind:'fighter',level:2,hp:3,atk:1,atkCost:0,cost:0,text:'\u2299: You gain \u2460.',activated:[{label:'Tap: Gain \u2460',cost:{tap:true},run(gp,ctx){gp.p[ctx.pid].coins++;}}]},
quarters:{id:'quarters',name:'Quarters',faction:'synth',type:'fighter',kind:'fighter',level:2,hp:2,atk:2,atkCost:0,cost:0,text:'Free 2-Attack body.'},
father:{id:'father',name:'Father, Annihilator',faction:'synth',type:'fighter',kind:'fighter',level:2,hp:2,atk:1,atkCost:1,cost:1,
  text:'Father wields Weapons for no cost. Response \u2462, Destroy Father: Return a Weapon from your graveyard to play.',freeWieldTarget:true,
  activated:[{label:'Response: Destroy\u2192return Weapon from grave',cost:{coins:2,sacrifice:true},run(gp,ctx){const opts=gp.p[ctx.pid].grave.filter(u=>gp.inst[u]&&CARDS[gp.inst[u].cid].type==='weapon');if(!opts.length){log(gp,'No Weapons in graveyard.');return;}pendPick(gp,{forId:ctx.pid,prompt:'Return which Weapon?',options:opts.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},(gp2,wUid)=>{moveZone(gp2,ctx.pid,wUid,'grave','board');resetInstance(gp2,wUid);pendTarget(gp2,{forId:ctx.pid,prompt:'Wield it to which Fighter?',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(gp3,fUid)=>wieldWeapon(gp3,wUid,fUid));});}}]},
motreina:{id:'motreina',name:'Motreina, Stepmonster',faction:'synth',type:'fighter',kind:'fighter',level:2,hp:3,atk:1,atkCost:1,cost:1,
  text:'On enter, wield up to one of your Weapons to target Fighter. \u2460\u2299: Move one of your wielded Weapons to another Fighter.',
  onEnter(gp,ctx){const w=gp.p[ctx.pid].board.filter(u=>gp.inst[u]&&CARDS[gp.inst[u].cid].type==='weapon'&&!gp.inst[u].wieldedBy);if(!w.length)return;pendPick(gp,{forId:ctx.pid,prompt:'Wield a Weapon on enter?',options:[...w.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})),{label:'Skip',value:''}]},(gp2,wUid)=>{if(!wUid)return;pendTarget(gp2,{forId:ctx.pid,prompt:'Wield to which Fighter?',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(gp3,fUid)=>wieldWeapon(gp3,wUid,fUid));});},
  activated:[{label:'Move a wielded Weapon',cost:{coins:1,tap:true},run(gp,ctx){const w=gp.p[ctx.pid].board.filter(u=>gp.inst[u]&&CARDS[gp.inst[u].cid].type==='weapon'&&gp.inst[u].wieldedBy);if(!w.length)return;pendPick(gp,{forId:ctx.pid,prompt:'Move which Weapon?',options:w.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},(gp2,wUid)=>pendTarget(gp2,{forId:ctx.pid,prompt:'Move to which Fighter?',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid&&i.uid!==gp2.inst[wUid].wieldedBy},(gp3,fUid)=>wieldWeapon(gp3,wUid,fUid)));}}]},
fishhooks:{id:'fishhooks',name:'Fishhooks',faction:'synth',type:'fighter',kind:'fighter',level:5,hp:4,atk:3,atkCost:2,cost:2,text:'Enforcer.',keywords:['Enforcer']},
bluegelati:{id:'bluegelati',name:'The Blue Gelati',faction:'synth',type:'fighter',kind:'fighter',level:3,hp:4,atk:1,atkCost:1,cost:1,
  text:'If this would die, it Fortifies instead. May pay \u2460 when attacking to gain +X Attack equal to a Weapon\'s Attack.',fortifyInstead:true,
  preAttack(gp,ctx){pendPick(gp,{forId:ctx.pid,prompt:'Pay \u2460 to borrow a Weapon\'s Attack?',options:[{label:'Pay \u2460 \u2014 borrow',value:'y'},{label:'Skip',value:'n'}]},(gp2,v)=>{if(v==='y'&&spendCoins(gp2,ctx.pid,1)){const ws=allBoard(gp2).filter(u=>gp2.inst[u]&&CARDS[gp2.inst[u].cid].type==='weapon');if(ws.length)pendPick(gp2,{forId:ctx.pid,prompt:'Borrow which Weapon\'s Attack?',options:ws.map(u=>({label:CARDS[gp2.inst[u].cid].name+' (+'+weaponAtk(gp2,u)+')',value:u}))},(gp3,wu)=>{gp3.inst[ctx.attacker].tempAtk=(gp3.inst[ctx.attacker].tempAtk||0)+weaponAtk(gp3,wu);resumeAttack(gp3,ctx);});}else resumeAttack(gp2,ctx);});}},
notamotua:{id:'notamotua',name:'Notamotua, Deathpunch',faction:'synth',type:'fighter',kind:'fighter',level:6,hp:4,atk:2,atkCost:3,cost:3,
  text:'Armor 1. \u2462\u2299: Destroy target Fighter that was dealt damage this level.',armor:1,
  activated:[{label:'Destroy a damaged Fighter',cost:{coins:2,tap:true},run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Destroy which Fighter (damaged)?',filter:i=>i.kind==='fighter'&&i.dmgThisLevel},(gp2,uid)=>destroyInstance(gp2,uid));}}]},
bleargh:{id:'bleargh',name:'Bleargh, Noxious Entity',faction:'mystic',type:'fighter',kind:'fighter',level:3,hp:3,atk:2,atkCost:0,cost:0,text:'Free 2-Attack body.'},
/* SYNTH WEAPONS */
dataspike:{id:'dataspike',name:'Data Spike',faction:'synth',type:'weapon',level:3,cost:2,text:'Enters with a charge. Wielder dies\u2192charge added. Wielder gets +1 Atk per charge.',dynamicAtk(gp,uid){return(gp.inst[uid].counters.charge||0);},startCounters:{charge:1}},
swiftpack:{id:'swiftpack',name:'Swiftpack',faction:'synth',type:'weapon',level:3,cost:2,text:'Wielder has Agility.',grantsKeyword:'agility'},
blastscanner:{id:'blastscanner',name:'Blast Scanner',faction:'synth',type:'weapon',level:4,cost:2,text:'On wield, stun target opposing Fighter.',onWield(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Stun which opposing Fighter?',filter:i=>i.kind==='fighter'&&i.owner!==ctx.pid},(gp2,uid)=>{gp2.inst[uid].stunned=true;});}},
jackedhammer:{id:'jackedhammer',name:'Jacked Hammer',faction:'synth',type:'weapon',level:1,cost:1,atkMod:1,text:'+1 Attack to wielder.'},
/* SYNTH TACTICS/RESPONSES */
givethesignal:{id:'givethesignal',name:'Give The Signal',faction:'synth',type:'tactic',speed:'sorcery',cost:5,text:'Reveal top 5 of deck. Synth Fighters may be played free. Put rest on bottom shuffled.',
  run(gp,ctx){const top=gp.p[ctx.pid].deck.slice(0,5);gp.p[ctx.pid].deck=gp.p[ctx.pid].deck.slice(5);const rest=[];top.forEach(u=>{const c=gp.inst[u]&&CARDS[gp.inst[u].cid];if(c&&c.faction==='synth'&&c.type==='fighter'){gp.p[ctx.pid].board.push(u);resetInstance(gp,u);fireOnEnter(gp,u,ctx.pid);}else rest.push(u);});gp.p[ctx.pid].deck=shuffle([...gp.p[ctx.pid].deck,...rest]);log(gp,'Give The Signal: '+(5-rest.length)+' Synth Fighters played.');}},
bestoffense:{id:'bestoffense',name:'Best Offense',faction:'synth',type:'tactic',speed:'sorcery',cost:3,text:'Deal damage equal to greatest Health among your Fighters.',
  run(gp,ctx){const best=gp.p[ctx.pid].board.filter(u=>gp.inst[u]&&gp.inst[u].kind==='fighter').reduce((m,u)=>Math.max(m,gp.inst[u].maxHp),0);pendTarget(gp,{forId:ctx.pid,prompt:'Deal '+best+' damage to:',filter:i=>true},(gp2,uid)=>dealDamage(gp2,uid,best));}},
powerplay:{id:'powerplay',name:'Power Play',faction:'synth',type:'tactic',speed:'sorcery',cost:1,text:'Deal 1 to yours and 3 to opposing. If opposing is Mystic, draw.',
  run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Deal 1 dmg to one of your own:',filter:i=>i.owner===ctx.pid},(gp2,u1)=>{dealDamage(gp2,u1,1);pendTarget(gp2,{forId:ctx.pid,prompt:'Deal 3 dmg to an opponent:',filter:i=>i.owner!==ctx.pid},(gp3,u2)=>{const f=gp3.inst[u2]&&CARDS[gp3.inst[u2].cid]&&CARDS[gp3.inst[u2].cid].faction;dealDamage(gp3,u2,3);if(f==='mystic')drawN(gp3,ctx.pid,1);});});}},
boom:{id:'boom',name:'Boom!',faction:'synth',type:'tactic',speed:'sorcery',cost:1,text:'Deal 2 dmg to target Fighter. Destroy an enhancement to deal 4 instead.',
  run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Deal damage to which Fighter?',filter:i=>i.kind==='fighter'},(gp2,uid)=>{pendPick(gp2,{forId:ctx.pid,prompt:'Destroy enhancement for +2 more dmg?',options:[{label:'Yes \u2014 4 dmg',value:'y'},{label:'No \u2014 2 dmg',value:'n'}]},(gp3,v)=>dealDamage(gp3,uid,v==='y'?4:2));});}},
autopilot:{id:'autopilot',name:'Autopilot',faction:'synth',type:'response',speed:'instant',cost:1,text:'Wield a Weapon from hand to target Fighter. Draw a card.',
  run(gp,ctx){const w=gp.p[ctx.pid].hand.filter(u=>gp.inst[u]&&CARDS[gp.inst[u].cid].type==='weapon');if(!w.length){drawN(gp,ctx.pid,1);return;}pendPick(gp,{forId:ctx.pid,prompt:'Wield which Weapon from hand?',options:w.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},(gp2,wUid)=>pendTarget(gp2,{forId:ctx.pid,prompt:'Wield to which Fighter?',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(gp3,fUid)=>{moveZone(gp3,ctx.pid,wUid,'hand','board');wieldWeapon(gp3,wUid,fUid);drawN(gp3,ctx.pid,1);}));}},
signaljam:{id:'signaljam',name:'Signal Jam',faction:'synth',type:'response',speed:'instant',cost:2,text:'Change the target of a single-target Tactic or Response. (Manual: agree with your group.)'},
/* MYSTIC FIGHTERS */
flecks:{id:'flecks',name:'Flecks, Accelerator',faction:'mystic',type:'fighter',kind:'fighter',level:3,hp:3,atk:2,atkCost:2,cost:2,text:'On enter: target\'s Attack Cost becomes \u2460 this level. \u2460\u2299: Set a unit\'s Attack Cost to \u2460.',
  onEnter(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Set whose Attack Cost to \u2460?',filter:i=>true},(gp2,uid)=>{gp2.inst[uid].costOverrideLevel=1;});},
  activated:[{label:'Set Attack Cost to \u2460',cost:{coins:1,tap:true},run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Set whose Attack Cost to \u2460?',filter:i=>true},(gp2,uid)=>{gp2.inst[uid].costOverrideLevel=1;});}}]},
shaman:{id:'shaman',name:'Shaman of Eternity',faction:'mystic',type:'fighter',kind:'fighter',level:3,hp:3,atk:2,atkCost:2,cost:2,text:'Whenever a +1 Atk counter is placed on your team, draw a card. \u2462: Phantasmal (+1 Atk counter).',
  onCounterPlaced(gp,ownerPid){drawN(gp,ownerPid,1);},
  activated:[{label:'Become Phantasmal (+1 Atk)',cost:{coins:2},run(gp,ctx){if(!gp.inst[ctx.src].phantasmal){gp.inst[ctx.src].phantasmal=true;addCounter(gp,ctx.src,'atk',1);}}}]},
ebb:{id:'ebb',name:'Ebb, Balancer of Scales',faction:'mystic',type:'fighter',kind:'fighter',level:2,hp:3,atk:1,atkCost:1,cost:1,text:'On enter: add or remove a counter on your team. Gets +1 Atk while any of your team has a counter.',
  dynamicAtkBonus(gp,uid){const pid=gp.inst[uid].owner;return gp.p[pid].board.concat([gp.p[pid].boss]).some(u=>{const i=gp.inst[u];return i&&Object.values(i.counters||{}).some(v=>v>0);})?1:0;},
  onEnter(gp,ctx){pendPick(gp,{forId:ctx.pid,prompt:'Add or remove a counter?',options:[{label:'Add +1 Atk counter',value:'add'},{label:'Remove a counter',value:'rem'}]},(gp2,mode)=>{pendTarget(gp2,{forId:ctx.pid,prompt:mode==='add'?'Add counter to:':'Remove counter from:',filter:i=>i.owner===ctx.pid},(gp3,uid)=>{if(mode==='add')addCounter(gp3,uid,'atk',1);else{if((gp3.inst[uid].counters.atk||0)>0)gp3.inst[uid].counters.atk--;}});});}},
gates:{id:'gates',name:'Gates, Supportive Sensei',faction:'mystic',type:'fighter',kind:'fighter',level:2,hp:2,atk:1,atkCost:1,cost:1,text:'On enter, another target Boss/Fighter gets +2 Attack this level.',
  onEnter(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Give +2 Attack (this level) to:',filter:i=>i.uid!==ctx.src},(gp2,uid)=>{gp2.inst[uid].tempAtk=(gp2.inst[uid].tempAtk||0)+2;});}},
clief:{id:'clief',name:'Clief, Ancient Eclipse',faction:'mystic',type:'fighter',kind:'fighter',level:7,hp:7,atk:3,atkCost:2,cost:2,text:'When attacking, play a Tactic from your graveyard for free.',
  onAttack(gp,ctx){const opts=gp.p[ctx.pid].grave.filter(u=>gp.inst[u]&&CARDS[gp.inst[u].cid].type==='tactic'&&CARDS[gp.inst[u].cid].run);if(!opts.length)return;pendPick(gp,{forId:ctx.pid,prompt:'Replay which Tactic (free)?',options:[...opts.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})),{label:'Skip',value:''}]},(gp2,uid)=>{if(!uid)return;CARDS[gp2.inst[uid].cid].run(gp2,{pid:ctx.pid});log(gp2,'Clief replays '+CARDS[gp2.inst[uid].cid].name+'.');});}},
shadowstriker:{id:'shadowstriker',name:'Shadowstriker',faction:'mystic',type:'fighter',kind:'fighter',level:5,hp:5,atk:2,atkCost:2,cost:2,text:'Can\'t be blocked. Attacks ignoring Enforcer.',atkFlags:{ignoreEnforcer:true,unblockable:true}},
reika:{id:'reika',name:'Reika, First Novice',faction:'mystic',type:'fighter',kind:'fighter',level:3,hp:2,atk:1,atkCost:0,cost:0,text:'Armor 1. Response \u2299: Block.',armor:1,selfBlock:{cost:{tap:true}}},
/* SHIFTER FIGHTERS */
darby:{id:'darby',name:'Darby, Straphanger',faction:'shifter',type:'fighter',kind:'fighter',level:4,hp:4,atk:3,atkCost:2,cost:2,text:'Vanilla body.'},
minka:{id:'minka',name:'Minka, Underestimated',faction:'shifter',type:'fighter',kind:'fighter',level:6,hp:5,atk:2,atkCost:2,cost:2,text:'Whenever a Fighter dies, put a +1 Attack counter on Minka. Response \u2460\u2299: Block.',
  onAnyFighterDeath(gp,uid){if(gp.inst[uid]&&gp.inst[uid].hp>0)addCounter(gp,uid,'atk',1);},selfBlock:{cost:{coins:1,tap:true}}},
slider:{id:'slider',name:'Slider, Untombed',faction:'shifter',type:'fighter',kind:'fighter',level:5,hp:5,atk:0,atkCost:2,cost:2,text:'Determination \u2014 has all Traits of opposing Fighters. (Manual.)'},
/* APEX FIGHTERS */
intersentinel:{id:'intersentinel',name:'Intersentinel',faction:'apex',type:'fighter',kind:'fighter',level:3,hp:3,atk:1,atkCost:1,cost:1,text:'At the start of each level, your Boss heals 1. Response \u2460\u2299: Block.',
  onLevelStart(gp,pid){healInst(gp,gp.p[pid].boss,1);},selfBlock:{cost:{coins:1,tap:true}}},
freevector:{id:'freevector',name:'Free Vector',faction:'apex',type:'fighter',kind:'fighter',level:1,hp:2,atk:1,atkCost:0,cost:0,text:'When this dies, draw a card.',onDeath(gp,ctx){drawN(gp,ctx.pid,1);}},
vector:{id:'vector',name:'Vector, Victor',faction:'apex',type:'fighter',kind:'fighter',level:3,hp:5,atk:1,atkCost:1,cost:1,text:'Vanilla body.'},
mechtorsuit:{id:'mechtorsuit',name:'Mechtor Suit',faction:'apex',type:'fighter',kind:'fighter',level:5,hp:5,atk:1,atkCost:0,cost:0,text:'Vanilla body.'},
/* MYSTIC WEAPON */
swordfromnowhere:{id:'swordfromnowhere',name:'Sword from Nowhere',faction:'mystic',type:'weapon',level:6,cost:2,
  text:'Wielder gets +X Attack = number of Tactic/Response in your graveyard. \u2462, Destroy: return a T/R from grave to hand.',
  dynamicAtk(gp,uid){const pid=gp.inst[uid].owner;return gp.p[pid].grave.filter(u=>{const c=gp.inst[u]&&CARDS[gp.inst[u].cid];return c&&(c.type==='tactic'||c.type==='response');}).length;},
  weaponActivated:[{label:'Destroy: return T/R from grave to hand',cost:{coins:2,sacrifice:true},run(gp,ctx){const pid=gp.inst[ctx.src].owner;const opts=gp.p[pid].grave.filter(u=>{const c=gp.inst[u]&&CARDS[gp.inst[u].cid];return c&&(c.type==='tactic'||c.type==='response');});if(!opts.length)return;pendPick(gp,{forId:pid,prompt:'Return which card to hand?',options:opts.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},(gp2,u)=>moveZone(gp2,pid,u,'grave','hand'));}}]},
/* MYSTIC TACTICS/RESPONSES */
theurgicthrashing:{id:'theurgicthrashing',name:'Theurgic Thrashing',faction:'mystic',type:'tactic',speed:'sorcery',cost:3,text:'Deal 3 dmg to target Fighter. A Boss/Fighter heals 3.',
  run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Deal 3 dmg to which Fighter?',filter:i=>i.kind==='fighter'},(gp2,u1)=>{dealDamage(gp2,u1,3);pendTarget(gp2,{forId:ctx.pid,prompt:'Heal 3 to which Boss/Fighter?',filter:i=>true},(gp3,u2)=>healInst(gp3,u2,3));});}},
rollcall:{id:'rollcall',name:'Roll Call',faction:'mystic',type:'tactic',speed:'sorcery',cost:5,text:'Choose: distribute 5 +1 Atk counters among Fighters, OR draw per countered Fighter.',
  run(gp,ctx){pendPick(gp,{forId:ctx.pid,prompt:'Choose a mode:',options:[{label:'Distribute 5 +1 Atk counters',value:'a'},{label:'Draw per countered Fighter',value:'b'}]},(gp2,mode)=>{if(mode==='b'){const n=gp2.p[ctx.pid].board.filter(u=>gp2.inst[u]&&gp2.inst[u].kind==='fighter'&&Object.values(gp2.inst[u].counters||{}).some(v=>v>0)).length;drawN(gp2,ctx.pid,n);return;}let left=5;const step=(gpx)=>{if(left<=0)return;pendPick(gpx,{forId:ctx.pid,prompt:left+' left \u2014 choose Fighter or Done',options:[...gpx.p[ctx.pid].board.filter(u=>gpx.inst[u]&&gpx.inst[u].kind==='fighter').map(u=>({label:CARDS[gpx.inst[u].cid].name,value:u})),{label:'Done',value:''}]},(gpy,u)=>{if(!u){left=0;return;}addCounter(gpy,u,'atk',1);left--;step(gpy);});};step(gp2);});}},
malefice:{id:'malefice',name:'Malefice',faction:'mystic',type:'tactic',speed:'sorcery',cost:3,text:'Destroy target Weapon. If wielded, deal damage to that Fighter equal to Weapon\'s level.',
  run(gp,ctx){const ws=allBoard(gp).filter(u=>gp.inst[u]&&CARDS[gp.inst[u].cid].type==='weapon');pendPick(gp,{forId:ctx.pid,prompt:'Destroy which Weapon?',options:ws.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},(gp2,wUid)=>{const w=gp2.inst[wUid];const wf=w&&w.wieldedBy;destroyInstance(gp2,wUid);if(wf&&gp2.inst[wf])dealDamage(gp2,wf,CARDS[w.cid].level||0);});}},
voltagesnap:{id:'voltagesnap',name:'Voltage Snap',faction:'mystic',type:'tactic',speed:'sorcery',cost:1,text:'Deal 2 dmg; if Synth or Survivor target, deal 3 instead.',
  run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Deal damage to:',filter:i=>true},(gp2,uid)=>{const f=gp2.inst[uid]&&CARDS[gp2.inst[uid].cid]&&CARDS[gp2.inst[uid].cid].faction;dealDamage(gp2,uid,(f==='synth'||f==='survivor')?3:2);});}},
sludged:{id:'sludged',name:'Sludged',faction:'mystic',type:'response',speed:'instant',cost:3,text:'Put target attacking Fighter on top of its owner\'s deck.',
  run(gp,ctx){const uid=ctx.attacker;if(!uid||!gp.inst[uid])return;const pid=gp.inst[uid].owner;moveZone(gp,pid,uid,'board','deck-top');cancelPendingAttack(gp);}},
rats:{id:'rats',name:'RATS!',faction:'mystic',type:'response',speed:'instant',cost:2,text:'Put a +1 Atk counter on up to 3 target Fighters on your team.',
  run(gp,ctx){let left=3;const step=(gpx)=>{if(left<=0)return;pendPick(gpx,{forId:ctx.pid,prompt:left+' left \u2014 choose Fighter or Done',options:[...gpx.p[ctx.pid].board.filter(u=>gpx.inst[u]&&gpx.inst[u].kind==='fighter').map(u=>({label:CARDS[gpx.inst[u].cid].name,value:u})),{label:'Done',value:''}]},(gpy,u)=>{if(!u){left=0;return;}addCounter(gpy,u,'atk',1);left--;step(gpy);});};step(gp);}},
fullheal:{id:'fullheal',name:'Full Heal!',faction:'mystic',type:'response',speed:'instant',cost:3,text:'Heal all Fighters on your team to max Health.',run(gp,ctx){gp.p[ctx.pid].board.forEach(u=>{if(gp.inst[u]&&gp.inst[u].kind==='fighter')gp.inst[u].hp=gp.inst[u].maxHp;});}},
echofade:{id:'echofade',name:'Echo Fade',faction:'mystic',type:'response',speed:'instant',cost:2,text:'Put two -1 Attack counters on target Fighter.',run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Target Fighter:',filter:i=>i.kind==='fighter'},(gp2,uid)=>addCounter(gp2,uid,'atk',-2));}},
evanesce:{id:'evanesce',name:'Evanesce',faction:'mystic',type:'response',speed:'instant',cost:3,text:'Destroy up to one target Weapon. Draw a card.',
  run(gp,ctx){const ws=allBoard(gp).filter(u=>gp.inst[u]&&CARDS[gp.inst[u].cid].type==='weapon');if(!ws.length){drawN(gp,ctx.pid,1);return;}pendPick(gp,{forId:ctx.pid,prompt:'Destroy a Weapon (optional):',options:[...ws.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})),{label:'Skip',value:''}]},(gp2,u)=>{if(u)destroyInstance(gp2,u);drawN(gp2,ctx.pid,1);});}},
/* SHIFTER WEAPONS+TACTICS */
marrowpiercer:{id:'marrowpiercer',name:'Marrowpiercer',faction:'shifter',type:'weapon',level:3,cost:3,text:'Whenever the wielder deals attack damage, it heals equal to that damage.',onWielderDealtDamage(gp,wu,amt){healInst(gp,wu,amt);}},
murkgodpendant:{id:'murkgodpendant',name:'Murkgod Pendant',faction:'shifter',type:'weapon',level:2,cost:0,text:'Wielder gains \u2462\u2299: Transform.',grantsActivated:[{label:'Transform',cost:{coins:2,tap:true},run(gp,ctx){transformInstance(gp,ctx.src);}}]},
trackersfrenzy:{id:'trackersfrenzy',name:"Tracker's Frenzy",faction:'shifter',type:'tactic',speed:'sorcery',cost:1,text:'Deal 1 dmg; if a Fighter left play this level, deal 3 instead.',run(gp,ctx){const amt=gp.fighterLeftThisLevel?3:1;pendTarget(gp,{forId:ctx.pid,prompt:'Deal '+amt+' dmg to:',filter:i=>true},(gp2,uid)=>dealDamage(gp2,uid,amt));}},
undertowed:{id:'undertowed',name:'Undertowed',faction:'shifter',type:'tactic',speed:'sorcery',cost:3,text:'Destroy target Fighter with 4+ max Health.',run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Destroy which Fighter (4+ Health)?',filter:i=>i.kind==='fighter'&&i.maxHp>=4},(gp2,uid)=>destroyInstance(gp2,uid));}},
steelswipe:{id:'steelswipe',name:'Steel Swipe',faction:'shifter',type:'tactic',speed:'sorcery',cost:2,text:'Deal 2 dmg; if your Boss is Shifter, deal 3 instead.',run(gp,ctx){const bCid=gp.inst[gp.p[ctx.pid].boss]&&gp.inst[gp.p[ctx.pid].boss].cid;const amt=bCid&&CARDS[bCid]&&CARDS[bCid].faction==='shifter'?3:2;pendTarget(gp,{forId:ctx.pid,prompt:'Deal '+amt+' dmg to:',filter:i=>true},(gp2,uid)=>dealDamage(gp2,uid,amt));}},
toothextraction:{id:'toothextraction',name:'Tooth Extraction',faction:'shifter',type:'tactic',speed:'sorcery',cost:4,text:'Deal 5 damage divided as you choose.',run(gp,ctx){let left=5;const step=(gpx)=>{if(left<=0)return;pendTarget(gpx,{forId:ctx.pid,prompt:left+' dmg left \u2014 choose target',filter:i=>true},(gpy,uid)=>{dealDamage(gpy,uid,1);left--;step(gpy);});};step(gp);}},
catchcard:{id:'catchcard',name:'Catch!',faction:'shifter',type:'tactic',speed:'sorcery',cost:2,text:'Deal 4 damage to target Fighter.',run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Deal 4 dmg to which Fighter?',filter:i=>i.kind==='fighter'},(gp2,uid)=>dealDamage(gp2,uid,4));}},
pushcard:{id:'pushcard',name:'Push',faction:'shifter',type:'tactic',speed:'sorcery',cost:3,text:'Destroy target Fighter.',run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Destroy which Fighter?',filter:i=>i.kind==='fighter'},(gp2,uid)=>destroyInstance(gp2,uid));}},
derail:{id:'derail',name:'Derail',faction:'shifter',type:'tactic',speed:'sorcery',cost:5,text:'Destroy all Fighters (every player).',run(gp,ctx){Object.keys(gp.p).forEach(pid=>{gp.p[pid].board.slice().forEach(u=>{if(gp.inst[u]&&gp.inst[u].kind==='fighter')destroyInstance(gp,u);});});}},
emergencybrake:{id:'emergencybrake',name:'Emergency Brake',faction:'shifter',type:'tactic',speed:'sorcery',cost:1,text:'Destroy target Level 2 or lower Fighter.',run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Destroy which Lvl-2-or-lower Fighter?',filter:i=>i.kind==='fighter'&&(CARDS[i.cid]&&CARDS[i.cid].level||0)<=2},(gp2,uid)=>destroyInstance(gp2,uid));}},
flippingout:{id:'flippingout',name:'Flipping Out',faction:'shifter',type:'tactic',speed:'sorcery',cost:5,text:'Deal 4 damage to up to two different targets.',
  run(gp,ctx){pendPick(gp,{forId:ctx.pid,prompt:'Split 4 damage how?',options:[{label:'All 4 to one target',value:'1'},{label:'2 and 2 to two targets',value:'2'}]},(gp2,mode)=>{if(mode==='1'){pendTarget(gp2,{forId:ctx.pid,prompt:'Target for 4 dmg:',filter:i=>true},(gp3,u)=>dealDamage(gp3,u,4));}else{pendTarget(gp2,{forId:ctx.pid,prompt:'First target (2 dmg):',filter:i=>true},(gp3,u1)=>{dealDamage(gp3,u1,2);pendTarget(gp3,{forId:ctx.pid,prompt:'Second target (2 dmg):',filter:i=>true},(gp4,u2)=>dealDamage(gp4,u2,2));});}});}},
nightvision:{id:'nightvision',name:'Night Vision',faction:'shifter',type:'tactic',speed:'sorcery',cost:1,text:'All units can be attacked as if they don\'t have Stealthy this level. Draw a card.',run(gp,ctx){gp.ignoreStealthyLevel=true;drawN(gp,ctx.pid,1);}},
ahacard:{id:'ahacard',name:'Aha!',faction:'shifter',type:'tactic',speed:'sorcery',cost:2,text:'Discard a card. Draw two cards.',run(gp,ctx){if(!gp.p[ctx.pid].hand.length){drawN(gp,ctx.pid,2);return;}pendPick(gp,{forId:ctx.pid,prompt:'Discard which card?',options:gp.p[ctx.pid].hand.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},(gp2,u)=>{moveZone(gp2,ctx.pid,u,'hand','grave');drawN(gp2,ctx.pid,2);});}},
outlast:{id:'outlast',name:'Outlast',faction:'shifter',type:'tactic',speed:'sorcery',cost:3,text:'Deal dmg to target on opponent\'s team = (their Fighters \u2212 your Fighters), min 0.',
  run(gp,ctx){const others=Object.keys(gp.p).filter(p=>p!==ctx.pid&&!gp.p[p].defeated);pendPick(gp,{forId:ctx.pid,prompt:'Choose an opponent:',options:others.map(p=>({label:gp.p[p].name,value:p}))},(gp2,opp)=>{pendTarget(gp2,{forId:ctx.pid,prompt:'Target Fighter of theirs:',filter:i=>i.owner===opp&&i.kind==='fighter'},(gp3,uid)=>{const mine=gp3.p[ctx.pid].board.filter(u=>gp3.inst[u]&&gp3.inst[u].kind==='fighter').length;const theirs=gp3.p[opp].board.filter(u=>gp3.inst[u]&&gp3.inst[u].kind==='fighter').length;dealDamage(gp3,uid,Math.max(0,theirs-mine));});});}},
};
const TOKEN_DEFS={
  beartrap:{id:'beartrap',name:'Bear Trap',faction:'synth',type:'token',kind:'fighter',hp:1,atk:0,atkCost:0,keywords:['Enforcer'],onDeathFromAttack(gp,aUid){dealDamage(gp,aUid,1);}},
  toolbox:{id:'toolbox',name:'Toolbox',faction:'synth',type:'token',kind:'fighter',hp:3,atk:1,atkCost:1},
  headrat:{id:'headrat',name:'Head Rat',faction:'mystic',type:'token',kind:'fighter',hp:2,atk:1,atkCost:0,tag:'Rat'},
  whump:{id:'whump',name:'Whump!',faction:'mystic',type:'token',kind:'fighter',hp:4,atk:3,atkCost:1,diesEndOfLevel:true}
};
Object.assign(CARDS,TOKEN_DEFS);

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

function artImg(cid,cls){
  /* CIMG is the mapping object — starts empty, updated by image-mapper tool */
  const fn=CIMG&&CIMG[cid];
  const src=fn?IMG_BASE+fn:null;
  const c=CARDS[cid];const fb=c&&FBG[c.faction]||'#0b0f14';
  return src
    ?`<img class="${cls}" src="${src}" loading="lazy" onerror="this.onerror=null;this.style.background='${fb}';this.removeAttribute('src')" alt="">`
    :`<div class="${cls}-fb" style="background:${fb}"></div>`;
}

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
  try{const saved=localStorage.getItem('ca_img_mapping');if(saved){const m=JSON.parse(saved);Object.keys(m).forEach(fn=>{if(m[fn])CIMG[m[fn]]=fn+'.webp';});console.log('Loaded',Object.keys(m).filter(k=>m[k]).length,'image mappings from localStorage');}}catch(e){}
  /* Preload images */
  Object.values(CIMG).forEach(fn=>{const im=new Image();im.src=IMG_BASE+fn;});
  /* Fallback poll */
  setInterval(async()=>{if(!S.code||S.busy||!_db)return;const f=await loadRoom(S.code);if(f&&(!S.room||f.v>S.room.v)){S.room=f;render();}},8000);
  render();
})();
