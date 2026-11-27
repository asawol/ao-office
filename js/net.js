/* ─────────────────────────────────────────────
   net.js — 실시간 동기화
   1) 공개 MQTT 브로커 (WSS) — 설정 없이 바로 동작
   2) BroadcastChannel — 같은 브라우저 탭끼리 (오프라인에서도)
   3) Firebase Realtime Database (선택) — 영구 저장
   ───────────────────────────────────────────── */
(function (global) {
  'use strict';

  var BROKERS = [
    { url: 'wss://broker.emqx.io:8084/mqtt', name: 'EMQX' },
    { url: 'wss://broker.hivemq.com:8884/mqtt', name: 'HiveMQ' },
    { url: 'wss://test.mosquitto.org:8081/mqtt', name: 'mosquitto' }
  ];

  function uid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    return Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
  }

  function OfficeNet(opts) {
    opts = opts || {};
    this.room = opts.room;
    this.clientId = opts.clientId || uid();
    this.onMessage = opts.onMessage || function () {};
    this.onStatus = opts.onStatus || function () {};
    this.base = 'pickleoffice/v1/' + this.room;
    this.channel = null;
    this.mqtt = null;
    this.brokerName = '';
    this.seen = new Set();
    this.seenQueue = [];
    this.started = false;
    this.live = false;
    this._retry = 0;
  }

  OfficeNet.prototype.start = function () {
    if (this.started) return;
    this.started = true;
    var self = this;

    if ('BroadcastChannel' in global) {
      try {
        this.channel = new BroadcastChannel('pickleoffice:' + this.room);
        this.channel.onmessage = function (ev) { self._receive(ev.data); };
      } catch (e) {
        this.channel = null;
      }
    }
    this._attempt(0);
  };

  OfficeNet.prototype._attempt = function (index) {
    var self = this;
    if (index >= BROKERS.length) {
      this.onStatus('local', '이 브라우저 안에서만');
      return;
    }
    this.onStatus('connecting', BROKERS[index].name);
    this._closes = this._closes || 0;

    var client = new MqttLite(BROKERS[index].url, {
      clientId: 'pkl' + this.clientId.slice(0, 10),
      timeout: 6500,
      onMessage: function (topic, payload) { self._onWire(payload); },
      onClose: function () {
        self.live = false;
        self._closes++;
        self.onStatus('connecting', '다시 연결 중');
        var next = self._closes >= 2 ? index + 1 : index;
        if (next >= BROKERS.length) {
          self._closes = 0;
          next = 0;
        }
        setTimeout(function () { self._attempt(next); }, 1600);
      }
    });
    this.mqtt = client;
    this.currentIndex = index;

    client.connect().then(function () {
      client.subscribe(self.base + '/#');
      self.live = true;
      self.brokerName = BROKERS[index].name;
      self.onStatus('live', BROKERS[index].name);
    }).catch(function () {
      try { client.end(); } catch (e) { /* noop */ }
      if (self.mqtt === client) self.mqtt = null;
      self.onStatus('connecting', BROKERS[index].name);
      setTimeout(function () { self._attempt(index + 1); }, 250);
    });
  };

  OfficeNet.prototype._onWire = function (raw) {
    var msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    this._receive(msg);
  };

  OfficeNet.prototype._receive = function (msg) {
    if (!msg || typeof msg !== 'object' || !msg.id || !msg.from) return;
    if (msg.from === this.clientId) return;
    if (this.seen.has(msg.id)) return;
    this.seen.add(msg.id);
    this.seenQueue.push(msg.id);
    if (this.seenQueue.length > 800) {
      var drop = this.seenQueue.splice(0, 400);
      for (var i = 0; i < drop.length; i++) this.seen.delete(drop[i]);
    }
    try { this.onMessage(msg); } catch (e) { /* noop */ }
  };

  OfficeNet.prototype.send = function (payload) {
    var msg = {
      id: uid(),
      from: this.clientId,
      at: Date.now()
    };
    for (var k in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, k)) msg[k] = payload[k];
    }
    var raw = JSON.stringify(msg);
    if (this.channel) {
      try { this.channel.postMessage(msg); } catch (e) { /* noop */ }
    }
    if (this.mqtt && this.mqtt.connected) {
      this.mqtt.publish(this.base + '/msg', raw);
    }
    return msg;
  };

  OfficeNet.prototype.status = function () {
    return this.live ? 'live' : (this.started ? 'local' : 'off');
  };

  OfficeNet.prototype.stop = function () {
    if (this.channel) { try { this.channel.close(); } catch (e) { /* noop */ } this.channel = null; }
    if (this.mqtt) { try { this.mqtt.end(); } catch (e) { /* noop */ } this.mqtt = null; }
    this.started = false;
    this.live = false;
  };

  /* ── Firebase (선택) ─────────────────────── */

  function CloudStore(opts) {
    opts = opts || {};
    this.room = opts.room;
    this.clientId = opts.clientId;
    this.onStatus = opts.onStatus || function () {};
    this.onPresence = opts.onPresence || function () {};
    this.onTasks = opts.onTasks || function () {};
    this.onMessages = opts.onMessages || function () {};
    this.url = '';
    this.profile = null;
    this.timer = null;
    this.hbTimer = null;
    this.stop();
  }

  CloudStore.prototype._p = function (path) {
    return this.url + '/pickleOffice/' + encodeURIComponent(this.room) + '/' + path + '.json';
  };

  CloudStore.prototype.start = function (url) {
    var self = this;
    this.stop();
    url = (url || '').trim().replace(/\/+$/, '');
    if (!url) {
      this.onStatus('off');
      return;
    }
    if (!/^https:\/\/[^\s]+$/.test(url)) {
      this.onStatus('error', 'https:// 로 시작하는 주소를 넣어 주세요');
      return;
    }
    this.url = url;
    this.onStatus('connecting');
    fetch(this._p('tasks'), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        self.onStatus('ready');
        if (data) self.onTasks(data);
        self._poll();
        self.timer = setInterval(function () { self._poll(); }, 9000);
      })
      .catch(function (err) {
        self.onStatus('error', (err && err.message) || '연결 실패');
      });
  };

  CloudStore.prototype.stop = function () {
    if (this.timer) clearInterval(this.timer);
    if (this.hbTimer) clearInterval(this.hbTimer);
    this.timer = null;
    this.hbTimer = null;
    this.url = '';
  };

  CloudStore.prototype._get = function (path) {
    return fetch(this._p(path), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  };

  CloudStore.prototype._put = function (path, value) {
    return fetch(this._p(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  };

  CloudStore.prototype._poll = function () {
    var self = this;
    if (!this.url) return;

    this._get('tasks').then(function (data) {
      if (data) self.onTasks(data);
    }).catch(function () { /* noop */ });

    this._get('messages').then(function (data) {
      if (Array.isArray(data) && data.length) self.onMessages(data);
    }).catch(function () { /* noop */ });
  };

  CloudStore.prototype._heartbeat = function () {
    if (!this.url || !this.profile) return;
    var self = this;
    var body = {
      p: this.profile,
      ts: Date.now()
    };
    this._put('presence/' + this.clientId, body).catch(function (err) {
      self.onStatus('error', err.message);
    });
  };

  CloudStore.prototype.heartbeat = function (profile) {
    this.profile = profile;
    if (this.url) this._heartbeat();
  };

  CloudStore.prototype.saveTasks = function (items, rev) {
    if (!this.url) return;
    this._put('tasks', { items: items, rev: rev }).catch(function () { /* noop */ });
  };

  CloudStore.prototype.saveMessages = function (list) {
    if (!this.url) return;
    this._put('messages', list.slice(-60)).catch(function () { /* noop */ });
  };

  global.OfficeNet = OfficeNet;
  global.CloudStore = CloudStore;
  global.PickleUid = uid;
})(window);
