const assert = require('node:assert/strict');
const { createGame } = require('./harness.cjs');

let passed = 0;
let failed = 0;
function test(name, verify) {
  try {
    verify(createGame());
    passed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    failed++;
    console.error(`× ${name}\n${error.stack}`);
  }
}
function emptyArena(game) {
  game.run(`startGame();
    zone.blocks = []; zone.pipes = []; zone.stairs = [];
    zone.groundPieces = [{ x: 0, w: zone.width }];
    zone.movingPlatforms = []; zone.platforms = []; zone.hazards = [];
    zone.enemies = []; enemies = zone.enemies;
    zone.coins = []; coins = zone.coins;
    zone.powerups = []; powerups = zone.powerups;`);
}

test('base paws defeat a nearby enemy without a pickup', game => {
  game.run(`startGame();
    var target = enemies[0]; target.x = player.x + player.w + 8;
    target.home = target.x; target.active = true; target.vx = 0;
    player.facing = 1; useAttack(); updateEnemies();`);
  assert.equal(game.run('player.weapon'), null);
  assert.equal(game.run('target.alive'), false);
  assert(game.run('player.attackCooldown') > 0);
});

test('a boomerang cracks armour outbound, hits once returning and is recovered', game => {
  emptyArena(game);
  game.run(`var target = makeEnemy({ x: 210, type: 'beetle', direction: -1 });
    enemies.push(target); collectPickup({ type: 'boomerang', x: 0, y: 0, taken: false });
    setControl('attack', true);`);
  const pickupScore = game.run('score');
  game.step();
  game.run("setControl('attack', false)");
  let crackedOutbound = false;
  let returnObserved = false;
  for (let frame = 0; frame < 160 && game.run('projectiles.length') > 0; frame++) {
    if (game.run('projectiles[0].returning === true')) returnObserved = true;
    if (!returnObserved && game.run('target.armor') === 0) {
      crackedOutbound = true;
      assert.equal(game.run('target.alive'), true, 'the outbound pass should only remove the shell');
      assert.equal(game.run('score'), pickupScore + 200, 'one outbound pass should hit only once');
    }
    game.step();
  }
  assert(crackedOutbound, 'the real projectile should cross the enemy on its outward trip');
  assert(returnObserved, 'the bone should enter its return phase');
  assert.equal(game.run('target.alive'), false, 'the return trip should defeat the cracked beetle');
  assert.equal(game.run('score'), pickupScore + 400, 'there should be exactly one hit per trip');
  assert.equal(game.run('projectiles.length'), 0, 'the bone should return to the dog and be removed');
});

test('baseline air jump is spent once and recharges on landing', game => {
  emptyArena(game);
  game.run(`player.y = 230; player.grounded = false; player.coyote = 0;
    player.vy = 2; setControl('jump', true);`);
  game.step();
  assert(game.run('player.vy') < -10, 'the second jump should lift the dog');
  assert.equal(game.run('player.airJumps'), 0);
  game.run("setControl('jump', false); setControl('jump', true)");
  game.step();
  assert(game.run('player.vy') > -10, 'another press must not grant unlimited jumps');
  game.run(`setControl('jump', false); jumpBuffer = 0;
    player.y = GROUND - player.h - 1; player.vy = 3;`);
  game.step();
  assert.equal(game.run('player.grounded'), true);
  assert.equal(game.run('player.airJumps'), 1);
});

test('boots add a third jump and expire back to the baseline', game => {
  emptyArena(game);
  game.run("collectPickup({ type: 'boots', x: 0, y: 0, taken: false })");
  assert.equal(game.run('player.airJumps'), 2);
  game.run(`player.y = 230; player.grounded = false; player.coyote = 0;
    player.vy = 0; setControl('jump', true);`);
  game.step();
  assert.equal(game.run('player.airJumps'), 1);
  game.run("setControl('jump', false); setControl('jump', true)");
  game.step();
  assert.equal(game.run('player.airJumps'), 0);
  assert(game.run('player.vy') < -10);
  game.run(`player.bootsTime = 1; setControl('jump', false); jumpBuffer = 0;
    player.y = GROUND - player.h - 1; player.vy = 3;`);
  game.step();
  assert.equal(game.run('player.bootsTime'), 0);
  assert.equal(game.run('player.airJumps'), 1);
});

test('wall slide caps falling speed and wall jump escapes the wall', game => {
  emptyArena(game);
  game.run(`zone.pipes.push({ x: 260, y: 190, w: 42, h: 260, type: 'pipe' });
    player.x = 230; player.y = 230; player.vy = 8;
    player.grounded = false; player.coyote = 0; player.airJumps = 0;
    setControl('right', true);`);
  game.step(10);
  assert(game.run('player.vy') <= 3, 'sliding should give time to react');
  game.run("setControl('jump', true)");
  game.step();
  assert(game.run('player.vy') < -10, 'wall jump should gain height');
  assert(game.run('player.x') < 230, 'wall jump should push away from the wall');
});

test('dash stops at a wall and cannot be spammed in the air', game => {
  emptyArena(game);
  game.run(`zone.pipes.push({ x: 225, y: 190, w: 4, h: 260, type: 'pipe' });
    player.x = 180; player.y = 320; player.grounded = false;
    player.facing = 1; setControl('right', true); useDash();`);
  assert(game.run('player.dashTime') > 0);
  assert.equal(game.run('player.barkEnergy'), 75);
  game.step(12);
  assert(game.run('player.x + player.w') <= 225, 'a thin wall should stop dash movement');
  const energy = game.run('player.barkEnergy');
  game.run('player.dashCooldown = 0; useDash()');
  assert.equal(game.run('player.barkEnergy'), energy, 'landing is required before another air dash');
});

test('bark stuns a nearby foe and its cooldown prevents repeated spending', game => {
  game.run(`startGame(); var target = enemies[0];
    target.x = player.x + 85; target.home = target.x; target.active = true;
    target.y = GROUND - target.h; useBark();`);
  assert(game.run('target.stun') > 0);
  assert.equal(game.run('player.barkEnergy'), 65);
  game.run('useBark()');
  assert.equal(game.run('player.barkEnergy'), 65);
  assert.equal(game.run('target.alive'), true, 'a bark provides control without replacing an attack');
});

test('ground pound breaks bricks and defeats armour with a landing shockwave', game => {
  emptyArena(game);
  game.run(`player.x = 150; player.y = 220; player.grounded = false;
    player.coyote = 0; player.vy = 0;
    zone.blocks.push({ x: 145, y: 330, w: T, h: T, type: 'brick', broken: false, used: false });
    var target = makeEnemy({ x: 215, type: 'beetle', direction: -1 });
    enemies.push(target); setControl('down', true);`);
  game.step(30);
  assert.equal(game.run('zone.blocks[0].broken'), true);
  assert.equal(game.run('target.alive'), false, 'the landing shockwave should bypass ordinary armour');
  assert.equal(game.run('player.groundPound'), false);
  assert.equal(game.run('player.hp'), 3);
  assert(game.run('score') >= 350);
});

test('crouch preserves feet position and cannot stand into a low ceiling', game => {
  emptyArena(game);
  game.run("setControl('down', true)");
  game.step();
  assert.equal(game.run('player.h'), 22);
  assert.equal(game.run('player.y + player.h'), game.run('GROUND'));
  game.run(`zone.blocks.push({ x: 70, y: 400, w: 100, h: 26,
    type: 'brick', broken: false, used: false }); setControl('down', false);`);
  game.step();
  assert.equal(game.run('player.h'), 22, 'standing must wait until the head has room');
  game.run('zone.blocks[0].broken = true');
  game.step();
  assert.equal(game.run('player.h'), 34);
  assert.equal(game.run('player.y + player.h'), game.run('GROUND'));
});

test('health and invulnerability absorb one hit at a time', game => {
  game.run('startGame(); damagePlayer(1, 200)');
  assert.equal(game.run('player.hp'), 2);
  assert.equal(game.run('lives'), 3);
  assert(game.run('player.invulnerable') > 0);
  game.run('damagePlayer(1, 200)');
  assert.equal(game.run('player.hp'), 2, 'one overlap must not deal repeated damage');
  game.run('player.invulnerable = 0; player.shield = true; damagePlayer(1, 200)');
  assert.equal(game.run('player.hp'), 2);
  assert.equal(game.run('player.shield'), false);
});

test('checkpoint death preserves world progress and equipment', game => {
  game.run(`startGame();
    checkpoint = { zone: 'surface', x: 68 * T, y: GROUND - player.h };
    surface.coins[0].taken = true; surface.blocks[0].used = true;
    surface.enemies[0].alive = false;
    score = 1200; coinCount = 7;
    player.weapon = 'spark'; player.weaponTime = 700;
    player.bootsTime = 300; player.magnetTime = 240;
    projectiles.push({ x: 0, y: 0, w: 16, h: 12, life: 10, vx: 8 });
    player.hp = 1; damagePlayer(1, 200);`);
  assert.equal(game.run('state'), 'respawn');
  assert.equal(game.run('lives'), 2);
  game.flushTimers(1000);
  assert.equal(game.run('state'), 'playing');
  assert.equal(game.run('player.x'), 68 * 42);
  assert.equal(game.run('player.hp'), 3);
  assert.equal(game.run('surface.coins[0].taken'), true);
  assert.equal(game.run('surface.blocks[0].used'), true);
  assert.equal(game.run('surface.enemies[0].alive'), false);
  assert.equal(game.run('score'), 1200);
  assert.equal(game.run('coinCount'), 7);
  assert.equal(game.run('player.weapon'), 'spark');
  assert.equal(game.run('player.weaponTime'), 700);
  assert.equal(game.run('player.bootsTime'), 300);
  assert.equal(game.run('player.magnetTime'), 240);
  assert.equal(game.run('projectiles.length'), 0);
});

test('pause freezes simulation and releases held controls', game => {
  game.run(`startGame();
    setControl('right', true); setControl('jump', true); setControl('attack', true);
    setControl('down', true); setControl('dash', true); setControl('bark', true); pauseGame();`);
  assert.equal(game.run('state'), 'paused');
  assert.equal(game.run('Object.values(control).some(Boolean)'), false);
  assert.equal(game.run('jumpBuffer + attackBuffer + downBuffer + dashBuffer + barkBuffer'), 0);
  const before = game.run('JSON.stringify({ x: player.x, y: player.y, tick, timeLeft })');
  game.step(60);
  assert.equal(game.run('JSON.stringify({ x: player.x, y: player.y, tick, timeLeft })'), before);
  game.run('pauseGame()');
  assert.equal(game.run('state'), 'playing');
  assert.equal(game.run('control.attack'), false);
});

test('blur pauses and clears input through the real event handlers', game => {
  game.run('startGame()');
  game.document.dispatch('keydown', { code: 'ArrowRight', repeat: false });
  assert.equal(game.run('control.right'), true);
  game.window.dispatch('blur');
  assert.equal(game.run('state'), 'paused');
  assert.equal(game.run('Object.values(control).some(Boolean)'), false);
});

test('two keys for one action stay held until both have been released', game => {
  game.run('startGame()');
  game.document.dispatch('keydown', { code: 'ArrowRight', repeat: false });
  game.document.dispatch('keydown', { code: 'KeyD', repeat: false });
  game.document.dispatch('keyup', { code: 'ArrowRight' });
  assert.equal(game.run('control.right'), true, 'releasing an alias must not cancel a held key');
  game.document.dispatch('keyup', { code: 'KeyD' });
  assert.equal(game.run('control.right'), false);
});

test('hiding the page pauses and releases held keyboard input', game => {
  game.run('startGame()');
  game.document.dispatch('keydown', { code: 'KeyJ', repeat: false });
  game.document.hidden = true;
  game.document.visibilityState = 'hidden';
  game.document.dispatch('visibilitychange');
  assert.equal(game.run('state'), 'paused');
  assert.equal(game.run('Object.values(control).some(Boolean)'), false);
  assert.equal(game.run('attackBuffer'), 0);
  game.document.hidden = false;
  game.document.visibilityState = 'visible';
  game.document.dispatch('visibilitychange');
  assert.equal(game.run('state'), 'paused', 'returning to the page should wait for deliberate resume');
});

test('one-way moving platforms allow upward travel, then land and carry', game => {
  emptyArena(game);
  game.run(`zone.platforms.push({ x: 100, y: 300, baseX: 100, baseY: 300,
    w: 180, h: 15, axis: 'x', range: 0, phase: 0, dx: 0, dy: 0,
    type: 'platform', oneWay: true });
    player.x = 150; player.y = 320; player.vy = -12;
    player.grounded = false; player.coyote = 0;`);
  game.step();
  assert(game.run('player.y') < 320);
  assert(game.run('player.vy') < 0, 'the underside must not stop an upward jump');
  game.run('player.y = 250; player.vy = 8; player.grounded = false');
  game.step(2);
  assert.equal(game.run('player.grounded'), true);
  assert.equal(game.run('player.y + player.h'), 300);
  game.run('zone.platforms[0].range = 50');
  const relative = game.run('player.x - zone.platforms[0].x');
  game.step(20);
  assert(Math.abs(game.run('player.x - zone.platforms[0].x') - relative) < .01);
  assert(game.run('zone.platforms[0].x') > 100, 'the platform should actually move');
  assert.equal(game.run('player.grounded'), true);
});

test('flame hazards warn before damage and obey health invulnerability', game => {
  emptyArena(game);
  game.run(`zone.hazards.push({ x: 100, y: GROUND - 20, w: 42, h: 20,
    type: 'flame', phase: 0 });
    player.x = 106; tick = 100; updateWorldFeatures();`);
  assert.equal(game.run('zone.hazards[0].warning'), true);
  assert.equal(game.run('zone.hazards[0].active'), false);
  assert.equal(game.run('player.hp'), 3);
  game.run('tick = 125; updateWorldFeatures()');
  assert.equal(game.run('zone.hazards[0].active'), true);
  assert.equal(game.run('player.hp'), 2);
  game.run('updateWorldFeatures()');
  assert.equal(game.run('player.hp'), 2);
});

test('bark opens a seal only once and reflects nearby enemy shots', game => {
  emptyArena(game);
  game.run(`zone.seals = [{ x: 140, y: 390, w: 38, h: 44, open: false }];
    zone.gems = [];
    enemyShots.push({ x: player.x + 15, y: player.y + 17, w: 12, h: 12, vx: -3, life: 120 });
    useBark();`);
  assert.equal(game.run('zone.seals[0].open'), true);
  assert.equal(game.run('zone.gems.length'), 1);
  assert.equal(game.run('powerups.length'), 1);
  assert.equal(game.run('enemyShots[0].life'), 0);
  assert.equal(game.run('projectiles.length'), 1);
  assert(game.run('projectiles[0].vx') > 0);
  game.run('barkWorld(player.x + 15, player.y + 17)');
  assert.equal(game.run('zone.gems.length'), 1);
  assert.equal(game.run('powerups.length'), 1);
  game.run('updateWorldFeatures()');
  assert.equal(game.run('player.hp'), 3, 'a reflected shot must not damage the dog on its next update');
});

test('a browser reload restores saved checkpoint, collections and equipment', () => {
  const storage = new Map();
  const first = createGame({ storage });
  first.run(`startGame(true, 'orchard');
    checkpoint = { zone: 'orchard', x: 20 * T, y: GROUND - player.h };
    orchard.coins[0].taken = true; orchard.blocks[0].used = true;
    orchard.enemies[0].alive = false; orchard.gems[0].taken = true;
    player.weapon = 'boomerang'; player.weaponTime = 900;
    player.shield = true; gemCount = 2; stageGems = 2;
    score = 5400; coinCount = 12; lives = 2; saveProgress();`);
  const reloaded = createGame({ storage });
  reloaded.run('continueGame()');
  assert.equal(reloaded.run('state'), 'playing');
  assert.equal(reloaded.run('zone.id'), 'orchard');
  assert.equal(reloaded.run('player.x'), 20 * 42);
  assert.equal(reloaded.run('orchard.coins[0].taken'), true);
  assert.equal(reloaded.run('orchard.blocks[0].used'), true);
  assert.equal(reloaded.run('orchard.enemies[0].alive'), false);
  assert.equal(reloaded.run('orchard.gems[0].taken'), true);
  assert.equal(reloaded.run('player.weapon'), 'boomerang');
  assert.equal(reloaded.run('player.weaponTime'), 900);
  assert.equal(reloaded.run('player.shield'), true);
  assert.equal(reloaded.run('score'), 5400);
  assert.equal(reloaded.run('coinCount'), 12);
  assert.equal(reloaded.run('gemCount'), 2);
  assert.equal(reloaded.run('lives'), 2);
});

test('a corrupted stored JSON save falls back to a playable fresh game', () => {
  const game = createGame({ storage: new Map([['plush-quest-v2', '{unfinished']]) });
  game.run('startGame()');
  game.step();
  assert.equal(game.run('state'), 'playing');
  assert.equal(game.run('player.hp'), 3);
  assert.equal(game.run('coinCount'), 0);
});

test('boss attacks visibly tell, commit, then expose a recovery window', game => {
  game.run(`startGame(true, 'orchard'); var boss = currentBoss();
    player.x = boss.recipe.left + 30; player.invulnerable = 1000;`);
  game.step();
  assert.equal(game.run('boss.bossState'), 'intro');
  assert.equal(game.run('checkpoint.x'), game.run('boss.recipe.left + 28'));
  const seen = new Set();
  for (let frame = 0; frame < 400; frame++) {
    seen.add(game.run('boss.bossState'));
    if (game.run('boss.bossState') === 'tell') {
      assert.equal(game.run('boss.vx'), 0, 'wind-up must precede movement');
      assert(game.run('boss.tellTotal') >= 42, 'the tell should allow reaction time');
    }
    if (game.run('boss.bossState') === 'recover') break;
    game.step();
  }
  assert(seen.has('tell'));
  assert(seen.has('charge'));
  assert.equal(game.run('boss.bossState'), 'recover');
  assert(game.run('boss.bossTimer') >= 90);
});

test('boss armour blocks premature attacks and limits hits in an opening', game => {
  game.run(`startGame(true, 'castle'); var boss = currentBoss();
    boss.bossState = 'tell'; boss.bossTimer = 54;
    damageEnemy(boss, 210, 'paw');`);
  assert.equal(game.run('boss.health'), 12);
  game.run("boss.bossState = 'recover'; damageEnemy(boss, 210, 'paw')");
  assert.equal(game.run('boss.health'), 11);
  game.run("damageEnemy(boss, 210, 'paw')");
  assert.equal(game.run('boss.health'), 11, 'one opening must not lose health every frame');
  game.run("boss.hurtCooldown = 0; damageEnemy(boss, 300, 'slam')");
  assert.equal(game.run('boss.health'), 9, 'a risky ground pound should deal extra damage');
  game.run("boss.hurtCooldown = 0; damageEnemy(boss, 210, 'paw')");
  assert.equal(game.run('boss.bossPhase'), 2);
  assert.equal(game.run('boss.bossState'), 'phase');
  game.run("boss.hurtCooldown = 0; damageEnemy(boss, 210, 'paw')");
  assert.equal(game.run('boss.health'), 8, 'phase transitions protect the boss until their tell finishes');
});

test('active boss arena locks movement until victory opens its gates', game => {
  game.run(`startGame(true, 'castle'); var boss = currentBoss();
    player.x = boss.recipe.left + 30; updateBossMovement(boss);
    player.x = boss.recipe.left - 100; updateBossMovement(boss);`);
  assert.equal(game.run('player.x'), game.run('activeBossArena().minX'));
  game.run('player.x = boss.recipe.right + 100; updateBossMovement(boss)');
  assert.equal(game.run('player.x'), game.run('activeBossArena().maxX'));
  game.run("player.x = activeBossArena().maxX - 2; player.vx = 5; setControl('right', true); updatePlayer()");
  assert.equal(game.run('player.x'), game.run('activeBossArena().maxX'), 'physics should use the same left-edge boundary as the arena');
  game.run('winGame()');
  assert.equal(game.run('state'), 'playing', 'reaching an exit cannot bypass a living boss');
  assert.equal(game.run('bossSolidGate().length'), 2);
  game.run(`for (let hit = 0; hit < 12; hit++) {
    boss.bossState = 'recover'; boss.hurtCooldown = 0; damageEnemy(boss, 200, 'paw');
  }`);
  assert.equal(game.run('boss.alive'), false);
  assert.equal(game.run('activeBossArena()'), null);
  assert.equal(game.run('bossSolidGate().length'), 0);
  game.run('winGame()');
  assert.equal(game.run('state'), 'won');
});

test('bark reflects boss projectiles into a protected attacking boss', game => {
  game.run(`startGame(true, 'castle'); var boss = currentBoss();
    boss.bossState = 'charge'; boss.bossTimer = 60;
    player.x = boss.x - 140; player.y = GROUND - player.h;
    bossAddHazard(boss, { kind: 'orb', x: player.x + 42, y: player.y + 10,
      w: 18, h: 18, vx: -3, vy: 0, life: 170 });
    useBark();`);
  assert.equal(game.run('bossHazards[0].hostile'), false);
  for (let frame = 0; frame < 30; frame++) game.run('updateBossHazards()');
  assert.equal(game.run('boss.health'), 11, 'a reflected orb can punish an armoured attack');
  assert.equal(game.run('player.hp'), 3);
  assert.equal(game.run('bossHazards.length'), 0);
});

test('checkpoint death preserves an already defeated boss and its open exit', game => {
  game.run(`startGame(true, 'castle'); var boss = currentBoss();
    for (let hit = 0; hit < 12; hit++) {
      boss.bossState = 'recover'; boss.hurtCooldown = 0; damageEnemy(boss, 200, 'paw');
    }
    checkpoint = { zone: 'castle', x: boss.recipe.right - 64, y: GROUND - player.h };
    player.x = checkpoint.x; player.hp = 1; player.invulnerable = 0;
    damagePlayer(1, player.x + 100);`);
  assert.equal(game.run('state'), 'respawn');
  game.flushTimers(1000);
  assert.equal(game.run('state'), 'playing');
  assert.equal(game.run('currentBoss().alive'), false, 'victory should survive a later fall or hit');
  assert.equal(game.run('bossSolidGate().length'), 0);
  game.run('winGame()');
  assert.equal(game.run('state'), 'won');
});

console.log(`${passed} gameplay behavior gates passed${failed ? `; ${failed} failed` : ''}`);
if (failed) process.exitCode = 1;
