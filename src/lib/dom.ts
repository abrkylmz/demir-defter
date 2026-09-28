/** Belgedeki öğeyi seçer; bulunamazsa hata fırlatır (uygulama kabuğundaki sabit öğeler için). */
export function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Öğe bulunamadı: ${selector}`);
  return el;
}

/** Kök içinde öğe seçer; bulunamazsa hata fırlatır. Panel şablonunda var olduğu bilinen öğeler için. */
export function q<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Öğe bulunamadı: ${selector}`);
  return el;
}

/** Kök içindeki eşleşen tüm öğeler. */
export const qa = <T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T[] =>
  Array.from(root.querySelectorAll<T>(selector));

/** data-* değeri; yoksa boş string. */
export const data = (el: HTMLElement, key: string): string => el.dataset[key] ?? '';

/** Tıklanan öğeden yukarı doğru seçiciye uyan ilk öğe. */
export const closest = <T extends HTMLElement = HTMLElement>(target: EventTarget | null, selector: string) =>
  target instanceof Element ? target.closest<T>(selector) : null;

const ESC_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
/** HTML şablonlarına giren her kullanıcı metni bundan geçmeli. */
export const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ESC_MAP[c]);

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** "12,5" gibi virgüllü girdileri de okur; geçersizse NaN döner. */
export const parseDecimal = (value: unknown): number => parseFloat(String(value).replace(',', '.'));
