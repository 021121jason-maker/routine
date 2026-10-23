/*
 * Standalone-site backend for 주헌 루틴.
 * The app was written against the claude.ai artifact runtime (`claude.use("db")`, `claude.use("user")`).
 * This file provides the same small surface on top of Supabase, so the app code runs unchanged:
 *   db.doc(path).set/update/onSnapshot, db.collection(path).onSnapshot, user.isOwner().
 * Every document is one row in the `docs` table: (user_id, path, data jsonb), guarded by row-level security.
 * With no Supabase config, or when the viewer picks "이 기기에서만 쓰기", use("db") resolves null and the app
 * falls back to browser storage.
 */
(function () {
  const cfg = window.ROUTINE_CONFIG || {};
  const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const LOCAL_CHOICE = 'juheon-routine-local-only';
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
  function deepMerge(base, patch) {
    const out = isObj(base) ? clone(base) : {};
    for (const k in patch) out[k] = isObj(patch[k]) && isObj(out[k]) ? deepMerge(out[k], patch[k]) : clone(patch[k]);
    return out;
  }

  let sb = null;
  if (configured) sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  /* ---------- login screen ---------- */
  function loginScreen() {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'login';
      wrap.innerHTML =
        '<form class="login-card" novalidate>' +
        '<h1 class="brand">주헌 루틴<small>로그인하면 휴대폰과 PC 기록이 이어져요</small></h1>' +
        '<div class="field"><label for="login-email">이메일</label>' +
        '<input id="login-email" type="email" autocomplete="email" placeholder="you@example.com" required></div>' +
        '<button class="btn pri" type="submit" id="login-send">로그인 링크 받기</button>' +
        '<p class="hint" id="login-msg" role="status"></p>' +
        '<button class="btn" type="button" id="login-local">로그인 없이 이 기기에서만 쓰기</button>' +
        '</form>';
      document.body.appendChild(wrap);
      const form = wrap.querySelector('form'), msg = wrap.querySelector('#login-msg'), send = wrap.querySelector('#login-send');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const email = wrap.querySelector('#login-email').value.trim();
        if (!email) { msg.textContent = '이메일을 적어 주세요.'; return; }
        send.disabled = true; msg.textContent = '보내는 중…';
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
        send.disabled = false;
        msg.textContent = error
          ? '링크를 보내지 못했어요: ' + error.message
          : email + ' 으로 로그인 링크를 보냈어요. 메일의 링크를 누르면 이 페이지로 돌아와 바로 시작해요.';
      };
      wrap.querySelector('#login-local').onclick = () => {
        try { localStorage.setItem(LOCAL_CHOICE, '1'); } catch (e) {}
        wrap.remove(); resolve(null);
      };
      sb.auth.onAuthStateChange((_ev, session) => { if (session) { wrap.remove(); resolve(session); } });
    });
  }

  let sessionPromise = null;
  async function getSession() {
    if (!configured) return null;
    if (!sessionPromise) sessionPromise = (async () => {
      const { data } = await sb.auth.getSession();
      if (data.session) return data.session;
      let local = false; try { local = localStorage.getItem(LOCAL_CHOICE) === '1'; } catch (e) {}
      if (local) return null;
      return loginScreen();
    })();
    return sessionPromise;
  }

  /* ---------- document store ---------- */
  function makeDb(session) {
    const uid = session.user.id;
    const cache = new Map();
    const listeners = new Set();
    let pending = 0, lastLoad = 0;
    const fail = (error) => { const e = new Error(error && error.message || 'unavailable'); e.code = 'unavailable'; throw e; };

    function emit(l) {
      if (l.kind === 'doc') {
        const d = cache.get(l.path);
        l.next({ id: l.path.split('/').pop(), exists: d !== undefined, data: () => clone(d), metadata: { fromCache: false, hasPendingWrites: false } });
      } else {
        const pre = l.path + '/';
        const docs = [...cache.entries()]
          .filter(([p]) => p.startsWith(pre) && !p.slice(pre.length).includes('/'))
          .map(([p, d]) => ({ id: p.slice(pre.length), exists: true, data: () => clone(d), metadata: {} }));
        l.next({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } });
      }
    }
    async function load() {
      const { data, error } = await sb.from('docs').select('path,data');
      if (error) throw error;
      cache.clear();
      data.forEach((r) => cache.set(r.path, r.data));
      lastLoad = Date.now();
      listeners.forEach(emit);
    }
    const ready = load();
    // pick up edits made on another device when this tab comes back to the front
    const refresh = () => { if (document.visibilityState === 'visible' && !pending && Date.now() - lastLoad > 5000) load().catch(() => {}); };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);

    async function write(path, data) {
      pending++;
      try {
        const { error } = await sb.from('docs').upsert({ user_id: uid, path, data, updated_at: new Date().toISOString() });
        if (error) fail(error);
        cache.set(path, clone(data));
      } finally { pending--; }
    }
    function subscribe(kind, path, next, err) {
      const l = { kind, path, next };
      listeners.add(l);
      ready.then(() => listeners.has(l) && emit(l), (e) => err && err({ code: 'unavailable', message: e.message }));
      return () => listeners.delete(l);
    }
    function doc(path) {
      return {
        id: path.split('/').pop(), path,
        async get() { await ready; const d = cache.get(path); return { id: path.split('/').pop(), exists: d !== undefined, data: () => clone(d), metadata: {} }; },
        set: (data) => write(path, clone(data)),
        update: (data) => write(path, deepMerge(cache.get(path), data)),
        async delete() { const { error } = await sb.from('docs').delete().eq('path', path); if (error) fail(error); cache.delete(path); },
        onSnapshot: (next, err) => subscribe('doc', path, next, err),
      };
    }
    function collection(path) {
      return { path, doc: (id) => doc(path + '/' + id), onSnapshot: (next, err) => subscribe('col', path, next, err) };
    }
    return { doc, collection };
  }

  let dbPromise = null;
  const signedIn = { isOwner: async () => true, canEdit: async () => true, can: async () => true, id: async () => null };

  window.claude = {
    use: async (name) => {
      if (name === 'db') {
        if (!dbPromise) dbPromise = getSession().then((s) => (s ? makeDb(s) : null));
        return dbPromise;
      }
      if (name === 'user') return (await getSession()) ? signedIn : null;
      return null;
    },
  };

  /* ---------- account control in the tab bar ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    if (!configured) return;
    const tabs = document.querySelector('.tabbar') || document.querySelector('.tabs');
    if (!tabs) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'acct';
    tabs.appendChild(b);
    const paint = async () => {
      const { data } = await sb.auth.getSession();
      b.textContent = data.session ? '로그아웃' : '로그인해서 동기화';
      b.onclick = async () => {
        if (data.session) await sb.auth.signOut();
        try { localStorage.removeItem(LOCAL_CHOICE); } catch (e) {}
        location.reload();
      };
    };
    paint();
  });
})();
