const assert = require('node:assert/strict');
const { createGame } = require('./harness.cjs');

// Initial placement is a combat fixture. From encounter activation to victory,
// the bot only reads telegraphs and uses real controls: no health, equipment,
// positions or boss states are changed during either fight.
const controller = `function combatBot(){
 const b=currentBoss(); if(!b||!b.alive)return;
 const centre=b.x+b.w/2, pc=player.x+player.w/2, distance=Math.abs(centre-pc);
 const side=b.x-b.recipe.left<190?1:b.recipe.right-(b.x+b.w)<190?-1:pc<centre?-1:1;
 const desired=side<0?Math.max(b.recipe.left+20,b.x-160):Math.min(b.recipe.right-60,b.x+b.w+130);
 setControl('left',player.x>desired+15);setControl('right',player.x<desired-15);setControl('run',true);
 // Keep facing the core while holding a ranged weapon.
 if(Math.abs(player.x-desired)<=15) {setControl('left',pc>centre&&player.facing!==-1);setControl('right',pc<centre&&player.facing!==1);}
 setControl('attack',bossIsOpen(b));setControl('bark',false);setControl('dash',false);
 const dangerous=distance<110 || b.bossState==='charge'&&distance<225 || b.bossState==='tell'&&b.nextMove==='charge'&&b.bossTimer<15;
 const wave=bossHazards.some(h=>h.hostile&&h.kind==='wave'&&Math.abs(h.x-pc)<110);
 if(player.grounded&&(dangerous||wave)){setControl('jump',false);setControl('jump',true);}
 else if(player.vy>0)setControl('jump',false);
 if(!player.grounded&&dangerous&&player.vy>0&&player.airJumps>0){setControl('jump',false);setControl('jump',true);}
 if(player.grounded&&distance<90&&player.dashCooldown===0&&player.barkEnergy>=25)setControl('dash',true);
 if(bossHazards.some(h=>h.hostile&&h.kind!=='wave'&&h.delay<=0&&Math.hypot(h.x-pc,h.y-player.y)<175))setControl('bark',true);
 if(b.bossState==='tell'&&b.nextMove==='volley'&&distance<200&&player.barkCooldown===0)setControl('bark',true);
 }`;
for (const stage of ['orchard', 'castle']) {
  const game = createGame();
  game.run(`startGame(true, '${stage}');
    player.x = currentBoss().recipe.left + 120;
    player.y = GROUND - player.h; player.prevY = player.y;`);
  game.run(controller);
  let frames = 0;
  const phases = new Set();
  while (frames++ < 7200 && game.run('state') === 'playing' && game.run('currentBoss().alive')) {
    game.run('combatBot(); step()');
    phases.add(game.run('currentBoss().bossPhase'));
  }
  assert.equal(game.run('currentBoss().alive'), false, `${stage}: real attacks should defeat the boss`);
  assert.equal(game.run('stageDeaths'), 0, `${stage}: the encounter should be beatable without retrying`);
  assert.deepEqual([...phases], [1, 2, 3], `${stage}: the fight must progress through all phases`);
  game.run(`releaseAllControls(); setControl('right', true); setControl('run', true);`);
  for (let index = 0; index < 300 && game.run('state') === 'playing'; index++) game.step();
  assert.equal(game.run('state'), 'won', `${stage}: the defeated boss must open a reachable exit`);
  console.log(`✓ ${stage}: three boss phases defeated with real inputs in ${(frames / 60).toFixed(1)}s, exit reached`);
}
