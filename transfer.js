/*
 * 기록 옮기기: import/export of all records as one JSON file ({app, version, docs: {path: data}}).
 * Loaded after the app script, so it can use the app's globals (S, P, M, Store, LKEY, render functions).
 * Records never live in the site files themselves; the viewer picks the file from their own device.
 */
(function () {
  const PATH_OK = /^(settings\/main|plan\/recurring|(months|monthplan)\/\d{4}-\d{2}|weeks\/\d{4}-\d{2}-\d{2})$/;
  const has = (m) => m && ((m.events || []).length || (m.goals || []).length);

  function collect() {
    const docs = {};
    if ((S.routines || []).length) docs['settings/main'] = { routines: S.routines };
    for (const k in S.months) docs['months/' + k] = S.months[k];
    if (P.rec.length) docs['plan/recurring'] = { items: P.rec };
    for (const k in P.weeks) if ((P.weeks[k].items || []).length) docs['weeks/' + k] = P.weeks[k];
    for (const k in M.months) if (has(M.months[k])) docs['monthplan/' + k] = M.months[k];
    return { app: 'juheon-routine', version: 1, exportedAt: new Date().toISOString(), docs: JSON.parse(JSON.stringify(docs)) };
  }
  const hasData = () => Object.keys(collect().docs).length > 0;

  function parseFile(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('JSON 파일이 아니에요.'); }
    if (!o || o.app !== 'juheon-routine' || !o.docs || typeof o.docs !== 'object') throw new Error('주헌 루틴 기록 파일이 아니에요.');
    const bad = Object.keys(o.docs).filter((p) => !PATH_OK.test(p));
    if (bad.length) throw new Error('알 수 없는 항목이 있어요: ' + bad.join(', '));
    return o.docs;
  }

  async function importDocs(docs) {
    if (Store.db) {
      for (const p in docs) await Store.db.doc(p).set(docs[p]);
      return;
    }
    let cur = {};
    try { cur = JSON.parse(localStorage.getItem(LKEY) || '{}') || {}; } catch (e) {}
    const o = { routines: cur.routines || null, months: cur.months || {}, rec: cur.rec || [], weeks: cur.weeks || {}, mplan: cur.mplan || {} };
    for (const p in docs) {
      const [c, id] = p.split('/'), d = docs[p];
      if (p === 'settings/main') o.routines = d.routines || [];
      else if (p === 'plan/recurring') o.rec = d.items || [];
      else if (c === 'months') o.months[id] = d;
      else if (c === 'weeks') o.weeks[id] = d;
      else if (c === 'monthplan') o.mplan[id] = d;
    }
    localStorage.setItem(LKEY, JSON.stringify(o));
  }

  /* ---------- card on the day view ---------- */
  const side = document.querySelector('#viewDay .side');
  if (!side) return;
  const card = document.createElement('section');
  card.className = 'card';
  card.innerHTML =
    '<h3>기록 옮기기</h3>' +
    '<p class="hint">claude.ai 앱에서 옮긴 기록 파일(.json)을 불러오거나, 지금 기록을 파일로 저장해요. 파일은 이 기기에서만 읽고, 사이트에 올라가지 않아요.</p>' +
    '<div class="ed-foot" style="margin-top:10px">' +
    '<label class="btn pri" for="imp-file" tabindex="0">기록 가져오기</label>' +
    '<input type="file" id="imp-file" accept=".json,application/json" hidden>' +
    '<button class="btn" type="button" id="exp-btn">파일로 내보내기</button></div>' +
    '<p class="hint" id="imp-msg" role="status" style="margin-top:8px"></p>' +
    '<div class="ed-foot" id="imp-confirm" hidden style="margin-top:8px">' +
    '<button class="btn danger" type="button" id="imp-yes">덮어쓰고 가져오기</button>' +
    '<button class="btn" type="button" id="imp-no">취소</button></div>';
  side.appendChild(card);

  const $q = (id) => document.getElementById(id);
  const msg = (t) => { $q('imp-msg').textContent = t; };
  let pending = null;

  $q('imp-file').previousElementSibling.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $q('imp-file').click(); } };

  async function run(docs) {
    $q('imp-confirm').hidden = true;
    msg('가져오는 중…');
    try {
      await importDocs(docs);
      msg('가져왔어요. 화면을 새로 불러올게요.');
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      msg('가져오지 못했어요: ' + (e && e.message || '알 수 없는 오류') + '. 잠시 뒤 다시 해 보세요.');
    }
  }

  $q('imp-file').onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    let docs;
    try { docs = parseFile(await f.text()); } catch (err) { msg(err.message); return; }
    const n = Object.keys(docs).length;
    if (hasData()) {
      pending = docs;
      msg('파일에 기록 묶음 ' + n + '개가 있어요. 같은 날짜·주·달의 기록은 파일 내용으로 바뀌어요.');
      $q('imp-confirm').hidden = false;
    } else run(docs);
  };
  $q('imp-yes').onclick = () => { if (pending) run(pending); pending = null; };
  $q('imp-no').onclick = () => { pending = null; $q('imp-confirm').hidden = true; msg(''); };

  /* first run: when this device (or the signed-in account) has no records yet, load the bundled seed once */
  const SEEDED = 'juheon-routine-seeded';
  (async () => {
    const seed = window.ROUTINE_SEED;
    if (!seed || !seed.docs) return;
    let done = false; try { done = localStorage.getItem(SEEDED) === '1'; } catch (e) {}
    for (let i = 0; i < 60 && !S.ready; i++) await new Promise((r) => setTimeout(r, 250));
    if (!S.ready) return;
    if (hasData()) { try { localStorage.setItem(SEEDED, '1'); } catch (e) {} return; }
    if (done && !Store.db) return;
    let docs; try { docs = parseFile(JSON.stringify(seed)); } catch (e) { return; }
    msg('저장해 둔 기록을 처음 한 번 불러오는 중…');
    try { localStorage.setItem(SEEDED, '1'); } catch (e) {}
    run(docs);
  })();

  $q('exp-btn').onclick = () => {
    const blob = new Blob([JSON.stringify(collect(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'juheon-routine-' + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    msg('기록을 파일로 저장했어요.');
  };
})();
