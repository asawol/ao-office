/* ─────────────────────────────────────────────
   art.js — 비서실 그림과 피클 캐릭터
   ───────────────────────────────────────────── */
(function (global) {
  'use strict';

  var WORLD = { w: 1200, h: 780 };

  var ZONES = [
    { id: 'work',    label: '업무 데스크존', x: 56,  y: 100, w: 544, h: 252, tint: '#FFE2B4', edge: '#EDBE7C', dot: '#F2A227' },
    { id: 'meeting', label: '회의 라운지',   x: 648, y: 100, w: 500, h: 252, tint: '#E2D8FF', edge: '#B9A6F2', dot: '#7A4BE0' },
    { id: 'cafe',    label: '카페 휴게실',   x: 56,  y: 400, w: 536, h: 332, tint: '#FFDBE7', edge: '#F2A9C6', dot: '#E8469B' },
    { id: 'focus',   label: '포커스 부스',   x: 648, y: 400, w: 500, h: 332, tint: '#CCEFE0', edge: '#93D8BE', dot: '#2FBF94' }
  ];

  var OBSTACLES = [];

  function addRect(x, y, w, h, tag) { OBSTACLES.push({ type: 'rect', x: x, y: y, w: w, h: h, tag: tag }); }
  function addCircle(x, y, r, tag) { OBSTACLES.push({ type: 'circle', x: x, y: y, r: r, tag: tag }); }

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
  function darken(c, amt) { return mix(c, '#2b1a2e', amt); }
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

  /* ── 바닥과 벽 ───────────────────────────── */

  function drawFloor(ctx) {
    ctx.fillStyle = '#EFD3AE';
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);

    // 나무결
    var plankH = 46;
    for (var y = 0; y < WORLD.h; y += plankH) {
      ctx.fillStyle = ((y / plankH) | 0) % 2 ? '#F2DDBE' : '#EBD1A9';
      ctx.fillRect(0, y, WORLD.w, plankH);
      ctx.strokeStyle = 'rgba(186, 142, 96, .42)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(WORLD.w, y + 0.5);
      ctx.stroke();
      // 이음새
      var offset = ((y * 37) % 260);
      for (var x = offset; x < WORLD.w; x += 260) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + plankH);
        ctx.strokeStyle = 'rgba(196, 156, 112, .22)';
        ctx.stroke();
      }
    }

    // 은은한 결
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (var i = 0; i < 26; i++) {
      var gx = (i * 137) % WORLD.w;
      var gy = (i * 211) % WORLD.h;
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.bezierCurveTo(gx + 40, gy - 6, gx + 70, gy + 8, gx + 110, gy + 1);
      ctx.stroke();
    }
    ctx.restore();

    // 존 러그
    ZONES.forEach(function (z) {
      ctx.save();
      ctx.fillStyle = z.tint;
      rr(ctx, z.x, z.y, z.w, z.h, 30);
      ctx.fill();
      ctx.strokeStyle = alpha(z.edge, .85);
      ctx.lineWidth = 2;
      ctx.setLineDash([9, 8]);
      ctx.stroke();
      ctx.restore();
    });

    // 가운데 러그
    var cx = (ZONES[0].x + ZONES[0].w + ZONES[1].x) / 2;
    ctx.save();
    ctx.fillStyle = '#FFE9D2';
    ctx.beginPath();
    ctx.ellipse(cx, 376, 92, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240, 196, 150, .9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, 376, 76, 30, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawWalls(ctx) {
    // 바깥 벽
    ctx.fillStyle = '#F8EBDA';
    ctx.fillRect(0, 0, WORLD.w, 78);
    ctx.fillRect(0, 0, 22, WORLD.h);
    ctx.fillRect(WORLD.w - 22, 0, 22, WORLD.h);
    ctx.fillRect(0, WORLD.h - 18, WORLD.w, 18);

    // 벽 아래 그림자
    var g = ctx.createLinearGradient(0, 62, 0, 96);
    g.addColorStop(0, 'rgba(150, 110, 70, .18)');
    g.addColorStop(1, 'rgba(150, 110, 70, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 62, WORLD.w, 34);

    // 걸레받이
    ctx.fillStyle = '#FFF9F0';
    ctx.fillRect(0, 68, WORLD.w, 10);
    ctx.fillStyle = 'rgba(210,175,135,.55)';
    ctx.fillRect(0, 77, WORLD.w, 2);

    ctx.fillStyle = '#FFF9F0';
    ctx.fillRect(18, 0, 8, WORLD.h);
    ctx.fillRect(WORLD.w - 26, 0, 8, WORLD.h);

    // 창문
    var windows = [[118, 288], [316, 486], [514, 566]];
    windows.forEach(function (w, i) {
      var x = w[0], width = w[1] - w[0], y = 16, h = 44;
      ctx.save();
      rr(ctx, x, y, width, h, 8);
      ctx.fillStyle = '#D9EEFF';
      ctx.fill();
      var sky = ctx.createLinearGradient(0, y, 0, y + h);
      sky.addColorStop(0, '#BFE3FF');
      sky.addColorStop(1, '#EAF7FF');
      ctx.fillStyle = sky;
      ctx.fill();
      ctx.clip();
      // 구름
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      var clouds = [[0.2, 0.45, 16], [0.55, 0.3, 12], [0.78, 0.6, 10]];
      clouds.forEach(function (c, ci) {
        var cxp = x + width * c[0], cyp = y + h * c[1];
        ctx.beginPath();
        ctx.arc(cxp, cyp, c[2] * 0.6, 0, Math.PI * 2);
        ctx.arc(cxp + c[2] * 0.6, cyp + 2, c[2] * 0.45, 0, Math.PI * 2);
        ctx.arc(cxp - c[2] * 0.55, cyp + 3, c[2] * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });
      // 해
      ctx.fillStyle = 'rgba(255, 236, 174, .95)';
      ctx.beginPath();
      ctx.arc(x + width * 0.82, y + 12, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      rr(ctx, x, y, width, h, 8);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(198, 162, 120, .45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // 창틀
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y + 2);
      ctx.lineTo(x + width / 2, y + h - 2);
      ctx.stroke();
      ctx.restore();
    });

    // 액자
    var frames = [[640, 24, 44, 34, '#FFD9E6'], [700, 28, 30, 26, '#D9F0E4']];
    frames.forEach(function (f) {
      ctx.save();
      ctx.fillStyle = '#FFFDF7';
      rr(ctx, f[0], f[1], f[2], f[3], 3);
      ctx.fill();
      ctx.fillStyle = f[4];
      rr(ctx, f[0] + 4, f[1] + 4, f[2] - 8, f[3] - 8, 2);
      ctx.fill();
      ctx.restore();
    });

    // 벽시계
    ctx.save();
    ctx.translate(1090, 38);
    ctx.fillStyle = '#FFFDF8';
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#E3C9A8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#8C7466';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -9);
    ctx.moveTo(0, 0); ctx.lineTo(6, 3);
    ctx.stroke();
    ctx.restore();

    // 스트링 라이트
    ctx.save();
    ctx.strokeStyle = 'rgba(150, 112, 80, .45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(30, 30);
    ctx.quadraticCurveTo(300, 62, 600, 32);
    ctx.quadraticCurveTo(900, 4, 1170, 30);
    ctx.stroke();
    var bulbs = [90, 170, 250, 330, 410, 490, 570, 660, 740, 820, 900, 980, 1060, 1140];
    bulbs.forEach(function (bx, i) {
      var by = 30 + Math.sin((bx / 600) * Math.PI) * 22 - (bx > 600 ? 6 : 0);
      var glow = ctx.createRadialGradient(bx, by + 4, 0, bx, by + 4, 12);
      glow.addColorStop(0, 'rgba(255, 226, 150, .9)');
      glow.addColorStop(1, 'rgba(255, 226, 150, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bx, by + 4, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = (i % 3 === 0) ? '#FFD47E' : (i % 3 === 1 ? '#FFC0D9' : '#C7E6FF');
      ctx.beginPath();
      ctx.arc(bx, by + 4, 3.4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // 출입문
    ctx.save();
    ctx.fillStyle = '#E9D3B4';
    rr(ctx, 566, WORLD.h - 22, 96, 18, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    rr(ctx, 574, WORLD.h - 18, 80, 6, 3);
    ctx.fill();
    ctx.restore();
  }

  /* ── 가구 ───────────────────────────────── */

  function drawPlant(ctx, x, y, s, tone) {
    s = s || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(110, 80, 50, .18)';
    ctx.beginPath();
    ctx.ellipse(0, 6 * s, 16 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#E8B98C';
    ctx.beginPath();
    ctx.moveTo(-10 * s, 0);
    ctx.lineTo(10 * s, 0);
    ctx.lineTo(7 * s, 14 * s);
    ctx.lineTo(-7 * s, 14 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#D9A373';
    ctx.fillRect(-11 * s, -3 * s, 22 * s, 5 * s);

    var leaves = [
      [-11, -12, -0.9], [-4, -20, -0.3], [4, -21, 0.25], [11, -13, 0.85], [0, -26, 0]
    ];
    var greens = ['#5FBF8E', '#4FAE7D', '#77CFA0', '#3E9C6D', '#8AD8AC'];
    leaves.forEach(function (l, i) {
      ctx.save();
      ctx.translate(l[0] * s, l[1] * s);
      ctx.rotate(l[2]);
      ctx.fillStyle = tone || greens[i % greens.length];
      ctx.beginPath();
      ctx.ellipse(0, 0, 7 * s, 12 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  }

  function drawMonitor(ctx, cx, cy, s, accent) {
    ctx.save();
    ctx.fillStyle = '#D9C6AE';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 17 * s, 14 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#C9B49A';
    ctx.fillRect(cx - 3 * s, cy + 8 * s, 6 * s, 9 * s);

    ctx.save();
    shadow(ctx, 'rgba(106, 130, 220, .45)', 14 * s);
    ctx.fillStyle = '#3B3550';
    rr(ctx, cx - 30 * s, cy - 19 * s, 60 * s, 36 * s, 5 * s);
    ctx.fill();
    ctx.restore();

    var g = ctx.createLinearGradient(cx - 26 * s, cy - 15 * s, cx + 26 * s, cy + 13 * s);
    g.addColorStop(0, accent || '#7C93DD');
    g.addColorStop(1, '#4C5B9C');
    ctx.fillStyle = g;
    rr(ctx, cx - 26 * s, cy - 15 * s, 52 * s, 28 * s, 3 * s);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (var i = 0; i < 4; i++) {
      rr(ctx, cx - 20 * s, cy - 10 * s + i * 6 * s, (10 + ((i * 9) % 20)) * s, 2 * s, 1 * s);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawChair(ctx, x, y, r, color) {
    ctx.save();
    ctx.fillStyle = 'rgba(110,80,50,.15)';
    ctx.beginPath();
    ctx.ellipse(x, y + 3, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color || '#F6D9C0';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,160,120,.45)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    // 등받이
    ctx.strokeStyle = 'rgba(150, 110, 72, .32)';
    ctx.lineWidth = Math.max(2, r * 0.38);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.8, Math.PI * 1.06, Math.PI * 1.94);
    ctx.stroke();
    ctx.restore();
  }

  var DESKS = [
    { x: 80, y: 146, w: 148, h: 62, chair: [154, 226], mug: '#F2789F', paper: true, plant: false },
    { x: 246, y: 146, w: 148, h: 62, chair: [320, 226], mug: '#7A4BE0', paper: false, plant: true },
    { x: 412, y: 146, w: 148, h: 62, chair: [486, 226], mug: '#2FBF94', paper: true, plant: false }
  ];
  DESKS.forEach(function (d) {
    addRect(d.x, d.y, d.w, d.h, 'desk');
    addCircle(d.chair[0], d.chair[1], 14, 'chair');
  });

  function drawDesk(ctx, d, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(110, 80, 50, .17)';
    rr(ctx, d.x + 3, d.y + 9, d.w, d.h, 12);
    ctx.fill();

    var g = ctx.createLinearGradient(0, d.y, 0, d.y + d.h);
    g.addColorStop(0, '#FFF8EC');
    g.addColorStop(1, '#E6C69B');
    ctx.fillStyle = g;
    rr(ctx, d.x, d.y, d.w, d.h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(198, 156, 112, .45)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // 서랍 라인
    ctx.strokeStyle = 'rgba(198, 156, 112, .3)';
    ctx.beginPath();
    ctx.moveTo(d.x + 8, d.y + d.h - 16);
    ctx.lineTo(d.x + d.w - 8, d.y + d.h - 16);
    ctx.stroke();

    drawChair(ctx, d.chair[0], d.chair[1], 15, '#F3D3B8');

    drawMonitor(ctx, d.x + d.w / 2, d.y + 20, 0.82);

    // 키보드
    ctx.fillStyle = '#F5E6D4';
    rr(ctx, d.x + d.w / 2 - 26, d.y + d.h - 16, 52, 11, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,150,110,.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 컵
    ctx.fillStyle = d.mug;
    ctx.beginPath();
    ctx.arc(d.x + d.w - 22, d.y + 16, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath();
    ctx.arc(d.x + d.w - 22, d.y + 16, 4.2, 0, Math.PI * 2);
    ctx.fill();
    // 김
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    var sy = -Math.abs(Math.sin(t * 1.2 + d.x)) * 4;
    ctx.moveTo(d.x + d.w - 24, d.y + 7);
    ctx.quadraticCurveTo(d.x + d.w - 20, d.y + 2 + sy, d.x + d.w - 24, d.y - 4 + sy);
    ctx.stroke();

    if (d.paper) {
      ctx.save();
      ctx.translate(d.x + 22, d.y + d.h - 20);
      ctx.rotate(-0.12);
      ctx.fillStyle = '#FFFFFF';
      rr(ctx, 0, 0, 26, 18, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,200,210,.8)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(4, 6); ctx.lineTo(22, 6);
      ctx.moveTo(4, 10); ctx.lineTo(18, 10);
      ctx.stroke();
      ctx.restore();
    }
    if (d.plant) {
      drawPlant(ctx, d.x + d.w - 18, d.y + d.h - 8, 0.62, '#79CE9F');
    }
    ctx.restore();
  }

  /* 업무 데스크존 소품 */
  function drawWorkCorner(ctx) {
    // 책장
    ctx.save();
    ctx.fillStyle = 'rgba(110,80,50,.15)';
    rr(ctx, 96, 302, 168, 44, 9);
    ctx.fill();
    ctx.fillStyle = '#F7E7D1';
    rr(ctx, 92, 296, 168, 44, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(198,156,112,.5)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    var books = ['#E8469B', '#7A4BE0', '#2FBF94', '#F2A227', '#5C8CF0', '#F2789F', '#8FD9BE', '#C9B8F2'];
    for (var i = 0; i < 8; i++) {
      ctx.fillStyle = books[i];
      rr(ctx, 102 + i * 12, 310 + (i % 3) * 2, 9, 22 - (i % 3) * 2, 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    rr(ctx, 210, 306, 40, 24, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,170,135,.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    addRect(92, 296, 168, 44, 'bookshelf');

    drawPlant(ctx, 300, 320, 0.85, '#6BC99A');
    addCircle(300, 320, 10, 'plant');

    // 공용 라운드 테이블
    ctx.save();
    ctx.fillStyle = 'rgba(110,80,50,.13)';
    ctx.beginPath();
    ctx.ellipse(440, 322, 40, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F6E3C8';
    ctx.beginPath();
    ctx.ellipse(438, 316, 38, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,150,110,.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(430, 312, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E8469B';
    ctx.beginPath();
    ctx.arc(448, 320, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    addRect(410, 300, 60, 40, 'lounge-table');
  }

  /* 회의 라운지 */
  var TABLE = { x: 900, y: 236, r: 72 };
  addCircle(TABLE.x, TABLE.y, TABLE.r + 4, 'table');

  function drawMeeting(ctx, t) {
    // 의자
    for (var i = 0; i < 6; i++) {
      var a = (Math.PI * 2 / 6) * i + 0.35;
      var cx = TABLE.x + Math.cos(a) * (TABLE.r + 34);
      var cy = TABLE.y + Math.sin(a) * (TABLE.r + 34);
      drawChair(ctx, cx, cy, 16, i % 2 ? '#EFE6FF' : '#E4DCFF');
    }

    ctx.save();
    ctx.fillStyle = 'rgba(110, 80, 50, .18)';
    ctx.beginPath();
    ctx.ellipse(TABLE.x, TABLE.y + 8, TABLE.r + 2, TABLE.r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();

    var g = ctx.createRadialGradient(TABLE.x - 24, TABLE.y - 30, 10, TABLE.x, TABLE.y, TABLE.r);
    g.addColorStop(0, '#FFF7EC');
    g.addColorStop(1, '#E3C399');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(TABLE.x, TABLE.y, TABLE.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190, 148, 106, .55)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(210, 175, 135, .45)';
    ctx.beginPath();
    ctx.arc(TABLE.x, TABLE.y, TABLE.r * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    // 회의 소품
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(TABLE.x - 20, TABLE.y - 6, 18, 12, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,200,215,.9)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(TABLE.x - 32, TABLE.y - 10); ctx.lineTo(TABLE.x - 8, TABLE.y - 10);
    ctx.moveTo(TABLE.x - 32, TABLE.y - 4); ctx.lineTo(TABLE.x - 14, TABLE.y - 4);
    ctx.stroke();

    // 노트북
    ctx.fillStyle = '#4B4763';
    rr(ctx, TABLE.x + 14, TABLE.y - 16, 34, 24, 4);
    ctx.fill();
    ctx.fillStyle = '#8C93C8';
    rr(ctx, TABLE.x + 17, TABLE.y - 13, 28, 16, 2);
    ctx.fill();

    // 컵들
    [['#E8469B', 26, 28], ['#7A4BE0', -4, 34], ['#2FBF94', -34, 14]].forEach(function (c) {
      ctx.fillStyle = c[0];
      ctx.beginPath();
      ctx.arc(TABLE.x + c[1], TABLE.y + c[2], 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath();
      ctx.arc(TABLE.x + c[1], TABLE.y + c[2], 3.8, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();

    // 화이트보드 (벽)
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    rr(ctx, 758, 12, 232, 58, 6);
    ctx.fill();
    ctx.strokeStyle = '#D9C6AE';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120, 140, 200, .55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(772, 30); ctx.lineTo(906, 30);
    ctx.moveTo(772, 40); ctx.lineTo(878, 40);
    ctx.moveTo(772, 50); ctx.lineTo(900, 50);
    ctx.stroke();
    // 스티키 노트
    [['#FFE073', 928, 24], ['#FFB3CE', 952, 24], ['#B9E7CF', 976, 24]].forEach(function (n) {
      ctx.save();
      ctx.translate(n[1], n[2]);
      ctx.rotate(-0.08);
      ctx.fillStyle = n[0];
      ctx.fillRect(0, 0, 16, 16);
      ctx.restore();
    });
    ctx.fillStyle = '#E8469B';
    ctx.fillRect(760, 66, 6, 4);
    ctx.restore();

    drawPlant(ctx, 690, 322, 1.05);
    drawPlant(ctx, 1112, 316, 0.85, '#79CE9F');
    addCircle(690, 322, 12, 'plant');
    addCircle(1112, 316, 10, 'plant');

    // 사이드 보드
    ctx.save();
    ctx.fillStyle = 'rgba(110,80,50,.15)';
    rr(ctx, 986, 300, 128, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#F7E7D1';
    rr(ctx, 984, 296, 126, 38, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(198,156,112,.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    addRect(984, 296, 126, 38, 'sideboard');
    drawPlant(ctx, 1020, 292, 0.5, '#79CE9F');
  }

  /* 카페 */
  function drawCafe(ctx, t) {
    // 뒷 벤치(수납장)
    ctx.save();
    ctx.fillStyle = 'rgba(110,80,50,.15)';
    rr(ctx, 84, 446, 268, 48, 10);
    ctx.fill();
    ctx.fillStyle = '#FBEFDD';
    rr(ctx, 80, 440, 268, 48, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(198,156,112,.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // 컵 진열
    for (var i = 0; i < 6; i++) {
      ctx.fillStyle = ['#E8469B', '#7A4BE0', '#2FBF94', '#F2A227', '#5C8CF0', '#F2789F'][i];
      ctx.beginPath();
      ctx.arc(106 + i * 38, 464, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath();
      ctx.arc(106 + i * 38, 464, 4.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    addRect(80, 440, 268, 48, 'shelf');

    // 메뉴판
    ctx.save();
    ctx.fillStyle = '#3F3A4E';
    rr(ctx, 386, 424, 96, 60, 6);
    ctx.fill();
    ctx.strokeStyle = '#C9B99F';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.fillStyle = '#FFF3E2';
    ctx.font = '10px "Jua", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MENU', 434, 442);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.font = '8px "Gowun Dodum", sans-serif';
    ctx.fillText('라떼  4,500', 434, 456);
    ctx.fillText('아메리카노  3,500', 434, 468);
    ctx.textAlign = 'left';
    ctx.restore();

    // 카운터
    ctx.save();
    ctx.fillStyle = 'rgba(110,80,50,.18)';
    rr(ctx, 84, 570, 300, 78, 14);
    ctx.fill();
    var cg = ctx.createLinearGradient(0, 556, 0, 640);
    cg.addColorStop(0, '#FFF4E4');
    cg.addColorStop(1, '#E9CFAE');
    ctx.fillStyle = cg;
    rr(ctx, 80, 556, 300, 78, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(198,156,112,.5)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // 나무 상판
    ctx.fillStyle = '#D9A97C';
    rr(ctx, 80, 548, 300, 20, 9);
    ctx.fill();
    ctx.restore();

    // 에스프레소 머신
    ctx.save();
    ctx.fillStyle = '#C9CED8';
    rr(ctx, 268, 512, 74, 42, 6);
    ctx.fill();
    ctx.fillStyle = '#9AA3B2';
    rr(ctx, 274, 506, 62, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#E8469B';
    ctx.beginPath();
    ctx.arc(288, 532, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5B6272';
    rr(ctx, 300, 546, 8, 12, 2);
    ctx.fill();
    rr(ctx, 318, 546, 8, 12, 2);
    ctx.fill();
    ctx.restore();
    addRect(268, 506, 74, 50, 'machine');

    // 바닥 스툴
    drawChair(ctx, 150, 664, 14, '#FFD8E5');
    drawChair(ctx, 208, 664, 14, '#FFD8E5');
    // 카운터 위 컵
    ctx.fillStyle = '#FFFFFF';
    rr(ctx, 120, 530, 18, 18, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,180,160,.8)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 소파
    ctx.save();
    ctx.fillStyle = 'rgba(110,80,50,.17)';
    rr(ctx, 428, 476, 152, 66, 18);
    ctx.fill();
    ctx.fillStyle = '#F3BFD4';
    rr(ctx, 424, 468, 152, 66, 18);
    ctx.fill();
    ctx.fillStyle = '#FFD8E6';
    rr(ctx, 434, 478, 62, 44, 12);
    ctx.fill();
    rr(ctx, 500, 478, 62, 44, 12);
    ctx.fill();
    ctx.fillStyle = '#E9A7C2';
    ctx.beginPath();
    ctx.arc(430, 500, 12, 0, Math.PI * 2);
    ctx.arc(570, 500, 12, 0, Math.PI * 2);
    ctx.fill();
    // 쿠션
    ctx.fillStyle = '#FFC3DA';
    rr(ctx, 448, 486, 26, 22, 8);
    ctx.fill();
    ctx.restore();
    addRect(424, 468, 152, 66, 'sofa');

    // 커피 테이블
    ctx.save();
    ctx.fillStyle = 'rgba(110,80,50,.15)';
    ctx.beginPath();
    ctx.ellipse(506, 616, 56, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FBEDD8';
    ctx.beginPath();
    ctx.ellipse(504, 610, 54, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(198,156,112,.5)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // 잡지
    ctx.fillStyle = '#FFFFFF';
    rr(ctx, 480, 600, 22, 16, 2);
    ctx.fill();
    ctx.fillStyle = '#E8469B';
    ctx.beginPath();
    ctx.arc(516, 608, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.beginPath();
    ctx.arc(516, 608, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    addRect(452, 586, 104, 50, 'table');

    // 러그
    ctx.save();
    ctx.fillStyle = 'rgba(255, 214, 232, .55)';
    ctx.beginPath();
    ctx.ellipse(500, 590, 112, 92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawPlant(ctx, 510, 710, 1.1, '#6BC99A');
    addCircle(510, 710, 13, 'plant');
    drawPlant(ctx, 78, 690, 0.9, '#6BC99A');
    addCircle(78, 690, 11, 'plant');

    // 펜던트 조명
    [['#FFD48C', 190, 520], ['#FFB6D5', 300, 500]].forEach(function (l) {
      var g = ctx.createRadialGradient(l[1], l[2], 2, l[1], l[2], 40);
      g.addColorStop(0, alpha(l[0], .55));
      g.addColorStop(1, alpha(l[0], 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(l[1], l[2], 40, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /* 포커스 부스 */
  var BOOTHS = [
    { x: 660, y: 452, w: 140, h: 120, tone: '#8FD9BE', dark: '#4FAE8C' },
    { x: 830, y: 452, w: 140, h: 120, tone: '#A9C0F5', dark: '#6E88D8' },
    { x: 1000, y: 452, w: 140, h: 120, tone: '#F2B7CE', dark: '#D77CA2' }
  ];
  BOOTHS.forEach(function (b) { addRect(b.x, b.y, b.w, b.h, 'booth'); });

  function drawFocus(ctx, t) {
    BOOTHS.forEach(function (b, i) {
      ctx.save();
      ctx.fillStyle = 'rgba(110,80,50,.17)';
      rr(ctx, b.x + 4, b.y + 10, b.w, b.h, 18);
      ctx.fill();

      // 부스 몸체
      ctx.fillStyle = lighten(b.tone, .55);
      rr(ctx, b.x, b.y, b.w, b.h, 18);
      ctx.fill();
      ctx.strokeStyle = alpha(b.dark, .5);
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // 안쪽 벽
      ctx.fillStyle = alpha(b.tone, .55);
      rr(ctx, b.x + 10, b.y + 10, b.w - 20, b.h - 20, 14);
      ctx.fill();

      // 데스크
      ctx.fillStyle = '#FFF7EA';
      rr(ctx, b.x + 24, b.y + 46, b.w - 48, 30, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(190,150,110,.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      drawMonitor(ctx, b.x + b.w / 2, b.y + 40, 0.5);

      // 의자
      ctx.fillStyle = alpha(b.tone, .9);
      ctx.beginPath();
      ctx.ellipse(b.x + b.w / 2, b.y + 96, 20, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // 커튼
      ctx.strokeStyle = alpha(b.dark, .45);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x + 8, b.y + 16);
      ctx.quadraticCurveTo(b.x + 2, b.y + b.h / 2, b.x + 8, b.y + b.h - 16);
      ctx.moveTo(b.x + b.w - 8, b.y + 16);
      ctx.quadraticCurveTo(b.x + b.w - 2, b.y + b.h / 2, b.x + b.w - 8, b.y + b.h - 16);
      ctx.stroke();

      // 스탠드 불빛
      var lampX = b.x + b.w - 26, lampY = b.y + 22;
      var g = ctx.createRadialGradient(lampX, lampY, 1, lampX, lampY, 26);
      g.addColorStop(0, 'rgba(255, 226, 150, .85)');
      g.addColorStop(1, 'rgba(255, 226, 150, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lampX, lampY, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFD684';
      ctx.beginPath();
      ctx.arc(lampX, lampY, 4, 0, Math.PI * 2);
      ctx.fill();

      // FOCUS 라벨
      ctx.fillStyle = alpha(b.dark, .8);
      ctx.font = '9px "Jua", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('FOCUS 0' + (i + 1), b.x + 14, b.y + b.h - 12);

      ctx.restore();
    });

    // 화분, 프린터
    drawPlant(ctx, 692, 700, 1.05, '#6BC99A');
    addCircle(692, 700, 13, 'plant');

    ctx.save();
    ctx.fillStyle = 'rgba(110,80,50,.15)';
    rr(ctx, 984, 690, 108, 46, 8);
    ctx.fill();
    ctx.fillStyle = '#EEF2F7';
    rr(ctx, 982, 686, 106, 44, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,192,208,.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#CBD5E3';
    rr(ctx, 996, 694, 34, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#A9B6C8';
    ctx.beginPath();
    ctx.arc(1070, 700, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    addRect(982, 686, 106, 44, 'printer');
  }

  /* 존 라벨 */
  function drawZoneLabels(ctx) {
    ZONES.forEach(function (z) {
      ctx.save();
      ctx.font = '12px "Jua", "Apple SD Gothic Neo", sans-serif';
      var text = z.label;
      var w = ctx.measureText(text).width + 34;
      ctx.fillStyle = 'rgba(255, 253, 248, .82)';
      rr(ctx, z.x + 14, z.y + 12, w, 24, 12);
      ctx.fill();
      ctx.fillStyle = z.dot;
      ctx.beginPath();
      ctx.arc(z.x + 26, z.y + 24, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6B5B70';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, z.x + 36, z.y + 24.5);
      ctx.restore();
    });
  }

  /* 씬 캐시 */
  var sceneCache = null;
  var SCALE = 2;

  function buildScene() {
    var c = document.createElement('canvas');
    c.width = WORLD.w * SCALE;
    c.height = WORLD.h * SCALE;
    var ctx = c.getContext('2d');
    ctx.scale(SCALE, SCALE);
    var t = 0;
    drawFloor(ctx);
    drawWalls(ctx);
    DESKS.forEach(function (d) { drawDesk(ctx, d, t); });
    drawWorkCorner(ctx);
    drawMeeting(ctx, t);
    drawCafe(ctx, t);
    drawFocus(ctx, t);
    return c;
  }

  function scene() {
    if (!sceneCache) sceneCache = buildScene();
    return sceneCache;
  }

  /* ── 피클 캐릭터 ─────────────────────────── */

  var R = 30;

  function drawPickle(ctx, ch, t, isSelf) {
    var x = ch.dx, y = ch.dy;
    var walking = !!ch.moving;
    var bob = walking ? Math.abs(Math.sin(t * 9 + ch.phase)) * 3.2 : Math.sin(t * 2 + ch.phase) * 1.4;
    var flip = ch.facing < 0 ? -1 : 1;

    ctx.save();
    ctx.translate(x, y);

    // 바닥 그림자
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#6B4A2E';
    ctx.beginPath();
    ctx.ellipse(0, R * 0.92, R * 0.82, R * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 내 캐릭터 표시
    if (isSelf) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.ellipse(0, R * 0.92, R * 0.98, R * 0.33, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.translate(0, -bob);

    // 꼬리
    ctx.save();
    ctx.fillStyle = darken(ch.body, 0.08);
    ctx.beginPath();
    ctx.ellipse(-flip * R * 0.84, R * 0.42, R * 0.22, R * 0.18, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 몸통 + 빛무리
    ctx.save();
    ctx.shadowColor = ch.glow;
    ctx.shadowBlur = ch.glow === '#FFFFFF' || ch.glow === '#ffffff' ? 18 : 26;
    var g = ctx.createLinearGradient(0, -R * 1.1, 0, R * 1.1);
    g.addColorStop(0, lighten(ch.body, 0.24));
    g.addColorStop(0.62, ch.body);
    g.addColorStop(1, darken(ch.body, 0.14));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 0.99, R * 1.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 깃털 귀
    [-1, 1].forEach(function (s) {
      ctx.save();
      ctx.translate(s * R * 0.84, -R * 0.1);
      for (var i = -1; i <= 1; i++) {
        ctx.save();
        ctx.rotate(i * 0.52 + s * 0.1);
        ctx.fillStyle = i === 0 ? ch.accent : mix(ch.accent, '#ffffff', i < 0 ? 0.22 : 0.12);
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
        ctx.fillStyle = '#2C2330';
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
        ctx.strokeStyle = '#2C2330';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-R * 0.16, 0);
        ctx.quadraticCurveTo(0, R * 0.12, R * 0.16, 0);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 몸 하이라이트
    ctx.save();
    ctx.globalAlpha = .35;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(-R * 0.34, -R * 0.52, R * 0.26, R * 0.17, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 볼
    ctx.fillStyle = 'rgba(255, 130, 178, .38)';
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

    // 입 (보라 립)
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
    ctx.font = '600 11px "Jua", "Apple SD Gothic Neo", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ZONES.forEach(function (z) {
      var p = toScreen(z.x + 14, z.y + 12, view);
      var w = ctx.measureText(z.label).width + 32;
      if (p.x > view.cw + 4 || p.y > view.ch + 4 || p.x + w < -4 || p.y + 22 < -4) return;
      ctx.fillStyle = 'rgba(255, 253, 248, .86)';
      rr(ctx, p.x, p.y, w, 22, 11);
      ctx.fill();
      ctx.strokeStyle = 'rgba(232, 216, 196, .7)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = z.dot;
      ctx.beginPath();
      ctx.arc(p.x + 12, p.y + 11, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6B5B70';
      ctx.fillText(z.label, p.x + 21, p.y + 11.5);
    });
    ctx.restore();
  }

  function drawBubble(ctx, ch, p, radius, now) {
    if (!ch.bubble || ch.bubble.until < now) return;
    var text = ch.bubble.text;
    if (!text) return;

    ctx.save();
    ctx.font = '600 12px "Gowun Dodum", "Apple SD Gothic Neo", sans-serif';
    var lines = wrapText(ctx, text, 152);
    var w = 26;
    for (var i = 0; i < lines.length; i++) {
      w = Math.max(w, ctx.measureText(lines[i]).width + 22);
    }
    var lh = 16;
    var h = lines.length * lh + 12;
    var bx = p.x - w / 2;
    var by = p.y - radius * 1.5 - 8 - h;

    ctx.globalAlpha = Math.min(1, Math.max(0, (ch.bubble.until - now) / 0.3));

    ctx.save();
    shadow(ctx, 'rgba(90, 60, 80, .2)', 12, 0, 4);
    ctx.fillStyle = '#FFFFFF';
    rr(ctx, bx, by, w, h, 12);
    ctx.fill();
    noShadow(ctx);
    ctx.beginPath();
    ctx.moveTo(p.x - 6, by + h - 1);
    ctx.lineTo(p.x, by + h + 8);
    ctx.lineTo(p.x + 7, by + h - 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#3E3140';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var j = 0; j < lines.length; j++) {
      ctx.fillText(lines[j], p.x, by + 6 + lh * (j + 0.5) + 1);
    }
    ctx.restore();
  }

  function statusLabel(status) {
    return { work: '업무중', meeting: '회의중', break: '휴식중', out: '외출중' }[status] || '업무중';
  }
  var STATUS_COLOR = { work: '#2FBF94', meeting: '#5C7EE8', break: '#F2A227', out: '#9C90AE' };

  function drawNameTag(ctx, ch, p, radius, isSelf) {
    ctx.save();
    ctx.font = '600 10.5px "Gowun Dodum", "Apple SD Gothic Neo", sans-serif';
    var label = ch.name + (isSelf ? ' (나)' : '');
    var w = ctx.measureText(label).width + 20;
    var y = p.y + radius * 0.98 + 5;

    ctx.fillStyle = isSelf ? 'rgba(232, 70, 155, .94)' : 'rgba(255,253,249,.94)';
    rr(ctx, p.x - w / 2, y, w, 18, 9);
    ctx.fill();
    if (!isSelf) {
      ctx.strokeStyle = 'rgba(228, 212, 194, .85)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = STATUS_COLOR[ch.status] || '#2FBF94';
    ctx.beginPath();
    ctx.arc(p.x - w / 2 + 8, y + 9, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isSelf ? '#fff' : '#5B4A60';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x - w / 2 + 14, y + 9.5);
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
    var g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#FFF4E6');
    g.addColorStop(0.55, '#FFEFF7');
    g.addColorStop(1, '#F1ECFF');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 바닥 그림자 원
    ctx.fillStyle = 'rgba(232, 70, 155, .08)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.82, 62, 20, 0, 0, Math.PI * 2);
    ctx.fill();

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
    ctx.scale(1.85, 1.85);
    ctx.translate(-w / 2, -ch.dy);
    drawPickle(ctx, ch, 0.4, false);
    ctx.restore();
  }

  /* ── 렌더 진입점 ────────────────────────── */

  function drawScene(ctx, view, chars, me, now) {
    ctx.save();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

    var bg = ctx.createLinearGradient(0, 0, 0, view.ch);
    bg.addColorStop(0, '#FBEDDA');
    bg.addColorStop(1, '#F4DDC0');
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
    var vg = ctx.createRadialGradient(view.cw / 2, view.ch / 2, Math.min(view.cw, view.ch) * 0.34,
                                      view.cw / 2, view.ch / 2, Math.max(view.cw, view.ch) * 0.72);
    vg.addColorStop(0, 'rgba(96, 62, 34, 0)');
    vg.addColorStop(1, 'rgba(96, 62, 34, .13)');
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
