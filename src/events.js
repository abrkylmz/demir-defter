// Tüm tıklamalar tek bir document dinleyicisinden yönlendirilir:
//   data-tab  → sekme değiştir
//   data-act  → eylem (aşağıdaki ACTIONS tablosu)
//   data-date → (data-act yoksa) gün seç
// Alt panel içindeki tıklamalar panelin kendi dinleyicilerine bırakılır.
import { foodDay } from './domain/nutrition.js';
import { session } from './domain/workout.js';
import { addDays, mondayOf, todayStr } from './lib/date.js';
import { prefersReducedMotion } from './lib/dom.js';
import { fmt } from './lib/format.js';
import { exportCsv } from './services/export.js';
import { persistFood, persistSession } from './services/persist.js';
import { openBodySheet } from './sheets/body-weight.js';
import { openExerciseMenu } from './sheets/exercise-menu.js';
import { openPicker } from './sheets/exercise-picker.js';
import { openAmountSheet } from './sheets/food-amount.js';
import { openFoodPicker } from './sheets/food-picker.js';
import { openGoals } from './sheets/goals.js';
import { openDayNote } from './sheets/note.js';
import { openSetSheet } from './sheets/set-entry.js';
import { openSaveTemplate, openTemplates } from './sheets/templates.js';
import { ui } from './state/ui.js';
import { toast } from './ui/toast.js';
import { render } from './views/render.js';

function goToDate(d) {
  ui.date = d;
  ui.weekStart = mondayOf(d);
}

/** @type {Record<string, (el: HTMLElement) => void>} */
const ACTIONS = {
  // antrenman
  pick: () => openPicker(),
  addset: b => openSetSheet(+b.dataset.ex),
  editset: b => openSetSheet(+b.dataset.ex, +b.dataset.set),
  exmenu: b => openExerciseMenu(+b.dataset.ex),
  templates: () => openTemplates(),
  savetpl: () => openSaveTemplate(),
  daynote: () => openDayNote(),
  toggle: b => {
    const id = b.dataset.id;
    if (ui.open.has(id)) ui.open.delete(id);
    else ui.open.add(id);
    render();
    const again = document.querySelector(`[data-act="toggle"][data-id="${id}"]`);
    if (again) again.focus({ preventScroll: true });
  },
  repeat: b => {
    const ex = session(ui.date).exercises[+b.dataset.ex];
    const last = ex.sets[ex.sets.length - 1];
    ex.sets.push({ kg: last.kg, reps: last.reps });
    persistSession(ui.date);
    render();
    toast(`Set ${ex.sets.length} kaydedildi: ${fmt(last.kg)} kg × ${last.reps}`);
  },

  // gezinme
  week: b => {
    ui.weekStart = addDays(ui.weekStart, 7 * +b.dataset.dir);
    render();
  },
  today: () => {
    goToDate(todayStr());
    render();
  },
  open: b => {
    goToDate(b.dataset.date);
    ui.tab = 'log';
    render();
    window.scrollTo(0, 0);
  },

  // beslenme
  addfood: b => openFoodPicker(b.dataset.meal),
  editfood: b => {
    const i = +b.dataset.i;
    openAmountSheet(null, foodDay(ui.date).items[i].meal, i);
  },
  goals: () => openGoals(),
  water: b => {
    const d = foodDay(ui.date, true);
    const n = +b.dataset.n;
    // dolu son bardağa tekrar dokunmak onu boşaltır
    d.water = d.water === n ? n - 1 : n;
    persistFood(ui.date);
    render();
  },
  foodclose: () => {
    ui.foodOpen = null;
    render();
  },
  openday: b => {
    const d = b.dataset.d;
    b.classList.add('turn');
    b.setAttribute('aria-expanded', 'true');
    setTimeout(
      () => {
        ui.foodOpen = d;
        goToDate(d);
        ui.justOpened = true;
        render();
      },
      prefersReducedMotion() ? 0 : 180,
    );
  },

  // kilo ve dışa aktarma
  bw: b => openBodySheet(b.dataset.date),
  export: () => exportCsv(),
};

function selectDay(d) {
  if (ui.tab === 'food') {
    ui.foodOpen = ui.foodOpen === d ? null : d;
    if (ui.foodOpen) {
      ui.weekStart = mondayOf(d);
      ui.justOpened = true;
    }
  }
  ui.date = d;
  render();
}

function onClick(e) {
  if (ui.sheetOpen && e.target.closest('#sheet')) return;

  const tab = e.target.closest('[data-tab]');
  if (tab) {
    ui.tab = tab.dataset.tab;
    if (ui.tab === 'food') ui.foodOpen = null;
    if (tab.dataset.home === 'today') goToDate(todayStr());
    render();
    window.scrollTo(0, 0);
    return;
  }

  const el = e.target.closest('[data-act],[data-date]');
  if (!el) return;
  const act = el.dataset.act;
  if (act) ACTIONS[act]?.(el);
  else selectDay(el.dataset.date);
}

function onChange(e) {
  if (e.target.id === 'exsel') {
    ui.progress = e.target.value;
    render();
  }
}

export function bindEvents() {
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
}
