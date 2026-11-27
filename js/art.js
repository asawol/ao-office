/* ─────────────────────────────────────────────
   art.js — 비서실 도면과 피클 캐릭터
   톤: 현대 오피스 (글래스 파티션 · 엔지니어드 우드 · 카펫 타일)
   ───────────────────────────────────────────── */
(function (global) {
  'use strict';

  var WORLD = { w: 1200, h: 780 };
  var R = 30;

  /* ── 팔레트 ─────────────────────────────── */

  var P = {
    wall:       '#262C35',
    wallFace:   '#39424E',
    wallDark:   '#171C23',
    concrete:   '#D8DCE0',
    corridor:   '#E2E5E9',
    woodA:      '#C39C74',
    woodB:      '#BA926A',
    woodSeam:   'rgba(110, 79, 51, .26)',
    carpetA:    '#CDD1D7',
    carpetB:    '#C5CAD1',
    carpetSeam: 'rgba(106, 116, 128, .28)',
    quietA:     '#B9BEC6',
    quietB:     '#B2B8C0',
    terrazzo:   '#DBD7D2',
    ink:        '#1F252D',
    ink2:       '#3E4854',
    muted:      '#77818D',
    line:       'rgba(84, 96, 110, .20)',
    metal:      '#2C343E',
    metalHi:    '#4B5563',
    glass:      'rgba(199, 220, 231, .42)',
    glassHi:    'rgba(255, 255, 255, .55)',
    oak:        '#B38457',
    oakLight:   '#C99C6D',
    white:      '#F2F2F0',
    steel:      '#9BA4AE',
    shadow:     'rgba(20, 26, 34, .13)'
  };

  var FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';

  /* ── 색 도구 ─────────────────────────────── */

  function rgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function toHex(c) {
    return '#' + c.map(function (v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length < 2 ? '0' + s : s;
    }).join('');
  }
  function mix(a, b, amt) {
    var A = rgb(a), B = rgb(b);
    return toHex([0, 1, 2].map(function (i) { return A[i] + (B[i] - A[i]) * amt; }));
  }
  function lighten(c, amt) { return mix(c, '#ffffff', amt); }
  function darken(c, amt) { return mix(c, '#101519', amt); }
  function alpha(hex, a) {
    var c = rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function rr(ctx, x, y, w, h, r) {
    var rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function shadow(ctx, color, blur, ox, oy) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = ox || 0;
    ctx.shadowOffsetY = oy || 0;
  }
  function noShadow(ctx) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  /* ── 방 배치 · 장애물 ─────────────────────── */

  var ROOMS = {
    work:    { x: 48,  y: 100, w: 540, h: 230 },
    meeting: { x: 612, y: 100, w: 540, h: 230 },
    pantry:  { x: 48,  y: 420, w: 540, h: 324 },
    focus:   { x: 612, y: 420, w: 540, h: 324 }
  };

  var ZONES = [
    { id: 'work',    label: '워크스테이션',      x: ROOMS.work.x,    y: ROOMS.work.y,    w: ROOMS.work.w,    h: ROOMS.work.h,    dot: '#3E6E92' },
    { id: 'meeting', label: '유리 회의실',        x: ROOMS.meeting.x, y: ROOMS.meeting.y, w: ROOMS.meeting.w, h: ROOMS.meeting.h, dot: '#5C6373' },
    { id: 'cafe',    label: '탕비실 · 라운지',   x: ROOMS.pantry.x,  y: ROOMS.pantry.y,  w: ROOMS.pantry.w,  h: ROOMS.pantry.h,  dot: '#8A6A47' },
    { id: 'focus',   label: '포커스 팟',          x: ROOMS.focus.x,   y: ROOMS.focus.y,   w: ROOMS.focus.w,   h: ROOMS.focus.h,   dot: '#42786B' }
  ];

  var OBSTACLES = [];
  function addRect(x, y, w, h, tag) { OBSTACLES.push({ type: 'rect', x: x, y: y, w: w, h: h, tag: tag || '' }); }
  function addCircle(x, y, r, tag) { OBSTACLES.push({ type: 'circle', x: x, y: y, r: r, tag: tag || '' }); }

  /* 워크스테이션: 3열 벤치 데스크 */
  var DESKS = [
    { x: 80,  y: 148, w: 152, h: 54, cx: 156, cy: 236, mug: '#9E6258', lamp: false, tray: true,  plant: false },
    { x: 248, y: 148, w: 152, h: 54, cx: 324, cy: 236, mug: '#5C7188', lamp: true,  tray: false, plant: true  },
    { x: 416, y: 148, w: 152, h: 54, cx: 492, cy: 236, mug: '#67735F', lamp: true,  tray: false, plant: false }
  ];
  DESKS.forEach(function (d) {
    addRect(d.x, d.y, d.w, d.h, 'desk');
    addCircle(d.cx, d.cy, 16, 'chair');
  });

  /* 회의실 테이블 */
  var TABLE = { x: 792, y: 178, w: 300, h: 88 };
  addRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h, 'table');
  var CONF_CHAIRS = [
    [836, 156], [942, 156], [1048, 156],
    [836, 288], [942, 288], [1048, 288],
    [766, 222], [1118, 222]
  ];
  CONF_CHAIRS.forEach(function (c) { addCircle(c[0], c[1], 15, 'chair'); });

  /* 탕비실 · 라운지 */
  var COUNTER = { x: 64, y: 458, w: 236, h: 62 };
  addRect(COUNTER.x, COUNTER.y, COUNTER.w, COUNTER.h, 'counter');
  addRect(316, 456, 32, 44, 'dispenser');
  addRect(470, 452, 86, 76, 'fridge');
  addRect(358, 570, 124, 68, 'coffee-table');
  addRect(356, 648, 200, 60, 'sofa');
  addCircle(112, 552, 14, 'stool');
  addCircle(192, 552, 14, 'stool');
  addCircle(376, 472, 14, 'plant');
  addCircle(70, 706, 12, 'plant');
  addCircle(566, 700, 12, 'plant');

  /* 워크스테이션 좌측 낮은 수납장 */
  addRect(22, 132, 24, 176, 'credenza');
  /* 워크스테이션 우측 보조 테이블 */
  addRect(470, 282, 86, 34, 'side-table');
  /* 회의실 사이드보드 */
  addRect(660, 296, 104, 24, 'sideboard');
  addCircle(644, 302, 12, 'plant');
  addCircle(1136, 300, 12, 'plant');

  /* 포커스 팟 */
  var PODS = [
    { x: 636, y: 456, w: 154, h: 108, tag: 'FOCUS 01' },
    { x: 812, y: 456, w: 154, h: 108, tag: 'FOCUS 02' },
    { x: 988, y: 456, w: 154, h: 108, tag: 'FOCUS 03' }
  ];
  PODS.forEach(function (p) { addRect(p.x, p.y, p.w, p.h, 'pod'); });
  addRect(824, 580, 168, 36, 'bench');
  addRect(636, 676, 124, 46, 'printer');
  addCircle(790, 710, 13, 'plant');
  addCircle(1080, 704, 12, 'plant');

  /* ── 바닥 ───────────────────────────────── */

  function woodFloor(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    var plank = 34;
    for (var py = y, i = 0; py < y + h; py += plank, i++) {
      ctx.fillStyle = i % 2 ? P.woodB : P.woodA;
      ctx.fillRect(x, py, w, plank);
      // 이음선
      ctx.fillStyle = P.woodSeam;
      ctx.fillRect(x, py + plank - 1, w, 1);
      // 결
      ctx.fillStyle = 'rgba(255, 246, 232, .07)';
      for (var g = 0; g < 3; g++) {
        ctx.fillRect(x + ((i * 53 + g * 71) % 180), py + 8 + g * 9, 96, 1);
      }
      // 마구리
      var off = (i * 137) % 240;
      for (var px = x - off; px < x + w; px += 240) {
        ctx.fillStyle = 'rgba(104, 74, 47, .18)';
        ctx.fillRect(px, py, 1.2, plank);
      }
    }

    // 위에서 드는 빛
    var lg = ctx.createLinearGradient(0, y, 0, y + h);
    lg.addColorStop(0, 'rgba(255, 250, 240, .20)');
    lg.addColorStop(0.55, 'rgba(255, 250, 240, .04)');
    lg.addColorStop(1, 'rgba(44, 32, 20, .07)');
    ctx.fillStyle = lg;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function carpetFloor(ctx, x, y, w, h, base, alt, tile) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);
    // 타일 체크
    ctx.fillStyle = alt;
    for (var ty = 0; ty < Math.ceil(h / tile); ty++) {
      for (var tx = 0; tx < Math.ceil(w / tile); tx++) {
        if ((tx + ty) % 2) ctx.fillRect(x + tx * tile, y + ty * tile, tile, tile);
      }
    }
    // 타일 줄눈
    ctx.strokeStyle = P.carpetSeam;
    ctx.lineWidth = 1;
    for (var gx = x; gx <= x + w; gx += tile) {
      ctx.beginPath(); ctx.moveTo(gx + .5, y); ctx.lineTo(gx + .5, y + h); ctx.stroke();
    }
    for (var gy = y; gy <= y + h; gy += tile) {
      ctx.beginPath(); ctx.moveTo(x, gy + .5); ctx.lineTo(x + w, gy + .5); ctx.stroke();
    }
    // 파일 결
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    for (var i = 0; i < 90; i++) {
      ctx.fillRect(x + ((i * 83) % w), y + ((i * 149) % h), 2.5, 1);
    }
    var lg = ctx.createLinearGradient(0, y, 0, y + h);
    lg.addColorStop(0, 'rgba(255,255,255,.10)');
    lg.addColorStop(1, 'rgba(46, 54, 64, .07)');
    ctx.fillStyle = lg;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function stoneFloor(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    var g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#DFDBD5');
    g.addColorStop(0.5, P.terrazzo);
    g.addColorStop(1, '#D5D0CA');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    // 테라조 알갱이
    var specks = ['rgba(120, 112, 102, .30)', 'rgba(255, 255, 255, .55)', 'rgba(92, 98, 104, .22)', 'rgba(168, 148, 128, .28)'];
    for (var i = 0; i < 260; i++) {
      var sx = x + ((i * 149) % w);
      var sy = y + ((i * 233) % h);
      ctx.fillStyle = specks[i % specks.length];
      ctx.beginPath();
      ctx.ellipse(sx, sy, 1 + (i % 3) * 0.6, 1 + ((i + 1) % 3) * 0.5, i, 0, Math.PI * 2);
      ctx.fill();
    }
    // 큰 슬래브 줄눈
    ctx.strokeStyle = 'rgba(120, 112, 104, .22)';
    ctx.lineWidth = 1;
    for (var gy = y + 108; gy < y + h; gy += 108) {
      ctx.beginPath(); ctx.moveTo(x, gy + .5); ctx.lineTo(x + w, gy + .5); ctx.stroke();
    }
    ctx.restore();
  }

  function drawFloor(ctx) {
    // 기본 콘크리트
    ctx.fillStyle = P.concrete;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);

    // 중앙 복도 (폴리시 콘크리트)
    var cg = ctx.createLinearGradient(0, 330, 0, 420);
    cg.addColorStop(0, '#E5E8EC');
    cg.addColorStop(0.45, '#E0E3E7');
    cg.addColorStop(1, '#D9DDE1');
    ctx.fillStyle = cg;
    ctx.fillRect(20, 330, WORLD.w - 40, 90);

    ctx.save();
    ctx.globalAlpha = 0.30;
    var rg = ctx.createLinearGradient(0, 334, 0, 370);
    rg.addColorStop(0, 'rgba(255,255,255,.75)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(20, 334, WORLD.w - 40, 36);
    ctx.restore();

    ctx.strokeStyle = 'rgba(112, 122, 134, .20)';
    ctx.lineWidth = 1;
    for (var gx = 140; gx < WORLD.w - 20; gx += 180) {
      ctx.beginPath(); ctx.moveTo(gx + .5, 330); ctx.lineTo(gx + .5, 420); ctx.stroke();
    }

    // 각 실 바닥
    woodFloor(ctx, ROOMS.work.x, ROOMS.work.y, ROOMS.work.w, ROOMS.work.h);
    carpetFloor(ctx, ROOMS.meeting.x, ROOMS.meeting.y, ROOMS.meeting.w, ROOMS.meeting.h, P.carpetA, P.carpetB, 46);
    stoneFloor(ctx, ROOMS.pantry.x, ROOMS.pantry.y, ROOMS.pantry.w, ROOMS.pantry.h);
    carpetFloor(ctx, ROOMS.focus.x, ROOMS.focus.y, ROOMS.focus.w, ROOMS.focus.h, P.quietA, P.quietB, 40);

    // 라운지 러그
    ctx.save();
    ctx.fillStyle = 'rgba(40, 48, 58, .10)';
    ctx.beginPath();
    ctx.ellipse(448, 626, 164, 100, 0, 0, Math.PI * 2);
    ctx.fill();
    var rug = ctx.createLinearGradient(400, 540, 520, 700);
    rug.addColorStop(0, '#4C5967');
    rug.addColorStop(1, '#3F4B58');
    ctx.fillStyle = rug;
    ctx.beginPath();
    ctx.ellipse(444, 622, 158, 96, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(214, 220, 226, .22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(444, 622, 146, 85, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 실 경계선
    ZONES.forEach(function (z) {
      ctx.strokeStyle = 'rgba(58, 68, 80, .22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(z.x + .5, z.y + .5, z.w - 1, z.h - 1);
    });
  }

  /* 방 안쪽 그림자 (빛은 위에서) */
  function roomInset(ctx, x, y, w, h) {
    ctx.save();
    var top = ctx.createLinearGradient(0, y, 0, y + 20);
    top.addColorStop(0, 'rgba(26, 32, 40, .16)');
    top.addColorStop(1, 'rgba(26, 32, 40, 0)');
    ctx.fillStyle = top;
    ctx.fillRect(x, y, w, 20);

    var left = ctx.createLinearGradient(x, 0, x + 20, 0);
    left.addColorStop(0, 'rgba(26, 32, 40, .10)');
    left.addColorStop(1, 'rgba(26, 32, 40, 0)');
    ctx.fillStyle = left;
    ctx.fillRect(x, y, 20, h);
    ctx.restore();
  }

  /* ── 벽 · 창 · 파티션 ─────────────────────── */

  function windowBand(ctx, x, y, w, h) {
    ctx.save();
    // 프레임
    ctx.fillStyle = '#171C23';
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);

    // 유리
    var g = ctx.createLinearGradient(x, y, x + w * 0.5, y + h);
    g.addColorStop(0, '#D3E3EB');
    g.addColorStop(0.55, '#BFD5E1');
    g.addColorStop(1, '#DFEAF0');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    // 바깥 풍경
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(126, 152, 172, .26)';
    for (var i = 0; i < 10; i++) {
      var bw = (w / 10) - 7;
      var bh = 9 + ((i * 37) % 16);
      ctx.fillRect(x + 6 + i * (w / 10), y + h - bh, bw, bh);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, .34)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.08, y + h);
    ctx.lineTo(x + w * 0.30, y);
    ctx.lineTo(x + w * 0.40, y);
    ctx.lineTo(x + w * 0.18, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 멀리언
    ctx.fillStyle = '#171C23';
    var panes = Math.max(2, Math.round(w / 118));
    for (var p = 1; p < panes; p++) ctx.fillRect(x + (w / panes) * p - 2, y, 4, h);

    // 상단 하이라이트
    ctx.fillStyle = 'rgba(255, 255, 255, .20)';
    ctx.fillRect(x, y, w, 2);
  }

  function wallDisplay(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 14, 19, .45)';
    rr(ctx, x + 2, y + 3, w, h, 4);
    ctx.fill();

    ctx.fillStyle = '#141A20';
    rr(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.fillStyle = '#1A2731';
    rr(ctx, x + 4, y + 4, w - 8, h - 8, 2);
    ctx.fill();

    // 차트
    var bars = [0.34, 0.52, 0.41, 0.68, 0.57, 0.82];
    for (var i = 0; i < bars.length; i++) {
      var bh = (h - 24) * bars[i];
      ctx.fillStyle = i === bars.length - 1 ? 'rgba(122, 186, 172, .80)' : 'rgba(120, 152, 178, .50)';
      ctx.fillRect(x + 14 + i * 15, y + h - 9 - bh, 8, bh);
    }

    // 텍스트 라인
    ctx.fillStyle = 'rgba(220, 230, 238, .50)';
    ctx.fillRect(x + w - 104, y + 12, 80, 3);
    ctx.fillRect(x + w - 104, y + 21, 58, 3);
    ctx.fillRect(x + w - 104, y + 30, 70, 3);

    ctx.strokeStyle = 'rgba(180, 196, 210, .16)';
    ctx.lineWidth = 1;
    rr(ctx, x + .5, y + .5, w - 1, h - 1, 4);
    ctx.stroke();
    ctx.restore();
  }

  function wallClock(ctx, x, y, r) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 14, 19, .45)';
    ctx.beginPath();
    ctx.arc(x + 1, y + 2, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#E9EBEC';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1B2129';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(58, 66, 76, .55)';
    ctx.lineWidth = 1;
    for (var i = 0; i < 12; i++) {
      var a = (Math.PI * 2 / 12) * i;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3));
      ctx.lineTo(x + Math.cos(a) * (r - 5.5), y + Math.sin(a) * (r - 5.5));
      ctx.stroke();
    }

    ctx.strokeStyle = '#232A33';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 1, y - r * 0.52);
    ctx.moveTo(x, y);
    ctx.lineTo(x + r * 0.40, y + r * 0.18);
    ctx.stroke();
    ctx.restore();
  }

  function drawWalls(ctx) {
    // 상단 벽
    ctx.fillStyle = P.wall;
    ctx.fillRect(0, 0, WORLD.w, 84);

    windowBand(ctx, 96, 14, 452, 54);
    windowBand(ctx, 1046, 14, 96, 54);
    wallDisplay(ctx, 792, 12, 230, 56);
    wallClock(ctx, 1112, 44, 15);

    ctx.fillStyle = 'rgba(255, 255, 255, .05)';
    ctx.fillRect(0, 0, WORLD.w, 2);
    ctx.fillStyle = P.wallFace;
    ctx.fillRect(0, 76, WORLD.w, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, .12)';
    ctx.fillRect(0, 76, WORLD.w, 1.5);

    var g = ctx.createLinearGradient(0, 84, 0, 118);
    g.addColorStop(0, 'rgba(18, 24, 32, .28)');
    g.addColorStop(1, 'rgba(18, 24, 32, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 84, WORLD.w, 34);

    // 좌 · 우 벽
    ctx.fillStyle = P.wall;
    ctx.fillRect(0, 0, 20, WORLD.h);
    ctx.fillRect(WORLD.w - 20, 0, 20, WORLD.h);
    ctx.fillStyle = 'rgba(255, 255, 255, .12)';
    ctx.fillRect(19, 0, 1.5, WORLD.h);
    ctx.fillRect(WORLD.w - 20.5, 0, 1.5, WORLD.h);

    // 하단 벽 + 출입구
    ctx.fillStyle = P.wall;
    ctx.fillRect(0, WORLD.h - 18, 566, 18);
    ctx.fillRect(694, WORLD.h - 18, WORLD.w - 694, 18);
    ctx.fillStyle = P.wallFace;
    ctx.fillRect(0, WORLD.h - 18, 566, 4);
    ctx.fillRect(694, WORLD.h - 18, WORLD.w - 694, 4);

    // 출입구 프레임 + 유리 도어
    ctx.fillStyle = '#1B2129';
    ctx.fillRect(566, WORLD.h - 22, 8, 22);
    ctx.fillRect(686, WORLD.h - 22, 8, 22);
    ctx.fillStyle = 'rgba(196, 219, 230, .55)';
    ctx.fillRect(576, WORLD.h - 16, 108, 12);
    ctx.fillStyle = 'rgba(27, 33, 41, .85)';
    ctx.fillRect(628, WORLD.h - 16, 3, 12);
    ctx.fillStyle = 'rgba(255, 255, 255, .28)';
    ctx.fillRect(576, WORLD.h - 16, 108, 1.5);

    // 출입 매트
    ctx.fillStyle = 'rgba(48, 56, 66, .55)';
    rr(ctx, 574, 742, 112, 18, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 236, 240, .18)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* 유리 파티션 (수평) */
  function glassWallH(ctx, x1, x2, y) {
    var w = x2 - x1;
    addRect(x1, y - 4, w, 8, 'glass');

    ctx.save();
    // 바닥 그림자
    ctx.fillStyle = 'rgba(20, 26, 34, .10)';
    ctx.fillRect(x1, y + 2, w, 7);

    // 유리
    ctx.fillStyle = P.glass;
    ctx.fillRect(x1, y - 3, w, 6);
    // 프레임
    ctx.fillStyle = P.metal;
    ctx.fillRect(x1, y - 4.5, w, 1.8);
    ctx.fillRect(x1, y + 2.7, w, 1.8);
    // 기둥
    for (var px = x1; px <= x2 - 5; px += 116) {
      ctx.fillStyle = P.metal;
      ctx.fillRect(px, y - 6, 5, 12);
      ctx.fillStyle = 'rgba(255, 255, 255, .16)';
      ctx.fillRect(px, y - 6, 1.2, 12);
    }
    // 반사
    ctx.fillStyle = P.glassHi;
    ctx.fillRect(x1, y - 2.2, w, 1);
    ctx.restore();
  }

  /* 유리 파티션 (수직) */
  function glassWallV(ctx, x, y1, y2) {
    var h = y2 - y1;
    addRect(x - 4, y1, 8, h, 'glass');

    ctx.save();
    ctx.fillStyle = 'rgba(20, 26, 34, .10)';
    ctx.fillRect(x + 2, y1, 7, h);

    ctx.fillStyle = P.glass;
    ctx.fillRect(x - 3, y1, 6, h);
    ctx.fillStyle = P.metal;
    ctx.fillRect(x - 4.5, y1, 1.8, h);
    ctx.fillRect(x + 2.7, y1, 1.8, h);
    for (var py = y1; py <= y2 - 5; py += 116) {
      ctx.fillStyle = P.metal;
      ctx.fillRect(x - 6, py, 12, 5);
      ctx.fillStyle = 'rgba(255, 255, 255, .16)';
      ctx.fillRect(x - 6, py, 12, 1.2);
    }
    ctx.fillStyle = P.glassHi;
    ctx.fillRect(x - 2.2, y1, 1, h);
    ctx.restore();
  }

  function partitionPost(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = 'rgba(20, 26, 34, .14)';
    ctx.fillRect(x - 4, y - 2, 10, 10);
    ctx.fillStyle = P.metal;
    ctx.fillRect(x - 5, y - 5, 10, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, .18)';
    ctx.fillRect(x - 5, y - 5, 2.5, 10);
    ctx.restore();
  }

  function drawPartitions(ctx) {
    // 1층(워크스테이션 · 회의실) 아래쪽
    glassWallH(ctx, 48, 268, 330);
    glassWallH(ctx, 452, 588, 330);
    glassWallH(ctx, 612, 780, 330);
    glassWallH(ctx, 964, 1152, 330);

    // 2층(탕비실 · 포커스 팟) 위쪽
    glassWallH(ctx, 48, 236, 420);
    glassWallH(ctx, 420, 588, 420);
    glassWallH(ctx, 612, 836, 420);
    glassWallH(ctx, 1020, 1152, 420);

    // 워크스테이션 ↔ 회의실
    glassWallV(ctx, 600, 100, 180);
    glassWallV(ctx, 600, 276, 330);

    // 탕비실 ↔ 포커스 팟
    glassWallV(ctx, 600, 420, 560);
    glassWallV(ctx, 600, 656, 744);

    // 모서리 기둥
    [[268, 330], [452, 330], [588, 330], [612, 330], [780, 330], [964, 330],
     [236, 420], [420, 420], [588, 420], [612, 420], [836, 420], [1020, 420],
     [600, 180], [600, 276], [600, 560], [600, 656]
    ].forEach(function (p) { partitionPost(ctx, p[0], p[1]); });
  }

  /* ── 가구 부품 ───────────────────────────── */

  function block(ctx, x, y, w, h, r) {
    ctx.save();
    ctx.fillStyle = 'rgba(20, 26, 34, .07)';
    rr(ctx, x + 1, y + 2, w, h, r);
    ctx.fill();
    ctx.fillStyle = P.shadow;
    rr(ctx, x + 2.5, y + 5.5, w, h, r);
    ctx.fill();
    ctx.restore();
  }

  function monitor(ctx, cx, cy, s) {
    ctx.save();
    // 받침
    ctx.fillStyle = 'rgba(30, 38, 48, .55)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 11 * s, 7 * s, 2.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2A323C';
    ctx.fillRect(cx - 1.2 * s, cy + 2 * s, 2.4 * s, 9 * s);

    // 본체
    ctx.fillStyle = '#1B212A';
    rr(ctx, cx - 20 * s, cy - 13 * s, 40 * s, 26 * s, 2.5 * s);
    ctx.fill();

    // 화면
    var g = ctx.createLinearGradient(cx - 18 * s, cy - 12 * s, cx + 18 * s, cy + 12 * s);
    g.addColorStop(0, '#33495E');
    g.addColorStop(1, '#22303E');
    ctx.fillStyle = g;
    rr(ctx, cx - 18 * s, cy - 11 * s, 36 * s, 22 * s, 1.5 * s);
    ctx.fill();

    // 화면 내용
    ctx.fillStyle = 'rgba(150, 186, 208, .40)';
    ctx.fillRect(cx - 14 * s, cy - 7 * s, 16 * s, 1.6 * s);
    ctx.fillRect(cx - 14 * s, cy - 3.5 * s, 24 * s, 1.4 * s);
    ctx.fillRect(cx - 14 * s, cy + 0.5 * s, 20 * s, 1.4 * s);
    ctx.fillStyle = 'rgba(126, 186, 170, .45)';
    ctx.fillRect(cx - 14 * s, cy + 5 * s, 11 * s, 2 * s);

    // 글레어
    ctx.fillStyle = 'rgba(255, 255, 255, .10)';
    ctx.beginPath();
    ctx.moveTo(cx - 16 * s, cy + 7 * s);
    ctx.lineTo(cx - 4 * s, cy - 10 * s);
    ctx.lineTo(cx + 1 * s, cy - 10 * s);
    ctx.lineTo(cx - 11 * s, cy + 7 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function chair(ctx, x, y, r, tone) {
    var base = tone || '#2C343D';
    ctx.save();
    // 그림자
    ctx.fillStyle = 'rgba(20, 26, 34, .17)';
    ctx.beginPath();
    ctx.ellipse(x + 1, y + 4, r * 1.03, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();

    // 등받이
    ctx.strokeStyle = darken(base, .28);
    ctx.lineWidth = r * 0.52;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.80, Math.PI * 1.10, Math.PI * 1.90);
    ctx.stroke();

    // 시트
    var g = ctx.createRadialGradient(x - r * 0.32, y - r * 0.38, r * 0.15, x, y, r);
    g.addColorStop(0, lighten(base, .26));
    g.addColorStop(1, base);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.90, r * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();

    // 메시 결
    ctx.strokeStyle = 'rgba(255, 255, 255, .07)';
    ctx.lineWidth = 1;
    for (var i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * r * 0.2, y - r * 0.66);
      ctx.lineTo(x + i * r * 0.2, y + r * 0.58);
      ctx.stroke();
    }
    ctx.restore();
  }

  function plant(ctx, x, y, s, tone) {
    s = s || 1;
    var greens = ['#3D6B53', '#48795F', '#325B46', '#568869', '#2E5340'];
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = 'rgba(20, 26, 34, .15)';
    ctx.beginPath();
    ctx.ellipse(2, 9 * s, 14 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 화분
    var pot = ctx.createLinearGradient(-10 * s, 0, 10 * s, 0);
    pot.addColorStop(0, '#A5AAB1');
    pot.addColorStop(0.45, '#C4C8CD');
    pot.addColorStop(1, '#969CA3');
    ctx.fillStyle = pot;
    ctx.beginPath();
    ctx.moveTo(-9 * s, -1 * s);
    ctx.lineTo(9 * s, -1 * s);
    ctx.lineTo(6.5 * s, 12 * s);
    ctx.lineTo(-6.5 * s, 12 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(72, 80, 90, .32)';
    ctx.fillRect(-9.5 * s, -3.4 * s, 19 * s, 2.6 * s);

    // 잎
    var leaves = [
      [-12, -13, -0.95, 8, 15],
      [-5, -20, -0.45, 9, 17],
      [3, -23, 0.18, 8.5, 16],
      [12, -15, 0.78, 7.5, 14],
      [-1, -27, 0.02, 8, 16],
      [-15, -7, -1.25, 6.5, 11]
    ];
    leaves.forEach(function (l, i) {
      ctx.save();
      ctx.translate(l[0] * s, l[1] * s);
      ctx.rotate(l[2]);
      // 줄기
      ctx.strokeStyle = 'rgba(58, 84, 66, .75)';
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.moveTo(0, l[4] * s * 0.55);
      ctx.lineTo(0, 0);
      ctx.stroke();
      // 잎몸
      var lg = ctx.createLinearGradient(0, -l[4] * s * 0.5, 0, l[4] * s * 0.5);
      lg.addColorStop(0, lighten(tone || greens[i % greens.length], .18));
      lg.addColorStop(1, darken(tone || greens[i % greens.length], .12));
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.ellipse(0, 0, l[3] * s * 0.55, l[4] * s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // 잎맥
      ctx.strokeStyle = 'rgba(255, 255, 255, .16)';
      ctx.lineWidth = 0.9 * s;
      ctx.beginPath();
      ctx.moveTo(0, -l[4] * s * 0.42);
      ctx.lineTo(0, l[4] * s * 0.42);
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  }

  function mug(ctx, x, y, r, color) {
    ctx.save();
    ctx.fillStyle = 'rgba(20, 26, 34, .16)';
    ctx.beginPath();
    ctx.ellipse(x + 1, y + 2, r, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color || '#8C6A5E';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, .55)';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function papers(ctx, x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || -0.1);
    ctx.fillStyle = 'rgba(20, 26, 34, .12)';
    ctx.fillRect(1, 2, 26, 18);
    ctx.fillStyle = '#FCFCFA';
    ctx.fillRect(0, 0, 26, 18);
    ctx.strokeStyle = 'rgba(150, 158, 168, .55)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(4, 5); ctx.lineTo(22, 5);
    ctx.moveTo(4, 9); ctx.lineTo(18, 9);
    ctx.stroke();
    ctx.restore();
  }

  function documentTray(ctx, x, y) {
    ctx.save();
    for (var i = 2; i >= 0; i--) {
      ctx.fillStyle = i === 0 ? '#E8E9E7' : '#DCDDDB';
      rr(ctx, x, y - i * 3, 24, 14, 1.5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(140, 148, 158, .55)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.fillStyle = '#F7F7F5';
    ctx.fillRect(x + 3, y - 4, 18, 9);
    ctx.restore();
  }

  function deskLamp(ctx, x, y) {
    ctx.save();
    // 빛
    var g = ctx.createRadialGradient(x + 4, y + 8, 2, x + 4, y + 8, 26);
    g.addColorStop(0, 'rgba(255, 233, 186, .34)');
    g.addColorStop(1, 'rgba(255, 233, 186, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x + 4, y + 8, 26, 0, Math.PI * 2);
    ctx.fill();
    // 몸체
    ctx.fillStyle = '#333B45';
    ctx.beginPath();
    ctx.ellipse(x, y, 4.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333B45';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 3, y - 9);
    ctx.lineTo(x + 9, y - 8);
    ctx.stroke();
    ctx.fillStyle = '#2A323B';
    rr(ctx, x + 7, y - 11, 7, 5, 2);
    ctx.fill();
    ctx.restore();
  }

  function laptop(ctx, x, y, s) {
    ctx.save();
    ctx.fillStyle = 'rgba(20, 26, 34, .14)';
    rr(ctx, x + 2, y + 3, 30 * s, 22 * s, 2);
    ctx.fill();
    ctx.fillStyle = '#3A4250';
    rr(ctx, x, y + 6 * s, 30 * s, 16 * s, 2);
    ctx.fill();
    ctx.fillStyle = '#1E252E';
    rr(ctx, x + 1, y, 28 * s, 14 * s, 2);
    ctx.fill();
    ctx.fillStyle = '#2E4256';
    rr(ctx, x + 2.5, y + 1.5, 25 * s, 11 * s, 1);
    ctx.fill();
    ctx.fillStyle = 'rgba(150, 186, 208, .35)';
    ctx.fillRect(x + 5, y + 4, 12 * s, 1.4);
    ctx.fillRect(x + 5, y + 7, 17 * s, 1.4);
    ctx.restore();
  }

  function credenza(ctx, x, y, w, h, vertical) {
    ctx.save();
    block(ctx, x, y, w, h, 3);
    ctx.fillStyle = '#333B45';
    rr(ctx, x, y, w, h, 3);
    ctx.fill();
    // 상판
    ctx.fillStyle = P.oak;
    if (vertical) {
      rr(ctx, x, y, w, 6, 2);
      ctx.fill();
    } else {
      rr(ctx, x, y, w, 5, 2);
      ctx.fill();
    }
    // 도어 라인
    ctx.strokeStyle = 'rgba(255, 255, 255, .10)';
    ctx.lineWidth = 1;
    if (vertical) {
      for (var p = 1; p < 4; p++) {
        ctx.beginPath();
        ctx.moveTo(x + 2, y + (h / 4) * p);
        ctx.lineTo(x + w - 2, y + (h / 4) * p);
        ctx.stroke();
      }
    } else {
      for (var q = 1; q < 3; q++) {
        ctx.beginPath();
        ctx.moveTo(x + (w / 3) * q, y + 3);
        ctx.lineTo(x + (w / 3) * q, y + h - 3);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ── 워크스테이션 ─────────────────────────── */

  function drawDesk(ctx, d) {
    block(ctx, d.x, d.y, d.w, d.h, 5);

    var g = ctx.createLinearGradient(0, d.y, 0, d.y + d.h);
    g.addColorStop(0, '#F5F4F1');
    g.addColorStop(0.72, '#E8E6E1');
    g.addColorStop(1, '#D8D5D0');
    ctx.fillStyle = g;
    rr(ctx, d.x, d.y, d.w, d.h, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(122, 126, 130, .42)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 상판 앞단 두께
    ctx.fillStyle = 'rgba(116, 120, 126, .38)';
    ctx.fillRect(d.x + 3, d.y + d.h - 2, d.w - 6, 2);

    // 듀얼 모니터
    monitor(ctx, d.x + 46, d.y + 20, 0.60);
    monitor(ctx, d.x + 86, d.y + 20, 0.60);

    // 키보드 · 마우스
    ctx.fillStyle = '#3B424B';
    rr(ctx, d.x + 52, d.y + 33, 34, 9, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, .16)';
    for (var k = 0; k < 3; k++) ctx.fillRect(d.x + 55, d.y + 35 + k * 2.6, 28, 1);
    ctx.fillStyle = '#3B424B';
    ctx.beginPath();
    ctx.ellipse(d.x + 96, d.y + 38, 4.5, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 머그
    mug(ctx, d.x + d.w - 20, d.y + 15, 6.5, d.mug);

    // 서류 · 트레이 · 스탠드
    if (d.tray) documentTray(ctx, d.x + 12, d.y + d.h - 20);
    if (d.lamp) deskLamp(ctx, d.x + d.w - 26, d.y + d.h - 16);
    papers(ctx, d.x + 20, d.y + 32, 0.14);
    if (d.plant) plant(ctx, d.x + d.w - 16, d.y + d.h + 2, 0.42, '#4A7A5F');

    // 의자
    chair(ctx, d.cx, d.cy, 16);
  }

  function drawWorkZone(ctx, t) {
    // 좌측 벽면 수납장
    credenza(ctx, 22, 132, 24, 176, true);
    plant(ctx, 33, 300, 0.42, '#4C7C62');

    DESKS.forEach(function (d) {
      drawDesk(ctx, d);
    });

    // 우측 보조 테이블 + 화분
    block(ctx, 470, 282, 86, 34, 4);
    ctx.fillStyle = '#3B434D';
    rr(ctx, 470, 282, 86, 34, 4);
    ctx.fill();
    ctx.fillStyle = P.oak;
    rr(ctx, 474, 286, 78, 26, 3);
    ctx.fill();
    plant(ctx, 514, 299, 0.62, '#46785C');

    // 바닥 화분
    plant(ctx, 72, 300, 0.85, '#40705A');

    // 데스크 위 조명 웅덩이
    DESKS.forEach(function (d) {
      var lg = ctx.createRadialGradient(d.x + 66, d.y + 26, 6, d.x + 66, d.y + 26, 52);
      lg.addColorStop(0, 'rgba(255, 240, 210, .14)');
      lg.addColorStop(1, 'rgba(255, 240, 210, 0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(d.x + 66, d.y + 26, 52, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /* ── 회의실 ──────────────────────────────── */

  function drawMeetingZone(ctx, t) {
    // 의자
    CONF_CHAIRS.forEach(function (c) {
      chair(ctx, c[0], c[1], 15, '#333B45');
    });

    // 테이블
    block(ctx, TABLE.x, TABLE.y, TABLE.w, TABLE.h, 10);
    var base = ctx.createLinearGradient(TABLE.x, TABLE.y, TABLE.x + TABLE.w * 0.4, TABLE.y + TABLE.h);
    base.addColorStop(0, '#6E5A46');
    base.addColorStop(1, '#4B3E31');
    ctx.fillStyle = base;
    rr(ctx, TABLE.x + 8, TABLE.y + 12, TABLE.w - 16, TABLE.h - 10, 8);
    ctx.fill();

    var top = ctx.createLinearGradient(TABLE.x, TABLE.y, TABLE.x + 40, TABLE.y + TABLE.h);
    top.addColorStop(0, P.oakLight);
    top.addColorStop(0.5, P.oak);
    top.addColorStop(1, '#A2764B');
    ctx.fillStyle = top;
    rr(ctx, TABLE.x, TABLE.y, TABLE.w, TABLE.h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(74, 56, 38, .35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 나뭇결
    ctx.save();
    ctx.beginPath();
    rr(ctx, TABLE.x, TABLE.y, TABLE.w, TABLE.h, 10);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 246, 232, .10)';
    ctx.lineWidth = 1;
    for (var i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.moveTo(TABLE.x, TABLE.y + 8 + i * 9);
      ctx.bezierCurveTo(TABLE.x + 100, TABLE.y + 4 + i * 9, TABLE.x + 200, TABLE.y + 14 + i * 9, TABLE.x + TABLE.w, TABLE.y + 6 + i * 9);
      ctx.stroke();
    }
    ctx.restore();

    // 케이블 홀
    ctx.fillStyle = 'rgba(58, 46, 34, .55)';
    rr(ctx, TABLE.x + TABLE.w / 2 - 16, TABLE.y + TABLE.h / 2 - 6, 32, 12, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, .14)';
    rr(ctx, TABLE.x + TABLE.w / 2 - 14, TABLE.y + TABLE.h / 2 - 4, 28, 8, 3);
    ctx.fill();

    // 회의 소품
    laptop(ctx, TABLE.x + 42, TABLE.y + 18, 0.9);
    papers(ctx, TABLE.x + 128, TABLE.y + 20, -0.06);
    papers(ctx, TABLE.x + 176, TABLE.y + 56, 0.1);
    // 스피커폰
    ctx.fillStyle = '#2A313A';
    rr(ctx, TABLE.x + 232, TABLE.y + 36, 42, 16, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, .18)';
    for (var s2 = 0; s2 < 4; s2++) ctx.fillRect(TABLE.x + 238 + s2 * 7, TABLE.y + 42, 4, 4);
    // 물병 · 컵
    ctx.fillStyle = 'rgba(206, 220, 228, .75)';
    ctx.beginPath();
    ctx.arc(TABLE.x + 214, TABLE.y + 22, 6, 0, Math.PI * 2);
    ctx.fill();
    mug(ctx, TABLE.x + 82, TABLE.y + 64, 6, '#7B6A5C');
    mug(ctx, TABLE.x + 158, TABLE.y + 66, 6, '#5D6B75');

    // 사이드보드
    credenza(ctx, 660, 296, 104, 24);
    documentTray(ctx, 690, 304);
    plant(ctx, 644, 302, 0.62, '#4A7A5F');
    plant(ctx, 1136, 300, 0.72, '#46785C');

    // 테이블 위 조명
    var lg = ctx.createRadialGradient(942, 216, 10, 942, 216, 150);
    lg.addColorStop(0, 'rgba(255, 244, 220, .12)');
    lg.addColorStop(1, 'rgba(255, 244, 220, 0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.ellipse(942, 222, 190, 90, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ── 탕비실 · 라운지 ─────────────────────── */

  function espressoMachine(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = 'rgba(20, 26, 34, .18)';
    rr(ctx, x + 2, y + 4, 48, 30, 4);
    ctx.fill();

    var g = ctx.createLinearGradient(x, y, x, y + 30);
    g.addColorStop(0, '#C9CDD2');
    g.addColorStop(0.45, '#AEB4BB');
    g.addColorStop(1, '#8C939C');
    ctx.fillStyle = g;
    rr(ctx, x, y, 48, 30, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(64, 72, 82, .45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 상단 트레이
    ctx.fillStyle = '#3B424B';
    rr(ctx, x + 5, y + 4, 38, 8, 2);
    ctx.fill();
    // 그룹 헤드
    ctx.fillStyle = '#2E353E';
    rr(ctx, x + 12, y + 14, 24, 7, 2);
    ctx.fill();
    // 포트 필터
    ctx.fillStyle = '#4C5560';
    ctx.fillRect(x + 19, y + 21, 10, 5);
    // 컵
    ctx.fillStyle = '#EDEFF1';
    ctx.beginPath();
    ctx.arc(x + 24, y + 27, 3.6, 0, Math.PI * 2);
    ctx.fill();
    // 버튼
    ctx.fillStyle = '#7FBFB0';
    ctx.beginPath();
    ctx.arc(x + 40, y + 8, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#C98C7C';
    ctx.beginPath();
    ctx.arc(x + 34, y + 8, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPantryZone(ctx, t) {
    // 카운터
    block(ctx, COUNTER.x, COUNTER.y, COUNTER.w, COUNTER.h, 5);
    // 하부 수납
    var body = ctx.createLinearGradient(0, COUNTER.y, 0, COUNTER.y + COUNTER.h);
    body.addColorStop(0, '#3A424C');
    body.addColorStop(1, '#2C343D');
    ctx.fillStyle = body;
    rr(ctx, COUNTER.x, COUNTER.y + 8, COUNTER.w, COUNTER.h - 8, 4);
    ctx.fill();
    // 도어 라인
    ctx.strokeStyle = 'rgba(255, 255, 255, .08)';
    ctx.lineWidth = 1;
    for (var i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(COUNTER.x + (COUNTER.w / 4) * i, COUNTER.y + 12);
      ctx.lineTo(COUNTER.x + (COUNTER.w / 4) * i, COUNTER.y + COUNTER.h - 4);
      ctx.stroke();
    }
    // 상판 (오크)
    var top = ctx.createLinearGradient(0, COUNTER.y, 0, COUNTER.y + 12);
    top.addColorStop(0, P.oakLight);
    top.addColorStop(1, P.oak);
    ctx.fillStyle = top;
    rr(ctx, COUNTER.x - 2, COUNTER.y - 1, COUNTER.w + 4, 12, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(74, 56, 38, .30)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 개수대
    ctx.fillStyle = '#8E959E';
    rr(ctx, COUNTER.x + 14, COUNTER.y + 2, 34, 8, 2);
    ctx.fill();
    ctx.fillStyle = '#6E757E';
    rr(ctx, COUNTER.x + 17, COUNTER.y + 4, 28, 4.5, 1.5);
    ctx.fill();
    ctx.strokeStyle = '#C7CCD2';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(COUNTER.x + 34, COUNTER.y + 2);
    ctx.lineTo(COUNTER.x + 34, COUNTER.y - 4);
    ctx.lineTo(COUNTER.x + 28, COUNTER.y - 4);
    ctx.stroke();

    // 커피 머신 · 그라인더 · 컵
    espressoMachine(ctx, COUNTER.x + 92, COUNTER.y + 2);
    ctx.fillStyle = 'rgba(20, 26, 34, .16)';
    ctx.beginPath();
    ctx.arc(COUNTER.x + 160, COUNTER.y + 24, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3A424C';
    ctx.beginPath();
    ctx.arc(COUNTER.x + 158, COUNTER.y + 22, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(206, 214, 220, .55)';
    ctx.beginPath();
    ctx.arc(COUNTER.x + 158, COUNTER.y + 22, 4.5, 0, Math.PI * 2);
    ctx.fill();
    for (var c = 0; c < 3; c++) {
      ctx.fillStyle = c % 2 ? '#D9DDE1' : '#C2C8CE';
      ctx.beginPath();
      ctx.arc(COUNTER.x + 196 + c * 12, COUNTER.y + 22, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // 오크 상판 위 컵 정리
    ctx.fillStyle = '#EDEFF1';
    rr(ctx, COUNTER.x + 176, COUNTER.y + 4, 14, 10, 2);
    ctx.fill();

    // 물 디스펜서
    block(ctx, 316, 456, 32, 44, 4);
    var wg = ctx.createLinearGradient(316, 456, 348, 500);
    wg.addColorStop(0, '#E6E8EA');
    wg.addColorStop(1, '#C7CCD2');
    ctx.fillStyle = wg;
    rr(ctx, 316, 456, 32, 44, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(148, 186, 204, .55)';
    rr(ctx, 320, 460, 24, 12, 2);
    ctx.fill();
    ctx.fillStyle = '#4A545F';
    ctx.fillRect(324, 478, 5, 8);
    ctx.fillRect(335, 478, 5, 8);

    // 냉장고
    block(ctx, 470, 452, 86, 76, 5);
    var fg = ctx.createLinearGradient(470, 452, 556, 528);
    fg.addColorStop(0, '#C9CED4');
    fg.addColorStop(0.4, '#AEB5BD');
    fg.addColorStop(1, '#8E959D');
    ctx.fillStyle = fg;
    rr(ctx, 470, 452, 86, 76, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 68, 78, .40)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, .30)';
    ctx.beginPath();
    ctx.moveTo(474, 490);
    ctx.lineTo(552, 490);
    ctx.stroke();
    ctx.fillStyle = '#4A525C';
    rr(ctx, 536, 466, 4, 20, 2);
    ctx.fill();
    rr(ctx, 536, 498, 4, 18, 2);
    ctx.fill();

    // 바 스툴
    stool(ctx, 112, 552);
    stool(ctx, 192, 552);

    // 화분
    plant(ctx, 376, 472, 0.85, '#47795D');

    // 라운지 소파
    drawSofa(ctx, 356, 648, 200, 60);

    // 커피 테이블
    drawCoffeeTable(ctx, 420, 604, 62, 34);

    // 바닥 화분
    plant(ctx, 70, 706, 0.95, '#40705A');
    plant(ctx, 566, 700, 0.8, '#46785C');

    // 카운터 다운라이트
    var lg = ctx.createRadialGradient(182, 490, 8, 182, 490, 120);
    lg.addColorStop(0, 'rgba(255, 239, 206, .16)');
    lg.addColorStop(1, 'rgba(255, 239, 206, 0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.ellipse(182, 496, 150, 70, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function stool(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = 'rgba(20, 26, 34, .16)';
    ctx.beginPath();
    ctx.ellipse(x + 1, y + 3, 14, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#39414B';
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4B545F';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, .10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawSofa(ctx, x, y, w, h) {
    block(ctx, x, y, w, h, 10);
    // 등받이 (아래쪽)
    var back = ctx.createLinearGradient(0, y + h - 20, 0, y + h);
    back.addColorStop(0, '#363E48');
    back.addColorStop(1, '#2B333C');
    ctx.fillStyle = back;
    rr(ctx, x, y + h - 20, w, 20, 8);
    ctx.fill();
    // 시트
    var seat = ctx.createLinearGradient(0, y, 0, y + h - 16);
    seat.addColorStop(0, '#4A535E');
    seat.addColorStop(1, '#3D4650');
    ctx.fillStyle = seat;
    rr(ctx, x + 6, y + 4, w - 12, h - 22, 7);
    ctx.fill();
    // 쿠션
    ctx.strokeStyle = 'rgba(20, 26, 34, .35)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 6);
    ctx.lineTo(x + w / 2, y + h - 24);
    ctx.stroke();
    // 팔걸이
    ctx.fillStyle = '#333B45';
    rr(ctx, x, y + 2, 9, h - 26, 5);
    ctx.fill();
    rr(ctx, x + w - 9, y + 2, 9, h - 26, 5);
    ctx.fill();
    // 쿠션 하이라이트
    ctx.fillStyle = 'rgba(255, 255, 255, .07)';
    rr(ctx, x + 14, y + 8, w / 2 - 22, 10, 4);
    ctx.fill();
    rr(ctx, x + w / 2 + 8, y + 8, w / 2 - 22, 10, 4);
    ctx.fill();
  }

  function drawCoffeeTable(ctx, cx, cy, rx, ry) {
    ctx.save();
    ctx.fillStyle = 'rgba(20, 26, 34, .16)';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 5, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    var g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 6, cx, cy, rx);
    g.addColorStop(0, '#6B5A48');
    g.addColorStop(1, '#4A3E31');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(28, 30, 34, .35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, .10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx - 8, ry - 6, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 매거진 · 트레이
    ctx.save();
    ctx.translate(cx - 26, cy - 2);
    ctx.rotate(-0.14);
    ctx.fillStyle = '#E9EAE8';
    ctx.fillRect(0, 0, 30, 20);
    ctx.fillStyle = 'rgba(120, 130, 142, .55)';
    ctx.fillRect(3, 3, 24, 6);
    ctx.restore();

    // 작은 화병
    ctx.fillStyle = '#2F3741';
    ctx.beginPath();
    ctx.ellipse(cx + 24, cy + 4, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3E6B53';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + 24, cy + 2);
    ctx.lineTo(cx + 28, cy - 12);
    ctx.moveTo(cx + 24, cy + 2);
    ctx.lineTo(cx + 19, cy - 11);
    ctx.stroke();
    ctx.restore();
  }

  /* ── 포커스 팟 ───────────────────────────── */

  function drawPod(ctx, p) {
    block(ctx, p.x, p.y, p.w, p.h, 7);

    // 프레임
    ctx.fillStyle = '#242B34';
    rr(ctx, p.x, p.y, p.w, p.h, 7);
    ctx.fill();

    // 유리
    ctx.fillStyle = 'rgba(198, 220, 231, .58)';
    rr(ctx, p.x + 4, p.y + 4, p.w - 8, p.h - 8, 5);
    ctx.fill();

    // 안쪽 바닥
    var fl = ctx.createLinearGradient(0, p.y + 10, 0, p.y + p.h - 10);
    fl.addColorStop(0, '#D2D5DA');
    fl.addColorStop(1, '#C2C6CC');
    ctx.fillStyle = fl;
    rr(ctx, p.x + 11, p.y + 11, p.w - 22, p.h - 22, 4);
    ctx.fill();

    // 데스크
    ctx.fillStyle = '#E9E7E2';
    rr(ctx, p.x + 18, p.y + 58, p.w - 36, 26, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 124, 130, .40)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 노트북
    laptop(ctx, p.x + 30, p.y + 62, 0.78);

    // 의자
    chair(ctx, p.x + p.w / 2, p.y + 94, 12, '#333B45');

    // 선반 · 책
    ctx.fillStyle = '#39414B';
    rr(ctx, p.x + p.w - 26, p.y + 20, 14, 34, 2);
    ctx.fill();
    var books = ['#8A6A47', '#5C7188', '#67735F', '#9E6258'];
    for (var b = 0; b < 4; b++) {
      ctx.fillStyle = books[b];
      ctx.fillRect(p.x + p.w - 24, p.y + 23 + b * 7, 10, 5);
    }

    // 작은 화분
    plant(ctx, p.x + 22, p.y + 26, 0.34, '#4A7A5F');

    // 라벨
    ctx.fillStyle = 'rgba(28, 34, 42, .80)';
    rr(ctx, p.x + 10, p.y + p.h - 22, 54, 13, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(236, 240, 244, .92)';
    ctx.font = '600 7.5px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.tag, p.x + 15, p.y + p.h - 15);

    // 유리 반사
    ctx.fillStyle = 'rgba(255, 255, 255, .16)';
    ctx.beginPath();
    ctx.moveTo(p.x + 8, p.y + p.h - 10);
    ctx.lineTo(p.x + p.w * 0.46, p.y + 8);
    ctx.lineTo(p.x + p.w * 0.60, p.y + 8);
    ctx.lineTo(p.x + p.w * 0.22, p.y + p.h - 10);
    ctx.closePath();
    ctx.fill();

    // 슬라이딩 도어 손잡이
    ctx.fillStyle = 'rgba(40, 48, 58, .55)';
    ctx.fillRect(p.x + p.w - 34, p.y + p.h - 5, 12, 2);
  }

  function drawFocusZone(ctx, t) {
    PODS.forEach(function (p) { drawPod(ctx, p); });

    // 벤치
    block(ctx, 824, 580, 168, 36, 6);
    ctx.fillStyle = '#414A55';
    rr(ctx, 824, 580, 168, 36, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 26, 34, .30)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, .08)';
    ctx.beginPath();
    ctx.moveTo(824 + 56, 583);
    ctx.lineTo(824 + 56, 613);
    ctx.moveTo(824 + 112, 583);
    ctx.lineTo(824 + 112, 613);
    ctx.stroke();

    // 복합기
    block(ctx, 636, 676, 124, 46, 5);
    var pg = ctx.createLinearGradient(636, 676, 760, 722);
    pg.addColorStop(0, '#E2E5E8');
    pg.addColorStop(1, '#C3C8CE');
    ctx.fillStyle = pg;
    rr(ctx, 636, 676, 124, 46, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 128, 138, .45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#9AA2AB';
    rr(ctx, 646, 684, 52, 12, 2);
    ctx.fill();
    ctx.fillStyle = '#2E343C';
    rr(ctx, 708, 684, 40, 18, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(140, 200, 186, .55)';
    ctx.fillRect(714, 690, 12, 5);
    ctx.fillStyle = '#E9EBED';
    rr(ctx, 646, 702, 104, 12, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150, 158, 168, .7)';
    ctx.stroke();

    // 화분
    plant(ctx, 790, 710, 1.0, '#46785C');
    plant(ctx, 1080, 704, 0.85, '#40705A');

    // 팟 앞 조명
    PODS.forEach(function (p) {
      var lg = ctx.createRadialGradient(p.x + p.w / 2, p.y + p.h / 2, 10, p.x + p.w / 2, p.y + p.h / 2, 110);
      lg.addColorStop(0, 'rgba(255, 244, 222, .12)');
      lg.addColorStop(1, 'rgba(255, 244, 222, 0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 110, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /* ── 씬 캐시 ─────────────────────────────── */

  var sceneCache = null;
  var SCALE = 2;

  function buildScene() {
    var c = document.createElement('canvas');
    c.width = WORLD.w * SCALE;
    c.height = WORLD.h * SCALE;
    var cx = c.getContext('2d');
    cx.scale(SCALE, SCALE);

    drawFloor(cx);
    roomInset(cx, ROOMS.work.x, ROOMS.work.y, ROOMS.work.w, ROOMS.work.h);
    roomInset(cx, ROOMS.meeting.x, ROOMS.meeting.y, ROOMS.meeting.w, ROOMS.meeting.h);
    roomInset(cx, ROOMS.pantry.x, ROOMS.pantry.y, ROOMS.pantry.w, ROOMS.pantry.h);
    roomInset(cx, ROOMS.focus.x, ROOMS.focus.y, ROOMS.focus.w, ROOMS.focus.h);

    drawWorkZone(cx, 0);
    drawMeetingZone(cx, 0);
    drawPantryZone(cx, 0);
    drawFocusZone(cx, 0);

    // 조명 · 벽은 마지막에 올려 가구 위에 자연스럽게 겹치도록
    drawWalls(cx);
    drawPartitions(cx);

    return c;
  }

  function scene() {
    if (!sceneCache) sceneCache = buildScene();
    return sceneCache;
  }

  /* ── 피클 캐릭터 ─────────────────────────── */

  function drawPickle(ctx, ch, t, isSelf) {
    var x = ch.dx, y = ch.dy;
    var walking = !!ch.moving;
    var bob = walking ? Math.abs(Math.sin(t * 9 + ch.phase)) * 3.2 : Math.sin(t * 2 + ch.phase) * 1.4;
    var flip = ch.facing < 0 ? -1 : 1;

    ctx.save();
    ctx.translate(x, y);

    // 바닥 그림자
    ctx.save();
    ctx.fillStyle = 'rgba(18, 24, 32, .18)';
    ctx.beginPath();
    ctx.ellipse(0, R * 0.94, R * 0.80, R * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 내 캐릭터 표시
    if (isSelf) {
      ctx.save();
      ctx.strokeStyle = 'rgba(38, 48, 60, .34)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.ellipse(0, R * 0.94, R * 1.02, R * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.translate(0, -bob);

    // 꼬리
    ctx.save();
    ctx.fillStyle = darken(ch.body, 0.10);
    ctx.beginPath();
    ctx.ellipse(-flip * R * 0.84, R * 0.42, R * 0.22, R * 0.18, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 몸통 + 빛무리
    ctx.save();
    ctx.shadowColor = ch.glow;
    ctx.shadowBlur = ch.glow === '#FFFFFF' || ch.glow === '#ffffff' ? 16 : 24;
    var g = ctx.createLinearGradient(0, -R * 1.1, 0, R * 1.1);
    g.addColorStop(0, lighten(ch.body, 0.26));
    g.addColorStop(0.58, ch.body);
    g.addColorStop(1, darken(ch.body, 0.16));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 0.99, R * 1.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 아래쪽 결 (볼륨감)
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#1B2129';
    ctx.beginPath();
    ctx.ellipse(0, R * 0.62, R * 0.72, R * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 깃털 귀
    [-1, 1].forEach(function (s) {
      ctx.save();
      ctx.translate(s * R * 0.84, -R * 0.1);
      for (var i = -1; i <= 1; i++) {
        ctx.save();
        ctx.rotate(i * 0.52 + s * 0.1);
        ctx.fillStyle = i === 0 ? ch.accent : mix(ch.accent, '#ffffff', i < 0 ? 0.26 : 0.14);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(s * R * 0.40, -R * 0.32, s * R * 0.64, -R * 0.04);
        ctx.quadraticCurveTo(s * R * 0.42, R * 0.18, 0, 0);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    });

    // 눈
    var blink = ch.blink > 0 ? 0.12 : 1;
    var look = flip * R * 0.04;
    [-1, 1].forEach(function (s) {
      ctx.save();
      ctx.translate(s * R * 0.34, -R * 0.12);
      ctx.scale(1, blink);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.25, R * 0.29, 0, 0, Math.PI * 2);
      ctx.fill();
      if (blink > 0.5) {
        ctx.fillStyle = '#212831';
        ctx.beginPath();
        ctx.ellipse(look, R * 0.03, R * 0.145, R * 0.17, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(look - R * 0.05, -R * 0.05, R * 0.055, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(look + R * 0.06, R * 0.09, R * 0.026, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#212831';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-R * 0.16, 0);
        ctx.quadraticCurveTo(0, R * 0.12, R * 0.16, 0);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 하이라이트
    ctx.save();
    ctx.globalAlpha = .38;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(-R * 0.34, -R * 0.52, R * 0.26, R * 0.17, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 볼
    ctx.fillStyle = 'rgba(226, 122, 156, .30)';
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      ctx.ellipse(s * R * 0.62, R * 0.24, R * 0.16, R * 0.095, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // 팔
    var swing = walking ? Math.sin(t * 9 + ch.phase) * 0.5 : 0;
    [-1, 1].forEach(function (s2) {
      ctx.save();
      ctx.translate(s2 * R * 0.82, R * 0.34);
      ctx.rotate(s2 * (0.5 + swing * (s2 > 0 ? 1 : -1)));
      ctx.fillStyle = ch.accent;
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.14, R * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 입
    ctx.save();
    ctx.strokeStyle = ch.accent;
    ctx.fillStyle = ch.accent;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    if (ch.talking) {
      ctx.beginPath();
      ctx.ellipse(0, R * 0.34, R * 0.13, R * 0.10, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(-R * 0.14, R * 0.28);
      ctx.quadraticCurveTo(0, R * 0.40, R * 0.14, R * 0.28);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  /* ── 화면 오버레이 ───────────────────────── */

  function wrapText(ctx, text, maxW) {
    var words = text.split(/\s+/);
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    if (lines.length > 3) {
      lines = lines.slice(0, 3);
      lines[2] = lines[2].slice(0, Math.max(0, lines[2].length - 1)) + '…';
    }
    return lines;
  }

  function toScreen(wx, wy, view) {
    return {
      x: view.cw / 2 + (wx - view.camX) * view.scale,
      y: view.ch / 2 + (wy - view.camY) * view.scale
    };
  }

  function drawZoneLabels(ctx, view) {
    ctx.save();
    ctx.font = '600 11px ' + FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ZONES.forEach(function (z) {
      var p = toScreen(z.x + 16, z.y + 16, view);
      var w = ctx.measureText(z.label).width + 22;
      if (p.x > view.cw + 4 || p.y > view.ch + 4 || p.x + w < -4 || p.y + 22 < -4) return;

      ctx.fillStyle = 'rgba(255, 255, 255, .88)';
      rr(ctx, p.x - 8, p.y - 11, w, 22, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150, 158, 168, .45)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = z.dot;
      rr(ctx, p.x - 4, p.y - 6, 2.5, 12, 1);
      ctx.fill();

      ctx.fillStyle = '#39424E';
      ctx.fillText(z.label, p.x + 5, p.y + 0.5);
    });
    ctx.restore();
  }

  function drawBubble(ctx, ch, p, radius, now) {
    if (!ch.bubble || ch.bubble.until < now) return;
    var text = ch.bubble.text;
    if (!text) return;

    ctx.save();
    ctx.font = '500 12px ' + FONT;
    var lines = wrapText(ctx, text, 152);
    var w = 26;
    for (var i = 0; i < lines.length; i++) {
      w = Math.max(w, ctx.measureText(lines[i]).width + 22);
    }
    var lh = 16;
    var h = lines.length * lh + 13;
    var bx = p.x - w / 2;
    var by = p.y - radius * 1.5 - 9 - h;

    ctx.globalAlpha = Math.min(1, Math.max(0, (ch.bubble.until - now) / 0.3));

    ctx.save();
    shadow(ctx, 'rgba(20, 26, 34, .18)', 12, 0, 4);
    ctx.fillStyle = '#FDFDFB';
    rr(ctx, bx, by, w, h, 5);
    ctx.fill();
    noShadow(ctx);
    ctx.beginPath();
    ctx.moveTo(p.x - 6, by + h - 1);
    ctx.lineTo(p.x, by + h + 7);
    ctx.lineTo(p.x + 6, by + h - 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(150, 158, 168, .40)';
    ctx.lineWidth = 1;
    rr(ctx, bx + .5, by + .5, w - 1, h - 1, 5);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#2A323B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var j = 0; j < lines.length; j++) {
      ctx.fillText(lines[j], p.x, by + 6.5 + lh * (j + 0.5) + 1);
    }
    ctx.restore();
  }

  function statusLabel(status) {
    return { work: '업무중', meeting: '회의중', break: '자리비움', out: '외근중' }[status] || '업무중';
  }
  var STATUS_COLOR = { work: '#2F7D5B', meeting: '#3A5F8F', break: '#A9772F', out: '#767E8A' };

  function drawNameTag(ctx, ch, p, radius, isSelf) {
    ctx.save();
    ctx.font = '600 10.5px ' + FONT;
    var label = ch.name + (isSelf ? ' (나)' : '');
    var w = ctx.measureText(label).width + 22;
    var y = p.y + radius * 0.98 + 6;

    ctx.save();
    shadow(ctx, 'rgba(20, 26, 34, .16)', 6, 0, 2);
    ctx.fillStyle = isSelf ? 'rgba(31, 37, 45, .94)' : 'rgba(253, 253, 251, .95)';
    rr(ctx, p.x - w / 2, y, w, 18, 3);
    ctx.fill();
    noShadow(ctx);
    ctx.restore();

    if (!isSelf) {
      ctx.strokeStyle = 'rgba(150, 158, 168, .50)';
      ctx.lineWidth = 1;
      rr(ctx, p.x - w / 2 + .5, y + .5, w - 1, 17, 3);
      ctx.stroke();
    }

    ctx.fillStyle = STATUS_COLOR[ch.status] || '#2F7D5B';
    ctx.beginPath();
    ctx.arc(p.x - w / 2 + 9, y + 9, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isSelf ? '#F3F5F7' : '#333C46';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x - w / 2 + 15, y + 9.5);
    ctx.restore();
  }

  /* ── 미리보기 ───────────────────────────── */

  function drawPreview(canvas, profile) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    var w = canvas.clientWidth || 240;
    var h = canvas.clientHeight || 150;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // 배경
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#EDEFF2');
    g.addColorStop(1, '#DDE1E5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 바닥 타일
    ctx.strokeStyle = 'rgba(120, 130, 142, .18)';
    ctx.lineWidth = 1;
    for (var x = 0; x < w; x += 26) {
      ctx.beginPath(); ctx.moveTo(x + .5, h * 0.55); ctx.lineTo(x + .5, h); ctx.stroke();
    }
    for (var y = h * 0.55; y < h; y += 26) {
      ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, .35)';
    ctx.fillRect(0, h * 0.55, w, 1.5);

    var ch = {
      dx: w / 2,
      dy: h * 0.52 + 12,
      body: profile.body,
      accent: profile.accent,
      glow: profile.glow,
      phase: 0.6,
      facing: 1,
      moving: false,
      blink: 0,
      talking: false,
      status: profile.status,
      name: profile.name || '피클'
    };
    ctx.save();
    ctx.translate(w / 2, ch.dy);
    ctx.scale(1.8, 1.8);
    ctx.translate(-w / 2, -ch.dy);
    drawPickle(ctx, ch, 0.4, false);
    ctx.restore();
  }

  /* ── 렌더 진입점 ────────────────────────── */

  function drawScene(ctx, view, chars, me, now) {
    ctx.save();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

    var bg = ctx.createLinearGradient(0, 0, 0, view.ch);
    bg.addColorStop(0, '#E7E9EC');
    bg.addColorStop(1, '#DDE0E4');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, view.cw, view.ch);

    ctx.save();
    ctx.translate(view.cw / 2, view.ch / 2);
    ctx.scale(view.scale, view.scale);
    ctx.translate(-view.camX, -view.camY);

    ctx.drawImage(scene(), 0, 0, WORLD.w, WORLD.h);

    var list = chars.slice().sort(function (a, b) { return a.dy - b.dy; });
    list.forEach(function (c) {
      drawPickle(ctx, c, now, c.id === me);
    });
    ctx.restore();

    // 화면 고정 크기 글자/말풍선
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    drawZoneLabels(ctx, view);

    // 가장자리 비네트
    var vg = ctx.createRadialGradient(view.cw / 2, view.ch / 2, Math.min(view.cw, view.ch) * 0.36,
                                      view.cw / 2, view.ch / 2, Math.max(view.cw, view.ch) * 0.74);
    vg.addColorStop(0, 'rgba(24, 30, 38, 0)');
    vg.addColorStop(1, 'rgba(24, 30, 38, .10)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, view.cw, view.ch);

    list.forEach(function (c) {
      var p = toScreen(c.dx, c.dy, view);
      var radius = R * view.scale;
      if (p.x < -90 || p.y < -110 || p.x > view.cw + 90 || p.y > view.ch + 80) return;
      if (c.bubble && c.bubble.until > now) drawBubble(ctx, c, p, radius, now);
      drawNameTag(ctx, c, p, radius, c.id === me);
    });

    ctx.restore();
  }

  global.OfficeArt = {
    WORLD: WORLD,
    R: R,
    ZONES: ZONES,
    ROOMS: ROOMS,
    OBSTACLES: OBSTACLES,
    scene: scene,
    drawScene: drawScene,
    drawPickle: drawPickle,
    drawPreview: drawPreview,
    statusLabel: statusLabel,
    STATUS_COLOR: STATUS_COLOR,
    lighten: lighten,
    mix: mix
  };
})(window);
