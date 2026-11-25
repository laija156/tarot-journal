/* Tarot Journal - Tarot Notebook add-on */
(() => {
'use strict';
const DB='TarotJournalNotebookDB',STORE='notebook',$=id=>document.getElementById(id);
let db=null,deck='rws',cardId='';
const ATTR={'四大元素':['火','水','風','地'],'惑星':['太陽','月','水星','金星','火星','木星','土星','天王星','海王星','冥王星'],'星座':['牡羊座','牡牛座','双子座','蟹座','獅子座','乙女座','天秤座','蠍座','射手座','山羊座','水瓶座','魚座']};
const css=document.createElement('style');
css.textContent=`#notebookView .nb-panel{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;margin:12px 0}#notebookView .nb-field{display:block;width:100%;background:#fff;border:1px solid var(--line);border-radius:10px;padding:11px 12px;color:var(--ink);font:inherit}#notebookView textarea.nb-field{min-height:105px;resize:vertical;line-height:1.7}#notebookView .nb-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}#notebookView .nb-actions{display:grid;gap:9px;margin:18px 0 28px}#notebookView .nb-status{font-size:11px;color:var(--muted);min-height:1.5em}#notebookView .nb-title{font-family:'Noto Serif JP',serif;font-size:19px;font-weight:500;margin:4px 0}@media(max-width:420px){#notebookView .nb-row{grid-template-columns:1fr}}`;
document.head.appendChild(css);
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function request(mode,fn){return new Promise((resolve,reject)=>{const t=db.transaction(STORE,mode),r=fn(t.objectStore(STORE));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
const get=id=>request('readonly',s=>s.get(id)),put=v=>request('readwrite',s=>s.put(v)),del=id=>request('readwrite',s=>s.delete(id));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const deckLabel=d=>d==='marseille'?'マルセイユ版':'ウェイト（ライダー）版';
function cards(d){return typeof window.cardOptions==='function'?window.cardOptions(d).map(c=>({id:c.id,name:c.name})):[];}
function cardName(id,d){return cards(d).find(c=>c.id===id)?.name||id;}
const key=(d,id)=>`${d}:${id}`;
function install(){
 if($('notebookView'))return;
 const main=document.querySelector('main');if(!main)return;
 const view=document.createElement('section');view.id='notebookView';view.className='view';
 view.innerHTML=`<div class="view-heading"><button class="back-btn" id="nbBack">← 一覧</button><span>タロット手帳</span></div>
 <div class="nb-panel"><label class="field-label" for="nbDeck">デッキ</label><select class="nb-field" id="nbDeck"><option value="rws">ウェイト（ライダー）版</option><option value="marseille">マルセイユ版</option></select>
 <label class="field-label" for="nbCard">カード</label><select class="nb-field" id="nbCard"></select><p class="nb-status" id="nbStatus" aria-live="polite"></p></div>
 <div class="nb-panel"><h2 class="nb-title" id="nbTitle">カード</h2><label class="field-label" for="nbType">属性</label>
 <div class="nb-row"><select class="nb-field" id="nbType"><option value="">分類を選択</option><option>四大元素</option><option>惑星</option><option>星座</option><option>その他</option></select><select class="nb-field" id="nbValue"><option value="">項目を選択</option></select></div>
 <input class="nb-field" id="nbCustom" placeholder="属性を自由入力" style="display:none;margin-top:8px">
 <label class="field-label" for="nbKeywords">キーワード</label><textarea class="nb-field" id="nbKeywords" placeholder="カードから連想する言葉"></textarea>
 <label class="field-label" for="nbReading">リーディング</label><textarea class="nb-field" id="nbReading" placeholder="カードの意味や、自分なりの読み解き"></textarea>
 <label class="field-label" for="nbSymbol">象徴</label><textarea class="nb-field" id="nbSymbol" placeholder="絵柄・色・数字・モチーフなど"></textarea>
 <label class="field-label" for="nbOther">その他</label><textarea class="nb-field" id="nbOther" placeholder="自由メモ"></textarea></div>
 <div class="nb-actions"><button class="primary-btn" id="nbSave">手帳を保存</button><button class="danger-text" id="nbDelete">このカードの手帳を削除</button></div>`;
 main.appendChild(view);
 $('homeNotebookBtn').addEventListener('click',openNotebook);
 $('menuNotebookBtn').addEventListener('click',()=>{$('menuDialog').close();openNotebook();});
 $('nbBack').addEventListener('click',()=>window.goHome());
 $('nbDeck').addEventListener('change',async e=>{deck=e.target.value;fillCards();await load();});
 $('nbCard').addEventListener('change',async e=>{cardId=e.target.value;await load();});
 $('nbType').addEventListener('change',()=>updateAttrs(''));
 $('nbSave').addEventListener('click',save);$('nbDelete').addEventListener('click',remove);
 fillCards();
}
function fillCards(){const list=cards(deck),s=$('nbCard');s.innerHTML=list.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');if(!list.some(c=>c.id===cardId))cardId=list[0]?.id||'';s.value=cardId;}
function updateAttrs(value){const type=$('nbType').value,s=$('nbValue'),c=$('nbCustom'),other=type==='その他';s.innerHTML='<option value="">項目を選択</option>';s.style.display=other?'none':'block';c.style.display=other?'block':'none';if(ATTR[type]){s.innerHTML+=ATTR[type].map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');s.value=value||'';}else if(other)c.value=value||'';else c.value='';}
async function load(){if(!cardId)return;$('nbTitle').textContent=cardName(cardId,deck);const e=await get(key(deck,cardId));$('nbType').value=e?.attributeType||'';updateAttrs(e?.attributeValue||'');$('nbKeywords').value=e?.keywords||'';$('nbReading').value=e?.reading||'';$('nbSymbol').value=e?.symbol||'';$('nbOther').value=e?.other||'';$('nbStatus').textContent=e?`保存済み · ${deckLabel(deck)}`:'未登録';}
async function save(){if(!cardId)return;const type=$('nbType').value;await put({id:key(deck,cardId),deck,cardId,attributeType:type,attributeValue:type==='その他'?$('nbCustom').value.trim():$('nbValue').value,keywords:$('nbKeywords').value,reading:$('nbReading').value,symbol:$('nbSymbol').value,other:$('nbOther').value,updatedAt:new Date().toISOString()});$('nbStatus').textContent=`保存済み · ${deckLabel(deck)}`;window.showToast('タロット手帳を保存しました');}
async function remove(){if(!cardId||!confirm(`${cardName(cardId,deck)}の手帳内容を削除しますか？`))return;await del(key(deck,cardId));await load();window.showToast('手帳内容を削除しました');}
async function openNotebook(){try{if(!db)db=await openDB();deck=$('nbDeck').value||'rws';fillCards();await load();window.showView('notebookView');}catch(e){window.showToast('タロット手帳を開けませんでした');}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();