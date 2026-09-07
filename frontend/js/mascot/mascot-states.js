/*
 * MascotStates — the behaviour table. 22 states, each bound to a real event in
 * this application. Table-driven like a playlist: eyes / hold / blink / duration
 * are looked up by name, never branched on.
 *
 * pose fields: turn (fake yaw, deg, clamped +-25 by shapes), roll (2D rotation,
 * deg), squash (-1..1, + = wider/shorter), elong (vertical stretch factor),
 * dy (vertical offset in SVG units).
 */
(function (g) {
  'use strict';

  var Core = g.MascotCore;
  if (!Core) { console.error('mascot-states: MascotCore missing'); return; }

  var DEFS = {
    /* ---- lifecycle ---- */
    idle: {
      group: 'lifecycle', dur: [2600, 6000],
      playlist: [0, 0, 3, 0, 10, 1, 0, 3], hold: [480, 1200], blink: [1600, 3800],
      morph: 'blob', pose: { turn: 0, roll: 0, squash: 0, elong: 1, dy: 0 }
    },
    listening: {
      group: 'lifecycle', dur: [1800, 3600],
      playlist: [0, 3, 0, 1], hold: [400, 900], blink: [2400, 5000],
      morph: 'blob', pose: { turn: 4, roll: -3, squash: 0, elong: 1.02, dy: 0 }
    },
    thinking: {
      group: 'lifecycle', dur: [1600, 3200],
      playlist: [10, 0], hold: [500, 900], blink: null,
      morph: 'blob', pose: { turn: -6, roll: 6, squash: -0.05, elong: 1.04, dy: -3 },
      gaze: [-8, -6]
    },
    searching: {
      group: 'lifecycle', dur: [2000, 4000],
      playlist: [10, 3, 10], hold: [420, 760], blink: null,
      morph: 'sentinel', pose: { turn: 0, roll: 0, squash: 0, elong: 1.06, dy: -2 },
      gazeSweep: 18
    },
    working: {
      group: 'lifecycle', dur: [2200, 4400],
      playlist: [0, 4, 0], hold: [600, 1000], blink: [4000, 7000],
      morph: 'sentinel', pose: { turn: 2, roll: -2, squash: 0.04, elong: 1, dy: 0 },
      fx: 'orbit', accent: 'cyan'
    },
    drowsy: {
      group: 'lifecycle', dur: [3000, 6000],
      playlist: [9, 9, 0], hold: [1200, 2000], blink: [900, 1600],
      morph: 'cushion', pose: { turn: -3, roll: 8, squash: 0.12, elong: 0.96, dy: 5 },
      fx: 'zzz'
    },
    sleeping: {
      group: 'lifecycle', dur: null,
      playlist: [9], hold: [2000, 3200], blink: [2600, 4200],
      morph: 'cushion', pose: { turn: -4, roll: 10, squash: 0.18, elong: 0.94, dy: 7 },
      fx: 'zzz'
    },
    waking: {
      group: 'lifecycle', dur: [900, 1300],
      playlist: [9, 0], hold: [300, 500], blink: null,
      morph: 'blob', pose: { turn: 0, roll: 2, squash: -0.08, elong: 1.05, dy: -2 }
    },

    /* ---- reactions ---- */
    happy: {
      group: 'reaction', dur: [1400, 2600],
      playlist: [1, 8, 1], hold: [420, 700], blink: null,
      morph: 'blob', pose: { turn: 0, roll: -4, squash: -0.1, elong: 1.08, dy: -4 }
    },
    excited: {
      group: 'reaction', dur: [1200, 2200],
      playlist: [2, 1, 2], hold: [300, 520], blink: null,
      morph: 'blob', pose: { turn: 6, roll: -8, squash: -0.16, elong: 1.12, dy: -6 },
      fx: 'burst'
    },
    celebrate: {
      group: 'reaction', dur: [2200, 3200],
      playlist: [8, 1, 8, 2], hold: [380, 640], blink: null,
      morph: 'blob', pose: { turn: -5, roll: 12, squash: -0.14, elong: 1.1, dy: -8 },
      fx: 'burst'
    },
    proud: {
      group: 'reaction', dur: [1600, 2800],
      playlist: [1, 0], hold: [600, 950], blink: [3000, 5200],
      morph: 'sentinel', pose: { turn: 0, roll: 0, squash: -0.08, elong: 1.1, dy: -5 }
    },
    curious: {
      group: 'reaction', dur: [1400, 2600],
      playlist: [3, 0, 3], hold: [500, 850], blink: [2600, 4600],
      morph: 'blob', pose: { turn: 10, roll: -6, squash: 0, elong: 1.04, dy: -2 }
    },
    surprised: {
      group: 'reaction', dur: [900, 1500],
      playlist: [2, 3], hold: [260, 420], blink: null,
      morph: 'sentinel', pose: { turn: 0, roll: 0, squash: -0.18, elong: 1.10, dy: -7 }
    },
    suspicious: {
      group: 'reaction', dur: [1400, 2600],
      playlist: [4, 0], hold: [600, 1000], blink: [3400, 5600],
      morph: 'blob', pose: { turn: -8, roll: 5, squash: 0.1, elong: 0.96, dy: 3 }
    },

    /* ---- agent morphs ---- */
    radar: {
      group: 'agent', dur: [2400, 3600],
      playlist: [10, 0], hold: [500, 820], blink: null,
      morph: 'sentinel', pose: { turn: 0, roll: 0, squash: 0, elong: 1.08, dy: -3 },
      gazeSweep: 20, fx: 'orbit', accent: 'cyan'
    },
    progress: {
      group: 'agent', dur: [2500, 2500],
      playlist: [0], hold: [1200, 1200], blink: null,
      morph: 'sentinel', pose: { turn: 0, roll: 0, squash: 0.02, elong: 1.02, dy: 0 },
      fx: 'arc'
    },

    /* ---- product lifecycle ---- */
    spawning: {
      group: 'product', dur: [2000, 2000],
      playlist: [10, 3, 0], hold: [220, 420], blink: null,
      morph: 'blob', pose: { turn: -12, roll: -18, squash: -0.2, elong: 1.2, dy: -10 },
      fx: 'gather'
    },
    alerting: {
      group: 'product', dur: [2600, 4000], loop: true,
      playlist: [4, 2, 4], hold: [420, 700], blink: null,
      morph: 'sentinel', pose: { turn: 0, roll: -3, squash: 0.06, elong: 1.14, dy: -4 },
      fx: 'alert', accent: 'red'
    },
    notifying: {
      group: 'product', dur: [1200, 1800],
      playlist: [2, 0], hold: [320, 520], blink: null,
      morph: 'blob', pose: { turn: 8, roll: -5, squash: -0.1, elong: 1.06, dy: -3 }
    },
    dragging: {
      group: 'product', dur: null,
      playlist: [2, 0], hold: [400, 700], blink: null,
      morph: 'blob', pose: { turn: 0, roll: 0, squash: -0.06, elong: 1.15, dy: 0 }
    },
    bouncing: {
      group: 'product', dur: [700, 900],
      playlist: [2, 1], hold: [240, 380], blink: null,
      morph: 'blob', pose: { turn: 0, roll: 0, squash: 0.3, elong: 0.8, dy: 0 }
    }
  };

  /* States that get a squash impulse on entry (technique: V_T set). */
  var V_T = { happy: 1, excited: 1, proud: 1, celebrate: 1 };

  /* States allowed to wink (single-eye lid dip). */
  var WINK = { idle: 1, happy: 1, curious: 1, proud: 1 };

  var ONBOARDING = ['curious', 'happy', 'excited', 'proud', 'listening', 'celebrate', 'surprised', 'radar'];
  var ONBOARDING_MS = 1200;

  function onboardingState(n) {
    return n % 2 === 0 ? 'idle' : (ONBOARDING[(((n - 1) / 2) % ONBOARDING.length) | 0] || 'idle');
  }

  function has(name) { return Object.prototype.hasOwnProperty.call(DEFS, name); }

  function def(name) { return DEFS[name] || DEFS.idle; }

  function randomDuration(name) {
    var d = DEFS[name];
    if (!d || d.dur === null) return Infinity;
    return Core.randRange(d.dur);
  }

  /* Where to go when a state's timer expires. */
  function nextState(name) {
    var d = DEFS[name];
    if (!d) return 'idle';
    if (d.loop) return name;
    if (d.dur === null) return name;              /* held until an external change */
    if (d.group === 'lifecycle') return Math.random() < 0.7 ? 'idle' : name;
    return 'idle';
  }

  var GROUP_LABELS = {
    lifecycle: 'Lifecycle',
    reaction: 'Reactions',
    agent: 'Agent morphs',
    product: 'Product lifecycle'
  };

  var NAMES = (function () {
    var out = [];
    for (var k in DEFS) if (Object.prototype.hasOwnProperty.call(DEFS, k)) out.push(k);
    return out;
  })();

  g.MascotStates = {
    DEFS: DEFS,
    NAMES: NAMES,
    GROUP_LABELS: GROUP_LABELS,
    V_T: V_T,
    WINK: WINK,
    ONBOARDING: ONBOARDING,
    ONBOARDING_MS: ONBOARDING_MS,
    onboardingState: onboardingState,
    has: has,
    def: def,
    randomDuration: randomDuration,
    nextState: nextState
  };
})(typeof window !== 'undefined' ? window : globalThis);
