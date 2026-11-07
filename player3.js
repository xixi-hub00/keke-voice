/* keke voice bubble v3. The bubble (from speak) is a ready shell + one loader line:
   <div class="kv3" data-u="encrypted url" data-k="key" data-s="seconds" data-t="translation" data-b="button label">…</div><script src=".../player3.js"></script>
   File at data-u = 12-byte iv + AES-256-GCM ciphertext; data-k = base64url key.
   The ciphertext is fetched right away (not on tap) and kept in Cache Storage, so a reloaded bubble plays at once. */
(function () {
  var NS = window.__kkv3 || (window.__kkv3 = { all: [] });
  var C = 'kkv3', KEEP = 40;
  var BARS = [8, 14, 10, 18, 12, 16, 9, 15, 11, 17, 10, 13];
  var PLAY = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="6.5" y="5.5" width="3.8" height="13" rx="1" fill="currentColor"/><rect x="13.7" y="5.5" width="3.8" height="13" rx="1" fill="currentColor"/></svg>';

  function css() {
    if (document.getElementById('kv3-css')) return;
    var s = document.createElement('style');
    s.id = 'kv3-css';
    s.textContent =
      '.kv3{cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;background:rgba(180,150,120,.22)!important;border:none!important}' +
      '.kv3 svg{flex:none;display:block}' +
      '.kv3-w{display:flex;align-items:center;gap:4px;flex:1;min-width:0;overflow:hidden}' +
      '.kv3-w i{display:block;flex:none;width:3px;border-radius:2px;background:currentColor;opacity:.4}.kv3-w i.on{opacity:.9}' +
      '.kv3-d{flex:none;font-variant-numeric:tabular-nums}' +
      '.kv3-t{display:inline-block;margin-top:10px;font-size:14px;padding:8px 14px;border-radius:999px;cursor:pointer;user-select:none;' +
      'background:transparent!important;color:var(--text-primary,#2B2825);border:0.5px solid var(--border,rgba(0,0,0,.18))!important}' +
      '.kv3-x{font-size:14px;color:var(--text-secondary,#6b645e);line-height:1.7;margin:8px 0 0;white-space:pre-wrap;display:none}' +
      '.kv3-m{font-size:12px;color:var(--text-muted,#8a847e);margin:6px 0 0}.kv3-m:empty{display:none}';
    (document.head || document.documentElement).appendChild(s);
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  function b64(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); });
  }

  async function cached(u) {
    try { var r = await (await caches.open(C)).match(u); return r ? new Uint8Array(await r.arrayBuffer()) : null; } catch (e) { return null; }
  }

  async function keep(u, x) {
    try {
      var c = await caches.open(C);
      await c.put(u, new Response(x));
      var ks = await c.keys();
      for (var i = 0; i < ks.length - KEEP; i++) await c.delete(ks[i]);
    } catch (e) {}
  }

  // 只有 cdn.jsdelivr.net 能用（小窗口拦了别的线路）；失败或 90 秒没取完就再试，最多 3 次
  async function get(u, say) {
    var x = await cached(u);
    if (x) return x;
    for (var n = 1; n <= 3; n++) {
      var ac = new AbortController(), tm = setTimeout(function () { ac.abort(); }, 90000);
      try {
        var r = await fetch(u, { signal: ac.signal });
        if (r.ok) { x = new Uint8Array(await r.arrayBuffer()); clearTimeout(tm); keep(u, x); return x; }
      } catch (e) {}
      clearTimeout(tm);
      if (n < 3) say('网络慢，再取一次（' + (n + 1) + '/3）');
    }
    throw new Error('取不到，过一会儿再点');
  }

  function mount(R) {
    if (R.__kv3) return;
    R.__kv3 = 1;
    var u = R.getAttribute('data-u') || '', k = R.getAttribute('data-k') || '';
    var tx = R.getAttribute('data-t') || '', label = R.getAttribute('data-b') || '转中文', secs = R.getAttribute('data-s');
    if (!u || !k) return;
    css();
    var ic = el('span', '', PLAY), w = el('span', 'kv3-w'), d = el('span', 'kv3-d'), m = el('p', 'kv3-m'), a = new Audio();
    d.textContent = secs ? secs + '″' : '··';
    BARS.forEach(function (h) { var i = document.createElement('i'); i.style.height = h + 'px'; w.appendChild(i); });
    R.innerHTML = '';
    R.appendChild(ic); R.appendChild(w); R.appendChild(d);
    R.setAttribute('role', 'button');
    var after = R;
    if (tx) {
      var tb = el('div', 'kv3-t'), p = el('p', 'kv3-x');
      tb.setAttribute('role', 'button');
      tb.textContent = label;
      p.textContent = tx;
      tb.onclick = function () {
        var open = p.style.display !== 'block';
        p.style.display = open ? 'block' : 'none';
        tb.textContent = open ? '收起' : label;
      };
      R.parentNode.insertBefore(tb, after.nextSibling); after = tb;
      R.parentNode.insertBefore(p, after.nextSibling); after = p;
    }
    R.parentNode.insertBefore(m, after.nextSibling);
    NS.all.push(a);

    var mp = null, go = null;
    function say(s) { m.textContent = s; }
    function load() {
      return go || (go = (async function () {
        var x = await get(u, say);
        var key = await crypto.subtle.importKey('raw', b64(k), 'AES-GCM', false, ['decrypt']);
        mp = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: x.slice(0, 12) }, key, x.slice(12)));
        a.src = URL.createObjectURL(new Blob([mp], { type: 'audio/mpeg' }));
        say('');
      })().catch(function (e) {
        go = null;
        say(e && e.name === 'OperationError' ? '解不开（钥匙对不上）' : String(e && e.message || e).slice(0, 60));
        throw e;
      }));
    }
    // 小窗口不让用 blob 地址时，换成 data 地址
    a.onerror = function () {
      if (!mp || a.__fb) return;
      a.__fb = 1;
      var s = '';
      for (var i = 0; i < mp.length; i += 8192) s += String.fromCharCode.apply(null, mp.subarray(i, i + 8192));
      a.src = 'data:audio/mpeg;base64,' + btoa(s);
    };
    var bars = w.children;
    function paint(f) { for (var i = 0; i < bars.length; i++) bars[i].className = i < Math.round(f * bars.length) ? 'on' : ''; }
    a.onloadedmetadata = function () { if (isFinite(a.duration)) d.textContent = Math.max(1, Math.round(a.duration)) + '″'; };
    a.ontimeupdate = function () { if (a.duration) paint(a.currentTime / a.duration); };
    a.onplay = function () { ic.innerHTML = PAUSE; say(''); };
    a.onpause = function () { ic.innerHTML = PLAY; };
    a.onended = function () { ic.innerHTML = PLAY; paint(0); };
    // iOS 只认点击当下直接调的 play()：语音没取好就不播，只提示；取好了在点击里同步调 play()，中间不 await
    R.onclick = function () {
      if (!a.paused) { a.pause(); return; }
      if (!mp) {
        say('还在取，好了再点一下');
        load().then(function () { say('取好了，点一下就能放'); }, function () {});
        return;
      }
      NS.all.forEach(function (o) { if (o !== a && !o.paused) o.pause(); });
      var pr = a.play();
      if (pr && pr.catch) pr.catch(function (e) { if (a.paused) say('放不出来，再点一下试试（' + String(e && e.name || e).slice(0, 30) + '）'); });
    };
    load().catch(function () {});
  }

  function scan() {
    var list = document.querySelectorAll('.kv3[data-u][data-k]');
    for (var i = 0; i < list.length; i++) mount(list[i]);
  }
  scan();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
})();
