import { daysAgoText, daysBetween, todayStr } from '../lib/date.js';
import { esc } from '../lib/dom.js';
import {
  backupFilename,
  buildBackup,
  isEmpty,
  lastBackupDate,
  markBackupDone,
  parseBackup,
  restoreBackup,
  summarize,
} from '../services/backup.js';
import { isCloud } from '../services/db.js';
import { exportCsv } from '../services/export.js';
import { pickTextFile, saveFile } from '../services/files.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

const summaryText = s =>
  [
    `${s.workouts} antrenman`,
    `${s.foodDays} beslenme günü`,
    `${s.weighIns} tartı`,
    s.templates ? `${s.templates} şablon` : '',
  ]
    .filter(Boolean)
    .join(', ');

/** Yedek hatırlatması: hiç yedek yoksa ya da son yedek 14 günden eskiyse. */
export function backupStatus() {
  const last = lastBackupDate();
  if (!last) return { text: 'Henüz yedek almadın', stale: true };
  return { text: `Son yedek ${daysAgoText(last)}`, stale: daysBetween(last, todayStr()) > 14 };
}

/** Tarayıcıdan verileri kalıcı saklamasını ister (yer açmak için silmesin). */
async function requestPersistence() {
  if (!navigator.storage || !navigator.storage.persist) return null;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export function openDataSheet() {
  const s = summarize();
  const status = backupStatus();
  const where = isCloud()
    ? 'Verilerin hesabına kayıtlı.'
    : 'Verilerin yalnızca bu cihazda, bu tarayıcıda saklanıyor. Tarayıcı verilerini silersen ya da telefon değiştirirsen kaybolur. Düzenli yedek al.';

  openSheet(
    `<h2>Yedekleme ve veriler</h2>
    <div class="sub">${esc(summaryText(s))}</div>
    <p class="hint">${where}</p>
    <p class="hint" id="persistInfo"></p>
    <div class="menu">
      <button class="btn primary" id="dBackup" ${isEmpty(s) ? 'disabled' : ''}>Yedek indir (.json)</button>
      <p class="hint" style="margin:0 2px 6px">${esc(status.text)}. Yedek dosyasını Drive, iCloud ya da e-postana kaydet.</p>
      <button class="btn" id="dRestore">Yedekten geri yükle</button>
      <button class="btn" id="dCsv" ${isEmpty(s) ? 'disabled' : ''}>Excel için CSV indir</button>
    </div>
    <div id="restoreBox"></div>`,
    sh => {
      requestPersistence().then(ok => {
        const el = sh.querySelector('#persistInfo');
        if (el && ok)
          el.textContent = 'Tarayıcı bu verileri kalıcı olarak saklıyor, yer açmak için silmeyecek.';
      });

      sh.querySelector('#dBackup').addEventListener('click', async () => {
        try {
          if (await saveFile(backupFilename(), buildBackup(), 'application/json')) {
            markBackupDone();
            closeSheet();
            toast('Yedek indirildi');
          }
        } catch {
          toast('Yedek şu an indirilemiyor');
        }
      });
      sh.querySelector('#dCsv').addEventListener('click', () => exportCsv());
      sh.querySelector('#dRestore').addEventListener('click', async () => {
        const text = await pickTextFile('application/json,.json');
        if (text !== null) showRestorePreview(sh.querySelector('#restoreBox'), text);
      });
    },
  );
}

/** Seçilen yedeğin özetini gösterir; iki dokunuşla bu cihazdaki verilerin yerine yükler. */
function showRestorePreview(box, text) {
  const r = parseBackup(text);
  if (!r.ok) {
    box.innerHTML = `<p class="hint" role="alert" style="color:var(--red)">${esc(r.error)}</p>`;
    return;
  }
  if (isEmpty(r.summary)) {
    box.innerHTML = `<p class="hint" role="alert">Bu yedekte hiç kayıt yok.</p>`;
    return;
  }
  const when = r.exportedAt ? new Date(r.exportedAt).toLocaleDateString('tr-TR', { dateStyle: 'long' }) : '';
  box.innerHTML = `<div class="newex" style="margin-top:14px">
      <div style="font-weight:600">${when ? esc(when) + ' tarihli yedek' : 'Yedek'}: ${esc(summaryText(r.summary))}</div>
      <p class="hint">Bu cihazdaki mevcut verilerin silinir ve yerine yedektekiler yüklenir.</p>
      <button class="btn danger" id="dConfirm" style="width:100%">Yedeği yükle</button></div>`;
  const btn = box.querySelector('#dConfirm');
  btn.focus();
  btn.addEventListener('click', () => {
    if (!btn.dataset.confirm) {
      btn.dataset.confirm = '1';
      btn.textContent = 'Emin misin? Onaylamak için tekrar dokun';
      return;
    }
    restoreBackup(r.data);
    closeSheet();
    toast('Yedek yüklendi');
  });
}

export function openInstallHelp() {
  openSheet(
    `<h2>Uygulamayı yükle</h2>
    <div class="sub">Ana ekranından tek dokunuşla açılır, internet olmadan da çalışır.</div>
    <ol class="steps">
      <li>Safari'nin alt çubuğundaki <b>Paylaş</b> simgesine dokun (yukarı ok olan kare).</li>
      <li>Listeyi kaydırıp <b>Ana Ekrana Ekle</b>'yi seç.</li>
      <li>Sağ üstteki <b>Ekle</b>'ye dokun.</li>
    </ol>
    <div class="sheetactions"><button class="btn primary grow" id="iOk">Tamam</button></div>`,
    sh => sh.querySelector('#iOk').addEventListener('click', closeSheet),
  );
}
