// Saves only this game's checkpoints, preferences and stage records on this device.
const SAVE_KEY = 'plush-quest-v2';
let saveData = { version: 2, records: {}, run: null, settings: {} };
try {
  const stored = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (stored && stored.version === 2) {
    saveData.records = stored.records && typeof stored.records === 'object' ? stored.records : {};
    saveData.settings = stored.settings && typeof stored.settings === 'object' ? stored.settings : {};
    saveData.run = stored.run && typeof stored.run === 'object' ? stored.run : null;
  }
} catch { /* Storage can be unavailable in private or embedded browsers. */ }

function persistSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(saveData)); } catch { /* Gameplay stays available. */ }
}
function saveSettings() { saveData.settings = { muted, musicEnabled }; persistSave(); }
function validSavedZone(id) { return typeof id === 'string' && Object.prototype.hasOwnProperty.call(zones, id); }

function saveProgress(won = false) {
  if (!player || lives <= 0) return;
  const world = {};
  for (const level of Object.values(zones)) {
    world[level.id] = {
      coins: level.coins.map(coin => coin.taken),
      gems: (level.gems || []).map(gem => gem.taken),
      seals: (level.seals || []).map(seal => seal.open),
      enemies: level.enemies.map(enemy => enemy.alive),
      blocks: level.blocks.map(block => [block.used, block.broken]),
      powerups: level.powerups.map(item => ({ type: item.type, x: item.x, y: item.y, taken: item.taken })),
    };
  }
  saveData.run = {
    stage: zone.id, checkpoint: { ...checkpoint }, score, coinCount, gemCount, stageGems, lives,
    timeLeft, runDeaths, stageDeaths, stageHits, won,
    equipment: { shield: player.shield, bootsTime: player.bootsTime, starTime: player.starTime,
      magnetTime: player.magnetTime, weapon: player.weapon, weaponTime: player.weaponTime }, world,
  };
  persistSave();
}

function continueGame() {
  const stored = saveData.run;
  if (!stored || !validSavedZone(stored.stage)) { startGame(); return; }
  const run = JSON.parse(JSON.stringify(stored));
  startGame(true, run.stage);
  const number = (value, min, max, fallback) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  score = number(run.score, 0, 9999999, 0); coinCount = number(run.coinCount, 0, 9999, 0);
  gemCount = number(run.gemCount, 0, 999, 0); stageGems = number(run.stageGems, 0, 99, 0);
  lives = number(run.lives, 1, 20, 3); timeLeft = number(run.timeLeft, 60, 400, 400);
  runDeaths = number(run.runDeaths, 0, 999, 0); stageDeaths = number(run.stageDeaths, 0, 999, 0); stageHits = number(run.stageHits, 0, 999, 0);
  for (const level of Object.values(zones)) {
    const world = run.world?.[level.id];
    if (!world) continue;
    level.coins.forEach((coin, index) => { coin.taken = !!world.coins?.[index]; });
    level.blocks.forEach((block, index) => { block.used = !!world.blocks?.[index]?.[0]; block.broken = !!world.blocks?.[index]?.[1]; });
    level.enemies.forEach((enemy, index) => { enemy.alive = world.enemies?.[index] !== false; });
    (level.seals || []).forEach((seal, index) => {
      seal.open = !!world.seals?.[index];
      if (seal.open) level.gems.push({ x: seal.x + 7, y: seal.y - 38, w: 24, h: 28, taken: false });
    });
    (level.gems || []).forEach((gem, index) => { gem.taken = !!world.gems?.[index]; });
    if (Array.isArray(world.powerups)) level.powerups = world.powerups.slice(0, 100).filter(item => ['bone','boots','star','magnet','heart','spark','claw','boomerang'].includes(item.type))
      .map(item => ({ type: item.type, x: number(item.x, 0, level.width, 80), y: number(item.y, -100, GROUND, 350), taken: !!item.taken, w: 34, h: 30, age: 0 }));
  }
  const equipment = run.equipment || {};
  player.shield = !!equipment.shield;
  for (const key of ['bootsTime', 'starTime', 'magnetTime', 'weaponTime']) player[key] = number(equipment[key], 0, 3600, 0);
  player.weapon = ['spark', 'claw', 'boomerang'].includes(equipment.weapon) ? equipment.weapon : null;
  const savedZone = validSavedZone(run.checkpoint?.zone) ? zones[run.checkpoint.zone] : zones[run.stage];
  activateZone(savedZone);
  checkpoint = { zone: savedZone.id, x: number(run.checkpoint?.x, 40, savedZone.width - 80, 80), y: number(run.checkpoint?.y, 0, GROUND - 34, GROUND - 34) };
  player.x = checkpoint.x; player.y = checkpoint.y; player.prevY = player.y;
  player.invulnerable = 80; camera = Math.max(0, Math.min(zone.width - W, player.x - 315));
  arrivalFade = 20; updateHud(); updateBossHudElements();
  showToast('已回到最近的营地 · 装备与收集进度已恢复');
  if (run.won && zone !== castle) advanceStage();
  saveProgress();
}

function recordCompletion() {
  const grade = stageDeaths === 0 && stageHits === 0 && stageGems >= 2 ? 'S' : stageDeaths === 0 ? 'A' : stageDeaths <= 1 ? 'B' : 'C';
  const record = { grade, score, gems: stageGems, seconds: Math.round(400 - timeLeft), date: new Date().toISOString().slice(0, 10) };
  const previous = saveData.records[zone.id];
  const ranks = { S: 4, A: 3, B: 2, C: 1 };
  if (!previous || ranks[grade] > ranks[previous.grade] || ranks[grade] === ranks[previous.grade] && score > previous.score) saveData.records[zone.id] = record;
  if (zone === castle) saveData.run = null;
  persistSave();
  return grade;
}

function updateTitleRecords() {
  const button = document.querySelector('#continue-button');
  if (button) {
    const available = !!saveData.run && validSavedZone(saveData.run.stage);
    button.classList.toggle('hidden', !available || state !== 'title');
    if (available) button.textContent = `继续冒险 · ${zones[saveData.run.stage].stage || '秘密岩洞'}`;
  }
  for (const button of document.querySelectorAll('[data-stage]')) {
    const record = saveData.records[button.dataset.stage];
    const badge = button.querySelector?.('.stage-record');
    if (badge) badge.textContent = record ? `${record.grade} 级` : '未挑战';
  }
}
