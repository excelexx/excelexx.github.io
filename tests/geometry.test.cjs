const test = require('node:test');
const assert = require('node:assert/strict');
const { circumcircle, bisector, clampPoint, toScenePoint, initGeometry, INITIAL_POINTS, BOUNDS } = require('../geometry.js');

function close(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}

test('right triangle: the hypotenuse midpoint is the circumcentre', () => {
  const result = circumcircle({ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 8 });
  close(result.x, 3); close(result.y, 4); close(result.radius, 5);
});

test('equilateral triangle has the expected centre and radius', () => {
  const result = circumcircle({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: Math.sqrt(3) });
  close(result.x, 1); close(result.y, 1 / Math.sqrt(3)); close(result.radius, 2 / Math.sqrt(3));
});

test('centre is invariant under vertex ordering, translation and scaling', () => {
  const original = circumcircle(...INITIAL_POINTS);
  for (const order of [[0, 2, 1], [1, 2, 0], [2, 1, 0]]) {
    const reordered = circumcircle(...order.map(index => INITIAL_POINTS[index]));
    close(reordered.x, original.x); close(reordered.y, original.y); close(reordered.radius, original.radius);
  }
  for (const scale of [1e-5, 0.5, 20]) {
    const transformed = circumcircle(...INITIAL_POINTS.map(p => ({ x: p.x * scale + 1000, y: p.y * scale - 2000 })));
    close(transformed.x, original.x * scale + 1000);
    close(transformed.y, original.y * scale - 2000);
    close(transformed.radius, original.radius * scale);
  }
});

test('coincident, collinear and numerically degenerate triangles have no circle', () => {
  assert.equal(circumcircle({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }), null);
  assert.equal(circumcircle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }), null);
  assert.equal(circumcircle({ x: 1, y: 2 }, { x: 1, y: 2 }, { x: 4, y: 8 }), null);
  assert.equal(circumcircle({ x: 0, y: 0 }, { x: 1, y: 1e-12 }, { x: 2, y: 0 }), null);
  assert.equal(circumcircle({ x: NaN, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }), null);
});

test('500 triangles satisfy OA = OB = OC and the perpendicular-bisector construction', () => {
  let seed = 48179;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < 500; i++) {
    const points = Array.from({ length: 3 }, () => ({ x: 40 + random() * 400, y: 40 + random() * 360 }));
    const circle = circumcircle(...points);
    if (!circle) continue;
    for (let j = 0; j < 3; j++) {
      close(Math.hypot(points[j].x - circle.x, points[j].y - circle.y), circle.radius);
      const a = points[j], b = points[(j + 1) % 3], line = bisector(a, b);
      const dx = line.x2 - line.x1, dy = line.y2 - line.y1;
      close((line.x1 + line.x2) / 2, (a.x + b.x) / 2);
      close((line.y1 + line.y2) / 2, (a.y + b.y) / 2);
      assert.ok(Math.abs(dx * (b.x - a.x) + dy * (b.y - a.y)) < 1e-6);
      const perpendicularDistance = Math.abs(dx * (circle.y - line.y1) - dy * (circle.x - line.x1)) / Math.hypot(dx, dy);
      assert.ok(perpendicularDistance < 1e-7 * Math.max(1, circle.radius));
    }
  }
  assert.equal(bisector({ x: 1, y: 1 }, { x: 1, y: 1 }), null);
});

test('pointer coordinates account for page offset and responsive scaling', () => {
  assert.deepEqual(toScenePoint(130, 75, { left: 10, top: 20, width: 240, height: 220 }), { x: 240, y: 110 });
  assert.deepEqual(clampPoint({ x: -500, y: 1000 }), { x: BOUNDS.left, y: BOUNDS.bottom });
});

// A small event harness checks controller behaviour without a browser dependency.
class Element {
  constructor() {
    this.attributes = {}; this.style = {}; this.handlers = {}; this.hidden = true;
    this.checked = false; this.textContent = ''; this.captures = new Set();
    const names = new Set();
    this.classList = {
      add: name => names.add(name), remove: name => names.delete(name), contains: name => names.has(name),
      toggle: (name, force) => force ? names.add(name) : names.delete(name)
    };
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  addEventListener(name, callback) { (this.handlers[name] ||= []).push(callback); }
  emit(name, detail = {}) {
    const event = { button: 0, pointerId: 1, preventDefault() { this.prevented = true; }, ...detail };
    for (const callback of this.handlers[name] || []) callback(event);
    return event;
  }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); this.emit('lostpointercapture', { pointerId: id }); }
  focus() { this.focused = true; }
}

function fixture() {
  const ids = Object.fromEntries(['geometry-diagram', 'triangle', 'circumcircle', 'circumcentre', 'centre-point', 'centre-label', 'construction-lines', 'show-construction', 'geometry-status', 'diagram-description', 'reset-geometry', 'vertex-controls', 'geometry-controls', 'geometry-help'].map(id => [id, new Element()]));
  const handles = Array.from({ length: 3 }, () => new Element());
  const dots = Array.from({ length: 3 }, () => new Element());
  const labels = Array.from({ length: 3 }, () => new Element());
  const lines = Array.from({ length: 3 }, () => new Element());
  const rect = { left: 10, top: 20, width: 240, height: 220 };
  const stage = { getBoundingClientRect: () => rect };
  ids['geometry-diagram'].querySelectorAll = query => query === '[data-point]' ? dots : labels;
  ids['construction-lines'].querySelectorAll = () => lines;
  initGeometry({ querySelector: () => stage, querySelectorAll: () => handles, getElementById: id => ids[id] });
  function position(index) { return { x: Number(dots[index].getAttribute('cx')), y: Number(dots[index].getAttribute('cy')) }; }
  function move(index, point) {
    const current = position(index);
    handles[index].emit('pointerdown', { clientX: current.x / 2 + 10, clientY: current.y / 2 + 20 });
    handles[index].emit('pointermove', { clientX: point.x / 2 + 10, clientY: point.y / 2 + 20 });
    handles[index].emit('pointerup');
  }
  return { ids, handles, dots, lines, position, move };
}

test('controller reveals controls and supports scaled dragging and reset', () => {
  const f = fixture();
  for (const id of ['vertex-controls', 'geometry-controls', 'geometry-help']) assert.equal(f.ids[id].hidden, false);
  f.move(0, { x: 240, y: 120 });
  close(f.position(0).x, 240); close(f.position(0).y, 120);
  assert.equal(f.handles[0].hasPointerCapture(1), false);
  f.handles[0].emit('pointermove', { clientX: 20, clientY: 20 });
  close(f.position(0).x, 240); close(f.position(0).y, 120);
  f.ids['show-construction'].checked = true;
  f.ids['show-construction'].emit('change');
  assert.equal(f.ids['construction-lines'].getAttribute('visibility'), 'visible');
  assert.ok(f.lines.every(line => line.getAttribute('visibility') === 'visible'));
  f.ids['reset-geometry'].emit('click');
  for (let i = 0; i < 3; i++) assert.deepEqual(f.position(i), INITIAL_POINTS[i]);
  assert.equal(f.ids['show-construction'].checked, false);
});

test('keyboard movement, Shift, Home and bounds are supported', () => {
  const f = fixture();
  const event = f.handles[0].emit('keydown', { key: 'ArrowRight' });
  assert.equal(event.prevented, true);
  close(f.position(0).x, INITIAL_POINTS[0].x + 4);
  f.handles[0].emit('keydown', { key: 'ArrowDown', shiftKey: true });
  close(f.position(0).y, INITIAL_POINTS[0].y + 12);
  f.handles[0].emit('keydown', { key: 'Home' });
  assert.deepEqual(f.position(0), INITIAL_POINTS[0]);
  f.move(0, { x: -100, y: 800 });
  assert.deepEqual(f.position(0), { x: BOUNDS.left, y: BOUNDS.bottom });
  f.handles[0].emit('keydown', { key: 'ArrowLeft' });
  assert.equal(f.position(0).x, BOUNDS.left);
});

test('collinear drag hides invalid geometry and moving away restores it', () => {
  const f = fixture();
  f.move(0, { x: 100, y: 200 }); f.move(1, { x: 200, y: 200 }); f.move(2, { x: 300, y: 200 });
  assert.equal(f.ids['circumcircle'].getAttribute('visibility'), 'hidden');
  assert.match(f.ids['geometry-status'].textContent, /non-collinear/);
  f.move(0, { x: 100, y: 100 });
  assert.equal(f.ids['circumcircle'].getAttribute('visibility'), 'visible');
  assert.equal(f.ids['geometry-status'].textContent, 'OA = OB = OC');
});

test('pointer cancellation clears drag state', () => {
  const f = fixture();
  f.handles[0].emit('pointerdown', { clientX: 104, clientY: 56 });
  assert.equal(f.handles[0].classList.contains('dragging'), true);
  f.handles[0].emit('pointercancel');
  assert.equal(f.handles[0].classList.contains('dragging'), false);
  f.handles[0].emit('pointermove', { clientX: 130, clientY: 80 });
  assert.deepEqual(f.position(0), INITIAL_POINTS[0]);
});

test('an almost-flat triangle does not send an enormous circle to the renderer', () => {
  const f = fixture();
  f.move(0, { x: 100, y: 200 }); f.move(1, { x: 200, y: 200.0001 }); f.move(2, { x: 300, y: 200 });
  assert.equal(f.ids['circumcircle'].getAttribute('visibility'), 'hidden');
  assert.match(f.ids['geometry-status'].textContent, /too large/);
  f.ids['reset-geometry'].emit('click');
  assert.equal(f.ids['circumcircle'].getAttribute('visibility'), 'visible');
});
