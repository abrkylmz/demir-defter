import { bodyChart } from '../components/charts.ts';
import { bodyDates, nearestBefore } from '../domain/body.ts';
import { addDays, longDate, todayStr } from '../lib/date.ts';
import { esc } from '../lib/dom.ts';
import { fmt } from '../lib/format.ts';
import { store } from '../state/store.ts';
import { plus } from '../ui/icons.ts';

const trendClass = (d: number) => (d > 0.05 ? 'up' : d < -0.05 ? 'down' : '');
const signed = (d: number) => (d > 0 ? '+' : '') + fmt(d, 1);

export function renderBody(): string {
  const ds = bodyDates();
  const t = todayStr();
  const head = `<div class="dayline"><h1>Vücut ağırlığı</h1></div>`;
  const addBtn = `<button class="btn primary" style="width:100%;margin:6px 0 4px" data-act="bw" data-date="${t}">${plus()}${store.body[t] !== undefined ? 'Bugünkü tartıyı düzenle' : 'Bugünkü tartıyı gir'}</button>`;
  if (!ds.length)
    return (
      head +
      `<div class="empty"><p>Kilonu düzenli girdiğinde değişimini burada grafikte görürsün. En tutarlı sonuç için sabah, aç karnına tartılmanı öneririm.</p></div>` +
      addBtn
    );

  const last = ds[ds.length - 1];
  const cur = store.body[last];
  const diffBox = (days: number, label: string) => {
    const ref = nearestBefore(ds, addDays(last, -days));
    if (!ref || ref === last) return `<div><b class="num">—</b><span>${label}</span></div>`;
    const d = cur - store.body[ref];
    return `<div><b class="num ${trendClass(d)}">${signed(d)}</b><span>${label}</span></div>`;
  };
  const total = cur - store.body[ds[0]];
  const pts = ds.map(d => ({ date: d, v: store.body[d] }));

  const rows = ds
    .slice()
    .reverse()
    .map((d, i, arr) => {
      const prev = arr[i + 1];
      const df = prev !== undefined ? store.body[d] - store.body[prev] : null;
      return `<li style="padding:0;border-top:${i ? '1px solid var(--line)' : '0'}"><button data-act="bw" data-date="${d}" style="width:100%;display:flex;justify-content:space-between;align-items:center;border:0;background:transparent;padding:10px 2px;text-align:left">
        <span>${esc(longDate(d))}</span><span style="text-align:right"><span class="r">${fmt(store.body[d], 1)} kg</span>${df !== null ? `<br><span style="font-size:13px" class="${trendClass(df)}">${signed(df)}</span>` : ''}</span></button></li>`;
    })
    .join('');

  return (
    head +
    `
  <div class="bighero"><b class="num">${fmt(cur, 1)}</b><span>kg</span></div>
  <p style="margin:0 0 6px;color:var(--ink-2)">Son tartı: ${esc(longDate(last))}</p>
  <div class="summary">${diffBox(7, 'son 1 hafta')}${diffBox(30, 'son 1 ay')}<div><b class="num ${trendClass(total)}">${ds.length > 1 ? signed(total) : '—'}</b><span>ilk kayıttan beri</span></div></div>
  ${addBtn}
  <div class="chartcard">${pts.length > 1 ? bodyChart(pts) : `<p style="margin:10px 6px 14px;color:var(--ink-2)">Grafik için bir gün daha tartı gir.</p>`}</div>
  <div class="chartcard" style="padding:6px 14px"><ul class="plist">${rows}</ul></div>`
  );
}
