/* ─────────────────────────────────────────────
   mqtt-lite.js — 아주 작은 MQTT 3.1.1 (WebSocket) 클라이언트
   외부 라이브러리 없이 브로커에 붙기 위해 필요한 만큼만 구현했어요.
   지원: CONNECT / SUBSCRIBE(#) / PUBLISH(QoS0) / PINGREQ
   ───────────────────────────────────────────── */
(function (global) {
  'use strict';

  var TE = new TextEncoder();
  var TD = new TextDecoder();

  function lenBytes(n) {
    var out = [];
    do {
      var d = n % 128;
      n = Math.floor(n / 128);
      if (n > 0) d |= 0x80;
      out.push(d);
    } while (n > 0);
    return out;
  }

  function strBytes(s) {
    var b = TE.encode(s);
    return [b.length >> 8, b.length & 0xff].concat(Array.from(b));
  }

  function packet(header, body) {
    return new Uint8Array([header].concat(lenBytes(body.length), body));
  }

  function concat(a, b) {
    var out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }

  function MqttLite(url, opts) {
    opts = opts || {};
    this.url = url;
    this.clientId = opts.clientId || ('pkl' + Math.random().toString(16).slice(2, 12));
    this.keepalive = opts.keepalive || 45;
    this.timeout = opts.timeout || 7000;
    this.onMessage = opts.onMessage || function () {};
    this.onClose = opts.onClose || function () {};
    this.sock = null;
    this.connected = false;
    this._buf = new Uint8Array(0);
    this._ping = null;
    this._connectedOnce = false;
  }

  MqttLite.prototype.connect = function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        self._kill();
        reject(new Error('timeout'));
      }, self.timeout);

      function ok() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(self);
      }
      function no(err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        self._kill();
        reject(err);
      }

      self._ok = ok;
      self._no = no;

      var sock;
      try {
        sock = new WebSocket(self.url, 'mqtt');
      } catch (e) {
        no(e);
        return;
      }
      self.sock = sock;
      sock.binaryType = 'arraybuffer';

      sock.onopen = function () {
        try {
          sock.send(self._connectPacket());
        } catch (e) {
          no(e);
        }
      };
      sock.onmessage = function (ev) {
        self._read(ev.data);
      };
      sock.onerror = function () {
        no(new Error('socket error'));
      };
      sock.onclose = function () {
        self._stopPing();
        if (!self.connected) {
          no(new Error('closed'));
        } else {
          self.connected = false;
          self.onClose();
        }
      };
    });
  };

  MqttLite.prototype._connectPacket = function () {
    var cid = strBytes(this.clientId);
    var body = [0x00, 0x04, 77, 81, 84, 84, 0x04, 0x02,
      (this.keepalive >> 8) & 0xff, this.keepalive & 0xff].concat(cid);
    return packet(0x10, body);
  };

  MqttLite.prototype.subscribe = function (topic) {
    if (!this.connected) return false;
    var t = strBytes(topic);
    var body = [0x00, 0x01].concat(t, [0x00]);
    this._send(packet(0x82, body));
    return true;
  };

  MqttLite.prototype.publish = function (topic, payload) {
    if (!this.connected) return false;
    var t = strBytes(topic);
    var p = Array.from(TE.encode(payload));
    return this._send(new Uint8Array([0x30].concat(lenBytes(t.length + p.length), t, p)));
  };

  MqttLite.prototype._send = function (bytes) {
    try {
      if (!this.sock || this.sock.readyState !== 1) return false;
      this.sock.send(bytes);
      return true;
    } catch (e) {
      return false;
    }
  };

  MqttLite.prototype._startPing = function () {
    var self = this;
    this._stopPing();
    this._ping = setInterval(function () {
      self._send(new Uint8Array([0xc0, 0x00]));
    }, Math.max(15, this.keepalive * 0.6) * 1000);
  };

  MqttLite.prototype._stopPing = function () {
    if (this._ping) clearInterval(this._ping);
    this._ping = null;
  };

  MqttLite.prototype._kill = function () {
    this._stopPing();
    try { if (this.sock) this.sock.close(); } catch (e) { /* noop */ }
    this.connected = false;
    this.sock = null;
  };

  MqttLite.prototype.end = function () {
    try {
      if (this.connected) this._send(new Uint8Array([0xe0, 0x00]));
    } catch (e) { /* noop */ }
    this._kill();
  };

  MqttLite.prototype._read = function (data) {
    var self = this;
    if (data instanceof Blob) {
      data.arrayBuffer().then(function (buf) { self._read(buf); });
      return;
    }
    var chunk = new Uint8Array(data);
    this._buf = this._buf.length ? concat(this._buf, chunk) : chunk;

    var off = 0;
    while (this._buf.length - off >= 2) {
      var header = this._buf[off];
      var mult = 1, len = 0, i = off + 1, complete = false;
      while (i < this._buf.length) {
        var b = this._buf[i++];
        len += (b & 0x7f) * mult;
        mult *= 128;
        if ((b & 0x80) === 0) { complete = true; break; }
      }
      if (!complete) break;
      if (this._buf.length < i + len) break;
      this._handle(header, this._buf.subarray(i, i + len));
      off = i + len;
    }
    this._buf = off >= this._buf.length ? new Uint8Array(0) : this._buf.subarray(off);
  };

  MqttLite.prototype._handle = function (header, body) {
    var type = header >> 4;

    if (type === 2) { // CONNACK
      var rc = body.length > 1 ? body[1] : 1;
      if (rc === 0) {
        this.connected = true;
        this._connectedOnce = true;
        this._startPing();
        if (this._ok) this._ok();
      } else if (this._no) {
        this._no(new Error('connack ' + rc));
      }
      return;
    }

    if (type === 3) { // PUBLISH
      var qos = (header >> 1) & 0x03;
      var tlen = (body[0] << 8) | body[1];
      var topic = TD.decode(body.subarray(2, 2 + tlen));
      var pos = 2 + tlen;
      if (qos > 0) pos += 2;
      var payload = TD.decode(body.subarray(pos));
      try { this.onMessage(topic, payload); } catch (e) { /* ignore */ }
      return;
    }
  };

  global.MqttLite = MqttLite;
})(window);
