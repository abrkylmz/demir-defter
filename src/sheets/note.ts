import { session } from '../domain/workout.ts';
import { longDate } from '../lib/date.ts';
import { esc, q } from '../lib/dom.ts';
import { persistSession } from '../services/persist.ts';
import { ui } from '../state/ui.ts';
import { closeSheet, openSheet } from '../ui/sheet.ts';
import { toast } from '../ui/toast.ts';

/**
 * Genel not paneli.
 * @param onSave boş string notun silindiği anlamına gelir
 */
export function openNoteSheet(
  title: string,
  subtitle: string,
  value: string | undefined,
  onSave: (value: string) => void,
): void {
  openSheet(
    `<h2>${esc(title)}</h2><div class="sub">${esc(subtitle)}</div>
    <div class="field"><label for="noteIn">Not</label>
      <textarea id="noteIn" class="notein" rows="4" maxlength="500" placeholder="Nasıl hissettin, ağrı, makine ayarı…">${esc(value || '')}</textarea></div>
    <div class="sheetactions">${value ? '<button class="btn danger" id="noteDel">Notu sil</button>' : ''}<button class="btn primary grow" id="noteSave">Kaydet</button></div>`,
    sh => {
      const input = q<HTMLTextAreaElement>(sh, '#noteIn');
      q(sh, '#noteSave').addEventListener('click', () => {
        const v = input.value.trim();
        if (v === (value || '')) {
          closeSheet();
          return;
        }
        onSave(v);
        closeSheet();
        toast(v ? 'Not kaydedildi' : 'Not silindi');
      });
      const del = sh.querySelector<HTMLElement>('#noteDel');
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

export function openDayNote(): void {
  const s = session(ui.date);
  openNoteSheet('Günün notu', longDate(ui.date), s?.note, v => {
    const day = session(ui.date, true);
    if (v) day.note = v;
    else delete day.note;
    persistSession(ui.date);
  });
}
