import { mondayOf, todayStr } from '../lib/date.js';

/** Kalıcı olmayan arayüz durumu. */
export const ui = {
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
