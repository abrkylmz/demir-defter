import { session } from '../domain/workout.js';
import { esc } from '../lib/dom.js';
import { persistSession } from '../services/persist.js';
import { ui } from '../state/ui.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { openNoteSheet } from './note.js';

/** Hareket kartındaki "…" menüsü: sırala, not, ilerleme, sil. */
export function openExerciseMenu(i) {
  const s = session(ui.date);
  const e = s.exercises[i];
  openSheet(
    `<h2>${esc(e.name)}</h2><div class="sub">${e.sets.length} set kayıtlı</div>
    <div class="menu">
      ${i > 0 ? `<button class="btn" data-m="up">Yukarı taşı</button>` : ''}
      ${i < s.exercises.length - 1 ? `<button class="btn" data-m="down">Aşağı taşı</button>` : ''}
      <button class="btn" data-m="note">${e.note ? 'Notu düzenle' : 'Not ekle'}</button>
      <button class="btn" data-m="progress">İlerlemeyi gör</button>
      <button class="btn danger" data-m="del">Hareketi ve setlerini sil</button>
    </div>`,
    sh => {
      sh.querySelectorAll('[data-m]').forEach(b =>
        b.addEventListener('click', () => {
          const m = b.dataset.m;
          if (m === 'up' || m === 'down') {
            const j = m === 'up' ? i - 1 : i + 1;
            [s.exercises[i], s.exercises[j]] = [s.exercises[j], s.exercises[i]];
            persistSession(ui.date);
            closeSheet();
          } else if (m === 'note') {
            openNoteSheet(
              e.name,
              'Bu hareket için not. Bir sonraki antrenmanda “Son sefer” kısmında görünür.',
              e.note,
              v => {
                if (v) e.note = v;
                else delete e.note;
                persistSession(ui.date);
              },
            );
          } else if (m === 'progress') {
            ui.progress = e.name;
            ui.tab = 'progress';
            closeSheet();
            window.scrollTo(0, 0);
          } else if (m === 'del') {
            // Seti olan hareket iki dokunuşla silinir.
            if (!e.sets.length || b.dataset.confirm) {
              s.exercises.splice(i, 1);
              persistSession(ui.date);
              closeSheet();
              toast(`${e.name} silindi`);
            } else {
              b.dataset.confirm = '1';
              b.textContent = `${e.sets.length} set silinecek, onaylamak için tekrar dokun`;
            }
          }
        }),
      );
    },
  );
}
