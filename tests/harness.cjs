const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// This harness runs the real game logic with a deterministic clock. Rendering is
// intentionally inert; browser checks cover the appearance and actual controls.
function createGame(options = {}) {
  const root = path.join(__dirname, '..');
  const elements = new Map();
  const timers = new Map();
  const storage = options.storage || new Map();
  let clock = 0;
  let timerId = 0;
  const gradient = { addColorStop() {} };
  const drawing = new Proxy({
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: text => ({ width: String(text).length * 8 }),
    getImageData: () => ({ data: new Uint8ClampedArray() }),
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });

  function eventTarget() {
    const handlers = new Map();
    return {
      addEventListener(type, handler) {
        if (!handlers.has(type)) handlers.set(type, []);
        handlers.get(type).push(handler);
      },
      removeEventListener(type, handler) {
        handlers.set(type, (handlers.get(type) || []).filter(found => found !== handler));
      },
      dispatch(type, event = {}) {
        const value = { preventDefault() {}, stopPropagation() {}, ...event };
        for (const handler of handlers.get(type) || []) handler(value);
      },
    };
  }
  function element() {
    const classes = new Set();
    return {
      ...eventTarget(), textContent: '', innerHTML: '', dataset: {}, style: {},
      width: 960, height: 540, disabled: false, value: '', children: [],
      classList: {
        add: (...values) => values.forEach(value => classes.add(value)),
        remove: (...values) => values.forEach(value => classes.delete(value)),
        contains: value => classes.has(value),
        toggle(value, force) {
          const next = force === undefined ? !classes.has(value) : force;
          if (next) classes.add(value); else classes.delete(value);
          return next;
        },
      },
      setAttribute(name, value) { this[name] = String(value); },
      getAttribute(name) { return this[name] ?? null; },
      appendChild(child) { this.children.push(child); return child; },
      getContext: () => drawing,
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 960, height: 540 }),
      setPointerCapture() {}, releasePointerCapture() {}, focus() {},
    };
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const controls = Array.from(html.matchAll(/data-control="([^"]+)"/g), match => {
    const found = element(); found.dataset.control = match[1]; return found;
  });
  const stages = Array.from(html.matchAll(/data-stage="([^"]+)"/g), match => {
    const found = element(); found.dataset.stage = match[1]; return found;
  });
  const document = {
    ...eventTarget(), hidden: false, visibilityState: 'visible',
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
    querySelectorAll(selector) {
      if (selector === '[data-control]') return controls;
      if (selector === '[data-stage]') return stages;
      return [];
    },
    createElement: element,
  };
  const window = {
    ...eventTarget(), innerWidth: 1280, innerHeight: 800,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  };
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
  window.localStorage = localStorage;
  const context = vm.createContext({
    document, window, localStorage, console,
    location: { search: '', pathname: '/', href: 'http://localhost/' },
    performance: { now: () => clock },
    Image: class { set src(value) { this._src = value; } },
    requestAnimationFrame() {}, cancelAnimationFrame() {},
    setTimeout(callback, delay = 0) {
      const id = ++timerId;
      timers.set(id, { callback, due: clock + Number(delay) });
      return id;
    },
    clearTimeout: id => timers.delete(id),
  });
  const sources = options.scripts || Array.from(html.matchAll(/<script[^>]+src="([^"?]+)[^"]*"[^>]*>/g), match => match[1]);
  for (const source of sources.length ? sources : ['game.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, source), 'utf8'), context, { filename: source });
  }
  const run = source => vm.runInContext(source, context);
  return {
    context, run, document, window, elements, controls, stages,
    step(count = 1) { for (let i = 0; i < count; i++) run('step()'); },
    flushTimers(duration = Infinity) {
      const end = clock + duration;
      let calls = 0;
      while (calls++ < 1000) {
        const next = [...timers.entries()].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        const [id, timer] = next;
        timers.delete(id); clock = timer.due; timer.callback();
      }
      if (Number.isFinite(end)) clock = end;
      if (calls >= 1000) throw new Error('Timer loop did not settle');
    },
  };
}

module.exports = { createGame };
