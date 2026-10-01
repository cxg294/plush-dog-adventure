const assert = require('node:assert/strict');
const { createGame } = require('./harness.cjs');

// A small input-only bot validates the main route. It uses the same controls as
// a player: no teleports, terrain edits, free equipment or invulnerability.
const controller = `
  function routeControls() {
    setControl('right', true); setControl('run', true); setControl('attack', true);
    setControl('dash', false); setControl('bark', false);
    const front = player.x + player.w, feet = player.y + player.h;
    const solidAhead = solids().filter(solid => !solid.oneWay && solid.type !== 'spring'
      && solid.x + solid.w > front + 1 && solid.x - front < 105
      && solid.y < feet - 8 && solid.y + solid.h > player.y + 3);
    const groundBelow = overGround(player);
    const piece = zone.groundPieces.find(piece => front >= piece.x && front <= piece.x + piece.w);
    const nearGap = piece && piece.x + piece.w - front < 72;
    const hazardAhead = (zone.hazards || []).some(hazard => hazard.x + hazard.w > front
      && hazard.x - front < 90 && (hazard.type === 'spikes' || hazard.active || hazard.warning));
    const nearbyEnemy = enemies.find(enemy => enemy.alive && !enemy.isBoss
      && enemy.x + enemy.w > player.x && enemy.x - front < 125
      && Math.abs(enemy.y + enemy.h - feet) < 85);
    const pickupAhead = powerups.some(item => !item.taken && item.x + item.w > front
      && item.x - front < 20 && item.x - front > -20
      && item.y < feet - 30 && item.y + item.h > player.y - 130);
    if (nearbyEnemy && player.barkCooldown === 0 && player.barkEnergy >= 35) setControl('bark', true);
    if (player.vy >= -.2) setControl('jump', false);
    if (player.grounded && (solidAhead.length || nearGap || hazardAhead || pickupAhead || !groundBelow)) {
      setControl('jump', false); setControl('jump', true);
    } else if (!player.grounded && player.vy >= 0 && player.airJumps > 0
      && (!groundBelow || solidAhead.some(solid => solid.x - front < 40))) {
      setControl('jump', false); setControl('jump', true);
    }
    if (!player.grounded && !groundBelow && player.vy > 0 && feet > GROUND - 85
      && player.airJumps === 0 && !player.airDashUsed) setControl('dash', true);
  }
`;

let failures = 0;
for (const stage of ['surface', 'orchard', 'sky', 'castle']) {
  const game = createGame();
  game.run(controller);
  game.run(`startGame(true, '${stage}')`);
  let furthest = 0;
  let previousLives = 3;
  let reached = false;
  let frames = 0;
  const retries = [];
  for (; frames < 4000; frames++) {
    const status = game.run('state');
    if (status === 'won' || game.run('activeBossArena() !== null')) { reached = true; break; }
    if (status === 'gameover') break;
    if (status === 'respawn') {
      retries.push(game.run('Math.round(player.x)'));
      game.flushTimers(1000);
      continue;
    }
    game.run('routeControls()');
    game.step();
    furthest = Math.max(furthest, game.run('player.x'));
    previousLives = game.run('lives');
  }
  const result = {
    stage, reached, seconds: Math.round(frames / 60 * 10) / 10,
    x: Math.round(game.run('player.x')), furthest: Math.round(furthest),
    hp: game.run('player.hp'), hits: game.run('stageHits'), lives: previousLives, retries,
  };
  console.log(JSON.stringify(result));
  if (!reached) failures++;
}
assert.equal(failures, 0, 'every main route should reach a flag or a boss arena using ordinary controls');
