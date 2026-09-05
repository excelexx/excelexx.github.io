/* A small Euclidean construction. Classic script also works from a file:// preview. */
(function (root) {
  'use strict';

  const WIDTH = 480;
  const HEIGHT = 440;
  const BOUNDS = Object.freeze({ left: 36, right: 444, top: 36, bottom: 404 });
  const INITIAL_POINTS = Object.freeze([
    Object.freeze({ x: 188, y: 72 }),
    Object.freeze({ x: 82, y: 294 }),
    Object.freeze({ x: 395, y: 273 })
  ]);

  function circumcircle(a, b, c) {
    const ux = b.x - a.x;
    const uy = b.y - a.y;
    const vx = c.x - a.x;
    const vy = c.y - a.y;
    const u2 = ux * ux + uy * uy;
    const v2 = vx * vx + vy * vy;
    const scale2 = Math.max(u2, v2, (b.x - c.x) ** 2 + (b.y - c.y) ** 2);
    const cross = ux * vy - uy * vx;
    // Compare area with side length squared, so the degeneracy test is scale invariant.
    if (!Number.isFinite(scale2) || scale2 === 0 || Math.abs(cross) <= 1e-8 * scale2) return null;
    const dx = (vy * u2 - uy * v2) / (2 * cross);
    const dy = (ux * v2 - vx * u2) / (2 * cross);
    return { x: a.x + dx, y: a.y + dy, radius: Math.hypot(dx, dy) };
  }

  function bisector(a, b) {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 1e-8) return null;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = -(b.y - a.y) / length * 800;
    const dy = (b.x - a.x) / length * 800;
    return { x1: mx - dx, y1: my - dy, x2: mx + dx, y2: my + dy };
  }

  function clampPoint(point) {
    return {
      x: Math.max(BOUNDS.left, Math.min(BOUNDS.right, point.x)),
      y: Math.max(BOUNDS.top, Math.min(BOUNDS.bottom, point.y))
    };
  }

  function toScenePoint(clientX, clientY, rect) {
    return { x: (clientX - rect.left) / rect.width * WIDTH, y: (clientY - rect.top) / rect.height * HEIGHT };
  }

  function initGeometry(doc) {
    const stage = doc.querySelector('.geometry-stage');
    if (!stage) return;
    const svg = doc.getElementById('geometry-diagram');
    const triangle = doc.getElementById('triangle');
    const circle = doc.getElementById('circumcircle');
    const centre = doc.getElementById('circumcentre');
    const centrePoint = doc.getElementById('centre-point');
    const centreLabel = doc.getElementById('centre-label');
    const construction = doc.getElementById('construction-lines');
    const lines = Array.from(construction.querySelectorAll('line'));
    const showConstruction = doc.getElementById('show-construction');
    const status = doc.getElementById('geometry-status');
    const handles = Array.from(doc.querySelectorAll('[data-vertex]'));
    const dots = Array.from(svg.querySelectorAll('[data-point]'));
    const labels = Array.from(svg.querySelectorAll('[data-label]'));
    let points = INITIAL_POINTS.map(point => ({ ...point }));
    let drag = null;

    function attributes(node, values) {
      for (const [name, value] of Object.entries(values)) node.setAttribute(name, String(value));
    }

    function render() {
      triangle.setAttribute('points', points.map(point => `${point.x},${point.y}`).join(' '));
      const centroid = { x: points.reduce((sum, point) => sum + point.x, 0) / 3, y: points.reduce((sum, point) => sum + point.y, 0) / 3 };
      points.forEach((point, index) => {
        attributes(dots[index], { cx: point.x, cy: point.y });
        const dx = point.x - centroid.x;
        const dy = point.y - centroid.y;
        const length = Math.hypot(dx, dy) || 1;
        attributes(labels[index], { x: point.x + dx / length * 23, y: point.y + dy / length * 23 + 6, 'text-anchor': 'middle' });
        handles[index].style.left = `${point.x / WIDTH * 100}%`;
        handles[index].style.top = `${point.y / HEIGHT * 100}%`;
        handles[index].setAttribute('aria-label', `Move vertex ${'ABC'[index]}, x ${Math.round(point.x)}, y ${Math.round(HEIGHT - point.y)}`);
      });

      const result = circumcircle(...points);
      // Very large circles are intentionally hidden rather than sent to the SVG renderer.
      const drawable = result !== null && result.radius < 10000;
      circle.setAttribute('visibility', drawable ? 'visible' : 'hidden');
      centre.setAttribute('visibility', drawable ? 'visible' : 'hidden');
      if (drawable) {
        attributes(circle, { cx: result.x, cy: result.y, r: result.radius });
        attributes(centrePoint, { cx: result.x, cy: result.y });
        attributes(centreLabel, { x: result.x + 14, y: result.y - 6 });
      }
      const message = !result
        ? 'A circle needs three distinct, non-collinear points.'
        : !drawable ? 'The circumcircle is too large for this sketch.' : 'OA = OB = OC';
      if (status.textContent !== message) status.textContent = message;
      status.classList.toggle('is-notice', !drawable);
      doc.getElementById('diagram-description').textContent = drawable
        ? 'A circle passes through all three vertices of the triangle. Its centre O is equally distant from A, B and C.'
        : message;

      construction.setAttribute('visibility', showConstruction.checked ? 'visible' : 'hidden');
      lines.forEach((line, index) => {
        const segment = bisector(points[index], points[(index + 1) % 3]);
        line.setAttribute('visibility', segment && showConstruction.checked ? 'visible' : 'hidden');
        if (segment) attributes(line, segment);
      });
    }

    function finishDrag(event) {
      if (!drag || (event && event.pointerId !== drag.pointerId)) return;
      const previous = drag;
      drag = null;
      const handle = handles[previous.index];
      handle.classList.remove('dragging');
      if (handle.hasPointerCapture(previous.pointerId)) handle.releasePointerCapture(previous.pointerId);
    }

    handles.forEach((handle, index) => {
      handle.addEventListener('pointerdown', event => {
        if (event.button !== 0 || drag) return;
        event.preventDefault();
        const pointer = toScenePoint(event.clientX, event.clientY, stage.getBoundingClientRect());
        drag = { index, pointerId: event.pointerId, dx: points[index].x - pointer.x, dy: points[index].y - pointer.y };
        handle.setPointerCapture(event.pointerId);
        handle.focus({ preventScroll: true });
        handle.classList.add('dragging');
      });
      handle.addEventListener('pointermove', event => {
        if (!drag || drag.index !== index || drag.pointerId !== event.pointerId) return;
        const pointer = toScenePoint(event.clientX, event.clientY, stage.getBoundingClientRect());
        points[index] = clampPoint({ x: pointer.x + drag.dx, y: pointer.y + drag.dy });
        render();
      });
      handle.addEventListener('pointerup', finishDrag);
      handle.addEventListener('pointercancel', finishDrag);
      handle.addEventListener('lostpointercapture', finishDrag);
      handle.addEventListener('keydown', event => {
        const step = event.shiftKey ? 12 : 4;
        const deltas = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (event.key !== 'Home' && !deltas[event.key]) return;
        event.preventDefault();
        finishDrag();
        if (event.key === 'Home') points[index] = { ...INITIAL_POINTS[index] };
        else {
          const [dx, dy] = deltas[event.key];
          points[index] = clampPoint({ x: points[index].x + dx, y: points[index].y + dy });
        }
        render();
      });
    });

    showConstruction.addEventListener('change', render);
    doc.getElementById('reset-geometry').addEventListener('click', () => {
      finishDrag();
      points = INITIAL_POINTS.map(point => ({ ...point }));
      showConstruction.checked = false;
      render();
    });
    render();
    for (const id of ['vertex-controls', 'geometry-controls', 'geometry-help']) doc.getElementById(id).hidden = false;
  }

  const api = { circumcircle, bisector, clampPoint, toScenePoint, initGeometry, INITIAL_POINTS, BOUNDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document) initGeometry(root.document);
})(typeof globalThis !== 'undefined' ? globalThis : this);
