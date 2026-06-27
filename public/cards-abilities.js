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
      top.forEach(u=>fireReveal(gp,ctx.pid,u));
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
      top.forEach(u=>fireReveal(gp,ctx.pid,u));
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

    activated:[{label:'Response \u2461 Destroy: return Weapon from discard',cost:{coins:2,sacrifice:true},run(gp,ctx){
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
      top.forEach(u=>fireReveal(gp,ctx.pid,u));

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
      top.forEach(u=>fireReveal(gp,ctx.pid,u));
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
    activated:[{label:'Response \u2461\u2299: Heal another B/F by 2',cost:{tap:true,coins:2},run(gp,ctx){pendTarget(gp,{forId:ctx.pid,prompt:'Tyro: heal which B/F by 2?',filter:i=>(i.kind==='fighter'||i.kind==='boss')&&i.uid!==ctx.src},(g,t)=>{if(t)healInst(g,t,2);});}}]
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
    preAttack(gp,ctx){
      /* "Choose a weapon in play" includes both unwielded weapons on boards AND wielded weapons. */
      const weapons=[];
      Object.keys(gp.inst).forEach(u=>{
        const i=gp.inst[u];if(!i)return;
        if((CARDS[i.cid]||{}).type==='weapon')weapons.push(u);
      });
      const canBoost=gp.p[ctx.pid].coins>=1&&weapons.length>0;
      if(!canBoost){finishAttackDamage(gp,ctx);return;}
      /* Helper: compute a weapon's effective Attack value as if Gelati were the wielder.
         Most weapons have atkMod=0 with conditional bonuses via atkBonusForWielder(gp, wielderUid).
         If a wielder already exists, use that; otherwise simulate Gelati as wielder. */
      function weaponEffectiveAtk(g, weaponUid){
        const wInst=g.inst[weaponUid];const wc=CARDS[wInst.cid];if(!wc)return 0;
        let v=Number(wc.atkMod)||0;
        if(wc.atkBonusForWielder){
          /* If wielded, use the actual wielder. Otherwise simulate Gelati. */
          const wielderForCalc=wInst.wieldedBy||ctx.attacker;
          v+=Number(wc.atkBonusForWielder(g,wielderForCalc))||0;
        }
        return Math.max(0,v);
      }
      pendPick(gp,{forId:ctx.pid,prompt:'Blue Gelati attacks: pay \u2460 for +X Attack equal to a weapon\u2019s Attack value?',
        options:[{label:'Yes \u2014 pick weapon',value:'y'},{label:'No (attack as is)',value:''}]},
        (g,choice)=>{
          if(choice!=='y'){finishAttackDamage(g,ctx);return;}
          pendPick(g,{forId:ctx.pid,prompt:'Blue Gelati: copy which weapon\u2019s Attack value?',
            options:weapons.map(u=>{
              const wc=CARDS[g.inst[u].cid];
              const effAtk=weaponEffectiveAtk(g,u);
              const wieldedNote=g.inst[u].wieldedBy?' (wielded)':' (unwielded)';
              return{label:wc.name+wieldedNote+' \u2014 +'+effAtk+' Atk',value:u};
            }).concat([{label:'Cancel \u2014 attack with base Attack',value:''}])},
            (g2,pick)=>{
              if(!pick){finishAttackDamage(g2,ctx);return;}
              const bonus=weaponEffectiveAtk(g2,pick);
              const wc=CARDS[g2.inst[pick].cid];
              g2.p[ctx.pid].coins=Math.max(0,g2.p[ctx.pid].coins-1);
              const cur=Number(g2.inst[ctx.attacker].tempAtk)||0;
              g2.inst[ctx.attacker].tempAtk=cur+bonus;
              log(g2,'Blue Gelati pays \u2460, copies '+wc.name+' Attack value (+'+bonus+').');
              finishAttackDamage(g2,ctx);
            });
        });
    }
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

  // Sage, Fair Fighter — use VISIBLE dice in attack loop (preAttack so buff applies BEFORE damage)
  'render-mq83i27x': {
    onEnter(gp,ctx){
      const ws=allBoard(gp).filter(u=>(CARDS[gp.inst[u].cid]||{}).type==='weapon');
      if(!ws.length)return;
      pendPick(gp,{forId:ctx.pid,prompt:'Sage: destroy a Weapon? (or skip)',options:ws.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})).concat([{label:'Skip',value:''}])},(g,pick)=>{
        if(pick){const lvl=(CARDS[g.inst[pick].cid]||{}).level||0;destroyInstance(g,pick,{skipFortify:true});const me=g.inst[ctx.src];me.maxHp+=lvl;me.hp+=lvl;log(g,'Sage gains '+lvl+' HP.');}
      });
    },
    preAttack(gp,ctx){
      let total=0;
      const rollOnce=()=>{
        rollDieVisible(6,'Sage attacks: d6',(r)=>{
          act(rm=>{const gp2=rm.game;
            log(gp2,'Sage rolls a '+r+'.');
            if(r>=4){
              total+=1;
              gp2.inst[ctx.attacker].tempAtk=(gp2.inst[ctx.attacker].tempAtk||0)+1;
              setTimeout(rollOnce,600);
            } else {
              log(gp2,'Sage final attack bonus: +'+total+'.');
              finishAttackDamage(gp2,ctx);
            }
          });
        });
      };
      rollOnce();
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
    onWielderPreAttack(gp,ctx){
      const wielderUid=ctx.attacker;
      const pid=gp.inst[wielderUid].owner;
      pendPick(gp,{forId:pid,prompt:'Whiskers: choose faction for wielder this level',options:[
        {label:'Synth',value:'synth'},{label:'Mystic',value:'mystic'},{label:'Shifter',value:'shifter'},{label:'Survivor',value:'survivor'},{label:'Apex',value:'apex'}
      ]},(g,fac)=>{
        if(!fac){finishAttackDamage(g,ctx);return;}
        g.inst[wielderUid].tempFaction=fac;
        const factions=new Set();
        eachAlly(g,pid,u=>{const fc=CARDS[g.inst[u].cid];if(fc&&fc.faction)factions.add(g.inst[u].tempFaction||fc.faction);});
        const bonus=factions.size;
        g.inst[wielderUid].tempAtk=(g.inst[wielderUid].tempAtk||0)+bonus;
        log(g,'Whiskers: wielder is now '+fac+' (+'+bonus+' Atk this level).');
        finishAttackDamage(g,ctx);
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
/* Weapon-granted Block: Makeshift Shield free, Swiftpack 1999 costs ① */
['render-mq836yg3'].forEach(cid=>{
  const e=window.CATA_ABILITIES[cid]||(window.CATA_ABILITIES[cid]={});
  e.grantsActivated=(e.grantsActivated||[]).concat([makeBlockAbility(0)]);
});
['render-mq83osng'].forEach(cid=>{
  const e=window.CATA_ABILITIES[cid]||(window.CATA_ABILITIES[cid]={});
  e.grantsActivated=(e.grantsActivated||[]).concat([makeBlockAbility(1)]);
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

/* ──────── Comprehensive ability completions (audit pass) ──────── */

/* Extra Block cards: Intersentinel, Bobby Brushbacks, Clatter, Diffin (1⊙ Block), Lyra (free Block) */
['DS1-030','render-mq82ozdt','render-mq82rspr','render-mq82up5x'].forEach(cid=>{
  const e=window.CATA_ABILITIES[cid]||(window.CATA_ABILITIES[cid]={});
  e.activated=(e.activated||[]).concat([makeBlockAbility(1)]);
});
['render-mq836emw'].forEach(cid=>{
  const e=window.CATA_ABILITIES[cid]||(window.CATA_ABILITIES[cid]={});
  e.activated=(e.activated||[]).concat([makeBlockAbility(0)]);
});

/* Intersentinel: at start of each level, owner's Boss heals 1 */
(function(){
  const e=window.CATA_ABILITIES['DS1-030']||(window.CATA_ABILITIES['DS1-030']={});
  e.onLevelStart=function(gp,pid){
    const boss=gp.p[pid].boss;
    if(boss&&gp.inst[boss]&&gp.inst[boss].hp>0)healInst(gp,boss,1);
  };
})();

/* Coney, Toothfighter: on enter, may discard a card to draw; if a Fighter was discarded, +1 atk counter on Coney */
(function(){
  const e=window.CATA_ABILITIES['render-mq82se55']||(window.CATA_ABILITIES['render-mq82se55']={});
  e.onEnter=function(gp,ctx){
    const hand=gp.p[ctx.pid].hand.filter(u=>u!==ctx.src);
    if(!hand.length)return;
    pendPick(gp,{forId:ctx.pid,prompt:'Coney: discard a card to draw one?',
      options:[{label:'Yes — pick which to discard',value:'y'},{label:'No',value:''}]},
      (g,choice)=>{
        if(choice!=='y')return;
        const handNow=g.p[ctx.pid].hand.filter(u=>u!==ctx.src);
        pendPick(g,{forId:ctx.pid,prompt:'Coney: discard which card?',
          options:handNow.map(u=>({label:CARDS[g.inst[u].cid].name,value:u}))},
          (g2,discard)=>{
            if(!discard)return;
            const dCid=g2.inst[discard].cid;
            const dC=CARDS[dCid];
            moveZone(g2,ctx.pid,discard,'hand','grave');
            drawN(g2,ctx.pid,1);
            log(g2,'Coney discards '+dC.name+', draws a card.');
            if(dC.type==='fighter'){
              addCounter(g2,ctx.src,'atk',1);
              log(g2,'Fighter discarded — +1 Attack counter on Coney.');
            }
          });
      });
  };
})();

/* Dreyver, Terminarch: ②⊙ target Synth gains Agility this level */
(function(){
  const e=window.CATA_ABILITIES['render-mq82vipj']||(window.CATA_ABILITIES['render-mq82vipj']={});
  e.activated=(e.activated||[]).concat([{
    label:'\u2461\u2299: Synth +Agility this lvl',
    cost:{tap:true,coins:2},
    run(gp,ctx){
      pendTarget(gp,{forId:ctx.pid,prompt:'Dreyver: which Synth gains Agility this level?',
        filter:i=>(i.kind==='fighter'||i.kind==='boss')&&(CARDS[i.cid]||{}).faction==='synth'&&i.owner===ctx.pid},
        (g,t)=>{if(t){g.inst[t].agilityLevel=true;log(g,CARDS[g.inst[t].cid].name+' gains Agility this level.');}});
    }
  }]);
})();

/* Goodstead, Sandhog: any Fighter dies, +1 Attack counter on Goodstead */
(function(){
  const e=window.CATA_ABILITIES['render-mq8327ej']||(window.CATA_ABILITIES['render-mq8327ej']={});
  e.onAnyFighterDeath=function(gp,uid){addCounter(gp,uid,'atk',1);};
})();

/* Minka, Underestimated: same global death trigger */
(function(){
  const e=window.CATA_ABILITIES['render-mq838tf0']||(window.CATA_ABILITIES['render-mq838tf0']={});
  e.onAnyFighterDeath=function(gp,uid){addCounter(gp,uid,'atk',1);};
})();

/* Kochi, Platform Presence: onEnter heal target Fighter to max; ③⊙ team heal 1 */
(function(){
  const e=window.CATA_ABILITIES['render-mq835b15']||(window.CATA_ABILITIES['render-mq835b15']={});
  e.onEnter=function(gp,ctx){
    const tgts=allFighters(gp).filter(u=>gp.inst[u]&&gp.inst[u].hp<gp.inst[u].maxHp);
    if(!tgts.length){log(gp,'Kochi: no damaged Fighter to heal.');return;}
    pendTarget(gp,{forId:ctx.pid,prompt:'Kochi: heal which Fighter to max?',filter:i=>i.kind==='fighter'&&i.hp<i.maxHp},
      (g,t)=>{
        if(!t)return;
        const ti=g.inst[t];const heal=ti.maxHp-ti.hp;
        if(heal>0)healInst(g,t,heal);
      });
  };
  e.activated=(e.activated||[]).concat([{
    label:'\u2462\u2299: Team heals 1',
    cost:{tap:true,coins:3},
    run(gp,ctx){eachAlly(gp,ctx.pid,u=>{const i=gp.inst[u];if(i&&i.hp<i.maxHp)healInst(gp,u,1);});}
  }]);
})();

/* Sky, Unlikely Champion: ③⊙ reveal until Fighter, put it in hand */
(function(){
  const e=window.CATA_ABILITIES['render-mq83m92b']||(window.CATA_ABILITIES['render-mq83m92b']={});
  e.activated=(e.activated||[]).concat([{
    label:'\u2462\u2299: Reveal until Fighter',
    cost:{tap:true,coins:3},
    run(gp,ctx){
      const taken=[];
      while(gp.p[ctx.pid].deck.length){
        const top=gp.p[ctx.pid].deck[0];
        const tc=CARDS[gp.inst[top].cid];
        gp.p[ctx.pid].deck=gp.p[ctx.pid].deck.slice(1);
        fireReveal(gp,ctx.pid,top);
        if(tc&&tc.type==='fighter'){
          gp.p[ctx.pid].hand.push(top);
          log(gp,'Sky reveals '+tc.name+', adds to hand.');
          bottomShuffle(gp,ctx.pid,taken);
          return;
        }
        taken.push(top);
        log(gp,'Sky reveals '+(tc?tc.name:'?')+' (not a Fighter).');
      }
      bottomShuffle(gp,ctx.pid,taken);
      log(gp,'Sky: deck exhausted, no Fighter found.');
    }
  }]);
})();

/* Clatter, Cornered: when attacked, reflect 1 damage to attacker */
(function(){
  const e=window.CATA_ABILITIES['render-mq82rspr']||(window.CATA_ABILITIES['render-mq82rspr']={});
  e.onAttacked=function(gp,ctx){
    if(ctx.attacker&&gp.inst[ctx.attacker]){
      log(gp,'Clatter reflects 1 damage to '+CARDS[gp.inst[ctx.attacker].cid].name+'.');
      dealDamage(gp,ctx.attacker,1);
    }
  };
})();

/* ──────── Audit-pass corrections: per-card accuracy fixes ──────── */

/* Lyra reveal-from-deck: draws a card whenever she's revealed by any effect */
(function(){
  const e=window.CATA_ABILITIES['render-mq836emw']||(window.CATA_ABILITIES['render-mq836emw']={});
  e.onReveal=function(gp,ctx){
    drawN(gp,ctx.pid,1);
    log(gp,'Lyra revealed from deck \u2014 draw a card.');
  };
})();

/* Oriana, Cutthroat: any player discards → Oriana deals 1 dmg to target B/F (her owner picks) */
(function(){
  const e=window.CATA_ABILITIES['render-mq83cnrg']||(window.CATA_ABILITIES['render-mq83cnrg']={});
  e.onAnyDiscard=function(gp,ctx){
    const owner=ctx.pid;
    pendTarget(gp,{forId:owner,prompt:'Oriana: 1 damage to which Boss or Fighter? (any opponent discarded)',
      filter:i=>i.kind==='fighter'||i.kind==='boss'},
      (g,t)=>{if(t)dealDamage(g,t,1);});
  };
})();

/* Tryp, Timelost: when YOU discard → 1 dmg to all opposing Bosses and Fighters */
(function(){
  const e=window.CATA_ABILITIES['render-mq83siwj']||(window.CATA_ABILITIES['render-mq83siwj']={});
  const existing=e.onAttack;
  e.onAnyDiscard=function(gp,ctx){
    if(ctx.discarderPid!==ctx.pid)return;
    eachOpponent(gp,ctx.pid,oppPid=>{
      gp.p[oppPid].board.forEach(u=>{const i=gp.inst[u];if(i&&i.kind==='fighter')dealDamage(gp,u,1);});
      const bb=gp.p[oppPid].boss;if(bb&&gp.inst[bb])dealDamage(gp,bb,1);
    });
    log(gp,'Tryp deals 1 damage to all opposing Bosses and Fighters.');
  };
})();

/* Gauntlet of the Dead: when wielder attacks, reveal top card; play it OR +1 atk counter on wielder + may discard revealed */
(function(){
  const e=window.CATA_ABILITIES['render-mq83191n']||(window.CATA_ABILITIES['render-mq83191n']={});
  e.onWielderAttack=function(gp,wielderUid){
    const i=gp.inst[wielderUid];if(!i)return;
    const pid=i.owner;const top=gp.p[pid].deck[0];if(!top)return;
    const tc=CARDS[gp.inst[top].cid];
    const lvlOk=!tc.level||tc.level<=gp.level;
    const costOk=gp.p[pid].coins>=(tc.cost||0);
    const canPlay=lvlOk&&costOk;
    log(gp,'Gauntlet reveals '+tc.name+'.');
    fireReveal(gp,pid,top);
    pendPick(gp,{forId:pid,prompt:'Gauntlet revealed '+tc.name+canPlay?'. Play it now?':'. (Cannot play \u2014 level/cost). Take counter instead.',
      options:canPlay?[{label:'Play '+tc.name+' (free)',value:'play'},{label:'Decline (+1 atk counter on wielder)',value:'pass'}]
                    :[{label:'+1 atk counter on wielder',value:'pass'}]},
      (g,choice)=>{
        if(choice==='play'){
          g.p[pid].deck=g.p[pid].deck.slice(1);
          if(tc.type==='fighter'){g.p[pid].board.push(top);resetInstance(g,top);fireOnEnter(g,top,pid);fireFighterEnterFromDeck(g,pid,top);}
          else if(tc.type==='weapon'){g.p[pid].board.push(top);
            pendTarget(g,{forId:pid,prompt:'Wield '+tc.name+' to which Fighter?',filter:i=>i.kind==='fighter'&&i.owner===pid},
              (g2,f)=>{if(f)wieldWeapon(g2,top,f);});}
          else{moveZone(g,pid,top,'deck','grave');if(tc.run)tc.run(g,{pid,src:top});}
        }else{
          addCounter(g,wielderUid,'atk',1);
          pendPick(g,{forId:pid,prompt:'Discard the revealed '+tc.name+'?',
            options:[{label:'Yes \u2014 to discard',value:'y'},{label:'No \u2014 keep on top',value:''}]},
            (g2,v)=>{if(v==='y'){g2.p[pid].deck=g2.p[pid].deck.slice(1);g2.p[pid].grave.push(top);log(g2,tc.name+' moved to discard.');}});
        }
      });
  };
})();

/* Vermingus: tighten activated ability + add the triggered "Fighter enters from deck → +1 atk + 1 Health" */
(function(){
  const e=window.CATA_ABILITIES['render-mq83u22z']||(window.CATA_ABILITIES['render-mq83u22z']={});
  e.activated=[{label:'\u2461\u2299: Reveal top, play if Fighter',cost:{tap:true,coins:2},run(gp,ctx){
    const u=gp.p[ctx.pid].deck[0];if(!u){log(gp,'Deck empty.');return;}
    const c=CARDS[gp.inst[u].cid];log(gp,'Vermingus reveals '+c.name+'.');
    fireReveal(gp,ctx.pid,u);
    if(c.type==='fighter'){
      const lvlOk=!c.level||c.level<=gp.level;
      const sameNameOnTeam=gp.p[ctx.pid].board.some(x=>x!==u&&CARDS[gp.inst[x].cid]&&CARDS[gp.inst[x].cid].name===c.name);
      if(lvlOk&&!sameNameOnTeam){
        gp.p[ctx.pid].deck.shift();
        gp.p[ctx.pid].board.push(u);
        resetInstance(gp,u);
        fireOnEnter(gp,u,ctx.pid);
        fireFighterEnterFromDeck(gp,ctx.pid,u);
      } else {
        gp.p[ctx.pid].deck.shift();
        gp.p[ctx.pid].hand.push(u);
        log(gp,lvlOk?'Same-name Fighter already on team \u2014 to hand.':'Level requirement not met \u2014 to hand.');
      }
    } else {
      gp.p[ctx.pid].deck.shift();
      gp.p[ctx.pid].hand.push(u);
    }
  }}];
  e.onAnyFighterEnterFromDeck=function(gp,ctx){
    if(ctx.enteringPid!==ctx.pid)return;
    if(ctx.enteringUid===ctx.src)return;
    addCounter(gp,ctx.src,'atk',1);
    const i=gp.inst[ctx.src];if(i){i.maxHp+=1;i.hp+=1;}
    log(gp,'Vermingus: +1 Attack counter and +1 Health (Fighter entered from deck).');
  };
})();

/* ──────── Batch 2: Boss accuracy fixes ──────── */

/* Charlotte: link helpers (linkFighter, returnLinkedFighters) and dynamicAtkBonus + grantsActivated */
function linkFighter(gp,charlotteUid,defenderUid){
  const ci=gp.inst[charlotteUid];if(!ci)return;
  const di=gp.inst[defenderUid];if(!di)return;
  /* If another Fighter is already linked, send it to its owner's discard ("replaced") */
  if(ci.linkedFighter){
    const oldUid=ci.linkedFighter;const oi=gp.inst[oldUid];
    if(oi){gp.p[oi.owner].grave.push(oldUid);log(gp,'Charlotte: linked '+CARDS[oi.cid].name+' is replaced \u2014 to discard.');}
    ci.linkedFighter=null;
  }
  /* Remove defeated Fighter from grave (destroyInstance has already moved it there) */
  gp.p[di.owner].grave=gp.p[di.owner].grave.filter(u=>u!==defenderUid);
  /* Put it into the linked zone (off-board, attached to Charlotte) */
  di.hp=di.maxHp;di.linkedTo=charlotteUid;
  ci.linkedFighter=defenderUid;
  log(gp,'Charlotte links '+CARDS[di.cid].name+'.');
}
function returnLinkedFighters(gp,charlotteUid){
  const ci=gp.inst[charlotteUid];if(!ci||!ci.linkedFighter)return;
  const oldUid=ci.linkedFighter;const oi=gp.inst[oldUid];
  if(oi){gp.p[oi.owner].grave.push(oldUid);log(gp,'Charlotte dies \u2014 linked '+CARDS[oi.cid].name+' to discard.');}
  ci.linkedFighter=null;
}
(function(){
  const e=window.CATA_ABILITIES['render-mq82qy7i']||(window.CATA_ABILITIES['render-mq82qy7i']={});
  e.dynamicAtkBonus=function(gp,uid){
    const i=gp.inst[uid];if(!i||!i.linkedFighter)return 0;
    const li=gp.inst[i.linkedFighter];if(!li)return 0;
    const lc=CARDS[li.cid];return lc&&lc.atk||0;
  };
  /* Activated abilities of the linked Fighter become Charlotte's */
  e.grantsActivatedFromLinked=true; /* engine should scan and append linked Fighter's activated to Charlotte's render */
})();

/* Blades, Triumphant: ④⊙ reveal up to 2 Fighters from top 4, take to hand, rest on bottom random */
(function(){
  const e=window.CATA_ABILITIES['render-mq82ocja']||(window.CATA_ABILITIES['render-mq82ocja']={});
  e.activated=[{label:'\u2463\u2299: Look at top 4, take up to 2 Fighters',cost:{tap:true,coins:4},run(gp,ctx){
    const top=gp.p[ctx.pid].deck.slice(0,4);
    if(!top.length)return;
    top.forEach(u=>fireReveal(gp,ctx.pid,u));
    const fighters=top.filter(u=>(CARDS[gp.inst[u].cid]||{}).type==='fighter');
    if(!fighters.length){log(gp,'Blades: no Fighters in top 4. Shuffling to bottom.');bottomShuffle(gp,ctx.pid,top);gp.p[ctx.pid].deck=gp.p[ctx.pid].deck.filter(x=>!top.includes(x));return;}
    /* First pick */
    pendPick(gp,{forId:ctx.pid,prompt:'Blades: take which Fighter to hand? (1 of up to 2)',options:fighters.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})).concat([{label:'Take none \u2014 bottom-shuffle rest',value:''}])},(g,first)=>{
      if(!first){bottomShuffle(g,ctx.pid,top);g.p[ctx.pid].deck=g.p[ctx.pid].deck.filter(x=>!top.includes(x));return;}
      g.p[ctx.pid].deck=g.p[ctx.pid].deck.filter(x=>x!==first);
      g.p[ctx.pid].hand.push(first);
      log(g,'Blades reveals '+CARDS[g.inst[first].cid].name+' to hand.');
      const remaining=fighters.filter(u=>u!==first);
      if(!remaining.length){const rest=top.filter(x=>x!==first);bottomShuffle(g,ctx.pid,rest);g.p[ctx.pid].deck=g.p[ctx.pid].deck.filter(x=>!rest.includes(x));return;}
      pendPick(g,{forId:ctx.pid,prompt:'Blades: take a 2nd Fighter to hand?',options:remaining.map(u=>({label:CARDS[g.inst[u].cid].name,value:u})).concat([{label:'No \u2014 bottom-shuffle rest',value:''}])},(g2,second)=>{
        if(second){
          g2.p[ctx.pid].deck=g2.p[ctx.pid].deck.filter(x=>x!==second);
          g2.p[ctx.pid].hand.push(second);
          log(g2,'Blades reveals '+CARDS[g2.inst[second].cid].name+' to hand.');
        }
        const rest=top.filter(x=>x!==first&&x!==second);
        bottomShuffle(g2,ctx.pid,rest);
        g2.p[ctx.pid].deck=g2.p[ctx.pid].deck.filter(x=>!rest.includes(x));
      });
    });
  }}];
})();

/* Mother May Eye: ⊙ persistent top-revealed mode for rest of level + Agility when 3+ T/R played */
(function(){
  const e=window.CATA_ABILITIES['render-mq83a3v4']||(window.CATA_ABILITIES['render-mq83a3v4']={});
  /* Track when she's activated; persistent mode = topRevealed flag like Hot Mike */
  e.activated=[{label:'\u2299: Reveal top of deck this level',cost:{tap:true},run(gp,ctx){
    gp.p[ctx.pid].topRevealed=true;
    gp.p[ctx.pid].topRevealedUntilLevel=gp.level;
    log(gp,'Mother May Eye: top of '+gp.p[ctx.pid].name+'\u2019s deck revealed for the rest of this level. Tactic/Response cards on top are playable.');
  }}];
  /* Original onLevelStart: reset T/R counter + clear topRevealed if it was set last level */
  e.onLevelStart=function(gp,pid){
    gp._trPlayed=gp._trPlayed||{};gp._trPlayed[pid]=0;
    if(gp.p[pid].topRevealedUntilLevel!==undefined&&gp.p[pid].topRevealedUntilLevel<gp.level){
      gp.p[pid].topRevealed=false;delete gp.p[pid].topRevealedUntilLevel;
    }
  };
  /* Engine hook fired when a T/R card is played; we'll mark Agility on threshold via onTacticPlayed */
  e.onAnyTacticOrResponsePlayed=function(gp,pid){
    if(!gp._trPlayed)gp._trPlayed={};
    gp._trPlayed[pid]=(gp._trPlayed[pid]||0)+1;
    if(gp._trPlayed[pid]>=3){
      const boss=gp.p[pid].boss;
      if(boss&&gp.inst[boss]&&CARDS[gp.inst[boss].cid].id==='render-mq83a3v4'){
        if(!gp.inst[boss].agilityLevel){
          gp.inst[boss].agilityLevel=true;
          log(gp,'Mother May Eye gains Agility this level (3+ Tactics/Responses played).');
        }
      }
    }
  };
})();

/* Seeya, Later Gator: untargetable when 5+ Fighters (engine ✓); first-attack-each-level reveal */
(function(){
  const e=window.CATA_ABILITIES['render-mq83jdnu']||(window.CATA_ABILITIES['render-mq83jdnu']={});
  e.onAttacked=function(gp,ctx){
    const i=gp.inst[ctx.src];if(!i)return;
    i._seeyaTriggeredLevel=i._seeyaTriggeredLevel||0;
    if(i._seeyaTriggeredLevel>=gp.level)return; /* already triggered this level */
    i._seeyaTriggeredLevel=gp.level;
    const top=gp.p[i.owner].deck[0];
    if(!top){log(gp,'Seeya: deck empty.');return;}
    const tc=CARDS[gp.inst[top].cid];
    log(gp,'Seeya reveals '+tc.name+' from top.');
    fireReveal(gp,i.owner,top);
    if(tc.type==='fighter'){
      gp.p[i.owner].deck=gp.p[i.owner].deck.slice(1);
      gp.p[i.owner].hand.push(top);
      log(gp,'Seeya: '+tc.name+' to hand.');
    } else {
      log(gp,'Seeya: '+tc.name+' is not a Fighter \u2014 stays on top.');
    }
  };
})();

/* Toolshed: after creating Toolbox, prompt to wield a weapon */
(function(){
  const e=window.CATA_ABILITIES['render-mq83r7oj']||(window.CATA_ABILITIES['render-mq83r7oj']={});
  e.activated=[{label:'\u2462\u2299: Create Toolbox',cost:{tap:true,coins:3},run(gp,ctx){
    createToken(gp,ctx.pid,'render-mq83qps3');
    /* Find the newly-created Toolbox uid: most recent board entry */
    const toolbox=gp.p[ctx.pid].board.filter(u=>(CARDS[gp.inst[u].cid]||{}).id==='render-mq83qps3').pop();
    if(!toolbox)return;
    /* Find this owner's wieldable weapons in play (currently not on Toolbox) */
    const weapons=gp.p[ctx.pid].board.filter(u=>{const i=gp.inst[u];return i&&CARDS[i.cid].type==='weapon'&&(i.wielderUid!==toolbox);});
    if(!weapons.length)return;
    pendPick(gp,{forId:ctx.pid,prompt:'Toolshed: wield which Weapon to Toolbox?',options:weapons.map(u=>({label:CARDS[gp.inst[u].cid].name,value:u})).concat([{label:'Skip \u2014 don\u2019t wield',value:''}])},(g,pick)=>{
      if(pick)wieldWeapon(g,pick,toolbox);
    });
  }}];
})();

/* Mon-Sewer Mayhem: fire reveal hook for each card revealed in the search */
(function(){
  const e=window.CATA_ABILITIES['render-mq839jkk']||(window.CATA_ABILITIES['render-mq839jkk']={});
  e.activated=[{label:'\u2461\u2299: Search for Weapon',cost:{tap:true,coins:2},run(gp,ctx){
    const deck=gp.p[ctx.pid].deck;const skipped=[];let found=null;
    while(deck.length){
      const u=deck.shift();
      fireReveal(gp,ctx.pid,u);
      const c=CARDS[gp.inst[u].cid];
      if(c&&c.type==='weapon'){found=u;break;}
      skipped.push(u);
    }
    gp.p[ctx.pid].deck=shuffle(deck.concat(skipped));
    if(found){gp.p[ctx.pid].hand.push(found);log(gp,'Mon-Sewer reveals '+CARDS[gp.inst[found].cid].name+' to hand.');}
    else log(gp,'Mon-Sewer: no Weapon found.');
  }}];
})();

/* Eff with me Ammo: dynamic Agility check (rather than per-level snapshot) */
(function(){
  const e=window.CATA_ABILITIES['render-mq82wdi3']||(window.CATA_ABILITIES['render-mq82wdi3']={});
  /* Override onLevelStart to do nothing — Agility is checked dynamically via dynamicKeyword */
  e.onLevelStart=function(gp,pid){};
  e.dynamicKeyword=function(gp,uid,kw){
    if(kw!=='Agility')return false;
    const i=gp.inst[uid];if(!i)return false;
    return gp.p[i.owner].board.some(u=>(CARDS[(gp.inst[u]||{}).cid]||{}).name==='Head Rat'&&gp.inst[u].hp>0);
  };
})();

/* ──────── Batch 3: Weapon accuracy fixes ──────── */

/* Helper: build a Response Block ability that can be invoked from a weapon's grantsActivated[] */
function makeBlockGrantForWielder(coinCost){
  return {
    label: coinCost ? ('Response '+'\u2460\u2461\u2462\u2463'[coinCost-1]+'\u2299: Block') : 'Response \u2299: Block',
    cost: coinCost ? {tap:true, coins:coinCost} : {tap:true},
    run(gp,ctx){
      if(!gp.responseWindow){log(gp,'Block can only be activated during an attack response window.');return;}
      const rw=gp.responseWindow;
      const newDef=ctx.src;
      log(gp,CARDS[gp.inst[newDef].cid].name+' blocks the attack \u2014 attack retargets.');
      rw.defenderUid=newDef;
      gp.pendingAttack.defender=newDef;
    }
  };
}

/* Blast Scanner: stunned Fighter's activated abilities flow to the wielder */
(function(){
  const e=window.CATA_ABILITIES['render-mq82od0q']||(window.CATA_ABILITIES['render-mq82od0q']={});
  e.onWield=function(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Blast Scanner: stun which opposing Fighter?',
      filter:opposingFighterFilter(ctx.pid)},(g,t)=>{
        if(!t)return;
        stunInstance(g,t);
        /* Tag this weapon with the stunned Fighter's uid so the wielder picks up its abilities */
        g.inst[ctx.src]._stunnedTarget=t;
        log(g,'Blast Scanner stunned '+CARDS[g.inst[t].cid].name+' \u2014 wielder gains its activated abilities.');
      });
  };
  /* Weapon broadcasts the stunned Fighter's activated[] to its wielder via grantsActivated */
  e.dynamicGrantsActivated=function(gp,weaponUid){
    const wi=gp.inst[weaponUid];if(!wi||!wi._stunnedTarget)return[];
    const si=gp.inst[wi._stunnedTarget];if(!si||si.hp<=0||!si.stunned)return[];
    return(CARDS[si.cid]&&CARDS[si.cid].activated||[]);
  };
})();

/* Data Spike: enters with charge, +1 charge when wielder dies, +1 atk per charge */
(function(){
  const e=window.CATA_ABILITIES['render-mq82szo4']||(window.CATA_ABILITIES['render-mq82szo4']={});
  e.onWield=function(gp,ctx){
    const wi=gp.inst[ctx.src];wi.counters=wi.counters||{};
    wi.counters.charge=(wi.counters.charge||0)+1;
    log(gp,'Data Spike enters with a charge counter ('+wi.counters.charge+' total).');
  };
  /* When a Fighter wielding Data Spike dies, add charge to Data Spike */
  e.onWielderDeath=function(gp,weaponUid,wielderUid){
    const wi=gp.inst[weaponUid];if(!wi)return;
    wi.counters=wi.counters||{};
    wi.counters.charge=(wi.counters.charge||0)+1;
    log(gp,'Data Spike: wielder defeated \u2014 charge counter added ('+wi.counters.charge+' total).');
  };
  e.atkBonusForWielder=function(gp,wielderUid){
    /* Find Data Spike on wielder's wielded list, sum charge counters */
    const i=gp.inst[wielderUid];if(!i)return 0;
    let bonus=0;
    (i.wielded||[]).forEach(wu=>{
      const wi=gp.inst[wu];if(!wi)return;
      if((CARDS[wi.cid]||{}).id==='render-mq82szo4')bonus+=(wi.counters&&wi.counters.charge||0);
    });
    return bonus;
  };
})();

/* Dog-Eared Passage: draw whenever wielder attacks (not 'deals damage') */
(function(){
  const e=window.CATA_ABILITIES['render-mq82uuz1']||(window.CATA_ABILITIES['render-mq82uuz1']={});
  e.onWield=function(gp,ctx){
    const holder=gp.inst[ctx.src].wieldedBy;
    if(holder)gainKwLevel(gp,holder,'Stealthy');
  };
  e.onWielderAttack=function(gp,wielderUid){
    drawN(gp,gp.inst[wielderUid].owner,1);
    log(gp,'Dog-Eared Passage: wielder attacks \u2014 draw a card.');
  };
  /* Remove the older onWielderDealtDamage so we don't double-draw */
  e.onWielderDealtDamage=undefined;
})();

/* Face of Death: when wielder defeats a Fighter, untap the wielder */
(function(){
  const e=window.CATA_ABILITIES['render-mq82yd7b']||(window.CATA_ABILITIES['render-mq82yd7b']={});
  e.onWielderKillFighter=function(gp,wielderUid,defeatedCid){
    const wi=gp.inst[wielderUid];if(!wi)return;
    wi.actedCount=Math.max(0,(wi.actedCount||0)-1);
    log(gp,'Face of Death: wielder defeats a Fighter \u2014 untapped.');
  };
})();

/* Makeshift Shield: wielder has Armor 1 and Response ⊙: Block */
(function(){
  const e=window.CATA_ABILITIES['render-mq836yg3']||(window.CATA_ABILITIES['render-mq836yg3']={});
  /* The wielder picks up Armor via dynamic check; engine reads armor from weapon's grantsArmor too */
  e.grantsArmor=1;
  e.grantsActivated=[makeBlockGrantForWielder(0)]; /* free Block */
})();

/* Sword from Nowhere: +X attack equal to T/R in your discard */
(function(){
  const e=window.CATA_ABILITIES['render-mq83pdq7']||(window.CATA_ABILITIES['render-mq83pdq7']={});
  e.atkBonusForWielder=function(gp,wielderUid){
    const pid=gp.inst[wielderUid].owner;
    return gp.p[pid].grave.filter(u=>{const c=CARDS[gp.inst[u].cid];return c&&(c.type==='tactic'||c.type==='response');}).length;
  };
})();

/* Swiftpack / Swiftpack 1999: weapons with Agility keyword must set grantsKeyword:'agility' to actually grant Agility */
(function(){
  ['render-mq83oqvm','render-mq83osng'].forEach(cid=>{
    const e=window.CATA_ABILITIES[cid]||(window.CATA_ABILITIES[cid]={});
    e.grantsKeyword='agility';
  });
  /* Swiftpack 1999 also grants Response ①⊙: Block */
  const e=window.CATA_ABILITIES['render-mq83osng']||(window.CATA_ABILITIES['render-mq83osng']={});
  e.grantsActivated=[makeBlockGrantForWielder(1)];
})();

/* Whiskers of the Ancient: 'this attack' → 'rest of this level'; +1 atk per faction on team */
(function(){
  const e=window.CATA_ABILITIES['render-mq83v8ob']||(window.CATA_ABILITIES['render-mq83v8ob']={});
  e.onWielderAttack=function(gp,wielderUid){
    const wielder=gp.inst[wielderUid];if(!wielder)return;
    const factions=['synth','mystic','shifter','survivor','apex'];
    pendPick(gp,{forId:wielder.owner,prompt:'Whiskers: wielder becomes which faction for the rest of this level?',
      options:factions.map(f=>({label:f.charAt(0).toUpperCase()+f.slice(1),value:f}))},
      (g,fac)=>{
        const w=g.inst[wielderUid];if(w){
          w.tempFaction=fac;
          w.tempFactionLevel=g.level;
          log(g,CARDS[w.cid].name+' becomes '+fac+' for the rest of this level.');
        }
      });
  };
  e.atkBonusForWielder=function(gp,wielderUid){
    const pid=gp.inst[wielderUid].owner;
    const factions=new Set();
    gp.p[pid].board.concat([gp.p[pid].boss]).forEach(u=>{
      if(!u)return;const i=gp.inst[u];if(!i||i.hp<=0)return;
      const c=CARDS[i.cid];if(!c)return;
      const fac=i.tempFaction&&i.tempFactionLevel===gp.level?i.tempFaction:c.faction;
      if(fac)factions.add(fac);
    });
    return factions.size;
  };
})();

/* ──────── Batch 4: Apex + Survivor fighter accuracy fixes ──────── */

/* EVee, The Fixer: other Survivors' Attack Costs cost ① less */
(function(){
  const e=window.CATA_ABILITIES['render-mq82xys2']||(window.CATA_ABILITIES['render-mq82xys2']={});
  e.atkCostModForAlly=function(gp,allyUid,evueUid){
    /* If the ally is a Survivor Fighter (not EVee herself), reduce by 1 */
    if(allyUid===evueUid)return 0;
    const ai=gp.inst[allyUid];if(!ai)return 0;
    const ac=CARDS[ai.cid];if(!ac)return 0;
    if(ac.faction!=='survivor')return 0;
    if(ac.type!=='fighter')return 0;
    return -1;
  };
})();

/* Hot Mike: set persistent top-revealed mode on enter (rules say "play with top revealed") */
(function(){
  const e=window.CATA_ABILITIES['render-mq833kln']||(window.CATA_ABILITIES['render-mq833kln']={});
  e.onEnter=function(gp,ctx){
    gp.p[ctx.pid].topRevealed=true;
    gp.p[ctx.pid].topRevealedHotMike=true;
    log(gp,'Hot Mike: top of '+gp.p[ctx.pid].name+'\u2019s deck revealed while Hot Mike is in play.');
    /* Fire reveal hook for the current top card */
    const top=gp.p[ctx.pid].deck[0];
    if(top)fireReveal(gp,ctx.pid,top);
  };
  e.onDeath=function(gp,ctx){
    /* Clear if Hot Mike was the source of the reveal effect */
    if(gp.p[ctx.pid].topRevealedHotMike){
      gp.p[ctx.pid].topRevealed=false;
      delete gp.p[ctx.pid].topRevealedHotMike;
    }
  };
})();

/* Just Elias, Protector: +1 Attack if at 3 or less Health (NOT "+1 per Survivor ally") */
(function(){
  const e=window.CATA_ABILITIES['render-mq834dho']||(window.CATA_ABILITIES['render-mq834dho']={});
  e.dynamicAtkBonus=function(gp,uid){
    const i=gp.inst[uid];if(!i)return 0;
    return i.hp<=3?1:0;
  };
})();

/* Kat Five: when deals attack damage, deals that much damage to another target B/F */
(function(){
  const e=window.CATA_ABILITIES['render-mq87mx41']||(window.CATA_ABILITIES['render-mq87mx41']={});
  /* Keep the onEnter coin gain */
  e.onEnter=function(gp,ctx){
    const n=myFighters(gp,ctx.pid).filter(u=>(CARDS[gp.inst[u].cid]||{}).faction==='survivor'&&u!==ctx.src).length;
    if(n>0){gp.p[ctx.pid].coins+=n;log(gp,'Kat Five: gain '+n+' \u2299.');}
  };
  /* Use the new attacker-side dealt-damage hook (not the weapon hook) */
  e.onAttackerDealtDamage=function(gp,uid,ctx){
    if(!ctx||!ctx.amount)return;
    const dmg=ctx.amount;
    pendTarget(gp,{forId:gp.inst[uid].owner,prompt:'Kat Five carries '+dmg+' damage to which other Boss or Fighter?',
      filter:i=>(i.kind==='fighter'||i.kind==='boss')&&i.uid!==uid&&i.uid!==ctx.defender},
      (g,t)=>{if(t)dealDamage(g,t,dmg);});
  };
  /* Remove the misplaced onWielderDealtDamage (Kat isn't a weapon) */
  e.onWielderDealtDamage=undefined;
})();

/* Mister Purple: label as Response */
(function(){
  const e=window.CATA_ABILITIES['render-mq839hev']||(window.CATA_ABILITIES['render-mq839hev']={});
  e.activated=[{label:'Response \u2461\u2299: Team heals 1',cost:{tap:true,coins:2},run(gp,ctx){
    eachAlly(gp,ctx.pid,u=>{const i=gp.inst[u];if(i&&i.hp<i.maxHp)healInst(gp,u,1);});
  }}];
})();

/* Sanyang, Unerring: variable attack — spend tokens (1-4) when attacking, that becomes her attack */
(function(){
  const e=window.CATA_ABILITIES['render-mq83iod9']||(window.CATA_ABILITIES['render-mq83iod9']={});
  e.dynamicAtk=function(gp,uid){
    const i=gp.inst[uid];if(!i)return 0;
    return i._sanyangAtkSet||0;
  };
  /* Custom attack-prep activated: spend N coins (1-4) to set her attack for next attack */
  e.activated=[{label:'\u2460-\u2463\u2299: Prepare attack (set ATK)',cost:{},run(gp,ctx){
    pendPick(gp,{forId:ctx.pid,prompt:'Sanyang: spend how many tokens to attack? (Becomes her Attack this attack)',
      options:[
        {label:'\u2460 \u2299 — 1 Attack',value:'1'},
        {label:'\u2461 \u2299 — 2 Attack',value:'2'},
        {label:'\u2462 \u2299 — 3 Attack',value:'3'},
        {label:'\u2463 \u2299 — 4 Attack',value:'4'},
        {label:'Cancel',value:''}
      ]},(g,v)=>{
        if(!v)return;
        const n=parseInt(v,10);
        if(g.p[ctx.pid].coins<n){log(g,'Not enough \u2299 to spend '+n+'.');return;}
        g.p[ctx.pid].coins-=n;
        g.inst[ctx.src]._sanyangAtkSet=n;
        log(g,'Sanyang: prepared to attack with '+n+' Attack (spent '+n+' \u2299). Click ATK to commit.');
      });
  }}];
  /* Clear after attack */
  e.onAttack=function(gp,ctx){
    const i=gp.inst[ctx.src];if(i)i._sanyangAtkSet=0;
  };
  /* Keep the onEnter coin gain */
  e.onEnter=function(gp,ctx){gp.p[ctx.pid].coins+=2;log(gp,'Sanyang: gain \u2461.');};
})();

/* Trouble, Forerunner: ALSO increase ability costs (not just atk costs) of OTHER B/F */
(function(){
  const e=window.CATA_ABILITIES['render-mq83senr']||(window.CATA_ABILITIES['render-mq83senr']={});
  e.abilityCostModForAlly=function(gp,allyUid,troubleUid){
    return allyUid===troubleUid?0:1;
  };
  /* onAttackKill already wired */
})();

/* Turner, Straphanger: restrict +1 counter to ALLY Survivor Fighter (not opponent's) */
(function(){
  const e=window.CATA_ABILITIES['render-mq83t4ak']||(window.CATA_ABILITIES['render-mq83t4ak']={});
  e.onEnter=function(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Turner: +1 Attack counter on which Survivor Fighter on your team?',
      filter:i=>i.kind==='fighter'&&(CARDS[i.cid]||{}).faction==='survivor'&&i.owner===ctx.pid},
      (g,t)=>{if(t)addCounter(g,t,'atk',1);});
  };
})();

/* ──────── Batch 5: Mystic fighter accuracy fixes ──────── */

/* Axel, Deathracer: Agility only while Phantasmal (not always) */
(function(){
  const e=window.CATA_ABILITIES['render-mq82n695']||(window.CATA_ABILITIES['render-mq82n695']={});
  e.dynamicKeyword=function(gp,uid,kw){
    if(kw!=='Agility')return false;
    const i=gp.inst[uid];if(!i)return false;
    return !!i.phantasmal;
  };
  /* Override activated: don't redundantly call gainKwLevel (dynamicKeyword handles it now) */
  e.activated=[{label:'\u2460: Phantasmal',cost:{coins:1},run(gp,ctx){
    const i=gp.inst[ctx.src];
    if(i.phantasmal){log(gp,'Axel is already Phantasmal.');return;}
    i.phantasmal=true;
    i.counters=i.counters||{};i.counters.atk=(i.counters.atk||0)+1;
    log(gp,'Axel becomes Phantasmal (+1 Attack counter, gains Agility while Phantasmal).');
  }}];
})();

/* DeeLux, Brutal Savant: grant Agility/Determination/Enforcer (not Stealthy!) */
(function(){
  const e=window.CATA_ABILITIES['render-mq82tt5b']||(window.CATA_ABILITIES['render-mq82tt5b']={});
  e.activated=[{label:'\u2461\u2299: +1 atk & grant keyword',cost:{tap:true,coins:2},run(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'DeeLux: +1 atk on which Fighter on your team?',
      filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(g,t)=>{
      if(!t)return;addCounter(g,t,'atk',1);
      pendPick(g,{forId:ctx.pid,prompt:'DeeLux: grant which keyword this level?',
        options:[{label:'Agility (tap twice/level)',value:'Agility'},
                 {label:'Determination (1 HP + counter on death)',value:'Determination'},
                 {label:'Enforcer (must be attacked first)',value:'Enforcer'}]},
        (g2,kw)=>{if(kw)gainKwLevel(g2,t,kw);});
    });
  }}];
})();

/* Ebb, Balancer of Scales: +1 atk while any B/F on your team has a counter */
(function(){
  const e=window.CATA_ABILITIES['render-mq82vp7e']||(window.CATA_ABILITIES['render-mq82vp7e']={});
  e.dynamicAtkBonus=function(gp,uid){
    const i=gp.inst[uid];if(!i)return 0;
    const pid=i.owner;
    const has=gp.p[pid].board.concat([gp.p[pid].boss]).some(u=>{
      if(!u)return false;const ii=gp.inst[u];if(!ii)return false;
      const c=ii.counters||{};return Object.keys(c).some(k=>c[k]>0);
    });
    return has?1:0;
  };
  /* Keep the onEnter prompt — already correct */
})();

/* Flecks, Accelerator: filter is BOSS OR FIGHTER for the activated (not just Fighter) */
(function(){
  const e=window.CATA_ABILITIES['render-mq82zd5k']||(window.CATA_ABILITIES['render-mq82zd5k']={});
  e.activated=[{label:'\u2460\u2299: B/F Atk Cost \u2192 \u2460 this level',cost:{tap:true,coins:1},run(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Flecks: target Boss or Fighter\u2014Atk Cost becomes \u2460 this level',
      filter:i=>i.kind==='fighter'||i.kind==='boss'},(g,t)=>{
        if(t){g.inst[t]._costOverride=1;log(g,CARDS[g.inst[t].cid].name+' Atk Cost = \u2460 this level.');}
      });
  }}];
  /* Keep onEnter as-is — text says "target Fighter" for the enter trigger */
})();

/* Knap, Forgemaster: label needs "Response" prefix so the response window detects it */
(function(){
  const e=window.CATA_ABILITIES['render-mq834zdf']||(window.CATA_ABILITIES['render-mq834zdf']={});
  e.activated=[{label:'Response \u2461\u2299: Unwield a Weapon',cost:{tap:true,coins:2},run(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Knap: which Weapon to unwield?',
      filter:i=>(CARDS[i.cid]||{}).type==='weapon'&&gp.inst[i.uid].wieldedBy},(g,w)=>{
        if(!w)return;
        const wInst=g.inst[w];const owner=wInst.owner;
        unwieldWeapon(g,w);
        log(g,CARDS[wInst.cid].name+' unwielded.');
        if(owner===ctx.pid)drawN(g,ctx.pid,1);
      });
  }}];
})();

/* Dette, Quickener: trigger on becoming Phantasmal (will work for self-activated AND any future external Phantasmal source) */
(function(){
  const e=window.CATA_ABILITIES['render-mq82ueab']||(window.CATA_ABILITIES['render-mq82ueab']={});
  e.activated=[{label:'\u2460: Phantasmal (+ heal trigger)',cost:{coins:1},run(gp,ctx){
    const i=gp.inst[ctx.src];
    if(i.phantasmal){log(gp,'Dette is already Phantasmal.');return;}
    i.phantasmal=true;
    i.counters=i.counters||{};i.counters.atk=(i.counters.atk||0)+1;
    log(gp,'Dette becomes Phantasmal (+1 Attack counter).');
    /* Fire the "becomes Phantasmal" trigger */
    if(e.onBecomePhantasmal)e.onBecomePhantasmal(gp,ctx);
  }}];
  e.onBecomePhantasmal=function(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Dette becomes Phantasmal: which ally Fighter gains 2 Health?',
      filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},
      (g,t)=>{if(t)gainHealth(g,t,2);});
  };
})();

/* Sage, Fair Fighter: use rollDieVisible for the d6 roll so player sees it */
(function(){
  const e=window.CATA_ABILITIES['render-mq83i27x']||(window.CATA_ABILITIES['render-mq83i27x']={});
  e.preAttack=function(gp,ctx){
    /* Per text: "When Sage attacks, roll a six-sided die. If you roll 4 or higher,
       Sage gets +1 Attack this level and roll again." Use animated dice. */
    function rollOnce(){
      rollDieVisible(6,'Sage rolls d6',(r)=>{
        log(gp,'Sage rolls a '+r+'.');
        if(r>=4){
          setTempAtk(gp,ctx.src,1);
          log(gp,'Sage: +1 Attack this level. Rolling again.');
          rollOnce();
        } else {
          /* End of chain → proceed with the attack */
          finishAttackDamage(gp,ctx);
        }
      });
    }
    rollOnce();
  };
  e.onAttack=undefined; /* Switched to preAttack so the +1 atk applies before damage */
})();

/* ──────── Batch 6: Shifter fighter accuracy fixes ──────── */

/* Clatter: remove duplicate onDamaged that referenced wrong sourceUid; onAttacked already wired */
(function(){
  const e=window.CATA_ABILITIES['render-mq82rspr']||(window.CATA_ABILITIES['render-mq82rspr']={});
  /* onAttacked already wired in Batch 1: reflects 1 dmg to attacker. Just nuke onDamaged here */
  e.onDamaged=undefined;
})();

/* Gordo, Collector: trigger only if YOUR Fighter died this level (not any player's) */
(function(){
  const e=window.CATA_ABILITIES['render-mq832cs4']||(window.CATA_ABILITIES['render-mq832cs4']={});
  e.onEnter=function(gp,ctx){
    const myDeaths=(gp.fighterDeathsThisLevel||{})[ctx.pid]||0;
    if(myDeaths<=0){log(gp,'Gordo: no Fighter on your team died this level. No damage.');return;}
    pendTarget(gp,{forId:ctx.pid,prompt:'Gordo: deal 2 damage to whom?',
      filter:i=>i.kind==='fighter'||i.kind==='boss'},
      (g,t)=>{if(t)dealDamage(g,t,2);});
  };
})();

/* Joe Strummage: each player MUST discard (forced, not optional) */
(function(){
  const e=window.CATA_ABILITIES['render-mq8347x5']||(window.CATA_ABILITIES['render-mq8347x5']={});
  e.onEnter=function(gp,ctx){
    /* Queue forced discards for every player who has cards */
    const targets=gp.order.filter(pid=>!gp.p[pid].defeated&&gp.p[pid].hand.length);
    function step(i){
      if(i>=targets.length)return;
      const pid=targets[i];
      pendDiscardForced(gp,{pid},'Joe Strummage: '+gp.p[pid].name+', discard a card.',(g)=>{step.call(null,i+1);});
    }
    step(0);
  };
})();

/* Kupp Lightpaws: opponent's discard is forced */
(function(){
  const e=window.CATA_ABILITIES['render-mq835m7t']||(window.CATA_ABILITIES['render-mq835m7t']={});
  e.onEnter=function(gp,ctx){
    const opps=gp.order.filter(p=>p!==ctx.pid&&!gp.p[p].defeated);
    if(!opps.length)return;
    if(opps.length===1){
      pendDiscardForced(gp,{pid:opps[0]},'Kupp Lightpaws: '+gp.p[opps[0]].name+', discard a card.');
    } else {
      pendPick(gp,{forId:ctx.pid,prompt:'Kupp Lightpaws: which opponent must discard?',
        options:opps.map(p=>({label:gp.p[p].name,value:p}))},
        (g,pid)=>{if(pid)pendDiscardForced(g,{pid},gp.p[pid].name+': discard a card (Kupp Lightpaws).');});
    }
  };
})();

/* Muck, Relentless Foe: Atk Cost = current HP (in addition to Atk = HP) */
(function(){
  const e=window.CATA_ABILITIES['render-mq83apbe']||(window.CATA_ABILITIES['render-mq83apbe']={});
  e.dynamicAtkCost=function(gp,uid){
    const i=gp.inst[uid];return i?(i.hp||0):0;
  };
  /* dynamicAtk and onAttackKill already wired correctly */
})();

/* Mumbly Peg: forced discard */
(function(){
  const e=window.CATA_ABILITIES['render-mq83arej']||(window.CATA_ABILITIES['render-mq83arej']={});
  e.onEnter=function(gp,ctx){
    const opps=gp.order.filter(pid=>pid!==ctx.pid&&!gp.p[pid].defeated);
    if(!opps.length)return;
    if(opps.length===1){
      pendDiscardForced(gp,{pid:opps[0]},'Mumbly Peg: '+gp.p[opps[0]].name+', discard a card.');
    } else {
      pendPick(gp,{forId:ctx.pid,prompt:'Mumbly Peg: which opponent must discard?',
        options:opps.map(p=>({label:gp.p[p].name,value:p}))},
        (g,pid)=>{if(pid)pendDiscardForced(g,{pid},gp.p[pid].name+': discard a card.');});
    }
  };
})();

/* Pilskin, Slithering Striker: carry damage to another B/F when deals attack damage */
(function(){
  const e=window.CATA_ABILITIES['render-mq83e6ta']||(window.CATA_ABILITIES['render-mq83e6ta']={});
  /* Keep the onEnter double-stun */
  e.onAttackerDealtDamage=function(gp,uid,ctx){
    if(!ctx||!ctx.amount)return;
    const dmg=ctx.amount;
    pendTarget(gp,{forId:gp.inst[uid].owner,prompt:'Pilskin carries '+dmg+' damage to which other Boss or Fighter?',
      filter:i=>(i.kind==='fighter'||i.kind==='boss')&&i.uid!==uid&&i.uid!==ctx.defender},
      (g,t)=>{if(t)dealDamage(g,t,dmg);});
  };
})();

/* Ryle, Unchecked: rewire — onDamaged (engine ✓) + onAttackerDealtDamage (self-damage 2) */
(function(){
  const e=window.CATA_ABILITIES['render-mq83i0g1']||(window.CATA_ABILITIES['render-mq83i0g1']={});
  e.onDamaged=function(gp,ctx){
    /* engine passes {pid, src, amount}. src is Ryle's uid */
    if(!ctx||!ctx.amount)return;
    pendTarget(gp,{forId:gp.inst[ctx.src].owner,prompt:'Ryle: deal '+ctx.amount+' damage to whom?',
      filter:i=>(i.kind==='fighter'||i.kind==='boss')&&i.uid!==ctx.src},
      (g,t)=>{if(t)dealDamage(g,t,ctx.amount);});
  };
  e.onAttackerDealtDamage=function(gp,uid,ctx){
    /* "When Ryle deals attack damage, deal 2 damage to Ryle" */
    if(ctx&&ctx.amount>0){
      log(gp,'Ryle: deals attack damage \u2014 takes 2 damage to self.');
      dealDamage(gp,uid,2);
    }
  };
  /* Remove the wrong weapon hook */
  e.onWielderDealtDamage=undefined;
})();

/* Vigo the Sharp: +1 Attack per player who discarded a card this level */
(function(){
  const e=window.CATA_ABILITIES['render-mq83unlz']||(window.CATA_ABILITIES['render-mq83unlz']={});
  e.dynamicAtkBonus=function(gp,uid){
    if(!gp.discardedPlayersThisLevel)return 0;
    return Object.keys(gp.discardedPlayersThisLevel).filter(p=>gp.discardedPlayersThisLevel[p]).length;
  };
})();

/* ──────── Batch 7: Synth fighter accuracy fixes ──────── */

/* Ahna, Demodulator: switch to onAttacked (knows attacker) + persistent stun across one level */
(function(){
  const e=window.CATA_ABILITIES['render-mq82mt2o']||(window.CATA_ABILITIES['render-mq82mt2o']={});
  /* The text: "Bosses or Fighters that deal attack damage to Ahna become stunned.
     They do not unstun the following level." So we fire AFTER damage was dealt (not just attack declared).
     The engine fires onAttacked BEFORE damage and onDamaged AFTER. Use onDamaged with the resp window context. */
  e.onDamaged=function(gp,ctx){
    /* engine context: {pid, src, amount}. src is Ahna's uid. We need the attacker.
       Source of damage isn't directly passed — but during finishAttackDamage, gp.responseWindow
       still has the attacker uid. After window closes, this is gone. Use a fallback: gp.pendingAttack. */
    const atkUid=(gp.responseWindow&&gp.responseWindow.attackerUid)||(gp.pendingAttack&&gp.pendingAttack.attacker);
    if(!atkUid||!gp.inst[atkUid])return;
    const ai=gp.inst[atkUid];
    if(ai.kind!=='fighter'&&ai.kind!=='boss')return;
    stunInstance(gp,atkUid);
    ai._stunPersist=gp.level+1; /* survives the NEXT level reset */
    log(gp,'Ahna: '+CARDS[ai.cid].name+' is stunned and stays stunned next level.');
  };
  /* Keep activated ② Stun Fighter — already correct */
})();

/* Father, Annihilator: "wields weapons for no cost" — apply via a special cost modifier */
(function(){
  const e=window.CATA_ABILITIES['render-mq82yhl3']||(window.CATA_ABILITIES['render-mq82yhl3']={});
  e.wieldCostMod=function(gp,fatherUid){return -999;}; /* signal: any wield is free for Father */
  /* Already wired the Response ② Destroy ability in earlier batch */
})();

/* Fishhooks: vanilla Enforcer ONLY — the prior onEnter incorrectly buffed all opposing Fighters! */
(function(){
  const e=window.CATA_ABILITIES['render-mq82yuv1']||(window.CATA_ABILITIES['render-mq82yuv1']={});
  e.onEnter=undefined;
  /* Enforcer keyword auto-detected from text; nothing else needed */
})();

/* Mahna, Soft Speaker: first enhancement (Fortify, counter, OR wielded weapon) triggers draw */
(function(){
  const e=window.CATA_ABILITIES['render-mq836hy5']||(window.CATA_ABILITIES['render-mq836hy5']={});
  function triggerIfFirst(gp,pid){
    gp.p[pid].board.forEach(u=>{
      const i=gp.inst[u];if(!i||i.cid!=='render-mq836hy5')return;
      if(i._mahnaTriggered)return;
      const enhanced=(i.counters&&i.counters.atk>0)||(i.wielded&&i.wielded.length)||(i.maxHp>(CARDS[i.cid]||{}).hp);
      if(enhanced){
        i._mahnaTriggered=true;
        drawN(gp,pid,1);
        log(gp,'Mahna: first enhancement \u2192 draw a card.');
      }
    });
  }
  e.onCounterPlaced=function(gp,pid){triggerIfFirst(gp,pid);};
  e.onAnyWeaponWielded=function(gp,pid){triggerIfFirst(gp,pid);};
  e.onAnyFortify=function(gp,pid){triggerIfFirst(gp,pid);};
})();

/* Pia, Laser Focused: destroy an *enhancement*, not the whole card. Pick from counter/weapon/fortification. */
(function(){
  const e=window.CATA_ABILITIES['render-mq83dkku']||(window.CATA_ABILITIES['render-mq83dkku']={});
  e.onEnter=function(gp,ctx){
    /* Build list of enhancements owned by Pia's owner */
    const enhancements=[];
    gp.p[ctx.pid].board.concat([gp.p[ctx.pid].boss]).forEach(u=>{
      if(!u)return;const i=gp.inst[u];if(!i)return;
      const c=CARDS[i.cid];if(!c)return;
      if(i.counters&&i.counters.atk>0){
        enhancements.push({label:'Remove +1 atk counter from '+c.name,value:'ctr:'+u});
      }
      (i.wielded||[]).forEach(wu=>{
        const wc=CARDS[(gp.inst[wu]||{}).cid];if(wc)enhancements.push({label:'Destroy '+wc.name+' (wielded to '+c.name+')',value:'wpn:'+wu});
      });
      /* Fortifications: search for any inst whose fortifiedUnder=u */
      Object.keys(gp.inst).forEach(fu=>{
        const fi=gp.inst[fu];
        if(fi&&fi.fortifiedUnder===u&&fi.owner===ctx.pid){
          const fc=CARDS[fi.cid];if(fc)enhancements.push({label:'Remove Fortified '+fc.name+' from under '+c.name,value:'frt:'+fu});
        }
      });
    });
    if(!enhancements.length){log(gp,'Pia: no enhancements to destroy. No draw.');return;}
    pendPick(gp,{forId:ctx.pid,prompt:'Pia: destroy an enhancement to draw a card?',
      options:enhancements.concat([{label:'Skip',value:''}])},
      (g,pick)=>{
        if(!pick)return;
        const [kind,uid]=pick.split(':');
        if(kind==='ctr'){
          const i=g.inst[uid];if(i&&i.counters&&i.counters.atk>0){i.counters.atk-=1;log(g,'Pia: removed +1 Attack counter from '+CARDS[i.cid].name+'.');}
        } else if(kind==='wpn'){
          const wi=g.inst[uid];if(wi){if(wi.wieldedBy){const h=g.inst[wi.wieldedBy];if(h)h.wielded=(h.wielded||[]).filter(x=>x!==uid);}
            destroyInstance(g,uid,{skipFortify:true});log(g,'Pia: destroyed wielded Weapon.');}
        } else if(kind==='frt'){
          const fi=g.inst[uid];if(fi){fi.fortifiedUnder=null;g.p[ctx.pid].grave.push(uid);log(g,'Pia: '+CARDS[fi.cid].name+' removed from Fortification to discard.');}
        }
        drawN(g,ctx.pid,1);
      });
  };
})();

/* ──────── Batch 8: Tactic accuracy fixes ──────── */

/* Aha!: "Discard a card. Draw two cards." — forced discard, not optional */
(function(){
  const e=window.CATA_ABILITIES['render-mq82m6em']||(window.CATA_ABILITIES['render-mq82m6em']={});
  e.run=function(gp,ctx){
    if(!gp.p[ctx.pid].hand.length){
      /* No cards to discard — still draw 2 per "after discard" reading. Most reasonable interpretation. */
      drawN(gp,ctx.pid,2);log(gp,'Aha!: no cards to discard, drawing 2.');
      return;
    }
    pendDiscardForced(gp,ctx,'Aha!: discard a card.',(g)=>{drawN(g,ctx.pid,2);});
  };
})();

/* Decisive Victory: only count boss if alive */
(function(){
  const e=window.CATA_ABILITIES['render-mq82tevl']||(window.CATA_ABILITIES['render-mq82tevl']={});
  e.run=function(gp,ctx){
    const bossUid=gp.p[ctx.pid].boss;
    const bossAlive=bossUid&&gp.inst[bossUid]&&gp.inst[bossUid].hp>0;
    const n=myFighters(gp,ctx.pid).length+(bossAlive?1:0);
    pendTarget(gp,{forId:ctx.pid,prompt:'Decisive Victory: deal '+n+' damage to which Fighter?',
      filter:fighterTargetFilter()},(g,t)=>{if(t)dealDamage(g,t,n);});
  };
})();

/* Fluorescent Fall: enforce "Fighters with those names can't be replayed this level by those players" */
(function(){
  const e=window.CATA_ABILITIES['render-mq83035u']||(window.CATA_ABILITIES['render-mq83035u']={});
  e.run=function(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Fluorescent Fall: return which ally Fighter to hand?',
      filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(g,t1)=>{
        if(!t1){log(g,'Fluorescent Fall: no ally Fighter selected.');return;}
        const c1=CARDS[g.inst[t1].cid];const owner1=g.inst[t1].owner;
        moveZone(g,owner1,t1,'board','hand');
        /* Stamp the level-block for this name on this player */
        g.p[owner1]._cantReplayThisLevel=g.p[owner1]._cantReplayThisLevel||{};
        g.p[owner1]._cantReplayThisLevel[c1.name]=g.level;
        log(g,c1.name+' returned to hand; cannot be replayed this level.');
        pendTarget(g,{forId:ctx.pid,prompt:'Return which opposing Fighter to its owner\u2019s hand?',
          filter:i=>i.kind==='fighter'&&i.owner!==ctx.pid},(g2,t2)=>{
            if(!t2)return;
            const c2=CARDS[g2.inst[t2].cid];const owner2=g2.inst[t2].owner;
            moveZone(g2,owner2,t2,'board','hand');
            g2.p[owner2]._cantReplayThisLevel=g2.p[owner2]._cantReplayThisLevel||{};
            g2.p[owner2]._cantReplayThisLevel[c2.name]=g2.level;
            log(g2,c2.name+' returned to '+g2.p[owner2].name+'\u2019s hand; cannot be replayed this level.');
          });
      });
  };
})();

/* Malefice: deal damage equal to weapon's LEVEL (not atkMod) */
(function(){
  const e=window.CATA_ABILITIES['render-mq8374uc']||(window.CATA_ABILITIES['render-mq8374uc']={});
  e.run=function(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Malefice: destroy which Weapon?',
      filter:i=>(CARDS[i.cid]||{}).type==='weapon'},(g,w)=>{
        if(!w)return;
        const wInst=g.inst[w];const wc=CARDS[wInst.cid];
        const dmg=wc.level||0;
        const wielder=wInst.wieldedBy;
        destroyInstance(g,w,{skipFortify:true});
        if(wielder&&g.inst[wielder]&&dmg>0){
          log(g,'Malefice: '+CARDS[g.inst[wielder].cid].name+' takes '+dmg+' damage (weapon level).');
          dealDamage(g,wielder,dmg);
        }
      });
  };
})();

/* Mimeoscoped: create a token copy of target Fighter, dies end of level, name "Mimeoscope",
   if Synth gain Agility. Stats copied from source (atk, hp, atkCost, faction, level, sub, keywords, activated). */
(function(){
  const e=window.CATA_ABILITIES['render-mq838ccz']||(window.CATA_ABILITIES['render-mq838ccz']={});
  e.run=function(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Mimeoscoped: copy which Fighter on your team?',
      filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},(g,t)=>{
        if(!t)return;
        const src=g.inst[t];const sc=CARDS[src.cid];if(!sc)return;
        /* Build a synthetic CARDS entry on the fly for this token */
        const tokenCid='_mimeo_'+t+'_'+g.level;
        CARDS[tokenCid]={
          id:tokenCid,kind:'token',type:'fighter',
          name:'Mimeoscope',faction:sc.faction,sub:sc.sub,level:sc.level,
          hp:sc.hp,atk:sc.atk,atkCost:sc.atkCost,cost:0,
          keywords:(sc.keywords||[]).slice(),
          activated:(sc.activated||[]).slice(),
          dynamicAtk:sc.dynamicAtk,dynamicAtkBonus:sc.dynamicAtkBonus,
          attackerMod:sc.attackerMod,defenderMod:sc.defenderMod,
          onEnter:undefined,/* don't re-fire onEnter on token */
          diesEndOfLevel:true,
          img:sc.img,
          text:'(Token copy of '+sc.name+', dies at end of level.)'
        };
        /* Synth gets Agility */
        if(sc.faction==='synth'&&!CARDS[tokenCid].keywords.includes('Agility')){
          CARDS[tokenCid].keywords.push('Agility');
        }
        /* Create the instance */
        const tokUid=newInstance(g,tokenCid,ctx.pid);
        g.p[ctx.pid].board.push(tokUid);resetInstance(g,tokUid);
        log(g,'Mimeoscoped creates token copy of '+sc.name+'.');
      });
  };
})();

/* Power Play: check BOTH targets for Mystic (the text says "If you dealt damage to a Mystic this way") */
(function(){
  const e=window.CATA_ABILITIES['render-mq83esvh']||(window.CATA_ABILITIES['render-mq83esvh']={});
  e.run=function(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Power Play: 1 damage to which ally B/F?',
      filter:i=>(i.kind==='fighter'||i.kind==='boss')&&i.owner===ctx.pid},(g,t1)=>{
        let mysticHit=false;
        if(t1){
          const fac1=(CARDS[g.inst[t1].cid]||{}).faction;
          dealDamage(g,t1,1);
          if(fac1==='mystic')mysticHit=true;
        }
        pendTarget(g,{forId:ctx.pid,prompt:'Power Play: 3 damage to which opposing B/F?',
          filter:i=>(i.kind==='fighter'||i.kind==='boss')&&i.owner!==ctx.pid},(g2,t2)=>{
            if(t2){
              const fac2=(CARDS[g2.inst[t2].cid]||{}).faction;
              dealDamage(g2,t2,3);
              if(fac2==='mystic')mysticHit=true;
            }
            if(mysticHit){drawN(g2,ctx.pid,1);log(g2,'Power Play: damaged a Mystic \u2014 draw a card.');}
          });
      });
  };
})();

/* Steel Swipe: only count boss if alive */
(function(){
  const e=window.CATA_ABILITIES['render-mq83o77a']||(window.CATA_ABILITIES['render-mq83o77a']={});
  e.run=function(gp,ctx){
    const bossUid=gp.p[ctx.pid].boss;
    const bossAlive=bossUid&&gp.inst[bossUid]&&gp.inst[bossUid].hp>0;
    const bossFac=bossAlive?(CARDS[gp.inst[bossUid].cid]||{}).faction:null;
    const n=bossFac==='shifter'?3:2;
    pendTarget(gp,{forId:ctx.pid,prompt:'Steel Swipe: deal '+n+' damage to whom?',
      filter:i=>i.kind==='fighter'||i.kind==='boss'},(g,t)=>{if(t)dealDamage(g,t,n);});
  };
})();

/* ──────── Batch 9 (final): Response card accuracy fixes ──────── */

/* Don't Bury Me...: counter removal only applies if target is a Fighter (per "that Fighter" wording) */
(function(){
  const e=window.CATA_ABILITIES['render-mq82v2l0']||(window.CATA_ABILITIES['render-mq82v2l0']={});
  e.run=function(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Don\u2019t Bury Me: heal 3 to which Boss or Fighter?',
      filter:i=>i.kind==='fighter'||i.kind==='boss'},(g,t)=>{
        if(!t)return;
        healInst(g,t,3);
        /* "Remove all -1 Attack counters from that Fighter" — only if target is a Fighter */
        const ti=g.inst[t];
        if(ti.kind==='fighter'&&ti.counters&&ti.counters.atk<0){
          const removed=-ti.counters.atk;
          ti.counters.atk=0;
          drawN(g,ctx.pid,1);
          log(g,'Don\u2019t Bury Me: removed '+removed+' -1 Attack counter(s) from '+CARDS[ti.cid].name+' \u2014 draw a card.');
        }
      });
  };
})();

/* Mystery Meat: target gains Agility this level; if Survivor, also reduce Atk Cost by ① this level */
(function(){
  const e=window.CATA_ABILITIES['render-mq83c0mv']||(window.CATA_ABILITIES['render-mq83c0mv']={});
  e.run=function(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Mystery Meat: Agility this level to whom?',
      filter:i=>i.kind==='fighter'||i.kind==='boss'},(g,t)=>{
        if(!t)return;
        gainKwLevel(g,t,'Agility');
        /* If Survivor: reduce Atk Cost by ① this level (use _costOverride with current cost - 1) */
        const tc=CARDS[g.inst[t].cid];
        if(tc&&tc.faction==='survivor'){
          const baseCost=tc.atkCost||0;
          const ti=g.inst[t];
          ti._costOverride=Math.max(0,baseCost-1);
          log(g,'Mystery Meat: '+tc.name+' is Survivor \u2014 Atk Cost reduced by \u2460 this level.');
        }
      });
  };
})();

/* Signal Jam: change target of a Tactic or Response card that has only one target */
(function(){
  const e=window.CATA_ABILITIES['render-mq83kyb0']||(window.CATA_ABILITIES['render-mq83kyb0']={});
  e.run=function(gp,ctx){
    /* The card redirects a pending single-target effect that's currently mid-resolution.
       Look for a pending `target` prompt; if there's one and it's of kind 'target', re-prompt for a new target. */
    if(!gp.pending||gp.pending.kind!=='target'){
      log(gp,'Signal Jam: nothing currently waiting for a single target. (Play this in response to a single-target spell.)');
      return;
    }
    /* Re-prompt the same selection but on this player's choice. The previous filter is preserved. */
    log(gp,'Signal Jam: redirecting target of pending effect.');
    /* Save the old callback */
    const oldCb=S.pendingCb;
    const oldPrompt=gp.pending.prompt;
    gp.pending={kind:'target',forId:ctx.pid,prompt:'Signal Jam: choose NEW target ('+oldPrompt+')',valid:gp.pending.valid};
    /* The callback signature is the same; the redirect just changes who picks */
    S.pendingCb=oldCb;
  };
})();

/* ──────── Faction-colored stun lightning: pass source faction to stunInstance ──────── */
(function(){
  /* Blast Scanner (synth weapon) — stun colored synth-orange */
  const e1=window.CATA_ABILITIES['render-mq82od0q']||(window.CATA_ABILITIES['render-mq82od0q']={});
  e1.onWield=function(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Blast Scanner: stun which opposing Fighter?',
      filter:opposingFighterFilter(ctx.pid)},(g,t)=>{
        if(!t)return;
        stunInstance(g,t,'synth');
        g.inst[ctx.src]._stunnedTarget=t;
        log(g,'Blast Scanner stunned '+CARDS[g.inst[t].cid].name+'.');
      });
  };

  /* Ahna, Demodulator (synth) — stuns are synth-orange */
  const e2=window.CATA_ABILITIES['render-mq82mt2o']||(window.CATA_ABILITIES['render-mq82mt2o']={});
  e2.onDamaged=function(gp,ctx){
    const atkUid=(gp.responseWindow&&gp.responseWindow.attackerUid)||(gp.pendingAttack&&gp.pendingAttack.attacker);
    if(!atkUid||!gp.inst[atkUid])return;
    const ai=gp.inst[atkUid];
    if(ai.kind!=='fighter'&&ai.kind!=='boss')return;
    stunInstance(gp,atkUid,'synth');
    ai._stunPersist=gp.level+1;
    log(gp,'Ahna: '+CARDS[ai.cid].name+' is stunned and stays stunned next level.');
  };
  e2.activated=[{label:'\u2461\u2299: Stun target Fighter',cost:{tap:true,coins:2},run(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Ahna: stun which Fighter?',filter:fighterTargetFilter()},
      (g,t)=>{if(t)stunInstance(g,t,'synth');});
  }}];

  /* Orson, Quickstinger (shifter) — stuns are shifter-blue */
  const e3=window.CATA_ABILITIES['render-mq83d04m']||(window.CATA_ABILITIES['render-mq83d04m']={});
  e3.onEnter=function(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Orson: stun which Fighter?',filter:fighterTargetFilter()},
      (g,t)=>{if(t)stunInstance(g,t,'shifter');});
  };

  /* Pilskin, Slithering Striker (shifter) — stuns are shifter-blue */
  const e4=window.CATA_ABILITIES['render-mq83e6ta']||(window.CATA_ABILITIES['render-mq83e6ta']={});
  const prevPilskin=e4.onEnter;
  e4.onEnter=function(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Pilskin: stun which Fighter? (1 of up to 2)',filter:fighterTargetFilter()},(g,t1)=>{
      if(t1){
        stunInstance(g,t1,'shifter');
        pendTarget(g,{forId:ctx.pid,prompt:'Pilskin: stun a different Fighter? (skip ok)',filter:i=>i.kind==='fighter'&&i.uid!==t1},
          (g2,t2)=>{if(t2)stunInstance(g2,t2,'shifter');});
      }
    });
  };
})();

/* ──────── Batch 1 (re-audit): Boss completion fixes ──────── */

/* Eff with me Ammo: switch _gainedKw to dynamicKeyword (engine actually reads dynamicKeyword) */
(function(){
  const e=window.CATA_ABILITIES['render-mq82wdi3']||(window.CATA_ABILITIES['render-mq82wdi3']={});
  e.dynamicKeyword=function(gp,uid,kw){
    if(kw!=='Agility')return false;
    const i=gp.inst[uid];if(!i)return false;
    return gp.p[i.owner].board.some(u=>{const ii=gp.inst[u];return ii&&(CARDS[ii.cid]||{}).name==='Head Rat'&&ii.hp>0;});
  };
  /* Remove the dead onLevelStart that wrote i._gainedKw (engine doesn't read it) */
  e.onLevelStart=undefined;
})();

/* Seeya, Later Gator: first time attacked each level, reveal top of deck.
   If Fighter, put it in hand. */
(function(){
  const e=window.CATA_ABILITIES['render-mq83jdnu']||(window.CATA_ABILITIES['render-mq83jdnu']={});
  e.onAttacked=function(gp,ctx){
    const i=gp.inst[ctx.src];if(!i)return;
    if(i._seeyaRevealedLevel===gp.level)return; /* already revealed this level */
    i._seeyaRevealedLevel=gp.level;
    const pid=i.owner;const deck=gp.p[pid].deck;if(!deck.length){log(gp,'Seeya: deck empty.');return;}
    const top=deck.shift();const tc=CARDS[gp.inst[top].cid];
    fireReveal(gp,pid,top);
    if(tc&&tc.type==='fighter'){
      gp.p[pid].hand.push(top);
      log(gp,'Seeya reveals '+tc.name+' (Fighter) \u2014 to hand.');
    } else {
      deck.push(top); /* not a Fighter: back on top? Rules unclear — go to bottom (most generous reading) */
      log(gp,'Seeya reveals '+((tc&&tc.name)||'?')+' (not a Fighter) \u2014 returns to deck.');
    }
  };
  e._info=undefined;
})();

/* Sky, Unlikely Champion: atk cost reduced by ① per Survivor Fighter on team + ③⊙: search Fighter */
(function(){
  const e=window.CATA_ABILITIES['render-mq83m92b']||(window.CATA_ABILITIES['render-mq83m92b']={});
  e.dynamicAtkCost=function(gp,uid){
    const i=gp.inst[uid];if(!i)return null;
    const base=(CARDS[i.cid]||{}).atkCost||0;
    const survivors=gp.p[i.owner].board.filter(u=>{const ii=gp.inst[u];return ii&&ii.kind==='fighter'&&ii.hp>0&&(CARDS[ii.cid]||{}).faction==='survivor';}).length;
    return Math.max(0,base-survivors);
  };
  e.activated=[{label:'\u2462\u2299: Search deck for Fighter',cost:{tap:true,coins:3},run(gp,ctx){
    const deck=gp.p[ctx.pid].deck;const skipped=[];let found=null;
    while(deck.length){
      const u=deck.shift();const c=CARDS[gp.inst[u].cid];
      if(c&&c.type==='fighter'){found=u;fireReveal(gp,ctx.pid,u);break;}
      skipped.push(u);
    }
    gp.p[ctx.pid].deck=shuffle(deck.concat(skipped));
    if(found){gp.p[ctx.pid].hand.push(found);log(gp,'Sky reveals '+CARDS[gp.inst[found].cid].name+' (Fighter) \u2014 to hand.');}
    else log(gp,'Sky: no Fighter in deck. Shuffled.');
  }}];
})();

/* Tryp, Timelost: whenever you discard one or more cards, deals 1 damage to all opposing B/F */
(function(){
  const e=window.CATA_ABILITIES['render-mq83siwj']||(window.CATA_ABILITIES['render-mq83siwj']={});
  /* The src param is the Tryp instance, ctx.discarderPid is the player who discarded.
     "Whenever you discard" — only when Tryp's owner discards. */
  e.onAnyDiscard=function(gp,ctx){
    const i=gp.inst[ctx.src];if(!i)return;
    if(ctx.discarderPid!==i.owner)return;
    Object.keys(gp.p).forEach(pid=>{
      if(pid===i.owner||gp.p[pid].defeated)return;
      gp.p[pid].board.concat([gp.p[pid].boss]).forEach(u=>{
        if(!u)return;const ti=gp.inst[u];if(!ti||ti.hp<=0)return;
        if(ti.kind==='fighter'||ti.kind==='boss')dealDamage(gp,u,1);
      });
    });
    log(gp,'Tryp: discard \u2192 1 damage to all opposing Bosses & Fighters.');
  };
  /* Keep existing onAttack (optional discard) */
  e._info=undefined;
})();

/* Mother May Eye: count T/R plays per level + Agility when 3+ + activated reveals top card playable */
(function(){
  const e=window.CATA_ABILITIES['render-mq83a3v4']||(window.CATA_ABILITIES['render-mq83a3v4']={});
  /* dynamicAtkBonus already in place reads gp._trPlayed[pid] */
  /* Track plays via onAnyTacticOrResponsePlayed */
  e.onAnyTacticOrResponsePlayed=function(gp,pid){
    const i=gp.inst[gp.p[pid].boss];if(!i||(CARDS[i.cid]||{}).id!=='render-mq83a3v4')return;
    gp._trPlayed=gp._trPlayed||{};
    gp._trPlayed[pid]=(gp._trPlayed[pid]||0)+1;
  };
  /* Dynamic Agility if 3+ T/R played this level */
  e.dynamicKeyword=function(gp,uid,kw){
    if(kw!=='Agility')return false;
    const i=gp.inst[uid];if(!i)return false;
    return ((gp._trPlayed&&gp._trPlayed[i.owner])||0)>=3;
  };
  /* Activated: reveal top of deck; if it's a Tactic or Response, play it for free */
  e.activated=[{label:'\u2299: Reveal top \u2014 play if Tactic/Response',cost:{tap:true},run(gp,ctx){
    const top=gp.p[ctx.pid].deck[0];
    if(!top){log(gp,'Mother May Eye: deck empty.');return;}
    const tc=CARDS[gp.inst[top].cid];if(!tc){log(gp,'Mother May Eye: reveals nothing.');return;}
    fireReveal(gp,ctx.pid,top);
    if(tc.type==='tactic'||tc.type==='response'){
      pendPick(gp,{forId:ctx.pid,prompt:'Mother May Eye: top of deck is '+tc.name+'. Play for free?',
        options:[{label:'Yes \u2014 play it',value:'y'},{label:'No (leave on top)',value:''}]},
        (g,v)=>{
          if(v==='y'){
            g.p[ctx.pid].deck.shift();
            /* Run as if played from hand: invoke ability run() if defined */
            const ent=window.CATA_ABILITIES[tc.id];
            if(ent&&ent.run)ent.run(g,{pid:ctx.pid,src:top});
            else if(tc.onPlay)tc.onPlay(g,{pid:ctx.pid,src:top});
            g.p[ctx.pid].grave.push(top);
            log(g,'Mother May Eye: played '+tc.name+' free from deck.');
            /* This counts as a T/R play */
            if(e.onAnyTacticOrResponsePlayed)e.onAnyTacticOrResponsePlayed(g,ctx.pid);
          } else {
            log(g,'Mother May Eye: '+tc.name+' stays on top of deck.');
          }
        });
    } else {
      log(gp,'Mother May Eye: top of deck is '+tc.name+' (not Tactic/Response). Stays revealed.');
    }
  }}];
})();

/* ──────── Batch 2 (re-audit): Weapon completion fixes ──────── */

/* Dog-Eared Passage: text says "Whenever the wielder attacks, draw a card."
   Switch from onWielderDealtDamage to onWielderAttack — fires on attack declaration
   regardless of whether damage actually lands (Block redirect, stops). */
(function(){
  const e=window.CATA_ABILITIES['render-mq82uuz1']||(window.CATA_ABILITIES['render-mq82uuz1']={});
  e.onWielderDealtDamage=undefined;
  e.onWielderAttack=function(gp,wielderUid){
    const wi=gp.inst[wielderUid];if(!wi)return;
    drawN(gp,wi.owner,1);
    log(gp,'Dog-Eared Passage: wielder attacks \u2192 draw a card.');
  };
})();

/* Gauntlet of the Dead: full impl per text.
   "When the wielder attacks, reveal the top card of your deck. You may play that card
    this level for its token cost or if the level requirement is met. If you don't,
    put a +1 Attack counter on the wielder and you may put the revealed card in your discard pile." */
(function(){
  const e=window.CATA_ABILITIES['render-mq83191n']||(window.CATA_ABILITIES['render-mq83191n']={});
  e.onWielderAttack=function(gp,wielderUid){
    const wi=gp.inst[wielderUid];if(!wi)return;
    const pid=wi.owner;const deck=gp.p[pid].deck;if(!deck.length){log(gp,'Gauntlet: deck empty.');return;}
    const topUid=deck[0];const topInst=gp.inst[topUid];if(!topInst)return;
    const topCard=CARDS[topInst.cid];if(!topCard)return;
    fireReveal(gp,pid,topUid);
    const canPlay=(topCard.type!=='fighter'||(topCard.level||0)<=gp.level);
    const playLabel='Play '+topCard.name+(topCard.cost?' (cost \u2460'.repeat(topCard.cost)+')':' (free)');
    const opts=[];
    if(canPlay&&gp.p[pid].coins>=(topCard.cost||0))opts.push({label:playLabel,value:'play'});
    opts.push({label:'Skip \u2014 put +1 Attack counter on wielder',value:'skip'});
    pendPick(gp,{forId:pid,prompt:'Gauntlet of the Dead reveals '+topCard.name+'.',options:opts},
      (g,choice)=>{
        if(choice==='play'){
          /* Pay cost, play the card */
          g.p[pid].coins=Math.max(0,g.p[pid].coins-(topCard.cost||0));
          g.p[pid].deck.shift();
          if(topCard.type==='fighter'){
            g.p[pid].board.push(topUid);resetInstance(g,topUid);
            fireOnEnter(g,topUid,pid);
            log(g,'Gauntlet: played '+topCard.name+' from top of deck.');
          } else if(topCard.type==='weapon'){
            /* Weapons need a wielder — prompt */
            const fighters=myFighters(g,pid);
            if(!fighters.length){g.p[pid].grave.push(topUid);log(g,'Gauntlet: no Fighter to wield to. Weapon goes to discard.');return;}
            pendPick(g,{forId:pid,prompt:'Wield '+topCard.name+' to which Fighter?',
              options:fighters.map(u=>({label:CARDS[g.inst[u].cid].name,value:u}))},
              (g2,wielder)=>{
                if(wielder){g2.p[pid].board.push(topUid);resetInstance(g2,topUid);wieldWeapon(g2,topUid,wielder);}
                else{g2.p[pid].grave.push(topUid);log(g2,'Gauntlet: weapon discarded.');}
              });
          } else {
            /* Tactic or Response — run the ability and send to grave */
            const ent=window.CATA_ABILITIES[topCard.id];
            if(ent&&ent.run)ent.run(g,{pid,src:topUid});
            g.p[pid].grave.push(topUid);
            log(g,'Gauntlet: played '+topCard.name+' from top of deck.');
          }
        } else {
          /* Skip: +1 atk counter + optional discard of the revealed card */
          addCounter(g,wielderUid,'atk',1);
          log(g,'Gauntlet: +1 Attack counter on wielder.');
          pendPick(g,{forId:pid,prompt:'Discard the revealed '+topCard.name+'?',
            options:[{label:'Yes \u2014 to discard',value:'y'},{label:'No \u2014 stays on top',value:''}]},
            (g2,v)=>{
              if(v==='y'){
                g2.p[pid].deck.shift();
                g2.p[pid].grave.push(topUid);
                log(g2,'Gauntlet: '+topCard.name+' to discard.');
              }
            });
        }
      });
  };
})();

/* ──────── Batch 3 (re-audit): Apex+Survivor fighter completion fixes ──────── */

/* Just Elias, Protector: text says "Enforcer. Just Elias gets +1 Attack if he has 3 or less Health."
   Was: dynamicAtkBonus counted Survivor allies (wrong impl entirely). Fix: +1 when his HP ≤ 3. */
(function(){
  const e=window.CATA_ABILITIES['render-mq834dho']||(window.CATA_ABILITIES['render-mq834dho']={});
  e.dynamicAtkBonus=function(gp,uid){
    const i=gp.inst[uid];if(!i)return 0;
    return i.hp<=3?1:0;
  };
})();

/* Kochi, Platform Presence: text says
   "When Kochi enters play, heal target Fighter to its maximum Health.
    When Kochi heals a Boss or Fighter, he deals damage to target Fighter equal to the total amount healed.
    ③⊙: Your team heals 1." */
(function(){
  const e=window.CATA_ABILITIES['render-mq835b15']||(window.CATA_ABILITIES['render-mq835b15']={});
  /* onEnter: heal target Fighter to full, then deal damage = amount healed */
  e.onEnter=function(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Kochi: heal which Fighter to full?',filter:fighterTargetFilter()},(g,t)=>{
      if(!t)return;
      const i=g.inst[t];const before=i.hp;
      i.hp=i.maxHp;
      const healed=i.hp-before;
      log(g,'Kochi heals '+CARDS[i.cid].name+' for '+healed+' (to full).');
      if(healed>0){
        /* "When Kochi heals a Boss or Fighter, he deals damage to target Fighter equal to total amount healed" */
        pendTarget(g,{forId:ctx.pid,prompt:'Kochi: deal '+healed+' damage to which Fighter?',filter:fighterTargetFilter()},
          (g2,t2)=>{if(t2)dealDamage(g2,t2,healed);});
      }
    });
  };
  /* Activated: ③⊙ Your team heals 1 */
  e.activated=[{label:'\u2462\u2299: Team heals 1',cost:{tap:true,coins:3},run(gp,ctx){
    eachAlly(gp,ctx.pid,u=>healInst(gp,u,1));
    log(gp,'Kochi: team heals 1.');
  }}];
})();

/* Turner, Straphanger: pendTarget filter now requires Survivor Fighter on YOUR team */
(function(){
  const e=window.CATA_ABILITIES['render-mq83t4ak']||(window.CATA_ABILITIES['render-mq83t4ak']={});
  e.onEnter=function(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Turner: +1 Attack counter on which Survivor Fighter on your team?',
      filter:i=>i.kind==='fighter'&&i.owner===ctx.pid&&(CARDS[i.cid]||{}).faction==='survivor'},
      (g,t)=>{if(t)addCounter(g,t,'atk',1);});
  };
})();

/* ──────── Batch 4 (re-audit): Mystic fighter completion fixes ──────── */

/* Stat, Mirage Master: enters as copy of another Fighter, but keeps Stat's name, Attack Cost, and Attack.
   Was: called undefined copyStatsOnto, crashes. Now: synthetic-CARDS-clone pattern (same approach as Mimeoscoped). */
(function(){
  const e=window.CATA_ABILITIES['render-mq83njzn']||(window.CATA_ABILITIES['render-mq83njzn']={});
  e.onEnter=function(gp,ctx){
    const targets=allBoard(gp).filter(u=>u!==ctx.src&&gp.inst[u]&&gp.inst[u].kind==='fighter'&&gp.inst[u].hp>0);
    if(!targets.length){log(gp,'Stat: no Fighter to copy.');return;}
    pendPick(gp,{forId:ctx.pid,prompt:'Stat: enter as a copy of which Fighter?',
      options:targets.map(u=>({label:CARDS[gp.inst[u].cid].name+' (HP '+gp.inst[u].maxHp+')',value:u}))},
      (g,t)=>{
        if(!t)return;
        const ti=g.inst[t];const tc=CARDS[ti.cid];if(!tc)return;
        const statC=CARDS['render-mq83njzn'];
        const cloneCid='_stat_'+ctx.src+'_'+g.level;
        /* Build a clone of the model's CARDS entry, override name/atk/atkCost from Stat */
        CARDS[cloneCid]=Object.assign({},tc,{
          id:cloneCid,
          name:statC.name,
          atk:statC.atk,
          atkCost:statC.atkCost,
          /* keep model's: hp, keywords, activated, dynamicAtkBonus, attackerMod, defenderMod, staticBuff,
             grantsKeyword, faction, type, kind, level, sub */
          onEnter:undefined /* don't refire onEnter when we swap cid */
        });
        /* Swap Stat's instance over to the clone */
        g.inst[ctx.src].cid=cloneCid;
        /* Re-resolve HP to match the model's printed HP */
        g.inst[ctx.src].maxHp=tc.hp;g.inst[ctx.src].hp=tc.hp;
        log(g,'Stat enters as a copy of '+tc.name+' (keeps Stat\u2019s name/atk/atkCost).');
      });
  };
  e._info=undefined;
})();

/* Axel, Deathracer: Agility while Phantasmal — also wire dynamicKeyword so it's
   accurate at all times (gainKwLevel only sets it once at Phantasmal-flip, fine but redundant). */
(function(){
  const e=window.CATA_ABILITIES['render-mq82n695']||(window.CATA_ABILITIES['render-mq82n695']={});
  e.dynamicKeyword=function(gp,uid,kw){
    if(kw!=='Agility')return false;
    const i=gp.inst[uid];return!!(i&&i.phantasmal);
  };
})();

/* Dette, Quickener: text says "When Dette becomes Phantasmal, target Fighter on your team gains 2 Health."
   The text doesn't say "another" — so Dette herself is a valid target. Just verify impl uses Fighter filter. */
/* (No engine change needed — leave existing impl which already prompts ally Fighter target.) */

/* Shaman of Eternity: engine already restricts onCounterPlaced to +1 atk counters (game.js line 439).
   No additional fix needed — verified. */

/* ──────── Batch 5 (re-audit): Shifter fighter completion fixes ──────── */

/* Clatter, Cornered: text says "When Clatter is dealt damage by an attack, he deals 1 damage to
   the attacking Boss or Fighter." Was: used (gp, uid, sourceUid) — engine doesn't pass sourceUid.
   Fix: read attacker from gp.pendingAttack/responseWindow (same pattern as Ahna). */
(function(){
  const e=window.CATA_ABILITIES['render-mq82rspr']||(window.CATA_ABILITIES['render-mq82rspr']={});
  e.onDamaged=function(gp,ctx){
    if(!ctx||!ctx.amount)return;
    /* "by an attack" — only fires during attack resolution */
    const atkUid=(gp.responseWindow&&gp.responseWindow.attackerUid)||(gp.pendingAttack&&gp.pendingAttack.attacker);
    if(!atkUid||!gp.inst[atkUid])return;
    const ai=gp.inst[atkUid];if(ai.kind!=='fighter'&&ai.kind!=='boss')return;
    dealDamage(gp,atkUid,1);
    log(gp,'Clatter: deals 1 damage back to '+(CARDS[ai.cid]||{name:'?'}).name+'.');
  };
})();

/* Gordo, Collector: text says "if a Fighter on YOUR team died this level".
   Was: used global gp.fighterLeftThisLevel — fires even if an OPPONENT's Fighter died.
   Fix: read from per-player gp.fighterDeathsThisLevel[ctx.pid]. */
(function(){
  const e=window.CATA_ABILITIES['render-mq832cs4']||(window.CATA_ABILITIES['render-mq832cs4']={});
  e.onEnter=function(gp,ctx){
    const myDeaths=(gp.fighterDeathsThisLevel||{})[ctx.pid]||0;
    if(myDeaths===0){log(gp,'Gordo: no Fighter on your team died this level \u2014 no damage.');return;}
    pendTarget(gp,{forId:ctx.pid,prompt:'Gordo: deal 2 damage to which Boss or Fighter?',
      filter:bossOrFighterFilter()},(g,t)=>{if(t)dealDamage(g,t,2);});
  };
})();

/* Joe Strummage: text says "When Joe enters play, each player discards a card. Joe can only
   attack if you have one or fewer cards in hand." Was: optional discard for each player, no
   attack restriction. Fix: force discard (per text), add per-card attack restriction in engine. */
(function(){
  const e=window.CATA_ABILITIES['render-mq8347x5']||(window.CATA_ABILITIES['render-mq8347x5']={});
  e.onEnter=function(gp,ctx){
    gp.order.forEach(pid=>{
      if(gp.p[pid].defeated||!gp.p[pid].hand.length)return;
      pendDiscardForced(gp,{pid},gp.p[pid].name+' must discard a card (Joe Strummage)',()=>{});
    });
  };
  /* The attack restriction is checked in engine playHandCard via a per-cid check. */
})();

/* ──────── Batch 6 (re-audit): Synth fighter completion fixes ──────── */

/* Fishhooks: text says only "Enforcer." — nothing else. Was: spurious onEnter giving +1 Attack
   to all opposing Fighters with no rules basis. Remove it. */
(function(){
  const e=window.CATA_ABILITIES['render-mq82yuv1']||(window.CATA_ABILITIES['render-mq82yuv1']={});
  e.onEnter=undefined;
})();

/* Dreyver, Terminarch: text says "Attack Costs AND activated abilities of other Synth Fighters and
   Bosses on your team cost ① less (Costs can't be less than ①.) ②⊙: Target Synth gains Agility this level."
   Was: only atkCostModForAlly wired. Add abilityCostModForAlly + the ②⊙ activated. */
(function(){
  const e=window.CATA_ABILITIES['render-mq82vipj']||(window.CATA_ABILITIES['render-mq82vipj']={});
  /* Attack-cost mod was already there; add ability-cost mod with same Synth-ally filter */
  e.abilityCostModForAlly=function(gp,allyUid,dreyverUid){
    if(allyUid===dreyverUid)return 0;
    const c=CARDS[gp.inst[allyUid].cid];if(!c)return 0;
    if(c.faction!=='synth')return 0;
    return -1;
  };
  /* ②⊙: Target Synth gains Agility this level */
  e.activated=[{label:'\u2461\u2299: Target Synth gains Agility this level',cost:{tap:true,coins:2},run(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Dreyver: grant Agility this level to which Synth?',
      filter:i=>(i.kind==='fighter'||i.kind==='boss')&&(CARDS[i.cid]||{}).faction==='synth'},
      (g,t)=>{if(t)gainKwLevel(g,t,'Agility');});
  }}];
})();

/* ──────── Batch 7 (re-audit): Tactic completion fixes ──────── */

/* Roll Call: text says "Draw a card for each Fighter with A COUNTER on it on your team."
   Was: only counted Fighters with +1 atk counters (counters.atk > 0).
   Fix: count Fighters with ANY counter (atk positive OR negative, charge, etc.) */
(function(){
  const e=window.CATA_ABILITIES['render-mq83hedv']||(window.CATA_ABILITIES['render-mq83hedv']={});
  e.run=function(gp,ctx){
    pendPick(gp,{forId:ctx.pid,prompt:'Roll Call: choose effect',
      options:[
        {label:'Distribute up to 5 +1 Attack counters',value:'distr'},
        {label:'Draw a card for each ally Fighter with a counter',value:'draw'}
      ]},(g,choice)=>{
        if(!choice)return;
        if(choice==='distr'){
          const give=(g2,n)=>{
            if(n===0)return;
            pendTarget(g2,{forId:ctx.pid,prompt:'+1 Attack counter to which ally Fighter? ('+n+' left, may Skip)',
              filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},
              (g3,t)=>{if(t){addCounter(g3,t,'atk',1);give(g3,n-1);}});
          };
          give(g,5);
        } else {
          /* Count Fighters with ANY counter, not just +1 atk */
          const n=myFighters(g,ctx.pid).filter(u=>{
            const ic=g.inst[u].counters;if(!ic)return false;
            return Object.keys(ic).some(k=>ic[k]!==0);
          }).length;
          if(n>0){drawN(g,ctx.pid,n);log(g,'Roll Call: '+n+' ally Fighter(s) with counters \u2014 drew '+n+' card(s).');}
          else log(g,'Roll Call: no ally Fighters with counters \u2014 drew 0.');
        }
      });
  };
})();

/* Flipping Out: text says "Deal 4 damage to UP TO TWO different target B/F."
   Add explicit Skip on first target (current relies on null fallthrough). */
(function(){
  const e=window.CATA_ABILITIES['render-mq82zkhm']||(window.CATA_ABILITIES['render-mq82zkhm']={});
  e.run=function(gp,ctx){
    pendTarget(gp,{forId:ctx.pid,prompt:'Flipping Out: 4 damage to which Boss/Fighter? (may Skip)',
      filter:bossOrFighterFilter()},(g,t1)=>{
        if(!t1){log(g,'Flipping Out: no targets selected.');return;}
        dealDamage(g,t1,4);
        pendTarget(g,{forId:ctx.pid,prompt:'Flipping Out: second (different) target? (may Skip)',
          filter:i=>(i.kind==='fighter'||i.kind==='boss')&&i.uid!==t1},
          (g2,t2)=>{if(t2)dealDamage(g2,t2,4);});
      });
  };
})();

/* ──────── Batch 7 (re-audit): Tactic accuracy refinements ──────── */

/* Roll Call: text says "draw a card for each Fighter WITH A COUNTER on it on your team."
   Was: filtered to counters.atk > 0 (positive only). Per text, "a counter" means any
   non-zero counter — including -1 atk counters from Echo Fade. Fix to non-zero. */
(function(){
  const e=window.CATA_ABILITIES['render-mq83hedv']||(window.CATA_ABILITIES['render-mq83hedv']={});
  e.run=function(gp,ctx){
    pendPick(gp,{forId:ctx.pid,prompt:'Roll Call: choose effect',
      options:[{label:'Distribute 5 +1 Attack counters',value:'distr'},
               {label:'Draw a card for each Fighter on your team with a counter',value:'draw'}]},
      (g,choice)=>{
        if(choice==='distr'){
          const give=(g2,n)=>{if(n===0)return;
            pendTarget(g2,{forId:ctx.pid,prompt:'+1 Attack to which ally Fighter? ('+n+' left)',
              filter:i=>i.kind==='fighter'&&i.owner===ctx.pid},
              (g3,t)=>{if(t){addCounter(g3,t,'atk',1);give(g3,n-1);}});};
          give(g,5);
        } else {
          const n=myFighters(g,ctx.pid).filter(u=>{const i=g.inst[u];return i.counters&&i.counters.atk!==0;}).length;
          if(n>0){drawN(g,ctx.pid,n);log(g,'Roll Call: '+n+' Fighter(s) with counters \u2014 drew '+n+' card(s).');}
          else log(g,'Roll Call: no Fighters with counters on your team.');
        }
      });
  };
})(); 
