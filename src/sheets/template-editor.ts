// Şablon düzenleyici: ad, hareket ekleme/çıkarma ve sıralama. Yeni şablon da buradan oluşturulur.
// Hareket eklerken seçici açılır; taslak bu modülde tutulur ve seçimden sonra düzenleyiciye dönülür.
import { OTHER_GROUP } from '../data/exercises.ts';
import { closest, data, esc, q } from '../lib/dom.ts';
import { clone, nameKey, uid8 } from '../lib/format.ts';
import { persistSettings } from '../services/persist.ts';
import { store } from '../state/store.ts';
import type { ExerciseInfo, Template } from '../types.ts';
import { arrowDown, arrowUp, cross, plus } from '../ui/icons.ts';
import { openSheet } from '../ui/sheet.ts';
import { toast } from '../ui/toast.ts';
import { openPicker } from './exercise-picker.ts';
import { openTemplates } from './templates.ts';

const MAX_NAME = 40;

/** Düzenlenen şablonun kopyası; kaydedilene kadar store değişmez. */
let draft: Template | null = null;
let isNew = false;

/** Mevcut şablonu (id) ya da yeni boş şablonu düzenlemek için açar. */
export function openTemplateEditor(id: string | null): void {
  const existing = id ? store.templates.find(t => t.id === id) : undefined;
  isNew = !existing;
  draft = existing ? clone(existing) : { id: uid8(), name: '', exercises: [] };
  render();
}

function render(focusName = false): void {
  const t = draft;
  if (!t) return;
  const rows = t.exercises
    .map(
      (x, i) => `<li>
        <span class="tpe-name"><span class="pn">${esc(x.name)}</span><span class="tx">${esc(x.group || OTHER_GROUP)}${x.bar ? ', barbell' : ''}</span></span>
        <button class="tdel" data-move="${i}" data-dir="-1" aria-label="${esc(x.name)} yukarı taşı" ${i === 0 ? 'disabled' : ''}>${arrowUp}</button>
        <button class="tdel" data-move="${i}" data-dir="1" aria-label="${esc(x.name)} aşağı taşı" ${i === t.exercises.length - 1 ? 'disabled' : ''}>${arrowDown}</button>
        <button class="tdel" data-remove="${i}" aria-label="${esc(x.name)} şablondan çıkar">${cross}</button>
      </li>`,
    )
    .join('');

  openSheet(
    `<h2>${isNew ? 'Yeni şablon' : 'Şablonu düzenle'}</h2>
    <div class="field"><label for="tpeName">Şablon adı</label>
      <input id="tpeName" class="search" style="margin-top:0" maxlength="${MAX_NAME}" autocomplete="off" value="${esc(t.name)}" placeholder="Örn. İtiş Günü"></div>
    <div class="pickhead">Hareketler (${t.exercises.length})</div>
    ${rows ? `<ul class="tpl tpe" id="tpeList">${rows}</ul>` : '<p class="hint" id="tpeList">Henüz hareket yok. Aşağıdan ekle.</p>'}
    <button class="btn" id="tpeAdd" style="width:100%;margin-top:10px;border-style:dashed">${plus()}Hareket ekle</button>
    <p class="auth-error" role="alert" id="tpeErr"></p>
    <div class="sheetactions">
      <button class="btn" id="tpeCancel">Vazgeç</button>
      <button class="btn primary grow" id="tpeSave">Kaydet</button>
    </div>
    ${isNew ? '' : '<button class="textbtn" id="tpeDelete" style="display:block;margin:10px auto 0;color:var(--red)">Şablonu sil</button>'}`,
    sh => {
      const name = q<HTMLInputElement>(sh, '#tpeName');
      // Taslağa ad her tuşta yazılır; seçiciye gidip dönünce kaybolmasın
      name.addEventListener('input', () => {
        if (draft) draft.name = name.value;
      });

      q(sh, '#tpeList').addEventListener('click', ev => {
        if (!draft) return;
        const move = closest(ev.target, '[data-move]');
        const remove = closest(ev.target, '[data-remove]');
        if (move) {
          const i = Number(data(move, 'move'));
          const j = i + Number(data(move, 'dir'));
          if (j < 0 || j >= draft.exercises.length) return;
          [draft.exercises[i], draft.exercises[j]] = [draft.exercises[j], draft.exercises[i]];
          render();
          // Odağı taşınan hareketin aynı düğmesine geri ver (klavyeyle art arda taşıyabilmek için)
          document.querySelector<HTMLElement>(`[data-move="${j}"][data-dir="${data(move, 'dir')}"]`)?.focus();
        } else if (remove) {
          const [gone] = draft.exercises.splice(Number(data(remove, 'remove')), 1);
          render();
          toast(`${gone.name} çıkarıldı`);
        }
      });

      q(sh, '#tpeAdd').addEventListener('click', () => {
        const current = draft;
        if (!current) return;
        openPicker({
          title: 'Şablona hareket ekle',
          marked: new Set(current.exercises.map(x => nameKey(x.name))),
          markLabel: 'şablonda',
          onPick: (info: ExerciseInfo) => {
            if (!current.exercises.some(x => nameKey(x.name) === nameKey(info.name)))
              current.exercises.push({ name: info.name, group: info.group || OTHER_GROUP, bar: !!info.bar });
            draft = current;
            render();
          },
        });
      });

      q(sh, '#tpeCancel').addEventListener('click', () => {
        draft = null;
        openTemplates();
      });

      q(sh, '#tpeSave').addEventListener('click', () => {
        const err = q(sh, '#tpeErr');
        const t2 = draft;
        if (!t2) return;
        const n = name.value.trim().slice(0, MAX_NAME);
        if (!n) {
          err.textContent = 'Şablona bir ad ver.';
          name.focus();
          return;
        }
        if (store.templates.some(x => x.id !== t2.id && nameKey(x.name) === nameKey(n))) {
          err.textContent = 'Bu adda başka bir şablon var.';
          name.focus();
          return;
        }
        if (!t2.exercises.length) {
          err.textContent = 'Şablona en az bir hareket ekle.';
          return;
        }
        const saved: Template = { ...t2, name: n };
        const i = store.templates.findIndex(x => x.id === saved.id);
        if (i >= 0) store.templates[i] = saved;
        else store.templates.push(saved);
        persistSettings();
        draft = null;
        toast(`“${n}” kaydedildi`);
        openTemplates();
      });

      sh.querySelector('#tpeDelete')?.addEventListener('click', ev => {
        const b = ev.currentTarget as HTMLButtonElement;
        if (!b.dataset.confirm) {
          b.dataset.confirm = '1';
          b.textContent = 'Silmek için tekrar dokun';
          return;
        }
        const t3 = draft;
        if (!t3) return;
        store.templates = store.templates.filter(x => x.id !== t3.id);
        persistSettings();
        draft = null;
        toast(`“${t3.name}” silindi`);
        openTemplates();
      });

      if (focusName || (isNew && !t.name)) setTimeout(() => name.focus({ preventScroll: true }), 50);
    },
  );
}
