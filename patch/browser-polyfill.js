/*
 * 非安全上下文（HTTP + IP/域名）下补齐浏览器缺失的 API。
 * 浏览器规范要求以下 API 仅在 https 或 localhost 可用；
 * 通过 HTTP 访问局域网 IP 时它们为 undefined，导致应用启动失败。
 *
 * 仅补齐缺失的接口，浏览器原生支持时完全不介入。
 */
(function () {
  "use strict";

  var cryptoObj = window.crypto || (window.crypto = {});

  /* ---------- crypto.randomUUID ---------- */
  if (typeof cryptoObj.randomUUID !== "function") {
    cryptoObj.randomUUID = function () {
      var bytes = new Uint8Array(16);
      if (typeof cryptoObj.getRandomValues === "function") cryptoObj.getRandomValues(bytes);
      else for (var i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      var hex = "0123456789abcdef";
      var out = "";
      for (var j = 0; j < 16; j++) {
        if (j === 4 || j === 6 || j === 8 || j === 10) out += "-";
        out += hex[bytes[j] >> 4] + hex[bytes[j] & 0x0f];
      }
      return out;
    };
  }

  /* ---------- SHA-256（用于 crypto.subtle.digest） ---------- */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function sha256(bytes) {
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var len = bytes.length;
    // 追加 0x80，补零到 56 (mod 64)，最后 8 字节存原始位长
    var withPad = new Uint8Array((((len + 8) >> 6) + 1) << 6);
    withPad.set(bytes);
    withPad[len] = 0x80;
    var bitLenHi = Math.floor(len / 0x20000000);
    var bitLenLo = (len << 3) >>> 0;
    var tail = withPad.length;
    withPad[tail - 8] = (bitLenHi >>> 24) & 0xff;
    withPad[tail - 7] = (bitLenHi >>> 16) & 0xff;
    withPad[tail - 6] = (bitLenHi >>> 8) & 0xff;
    withPad[tail - 5] = bitLenHi & 0xff;
    withPad[tail - 4] = (bitLenLo >>> 24) & 0xff;
    withPad[tail - 3] = (bitLenLo >>> 16) & 0xff;
    withPad[tail - 2] = (bitLenLo >>> 8) & 0xff;
    withPad[tail - 1] = bitLenLo & 0xff;

    var w = new Int32Array(64);
    for (var offset = 0; offset < tail; offset += 64) {
      for (var i = 0; i < 16; i++) {
        var p = offset + i * 4;
        w[i] = (withPad[p] << 24) | (withPad[p + 1] << 16) | (withPad[p + 2] << 8) | withPad[p + 3];
      }
      for (i = 16; i < 64; i++) {
        var s0 = (w[i - 15] >>> 7 | w[i - 15] << 25) ^ (w[i - 15] >>> 18 | w[i - 15] << 14) ^ (w[i - 15] >>> 3);
        var s1 = (w[i - 2] >>> 17 | w[i - 2] << 15) ^ (w[i - 2] >>> 19 | w[i - 2] << 13) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (i = 0; i < 64; i++) {
        var S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (hh + S1 + ch + K[i] + w[i]) | 0;
        var S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;
        hh = g; g = f; f = e;
        e = (d + temp1) | 0;
        d = c; c = b; b = a;
        a = (temp1 + temp2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }

    var out = new Uint8Array(32);
    for (i = 0; i < 8; i++) {
      out[i * 4] = (h[i] >>> 24) & 0xff;
      out[i * 4 + 1] = (h[i] >>> 16) & 0xff;
      out[i * 4 + 2] = (h[i] >>> 8) & 0xff;
      out[i * 4 + 3] = h[i] & 0xff;
    }
    return out;
  }

  /* ---------- crypto.subtle.digest ---------- */
  if (!cryptoObj.subtle || typeof cryptoObj.subtle.digest !== "function") {
    var subtle = cryptoObj.subtle || {};
    subtle.digest = function (algorithm, data) {
      return new Promise(function (resolve, reject) {
        try {
          var name = typeof algorithm === "string" ? algorithm : algorithm && algorithm.name;
          if (String(name).toUpperCase().replace(/-/g, "") !== "SHA256") {
            reject(new Error("polyfill 仅支持 SHA-256，收到：" + name));
            return;
          }
          var bytes;
          if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
          else if (ArrayBuffer.isView(data)) bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          else { reject(new Error("digest 数据必须是 ArrayBuffer 或类型化数组")); return; }
          var result = sha256(bytes);
          resolve(result.buffer);
        } catch (error) { reject(error); }
      });
    };
    try { cryptoObj.subtle = subtle; }
    catch (e) { Object.defineProperty(cryptoObj, "subtle", { value: subtle, configurable: true }); }
  }

  /* ---------- navigator.clipboard ---------- */
  if (navigator.clipboard === undefined) {
    var readTextFallback = function () {
      return new Promise(function (resolve, reject) {
        var area = document.createElement("textarea");
        area.value = "";
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        document.body.removeChild(area);
        if (ok) resolve("");
        else reject(new Error("当前浏览器不支持读取剪贴板，请在 HTTPS 下使用"));
      });
    };
    var writeTextFallback = function (text) {
      return new Promise(function (resolve, reject) {
        var area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        document.body.removeChild(area);
        if (ok) resolve(); else reject(new Error("复制失败"));
      });
    };
    var clipboardPolyfill = {
      readText: readTextFallback,
      writeText: writeTextFallback,
      read: function () { return Promise.reject(new Error("当前浏览器不支持读取剪贴板图片，请在 HTTPS 下使用")); },
      write: function (items) {
        // 仅支持纯文本写入，图片写入在非安全上下文无法实现。
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          if (item && typeof item.getType === "function") {
            var blob = item.getType("text/plain");
            if (blob) return blob.then(function (b) { return b.text(); }).then(writeTextFallback);
          }
        }
        return Promise.reject(new Error("当前浏览器不支持写入该类型剪贴板内容"));
      }
    };
    try { Object.defineProperty(navigator, "clipboard", { value: clipboardPolyfill, configurable: true }); }
    catch (e) { /* 无法覆盖时保持缺失，业务侧已有容错 */ }
  }

  /* ---------- navigator.mediaDevices ---------- */
  if (navigator.mediaDevices === undefined) {
    try {
      Object.defineProperty(navigator, "mediaDevices", {
        value: {
          getUserMedia: function () {
            return Promise.reject(new Error("当前浏览器在非 HTTPS 环境下无法访问麦克风，语音输入不可用"));
          },
          enumerateDevices: function () { return Promise.resolve([]); }
        },
        configurable: true
      });
    } catch (e) { /* 保持缺失 */ }
  }
})();
