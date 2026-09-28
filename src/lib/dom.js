export const $ = selector => document.querySelector(selector);

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** HTML şablonlarına giren her kullanıcı metni bundan geçmeli. */
export const esc = value => String(value).replace(/[&<>"']/g, c => ESC_MAP[c]);

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** "12,5" gibi virgüllü girdileri de okur; geçersizse NaN döner. */
export const parseDecimal = value => parseFloat(String(value).replace(',', '.'));
