/* ─────────────────────────────────────────────
   Cream Office — app.js
   크림 본부 3D 오피스: 파트 현황 · 회의실 · 작업실 · 현황 · 메모
   실시간 동기화: js/net.js (MQTT) + BroadcastChannel, 저장: localStorage
   ───────────────────────────────────────────── */
(function () {
  'use strict';

  var LS_KEY = 'cream-office-v4';
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
  function timeLabel(ts) {
    var d = new Date(ts);
    var h = d.getHours(), m = d.getMinutes();
    var ap = h < 12 ? '오전' : '오후';
    var hh = h % 12; if (hh === 0) hh = 12;
    return ap + ' ' + hh + ':' + (m < 10 ? '0' + m : m);
  }

  var store = {
    get: function (k, fb) { try { var v = localStorage.getItem(k); return v === null ? fb : v; } catch (e) { return fb; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* noop */ } },
    json: function (k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
  };

  var PALETTE = ['#e85aa6', '#5b76e8', '#e9932f', '#2aa98a', '#7b61d9', '#c2a15a'];

  var DEFAULT_PARTS = [
    { id: 'chief', name: '크림', role: '지휘', zone: '지휘실', accent: '#e85aa6', on: true,
      status: '대표님 지시를 기다리는 중', line: '오늘 일정은 제가 정리해 둘게요.', anchor: [53, 18] },
    { id: 'plan', name: '모아', role: '기획·일정', zone: '기획·일정', accent: '#5b76e8', on: true,
      status: '이번 주 계획표 정리 중', line: '화요일 리뷰는 오전 10시로 잡아둘게요.', anchor: [31, 47] },
    { id: 'dev', name: '코다', role: '개발·리서치', zone: '개발·리서치', accent: '#e9932f', on: true,
      status: '경쟁사 자료 조사 중', line: '비교표 초안은 오후에 올려둘게요.', anchor: [47, 53] },
    { id: 'ops', name: '하루', role: '총무·운영', zone: '총무·운영', accent: '#2aa98a', on: true,
      status: '비품과 회의실 정리 중', line: '회의실 예약은 제가 챙겼어요.', anchor: [64, 44] }
  ];

  var SPACES = [
    { id: 'chief', label: '지휘실', x: 52, y: 40.5, kind: 'part', name: '지휘실' },
    { id: 'meeting', label: '대회의실', x: 20.5, y: 43, kind: 'room' },
    { id: 'plan', label: '기획·일정', x: 30, y: 69.5, kind: 'part' },
    { id: 'dev', label: '개발·리서치', x: 48.5, y: 60, kind: 'part' },
    { id: 'ops', label: '총무·운영', x: 64.5, y: 51, kind: 'part' },
    { id: 'lounge', label: '라운지', x: 77.5, y: 71.5, kind: 'room' }
  ];

  var ROOMS = {
    meeting: {
      title: '대회의실',
      desc: '유리로 나뉜 6인 회의실. 여기서 정한 일은 회의실 탭 대화로 바로 이어집니다.',
      status: '예약 없음 · 바로 사용할 수 있어요',
      action: '회의실로 가기',
      prefill: ''
    },
    lounge: {
      title: '라운지',
      desc: '커피와 잠깐의 숨. 파트들이 하루에 한 번씩 여기서 쉬어갑니다.',
      status: '조용함 · 다들 집중 중',
      action: '다들 격려 한마디',
      prefill: '다들 수고 많았어요 ☕'
    }
  };

  var REPLIES = {
    chief: [
      '네, 대표님. 제가 먼저 정리해서 올려두겠습니다.',
      '확인했습니다. 우선순위대로 진행할게요.',
      '지금 네 파트 모두 움직이고 있어요. 마무리되면 정리해 드릴게요.',
      '필요한 부분만 짚어 주시면 나머지는 제가 맞춰 둘게요.',
      '오늘은 제가 먼저 움직이고, 결정이 필요한 것만 여쭙겠습니다.'
    ],
    plan: [
      '일정 정리해서 공유드릴게요. 내일 오전에 한 번 더 확인하겠습니다.',
      '이번 주 핵심은 화요일 리뷰와 목요일 보고예요.',
      '회의는 오후 2시로 잡아둘까요? 대표님 편한 시간 알려주세요.',
      '우선순위대로 세 개만 추렸습니다. 나머지는 다음 주로 넘겼어요.',
      '비는 시간은 목요일 오전이에요. 그때 몰아서 잡아도 됩니다.'
    ],
    dev: [
      '리서치 자료 세 건 정리 중입니다. 초안은 오후에 올려둘게요.',
      '경쟁 서비스 비교표는 거의 다 됐어요. 마지막 검수만 남았습니다.',
      '이번 안건은 기술적으로는 문제 없어 보여요. 일정만 확인하면 됩니다.',
      '레퍼런스 링크 모아 두었습니다. 필요하실 때 말씀해 주세요.',
      '새로 나온 사례 두 개 찾았어요. 짧게 요약해서 붙여둘게요.'
    ],
    ops: [
      '비품과 회의실 예약은 제가 챙겼습니다. 빠진 건 없어요.',
      '대표님 자리 주변 정리해 두었어요. 필요한 서류는 데스크 위에 있습니다.',
      '택배는 오후 4시쯤 도착 예정이에요. 받으면 알려드릴게요.',
      '다음 주 외부 미팅 준비물 목록 확인해 두겠습니다.',
      '커피와 다과는 내일 오전에 채워둘게요.'
    ]
  };

  var GREET_REPLIES = [
    '안녕하세요, 대표님. 오늘도 잘 부탁드립니다.',
    '네, 대표님. 다들 자리에 있습니다.',
    '부르셨어요? 바로 확인하겠습니다.'
  ];

  /* ── state ─────────────────────────────── */
  var params = new URLSearchParams(location.search);
  var saved = store.json(LS_KEY, null) || {};

  var S = {
    name: saved.name || '크림',
    owner: saved.owner || '아사월님의 비서',
    accent: saved.accent || '#e85aa6',
    room: params.get('room') || saved.room || 'asawol-office',
    motion: saved.motion !== false,
    tab: 'office',
    parts: Array.isArray(saved.parts) && saved.parts.length ? saved.parts : DEFAULT_PARTS.slice(),
    memos: Array.isArray(saved.memos) ? saved.memos : [
      { id: uid(), text: '주간 보고 초안 다듬기 — 목요일 오전까지', done: false, by: '모아', at: Date.now() - 6e5 },
      { id: uid(), text: '신규 리서치 링크 정리해서 공유', done: false, by: '코다', at: Date.now() - 4e5 },
      { id: uid(), text: '회의실 예약 · 다과 준비', done: true, by: '하루', at: Date.now() - 2e5 }
    ],
    chat: Array.isArray(saved.chat) ? saved.chat.slice(-60) : [],
    memoRev: saved.memoRev || Date.now()
  };
  S.parts.forEach(function (p) {
    if (!p.anchor) {
      var sp = SPACES.filter(function (s) { return s.id === p.id; })[0];
      p.anchor = sp ? [sp.x, sp.y - 12] : [50, 45];
    }
  });

  function save() {
    store.set(LS_KEY, JSON.stringify({
      name: S.name, owner: S.owner, accent: S.accent, room: S.room,
      motion: S.motion, parts: S.parts, memos: S.memos.slice(0, 80),
      chat: S.chat.slice(-60), memoRev: S.memoRev
    }));
  }
  var saveTimer = null;
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 250); }

  function level() {
    var sent = S.chat.filter(function (m) { return m.mine; }).length;
    return clamp(2 + Math.floor(sent / 25), 2, 9);
  }
  function activeParts() { return S.parts.filter(function (p) { return p.on; }); }
  function partById(id) { return S.parts.filter(function (p) { return p.id === id; })[0] || null; }
  function initial(name) { return (name || '?').trim().slice(0, 1); }

  var remotes = {};
  var repliedTo = {};
  var net = null;
  var netState = 'connecting';
  var wasLive = false;

  /* ── net ───────────────────────────────── */
  function bootNet() {
    if (typeof OfficeNet !== 'function') { setNet('local'); return; }
    net = new OfficeNet({
      room: S.room,
      onMessage: onNetMessage,
      onStatus: function (status, info) {
        netState = (status === 'live') ? 'live' : (status === 'connecting' ? 'connecting' : 'local');
        setNet(netState, info);
      }
    });
    net.start();
    setTimeout(function () {
      if (net) net.send({ kind: 'hello', name: S.name, owner: S.owner, level: level(), accent: S.accent });
    }, 400);
    setTimeout(function () { if (net && !net.live) setNet('local'); }, 9000);

    setInterval(function () {
      if (!net) return;
      net.send({ kind: 'state', name: S.name, owner: S.owner, level: level(), accent: S.accent });
    }, 20000);
    setInterval(function () {
      var now = Date.now();
      var changed = false;
      Object.keys(remotes).forEach(function (id) {
        if (now - remotes[id].at > 55000) { delete remotes[id]; changed = true; }
      });
      if (changed) renderCurrent();
    }, 15000);
  }

  function setNet(state, info) {
    var changed = netState !== state;
    netState = state;
    var pill = $('#livePill'), text = $('#liveText');
    if (!pill) return;
    pill.classList.remove('is-local', 'is-connecting');
    if (state === 'live') {
      text.textContent = 'LIVE';
      pill.title = '실시간 연결됨' + (info ? ' · ' + info : '');
      if (!wasLive && net) {
        net.send({ kind: 'hello', name: S.name, owner: S.owner, level: level(), accent: S.accent });
      }
      wasLive = true;
    }
    else if (state === 'connecting') { pill.classList.add('is-connecting'); text.textContent = '연결 중'; }
    else { pill.classList.add('is-local'); text.textContent = '로컬'; pill.title = '이 브라우저 안에서만 동기화'; }
    var foot = document.querySelector('.map-foot span:last-child');
    if (foot) foot.textContent = (state === 'live') ? '실시간 동기화' : '이 브라우저에서';
    if (changed || state === 'live') renderCurrent();
  }

  function onNetMessage(msg) {
    if (!msg || !msg.kind) return;
    if (msg.kind === 'chat') {
      S.chat.push({
        id: msg.id || uid(), mine: false,
        name: msg.name || '피클', role: msg.role || '게스트',
        accent: msg.accent || '#8b95a3',
        text: String(msg.text || '').slice(0, 800),
        at: msg.at || Date.now()
      });
      S.chat = S.chat.slice(-60);
      saveSoon();
      if (S.tab === 'meeting') { renderMessages(); scrollMessages(); }
      else { markTabDot('meeting'); }
      if (S.tab === 'status') renderCurrent();
      return;
    }
    if (msg.kind === 'hello' || msg.kind === 'state') {
      remotes[msg.from] = {
        id: msg.from, name: msg.name || '피클', owner: msg.owner || '',
        level: msg.level || 2, accent: msg.accent || '#8b95a3', at: Date.now()
      };
      if (msg.kind === 'hello' && !repliedTo[msg.from] && net) {
        repliedTo[msg.from] = true;
        net.send({ kind: 'hello', name: S.name, owner: S.owner, level: level(), accent: S.accent });
      }
      if (S.tab === 'status') renderCurrent();
      if (S.tab === 'meeting') renderChatHead();
      return;
    }
    if (msg.kind === 'bye') {
      delete remotes[msg.from];
      if (S.tab === 'status') renderCurrent();
      if (S.tab === 'meeting') renderChatHead();
      return;
    }
    if (msg.kind === 'tasks' && Array.isArray(msg.items)) {
      if ((msg.rev || 0) > (S.memoRev || 0)) {
        S.memos = msg.items.slice(0, 80);
        S.memoRev = msg.rev;
        saveSoon();
        if (S.tab === 'memo' || S.tab === 'status') renderCurrent();
      }
    }
  }

  /* ── render: shell ─────────────────────── */
  function renderChrome() {
    var n = activeParts().length;
    var sub = $('#brandSub');
    if (sub) sub.textContent = '크림 본부 · ' + (n ? n + '개 파트 가동 중' : '잠시 쉬는 중');
    var mark = $('#brandMark');
    if (mark) mark.textContent = 'K.';
    document.title = 'Cream Office · 크림 본부';
  }

  function renderCurrent() {
    renderChrome();
    if (S.tab === 'office') renderOffice();
    else if (S.tab === 'meeting') renderMeeting();
    else if (S.tab === 'workshop') renderWorkshop();
    else if (S.tab === 'status') renderStatus();
    else if (S.tab === 'memo') renderMemo();
  }

  function setTab(tab, opts) {
    opts = opts || {};
    S.tab = tab;
    $$('.tab').forEach(function (b) {
      var on = b.getAttribute('data-tab') === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) b.classList.remove('has-dot');
    });
    $$('.view').forEach(function (v) {
      var on = v.id === 'view-' + tab;
      v.classList.toggle('is-active', on);
      v.hidden = !on;
    });
    renderCurrent();
    if (tab === 'meeting') {
      renderMessages(); scrollMessages();
      if (opts.prefill) setComposer(opts.prefill);
      var input = $('#chatInput');
      if (input && opts.focus && window.innerWidth >= 900) input.focus();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function markTabDot(tab) {
    var b = $('.tab[data-tab="' + tab + '"]');
    if (b && !b.classList.contains('is-active')) b.classList.add('has-dot');
  }

  /* ── render: office ────────────────────── */
  function renderOffice() {
    var host = $('#view-office');
    if (!host) return;
    var act = activeParts();
    var n = act.length;
    var headline = n === 0
      ? '대표님, 지금은 모든 파트가 쉬고 있어요'
      : '대표님, ' + n + '개 파트가 대기 중이에요';

    host.innerHTML =
      '<div class="office-main">' +
        '<section class="card hero">' +
          '<span class="tag">Workspace</span>' +
          '<h2>' + esc(headline) + '</h2>' +
          '<p>공간이나 담당자를 탭하면 최근 진행 현황을 바로 볼 수 있어요.</p>' +
        '</section>' +
        '<div class="chips">' +
          '<button type="button" class="chip dark' + (S.motion ? '' : ' is-off') + '" data-act="motion" aria-pressed="' + (S.motion ? 'true' : 'false') + '">' +
            '<span class="chip-dot" aria-hidden="true"></span>모션 ' + (S.motion ? 'ON' : 'OFF') +
          '</button>' +
          '<span class="chip">가동 ' + n + '파트</span>' +
          '<span class="chip">Lv.' + level() + ' ' + esc(S.name) + '</span>' +
        '</div>' +
        '<section class="card map-card">' +
          '<div class="map" id="map">' +
            '<picture>' +
              '<source srcset="assets/office-diorama.webp" type="image/webp" />' +
              '<img src="assets/office-diorama.jpg" srcset="assets/office-diorama@700.jpg 700w, assets/office-diorama.jpg 1402w" sizes="(min-width: 900px) 700px, 100vw" width="1402" height="1122" alt="크림 본부 3D 아이소메트릭 오피스" fetchpriority="high" decoding="async" />' +
            '</picture>' +
            pinsHTML() +
            '<div class="bubble" id="mapBubble"></div>' +
          '</div>' +
          '<div class="map-foot">' +
            '<span><strong>' + n + '개 파트</strong>가 일하고 있어요</span>' +
            '<span>' + (netState === 'live' ? '실시간 동기화' : '이 브라우저에서') + '</span>' +
          '</div>' +
        '</section>' +
      '</div>' +
      '<aside class="office-side">' +
        '<section class="card side-card">' +
          '<div class="side-head"><h3>지금 이 순간</h3><span>' + timeLabel(Date.now()) + '</span></div>' +
          '<div class="rows">' + partRowsHTML() + '</div>' +
        '</section>' +
        recentChatCardHTML() +
      '</aside>';

    document.body.classList.toggle('motion-on', !!S.motion);
    scheduleBubble();
  }

  function recentChatCardHTML() {
    var last = S.chat.slice(-2);
    if (!last.length) return '';
    var rows = last.map(function (m) {
      return '<div class="row" style="cursor:default">' +
        '<span class="row-avatar" style="background:' + (m.accent || '#8b95a3') + '">' + esc(initial(m.name)) + '</span>' +
        '<span class="row-body">' +
          '<span class="row-title">' + esc(m.mine ? S.name : m.name) +
            '<span class="muted small" style="font-weight:600">· ' + timeLabel(m.at) + '</span></span>' +
          '<span class="row-sub">' + esc(m.text) + '</span>' +
        '</span></div>';
    }).join('');
    return '<section class="card side-card only-desktop">' +
      '<div class="side-head"><h3>회의실 최근 대화</h3><span>' + S.chat.length + '개</span></div>' +
      '<div class="rows">' + rows + '</div>' +
      '<div style="padding:2px 0 12px"><button type="button" class="btn wide" data-act="go-meeting">회의실 열기</button></div>' +
      '</section>';
  }

  function pinsHTML() {
    return SPACES.map(function (sp) {
      var p = sp.kind === 'part' ? partById(sp.id) : null;
      var on = sp.kind === 'part' ? !!(p && p.on) : true;
      return '<button type="button" class="pin' + (on ? '' : ' is-idle') + '" data-act="pin" data-space="' + sp.id + '"' +
        ' style="left:' + sp.x + '%;top:' + sp.y + '%" aria-label="' + esc(sp.label) + ' 현황 보기">' +
        '<span class="dot" aria-hidden="true"></span>' + esc(sp.label) + '</button>';
    }).join('');
  }

  function partRowsHTML() {
    var act = activeParts();
    if (!act.length) {
      return '<div class="empty">모든 파트가 쉬고 있어요.<br>작업실에서 AI 동료를 다시 켤 수 있어요.</div>';
    }
    return act.map(function (p) {
      return '<button type="button" class="row" data-act="pin" data-space="' + p.id + '">' +
        '<span class="row-avatar" style="background:' + p.accent + '">' + esc(initial(p.name)) + '</span>' +
        '<span class="row-body">' +
          '<span class="row-title"><span class="state-dot"></span>' + esc(p.name) +
            '<span class="muted small" style="font-weight:600">· ' + esc(p.role) + '</span></span>' +
          '<span class="row-sub">' + esc(p.status) + '</span>' +
        '</span>' +
        '<svg class="row-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>' +
      '</button>';
    }).join('');
  }

  /* ── speech bubbles ───────────────────── */
  var bubbleTimer = null, bubbleHide = null;
  function scheduleBubble() {
    clearTimeout(bubbleTimer);
    if (!S.motion) return;
    bubbleTimer = setTimeout(function () {
      if (S.tab !== 'office' || !S.motion) { scheduleBubble(); return; }
      var act = activeParts();
      if (!act.length) { scheduleBubble(); return; }
      var p = act[Math.floor(Math.random() * act.length)];
      showBubble(p);
      scheduleBubble();
    }, 6500 + Math.random() * 2500);
  }
  function showBubble(p) {
    var el = $('#mapBubble');
    if (!el) return;
    var a = p.anchor || [50, 40];
    el.style.left = a[0] + '%';
    el.style.top = a[1] + '%';
    el.textContent = p.line;
    el.classList.add('is-show');
    clearTimeout(bubbleHide);
    bubbleHide = setTimeout(function () { el.classList.remove('is-show'); }, 4200);
  }

  /* ── sheet ─────────────────────────────── */
  var sheetOpen = false;
  function openSheet(title, html, onMount) {
    var sheet = $('#sheet'), scrim = $('#scrim');
    $('#sheetTitle').textContent = title;
    $('#sheetBody').innerHTML = html;
    sheet.hidden = false;
    scrim.hidden = false;
    sheetOpen = true;
    document.body.style.overflow = 'hidden';
    if (onMount) onMount($('#sheetBody'));
    var close = $('#sheetClose');
    if (close) close.focus({ preventScroll: true });
  }
  function closeSheet() {
    $('#sheet').hidden = true;
    $('#scrim').hidden = true;
    sheetOpen = false;
    document.body.style.overflow = '';
  }

  function openSpaceSheet(spaceId) {
    var sp = SPACES.filter(function (s) { return s.id === spaceId; })[0];
    if (!sp) return;

    if (sp.kind === 'room') {
      var r = ROOMS[sp.id] || ROOMS.meeting;
      openSheet(r.title,
        '<p class="sheet-note">' + esc(r.desc) + '</p>' +
        '<div class="sheet-line"><span class="state-dot" style="display:inline-block;margin-right:7px"></span>' + esc(r.status) + '</div>' +
        '<div class="sheet-actions">' +
          '<button type="button" class="btn primary" data-act="go-meeting" data-prefill="' + esc(r.prefill) + '">' + esc(r.action) + '</button>' +
          '<button type="button" class="btn" data-act="close-sheet">닫기</button>' +
        '</div>');
      return;
    }

    var p = partById(sp.id);
    if (!p) {
      openSheet(sp.label,
        '<p class="sheet-note">아직 이 자리에 담당 파트가 없어요. 작업실에서 AI 동료를 추가해 보세요.</p>' +
        '<div class="sheet-actions">' +
          '<button type="button" class="btn primary" data-act="go-workshop">작업실로 가기</button>' +
          '<button type="button" class="btn" data-act="close-sheet">닫기</button>' +
        '</div>');
      return;
    }

    var on = p.on;
    openSheet(sp.label,
      '<div class="row" style="padding:0;border:0">' +
        '<span class="row-avatar" style="background:' + p.accent + '">' + esc(initial(p.name)) + '</span>' +
        '<span class="row-body">' +
          '<span class="row-title"><span class="state-dot' + (on ? '' : ' is-off') + '"></span>' + esc(p.name) + '</span>' +
          '<span class="row-sub">' + esc(p.role) + ' · ' + (on ? '가동 중' : '쉬는 중') + '</span>' +
        '</span>' +
      '</div>' +
      '<div class="sheet-line"><b>지금</b> · ' + esc(on ? p.status : '잠시 대기 중이에요') + '</div>' +
      '<div class="sheet-line"><b>최근 한마디</b> · "' + esc(p.line) + '"</div>' +
      '<div class="sheet-actions">' +
        '<button type="button" class="btn primary" data-act="talk-part" data-part="' + p.id + '">' + esc(p.name) + '와 대화</button>' +
        '<button type="button" class="btn" data-act="go-workshop">작업실에서 관리</button>' +
      '</div>');
  }

  function openSettings() {
    openSheet('설정',
      '<div class="field"><label for="setName">내 피클 이름</label>' +
        '<input id="setName" maxlength="12" value="' + esc(S.name) + '" /></div>' +
      '<div class="field"><label for="setOwner">소개</label>' +
        '<input id="setOwner" maxlength="30" value="' + esc(S.owner) + '" /></div>' +
      '<div class="field"><label for="setRoom">방 이름 (같은 이름이면 실시간으로 이어져요)</label>' +
        '<input id="setRoom" maxlength="32" value="' + esc(S.room) + '" /></div>' +
      '<div class="field"><label>색상</label><div class="swatches" id="setSwatches">' +
        PALETTE.map(function (c) {
          return '<button type="button" class="swatch" data-act="swatch" data-color="' + c + '" aria-pressed="' + (S.accent === c) + '" style="background:' + c + '"></button>';
        }).join('') + '</div></div>' +
      '<div class="sheet-actions">' +
        '<button type="button" class="btn primary" data-act="save-settings">저장</button>' +
        '<button type="button" class="btn" data-act="copy-invite">초대 링크 복사</button>' +
      '</div>' +
      '<p class="hint">설정은 이 브라우저에 저장돼요. 방 이름을 바꾸면 새 방으로 이어집니다.</p>',
      function (root) {
        $$('.swatch', root).forEach(function (b) {
          b.addEventListener('click', function () {
            $$('.swatch', root).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
            b.setAttribute('aria-pressed', 'true');
          });
        });
      });
  }

  function openAddPart(editId) {
    var p = editId ? partById(editId) : null;
    var roles = ['기획·일정', '개발·리서치', '총무·운영', '리서치', '콘텐츠', '고객 응대'];
    openSheet(p ? 'AI 동료 수정' : 'AI 동료 추가',
      '<div class="field"><label for="apName">이름</label>' +
        '<input id="apName" maxlength="10" placeholder="예: 모아" value="' + esc(p ? p.name : '') + '" /></div>' +
      '<div class="field"><label for="apRole">담당 파트</label>' +
        '<input id="apRole" maxlength="16" placeholder="예: 기획·일정" value="' + esc(p ? p.role : '') + '" list="roleList" />' +
        '<datalist id="roleList">' + roles.map(function (r) { return '<option value="' + r + '">'; }).join('') + '</datalist></div>' +
      '<div class="field"><label for="apStatus">지금 하는 일</label>' +
        '<input id="apStatus" maxlength="40" placeholder="예: 이번 주 계획표 정리 중" value="' + esc(p ? p.status : '') + '" /></div>' +
      '<div class="field"><label>색상</label><div class="swatches" id="apSwatches">' +
        PALETTE.map(function (c) {
          var cur = p ? p.accent === c : c === '#7b61d9';
          return '<button type="button" class="swatch" data-color="' + c + '" aria-pressed="' + cur + '" style="background:' + c + '"></button>';
        }).join('') + '</div></div>' +
      '<div class="sheet-actions">' +
        '<button type="button" class="btn primary" data-act="save-part" data-edit="' + (p ? p.id : '') + '">' + (p ? '저장' : '동료 들이기') + '</button>' +
        (p ? '<button type="button" class="btn danger" data-act="ask-remove-part" data-part="' + p.id + '">내보내기</button>' : '') +
      '</div>',
      function (root) {
        $$('.swatch', root).forEach(function (b) {
          b.addEventListener('click', function () {
            $$('.swatch', root).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
            b.setAttribute('aria-pressed', 'true');
          });
        });
      });
  }

  function savePart(editId, root) {
    var name = ($('#apName', root) || {}).value;
    name = (name || '').trim();
    var role = (($('#apRole', root) || {}).value || '').trim();
    var status = (($('#apStatus', root) || {}).value || '').trim();
    var sw = $('.swatch[aria-pressed="true"]', root);
    var accent = sw ? sw.getAttribute('data-color') : PALETTE[0];
    if (!name) { toast('이름을 적어 주세요'); return; }

    if (editId) {
      var p = partById(editId);
      if (!p) return;
      p.name = name;
      p.role = role || p.role;
      p.status = status || p.status;
      p.accent = accent;
      if (editId === 'chief') { S.name = name; S.accent = accent; }
    } else {
      var id = 'p' + uid().slice(0, 6);
      S.parts.push({
        id: id, name: name, role: role || '새 파트', zone: role || '새 파트',
        accent: accent, on: true, status: status || '새로 합류했어요',
        line: name + '입니다. 잘 부탁드립니다!', anchor: [50, 44]
      });
    }
    save();
    closeSheet();
    toast(editId ? '동료 정보를 저장했어요' : name + ' 님이 합류했어요');
    renderCurrent();
    if (net) net.send({ kind: 'state', name: S.name, owner: S.owner, level: level(), accent: S.accent });
  }

  function askRemovePart(id) {
    var p = partById(id);
    if (!p) return;
    openSheet('동료 내보내기',
      '<p class="sheet-note">' + esc(p.name) + ' 님을 작업실에서 내보낼까요? 메모와 대화는 그대로 남습니다.</p>' +
      '<div class="sheet-actions">' +
        '<button type="button" class="btn danger" data-act="remove-part" data-part="' + id + '">내보내기</button>' +
        '<button type="button" class="btn" data-act="close-sheet">취소</button>' +
      '</div>');
  }

  function removePart(id) {
    S.parts = S.parts.filter(function (p) { return p.id !== id; });
    save(); closeSheet(); renderCurrent();
    toast('동료를 내보냈어요');
  }

  function togglePart(id) {
    var p = partById(id);
    if (!p) return;
    p.on = !p.on;
    p.status = p.on ? p.status.replace(/^쉬는 중/, '대기 중') : p.status;
    save(); renderCurrent();
  }

  /* ── render: meeting ───────────────────── */
  function renderMeeting() {
    var host = $('#view-meeting');
    if (!host) return;
    host.innerHTML =
      '<div class="meeting-grid">' +
        '<section class="card chat-card">' +
          '<div class="chat-head">' +
            '<div><h2>회의실</h2><div class="sub" id="chatSub"></div></div>' +
            '<div class="party" id="chatParty"></div>' +
          '</div>' +
          '<div class="messages" id="messages" aria-live="polite"></div>' +
          '<div class="quick-row" id="quickRow"></div>' +
          '<form class="composer" id="composer" autocomplete="off">' +
            '<input id="chatInput" maxlength="400" placeholder="AI 동료에게 말을 걸어 보세요" aria-label="메시지" />' +
            '<button type="submit" id="sendBtn">전송</button>' +
          '</form>' +
        '</section>' +
        '<aside class="office-side">' +
          '<section class="card side-card">' +
            '<div class="side-head"><h3>이 방의 파트</h3><span id="partyCount"></span></div>' +
            '<div class="rows" id="partyRows"></div>' +
            '<p class="hint" style="padding:6px 2px 10px">빠른 인사로 대화를 시작해 보세요. 답장은 동료들이 직접 남깁니다.</p>' +
          '</section>' +
        '</aside>' +
      '</div>';

    $('#composer').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#chatInput');
      var v = (input.value || '').trim();
      if (!v) return;
      input.value = '';
      sendChat(v);
    });

    renderChatHead();
    renderQuick();
    renderMessages();
    renderPartyRows();
    scrollMessages();
  }

  function renderChatHead() {
    var sub = $('#chatSub');
    if (sub) sub.textContent = 'AI 동료 ' + activeParts().length + '명' + (Object.keys(remotes).length ? ' · 피클 ' + Object.keys(remotes).length + '명' : '');
    var party = $('#chatParty');
    if (!party) return;
    var act = activeParts();
    party.innerHTML = act.slice(0, 4).map(function (p) {
      return '<span class="row-avatar" style="background:' + p.accent + '" title="' + esc(p.name) + '">' + esc(initial(p.name)) + '</span>';
    }).join('') + (act.length > 4 ? '<span class="more">+' + (act.length - 4) + '</span>' : '');
  }

  function renderPartyRows() {
    var host = $('#partyRows');
    if (!host) return;
    var act = activeParts();
    var html = act.map(function (p) {
      return '<button type="button" class="row" data-act="talk-part" data-part="' + p.id + '">' +
        '<span class="row-avatar" style="background:' + p.accent + '">' + esc(initial(p.name)) + '</span>' +
        '<span class="row-body">' +
          '<span class="row-title"><span class="state-dot"></span>' + esc(p.name) + '</span>' +
          '<span class="row-sub">' + esc(p.role) + '</span>' +
        '</span></button>';
    }).join('');
    Object.keys(remotes).forEach(function (id) {
      var r = remotes[id];
      html += '<div class="row">' +
        '<span class="row-avatar" style="background:' + r.accent + '">' + esc(initial(r.name)) + '</span>' +
        '<span class="row-body"><span class="row-title">' + esc(r.name) + '</span>' +
        '<span class="row-sub">' + esc(r.owner || '다른 피클') + '</span></span>' +
        '<span class="state-dot"></span></div>';
    });
    if (!html) html = '<div class="empty">지금은 조용해요. 작업실에서 동료를 켜 보세요.</div>';
    host.innerHTML = html;
    var pc = $('#partyCount');
    if (pc) pc.textContent = act.length + '명';
  }

  function renderQuick() {
    var row = $('#quickRow');
    if (!row) return;
    var qs = ['안녕하세요', '오늘 일정 알려줘', '진행 상황 공유해줘', '회의실 비어 있어?'];
    row.innerHTML = qs.map(function (q) {
      return '<button type="button" class="quick" data-act="quick" data-text="' + esc(q) + '">' + esc(q) + '</button>';
    }).join('');
  }

  function renderMessages() {
    var host = $('#messages');
    if (!host) return;
    if (!S.chat.length) {
      host.innerHTML = '<div class="empty">아직 대화가 없어요.<br>아래에 인사를 남기면 동료들이 답합니다.</div>';
      return;
    }
    host.innerHTML = S.chat.map(function (m) {
      var mine = !!m.mine;
      return '<div class="msg' + (mine ? ' is-me' : '') + '">' +
        '<span class="msg-avatar" style="background:' + (m.accent || '#8b95a3') + '">' + esc(initial(m.name)) + '</span>' +
        '<div class="msg-col">' +
          '<div class="msg-meta"><b>' + esc(mine ? S.name : (m.name || '피클')) + '</b><span>' + esc(m.role || '') + '</span><span>' + timeLabel(m.at) + '</span></div>' +
          '<div class="msg-bubble">' + esc(m.text) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function scrollMessages() {
    var host = $('#messages');
    if (host) host.scrollTop = host.scrollHeight;
  }

  function setComposer(text) {
    var input = $('#chatInput');
    if (input) { input.value = text; input.focus({ preventScroll: true }); }
  }

  function sendChat(text) {
    var mine = { id: uid(), mine: true, name: S.name, role: '지휘', accent: S.accent, text: text, at: Date.now() };
    S.chat.push(mine);
    S.chat = S.chat.slice(-60);
    saveSoon();
    renderMessages();
    scrollMessages();
    if (net) net.send({ kind: 'chat', text: text, name: S.name, role: '지휘', accent: S.accent });
    aiReply(text);
  }

  function roleMatches(p, cat) {
    if (p.id === cat) return true;
    var r = p.role || '';
    if (cat === 'chief') return /지휘|비서/.test(r);
    if (cat === 'plan') return /기획|일정|계획/.test(r);
    if (cat === 'dev') return /개발|리서치|조사|분석/.test(r);
    if (cat === 'ops') return /총무|운영|관리|고객/.test(r);
    return false;
  }

  function pickPartFor(text) {
    var t = String(text).toLowerCase();
    var act = activeParts();
    if (!act.length) return null;
    var want = null;
    if (/안녕|하이|반가|수고|고마|감사/.test(t)) want = 'chief';
    else if (/일정|스케줄|회의|캘린더|약속|계획|날짜/.test(t)) want = 'plan';
    else if (/개발|리서치|조사|코드|버그|자료|시장|경쟁|분석/.test(t)) want = 'dev';
    else if (/총무|비품|배송|택배|예약|구매|정리|준비|다과/.test(t)) want = 'ops';
    var p = want ? act.filter(function (x) { return roleMatches(x, want); })[0] : null;
    if (p) return p;
    return act[Math.floor(Math.random() * act.length)];
  }

  function replyBank(p) {
    if (REPLIES[p.id]) return REPLIES[p.id];
    if (roleMatches(p, 'plan')) return REPLIES.plan;
    if (roleMatches(p, 'dev')) return REPLIES.dev;
    if (roleMatches(p, 'ops')) return REPLIES.ops;
    return REPLIES.chief;
  }

  function aiReply(text) {
    var p = pickPartFor(text);
    if (!p) return;
    var delay = 700 + Math.random() * 900;
    var typing = { id: 'typing', typing: true, name: p.name, role: p.role, accent: p.accent, at: Date.now() };

    setTimeout(function () {
      if (S.tab !== 'meeting') { markTabDot('meeting'); }
      var host = $('#messages');
      if (host && S.tab === 'meeting') {
        var el = document.createElement('div');
        el.className = 'msg is-typing';
        el.id = 'typingRow';
        el.innerHTML = '<span class="msg-avatar" style="background:' + p.accent + '">' + esc(initial(p.name)) + '</span>' +
          '<div class="msg-col"><div class="msg-meta"><b>' + esc(p.name) + '</b><span>' + esc(p.role) + '</span></div>' +
          '<div class="msg-bubble"><span class="typing-dots"><i></i><i></i><i></i></span></div></div>';
        host.appendChild(el);
        scrollMessages();
      }

      setTimeout(function () {
        var row = $('#typingRow');
        if (row) row.remove();
        var pool = replyBank(p);
        var rep = /안녕|하이|반가/.test(text) && Math.random() < 0.6
          ? GREET_REPLIES[Math.floor(Math.random() * GREET_REPLIES.length)]
          : pool[Math.floor(Math.random() * pool.length)];
        S.chat.push({
          id: uid(), mine: false, name: p.name, role: p.role,
          accent: p.accent, text: rep, at: Date.now()
        });
        S.chat = S.chat.slice(-60);
        saveSoon();
        if (S.tab === 'meeting') { renderMessages(); scrollMessages(); }
        else markTabDot('meeting');
      }, 620 + Math.random() * 700);
    }, delay);
    void typing;
  }

  /* ── render: workshop ──────────────────── */
  function renderWorkshop() {
    var host = $('#view-workshop');
    if (!host) return;
    var cards = S.parts.map(function (p) {
      return '<section class="card part-card">' +
        '<div class="part-top">' +
          '<span class="row-avatar" style="background:' + p.accent + '">' + esc(initial(p.name)) + '</span>' +
          '<div class="part-main">' +
            '<div class="part-name">' + esc(p.name) +
              (p.id === 'chief' ? '<span class="badge-lv">Lv.' + level() + '</span>' : '') +
            '</div>' +
            '<div class="part-role">' + esc(p.role) + (p.zone && p.zone !== p.role ? ' · ' + esc(p.zone) : '') + '</div>' +
          '</div>' +
          '<div class="part-tools">' +
            '<button type="button" class="switch" role="switch" aria-checked="' + (p.on ? 'true' : 'false') + '" data-act="toggle-part" data-part="' + p.id + '" aria-label="' + esc(p.name) + ' 가동 전환"></button>' +
          '</div>' +
        '</div>' +
        '<div class="part-status"><span class="state-dot' + (p.on ? '' : ' is-off') + '"></span><span>' + esc(p.on ? p.status : '쉬는 중') + '</span></div>' +
        '<div class="part-actions">' +
          '<button type="button" class="btn" data-act="talk-part" data-part="' + p.id + '">대화</button>' +
          '<button type="button" class="btn" data-act="edit-part" data-part="' + p.id + '">수정</button>' +
          (p.id === 'chief' ? '' : '<button type="button" class="btn danger" data-act="ask-remove-part" data-part="' + p.id + '">내보내기</button>') +
        '</div>' +
      '</section>';
    }).join('');

    host.innerHTML =
      '<div class="workshop-grid">' + cards +
        '<button type="button" class="add-part" data-act="add-part">＋ AI 동료 추가</button>' +
        '<p class="hint">파트를 켜고 끄면 오피스 핀과 현황에 바로 반영돼요. 꺼 둔 파트는 대화에 답하지 않습니다.</p>' +
      '</div>';
  }

  /* ── render: status ────────────────────── */
  function renderStatus() {
    var host = $('#view-status');
    if (!host) return;
    var act = activeParts();
    var remoteList = Object.keys(remotes).map(function (k) { return remotes[k]; });

    var partsHTML = S.parts.map(function (p) {
      return '<div class="phase">' +
        '<span class="row-avatar" style="background:' + p.accent + '">' + esc(initial(p.name)) + '</span>' +
        '<span><span class="phase-name">' + esc(p.name) + '</span>' +
          '<span class="phase-sub" style="display:block">' + esc(p.role) + '</span></span>' +
        '<span class="phase-val">' + (p.on ? '가동 중' : '쉬는 중') + '</span>' +
      '</div>';
    }).join('');

    var picklesHTML = remoteList.length
      ? remoteList.map(function (r) {
          return '<div class="phase">' +
            '<span class="row-avatar" style="background:' + r.accent + '">' + esc(initial(r.name)) + '</span>' +
            '<span><span class="phase-name">' + esc(r.name) + '</span>' +
              '<span class="phase-sub" style="display:block">' + esc(r.owner || '다른 피클') + '</span></span>' +
            '<span class="phase-val">Lv.' + (r.level || 2) + ' · 접속 중</span>' +
          '</div>';
        }).join('')
      : '<div class="empty">아직 함께 접속한 피클이 없어요.<br>초대 링크를 보내면 이 방에서 만날 수 있어요.</div>';

    host.innerHTML =
      '<div class="status-grid">' +
        '<section class="card me-card span-2">' +
          '<div class="me-top">' +
            '<span class="row-avatar" style="background:' + S.accent + '">' + esc(initial(S.name)) + '</span>' +
            '<div><div class="me-name">' + esc(S.name) + '<span class="badge-lv">Lv.' + level() + '</span></div>' +
            '<div class="me-owner">' + esc(S.owner) + '</div></div>' +
          '</div>' +
          '<div class="me-stats">' +
            '<div class="stat"><b>' + act.length + '</b><span>가동 파트</span></div>' +
            '<div class="stat"><b>' + remoteList.length + '</b><span>연결된 피클</span></div>' +
            '<div class="stat"><b>' + S.memos.filter(function (m) { return !m.done; }).length + '</b><span>남은 메모</span></div>' +
          '</div>' +
        '</section>' +
        '<section class="card side-card">' +
          '<div class="side-head"><h3>파트 상태</h3><span>' + act.length + '/' + S.parts.length + ' 가동</span></div>' +
          '<div class="phase-list">' + (partsHTML || '<div class="empty">아직 파트가 없어요.</div>') + '</div>' +
        '</section>' +
        '<section class="card side-card">' +
          '<div class="side-head"><h3>연결된 피클</h3><span>' + remoteList.length + '명</span></div>' +
          '<div class="phase-list">' + picklesHTML + '</div>' +
        '</section>' +
        '<section class="card side-card span-2">' +
          '<div class="side-head"><h3>시스템</h3><span>' + (netState === 'live' ? 'LIVE' : netState === 'connecting' ? '연결 중' : '로컬') + '</span></div>' +
          '<div class="kv"><span>실시간 연결</span><b>' + (netState === 'live' ? 'MQTT 연결됨' : netState === 'connecting' ? '브로커 찾는 중' : '이 브라우저 안에서만') + '</b></div>' +
          '<div class="kv"><span>방 이름</span><b>' + esc(S.room) + '</b></div>' +
          '<div class="kv"><span>저장 방식</span><b>localStorage · 최근 60개 대화</b></div>' +
          '<div class="kv"><span>모션</span><b>' + (S.motion ? 'ON' : 'OFF') + '</b></div>' +
        '</section>' +
      '</div>';
  }

  /* ── render: memo ──────────────────────── */
  function renderMemo() {
    var host = $('#view-memo');
    if (!host) return;
    var items = S.memos;
    var done = items.filter(function (m) { return m.done; }).length;

    var listHTML = items.length ? items.map(function (m) {
      return '<div class="memo' + (m.done ? ' is-done' : '') + '" data-id="' + m.id + '">' +
        '<button type="button" class="memo-check" data-act="toggle-memo" data-id="' + m.id + '" aria-label="완료 표시" aria-pressed="' + (m.done ? 'true' : 'false') + '">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>' +
        '</button>' +
        '<div class="memo-body">' +
          '<div class="memo-text">' + esc(m.text) + '</div>' +
          '<div class="memo-meta">' + esc(m.by || S.name) + ' · ' + timeLabel(m.at || Date.now()) + '</div>' +
        '</div>' +
        '<button type="button" class="memo-del" data-act="del-memo" data-id="' + m.id + '" aria-label="메모 삭제">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
      '</div>';
    }).join('') : '<div class="empty">아직 메모가 없어요.<br>오늘 챙길 일을 한 줄로 남겨 보세요.</div>';

    host.innerHTML =
      '<div class="memo-grid">' +
        '<form class="card memo-form" id="memoForm" autocomplete="off">' +
          '<input id="memoInput" maxlength="120" placeholder="함께 볼 일을 적어 두세요" aria-label="메모 입력" />' +
          '<button type="submit" aria-label="메모 추가">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
          '</button>' +
        '</form>' +
        '<section class="card memo-card">' + listHTML + '</section>' +
        '<aside class="office-side">' +
          '<section class="card side-card">' +
            '<div class="side-head"><h3>보드</h3><span>' + done + '/' + items.length + ' 완료</span></div>' +
            '<div class="kv"><span>남은 일</span><b>' + (items.length - done) + '개</b></div>' +
            '<div class="kv"><span>오늘 올린 메모</span><b>' + items.filter(function (m) { return new Date(m.at || 0).toDateString() === new Date().toDateString(); }).length + '개</b></div>' +
            '<p class="hint" style="padding:10px 2px">메모는 이 방에 함께 있는 피클과 실시간으로 맞춰집니다.</p>' +
          '</section>' +
        '</aside>' +
      '</div>';

    var form = $('#memoForm');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#memoInput');
      var v = (input.value || '').trim();
      if (!v) return;
      input.value = '';
      S.memos.unshift({ id: uid(), text: v, done: false, by: S.name, at: Date.now() });
      S.memos = S.memos.slice(0, 80);
      S.memoRev = Date.now();
      saveSoon();
      pushMemos();
      renderMemo();
      var again = $('#memoInput');
      if (again) again.focus();
    });
  }

  function pushMemos() {
    if (net) net.send({ kind: 'tasks', items: S.memos.slice(0, 80), rev: S.memoRev });
  }

  /* ── toast ─────────────────────────────── */
  var toastTimer = null;
  function toast(text) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-show'); }, 2200);
  }

  /* ── invite ────────────────────────────── */
  function inviteURL() {
    var base = location.origin + location.pathname;
    return base + (S.room ? '?room=' + encodeURIComponent(S.room) : '');
  }
  function copyInvite() {
    var url = inviteURL();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast('초대 링크를 복사했어요'); })
        .catch(function () { fallbackCopy(url); });
    } else fallbackCopy(url);
  }
  function fallbackCopy(url) {
    var ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('초대 링크를 복사했어요'); }
    catch (e) { toast('링크: ' + url); }
    ta.remove();
  }

  /* ── events ────────────────────────────── */
  document.addEventListener('click', function (e) {
    var tabBtn = e.target.closest('.tab');
    if (tabBtn) { setTab(tabBtn.getAttribute('data-tab')); return; }

    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');

    if (act === 'motion') {
      S.motion = !S.motion;
      save();
      document.body.classList.toggle('motion-on', S.motion);
      var chip = el;
      chip.classList.toggle('is-off', !S.motion);
      chip.setAttribute('aria-pressed', S.motion ? 'true' : 'false');
      chip.innerHTML = '<span class="chip-dot" aria-hidden="true"></span>모션 ' + (S.motion ? 'ON' : 'OFF');
      if (!S.motion) { var b = $('#mapBubble'); if (b) b.classList.remove('is-show'); }
      else showBubble(activeParts()[0] || S.parts[0] || { anchor: [50, 40], line: '다시 움직여 볼게요.' });
      scheduleBubble();
      toast('모션 ' + (S.motion ? '켬' : '껐어요'));
      return;
    }
    if (act === 'pin') { openSpaceSheet(el.getAttribute('data-space')); return; }
    if (act === 'close-sheet') { closeSheet(); return; }
    if (act === 'go-meeting') {
      var pre = el.getAttribute('data-prefill') || '';
      closeSheet();
      setTab('meeting', { prefill: pre, focus: !pre });
      return;
    }
    if (act === 'go-workshop') { closeSheet(); setTab('workshop'); return; }
    if (act === 'talk-part') {
      var p = partById(el.getAttribute('data-part'));
      if (!p) return;
      closeSheet();
      setTab('meeting', { prefill: p.name + ', 지금 상황 알려줘', focus: false });
      return;
    }
    if (act === 'quick') {
      var t = el.getAttribute('data-text');
      sendChat(t);
      return;
    }
    if (act === 'add-part') { openAddPart(null); return; }
    if (act === 'edit-part') { openAddPart(el.getAttribute('data-part')); return; }
    if (act === 'save-part') { savePart(el.getAttribute('data-edit'), $('#sheetBody')); return; }
    if (act === 'ask-remove-part') { askRemovePart(el.getAttribute('data-part')); return; }
    if (act === 'remove-part') { removePart(el.getAttribute('data-part')); return; }
    if (act === 'toggle-part') { togglePart(el.getAttribute('data-part')); return; }
    if (act === 'swatch') {
      var wrap = el.parentElement;
      $$('.swatch', wrap).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      el.setAttribute('aria-pressed', 'true');
      return;
    }
    if (act === 'save-settings') {
      var name = ($('#setName') || {}).value;
      var owner = ($('#setOwner') || {}).value;
      var room = ($('#setRoom') || {}).value;
      name = (name || '').trim(); owner = (owner || '').trim(); room = (room || '').trim();
      if (name) S.name = name;
      if (owner) S.owner = owner;
      var sw = $('#setSwatches .swatch[aria-pressed="true"]');
      if (sw) {
        S.accent = sw.getAttribute('data-color');
        var chief = partById('chief');
        if (chief) chief.accent = S.accent;
      }
      var roomChanged = room && room !== S.room;
      if (room) S.room = room;
      save();
      closeSheet();
      if (chiefNameFix()) { /* noop */ }
      toast('설정을 저장했어요');
      renderCurrent();
      if (roomChanged) {
        toast('방 이름이 바뀌었어요 · 새로 연결합니다');
        if (net) { try { net.stop(); } catch (e) { /* noop */ } }
        remotes = {};
        netState = 'connecting';
        bootNet();
      }
      return;
    }
    if (act === 'copy-invite') { copyInvite(); return; }
    if (act === 'toggle-memo') {
      var id = el.getAttribute('data-id');
      S.memos = S.memos.map(function (m) { return m.id === id ? Object.assign({}, m, { done: !m.done }) : m; });
      S.memoRev = Date.now();
      save(); pushMemos(); renderMemo();
      return;
    }
    if (act === 'del-memo') {
      var did = el.getAttribute('data-id');
      S.memos = S.memos.filter(function (m) { return m.id !== did; });
      S.memoRev = Date.now();
      save(); pushMemos(); renderMemo();
      return;
    }
  });

  function chiefNameFix() {
    var chief = partById('chief');
    if (chief && chief.name !== S.name) { chief.name = S.name; return true; }
    return false;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sheetOpen) closeSheet();
  });
  $('#scrim').addEventListener('click', closeSheet);
  $('#inviteBtn').addEventListener('click', copyInvite);
  $('#settingsBtn').addEventListener('click', openSettings);

  /* ── boot ──────────────────────────────── */
  if (S.chat.length === 0) {
    S.chat.push({
      id: uid(), mine: false, name: '모아', role: '기획·일정', accent: '#5b76e8',
      text: '대표님, 이번 주 일정표 정리해서 올려두었어요. 확인해 보실래요?',
      at: Date.now() - 42e5
    });
    S.chat.push({
      id: uid(), mine: false, name: '하루', role: '총무·운영', accent: '#2aa98a',
      text: '회의실 예약과 다과는 준비됐습니다. 필요한 것 있으면 말씀해 주세요.',
      at: Date.now() - 18e5
    });
  }

  document.body.classList.toggle('motion-on', !!S.motion);
  renderChrome();
  setTab('office');
  bootNet();
})();
