/* The original advanexus mark becomes a moving material.
 * One clock drives the field, the shared paths and the four business steps.
 * This is a conceptual illustration, not a live execution monitor. */
(() => {
  'use strict';
  const scene = document.querySelector('.scene');
  const canvas = document.querySelector('.signature-canvas');
  const controls = [...document.querySelectorAll('.flow-step')];
  const motionButton = document.querySelector('.motion-control');
  const languageMenu = document.querySelector('.languages');
  if (!scene || !canvas) return;
  const context = canvas.getContext('2d', { alpha: true });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const mark = new Image();
  const state = {
    width: 1, height: 1, time: 0, phase: 0, phaseStart: 0,
    automaticAfter: 0, paused: reducedMotion.matches, visible: true,
    pointerX: 0, pointerY: 0, driftX: 0, driftY: 0,
    frame: 0, lastTime: 0, ready: false
  };
  const TAU = Math.PI * 2;
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
  const smooth = value => value * value * (3 - 2 * value);
  const teal = alpha => `rgba(10,179,156,${alpha})`;
  const white = alpha => `rgba(255,255,255,${alpha})`;

  function choosePhase(phase, manual = false) {
    state.phase = phase;
    state.phaseStart = state.time;
    if (manual) state.automaticAfter = state.time + 11;
    controls.forEach((control, index) => {
      control.classList.toggle('is-active', index === phase);
      control.setAttribute('aria-pressed', String(index === phase));
    });
    scene.dataset.phase = String(phase);
    scene.querySelector('.index-number').textContent = `0${phase + 1}`;
    if (state.paused || !state.visible) draw();
  }
  controls.forEach((control, index) => {
    control.addEventListener('click', () => choosePhase(index, true));
    control.addEventListener('keydown', event => {
      const forward = root.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const backward = root.dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
      let next;
      if (event.key === forward) next = (index + 1) % controls.length;
      if (event.key === backward) next = (index + controls.length - 1) % controls.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = controls.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      controls[next].focus();
      choosePhase(next, true);
    });
  });

  function syncMotion() {
    const playing = !state.paused && state.visible && !document.hidden;
    root.classList.toggle('motion-running', playing);
    root.classList.toggle('motion-paused', !playing);
    if (motionButton) {
      motionButton.hidden = false;
      motionButton.setAttribute('aria-pressed', String(state.paused));
      motionButton.querySelector('.motion-label').textContent = state.paused
        ? motionButton.dataset.resume : motionButton.dataset.pause;
      motionButton.querySelector('.motion-symbol').textContent = state.paused ? '▷' : 'Ⅱ';
    }
    cancelAnimationFrame(state.frame);
    state.lastTime = 0;
    if (playing && state.ready) state.frame = requestAnimationFrame(tick);
    else draw();
  }
  motionButton?.addEventListener('click', () => {
    state.paused = !state.paused;
    syncMotion();
  });
  reducedMotion.addEventListener('change', event => {
    state.paused = event.matches;
    syncMotion();
  });
  document.addEventListener('visibilitychange', syncMotion);
  new IntersectionObserver(entries => {
    state.visible = entries[0].isIntersecting;
    syncMotion();
  }, { threshold: 0 }).observe(scene);

  languageMenu?.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      languageMenu.open = false;
      languageMenu.querySelector('summary').focus();
    }
  });
  document.addEventListener('click', event => {
    if (languageMenu?.open && !languageMenu.contains(event.target)) languageMenu.open = false;
  });

  function resize() {
    const rect = scene.getBoundingClientRect();
    state.width = rect.width;
    state.height = rect.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2, 1600 / rect.width);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }
  new ResizeObserver(resize).observe(scene);
  scene.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || state.paused) return;
    const rect = scene.getBoundingClientRect();
    state.pointerX = clamp((event.clientX - rect.left) / rect.width - .5, -.5, .5);
    state.pointerY = clamp((event.clientY - rect.top) / rect.height - .5, -.5, .5);
  }, { passive: true });
  scene.addEventListener('pointerleave', () => {
    state.pointerX = state.pointerY = 0;
  });

  // Both packet and rail use this exact cubic curve, keeping them aligned.
  function curve(points, progress) {
    const q = 1 - progress;
    return {
      x: q ** 3 * points[0].x + 3 * q * q * progress * points[1].x
        + 3 * q * progress * progress * points[2].x + progress ** 3 * points[3].x,
      y: q ** 3 * points[0].y + 3 * q * q * progress * points[1].y
        + 3 * q * progress * progress * points[2].y + progress ** 3 * points[3].y
    };
  }
  function pathSection(points, from, to, color, width) {
    context.beginPath();
    const first = curve(points, from);
    context.moveTo(first.x, first.y);
    for (let step = 1; step <= 28; step++) {
      const point = curve(points, from + (to - from) * step / 28);
      context.lineTo(point.x, point.y);
    }
    context.lineWidth = width;
    context.strokeStyle = color;
    context.stroke();
  }
  function light(point, radius, alpha, color = 'white') {
    const rgba = color === 'teal' ? teal : white;
    const bloom = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 5);
    bloom.addColorStop(0, rgba(alpha * .8));
    bloom.addColorStop(.2, rgba(alpha * .35));
    bloom.addColorStop(1, rgba(0));
    context.fillStyle = bloom;
    context.fillRect(point.x - radius * 5, point.y - radius * 5, radius * 10, radius * 10);
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, TAU);
    context.fillStyle = rgba(alpha);
    context.fill();
  }

  function fieldPoint(u, v, time) {
    const { width: w, height: h } = state;
    const fold = Math.sin(u * 2.5 + v * 1.5 + time * .23) * .043;
    const ripple = Math.sin(v * 7 - time * .8 + u * 2) * .017;
    return {
      x: w * (.51 + u * .43 + v * .15) + state.driftX * 17,
      y: h * (.64 + v * .19 - u * .14 - fold - ripple) + state.driftY * 12
    };
  }
  function drawField(time) {
    const { width: w, height: h } = state;
    const columns = w < 500 ? 25 : 34;
    const rows = w < 500 ? 21 : 27;
    const beam = ((time * .21 + .8) % 2.8) - 1.4;
    for (let row = 0; row < rows; row++) {
      const v = (row / (rows - 1) - .5) * 2;
      for (let col = 0; col < columns; col++) {
        const u = ((col + (row % 2) * .5) / (columns - 1) - .5) * 2;
        const edge = Math.max(0, 1 - (u / 1.13) ** 4) * Math.max(0, 1 - (v / 1.1) ** 4);
        const sweep = Math.exp(-(((u + v * .35 - beam) / .18) ** 2));
        const pulse = Math.exp(-(((u - .15) / .45) ** 2) - ((v + .12) / .4) ** 2)
          * (.55 + .45 * Math.sin(time * .9));
        const opacity = edge * (.065 + sweep * .65 + pulse * .12);
        const point = fieldPoint(u, v, time);
        const size = w / columns * .75 * (1 + v * .08);
        context.save();
        context.translate(point.x, point.y);
        context.rotate(-.28 + Math.sin(v * 4 + time * .25) * .025);
        context.globalAlpha = opacity;
        context.drawImage(mark, -size / 2, -size * .35, size, size * .7);
        context.restore();
        if (sweep > .85 && edge > .7 && (col + row * 3) % 13 === 0) {
          light(point, w < 500 ? 1 : 1.2, sweep * edge * .8);
        }
      }
    }
    // Light reflected underneath the original circular brand artwork.
    const halo = context.createRadialGradient(w * .51, h * .55, 0, w * .51, h * .55, w * .28);
    halo.addColorStop(0, teal(.1 + .025 * Math.sin(time)));
    halo.addColorStop(.5, teal(.04));
    halo.addColorStop(1, teal(0));
    context.fillStyle = halo;
    context.fillRect(0, h * .25, w, h * .6);
  }

  function drawPackets(time) {
    const { width: w, height: h, phase } = state;
    const hub = { x: w * .51, y: h * (w < 500 ? .44 : .43) };
    for (let lane = 0; lane < 7; lane++) {
      const source = fieldPoint(-.85 + lane * .235, .7, time);
      const points = [source, { x: source.x + w * .1, y: source.y - h * .14 },
        { x: hub.x - w * .17 + lane * w * .015, y: hub.y + h * .14 }, hub];
      const progress = (time * .17 + lane * .143) % 1;
      const envelope = Math.sin(progress * Math.PI);
      const strength = phase === 0 ? 1 : phase === 1 ? .8 : .35;
      pathSection(points, Math.max(0, progress - .19), progress, teal(envelope * .24 * strength), 1);
      const point = curve(points, progress);
      light(point, w < 500 ? 1.65 : 2, envelope * strength, lane % 3 ? 'white' : 'teal');
    }
    if (phase >= 2) {
      for (let lane = 0; lane < 3; lane++) {
        const target = { x: w * (.83 + lane * .027), y: h * (.2 + lane * .023) };
        const points = [hub, { x: hub.x + w * .17, y: hub.y - h * .015 },
          { x: target.x - w * .1, y: target.y + h * .1 }, target];
        const progress = (time * .21 + lane * .31) % 1;
        const envelope = Math.sin(progress * Math.PI);
        pathSection(points, Math.max(0, progress - .24), progress, white(envelope * .22), 1);
        light(curve(points, progress), 2, envelope * .95, lane === 1 ? 'teal' : 'white');
      }
    }
    if (phase === 1) {
      const scan = .5 + .5 * Math.sin(time * 1.3);
      const y = hub.y - h * .13 + scan * h * .26;
      const gradient = context.createLinearGradient(hub.x - w * .2, y, hub.x + w * .2, y);
      gradient.addColorStop(0, teal(0)); gradient.addColorStop(.5, teal(.4)); gradient.addColorStop(1, teal(0));
      context.fillStyle = gradient;
      context.fillRect(hub.x - w * .2, y, w * .4, 1);
    }
  }
  function draw() {
    if (!context || !state.ready) return;
    context.clearRect(0, 0, state.width, state.height);
    drawField(state.time);
    drawPackets(state.time);
  }
  function tick(timestamp) {
    if (state.paused || !state.visible || document.hidden) return;
    if (!state.lastTime) state.lastTime = timestamp;
    const delta = timestamp - state.lastTime;
    if (delta >= 1000 / 30 - 1) {
      state.time += Math.min(delta / 1000, .075);
      state.lastTime = timestamp;
      state.driftX += (state.pointerX - state.driftX) * .07;
      state.driftY += (state.pointerY - state.driftY) * .07;
      if (state.time >= state.automaticAfter && state.time - state.phaseStart > 6.5) {
        choosePhase((state.phase + 1) % controls.length);
      }
      draw();
    }
    state.frame = requestAnimationFrame(tick);
  }
  mark.onload = () => {
    state.ready = !!context;
    if (!state.ready) return;
    scene.classList.add('is-ready');
    resize();
    syncMotion();
  };
  mark.src = scene.dataset.mark;
  choosePhase(0);
  syncMotion();
})();
