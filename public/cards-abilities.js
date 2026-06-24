/* Cataclysm Arcade — per-card ability registry.
   Each entry is keyed by card id and may define any of:
     run            : (gp,ctx) => void   // tactic/response on play
     onEnter        : (gp,ctx) => void   // fighter enters play (ctx.src=uid)
     onDeath        : (gp,ctx) => void   // unit dies
     onAttack       : (gp,ctx) => void   // unit declares attack (ctx.src=attacker)
     onWield        : (gp,ctx) => void   // weapon becomes wielded
     onLevelStart   : (gp,pid)  => void  // start of each level
     onCounterPlaced: (gp,pid)  => void  // any +1 atk counter placed on your team
     onAnyFighterDeath: (gp,uid) => void // any Fighter on the board dies
     activated      : [{ label, cost:{tap,coins,sacrifice,selfDamage}, run(gp,ctx) }]
     dynamicAtkBonus: (gp,uid) => number  // extra Attack on the unit itself
     staticBuff     : (gp,buffedUid,sourceUid) => number  // ally Attack buff
     atkFlags       : { ignoreEnforcer, unblockable, ... }

   Engine helpers available:
     dealDamage(gp,uid,n) healInst(gp,uid,n) destroyInstance(gp,uid,opts)
     drawN(gp,pid,n) spendCoins(gp,pid,n) addCounter(gp,uid,'atk',n)
     pendTarget(gp,{forId,prompt,filter},cb) pendPick(gp,{forId,prompt,options},cb)
     pendDiscardOptional(gp,ctx,prompt,cb) log(gp,msg) shuffle(arr)
     wieldWeapon(gp,w,f) unwieldWeapon(gp,w) moveZone(gp,pid,u,from,to)
     myFighters(gp,pid) eachAlly(gp,pid,cb) eachOpponent(gp,me,cb)
     setTempAtk(gp,uid,n) gainKwLevel(gp,uid,kw) stopAttack(gp)
     fighterTargetFilter() bossOrFighterFilter() opposingFighterFilter(pid)
*/

window.CATA_ABILITIES = {

  // Aha! — Discard a card. Draw two cards.
  'render-mq82m6em': {
    run(gp,ctx){
      pendDiscardOptional(gp,ctx,'Aha!: Discard a card.',(g)=>{drawN(g,ctx.pid,2);});
    }
  },

  // Boom! — Deal 2 damage to target Fighter. You may destroy enhancement → 4 damage.
  'render-mq82pliu': {
    run(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'Boom!: deal damage to which Fighter?',filter:fighterTargetFilter()},(g,t)=>{
        if(!t)return;
        const enhancements=g.p[ctx.pid].board.filter(u=>{const i=g.inst[u];if(!i)return false;const c=CARDS[i.cid];
          if(c&&c.type==='weapon')return true;
          if(i.counters&&i.counters.atk>0)return true;
          return false;
        });
        if(!enhancements.length){dealDamage(g,t,2);return;}
        pendPick(g,{forId:ctx.pid,prompt:'Boom!: destroy an enhancement to deal 4 damage instead of 2?',options:[{label:'Yes — pick enhancement to destroy',value:'y'},{label:'No (deal 2)',value:''}]},(g2,choice)=>{
          if(choice!=='y'){dealDamage(g2,t,2);return;}
          pendPick(g2,{forId:ctx.pid,prompt:'Boom!: which enhancement to destroy?',options:enhancements.map(u=>({label:CARDS[g2.inst[u].cid].name+(g2.inst[u].counters&&g2.inst[u].counters.atk>0?' (+atk counter)':''),value:u}))},(g3,pick)=>{
            if(pick){
              const pi=g3.inst[pick];const pc=CARDS[pi.cid];
              if(pc.type==='weapon')destroyInstance(g3,pick,{skipFortify:true});
              else if(pi.counters&&pi.counters.atk>0){pi.counters.atk-=1;log(g3,'Removed +1 atk counter from '+pc.name+'.');}
              dealDamage(g3,t,4);
            }else{dealDamage(g3,t,2);}
          });
        });
      });
    }
  },

  // Catch! — Deal 4 damage to target Fighter.
  'render-mq82qx7k': {
    run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Catch!: deal 4 damage to which Fighter?',filter:fighterTargetFilter()},(g,t)=>dealDamage(g,t,4));}
  },

  // Decisive Victory — Deal damage to target Fighter equal to # Bosses+Fighters on your team.
  'render-mq82tevl': {
    run(gp,ctx){
      const n=myFighters(gp,ctx.pid).length+(gp.inst[gp.p[ctx.pid].boss]?1:0);
      pendTarget(gp,{forId:ctx.pid,prompt:'Decisive Victory: deal '+n+' damage to which Fighter?',filter:fighterTargetFilter()},(g,t)=>dealDamage(g,t,n));
    }
  },

  // Derail — Destroy all Fighters.
  'render-mq82u1ed': {
    run(gp,ctx){
      const targets=allBoard(gp).filter(u=>gp.inst[u]&&gp.inst[u].kind==='fighter'&&gp.inst[u].hp>0);
      log(gp,'Derail destroys '+targets.length+' Fighter(s).');
      targets.forEach(u=>destroyInstance(gp,u));
    }
  },

  // Emergency Brake — Destroy target Level 2 or lower Fighter.
  'render-mq82xhjm': {
    run(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'Emergency Brake: destroy which Level≤2 Fighter?',filter:i=>i.kind==='fighter'&&((CARDS[i.cid]||{}).level||0)<=2},(g,t)=>destroyInstance(g,t));
    }
  },

  // Flipping Out — Deal 4 damage to up to two different target Bosses or Fighters.
  'render-mq82zkhm': {
    run(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'Flipping Out: deal 4 damage to first target',filter:bossOrFighterFilter()},(g,t1)=>{
        dealDamage(g,t1,4);
        pendTarget(g,{forId:ctx.pid,prompt:'Second target (different) or pass',filter:i=>(i.kind==='fighter'||i.kind==='boss')&&i.uid!==t1},(g2,t2)=>{if(t2)dealDamage(g2,t2,4);});
      });
    }
  },

  // Malefice — Destroy target Weapon. If wielded by a Fighter, deal damage equal to that Weapon's Attack to that Fighter.
  'render-mq8374uc': {
    run(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'Malefice: destroy which Weapon?',filter:i=>(CARDS[i.cid]||{}).type==='weapon'},(g,w)=>{
        const wInst=g.inst[w];const wc=CARDS[wInst.cid];const dmg=wc.atkMod||0;
        const wielder=wInst.wieldedBy;
        destroyInstance(g,w,{skipFortify:true});
        if(wielder&&g.inst[wielder]&&dmg>0){dealDamage(g,wielder,dmg);}
      });
    }
  },

  // Night Vision — All Bosses/Fighters can be attacked as though they don't have Stealthy this level. Draw a card.
  'render-mq83c0e5': {
    run(gp,ctx){gp.ignoreStealthyLevel=true;drawN(gp,ctx.pid,1);log(gp,'Night Vision: Stealthy ignored this level.');}
  },

  // Push — Destroy target Fighter.
  'render-mq83fg9i': {
    run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Push: destroy which Fighter?',filter:fighterTargetFilter()},(g,t)=>destroyInstance(g,t));}
  },

  // Steel Swipe — Deal 2 damage to target Boss or Fighter. If your Boss is a Shifter, deal 3 instead.
  'render-mq83o77a': {
    run(gp,ctx){
      const bossFac=(CARDS[gp.inst[gp.p[ctx.pid].boss].cid]||{}).faction;
      const n=bossFac==='shifter'?3:2;
      pendTarget(gp,{forId:ctx.pid,prompt:'Steel Swipe: deal '+n+' damage to whom?',filter:bossOrFighterFilter()},(g,t)=>dealDamage(g,t,n));
    }
  },

  // Theurgic Thrashing — Deal 3 damage to target Fighter. Target Boss or Fighter heals 3.
  'render-mq83qlgo': {
    run(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'Theurgic Thrashing: deal 3 damage to which Fighter?',filter:fighterTargetFilter()},(g,t)=>{
        dealDamage(g,t,3);
        pendTarget(g,{forId:ctx.pid,prompt:'Heal 3 to which Boss or Fighter?',filter:bossOrFighterFilter()},(g2,h)=>healInst(g2,h,3));
      });
    }
  },

  // Tooth Extraction — Deal 5 damage divided as you choose among any number of targets.
  'render-mq83rb8z': {
    run(gp,ctx){
      const distribute=(g,remaining)=>{
        if(remaining<=0)return;
        pendTarget(g,{forId:ctx.pid,prompt:'Tooth Extraction: deal damage to which Boss/Fighter? ('+remaining+' damage left)',filter:bossOrFighterFilter()},(g2,t)=>{
          if(!t)return;
          const opts=[];for(let i=1;i<=remaining;i++)opts.push({label:i+' damage'+(i===remaining?' (all remaining)':''),value:String(i)});
          opts.push({label:'Stop dividing',value:'0'});
          pendPick(g2,{forId:ctx.pid,prompt:'How much damage to '+(CARDS[g2.inst[t].cid]||{}).name+'? ('+remaining+' left)',options:opts},(g3,v)=>{
            const n=parseInt(v||'0',10);
            if(n<=0)return;
            dealDamage(g3,t,n);
            if(remaining-n>0)distribute(g3,remaining-n);
          });
        });
      };
      distribute(gp,5);
    }
  },

  // Tracker's Frenzy — Deal 1 damage to target Boss or Fighter. If a Fighter left play this level, deal 3 instead.
  'render-mq83rstx': {
    run(gp,ctx){
      const n=gp.fighterLeftThisLevel?3:1;
      pendTarget(gp,{forId:ctx.pid,prompt:'Tracker\u2019s Frenzy: deal '+n+' damage to whom?',filter:bossOrFighterFilter()},(g,t)=>dealDamage(g,t,n));
    }
  },

  // Undertowed — Destroy target Fighter with 4 or more Health.
  'render-mq83tec6': {
    run(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'Undertowed: destroy which Fighter (4+ HP)?',filter:i=>i.kind==='fighter'&&(gp.inst[i.uid].hp>=4)},(g,t)=>destroyInstance(g,t));
    }
  },

  // Voltage Snap — 2 damage to target. 3 instead if it's Synth or Survivor.
  'render-mq83upm0': {
    run(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'Voltage Snap: deal damage to whom?',filter:bossOrFighterFilter()},(g,t)=>{
        const f=(CARDS[g.inst[t].cid]||{}).faction;
        const n=(f==='synth'||f==='survivor')?3:2;
        dealDamage(g,t,n);
      });
    }
  },

  // Screech! — Deal damage to target Fighter equal to the greatest Health among Fighters on your team.
  'render-mq83jdqz': {
    run(gp,ctx){
      const maxHp=myFighters(gp,ctx.pid).reduce((m,u)=>Math.max(m,gp.inst[u].hp),0);
      pendTarget(gp,{forId:ctx.pid,prompt:'Screech: deal '+maxHp+' damage to which Fighter?',filter:fighterTargetFilter()},(g,t)=>dealDamage(g,t,maxHp));
    }
  },

  // Best Offense — Deal damage to target Boss/Fighter equal to greatest Health among Fighters on your team.
  'render-mq82ns08': {
    run(gp,ctx){
      const maxHp=myFighters(gp,ctx.pid).reduce((m,u)=>Math.max(m,gp.inst[u].hp),0);
      pendTarget(gp,{forId:ctx.pid,prompt:'Best Offense: deal '+maxHp+' damage to whom?',filter:bossOrFighterFilter()},(g,t)=>dealDamage(g,t,maxHp));
    }
  },

  // Autopilot — Wield up to one of your Weapons to target Fighter. Draw a card.
  'render-mq82n30v': {
    run(gp,ctx){
      const myWeapons=gp.p[ctx.pid].board.filter(u=>gp.inst[u]&&!gp.inst[u].wieldedBy&&CARDS[gp.inst[u].cid].type==='weapon');
      const myF=myFighters(gp,ctx.pid);
      if(myWeapons.length&&myF.length){
        pendPick(gp,{forId:ctx.pid,prompt:'Autopilot: pick a Weapon to wield (or skip)',options:myWeapons.map(w=>({label:CARDS[gp.inst[w].cid].name,value:w})).concat([{label:'Skip',value:''}])},(g,wPick)=>{
          if(wPick){pendTarget(g,{forId:ctx.pid,prompt:'Wield to which Fighter?',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(g2,f)=>{wieldWeapon(g2,wPick,f);drawN(g2,ctx.pid,1);});}
          else drawN(g,ctx.pid,1);
        });
      } else drawN(gp,ctx.pid,1);
    }
  },

  // Cache Money — You gain ③.
  'render-mq82qaar': {run(gp,ctx){gp.p[ctx.pid].coins+=3;log(gp,gp.p[ctx.pid].name+' gains ③.');}},

  // Echo Fade — Put two -1 Attack counters on target Fighter.
  'render-mq82w5xo': {
    run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Echo Fade: put -2 atk on which Fighter?',filter:fighterTargetFilter()},(g,t)=>addCounter(g,t,'atk',-2));}
  },

  // Evanesce — Destroy up to one target Weapon. Draw a card.
  'render-mq82xttd': {
    run(gp,ctx){
      const weapons=allBoard(gp).filter(u=>(CARDS[gp.inst[u].cid]||{}).type==='weapon');
      if(weapons.length){pendPick(gp,{forId:ctx.pid,prompt:'Evanesce: destroy a Weapon? (or skip)',options:weapons.map(w=>({label:CARDS[gp.inst[w].cid].name,value:w})).concat([{label:'Skip',value:''}])},(g,wPick)=>{if(wPick)destroyInstance(g,wPick,{skipFortify:true});drawN(g,ctx.pid,1);});}
      else drawN(gp,ctx.pid,1);
    }
  },

  // Full Heal! — Heal all Fighters on your team to maximum.
  'render-mq830569': {
    run(gp,ctx){myFighters(gp,ctx.pid).forEach(u=>{const i=gp.inst[u];i.hp=i.maxHp;});log(gp,'All Fighters on '+gp.p[ctx.pid].name+'\u2019s team fully healed.');}
  },

  // Mister Purple — Response ②⊙: Your team heals 1.  (Activated)
  'render-mq839hev': {
    activated:[{label:'② Heal team 1',cost:{tap:true,coins:2},run(gp,ctx){eachAlly(gp,ctx.pid,u=>healInst(gp,u,1));}}]
  },

  // RATS! — Put +1 Attack counter on up to 3 target Fighters on your team.
  'render-mq83grxa': {
    run(gp,ctx){
      const pick1=(g,n)=>{
        if(n===0)return;
        const mine=myFighters(g,ctx.pid);
        if(!mine.length)return;
        pendTarget(g,{forId:ctx.pid,prompt:'RATS!: +1 atk to which of your Fighters? ('+n+' remaining)',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(g2,t)=>{if(t){addCounter(g2,t,'atk',1);pick1(g2,n-1);}});
      };
      pick1(gp,3);
    }
  },

  // Rope-a-Dope — Target B/F gains 2 Health. Target B/F gains +3 Attack this level.
  'render-mq83hfj9': {
    run(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'Rope-a-Dope: +2 Health to whom?',filter:bossOrFighterFilter()},(g,t1)=>{
        gainHealth(g,t1,2);
        pendTarget(g,{forId:ctx.pid,prompt:'Rope-a-Dope: +3 Attack this level to whom?',filter:bossOrFighterFilter()},(g2,t2)=>setTempAtk(g2,t2,3));
      });
    }
  },

  // Scrap Shield — Stop target Boss or Fighter's attack.
  'render-mq83io9y': {run(gp,ctx){stopAttack(gp);log(gp,'Scrap Shield: attack stopped.');}},

  // Sharp Reflexes — Stop attack. Deal 2 damage to that B/F.
  'render-mq83kb5b': {
    run(gp,ctx){
      const tgt=gp.pendingAttack&&gp.pendingAttack.attacker;
      stopAttack(gp);
      if(tgt&&gp.inst[tgt])dealDamage(gp,tgt,2);
    }
  },

  // Signal Jam — Change the target of a Tactic or Response with one target.
  'render-mq83kyb0': {run(gp,ctx){log(gp,'Signal Jam: change target manually (GM panel for redirect).');}},

  // Sludged — Put target attacking Fighter on top of its owner's deck.
  'render-mq83mwwt': {
    run(gp,ctx){
      const a=gp.pendingAttack&&gp.pendingAttack.attacker;
      if(a&&gp.inst[a]){const i=gp.inst[a];moveZone(gp,i.owner,a,'board','deck-top');log(gp,CARDS[i.cid].name+' returned to top of deck.');stopAttack(gp);}
    }
  },

  // Stay Hydrated — Target Boss or Fighter gains 2 Health.
  'render-mq83o5fa': {
    run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Stay Hydrated: +2 Health to whom?',filter:bossOrFighterFilter()},(g,t)=>gainHealth(g,t,2));}
  },

  // Free Vector — When dies, draw a card.
  'DS1-023': {onDeath(gp,ctx){drawN(gp,ctx.pid,1);}},

  // Intersentinel — At start of each level, your Boss heals 1.
  'DS1-030': {onLevelStart(gp,pid){const b=gp.p[pid].boss;if(b)healInst(gp,b,1);}},

  // Astuta, Signal Savant — Other Survivor Fighters on your team get +1 Attack.
  'render-mq82mtls': {
    staticBuff(gp,buffUid,srcUid){
      const buffI=gp.inst[buffUid];const srcI=gp.inst[srcUid];
      if(!buffI||!srcI||buffUid===srcUid)return 0;
      if(buffI.owner!==srcI.owner)return 0;
      const bc=CARDS[buffI.cid];if(!bc||bc.type!=='fighter'||bc.faction!=='survivor')return 0;
      return 1;
    }
  },

  // Calamity Blaque — When enters, +1 atk counter on up to 2 target Fighters on your team.
  'render-mq82qb03': {
    onEnter(gp,ctx){
      const pick=(g,n)=>{if(n===0)return;pendTarget(g,{forId:ctx.pid,prompt:'Calamity: +1 atk to a Fighter? ('+n+' left)',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(g2,t)=>{if(t){addCounter(g2,t,'atk',1);pick(g2,n-1);}});};
      pick(gp,2);
    }
  },

  // Chip, Killswitch — Activated: ②⊙, Destroy Chip: Destroy target Fighter.
  'render-mq82rj1b': {
    activated:[{label:'② Destroy: nuke a Fighter',cost:{tap:true,coins:2,sacrifice:true},run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Chip: destroy which Fighter?',filter:fighterTargetFilter()},(g,t)=>destroyInstance(g,t));}}]
  },

  // Chirp, Teammate — ②⊙: Put two +1 atk counters on target Survivor Fighter.
  'render-mq82rkj2': {
    activated:[{label:'② +2 atk to Survivor',cost:{tap:true,coins:2},run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Chirp: +2 atk to which Survivor?',filter:i=>i.kind==='fighter'&&(CARDS[i.cid]||{}).faction==='survivor'&&i.owner===ctx.pid},(g,t)=>addCounter(g,t,'atk',2));}}]
  },

  // Constance — When enters play, gains 1 Health for each other Fighter on your team.
  'render-mq82smh7': {
    onEnter(gp,ctx){const n=myFighters(gp,ctx.pid).filter(u=>u!==ctx.src).length;if(n>0)gainHealth(gp,ctx.src,n); else log(gp,'Constance gains no Health (no other Fighters).');}
  },

  // Eliza, Do Little — +2 Attack as long as you have a Shifter on your team.
  'render-mq82x31a': {
    dynamicAtkBonus(gp,uid){const i=gp.inst[uid];if(!i)return 0;const hasShifter=(gp.p[i.owner].board.concat([gp.p[i.owner].boss])).some(u=>u&&gp.inst[u]&&(CARDS[gp.inst[u].cid]||{}).faction==='shifter');return hasShifter?2:0;}
  },

  // EVee — Other Survivors on your team cost ① less to attack.
  'render-mq82xys2': {
    /* Engine note: attack cost is read from c.atkCost at declareAttack — we patch by listening for atkCost calc */
    // The engine doesn't expose a pluggable atkCost hook today. Leave as informational, GM-adjust coins manually if needed.
    _info: 'Other Survivor allies pay ① less to attack (manual via GM panel).'
  },

  // Face of Death — Whenever the wielder defeats a Fighter, untap them.
  'render-mq82yd7b': {
    onWielderDealtDamage(gp,uid,dmg){/* engine fires this hook; we use the defeat path elsewhere */}
    /* simpler: just expose atkMod (+1) and let users manually untap via GM if needed for now */
  },

  // Fishhooks — Enforcer (kw already auto-tagged). When enters, +1 atk to all opposing Fighters.
  // Card text: "Enforcer (...). When Fishhooks enters play, opposing Fighters gain +1 Attack this level."
  // (interpretation may vary)
  'render-mq82yuv1': {
    onEnter(gp,ctx){
      eachOpponent(gp,ctx.pid,oppPid=>{
        gp.p[oppPid].board.filter(u=>gp.inst[u]&&gp.inst[u].kind==='fighter').forEach(u=>setTempAtk(gp,u,1));
      });
    }
  },

  // Gates, Supportive Sensei — When enters, another target B/F gets +2 Attack this level.
  'render-mq830owo': {
    onEnter(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Gates: +2 Attack this level to whom?',filter:i=>(i.kind==='fighter'||i.kind==='boss')&&i.uid!==ctx.src},(g,t)=>setTempAtk(g,t,2));}
  },

  // Goodstead, Sandhog — Whenever a Fighter dies, +1 atk counter on Goodstead.
  'render-mq8327ej': {
    onAnyFighterDeath(gp,myUid){addCounter(gp,myUid,'atk',1);}
  },

  // Gordo, Collector — When enters, if a Fighter on your team died this level, deal 2 damage to target B/F.
  'render-mq832cs4': {
    onEnter(gp,ctx){if(gp.fighterLeftThisLevel){pendTarget(gp,{forId:ctx.pid,prompt:'Gordo: deal 2 damage to whom?',filter:bossOrFighterFilter()},(g,t)=>dealDamage(g,t,2));}}
  },

  // Hard Knox — When enters, destroy target opposing Fighter with 2 or less Health.
  'render-mq832yx4': {
    onEnter(gp,ctx){
      const targets=allBoard(gp).filter(u=>{const i=gp.inst[u];return i&&i.kind==='fighter'&&i.owner!==ctx.pid&&i.hp<=2;});
      if(targets.length){pendTarget(gp,{forId:ctx.pid,prompt:'Hard Knox: destroy opposing Fighter (≤2 HP)?',filter:i=>i.kind==='fighter'&&i.owner!==ctx.pid&&gp.inst[i.uid].hp<=2},(g,t)=>destroyInstance(g,t));}
    }
  },

  // Jacked Hammer — Weapon, "The wielder gets +1 Attack" (atkMod handles via cards-data).
  'render-mq833z75': {/* atkMod:1 already in data */},

  // Joe Strummage — When enters, each player discards a card. Joe can only attack if you have a Fighter with 5+ HP. (latter manual)
  'render-mq8347x5': {
    onEnter(gp,ctx){
      gp.order.forEach(pid=>{if(!gp.p[pid].defeated&&gp.p[pid].hand.length)pendDiscardOptional(gp,{pid},gp.p[pid].name+': discard a card (Joe Strummage)',()=>{});});
    }
  },

  // Knap, Forgemaster — Response ②⊙: Unwield target Weapon; if it's your Weapon, draw a card.
  'render-mq834zdf': {
    activated:[{label:'② Unwield a Weapon',cost:{tap:true,coins:2},run(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'Knap: which Weapon to unwield?',filter:i=>(CARDS[i.cid]||{}).type==='weapon'&&gp.inst[i.uid].wieldedBy},(g,w)=>{
        const wInst=g.inst[w];const owner=wInst.owner;
        unwieldWeapon(g,w);
        log(g,CARDS[wInst.cid].name+' unwielded.');
        if(owner===ctx.pid)drawN(g,ctx.pid,1);
      });
    }}]
  },

  // Mumbly Peg — When enters, choose opponent; that opponent discards a card.
  'render-mq83arej': {
    onEnter(gp,ctx){
      const opps=gp.order.filter(pid=>pid!==ctx.pid&&!gp.p[pid].defeated);
      if(!opps.length)return;
      if(opps.length===1){pendDiscardOptional(gp,{pid:opps[0]},'Mumbly Peg: '+gp.p[opps[0]].name+', discard a card.',()=>{});}
      else pendPick(gp,{forId:ctx.pid,prompt:'Mumbly Peg: which opponent discards?',options:opps.map(p=>({label:gp.p[p].name,value:p}))},(g,pid)=>pendDiscardOptional(g,{pid},gp.p[pid].name+': discard a card',()=>{}));
    }
  },

  // Murder Countess — When enters, deal 1 damage to up to 2 different target B/F.
  'render-mq83be2z': {
    onEnter(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'Murder Countess: 1 damage to whom?',filter:bossOrFighterFilter()},(g,t1)=>{
        if(t1)dealDamage(g,t1,1);
        pendTarget(g,{forId:ctx.pid,prompt:'Second target (different) or skip',filter:i=>(i.kind==='fighter'||i.kind==='boss')&&i.uid!==t1},(g2,t2)=>{if(t2)dealDamage(g2,t2,1);});
      });
    }
  },

  // Oriana, Cutthroat — Whenever a player discards, Oriana deals 1 damage to target B/F.
  // Note: discard hook isn't wired globally yet. Documented for next pass.
  'render-mq83cnrg': {_info:'Triggers on any discard \u2014 manual prompt fallback for now.'},

  // Phern, Battle Ready — When enters, look at top 4 of deck; may reveal Tactic/Response cost ≤3 and put in hand; rest on bottom in random order. If you don't, +1 atk on Phern.
  'render-mq83djn0': {
    onEnter(gp,ctx){
      const deck=gp.p[ctx.pid].deck;
      const top=deck.slice(0,4);
      const eligible=top.filter(u=>{const c=CARDS[gp.inst[u].cid];return c&&(c.type==='tactic'||c.type==='response')&&(c.cost||0)<=3;});
      if(eligible.length){
        pendPick(gp,{forId:ctx.pid,prompt:'Phern: reveal a Tactic/Response (cost ≤3) to your hand?',options:eligible.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})).concat([{label:'Skip (+1 atk on Phern)',value:''}])},(g,pick)=>{
          if(pick){g.p[ctx.pid].deck=g.p[ctx.pid].deck.filter(x=>x!==pick);g.p[ctx.pid].hand.push(pick);log(g,'Phern reveals '+CARDS[g.inst[pick].cid].name+' to hand.');
            const rest=top.filter(x=>x!==pick);g.p[ctx.pid].deck=g.p[ctx.pid].deck.filter(x=>!rest.includes(x)).concat(shuffle(rest));}
          else{addCounter(g,ctx.src,'atk',1);g.p[ctx.pid].deck=g.p[ctx.pid].deck.filter(x=>!top.includes(x)).concat(shuffle(top));}
        });
      } else {addCounter(gp,ctx.src,'atk',1);log(gp,'Phern: no eligible card \u2014 +1 atk on Phern.');gp.p[ctx.pid].deck=gp.p[ctx.pid].deck.filter(x=>!top.includes(x)).concat(shuffle(top));}
    }
  },

  // ProX — ⊙: You gain ①. (Activated, free tap)
  'render-mq83fg5f': {
    activated:[{label:'⊙ Gain ①',cost:{tap:true},run(gp,ctx){gp.p[ctx.pid].coins+=1;log(gp,gp.p[ctx.pid].name+' gains ①.');}}]
  },

  // Shiner, The Unruly — +1 Attack for each Weapon she is wielding.
  'render-mq83kyg7': {
    dynamicAtkBonus(gp,uid){const i=gp.inst[uid];return((i&&i.wielded)||[]).filter(w=>gp.inst[w]).length;}
  },

  // Spot, Weaponhound — When enters, look at top 4; may reveal a Weapon to hand; rest bottom random. If no Weapon, +1 atk on Spot.
  'render-mq83mxj8': {
    onEnter(gp,ctx){
      const deck=gp.p[ctx.pid].deck;const top=deck.slice(0,4);
      const weapons=top.filter(u=>(CARDS[gp.inst[u].cid]||{}).type==='weapon');
      if(weapons.length){
        pendPick(gp,{forId:ctx.pid,prompt:'Spot: reveal a Weapon to your hand?',options:weapons.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})).concat([{label:'Skip (+1 atk on Spot)',value:''}])},(g,pick)=>{
          if(pick){g.p[ctx.pid].deck=g.p[ctx.pid].deck.filter(x=>x!==pick);g.p[ctx.pid].hand.push(pick);log(g,'Spot reveals '+CARDS[g.inst[pick].cid].name+'.');
            const rest=top.filter(x=>x!==pick);g.p[ctx.pid].deck=g.p[ctx.pid].deck.filter(x=>!rest.includes(x)).concat(shuffle(rest));}
          else{addCounter(g,ctx.src,'atk',1);g.p[ctx.pid].deck=g.p[ctx.pid].deck.filter(x=>!top.includes(x)).concat(shuffle(top));}
        });
      } else {addCounter(gp,ctx.src,'atk',1);gp.p[ctx.pid].deck=gp.p[ctx.pid].deck.filter(x=>!top.includes(x)).concat(shuffle(top));}
    }
  },

  // Squatch — +1 atk vs Mystics; Mystics get -1 atk attacking him. (latter is harder; document)
  'render-mq83niqy': {

  },

  // Tube Steak — Response ⊙: Block. (Keyword Block already automated; activated keyword is metadata only.)
  'render-mq83t4ah': {},

  // Turner — When enters, +1 atk counter on target Survivor Fighter.
  'render-mq83t4ak': {
    onEnter(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Turner: +1 atk on which Survivor Fighter?',filter:i=>i.kind==='fighter'&&(CARDS[i.cid]||{}).faction==='survivor'},(g,t)=>addCounter(g,t,'atk',1));}
  },

  // Vigo the Sharp — +1 Attack per player that discarded a card this level. (Tracker fallback: counts current grave moves.)
  'render-mq83unlz': {
    /* not currently tracked per-player-per-level; manual via GM if it matters */
    _info:'Per-player discard tracking not in engine \u2014 use GM panel to add atk if needed.'
  },

  // Whump! token — dies at end of level (already keyword diesEndOfLevel via card data).
  'render-mq83vajo': {/* engine handles via diesEndOfLevel? — actually no, that's a separate flag; add via static */
    _info:'Token; dies at end of level via GM clear or manually.'
  },

  // Zanni — can't be attacked. Response ①⊙: Block.
  'render-mq83wcyl': {
    /* "can't be attacked" is a target-filter rule; engine currently doesn't filter "untargetable" cards.
       For now, the Block keyword auto-tag will let players intercept attacks via the existing Block helper. */
    _info:'Can\u2019t-be-attacked rule needs target-filter extension \u2014 next pass.'
  },

  // 'Lique, Clockwork Hunter — enters with two +1 atk counters; at start of each level remove one.
  'render-mq83wg7d': {
    onEnter(gp,ctx){const i=gp.inst[ctx.src];i.counters=i.counters||{};i.counters.atk=(i.counters.atk||0)+2;log(gp,'\u2018Lique enters with two +1 Attack counters.');},
    onLevelStart(gp,pid){gp.p[pid].board.forEach(u=>{const i=gp.inst[u];if(i&&i.cid==='render-mq83wg7d'&&i.counters&&i.counters.atk>0){i.counters.atk-=1;log(gp,'\u2018Lique loses a +1 Attack counter.');}});}
  },

  // Coney, Toothfighter — Armor 1 (already auto); When enters, +1 atk on a Survivor Fighter (assumed)
  // Card text not fully shown; safe stub:
  'render-mq82se55': {_info:'Armor 1 auto-applied; ability text needs verification.'},

  // Dreyver, Terminarch — When attacks, you may pay ① to deal 1 damage to target B/F (sketch).
  // Without exact text confirmed, leaving as informational.

    // Murkgod Pendant (atkMod 0), Sky Axe Restored (atkMod 2), Swiftpack (Agility kw),
  // Swiftpack 1999 (Agility kw, +2 atkMod), Effin' Slingshot (+1), all auto via cards-data.js fields.
  // Dog-Eared Passage, Data Spike, Blast Scanner, Sword from Nowhere — complex, next pass.

};

Object.assign(window.CATA_ABILITIES, {

  // Blades, Triumphant — When attacks, if 3+ Fighters, draw a card. ④⊙: look at top 4, may play one.
  'render-mq82ocja': {
    onAttack(gp,ctx){if(myFighters(gp,ctx.pid).length>=3)drawN(gp,ctx.pid,1);},
    activated:[{label:'④ Look at top 4',cost:{tap:true,coins:4},run(gp,ctx){
      const top=gp.p[ctx.pid].deck.slice(0,4);
      if(!top.length)return;
      pendPick(gp,{forId:ctx.pid,prompt:'Blades: play one of top 4? (cost still applies)',options:top.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})).concat([{label:'Skip',value:''}])},(g,pick)=>{
        if(pick){g.p[ctx.pid].deck=g.p[ctx.pid].deck.filter(x=>x!==pick);g.p[ctx.pid].hand.push(pick);log(g,'Revealed '+CARDS[g.inst[pick].cid].name+' to hand (cost applies on play).');}
        bottomShuffle(g,ctx.pid,top.filter(x=>x!==pick));
      });
    }}]
  },

  // Charlotte, Nightbringer — When defeats Fighter, may remove linked. (Linked-fighter mechanic complex — log + GM.)
  'render-mq82qy7i': {
    _info:'On defeat: link Fighter to Charlotte (use GM panel to track linked units).'
  },

  // Eff with me Ammo — Agility while you have a Rat. ②⊙: Create Head Rat token.
  'render-mq82wdi3': {
    dynamicAtkBonus(gp,uid){return 0;}, /* placeholder, real effect is Agility — handled below via instSummary */
    onLevelStart(gp,pid){
      const b=gp.p[pid].boss;if(!b)return;
      const i=gp.inst[b];const hasRat=gp.p[pid].board.some(u=>(CARDS[gp.inst[u].cid]||{}).name==='Head Rat');
      i._gainedKw=i._gainedKw||{};if(hasRat)i._gainedKw['Agility']=gp.level;else delete i._gainedKw['Agility'];
    },
    activated:[{label:'② Create Head Rat',cost:{tap:true,coins:2},run(gp,ctx){createToken(gp,ctx.pid,'render-mq833gl9');}}]
  },

  // Mon-Sewer Mayhem — Attack = # cards in hand. ②⊙: Reveal until Weapon, put in hand, rest bottom random.
  'render-mq839jkk': {
    dynamicAtk(gp,uid){const i=gp.inst[uid];return gp.p[i.owner].hand.length;},
    activated:[{label:'② Search for Weapon',cost:{tap:true,coins:2},run(gp,ctx){
      const deck=gp.p[ctx.pid].deck;const skipped=[];let found=null;
      while(deck.length){const u=deck.shift();const c=CARDS[gp.inst[u].cid];if(c&&c.type==='weapon'){found=u;break;}skipped.push(u);}
      gp.p[ctx.pid].deck=shuffle(deck.concat(skipped));
      if(found){gp.p[ctx.pid].hand.push(found);log(gp,'Mon-Sewer reveals '+CARDS[gp.inst[found].cid].name+' to hand.');}
      else log(gp,'Mon-Sewer: no Weapon found.');
    }}]
  },

  // Mother May Eye — +1 Atk per Tactic/Response played this level. ⊙: top card of deck revealed; may play T/R from top.
  'render-mq83a3v4': {
    dynamicAtkBonus(gp,uid){const i=gp.inst[uid];return(gp._trPlayed&&gp._trPlayed[i.owner])||0;},
    onLevelStart(gp,pid){gp._trPlayed=gp._trPlayed||{};gp._trPlayed[pid]=0;},
    activated:[{label:'⊙ Reveal top, play T/R',cost:{tap:true},run(gp,ctx){
      const top=gp.p[ctx.pid].deck[0];if(!top)return;
      log(gp,'Mother May Eye reveals '+CARDS[gp.inst[top].cid].name+' from top — playable as T/R if applicable.');
    }}]
  },

  // Seeya, Later Gator — can't be attacked if 5+ Fighters. First attack each level reveals top of deck; if Fighter, put in hand.
  'render-mq83jdnu': {
    _info:'Untargetable when 5+ Fighters \u2014 use GM panel to enforce.'
  },

  // Sky, Unlikely Champion — When attacked, gains Agility this level. Atk cost -1 per Survivor.
  'render-mq83m92b': {
    onAttacked(gp,ctx){
      const i=gp.inst[ctx.src];if(!i)return;
      i.agilityLevel=true;
      log(gp,'Sky gains Agility this level (attacked).');
    }
  },

  // Tantrum, World Ender — can't be attacked if Whump! exists. ③⊙ + 1 self-dmg: create Whump!.
  'render-mq83ph11': {
    activated:[{label:'③ +1 self-dmg: Create Whump!',cost:{tap:true,coins:3,selfDamage:1},run(gp,ctx){createToken(gp,ctx.pid,'render-mq83vajo');}}]
  },

  // The Decommissioner — When attacks, may discard; if so deal 2 dmg to target Fighter. ③⊙: return Synth Fighter from discard to play.
  'render-mq83q46m': {
    onAttack(gp,ctx){
      if(!gp.p[ctx.pid].hand.length)return;
      pendDiscardOptional(gp,{pid:ctx.pid},'Decommissioner: discard a card → 2 damage to target Fighter?',(g,v)=>{
        if(v)pendTarget(g,{forId:ctx.pid,prompt:'Deal 2 damage to which Fighter?',filter:fighterTargetFilter()},(g2,t)=>dealDamage(g2,t,2));
      });
    },
    activated:[{label:'③ Return Synth from discard',cost:{tap:true,coins:3},run(gp,ctx){
      const synthFighters=gp.p[ctx.pid].grave.filter(u=>{const c=CARDS[gp.inst[u].cid];return c&&c.type==='fighter'&&c.faction==='synth';});
      if(!synthFighters.length){log(gp,'No Synth Fighter in discard.');return;}
      pendPick(gp,{forId:ctx.pid,prompt:'Decommissioner: which Synth Fighter to return?',options:synthFighters.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},(g,pick)=>{
        if(pick){moveZone(g,ctx.pid,pick,'grave','board');resetInstance(g,pick);fireOnEnter(g,pick,ctx.pid);}
      });
    }}]
  },

  // Toolshed — Whenever Weapon enters play, may pay ① to draw. ③⊙: Create Toolbox token, may wield to it.
  'render-mq83r7oj': {
    onWeaponEnter(gp,ctx){if(gp.p[ctx.pid].coins>=1){pendPick(gp,{forId:ctx.pid,prompt:'Toolshed: pay ① to draw a card?',options:[{label:'Yes',value:'y'},{label:'No',value:''}]},(g,v)=>{if(v){g.p[ctx.pid].coins-=1;drawN(g,ctx.pid,1);}});}},
    activated:[{label:'③ Create Toolbox',cost:{tap:true,coins:3},run(gp,ctx){createToken(gp,ctx.pid,'render-mq83qps3');}}]
  },

  // Trapper, Hunter of the Pack — Start of level, draw extra if hand empty. ②⊙: Create Bear Trap token.
  'render-mq83rwrb': {
    onLevelStart(gp,pid){if(gp.p[pid].hand.length===0)drawN(gp,pid,1);},
    activated:[{label:'② Create Bear Trap',cost:{tap:true,coins:2},run(gp,ctx){createToken(gp,ctx.pid,'render-mq82noow');}}]
  },

  // Tryp, Timelost — Whenever you discard 1+ cards, deal 1 dmg to all opposing B/F. When attacks, may discard.
  'render-mq83siwj': {
    onAttack(gp,ctx){if(gp.p[ctx.pid].hand.length)pendDiscardOptional(gp,{pid:ctx.pid},'Tryp attacks: discard a card?',()=>{});},
    /* Cross-trigger on any discard: we'll fire from pendDiscardOptional callback path via _info note */
    _info:'On any discard \u2192 1 dmg to all opposing B/F (manual via GM or future hook).'
  },

  // Blast Scanner — When wielded, stun target opposing Fighter.
  'render-mq82od0q': {
    onWield(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Blast Scanner: stun which opposing Fighter?',filter:opposingFighterFilter(ctx.pid)},(g,t)=>{stunInstance(g,t);});}
  },

  // Data Spike — Enters with charge counter. Wielder dies → +charge counter. Wielder gets +1 atk per charge.
  'render-mq82szo4': {
    onWield(gp,ctx){const i=gp.inst[ctx.src];i.counters=i.counters||{};i.counters.charge=(i.counters.charge||0)+1;log(gp,'Data Spike enters with a charge counter.');},
    /* The +1 per charge is on the WIELDER not the weapon — applied via dynamic check below */
  },

  // Dog-Eared Passage — When wielded, wielder gains Stealthy this level. Whenever wielder attacks, draw a card.
  'render-mq82uuz1': {
    onWield(gp,ctx){const holder=gp.inst[ctx.src].wieldedBy;if(holder)gainKwLevel(gp,holder,'Stealthy');},
    onWielderDealtDamage(gp,wielderUid,dmg){drawN(gp,gp.inst[wielderUid].owner,1);}
  },

  // Effin' Slingshot — Reduce wielder's Attack Cost by ①. (atkMod:1 already used as atk bonus per data; cost-reduction needs engine hook → manual.)
  'render-mq82wrmk': {_info:'Reduces wielder Attack Cost by ① (manual via GM coins).'},

  // Gauntlet of the Dead — When wielder attacks, reveal top of deck; may play it (cost applies).
  'render-mq83191n': {
    onWielderAttack(gp,wielderUid){
      const pid=gp.inst[wielderUid].owner;const top=gp.p[pid].deck[0];if(!top)return;
      log(gp,'Gauntlet reveals '+CARDS[gp.inst[top].cid].name+' \u2014 may play it (cost applies).');
    }
  },

  // Makeshift Shield — Wielder has Armor 1 and Block. (Both keywords; auto-applied via cards-data flags.)
  'render-mq836yg3': {/* keywords auto-detected from text */},

  // Marrowpiercer — Whenever wielder deals attack damage, this Fighter or your Boss heals equal to damage.
  'render-mq837klg': {
    onWielderDealtDamage(gp,wielderUid,dmg){const pid=gp.inst[wielderUid].owner;
      pendPick(gp,{forId:pid,prompt:'Marrowpiercer: heal which by '+dmg+'?',options:[{label:'This Fighter',value:wielderUid},{label:'Your Boss',value:gp.p[pid].boss}]},(g,pick)=>{if(pick&&g.inst[pick])healInst(g,pick,dmg);});
    }
  },

  // Mayhem Fist — +1 Attack per Survivor Fighter on your team. Increases wielder's Attack Cost by ①.
  'render-mq83879t': {
    /* Bonus via wielder's dynamicAtkBonus is awkward to wire from weapon; we use a static-buff-like hook on wielder via wieldedBy lookup */
    _info:'Wielder +1 Atk per Survivor Fighter; +① Atk Cost (manual coin adj).'
  },

  // Murkgod Pendant — Wielder gains ②: Transform.
  'render-mq83bebv': {
    weaponActivated:[{label:'② Transform',cost:{tap:true,coins:2,sacrifice:true},run(gp,ctx){transformInstance(gp,ctx.src);}}]
  },

  // Sky Axe, Restored — vanilla weapon (atkMod already in data: +2).
  'render-mq83lly5': {/* no rules text beyond wield instruction */},

  // Swiftpack — Wielder has Agility (keyword auto-detected → Agility kw on weapon, so wielder gets it via hasWieldedAgility).
  'render-mq83oqvm': {/* Agility kw already on card */},

  // Swiftpack 1999 — Wielder has Agility + Response ①⊙: Block.
  'render-mq83osng': {/* keywords already auto */},

  // Sword from Nowhere — Wielder +X Attack = # Tactic/Response in discard. ②, destroy: return T/R from discard.
  'render-mq83pdq7': {

    weaponActivated:[{label:'② Destroy: return T/R from discard',cost:{tap:true,coins:2,sacrifice:true},run(gp,ctx){
      const trs=gp.p[ctx.pid].grave.filter(u=>{const c=CARDS[gp.inst[u].cid];return c&&(c.type==='tactic'||c.type==='response');});
      if(!trs.length){log(gp,'No T/R in discard.');return;}
      pendPick(gp,{forId:ctx.pid,prompt:'Sword from Nowhere: return which to hand?',options:trs.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},(g,pick)=>{if(pick){moveZone(g,ctx.pid,pick,'grave','hand');log(g,CARDS[g.inst[pick].cid].name+' returned to hand.');}});
    }}]
  },

  // Whiskers of the Ancient — Wielder attacks → becomes faction of your choice this level; +1 atk per faction on team.
  'render-mq83v8ob': {
    onWielderAttack(gp,uid,defUid){
      const wielder=gp.inst[uid];if(!wielder)return;
      const factions=['synth','mystic','shifter','survivor','apex'];
      pendPick(gp,{forId:wielder.owner,prompt:'Whiskers: wielder becomes which faction this attack?',
        options:factions.map(f=>({label:f.charAt(0).toUpperCase()+f.slice(1),value:f}))},
        (g,fac)=>{const w=g.inst[uid];if(w){w.tempFaction=fac;log(g,CARDS[w.cid].name+' becomes '+fac+' this attack.');}});
    }
  },

  // Ada, Relict Fighter — +1 atk per enhanced B/F on your team. Response ②: Fortify.
  'render-mq82m6zt': {
    dynamicAtkBonus(gp,uid){
      const i=gp.inst[uid];if(!i)return 0;let n=0;
      eachAlly(gp,i.owner,u=>{const ai=gp.inst[u];if(!ai)return;
        const isEnhanced=(ai.counters&&(ai.counters.atk>0||ai.maxHp>(CARDS[ai.cid]||{}).hp))||(ai.wielded&&ai.wielded.length);
        if(isEnhanced&&u!==uid)n++;
      });
      return n;
    }

  },

  // Ahna, Demodulator — Bosses/Fighters that deal damage to Ahna become stunned (and don't unstun next level).
  'render-mq82mt2o': {

    onDamaged(gp,uid,sourceUid){if(sourceUid&&gp.inst[sourceUid])stunInstance(gp,sourceUid);},
    activated:[{label:'② Stun Fighter',cost:{tap:true,coins:2},run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Ahna: stun which Fighter?',filter:fighterTargetFilter()},(g,t)=>{stunInstance(g,t);});}}]
  },

  // Axel, Deathracer — Phantasmal → Agility. ①: Phantasmal.
  'render-mq82n695': {
    activated:[{label:'① Become Phantasmal',cost:{coins:1},run(gp,ctx){const i=gp.inst[ctx.src];if(!i.phantasmal){i.phantasmal=true;i.counters=i.counters||{};i.counters.atk=(i.counters.atk||0)+1;log(gp,'Axel becomes Phantasmal (+1 atk counter).');gainKwLevel(gp,ctx.src,'Agility');}}}]
  },

  // Bear Trap (token) — Enforcer + when dies from attack, 1 dmg to attacker.
  'render-mq82noow': {
    onDeath(gp,ctx){if(ctx.killerUid&&gp.inst[ctx.killerUid])dealDamage(gp,ctx.killerUid,1);}
  },

  // Bobby Brushbacks — Determination kw (engine auto). Vanilla otherwise.
  'render-mq82ozdt': {},

  // Clatter, Cornered — When damaged by attack, deals 1 dmg back to attacker. Response ①⊙: Block.
  'render-mq82rspr': {
    onDamaged(gp,uid,sourceUid){if(sourceUid&&gp.inst[sourceUid])dealDamage(gp,sourceUid,1);}
  },

  // Clief, Ancient Eclipse — When attacks, may play a Tactic from discard without paying.
  'render-mq82ry0b': {
    onAttack(gp,ctx){
      const tactics=gp.p[ctx.pid].grave.filter(u=>(CARDS[gp.inst[u].cid]||{}).type==='tactic');
      if(!tactics.length)return;
      pendPick(gp,{forId:ctx.pid,prompt:'Clief: play a Tactic from discard for free?',options:tactics.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})).concat([{label:'Skip',value:''}])},(g,pick)=>{
        if(pick){const tc=CARDS[g.inst[pick].cid];moveZone(g,ctx.pid,pick,'grave','grave');log(g,'Clief plays '+tc.name+' for free.');if(tc.run)tc.run(g,{pid:ctx.pid,src:pick});}
      });
    }
  },

  // Coney, Toothfighter — Armor 1 (auto). When enters, deal 1 dmg to target B/F. ②⊙: destroy damaged Fighter.
  'render-mq82se55': {
    onEnter(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Coney: deal 1 dmg to whom?',filter:bossOrFighterFilter()},(g,t)=>{if(t)dealDamage(g,t,1);});},
    activated:[{label:'② Destroy damaged Fighter',cost:{tap:true,coins:2},run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Coney: destroy which damaged Fighter?',filter:i=>i.kind==='fighter'&&gp.inst[i.uid].dmgThisLevel},(g,t)=>destroyInstance(g,t));}}]
  },

  // DeeLux, Brutal Savant — ②⊙: +1 atk counter on a Fighter, choose a keyword to grant this level.
  'render-mq82tt5b': {
    activated:[{label:'② +1 atk & grant keyword',cost:{tap:true,coins:2},run(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'DeeLux: +1 atk on which Fighter on your team?',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(g,t)=>{
        if(!t)return;addCounter(g,t,'atk',1);
        pendPick(g,{forId:ctx.pid,prompt:'Grant which keyword this level?',options:[{label:'Agility',value:'Agility'},{label:'Stealthy',value:'Stealthy'},{label:'Enforcer',value:'Enforcer'}]},(g2,kw)=>{if(kw)gainKwLevel(g2,t,kw);});
      });
    }}]
  },

  // Dette, Quickener — When becomes Phantasmal, target ally Fighter gains 2 HP. ①: Phantasmal.
  'render-mq82ueab': {
    activated:[{label:'① Become Phantasmal',cost:{coins:1},run(gp,ctx){const i=gp.inst[ctx.src];if(!i.phantasmal){i.phantasmal=true;i.counters=i.counters||{};i.counters.atk=(i.counters.atk||0)+1;log(gp,'Dette becomes Phantasmal.');pendTarget(gp,{forId:ctx.pid,prompt:'Dette: +2 HP to which ally Fighter?',filter:i2=>i2.kind==='fighter'&&i2.owner===ctx.pid},(g,t)=>{if(t)gainHealth(g,t,2);});}}}]
  },

  // Diffin, Slow Hand — Can't attack unless you have a Fighter with 5+ HP. Response ①⊙: Block.
  'render-mq82up5x': {

    _info:'Cannot attack without 5+ HP Fighter on team \u2014 GM enforce if violated.'
  },

  // Dreyver, Terminarch — Other Synth Bosses/Fighters cost ① less to attack/activate.
  'render-mq82vipj': {_info:'Other Synth allies pay ① less to attack/activate (manual via GM).'},

  // Ebb, Balancer of Scales — When enters, add or remove a counter on a B/F on your team.
  'render-mq82vp7e': {
    onEnter(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'Ebb: choose B/F on your team to add/remove a counter',filter:i=>(i.kind==='fighter'||i.kind==='boss')&&i.owner===ctx.pid},(g,t)=>{
        if(!t)return;
        pendPick(g,{forId:ctx.pid,prompt:'Add or remove a +1 Attack counter?',options:[{label:'Add +1',value:'add'},{label:'Remove -1',value:'rem'}]},(g2,v)=>{if(v==='add')addCounter(g2,t,'atk',1);else addCounter(g2,t,'atk',-1);});
      });
    }
  },

  // Father, Annihilator — wields weapons for no cost. Response ②, destroy: return Weapon from discard to play.
  'render-mq82yhl3': {

    activated:[{label:'② Destroy: return Weapon from discard',cost:{coins:2,sacrifice:true},run(gp,ctx){
      const ws=gp.p[ctx.pid].grave.filter(u=>(CARDS[gp.inst[u].cid]||{}).type==='weapon');
      if(!ws.length){log(gp,'No Weapon in discard.');return;}
      pendPick(gp,{forId:ctx.pid,prompt:'Father: return which Weapon to play?',options:ws.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},(g,pick)=>{
        if(pick){moveZone(g,ctx.pid,pick,'grave','board');resetInstance(g,pick);
          const myF=myFighters(g,ctx.pid);if(myF.length){pendTarget(g,{forId:ctx.pid,prompt:'Wield to which Fighter?',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(g2,f)=>wieldWeapon(g2,pick,f));}
        }
      });
    }}]
  },

  // Flank, Packleader — +1 atk per other Fighter on team. Can't be attacked if 4+ Fighters.
  'render-mq82yz0l': {
    dynamicAtkBonus(gp,uid){const i=gp.inst[uid];if(!i)return 0;return myFighters(gp,i.owner).filter(u=>u!==uid).length;}
  },

  // Flecks, Accelerator — When enters, target Fighter's base Attack Cost becomes ① this level.
  'render-mq82zd5k': {
    onEnter(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Flecks: target Fighter\u2019s Atk Cost becomes ① this level',filter:fighterTargetFilter()},(g,t)=>{if(t){g.inst[t]._costOverride=1;log(g,CARDS[g.inst[t].cid].name+' Atk Cost = ① this level (manual).');}});},
    activated:[{label:'①⊙ Same on Fighter',cost:{tap:true,coins:1},run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Same effect on target Fighter',filter:fighterTargetFilter()},(g,t)=>{if(t){g.inst[t]._costOverride=1;log(g,CARDS[g.inst[t].cid].name+' Atk Cost = ① this level.');}});}}]
  },

  // Galen, Nurturer — When enters, target B/F heals 2. ②: Transform.
  'render-mq830mwk': {
    onEnter(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Galen: heal 2 to whom?',filter:bossOrFighterFilter()},(g,t)=>{if(t)healInst(g,t,2);});},
    activated:[{label:'② Transform',cost:{coins:2,sacrifice:true},run(gp,ctx){transformInstance(gp,ctx.src);}}]
  },

  // Gizzard — any-number copies. +1 Atk for each other Gizzard on team.
  'render-mq831kn8': {
    dynamicAtkBonus(gp,uid){const i=gp.inst[uid];if(!i)return 0;return myFighters(gp,i.owner).filter(u=>u!==uid&&gp.inst[u].cid===i.cid).length;}
  },

  // Grammie, Picker-Upper — When enters, may wield any number of your Weapons to her. +1 atk per Weapon wielding.
  'render-mq832sdi': {
    onEnter(gp,ctx){
      const myWeapons=gp.p[ctx.pid].board.filter(u=>{const i=gp.inst[u];return i&&!i.wieldedBy&&(CARDS[i.cid]||{}).type==='weapon';});
      if(!myWeapons.length)return;
      const askNext=(g,idx)=>{
        if(idx>=myWeapons.length)return;
        const w=myWeapons[idx];const wc=CARDS[g.inst[w].cid];
        pendPick(g,{forId:ctx.pid,prompt:'Grammie: wield '+wc.name+' to her?',options:[{label:'Yes',value:'y'},{label:'Skip',value:''}]},(g2,v)=>{
          if(v==='y'){wieldWeapon(g2,w,ctx.src);}
          askNext(g2,idx+1);
        });
      };
      askNext(gp,0);
    },
    dynamicAtkBonus(gp,uid){const i=gp.inst[uid];return((i&&i.wielded)||[]).length;}
  },

  // Just Elias, Protector — Enforcer (auto). +1 atk per Survivor on team.
  'render-mq834dho': {
    dynamicAtkBonus(gp,uid){const i=gp.inst[uid];if(!i)return 0;return myFighters(gp,i.owner).filter(u=>(CARDS[gp.inst[u].cid]||{}).faction==='survivor'&&u!==uid).length;}
  },

  // Kochi, Platform Presence — When enters, heal target Fighter to max. When Kochi heals B/F, deals (n) dmg to target opp.
  'render-mq835b15': {
    onEnter(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Kochi: heal which Fighter to full?',filter:fighterTargetFilter()},(g,t)=>{if(t){const i=g.inst[t];i.hp=i.maxHp;log(g,CARDS[i.cid].name+' fully healed.');}});}
  },

  // Kupp Lightpaws — When enters, opponent discards. ②: Transform.
  'render-mq835m7t': {
    onEnter(gp,ctx){const opps=gp.order.filter(p=>p!==ctx.pid&&!gp.p[p].defeated);if(opps.length===1)pendDiscardOptional(gp,{pid:opps[0]},'Kupp Lightpaws: discard a card',()=>{});
      else if(opps.length)pendPick(gp,{forId:ctx.pid,prompt:'Kupp: which opponent discards?',options:opps.map(p=>({label:gp.p[p].name,value:p}))},(g,pid)=>pendDiscardOptional(g,{pid},'discard',()=>{}));},
    activated:[{label:'② Transform',cost:{coins:2,sacrifice:true},run(gp,ctx){transformInstance(gp,ctx.src);}}]
  },

  // Lacey, Bonesaw Healer — When enters, roll d6. ≤3: +1 atk on each Fighter on team. >3: each ally heals 1.
  'render-mq835xsc': {
    onEnter(gp,ctx){const r=rollDie(6);log(gp,'Lacey rolls a '+r+'.');if(r<=3)myFighters(gp,ctx.pid).forEach(u=>addCounter(gp,u,'atk',1));else eachAlly(gp,ctx.pid,u=>gainHealth(gp,u,1));}
  },

  // Lyra, Silken Assassin — If revealed from deck, draw a card. Response ⊙: Block.
  'render-mq836emw': {/* Block kw auto; revealed-from-deck hook not common, manual */},

  // Mahna, Soft Speaker — First time becomes enhanced, draw a card.
  'render-mq836hy5': {
    onEnter(gp,ctx){gp.inst[ctx.src]._mahnaTriggered=false;},
    onCounterPlaced(gp,pid){gp.p[pid].board.forEach(u=>{const i=gp.inst[u];if(i&&i.cid==='render-mq836hy5'&&!i._mahnaTriggered){i._mahnaTriggered=true;drawN(gp,pid,1);log(gp,'Mahna: first enhancement \u2192 draw a card.');}});}
  },

  // Minka, Underestimated — Whenever a Fighter dies, +1 atk counter on Minka. Response ①⊙: Block.
  'render-mq838tf0': {
    onAnyFighterDeath(gp,myUid){addCounter(gp,myUid,'atk',1);}
  },

  // Mist Me — Stealthy (auto). ①: Phantasmal (+1 atk counter).
  'render-mq838y1r': {
    activated:[{label:'① Become Phantasmal',cost:{coins:1},run(gp,ctx){const i=gp.inst[ctx.src];if(!i.phantasmal){i.phantasmal=true;i.counters=i.counters||{};i.counters.atk=(i.counters.atk||0)+1;log(gp,'Mist Me becomes Phantasmal.');}}}]
  },

  // Motreina, Stepmonster — When enters, wield up to one Weapon to target ally Fighter. ①⊙: same.
  'render-mq83a6bz': {
    onEnter(gp,ctx){
      const unwield=gp.p[ctx.pid].board.filter(u=>{const i=gp.inst[u];return i&&!i.wieldedBy&&(CARDS[i.cid]||{}).type==='weapon';});
      if(!unwield.length)return;
      pendPick(gp,{forId:ctx.pid,prompt:'Motreina: wield which Weapon? (or skip)',options:unwield.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})).concat([{label:'Skip',value:''}])},(g,wPick)=>{
        if(wPick)pendTarget(g,{forId:ctx.pid,prompt:'To which Fighter?',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(g2,f)=>wieldWeapon(g2,wPick,f));
      });
    },
    activated:[{label:'①⊙ Wield Weapon',cost:{tap:true,coins:1},run(gp,ctx){const unwield=gp.p[ctx.pid].board.filter(u=>{const i=gp.inst[u];return i&&!i.wieldedBy&&(CARDS[i.cid]||{}).type==='weapon';});if(!unwield.length)return;pendPick(gp,{forId:ctx.pid,prompt:'Wield which Weapon?',options:unwield.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u}))},(g,wPick)=>{if(wPick)pendTarget(g,{forId:ctx.pid,prompt:'To which Fighter?',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(g2,f)=>wieldWeapon(g2,wPick,f));});}}]
  },

  // Muck, Relentless Foe — When defeats Fighter, heals 1. Atk Cost & Atk = HP.
  'render-mq83apbe': {
    dynamicAtk(gp,uid){return(gp.inst[uid]||{}).hp||0;},
    onAttackKill(gp,uid){healInst(gp,uid,1);}
  },

  // Notamotua, Deathpunch — Armor 1 (auto). ②⊙: Destroy target Fighter damaged this level.
  'render-mq83cnop': {
    activated:[{label:'② Destroy damaged Fighter',cost:{tap:true,coins:2},run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Notamotua: destroy which damaged Fighter?',filter:i=>i.kind==='fighter'&&gp.inst[i.uid].dmgThisLevel},(g,t)=>destroyInstance(g,t));}}]
  },

  // Orson, Quickstinger — When enters, stun target Fighter. ②: Transform.
  'render-mq83cxwt': {
    onEnter(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Orson: stun which Fighter?',filter:fighterTargetFilter()},(g,t)=>{if(t){stunInstance(g,t);}});},
    activated:[{label:'② Transform',cost:{coins:2,sacrifice:true},run(gp,ctx){transformInstance(gp,ctx.src);}}]
  },

  // Pia, Laser Focused — When enters, may destroy an enhancement you own; if so draw a card. Response ②: Fortify.
  'render-mq83dkku': {
    onEnter(gp,ctx){
      const enhanced=gp.p[ctx.pid].board.filter(u=>{const i=gp.inst[u];return i&&((i.counters&&i.counters.atk>0)||(i.wielded&&i.wielded.length)||CARDS[i.cid].type==='weapon');});
      if(!enhanced.length)return;
      pendPick(gp,{forId:ctx.pid,prompt:'Pia: destroy an enhancement to draw a card?',options:enhanced.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})).concat([{label:'Skip',value:''}])},(g,pick)=>{
        if(pick){destroyInstance(g,pick,{skipFortify:true});drawN(g,ctx.pid,1);}
      });
    }
  },

  // Piecebook — Stealthy (auto). +1 atk vs Mystics. (attacker-side mod — manual.)
  'render-mq83e5uz': {_info:'+1 Atk vs Mystics (manual via GM during attack).'},

  // Pilskin, Slithering Striker — When enters, stun up to 2 Fighters. When deals damage, deal that to another B/F.
  'render-mq83e6ta': {
    onEnter(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'Pilskin: stun first Fighter (or skip)',filter:fighterTargetFilter()},(g,t1)=>{
        if(t1){stunInstance(g,t1);
          pendTarget(g,{forId:ctx.pid,prompt:'Stun a different Fighter? (skip ok)',filter:i=>i.kind==='fighter'&&i.uid!==t1},(g2,t2)=>{if(t2){stunInstance(g2,t2);}});
        }
      });
    }
  },

  // Poof, Worst Enemy — When dealt damage, +1 atk on target ally Fighter. Poof +1 Atk per enhanced ally B/F.
  'render-mq83esbe': {
    onDamaged(gp,uid){pendTarget(gp,{forId:gp.inst[uid].owner,prompt:'Poof: +1 atk on which ally Fighter?',filter:i=>i.kind==='fighter'&&i.owner===gp.inst[uid].owner},(g,t)=>{if(t)addCounter(g,t,'atk',1);});},
    dynamicAtkBonus(gp,uid){const i=gp.inst[uid];if(!i)return 0;let n=0;eachAlly(gp,i.owner,u=>{if(u===uid)return;const ai=gp.inst[u];if(ai&&((ai.counters&&ai.counters.atk>0)||(ai.wielded&&ai.wielded.length)))n++;});return n;}
  },

  // Don't Bury Me... — Heal 3 + remove all -1 atk counters; if removed, draw.
  'render-mq82v2l0': {
    run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Don\u2019t Bury Me: heal 3 to whom?',filter:bossOrFighterFilter()},(g,t)=>{if(!t)return;healInst(g,t,3);const i=g.inst[t];if(i.counters&&i.counters.atk<0){const removed=i.counters.atk;i.counters.atk=0;drawN(g,ctx.pid,1);log(g,'Removed '+(-removed)+' -1 Atk counters; drew a card.');}});}
  },

  // Fluorescent Fall — Return target ally Fighter + opposing Fighter to their owner's hand. Same-name F can't enter this level (manual).
  'render-mq83035u': {
    run(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'Fluorescent Fall: return which ally Fighter to hand?',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(g,t1)=>{
        if(t1)moveZone(g,ctx.pid,t1,'board','hand');
        pendTarget(g,{forId:ctx.pid,prompt:'Return which opposing Fighter to its owner\u2019s hand?',filter:i=>i.kind==='fighter'&&i.owner!==ctx.pid},(g2,t2)=>{if(t2)moveZone(g2,g2.inst[t2].owner,t2,'board','hand');});
      });
    }
  },

  // Give The Signal — Reveal top 5; for each Synth Fighter, may play or Fortify for free; rest go to bottom random.
  'render-mq831dlh': {
    run(gp,ctx){
      const top=gp.p[ctx.pid].deck.slice(0,5);
      log(gp,'Give The Signal reveals top 5: '+top.map(u=>CARDS[gp.inst[u].cid].name).join(', '));

      const synths=top.filter(u=>{const c=CARDS[gp.inst[u].cid];return c&&c.type==='fighter'&&c.faction==='synth';});
      const handled=new Set();

      const askNext=(g,idx)=>{
        if(idx>=synths.length){

          const remaining=top.filter(u=>!handled.has(u)&&g.p[ctx.pid].deck.includes(u));
          bottomShuffle(g,ctx.pid,remaining);
          return;
        }
        const u=synths[idx];
        const c=CARDS[g.inst[u].cid];
        pendPick(g,{forId:ctx.pid,prompt:'Give The Signal: what to do with '+c.name+' (Synth Fighter)?',options:[
          {label:'Play to board (free)',value:'play'},
          {label:'Fortify (free) — adds HP to a Synth on your team',value:'fort'},
          {label:'Skip (goes to bottom of deck)',value:''}
        ]},(g2,choice)=>{
          if(choice==='play'){

            g2.p[ctx.pid].deck=g2.p[ctx.pid].deck.filter(x=>x!==u);
            g2.p[ctx.pid].board.push(u);
            resetInstance(g2,u);
            fireOnEnter(g2,u,ctx.pid);
            handled.add(u);
            log(g2,'  → Played '+c.name+' to board.');
          } else if(choice==='fort'){

            const synthAllies=g2.p[ctx.pid].board.concat([g2.p[ctx.pid].boss]).filter(au=>{if(!au||au===u)return false;const ai=g2.inst[au];if(!ai)return false;const ac=CARDS[ai.cid];return ac&&ac.faction==='synth'&&(ac.type==='fighter'||ac.type==='boss');});
            if(!synthAllies.length){log(g2,'  → No Synth to Fortify under; skipped.');askNext(g2,idx+1);return;}
            pendPick(g2,{forId:ctx.pid,prompt:'Fortify '+c.name+' under which Synth?',options:synthAllies.map(au=>({label:CARDS[g2.inst[au].cid].name+' (HP '+g2.inst[au].hp+')',value:au}))},(g3,host)=>{
              if(host){
                const hostI=g3.inst[host];const addHp=c.hp||0;
                hostI.maxHp+=addHp;hostI.hp+=addHp;
                g3.p[ctx.pid].deck=g3.p[ctx.pid].deck.filter(x=>x!==u);
                g3.inst[u].fortifiedUnder=host;
                handled.add(u);
                log(g3,'  → '+c.name+' Fortified under '+CARDS[hostI.cid].name+' (+'+addHp+' HP).');
              }
              askNext(g3,idx+1);
            });
            return;
          } else {
            log(g2,'  → Skipped '+c.name+'.');
          }
          askNext(g2,idx+1);
        });
      };
      askNext(gp,0);
    }
  },

  // Go to the Videotape — Look at top 4. You may reveal any number of Survivor Fighters to hand; rest bottom random.
  'render-mq831q38': {
    run(gp,ctx){
      const top=gp.p[ctx.pid].deck.slice(0,4);
      const survF=top.filter(u=>{const c=CARDS[gp.inst[u].cid];return c&&c.type==='fighter'&&c.faction==='survivor';});
      log(gp,'Videotape reveals top 4: '+top.map(u=>CARDS[gp.inst[u].cid].name).join(', '));
      const handled=new Set();
      const askNext=(g,idx)=>{
        if(idx>=survF.length){
          const remaining=top.filter(u=>!handled.has(u)&&g.p[ctx.pid].deck.includes(u));
          bottomShuffle(g,ctx.pid,remaining);
          return;
        }
        const u=survF[idx];
        const c=CARDS[g.inst[u].cid];
        pendPick(g,{forId:ctx.pid,prompt:'Videotape: take '+c.name+' (Survivor Fighter) to hand?',options:[
          {label:'Yes — take to hand',value:'y'},
          {label:'Leave (goes to bottom)',value:''}
        ]},(g2,v)=>{
          if(v==='y'){
            g2.p[ctx.pid].deck=g2.p[ctx.pid].deck.filter(x=>x!==u);
            g2.p[ctx.pid].hand.push(u);
            handled.add(u);
            log(g2,'  → Took '+c.name+' to hand.');
          } else {
            log(g2,'  → Left '+c.name+' in deck.');
          }
          askNext(g2,idx+1);
        });
      };
      askNext(gp,0);
    }
  },

  // Mimeoscoped — Token copy of ally Fighter that dies end of level.
  'render-mq838ccz': {_info:'Create a same-stats token of target Fighter (use GM panel to create matching token).'},

  // Mystery Meat — Target B/F gains Agility this level. If Survivor, -① atk cost.
  'render-mq83c0mv': {
    run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Mystery Meat: Agility this level to whom?',filter:bossOrFighterFilter()},(g,t)=>{if(t)gainKwLevel(g,t,'Agility');});}
  },

  // Outlast — Deal damage to opp target = (# F on their team − # F on yours).
  'render-mq83cyq3': {
    run(gp,ctx){
      const opps=gp.order.filter(p=>p!==ctx.pid&&!gp.p[p].defeated);
      pendPick(gp,{forId:ctx.pid,prompt:'Outlast: choose an opponent',options:opps.map(p=>({label:gp.p[p].name,value:p}))},(g,oppPid)=>{
        if(!oppPid)return;const n=Math.max(0,myFighters(g,oppPid).length-myFighters(g,ctx.pid).length);
        if(n===0){log(g,'Outlast deals 0 damage.');return;}
        pendTarget(g,{forId:ctx.pid,prompt:'Outlast: deal '+n+' damage to which B/F of '+g.p[oppPid].name+'?',filter:i=>(i.kind==='fighter'||i.kind==='boss')&&i.owner===oppPid},(g2,t)=>{if(t)dealDamage(g2,t,n);});
      });
    }
  },

  // Power Play — Deal 1 dmg to ally target + 3 dmg to opp target. If dmg'd a Mystic, draw.
  'render-mq83esvh': {
    run(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'Power Play: 1 damage to which ally B/F?',filter:i=>(i.kind==='fighter'||i.kind==='boss')&&i.owner===ctx.pid},(g,t1)=>{
        if(t1)dealDamage(g,t1,1);
        pendTarget(g,{forId:ctx.pid,prompt:'Power Play: 3 damage to which opposing B/F?',filter:i=>(i.kind==='fighter'||i.kind==='boss')&&i.owner!==ctx.pid},(g2,t2)=>{
          if(t2){const dmgFac=(CARDS[g2.inst[t2].cid]||{}).faction;dealDamage(g2,t2,3);if(dmgFac==='mystic')drawN(g2,ctx.pid,1);}
        });
      });
    }
  },

  // Rally Up — Target Fighter gains Determination this level. If Survivor, draw a card.
  'render-mq83g4uy': {
    run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Rally Up: Determination this level to which Fighter?',filter:fighterTargetFilter()},(g,t)=>{if(t){gainKwLevel(g,t,'Determination');if((CARDS[g.inst[t].cid]||{}).faction==='survivor')drawN(g,ctx.pid,1);}});}
  },

  // Roll Call — Choose one: distribute 5 +1 atk counters among allies, OR draw card per ally with counter.
  'render-mq83hedv': {
    run(gp,ctx){
      pendPick(gp,{forId:ctx.pid,prompt:'Roll Call: choose effect',options:[{label:'Distribute 5 +1 atk counters',value:'distr'},{label:'Draw card per ally with counter',value:'draw'}]},(g,choice)=>{
        if(choice==='distr'){
          const give=(g2,n)=>{if(n===0)return;pendTarget(g2,{forId:ctx.pid,prompt:'+1 atk to which ally Fighter? ('+n+' left)',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(g3,t)=>{if(t){addCounter(g3,t,'atk',1);give(g3,n-1);}});};
          give(g,5);
        } else {
          const n=myFighters(g,ctx.pid).filter(u=>{const i=g.inst[u];return i.counters&&i.counters.atk>0;}).length;
          if(n>0){drawN(g,ctx.pid,n);log(g,'Roll Call: drew '+n+' card(s).');}
        }
      });
    }
  },

});

Object.assign(window.CATA_ABILITIES, {

  // Reika, First Novice — Armor 1 (auto). Response ⊙: Block (kw auto).
  'render-mq83gsx7': {/* both kws auto */},

  // Ryle, Unchecked — When damaged, deals that damage to target B/F. When Ryle deals attack damage, deal 2 to Ryle.
  'render-mq83i0g1': {
    onDamaged(gp,uid,sourceUid,amt){if(amt>0)pendTarget(gp,{forId:gp.inst[uid].owner,prompt:'Ryle: deal '+amt+' damage to whom?',filter:bossOrFighterFilter()},(g,t)=>{if(t)dealDamage(g,t,amt);});},
    onWielderDealtDamage(gp,uid){dealDamage(gp,uid,2);}
  },

  // Sage, Fair Fighter — Enters: destroy up to one Weapon; Sage gains HP = level. When attacks, d6: 4+ → +1 atk + roll again.
  'render-mq83i27x': {
    onEnter(gp,ctx){
      const ws=allBoard(gp).filter(u=>(CARDS[gp.inst[u].cid]||{}).type==='weapon');
      if(!ws.length)return;
      pendPick(gp,{forId:ctx.pid,prompt:'Sage: destroy a Weapon? (or skip)',options:ws.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})).concat([{label:'Skip',value:''}])},(g,pick)=>{
        if(pick){const lvl=(CARDS[g.inst[pick].cid]||{}).level||0;destroyInstance(g,pick,{skipFortify:true});const me=g.inst[ctx.src];me.maxHp+=lvl;me.hp+=lvl;log(g,'Sage gains '+lvl+' HP.');}
      });
    },
    onAttack(gp,ctx){
      let keep=true;
      while(keep){const r=rollDie(6);log(gp,'Sage rolls a '+r+'.');if(r>=4){setTempAtk(gp,ctx.src,1);}else keep=false;}
    }
  },

  // Sanyang, Unerring — When enters, gain ②. Attack = tokens spent (cap 4).
  'render-mq83iod9': {
    onEnter(gp,ctx){gp.p[ctx.pid].coins+=2;log(gp,'Sanyang: gain ②.');}

  },

  // Shadowcaster — Enforcer (auto). ①: Phantasmal.
  'render-mq83jnmx': {
    activated:[{label:'① Become Phantasmal',cost:{coins:1},run(gp,ctx){const i=gp.inst[ctx.src];if(!i.phantasmal){i.phantasmal=true;i.counters=i.counters||{};i.counters.atk=(i.counters.atk||0)+1;log(gp,'Shadowcaster becomes Phantasmal.');}}}]
  },

  // Shadowstriker — Can't be blocked, ignores Enforcer (both atkFlags auto).
  'render-mq83jnpz': {/* atkFlags auto */},

  // Shaman of Eternity — Whenever you place +1 atk counter on B/F, draw. ②: Phantasmal.
  'render-mq83kaj3': {
    onCounterPlaced(gp,pid){drawN(gp,pid,1);},
    activated:[{label:'② Become Phantasmal',cost:{coins:2},run(gp,ctx){const i=gp.inst[ctx.src];if(!i.phantasmal){i.phantasmal=true;i.counters=i.counters||{};i.counters.atk=(i.counters.atk||0)+1;log(gp,'Shaman of Eternity becomes Phantasmal.');}}}]
  },

  // Skell — Vanilla flavor (no rules text effect).
  'render-mq83llb0': {},

  // Slider, Untombed — Determination (auto). Atk = # unique Traits among opposing Fighters (manual).
  'render-mq83m97v': {_info:'Variable atk equal to opposing Traits \u2014 manual.'},

  // Squatch — already in earlier; placeholder.
  /* Stat, Mirage Master — Copy another Fighter — too complex, manual */
  'render-mq83njzn': {_info:'Stat enters as copy of another Fighter \u2014 use GM panel to mirror stats.'},

  // Tyro, Sensei's Pet — Determination (auto). Response ②⊙: another target B/F heals 2.
  'render-mq83tf41': {
    activated:[{label:'② Heal another B/F by 2',cost:{tap:true,coins:2},run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Tyro: heal which B/F by 2?',filter:i=>(i.kind==='fighter'||i.kind==='boss')&&i.uid!==ctx.src},(g,t)=>{if(t)healInst(g,t,2);});}}]
  },

  // Vermingus, Brutal Busker — When Fighter enters from deck, +1 atk + 1 HP. ②⊙: Reveal top, if playable play.
  'render-mq83u22z': {
    activated:[{label:'② Reveal top, play if Fighter',cost:{tap:true,coins:2},run(gp,ctx){
      const u=gp.p[ctx.pid].deck[0];if(!u){log(gp,'Deck empty.');return;}
      const c=CARDS[gp.inst[u].cid];log(gp,'Vermingus reveals '+c.name+'.');
      if(c.type==='fighter'){gp.p[ctx.pid].deck.shift();gp.p[ctx.pid].board.push(u);resetInstance(gp,u);fireOnEnter(gp,u,ctx.pid);}
      else{gp.p[ctx.pid].deck.shift();gp.p[ctx.pid].hand.push(u);}
    }}]
  },

  // Vengeance de Milo — When enters, 2 dmg to target Fighter; if Shifter, 4 instead.
  'render-mq83u290': {
    onEnter(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Vengeance de Milo: damage to which Fighter?',filter:fighterTargetFilter()},(g,t)=>{if(t){const fac=(CARDS[g.inst[t].cid]||{}).faction;dealDamage(g,t,fac==='shifter'?4:2);}});}
  },

  // Vigo the Sharp  — duplicate-safe.

  // WillyB, Newcomer — flavor only.
  'render-mq83vunp': {},

  // Yoshi, Victory at all Cost — Stealthy (auto). +1 atk vs Synths. ②⊙ destroy: destroy Synth Fighter.
  'render-mq83vx5p': {
    activated:[{label:'② Destroy: nuke Synth Fighter',cost:{tap:true,coins:2,sacrifice:true},run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Yoshi: destroy which Synth Fighter?',filter:i=>i.kind==='fighter'&&(CARDS[i.cid]||{}).faction==='synth'},(g,t)=>destroyInstance(g,t));}}]
  },

  // Zanni already in phase 1.

  // 'Lique already in phase 1.

  // Toolbox token — vanilla.
  'render-mq83qps3': {},

  // Head Rat token — vanilla.
  'render-mq833gl9': {},

  // Whump! token — already in phase 1.

  // Bleargh — flavor.
  'render-mq82oy4v': {},

  // Burgess — flavor.
  'render-mq82pls1': {},

  // Darby — flavor.
  'render-mq82ssqb': {},

  // Hot Mike — reveal top card, may play T/R from top (manual).
  'render-mq833kln': {_info:'Top of deck revealed; may play T/R from top \u2014 manual.'},

  // Kat Five — When enters, gain ⊙ per other Survivor. Damage carries.
  'render-mq87mx41': {
    onEnter(gp,ctx){const n=myFighters(gp,ctx.pid).filter(u=>(CARDS[gp.inst[u].cid]||{}).faction==='survivor'&&u!==ctx.src).length;if(n>0){gp.p[ctx.pid].coins+=n;log(gp,'Kat Five: gain '+n+' ⊙.');}},
    onWielderDealtDamage(gp,wielderUid,dmg){/* carry-damage to another B/F */pendTarget(gp,{forId:gp.inst[wielderUid].owner,prompt:'Kat Five carry '+dmg+' damage to which other B/F?',filter:i=>(i.kind==='fighter'||i.kind==='boss')&&i.uid!==wielderUid},(g,t)=>{if(t)dealDamage(g,t,dmg);});}
  },

  // Luna, Max, Quarters — flavor only.
  'render-mq8368ip': {},
  'render-mq837rlv': {},
  'render-mq83g4dy': {},

  // Mechtor Suit, Vector Victor — vanilla bodies.
  'DS1-038': {},
  'DS1-071': {},

  // Fishhooks already automated.
});

/* End of cards-abilities.js. Run `applyAbilities()` is called automatically on load. */

/* The final 2 cards */
Object.assign(window.CATA_ABILITIES, {
  // The Blue Gelati — When attacks, may pay ① for +X atk equal to a Weapon's attack. Fortify on death (auto).
  'render-mq83q0bf': {
    onAttack(gp,ctx){
      if(gp.p[ctx.pid].coins<1)return;
      const weapons=allBoard(gp).filter(u=>(CARDS[gp.inst[u].cid]||{}).type==='weapon');
      if(!weapons.length)return;
      pendPick(gp,{forId:ctx.pid,prompt:'Blue Gelati: pay ① for +X atk (X = weapon\u2019s Atk)?',options:weapons.map(u=>({label:CARDS[gp.inst[u].cid].name+' (+'+(CARDS[gp.inst[u].cid].atkMod||0)+')',value:u})).concat([{label:'Skip',value:''}])},(g,pick)=>{
        if(pick){const bonus=CARDS[g.inst[pick].cid].atkMod||0;g.p[ctx.pid].coins-=1;setTempAtk(g,ctx.src,bonus);}
      });
    }
    /* fortifyInstead auto-set via text-scan */
  },
  // Trouble, Forerunner — Others cost ① more to activate. When defeats Fighter, gain ②.
  'render-mq83senr': {
    onAttackKill(gp,uid){const pid=gp.inst[uid].owner;gp.p[pid].coins+=2;log(gp,'Trouble: gain ②.');},
    _info:'Other allies\u2019 atk/ability costs +① (manual via GM coin adj).'
  },
});

Object.assign(window.CATA_ABILITIES, {

  // Tryp, Timelost — Whenever a player discards 1+ cards, deal 1 dmg to all opposing B/F.
  'render-mq83siwj': {
    onAttack(gp,ctx){if(gp.p[ctx.pid].hand.length)pendDiscardOptional(gp,{pid:ctx.pid},'Tryp attacks: discard a card?',()=>{});},
    onAnyDiscard(gp,ctx){
      /* ctx.pid = Tryp's owner; ctx.discarderPid = who discarded */
      eachOpponent(gp,ctx.pid,oppPid=>{
        gp.p[oppPid].board.concat([gp.p[oppPid].boss]).forEach(u=>{
          if(u&&gp.inst[u]&&(gp.inst[u].kind==='fighter'||gp.inst[u].kind==='boss'))dealDamage(gp,u,1);
        });
      });
    }
  },

  // Oriana, Cutthroat — Whenever a player discards 1+, Oriana deals 1 dmg to target B/F.
  'render-mq83cnrg': {
    onAnyDiscard(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'Oriana: deal 1 dmg to which Boss or Fighter?',filter:bossOrFighterFilter()},(g,t)=>{if(t)dealDamage(g,t,1);});
    }
  },

  // Sky, Unlikely Champion — When attacked, gains Agility this level. Atk Cost -1 per Survivor (handled by atkCostModForAlly elsewhere — Sky benefits when attacking opp).
  'render-mq83m92b': {
    onAttacked(gp,ctx){gainKwLevel(gp,ctx.src,'Agility');}
    /* The "Atk Cost -1 per Survivor" applies to Sky himself, not allies — we handle via dynamic check in effectiveAtkCost below */
  },

  // Effin' Slingshot — atkCost -1 on wielder (handled in effectiveAtkCost via id check).
  'render-mq82wrmk': {/* effect via effectiveAtkCost id check */},

  // Dreyver — Other Synth allies pay ① less to attack.
  'render-mq82vipj': {
    atkCostModForAlly(gp,uid,sourceUid){
      const i=gp.inst[uid];const sc=CARDS[gp.inst[sourceUid].cid];
      if(uid===sourceUid)return 0;
      const c=CARDS[i.cid];if(!c)return 0;
      if(c.faction!=='synth')return 0;
      return -1;
    }
  },

  // EVee — Attack costs of other Survivors on your team cost ① less.
  'render-mq82xys2': {
    atkCostModForAlly(gp,uid,sourceUid){
      if(uid===sourceUid)return 0;
      const c=CARDS[gp.inst[uid].cid];if(!c||c.faction!=='survivor')return 0;
      return -1;
    }
  },

  // Trouble, Forerunner — All OTHER B/F cost ① more to attack/activate. (Engine applies in effectiveAtkCost via id check for opposing Trouble.)
  'render-mq83senr': {
    onAttackKill(gp,uid){const pid=gp.inst[uid].owner;gp.p[pid].coins+=2;log(gp,'Trouble: gain ②.');}
  },

  // Lacey, Bonesaw Healer — use VISIBLE dice
  'render-mq835xsc': {
    onEnter(gp,ctx){
      rollDieVisible(6,'Lacey rolls a d6',(r)=>{
        act(rm=>{const gp2=rm.game;log(gp2,'Lacey rolls a '+r+'.');
          if(r<=3)myFighters(gp2,ctx.pid).forEach(u=>addCounter(gp2,u,'atk',1));
          else eachAlly(gp2,ctx.pid,u=>gainHealth(gp2,u,1));
        });
      });
    }
  },

  // Sage, Fair Fighter — use VISIBLE dice in attack loop
  'render-mq83i27x': {
    onEnter(gp,ctx){
      const ws=allBoard(gp).filter(u=>(CARDS[gp.inst[u].cid]||{}).type==='weapon');
      if(!ws.length)return;
      pendPick(gp,{forId:ctx.pid,prompt:'Sage: destroy a Weapon? (or skip)',options:ws.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})).concat([{label:'Skip',value:''}])},(g,pick)=>{
        if(pick){const lvl=(CARDS[g.inst[pick].cid]||{}).level||0;destroyInstance(g,pick,{skipFortify:true});const me=g.inst[ctx.src];me.maxHp+=lvl;me.hp+=lvl;log(g,'Sage gains '+lvl+' HP.');}
      });
    },
    onAttack(gp,ctx){
      const keepRolling=()=>rollDieVisible(6,'Sage attacks: d6',(r)=>{
        act(rm=>{const gp2=rm.game;log(gp2,'Sage rolls a '+r+'.');
          if(r>=4){setTempAtk(gp2,ctx.src,1);}
        });
        if(r>=4)setTimeout(keepRolling,600);
      });
      keepRolling();
    }
  },

});

Object.assign(window.CATA_ABILITIES, {

  // Charlotte, Nightbringer — When Charlotte defeats a Fighter, may link it.
  // When Charlotte dies, all linked Fighters return to play.
  'render-mq82qy7i': {
    onAttackKill(gp,ctx){

      const dC=CARDS[ctx.defenderCid];if(!dC||dC.type!=='fighter')return;
      pendPick(gp,{forId:ctx.pid,prompt:'Charlotte: link '+dC.name+'? (returns to play when Charlotte dies)',options:[{label:'Yes, link',value:'y'},{label:'No, leave in discard',value:''}]},(g,v)=>{
        if(v==='y')linkFighter(g,ctx.src,ctx.defenderUid);
      });
    },
    onDeath(gp,ctx){

      Object.keys(gp.inst).forEach(uid=>{const i=gp.inst[uid];if(i&&i.cid==='render-mq82qy7i'&&i.hp<=0&&i.linkedFighters&&i.linkedFighters.length)returnLinkedFighters(gp,uid);});
    }
  },

  // Whiskers of the Ancient — Wielder attacks → becomes any faction this level; +1 atk per faction on your team.
  'render-mq83v8ob': {
    onWielderAttack(gp,wielderUid){
      const pid=gp.inst[wielderUid].owner;
      pendPick(gp,{forId:pid,prompt:'Whiskers: choose faction for wielder this level',options:[
        {label:'Synth',value:'synth'},{label:'Mystic',value:'mystic'},{label:'Shifter',value:'shifter'},{label:'Survivor',value:'survivor'},{label:'Apex',value:'apex'}
      ]},(g,fac)=>{
        if(!fac)return;
        g.inst[wielderUid].tempFaction=fac;

        const factions=new Set();
        eachAlly(g,pid,u=>{const fc=CARDS[g.inst[u].cid];if(fc&&fc.faction)factions.add(g.inst[u].tempFaction||fc.faction);});
        const bonus=factions.size;setTempAtk(g,wielderUid,bonus);
        log(g,'Whiskers: wielder is now '+fac+' (+'+bonus+' Atk this level).');
      });
    }
  },

  // Stat, Mirage Master — Enters as copy of another Fighter (HP/atk/abilities inherited).
  'render-mq83njzn': {
    onEnter(gp,ctx){
      const targets=allBoard(gp).filter(u=>u!==ctx.src&&gp.inst[u]&&gp.inst[u].kind==='fighter'&&gp.inst[u].hp>0);
      if(!targets.length)return;
      pendTarget(gp,{forId:ctx.pid,prompt:'Stat: enter as a copy of which Fighter?',filter:i=>i.kind==='fighter'&&i.uid!==ctx.src},(g,t)=>{
        if(t)copyStatsOnto(g,ctx.src,t);
      });
    },

    dynamicAtk(gp,uid){
      const i=gp.inst[uid];if(!i||!i._copyOf)return undefined;
      const modelC=CARDS[i._copyOf];if(!modelC)return undefined;
      return(modelC.atk||0)+(i.counters&&i.counters.atk||0)+(i.tempAtk||0);
    }
  },

  // Hot Mike — Top of deck revealed. May play T/R from top.
  'render-mq833kln': {
    onEnter(gp,ctx){gp.p[ctx.pid].topRevealed=true;log(gp,'Hot Mike: top of '+gp.p[ctx.pid].name+'\u2019s deck is now revealed.');},
    onDeath(gp,ctx){gp.p[ctx.pid].topRevealed=false;},
    activated:[{label:'⊙ Play T/R from deck top',cost:{tap:true},run(gp,ctx){
      const top=gp.p[ctx.pid].deck[0];if(!top){log(gp,'Deck empty.');return;}
      const tc=CARDS[gp.inst[top].cid];if(!tc||(tc.type!=='tactic'&&tc.type!=='response')){log(gp,'Top card is not a Tactic/Response.');return;}
      if((tc.cost||0)>gp.p[ctx.pid].coins){log(gp,'Not enough coins.');return;}
      gp.p[ctx.pid].deck.shift();gp.p[ctx.pid].coins-=(tc.cost||0);gp.p[ctx.pid].grave.push(top);
      log(gp,gp.p[ctx.pid].name+' plays '+tc.name+' from top of deck.');
      if(tc.run)tc.run(gp,{pid:ctx.pid,src:top});
    }}]
  },

  // Mimeoscoped — Create a token copy of an ally Fighter, dies end of level.
  'render-mq838ccz': {
    run(gp,ctx){
      const myF=myFighters(gp,ctx.pid);
      if(!myF.length){log(gp,'Mimeoscoped: no Fighter to copy.');return;}
      pendTarget(gp,{forId:ctx.pid,prompt:'Mimeoscoped: copy which ally Fighter (token, dies end of level)?',filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(g,t)=>{
        if(!t)return;

        const tInst=g.inst[t];const tC=CARDS[tInst.cid];if(!tC)return;
        const tokId='_mimeo_'+Date.now()+'_'+Math.floor(Math.random()*99999);
        CARDS[tokId]=Object.assign({},tC,{id:tokId,name:'Mimeoscope ('+tC.name+')',type:'token',kind:'fighter',diesEndOfLevel:true});

        const newUid=newInstance(g,tokId,ctx.pid);
        g.p[ctx.pid].board.push(newUid);
        resetInstance(g,newUid);
        log(g,'Mimeoscoped creates a token copy of '+tC.name+' (dies end of level).');
      });
    }
  },

  // Squatch — +1 Atk vs Mystics (attacker mod); Mystics attacking Squatch get -1 Atk (defender mod).
  'render-mq83niqy': {
    attackerMod(gp,atkUid,defUid,{dFac}){return dFac==='mystic'?1:0;},
    defenderMod(gp,atkUid,defUid,{aFac}){return aFac==='mystic'?-1:0;}
  },

  // Piecebook — Stealthy (auto). +1 Atk when attacking Mystics.
  'render-mq83e5uz': {
    attackerMod(gp,atkUid,defUid,{dFac}){return dFac==='mystic'?1:0;}
  },

  // Yoshi, Victory at all Cost — +1 atk vs Synths.
  'render-mq83vx5p': {
    attackerMod(gp,atkUid,defUid,{dFac}){return dFac==='synth'?1:0;},
    activated:[{label:'② Destroy: nuke Synth Fighter',cost:{tap:true,coins:2,sacrifice:true},run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Yoshi: destroy which Synth Fighter?',filter:i=>i.kind==='fighter'&&(CARDS[i.cid]||{}).faction==='synth'},(g,t)=>destroyInstance(g,t));}}]
  },

  // Mayhem Fist (weapon) — wielder +1 Atk per Survivor Fighter; wielder Atk Cost +①.
  'render-mq83879t': {
    /* Wielder bonus through static-ally check: wielder reads weapon's bonus via wielded loop, but
       the bonus depends on board state. Use a small static-buff on the weapon that returns extra atk
       to its wielder (a new convention: weapon.atkBonusForWielder(gp, wielderUid)). */
    atkBonusForWielder(gp,wielderUid){return myFighters(gp,gp.inst[wielderUid].owner).filter(u=>(CARDS[gp.inst[u].cid]||{}).faction==='survivor').length;},
    atkCostModForAlly(gp,uid,sourceUid){

      return 0;
    },
    wielderAtkCostMod:1
  },

  // Sanyang, Unerring — On attack, prompt for tokens to spend (1..4); Sanyang's atk = that amount.
  'render-mq83iod9': {
    onEnter(gp,ctx){gp.p[ctx.pid].coins+=2;log(gp,'Sanyang: gain ②.');},
    preAttack(gp,ctx){
      const max=Math.min(4,gp.p[ctx.pid].coins);
      if(max<=0){log(gp,'Sanyang attacks for 0 (no coins to spend).');gp.inst[ctx.attacker].tempAtk=0;finishAttackDamage(gp,ctx);return;}
      pendPick(gp,{forId:ctx.pid,prompt:'Sanyang attacks: spend how many coins for damage? (max '+max+')',options:Array.from({length:max},(_,i)=>({label:(i+1)+' \u29bb',value:String(i+1)})).concat([{label:'0 (no damage)',value:'0'}])},(g,v)=>{
        const n=parseInt(v||'0',10);g.p[ctx.pid].coins-=n;
        g.inst[ctx.attacker].tempAtk=(g.inst[ctx.attacker].tempAtk||0)+n;
        log(g,'Sanyang spends '+n+' \u29bb for '+n+' damage.');
        finishAttackDamage(g,ctx);
      });
    }
  },

  // Slider, Untombed — Atk = # unique Factions among opposing Fighters (proxy for "Traits").
  'render-mq83m97v': {
    dynamicAtk(gp,uid){
      const i=gp.inst[uid];if(!i)return 0;
      const factions=new Set();
      eachOpponent(gp,i.owner,oppPid=>{
        gp.p[oppPid].board.forEach(u=>{const oc=CARDS[gp.inst[u].cid];if(oc&&oc.type==='fighter')factions.add(oc.faction);});
      });
      return factions.size;
    }
  },

  // Diffin, Slow Hand — attack restriction handled in confirmAttack; just info.
  'render-mq82up5x': {},

});

/* Block redirect — for cards with "Response ⊙: Block" in their text. When played
   during an attack response window, swap the defender to this card. */
function makeBlockAbility(coinCost){
  return {
    label: coinCost ? ('Response '+'\u2460\u2461\u2462\u2463'[coinCost-1]+'\u2299: Block') : 'Response \u2299: Block',
    cost: coinCost ? {tap:true, coins:coinCost} : {tap:true},
    run(gp, ctx){
      if(!gp.pendingAttack){log(gp,'Block: no attack to redirect.');return;}
      const blocker = ctx.src;
      const oldDef = gp.pendingAttack.defender;
      if(oldDef===blocker){log(gp,'Block: already the defender.');return;}
      gp.pendingAttack.defender = blocker;
      log(gp,(CARDS[gp.inst[blocker].cid]||{name:'?'}).name + ' Blocks the attack from ' + ((CARDS[gp.inst[oldDef]?.cid]||{name:'?'}).name) + '!');
    }
  };
}

const BLOCK_FREE = ['render-mq831kn8','render-mq83t4ah','render-mq83gsx7'];
const BLOCK_ONE  = ['render-mq838tf0','render-mq83wcyl'];
BLOCK_FREE.forEach(cid=>{const e=window.CATA_ABILITIES[cid]||(window.CATA_ABILITIES[cid]={});e.activated=(e.activated||[]).concat([makeBlockAbility(0)]);});
BLOCK_ONE.forEach(cid=>{const e=window.CATA_ABILITIES[cid]||(window.CATA_ABILITIES[cid]={});e.activated=(e.activated||[]).concat([makeBlockAbility(1)]);});

/* Weapon-granted Block (the wielder gets Response ⊙: Block) */
['render-mq836yg3','render-mq83osng'].forEach(cid=>{
  const e=window.CATA_ABILITIES[cid]||(window.CATA_ABILITIES[cid]={});
  e.grantsActivated=(e.grantsActivated||[]).concat([makeBlockAbility(0)]);
});

/* Pia's Response ②⊙: Fortify — defender chooses an ally Synth to host, gains Pia's HP. */
(function wirePiaResponse(){
  const e=window.CATA_ABILITIES['render-mq83dkku']||(window.CATA_ABILITIES['render-mq83dkku']={});
  e.activated=(e.activated||[]).concat([{
    label:'Response \u2461\u2299: Fortify',
    cost:{tap:true,coins:2},
    run(gp,ctx){
      const me=gp.inst[ctx.src];if(!me)return;
      const hosts=gp.p[ctx.pid].board.concat([gp.p[ctx.pid].boss]).filter(au=>{
        if(!au||au===ctx.src)return false;
        const ai=gp.inst[au];if(!ai)return false;
        const ac=CARDS[ai.cid];
        return ac&&ac.faction==='synth'&&(ac.type==='fighter'||ac.type==='boss');
      });
      if(!hosts.length){log(gp,'Pia: no Synth ally to Fortify under.');return;}
      pendPick(gp,{forId:ctx.pid,prompt:'Pia: Fortify under which Synth?',
        options:hosts.map(au=>({label:CARDS[gp.inst[au].cid].name,value:au}))},
        (g,host)=>{
          if(!host)return;
          const hostI=g.inst[host];const addHp=me.maxHp||0;
          hostI.maxHp+=addHp;hostI.hp+=addHp;
          g.p[ctx.pid].board=g.p[ctx.pid].board.filter(x=>x!==ctx.src);
          me.fortifiedUnder=host;
          log(g,CARDS[me.cid].name+' Fortifies under '+CARDS[hostI.cid].name+' (+'+addHp+' HP).');
        });
    }
  }]);
})();
