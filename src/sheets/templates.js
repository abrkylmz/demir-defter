import { OTHER_GROUP } from '../data/exercises.js';
import { libInfo, session, sortedDates } from '../domain/workout.js';
import { parseYmd } from '../lib/date.js';
import { esc } from '../lib/dom.js';
import { nameKey, uid8 } from '../lib/format.js';
import { persistSession, persistSettings } from '../services/persist.js';
import { store } from '../state/store.js';
import { ui } from '../state/ui.js';
import { trash } from '../ui/icons.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

const PAST_LIMIT = 6;

/** Hareketleri seçili güne boş setlerle ekler; günde zaten olanları atlar. */
function applyExercises(list) {
  const s = session(ui.date, true);
  let added = 0;
  let firstId = null;
  list.forEach(x => {
    if (s.exercises.some(e => nameKey(e.name) === nameKey(x.name))) return;
    const info = libInfo(x.name) || x;
    const id = uid8();
    if (!firstId) firstId = id;
    s.exercises.push({ id, name: info.name, group: info.group || OTHER_GROUP, bar: !!info.bar, sets: [] });
    added++;
  });
  if (added) {
    ui.open.add(firstId);
    persistSession(ui.date);
  }
  closeSheet();
  toast(added ? `${added} hareket eklendi` : 'Bu hareketler zaten ekli');
}

const pastLabel = d =>
  parseYmd(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' });

export function openTemplates() {
  const past = sortedDates()
    .filter(d => d !== ui.date)
    .reverse()
    .slice(0, PAST_LIMIT);
  const tplList = store.templates.length
    ? `<ul class="tpl">${store.templates
        .map(
          t => `<li><button class="go" data-tpl="${esc(t.id)}"><span class="pn">${esc(t.name)}</span><span class="tx">${esc(t.exercises.map(x => x.name).join(', '))}</span></button>
        <button class="tdel" data-tdel="${esc(t.id)}" aria-label="${esc(t.name)} şablonunu sil">${trash}</button></li>`,
        )
        .join('')}</ul>`
    : `<p class="hint">Henüz şablonun yok. Bir günün hareketlerini “Şablon kaydet” ile saklayabilirsin.</p>`;
  const pastList = past.length
    ? `<div class="pickhead">Önceki antrenmanı tekrarla</div><ul class="tpl">${past
        .map(
          d =>
            `<li><button class="go" data-past="${d}"><span class="pn">${esc(pastLabel(d))}</span><span class="tx">${esc(
              store.sessions[d].exercises
                .filter(e => e.sets.length)
                .map(e => e.name)
                .join(', '),
            )}</span></button></li>`,
        )
        .join('')}</ul>`
    : '';

  openSheet(
    `<h2>Şablondan ekle</h2><div class="sub">Hareketler boş setlerle eklenir, son sefer ağırlıkları hazır gelir.</div>
    <div id="tplbox"><div class="pickhead">Şablonların</div>${tplList}${pastList}</div>`,
    sh => {
      sh.querySelector('#tplbox').addEventListener('click', ev => {
        const b = ev.target.closest('[data-tpl],[data-past],[data-tdel]');
        if (!b) return;
        if (b.dataset.tpl) {
          const t = store.templates.find(x => x.id === b.dataset.tpl);
          if (t) applyExercises(t.exercises);
        } else if (b.dataset.past) {
          applyExercises(store.sessions[b.dataset.past].exercises.filter(e => e.sets.length));
        } else {
          deleteTemplate(b);
        }
      });
    },
  );
}

/** İlk dokunuş onay ister, ikincisi siler. */
function deleteTemplate(button) {
  const t = store.templates.find(x => x.id === button.dataset.tdel);
  if (!t) return;
  if (!button.classList.contains('confirm')) {
    button.classList.add('confirm');
    button.textContent = 'Sil';
    button.setAttribute('aria-label', `${t.name} silinsin mi? Onaylamak için tekrar dokun`);
    return;
  }
  store.templates = store.templates.filter(x => x !== t);
  persistSettings();
  button.closest('li').remove();
  toast(`“${t.name}” silindi`);
}

export function openSaveTemplate() {
  const ex = session(ui.date).exercises;
  const suggested = [...new Set(ex.map(e => e.group || OTHER_GROUP))].slice(0, 3).join(' + ');
  openSheet(
    `<h2>Şablon kaydet</h2><div class="sub">${ex.length} hareket: ${esc(ex.map(e => e.name).join(', '))}</div>
    <div class="field"><label for="tplName">Şablon adı</label><input id="tplName" class="search" style="margin-top:0" maxlength="40" autocomplete="off" value="${esc(suggested)}"></div>
    <p class="hint" id="tplHint"></p>
    <div class="sheetactions"><button class="btn primary grow" id="tplSave">Kaydet</button></div>`,
    sh => {
      const input = sh.querySelector('#tplName');
      const hint = sh.querySelector('#tplHint');
      const existingIndex = () => store.templates.findIndex(t => nameKey(t.name) === nameKey(input.value));
      const update = () => {
        hint.textContent =
          input.value.trim() && existingIndex() >= 0 ? 'Bu adda bir şablon var, üzerine yazılacak.' : '';
      };
      input.addEventListener('input', update);
      input.addEventListener('focus', () => input.select());
      update();

      const save = () => {
        const name = input.value.trim().slice(0, 40);
        if (!name) {
          toast('Şablona bir ad ver');
          input.focus();
          return;
        }
        const tpl = {
          id: uid8(),
          name,
          exercises: ex.map(e => ({ name: e.name, group: e.group || OTHER_GROUP, bar: !!e.bar })),
        };
        const i = existingIndex();
        if (i >= 0) {
          tpl.id = store.templates[i].id;
          store.templates[i] = tpl;
        } else store.templates.push(tpl);
        persistSettings();
        closeSheet();
        toast(`“${name}” şablonu kaydedildi`);
      };
      sh.querySelector('#tplSave').addEventListener('click', save);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') save();
      });
    },
  );
}
