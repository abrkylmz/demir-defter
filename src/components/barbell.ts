// Set girişindeki bar görseli. Plaka renkleri anlam taşır: kırmızı 25, mavi 20, sarı 15, yeşil 10 kg.
import { BAR_KG, platesFor } from '../lib/fitness.ts';
import { fmt } from '../lib/format.ts';

const PLATE_STYLE: Record<number, { h: number; w: number; c: string }> = {
  25: { h: 84, w: 13, c: 'var(--red)' },
  20: { h: 84, w: 12, c: 'var(--blue)' },
  15: { h: 74, w: 11, c: 'var(--yellow)' },
  10: { h: 62, w: 10, c: 'var(--green)' },
  5: { h: 46, w: 8, c: 'var(--wplate)' },
  2.5: { h: 36, w: 7, c: 'var(--red)' },
  1.25: { h: 30, w: 6, c: 'var(--chrome)' },
};

export function barbellSVG(kg: number): string {
  const W = 320;
  const H = 100;
  const cy = 50;
  const r = platesFor(kg);
  let s = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
  s += `<rect x="6" y="${cy - 3}" width="${W - 12}" height="6" rx="3" fill="var(--bar)"/>`;
  s += `<rect x="${W / 2 - 66}" y="${cy - 4}" width="132" height="8" rx="2" fill="var(--bar)" opacity=".75"/>`;
  const sleeveL = W / 2 - 72;
  const sleeveR = W / 2 + 72;
  s += `<rect x="${sleeveL - 6}" y="${cy - 10}" width="6" height="20" rx="2" fill="var(--bar)"/><rect x="${sleeveR}" y="${cy - 10}" width="6" height="20" rx="2" fill="var(--bar)"/>`;
  if (r) {
    let xr = sleeveR + 8;
    let xl = sleeveL - 8;
    r.plates.forEach(p => {
      const { h, w, c } = PLATE_STYLE[p];
      if (xr + w > W - 8) return;
      const stroke = p === 5 ? 'stroke="var(--ink-3)" stroke-width="1"' : '';
      s += `<rect x="${xr}" y="${cy - h / 2}" width="${w}" height="${h}" rx="2.5" fill="${c}" ${stroke}/>`;
      s += `<rect x="${xl - w}" y="${cy - h / 2}" width="${w}" height="${h}" rx="2.5" fill="${c}" ${stroke}/>`;
      xr += w + 1.5;
      xl -= w + 1.5;
    });
  }
  return s + '</svg>';
}

/** "Bar 20 kg, her tarafa 2×20 + 5 kg" gibi açıklama. */
export function barbellCaption(kg: number): string {
  if (!(kg > 0)) return '';
  const r = platesFor(kg);
  if (!r) return `${BAR_KG} kg bardan hafif, dambıl ya da EZ bar olabilir`;
  if (!r.plates.length) return `Sadece bar (${BAR_KG} kg)`;
  const counts = [];
  let prev: number | null = null;
  let c = 0;
  r.plates.forEach(p => {
    if (prev === p) c++;
    else {
      if (prev !== null) counts.push(c > 1 ? `${c}×${fmt(prev)}` : fmt(prev));
      prev = p;
      c = 1;
    }
  });
  if (prev !== null) counts.push(c > 1 ? `${c}×${fmt(prev)}` : fmt(prev));
  return `Bar ${BAR_KG} kg, her tarafa ${counts.join(' + ')} kg${r.rest ? ` (${fmt(r.rest)} kg plakayla karşılanamıyor)` : ''}`;
}
