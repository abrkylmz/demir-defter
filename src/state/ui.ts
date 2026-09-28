import { mondayOf, todayStr } from '../lib/date.ts';
import type { DateStr, Tab } from '../types.ts';

export const TABS: readonly Tab[] = ['home', 'log', 'food', 'history', 'progress', 'body'];
export const isTab = (v: unknown): v is Tab => TABS.includes(v as Tab);

interface UiState {
  tab: Tab;
  date: DateStr;
  weekStart: DateStr;
  open: Set<string>;
  foodOpen: DateStr | null;
  justOpened: boolean;
  progress: string | null;
  sheetOpen: boolean;
}

/** Kalıcı olmayan arayüz durumu. */
export const ui: UiState = {
  tab: 'home',
  /** Seçili gün (antrenman ve beslenme ekranları). */
  date: todayStr(),
  weekStart: mondayOf(todayStr()),
  /** Açık (genişletilmiş) hareket kartlarının id'leri. */
  open: new Set(),
  /** Beslenmede detayı açık gün; null ise hafta görünümü. */
  foodOpen: null,
  /** Gün yeni açıldıysa bir kez açılma animasyonu oynatılır. */
  justOpened: false,
  /** İlerleme ekranında seçili hareket. */
  progress: null,
  /** Alt panel açıkken o günün bulut güncellemeleri bekletilir. */
  sheetOpen: false,
};
