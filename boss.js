// Boss encounters use their own deterministic attack timelines. Every damaging
// move has a visible wind-up, followed by a generous opening in the armour.
const bossHazards = [];
const bossRecipes = {
  orchard: {
    type: 'bramble', name: '荆棘果王', subtitle: '果园的守护者',
    tile: 85, leftTile: 79, rightTile: 95, w: 94, h: 82,
    health: 6, colour: '#ffb765', open: '#c9f7a1', reward: 3000,
  },
  castle: {
    type: 'guardian', name: '月蚀石狼', subtitle: '月夜城堡 · 最终守卫',
    tile: 82, leftTile: 76, rightTile: 93, w: 104, h: 106,
    health: 12, colour: '#afa9ff', open: '#87f3eb', reward: 7500,
  },
};

function setupBossEncounter(level) {
  const recipe = bossRecipes[level.id];
  if (!recipe) return;
  recipe.left = recipe.leftTile * T;
  recipe.right = recipe.rightTile * T;
  level.bossRequired = true;
  if (!level.enemySeeds.some(seed => seed.type === recipe.type)) {
    level.enemySeeds.push({ x: recipe.tile * T, direction: -1, type: recipe.type });
  }
}

function resetBossBattles(levels) {
  const ids = new Set(levels.map(level => level.id));
  for (let i = bossHazards.length - 1; i >= 0; i--) {
    if (ids.has(bossHazards[i].zoneId)) bossHazards.splice(i, 1);
  }
  for (const level of levels) {
    const recipe = bossRecipes[level.id];
    if (!recipe) continue;
    setupBossEncounter(level);
    let boss = level.enemies.find(enemy => enemy.type === recipe.type);
    if (!boss) {
      boss = makeEnemy({ x: recipe.tile * T, direction: -1, type: recipe.type });
      level.enemies.push(boss);
    }
    Object.assign(boss, {
      isBoss: true, alive: true, active: false, recipe,
      x: recipe.tile * T, y: GROUND - recipe.h, home: recipe.tile * T,
      w: recipe.w, h: recipe.h, vx: 0, vy: 0, armor: 0, stun: 0,
      health: recipe.health, maxHealth: recipe.health,
      bossState: 'waiting', bossTimer: 0, bossPhase: 1, attackCount: 0,
      facing: -1, nextMove: null, hurtCooldown: 0, barkCooldown: 0,
      tellTotal: 0, targetX: 0, deathTicks: 0, flash: 0,
      leapCount: 0, recovered: false, suppliesAdded: false,
    });
    // Normal patrols cannot wander into a sealed boss arena.
    level.enemies.forEach(enemy => {
      if (!enemy.isBoss && enemy.x > recipe.left - T) enemy.alive = false;
    });
  }
  updateBossHudElements();
}

function currentBoss() {
  return enemies.find(enemy => enemy.isBoss) || null;
}

function activeBossArena() {
  const boss = currentBoss();
  if (!boss || !boss.alive || boss.bossState === 'waiting') return null;
  const { left, right } = boss.recipe;
  return {
    left, right, minX: left + 16, maxX: right - 16 - player.w, boss,
    camera: Math.max(0, Math.min(zone.width - W, (left + right - W) / 2)),
  };
}

function bossSolidGate() {
  const boss = currentBoss();
  if (!boss || !boss.alive) return [];
  const { left, right } = boss.recipe;
  const gates = [{ x: right - 8, y: 0, w: 16, h: GROUND, type: 'bossGate' }];
  if (boss.bossState !== 'waiting') {
    gates.push({ x: left - 8, y: 0, w: 16, h: GROUND, type: 'bossGate' });
  }
  return gates;
}

function bossIsOpen(boss) {
  return boss.bossState === 'recover' || boss.bossState === 'stagger';
}

function beginBossState(boss, next, duration) {
  boss.bossState = next;
  boss.bossTimer = duration;
  if (next !== 'charge' && next !== 'leap') boss.vx = 0;
  if (next === 'recover' || next === 'stagger') {
    boss.recovered = true;
    boss.stun = duration;
    sparkle(boss.x + boss.w / 2, boss.y + 24, boss.recipe.open, 10);
  } else boss.stun = 0;
}

function startBossEncounter(boss) {
  boss.active = true;
  boss.facing = -1;
  beginBossState(boss, 'intro', 90);
  checkpoint = { zone: zone.id, x: boss.recipe.left + 28, y: GROUND - player.h };
  if (!boss.suppliesAdded) {
    boss.suppliesAdded = true;
    powerups.push({ type: 'bone', x: boss.recipe.left + 88, y: GROUND - 30, w: 34, h: 30, age: 0, taken: false });
    powerups.push({ type: 'spark', x: boss.recipe.left + 144, y: GROUND - 30, w: 34, h: 30, age: 0, taken: false });
  }
  showToast(`${boss.recipe.name}现身！躲开红色预警，攻击发光的核心`);
  player.hp = player.maxHp; saveProgress();
  sound('start');
}

function bossChooseAttack(boss) {
  const sequences = boss.type === 'bramble'
    ? [['charge', 'leap'], ['charge', 'volley', 'leap'], ['leap', 'charge', 'volley']]
    : [['charge', 'leap'], ['volley', 'leap', 'charge'], ['doubleLeap', 'volley', 'charge', 'meteor']];
  const sequence = sequences[boss.bossPhase - 1];
  boss.nextMove = sequence[boss.attackCount++ % sequence.length];
  boss.facing = player.x + player.w / 2 < boss.x + boss.w / 2 ? -1 : 1;
  boss.targetX = Math.max(boss.recipe.left + 65, Math.min(boss.recipe.right - boss.w - 50, player.x + player.w / 2 - boss.w / 2));
  const duration = boss.nextMove === 'charge' ? 54 : boss.nextMove === 'volley' ? 62 : 58;
  boss.tellTotal = duration;
  beginBossState(boss, 'tell', duration);
  sound('bump');
}

function bossLaunchLeap(boss) {
  const travel = boss.targetX - boss.x;
  boss.vx = travel / 40;
  boss.vy = -12.8;
  beginBossState(boss, 'leap', 80);
  boss.vx = travel / 40;
  sound('spring');
}

function bossAddHazard(boss, properties) {
  bossHazards.push({ zoneId: zone.id, owner: boss, age: 0, hostile: true, life: 160, ...properties });
}

function bossGroundWaves(boss, strong = false) {
  const x = boss.x + boss.w / 2;
  const speed = strong ? 5.1 : 4.2;
  for (const direction of [-1, 1]) {
    bossAddHazard(boss, { kind: 'wave', x, y: GROUND - 23, w: 28, h: 23, vx: speed * direction, vy: 0, life: 130 });
  }
  feedback(x, GROUND - 6, boss.recipe.colour, strong ? 7 : 4);
  sound('break');
}

function bossFireVolley(boss) {
  const count = boss.bossPhase === 3 ? 5 : 3;
  const originX = boss.x + boss.w / 2;
  const originY = boss.y + 38;
  const dx = player.x + player.w / 2 - originX;
  const dy = player.y + player.h / 2 - originY;
  const aim = Math.atan2(dy, dx);
  for (let i = 0; i < count; i++) {
    const angle = aim + (i - (count - 1) / 2) * .22;
    const speed = boss.type === 'bramble' ? 3.5 : 4.1;
    bossAddHazard(boss, { kind: boss.type === 'bramble' ? 'seed' : 'orb', x: originX - 9, y: originY - 9, w: 18, h: 18, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 170 });
  }
  sound('attack');
  sparkle(originX, originY, boss.recipe.colour, 12);
}

function bossMeteorRain(boss) {
  const origin = player.x + player.w / 2;
  for (let i = -1; i <= 1; i++) {
    const x = Math.max(boss.recipe.left + 36, Math.min(boss.recipe.right - 46, origin + i * 120));
    bossAddHazard(boss, { kind: 'meteor', x: x - 14, y: 38, w: 28, h: 28, vx: 0, vy: 0, delay: 48 + Math.abs(i) * 10, life: 180 });
  }
  sound('power');
}

function bossCompleteAttack(boss) {
  boss.vx = 0;
  boss.vy = 0;
  boss.y = GROUND - boss.h;
  beginBossState(boss, 'recover', boss.bossPhase === 3 ? 90 : 115);
}

function updateBossMovement(boss) {
  if (boss.hurtCooldown > 0) boss.hurtCooldown--;
  if (boss.barkCooldown > 0) boss.barkCooldown--;
  if (boss.flash > 0) boss.flash--;
  if (boss.stun > 0) boss.stun--;
  if (boss.bossState === 'waiting') {
    if (player.x + player.w > boss.recipe.left + 26) startBossEncounter(boss);
    return;
  }
  const arena = activeBossArena();
  if (arena) player.x = Math.max(arena.minX, Math.min(arena.maxX, player.x));
  boss.bossTimer--;
  if (boss.bossState === 'intro' || boss.bossState === 'phase') {
    if (tick % 12 === 0) sparkle(boss.x + boss.w / 2, boss.y + 45, boss.recipe.colour, 3);
    if (boss.bossTimer <= 0) beginBossState(boss, 'idle', 45);
    return;
  }
  if (boss.bossState === 'idle') {
    boss.facing = player.x + player.w / 2 < boss.x + boss.w / 2 ? -1 : 1;
    if (boss.bossTimer <= 0) bossChooseAttack(boss);
    return;
  }
  if (boss.bossState === 'tell') {
    if (tick % 10 === 0) sparkle(boss.x + boss.w / 2, boss.y + 40, '#ff967f', 2);
    if (boss.bossTimer > 0) return;
    if (boss.nextMove === 'charge') {
      beginBossState(boss, 'charge', 72);
      boss.vx = boss.facing * (boss.bossPhase === 3 ? 7.8 : 6.5);
      sound('attack');
    } else if (boss.nextMove === 'volley') {
      beginBossState(boss, 'volley', 65);
      bossFireVolley(boss);
    } else if (boss.nextMove === 'meteor') {
      beginBossState(boss, 'volley', 90);
      bossMeteorRain(boss);
    } else {
      boss.leapCount = boss.nextMove === 'doubleLeap' ? 2 : 1;
      bossLaunchLeap(boss);
    }
    return;
  }
  if (boss.bossState === 'charge') {
    boss.x += boss.vx;
    if (tick % 4 === 0) sparkle(boss.x + boss.w / 2, GROUND - 8, '#dbc8b6', 2);
    const limit = boss.vx < 0 ? boss.recipe.left + 28 : boss.recipe.right - boss.w - 28;
    if (boss.bossTimer <= 0 || (boss.vx < 0 ? boss.x <= limit : boss.x >= limit)) {
      boss.x = Math.max(boss.recipe.left + 28, Math.min(boss.recipe.right - boss.w - 28, boss.x));
      feedback(boss.x + boss.w / 2, GROUND - 18, '#fff4c1', 5);
      bossCompleteAttack(boss);
    }
    return;
  }
  if (boss.bossState === 'leap') {
    boss.x += boss.vx;
    boss.vy += .64;
    boss.y += boss.vy;
    boss.x = Math.max(boss.recipe.left + 30, Math.min(boss.recipe.right - boss.w - 30, boss.x));
    if (boss.y + boss.h >= GROUND && boss.vy > 0) {
      boss.y = GROUND - boss.h;
      bossGroundWaves(boss, boss.bossPhase === 3);
      boss.leapCount--;
      if (boss.leapCount > 0) {
        boss.targetX = Math.max(boss.recipe.left + 60, Math.min(boss.recipe.right - boss.w - 50, player.x - boss.w / 2));
        boss.nextMove = 'repeatLeap';
        boss.tellTotal = 42;
        beginBossState(boss, 'tell', 42);
      } else bossCompleteAttack(boss);
    }
    return;
  }
  if (boss.bossState === 'volley') {
    if (boss.nextMove === 'volley' && boss.bossPhase === 3 && boss.bossTimer === 28) bossFireVolley(boss);
    if (boss.bossTimer <= 0) bossCompleteAttack(boss);
    return;
  }
  if (bossIsOpen(boss) && boss.bossTimer <= 0) {
    boss.recovered = false;
    beginBossState(boss, 'idle', boss.bossPhase === 3 ? 32 : 48);
  }
}

function damageBoss(enemy, points = 150, kind = 'paw') {
  if (!enemy.isBoss) return false;
  if (!enemy.alive || enemy.hurtCooldown > 0) return true;
  const protectedState = ['waiting', 'intro', 'phase'].includes(enemy.bossState);
  if (protectedState || (!bossIsOpen(enemy) && kind !== 'reflect')) {
    if (enemy.flash <= 0) {
      enemy.flash = 10;
      sparkle(enemy.x + enemy.w / 2, enemy.y + 45, '#cad5e8', 5);
      sound('bump');
    }
    return true;
  }
  const damage = kind === 'slam' ? 2 : 1;
  enemy.health = Math.max(0, enemy.health - damage);
  enemy.hurtCooldown = 25;
  enemy.flash = 18;
  score += points;
  feedback(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.recipe.open, 6);
  sound('stomp');
  if (enemy.health <= 0) {
    enemy.alive = false;
    enemy.bossState = 'dead';
    enemy.deathTicks = 100;
    enemy.stun = 0;
    score += enemy.recipe.reward;
    for (let i = bossHazards.length - 1; i >= 0; i--) {
      if (bossHazards[i].owner === enemy) bossHazards.splice(i, 1);
    }
    sparkle(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#fff2b7', 36);
    powerups.push({ type: 'heart', x: enemy.x + enemy.w / 2 - 16, y: GROUND - 35, w: 34, h: 30, age: 0, taken: false });
    showToast(`${enemy.recipe.name}被击败！结界解除，终点开放！`);
    sound('win');
  } else {
    const phase = enemy.health <= enemy.maxHealth / 3 ? 3 : enemy.health <= enemy.maxHealth * 2 / 3 ? 2 : 1;
    if (phase > enemy.bossPhase) {
      enemy.bossPhase = phase;
      enemy.y = GROUND - enemy.h;
      enemy.vy = 0;
      beginBossState(enemy, 'phase', 88);
      bossHazards.forEach(hazard => { if (hazard.owner === enemy) hazard.life = 0; });
      showToast(`第 ${phase} 阶段：${phase === 3 ? '守卫全力出击！注意连续预警' : '新的招式出现！汪叫可以反弹飞弹'}`);
      sound('power');
    }
  }
  updateHud();
  updateBossHudElements();
  return true;
}

function updateBossContact(boss) {
  if (!boss.alive || ['waiting', 'intro', 'phase'].includes(boss.bossState)) return;
  const slash = { x: player.facing > 0 ? player.x + 15 : player.x - player.attackReach, y: player.y - 14, w: player.attackReach, h: player.h + 28 };
  if (player.attackFrame > 0 && boss.lastAttackId !== player.attackId && overlap(boss, slash)) {
    boss.lastAttackId = player.attackId;
    damageBoss(boss, 210, player.weapon === 'claw' ? 'claw' : 'paw');
  }
  if (!overlap(player, boss)) return;
  if (player.vy > 1.2 && player.prevY + player.h <= boss.y + 28) {
    const slammed = player.groundPound;
    damageBoss(boss, slammed ? 300 : 200, slammed ? 'slam' : 'stomp');
    player.y = boss.y - player.h;
    player.vy = control.jump ? -12.5 : -10.5;
    player.groundPound = false;
    player.grounded = false;
    player.coyote = 0; player.airJumps = player.bootsTime > 0 ? 2 : 1; player.airDashUsed = false;
    sparkle(player.x + player.w / 2, boss.y, boss.recipe.open, 6);
    return;
  }
  if (player.starTime > 0) {
    damageBoss(boss, 180, 'star');
    return;
  }
  if (player.dashTime > 0) {
    if (bossIsOpen(boss)) damageBoss(boss, 200, 'dash');
    return;
  }
  if (bossIsOpen(boss) || boss.hurtCooldown > 0 || player.invulnerable > 0) return;
  damagePlayer(1, boss.x + boss.w / 2);
}

function updateBossHazards() {
  for (const hazard of bossHazards) {
    if (hazard.zoneId !== zone.id || hazard.life <= 0) continue;
    hazard.age++;
    hazard.life--;
    if (hazard.delay > 0) { hazard.delay--; continue; }
    if (hazard.kind === 'meteor') hazard.vy = Math.min(11, hazard.vy + .62);
    hazard.x += hazard.vx;
    hazard.y += hazard.vy;
    if (hazard.kind === 'meteor' && hazard.y + hazard.h >= GROUND) {
      sparkle(hazard.x + 14, GROUND - 10, '#dab4ff', 12);
      hazard.life = 0;
      continue;
    }
    if (hazard.x < hazard.owner.recipe.left - 40 || hazard.x > hazard.owner.recipe.right + 40 || hazard.y > H + 40 || hazard.y < -40) {
      hazard.life = 0;
      continue;
    }
    if (!hazard.hostile) {
      if (overlap(hazard, hazard.owner)) {
        damageBoss(hazard.owner, 250, 'reflect');
        hazard.life = 0;
      }
      continue;
    }
    if (!overlap(player, hazard)) continue;
    if (player.dashTime > 0 || player.starTime > 0) {
      sparkle(hazard.x + hazard.w / 2, hazard.y + hazard.h / 2, '#fff2aa', 7);
    } else if (player.invulnerable <= 0) damagePlayer(1, hazard.x + hazard.w / 2);
    hazard.life = 0;
  }
  for (let i = bossHazards.length - 1; i >= 0; i--) if (bossHazards[i].life <= 0) bossHazards.splice(i, 1);
}

function bossBarkPulse(x, y) {
  const boss = currentBoss();
  if (!boss || !boss.alive || boss.bossState === 'waiting') return;
  for (const hazard of bossHazards) {
    if (hazard.zoneId !== zone.id || !hazard.hostile || hazard.delay > 0 || Math.hypot(hazard.x + hazard.w / 2 - x, hazard.y + hazard.h / 2 - y) > 220) continue;
    if (hazard.kind === 'wave') { hazard.life = 0; sparkle(hazard.x, hazard.y, '#a2f4ed', 8); continue; }
    hazard.hostile = false;
    const dx = boss.x + boss.w / 2 - hazard.x;
    const dy = boss.y + boss.h / 2 - hazard.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    hazard.vx = dx / distance * 7;
    hazard.vy = dy / distance * 7;
    hazard.kind = 'reflected';
    sparkle(hazard.x + 9, hazard.y + 9, '#a2f4ed', 10);
  }
  if (Math.hypot(boss.x + boss.w / 2 - x, boss.y + boss.h / 2 - y) > 210 || boss.barkCooldown > 0) return;
  if (bossIsOpen(boss)) {
    boss.bossTimer = Math.max(boss.bossTimer, 125);
    boss.barkCooldown = 220;
    sparkle(boss.x + boss.w / 2, boss.y + 20, '#a2f4ed', 10);
  } else if (boss.bossState === 'tell' && boss.nextMove === 'volley') {
    beginBossState(boss, 'stagger', 100);
    boss.barkCooldown = 220;
    showToast('汪叫打断了蓄力！核心暴露，快攻击！');
  }
}

function updateBossBattle() {
  const boss = currentBoss();
  if (boss) {
    if (boss.alive) {
      updateBossMovement(boss);
      updateBossContact(boss);
    } else if (boss.deathTicks > 0) boss.deathTicks--;
  }
  updateBossHazards();
  updateBossHudElements();
}

function bossTellLabel(boss) {
  if (boss.bossState === 'intro') return '躲开预警 · 核心发光时攻击';
  if (boss.bossState === 'phase') return `第 ${boss.bossPhase} 阶段 · 新招式觉醒`;
  if (bossIsOpen(boss)) return '核心暴露！挥爪 / 星火 / 重击';
  if (boss.bossState === 'charge' || boss.nextMove === 'charge' && boss.bossState === 'tell') return '冲锋！跳跃越过，或用闪冲躲开';
  if (boss.bossState === 'leap' || boss.bossState === 'tell' && ['leap', 'doubleLeap', 'repeatLeap'].includes(boss.nextMove)) return '落地震波！跳跃越过地面光环';
  if (boss.nextMove === 'meteor' && ['tell', 'volley'].includes(boss.bossState)) return '星陨！离开地面的紫色标记';
  if (boss.nextMove === 'volley' && ['tell', 'volley'].includes(boss.bossState)) return '飞弹！汪叫反弹 / 闪冲穿过';
  return '观察预警 · 等待攻击机会';
}

function updateBossHudElements() {
  const panel = document.querySelector('#boss-panel');
  if (!panel) return;
  const boss = currentBoss();
  const visible = boss && boss.alive && boss.bossState !== 'waiting';
  panel.hidden = !visible;
  panel.classList.toggle('hidden', !visible);
  panel.classList.toggle('show', Boolean(visible));
  if (!visible) return;
  const name = document.querySelector('#boss-name');
  const health = document.querySelector('#boss-health-fill');
  const phase = document.querySelector('#boss-phase');
  if (name && name.textContent !== boss.recipe.name) name.textContent = boss.recipe.name;
  const ratio = `${boss.health / boss.maxHealth * 100}%`;
  if (health && health.style.width !== ratio) health.style.width = ratio;
  const phaseLabel = `阶段 ${boss.bossPhase} / 3 · ${boss.health} / ${boss.maxHealth}`;
  if (phase && phase.textContent !== phaseLabel) phase.textContent = phaseLabel;
}

function bossPixelStar(x, y, color, size = 3) {
  fill(x - size, y, size * 3, size, color);
  fill(x, y - size, size, size * 3, color);
}

function drawBossGuardian(boss, x, y) {
  const open = bossIsOpen(boss);
  const flash = boss.flash > 0 && tick % 4 < 2;
  const armour = flash ? '#e8edff' : boss.bossPhase === 3 ? '#77739a' : '#697992';
  const shade = '#25314c', light = '#bdc8da';
  const bob = boss.bossState === 'charge' ? Math.sin(tick * .8) * 3 : Math.sin(tick * .045) * 2;
  y += bob;
  // Heavy paws, layered shoulders, articulated armour and a glowing moon core.
  fill(x + 8, y + 79, 27, 24, shade); fill(x + 67, y + 79, 27, 24, shade);
  fill(x + 10, y + 81, 24, 17, armour); fill(x + 68, y + 81, 24, 17, armour);
  fill(x + 8, y + 98, 29, 7, '#15243e'); fill(x + 66, y + 98, 29, 7, '#15243e');
  [12, 23, 72, 83].forEach(offset => fill(x + offset, y + 99, 7, 4, '#d1d7df'));
  fill(x + 4, y + 30, 96, 59, shade);
  fill(x + 10, y + 25, 84, 62, armour);
  fill(x + 17, y + 23, 70, 11, light);
  fill(x + 3, y + 35, 20, 36, '#4c5c78'); fill(x + 81, y + 35, 20, 36, '#4c5c78');
  fill(x + 5, y + 35, 17, 7, '#adbacc'); fill(x + 82, y + 35, 17, 7, '#adbacc');
  fill(x + 9, y + 59, 14, 16, '#354564'); fill(x + 81, y + 59, 14, 16, '#354564');
  fill(x + 20, y + 57, 65, 25, '#3e4e6b');
  fill(x + 25, y + 62, 55, 5, '#71849b');
  fill(x + 44, y + 60, 18, 20, '#1a2a44');
  const glow = open ? '#b8fff0' : boss.bossPhase === 3 ? '#ff9bbb' : '#b7a8ee';
  fill(x + 48, y + 63, 10, 14, glow); fill(x + 45, y + 67, 16, 6, glow);
  if (open) {
    ctx.globalAlpha = .28 + Math.sin(tick / 5) * .08;
    fill(x + 37, y + 53, 32, 33, '#a9fff0'); ctx.globalAlpha = 1;
    bossPixelStar(x + 31 + Math.sin(tick / 9) * 7, y + 62, '#c0fff4', 3);
    bossPixelStar(x + 77, y + 47 + Math.cos(tick / 11) * 6, '#c0fff4', 2);
  }
  fill(x + 23, y + 5, 59, 50, shade);
  fill(x + 28, y + 7, 49, 42, armour);
  fill(x + 31, y + 5, 43, 7, light);
  fill(x + 23, y + 3, 13, 19, '#394c6a'); fill(x + 70, y + 3, 13, 19, '#394c6a');
  fill(x + 23, y - 11, 9, 19, '#c0cde0'); fill(x + 74, y - 11, 9, 19, '#c0cde0');
  fill(x + 26, y - 14, 6, 10, '#edf0e5'); fill(x + 74, y - 14, 6, 10, '#edf0e5');
  fill(x + 30, y + 22, 18, 13, shade); fill(x + 59, y + 22, 18, 13, shade);
  const angry = ['tell', 'charge', 'phase'].includes(boss.bossState);
  fill(x + 34, y + 25, 11, 7, angry ? '#ffb086' : '#f4e3aa');
  fill(x + 62, y + 25, 11, 7, angry ? '#ffb086' : '#f4e3aa');
  fill(x + (boss.facing > 0 ? 41 : 34), y + 25, 4, 7, '#312943');
  fill(x + (boss.facing > 0 ? 69 : 62), y + 25, 4, 7, '#312943');
  fill(x + 36, y + 39, 34, 12, '#aab7c7'); fill(x + 46, y + 37, 14, 8, '#283551');
  fill(x + 41, y + 49, 24, 4, '#273650');
  fill(x + 42, y + 46, 5, 6, '#eceddd'); fill(x + 59, y + 46, 5, 6, '#eceddd');
  // Small engraved cracks gain light as the battle progresses.
  fill(x + 16, y + 45, 3, 11, '#aebed1'); fill(x + 84, y + 44, 3, 12, '#aebed1');
  if (boss.bossPhase >= 2) { fill(x + 28, y + 35, 3, 14, glow); fill(x + 73, y + 55, 3, 20, glow); }
  if (boss.bossPhase === 3) { fill(x + 40, y + 12, 3, 9, glow); fill(x + 64, y + 14, 3, 7, glow); }
}

function drawBossBramble(boss, x, y) {
  const open = bossIsOpen(boss);
  const bright = boss.flash > 0 && tick % 4 < 2;
  const rust = bright ? '#ffe0ac' : '#a95e42';
  const leaf = boss.bossPhase === 3 ? '#c17859' : '#669451';
  const foot = boss.bossState === 'charge' ? Math.sin(tick * .7) * 3 : 0;
  fill(x + 9, y + 63 + foot, 22, 17 - foot, '#674237');
  fill(x + 64, y + 63 - foot, 22, 17 + foot, '#674237');
  fill(x + 6, y + 74 + foot, 26, 7, '#3d3839'); fill(x + 62, y + 74 - foot, 27, 7, '#3d3839');
  fill(x + 4, y + 21, 86, 46, '#614836'); fill(x + 8, y + 15, 78, 52, rust);
  fill(x + 15, y + 12, 66, 12, '#d6935d'); fill(x + 13, y + 46, 69, 20, '#8c543e');
  fill(x + 26, y + 54, 42, 17, '#563b36'); fill(x + 32, y + 55, 31, 13, '#e5ad66');
  [0, 1, 2, 3, 4].forEach(i => {
    const leafX = x + 4 + i * 18;
    const leafY = y + 8 + Math.sin(i + tick / 30) * 3;
    fill(leafX, leafY, 16, 17, '#416149'); fill(leafX + 3, leafY - 5, 10, 18, leaf);
    fill(leafX + 7, leafY - 9, 4, 10, '#b7c86e');
    fill(leafX + 4, leafY + 4, 8, 4, '#8eae59');
  });
  fill(x + 21, y + 22, 19, 11, '#563b36'); fill(x + 55, y + 22, 19, 11, '#563b36');
  const eye = ['tell', 'charge'].includes(boss.bossState) ? '#ffda95' : '#e9efa6';
  fill(x + 26, y + 23, 10, 7, eye); fill(x + 58, y + 23, 10, 7, eye);
  fill(x + (boss.facing > 0 ? 33 : 26), y + 24, 3, 6, '#383f35');
  fill(x + (boss.facing > 0 ? 65 : 58), y + 24, 3, 6, '#383f35');
  fill(x + 37, y + 34, 20, 12, '#e5a16f'); fill(x + 42, y + 34, 12, 7, '#603a37');
  fill(x + 34, y + 46, 28, 5, '#4b3935'); fill(x + 37, y + 44, 6, 5, '#ffedb6'); fill(x + 54, y + 44, 6, 5, '#ffedb6');
  fill(x + 3, y + 30, 10, 17, '#644637'); fill(x + 81, y + 30, 10, 17, '#644637');
  fill(x - 2, y + 31, 10, 5, '#b3c977'); fill(x + 86, y + 31, 10, 5, '#b3c977');
  fill(x - 5, y + 45, 11, 4, '#b3c977'); fill(x + 89, y + 45, 11, 4, '#b3c977');
  const core = open ? '#e4ffae' : '#d68464';
  fill(x + 40, y + 54, 16, 17, '#673e3b'); fill(x + 44, y + 57, 8, 10, core);
  if (open) {
    ctx.globalAlpha = .26; fill(x + 32, y + 48, 32, 30, '#d6ff95'); ctx.globalAlpha = 1;
    bossPixelStar(x + 25, y + 54 + Math.sin(tick / 8) * 6, '#e9ffac');
    bossPixelStar(x + 70, y + 53, '#e9ffac', 2);
  }
}

function drawBossTelegraph(boss) {
  if (boss.bossState !== 'tell') return;
  const pulse = .18 + Math.abs(Math.sin(tick / 5)) * .13;
  const x = boss.x - camera;
  if (boss.nextMove === 'charge') {
    const from = boss.facing < 0 ? boss.recipe.left + 18 : boss.x + boss.w;
    const to = boss.facing < 0 ? boss.x : boss.recipe.right - 18;
    ctx.globalAlpha = pulse;
    fill(from - camera, GROUND - 34, to - from, 32, '#ff7868');
    ctx.globalAlpha = .8;
    for (let arrow = from + 25; arrow < to; arrow += 48) {
      fill(arrow - camera, GROUND - 22, 15, 3, '#ffc1a1');
      fill(arrow - camera + (boss.facing > 0 ? 12 : 0), GROUND - 26, 3, 11, '#ffc1a1');
    }
    ctx.globalAlpha = 1;
  } else if (['leap', 'doubleLeap', 'repeatLeap'].includes(boss.nextMove)) {
    const target = boss.targetX + boss.w / 2 - camera;
    ctx.globalAlpha = pulse + .18;
    fill(target - 58, GROUND - 8, 116, 8, '#ff957e');
    fill(target - 48, GROUND - 14, 96, 4, '#ffc1a6');
    ctx.globalAlpha = 1;
    bossPixelStar(target - 2, GROUND - 27, '#ffe2ac');
  } else {
    const color = boss.nextMove === 'meteor' ? '#d5a5ff' : '#ffc198';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = .6;
    ctx.beginPath(); ctx.arc(x + boss.w / 2, boss.y + 40, 30 + Math.sin(tick / 7) * 5, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const fraction = 1 - Math.max(0, boss.bossTimer / boss.tellTotal);
  fill(x + 13, boss.y - 25, boss.w - 26, 5, '#463d52');
  fill(x + 13, boss.y - 25, (boss.w - 26) * fraction, 5, '#ffb490');
}

function drawBossHazards() {
  for (const hazard of bossHazards) {
    if (hazard.zoneId !== zone.id || hazard.life <= 0) continue;
    const x = hazard.x - camera, y = hazard.y;
    if (hazard.delay > 0) {
      ctx.globalAlpha = .35 + Math.sin(tick / 4) * .14;
      fill(x - 13, GROUND - 7, 54, 7, '#ce9bff');
      fill(x - 6, GROUND - 14, 40, 4, '#f2cbff');
      ctx.globalAlpha = 1;
      bossPixelStar(x + 12, GROUND - 30, '#f2cbff', 3);
      continue;
    }
    if (hazard.kind === 'wave') {
      ctx.globalAlpha = .28;
      fill(x - 8, y - 7, 44, 30, hazard.owner.recipe.colour);
      ctx.globalAlpha = 1;
      fill(x + 8, y, 11, 4, '#fff1b6'); fill(x + 4, y + 4, 21, 4, '#fff1b6');
      fill(x + 1, y + 8, 27, 5, '#eda98f'); fill(x - 2, y + 14, 32, 6, '#c885a9');
      fill(x + 5, y + 10, 18, 13, '#ecd8a5');
    } else if (hazard.kind === 'seed') {
      fill(x + 4, y, 10, 5, '#c8dc77'); fill(x, y + 5, 18, 9, '#7d5544');
      fill(x + 3, y + 4, 12, 9, '#e8b574'); fill(x + 5, y + 6, 5, 4, '#ffe0a0');
      fill(x + 5, y + 14, 9, 4, '#9c6244');
    } else {
      const reflected = !hazard.hostile;
      const size = hazard.kind === 'meteor' ? 28 : 18;
      const color = reflected ? '#9dfff2' : '#bda1f7';
      ctx.globalAlpha = .2;
      fill(x - 7, y - 7, size + 14, size + 14, color);
      ctx.globalAlpha = 1;
      fill(x + size * .25, y, size * .5, size, color);
      fill(x, y + size * .25, size, size * .5, color);
      fill(x + size * .3, y + size * .3, size * .4, size * .4, '#fff6df');
      if (hazard.kind === 'meteor') {
        fill(x + 8, y - 18, 12, 19, '#7963b0'); fill(x + 11, y - 28, 7, 20, '#554979');
      }
    }
  }
}

function drawBossBattle() {
  const boss = currentBoss();
  if (!boss) return;
  for (const gate of bossSolidGate()) {
    const x = gate.x - camera;
    if (x < -30 || x > W + 30) continue;
    ctx.globalAlpha = boss.bossState === 'waiting' ? .38 : .64;
    fill(x, GROUND - 214, 16, 214, '#9783bd');
    fill(x + 6, GROUND - 214, 4, 214, '#e3c5ff');
    for (let mark = 0; mark < 7; mark++) fill(x - 5, GROUND - 20 - mark * 29, 26, 3, '#e3c5ff');
    ctx.globalAlpha = 1;
    fill(x - 9, GROUND - 14, 34, 14, '#424767');
    bossPixelStar(x + 6, GROUND - 223, '#e3c5ff', 4);
  }
  drawBossHazards();
  const x = boss.x - camera;
  if (x < -140 || x > W + 140) return;
  if (!boss.alive && boss.deathTicks <= 0) return;
  ctx.globalAlpha = boss.alive ? .2 : .1;
  fill(x + 3, GROUND - 5, boss.w - 3, 6, '#10243e');
  ctx.globalAlpha = boss.alive ? 1 : Math.min(1, boss.deathTicks / 55);
  if (!boss.alive) {
    fill(x + 12, GROUND - 29, boss.w - 24, 27, boss.type === 'bramble' ? '#a87757' : '#6d7991');
    fill(x + 20, GROUND - 34, boss.w - 40, 9, boss.type === 'bramble' ? '#cbaa6d' : '#b9c5d5');
    ctx.globalAlpha = 1;
    return;
  }
  drawBossTelegraph(boss);
  if (boss.type === 'bramble') drawBossBramble(boss, x, boss.y);
  else drawBossGuardian(boss, x, boss.y);
  ctx.globalAlpha = 1;
  if (boss.bossState === 'phase') {
    ctx.globalAlpha = .3 + Math.sin(tick / 5) * .15;
    fill(x - 12, boss.y - 20, boss.w + 24, boss.h + 20, boss.recipe.colour);
    ctx.globalAlpha = 1;
  }
}

function drawBossHud() {
  const boss = currentBoss();
  if (!boss || !boss.alive || boss.bossState === 'waiting') return;
  const y = H - 40;
  ctx.globalAlpha = .9; fill(W / 2 - 190, y, 380, 27, '#192b45'); ctx.globalAlpha = 1;
  ctx.font = 'bold 12px system-ui, sans-serif'; ctx.fillStyle = bossIsOpen(boss) ? '#bdffe5' : '#e2d4c8';
  ctx.textAlign = 'center'; ctx.fillText(bossTellLabel(boss), W / 2, y + 18); ctx.textAlign = 'left';
  if (boss.bossState === 'intro' && boss.bossTimer > 34) {
    ctx.globalAlpha = Math.min(1, (90 - boss.bossTimer) / 12, (boss.bossTimer - 34) / 12);
    fill(W / 2 - 244, 184, 488, 91, '#1b2d46');
    fill(W / 2 - 244, 184, 488, 3, boss.recipe.colour);
    ctx.font = 'bold 27px system-ui, sans-serif'; ctx.fillStyle = '#fff1d0';
    ctx.textAlign = 'center'; ctx.fillText(boss.recipe.name, W / 2, 224);
    ctx.font = '14px system-ui, sans-serif'; ctx.fillStyle = '#cdd6e5'; ctx.fillText(boss.recipe.subtitle, W / 2, 254);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
}
