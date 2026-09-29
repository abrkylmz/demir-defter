// Tekrar kullanılan satır içi SVG ikonlar.

export const chevronLeft =
  '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12.5 4l-6 6 6 6"/></svg>';

export const chevronRight =
  '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7.5 4l6 6-6 6"/></svg>';

export const chevronDown =
  '<svg class="chev" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6l4.5 4.5L12.5 6"/></svg>';

/** Genişletilebilir kart oku (sağa bakar, açıkken CSS ile döner). */
export const chevronToggle =
  '<svg class="chev" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>';

export type TileIcon = 'log' | 'food' | 'history' | 'progress' | 'body';
export type UtilIcon = 'install' | 'backup';

export const plus = (size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 3v12M3 9h12"/></svg>`;

export const plusLarge =
  '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M11 4v14M4 11h14"/></svg>';

export const dots =
  '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><circle cx="4" cy="10" r="1.8"/><circle cx="10" cy="10" r="1.8"/><circle cx="16" cy="10" r="1.8"/></svg>';

export const trash =
  '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11"/></svg>';

const small = (body: string) =>
  `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const pencil = small('<path d="M13.5 3.5l3 3L7 16H4v-3z"/><path d="M11.5 5.5l3 3"/>');
export const arrowUp = small('<path d="M10 16V4M5 9l5-5 5 5"/>');
export const arrowDown = small('<path d="M10 4v12M5 11l5 5 5-5"/>');
export const camera =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>';
export const cross = small('<path d="M5 5l10 10M15 5L5 15"/>');

const tabIcon = (size: number, strokeWidth: number, body: string, join = true) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round"${join ? ' stroke-linejoin="round"' : ''} aria-hidden="true">${body}</svg>`;

const ICON_PATHS: Record<TileIcon, [string, boolean]> = {
  log: [
    '<path d="M2 12h20"/><rect x="4.5" y="6.5" width="3.2" height="11" rx="1"/><rect x="16.3" y="6.5" width="3.2" height="11" rx="1"/>',
    false,
  ],
  food: [
    '<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10"/><path d="M17 21V3c-2.2 1.2-3.5 3.8-3.5 7v3H17"/>',
    true,
  ],
  history: [
    '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    false,
  ],
  progress: ['<path d="M3 19l6-6 4 4 8-9"/><path d="M15 8h6v6"/>', true],
  body: [
    '<rect x="3.5" y="4" width="17" height="16" rx="4"/><path d="M8.5 9.5a5 5 0 0 1 7 0"/><path d="M12 11.5l1.5-2.5"/>',
    true,
  ],
};

const UTIL_PATHS: Record<UtilIcon, string> = {
  install: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7v7M9 11l3 3 3-3M10 18.5h4"/>',
  backup:
    '<path d="M12 3l7.5 3v5.5c0 4.4-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5.1-7.5-9.5V6z"/><path d="M12 8v6M9 11l3 3 3-3"/>',
};

/** Ana ekran alt satır ikonları. */
export const utilIcon = (name: UtilIcon) => tabIcon(24, 2, UTIL_PATHS[name]);

/** Ana ekran kutusu ikonları. */
export const tileIcon = (name: TileIcon, size = 30) =>
  tabIcon(size, 2.2, ICON_PATHS[name][0], ICON_PATHS[name][1]);
