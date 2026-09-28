import { GROUPS, OTHER_GROUP } from '../data/exercises.js';
import { allExercises, libInfo, recentNames, session } from '../domain/workout.js';
import { $, esc, prefersReducedMotion } from '../lib/dom.js';
import { nameKey, uid8 } from '../lib/format.js';
import { persistSession, persistSettings } from '../services/persist.js';
import { store } from '../state/store.js';
import { ui } from '../state/ui.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { openSetSheet } from './set-entry.js';

const ALL = 'Tümü';
let state = { q: '', group: ALL };

export function openPicker() {
  state = { q: '', group: ALL };
  openSheet(
    `<h2>Hareket ekle</h2>
    <input class="search" id="pq" type="search" placeholder="Ara ya da yeni hareket adı yaz" autocomplete="off" aria-label="Hareket ara">
    <div class="chips" id="pg">${[ALL]
      .concat(GROUPS)
      .map(g => `<button type="button" class="chip" data-g="${g}" aria-pressed="${g === ALL}">${g}</button>`)
      .join('')}</div>
    <div id="plist"></div>`,
    sh => {
      const q = sh.querySelector('#pq');
      q.addEventListener('input', () => {
        state.q = q.value;
        drawList();
      });
      sh.querySelector('#pg').addEventListener('click', ev => {
        const b = ev.target.closest('[data-g]');
        if (!b) return;
        state.group = b.dataset.g;
        sh.querySelectorAll('[data-g]').forEach(c =>
          c.setAttribute('aria-pressed', String(c.dataset.g === state.group)),
        );
        drawList();
      });
      drawList();
    },
  );
}

function drawList() {
  const box = $('#plist');
  if (!box) return;
  const q = nameKey(state.q);
  const inToday = new Set((session(ui.date)?.exercises || []).map(e => nameKey(e.name)));
  const all = allExercises();
  const list = all.filter(
    x => (state.group === ALL || x.group === state.group) && (!q || nameKey(x.name).includes(q)),
  );
  const item = x =>
    `<li><button data-pick="${esc(x.name)}"><span class="pn">${esc(x.name)}</span><span class="pg">${inToday.has(nameKey(x.name)) ? 'bugün eklendi' : esc(x.group)}</span></button></li>`;

  let html = '';
  if (!q && state.group === ALL) {
    const recent = recentNames(5).map(n => libInfo(n) || { name: n, group: OTHER_GROUP });
    if (recent.length)
      html += `<div class="pickhead">Son kullandıkların</div><ul class="pick">${recent.map(item).join('')}</ul><div class="pickhead">Tüm hareketler</div>`;
  }
  const exact = all.some(x => nameKey(x.name) === q);
  if (q && !exact) {
    const g = state.group === ALL ? OTHER_GROUP : state.group;
    html += `<div class="newex"><div style="font-weight:600">“${esc(state.q.trim())}” adında yeni hareket</div>
      <div class="row"><select id="ng" class="sel" style="font-size:16px;font-family:var(--body);font-weight:600;padding:9px 34px 9px 12px" aria-label="Kas grubu">${GROUPS.map(x => `<option ${x === g ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <label class="toggle"><input type="checkbox" id="nb"> Barbell ile</label>
      <button class="btn primary" id="ncreate" style="margin-left:auto">Oluştur ve ekle</button></div></div>`;
  }
  html += list.length
    ? `<ul class="pick">${list.map(item).join('')}</ul>`
    : q
      ? ''
      : `<p style="color:var(--ink-2)">Bu grupta hareket yok.</p>`;
  box.innerHTML = html;

  box
    .querySelectorAll('[data-pick]')
    .forEach(b =>
      b.addEventListener('click', () =>
        addExercise(libInfo(b.dataset.pick) || { name: b.dataset.pick, group: OTHER_GROUP, bar: false }),
      ),
    );
  const create = box.querySelector('#ncreate');
  if (create)
    create.addEventListener('click', () => {
      const info = {
        name: state.q.trim().slice(0, 60),
        group: box.querySelector('#ng').value,
        bar: box.querySelector('#nb').checked,
      };
      store.custom.push(info);
      persistSettings();
      addExercise(info);
    });
}

/** Hareketi güne ekler (zaten varsa onu açar) ve set girişini başlatır. */
function addExercise(info) {
  const s = session(ui.date, true);
  let idx = s.exercises.findIndex(e => nameKey(e.name) === nameKey(info.name));
  if (idx < 0) {
    s.exercises.push({ id: uid8(), name: info.name, group: info.group, bar: !!info.bar, sets: [] });
    idx = s.exercises.length - 1;
    persistSession(ui.date);
  }
  ui.open.add(s.exercises[idx].id);
  closeSheet();
  setTimeout(() => {
    const el = document.querySelectorAll('section.ex')[idx];
    if (el) el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    setTimeout(() => openSetSheet(idx), 120);
  }, 280);
}
