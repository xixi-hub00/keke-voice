/* keke voice bubble v2. One line:
   <script src=".../player.js" data-u="encrypted url" data-k="key" data-t="translation" data-b="button label"></script>
   File at data-u = 12-byte iv + AES-256-GCM ciphertext; data-k = base64url key. data-t / data-b are optional. */
(function () {
  var NS = window.__kkv || (window.__kkv = { all: [] });
  var BARS = [8, 14, 10, 18, 12, 16, 9, 15, 11, 17, 10, 13, 9, 15];
  var PLAY = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="6.5" y="5.5" width="3.8" height="13" rx="1" fill="currentColor"/><rect x="13.7" y="5.5" width="3.8" height="13" rx="1" fill="currentColor"/></svg>';

  function css() {
    if (document.getElementById('kkv-css')) return;
    var s = document.createElement('style');
    s.id = 'kkv-css';
    s.textContent =
      '.kkv{padding:.5rem 0;font-family:inherit}' +
      '.kkv-b{display:flex;align-items:center;gap:14px;width:72%;max-width:300px;min-width:180px;padding:14px 22px;border-radius:999px;' +
      'background:rgba(180,150,120,.22);border:none;color:var(--text-primary,#2B2825);cursor:pointer;font:inherit;-webkit-tap-highlight-color:transparent}' +
      '.kkv-b svg{flex:none}' +
      '.kkv-w{display:flex;align-items:center;gap:4px;flex:1;min-width:0;overflow:hidden}' +
      '.kkv-w i{display:block;flex:none;width:3px;border-radius:2px;background:currentColor;opacity:.4;transition:opacity .2s}' +
      '.kkv-w i.on{opacity:.9}' +
      '.kkv-d{font-size:14px;flex:none;font-variant-numeric:tabular-nums}' +
      '.kkv-tr{margin-top:10px;font:inherit;font-size:14px;padding:8px 14px;border-radius:999px;cursor:pointer;' +
      'background:transparent;color:var(--text-primary,#2B2825);border:0.5px solid var(--border,rgba(0,0,0,.18))}' +
      '.kkv-tx{font-size:14px;color:var(--text-secondary,#6b645e);line-height:1.7;margin:8px 0 0;white-space:pre-wrap;display:none}' +
      '.kkv-m{font-size:12px;color:var(--text-muted,#8a847e);margin:6px 0 0}' +
      '.kkv-m:empty{display:none}';
    (document.head || document.documentElement).appendChild(s);
  }

  function b64(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); });
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  function mount(sc) {
    if (!sc || sc.__kkv || !sc.parentNode) return;
    sc.__kkv = 1;
    var u = sc.getAttribute('data-u') || '', k = sc.getAttribute('data-k') || '';
    var tx = sc.getAttribute('data-t') || '', label = sc.getAttribute('data-b') || '\u8f6c\u4e2d\u6587';
    if (!u || !k) return;
    css();
    var wrap = el('div', 'kkv'), b = el('button', 'kkv-b'), ic = el('span', '', PLAY), w = el('span', 'kkv-w'), d = el('span', 'kkv-d');
    var m = el('p', 'kkv-m'), a = document.createElement('audio');
    b.type = 'button';
    d.textContent = '\u00b7\u00b7';
    BARS.forEach(function (h) { var i = document.createElement('i'); i.style.height = h + 'px'; w.appendChild(i); });
    ic.style.display = 'flex';
    b.appendChild(ic); b.appendChild(w); b.appendChild(d);
    wrap.appendChild(b);
    if (tx) {
      var tb = el('button', 'kkv-tr'), p = el('p', 'kkv-tx');
      tb.type = 'button';
      tb.textContent = label;
      p.textContent = tx;
      tb.onclick = function () {
        var open = p.style.display !== 'block';
        p.style.display = open ? 'block' : 'none';
        tb.textContent = open ? '\u6536\u8d77' : label;
      };
      wrap.appendChild(tb); wrap.appendChild(p);
    }
    wrap.appendChild(m); wrap.appendChild(a);
    sc.parentNode.insertBefore(wrap, sc);
    NS.all.push(a);

    var mp3 = null;
    var ready = (async function () {
      var r = await fetch(u);
      if (!r.ok) throw new Error('\u53d6\u4e0d\u5230\uff08' + r.status + '\uff09');
      var x = new Uint8Array(await r.arrayBuffer());
      var key = await crypto.subtle.importKey('raw', b64(k), 'AES-GCM', false, ['decrypt']);
      try { mp3 = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: x.slice(0, 12) }, key, x.slice(12))); }
      catch (e) { mp3 = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: x.slice(-12) }, key, x.slice(0, -12))); }
      a.src = URL.createObjectURL(new Blob([mp3], { type: 'audio/mpeg' }));
    })();
    ready.catch(function (e) { m.textContent = e && e.name === 'OperationError' ? '\u89e3\u4e0d\u5f00\uff08\u94a5\u5319\u5bf9\u4e0d\u4e0a\uff09' : '\u6ca1\u53d6\u5230\uff1a' + String(e && e.message || e).slice(0, 80); });

    // \u5c0f\u7a97\u53e3\u4e0d\u8ba9\u7528 blob \u5730\u5740\u65f6\uff0c\u6362\u6210 data \u5730\u5740
    a.onerror = function () {
      if (!mp3 || a.__fb) return;
      a.__fb = 1;
      var bin = '';
      for (var i = 0; i < mp3.length; i += 8192) bin += String.fromCharCode.apply(null, mp3.subarray(i, i + 8192));
      a.src = 'data:audio/mpeg;base64,' + btoa(bin);
    };
    a.onloadedmetadata = function () { if (isFinite(a.duration)) d.textContent = Math.max(1, Math.round(a.duration)) + '\u2033'; };
    var bars = w.children;
    function paint(f) { for (var i = 0; i < bars.length; i++) bars[i].className = i < Math.round(f * bars.length) ? 'on' : ''; }
    a.ontimeupdate = function () { if (a.duration) paint(a.currentTime / a.duration); };
    a.onplay = function () { ic.innerHTML = PAUSE; };
    a.onpause = function () { ic.innerHTML = PLAY; };
    a.onended = function () { ic.innerHTML = PLAY; paint(0); };
    b.onclick = async function () {
      try {
        await ready;
        if (a.paused) {
          NS.all.forEach(function (o) { if (o !== a && !o.paused) o.pause(); });
          await a.play();
        } else a.pause();
        m.textContent = '';
      } catch (e) { m.textContent = '\u653e\u4e0d\u51fa\u6765\uff1a' + String(e && e.message || e).slice(0, 80); }
    };
  }

  mount(document.currentScript);
  function scan() {
    var list = document.querySelectorAll('script[data-u][data-k]');
    for (var i = 0; i < list.length; i++) mount(list[i]);
  }
  scan();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
})();
