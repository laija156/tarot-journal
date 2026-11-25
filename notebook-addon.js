/* Tarot Journal - Tarot Notebook add-on
   Separate IndexedDB database: does not alter existing reading records. */
(() => {
  'use strict';

  const DB_NAME = 'TarotJournalNotebookDB';
  const STORE = 'notebook';
  const $ = id => document.getElementById(id);
  let notebookDB = null;
  let activeDeck = 'rws';
  let activeCardId = '';

  const ATTRIBUTE_OPTIONS = {
    '四大元素': ['火', '水', '風', '地'],
    '惑星': ['太陽', '月', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星'],
    '星座': ['牡羊座', '牡牛座', '双子座', '蟹座', '獅子座', '乙女座', '天秤座', '蠍座', '射手座', '山羊座', '水瓶座', '魚座']
  };

  const style = document.createElement('style');
  style.textContent = `
    #notebookView .notebook-panel{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;margin:12px 0}
    #notebookView .notebook-field{display:block;width:100%;background:#fff;border:1px solid var(--line);border-radius:10px;padding:11px 12px;color:var(--ink);font:inherit}
    #notebookView textarea.notebook-field{min-height:105px;resize:vertical;line-height:1.7}
    #notebookView .notebook-actions{display:grid;gap:9px;margin:18px 0 28px}
    #notebookView .notebook-status{font-size:11px;color:var(--muted);min-height:1.5em}
    #notebookView .notebook-title{font-family:'Noto Serif JP',serif;font-size:19px;font-weight:500;margin:4px 0}
    #notebookView .notebook-attribute-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    #notebookView .notebook-empty{font-size:12px;color:var(--muted);margin:8px 0}
    @media(max-width:420px){#notebookView .notebook-attribute-row{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function getEntry(id) {
    return new Promise((resolve, reject) => {
      const req = notebookDB.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
  function putEntry(entry) {
    return new Promise((resolve, reject) => {
      const req = notebookDB.transaction(STORE, 'readwrite').objectStore(STORE).put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
  function deleteEntry(id) {
    return new Promise((resolve, reject) => {
      const req = notebookDB.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
  function getAllEntries() {
    return new Promise((resolve, reject) => {
      const req = notebookDB.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
  function deckLabel(deck) {
    return deck === 'marseille' ? 'マルセイユ版' : 'ウェイト（ライダー）版';
  }
  function cardLabel(cardId, deck) {
    const card = window.tarotCards?.find(c => c.id === cardId);
    if (!card) return cardId;
    return window.cardName ? window.cardName({cardId}, deck) : (deck === 'marseille' ? card.marseille : card.rws);
  }
  function cardList(deck) {
    return [...(window.tarotCards || [])]
      .sort((a, b) => (a.order?.[deck] ?? 999) - (b.order?.[deck] ?? 999))
      .map(c => ({id:c.id, label:cardLabel(c.id, deck)}));
  }
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));
  }
  function entryId(deck, cardId) {
    return `${deck}:${cardId}`;
  }

  function installUI() {
    const main = document.querySelector('main');
    const menu = $('menuDialog');
    if (!main || !menu || $('notebookView')) return;

    const section = document.createElement('section');
    section.id = 'notebookView';
    section.className = 'view';
    section.innerHTML = `
      <div class="view-heading">
        <button class="back-btn" id="notebookBack">← 一覧</button>
        <span>タロット手帳</span>
      </div>
      <div class="notebook-panel">
        <label class="field-label" for="notebookDeck">デッキ</label>
        <select class="notebook-field" id="notebookDeck">
          <option value="rws">ウェイト（ライダー）版</option>
          <option value="marseille">マルセイユ版</option>
        </select>
        <label class="field-label" for="notebookCard">カード</label>
        <select class="notebook-field" id="notebookCard"></select>
        <p class="notebook-status" id="notebookStatus" aria-live="polite"></p>
      </div>
      <div class="notebook-panel">
        <h2 class="notebook-title" id="notebookCardTitle">カードを選択してください</h2>
        <label class="field-label" for="notebookAttributeType">属性</label>
        <div class="notebook-attribute-row">
          <select class="notebook-field" id="notebookAttributeType">
            <option value="">分類を選択</option>
            <option value="四大元素">四大元素</option>
            <option value="惑星">惑星</option>
            <option value="星座">星座</option>
            <option value="その他">その他</option>
          </select>
          <select class="notebook-field" id="notebookAttributeValue">
            <option value="">項目を選択</option>
          </select>
        </div>
        <input class="notebook-field" id="notebookAttributeCustom" type="text" placeholder="属性を自由入力" style="display:none;margin-top:8px">
        <label class="field-label" for="notebookKeywords">キーワード</label>
        <textarea class="notebook-field" id="notebookKeywords" placeholder="カードから連想する言葉"></textarea>
        <label class="field-label" for="notebookReading">リーディング</label>
        <textarea class="notebook-field" id="notebookReading" placeholder="カードの意味や、自分なりの読み解き"></textarea>
        <label class="field-label" for="notebookSymbol">象徴</label>
        <textarea class="notebook-field" id="notebookSymbol" placeholder="絵柄・色・数字・モチーフなど"></textarea>
        <label class="field-label" for="notebookOther">その他</label>
        <textarea class="notebook-field" id="notebookOther" placeholder="自由メモ"></textarea>
      </div>
      <div class="notebook-actions">
        <button class="primary-btn" id="notebookSave">手帳を保存</button>
        <button class="danger-text" id="notebookDelete" type="button">このカードの手帳を削除</button>
      </div>`;
    main.appendChild(section);

    const menuButton = document.createElement('button');
    menuButton.className = 'secondary-btn full';
    menuButton.id = 'menuNotebookBtn';
    menuButton.textContent = 'タロット手帳';
    $('menuNewBtn').insertAdjacentElement('afterend', menuButton);
    menuButton.addEventListener('click', () => {
      menu.close();
      openNotebook();
    });

    $('notebookBack').addEventListener('click', () => {
      if (window.goHome) window.goHome();
      else window.showView('homeView');
    });
    $('notebookDeck').addEventListener('change', async e => {
      activeDeck = e.target.value;
      fillCardOptions();
      await loadCardEntry();
    });
    $('notebookCard').addEventListener('change', async e => {
      activeCardId = e.target.value;
      await loadCardEntry();
    });
    $('notebookAttributeType').addEventListener('change', updateAttributeChoices);
    $('notebookSave').addEventListener('click', saveCardEntry);
    $('notebookDelete').addEventListener('click', removeCardEntry);
    fillCardOptions();
  }

  function fillCardOptions() {
    const select = $('notebookCard');
    if (!select) return;
    const cards = cardList(activeDeck);
    select.innerHTML = cards.map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('');
    if (!cards.some(c => c.id === activeCardId)) activeCardId = cards[0]?.id || '';
    select.value = activeCardId;
  }

  function updateAttributeChoices(value = '') {
    const type = $('notebookAttributeType').value;
    const select = $('notebookAttributeValue');
    const custom = $('notebookAttributeCustom');
    select.innerHTML = '<option value="">項目を選択</option>';
    custom.style.display = type === 'その他' ? 'block' : 'none';
    select.style.display = type === 'その他' ? 'none' : 'block';
    if (ATTRIBUTE_OPTIONS[type]) {
      select.innerHTML += ATTRIBUTE_OPTIONS[type].map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
      select.value = value;
    } else if (type === 'その他') {
      custom.value = value;
    } else {
      custom.value = '';
    }
  }

  async function loadCardEntry() {
    if (!activeCardId) return;
    const title = cardLabel(activeCardId, activeDeck);
    $('notebookCardTitle').textContent = title;
    const entry = await getEntry(entryId(activeDeck, activeCardId));
    $('notebookAttributeType').value = entry?.attributeType || '';
    updateAttributeChoices(entry?.attributeValue || '');
    if (entry?.attributeType === 'その他') $('notebookAttributeCustom').value = entry.attributeValue || '';
    $('notebookKeywords').value = entry?.keywords || '';
    $('notebookReading').value = entry?.reading || '';
    $('notebookSymbol').value = entry?.symbol || '';
    $('notebookOther').value = entry?.other || '';
    $('notebookStatus').textContent = entry ? `保存済み · ${deckLabel(activeDeck)}` : '未登録';
  }

  async function saveCardEntry() {
    const type = $('notebookAttributeType').value;
    const value = type === 'その他' ? $('notebookAttributeCustom').value.trim() : $('notebookAttributeValue').value;
    const entry = {
      id: entryId(activeDeck, activeCardId),
      deck: activeDeck,
      cardId: activeCardId,
      attributeType: type,
      attributeValue: value,
      keywords: $('notebookKeywords').value,
      reading: $('notebookReading').value,
      symbol: $('notebookSymbol').value,
      other: $('notebookOther').value,
      updatedAt: new Date().toISOString()
    };
    await putEntry(entry);
    $('notebookStatus').textContent = `保存済み · ${deckLabel(activeDeck)}`;
    window.showToast?.('タロット手帳を保存しました');
  }

  async function removeCardEntry() {
    if (!activeCardId) return;
    if (!confirm(`${cardLabel(activeCardId, activeDeck)}の手帳内容を削除しますか？`)) return;
    await deleteEntry(entryId(activeDeck, activeCardId));
    await loadCardEntry();
    window.showToast?.('手帳内容を削除しました');
  }

  async function openNotebook() {
    if (!notebookDB) notebookDB = await openDB();
    activeDeck = $('notebookDeck').value || 'rws';
    fillCardOptions();
    await loadCardEntry();
    window.showView('notebookView');
  }

  // Extend the existing JSON backup without changing its format for old backups.
  const originalExport = window.exportBackup;
  if (typeof originalExport === 'function') {
    window.exportBackup = async function() {
      const records = await window.dbGetAll();
      const notebook = await getAllEntries();
      const backup = {
        app: 'Tarot Journal',
        version: 3,
        exportedAt: new Date().toISOString(),
        records,
        notebook
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tarot-journal-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      window.showToast?.(`${records.length}件の記録と手帳データ${notebook.length}件をバックアップしました`);
    };
  }

  const originalImport = window.importBackup;
  if (typeof originalImport === 'function') {
    window.importBackup = async function(file) {
      try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data.records)) throw new Error('形式が違います');
        if (!confirm(`${data.records.length}件の記録と手帳データ${Array.isArray(data.notebook) ? data.notebook.length : 0}件を取り込みます。同じIDのデータは上書きされます。続行しますか？`)) return;
        for (const record of data.records) {
          if (!record.id || !record.date) continue;
          await window.dbPut(record);
        }
        if (Array.isArray(data.notebook)) {
          for (const entry of data.notebook) {
            if (entry?.id && entry?.deck && entry?.cardId) await putEntry(entry);
          }
        }
        await window.renderList();
        window.showView('homeView');
        window.showToast?.('バックアップを復元しました');
      } catch (error) {
        window.showToast?.('復元できませんでした：バックアップ形式を確認してください');
      }
    };
  }

  function boot() {
    installUI();
    // The app initializes IndexedDB asynchronously; this add-on uses its own DB.
    openDB().then(db => { notebookDB = db; }).catch(() => {
      window.showToast?.('タロット手帳の保存領域を初期化できませんでした');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }
})();
