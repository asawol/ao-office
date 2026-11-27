/* ─────────────────────────────────────────────
   app.js — 합동 피클 비서실
   ───────────────────────────────────────────── */
(function () {
  'use strict';

  var A = window.OfficeArt;
  var WORLD = A.WORLD;

  var PRESETS = [
    { id: 'cream',  name: '크림',  body: '#E8469B', accent: '#7A4BE0', glow: '#FFFFFF' },
    { id: 'mint',   name: '민트',  body: '#33C6A0', accent: '#266B8C', glow: '#E6FFF7' },
    { id: 'lemon',  name: '레몬',  body: '#FFC93C', accent: '#E0622A', glow: '#FFF4C9' },
    { id: 'berry',  name: '베리',  body: '#8E6BE8', accent: '#E8509B', glow: '#F2EAFF' },
    { id: 'sky',    name: '하늘',  body: '#5EAAF0', accent: '#2E5BB8', glow: '#E6F4FF' },
    { id: 'peach',  name: '피치',  body: '#FF9A76', accent: '#C43F6B', glow: '#FFEFE7' }
  ];

  var STATUSES = [
    { id: 'work', label: '업무중' },
    { id: 'meeting', label: '회의중' },
    { id: 'break', label: '휴식중' },
    { id: 'out', label: '외출중' }
  ];

  var QUICKS = ['안녕하세요! 👋', '회의 중이에요', '잠깐 자리 비울게요', '수고했어요 👏'];

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function nowMs() { return Date.now(); }

  var Store = {
    get: function (k, fb) { try { var v = localStorage.getItem(k); return v === null ? fb : v; } catch (e) { return fb; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* noop */ } },
    json: function (k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
  };

  function sanitizeRoom(raw) {
    var s = String(raw || '').trim().toLowerCase();
    s = s.replace(/[^a-z0-9\-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return s.slice(0, 40);
  }

  function readRoom() {
    var fromUrl = new URLSearchParams(location.search).get('room');
    var room = sanitizeRoom(fromUrl || Store.get('pickleoffice.room', '') || 'asawol-office');
    return room || 'asawol-office';
  }

  var room = readRoom();
  Store.set('pickleoffice.room', room);

  var clientId = (function () {
    var id = null;
    try { id = sessionStorage.getItem('pickleoffice.cid'); } catch (e) { /* noop */ }
    if (!id) {
      id = (window.PickleUid ? window.PickleUid() : Math.random().toString(16).slice(2));
      try { sessionStorage.setItem('pickleoffice.cid', id); } catch (e) { /* noop */ }
    }
    return id;
  })();

  var myId = clientId;

  /* ── 상태 ───────────────────────────────── */

  var me = {
    id: myId,
    name: '크림',
    owner: '아사월',
    body: '#E8469B',
    accent: '#7A4BE0',
    glow: '#FFFFFF',
    status: 'work',
    x: 620,
    y: 376,
    dx: 620,
    dy: 376,
    facing: 1,
    moving: false,
    phase: Math.random() * 6.28,
    blink: 0,
    nextBlink: 2 + Math.random() * 3,
    bubble: null,
    target: null,
    stuck: 0,
    lastSeen: nowMs()
  };

  var chars = new Map();
  chars.set(myId, me);

  var messages = [];
  var msgIds = new Set();
  var tasks = [];
  var taskRev = 0;
  var cloud = null;
  var net = null;

  var view = { cw: 800, ch: 600, dpr: 1, scale: 1 };
  var cam = { x: WORLD.w / 2, y: WORLD.h / 2 };
  var keys = {};
  var lastPub = 0;
  var lastPrune = 0;
  var hintTimer = null;
  var chatScrollPending = false;

  /* ── 프로필 저장/복원 ───────────────────── */

  function validColor(c, fb) {
    return /^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? String(c) : fb;
  }

  function loadProfile() {
    var p = Store.json('pickleoffice.profile', null);
    if (!p || typeof p !== 'object') return false;
    me.name = String(p.name || '크림').slice(0, 14);
    me.owner = String(p.owner || '아사월').slice(0, 14);
    me.body = validColor(p.body, '#E8469B');
    me.accent = validColor(p.accent, '#7A4BE0');
    me.glow = validColor(p.glow, '#FFFFFF');
    me.status = STATUSES.some(function (s) { return s.id === p.status; }) ? p.status : 'work';
    return true;
  }

  function saveProfile() {
    Store.set('pickleoffice.profile', JSON.stringify({
      name: me.name,
      owner: me.owner,
      body: me.body,
      accent: me.accent,
      glow: me.glow,
      status: me.status
    }));
  }

  function avatarGradient(body) {
    return 'radial-gradient(circle at 34% 28%, ' + A.lighten(body, 0.34) + ' 0%, ' + body + ' 68%, ' + A.mix(body, '#2b1a2e', 0.18) + ' 100%)';
  }

  function statusLabel(id) {
    for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i].id === id) return STATUSES[i].label;
    return '업무중';
  }

  /* ── 화면 요소 ──────────────────────────── */

  var canvas = $('#office');
  var ctx = canvas.getContext('2d');
  var stage = $('#stage');
  var netPill = $('#netPill');
  var netText = $('#netText');
  var rosterList = $('#rosterList');
  var rosterStrip = $('#rosterStrip');
  var rosterCount = $('#rosterCount');
  var rosterEmpty = $('#rosterEmpty');
  var chatList = $('#chatList');
  var chatForm = $('#chatForm');
  var chatInput = $('#chatInput');
  var taskList = $('#taskList');
  var taskForm = $('#taskForm');
  var taskInput = $('#taskInput');
  var taskCount = $('#taskCount');
  var toastEl = $('#toast');
  var hintEl = $('#hint');

  $('.room-hash').textContent = '#';
  $('#roomLabel').textContent = room;

  /* ── 토스트 ─────────────────────────────── */

  var toastTimer = null;
  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('is-show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-show'); }, 2400);
  }

  var miniToast = document.createElement('div');
  miniToast.className = 'mini-toast';
  document.body.appendChild(miniToast);
  var miniTimer = null;
  function showMini(text) {
    miniToast.textContent = text;
    miniToast.classList.add('is-show');
    if (miniTimer) clearTimeout(miniTimer);
    miniTimer = setTimeout(function () { miniToast.classList.remove('is-show'); }, 2000);
  }

  /* ── 내 카드 & 명단 ──────────────────────── */

  function renderMe() {
    $('#myName').textContent = me.name;
    $('#myOwner').textContent = me.owner ? me.owner + '님의 비서' : '비서';
    $('#myAvatar').style.background = avatarGradient(me.body);
    $('#btnAvatar').style.background = avatarGradient(me.body);
    document.title = me.name + ' · 합동 피클 비서실';

    var row = $('#statusRow');
    row.innerHTML = '';
    STATUSES.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'status-chip' + (me.status === s.id ? ' is-active' : '');
      b.dataset.status = s.id;
      var dot = document.createElement('i');
      dot.className = 'pill-dot';
      b.appendChild(dot);
      b.appendChild(document.createTextNode(s.label));
      b.addEventListener('click', function () { setStatus(s.id); });
      row.appendChild(b);
    });
  }

  var rosterSig = '';

  function rosterSignature() {
    return Array.from(chars.values()).map(function (c) {
      return c.id + '|' + c.name + '|' + c.owner + '|' + c.status + '|' + c.body;
    }).join('~');
  }

  function renderRoster() {
    var sig = rosterSignature();
    if (sig === rosterSig) return;
    rosterSig = sig;
    var list = Array.from(chars.values()).sort(function (a, b) {
      if (a.id === myId) return -1;
      if (b.id === myId) return 1;
      return a.name.localeCompare(b.name);
    });

    rosterList.innerHTML = '';
    rosterStrip.innerHTML = '';

    list.forEach(function (c) {
      var li = document.createElement('li');
      li.className = 'roster-item';
      var av = document.createElement('span');
      av.className = 'roster-avatar';
      av.style.background = avatarGradient(c.body);
      var meta = document.createElement('div');
      meta.className = 'roster-meta';
      var nm = document.createElement('strong');
      nm.textContent = c.name + (c.id === myId ? ' (나)' : '');
      var ow = document.createElement('span');
      ow.textContent = c.owner ? c.owner + '님의 비서' : '비서';
      meta.appendChild(nm);
      meta.appendChild(ow);
      var st = document.createElement('span');
      st.className = 'roster-status';
      st.dataset.status = c.status;
      st.textContent = statusLabel(c.status);
      li.appendChild(av);
      li.appendChild(meta);
      li.appendChild(st);
      rosterList.appendChild(li);

      var chip = document.createElement('span');
      chip.className = 'strip-chip';
      var av2 = document.createElement('span');
      av2.className = 'roster-avatar';
      av2.style.background = avatarGradient(c.body);
      var dot = document.createElement('i');
      dot.className = 'dot-status';
      dot.style.background = A.STATUS_COLOR[c.status] || '#2FBF94';
      var nm2 = document.createElement('span');
      nm2.textContent = c.name + (c.id === myId ? ' (나)' : '');
      chip.appendChild(av2);
      chip.appendChild(nm2);
      chip.appendChild(dot);
      rosterStrip.appendChild(chip);
    });

    rosterCount.textContent = String(list.length);
    rosterEmpty.hidden = list.length > 1;  }

  /* ── 채팅 ───────────────────────────────── */

  function timeStr(ts) {
    var d = new Date(ts || nowMs());
    var h = d.getHours();
    var m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function cleanText(t, max) {
    return String(t || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function addMessage(m) {
    if (!m || !m.id || msgIds.has(m.id)) return;
    msgIds.add(m.id);
    messages.push(m);
    if (messages.length > 120) {
      var dropped = messages.splice(0, messages.length - 120);
      dropped.forEach(function (d) { msgIds.delete(d.id); });
    }
    appendChatNode(m);
    if (!m.system) saveChatLocal();
    if (m.from === myId) return;
    var c = chars.get(m.from);
    if (c) {
      c.bubble = { text: m.text, until: performance.now() / 1000 + 7 };
    }
  }

  function appendSystem(text) {
    addMessage({ id: 'sys' + nowMs() + Math.random().toString(16).slice(2, 6), system: true, text: text, at: nowMs() });
  }

  function appendChatNode(m) {
    if (m.system) {
      var s = document.createElement('li');
      s.className = 'chat-system';
      s.textContent = m.text;
      chatList.appendChild(s);
    } else {
      var li = document.createElement('li');
      li.className = 'chat-item' + (m.from === myId ? ' is-mine' : '');
      var av = document.createElement('span');
      av.className = 'chat-avatar';
      av.style.background = avatarGradient(m.body || '#B9AEC8');
      var main = document.createElement('div');
      main.className = 'chat-main';
      var nm = document.createElement('span');
      nm.className = 'chat-name';
      nm.textContent = (m.from === myId ? '나' : (m.name || '피클')) + ' · ' + timeStr(m.at);
      var bub = document.createElement('div');
      bub.className = 'chat-bubble';
      bub.textContent = m.text;
      main.appendChild(nm);
      main.appendChild(bub);
      li.appendChild(av);
      li.appendChild(main);
      chatList.appendChild(li);
    }
    chatScrollPending = true;
  }

  function flushChatScroll() {
    if (!chatScrollPending) return;
    chatScrollPending = false;
    chatList.scrollTop = chatList.scrollHeight;
  }

  function saveChatLocal() {
    try {
      Store.set('pickleoffice.messages.' + room, JSON.stringify(messages.slice(-50).filter(function (m) { return !m.system; })));
    } catch (e) { /* noop */ }
  }

  function sendChat(text) {
    var t = cleanText(text, 140);
    if (!t) return;
    var msg = net.send({ kind: 'chat', text: t, name: me.name, body: me.body });
    addMessage({ id: msg.id, from: myId, name: me.name, body: me.body, text: t, at: msg.at });
    me.bubble = { text: t, until: performance.now() / 1000 + 7 };
    if (cloud && cloud.url) cloud.saveMessages(messages.filter(function (m) { return !m.system; }));
    saveChatLocal();
  }

  /* ── 업무 메모 ──────────────────────────── */

  function renderTasks() {
    taskList.innerHTML = '';
    if (!tasks.length) {
      var p = document.createElement('li');
      p.className = 'task-empty';
      p.textContent = '아직 적어 둔 업무가 없어요.';
      taskList.appendChild(p);
    }
    tasks.forEach(function (t) {
      var li = document.createElement('li');
      li.className = 'task-item' + (t.done ? ' is-done' : '');

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'task-check';
      cb.checked = !!t.done;
      cb.addEventListener('change', function () {
        t.done = cb.checked;
        tasksChanged(true);
      });

      var txt = document.createElement('span');
      txt.className = 'task-text';
      txt.textContent = t.text;

      var by = document.createElement('span');
      by.className = 'task-by';
      by.textContent = t.by ? t.by : '';

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'task-del';
      del.textContent = '✕';
      del.setAttribute('aria-label', '할 일 지우기');
      del.addEventListener('click', function () {
        tasks = tasks.filter(function (x) { return x.id !== t.id; });
        tasksChanged(true);
      });

      li.appendChild(cb);
      li.appendChild(txt);
      if (t.by) li.appendChild(by);
      li.appendChild(del);
      taskList.appendChild(li);
    });

    var open = tasks.filter(function (t) { return !t.done; }).length;
    taskCount.textContent = String(open);
  }

  function tasksChanged(broadcast) {
    taskRev = nowMs();
    renderTasks();
    Store.set('pickleoffice.tasks.' + room, JSON.stringify(tasks));
    if (broadcast !== false) net.send({ kind: 'tasks', items: tasks, rev: taskRev });
    if (cloud && cloud.url) cloud.saveTasks(tasks, taskRev);
  }

  /* ── 상태 변경 ──────────────────────────── */

  function setStatus(id) {
    me.status = id;
    saveProfile();
    renderMe();
    renderRoster();
    net.send({ kind: 'state', x: Math.round(me.x), y: Math.round(me.y), moving: false, facing: me.facing, status: me.status, name: me.name, owner: me.owner, body: me.body, accent: me.accent, glow: me.glow });
  }

  /* ── 네트워크 ───────────────────────────── */

  function sendState(force) {
    var t = nowMs();
    if (!force && t - lastPub < (me.moving ? 130 : 2200)) return;
    lastPub = t;
    net.send({
      kind: 'state',
      x: Math.round(me.x),
      y: Math.round(me.y),
      moving: me.moving,
      facing: me.facing,
      status: me.status,
      name: me.name,
      owner: me.owner,
      body: me.body,
      accent: me.accent,
      glow: me.glow
    });
  }

  function ensureChar(msg) {
    var id = msg.from;
    var c = chars.get(id);
    if (c) return c;
    c = {
      id: id,
      name: cleanText(msg.name, 14) || '피클',
      owner: cleanText(msg.owner, 14) || '',
      body: validColor(msg.body, '#B9AEC8'),
      accent: validColor(msg.accent, '#7A4BE0'),
      glow: validColor(msg.glow, '#FFFFFF'),
      status: STATUSES.some(function (s) { return s.id === msg.status; }) ? msg.status : 'work',
      x: Number(msg.x) || 620,
      y: Number(msg.y) || 376,
      dx: Number(msg.x) || 620,
      dy: Number(msg.y) || 376,
      facing: Number(msg.facing) < 0 ? -1 : 1,
      moving: !!msg.moving,
      phase: Math.random() * 6.28,
      blink: 0,
      nextBlink: 2 + Math.random() * 3,
      bubble: null,
      lastSeen: nowMs()
    };
    chars.set(id, c);
    renderRoster();
    appendSystem(c.name + ' 피클이 비서실에 들어왔어요');
    return c;
  }

  function removeChar(id) {
    var c = chars.get(id);
    if (!c) return;
    chars.delete(id);
    renderRoster();
    appendSystem(c.name + ' 피클이 나갔어요');
  }

  function onNetMessage(msg) {
    if (msg.kind === 'hello') {
      ensureChar(msg);
      sendState(true);
      return;
    }
    if (msg.kind === 'state') {
      var c = ensureChar(msg);
      c.name = cleanText(msg.name, 14) || c.name;
      c.owner = cleanText(msg.owner, 14) || c.owner;
      c.body = validColor(msg.body, c.body);
      c.accent = validColor(msg.accent, c.accent);
      c.glow = validColor(msg.glow, c.glow);
      if (STATUSES.some(function (s) { return s.id === msg.status; })) c.status = msg.status;
      var nx = Number(msg.x);
      var ny = Number(msg.y);
      if (isFinite(nx) && isFinite(ny)) {
        c.x = clamp(nx, 40, WORLD.w - 40);
        c.y = clamp(ny, 96, WORLD.h - 30);
        if (c.dx === undefined || Math.abs(c.dx - c.x) > 260) { c.dx = c.x; c.dy = c.y; }
      }
      c.moving = !!msg.moving;
      if (Number(msg.facing) < 0 || Number(msg.facing) > 0) c.facing = Number(msg.facing) < 0 ? -1 : 1;
      c.lastSeen = nowMs();
      renderRoster();
      return;
    }
    if (msg.kind === 'chat') {
      var text = cleanText(msg.text, 140);
      if (!text) return;
      var ch = chars.get(msg.from) || ensureChar(msg);
      addMessage({
        id: msg.id,
        from: msg.from,
        name: ch.name,
        body: ch.body,
        text: text,
        at: Number(msg.at) || nowMs()
      });
      ch.lastSeen = nowMs();
      return;
    }
    if (msg.kind === 'tasks') {
      if (!Array.isArray(msg.items)) return;
      if (Number(msg.rev) <= taskRev) return;
      taskRev = Number(msg.rev) || nowMs();
      tasks = msg.items.slice(0, 40).map(function (t) {
        return {
          id: String(t.id || nowMs() + Math.random()),
          text: cleanText(t.text, 80),
          done: !!t.done,
          by: cleanText(t.by, 14)
        };
      }).filter(function (t) { return t.text; });
      renderTasks();
      Store.set('pickleoffice.tasks.' + room, JSON.stringify(tasks));
      return;
    }
    if (msg.kind === 'bye') {
      removeChar(msg.from);
      return;
    }
  }

  function setNetUI(state, detail) {
    netPill.classList.remove('is-live', 'is-local', 'is-connecting');
    if (state === 'live') {
      netPill.classList.add('is-live');
      netText.textContent = '연결됨';
      netPill.title = '실시간 연결됨 (' + (detail || '브로커') + ')';
    } else if (state === 'connecting') {
      netPill.classList.add('is-connecting');
      netText.textContent = '연결 중';
      netPill.title = '실시간 연결을 준비하고 있어요' + (detail ? ' · ' + detail : '');
    } else {
      netPill.classList.add('is-local');
      netText.textContent = '로컬';
      netPill.title = '이 브라우저 안에서만 움직여요. 네트워크가 열리면 자동으로 연결돼요.';
    }
    var sync = $('#syncStatus');
    if (sync) {
      sync.textContent = state === 'live'
        ? '공개 브로커(' + (detail || 'EMQX') + ')로 실시간 연결됐어요. 같은 방 링크를 연 피클과 바로 만나요.'
        : (state === 'connecting'
          ? '브로커에 연결하는 중이에요…'
          : '지금은 로컬 모드예요. 같은 브라우저의 다른 탭끼리만 보여요.');
    }
  }

  function bootNet() {
    net = new window.OfficeNet({
      room: room,
      clientId: clientId,
      onMessage: onNetMessage,
      onStatus: function (state, detail) {
        setNetUI(state, detail);
        if (state === 'live') {
          net.send({ kind: 'hello', name: me.name, owner: me.owner, body: me.body, accent: me.accent, glow: me.glow, status: me.status, x: Math.round(me.x), y: Math.round(me.y) });
          sendState(true);
        }
      }
    });
    net.start();
    sendState(true);
    setTimeout(function () { if (net && !net.live) setNetUI('local'); }, 9000);
  }

  function bootCloud(url) {
    if (!cloud) {
      cloud = new window.CloudStore({
        room: room,
        clientId: clientId,
        onStatus: function (state, detail) {
          var el = $('#fbStatus');
          if (!el) return;
          if (state === 'ready') el.textContent = 'Firebase에 연결됐어요. 업무 메모와 대화가 저장돼요.';
          else if (state === 'connecting') el.textContent = 'Firebase에 연결하는 중…';
          else if (state === 'error') el.textContent = 'Firebase 오류: ' + detail + ' (DB 규칙에서 읽기/쓰기를 허용해야 해요)';
          else el.textContent = '';
        },
        onTasks: function (data) {
          if (!data || !Array.isArray(data.items)) return;
          if (Number(data.rev) <= taskRev) return;
          taskRev = Number(data.rev) || nowMs();
          tasks = data.items.slice(0, 40).map(function (t) {
            return { id: String(t.id || nowMs()), text: cleanText(t.text, 80), done: !!t.done, by: cleanText(t.by, 14) };
          }).filter(function (t) { return t.text; });
          renderTasks();
        },
        onMessages: function (list) {
          list.forEach(function (m) {
            if (!m || !m.id || !m.text) return;
            addMessage({
              id: m.id,
              from: String(m.from || 'cloud'),
              name: cleanText(m.name, 14) || '피클',
              body: validColor(m.body, '#B9AEC8'),
              text: cleanText(m.text, 140),
              at: Number(m.at) || nowMs()
            });
          });
        }
      });
    }
    cloud.start(url);
  }

  /* ── 이동 ───────────────────────────────── */

  function blocked(x, y) {
    var r = 18;
    if (x < 40 || x > WORLD.w - 40 || y < 96 || y > WORLD.h - 30) return true;
    var obs = A.OBSTACLES;
    for (var i = 0; i < obs.length; i++) {
      var o = obs[i];
      if (o.type === 'rect') {
        var cx = clamp(x, o.x, o.x + o.w);
        var cy = clamp(y, o.y, o.y + o.h);
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy < r * r) return true;
      } else {
        var ddx = x - o.x, ddy = y - o.y;
        var rr2 = (r + o.r);
        if (ddx * ddx + ddy * ddy < rr2 * rr2) return true;
      }
    }
    return false;
  }

  function tryStep(ch, dx, dy) {
    var moved = false;
    if (!blocked(ch.x + dx, ch.y + dy)) {
      ch.x += dx; ch.y += dy;
      return true;
    }
    if (Math.abs(dx) > 0.01 && !blocked(ch.x + dx, ch.y)) { ch.x += dx; moved = true; }
    if (Math.abs(dy) > 0.01 && !blocked(ch.x, ch.y + dy)) { ch.y += dy; moved = true; }
    return moved;
  }

  function freePoint(tx, ty) {
    tx = clamp(tx, 44, WORLD.w - 44);
    ty = clamp(ty, 100, WORLD.h - 34);
    if (!blocked(tx, ty)) return { x: tx, y: ty };
    for (var r = 12; r <= 120; r += 12) {
      for (var a = 0; a < 12; a++) {
        var ang = (Math.PI * 2 / 12) * a;
        var x = clamp(tx + Math.cos(ang) * r, 44, WORLD.w - 44);
        var y = clamp(ty + Math.sin(ang) * r, 100, WORLD.h - 34);
        if (!blocked(x, y)) return { x: x, y: y };
      }
    }
    return null;
  }

  function onPointer(e) {
    var rect = canvas.getBoundingClientRect();
    var px = e.clientX - rect.left;
    var py = e.clientY - rect.top;
    var wx = (px - view.cw / 2) / view.scale + cam.x;
    var wy = (py - view.ch / 2) / view.scale + cam.y;
    var p = freePoint(wx, wy);
    if (p) me.target = p;
    hideHint();
  }

  function hideHint() {
    if (!hintEl.classList.contains('is-hidden')) {
      hintEl.classList.add('is-hidden');
      Store.set('pickleoffice.hinted', '1');
    }
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
  }

  /* ── 루프 ───────────────────────────────── */

  function resize() {
    var rect = stage.getBoundingClientRect();
    view.cw = Math.max(120, rect.width);
    view.ch = Math.max(120, rect.height);
    view.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    var w = Math.round(view.cw * view.dpr);
    var h = Math.round(view.ch * view.dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function computeView(dt) {
    var fitW = view.cw / WORLD.w;
    var fitH = view.ch / WORLD.h;
    var scale = Math.max(fitW, fitH);
    if (view.cw < 700) {
      var zoomed = Math.min(view.cw / (WORLD.w * 0.45), view.ch / (WORLD.h * 0.62));
      scale = Math.max(scale, zoomed);
    }
    var viewW = view.cw / scale;
    var viewH = view.ch / scale;
    var tx = WORLD.w / 2;
    var ty = WORLD.h / 2;
    if (viewW < WORLD.w - 6) tx = clamp(me.dx, viewW / 2, WORLD.w - viewW / 2);
    if (viewH < WORLD.h - 6) ty = clamp(me.dy, viewH / 2, WORLD.h - viewH / 2);
    var k = 1 - Math.pow(0.0015, Math.max(0.001, dt));
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    view.scale = scale;
    view.camX = cam.x;
    view.camY = cam.y;
    return view;
  }

  function update(now, dt) {
    // 내 캐릭터
    var kx = 0, ky = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) kx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) kx += 1;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) ky -= 1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) ky += 1;

    var speed = 168;
    var moving = false;

    if (kx || ky) {
      me.target = null;
      var len = Math.hypot(kx, ky) || 1;
      var stepLen = speed * dt;
      tryStep(me, (kx / len) * stepLen, (ky / len) * stepLen);
      if (kx) me.facing = kx < 0 ? -1 : 1;
      moving = true;
      hideHint();
    } else if (me.target) {
      var ddx = me.target.x - me.x;
      var ddy = me.target.y - me.y;
      var dist = Math.hypot(ddx, ddy);
      if (dist < 3) {
        me.target = null;
      } else {
        var step = Math.min(dist, speed * dt);
        var bx = me.x, by = me.y;
        tryStep(me, (ddx / dist) * step, (ddy / dist) * step);
        var moved = Math.hypot(me.x - bx, me.y - by);
        if (moved < step * 0.2) {
          me.stuck += dt;
          if (me.stuck > 0.3) { me.target = null; me.stuck = 0; }
        } else {
          me.stuck = 0;
        }
        if (Math.abs(ddx) > 2) me.facing = ddx < 0 ? -1 : 1;
        moving = true;
      }
    }

    me.moving = moving;
    me.dx = me.x;
    me.dy = me.y;

    // 다른 피클 보간 + 깜빡임
    chars.forEach(function (c) {
      if (c.id === myId) {
        c.blink = Math.max(0, c.blink - dt);
        if (c.blink === 0) {
          c.nextBlink -= dt;
          if (c.nextBlink <= 0) {
            c.blink = 0.13;
            c.nextBlink = 2 + Math.random() * 4;
          }
        }
        return;
      }
      var lerp = 1 - Math.pow(0.0005, dt);
      c.dx += (c.x - c.dx) * lerp;
      c.dy += (c.y - c.dy) * lerp;
      c.blink = Math.max(0, c.blink - dt);
      c.nextBlink -= dt;
      if (c.nextBlink <= 0) {
        c.blink = 0.13;
        c.nextBlink = 2 + Math.random() * 4;
      }
    });

    // 캐릭터끼리 겹치지 않게 부드럽게 밀어내기 (화면 위치만)
    var arr = Array.from(chars.values());
    for (var i = 0; i < arr.length; i++) {
      for (var j = i + 1; j < arr.length; j++) {
        var a = arr[i], b = arr[j];
        var sdx = b.dx - a.dx, sdy = b.dy - a.dy;
        var dist = Math.hypot(sdx, sdy);
        var minD = 46;
        if (dist < 0.01) { sdx = 1; sdy = 0; dist = 1; }
        if (dist < minD) {
          var push = (minD - dist) / 2;
          var ux = sdx / dist, uy = sdy / dist;
          if (a.id === myId) {
            b.dx += ux * push * 2; b.dy += uy * push * 2;
          } else if (b.id === myId) {
            a.dx -= ux * push * 2; a.dy -= uy * push * 2;
          } else {
            a.dx -= ux * push; a.dy -= uy * push;
            b.dx += ux * push; b.dy += uy * push;
          }
        }
      }
    }

    sendState(false);

    var t = nowMs();
    if (t - lastPrune > 1000) {
      lastPrune = t;
      chars.forEach(function (c) {
        if (c.id !== myId && t - c.lastSeen > 16000) {
          // 16초 동안 소식이 없으면 자리 비움으로 정리
          removeChar(c.id);
        }
      });
    }
  }

  var lastFrame = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    var now = ts / 1000;
    var dt = lastFrame ? Math.min(0.05, now - lastFrame) : 0.016;
    lastFrame = now;
    update(now, dt);
    var v = computeView(dt);
    A.drawScene(ctx, v, Array.from(chars.values()), myId, now);
    flushChatScroll();
  }

  /* ── 설정 모달 ──────────────────────────── */

  var settingsDlg = $('#settingsDlg');
  var welcomeDlg = $('#welcomeDlg');
  var previewCanvas = $('#previewCanvas');
  var draft = null;

  function draftProfile() {
    return {
      name: cleanText($('#setName').value, 14) || '피클',
      owner: cleanText($('#setOwner').value, 14),
      body: validColor($('#setBody').value, me.body),
      accent: validColor($('#setAccent').value, me.accent),
      glow: validColor($('#setGlow').value, me.glow),
      status: $('#setStatus').value
    };
  }

  function paintPreview() {
    if (!draft) return;
    A.drawPreview(previewCanvas, draft);
  }

  function buildPresets(container, onPick) {
    container.innerHTML = '';
    PRESETS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset';
      b.dataset.preset = p.id;
      var sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = p.body;
      sw.style.setProperty('--acc', p.accent);
      b.appendChild(sw);
      b.appendChild(document.createTextNode(p.name));
      b.addEventListener('click', function () {
        onPick(p);
        Array.prototype.forEach.call(container.children, function (el) {
          el.classList.toggle('is-active', el.dataset.preset === p.id);
        });
      });
      container.appendChild(b);
    });
  }

  function syncPresetState() {
    var row = $('#presetRow');
    Array.prototype.forEach.call(row.children, function (el) {
      var p = PRESETS.filter(function (x) { return x.id === el.dataset.preset; })[0];
      el.classList.toggle('is-active', !!p && p.body.toLowerCase() === draft.body.toLowerCase() && p.accent.toLowerCase() === draft.accent.toLowerCase());
    });
  }

  function openSettings() {
    draft = {
      name: me.name,
      owner: me.owner,
      body: me.body,
      accent: me.accent,
      glow: me.glow,
      status: me.status
    };
    $('#setName').value = me.name;
    $('#setOwner').value = me.owner;
    $('#setStatus').value = me.status;
    $('#setBody').value = me.body;
    $('#setAccent').value = me.accent;
    $('#setGlow').value = me.glow;
    $('#setRoom').value = room;
    $('#setFirebase').value = Store.get('pickleoffice.firebase', '');
    $('#fbStatus').textContent = '';
    setNetUI(net && net.live ? 'live' : 'local', net && net.brokerName);

    buildPresets($('#presetRow'), function (p) {
      draft.body = p.body;
      draft.accent = p.accent;
      draft.glow = p.glow;
      $('#setBody').value = p.body;
      $('#setAccent').value = p.accent;
      $('#setGlow').value = p.glow;
      paintPreview();
    });

    settingsDlg.showModal();
    requestAnimationFrame(function () {
      paintPreview();
      syncPresetState();
    });
  }

  ['setBody', 'setAccent', 'setGlow'].forEach(function (id) {
    $('#' + id).addEventListener('input', function () {
      draft = draftProfile();
      paintPreview();
      syncPresetState();
    });
  });
  ['setName', 'setOwner', 'setStatus'].forEach(function (id) {
    $('#' + id).addEventListener('input', function () {
      draft = draftProfile();
      paintPreview();
    });
  });

  $('#settingsForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var next = draftProfile();
    me.name = next.name;
    me.owner = next.owner;
    me.body = next.body;
    me.accent = next.accent;
    me.glow = next.glow;
    me.status = next.status;
    saveProfile();
    renderMe();
    renderRoster();
    sendState(true);

    var fb = $('#setFirebase').value.trim();
    Store.set('pickleoffice.firebase', fb);
    if (fb && (!cloud || cloud.url !== fb.replace(/\/+$/, ''))) bootCloud(fb);

    var nextRoom = sanitizeRoom($('#setRoom').value) || room;
    if (nextRoom !== room) {
      Store.set('pickleoffice.room', nextRoom);
      var base = location.pathname + '?room=' + encodeURIComponent(nextRoom);
      settingsDlg.close();
      location.href = base;
      return;
    }

    settingsDlg.close();
    showToast('내 피클을 저장했어요');
  });

  $$('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (settingsDlg.open) settingsDlg.close();
      if (welcomeDlg.open) welcomeDlg.close();
    });
  });

  function inviteLink() {
    return location.origin + location.pathname + '?room=' + encodeURIComponent(room);
  }

  function copyInvite() {
    var link = inviteLink();
    var done = function () { showToast('초대 링크를 복사했어요'); showMini('초대 링크 복사됨'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done).catch(fallback);
    } else {
      fallback();
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = link;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { showToast(link); }
      document.body.removeChild(ta);
    }
  }

  $('#inviteBtn').addEventListener('click', copyInvite);
  $('#copyInviteBtn').addEventListener('click', copyInvite);
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#roomChip').addEventListener('click', openSettings);
  $('#newRoomBtn').addEventListener('click', function () {
    var id = 'office-' + Math.random().toString(36).slice(2, 7);
    $('#setRoom').value = id;
    showMini('새 방 이름: ' + id + ' — 저장하면 이동해요');
  });

  /* ── 첫 방문 ─────────────────────────────── */

  function openWelcome() {
    buildPresets($('#wPresetRow'), function (p) {
      $('#welcomeDlg').dataset.body = p.body;
      $('#welcomeDlg').dataset.accent = p.accent;
      $('#welcomeDlg').dataset.glow = p.glow;
    });
    welcomeDlg.showModal();
  }

  $('#welcomeStart').addEventListener('click', function () {
    var name = cleanText($('#wName').value, 14) || '크림';
    var owner = cleanText($('#wOwner').value, 14);
    me.name = name;
    me.owner = owner;
    if (welcomeDlg.dataset.body) {
      me.body = validColor(welcomeDlg.dataset.body, me.body);
      me.accent = validColor(welcomeDlg.dataset.accent, me.accent);
      me.glow = validColor(welcomeDlg.dataset.glow, me.glow);
    }
    saveProfile();
    renderMe();
    renderRoster();
    sendState(true);
    welcomeDlg.close();
    hideHint();
  });

  /* ── 입력 ───────────────────────────────── */

  canvas.addEventListener('pointerdown', onPointer);

  window.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) {
      if (e.key === 'Escape' && e.target.blur) e.target.blur();
      return;
    }
    if (e.key === '/' ) {
      e.preventDefault();
      chatInput.focus();
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) !== -1) e.preventDefault();
    keys[e.key] = true;
    if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].indexOf(e.key) !== -1) hideHint();
  });
  window.addEventListener('keyup', function (e) { keys[e.key] = false; });
  window.addEventListener('blur', function () { keys = {}; });

  chatForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = chatInput.value;
    chatInput.value = '';
    sendChat(v);
  });

  taskForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = cleanText(taskInput.value, 60);
    taskInput.value = '';
    if (!t) return;
    tasks.push({ id: 't' + nowMs() + Math.random().toString(16).slice(2, 5), text: t, done: false, by: me.name });
    tasks = tasks.slice(-40);
    tasksChanged(true);
  });

  // 빠른 인사
  var quickRow = $('#quickRow');
  QUICKS.forEach(function (q) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'quick-chip';
    b.textContent = q;
    b.addEventListener('click', function () { sendChat(q); });
    quickRow.appendChild(b);
  });

  // 탭
  $$('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      $$('.tab').forEach(function (t) {
        t.classList.toggle('is-active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      $$('.tab-body').forEach(function (body) {
        body.hidden = body.dataset.body !== tab.dataset.tab;
      });
    });
  });

  $('#sheetToggle').addEventListener('click', function () {
    $('#rightPanel').classList.toggle('is-expanded');
  });

  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);

  window.addEventListener('pagehide', function () {
    try { net.send({ kind: 'bye', name: me.name }); } catch (e) { /* noop */ }
  });

  /* ── 시작 ───────────────────────────────── */

  function loadLocalHistory() {
    var saved = Store.json('pickleoffice.messages.' + room, []);
    if (Array.isArray(saved)) {
      saved.slice(-30).forEach(function (m) {
        if (m && m.id && m.text) {
          addMessage({ id: m.id, from: m.from || 'past', name: m.name || '피클', body: m.body || '#B9AEC8', text: m.text, at: m.at || nowMs() });
        }
      });
    }
    var savedTasks = Store.json('pickleoffice.tasks.' + room, []);
    if (Array.isArray(savedTasks) && savedTasks.length) {
      tasks = savedTasks;
      taskRev = nowMs();
    }
  }

  function start() {
    var hadProfile = loadProfile();
    var spots = [[620, 376], [300, 376], [900, 376], [300, 540], [900, 540], [1120, 640], [130, 300]];
    var pick = spots[Math.floor(Math.random() * spots.length)];
    var spawn = freePoint(pick[0] + (Math.random() - 0.5) * 60, pick[1] + (Math.random() - 0.5) * 40);
    if (spawn) { me.x = spawn.x; me.y = spawn.y; me.dx = spawn.x; me.dy = spawn.y; }
    renderMe();
    renderRoster();
    loadLocalHistory();
    renderTasks();
    resize();
    bootNet();

    var fbUrl = Store.get('pickleoffice.firebase', '');
    if (fbUrl) bootCloud(fbUrl);

    requestAnimationFrame(frame);

    if (!hadProfile) {
      setTimeout(openWelcome, 350);
    } else if (!Store.get('pickleoffice.hinted')) {
      hintTimer = setTimeout(hideHint, 12000);
    } else {
      hideHint();
    }

    appendSystem('‘' + room + '’ 방에 들어왔어요. 링크를 복사해 피클 친구를 초대해 보세요.');
    setNetUI('connecting');
  }

  // 디버깅·테스트용 (읽기 전용)
  window.__pickleOffice = {
    room: room,
    me: me,
    chars: chars,
    netStatus: function () { return net ? { live: net.live, broker: net.brokerName } : null; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
