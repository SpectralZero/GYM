/* =========================================================
   IRONLOG — machine catalog + illustrations
   Every machine is drawn from a shared primitive set so the whole
   library reads as one designed collection. viewBox is 200x140.
   You can replace any illustration with a real photo of YOUR gym's
   machine from the app (camera button on the machine screen).
   ========================================================= */
(function (global) {
  'use strict';

  /* ---------- drawing primitives ---------- */
  const L = (x1, y1, x2, y2, w = 4) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke-width="${w}"/>`;
  const P = (pts, w = 4) => `<path d="M${pts.map(p => p[0] + ' ' + p[1]).join('L')}" stroke-width="${w}"/>`;
  const RC = (x, y, w, h, r = 4, sw = 3.6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" stroke-width="${sw}"/>`;
  const PAD = (x, y, w, h, r = 5, rot = 0) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="currentColor" fill-opacity=".22" stroke-width="3.4"` +
    (rot ? ` transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"` : '') + `/>`;
  const CI = (cx, cy, r, fill = false, sw = 3.6) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}"${fill ? ' fill="currentColor" stroke="none"' : ` stroke-width="${sw}"`}/>`;
  const ROLL = (cx, cy, r = 9) => CI(cx, cy, r, false, 3.4) + CI(cx, cy, 2, true);
  const FLOOR = (x1 = 18, x2 = 182, y = 128) => L(x1, y, x2, y, 5);
  const RAW = d => d;
  /* weight stack with selector pin */
  const STACK = (x, y, w = 28, h = 56) => {
    let s = RC(x, y, w, h, 4, 3.4);
    for (let i = 1; i < 5; i++) s += L(x + 3.5, y + h * i / 5, x + w - 3.5, y + h * i / 5, 2.4);
    return s + L(x + w / 2, y - 16, x + w / 2, y, 3) + CI(x + w - 1, y + h * 0.62, 3, true);
  };
  const PULLEY = (cx, cy) => CI(cx, cy, 6, false, 3.2) + CI(cx, cy, 1.7, true);
  const CABLE = pts => P(pts, 2.4);
  const PLATE = (cx, cy, r = 14) => CI(cx, cy, r, false, 5);
  /* D-handle */
  const HANDLE = (x, y, len = 16) => L(x, y - len / 2, x, y + len / 2, 5);
  /* dumbbell centred at cx,cy */
  const DB = (cx, cy, s = 1) => L(cx - 16 * s, cy, cx + 16 * s, cy, 4.5) +
    RC(cx - 26 * s, cy - 12 * s, 11 * s, 24 * s, 4, 3.4) + RC(cx + 15 * s, cy - 12 * s, 11 * s, 24 * s, 4, 3.4);
  /* loaded barbell, horizontal */
  const BB = (cx, cy, half = 74) => L(cx - half, cy, cx + half, cy, 4) +
    PLATE(cx - half + 6, cy, 18) + PLATE(cx + half - 6, cy, 18) +
    PLATE(cx - half + 22, cy, 12) + PLATE(cx + half - 22, cy, 12);

  const SVG = inner =>
    `<svg viewBox="0 0 200 140" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${inner}</svg>`;

  /* ---------- the illustrations ---------- */
  const ART = {

    /* --- selectorized pressing --- */
    pressMachine: () => SVG(FLOOR() + L(150, 128, 150, 36) + STACK(136, 58) + L(150, 36, 104, 36) +
      PAD(74, 98, 52, 11) + L(100, 109, 100, 128, 5) + PAD(116, 50, 12, 50, 5, 6) +
      P([[112, 62], [62, 62]]) + HANDLE(60, 62, 20) + P([[112, 78], [72, 78]]) + HANDLE(70, 78, 18) + CI(112, 70, 4, true)),

    inclinePress: () => SVG(FLOOR() + L(152, 128, 152, 40) + STACK(138, 60) + PAD(70, 100, 50, 11) +
      L(96, 111, 96, 128, 5) + PAD(112, 46, 12, 56, 6, 18) + P([[112, 60], [68, 44]]) + HANDLE(64, 42, 20) +
      P([[114, 74], [76, 60]]) + CI(114, 68, 4, true)),

    shoulderPressMachine: () => SVG(FLOOR() + L(148, 128, 148, 44) + STACK(134, 62) + PAD(72, 98, 50, 11) +
      L(98, 109, 98, 128, 5) + PAD(116, 48, 12, 50, 5) + P([[112, 56], [96, 30]]) + L(80, 30, 112, 30, 5) +
      P([[112, 62], [128, 34]]) + L(120, 26, 120, 40, 4.5) + CI(112, 58, 4, true)),

    pecDeck: () => SVG(FLOOR() + L(100, 128, 100, 96, 5) + PAD(74, 90, 52, 12) + RC(84, 40, 32, 50, 7) +
      L(100, 40, 100, 26, 4) + L(66, 26, 134, 26, 4) +
      P([[84, 54], [50, 54]]) + PAD(36, 40, 13, 28, 5) + P([[116, 54], [150, 54]]) + PAD(151, 40, 13, 28, 5)),

    reversePecDeck: () => SVG(FLOOR() + L(100, 128, 100, 96, 5) + PAD(74, 90, 52, 12) + RC(86, 36, 28, 44, 7) +
      L(100, 36, 100, 24, 4) + P([[96, 44], [56, 62]]) + HANDLE(52, 64, 22) +
      P([[104, 44], [144, 62]]) + HANDLE(148, 64, 22) + CI(100, 42, 4, true)),

    /* --- pulling --- */
    latPulldown: () => SVG(FLOOR() + L(158, 128, 158, 26, 5) + L(158, 26, 68, 26, 4) + PULLEY(68, 33) +
      CABLE([[68, 39], [68, 54]]) + L(38, 58, 98, 58, 5) + L(38, 49, 38, 67, 4) + L(98, 49, 98, 67, 4) +
      STACK(144, 62) + PAD(78, 100, 46, 11) + L(100, 111, 100, 128, 5) + PAD(60, 80, 46, 10) + L(64, 90, 64, 116, 4)),

    seatedRow: () => SVG(FLOOR() + L(30, 128, 30, 106, 5) + PAD(18, 96, 15, 28, 4, -14) + PULLEY(46, 112) +
      CABLE([[46, 106], [46, 86], [72, 82]]) + HANDLE(74, 82, 20) +
      PAD(98, 96, 46, 11) + L(120, 107, 120, 128, 5) + PAD(84, 62, 11, 32, 5) + L(90, 94, 90, 70, 4) + STACK(156, 62)),

    tBarRow: () => SVG(FLOOR() + RC(38, 114, 124, 14, 4, 4) + CI(50, 114, 5, true) + P([[50, 114], [148, 52]], 5) +
      PLATE(156, 47, 15) + PLATE(146, 53, 11) + P([[120, 68], [132, 82]]) + L(126, 88, 138, 76, 4.5)),

    chestSupportedRow: () => SVG(FLOOR() + RC(48, 110, 104, 18, 4, 4) + PAD(80, 50, 26, 58, 7, -22) +
      PAD(52, 94, 28, 11) + P([[112, 66], [130, 66]]) + HANDLE(132, 66, 20) + PLATE(150, 96, 14) + L(112, 78, 128, 78, 4)),

    assistedPullup: () => SVG(FLOOR() + L(34, 128, 34, 26, 5) + L(164, 128, 164, 26, 5) + L(34, 26, 164, 26, 4) +
      L(68, 34, 130, 34, 5) + P([[68, 34], [56, 46]]) + P([[130, 34], [142, 46]]) +
      PAD(74, 86, 46, 12) + L(97, 98, 97, 128, 5) + STACK(140, 58)),

    straightArm: () => SVG(FLOOR() + L(52, 128, 52, 24, 5) + RC(40, 26, 24, 102, 5) + PULLEY(74, 38) +
      CABLE([[74, 44], [74, 62], [104, 66]]) + L(104, 58, 104, 74, 5) + L(104, 66, 132, 66, 4) + L(132, 58, 132, 74, 5)),

    /* --- cables --- */
    cableTower: () => SVG(FLOOR() + L(56, 128, 56, 22, 5) + RC(44, 24, 24, 104, 5) + PULLEY(78, 36) +
      CABLE([[78, 42], [78, 74], [106, 80]]) + HANDLE(108, 80, 20) + CI(120, 80, 6) +
      L(150, 128, 150, 60, 4) + PLATE(150, 52, 13)),

    cableCrossover: () => SVG(FLOOR() + L(30, 128, 30, 24, 5) + L(170, 128, 170, 24, 5) + PULLEY(38, 32) + PULLEY(162, 32) +
      CABLE([[38, 38], [38, 56], [76, 70]]) + CABLE([[162, 38], [162, 56], [124, 70]]) +
      HANDLE(76, 70, 18) + HANDLE(124, 70, 18) + L(84, 116, 116, 116, 4)),

    pushdown: () => SVG(FLOOR() + L(60, 128, 60, 22, 5) + RC(48, 24, 24, 104, 5) + PULLEY(82, 34) +
      CABLE([[82, 40], [82, 62]]) + L(70, 66, 118, 66, 5) + L(70, 58, 70, 74, 4) + L(118, 58, 118, 74, 4) +
      L(146, 128, 146, 64, 4) + PLATE(146, 56, 13)),

    /* --- legs --- */
    legPress: () => SVG(FLOOR() + P([[26, 118], [148, 40]], 5) + P([[38, 128], [158, 50]], 5) +
      PAD(118, 40, 40, 26, 5, -32) + PLATE(132, 86, 15) + PLATE(150, 74, 15) +
      PAD(28, 100, 44, 12) + PAD(18, 64, 12, 40, 5, 16) + L(50, 112, 50, 128, 4)),

    hackSquat: () => SVG(FLOOR() + P([[52, 124], [148, 34]], 5) + P([[64, 128], [160, 38]], 5) +
      PAD(94, 50, 22, 58, 6, -42) + L(122, 50, 146, 50, 5) + PAD(122, 44, 26, 10, 5, -42) +
      PAD(32, 110, 54, 12, 4) + PLATE(154, 74, 13)),

    legExtension: () => SVG(FLOOR() + L(150, 128, 150, 50, 5) + STACK(136, 58) + PAD(90, 94, 50, 11) +
      L(114, 105, 114, 128, 5) + PAD(134, 46, 12, 48, 5) + P([[90, 100], [62, 80]]) + ROLL(56, 76) + ROLL(74, 98, 7)),

    legCurlSeated: () => SVG(FLOOR() + L(46, 128, 46, 52, 5) + STACK(32, 60) + PAD(58, 94, 50, 11) +
      L(82, 105, 82, 128, 5) + PAD(54, 46, 12, 48, 5) + PAD(94, 76, 34, 10) +
      P([[112, 100], [144, 110]]) + ROLL(150, 112)),

    legCurlLying: () => SVG(FLOOR() + PAD(38, 78, 98, 15, 7) + L(52, 93, 52, 128, 5) + L(122, 93, 122, 128, 5) +
      PAD(24, 72, 16, 11, 4) + P([[136, 86], [158, 68]]) + ROLL(163, 64) + PLATE(146, 108, 13)),

    abductor: () => SVG(FLOOR() + L(100, 128, 100, 98, 5) + PAD(74, 92, 52, 12) + RC(84, 44, 32, 48, 7) +
      P([[76, 102], [58, 102]]) + PAD(44, 92, 14, 30, 5) + P([[124, 102], [142, 102]]) + PAD(142, 92, 14, 30, 5)),

    adductor: () => SVG(FLOOR() + L(100, 128, 100, 98, 5) + PAD(74, 92, 52, 12) + RC(84, 44, 32, 48, 7) +
      P([[62, 102], [76, 102]]) + PAD(62, 92, 14, 30, 5) + P([[138, 102], [124, 102]]) + PAD(124, 92, 14, 30, 5) +
      L(46, 84, 58, 84, 3) + L(154, 84, 142, 84, 3)),

    gluteKickback: () => SVG(FLOOR() + RC(32, 108, 102, 20, 4, 4) + PAD(44, 88, 36, 12) +
      PAD(32, 52, 14, 36, 5) + L(39, 88, 39, 60, 4) + P([[112, 100], [148, 84]]) + PAD(148, 74, 14, 22, 5) + PLATE(120, 68, 12)),

    hipThrustMachine: () => SVG(FLOOR() + PAD(28, 90, 74, 15, 7) + L(42, 105, 42, 128, 5) + L(90, 105, 90, 128, 5) +
      PAD(106, 78, 28, 13, 6) + L(120, 70, 120, 78, 4) + L(104, 62, 172, 62, 4) + PLATE(174, 62, 15) + L(152, 128, 152, 76, 4)),

    smithMachine: () => SVG(FLOOR() + L(46, 128, 46, 22, 5) + L(154, 128, 154, 22, 5) + L(46, 22, 154, 22, 4) +
      L(34, 70, 166, 70, 4) + PLATE(32, 70, 14) + PLATE(168, 70, 14) +
      PAD(70, 96, 60, 12, 6) + L(80, 108, 80, 128, 4) + L(120, 108, 120, 128, 4) + CI(46, 70, 4, true) + CI(154, 70, 4, true)),

    powerRack: () => SVG(FLOOR() + L(44, 128, 44, 24, 5) + L(156, 128, 156, 24, 5) + L(44, 24, 156, 24, 4) +
      L(44, 62, 58, 62, 4) + L(142, 62, 156, 62, 4) + L(30, 56, 170, 56, 4) + PLATE(28, 56, 16) + PLATE(172, 56, 16) +
      L(44, 92, 58, 92, 3) + L(142, 92, 156, 92, 3)),

    calfSeated: () => SVG(FLOOR() + PAD(94, 96, 50, 11) + L(118, 107, 118, 128, 5) + PAD(138, 50, 12, 48, 5) +
      PAD(62, 74, 36, 11) + L(68, 85, 68, 100, 4) + PAD(36, 110, 26, 13, 4, -14) + PLATE(150, 84, 13) + L(150, 128, 150, 96, 4)),

    calfStanding: () => SVG(FLOOR() + L(150, 128, 150, 42, 5) + STACK(136, 50) + PAD(82, 44, 46, 12) +
      L(105, 56, 105, 106, 4) + PAD(72, 106, 56, 14, 4) + L(88, 120, 88, 128, 3) + L(120, 120, 120, 128, 3)),

    /* --- arms --- */
    preacherCurl: () => SVG(FLOOR() + PAD(36, 96, 46, 12) + L(58, 108, 58, 128, 5) + PAD(88, 56, 22, 50, 6, -26) +
      RAW(`<path d="M108 50c6 6 12 8 18 8s12-2 18-8" stroke-width="4"/>`) + PLATE(150, 46, 12) + L(104, 104, 104, 128, 5)),

    curlMachine: () => SVG(FLOOR() + L(44, 128, 44, 58, 5) + STACK(30, 66) + PAD(64, 96, 46, 12) +
      L(88, 108, 88, 128, 5) + PAD(58, 50, 12, 46, 5) + PAD(108, 62, 36, 12, 6, -16) + HANDLE(150, 64, 20) + CI(150, 64, 4, true)),

    tricepsMachine: () => SVG(FLOOR() + L(156, 128, 156, 54, 5) + STACK(142, 62) + PAD(84, 98, 48, 11) +
      L(108, 109, 108, 128, 5) + PAD(128, 52, 12, 48, 5) + P([[124, 64], [80, 64]]) + P([[80, 64], [74, 84]]) +
      CI(72, 88, 6) + CI(124, 64, 4, true)),

    dipStation: () => SVG(FLOOR() + L(52, 128, 52, 76, 5) + L(148, 128, 148, 76, 5) + L(36, 76, 88, 76, 5) +
      L(112, 76, 164, 76, 5) + L(44, 128, 156, 128, 5) + L(52, 100, 148, 100, 3)),

    /* --- free weights --- */
    barbellFloor: () => SVG(FLOOR() + BB(100, 96, 76)),
    dumbbellPair: () => SVG(FLOOR() + DB(64, 74, .95) + DB(140, 90, .95)),
    dumbbellSingle: () => SVG(FLOOR() + DB(100, 76, 1.3)),
    benchFlat: () => SVG(FLOOR() + PAD(44, 88, 108, 14, 7) + L(58, 102, 58, 128, 5) + L(138, 102, 138, 128, 5) +
      L(56, 88, 56, 60, 4) + L(76, 88, 76, 60, 4) + L(34, 56, 166, 56, 4) + PLATE(32, 56, 15) + PLATE(168, 56, 15)),
    benchIncline: () => SVG(FLOOR() + PAD(60, 62, 84, 14, 7, -25) + PAD(42, 96, 34, 12, 6) + L(58, 108, 58, 128, 5) +
      L(134, 88, 134, 128, 5) + DB(150, 46, .7) + DB(50, 58, .7)),
    pullupBar: () => SVG(FLOOR() + L(40, 128, 40, 30, 5) + L(160, 128, 160, 30, 5) + L(40, 30, 160, 30, 4) +
      L(68, 30, 68, 46, 4.5) + L(132, 30, 132, 46, 4.5) + L(30, 128, 50, 128, 5) + L(150, 128, 170, 128, 5)),
    kettlebell: () => SVG(FLOOR() + RAW(`<path d="M84 66a16 16 0 0 1 32 0" stroke-width="5"/>`) +
      RAW(`<path d="M100 66c-20 0-30 12-30 26s14 24 30 24 30-10 30-24-10-26-30-26z" stroke-width="4.5" fill="currentColor" fill-opacity=".2"/>`)),

    /* --- core --- */
    abCrunchMachine: () => SVG(FLOOR() + L(150, 128, 150, 44, 5) + STACK(136, 52) + PAD(84, 98, 50, 11) +
      L(108, 109, 108, 128, 5) + PAD(130, 56, 12, 44, 5) + P([[130, 58], [96, 46]]) + PAD(74, 40, 22, 12, 5, -14) + CI(96, 56, 5)),
    romanChair: () => SVG(FLOOR() + L(60, 128, 60, 42, 5) + L(140, 128, 140, 42, 5) + L(60, 42, 140, 42, 4) +
      PAD(88, 50, 24, 42, 6) + PAD(60, 66, 26, 12, 5) + PAD(114, 66, 26, 12, 5) + L(66, 56, 66, 66, 4) + L(134, 56, 134, 66, 4)),
    hyperextension: () => SVG(FLOOR() + RC(40, 112, 108, 16, 4, 4) + PAD(74, 52, 26, 46, 7, -38) +
      PAD(94, 76, 24, 12, 6, -38) + ROLL(56, 98, 8) + ROLL(56, 116, 8) + L(120, 60, 132, 48, 4)),
    torsoRotation: () => SVG(FLOOR() + L(56, 128, 56, 52, 5) + STACK(42, 60) + PAD(78, 96, 48, 12) +
      L(102, 108, 102, 128, 5) + PAD(118, 54, 12, 36, 5) + PAD(86, 54, 12, 36, 5) +
      RAW(`<path d="M84 48a34 34 0 0 1 48 0" stroke-width="3"/>`)),
    plank: () => SVG(FLOOR() + CI(38, 78, 11) + P([[50, 84], [110, 92], [148, 116]], 5) + L(58, 90, 58, 122, 4) + L(96, 92, 96, 122, 4)),

    /* --- cardio --- */
    treadmill: () => SVG(FLOOR() + P([[30, 116], [150, 96]], 5) + P([[34, 128], [154, 108]], 5) + ROLL(30, 122, 7) + ROLL(154, 102, 7) +
      L(140, 100, 152, 44, 5) + RC(126, 26, 54, 22, 5) + L(132, 56, 172, 56, 4)),
    stationaryBike: () => SVG(FLOOR() + CI(58, 100, 24) + CI(146, 104, 18) + P([[58, 100], [96, 60], [130, 60]], 4) +
      L(96, 60, 108, 44, 4) + PAD(96, 34, 30, 11, 5) + L(130, 60, 146, 104, 4) + CI(104, 96, 9) + L(104, 96, 112, 108, 3.4)),
    elliptical: () => SVG(FLOOR() + CI(150, 88, 22) + P([[128, 86], [40, 112]], 5) + P([[130, 96], [46, 122]], 5) +
      L(150, 88, 150, 40, 5) + P([[150, 48], [116, 34]], 4) + P([[150, 48], [184, 34]], 4) + ROLL(44, 116, 7)),
    stairMaster: () => SVG(FLOOR() + P([[36, 124], [36, 108], [64, 108], [64, 92], [92, 92], [92, 76], [120, 76], [120, 60], [148, 60]], 5) +
      L(148, 60, 148, 28, 5) + L(120, 28, 168, 28, 4) + L(36, 124, 148, 124, 4)),
    rowErg: () => SVG(FLOOR() + P([[40, 108], [160, 108]], 5) + CI(48, 88, 20) + PAD(96, 96, 34, 11) +
      L(160, 108, 160, 122, 4) + L(40, 108, 40, 122, 4) + CABLE([[64, 84], [126, 84]]) + L(126, 74, 126, 94, 5)),

    generic: () => SVG(FLOOR() + RC(52, 46, 96, 74, 8) + L(52, 82, 148, 82, 3.4) + L(100, 46, 100, 26, 4) + CI(100, 22, 6))
  };

  /* ---------- muscle groups ---------- */
  const GROUPS = [
    { id: 'chest', name: 'Chest' },
    { id: 'back', name: 'Back' },
    { id: 'shoulders', name: 'Shoulders' },
    { id: 'arms', name: 'Arms' },
    { id: 'legs', name: 'Legs' },
    { id: 'glutes', name: 'Glutes' },
    { id: 'calves', name: 'Calves' },
    { id: 'core', name: 'Core' },
    { id: 'cardio', name: 'Cardio' }
  ];

  /* ---------- catalog ----------
     equip:  machine | cable | barbell | dumbbell | bodyweight | cardio
     metric: weight (default) | reps | time | cardio
     step:   default weight increment for the +/- buttons
  ------------------------------------------------------------------ */
  const D = (id, name, group, art, equip, opts) => Object.assign({
    id, name, group, art, equip,
    metric: 'weight',
    step: equip === 'dumbbell' ? 2 : equip === 'barbell' ? 2.5 : 2.5,
    unilateral: false
  }, opts || {});

  const EXERCISES = [
    /* ---- CHEST ---- */
    D('chest-press-machine', 'Chest Press Machine', 'chest', 'pressMachine', 'machine', { tip: 'Elbows ~45°, press without locking hard.' }),
    D('incline-press-machine', 'Incline Chest Press', 'chest', 'inclinePress', 'machine', { tip: 'Upper chest. Push up and slightly in.' }),
    D('pec-deck', 'Pec Deck / Butterfly', 'chest', 'pecDeck', 'machine', { tip: 'Squeeze 1s at the middle.' }),
    D('cable-crossover', 'Cable Crossover', 'chest', 'cableCrossover', 'cable', { tip: 'Per-side weight. Cross hands slightly.' }),
    D('bench-press', 'Barbell Bench Press', 'chest', 'benchFlat', 'barbell', { tip: 'Bar weight included in the number you log.' }),
    D('incline-db-press', 'Incline Dumbbell Press', 'chest', 'benchIncline', 'dumbbell', { tip: 'Log the weight of ONE dumbbell.' }),
    D('db-fly', 'Dumbbell Fly', 'chest', 'dumbbellPair', 'dumbbell', { tip: 'Slight elbow bend, wide arc.' }),
    D('smith-bench', 'Smith Machine Bench', 'chest', 'smithMachine', 'machine', { tip: 'Fixed path — good for pushing heavy safely.' }),
    D('dips-chest', 'Chest Dips', 'chest', 'dipStation', 'bodyweight', { metric: 'reps', tip: 'Lean forward for chest.' }),
    D('push-up', 'Push-Up', 'chest', 'plank', 'bodyweight', { metric: 'reps' }),

    /* ---- BACK ---- */
    D('lat-pulldown', 'Lat Pulldown', 'back', 'latPulldown', 'machine', { tip: 'Pull to collarbone, chest up.' }),
    D('lat-pulldown-close', 'Close-Grip Pulldown', 'back', 'latPulldown', 'machine', { tip: 'Neutral grip, more lower lat.' }),
    D('seated-cable-row', 'Seated Cable Row', 'back', 'seatedRow', 'cable', { tip: 'Drive elbows back, no torso swing.' }),
    D('t-bar-row', 'T-Bar Row', 'back', 'tBarRow', 'barbell', { tip: 'Count plates only, or total — stay consistent.' }),
    D('chest-supported-row', 'Chest-Supported Row', 'back', 'chestSupportedRow', 'machine', { tip: 'Strict — the pad removes cheating.' }),
    D('barbell-row', 'Barbell Row', 'back', 'barbellFloor', 'barbell', { tip: 'Torso ~45°, pull to belly.' }),
    D('deadlift', 'Deadlift', 'back', 'barbellFloor', 'barbell', { step: 5, tip: 'Log total bar weight.' }),
    D('straight-arm-pulldown', 'Straight-Arm Pulldown', 'back', 'straightArm', 'cable', { tip: 'Lats only, arms locked.' }),
    D('assisted-pullup', 'Assisted Pull-Up', 'back', 'assistedPullup', 'machine', { tip: 'Number = ASSIST weight. Lower assist = stronger!', inverse: true }),
    D('pull-up', 'Pull-Up', 'back', 'pullupBar', 'bodyweight', { metric: 'reps', tip: 'Add weight in the notes if you use a belt.' }),
    D('shrug-barbell', 'Barbell Shrug', 'back', 'barbellFloor', 'barbell', { tip: 'Straight up, pause at top.' }),
    D('shrug-db', 'Dumbbell Shrug', 'back', 'dumbbellPair', 'dumbbell'),

    /* ---- SHOULDERS ---- */
    D('shoulder-press-machine', 'Shoulder Press Machine', 'shoulders', 'shoulderPressMachine', 'machine'),
    D('db-shoulder-press', 'Dumbbell Shoulder Press', 'shoulders', 'dumbbellPair', 'dumbbell', { tip: 'Log ONE dumbbell.' }),
    D('overhead-press', 'Barbell Overhead Press', 'shoulders', 'powerRack', 'barbell'),
    D('lateral-raise-db', 'Dumbbell Lateral Raise', 'shoulders', 'dumbbellPair', 'dumbbell', { step: 1, tip: 'Light weight, no swinging.' }),
    D('lateral-raise-cable', 'Cable Lateral Raise', 'shoulders', 'cableTower', 'cable', { unilateral: true, step: 1.25 }),
    D('rear-delt-machine', 'Rear Delt Machine', 'shoulders', 'reversePecDeck', 'machine', { tip: 'Thumbs out, squeeze back.' }),
    D('face-pull', 'Face Pull', 'shoulders', 'cableTower', 'cable', { tip: 'Rope to forehead, elbows high.' }),
    D('front-raise', 'Front Raise', 'shoulders', 'dumbbellPair', 'dumbbell', { step: 1 }),
    D('upright-row', 'Upright Row', 'shoulders', 'barbellFloor', 'barbell'),

    /* ---- ARMS ---- */
    D('biceps-curl-machine', 'Biceps Curl Machine', 'arms', 'curlMachine', 'machine'),
    D('preacher-curl', 'Preacher Curl', 'arms', 'preacherCurl', 'barbell'),
    D('db-curl', 'Dumbbell Curl', 'arms', 'dumbbellSingle', 'dumbbell', { tip: 'Log ONE dumbbell.' }),
    D('hammer-curl', 'Hammer Curl', 'arms', 'dumbbellPair', 'dumbbell'),
    D('cable-curl', 'Cable Curl', 'arms', 'cableTower', 'cable'),
    D('barbell-curl', 'Barbell Curl', 'arms', 'barbellFloor', 'barbell'),
    D('triceps-pushdown', 'Triceps Pushdown', 'arms', 'pushdown', 'cable', { tip: 'Elbows pinned to sides.' }),
    D('triceps-machine', 'Triceps Extension Machine', 'arms', 'tricepsMachine', 'machine'),
    D('overhead-triceps-cable', 'Overhead Cable Extension', 'arms', 'cableTower', 'cable'),
    D('skullcrusher', 'Skullcrusher', 'arms', 'benchFlat', 'barbell'),
    D('dip-machine', 'Dip Machine', 'arms', 'tricepsMachine', 'machine'),
    D('dips-triceps', 'Triceps Dips', 'arms', 'dipStation', 'bodyweight', { metric: 'reps', tip: 'Stay upright for triceps.' }),

    /* ---- LEGS ---- */
    D('leg-press', 'Leg Press', 'legs', 'legPress', 'machine', { step: 5, tip: 'Feet shoulder width, no knee collapse.' }),
    D('hack-squat', 'Hack Squat', 'legs', 'hackSquat', 'machine', { step: 5 }),
    D('squat', 'Barbell Squat', 'legs', 'powerRack', 'barbell', { step: 5, tip: 'Log total bar weight.' }),
    D('smith-squat', 'Smith Machine Squat', 'legs', 'smithMachine', 'machine', { step: 5 }),
    D('leg-extension', 'Leg Extension', 'legs', 'legExtension', 'machine', { tip: 'Pause at the top, quads locked.' }),
    D('leg-curl-seated', 'Seated Leg Curl', 'legs', 'legCurlSeated', 'machine'),
    D('leg-curl-lying', 'Lying Leg Curl', 'legs', 'legCurlLying', 'machine'),
    D('romanian-deadlift', 'Romanian Deadlift', 'legs', 'barbellFloor', 'barbell', { step: 5, tip: 'Hamstring stretch, back flat.' }),
    D('bulgarian-split', 'Bulgarian Split Squat', 'legs', 'dumbbellPair', 'dumbbell', { unilateral: true }),
    D('goblet-squat', 'Goblet Squat', 'legs', 'kettlebell', 'dumbbell'),
    D('walking-lunge', 'Walking Lunge', 'legs', 'dumbbellPair', 'dumbbell'),

    /* ---- GLUTES ---- */
    D('hip-thrust-machine', 'Hip Thrust Machine', 'glutes', 'hipThrustMachine', 'machine', { step: 5 }),
    D('hip-abduction', 'Hip Abduction (Outer)', 'glutes', 'abductor', 'machine', { tip: 'Push knees out, lean forward slightly.' }),
    D('hip-adduction', 'Hip Adduction (Inner)', 'glutes', 'adductor', 'machine'),
    D('glute-kickback', 'Glute Kickback Machine', 'glutes', 'gluteKickback', 'machine', { unilateral: true }),
    D('cable-kickback', 'Cable Kickback', 'glutes', 'cableTower', 'cable', { unilateral: true }),
    D('back-extension', 'Back Extension', 'glutes', 'hyperextension', 'bodyweight', { metric: 'reps' }),

    /* ---- CALVES ---- */
    D('calf-seated', 'Seated Calf Raise', 'calves', 'calfSeated', 'machine'),
    D('calf-standing', 'Standing Calf Raise', 'calves', 'calfStanding', 'machine', { step: 5 }),
    D('calf-leg-press', 'Calf Press on Leg Press', 'calves', 'legPress', 'machine', { step: 5 }),

    /* ---- CORE ---- */
    D('ab-crunch-machine', 'Ab Crunch Machine', 'core', 'abCrunchMachine', 'machine'),
    D('cable-crunch', 'Cable Crunch', 'core', 'cableTower', 'cable'),
    D('torso-rotation', 'Torso Rotation Machine', 'core', 'torsoRotation', 'machine'),
    D('hanging-leg-raise', 'Hanging Leg Raise', 'core', 'pullupBar', 'bodyweight', { metric: 'reps' }),
    D('captains-chair', "Captain's Chair Leg Raise", 'core', 'romanChair', 'bodyweight', { metric: 'reps' }),
    D('plank', 'Plank', 'core', 'plank', 'bodyweight', { metric: 'time', tip: 'Logged in seconds.' }),

    /* ---- CARDIO ---- */
    D('treadmill', 'Treadmill', 'cardio', 'treadmill', 'cardio', { metric: 'cardio' }),
    D('bike', 'Stationary Bike', 'cardio', 'stationaryBike', 'cardio', { metric: 'cardio' }),
    D('elliptical', 'Elliptical', 'cardio', 'elliptical', 'cardio', { metric: 'cardio' }),
    D('stairmaster', 'Stair Climber', 'cardio', 'stairMaster', 'cardio', { metric: 'cardio' }),
    D('rower', 'Rowing Machine', 'cardio', 'rowErg', 'cardio', { metric: 'cardio' })
  ];

  const artFor = key => (ART[key] || ART.generic)();

  global.Machines = { ART, GROUPS, EXERCISES, artFor, ART_KEYS: Object.keys(ART) };
})(window);
