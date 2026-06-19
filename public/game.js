/* ============================================================
   CATACLYSM ARCADE — FULL ENGINE
============================================================ */

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const FACTION_META = {
  synth:{name:'Synth', cls:'fc-synth'},
  mystic:{name:'Mystic', cls:'fc-mystic'},
  shifter:{name:'Shifter', cls:'fc-shifter'},
  survivor:{name:'Survivor', cls:'fc-survivor'},
  apex:{name:'Apex', cls:'fc-apex'}
};

const KEYWORDS_HELP = {
  Enforcer:'This must always be attacked before another Boss/Fighter on the team if able.',
  Block:'A Boss or Fighter attacks this Fighter instead (self-activated Response).',
  Fortify:'Instead of dying, this is placed under a non-Fortified Boss/Fighter on the team, which gains Health equal to this card\'s Health.',
  Agility:'Can act (attack or use an ability) twice per level instead of once.',
  Stealthy:'Can\'t be attacked the level it enters play.',
  Armor:'Prevents a fixed amount of damage each level.',
  Stun:'Stunned cards can\'t tap or activate abilities this level.',
  Transform:'Destroy this Fighter, then search for and put into play a Fighter of equal or lower level with a different name; shuffle.'
};

/* ---------------- CARD DATABASE ---------------- */
const CARDS = {
decommissioner:{id:'decommissioner',name:'The Decommissioner',faction:'synth',type:'boss',sub:'Champion',hp:17,atk:2,atkCost:3,
  text:'When attacking, you may discard a card: deal 2 dmg to target Fighter. ③⊙: Return a Synth Fighter from your graveyard to play.',
  onAttack(gp,ctx){ pendDiscardOptional(gp,ctx,'Discard a card to deal 2 dmg to a Fighter?',(gp2,ctx2,discardUid)=>{
      if(!discardUid) return;
      moveZone(gp2,ctx2.pid,discardUid,'hand','grave');
      pendTarget(gp2,{forId:ctx2.pid,prompt:'Choose a Fighter to deal 2 damage',filter:i=>i.kind==='fighter'},(gp3,uid)=>dealDamage(gp3,uid,2));
  });},
  activated:[{label:'Return Synth Fighter from grave',cost:{coins:3,tap:true},
    run(gp,ctx){ const opts=gp.p[ctx.pid].grave.filter(u=>{const i=gp.inst[u];return i&&CARDS[i.cid].faction==='synth'&&CARDS[i.cid].type==='fighter';});
      if(!opts.length){log(gp,'No Synth Fighters in graveyard.');return;}
      pendPick(gp,{forId:ctx.pid,prompt:'Return which Fighter to play?',options:opts.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},
        (gp2,uid)=>{ moveZone(gp2,ctx.pid,uid,'grave','board'); resetInstance(gp2,uid); fireOnEnter(gp2,uid,ctx.pid); });
    }}]
},
toolshed:{id:'toolshed',name:'Toolshed',faction:'synth',type:'boss',sub:'Weaponsmith',hp:17,atk:2,atkCost:2,
  text:'Whenever a Weapon enters play under your control, you may pay ① to draw a card. ③⊙: Create a "Toolbox" Synth Fighter token (1/1/3) and may wield one of your Weapons in play to it.',
  onWeaponEnter(gp,ctx){ pendPick(gp,{forId:ctx.pid,prompt:'Pay ① to draw a card?',options:[{label:'Pay ① — Draw',value:'y'},{label:'Skip',value:'n'}]},
      (gp2,v)=>{ if(v==='y'&&spendCoins(gp2,ctx.pid,1)) drawN(gp2,ctx.pid,1); }); },
  activated:[{label:'Create Toolbox token',cost:{coins:3,tap:true},
    run(gp,ctx){ createToken(gp,ctx.pid,'toolbox'); }}]
},
trapper:{id:'trapper',name:'Trapper, Hunter of the Pack',faction:'synth',type:'boss',sub:'Hunter',hp:16,atk:3,atkCost:3,
  text:'At the start of a level, if you have no cards in hand, draw an additional card. ②⊙: Create a "Bear Trap" token (0/0/1, Enforcer; deals 1 dmg back when it dies from an attack).',
  activated:[{label:'Create Bear Trap token',cost:{coins:2,tap:true},
    run(gp,ctx){ createToken(gp,ctx.pid,'beartrap'); }}]
},
dreyver:{id:'dreyver',name:'Dreyver, Terminarch',faction:'synth',type:'fighter',kind:'fighter',sub:'Endlings',level:1,hp:3,atk:1,atkCost:2,cost:2,
  text:'Other Synth Fighters/Bosses you control: Attack Costs & activated abilities cost ① less. ②⊙: Target Synth gains Agility this level.',
  staticReduction:{scope:'otherSynth',amount:1},
  activated:[{label:'Grant Agility to a Synth',cost:{coins:2,tap:true},
    run(gp,ctx){ pendTarget(gp,{forId:ctx.pid,prompt:'Grant Agility this level to which Synth?',filter:(i)=>CARDS[i.cid].faction==='synth'&&i.owner===ctx.pid},
      (gp2,uid)=>{ gp2.inst[uid].agilityLevel=true; }); }}]
},
prox:{id:'prox',name:'ProX',faction:'synth',type:'fighter',kind:'fighter',sub:'The Marqued',level:2,hp:3,atk:1,atkCost:0,cost:0,
  text:'⊙: You gain ①.',
  activated:[{label:'Tap: Gain ①',cost:{tap:true}, run(gp,ctx){ gp.p[ctx.pid].coins++; }}]
},
quarters:{id:'quarters',name:'Quarters',faction:'synth',type:'fighter',kind:'fighter',sub:'The Marqued',level:2,hp:2,atk:2,atkCost:0,cost:0,text:'Free 2-Attack body.'},
father:{id:'father',name:'Father, Annihilator',faction:'synth',type:'fighter',kind:'fighter',sub:'The Joneses',level:2,hp:2,atk:1,atkCost:1,cost:1,
  text:'Father wields Weapons for no cost. Response ②, Destroy Father: Return a Weapon from your graveyard to play, wielded to target Fighter.',
  freeWieldTarget:true,
  activated:[{label:'Response: Destroy → return Weapon from grave',cost:{coins:2,sacrifice:true},
    run(gp,ctx){ const opts=gp.p[ctx.pid].grave.filter(u=>CARDS[gp.inst[u].cid].type==='weapon');
      if(!opts.length){log(gp,'No Weapons in graveyard.');return;}
      pendPick(gp,{forId:ctx.pid,prompt:'Return which Weapon?',options:opts.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},
        (gp2,wUid)=>{ moveZone(gp2,ctx.pid,wUid,'grave','board'); resetInstance(gp2,wUid);
          pendTarget(gp2,{forId:ctx.pid,prompt:'Wield it to which Fighter?',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},
            (gp3,fUid)=>wieldWeapon(gp3,wUid,fUid)); });
    }}]
},
motreina:{id:'motreina',name:'Motreina, Stepmonster',faction:'synth',type:'fighter',kind:'fighter',sub:'The Joneses',level:2,hp:3,atk:1,atkCost:1,cost:1,
  text:'On enter, wield up to one of your Weapons to target Fighter. ①⊙: Move one of your wielded Weapons to another Fighter.',
  onEnter(gp,ctx){ const w=gp.p[ctx.pid].board.filter(u=>CARDS[gp.inst[u].cid].type==='weapon'&&!gp.inst[u].wieldedBy);
      if(!w.length) return;
      pendPick(gp,{forId:ctx.pid,prompt:'Wield a Weapon on enter?',options:[...w.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})),{label:'Skip',value:''}]},
        (gp2,wUid)=>{ if(!wUid) return; pendTarget(gp2,{forId:ctx.pid,prompt:'Wield to which Fighter?',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},
          (gp3,fUid)=>wieldWeapon(gp3,wUid,fUid)); }); },
  activated:[{label:'Move a wielded Weapon',cost:{coins:1,tap:true},
    run(gp,ctx){ const w=gp.p[ctx.pid].board.filter(u=>CARDS[gp.inst[u].cid].type==='weapon'&&gp.inst[u].wieldedBy);
      if(!w.length) return;
      pendPick(gp,{forId:ctx.pid,prompt:'Move which Weapon?',options:w.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},
        (gp2,wUid)=>pendTarget(gp2,{forId:ctx.pid,prompt:'Move it to which Fighter?',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid&&i.uid!==gp2.inst[wUid].wieldedBy},
          (gp3,fUid)=>wieldWeapon(gp3,wUid,fUid)));
    }}]
},
fishhooks:{id:'fishhooks',name:'Fishhooks',faction:'synth',type:'fighter',kind:'fighter',sub:'The Marqued',level:5,hp:4,atk:3,atkCost:2,cost:2,
  text:'Enforcer.', keywords:['Enforcer']},
bluegelati:{id:'bluegelati',name:'The Blue Gelati',faction:'synth',type:'fighter',kind:'fighter',sub:'Endlings',level:3,hp:4,atk:1,atkCost:1,cost:1,
  text:'If this would die, it Fortifies instead. May pay ① when attacking to gain +X Attack equal to a Weapon\'s Attack this attack.',
  fortifyInstead:true,
  preAttack(gp,ctx){ pendPick(gp,{forId:ctx.pid,prompt:'Pay ① to borrow a Weapon\'s Attack this attack?',options:[{label:'Pay ① — borrow',value:'y'},{label:'Skip',value:'n'}]},
    (gp2,v)=>{ if(v==='y'&&spendCoins(gp2,ctx.pid,1)){ const ws=allBoard(gp2).filter(u=>CARDS[gp2.inst[u].cid].type==='weapon');
      if(ws.length) pendPick(gp2,{forId:ctx.pid,prompt:'Borrow which Weapon\'s Attack?',options:ws.map(u=>({label:CARDS[gp2.inst[u].cid].name+' (+'+weaponAtk(gp2,u)+')',value:u}))},
        (gp3,wu)=>{ gp3.inst[ctx.attacker].tempAtk=(gp3.inst[ctx.attacker].tempAtk||0)+weaponAtk(gp3,wu); resumeAttack(gp3,ctx); }); } else resumeAttack(gp2,ctx); }); }
},
notamotua:{id:'notamotua',name:'Notamotua, Deathpunch',faction:'synth',type:'fighter',kind:'fighter',sub:'Endlings',level:6,hp:4,atk:2,atkCost:3,cost:3,
  text:'Armor 1. ②⊙: Destroy target Fighter that was dealt damage this level.',armor:1,
  activated:[{label:'Destroy a damaged Fighter',cost:{coins:2,tap:true},
    run(gp,ctx){ pendTarget(gp,{forId:ctx.pid,prompt:'Destroy which Fighter (damaged this level)?',filter:i=>i.kind==='fighter'&&i.dmgThisLevel},
      (gp2,uid)=>destroyInstance(gp2,uid)); }}]
},
bleargh:{id:'bleargh',name:'Bleargh, Noxious Entity',faction:'mystic',type:'fighter',kind:'fighter',sub:'Incarnate',level:3,hp:3,atk:2,atkCost:0,cost:0,text:'Free 2-Attack body.'},
dataspike:{id:'dataspike',name:'Data Spike',faction:'synth',type:'weapon',level:3,cost:2,
  text:'Enters with a charge. Whenever the wielder dies, put a charge on this. Wielder gets +1 Attack per charge.',
  dynamicAtk(gp,uid){ return (gp.inst[uid].counters.charge||0); }, startCounters:{charge:1}
},
swiftpack:{id:'swiftpack',name:'Swiftpack',faction:'synth',type:'weapon',level:3,cost:2,
  text:'Wielder has Agility (can act twice per level).', grantsKeyword:'agility'},
blastscanner:{id:'blastscanner',name:'Blast Scanner',faction:'synth',type:'weapon',level:4,cost:2,
  text:'On wield, stun target opposing Fighter.',
  onWield(gp,ctx){ pendTarget(gp,{forId:ctx.pid,prompt:'Stun which opposing Fighter?',filter:i=>i.kind==='fighter'&&i.owner!==ctx.pid},
    (gp2,uid)=>{ gp2.inst[uid].stunned=true; }); }},
jackedhammer:{id:'jackedhammer',name:'Jacked Hammer',faction:'synth',type:'weapon',level:1,cost:1,atkMod:1,text:'+1 Attack to wielder.'},
givethesignal:{id:'givethesignal',name:'Give The Signal',faction:'synth',type:'tactic',speed:'sorcery',cost:5,
  text:'Reveal the top 5 of your deck. Synth Fighters revealed may be played free. Put the rest on the bottom, shuffled.',
  run(gp,ctx){ const top=gp.p[ctx.pid].deck.slice(0,5); gp.p[ctx.pid].deck=gp.p[ctx.pid].deck.slice(5);
    const rest=[];
    top.forEach(u=>{ const c=CARDS[gp.inst[u].cid];
      if(c.faction==='synth'&&c.type==='fighter'){ gp.p[ctx.pid].board.push(u); resetInstance(gp,u); fireOnEnter(gp,u,ctx.pid); }
      else rest.push(u);
    });
    gp.p[ctx.pid].deck=shuffle([...gp.p[ctx.pid].deck,...rest]);
    log(gp,'Give The Signal: '+(5-rest.length)+' Synth Fighter(s) played free.');
  }},
bestoffense:{id:'bestoffense',name:'Best Offense',faction:'synth',type:'tactic',speed:'sorcery',cost:3,
  text:'Deal damage to target Boss/Fighter equal to the greatest Health among your Fighters.',
  run(gp,ctx){ const mine=gp.p[ctx.pid].board.filter(u=>gp.inst[u].kind==='fighter');
    const best=mine.reduce((m,u)=>Math.max(m,gp.inst[u].maxHp),0);
    pendTarget(gp,{forId:ctx.pid,prompt:'Deal '+best+' damage to:',filter:i=>true},(gp2,uid)=>dealDamage(gp2,uid,best)); }},
powerplay:{id:'powerplay',name:'Power Play',faction:'synth',type:'tactic',speed:'sorcery',cost:1,
  text:'Deal 1 dmg to target on your team and 3 dmg to target opposing. If the opposing target is a Mystic, draw a card.',
  run(gp,ctx){ pendTarget(gp,{forId:ctx.pid,prompt:'Deal 1 dmg to one of your own:',filter:i=>i.owner===ctx.pid},
    (gp2,u1)=>{ dealDamage(gp2,u1,1); pendTarget(gp2,{forId:ctx.pid,prompt:'Deal 3 dmg to an opponent:',filter:i=>i.owner!==ctx.pid},
      (gp3,u2)=>{ const wasMystic=CARDS[gp3.inst[u2]?.cid||'']?.faction==='mystic'; dealDamage(gp3,u2,3); if(wasMystic) drawN(gp3,ctx.pid,1); }); }); }},
boom:{id:'boom',name:'Boom!',faction:'synth',type:'tactic',speed:'sorcery',cost:1,
  text:'Deal 2 dmg to target Fighter. You may destroy one of your enhancements to deal 4 instead.',
  run(gp,ctx){ pendTarget(gp,{forId:ctx.pid,prompt:'Deal damage to which Fighter?',filter:i=>i.kind==='fighter'},
    (gp2,uid)=>{ pendPick(gp2,{forId:ctx.pid,prompt:'Destroy one of your enhancements for +2 more dmg (total 4)?',options:[{label:'Yes — 4 dmg',value:'y'},{label:'No — 2 dmg',value:'n'}]},
      (gp3,v)=>dealDamage(gp3,uid,v==='y'?4:2)); }); }},
autopilot:{id:'autopilot',name:'Autopilot',faction:'synth',type:'response',speed:'instant',cost:1,
  text:'Wield a Weapon to target Fighter on your team. Draw a card.',
  run(gp,ctx){ const w=gp.p[ctx.pid].hand.filter(u=>CARDS[gp.inst[u].cid].type==='weapon');
    if(!w.length){ drawN(gp,ctx.pid,1); return; }
    pendPick(gp,{forId:ctx.pid,prompt:'Wield which Weapon from hand?',options:w.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},
      (gp2,wUid)=>pendTarget(gp2,{forId:ctx.pid,prompt:'Wield to which Fighter?',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},
        (gp3,fUid)=>{ moveZone(gp3,ctx.pid,wUid,'hand','board'); wieldWeapon(gp3,wUid,fUid); drawN(gp3,ctx.pid,1); }));
  }},
signaljam:{id:'signaljam',name:'Signal Jam',faction:'synth',type:'response',speed:'instant',cost:2,
  text:'Change the target of a single-target Tactic or Response. (Manual: agree the new target with your group.)'},

/* ===== MYSTIC BOSSES ===== */
effwithmeammo:{id:'effwithmeammo',name:'Eff with me Ammo',faction:'mystic',type:'boss',hp:17,atk:2,atkCost:2,
  text:'Has Agility while you control a Rat. ②⊙: Create a "Head Rat" Mystic token (1/0/2).',
  activated:[{label:'Create Head Rat token',cost:{coins:2,tap:true}, run(gp,ctx){ createToken(gp,ctx.pid,'headrat'); }}]
},
mothermayeye:{id:'mothermayeye',name:'Mother May Eye',faction:'mystic',type:'boss',sub:'Tracker',hp:16,atk:1,atkCost:1,
  text:'Gets +1 Attack per Tactic/Response played this level. ⊙: play with top of deck revealed, may play Tactics/Responses off the top. 3+ this level: gains Agility. (Manual resolution.)'},
tantrum:{id:'tantrum',name:'Tantrum, World Ender',faction:'mystic',type:'boss',sub:'Illusionist',hp:16,atk:2,atkCost:2,
  text:'Can\'t be attacked while you control a "Whump!" token. ③⊙, deal 1 dmg to self: Create a "Whump!" token (3/4 atk+, dies end of level).',
  cantBeAttackedIfTokenAlive:'whump',
  activated:[{label:'Create Whump! (1 dmg to self)',cost:{coins:3,tap:true,selfDamage:1}, run(gp,ctx){ createToken(gp,ctx.pid,'whump'); }}]
},

/* ===== MYSTIC FIGHTERS ===== */
flecks:{id:'flecks',name:'Flecks, Accelerator',faction:'mystic',type:'fighter',kind:'fighter',sub:'Odddz',level:3,hp:3,atk:2,atkCost:2,cost:2,
  text:'On enter: target\'s base Attack Cost becomes ① this level. ①⊙: Target Boss/Fighter\'s base Attack Cost becomes ① this level.',
  onEnter(gp,ctx){ pendTarget(gp,{forId:ctx.pid,prompt:'Set whose Attack Cost to ① this level?',filter:i=>true},(gp2,uid)=>{ gp2.inst[uid].costOverrideLevel=1; }); },
  activated:[{label:'Set a unit\'s Attack Cost to ①',cost:{coins:1,tap:true},
    run(gp,ctx){ pendTarget(gp,{forId:ctx.pid,prompt:'Set whose Attack Cost to ① this level?',filter:i=>true},(gp2,uid)=>{ gp2.inst[uid].costOverrideLevel=1; }); }}]
},
shaman:{id:'shaman',name:'Shaman of Eternity',faction:'mystic',type:'fighter',kind:'fighter',sub:'The Boom',level:3,hp:3,atk:2,atkCost:2,cost:2,
  text:'Whenever a +1 Attack counter is placed on your team, draw a card. ②: Phantasmal (first time: +1 Atk counter & becomes Phantasmal).',
  onCounterPlaced(gp,ownerPid){ drawN(gp,ownerPid,1); },
  activated:[{label:'Become Phantasmal (+1 Atk)',cost:{coins:2},
    run(gp,ctx){ if(!gp.inst[ctx.src].phantasmal){ gp.inst[ctx.src].phantasmal=true; addCounter(gp,ctx.src,'atk',1); } }}]
},
ebb:{id:'ebb',name:'Ebb, Balancer of Scales',faction:'mystic',type:'fighter',kind:'fighter',sub:'Odddz',level:2,hp:3,atk:1,atkCost:1,cost:1,
  text:'On enter: add or remove a counter on your team. Gets +1 Attack while any of your team has a counter.',
  dynamicAtkBonus(gp,uid){ const pid=gp.inst[uid].owner; const any=gp.p[pid].board.concat([gp.p[pid].boss]).some(u=>{const i=gp.inst[u];return i&&Object.values(i.counters||{}).some(v=>v>0);}); return any?1:0; },
  onEnter(gp,ctx){ pendPick(gp,{forId:ctx.pid,prompt:'Add or remove a counter?',options:[{label:'Add +1 Atk counter',value:'add'},{label:'Remove a counter',value:'rem'}]},
    (gp2,mode)=>{ pendTarget(gp2,{forId:ctx.pid,prompt:(mode==='add'?'Add counter to:':'Remove counter from:'),filter:i=>i.owner===ctx.pid},
      (gp3,uid)=>{ if(mode==='add') addCounter(gp3,uid,'atk',1); else { if((gp3.inst[uid].counters.atk||0)>0) gp3.inst[uid].counters.atk--; } }); }); }
},
gates:{id:'gates',name:'Gates, Supportive Sensei',faction:'mystic',type:'fighter',kind:'fighter',sub:'Odddz',level:2,hp:2,atk:1,atkCost:1,cost:1,
  text:'On enter, another target Boss/Fighter gets +2 Attack this level.',
  onEnter(gp,ctx){ pendTarget(gp,{forId:ctx.pid,prompt:'Give +2 Attack (this level) to:',filter:i=>i.uid!==ctx.src},
    (gp2,uid)=>{ gp2.inst[uid].tempAtk=(gp2.inst[uid].tempAtk||0)+2; }); }
},
clief:{id:'clief',name:'Clief, Ancient Eclipse',faction:'mystic',type:'fighter',kind:'fighter',sub:'The Boom',level:7,hp:7,atk:3,atkCost:2,cost:2,
  text:'When attacking, play a Tactic from your graveyard for free.',
  onAttack(gp,ctx){ const opts=gp.p[ctx.pid].grave.filter(u=>CARDS[gp.inst[u].cid].type==='tactic'&&CARDS[gp.inst[u].cid].run);
    if(!opts.length) return;
    pendPick(gp,{forId:ctx.pid,prompt:'Replay which Tactic from graveyard (free)?',options:[...opts.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})),{label:'Skip',value:''}]},
      (gp2,uid)=>{ if(!uid) return; CARDS[gp2.inst[uid].cid].run(gp2,{pid:ctx.pid}); log(gp2,'Clief replays '+CARDS[gp2.inst[uid].cid].name+'.'); }); }
},
shadowstriker:{id:'shadowstriker',name:'Shadowstriker',faction:'mystic',type:'fighter',kind:'fighter',sub:'Incarnate',level:5,hp:5,atk:2,atkCost:2,cost:2,
  text:'Can\'t be blocked. Attacks as though opponents don\'t have Enforcer.', atkFlags:{ignoreEnforcer:true,unblockable:true}},
reika:{id:'reika',name:'Reika, First Novice',faction:'mystic',type:'fighter',kind:'fighter',sub:'The Boom',level:3,hp:2,atk:1,atkCost:0,cost:0,
  text:'Armor 1. Response ⊙: Block.', armor:1, selfBlock:{cost:{tap:true}}},
darby:{id:'darby',name:'Darby, Straphanger',faction:'shifter',type:'fighter',kind:'fighter',sub:'The Shambles',level:4,hp:4,atk:3,atkCost:2,cost:2,text:'Vanilla body.'},
minka:{id:'minka',name:'Minka, Underestimated',faction:'shifter',type:'fighter',kind:'fighter',sub:'The Waddle',level:6,hp:5,atk:2,atkCost:2,cost:2,
  text:'Whenever a Fighter dies, put a +1 Attack counter on Minka. Response ①⊙: Block.',
  onAnyFighterDeath(gp,uid){ if(gp.inst[uid].hp>0) addCounter(gp,uid,'atk',1); }, selfBlock:{cost:{coins:1,tap:true}}},
slider:{id:'slider',name:'Slider, Untombed',faction:'shifter',type:'fighter',kind:'fighter',sub:'Time Wolf',level:5,hp:5,atk:0,atkCost:2,cost:2,
  text:'Determination — has all Traits of opposing Fighters; Attack = number of unique Traits held. (Manual resolution.)'},
intersentinel:{id:'intersentinel',name:'Intersentinel',faction:'apex',type:'fighter',kind:'fighter',sub:'Pawn',level:3,hp:3,atk:1,atkCost:1,cost:1,
  text:'At the start of each level, your Boss heals 1. Response ①⊙: Block.',
  onLevelStart(gp,pid){ healInst(gp,gp.p[pid].boss,1); }, selfBlock:{cost:{coins:1,tap:true}}},
freevector:{id:'freevector',name:'Free Vector',faction:'apex',type:'fighter',kind:'fighter',sub:'Pawn',level:1,hp:2,atk:1,atkCost:0,cost:0,
  text:'When this dies, draw a card.', onDeath(gp,ctx){ drawN(gp,ctx.pid,1); }},
vector:{id:'vector',name:'Vector, Victor',faction:'apex',type:'fighter',kind:'fighter',sub:'Pawn',level:3,hp:5,atk:1,atkCost:1,cost:1,text:'Vanilla body.'},
mechtorsuit:{id:'mechtorsuit',name:'Mechtor Suit',faction:'apex',type:'fighter',kind:'fighter',sub:'Pawn',level:5,hp:5,atk:1,atkCost:0,cost:0,text:'Vanilla body.'},
swordfromnowhere:{id:'swordfromnowhere',name:'Sword from Nowhere',faction:'mystic',type:'weapon',level:6,cost:2,
  text:'Wielder gets +X Attack = number of Tactic/Response cards in your graveyard. ②, Destroy: return a Tactic/Response from graveyard to hand.',
  dynamicAtk(gp,uid){ const pid=gp.inst[uid].owner; return gp.p[pid].grave.filter(u=>{const c=CARDS[gp.inst[u]?.cid];return c&&(c.type==='tactic'||c.type==='response');}).length; },
  weaponActivated:[{label:'Destroy: return T/R from grave to hand',cost:{coins:2,sacrifice:true},
    run(gp,ctx){ const pid=gp.inst[ctx.src].owner; const opts=gp.p[pid].grave.filter(u=>{const c=CARDS[gp.inst[u]?.cid];return c&&(c.type==='tactic'||c.type==='response');});
      if(!opts.length) return; pendPick(gp,{forId:pid,prompt:'Return which card to hand?',options:opts.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},
        (gp2,u)=>moveZone(gp2,pid,u,'grave','hand')); }}]
},
theurgicthrashing:{id:'theurgicthrashing',name:'Theurgic Thrashing',faction:'mystic',type:'tactic',speed:'sorcery',cost:3,
  text:'Deal 3 dmg to target Fighter. A Boss/Fighter heals 3.',
  run(gp,ctx){ pendTarget(gp,{forId:ctx.pid,prompt:'Deal 3 dmg to which Fighter?',filter:i=>i.kind==='fighter'},
    (gp2,u1)=>{ dealDamage(gp2,u1,3); pendTarget(gp2,{forId:ctx.pid,prompt:'Heal 3 to which Boss/Fighter?',filter:i=>true},
      (gp3,u2)=>healInst(gp3,u2,3)); }); }},
rollcall:{id:'rollcall',name:'Roll Call',faction:'mystic',type:'tactic',speed:'sorcery',cost:5,
  text:'Choose: distribute up to 5 +1 Attack counters among your Fighters, OR draw a card for each of your Fighters with a counter.',
  run(gp,ctx){ pendPick(gp,{forId:ctx.pid,prompt:'Choose a mode:',options:[{label:'Distribute 5 +1 Atk counters',value:'a'},{label:'Draw per countered Fighter',value:'b'}]},
    (gp2,mode)=>{ if(mode==='b'){ const n=gp2.p[ctx.pid].board.filter(u=>gp2.inst[u].kind==='fighter'&&Object.values(gp2.inst[u].counters||{}).some(v=>v>0)).length; drawN(gp2,ctx.pid,n); return; }
      let left=5; const step=(gpx)=>{ if(left<=0) return; pendPick(gpx,{forId:ctx.pid,prompt:left+' counter(s) left — choose a Fighter or Done',
          options:[...gpx.p[ctx.pid].board.filter(u=>gpx.inst[u].kind==='fighter').map(u=>({label:CARDS[gpx.inst[u].cid].name,value:u})),{label:'Done',value:''}]},
        (gpy,u)=>{ if(!u){left=0;return;} addCounter(gpy,u,'atk',1); left--; step(gpy); }); };
      step(gp2); }); }},
malefice:{id:'malefice',name:'Malefice',faction:'mystic',type:'tactic',speed:'sorcery',cost:3,
  text:'Destroy target Weapon. If wielded, deal damage to that Fighter equal to the Weapon\'s level.',
  run(gp,ctx){ const ws=allBoard(gp).filter(u=>CARDS[gp.inst[u].cid].type==='weapon');
    pendPick(gp,{forId:ctx.pid,prompt:'Destroy which Weapon?',options:ws.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},
      (gp2,wUid)=>{ const w=gp2.inst[wUid]; const wieldedFighter=w.wieldedBy; destroyInstance(gp2,wUid);
        if(wieldedFighter) dealDamage(gp2,wieldedFighter,CARDS[w.cid].level||0); }); }},
voltagesnap:{id:'voltagesnap',name:'Voltage Snap',faction:'mystic',type:'tactic',speed:'sorcery',cost:1,
  text:'Deal 2 dmg to target Boss/Fighter; if it\'s a Synth or Survivor, deal 3 instead.',
  run(gp,ctx){ pendTarget(gp,{forId:ctx.pid,prompt:'Deal damage to:',filter:i=>true},
    (gp2,uid)=>{ const f=CARDS[gp2.inst[uid]?.cid||'']?.faction; dealDamage(gp2,uid,(f==='synth'||f==='survivor')?3:2); }); }},
sludged:{id:'sludged',name:'Sludged',faction:'mystic',type:'response',speed:'instant',cost:3,
  text:'Put target attacking Fighter on top of its owner\'s deck.', counterAttack:true,
  run(gp,ctx){ const uid=ctx.attacker; const pid=gp.inst[uid].owner; moveZone(gp,pid,uid,'board','deck-top'); cancelPendingAttack(gp); }},
rats:{id:'rats',name:'RATS!',faction:'mystic',type:'response',speed:'instant',cost:2,
  text:'Put a +1 Attack counter on up to 3 target Fighters on your team.',
  run(gp,ctx){ let left=3; const step=(gpx)=>{ if(left<=0) return; pendPick(gpx,{forId:ctx.pid,prompt:left+' counter(s) left — choose a Fighter or Done',
      options:[...gpx.p[ctx.pid].board.filter(u=>gpx.inst[u].kind==='fighter').map(u=>({label:CARDS[gpx.inst[u].cid].name,value:u})),{label:'Done',value:''}]},
    (gpy,u)=>{ if(!u){left=0;return;} addCounter(gpy,u,'atk',1); left--; step(gpy); }); }; step(gp); }},
fullheal:{id:'fullheal',name:'Full Heal!',faction:'mystic',type:'response',speed:'instant',cost:3,
  text:'Heal all Fighters on your team to maximum Health.',
  run(gp,ctx){ gp.p[ctx.pid].board.forEach(u=>{ if(gp.inst[u].kind==='fighter') gp.inst[u].hp=gp.inst[u].maxHp; }); }},
echofade:{id:'echofade',name:'Echo Fade',faction:'mystic',type:'response',speed:'instant',cost:2,
  text:'Put two -1 Attack counters on target Fighter.',
  run(gp,ctx){ pendTarget(gp,{forId:ctx.pid,prompt:'Target Fighter:',filter:i=>i.kind==='fighter'},(gp2,uid)=>addCounter(gp2,uid,'atk',-2)); }},
evanesce:{id:'evanesce',name:'Evanesce',faction:'mystic',type:'response',speed:'instant',cost:3,
  text:'Destroy up to one target Weapon. Draw a card.',
  run(gp,ctx){ const ws=allBoard(gp).filter(u=>CARDS[gp.inst[u].cid].type==='weapon');
    if(!ws.length){ drawN(gp,ctx.pid,1); return; }
    pendPick(gp,{forId:ctx.pid,prompt:'Destroy a Weapon (optional):',options:[...ws.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})),{label:'Skip',value:''}]},
      (gp2,u)=>{ if(u) destroyInstance(gp2,u); drawN(gp2,ctx.pid,1); }); }},
marrowpiercer:{id:'marrowpiercer',name:'Marrowpiercer',faction:'shifter',type:'weapon',level:3,cost:3,
  text:'Whenever the wielder deals attack damage, it heals equal to that damage.',
  onWielderDealtDamage(gp,wielderUid,amt){ healInst(gp,wielderUid,amt); }},
murkgodpendant:{id:'murkgodpendant',name:'Murkgod Pendant',faction:'shifter',type:'weapon',level:2,cost:0,
  text:'Wielder gains ②⊙: Transform.',
  grantsActivated:[{label:'Transform',cost:{coins:2,tap:true}, run(gp,ctx){ transformInstance(gp,ctx.src); }}]},
trackersfrenzy:{id:'trackersfrenzy',name:"Tracker's Frenzy",faction:'shifter',type:'tactic',speed:'sorcery',cost:1,
  text:'Deal 1 dmg to target Boss/Fighter; if a Fighter left play this level, deal 3 instead.',
  run(gp,ctx){ const amt=gp.fighterLeftThisLevel?3:1; pendTarget(gp,{forId:ctx.pid,prompt:'Deal '+amt+' dmg to:',filter:i=>true},(gp2,uid)=>dealDamage(gp2,uid,amt)); }},
undertowed:{id:'undertowed',name:'Undertowed',faction:'shifter',type:'tactic',speed:'sorcery',cost:3,
  text:'Destroy target Fighter with 4 or more (max) Health.',
  run(gp,ctx){ pendTarget(gp,{forId:ctx.pid,prompt:'Destroy which Fighter (4+ Health)?',filter:i=>i.kind==='fighter'&&i.maxHp>=4},(gp2,uid)=>destroyInstance(gp2,uid)); }},
steelswipe:{id:'steelswipe',name:'Steel Swipe',faction:'shifter',type:'tactic',speed:'sorcery',cost:2,
  text:'Deal 2 dmg; if your Boss is a Shifter, deal 3 instead.',
  run(gp,ctx){ const amt=CARDS[gp.inst[gp.p[ctx.pid].boss].cid].faction==='shifter'?3:2;
    pendTarget(gp,{forId:ctx.pid,prompt:'Deal '+amt+' dmg to:',filter:i=>true},(gp2,uid)=>dealDamage(gp2,uid,amt)); }},
toothextraction:{id:'toothextraction',name:'Tooth Extraction',faction:'shifter',type:'tactic',speed:'sorcery',cost:4,
  text:'Deal 5 damage divided as you choose among any targets.',
  run(gp,ctx){ let left=5; const step=(gpx)=>{ if(left<=0) return; pendTarget(gpx,{forId:ctx.pid,prompt:left+' dmg left — choose a target',filter:i=>true},
      (gpy,uid)=>{ dealDamage(gpy,uid,1); left--; step(gpy); }); }; step(gp); }},
catchcard:{id:'catchcard',name:'Catch!',faction:'shifter',type:'tactic',speed:'sorcery',cost:2,
  text:'Deal 4 damage to target Fighter.',
  run(gp,ctx){ pendTarget(gp,{forId:ctx.pid,prompt:'Deal 4 dmg to which Fighter?',filter:i=>i.kind==='fighter'},(gp2,uid)=>dealDamage(gp2,uid,4)); }},
pushcard:{id:'pushcard',name:'Push',faction:'shifter',type:'tactic',speed:'sorcery',cost:3,
  text:'Destroy target Fighter.', run(gp,ctx){ pendTarget(gp,{forId:ctx.pid,prompt:'Destroy which Fighter?',filter:i=>i.kind==='fighter'},(gp2,uid)=>destroyInstance(gp2,uid)); }},
derail:{id:'derail',name:'Derail',faction:'shifter',type:'tactic',speed:'sorcery',cost:5,
  text:'Destroy all Fighters (every player).',
  run(gp,ctx){ Object.keys(gp.p).forEach(pid=>{ gp.p[pid].board.slice().forEach(u=>{ if(gp.inst[u].kind==='fighter') destroyInstance(gp,u); }); }); }},
emergencybrake:{id:'emergencybrake',name:'Emergency Brake',faction:'shifter',type:'tactic',speed:'sorcery',cost:1,
  text:'Destroy target Level 2 or lower Fighter.',
  run(gp,ctx){ pendTarget(gp,{forId:ctx.pid,prompt:'Destroy which Lvl-2-or-lower Fighter?',filter:i=>i.kind==='fighter'&&(CARDS[i.cid].level||0)<=2},(gp2,uid)=>destroyInstance(gp2,uid)); }},
flippingout:{id:'flippingout',name:'Flipping Out',faction:'shifter',type:'tactic',speed:'sorcery',cost:5,
  text:'Deal 4 damage to up to two different targets.',
  run(gp,ctx){ pendPick(gp,{forId:ctx.pid,prompt:'Split the 4 damage how?',options:[{label:'All 4 to one target',value:'1'},{label:'2 and 2 to two targets',value:'2'}]},
    (gp2,mode)=>{ if(mode==='1'){ pendTarget(gp2,{forId:ctx.pid,prompt:'Target for 4 dmg:',filter:i=>true},(gp3,u)=>dealDamage(gp3,u,4)); }
      else { pendTarget(gp2,{forId:ctx.pid,prompt:'First target (2 dmg):',filter:i=>true},(gp3,u1)=>{ dealDamage(gp3,u1,2);
          pendTarget(gp3,{forId:ctx.pid,prompt:'Second target (2 dmg):',filter:i=>true},(gp4,u2)=>dealDamage(gp4,u2,2)); }); } }); }},
nightvision:{id:'nightvision',name:'Night Vision',faction:'shifter',type:'tactic',speed:'sorcery',cost:1,
  text:'All Bosses/Fighters can be attacked as though they don\'t have Stealthy this level. Draw a card.',
  run(gp,ctx){ gp.ignoreStealthyLevel=true; drawN(gp,ctx.pid,1); }},
ahacard:{id:'ahacard',name:'Aha!',faction:'shifter',type:'tactic',speed:'sorcery',cost:2,
  text:'Discard a card. Draw two cards.',
  run(gp,ctx){ if(!gp.p[ctx.pid].hand.length){ drawN(gp,ctx.pid,2); return; }
    pendPick(gp,{forId:ctx.pid,prompt:'Discard which card?',options:gp.p[ctx.pid].hand.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},
      (gp2,u)=>{ moveZone(gp2,ctx.pid,u,'hand','grave'); drawN(gp2,ctx.pid,2); }); }},
outlast:{id:'outlast',name:'Outlast',faction:'shifter',type:'tactic',speed:'sorcery',cost:3,
  text:'Choose an opponent. Deal dmg to target on their team = (their Fighter count − your Fighter count), min 0.',
  run(gp,ctx){ const others=Object.keys(gp.p).filter(p=>p!==ctx.pid&&!gp.p[p].defeated);
    pendPick(gp,{forId:ctx.pid,prompt:'Choose an opponent:',options:others.map(p=>({label:gp.p[p].name,value:p}))},
      (gp2,opp)=>{ pendTarget(gp2,{forId:ctx.pid,prompt:'Target Fighter of theirs:',filter:i=>i.owner===opp&&i.kind==='fighter'},
        (gp3,uid)=>{ const mine=gp3.p[ctx.pid].board.filter(u=>gp3.inst[u].kind==='fighter').length;
          const theirs=gp3.p[opp].board.filter(u=>gp3.inst[u].kind==='fighter').length;
          dealDamage(gp3,uid,Math.max(0,theirs-mine)); }); }); }}
};

const TOKEN_DEFS = {
  beartrap:{id:'beartrap',name:'Bear Trap',faction:'synth',type:'token',kind:'fighter',hp:1,atk:0,atkCost:0,keywords:['Enforcer'],
    onDeathFromAttack(gp,attackerUid){ dealDamage(gp,attackerUid,1); }},
  toolbox:{id:'toolbox',name:'Toolbox',faction:'synth',type:'token',kind:'fighter',hp:3,atk:1,atkCost:1},
  headrat:{id:'headrat',name:'Head Rat',faction:'mystic',type:'token',kind:'fighter',hp:2,atk:1,atkCost:0,tag:'Rat'},
  whump:{id:'whump',name:'Whump!',faction:'mystic',type:'token',kind:'fighter',hp:4,atk:3,atkCost:1,diesEndOfLevel:true}
};
Object.assign(CARDS, TOKEN_DEFS);

/* ============== UTIL ============== */
function uid(n){ const c='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<(n||8);i++) s+=c[Math.floor(Math.random()*c.length)]; return s; }
function roomCode(){ return uid(5); }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* ============== DB LIVE STORAGE LAYER ============== */
async function loadRoom(code) {
  const { data, error } = await supabaseClient.from('rooms').select('payload').eq('code', code).maybeSingle();
  if (error) { console.error("Database read fault:", error); return null; }
  return data ? data.payload : null;
}

async function saveRoom(room) {
  room.v = (room.v || 0) + 1;
  const { error } = await supabaseClient.from('rooms').upsert({
    code: room.code,
    payload: room,
    v: room.v,
    updated_at: new Date().toISOString()
  }, { onConflict: 'code' });
  if (error) { console.error("Database write fault:", error); return false; }
  return true;
}

function getMyPid(code) { return localStorage.getItem('cc_pid_' + code); }
function setMyPid(code, pid) { localStorage.setItem('cc_pid_' + code, pid); }

let realtimeChannel = null;
function subscribeToRoom(code) {
  if (realtimeChannel) realtimeChannel.unsubscribe();
  realtimeChannel = supabaseClient
    .channel('room_' + code)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: 'code=eq.' + code }, payload => {
      const freshRoom = payload.new.payload;
      if (!S.room || freshRoom.v > S.room.v) {
        S.room = freshRoom;
        render();
      }
    })
    .subscribe();
}

async function act(mutator){
  if(!S.code) return;
  S.busy=true; render();
  const fresh=await loadRoom(S.code);
  if(!fresh){ S.busy=false; alert('Room went stale or was destroyed.'); return; }
  mutator(fresh);
  const ok=await saveRoom(fresh);
  S.busy=false;
  if(ok){ S.room=fresh; render(); }
}

/* ============== CLIENT STATE ============== */
let S={ screen:'home', name:'', codeInput:'', code:null, myId:null, room:null, busy:false, helpOpen:false, attackPick:null };

/* ============== ENGINE HELPERS ============== */
function log(gp,msg){ gp.log=gp.log||[]; gp.log.push(msg); if(gp.log.length>60) gp.log.shift(); }
function inst(gp,u){ return gp.inst[u]; }
function allBoard(gp){ let r=[]; Object.keys(gp.p).forEach(pid=>{ r=r.concat(gp.p[pid].board); if(gp.p[pid].boss) r.push(gp.p[pid].boss); }); return r; }
function weaponAtk(gp,uid){ const i=gp.inst[uid]; const c=CARDS[i.cid]; let v=c.atkMod||0; if(c.dynamicAtk) v=c.dynamicAtk(gp,uid); return v; }

function instSummary(gp,uid){
  const i=gp.inst[uid]; if(!i) return null; const c=CARDS[i.cid];
  let atk=0;
  if(i.kind==='fighter'||i.kind==='boss'){
    atk=(c.atk||0)+(i.counters.atk||0)+(i.tempAtk||0);
    if(c.dynamicAtkBonus) atk+=c.dynamicAtkBonus(gp,uid);
    (i.wielded||[]).forEach(wu=>{ atk+=weaponAtk(gp,wu); });
  }
  return {uid,name:c.name,faction:c.faction,kind:i.kind,hp:i.hp,maxHp:i.maxHp,atk:Math.max(0,atk),tapped:(i.actedCount>=(i.agilityLevel||c.grantsKeyword==='agility'||hasWieldedAgility(gp,uid)?2:1)),
    keywords:(c.keywords||[]).concat(i.stunned?['Stunned']:[]).concat(i.phantasmal?['Phantasmal']:[]),
    enterLevel:i.enterLevel, dead:i.hp<=0};
}
function hasWieldedAgility(gp,uid){ return (gp.inst[uid].wielded||[]).some(wu=>CARDS[gp.inst[wu].cid].grantsKeyword==='agility'); }

function resetInstance(gp,uid){ const i=gp.inst[uid]; const c=CARDS[i.cid];
  i.hp=c.hp||1; i.maxHp=c.hp||1; i.counters=Object.assign({},c.startCounters||{}); i.tempAtk=0; i.actedCount=0; i.agilityLevel=false;
  i.stunned=false; i.wielded=[]; i.wieldedBy=null; i.fortifiedUnder=null; i.dmgThisLevel=false; i.enterLevel=gp.level; i.phantasmal=false;
}
function newInstance(gp,cardId,owner){ const u=uid(10); gp.inst[u]={uid:u,cid:cardId,owner,kind:CARDS[cardId].kind||CARDS[cardId].type,counters:{},wielded:[]}; resetInstance(gp,u); return u; }

function moveZone(gp,pid,u,from,to){
  if(from==='hand') gp.p[pid].hand=gp.p[pid].hand.filter(x=>x!==u);
  if(from==='board') gp.p[pid].board=gp.p[pid].board.filter(x=>x!==u);
  if(from==='grave') gp.p[pid].grave=gp.p[pid].grave.filter(x=>x!==u);
  if(from==='deck') gp.p[pid].deck=gp.p[pid].deck.filter(x=>x!==u);
  if(to==='hand') gp.p[pid].hand.push(u);
  if(to==='board') gp.p[pid].board.push(u);
  if(to==='grave') gp.p[pid].grave.push(u);
  if(to==='deck-top') gp.p[pid].deck.unshift(u);
}
function drawN(gp,pid,n){ for(let i=0;i<n;i++){ const d=gp.p[pid].deck; if(!d.length) continue; const u=d.shift(); gp.p[pid].hand.push(u); } }
function spendCoins(gp,pid,n){ if(gp.p[pid].coins<n) return false; gp.p[pid].coins-=n; return true; }
function healInst(gp,uid,amt){ const i=gp.inst[uid]; if(!i) return; i.hp=Math.min(i.maxHp,i.hp+amt); log(gp,CARDS[i.cid].name+' heals '+amt+'.'); }
function addCounter(gp,uid,type,amt){ const i=gp.inst[uid]; if(!i) return; i.counters[type]=(i.counters[type]||0)+amt;
  if(type==='atk'&&amt>0){ const pid=i.owner; (gp.p[pid].board.concat([gp.p[pid].boss])).forEach(u=>{ if(u&&gp.inst[u]&&CARDS[gp.inst[u].cid].onCounterPlaced) CARDS[gp.inst[u].cid].onCounterPlaced(gp,pid); }); }
  log(gp,CARDS[i.cid].name+' gets a '+type+' counter ('+(amt>0?'+':'')+amt+').');
}
function createToken(gp,pid,tokenId){ const u=newInstance(gp,tokenId,pid); gp.p[pid].board.push(u); log(gp,gp.p[pid].name+' creates '+CARDS[tokenId].name+'.'); return u; }

function wieldWeapon(gp,wUid,fUid){ const w=gp.inst[wUid]; w.wieldedBy=fUid; gp.inst[fUid].wielded.push(wUid);
  const c=CARDS[w.cid]; if(c.onWield) c.onWield(gp,{pid:w.owner,src:wUid});
  const owner=w.owner; if(CARDS['toolshed']&&gp.p[owner].boss&&gp.inst[gp.p[owner].boss].cid==='toolshed') CARDS.toolshed.onWeaponEnter(gp,{pid:owner});
  log(gp,CARDS[w.cid].name+' wielded to '+CARDS[gp.inst[fUid].cid].name+'.');
}

function fireOnEnter(gp,uid,pid){ const c=CARDS[gp.inst[uid].cid]; if(c.onEnter) c.onEnter(gp,{pid,src:uid}); }

function destroyInstance(gp,uid,opts){
  const i=gp.inst[uid]; if(!i) return; const c=CARDS[i.cid]; const pid=i.owner;
  if(c.fortifyInstead && !(opts&&opts.skipFortify)){
    const candidates=(gp.p[pid].board.concat([gp.p[pid].boss])).filter(u=>u&&u!==uid&&gp.inst[u]&&!gp.inst[u].fortifiedUnder&&(gp.inst[u].kind==='fighter'||gp.inst[u].kind==='boss')&&gp.inst[u].hp>0);
    if(candidates.length){ const target=candidates[0]; gp.inst[target].maxHp+=i.maxHp; gp.inst[target].hp+=i.maxHp; i.fortifiedUnder=target;
      gp.p[pid].board=gp.p[pid].board.filter(x=>x!==uid); log(gp,c.name+' Fortifies under '+CARDS[gp.inst[target].cid].name+'.'); return; }
  }
  if(i.kind==='fighter') gp.fighterLeftThisLevel=true;
  moveZone(gp,pid,uid,'board','grave');
  if(c.onDeath) c.onDeath(gp,{pid});
  allBoard(gp).forEach(u=>{ if(gp.inst[u]&&CARDS[gp.inst[u].cid].onAnyFighterDeath&&i.kind==='fighter') CARDS[gp.inst[u].cid].onAnyFighterDeath(gp,u); });
  log(gp,c.name+' is destroyed.');
  checkWin(gp);
}

function dealDamage(gp,uid,amt){
  const i=gp.inst[uid]; if(!i||i.hp<=0) return; const c=CARDS[i.cid];
  let reduced=amt; if(c.armor) reduced=Math.max(0,amt-c.armor);
  i.hp-=reduced; i.dmgThisLevel=true;
  log(gp,c.name+' takes '+reduced+' damage'+(c.armor&&reduced<amt?' (Armor reduced)':'')+'.');
  if(i.hp<=0) destroyInstance(gp,uid);
  checkWin(gp);
}

function pendTarget(gp,{forId,prompt,filter},cb){
  const valid=allBoard(gp).filter(u=>{ const s=instSummary(gp,u); return s&&!s.dead&&filter(Object.assign({},s,{owner:gp.inst[u].owner})); });
  gp.pending={kind:'target',forId,prompt,valid,_cb:null};
  S.pendingCb=cb;
}
function pendPick(gp,{forId,prompt,options},cb){ gp.pending={kind:'pick',forId,prompt,options}; S.pendingCb=cb; }
function pendDiscardOptional(gp,ctx,prompt,cb){
  const hand=gp.p[ctx.pid].hand;
  gp.pending={kind:'discard',forId:ctx.pid,prompt,options:hand.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})).concat([{label:'Skip',value:''}])};
  S.pendingCb=(gp2,v)=>cb(gp2,Object.assign({},ctx),v||null);
}
function cancelPendingAttack(gp){ gp.pendingAttack=null; }
function resumeAttack(gp,ctx){ finishAttackDamage(gp,ctx); }

/* ============== SETUP AND ARCHITECTURE LOGIC ============== */
function startGame(room){
  const gp={ level:1, order:room.players.map(p=>p.id), firstIdx:0, curIdx:0, passes:0, p:{}, inst:{}, pending:null, winner:null, log:[], fighterLeftThisLevel:false, ignoreStealthyLevel:false };
  room.players.forEach(pl=>{
    gp.p[pl.id]={ name:pl.name, coins:0, hand:[], board:[], grave:[], deck:[], boss:null, mullUsed:false, defeated:false };
    const bossUid=newInstance(gp,pl.bossId,pl.id); gp.p[pl.id].boss=bossUid;
    const lib=[]; Object.entries(pl.list||{}).forEach(([cid,n])=>{ for(let i=0;i<n;i++) lib.push(newInstance(gp,cid,pl.id)); });
    gp.p[pl.id].deck=shuffle(lib);
    drawN(gp,pl.id,room.settings.startHand);
  });
  dealLevelCoins(gp,room.settings);
  room.game=gp; room.phase='play'; log(gp,'Game started. Level 1 begins.');
}
function dealLevelCoins(gp,settings){ Object.keys(gp.p).forEach(pid=>{ if(!gp.p[pid].defeated) gp.p[pid].coins+=gp.level; }); }

function levelStart(gp,settings){
  gp.fighterLeftThisLevel=false; gp.ignoreStealthyLevel=false;
  Object.keys(gp.p).forEach(pid=>{
    if(gp.p[pid].defeated) return;
    gp.p[pid].board.concat([gp.p[pid].boss]).forEach(u=>{ if(!u) return; const i=gp.inst[u]; i.actedCount=0; i.tempAtk=0; if(i.stunned&&i._stunnedSetLevel!==gp.level) i.stunned=false; });
    const hadNone=gp.p[pid].hand.length===0;
    drawN(gp,pid,settings.drawPerLevel||1);
    if(hadNone){ const boss=gp.inst[gp.p[pid].boss]; if(boss&&CARDS[boss.cid].id==='trapper') drawN(gp,pid,1); }
    const bossDef=gp.inst[gp.p[pid].boss]&&CARDS[gp.inst[gp.p[pid].boss].cid];
    if(bossDef&&bossDef.onLevelStart) bossDef.onLevelStart(gp,pid);
    gp.p[pid].board.forEach(u=>{ const c=CARDS[gp.inst[u].cid]; if(c.onLevelStart) c.onLevelStart(gp,pid); });
  });
  Object.keys(gp.p).forEach(pid=>{ gp.p[pid].board.slice().forEach(u=>{ if(CARDS[gp.inst[u].cid].diesEndOfLevel) destroyInstance(gp,u,{skipFortify:true}); }); });
  dealLevelCoins(gp,settings);
}

function advanceLevel(gp,settings){
  Object.keys(gp.p).forEach(pid=>{ gp.p[pid].coins=0; });
  gp.level++;
  const active=gp.order.filter(p=>!gp.p[p].defeated);
  gp.firstIdx=(gp.firstIdx+1)%gp.order.length;
  while(gp.p[gp.order[gp.firstIdx]].defeated) gp.firstIdx=(gp.firstIdx+1)%gp.order.length;
  gp.curIdx=gp.firstIdx; gp.passes=0;
  levelStart(gp,settings);
  log(gp,'— Level '+gp.level+' begins —');
}

function activePlayers(gp){ return gp.order.filter(p=>!gp.p[p].defeated); }
function nextTurn(gp){ const ord=gp.order; let idx=gp.curIdx;
  do{ idx=(idx+1)%ord.length; }while(gp.p[ord[idx]].defeated);
  gp.curIdx=idx;
}
function checkWin(gp){
  Object.keys(gp.p).forEach(pid=>{ if(!gp.p[pid].defeated && gp.inst[gp.p[pid].boss] && gp.inst[gp.p[pid].boss].hp<=0) gp.p[pid].defeated=true; });
  const left=activePlayers(gp);
  if(left.length<=1 && !gp.winner){ gp.winner=left[0]||'draw'; log(gp,left[0]?(gp.p[left[0]].name+' wins!'):'Draw — all Bosses fell.'); }
}

function transformInstance(gp,uid){ const i=gp.inst[uid]; const pid=i.owner; const lvl=CARDS[i.cid].level||0; const origName=CARDS[i.cid].name;
  destroyInstance(gp,uid,{skipFortify:true});
  const pool=gp.p[pid].deck.filter(u=>{ const c=CARDS[gp.inst[u].cid]; return c.kind==='fighter'&&(c.level||0)<=lvl&&c.name!==origName; });
  if(!pool.length){ log(gp,'Transform found no eligible Fighter.'); return; }
  const pick=pool[Math.floor(Math.random()*pool.length)];
  gp.p[pid].deck=gp.p[pid].deck.filter(u=>u!==pick); gp.p[pid].board.push(pick); resetInstance(gp,pick); fireOnEnter(gp,pick,pid);
  gp.p[pid].deck=shuffle(gp.p[pid].deck);
  log(gp,'Transformed into '+CARDS[gp.inst[pick].cid].name+'.');
}

/* ============== COMBAT OPERATIONS ============== */
function effectiveAtkCost(gp,uid){ const i=gp.inst[uid]; const c=CARDS[i.cid]; let cost=(i.costOverrideLevel!==undefined?i.costOverrideLevel:(c.atkCost||0));
  if(c.faction==='synth' && i.cid!=='dreyver'){ const pid=i.owner; const hasDreyver=gp.p[pid].board.some(u=>gp.inst[u].cid==='dreyver'&&gp.inst[u].hp>0);
    if(hasDreyver) cost=Math.max(1,cost-1); }
  return Math.max(0,cost);
}
function canAct(gp,uid){ const i=gp.inst[uid]; const c=CARDS[i.cid]; const maxActs=(i.agilityLevel||c.grantsKeyword==='agility'||hasWieldedAgility(gp,uid))?2:1;
  if(i.stunned) return false; return (i.actedCount||0)<maxActs; }

function declareAttack(gp,attackerUid,defenderUid,ctxPid){
  const cost=effectiveAtkCost(gp,attackerUid);
  if(!spendCoins(gp,ctxPid,cost)) return false;
  gp.inst[attackerUid].actedCount=(gp.inst[attackerUid].actedCount||0)+1;
  gp.passes=0;
  const ctx={pid:ctxPid,attacker:attackerUid,defender:defenderUid};
  const c=CARDS[gp.inst[attackerUid].cid];
  if(c.preAttack){ c.preAttack(gp,ctx); return true; }
  finishAttackDamage(gp,ctx);
  return true;
}
function finishAttackDamage(gp,ctx){
  const s=instSummary(gp,ctx.attacker); const dmg=s.atk;
  dealDamage(gp,ctx.defender,dmg);
  (gp.inst[ctx.attacker].wielded||[]).forEach(wu=>{ const wc=CARDS[gp.inst[wu].cid]; if(wc.onWielderDealtDamage) wc.onWielderDealtDamage(gp,ctx.attacker,dmg); });
  const ac=CARDS[gp.inst[ctx.attacker].cid];
  if(ac.onAttack) ac.onAttack(gp,{pid:ctx.pid,src:ctx.attacker});
  log(gp,ac.name+' attacks for '+dmg+' damage.');
}

/* ============== INTERFACE EVENT HOOKS ============== */
window.createRoom=async function(){
  if(!S.name.trim()) return alert('Enter a username first.');
  const code=roomCode(); const pid=uid(8);
  const room={ code, hostId:pid, phase:'lobby', settings:{startHand:5,drawPerLevel:1}, players:[{id:pid,name:S.name,ready:false,factions:[],bossId:null,list:{}}], game:null, v:0, log:[] };
  S.busy=true; render();
  const ok=await saveRoom(room); setMyPid(code,pid);
  S.busy=false;
  if(ok){ S.code=code; S.myId=pid; S.room=room; S.screen='lobby'; subscribeToRoom(code); render(); }
  else { alert('Could not link to network server.'); }
};

window.joinRoom=async function(){
  if(!S.name.trim()) return alert('Enter a username first.');
  const code=S.codeInput.trim().toUpperCase(); if(!code) return alert('Enter a room code.');
  S.busy=true; render();
  const room=await loadRoom(code);
  if(!room){ S.busy=false; return alert('Room code invalid or missing.'); }
  if(room.phase!=='lobby'){ S.busy=false; return alert('Combat session already locked & in progress.'); }
  let pid=getMyPid(code);
  if(!pid || !room.players.find(p=>p.id===pid)){
    pid=uid(8);
    room.players.push({id:pid,name:S.name,ready:false,factions:[],bossId:null,list:{}});
    const ok = await saveRoom(room);
    if(!ok) { S.busy=false; return alert('Could not mount node state.'); }
    setMyPid(code,pid);
  }
  S.code=code; S.myId=pid; S.room=room; S.screen='lobby'; S.busy=false;
  subscribeToRoom(code); render();
};

window.startBuild=async function(){ await act(r=>{ r.phase='build'; }); };
window.toggleFaction=async function(f){
  await act(r=>{ const me=r.players.find(p=>p.id===S.myId); const i=me.factions.indexOf(f);
    if(i>=0) me.factions.splice(i,1); else { if(me.factions.length>=2) me.factions.shift(); me.factions.push(f); }
    me.bossId=null; me.list={}; });
};
window.pickBoss=async function(cid){ await act(r=>{ r.players.find(p=>p.id===S.myId).bossId=cid; }); };
window.adjustCard=async function(cid,delta){
  await act(r=>{ const me=r.players.find(p=>p.id===S.myId); const cur=me.list[cid]||0; const next=Math.max(0,Math.min(3,cur+delta));
    const total=Object.entries(me.list).reduce((s,[k,v])=>s+(k===cid?0:v),0)+next;
    if(next>cur && total>39) return; me.list[cid]=next; if(!me.list[cid]) delete me.list[cid]; });
};
window.markReady=async function(){
  await act(r=>{ const me=r.players.find(p=>p.id===S.myId);
    const total=Object.values(me.list).reduce((a,b)=>a+b,0);
    if(!me.bossId) return alert('Assign a team Boss card.');
    if(total!==39) return alert('Deck footprint must measure exactly 39 cards. Current setup: '+total);
    me.ready=true; });
};
window.unready=async function(){ await act(r=>{ r.players.find(p=>p.id===S.myId).ready=false; }); };
window.beginGame=async function(){ await act(r=>{ startGame(r); }); };
window.doMulligan=async function(){ await act(r=>{ const gp=r.game; const pid=S.myId; if(gp.p[pid].mullUsed) return;
  const hand=gp.p[pid].hand.slice(); gp.p[pid].deck=shuffle(gp.p[pid].deck.concat(hand)); gp.p[pid].hand=[];
  drawN(gp,pid,r.settings.startHand); gp.p[pid].mullUsed=true; log(gp,gp.p[pid].name+' takes a Mulligan reset.'); }); };

window.playHandCard=async function(u){
  await act(r=>{ const gp=r.game; const pid=S.myId; const c=CARDS[gp.inst[u].cid];
    if(gp.curIdx!==gp.order.indexOf(pid) && c.speed!=='instant') return alert('Awaiting opponent action lane.');
    if(gp.p[pid].coins<(c.cost||0)) return alert('Insufficient Resource Coins.');
    if(c.type==='fighter'){ if((c.level||0)>gp.level) return alert('Level ceiling restriction unmet.');
      spendCoins(gp,pid,c.cost||0); moveZone(gp,pid,u,'hand','board'); resetInstance(gp,u); fireOnEnter(gp,u,pid); gp.passes=0; }
    else if(c.type==='weapon'){ if((c.level||0)>gp.level) return alert('Level ceiling restriction unmet.');
      const myFighters=gp.p[pid].board.filter(x=>gp.inst[x].kind==='fighter');
      if(!myFighters.length) return alert('No valid targets to equip.');
      spendCoins(gp,pid,c.cost||0); moveZone(gp,pid,u,'hand','board'); gp.passes=0;
      pendTarget(gp,{forId:pid,prompt:'Wield '+c.name+' to target Fighter:',filter:i=>i.kind==='fighter'&&i.owner===pid},(gp2,fUid)=>wieldWeapon(gp2,u,fUid));
    } else { spendCoins(gp,pid,c.cost||0); moveZone(gp,pid,u,'hand','grave'); gp.passes=0; if(c.run) c.run(gp,{pid}); else log(gp,c.name+' deployed (Manual Execution Required: "'+c.text+'")'); }
    if(!gp.pending) nextTurn(gp);
  });
};
window.startAttack=function(u){ S.attackPick=u; render(); };
window.cancelAttackPick=function(){ S.attackPick=null; render(); };
window.confirmAttack=async function(defUid){
  const atkUid=S.attackPick; S.attackPick=null;
  await act(r=>{ const gp=r.game; const pid=S.myId;
    if(gp.curIdx!==gp.order.indexOf(pid)) return alert('Not your turn.');
    if(!canAct(gp,atkUid)) return alert('Exceeded maximum acts for current turn cycle.');
    const ok=declareAttack(gp,atkUid,defUid,pid); if(!ok) return alert('Insufficient Resource Coins.');
    if(!gp.pending) nextTurn(gp);
  });
};

window.useAbility=async function(u, idx) {
  await act(r => {
    const gp = r.game;
    const pid = S.myId;
    if (gp.curIdx !== gp.order.indexOf(pid)) return alert('Awaiting opponent action lane.');
    
    const i = gp.inst[u];
    const c = CARDS[i.cid];
    let ab = (c.activated || [])[idx];
    let weaponAb = null;
    
    // Find weapon ability
    if (!ab) {
      (i.wielded || []).forEach(wu => {
        const wc = CARDS[gp.inst[wu].cid];
        (wc.weaponActivated || wc.grantsActivated || []).forEach((a, ai) => {
          if (('w' + wu + ai) === idx) weaponAb = a;
        });
      });
    }
    
    const useAb = ab || weaponAb;
    if (!useAb) return;
    
    if (useAb.cost.tap && !canAct(gp, u)) return alert('Exceeded action parameters.');
    if (useAb.cost.coins && !spendCoins(gp, pid, useAb.cost.coins)) return alert('Insufficient Resource Coins.');
    if (useAb.cost.tap) i.actedCount = (i.actedCount || 0) + 1;
    
    // Handle specific costs
    if (useAb.cost.sacrifice) destroyInstance(gp, u, { skipFortify: true });
    if (useAb.cost.selfDamage) {
        i.hp -= useAb.cost.selfDamage;
        log(gp, CARDS[i.cid].name + ' takes ' + useAb.cost.selfDamage + ' dmg.');
        if (i.hp <= 0) destroyInstance(gp, u);
    }
    
    useAb.run(gp, { pid, src: u });
    if (!gp.pending) nextTurn(gp);
    render(); 
  });
};

/* --- RENDERER --- */
window.render = function() {
  const app = document.getElementById('app');
  if (!S.room) {
    app.innerHTML = `
      <div class="wrap"><div class="center-box">
        <h1>CATACLYSM</h1>
        <div class="field"><label>Username</label><input onchange="S.name=this.value" placeholder="Pilot Name"></div>
        <div class="field"><label>Room</label><input onchange="S.codeInput=this.value" placeholder="Enter Code"></div>
        <button class="btn" onclick="createRoom()">New</button>
        <button class="btn ghost" onclick="joinRoom()">Join</button>
      </div></div>`;
  } else {
    app.innerHTML = `
      <div id="topbar"><div class="code">Room: ${S.code}</div></div>
      <div class="wrap">
        <h2>Game Status: ${S.room.phase}</h2>
        <div id="board"></div>
      </div>`;
  }
};

render();
