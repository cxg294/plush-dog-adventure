const assert = require('node:assert/strict');
const { createGame } = require('./harness.cjs');
const { context, run } = createGame();

run('startGame()');
run("setControl('right', true)");
for (let i = 0; i < 35; i++) run('step()');
assert(run('player.x') > 160, 'right movement should advance the player');
assert.equal(run('state'), 'playing', 'the starting area should stay safe');

run('startGame()');
run('player.x = 11 * T + 4; player.y = GROUND - 4 * T + T + 1; player.vy = -15; player.grounded = false');
run('step()');
assert.equal(run('coinCount'), 1, 'hitting a question block should release a coin');
assert(run('blocks.find(block => block.x === 11 * T).used'), 'the block should become spent');

run('startGame()');
run('player.x = enemySeeds[0].x; player.y = GROUND - 63; player.vy = 3; player.grounded = false');
run('step()');
assert.equal(run('enemies[0].alive'), false, 'landing on an enemy should defeat it');
assert.equal(run('score'), 100);

run('startGame()');
run('player.shield = true; player.x = enemySeeds[0].x; player.y = GROUND - player.h');
run('step()');
assert.equal(run('player.shield'), false, 'the bone shield should absorb a hit');
assert.equal(run('lives'), 3, 'shield damage should not cost a life');

run('startGame()');
run("collectPickup({ type: 'boots', x: 100, y: 100, taken: false }); player.grounded = false; player.coyote = 0; player.y = 310; setControl('jump', true)");
run('step()');
assert(run('player.vy') < -10, 'boots should enable an extra jump in the air');
assert.equal(run('player.airJumps'), 1, 'boots should allow one more jump after the baseline air jump');

run('startGame()');
run("collectPickup({ type: 'star', x: 100, y: 100, taken: false }); player.x = enemySeeds[0].x; player.y = GROUND - player.h");
run('step()');
assert.equal(run('enemies[0].alive'), false, 'star power should defeat enemies on contact');
assert.equal(run('lives'), 3);

run('startGame()');
run("const targetBeetle = enemies.find(enemy => enemy.type === 'beetle'); targetBeetle.active = true; player.x = targetBeetle.x; player.y = targetBeetle.y - player.h - 1; player.vy = 3; player.grounded = false");
run('step()');
assert.equal(run('targetBeetle.armor'), 0, 'the first stomp should crack beetle armor');
assert.equal(run('targetBeetle.alive'), true);
for (let i = 0; i < 3; i++) run('step()');
run('player.x = targetBeetle.x; player.y = targetBeetle.y - player.h - 1; player.vy = 3; player.grounded = false');
run('step()');
assert.equal(run('targetBeetle.alive'), false, 'the second stomp should defeat a beetle');

run('startGame()');
run("collectPickup({ type: 'magnet', x: 100, y: 100, taken: false }); player.x = coins[0].x - 105; player.y = coins[0].y - 17; player.grounded = false");
run('step()');
assert.equal(run('coins[0].taken'), true, 'the magnet should collect a nearby coin');
run("collectPickup({ type: 'heart', x: 100, y: 100, taken: false })");
assert.equal(run('lives'), 4, 'a heart should add a life');

run('startGame()');
run("surface.enemies = []; enemies = surface.enemies; player.x = 54 * T + 26; player.y = GROUND - 2 * T - player.h; player.grounded = true; surface.coins[0].taken = true; setControl('down', true)");
run('step()');
assert.equal(run('state'), 'warping', 'down on the marked pipe should start travel');
for (let i = 0; i < 28; i++) run('step()');
assert.equal(run('zone.id'), 'cave', 'the pipe should lead to the cave');
assert.equal(run('state'), 'playing');
run('cave.coins[0].taken = true');
run("setControl('down', false); portalCooldown = 0; cave.enemies = []; enemies = cave.enemies; player.x = 42 * T + 26; player.y = GROUND - 2 * T - player.h; player.grounded = true; setControl('down', true)");
run('step()');
for (let i = 0; i < 28; i++) run('step()');
assert.equal(run('zone.id'), 'surface', 'the cave exit should return to the surface');
assert.equal(run('surface.coins[0].taken'), true, 'surface collection state should survive travel');
run("setControl('down', false); portalCooldown = 0; player.x = 54 * T + 26; player.y = GROUND - 2 * T - player.h; player.grounded = true; setControl('down', true)");
run('step()');
for (let i = 0; i < 28; i++) run('step()');
assert.equal(run('zone.id'), 'cave');
assert.equal(run('cave.coins[0].taken'), true, 'cave collection state should survive a round trip');

run('startGame()');
run("activateZone(cave); cave.enemies = []; enemies = cave.enemies; player.x = 18 * T + 5; player.y = GROUND - player.h; player.grounded = true");
run('step()');
assert(run('player.vy') < -17, 'the cave spring should launch the player');
for (let i = 0; i < 20; i++) run('step()');
assert(run('player.starTime') > 0, 'the spring route should reach the floating star');

run('startGame()');
run('surface.enemies = []; enemies = surface.enemies');
run("player.x = 30 * T - 85; player.vx = 5.4; setControl('right', true); setControl('run', true); setControl('jump', true)");
for (let i = 0; i < 55; i++) run('step()');
assert(run('player.x') > 30 * 42 + 84, 'a run jump should clear the tall pipe');
assert.equal(run('state'), 'playing');

run('startGame()');
run('surface.enemies = []; enemies = surface.enemies');
run("player.x = 59 * T - 65; player.vx = 5.4; setControl('right', true); setControl('run', true); setControl('jump', true)");
for (let i = 0; i < 55; i++) run('step()');
assert(run('player.x') > 62 * 42, 'a run jump should cross the first pit');
assert.equal(run('state'), 'playing');

run('startGame()');
run("player.x = FLAG_X - 33; setControl('right', true)");
for (let i = 0; i < 20; i++) run('step()');
assert.equal(run('state'), 'won', 'crossing the flag should finish the level');

run('startGame(); draw(); activateZone(cave); draw()');
for (const stage of ['orchard', 'sky', 'castle']) {
  run(`startGame(true, '${stage}'); draw()`);
  assert.equal(run('zone.id'), stage, `${stage} should be selectable and drawable`);
  assert(run('zone.finishX < zone.width'), `${stage} should have a reachable finish area`);
}

run("startGame(true, 'orchard'); collectPickup({ type: 'spark', x: 100, y: 100, taken: false }); setControl('attack', true); step()");
assert.equal(run('player.weapon'), 'spark', 'the spark bell should equip the player');
assert.equal(run('projectiles.length'), 1, 'attack should launch a projectile');
run('enemies[0].x = projectiles[0].x + 8; enemies[0].y = projectiles[0].y; updateProjectiles()');
assert.equal(run('enemies[0].alive'), false, 'a spark projectile should defeat an unarmored enemy');

run("startGame(true, 'orchard'); collectPickup({ type: 'claw', x: 100, y: 100, taken: false }); player.x = enemies[0].x - 45; player.y = GROUND - player.h; player.facing = 1; useAttack(); updateEnemies()");
assert.equal(run('player.weapon'), 'claw', 'the claw should equip the player');
assert.equal(run('enemies[0].alive'), false, 'the claw attack should defeat an enemy in front');

run("startGame(true, 'surface'); winGame(); advanceStage()");
assert.equal(run('zone.id'), 'orchard', 'clearing 1-1 should advance to 1-2');
run('currentBoss().alive = false; winGame(); advanceStage()');
assert.equal(run('zone.id'), 'sky', 'clearing 1-2 should advance to 1-3');
run('winGame(); advanceStage()');
assert.equal(run('zone.id'), 'castle', 'clearing 1-3 should advance to 1-4');
assert.equal(run('lives'), 3, 'stage progression should preserve lives');

run("startGame(true, 'castle'); winGame()");
assert.equal(run('state'), 'playing', 'the living guardian should lock the 1-4 exit');
run("player.x = castle.finishX - 34; player.vx = 5; setControl('right', true); step()");
assert(run('player.x <= activeBossArena().maxX'), 'the arena should block passage through its right boundary');
assert.equal(run('state'), 'playing', 'the living boss should prevent a premature clear');
run("var guardian = enemies.find(enemy => enemy.type === 'guardian'); for (let hit = 0; hit < guardian.maxHealth; hit++) { guardian.bossState = 'recover'; guardian.hurtCooldown = 0; damageEnemy(guardian); }");
assert.equal(run('guardian.alive'), false, 'attacks during recovery should defeat the guardian');
run('winGame()');
assert.equal(run('state'), 'won', 'defeating the guardian should unlock the final clear');

for (const stage of ['orchard', 'sky']) {
  run(`startGame(true, '${stage}'); if (currentBoss()) currentBoss().alive = false; player.x = zone.finishX - 5; player.y = GROUND - player.h; step()`);
  assert.equal(run('state'), 'won', `${stage} should clear when the player reaches its flag`);
}

context.setTimeout = callback => { callback(); return 1; };
run("startGame(); checkpoint = { zone: 'surface', x: 68 * T, y: GROUND - 34 }; timeLeft = 1 / 120; step()");
assert.equal(run('state'), 'playing', 'time expiry should respawn when lives remain');
assert.equal(run('lives'), 2);
assert.equal(run('timeLeft'), 200, 'an exhausted timer should be restored for the checkpoint retry');
assert.equal(run('player.x'), 68 * 42, 'respawn should use the latest checkpoint');

console.log('smoke tests passed: movement, blocks, enemies, items, secret pipe, four stages, attacks, guardian, finish');
