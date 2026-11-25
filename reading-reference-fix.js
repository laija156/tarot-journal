/* Tarot Journal - reliable reading card notebook reference buttons */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const DB = 'TarotJournalNotebookDB';
  let dialog;

  const css = document.createElement('style');
  css.textContent = `
    #cardsContainer .nb-reference-btn{width:100%;margin-top:9px}
    #notebookReferenceDialog{width:min(560px,calc(100% - 24px));max-height:min(82dvh,760px);overflow:hidden;padding:0;border:1px solid var(--line);border-radius:18px;background:var(--paper);color:var(--ink)}
    #notebookReferenceDialog::backdrop{background:#20192c99}
    #notebookReferenceDialog .npr-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 17px;background:#fff;border-bottom:1px solid var(--line)}
    #notebookReferenceDialog .npr-body{padding:15px 17px 22px;overflow-y:auto;max-height:calc(min(82dvh,760px) - 62px)}
    #notebookReferenceDialog .npr-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:13px;margin-bottom:11px}
    #notebookReferenceDialog .npr-label{font-size:11px;color:var(--muted);margin-bottom:5px}
    #notebookReferenceDialog .npr-value{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8;font-size:14px;user-select:text;-webkit-user-select:text;-webkit-touch-callout:default}
    #notebookReferenceDialog .npr-empty{color:var(--muted);font-size:13px;line-height:1.8;padding:12px 2px}
    #notebookReferenceDialog .npr-actions{display:flex;gap:8px;align-items:center}
    #notebookReferenceDialog .npr-actions button{width:auto;padding:8px 12px}
    #notebookReferenceDialog .npr-close{border:0;background:transparent;color:var(--muted);font-size:23px;padding:2px 7px}
  `;
  document.head.appendChild(css);

  function openNotebookDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function getNotebook(db, id) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notebook', 'readonly');
      const req = tx.objectStore('notebook').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.id = 'notebookReferenceDialog';
    dialog.innerHTML = `<div class="npr-head"><strong id="nprTitle">タロット手帳</strong><div class="npr-actions"><button type="button" class="secondary-btn" id="nprCopy">全文をコピー</button><button type="button" class="npr-close" id="nprClose" aria-label="閉じる">×</button></div></div><div class="npr-body" id="nprBody"></div>`;
    document.body.appendChild(dialog);
    $('nprClose').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    $('nprCopy').addEventListener('click', async () => {
      const value = $('nprBody').dataset.copyText || '';
      if (!value) return;
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
        else throw new Error('clipboard unavailable');
        window.showToast?.('手帳の内容をコピーしました');
      } catch (_) {
        const ta = document.createElement('textarea');
        ta.value = value; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
        ta.remove();
        window.showToast?.(ok ? '手帳の内容をコピーしました' : '文章を長押ししてコピーしてください');
      }
    });
  }
  async function showReference(select) {
    ensureDialog();
    const body = $('nprBody');
    const id = select.value;
    const deck = $('deckInput')?.value || 'rws';
    const name = select.selectedOptions?.[0]?.textContent || '';
    $('nprTitle').textContent = name ? `${name}の手帳` : 'タロット手帳';
    body.textContent = '手帳を読み込んでいます…';
    body.dataset.copyText = '';
    if (!dialog.open) dialog.showModal();
    try {
      let entry = null;
      if (id && id !== 'custom') {
        const db = await openNotebookDB();
        try { entry = await getNotebook(db, `${deck}:${id}`); } finally { db.close(); }
      }
      const deckName = deck === 'marseille' ? 'マルセイユ版' : 'ウェイト（ライダー）版';
      const fields = [
        ['属性', [entry?.attributeType, entry?.attributeValue].filter(Boolean).join('：')],
        ['キーワード', entry?.keywords], ['リーディング', entry?.reading],
        ['象徴', entry?.symbol], ['その他', entry?.other]
      ].filter(([, value]) => String(value || '').trim());
      const allText = [name, deckName, ...fields.map(([label, value]) => `${label}\n${value}`)].join('\n\n');
      body.dataset.copyText = allText;
      body.replaceChildren();
      if (!id || id === 'custom' || !entry) {
        const p = document.createElement('p'); p.className = 'npr-empty';
        p.textContent = !id || id === 'custom'
          ? 'カードを選択すると、そのカードの手帳を参照できます。'
          : 'このカードの手帳はまだ登録されていません。タロット手帳で記録できます。';
        body.appendChild(p);
        return;
      }
      const meta = document.createElement('p'); meta.className = 'npr-label'; meta.textContent = deckName; body.appendChild(meta);
      if (!fields.length) {
        const p = document.createElement('p'); p.className = 'npr-empty'; p.textContent = 'このカードの手帳はまだ空欄です。'; body.appendChild(p);
      } else {
        for (const [label, value] of fields) {
          const section = document.createElement('section'); section.className = 'npr-card';
          const heading = document.createElement('div'); heading.className = 'npr-label'; heading.textContent = label;
          const content = document.createElement('div'); content.className = 'npr-value'; content.textContent = value;
          section.append(heading, content); body.appendChild(section);
        }
      }
    } catch (_) {
      body.textContent = '手帳を読み込めませんでした。画面を閉じて、もう一度お試しください。';
    }
  }
  function addButtons() {
    const container = $('cardsContainer');
    if (!container) return;
    container.querySelectorAll('.card-entry').forEach(entry => {
      const select = entry.querySelector('select.card-name');
      if (!select || entry.querySelector('.nb-reference-btn')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary-btn nb-reference-btn';
      button.textContent = '▤ タロット手帳を参照';
      button.addEventListener('click', () => showReference(select));
      const controls = entry.querySelector('.card-memo-controls');
      (controls || entry).insertAdjacentElement('afterend', button);
    });
  }
  function start() {
    const container = $('cardsContainer');
    if (!container) return;
    addButtons();
    const observer = new MutationObserver(() => addButtons());
    observer.observe(container, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
