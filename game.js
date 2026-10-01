const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const overlay = document.querySelector('#overlay');
const primaryButton = document.querySelector('#primary-button');
const pauseButton = document.querySelector('#pause-button');
const soundButton = document.querySelector('#sound-button');
const toastElement = document.querySelector('#toast');
const effectBar = document.querySelector('#effect-bar');
const contextHint = document.querySelector('#context-hint');
const zoneName = document.querySelector('#zone-name');
const stageNumber = document.querySelector('#stage-number');
const levelPicker = document.querySelector('#level-picker');
const hud = {
  score: document.querySelector('#score'),
  coins: document.querySelector('#coins'),
  time: document.querySelector('#time'),
  lives: document.querySelector('#lives'),
};

const W = 960;
const H = 540;
const T = 42;
const GROUND = 450;
const WORLD = 154 * T;
const CAVE_WIDTH = 47 * T;
const FLAG_X = 144 * T;
const groundPieces = [
  { x: 0, w: 59 * T },
  { x: 62 * T, w: 30 * T },
  { x: 95 * T, w: WORLD - 95 * T },
];
const control = { left: false, right: false, down: false, jump: false, run: false, attack: false, dash: false, bark: false };
const blocks = [];
const pipes = [];
const stairs = [];
const coinSeeds = [];
const enemySeeds = [];
const pickupSeeds = [];
const particles = [];
const movingCoins = [];
const projectiles = [];
const decorations = [];
const surface = { id: 'surface', name: '晴空草原 1 — 1', width: WORLD, groundPieces, blocks, pipes, stairs, coinSeeds, enemySeeds, pickupSeeds, decorations };
const cave = {
  id: 'cave', name: '星光岩洞', width: CAVE_WIDTH,
  groundPieces: [{ x: 0, w: 20 * T }, { x: 23 * T, w: CAVE_WIDTH - 23 * T }],
  blocks: [], pipes: [], stairs: [], coinSeeds: [], enemySeeds: [], pickupSeeds: [], decorations: [],
};
const zones = { surface, cave };
surface.theme = 'meadow'; surface.stage = '1-1'; surface.finishX = FLAG_X; surface.checkpoints = [68, 100];
cave.theme = 'cave';
let zone = surface;
let selectedStage = 'surface';
let checkpoint = { zone: 'surface', x: 80, y: GROUND - 34 };
let warp = null;
let arrivalFade = 0;
let downBuffer = 0;
let portalCooldown = 0;
let sprite = null;
const backdrops = { surface: null, cave: null };
let state = 'title';
let player;
let enemies = [];
let coins = [];
let powerups = [];
let score = 0;
let coinCount = 0;
let lives = 3;
let timeLeft = 400;
let camera = 0;
let tick = 0;
let jumpBuffer = 0;
let attackBuffer = 0;
let audio = null;
let muted = false;
let toastTimeout = 0;
let lastFrame = 0;
let accumulator = 0;
let dashBuffer = 0, barkBuffer = 0;
let hitStop = 0, screenShake = 0, damageFlash = 0, stageIntro = 0;
let deathTimeout = 0;
let runDeaths = 0, stageDeaths = 0, stageHits = 0;
let musicEnabled = saveData.settings.musicEnabled !== false;
const floatingLabels = [], barkWaves = [], ghostTrails = [];
const heldInputs = new Map();
muted = !!saveData.settings.muted;


function addBlock(tx, row, type = 'brick', contents = null) {
  blocks.push({ x: tx * T, y: GROUND - row * T, w: T, h: T, type, contents, used: false, bump: 0, broken: false });
}
function blockLine(from, to, row, pattern) {
  for (let tx = from; tx <= to; tx++) addBlock(tx, row, pattern[tx - from] || 'brick');
}
function addPipe(tx, height, portal = null) {
  pipes.push({ x: tx * T, y: GROUND - height * T, w: 2 * T, h: height * T, type: 'pipe', portal });
}
function addStairs(tx, height) {
  for (let row = 1; row <= height; row++) stairs.push({ x: tx * T, y: GROUND - row * T, w: T, h: T, type: 'stone' });
}
function addCoins(start, end, y, step = T) {
  for (let x = start; x <= end; x += step) coinSeeds.push({ x, y });
}
function buildLevel() {
  blockLine(10, 14, 4, ['brick', 'question', 'brick', 'question', 'brick']);
  blocks.find(b => b.x === 11 * T && b.type === 'question').contents = 'coin';
  blocks.find(b => b.x === 13 * T && b.type === 'question').contents = 'bone';
  addBlock(12, 7, 'question', 'coin');
  blockLine(20, 24, 4, ['question', 'brick', 'question', 'brick', 'question']);
  blocks.find(b => b.x === 22 * T).contents = 'boots';
  blocks.find(b => b.x === 20 * T && b.type === 'question').contents = 'spark';
  addBlock(22, 7, 'brick');
  blockLine(37, 40, 4, ['brick', 'question', 'brick', 'brick']);
  blockLine(43, 46, 4, ['brick', 'brick', 'question', 'brick']);
  blocks.find(b => b.x === 45 * T).contents = 'magnet';
  blockLine(65, 68, 4, ['question', 'brick', 'brick', 'question']);
  addBlock(66, 7, 'question', 'bone');
  blockLine(73, 76, 4, ['brick', 'question', 'brick', 'brick']);
  blockLine(82, 86, 4, ['brick', 'question', 'brick', 'question', 'brick']);
  blockLine(101, 105, 4, ['question', 'brick', 'brick', 'question', 'brick']);
  blocks.find(b => b.x === 104 * T).contents = 'star';
  blockLine(109, 112, 7, ['brick', 'brick', 'question', 'brick']);

  addPipe(30, 2);
  addPipe(36, 3);
  addPipe(48, 3);
  addPipe(54, 2, { zone: 'cave', x: 4 * T, y: GROUND - 34 });
  addPipe(77, 2);
  addPipe(88, 3);
  addPipe(113, 2);
  addPipe(120, 3);

  for (let i = 0; i < 5; i++) addStairs(127 + i, i + 1);
  for (let i = 0; i < 5; i++) addStairs(135 + i, 5 - i);

  addCoins(17 * T, 19 * T, GROUND - 120);
  addCoins(26 * T, 28 * T, GROUND - 170);
  addCoins(58 * T, 63 * T, GROUND - 135);
  addCoins(70 * T, 72 * T, GROUND - 155);
  addCoins(91 * T, 96 * T, GROUND - 140);
  addCoins(116 * T, 119 * T, GROUND - 170);
  addCoins(130 * T, 135 * T, GROUND - 260);

  pickupSeeds.push({ type: 'boots', x: 28 * T, y: GROUND - 112 });
  pickupSeeds.push({ type: 'spark', x: 8 * T, y: GROUND - 82 });
  pickupSeeds.push({ type: 'heart', x: 97 * T, y: GROUND - 155 });

  [16, 23, 27, 33, 42, 44, 51, 57, 65, 71, 75, 81, 84, 99, 106, 110, 117, 122].forEach((tile, i) => {
    const type = i > 2 && i % 5 === 3 ? 'bat' : i > 1 && i % 4 === 2 ? 'beetle' : 'mushroom';
    enemySeeds.push({ x: tile * T, direction: i % 3 === 0 ? 1 : -1, type });
  });
  [6, 18, 28, 41, 53, 65, 79, 87, 100, 111, 123, 143].forEach((tile, i) => {
    decorations.push({ x: tile * T, kind: i % 3, size: i % 2 });
  });
}
buildLevel();

function buildCave() {
  const block = (tile, row, type = 'brick', contents = 'coin') => cave.blocks.push({ x: tile * T, y: GROUND - row * T, w: T, h: T, type, contents, used: false, bump: 0, broken: false });
  for (let tile = 6; tile <= 9; tile++) block(tile, 4, tile === 7 ? 'question' : 'brick', tile === 7 ? 'magnet' : 'coin');
  for (let tile = 13; tile <= 16; tile++) block(tile, 4, tile === 14 ? 'question' : 'brick', tile === 14 ? 'boots' : 'coin');
  for (let tile = 19; tile <= 23; tile++) block(tile, 3, tile === 21 ? 'question' : 'brick', tile === 21 ? 'star' : 'coin');
  for (let tile = 28; tile <= 31; tile++) block(tile, 4, tile === 29 ? 'question' : 'brick', tile === 29 ? 'coin' : 'coin');
  for (let tile = 35; tile <= 38; tile++) block(tile, 4, tile === 36 ? 'question' : 'brick', tile === 36 ? 'bone' : 'coin');
  cave.stairs.push({ x: 18 * T, y: GROUND - 14, w: T, h: 14, type: 'spring' });
  cave.pipes.push({ x: T, y: GROUND - 2 * T, w: 2 * T, h: 2 * T, type: 'pipe', portal: { zone: 'surface', x: 54 * T + 20, y: GROUND - 2 * T - 34 } });
  cave.pipes.push({ x: 42 * T, y: GROUND - 2 * T, w: 2 * T, h: 2 * T, type: 'pipe', portal: { zone: 'surface', x: 78 * T, y: GROUND - 2 * T - 34 } });
  [[5, 8, 126], [11, 15, 235], [18, 24, 155], [26, 30, 122], [33, 37, 210]].forEach(([from, to, height]) => {
    for (let tile = from; tile <= to; tile++) cave.coinSeeds.push({ x: tile * T + T / 2, y: GROUND - height });
  });
  cave.pickupSeeds.push({ type: 'star', x: 18 * T + 14, y: GROUND - 270 });
  cave.pickupSeeds.push({ type: 'heart', x: 33 * T + 14, y: GROUND - 115 });
  cave.pickupSeeds.push({ type: 'magnet', x: 25 * T + 10, y: GROUND - 95 });
  [[9, 'slime'], [12, 'bat'], [26, 'beetle'], [32, 'slime'], [38, 'bat']].forEach(([tile, type], i) => {
    cave.enemySeeds.push({ x: tile * T, direction: i % 2 ? 1 : -1, type });
  });
  [4, 10, 15, 18, 24, 28, 34, 40, 45].forEach((tile, i) => cave.decorations.push({ x: tile * T, kind: i % 3, size: i % 2 }));
}
buildCave();

function createStage(id, stage, name, tiles, spans, finishTile, theme, checkpoints) {
  const level = {
    id, stage, name, theme, width: tiles * T, finishX: finishTile * T, checkpoints,
    groundPieces: spans.map(([start, end]) => ({ x: start * T, w: (end - start) * T })),
    blocks: [], pipes: [], stairs: [], coinSeeds: [], enemySeeds: [], pickupSeeds: [], decorations: [],
  };
  zones[id] = level;
  return level;
}
function stageBlock(level, tile, row, type = 'brick', contents = null) {
  level.blocks.push({ x: tile * T, y: GROUND - row * T, w: T, h: T, type, contents, used: false, bump: 0, broken: false });
}
function stageLine(level, from, to, row, questionTile, item) {
  for (let tile = from; tile <= to; tile++) stageBlock(level, tile, row, tile === questionTile ? 'question' : 'brick', tile === questionTile ? item : null);
}
function stagePipe(level, tile, height) {
  level.pipes.push({ x: tile * T, y: GROUND - height * T, w: 2 * T, h: height * T, type: 'pipe' });
}
function stageCoins(level, from, to, height) {
  for (let tile = from; tile <= to; tile++) level.coinSeeds.push({ x: tile * T + T / 2, y: GROUND - height });
}
function stageStairs(level, tile, height) {
  for (let row = 1; row <= height; row++) level.stairs.push({ x: tile * T, y: GROUND - row * T, w: T, h: T, type: 'stone' });
}
function stagePickup(level, type, tile, height = 80) {
  level.pickupSeeds.push({ type, x: tile * T, y: GROUND - height });
}
function stageEnemies(level, placements) {
  placements.forEach(([tile, type], i) => level.enemySeeds.push({ x: tile * T, direction: i % 2 ? 1 : -1, type }));
}
function stageDecorations(level, tiles) {
  tiles.forEach((tile, i) => level.decorations.push({ x: tile * T, kind: i % 3, size: i % 2 }));
}

const orchard = createStage('orchard', '1-2', '落日果园 1 — 2', 96, [[0, 30], [33, 63], [66, 96]], 94.5, 'orchard', [46, 72]);
stageLine(orchard, 8, 12, 4, 10, 'spark');
stageLine(orchard, 18, 22, 5, 20, 'coin');
stageLine(orchard, 35, 40, 4, 37, 'claw');
stageLine(orchard, 48, 53, 5, 50, 'heart');
stageLine(orchard, 69, 74, 4, 71, 'spark');
stageLine(orchard, 80, 84, 6, 82, 'star');
[25, 43, 59, 77].forEach((tile, i) => stagePipe(orchard, tile, i % 2 ? 3 : 2));
stageStairs(orchard, 29, 2); stageStairs(orchard, 62, 2);
[[14, 17, 130], [27, 30, 175], [42, 46, 145], [56, 61, 185], [75, 80, 145]].forEach(args => stageCoins(orchard, ...args));
stagePickup(orchard, 'spark', 5, 75); stagePickup(orchard, 'bone', 54, 85);
stageEnemies(orchard, [[15, 'mushroom'], [21, 'beetle'], [28, 'mushroom'], [38, 'slime'], [45, 'beetle'], [52, 'mushroom'], [60, 'bat'], [70, 'slime'], [78, 'beetle'], [85, 'mushroom']]);
stageDecorations(orchard, [6, 17, 24, 36, 49, 58, 70, 81, 89]);

const sky = createStage('sky', '1-3', '云端花园 1 — 3', 98, [[0, 21], [24, 43], [46, 66], [69, 98]], 92, 'sky', [34, 72]);
stageLine(sky, 7, 11, 4, 9, 'boots');
stageLine(sky, 17, 20, 6, 19, 'spark');
stageLine(sky, 27, 32, 4, 30, 'claw');
stageLine(sky, 48, 53, 5, 50, 'heart');
stageLine(sky, 60, 64, 4, 62, 'boots');
stageLine(sky, 75, 80, 5, 77, 'star');
stageLine(sky, 85, 88, 7, 86, 'spark');
stagePipe(sky, 37, 2); stagePipe(sky, 57, 3); stagePipe(sky, 83, 2);
sky.stairs.push({ x: 20 * T, y: GROUND - 14, w: T, h: 14, type: 'spring' });
sky.stairs.push({ x: 65 * T, y: GROUND - 14, w: T, h: 14, type: 'spring' });
[[13, 17, 160], [20, 25, 205], [34, 39, 170], [44, 49, 215], [61, 67, 190], [78, 84, 175]].forEach(args => stageCoins(sky, ...args));
stagePickup(sky, 'boots', 5, 75); stagePickup(sky, 'claw', 54, 85);
stageEnemies(sky, [[14, 'bat'], [18, 'slime'], [28, 'bat'], [35, 'beetle'], [41, 'bat'], [52, 'slime'], [62, 'bat'], [72, 'beetle'], [81, 'bat'], [88, 'slime']]);
stageDecorations(sky, [5, 16, 29, 39, 51, 60, 74, 86, 94]);

const castle = createStage('castle', '1-4', '月夜城堡 1 — 4', 94, [[0, 26], [29, 57], [60, 94]], 92.5, 'castle', [37, 67]);
castle.bossRequired = true;
stageLine(castle, 8, 12, 4, 10, 'spark');
stageLine(castle, 18, 23, 5, 21, 'bone');
stageLine(castle, 32, 37, 4, 34, 'claw');
stageLine(castle, 45, 49, 6, 47, 'star');
stageLine(castle, 62, 67, 4, 64, 'spark');
stageLine(castle, 72, 76, 5, 74, 'heart');
[24, 40, 54, 69].forEach((tile, i) => stagePipe(castle, tile, i % 2 ? 3 : 2));
stageStairs(castle, 25, 2); stageStairs(castle, 56, 2);
[[13, 18, 145], [27, 32, 190], [41, 46, 170], [55, 61, 190], [70, 75, 150]].forEach(args => stageCoins(castle, ...args));
stagePickup(castle, 'spark', 5, 75); stagePickup(castle, 'claw', 59, 90); stagePickup(castle, 'heart', 78, 85);
stageEnemies(castle, [[15, 'beetle'], [22, 'bat'], [31, 'slime'], [38, 'beetle'], [46, 'bat'], [53, 'slime'], [63, 'beetle'], [71, 'bat'], [82, 'guardian']]);
stageDecorations(castle, [6, 17, 28, 36, 48, 59, 68, 77, 90]);

const stageOrder = [surface, orchard, sky, castle];
prepareWorldFeatures();

function freshPlayer() {
  return {
    x: 80, y: GROUND - 34, prevY: GROUND - 34, w: 30, h: 34, vx: 0, vy: 0,
    grounded: true, coyote: 7, facing: 1, shield: false, invulnerable: 0,
    hp: 3, maxHp: 3, bootsTime: 0, starTime: 0, magnetTime: 0, airJumps: 1, stompChain: 0,
    weapon: null, weaponTime: 0, attackCooldown: 0, attackFrame: 0, attackId: 0, attackReach: 58, landing: 0,
    dashTime: 0, dashCooldown: 0, airDashUsed: false, barkEnergy: 100, barkCooldown: 0,
    combo: 0, comboTimer: 0, wallDir: 0, wallLock: 0, groundPound: false, slamWindup: 0, crouched: false,
  };
}
function makeEnemy(seed) {
  const sizes = { spitter: [34, 35], bramble: [80, 70], mushroom: [30, 28], beetle: [34, 27], bat: [38, 24], slime: [32, 27], guardian: [58, 50] };
  const [w, h] = sizes[seed.type] || sizes.mushroom;
  const y = seed.type === 'bat' ? GROUND - 150 : GROUND - h;
  return { ...seed, home: seed.x, active: false, y, baseY: y, w, h, vx: seed.direction * (seed.type === 'bat' ? 1.5 : seed.type === 'slime' ? .8 : seed.type === 'guardian' ? 1.25 : 1.05), vy: 0, alive: true, squash: 0, armor: seed.type === 'beetle' ? 1 : 0, health: seed.type === 'guardian' ? 3 : 1, stun: 0, phase: seed.x * .03 };
}
function activateZone(nextZone) {
  zone = nextZone;
  enemies = zone.enemies;
  coins = zone.coins;
  powerups = zone.powerups;
  zoneName.textContent = zone.name;
  stageNumber.textContent = zone.stage || '秘密';
  updateHud();
}
function resetWorld() {
  clearTimeout(deathTimeout); clearTimeout(toastTimeout);
  toastElement.classList.remove('show'); contextHint.classList.remove('show');
  player = freshPlayer();
  for (const level of Object.values(zones)) {
    level.enemies = level.enemySeeds.map(makeEnemy);
    level.coins = level.coinSeeds.map(seed => ({ ...seed, taken: false }));
    level.powerups = level.pickupSeeds.map(seed => ({ ...seed, w: 34, h: 30, age: 0, taken: false }));
    level.blocks.forEach(block => { block.used = false; block.broken = false; block.bump = 0; });
  }
  resetWorldFeatures(Object.values(zones));
  resetBossBattles(Object.values(zones));
  particles.length = movingCoins.length = projectiles.length = floatingLabels.length = barkWaves.length = ghostTrails.length = 0;
  camera = 0; tick = 0; jumpBuffer = attackBuffer = downBuffer = dashBuffer = barkBuffer = 0;
  portalCooldown = 0; warp = null; arrivalFade = 0; hitStop = screenShake = damageFlash = 0;
  releaseAllControls();
  activateZone(surface);
}
function startGame(resetStats = true, stageId = selectedStage) {
  if (resetStats) {
    score = 0; coinCount = 0; gemCount = 0; stageGems = 0; lives = 3; timeLeft = 400;
    runDeaths = stageDeaths = stageHits = 0;
  }
  resetWorld();
  activateZone(zones[stageId] || surface);
  selectedStage = zone.id;
  checkpoint = { zone: zone.id, x: 80, y: GROUND - player.h };
  state = 'playing'; stageIntro = 150;
  hideOverlay();
  pauseButton.textContent = 'Ⅱ'; pauseButton.setAttribute('aria-label', '暂停游戏');
  ensureAudio(); sound('start'); updateHud(); updateTitleRecords(); saveProgress();
}
function advanceStage() {
  const next = stageOrder[stageOrder.indexOf(zone) + 1];
  if (!next) { startGame(); return; }
  const equipment = {
    shield: player.shield, bootsTime: player.bootsTime, starTime: player.starTime,
    magnetTime: player.magnetTime, weapon: player.weapon, weaponTime: player.weaponTime,
  };
  selectedStage = next.id;
  player = Object.assign(freshPlayer(), equipment);
  activateZone(next);
  checkpoint = { zone: next.id, x: 80, y: GROUND - player.h };
  projectiles.length = 0;
  particles.length = 0;
  movingCoins.length = 0;
  camera = 0;
  timeLeft = 400; stageGems = stageDeaths = stageHits = 0; stageIntro = 150;
  releaseAllControls(); enemyShots.length = 0;
  arrivalFade = 20;
  state = 'playing';
  hideOverlay();
  updateHud();
  showToast(`进入 ${next.stage}：${next.name.split(' ')[0]}！`);
  sound('start'); saveProgress();
}
function setOverlay(kicker, title, message, button) {
  document.querySelector('#overlay-kicker').textContent = kicker;
  document.querySelector('#overlay-title').textContent = title;
  document.querySelector('#overlay-text').textContent = message;
  primaryButton.innerHTML = `${button} <span>→</span>`;
  levelPicker.classList.add('hidden');
  document.querySelector('#menu-button').classList.remove('hidden');
  overlay.classList.remove('hidden');
}
function hideOverlay() { overlay.classList.add('hidden'); }
function releaseAllControls() {
  heldInputs.clear();
  Object.keys(control).forEach(key => { control[key] = false; });
  jumpBuffer = attackBuffer = downBuffer = dashBuffer = barkBuffer = 0;
  for (const button of document.querySelectorAll('[data-control]')) button.classList.remove('pressed');
}
function pauseGame() {
  if (state === 'playing') {
    releaseAllControls(); state = 'paused'; hitStop = 0; saveProgress();
    setOverlay('TRAIL BREAK', '在这里喘口气', '营地已为你保存进度。准备好了，就继续这场冒险。', '继续冒险');
    pauseButton.textContent = '▶'; pauseButton.setAttribute('aria-label', '继续游戏');
  } else if (state === 'paused') {
    releaseAllControls(); state = 'playing'; hideOverlay();
    pauseButton.textContent = 'Ⅱ'; pauseButton.setAttribute('aria-label', '暂停游戏');
  }
}
function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toastElement.classList.remove('show'), 1450);
}
function updateHud() {
  hud.score.textContent = String(score).padStart(6, '0');
  hud.coins.textContent = String(coinCount).padStart(2, '0');
  hud.time.textContent = String(Math.max(0, Math.ceil(timeLeft))).padStart(3, '0');
  hud.lives.textContent = '× ' + lives;
  const health = document.querySelector('#health');
  if (health && player) health.innerHTML = Array.from({ length: player.maxHp }, (_, index) => `<span class="${index < player.hp ? 'full' : 'empty'}">♥</span>`).join('');
  if (health && player) health.setAttribute('aria-label', `体力 ${player.hp} / ${player.maxHp}`);
  const energy = document.querySelector('#stamina-fill');
  if (energy && player) energy.style.width = `${Math.round(player.barkEnergy)}%`;
  const energyValue = document.querySelector('#stamina-value');
  if (energyValue && player) energyValue.textContent = Math.round(player.barkEnergy);
  const gems = document.querySelector('#gems'); if (gems) gems.textContent = String(stageGems).padStart(2, '0');
  const progress = document.querySelector('#progress-fill'); if (progress) progress.style.width = `${Math.min(100, player.x / (zone.finishX || zone.width) * 100)}%`;
  const recordLabel = document.querySelector('#record-label');
  const record = saveData.records[zone.id];
  if (recordLabel) recordLabel.textContent = record ? `BEST ${record.grade} · ${record.gems} ◆` : 'BEST —';
  const objective = document.querySelector('#objective');
  if (objective) objective.textContent = activeBossArena() ? '看准预警 · 闪避后反击' : zone === cave ? '星光岩洞 · 收集星晶，寻找出口' : '探索奖励路线 · 抵达营地旗帜';
  if (effectBar && player) {
    const chips = [];
    if (player.shield) chips.push('<span class="effect-chip">♧ 骨头护盾</span>');
    if (player.bootsTime > 0) chips.push(`<span class="effect-chip boots">✦ 三段跳 / 滑翔 ${Math.ceil(player.bootsTime / 60)}s</span>`);
    if (player.starTime > 0) chips.push(`<span class="effect-chip star">★ 无敌 ${Math.ceil(player.starTime / 60)}s</span>`);
    if (player.magnetTime > 0) chips.push(`<span class="effect-chip magnet">◉ 磁铁 ${Math.ceil(player.magnetTime / 60)}s</span>`);
    if (player.weaponTime > 0) {
      const names = { spark: '✹ 星火铃铛', claw: '✺ 旋风爪套', boomerang: '⌁ 回旋骨头' };
      chips.push(`<span class="effect-chip ${player.weapon}">${names[player.weapon]} ${Math.ceil(player.weaponTime / 60)}s</span>`);
    }
    effectBar.innerHTML = chips.join('');
  }
}
function gainCoin(x, y) {
  coinCount++;
  score += 200;
  if (coinCount % 25 === 0) { lives++; showToast('金币奖励：生命 +1'); }
  movingCoins.push({ x, y, age: 0 });
  sparkle(x, y, '#ffe57b', 9);
  sound('coin');
  updateHud();
}
function sparkle(x, y, color, count = 6) {
  for (let i = 0; i < count; i++) {
    const a = i * Math.PI * 2 / count;
    particles.push({ x, y, vx: Math.cos(a) * (1.1 + i % 3), vy: Math.sin(a) * 2.2 - 1.2, life: 28 + i % 11, color, size: 3 + i % 2 });
  }
}
function solids() { return [...zone.blocks.filter(b => !b.broken), ...zone.pipes, ...zone.stairs, ...worldSolids(), ...bossSolidGate()]; }
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function overGround(entity) {
  return zone.groundPieces.some(piece => entity.x + entity.w > piece.x + 2 && entity.x < piece.x + piece.w - 2);
}
function hitBlock(block) {
  block.bump = 9;
  if (block.type === 'question' && !block.used) {
    block.used = true;
    if (block.contents && block.contents !== 'coin') {
      powerups.push({ type: block.contents, x: block.x + 4, y: block.y - 33, w: 34, h: 30, age: 0, taken: false });
      showToast({ bone: '神奇骨头出现了！', boots: '弹跳靴出现了！', star: '闪光星星出现了！', magnet: '金币磁铁出现了！', spark: '星火铃铛出现了！', claw: '旋风爪套出现了！' }[block.contents] || '发现了道具！');
      sound('power');
    } else {
      gainCoin(block.x + T / 2, block.y - 6);
    }
  } else if (block.type === 'brick' && player.shield) {
    block.broken = true;
    score += 50;
    sparkle(block.x + 20, block.y + 20, '#b66c42', 12);
    sound('break');
    updateHud();
  } else {
    sound('bump');
  }
}
function collectPickup(pickup) {
  pickup.taken = true;
  if (pickup.type === 'bone') {
    player.shield = true;
    showToast('骨头护盾：挡一次伤害，还能顶碎砖块');
  } else if (pickup.type === 'boots') {
    player.bootsTime = 60 * 28;
    player.airJumps = 2;
    showToast('云步靴：三段跳，按住跳跃还能滑翔！');
  } else if (pickup.type === 'star') {
    player.starTime = 60 * 12;
    showToast('闪光星星：12 秒无敌！');
  } else if (pickup.type === 'magnet') {
    player.magnetTime = 60 * 20;
    showToast('金币磁铁：附近的金币会飞过来！');
  } else if (pickup.type === 'heart') {
    player.hp = player.maxHp; lives++;
    showToast('爱心：体力全满，重试机会 +1');
  } else if (pickup.type === 'spark') {
    player.weapon = 'spark';
    player.weaponTime = 60 * 40;
    showToast('星火铃铛：按 J / Z 发射星火弹！');
  } else if (pickup.type === 'boomerang') {
    player.weapon = 'boomerang'; player.weaponTime = 60 * 50;
    showToast('回旋骨头：按 J 投掷，一次扫过整排敌人！');
  } else if (pickup.type === 'claw') {
    player.weapon = 'claw';
    player.weaponTime = 60 * 40;
    showToast('旋风爪套：按 J / Z 向前挥爪！');
  }
  score += pickup.type === 'heart' ? 500 : 1000;
  sparkle(pickup.x + 16, pickup.y + 12, pickup.type === 'star' ? '#ffe579' : '#fff1bd', 16);
  sound('power');
  updateHud();
}
function floatingText(x, y, text, color = '#fff0bd') { floatingLabels.push({ x, y, text, color, life: 55 }); }
function feedback(x, y, color, amount = 5) {
  sparkle(x, y, color, Math.min(18, amount * 2));
  screenShake = Math.max(screenShake, amount);
  hitStop = Math.max(hitStop, Math.min(5, Math.round(amount / 2)));
}
function damageEnemy(enemy, points = 150, kind = 'paw') {
  if (!enemy.alive) return;
  if (enemy.isBoss) { damageBoss(enemy, points, kind); return; }
  const centerX = enemy.x + enemy.w / 2;
  if (enemy.armor > 0 && kind !== 'slam') {
    enemy.armor--; enemy.stun = 85; score += points;
    feedback(centerX, enemy.y + 5, '#9dd8ed', 3);
    floatingText(centerX, enemy.y, '破甲', '#b5edf1');
  } else {
    enemy.health--; score += points;
    if (enemy.health <= 0) {
      enemy.alive = false; enemy.squash = 22;
      player.barkEnergy = Math.min(100, player.barkEnergy + 12);
      feedback(centerX, enemy.y + enemy.h / 2, '#fff3a8', 4);
      floatingText(centerX, enemy.y - 10, `+${points}`);
    }
  }
  sound('stomp'); updateHud();
}
function useAttack() {
  if (player.attackCooldown > 0 || state !== 'playing' || player.groundPound) return;
  player.attackId++;
  const weapon = player.weaponTime > 0 ? player.weapon : null;
  if (weapon === 'spark') {
    projectiles.push({ x: player.x + (player.facing > 0 ? player.w : -16), y: player.y + 10, w: 16, h: 12, vx: player.facing * 8.5, life: 82, phase: tick, kind: 'spark' });
    player.attackCooldown = 17;
  } else if (weapon === 'boomerang') {
    if (projectiles.some(shot => shot.kind === 'boomerang')) return;
    projectiles.push({ x: player.x + 15, y: player.y + 10, w: 28, h: 20, vx: player.facing * 9, life: 95, age: 0, phase: tick, kind: 'boomerang', hits: new Set() });
    player.attackCooldown = 30;
  } else {
    player.combo = player.comboTimer > 0 ? player.combo % 3 + 1 : 1;
    player.comboTimer = 50; player.attackFrame = weapon === 'claw' ? 14 : 10;
    player.attackReach = weapon === 'claw' ? 90 : 48 + player.combo * 10;
    player.attackCooldown = weapon === 'claw' ? 20 : 17;
    if (player.combo === 3) { player.vx += player.facing * 1.3; screenShake = Math.max(screenShake, 2); }
  }
  sound('attack');
}
function useDash() {
  if (state !== 'playing' || player.dashCooldown > 0 || player.barkEnergy < 25 || player.groundPound || !player.grounded && player.airDashUsed) return false;
  const direction = Number(control.right) - Number(control.left);
  if (direction) player.facing = direction;
  player.dashTime = 10; player.dashCooldown = 48; player.barkEnergy -= 25;
  if (!player.grounded) player.airDashUsed = true;
  player.vx = player.facing * 11.8; player.vy = 0;
  feedback(player.x + 15, player.y + 17, '#b7ebdf', 2); sound('dash'); updateHud(); return true;
}
function useBark() {
  if (state !== 'playing' || player.barkCooldown > 0 || player.barkEnergy < 35) return false;
  player.barkEnergy -= 35; player.barkCooldown = 65;
  const x = player.x + 15, y = player.y + 17;
  barkWaves.push({ x, y, life: 26, type: 'bark' });
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.isBoss || Math.hypot(enemy.x + enemy.w / 2 - x, enemy.y + enemy.h / 2 - y) > 170) continue;
    enemy.stun = 120; enemy.vx = Math.sign(enemy.x - x || 1) * Math.abs(enemy.vx);
    floatingText(enemy.x + enemy.w / 2, enemy.y, '震晕', '#b1f5e7');
  }
  barkWorld(x, y); bossBarkPulse(x, y);
  sound('bark'); screenShake = Math.max(screenShake, 3); updateHud(); return true;
}
function damagePlayer(amount = 1, sourceX = player.x) {
  if (state !== 'playing' || player.invulnerable > 0 || player.starTime > 0 || player.dashTime > 0) return false;
  player.invulnerable = 80; player.vx = Math.sign(player.x + 15 - sourceX || 1) * 5;
  player.vy = -6; player.groundPound = false;
  player.grounded = false; player.coyote = 0;
  if (player.shield) { player.shield = false; showToast('骨头护盾吸收了这次伤害'); }
  else { player.hp = Math.max(0, player.hp - amount); stageHits++; }
  damageFlash = 14; screenShake = 6; sound('hurt'); updateHud();
  if (player.hp <= 0) loseLife();
  return true;
}
function updateProjectiles() {
  for (const shot of projectiles) {
    if (shot.life <= 0) continue;
    shot.life--;
  if (shot.kind === 'boomerang') {
      shot.age++;
      if (shot.age > 24 || shot.returning) {
        if (!shot.returning) shot.hits.clear();
        shot.returning = true;
        const dx = player.x + 15 - shot.x, dy = player.y + 12 - shot.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 24) { shot.life = 0; player.barkEnergy = Math.min(100, player.barkEnergy + 4); continue; }
        shot.vx = dx / distance * 10; shot.vy = dy / distance * 10;
      }
      shot.x += shot.vx; shot.y += shot.vy || 0;
      for (const enemy of enemies) if (enemy.alive && overlap(shot, enemy) && !shot.hits.has(enemy)) {
        shot.hits.add(enemy); damageEnemy(enemy, 200, 'boomerang');
      }
      if (!shot.returning && solids().some(solid => !solid.oneWay && overlap(shot, solid))) { shot.returning = true; shot.hits.clear(); }
    } else {
      shot.x += shot.vx;
      const hit = enemies.find(enemy => enemy.alive && overlap(shot, enemy));
      if (hit) { damageEnemy(hit, 180, 'spark'); shot.life = 0; sparkle(shot.x, shot.y, '#ffeab2', 7); }
      else if (solids().some(solid => !solid.oneWay && solid.type !== 'spring' && overlap(shot, solid))) { shot.life = 0; sparkle(shot.x, shot.y, '#ffeab2', 5); }
    }
  }
  for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i].life <= 0 || Math.abs(projectiles[i].x - player.x) > W + 180) projectiles.splice(i, 1);
}
function portalUnderPlayer() {
  const center = player.x + player.w / 2;
  return zone.pipes.find(pipe => pipe.portal && player.grounded && Math.abs(player.y + player.h - pipe.y) < 3 && center > pipe.x + 12 && center < pipe.x + pipe.w - 12);
}
function beginWarp(pipe) {
  state = 'warping';
  warp = { portal: pipe.portal, ticks: 28, total: 28 };
  player.vx = 0;
  player.vy = 0;
  downBuffer = 0;
  contextHint.classList.remove('show');
  sound('pipe');
}
function finishWarp() {
  const destination = warp.portal;
  activateZone(zones[destination.zone]);
  particles.length = 0;
  movingCoins.length = 0;
  player.x = destination.x;
  player.y = destination.y;
  player.prevY = player.y;
  player.vx = 0;
  player.vy = 0;
  player.grounded = true;
  player.coyote = 7;
  player.invulnerable = Math.max(player.invulnerable, 45);
  player.stompChain = 0; player.airJumps = player.bootsTime > 0 ? 2 : 1; player.airDashUsed = false;
  projectiles.length = enemyShots.length = 0;
  checkpoint = { zone: destination.zone, x: destination.x, y: destination.y };
  camera = Math.max(0, Math.min(zone.width - W, player.x - 290));
  portalCooldown = 48;
  arrivalFade = 20;
  warp = null;
  state = 'playing';
  showToast(zone === cave ? '发现秘密空间：星光岩洞！' : '回到地表，继续冒险！'); saveProgress();
}
function updateContextHint() {
  if (state !== 'playing') { contextHint.classList.remove('show'); return; }
  const pipe = portalUnderPlayer();
  if (pipe && portalCooldown === 0) {
    contextHint.textContent = zone === cave ? '按 ↓ / S 钻入管道，回到地表' : '发现爪印管道！按 ↓ / S 进入秘密空间';
    contextHint.classList.add('show');
  } else {
    contextHint.classList.remove('show');
  }
}
function resolvePlayerX() {
  for (const solid of solids()) {
    if (solid.type === 'spring' || solid.oneWay || !overlap(player, solid)) continue;
    const direction = Math.sign(player.vx);
    if (direction > 0) player.x = solid.x - player.w;
    else if (direction < 0) player.x = solid.x + solid.w;
    if (!player.grounded && direction) player.wallDir = direction;
    player.vx = 0; player.dashTime = 0;
  }
}
function movePlayerX(distance) {
  const parts = Math.max(1, Math.ceil(Math.abs(distance) / 6));
  for (let i = 0; i < parts; i++) {
    player.x += distance / parts; resolvePlayerX();
    if (player.vx === 0) break;
  }
}
function slamImpact() {
  player.groundPound = false; player.slamWindup = 0;
  barkWaves.push({ x: player.x + 15, y: player.y + player.h, life: 22, type: 'slam' });
  feedback(player.x + 15, player.y + player.h, '#fff0be', 8);
  sound('slam'); player.barkEnergy = Math.min(100, player.barkEnergy + 10);
  for (const enemy of enemies) if (enemy.alive && Math.abs(enemy.x + enemy.w / 2 - (player.x + 15)) < 110 && Math.abs(enemy.y + enemy.h - (player.y + player.h)) < 90) damageEnemy(enemy, 300, 'slam');
}
function resolvePlayerY() {
  const impact = player.vy;
  player.grounded = false;
  for (const solid of solids()) {
    if (!overlap(player, solid)) continue;
    if (solid.oneWay && (player.vy < 0 || player.prevY + player.h > solid.y + Math.max(8, Math.abs(solid.dy || 0) + 2))) continue;
    if (solid.type === 'spring' && player.vy >= 0) {
      player.y = solid.y - player.h; player.vy = -19; player.groundPound = false;
      player.airJumps = player.bootsTime > 0 ? 2 : 1; player.airDashUsed = false;
      sparkle(player.x + 15, solid.y, '#f5b7f3', 10); sound('spring'); continue;
    }
    if (player.vy >= 0 && player.prevY + player.h <= solid.y + 16) {
      if (player.groundPound && solid.type === 'brick') { solid.broken = true; score += 50; sparkle(solid.x + 20, solid.y + 20, '#d5aa7d', 12); continue; }
      if (player.groundPound && solid.type === 'question') hitBlock(solid);
      player.y = solid.y - player.h; player.vy = 0; player.grounded = true;
    } else if (!solid.oneWay && player.vy < 0 && player.prevY >= solid.y + solid.h - 12) {
      player.y = solid.y + solid.h; player.vy = 0;
      if (solid.type === 'question' || solid.type === 'brick') hitBlock(solid);
    }
  }
  if (player.vy >= 0 && player.prevY + player.h <= GROUND + 16 && player.y + player.h >= GROUND && overGround(player)) {
    player.y = GROUND - player.h; player.vy = 0; player.grounded = true;
  }
  if (player.grounded) {
    if (impact > 5) player.landing = Math.min(10, Math.round(impact));
    if (player.groundPound) slamImpact();
    player.coyote = 7; player.airJumps = player.bootsTime > 0 ? 2 : 1; player.airDashUsed = false;
    player.stompChain = 0; player.wallDir = 0;
  }
}
function updatePlayer() {
  for (const key of ['invulnerable','landing','attackCooldown','attackFrame','dashCooldown','barkCooldown','wallLock','comboTimer']) if (player[key] > 0) player[key]--;
  if (player.weaponTime > 0 && --player.weaponTime === 0) { player.weapon = null; player.attackFrame = 0; }
  if (player.bootsTime > 0) player.bootsTime--;
  if (player.starTime > 0) player.starTime--;
  if (player.magnetTime > 0) player.magnetTime--;
  if (portalCooldown > 0) portalCooldown--;
  player.barkEnergy = Math.min(100, player.barkEnergy + (player.grounded ? .35 : .16));
  if (player.starTime > 0 && tick % 5 === 0) sparkle(player.x + 15, player.y + 15, '#fff2a5', 2);
  if (attackBuffer > 0) attackBuffer--;
  if ((control.attack || attackBuffer > 0) && player.attackCooldown === 0) { useAttack(); attackBuffer = 0; }
  if (dashBuffer > 0) { dashBuffer--; if (useDash()) dashBuffer = 0; }
  if (barkBuffer > 0) { barkBuffer--; if (useBark()) barkBuffer = 0; }
  if (downBuffer > 0) downBuffer--;
  const wantsCrouch = control.down && player.grounded && !portalUnderPlayer();
  if (wantsCrouch && !player.crouched) { player.h = 22; player.y += 12; player.crouched = true; }
  else if (!wantsCrouch && player.crouched) {
    const standing = { x: player.x, y: player.y - 12, w: player.w, h: 34 };
    if (!solids().some(solid => !solid.oneWay && overlap(standing, solid))) { player.y -= 12; player.h = 34; player.crouched = false; }
  }
  player.prevY = player.y;
  const direction = Number(control.right) - Number(control.left);
  const maxSpeed = player.crouched ? 1.8 : control.run ? 5.8 : 4.2;
  if (player.dashTime > 0) { player.dashTime--; player.vx = player.facing * 11.8; player.vy = 0; }
  else if (player.wallLock > 0) { player.vx *= .98; }
  else if (direction) {
    player.vx += direction * (player.grounded ? .7 : .45);
    player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx)); player.facing = direction;
  } else { player.vx *= player.grounded ? .76 : .96; if (Math.abs(player.vx) < .08) player.vx = 0; }
  if (!player.grounded && player.coyote > 0) player.coyote--;
  if (jumpBuffer > 0) jumpBuffer--;
  if (jumpBuffer && !player.groundPound && (player.grounded || player.coyote || player.wallDir || player.airJumps > 0)) {
    const airJump = !player.grounded && !player.coyote;
    if (airJump && player.wallDir) {
      player.vx = -player.wallDir * 6.8; player.facing = -player.wallDir; player.wallLock = 12;
      player.vy = -13.8; player.airJumps = Math.max(1, player.airJumps); player.airDashUsed = false;
      floatingText(player.x + 15, player.y, '蹬墙', '#bbefe0');
    } else { player.vy = airJump ? -12.4 : -14; if (airJump) player.airJumps--; }
    if (player.crouched) { player.y -= 12; player.h = 34; player.crouched = false; }
    player.grounded = false; player.coyote = 0; player.wallDir = 0; player.dashTime = 0; jumpBuffer = 0;
    sparkle(player.x + 15, player.y + player.h, airJump ? '#b2e5fa' : '#fff1cf', 6);
    sound(airJump ? 'doubleJump' : 'jump');
  }
  if (downBuffer > 0 && !player.grounded && player.coyote === 0 && !player.groundPound) {
    player.groundPound = true; player.slamWindup = 6; player.dashTime = 0; downBuffer = 0;
  }
  player.wallDir = 0;
  movePlayerX(player.groundPound ? player.vx * .22 : player.vx);
  player.x = Math.max(0, Math.min(zone.width - player.w, player.x));
  const arena = activeBossArena();
  if (arena) player.x = Math.max(arena.minX, Math.min(arena.maxX, player.x));
  if (player.groundPound) {
    if (player.slamWindup > 0) { player.slamWindup--; player.vy = -1; } else player.vy = 18;
  } else if (player.dashTime === 0) {
    const gliding = player.bootsTime > 0 && control.jump && player.vy > 0;
    player.vy = Math.min(gliding ? 3.4 : 12, player.vy + (gliding ? .14 : .55));
    if (player.wallDir && direction === player.wallDir && player.vy > 0) player.vy = Math.min(2.1, player.vy);
  }
  player.y += player.vy; resolvePlayerY();
  if (player.dashTime > 0 && tick % 2 === 0) ghostTrails.push({ x: player.x, y: player.y, facing: player.facing, life: 12 });
  for (const coin of coins) {
    const dx = Math.abs(coin.x - (player.x + 15)), dy = Math.abs(coin.y - (player.y + player.h / 2));
    if (!coin.taken && (dx < 28 && dy < 31 || player.magnetTime > 0 && dx < 130 && dy < 115)) { coin.taken = true; gainCoin(coin.x, coin.y); }
  }
  for (const pickup of powerups) { pickup.age++; if (!pickup.taken && overlap(player, pickup)) collectPickup(pickup); }
  const portal = portalUnderPlayer();
  if (portal && downBuffer && portalCooldown === 0) { beginWarp(portal); return; }
  updateContextHint();
  for (const tile of zone.checkpoints || []) if (player.x > tile * T && (checkpoint.zone !== zone.id || checkpoint.x < tile * T)) {
    checkpoint = { zone: zone.id, x: tile * T, y: GROUND - 34 }; player.hp = player.maxHp;
    showToast('营地点亮 · 体力已恢复，进度已保存'); sound('checkpoint'); saveProgress(); updateHud();
  }
  if (player.y > H + 100) loseLife();
  if (zone.finishX && player.x + player.w > zone.finishX + 8 && player.y < GROUND) winGame();
}
function updateEnemies() {
  const solidList = solids();
  for (const enemy of enemies) {
    if (enemy.isBoss) continue;
    if (!enemy.alive) { if (enemy.squash > 0) enemy.squash--; continue; }
    if (!enemy.active) {
      if (enemy.x < camera - 50 || enemy.x > camera + W + 50) continue;
      enemy.active = true;
    }
    if (enemy.stun > 0) enemy.stun--;
    if (enemy.x < enemy.home - 105) enemy.vx = Math.abs(enemy.vx);
    if (enemy.x > enemy.home + 105) enemy.vx = -Math.abs(enemy.vx);
    if (enemy.type === 'bat') {
      if (!enemy.stun) { enemy.x += enemy.vx; enemy.y = enemy.baseY + Math.sin(tick * .07 + enemy.phase) * 28; }
    } else {
      if (!enemy.stun && enemy.type !== 'spitter') enemy.x += enemy.vx;
      for (const solid of solidList) {
        if (solid.oneWay || !overlap(enemy, solid)) continue;
        enemy.x = enemy.vx > 0 ? solid.x - enemy.w : solid.x + solid.w;
        enemy.vx *= -1;
      }
      const prevBottom = enemy.y + enemy.h;
      if (!enemy.stun && enemy.type === 'slime' && enemy.vy === 0 && (tick + Math.round(enemy.phase * 10)) % 83 === 0) enemy.vy = -8.5;
      enemy.vy = Math.min(12, enemy.vy + .5); enemy.y += enemy.vy;
      for (const solid of solidList) if (overlap(enemy, solid) && enemy.vy > 0 && prevBottom <= solid.y + 10) { enemy.y = solid.y - enemy.h; enemy.vy = 0; }
      if (prevBottom <= GROUND + 10 && enemy.y + enemy.h >= GROUND && overGround(enemy)) { enemy.y = GROUND - enemy.h; enemy.vy = 0; }
      if (enemy.type === 'spitter' && !enemy.stun && Math.abs(enemy.x - player.x) < 540 && (tick + Math.floor(enemy.phase)) % 130 === 0) {
        const facing = Math.sign(player.x - enemy.x) || -1;
        enemyShots.push({ x: enemy.x + enemy.w / 2, y: enemy.y + 12, w: 16, h: 12, vx: facing * 3.1, life: 170 });
        sparkle(enemy.x + 17, enemy.y + 15, '#ecad8b', 4);
      }
    }
    if (enemy.y > H + 100) { enemy.alive = false; continue; }
    if (state !== 'playing') continue;
    const slash = { x: player.facing > 0 ? player.x + 15 : player.x - player.attackReach, y: player.y - 14, w: player.attackReach, h: player.h + 24 };
    if (player.attackFrame > 0 && enemy.lastAttackId !== player.attackId && overlap(enemy, slash)) {
      enemy.lastAttackId = player.attackId; damageEnemy(enemy, 210, player.weapon === 'claw' ? 'claw' : 'paw'); continue;
    }
    if (!overlap(player, enemy)) continue;
    if (player.starTime > 0) { damageEnemy(enemy, 200, 'star'); continue; }
    if (player.vy > 1.2 && player.prevY + player.h < enemy.y + 14) {
      player.stompChain++;
      const bonus = Math.min(800, 100 * 2 ** (player.stompChain - 1));
      const slammed = player.groundPound;
      damageEnemy(enemy, bonus, slammed ? 'slam' : 'stomp');
      if (slammed) slamImpact();
      player.groundPound = false; player.vy = control.jump ? -10.2 : -8.2;
      player.airJumps = player.bootsTime > 0 ? 2 : 1; player.airDashUsed = false;
      if (player.stompChain > 1) showToast(`连踩 ×${player.stompChain}　+${bonus}`);
    } else if (!enemy.stun) damagePlayer(1, enemy.x + enemy.w / 2);
  }
}
function loseLife() {
  if (state !== 'playing') return;
  lives--; runDeaths++; stageDeaths++; releaseAllControls();
  player.hp = 0; player.vx = 0; player.vy = -7; player.groundPound = false;
  sound('hurt'); feedback(player.x + 15, player.y, '#ec8c81', 8);
  contextHint.classList.remove('show'); updateHud();
  if (lives <= 0) {
    state = 'gameover'; saveData.run = null; persistSave(); updateTitleRecords();
    setOverlay('THE TRAIL GOES ON', '冒险还可以再来一次', `本次收藏 ${gemCount} 枚星晶、${coinCount} 枚金币，得分 ${score}。你的最佳关卡记录已保留。`, '重新挑战');
    return;
  }
  state = 'respawn';
  const equipment = { shield: player.shield, bootsTime: player.bootsTime, starTime: player.starTime,
    magnetTime: player.magnetTime, weapon: player.weapon, weaponTime: player.weaponTime };
  deathTimeout = setTimeout(() => {
    if (state !== 'respawn') return;
    const destination = zones[checkpoint.zone] || zone;
    player = Object.assign(freshPlayer(), equipment); activateZone(destination);
    const unfinishedBoss = destination.enemies.find(enemy => enemy.isBoss && enemy.alive);
    if (unfinishedBoss) {
      const suppliesAdded = unfinishedBoss.suppliesAdded;
      resetBossBattles([destination]); unfinishedBoss.suppliesAdded = suppliesAdded;
    }
    player.x = checkpoint.x; player.y = checkpoint.y; player.prevY = player.y;
    player.invulnerable = 100; player.grounded = false;
    camera = Math.max(0, Math.min(zone.width - W, player.x - 315));
    projectiles.length = enemyShots.length = barkWaves.length = ghostTrails.length = 0;
    hitStop = damageFlash = 0; arrivalFade = 20; portalCooldown = 70;
    if (timeLeft <= 0) timeLeft = 200;
    state = 'playing'; updateHud(); saveProgress();
    showToast(`回到营地 · 还有 ${lives} 条生命`);
  }, 900);
}
function winGame() {
  if (state !== 'playing') return;
  if (zone.bossRequired && enemies.some(enemy => enemy.isBoss && enemy.alive)) {
    if (tick % 50 === 0) showToast('击败首领，才能打开出口！'); return;
  }
  state = 'won'; releaseAllControls();
  const bonus = Math.ceil(timeLeft) * 10; score += bonus;
  const grade = recordCompletion();
  if (zone !== castle) saveProgress(true);
  updateHud(); updateTitleRecords(); sound('win');
  sparkle(zone.finishX, GROUND - 245, '#ffe582', 25);
  setTimeout(() => {
    if (state !== 'won') return;
    const finalStage = zone === castle;
    setOverlay(`WORLD ${zone.stage} CLEAR · ${grade} RANK`, finalStage ? '团子，成为了冒险家！' : `${zone.stage} · 冒险完成`,
      `${grade} 级评价 · 本关 ${stageGems} 枚星晶 · ${stageHits} 次受伤 · ${stageDeaths} 次重试\n时间奖励 ${bonus} 分 · 总分 ${score} 分`,
      finalStage ? '再来一次完整旅程' : `前往 ${stageOrder[stageOrder.indexOf(zone) + 1].stage}`);
  }, 650);
}
function updateEffects() {
  for (const block of zone.blocks) if (block.bump > 0) block.bump--;
  for (const particle of particles) { particle.x += particle.vx; particle.y += particle.vy; particle.vy += .15; particle.life--; }
  for (const coin of movingCoins) coin.age++;
  for (const label of floatingLabels) { label.y -= .55; label.life--; }
  for (const wave of barkWaves) wave.life--;
  for (const trail of ghostTrails) trail.life--;
  if (screenShake > 0) screenShake *= .86;
  if (damageFlash > 0) damageFlash--;
  if (stageIntro > 0) stageIntro--;
  for (const list of [particles, floatingLabels, barkWaves, ghostTrails]) for (let i = list.length - 1; i >= 0; i--) if (list[i].life <= 0) list.splice(i, 1);
  for (let i = movingCoins.length - 1; i >= 0; i--) if (movingCoins[i].age > 33) movingCoins.splice(i, 1);
}
function step() {
  if (state === 'warping') {
    tick++; warp.ticks--; updateEffects(); if (warp.ticks <= 0) finishWarp(); return;
  }
  if (state === 'won' || state === 'respawn') {
    tick++; updateEffects();
    if (state === 'respawn') { player.vy += .4; player.y += player.vy; }
    return;
  }
  if (state !== 'playing') return;
  if (hitStop > 0) { hitStop--; return; }
  tick++; timeLeft -= 1 / 60;
  if (arrivalFade > 0) arrivalFade--;
  if (timeLeft <= 0) { timeLeft = 0; loseLife(); return; }
  updateWorldFeatures();
  if (state === 'playing') updatePlayer();
  if (state === 'playing') updateProjectiles();
  if (state === 'playing') updateEnemies();
  if (state === 'playing') updateBossBattle();
  updateEffects(); updateMusic();
  const arena = activeBossArena();
  const target = arena ? arena.camera : Math.max(0, Math.min(zone.width - W, player.x - 315 + player.vx * 9));
  camera += (target - camera) * .12;
  if (tick % 12 === 0) updateHud();
}

function fill(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function drawIllustratedBackdrop(image) {
  if (!image) return false;
  const cropScale = 1.1;
  const sourceWidth = image.width / cropScale;
  const sourceHeight = image.height / cropScale;
  const progress = Math.max(0, Math.min(1, camera / Math.max(1, zone.width - W)));
  const sourceX = (image.width - sourceWidth) * progress;
  const sourceY = (image.height - sourceHeight) * .36;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  return true;
}
function drawCloud(x, y, scale = 1) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(scale, scale);
  fill(14, 0, 50, 15, '#fff7e6'); fill(0, 13, 88, 19, '#fff7e6'); fill(9, 30, 68, 7, '#cee8e5');
  fill(53, -10, 25, 24, '#fff7e6'); fill(4, 21, 9, 7, '#fffdf1');
  fill(14, 5, 43, 5, '#ffffff'); fill(10, 17, 72, 4, '#ffffff');
  ctx.restore();
}
function drawHills(parallax) {
  for (let i = -1; i < 15; i++) {
    const x = i * 520 + 70 - parallax * .22;
    ctx.fillStyle = '#a5d9ce';
    ctx.beginPath(); ctx.ellipse(x + 180, 445, 215, 142, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#79c7ae';
    ctx.beginPath(); ctx.ellipse(x + 400, 448, 155, 98, 0, Math.PI, Math.PI * 2); ctx.fill();
    fill(x + 153, 363, 7, 10, '#72bea9'); fill(x + 185, 381, 6, 9, '#72bea9');
    fill(x + 160, 350, 30, 5, '#c5e9d7');
  }
  for (let i = -1; i < 20; i++) {
    const x = i * 275 + 25 - parallax * .43;
    fill(x + 18, 352, 19, 96, '#4caa84');
    fill(x, 350, 58, 35, '#5eba8e');
    fill(x + 9, 329, 42, 35, '#63c295');
    fill(x + 20, 312, 22, 25, '#70cda1');
    fill(x + 7, 355, 8, 6, '#90d8ae');
    fill(x + 43, 347, 7, 6, '#90d8ae');
  }
}
function drawSky() {
  if (drawIllustratedBackdrop(backdrops.surface)) {
    for (let i = 0; i < 13; i++) {
      const x = ((i * 191 + 35 - camera * .025) % 1100 + 1100) % 1100;
      const y = 88 + (i * 97) % 240 + Math.sin(tick / 55 + i) * 5;
      ctx.globalAlpha = .32 + Math.sin(tick / 19 + i) * .2;
      fill(x, y, 3, 3, '#fff8d7');
    }
    ctx.globalAlpha = 1;
    return;
  }
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, '#6bb6e6'); gradient.addColorStop(.55, '#a8e0e8'); gradient.addColorStop(1, '#f8e2b1');
  fill(0, 0, W, H, gradient);
  for (let i = 0; i < 18; i++) {
    const x = ((i * 117 + 40 - camera * .06) % 1100 + 1100) % 1100;
    fill(x, 125 + (i * 57) % 175, 3, 3, '#e8fbeb9c');
  }
  const sunX = 765 - camera * .045;
  ctx.globalAlpha = .13;
  fill(sunX - 45, 44, 160, 160, '#fff6c8');
  ctx.globalAlpha = .22;
  fill(sunX - 23, 66, 116, 116, '#fff3b5');
  ctx.globalAlpha = 1;
  fill(sunX, 90, 70, 70, '#fff0ae');
  fill(sunX + 9, 99, 52, 52, '#fff8d2');
  fill(sunX - 21, 122, 12, 9, '#fff8d2'); fill(sunX + 78, 122, 12, 9, '#fff8d2');
  drawHills(camera);
  for (let i = 0; i < 19; i++) {
    const x = (i * 391 + 155 - camera * .12) % 1600;
    drawCloud(x < -130 ? x + 1600 : x, 105 + (i % 4) * 43 + Math.sin(tick / 95 + i) * 3, .72 + i % 3 * .16);
  }
}
function drawCaveCrystal(x, y, size = 1, color = '#80d9d4') {
  const s = size * 20;
  ctx.globalAlpha = .12 + Math.sin(tick / 22 + x) * .035;
  fill(x - s, y - s * 1.8, s * 3, s * 2.5, color);
  ctx.globalAlpha = 1;
  fill(x + 4 * size, y - 25 * size, 11 * size, 25 * size, '#316975');
  fill(x, y - 32 * size, 12 * size, 32 * size, color);
  fill(x + 2 * size, y - 27 * size, 3 * size, 22 * size, '#d3fff0');
  fill(x + 13 * size, y - 17 * size, 8 * size, 17 * size, '#6297b0');
}
function drawCaveBackground() {
  if (drawIllustratedBackdrop(backdrops.cave)) {
    fill(0, 0, W, H, '#17204429');
    for (let i = 0; i < 28; i++) {
      const x = ((i * 151 + 31 - camera * .08) % 1100 + 1100) % 1100;
      const y = 70 + (i * 71) % 345 + Math.sin(tick / 42 + i) * 5;
      ctx.globalAlpha = .32 + (Math.sin(tick / 17 + i) + 1) * .2;
      fill(x, y, i % 5 === 0 ? 4 : 2, i % 5 === 0 ? 4 : 2, i % 3 ? '#a6f3e7' : '#ffe7a9');
    }
    ctx.globalAlpha = 1;
    return;
  }
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, '#10172f'); gradient.addColorStop(.56, '#313052'); gradient.addColorStop(1, '#62506d');
  fill(0, 0, W, H, gradient);
  for (let i = -1; i < 14; i++) {
    const x = i * 245 - camera * .18;
    fill(x + 12, 0, 75, 370, '#23233f');
    fill(x + 100, 80, 47, 345, '#282841');
    fill(x + 36, 190, 65, 8, '#373659');
    fill(x + 104, 304, 58, 9, '#47415f');
  }
  for (let i = -1; i < 35; i++) {
    const x = i * 92 - camera * .34;
    const length = 30 + (i * 37 + 500) % 85;
    fill(x, 0, 30, 17, '#22233f');
    fill(x + 5, 17, 20, length * .55, '#2f2b49');
    fill(x + 10, length * .55 + 16, 10, length * .45, '#3b3453');
  }
  for (let i = 0; i < 42; i++) {
    const x = ((i * 127 + 33 - camera * .11) % 1100 + 1100) % 1100;
    const y = 100 + i * 83 % 290;
    const pulse = .3 + (Math.sin(tick / 22 + i) + 1) * .22;
    ctx.globalAlpha = pulse;
    fill(x, y, 3 + i % 2, 3 + i % 2, i % 3 ? '#b8a5f2' : '#91f3e1');
  }
  ctx.globalAlpha = 1;
  for (let i = -1; i < 15; i++) {
    const x = i * 185 + 50 - camera * .58;
    drawCaveCrystal(x, 440, i % 3 === 0 ? 1.45 : .9, i % 2 ? '#a79ce8' : '#76d8cd');
  }
}
function drawStageBackground() {
  if (zone === surface) { drawSky(); return; }
  if (zone === cave) { drawCaveBackground(); return; }
  if (!drawIllustratedBackdrop(backdrops[zone.id])) { drawSky(); return; }
  const night = zone.theme === 'castle';
  if (night) fill(0, 0, W, H, '#0d18302b');
  for (let i = 0; i < 17; i++) {
    const x = ((i * 173 + 49 - camera * .04) % 1100 + 1100) % 1100;
    const y = 95 + (i * 83) % 285 + Math.sin(tick / 53 + i) * 4;
    ctx.globalAlpha = .18 + (Math.sin(tick / 20 + i) + 1) * .13;
    fill(x, y, night ? 3 : 2, night ? 3 : 2, night ? '#fff4c7' : '#fffbed');
  }
  ctx.globalAlpha = 1;
}
function drawBush(x, y, size) {
  const s = size ? 1.2 : 1;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(s, s);
  fill(3, -15, 83, 15, '#315e55');
  fill(8, -26, 74, 23, '#3e8065');
  fill(17, -36, 28, 28, '#539873');
  fill(42, -41, 27, 31, '#4f916e');
  fill(1, -18, 25, 14, '#4a946b');
  fill(67, -24, 20, 18, '#3e7a62');
  fill(23, -34, 15, 5, '#83bd83');
  fill(48, -38, 13, 5, '#8cc18a');
  fill(11, -19, 9, 4, '#6cad77');
  fill(73, -17, 6, 4, '#6cad77');
  fill(37, -8, 20, 4, '#295e51');
  ctx.restore();
}
function drawGround() {
  if (zone === cave || zone === castle) { drawCaveGround(); return; }
  if (zone === sky) { drawSkyGround(); return; }
  for (const piece of zone.groundPieces) {
    if (piece.x + piece.w < camera - T || piece.x > camera + W + T) continue;
    const sx = piece.x - camera;
    fill(sx, GROUND, piece.w, H - GROUND, '#725147');
    fill(sx, GROUND, piece.w, 4, '#315e53');
    fill(sx, GROUND + 4, piece.w, 5, '#5a9a72');
    fill(sx, GROUND + 9, piece.w, 4, '#9ac484');
    fill(sx, GROUND + 13, piece.w, 5, '#8c624a');
    for (let x = piece.x; x < piece.x + piece.w; x += T) {
      const screen = x - camera;
      if (screen < -T || screen > W + T) continue;
      const cell = Math.floor(x / T);
      fill(screen, GROUND + 18, 2, H - GROUND - 18, '#60463f');
      fill(screen + 4, GROUND + 25, 12, 4, '#a97a58');
      fill(screen + 24, GROUND + 43, 12, 5, '#59413c');
      fill(screen + 12, GROUND + 69, 13, 4, '#a77b5b');
      fill(screen + 30, GROUND + 77, 6, 3, '#d4ad78');
      fill(screen + 8, GROUND + 37, 3, 3, '#493d3b');
      fill(screen + 3, GROUND - 3, 18, 4, '#65a977');
      fill(screen + 5, GROUND - 6, 4, 5, '#7dbb7d');
      fill(screen + 26, GROUND - 5, 6, 6, '#88be7e');
      if (cell % 3 === 0) {
        fill(screen + 17, GROUND - 8, 3, 8, '#3d8061');
        fill(screen + 22, GROUND - 6, 3, 6, '#438c67');
      }
      if (cell % 7 === 2) {
        fill(screen + 28, GROUND + 26, 8, 5, '#d3ab78');
        fill(screen + 29, GROUND + 25, 5, 2, '#f1d2a0');
      }
    }
  }
  for (const deco of zone.decorations) {
    const x = deco.x - camera;
    if (x < -120 || x > W + 120) continue;
    if (deco.kind === 2) {
      fill(x + 7, GROUND - 17, 4, 18, '#39845f');
      fill(x, GROUND - 24, 13, 10, '#fff3b7');
      fill(x + 7, GROUND - 31, 13, 11, '#fff3b7');
      fill(x + 9, GROUND - 24, 5, 5, '#f7a06d');
    } else drawBush(x, GROUND, deco.size);
  }
}
function drawSkyGround() {
  for (const piece of zone.groundPieces) {
    if (piece.x + piece.w < camera - T || piece.x > camera + W + T) continue;
    const sx = piece.x - camera;
    fill(sx, GROUND, piece.w, H - GROUND, '#647b91');
    fill(sx, GROUND, piece.w, 5, '#f8f1d9');
    fill(sx, GROUND + 5, piece.w, 7, '#bfd5d7');
    fill(sx, GROUND + 12, piece.w, 8, '#8fa8b9');
    for (let x = piece.x; x < piece.x + piece.w; x += T) {
      const screen = x - camera;
      if (screen < -T || screen > W + T) continue;
      fill(screen, GROUND + 20, 2, H - GROUND - 20, '#52677f');
      fill(screen + 4, GROUND - 3, 19, 5, '#fff5dd');
      fill(screen + 28, GROUND - 5, 8, 6, '#eaf4e6');
      fill(screen + 7, GROUND + 29, 16, 4, '#a6c0c9');
      fill(screen + 25, GROUND + 50, 11, 4, '#d1d2cf');
      fill(screen + 12, GROUND + 73, 17, 3, '#8199ab');
    }
  }
  for (const deco of zone.decorations) {
    const x = deco.x - camera;
    if (x < -100 || x > W + 100) continue;
    fill(x + 9, GROUND - 29, 4, 29, '#6f9f92');
    fill(x + 1, GROUND - 36, 20, 15, '#a6c7ad');
    fill(x + 5, GROUND - 41, 12, 10, '#d4e2bf');
    fill(x + 9, GROUND - 40, 4, 4, '#fff4d5');
  }
}
function drawCaveGround() {
  for (const piece of zone.groundPieces) {
    if (piece.x + piece.w < camera - T || piece.x > camera + W + T) continue;
    const sx = piece.x - camera;
    fill(sx, GROUND, piece.w, H - GROUND, '#252943');
    fill(sx, GROUND, piece.w, 4, '#b2a2cb');
    fill(sx, GROUND + 4, piece.w, 6, '#73638e');
    fill(sx, GROUND + 10, piece.w, 5, '#4c476d');
    for (let x = piece.x; x < piece.x + piece.w; x += T) {
      const screen = x - camera;
      if (screen < -T || screen > W + T) continue;
      fill(screen, GROUND + 15, 2, H - GROUND, '#1c2037');
      fill(screen + 5, GROUND + 26, 18, 4, '#5c577a');
      fill(screen + 25, GROUND + 49, 12, 4, '#494768');
      fill(screen + 9, GROUND + 71, 8, 4, '#666083');
      fill(screen + 31, GROUND + 76, 3, 3, '#8cccd2');
      if (Math.floor(x / T) % 5 === 0) {
        fill(screen + 5, GROUND - 4, 5, 4, '#80d8db');
        fill(screen + 7, GROUND - 7, 2, 4, '#d7faf0');
      }
    }
  }
  for (const deco of zone.decorations) {
    const x = deco.x - camera;
    if (x < -50 || x > W + 50) continue;
    drawCaveCrystal(x, GROUND, deco.size ? 1 : .7, deco.kind === 1 ? '#c0a2ec' : '#82dbd2');
  }
  for (let i = 0; i < 2; i++) {
    const start = i === 0 ? 20 * T : 0;
    if (!start) continue;
    const x = start - camera;
    fill(x, GROUND + 30, 3 * T, H - GROUND - 30, '#5c4d77');
    for (let n = 0; n < 6; n++) fill(x + n * 25 + Math.sin(tick / 24 + n) * 3, GROUND + 42 + n % 2 * 8, 12, 3, '#8d6dab');
  }
}
function drawBrick(x, y, stone = false) {
  const night = zone === cave || zone === castle;
  const airy = zone === sky;
  const main = night ? '#665e83' : airy ? '#a5b7c3' : stone ? '#a98468' : '#ca7955';
  const light = night ? '#a395bf' : airy ? '#d6e4de' : stone ? '#ddbc92' : '#f5aa73';
  const dark = night ? '#393750' : airy ? '#677b97' : stone ? '#6d5651' : '#8c513f';
  fill(x, y, T, T, dark); fill(x + 3, y + 3, T - 6, T - 6, main);
  fill(x + 3, y + 3, T - 6, 4, light);
  fill(x + 3, y + 7, 4, 11, light);
  fill(x + 3, y + 19, T - 6, 3, dark);
  fill(x + 21, y + 3, 3, 16, dark);
  fill(x + 11, y + 22, 3, 16, dark);
  fill(x + 5, y + 28, 5, 3, light); fill(x + 27, y + 10, 8, 3, light);
  fill(x + 7, y + 10, 7, 2, night ? '#c1b1cd' : airy ? '#f5f6e6' : '#ffd0a0');
  fill(x + 23, y + 34, 11, 2, dark);
  if (night) fill(x + 28, y + 6, 4, 5, '#9bd8dc');
}
function drawQuestion(block) {
  const x = Math.round(block.x - camera), y = Math.round(block.y - (block.bump ? Math.sin(block.bump / 9 * Math.PI) * 8 : 0));
  fill(x, y, T, T, block.used ? '#9d7e60' : zone === cave || zone === castle ? '#6a537c' : '#a6633e');
  fill(x + 3, y + 3, T - 6, T - 6, block.used ? '#c3a27b' : zone === cave || zone === castle ? '#d7b5eb' : '#ffcb62');
  fill(x + 4, y + 4, T - 8, 5, block.used ? '#d5b990' : '#ffe592');
  fill(x + 5, y + 5, 4, 4, '#fff4c2'); fill(x + T - 9, y + 5, 4, 4, '#fff4c2');
  fill(x + 5, y + T - 9, 4, 4, '#a56a3b'); fill(x + T - 9, y + T - 9, 4, 4, '#a56a3b');
  if (!block.used) {
    ctx.font = 'bold 27px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#925b31'; ctx.fillText('?', x + T / 2 + 2, y + T / 2 + 4);
    ctx.fillStyle = '#fff9c8'; ctx.fillText('?', x + T / 2, y + T / 2 + 2);
    if (tick % 78 < 12) fill(x + 32, y + 6, 5, 5, '#ffffff');
  }
}
function drawSpring(x, y) {
  fill(x, y + 3, T, 11, '#6e487c');
  fill(x + 3, y, T - 6, 7, '#eb93b6');
  fill(x + 7, y + 7, 5, 7, '#efe5d6');
  fill(x + 29, y + 7, 5, 7, '#efe5d6');
  fill(x + 13, y + 7, 16, 5, '#bd709e');
}
function drawBlocks() {
  for (const block of zone.blocks) {
    if (block.broken || block.x < camera - T || block.x > camera + W + T) continue;
    if (block.type === 'question') drawQuestion(block);
    else drawBrick(Math.round(block.x - camera), Math.round(block.y - (block.bump ? Math.sin(block.bump / 9 * Math.PI) * 8 : 0)));
  }
  for (const block of zone.stairs) {
    if (block.x < camera - T || block.x > camera + W + T) continue;
    if (block.type === 'spring') drawSpring(Math.round(block.x - camera), block.y);
    else drawBrick(Math.round(block.x - camera), block.y, true);
  }
}
function drawPipes() {
  for (const pipe of zone.pipes) {
    if (pipe.x < camera - pipe.w || pipe.x > camera + W) continue;
    const x = Math.round(pipe.x - camera), y = pipe.y;
    const cavePipe = zone === cave || zone === castle;
    const edge = cavePipe ? '#263958' : '#255744';
    const base = cavePipe ? '#49768f' : '#37855f';
    const light = cavePipe ? '#8fcbd1' : '#9bd795';
    fill(x + 8, y + 15, pipe.w - 16, pipe.h - 15, edge);
    fill(x + 11, y + 16, pipe.w - 22, pipe.h - 16, base);
    fill(x + 17, y + 18, 12, pipe.h - 18, light);
    fill(x + 31, y + 18, 5, pipe.h - 18, cavePipe ? '#659fb3' : '#5baa72');
    fill(x + pipe.w - 20, y + 17, 8, pipe.h - 17, cavePipe ? '#31516f' : '#2a6c51');
    fill(x + 2, y - 2, pipe.w - 4, 26, edge);
    fill(x + 5, y + 1, pipe.w - 10, 18, cavePipe ? '#6a9daf' : '#5eae73');
    fill(x + 10, y + 2, 18, 13, cavePipe ? '#c3e7df' : '#c5eba4');
    fill(x + 29, y + 2, 6, 13, light);
    fill(x + pipe.w - 16, y + 2, 7, 14, cavePipe ? '#416784' : '#39845c');
    fill(x + 5, y + 17, pipe.w - 10, 4, cavePipe ? '#385670' : '#34785a');
    fill(x + 10, y + 24, pipe.w - 20, 3, cavePipe ? '#243f62' : '#275f4b');
    fill(x + 6, y - 2, pipe.w - 12, 2, cavePipe ? '#d2e5de' : '#d8eead');
    if (pipe.portal) {
      const glow = .35 + (Math.sin(tick / 13) + 1) * .19;
      ctx.globalAlpha = glow;
      fill(x + 28, y + 34, 29, 28, cavePipe ? '#a3caff' : '#e2ef9f');
      ctx.globalAlpha = 1;
      fill(x + 33, y + 46, 17, 10, cavePipe ? '#d7f4ee' : '#fff2bb');
      fill(x + 32, y + 39, 5, 5, cavePipe ? '#d7f4ee' : '#fff2bb');
      fill(x + 40, y + 36, 5, 5, cavePipe ? '#d7f4ee' : '#fff2bb');
      fill(x + 48, y + 39, 5, 5, cavePipe ? '#d7f4ee' : '#fff2bb');
    }
  }
}
function drawCoin(x, y, spin = 0) {
  const width = Math.max(5, Math.abs(Math.cos(spin)) * 20);
  fill(x - width / 2 - 2, y - 13, width + 4, 26, '#aa682b');
  fill(x - width / 2, y - 11, width, 22, '#ffd15d');
  if (width > 11) {
    fill(x - 3, y - 7, 5, 14, '#fff1a5');
    fill(x + 5, y - 4, 3, 9, '#e49c3f');
  }
}
function drawBone(x, y) {
  fill(x + 8, y + 7, 19, 10, '#b6a275');
  fill(x + 6, y + 5, 19, 10, '#fff5d0');
  fill(x + 2, y + 3, 9, 9, '#fff5d0'); fill(x + 2, y + 11, 9, 9, '#fff5d0');
  fill(x + 23, y + 3, 9, 9, '#fff5d0'); fill(x + 23, y + 11, 9, 9, '#fff5d0');
  fill(x + 11, y + 7, 14, 3, '#ffffff');
}
function drawItem(type, x, y, age = 0) {
  const bob = Math.sin((tick + age * 2) / 13) * 4;
  y += bob;
  ctx.globalAlpha = .17 + (Math.sin(tick / 17 + x) + 1) * .05;
  fill(x - 9, y - 11, 52, 48, type === 'star' || type === 'spark' ? '#ffe580' : '#ddcaff');
  ctx.globalAlpha = 1;
  if (type === 'bone' || type === 'boomerang') { drawBone(x, y + 5); if (type === 'boomerang') { fill(x + 13, y + 6, 8, 3, '#72c8c6'); fill(x + 26, y - 5, 3, 6, '#b5f5dd'); } return; }
  if (type === 'boots') {
    fill(x + 4, y + 1, 25, 22, '#415e9c');
    fill(x + 9, y + 4, 17, 14, '#7a9cdb');
    fill(x + 3, y + 20, 30, 8, '#e6eaf8');
    fill(x + 7, y + 11, 5, 5, '#f7d36b');
    fill(x + 18, y + 9, 6, 3, '#eef5ff');
  } else if (type === 'star') {
    ctx.fillStyle = '#ffd054';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 ? 8 : 17;
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const px = x + 17 + Math.cos(angle) * radius;
      const py = y + 15 + Math.sin(angle) * radius;
      if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    fill(x + 11, y + 11, 3, 4, '#724e4b'); fill(x + 21, y + 11, 3, 4, '#724e4b');
    fill(x + 8, y + 3, 4, 4, '#fff5ad');
  } else if (type === 'magnet') {
    fill(x + 3, y + 2, 8, 22, '#f17071'); fill(x + 24, y + 2, 8, 22, '#f17071');
    fill(x + 7, y + 19, 21, 8, '#e76d89');
    fill(x + 3, y + 2, 8, 7, '#e8ecfa'); fill(x + 24, y + 2, 8, 7, '#e8ecfa');
    fill(x + 13, y + 13, 8, 6, '#32496c');
  } else if (type === 'heart') {
    fill(x + 4, y + 6, 11, 10, '#ea607c'); fill(x + 20, y + 6, 11, 10, '#ea607c');
    fill(x + 6, y + 13, 24, 9, '#ed5e7a');
    fill(x + 11, y + 22, 14, 5, '#e15070');
    fill(x + 15, y + 27, 6, 4, '#c74466');
    fill(x + 8, y + 8, 5, 4, '#ffb6bc');
  } else if (type === 'spark') {
    fill(x + 8, y + 5, 19, 21, '#9a6649');
    fill(x + 10, y + 2, 15, 21, '#f4bb65');
    fill(x + 14, y + 5, 7, 11, '#ffe5a6');
    fill(x + 6, y + 19, 23, 5, '#cc8a4c');
    fill(x + 14, y + 22, 7, 6, '#fff4c0');
    fill(x + 2, y + 5, 4, 4, '#fff3b0'); fill(x + 28, y + 7, 4, 4, '#fff3b0');
  } else if (type === 'claw') {
    fill(x + 6, y + 9, 24, 19, '#365e78');
    fill(x + 8, y + 7, 20, 17, '#75b9c7');
    fill(x + 10, y + 4, 4, 9, '#d8f6ec');
    fill(x + 17, y + 1, 4, 10, '#d8f6ec');
    fill(x + 24, y + 4, 4, 9, '#d8f6ec');
    fill(x + 12, y + 15, 12, 6, '#e9e1c9');
  }
}
function drawProjectiles() {
  for (const shot of projectiles) {
    const x = Math.round(shot.x - camera), y = Math.round(shot.y);
    if (shot.kind === 'boomerang') { ctx.save(); ctx.translate(x + 14, y + 8); ctx.rotate(shot.age * .34); drawBone(-17, -11); fill(-3, -5, 8, 3, '#82d7d4'); ctx.restore(); continue; }
    if (x < -30 || x > W + 30) continue;
    ctx.globalAlpha = .22;
    fill(x - 9, y - 8, 34, 29, '#fff0a1');
    ctx.globalAlpha = 1;
    fill(x - Math.sign(shot.vx) * 8, y + 4, 9, 4, '#f5a971');
    fill(x, y + 2, 17, 12, '#a96a55');
    fill(x + 2, y, 13, 12, '#ffce73');
    fill(x + 5, y + 2, 7, 5, '#fff7c1');
    fill(x + 7, y - 4, 3, 3, '#fff9dc');
  }
}
function drawCollectibles() {
  for (const coin of coins) {
    if (coin.taken || coin.x < camera - 30 || coin.x > camera + W + 30) continue;
    drawCoin(coin.x - camera, coin.y + Math.sin(tick / 14 + coin.x) * 4, tick / 10 + coin.x);
  }
  for (const pickup of powerups) {
    if (!pickup.taken && pickup.x > camera - 50 && pickup.x < camera + W + 50)
      drawItem(pickup.type, pickup.x - camera, pickup.y, pickup.age);
  }
  for (const coin of movingCoins) {
    drawCoin(coin.x - camera, coin.y - coin.age * 2.3, coin.age / 6);
  }
}
function drawEnemy(enemy) {
  if (enemy.isBoss) return;
  const x = Math.round(enemy.x - camera), y = Math.round(enemy.y);
  if (x < -50 || x > W + 50) return;
  if (!enemy.alive) {
    if (enemy.squash > 0) { fill(x + 3, y + enemy.h - 7, enemy.w - 6, 7, enemy.type === 'slime' ? '#9365a7' : '#925b3b'); }
    return;
  }
  if (enemy.type !== 'bat') {
    ctx.globalAlpha = .2;
    fill(x + 2, GROUND - 4, enemy.w + 2, 4, '#172e3c');
    ctx.globalAlpha = 1;
  }
  if (enemy.stun && tick % 10 < 5) { drawPawGlyph(x + enemy.w / 2, y - 13, '#ffe7a1', .65); }
  if (enemy.type === 'spitter') {
    fill(x + 4, y + 25, 28, 10, '#34495a'); fill(x + 2, y + 12, 30, 20, '#588b82');
    fill(x + 5, y + 5, 24, 19, '#8fc1a4'); fill(x + 11, y, 12, 9, '#b4d3a0');
    fill(x + 7, y + 14, 5, 5, '#22394e'); fill(x + 22, y + 14, 5, 5, '#22394e');
    fill(x + 12, y + 22, 13, 8, '#3a5861'); fill(x + 16, y + 23, 6, 4, '#ebba93');
    fill(x + 6, y + 8, 7, 3, '#d8ebbd'); return;
  }
  if (enemy.type === 'guardian') {
    const blink = enemy.stun > 0 && tick % 8 < 4;
    fill(x + 4, y + 34, 17, 15, '#202d4b'); fill(x + 37, y + 34, 17, 15, '#202d4b');
    fill(x + 2, y + 13, 54, 31, '#293653');
    fill(x + 6, y + 9, 46, 32, blink ? '#8d88a2' : '#596481');
    fill(x + 11, y + 6, 36, 13, '#8294a7');
    fill(x + 4, y + 3, 13, 18, '#465675'); fill(x + 41, y + 3, 13, 18, '#465675');
    fill(x + 10, y, 8, 11, '#b5c8c0'); fill(x + 40, y, 8, 11, '#b5c8c0');
    fill(x + 13, y + 21, 11, 8, '#2b3955'); fill(x + 34, y + 21, 11, 8, '#2b3955');
    fill(x + 16, y + 22, 6, 6, blink ? '#fff4da' : '#ffe39c'); fill(x + 36, y + 22, 6, 6, blink ? '#fff4da' : '#ffe39c');
    fill(x + 24, y + 30, 10, 6, '#3b405b');
    fill(x + 25, y + 30, 8, 3, '#d4c8b7');
    fill(x + 11, y + 13, 8, 3, '#c8d3cb'); fill(x + 38, y + 13, 8, 3, '#c8d3cb');
    for (let i = 0; i < 3; i++) fill(x + 12 + i * 12, y - 12, 8, 5, i < enemy.health ? '#ffe5a0' : '#4b5369');
    return;
  }
  if (enemy.type === 'bat') {
    const spread = 8 + Math.abs(Math.sin(tick / 6 + enemy.phase)) * 13;
    fill(x + 13 - spread, y + 10, spread + 5, 8, '#322c53');
    fill(x + 22, y + 10, spread + 5, 8, '#322c53');
    fill(x + 7 - spread, y + 14 + spread * .18, spread + 5, 5, '#514073');
    fill(x + 26, y + 14 + spread * .18, spread + 5, 5, '#514073');
    fill(x + 8, y + 1, 8, 8, '#5b4b7f'); fill(x + 24, y + 1, 8, 8, '#5b4b7f');
    fill(x + 11, y + 6, 20, 17, '#554773');
    fill(x + 16, y + 10, 5, 6, '#ffdc83'); fill(x + 25, y + 10, 5, 6, '#ffdc83');
    fill(x + 18, y + 11, 2, 4, '#3a2d4b'); fill(x + 27, y + 11, 2, 4, '#3a2d4b');
    fill(x + 21, y + 18, 5, 3, '#e7adac');
    return;
  }
  if (enemy.type === 'beetle') {
    const shell = enemy.armor ? '#4b89a0' : '#c98069';
    const top = enemy.armor ? '#88c7c8' : '#f4b487';
    fill(x + 4, y + 22, 10, 5, '#374352'); fill(x + 22, y + 22, 10, 5, '#374352');
    fill(x + 2, y + 11, 32, 15, '#3c5263');
    fill(x + 4, y + 5, 28, 18, shell);
    fill(x + 9, y + 2, 18, 7, top);
    fill(x + 17, y + 5, 2, 14, enemy.armor ? '#346479' : '#aa634f');
    fill(x + 7, y + 12, 6, 4, '#a8e4d9'); fill(x + 24, y + 12, 6, 4, '#a8e4d9');
    fill(x + 8, y + 17, 5, 5, '#eff6e9'); fill(x + 24, y + 17, 5, 5, '#eff6e9');
    fill(x + 10, y + 18, 2, 4, '#263b4f'); fill(x + 26, y + 18, 2, 4, '#263b4f');
    if (enemy.stun) {
      fill(x + 3, y - 7, 4, 4, '#ffe899'); fill(x + 26, y - 10, 4, 4, '#ffe899');
    }
    return;
  }
  if (enemy.type === 'slime') {
    const stretch = enemy.vy < -1 ? 3 : 0;
    fill(x + 3, y + 9 - stretch, 27, 16 + stretch, '#785994');
    fill(x + 7, y + 4 - stretch, 19, 11, '#a47ac3');
    fill(x + 10, y + 3 - stretch, 12, 5, '#c39cdc');
    fill(x + 2, y + 20, 30, 7, '#70518c');
    fill(x + 9, y + 14, 5, 6, '#fff2e6'); fill(x + 21, y + 14, 5, 6, '#fff2e6');
    fill(x + 11, y + 16, 2, 4, '#3d375e'); fill(x + 23, y + 16, 2, 4, '#3d375e');
    fill(x + 16, y + 21, 6, 2, '#5a406f');
    fill(x + 8, y + 8, 4, 4, '#d9b6e5');
    return;
  }
  const foot = Math.sin(tick / 5 + enemy.phase) > 0 ? 2 : 0;
  fill(x + 4, y + 21 + foot, 9, 7 - foot, '#514447'); fill(x + 19, y + 23 - foot, 9, 5 + foot, '#514447');
  fill(x + 3, y + 12, 26, 14, '#765650');
  fill(x + 6, y + 14, 20, 11, '#ffe2b7');
  fill(x + 1, y + 8, 30, 12, '#9b534d');
  fill(x + 4, y + 4, 24, 10, '#d87d62');
  fill(x + 8, y + 2, 16, 5, '#f5a77c');
  fill(x + 7, y + 7, 5, 4, '#fff2d6'); fill(x + 21, y + 8, 5, 4, '#fff2d6');
  fill(x + 14, y + 4, 4, 3, '#ffd9a7');
  fill(x + 10, y + 16, 4, 6, '#303441'); fill(x + 20, y + 16, 4, 6, '#303441');
  fill(x + 11, y + 17, 2, 2, '#fff9e5'); fill(x + 21, y + 17, 2, 2, '#fff9e5');
  fill(x + 15, y + 22, 4, 2, '#ce8f81');
}
function drawDog() {
  if (!player) return;
  ctx.save();
  if (player.invulnerable && Math.floor(tick / 5) % 2) ctx.globalAlpha = .52;
  const sink = state === 'warping' && warp ? (warp.total - warp.ticks) * 2.2 : 0;
  const x = Math.round(player.x - camera - 17), y = Math.round(player.y + player.h - 63 + sink);
  const moving = Math.abs(player.vx) > .65;
  const row = state === 'respawn' ? 5 : !player.grounded ? 4 : moving ? 1 : 0;
  const frames = row === 0 ? 6 : row === 4 ? 6 : 8;
  const col = row === 4 ? (player.vy < -2 ? 1 : player.vy > 2 ? 4 : 2) : Math.floor(tick / (row === 0 ? 14 : 5)) % frames;
  const squash = player.landing > 0 ? player.landing / 55 : 0;
  const stretch = !player.grounded && player.vy < -2 ? .055 : 0;
  if (player.grounded && !sink) {
    ctx.globalAlpha = .22;
    const shadowY = Math.min(GROUND, player.y + player.h);
    fill(x + 9, shadowY - 4, 49, 5, zone === cave || zone === castle ? '#0d1225' : '#254654');
    fill(x + 17, shadowY - 7, 32, 3, '#fff6d0');
    ctx.globalAlpha = 1;
  }
  if (player.starTime > 0) {
    const pulse = Math.sin(tick / 5) * 3;
    ctx.globalAlpha = .24;
    fill(x + 2 - pulse, y - 3 - pulse, 63 + pulse * 2, 72 + pulse * 2, tick % 10 < 5 ? '#fff2a0' : '#f2d5ff');
    ctx.globalAlpha = 1;
    for (let i = 0; i < 4; i++) {
      const angle = tick / 12 + i * Math.PI / 2;
      const px = x + 32 + Math.cos(angle) * 38, py = y + 33 + Math.sin(angle) * 36;
      fill(px - 1, py - 5, 3, 12, '#fff4b0'); fill(px - 5, py - 1, 12, 3, '#fff4b0');
    }
  }
  if (player.shield) {
    ctx.globalAlpha = .15;
    fill(x + 3, y + 1, 60, 66, '#fff2b3');
    ctx.globalAlpha = 1;
    fill(x + 8, y - 1, 48, 3, '#fff5c3');
    fill(x + 3, y + 5, 4, 50, '#f7dda2'); fill(x + 58, y + 5, 4, 50, '#f7dda2');
    fill(x + 8, y + 62, 48, 3, '#f7dda2');
    fill(x + 5, y + 3, 6, 6, '#fff9de'); fill(x + 54, y + 57, 6, 6, '#fff9de');
  }
  if (sprite) {
    ctx.save();
    ctx.translate(x + 32, y + 70);
    ctx.scale((player.facing < 0 ? -1 : 1) * (1 + squash - stretch / 2 + (player.dashTime ? .15 : 0)), (1 - squash + stretch) * (player.crouched ? .72 : 1));
    ctx.rotate(player.groundPound ? player.facing * .12 : player.wallDir ? player.wallDir * -.12 : 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, col * 192, row * 208, 192, 208, -32, -70, 65, 70);
    ctx.restore();
  } else {
    fill(x + 12, y + 15, 42, 45, '#eebc78');
    fill(x + 18, y + 30, 30, 25, '#fff4d6');
    fill(x + 22, y + 25, 4, 4, '#302f32'); fill(x + 39, y + 25, 4, 4, '#302f32');
  }
  // A small adventurer scarf and a collar keep the same plush silhouette in every state.
  const scarfX = player.facing > 0 ? x + 18 : x + 36;
  fill(scarfX, y + 45, 14, 4, '#bd625b'); fill(scarfX - player.facing * 5, y + 46, 5, 11, '#e7886a');
  if (player.weapon === 'boomerang' && player.weaponTime > 0) { fill(x + 30, y + 47, 8, 5, '#78bbb9'); drawPawGlyph(x + 34, y + 50, '#fff2c5', .28); }
  if (player.groundPound) { fill(x + 24, y + 75, 20, 3, '#ffe8a7'); fill(x + 28, y + 82, 12, 3, '#d4f1e6'); }
  if (player.shield) {
    fill(x + 25, y + 49, 17, 4, '#d98260');
    fill(x + 31, y + 46, 7, 9, '#ffe7a1');
    fill(x + 33, y + 48, 3, 5, '#fff9d3');
  }
  if (player.bootsTime > 0) {
    fill(x + 8, y + 59, 19, 8, '#426d9b'); fill(x + 39, y + 59, 19, 8, '#426d9b');
    fill(x + 9, y + 58, 16, 4, '#91bee0'); fill(x + 40, y + 58, 16, 4, '#91bee0');
    fill(x + 7, y + 65, 22, 3, '#f1ead4'); fill(x + 37, y + 65, 22, 3, '#f1ead4');
    if (!player.grounded) { fill(x + 5, y + 70, 4, 4, '#d5ebff'); fill(x + 56, y + 70, 4, 4, '#d5ebff'); }
  }
  if (player.magnetTime > 0) {
    const orbitX = x + 31 + Math.cos(tick / 12) * 38;
    const orbitY = y + 30 + Math.sin(tick / 12) * 24;
    drawCoin(orbitX, orbitY, tick / 12);
    fill(x + 51, y + 40, 5, 11, '#ef7583'); fill(x + 59, y + 40, 5, 11, '#ef7583');
    fill(x + 53, y + 48, 9, 5, '#f1a0ae');
  }
  if (player.weaponTime > 0 && player.weapon === 'spark') {
    fill(x + 22, y + 48, 22, 5, '#b37d5c');
    fill(x + 29, y + 50, 9, 9, '#f5c578');
    fill(x + 32, y + 52, 3, 4, '#fff7bd');
    if (tick % 17 < 8) { fill(x + 48, y + 16, 4, 4, '#fff0ad'); fill(x + 54, y + 12, 2, 2, '#fff7cc'); }
  }
  if (player.weaponTime > 0 && player.weapon === 'claw') {
    const pawX = player.facing > 0 ? x + 51 : x + 7;
    fill(pawX, y + 46, 11, 13, '#447c93');
    fill(pawX + 2, y + 44, 7, 10, '#8ec7d0');
    fill(pawX + 1, y + 41, 2, 6, '#e7f7e9'); fill(pawX + 5, y + 39, 2, 7, '#e7f7e9'); fill(pawX + 9, y + 41, 2, 6, '#e7f7e9');
  }
  if (player.attackFrame > 0) {
    const direction = player.facing;
    const edge = direction > 0 ? player.x - camera + player.attackReach - 8 : player.x - camera - player.attackReach + 10;
    const reach = player.attackFrame > 6 ? 0 : 6;
    fill(edge + direction * reach, y + 15, 5, 34, '#d8f8ef');
    fill(edge + direction * (reach + 8), y + 8, 4, 24, '#9ddde0');
    fill(edge + direction * (reach + 15), y + 18, 3, 22, '#fff6d7');
  }
  ctx.restore();
}
function drawFlagAndCastle() {
  if (!zone.finishX) return;
  const x = Math.round(zone.finishX - camera);
  const night = zone === castle;
  const airy = zone === sky;
  if (x > -50 && x < W + 50) {
    if (night && enemies.some(enemy => enemy.isBoss && enemy.alive)) {
      ctx.globalAlpha = .35 + (Math.sin(tick / 12) + 1) * .1;
      fill(x - 11, GROUND - 220, 12, 220, '#a9d9e6');
      fill(x - 15, GROUND - 218, 4, 216, '#d6f9ed');
      fill(x + 1, GROUND - 218, 4, 216, '#d6f9ed');
      ctx.globalAlpha = 1;
      for (let i = 0; i < 5; i++) fill(x - 17, GROUND - 215 + i * 46, 24, 4, '#d6f9ed');
    }
    fill(x + 10, GROUND - 330, 5, 330, '#e9eee4');
    fill(x + 7, GROUND - 337, 11, 10, '#ffe79e');
    fill(x + 15, GROUND - 325, 75, 44, night ? '#8ba4cf' : airy ? '#e4bbdd' : '#ea8065');
    fill(x + 15, GROUND - 325, 75, 7, night ? '#c3d7e7' : airy ? '#f7d8e6' : '#ffc492');
    fill(x + 24, GROUND - 310, 43, 5, '#fff3c8');
    fill(x + 27, GROUND - 297, 30, 4, '#fff3c8');
    fill(x, GROUND - 10, 32, 10, '#ba8c66');
  }
  const cx = zone.finishX + 4 * T - camera;
  if (cx < W + 180 && cx > -220) {
    const stone = night ? '#5b5d80' : airy ? '#b8b9c4' : '#ad7661';
    const highlight = night ? '#9191ae' : airy ? '#e5ded0' : '#bc896b';
    const shadow = night ? '#333954' : airy ? '#7a849b' : '#85595a';
    fill(cx, GROUND - 116, 170, 116, stone);
    fill(cx + 10, GROUND - 133, 44, 28, highlight);
    fill(cx + 115, GROUND - 133, 44, 28, highlight);
    fill(cx + 18, GROUND - 142, 28, 10, shadow);
    fill(cx + 122, GROUND - 142, 28, 10, shadow);
    fill(cx + 72, GROUND - 154, 28, 38, highlight);
    fill(cx + 65, GROUND - 163, 42, 10, shadow);
    fill(cx + 63, GROUND - 68, 44, 68, shadow);
    fill(cx + 69, GROUND - 62, 32, 62, night ? '#586581' : '#70484b');
    fill(cx + 26, GROUND - 89, 17, 24, '#f8d99a');
    fill(cx + 127, GROUND - 89, 17, 24, '#f8d99a');
    for (let i = 0; i < 4; i++) fill(cx + i * 41, GROUND - 30, 4, 27, shadow);
  }
}
function drawCheckpoints() {
  for (const tile of zone.checkpoints || []) {
    const x = Math.round(tile * T - camera);
    if (x < -30 || x > W + 30) continue;
    const active = checkpoint.zone === zone.id && checkpoint.x >= tile * T;
    fill(x + 11, GROUND - 76, 5, 76, '#716e66');
    fill(x + 6, GROUND - 88, 15, 17, active ? '#ffe19a' : '#938493');
    fill(x + 9, GROUND - 84, 9, 9, active ? '#fff6bd' : '#c3adac');
    fill(x + 7, GROUND - 6, 14, 6, '#735a4e');
    if (active) {
      ctx.globalAlpha = .16 + Math.sin(tick / 10) * .04;
      fill(x - 12, GROUND - 105, 52, 59, '#ffe596');
      ctx.globalAlpha = 1;
    }
  }
}
function drawAtmosphere() {
  if (zone === cave || zone === castle) {
    const shade = ctx.createRadialGradient(W / 2, H / 2 - 20, 110, W / 2, H / 2 - 20, 660);
    shade.addColorStop(0, '#0b112000'); shade.addColorStop(1, zone === cave ? '#090c25a3' : '#090c2566');
    fill(0, 0, W, H, shade);
    for (let i = 0; i < 7; i++) {
      const x = i * 168 - camera * .8;
      ctx.globalAlpha = .11;
      fill(x, 0, 35, H, '#a58acd');
    }
    ctx.globalAlpha = 1;
  } else {
    const warmth = ctx.createLinearGradient(0, 250, W, 530);
    warmth.addColorStop(0, '#ffffff00'); warmth.addColorStop(1, '#f9d99420');
    fill(0, 0, W, H, warmth);
  }
}
function drawParticles() {
  for (const p of particles) fill(p.x - camera, p.y, p.size, p.size, p.color);
}
function drawActionEffects() {
  for (const trail of ghostTrails) {
    if (!sprite) continue;
    ctx.save(); ctx.globalAlpha = trail.life / 12 * .22;
    ctx.translate(trail.x - camera + 15, trail.y + 41); ctx.scale(trail.facing, 1);
    ctx.drawImage(sprite, 192, 4 * 208, 192, 208, -32, -70, 65, 70); ctx.restore();
  }
  for (const wave of barkWaves) {
    const progress = 1 - wave.life / (wave.type === 'slam' ? 22 : 26), radius = 22 + progress * (wave.type === 'slam' ? 115 : 170);
    ctx.save(); ctx.globalAlpha = (1 - progress) * .7; ctx.strokeStyle = wave.type === 'slam' ? '#ffeab0' : '#abf4df'; ctx.lineWidth = 5 - progress * 3;
    ctx.beginPath(); ctx.ellipse(wave.x - camera, wave.y, radius, wave.type === 'slam' ? radius * .2 : radius * .68, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  for (const label of floatingLabels) {
    ctx.save(); ctx.globalAlpha = Math.min(1, label.life / 15); ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#1d3149'; ctx.fillText(label.text, label.x - camera + 1, label.y + 1); ctx.fillStyle = label.color; ctx.fillText(label.text, label.x - camera, label.y); ctx.restore();
  }
}
function drawStageIntro() {
  if (stageIntro <= 0 || state !== 'playing' || activeBossArena()) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, stageIntro / 28, (150 - stageIntro) / 18);
  const width = 300, x = (W - width) / 2, y = 95;
  fill(x, y, width, 62, '#20364ce6'); fill(x + 12, y + 10, 3, 42, '#e8bd75');
  ctx.textAlign = 'center'; ctx.fillStyle = '#eebf7b'; ctx.font = '10px monospace'; ctx.fillText('A LITTLE DOG. A BIG ADVENTURE.', W / 2, y + 18);
  ctx.fillStyle = '#fff2d0'; ctx.font = 'bold 21px system-ui, sans-serif'; ctx.fillText(zone.name, W / 2, y + 46); ctx.restore();
}
function draw() {
  ctx.save();
  if (screenShake > .25 && state !== 'paused') ctx.translate(Math.sin(tick * 2.3) * screenShake, Math.cos(tick * 3.1) * screenShake * .55);
  drawStageBackground(); drawGround(); drawFlagAndCastle(); drawCheckpoints();
  drawBlocks(); drawPipes(); drawWorldFeatures(); drawCollectibles(); drawProjectiles();
  for (const enemy of enemies) drawEnemy(enemy);
  drawBossBattle(); drawActionEffects(); drawDog(); drawParticles(); drawAtmosphere();
  ctx.restore();
  if (damageFlash > 0) { ctx.globalAlpha = damageFlash / 100; fill(0, 0, W, H, '#db6562'); ctx.globalAlpha = 1; }
  drawStageIntro(); drawBossHud();
  if (state === 'warping' && warp) {
    ctx.globalAlpha = .06 + (warp.total - warp.ticks) / warp.total * .88; fill(0, 0, W, H, '#11142b'); ctx.globalAlpha = 1;
  } else if (arrivalFade > 0) {
    ctx.globalAlpha = arrivalFade / 20 * .9; fill(0, 0, W, H, '#11142b'); ctx.globalAlpha = 1;
  }
}
function frame(now) {
  if (!lastFrame) lastFrame = now;
  accumulator += Math.min(50, now - lastFrame);
  lastFrame = now;
  while (accumulator >= 1000 / 60) { step(); accumulator -= 1000 / 60; }
  draw();
  requestAnimationFrame(frame);
}

function ensureAudio() {
  if (!audio && !muted) {
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { muted = true; }
  }
  if (audio?.state === 'suspended') audio.resume();
}
function updateMusic() {
  if (!musicEnabled || muted || !audio || state !== 'playing') return;
  const fighting = !!activeBossArena();
  const tempo = fighting ? 14 : 20;
  if (tick % tempo) return;
  const melodies = { surface: [0,4,7,12,7,4,2,7,4,0,7,9,7,4,2,0], cave: [0,3,7,10,7,3,5,2], orchard: [0,4,7,9,7,4,5,2], sky: [12,7,9,4,7,12,14,11], castle: [0,3,7,10,8,7,3,2] };
  const sequence = melodies[zone.id] || melodies.surface;
  const beat = Math.floor(tick / tempo);
  const root = zone === castle || zone === cave ? 196 : 220;
  const note = fighting ? [0,7,3,10,0,7,2,8][beat % 8] : sequence[beat % sequence.length];
  tone(root * 2 ** (note / 12), .16, 'triangle', .014);
  if (beat % 4 === 0) tone(root / 2, .24, 'sine', .023);
}
function tone(frequency, duration, type = 'square', volume = .055, delay = 0) {
  if (!audio || muted) return;
  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(.001, start + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}
function sound(name) {
  if (muted) return;
  if (name === 'dash') { tone(640, .09, 'sawtooth', .025); tone(190, .12, 'triangle', .05, .04); }
  if (name === 'bark') { tone(240, .08, 'triangle', .09); tone(360, .12, 'triangle', .08, .09); tone(720, .15, 'sine', .025, .16); }
  if (name === 'slam') { tone(100, .22, 'triangle', .09); tone(70, .14, 'sawtooth', .03, .03); }
  if (name === 'gem') [660, 880, 1100].forEach((f, i) => tone(f, .2, 'sine', .045, i * .09));
  if (name === 'checkpoint') [390, 490, 590, 780].forEach((f, i) => tone(f, .2, 'triangle', .035, i * .08));
  if (name === 'jump') { tone(340, .09); tone(485, .12, 'square', .045, .07); }
  if (name === 'doubleJump') { tone(530, .08); tone(790, .15, 'square', .045, .07); }
  if (name === 'coin') { tone(710, .07); tone(920, .12, 'square', .05, .08); }
  if (name === 'stomp') { tone(170, .12, 'triangle', .09); tone(230, .08, 'triangle', .05, .07); }
  if (name === 'bump') tone(145, .09, 'square', .045);
  if (name === 'break') { tone(160, .1, 'sawtooth', .035); tone(95, .13, 'triangle', .05, .08); }
  if (name === 'hurt') { tone(250, .12, 'sawtooth', .055); tone(130, .25, 'sawtooth', .045, .1); }
  if (name === 'power') [390, 520, 650, 780].forEach((f, i) => tone(f, .13, 'square', .035, i * .075));
  if (name === 'spring') [270, 390, 590].forEach((f, i) => tone(f, .1, 'triangle', .065, i * .055));
  if (name === 'attack') { tone(540, .07, 'triangle', .05); tone(740, .11, 'triangle', .035, .04); }
  if (name === 'pipe') [440, 340, 240, 160].forEach((f, i) => tone(f, .12, 'triangle', .065, i * .075));
  if (name === 'start') [330, 440, 550].forEach((f, i) => tone(f, .12, 'square', .035, i * .1));
  if (name === 'win') [440, 550, 660, 880, 660, 880].forEach((f, i) => tone(f, .19, 'square', .045, i * .14));
}

function setControl(name, pressed, source = 'direct') {
  if (!(name in control)) return;
  if (pressed && state !== 'playing') return;
  if (!heldInputs.has(name)) heldInputs.set(name, new Set());
  const held = heldInputs.get(name);
  if (pressed) held.add(source); else held.delete(source);
  const next = held.size > 0;
  if (next && !control[name]) {
    if (name === 'jump') jumpBuffer = 8;
    if (name === 'attack') attackBuffer = 8;
    if (name === 'down') downBuffer = 12;
    if (name === 'dash') dashBuffer = 8;
    if (name === 'bark') barkBuffer = 8;
  }
  if (name === 'jump' && !next && control.jump && player && player.vy < -4 && !player.dashTime) player.vy *= .55;
  control[name] = next;
}
const keyMap = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run',
  KeyJ: 'attack', KeyZ: 'attack', KeyK: 'dash', KeyC: 'dash', KeyL: 'bark', KeyV: 'bark',
};
function primaryAction() {
  if (state === 'paused') { pauseGame(); return; }
  if (state === 'won' && zone !== castle) { advanceStage(); return; }
  if (state === 'won' && zone === castle) selectedStage = 'surface';
  if (state === 'title' || state === 'won' || state === 'gameover') startGame();
}
function restartStage() {
  if (state === 'title') return;
  startGame(true, zone === cave ? 'surface' : zone.id);
  showToast('全新挑战开始 · 本关的最佳记录已保留');
}
function returnToTitle() {
  if (state === 'playing' || state === 'paused') saveProgress();
  releaseAllControls(); state = 'title'; resetWorld();
  if (!stageOrder.some(level => level.id === selectedStage)) selectedStage = 'surface';
  for (const button of document.querySelectorAll('[data-stage]')) button.classList.toggle('selected', button.dataset.stage === selectedStage);
  score = coinCount = gemCount = stageGems = 0; lives = 3; timeLeft = 400;
  setOverlay('A LITTLE DOG. A BIG ADVENTURE.', '小爪子，大冒险。', '跨越草原、果园与云海，闯进绒绒城堡。\n秘密宝藏和强大的首领，正等着团子！', '开始冒险');
  document.querySelector('#menu-button').classList.add('hidden');
  levelPicker.classList.remove('hidden');
  pauseButton.textContent = 'Ⅱ'; pauseButton.setAttribute('aria-label', '暂停游戏');
  updateHud(); updateTitleRecords();
}
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.querySelector('.app')?.requestFullscreen?.().catch(() => showToast('当前浏览器暂不支持全屏'));
}
const helpDialog = document.querySelector('#help-dialog');
let helpWasPlaying = false;
function openHelp() {
  helpWasPlaying = state === 'playing';
  if (helpWasPlaying) pauseGame();
  if (helpDialog.showModal) helpDialog.showModal();
}
function closeHelp() { helpDialog.close?.(); }
helpDialog.addEventListener('close', () => { if (helpWasPlaying && state === 'paused') pauseGame(); helpWasPlaying = false; });
document.addEventListener('keydown', event => {
  if (helpDialog.open) return;
  if (keyMap[event.code] || ['Escape','KeyP','KeyM','KeyR','KeyF','Enter'].includes(event.code)) event.preventDefault();
  if (event.code === 'Escape' || event.code === 'KeyP') { if (!event.repeat) pauseGame(); return; }
  if (event.code === 'KeyM') { if (!event.repeat) toggleSound(); return; }
  if (event.code === 'KeyR') { if (!event.repeat) restartStage(); return; }
  if (event.code === 'KeyF') { if (!event.repeat) toggleFullscreen(); return; }
  if ((event.code === 'Enter' || event.code === 'Space') && ['title','paused','won','gameover'].includes(state) && !event.repeat) { primaryAction(); return; }
  if (keyMap[event.code]) setControl(keyMap[event.code], true, event.code);
});
document.addEventListener('keyup', event => { if (keyMap[event.code]) setControl(keyMap[event.code], false, event.code); });
function suspendGame() { releaseAllControls(); if (state === 'playing') pauseGame(); }
window.addEventListener('blur', suspendGame);
document.addEventListener('visibilitychange', () => { if (document.hidden) suspendGame(); });
window.addEventListener('pagehide', () => { if (state === 'playing' || state === 'paused') saveProgress(); });
for (const button of document.querySelectorAll('[data-control]')) {
  const name = button.dataset.control;
  button.addEventListener('pointerdown', event => {
    event.preventDefault(); button.setPointerCapture(event.pointerId); button.classList.add('pressed');
    setControl(name, true, `pointer${event.pointerId}`);
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type, event => {
    button.classList.remove('pressed'); setControl(name, false, `pointer${event.pointerId}`);
  });
  button.addEventListener('contextmenu', event => event.preventDefault());
  button.addEventListener('click', event => {
    if (event.detail !== 0 || state !== 'playing') return;
    setControl(name, true, 'accessible'); setTimeout(() => setControl(name, false, 'accessible'), 100);
  });
}
function syncAudioButtons() {
  soundButton.textContent = muted ? '♪̸' : '♫'; soundButton.setAttribute('aria-label', muted ? '开启音频' : '关闭音频');
  soundButton.setAttribute('aria-pressed', String(!muted));
  const musicButton = document.querySelector('#music-button');
  musicButton.textContent = musicEnabled ? '♪' : '♪̸'; musicButton.setAttribute('aria-label', musicEnabled ? '关闭背景音乐' : '开启背景音乐');
  musicButton.setAttribute('aria-pressed', String(musicEnabled));
}
function toggleSound() {
  muted = !muted; if (!muted) ensureAudio(); syncAudioButtons(); saveSettings(); showToast(muted ? '音频已关闭' : '音频已开启');
}
soundButton.addEventListener('click', toggleSound);
document.querySelector('#music-button').addEventListener('click', () => { musicEnabled = !musicEnabled; ensureAudio(); syncAudioButtons(); saveSettings(); showToast(musicEnabled ? '背景音乐已开启' : '背景音乐已关闭'); });
pauseButton.addEventListener('click', pauseGame);
primaryButton.addEventListener('click', primaryAction);
document.querySelector('#continue-button').addEventListener('click', continueGame);
document.querySelector('#menu-button').addEventListener('click', returnToTitle);
document.querySelector('#restart-button').addEventListener('click', restartStage);
document.querySelector('#fullscreen-button').addEventListener('click', toggleFullscreen);
document.querySelector('#help-button').addEventListener('click', openHelp);
document.querySelector('#close-help-button').addEventListener('click', closeHelp);
for (const button of document.querySelectorAll('[data-stage]')) button.addEventListener('click', () => {
  if (state !== 'title') return;
  selectedStage = button.dataset.stage;
  for (const option of document.querySelectorAll('[data-stage]')) option.classList.toggle('selected', option === button);
  const selected = zones[selectedStage];
  document.querySelector('#overlay-text').textContent = `${selected.stage} · ${selected.name.split(' ')[0]}，出发吧！`;
});
syncAudioButtons();

const source = new Image();
source.src = 'assets/plush-dog.webp';
source.onload = () => {
  const image = document.createElement('canvas');
  image.width = source.width; image.height = source.height;
  const imageContext = image.getContext('2d', { willReadFrequently: true });
  imageContext.drawImage(source, 0, 0);
  const pixels = imageContext.getImageData(0, 0, image.width, image.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2];
    if (r > 45 && b > 42 && g < 105 && r > g * 1.38 && b > g * 1.3) pixels.data[i + 3] = 0;
  }
  imageContext.putImageData(pixels, 0, 0);
  sprite = image;
  const portrait = document.querySelector('#dog-portrait');
  if (portrait) { const portraitContext = portrait.getContext('2d'); portraitContext.imageSmoothingEnabled = false; portraitContext.clearRect(0, 0, 100, 100); portraitContext.drawImage(sprite, 0, 0, 192, 208, 4, 0, 92, 100); }
};
for (const [name, path] of Object.entries({
  surface: 'assets/meadow-background-v1.png',
  cave: 'assets/crystal-cave-background-v1.png',
  orchard: 'assets/orchard-sunset-background-v1.png',
  sky: 'assets/sky-garden-background-v1.png',
  castle: 'assets/moonlit-castle-background-v1.png',
})) {
  const image = new Image();
  image.onload = () => { backdrops[name] = image; };
  image.src = path;
}
resetWorld();
updateTitleRecords();
requestAnimationFrame(frame);
