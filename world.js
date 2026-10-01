// Interactive routes, treasure seals and moving terrain shared by every stage.
const enemyShots = [];
let gemCount = 0;
let stageGems = 0;
let tutorialSeen = new Set();

function prepareWorldFeatures() {
  const definitions = {
    surface: {
      platforms: [[31, 4, 2.6, 'y', 60], [58, 3, 2, 'x', 64], [91, 4, 2.6, 'x', 58]],
      gems: [[12, 8.2], [44, 6.1], [133, 8]], seals: [[42, 3.2]], hazards: [],
    },
    cave: {
      platforms: [[20, 3.2, 2.5, 'x', 55], [33, 4, 2, 'y', 66]],
      gems: [[15, 7.2], [29, 6.2]], seals: [[32, 1.2]], hazards: [],
    },
    orchard: {
      platforms: [[30, 3, 2.5, 'x', 64], [49, 4, 2, 'y', 60], [63, 3.3, 2.5, 'x', 58]],
      gems: [[20, 8], [50, 7.3], [65, 5.4]], seals: [[48, 3.2]], hazards: [[57, 'spikes', 2]],
    },
    sky: {
      platforms: [[21, 3.3, 2.8, 'x', 68], [43, 4.3, 2.5, 'y', 55], [66, 3.3, 2.7, 'x', 62], [72, 5.6, 2.8, 'x', 75]],
      gems: [[23, 6.8], [46, 7.3], [79, 8.3]], seals: [[52, 3.5]], hazards: [],
    },
    castle: {
      platforms: [[26, 3.1, 2.4, 'x', 60], [57, 3.2, 2.4, 'x', 55]],
      gems: [[21, 8], [47, 8.5], [65, 6.5]], seals: [[35, 3.2]], hazards: [[34, 'flame', 1], [48, 'spikes', 2], [64, 'flame', 1]],
    },
  };
  for (const [id, definition] of Object.entries(definitions)) {
    const level = zones[id];
    level.platforms = definition.platforms.map(([tile, row, width, axis, range], index) => ({
      x: tile * T, y: GROUND - row * T, baseX: tile * T, baseY: GROUND - row * T,
      w: width * T, h: 15, axis, range, phase: index * 1.7 + tile * .1, type: 'platform', oneWay: true,
      dx: 0, dy: 0,
    }));
    level.gemSeeds = definition.gems.map(([tile, row]) => ({ x: tile * T + 12, y: GROUND - row * T, w: 24, h: 28 }));
    level.seals = definition.seals.map(([tile, row]) => ({ x: tile * T, y: GROUND - row * T, w: 38, h: 44, open: false }));
    level.hazards = definition.hazards.map(([tile, type, width], index) => ({ x: tile * T, y: GROUND - 20, w: width * T, h: 20, type, phase: index * 73 }));
    level.tutorials = id === 'surface' ? [
      [3, '空中再按跳跃 · 二段跳越过更远的地方'],
      [15, 'J 挥爪连招 · K 冲刺穿过敌人的攻击'],
      [28, '空中按 ↓ 下砸 · 按 L 用汪汪声波震开机关'],
    ] : [];
  }
  stagePickup(surface, 'boomerang', 41, 82);
  stagePickup(orchard, 'boomerang', 43, 165);
  stagePickup(sky, 'boomerang', 33, 95);
  castle.pickupSeeds.push({ type: 'bone', x: 74 * T, y: GROUND - 60 });
  orchard.enemySeeds.push({ type: 'spitter', x: 55 * T, direction: -1 });
  castle.enemySeeds.push({ type: 'spitter', x: 50 * T, direction: -1 });
}

function resetWorldFeatures(levels) {
  enemyShots.length = 0;
  for (const level of levels) {
    level.gems = (level.gemSeeds || []).map(seed => ({ ...seed, taken: false }));
    (level.seals || []).forEach(seal => { seal.open = false; });
    (level.platforms || []).forEach(platform => { platform.x = platform.baseX; platform.y = platform.baseY; platform.dx = 0; platform.dy = 0; });
  }
}

function worldSolids() { return zone.platforms || []; }

function updateWorldFeatures() {
  for (const platform of zone.platforms || []) {
    const previousX = platform.x, previousY = platform.y;
    const movement = Math.sin(tick * .018 + platform.phase) * platform.range;
    platform.x = platform.baseX + (platform.axis === 'x' ? movement : 0);
    platform.y = platform.baseY + (platform.axis === 'y' ? movement : 0);
    platform.dx = platform.x - previousX;
    platform.dy = platform.y - previousY;
    if (player.grounded && Math.abs(player.y + player.h - previousY) < 3 && player.x + player.w > previousX && player.x < previousX + platform.w) {
      player.x += platform.dx;
      player.y += platform.dy;
    }
  }
  for (const hazard of zone.hazards || []) {
    const cycle = (tick + hazard.phase) % 180;
    hazard.warning = hazard.type === 'flame' && cycle > 90 && cycle < 120;
    hazard.active = hazard.type === 'spikes' || cycle >= 120;
    const hitbox = { ...hazard, y: hazard.type === 'flame' ? GROUND - 94 : hazard.y, h: hazard.type === 'flame' ? 94 : hazard.h };
    if (hazard.active && overlap(player, hitbox)) damagePlayer(1, hazard.x + hazard.w / 2);
  }
  for (const gem of zone.gems || []) {
    if (!gem.taken && overlap(player, gem)) {
      gem.taken = true;
      gemCount++; stageGems++; score += 1500;
      feedback(gem.x + 12, gem.y + 14, '#a9f5dd', 3);
      floatingText(gem.x + 12, gem.y, '星晶 +1', '#b1f7db');
      sound('gem'); updateHud();
      showToast('星晶已收藏 · 挑战高处的奖励路线');
    }
  }
  for (const [tile, message] of zone.tutorials || []) {
    const key = zone.id + tile;
    if (player.x > tile * T && !tutorialSeen.has(key)) { tutorialSeen.add(key); showToast(message); }
  }
  for (const shot of enemyShots) {
    if (shot.life <= 0) continue;
    shot.x += shot.vx; shot.y += shot.vy || 0; shot.life--;
    if (overlap(player, shot)) { damagePlayer(1, shot.x); shot.life = 0; }
    if (solids().some(solid => !solid.oneWay && overlap(shot, solid))) shot.life = 0;
  }
  for (let i = enemyShots.length - 1; i >= 0; i--) if (enemyShots[i].life <= 0) enemyShots.splice(i, 1);
}

function barkWorld(x, y) {
  for (const seal of zone.seals || []) {
    if (seal.open || Math.hypot(seal.x + 19 - x, seal.y + 22 - y) > 175) continue;
    seal.open = true;
    const gem = { x: seal.x + 7, y: seal.y - 38, w: 24, h: 28, taken: false };
    zone.gems.push(gem);
    powerups.push({ type: 'bone', x: seal.x + 42, y: seal.y - 28, w: 34, h: 30, age: 0, taken: false });
    score += 500;
    feedback(seal.x + 19, seal.y + 18, '#9de5e0', 7);
    floatingText(seal.x + 19, seal.y, '封印解除', '#bdf4dc');
    showToast('声波解开了爪印宝箱！');
    sound('power');
  }
  for (const shot of enemyShots) {
    if (Math.hypot(shot.x - x, shot.y - y) < 170) {
      shot.life = 0;
      projectiles.push({ x: shot.x, y: shot.y, w: 16, h: 12, vx: player.facing * 9, life: 50, phase: tick });
      sparkle(shot.x, shot.y, '#bdf4dc', 6);
    }
  }
}

function drawWorldFeatures() {
  for (const platform of zone.platforms || []) {
    const x = platform.x - camera, y = platform.y;
    if (x < -platform.w || x > W) continue;
    const tint = zone === sky ? '#abd9d4' : zone === castle || zone === cave ? '#7184a3' : '#bcaa73';
    fill(x - 3, y, platform.w + 6, 15, '#253a52');
    fill(x, y - 3, platform.w, 9, tint);
    fill(x + 4, y - 4, platform.w - 8, 3, '#f0efd0');
    for (let i = 8; i < platform.w - 8; i += 21) { fill(x + i, y + 6, 7, 4, '#5a7185'); fill(x + i + 2, y + 7, 3, 2, '#c9ece5'); }
    if (platform.axis === 'y') {
      ctx.globalAlpha = .25;
      fill(platform.baseX + platform.w / 2 - camera - 2, platform.baseY - platform.range, 4, platform.range * 2 + 15, tint);
      ctx.globalAlpha = 1;
    }
    const arrow = platform.axis === 'x' ? '↔' : '↕';
    ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff4ce'; ctx.fillText(arrow, x + platform.w / 2, y + 12);
  }
  for (const gem of zone.gems || []) {
    if (gem.taken || gem.x < camera - 30 || gem.x > camera + W + 30) continue;
    const x = gem.x - camera + 12, y = gem.y + 14 + Math.sin(tick / 17 + gem.x) * 4;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = .14; fill(-20, -20, 40, 40, '#9bffe0'); ctx.globalAlpha = 1;
    fill(-10, -10, 20, 20, '#335e75'); fill(-8, -8, 16, 16, '#77c9c4'); fill(-6, -6, 8, 8, '#d0f6dd'); fill(2, 2, 6, 6, '#4a9dab'); ctx.restore();
    fill(x - 1, y - 18, 3, 6, '#fff2bd'); fill(x - 3, y - 16, 7, 2, '#fff2bd');
  }
  for (const seal of zone.seals || []) {
    const x = seal.x - camera, y = seal.y;
    if (x < -60 || x > W + 60) continue;
    fill(x - 4, y + 37, 46, 8, '#283a55');
    fill(x, y + 12, 38, 28, seal.open ? '#586d7c' : '#537c88');
    fill(x + 3, y + 4, 32, 20, seal.open ? '#91a8ab' : '#8ec5be');
    fill(x + 4, y + 7, 30, 4, '#d7e7c2');
    fill(x + 16, y + 24, 7, 7, '#efd197');
    if (!seal.open) {
      ctx.globalAlpha = .14 + Math.sin(tick / 15) * .05; fill(x - 10, y - 4, 58, 55, '#98f0dc'); ctx.globalAlpha = 1;
      drawPawGlyph(x + 19, y + 17, '#fff2cb', 1);
      ctx.textAlign = 'center'; ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#e9f1d9'; ctx.fillText('L · 声波解印', x + 19, y - 11);
    }
  }
  for (const hazard of zone.hazards || []) {
    const x = hazard.x - camera;
    if (x < -hazard.w || x > W) continue;
    fill(x - 3, GROUND - 5, hazard.w + 6, 7, '#43364c');
    if (hazard.type === 'spikes') {
      for (let i = 0; i < hazard.w; i += 14) { fill(x + i, GROUND - 14, 12, 10, '#7d829b'); fill(x + i + 3, GROUND - 21, 6, 10, '#b4becb'); fill(x + i + 5, GROUND - 25, 2, 9, '#e0e4d4'); }
    } else {
      fill(x + 4, GROUND - 10, hazard.w - 8, 8, '#63738d');
      if (hazard.active) for (let i = 0; i < 3; i++) {
        const h = 56 + Math.sin(tick / 3 + i) * 17;
        fill(x + 6 + i * 10, GROUND - h, 13, h - 8, '#d87569'); fill(x + 9 + i * 10, GROUND - h + 12, 7, h - 23, '#ffbb7b'); fill(x + 11 + i * 10, GROUND - h + 27, 3, h - 39, '#fff0b5');
      }
      if (hazard.warning) { ctx.textAlign = 'center'; ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#ffd394'; ctx.fillText('!', x + hazard.w / 2, GROUND - 29); }
    }
  }
  for (const shot of enemyShots) {
    fill(shot.x - camera, shot.y, shot.w, shot.h, '#916d9b'); fill(shot.x - camera + 3, shot.y + 2, 6, 4, '#e5aec4');
  }
}

function drawPawGlyph(x, y, color, size = 1) {
  fill(x - 5 * size, y, 10 * size, 6 * size, color);
  fill(x - 8 * size, y - 6 * size, 4 * size, 5 * size, color);
  fill(x - 2 * size, y - 9 * size, 4 * size, 5 * size, color);
  fill(x + 4 * size, y - 6 * size, 4 * size, 5 * size, color);
}
