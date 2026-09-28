import { session } from '../domain/workout.js';
import { longDate } from '../lib/date.js';
import { esc } from '../lib/dom.js';
import { persistSession } from '../services/persist.js';
import { ui } from '../state/ui.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/**
 * Genel not paneli.
 * @param {(value: string) => void} onSave boş string notun silindiği anlamına gelir
 */
export function openNoteSheet(title, subtitle, value, onSave) {
  openSheet(
    `<h2>${esc(title)}</h2><div class="sub">${esc(subtitle)}</div>
    <div class="field"><label for="noteIn">Not</label>
      <textarea id="noteIn" class="notein" rows="4" maxlength="500" placeholder="Nasıl hissettin, ağrı, makine ayarı…">${esc(value || '')}</textarea></div>
    <div class="sheetactions">${value ? '<button class="btn danger" id="noteDel">Notu sil</button>' : ''}<button class="btn primary grow" id="noteSave">Kaydet</button></div>`,
    sh => {
      const input = sh.querySelector('#noteIn');
      sh.querySelector('#noteSave').addEventListener('click', () => {
        const v = input.value.trim();
        if (v === (value || '')) {
          closeSheet();
          return;
        }
        onSave(v);
        closeSheet();
        toast(v ? 'Not kaydedildi' : 'Not silindi');
      });
      const del = sh.querySelector('#noteDel');
      if (del)
        del.addEventListener('click', () => {
          onSave('');
          closeSheet();
          toast('Not silindi');
        });
      setTimeout(() => input.focus({ preventScroll: true }), 50);
    },
  );
}

export function openDayNote() {
  const s = session(ui.date);
  openNoteSheet('Günün notu', longDate(ui.date), s && s.note, v => {
    const day = session(ui.date, true);
    if (v) day.note = v;
    else delete day.note;
    persistSession(ui.date);
  });
}
