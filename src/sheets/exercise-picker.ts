import { GROUPS, OTHER_GROUP } from '../data/exercises.ts';
import { allExercises, libInfo, recentNames, session } from '../domain/workout.ts';
import { closest, data, esc, prefersReducedMotion, q, qa } from '../lib/dom.ts';
import type { ExerciseInfo } from '../types.ts';
import { nameKey, uid8 } from '../lib/format.ts';
import { persistSession, persistSettings } from '../services/persist.ts';
import { store } from '../state/store.ts';
import { ui } from '../state/ui.ts';
import { closeSheet, openSheet } from '../ui/sheet.ts';
import { openSetSheet } from './set-entry.ts';

const ALL = 'Tümü';
let state = { q: '', group: ALL };

export interface PickerOptions {
  title?: string;
  /** Seçilen hareketle ne yapılacağı; verilmezse güne eklenir ve set girişi açılır. */
  onPick?: (info: ExerciseInfo) => void;
  /** Listede işaretlenecek hareketler (ör. zaten eklenmiş olanlar) ve etiketi */
  marked?: Set<string>;
  markLabel?: string;
}

let opts: Required<PickerOptions>;

export function openPicker(options: PickerOptions = {}): void {
  state = { q: '', group: ALL };
  opts = {
    title: options.title || 'Hareket ekle',
    onPick: options.onPick || addExercise,
    marked: options.marked || new Set((session(ui.date)?.exercises || []).map(e => nameKey(e.name))),
    markLabel: options.markLabel || 'bugün eklendi',
  };
  openSheet(
    `<h2>${esc(opts.title)}</h2>
    <input class="search" id="pq" type="search" placeholder="Ara ya da yeni hareket adı yaz" autocomplete="off" aria-label="Hareket ara">
    <div class="chips" id="pg">${[ALL]
      .concat(GROUPS)
      .map(g => `<button type="button" class="chip" data-g="${g}" aria-pressed="${g === ALL}">${g}</button>`)
      .join('')}</div>
    <div id="plist"></div>`,
    sh => {
      const search = q<HTMLInputElement>(sh, '#pq');
      search.addEventListener('input', () => {
        state.q = search.value;
        drawList();
      });
      q(sh, '#pg').addEventListener('click', ev => {
        const b = closest(ev.target, '[data-g]');
        if (!b) return;
        state.group = data(b, 'g');
        qa(sh, '[data-g]').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.g === state.group)));
        drawList();
      });
      drawList();
    },
  );
}

function drawList() {
  const box = document.getElementById('plist');
  if (!box) return;
  const query = nameKey(state.q);
  const all = allExercises();
  const list = all.filter(
    x => (state.group === ALL || x.group === state.group) && (!query || nameKey(x.name).includes(query)),
  );
  const item = (x: ExerciseInfo) =>
    `<li><button data-pick="${esc(x.name)}"><span class="pn">${esc(x.name)}</span><span class="pg">${opts.marked.has(nameKey(x.name)) ? esc(opts.markLabel) : esc(x.group)}</span></button></li>`;

  let html = '';
  if (!query && state.group === ALL) {
    const recent = recentNames(5).map(n => libInfo(n) || { name: n, group: OTHER_GROUP, bar: false });
    if (recent.length)
      html += `<div class="pickhead">Son kullandıkların</div><ul class="pick">${recent.map(item).join('')}</ul><div class="pickhead">Tüm hareketler</div>`;
  }
  const exact = all.some(x => nameKey(x.name) === query);
  if (query && !exact) {
    const g = state.group === ALL ? OTHER_GROUP : state.group;
    html += `<div class="newex"><div style="font-weight:600">“${esc(state.q.trim())}” adında yeni hareket</div>
      <div class="row"><select id="ng" class="sel" style="font-size:16px;font-family:var(--body);font-weight:600;padding:9px 34px 9px 12px" aria-label="Kas grubu">${GROUPS.map(x => `<option ${x === g ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <label class="toggle"><input type="checkbox" id="nb"> Barbell ile</label>
      <button class="btn primary" id="ncreate" style="margin-left:auto">Oluştur ve ekle</button></div></div>`;
  }
  html += list.length
    ? `<ul class="pick">${list.map(item).join('')}</ul>`
    : query
      ? ''
      : `<p style="color:var(--ink-2)">Bu grupta hareket yok.</p>`;
  box.innerHTML = html;

  qa(box, '[data-pick]').forEach(b =>
    b.addEventListener('click', () => {
      const name = data(b, 'pick');
      opts.onPick(libInfo(name) || { name, group: OTHER_GROUP, bar: false });
    }),
  );
  const create = box.querySelector<HTMLElement>('#ncreate');
  if (create)
    create.addEventListener('click', () => {
      const info: ExerciseInfo = {
        name: state.q.trim().slice(0, 60),
        group: q<HTMLSelectElement>(box, '#ng').value,
        bar: q<HTMLInputElement>(box, '#nb').checked,
      };
      store.custom.push(info);
      persistSettings();
      opts.onPick(info);
    });
}

/** Hareketi güne ekler (zaten varsa onu açar) ve set girişini başlatır. */
function addExercise(info: ExerciseInfo): void {
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
    const el = qa(document, 'section.ex')[idx];
    if (el) el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    setTimeout(() => openSetSheet(idx), 120);
  }, 280);
}
