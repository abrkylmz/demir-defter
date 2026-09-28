// Tüm tıklamalar tek bir document dinleyicisinden yönlendirilir:
//   data-tab  → sekme değiştir
//   data-act  → eylem (aşağıdaki ACTIONS tablosu)
//   data-date → (data-act yoksa) gün seç
// Alt panel içindeki tıklamalar panelin kendi dinleyicilerine bırakılır.
import { foodDay } from './domain/nutrition.ts';
import { session } from './domain/workout.ts';
import { addDays, mondayOf, todayStr } from './lib/date.ts';
import { closest, data, prefersReducedMotion } from './lib/dom.ts';
import { fmt } from './lib/format.ts';
import { exportCsv } from './services/export.ts';
import { promptInstall } from './services/install.ts';
import { persistFood, persistSession } from './services/persist.ts';
import { openBodySheet } from './sheets/body-weight.ts';
import { openDataSheet, openInstallHelp } from './sheets/data.ts';
import { openExerciseMenu } from './sheets/exercise-menu.ts';
import { openPicker } from './sheets/exercise-picker.ts';
import { openProfile } from './sheets/profile.ts';
import { openAmountSheet } from './sheets/food-amount.ts';
import { openFoodPicker } from './sheets/food-picker.ts';
import { openGoals } from './sheets/goals.ts';
import { openDayNote } from './sheets/note.ts';
import { openSetSheet } from './sheets/set-entry.ts';
import { openSaveTemplate, openTemplates } from './sheets/templates.ts';
import { isTab, ui } from './state/ui.ts';
import type { DateStr, MealKey } from './types.ts';
import { toast } from './ui/toast.ts';
import { render } from './views/render.ts';

/** data-* değerini sayı olarak okur. */
const num = (el: HTMLElement, key: string): number => Number(data(el, key));

function goToDate(d: DateStr): void {
  ui.date = d;
  ui.weekStart = mondayOf(d);
}

const ACTIONS: Record<string, (el: HTMLElement) => void> = {
  // antrenman
  pick: () => openPicker(),
  addset: b => openSetSheet(num(b, 'ex')),
  editset: b => openSetSheet(num(b, 'ex'), num(b, 'set')),
  exmenu: b => openExerciseMenu(num(b, 'ex')),
  templates: () => openTemplates(),
  savetpl: () => openSaveTemplate(),
  daynote: () => openDayNote(),
  toggle: b => {
    const id = data(b, 'id');
    if (ui.open.has(id)) ui.open.delete(id);
    else ui.open.add(id);
    render();
    document
      .querySelector<HTMLElement>(`[data-act="toggle"][data-id="${id}"]`)
      ?.focus({ preventScroll: true });
  },
  repeat: b => {
    const ex = session(ui.date, true).exercises[num(b, 'ex')];
    const last = ex.sets[ex.sets.length - 1];
    ex.sets.push({ kg: last.kg, reps: last.reps });
    persistSession(ui.date);
    render();
    toast(`Set ${ex.sets.length} kaydedildi: ${fmt(last.kg)} kg × ${last.reps}`);
  },

  pview: b => {
    ui.progressView = data(b, 'v') === 'records' ? 'records' : 'chart';
    render();
  },
  prchart: b => {
    ui.progress = data(b, 'name');
    ui.progressView = 'chart';
    render();
    window.scrollTo(0, 0);
  },

  // gezinme
  week: b => {
    ui.weekStart = addDays(ui.weekStart, 7 * num(b, 'dir'));
    render();
  },
  today: () => {
    goToDate(todayStr());
    render();
  },
  open: b => {
    goToDate(data(b, 'date'));
    ui.tab = 'log';
    render();
    window.scrollTo(0, 0);
  },

  // beslenme
  addfood: b => openFoodPicker(data(b, 'meal') as MealKey),
  editfood: b => {
    const i = num(b, 'i');
    openAmountSheet(null, foodDay(ui.date, true).items[i].meal, i);
  },
  goals: () => openGoals(),
  water: b => {
    const d = foodDay(ui.date, true);
    const n = num(b, 'n');
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
    const d = data(b, 'd');
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

  // kilo, veriler ve kurulum
  bw: b => openBodySheet(data(b, 'date')),
  export: () => void exportCsv(),
  data: () => openDataSheet(),
  profile: () => openProfile(),
  install: async () => {
    if (!(await promptInstall())) openInstallHelp();
    render();
  },
};

function selectDay(d: DateStr): void {
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

function onClick(e: MouseEvent): void {
  if (ui.sheetOpen && closest(e.target, '#sheet')) return;

  const tab = closest(e.target, '[data-tab]');
  if (tab) {
    const name = data(tab, 'tab');
    if (!isTab(name)) return;
    ui.tab = name;
    if (ui.tab === 'food') ui.foodOpen = null;
    if (tab.dataset.home === 'today') goToDate(todayStr());
    render();
    window.scrollTo(0, 0);
    return;
  }

  const el = closest(e.target, '[data-act],[data-date]');
  if (!el) return;
  const act = el.dataset.act;
  if (act) ACTIONS[act]?.(el);
  else selectDay(data(el, 'date'));
}

function onChange(e: Event): void {
  const t = e.target;
  if (t instanceof HTMLSelectElement && t.id === 'exsel') {
    ui.progress = t.value;
    render();
  }
}

export function bindEvents(): void {
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
}
