/* Tarot Journal V8 enhancements. Keeps the existing IndexedDB schema unchanged. */
(() => {
  'use strict';

  const ENGLISH = {
    fool:'The Fool', magician:'The Magician', highPriestess:'The High Priestess',
    empress:'The Empress', emperor:'The Emperor', hierophant:'The Hierophant',
    lovers:'The Lovers', chariot:'The Chariot', strength:'Strength', hermit:'The Hermit',
    wheel:'Wheel of Fortune', justice:'Justice', hangedMan:'The Hanged Man',
    death:'Death', temperance:'Temperance', devil:'The Devil', tower:'The Tower',
    star:'The Star', moon:'The Moon', sun:'The Sun', judgement:'Judgement', world:'The World'
  };
  const FRENCH = {
    fool:'Le Mat', magician:'Le Bateleur', highPriestess:'La Papesse',
    empress:'L’Impératrice', emperor:'L’Empereur', hierophant:'Le Pape',
    lovers:'L’Amoureux', chariot:'Le Chariot', strength:'La Force', hermit:'L’Hermite',
    wheel:'La Roue de Fortune', justice:'La Justice', hangedMan:'Le Pendu',
    death:'L’Arcane sans nom', temperance:'Tempérance', devil:'Le Diable',
    tower:'La Maison Dieu', star:'L’Étoile', moon:'La Lune', sun:'Le Soleil',
    judgement:'Le Jugement', world:'Le Monde'
  };
  const ROMAN_RWS = ['0','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI'];
  const ROMAN_MARSEILLE = ['','I','II','III','IIII','V','VI','VII','XI','VIIII','X','VIII','XII','XIII','XIIII','XV','XVI','XVII','XVIII','XVIIII','XX','XXI'];
  const PAD = n => String(n).padStart(2,'0');
  const originalRenderList = window.renderList;
  const originalCardOptions = window.cardOptions;

  function cardIndex(card) {
    if (!card || !card.major) return -1;
    return MAJOR.findIndex(m => m[0] === card.id);
  }
  function mainNumber(card, deck, idx) {
    if (deck === 'marseille') {
      if (card.id === 'strength') return 11;
      if (card.id === 'justice') return 8;
    }
    return idx;
  }
  function displayCard(card, deck) {
    const idx = cardIndex(card);
    if (idx < 0) return deck === 'marseille' ? card.marseille : card.rws;
    const number = mainNumber(card, deck, idx);
    const roman = deck === 'marseille' ? ROMAN_MARSEILLE[idx] : ROMAN_RWS[idx];
    const nativeName = deck === 'marseille' ? (FRENCH[card.id] || card.marseille) : (ENGLISH[card.id] || card.rws);
    const japanese = deck === 'marseille' ? card.marseille : card.rws;
    const prefix = `${PAD(number)}：${japanese}`;
    return `${prefix} (${roman || '番号なし'} ${nativeName})`;
  }

  // Override display functions used by card selector and existing-record normalization.
  window.cardName = function(card, deck) {
    const data = getCardById(card.cardId);
    if (!data) return card.name || '';
    return displayCard(data, deck);
  };
  window.cardOptions = function(deck) {
    return [...tarotCards]
      .sort((a,b) => a.order[deck] - b.order[deck])
      .map(c => ({id:c.id, name:displayCard(c, deck)}));
  };
  window.identifyCardId = function(name) {
    const clean = String(name || '')
      .replace(/^\s*\d{1,2}\s*[:：]\s*/, '')
      .replace(/^\s*[0-9IVXLCDM]+\s+/i, '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim();
    const card = tarotCards.find(c =>
      c.rws === clean || c.marseille === clean ||
      c.rws === name || c.marseille === name
    );
    return card ? card.id : null;
  };

  function addDateControls() {
    const row = document.querySelector('.search-row');
    if (!row || document.getElementById('dateFromFilter')) return;
    const wrap = document.createElement('div');
    wrap.className = 'date-filter-row';
    wrap.innerHTML = `
      <label>開始日 <input id="dateFromFilter" type="date" aria-label="検索開始日"></label>
      <label>終了日 <input id="dateToFilter" type="date" aria-label="検索終了日"></label>
      <button type="button" id="clearDateFilter" class="date-clear-btn">日付解除</button>
      <p class="date-filter-hint">指定した期間内の記録を表示します。片方だけの指定もできます。</p>`;
    row.insertAdjacentElement('afterend', wrap);
    const from = document.getElementById('dateFromFilter');
    const to = document.getElementById('dateToFilter');
    const refresh = () => window.renderList();
    from.addEventListener('change', () => {
      if (from.value && to.value && from.value > to.value) to.value = from.value;
      refresh();
    });
    to.addEventListener('change', () => {
      if (from.value && to.value && to.value < from.value) from.value = to.value;
      refresh();
    });
    document.getElementById('clearDateFilter').addEventListener('click', () => {
      from.value = ''; to.value = ''; refresh();
    });
  }

  window.renderList = async function() {
    if (typeof originalRenderList === 'function') await originalRenderList();
    addDateControls();
    const from = document.getElementById('dateFromFilter')?.value || '';
    const to = document.getElementById('dateToFilter')?.value || '';
    if (!from && !to) return;

    // Base renderer sorts records newest-first and renders only text-matched/tag-matched rows.
    // Pair rendered cards with the same ordered records after applying the same text/tag filters.
    const records = (await window.dbGetAll()).sort((a,b) =>
      (b.date || '').localeCompare(a.date || '') ||
      (b.updatedAt || '').localeCompare(a.updatedAt || '')
    );
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    const selectedTag = document.getElementById('tagFilter').value;
    const candidates = records.filter(r => {
      const hay = [r.title,r.notes,r.spread,
        (r.cards||[]).map(c => c.name+' '+c.orientation+' '+(c.memo||'')).join(' '),
        (r.tags||[]).join(' ')].join(' ').toLowerCase();
      return (!query || hay.includes(query)) && (!selectedTag || (r.tags||[]).includes(selectedTag));
    });
    const visibleByBase = candidates.filter(r => (!from || (r.date||'') >= from) && (!to || (r.date||'') <= to));
    const list = document.getElementById('recordsList');
    const allowed = new Set(visibleByBase.map(r => r.id));
    // The original renderer does not expose IDs on cards; rebuild visibility by date/text order.
    const allRendered = Array.from(list.children);
    let candidateIndex = 0;
    allRendered.forEach(node => {
      const record = candidates[candidateIndex++];
      if (!record) { node.hidden = true; return; }
      node.hidden = !allowed.has(record.id);
    });
    const empty = document.getElementById('emptyState');
    const hasVisible = allRendered.some(node => !node.hidden);
    if (!hasVisible && candidates.length) {
      empty.hidden = false;
      empty.className = 'empty-state';
      empty.innerHTML = '<div class="empty-symbol">⌕</div><h3>該当する記録がありません</h3><p>日付の範囲を変更してください。</p>';
      empty.onclick = null;
    }
  };

  // Ensure the extra script has patched functions before the app's async DB init calls bind/render.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addDateControls, {once:true});
  } else {
    addDateControls();
  }
})();
