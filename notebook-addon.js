/* Tarot Journal - Tarot Notebook add-on + reading reference popup */
(() => {
'use strict';
const DB='TarotJournalNotebookDB',STORE='notebook',$=id=>document.getElementById(id);
let db=null,deck='rws',cardId='';
const ATTR={'四大元素':['火','水','風','地'],'惑星':['太陽','月','水星','金星','火星','木星','土星','天王星','海王星','冥王星'],'星座':['牡羊座','牡牛座','双子座','蟹座','獅子座','乙女座','天秤座','蠍座','射手座','山羊座','水瓶座','魚座']};
const css=document.createElement('style');
css.textContent=`
#notebookView .nb-panel{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;margin:12px 0}
#notebookView .nb-field{display:block;width:100%;background:#fff;border:1px solid var(--line);border-radius:10px;padding:11px 12px;color:var(--ink);font:inherit}
#notebookView textarea.nb-field{min-height:105px;resize:vertical;line-height:1.7}
#notebookView .nb-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#notebookView .nb-actions{display:grid;gap:9px;margin:18px 0 28px}
#notebookView .nb-status{font-size:11px;color:var(--muted);min-height:1.5em}
#notebookView .nb-title{font-family:'Noto Serif JP',serif;font-size:19px;font-weight:500;margin:4px 0}
#cardsContainer .nb-reference-btn{width:100%;margin-top:9px}
#notebookReferenceDialog{width:min(560px,calc(100% - 24px));max-height:min(82dvh,760px);overflow:hidden;padding:0;border:1px solid var(--line);border-radius:18px;background:var(--paper);color:var(--ink)}
#notebookReferenceDialog::backdrop{background:#20192c99}
#notebookReferenceDialog .npr-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 17px;background:#fff;border-bottom:1px solid var(--line)}
#notebookReferenceDialog .npr-head strong{font-family:'Noto Serif JP',serif;font-weight:500;font-size:17px}
#notebookReferenceDialog .npr-body{padding:15px 17px 22px;overflow-y:auto;max-height:calc(min(82dvh,760px) - 62px);overscroll-behavior:contain}
#notebookReferenceDialog .npr-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:13px;margin-bottom:11px}
#notebookReferenceDialog .npr-label{font-size:11px;color:var(--muted);margin-bottom:5px}
#notebookReferenceDialog .npr-value{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8;font-size:14px;user-select:text;-webkit-user-select:text;-webkit-touch-callout:default;cursor:text}
#notebookReferenceDialog .npr-empty{color:var(--muted);font-size:13px;line-height:1.8;padding:12px 2px}
#notebookReferenceDialog .npr-actions{display:flex;gap:8px;align-items:center}
#notebookReferenceDialog .npr-actions button{width:auto;padding:8px 12px}
#notebookReferenceDialog .npr-close{border:0;background:transparent;color:var(--muted);font-size:23px;padding:2px 7px}
@media(max-width:420px){#notebookView .nb-row{grid-template-columns:1fr}}
`;
document.head.appendChild(css);
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function request(mode,fn){return new Promise((resolve,reject)=>{const t=db.transaction(STORE,mode),r=fn(t.objectStore(STORE));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
const get=id=>request('readonly',s=>s.get(id)),put=v=>request('readwrite',s=>s.put(v)),del=id=>request('readwrite',s=>s.delete(id));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const deckLabel=d=>d==='marseille'?'マルセイユ版':'ウェイト（ライダー）版';
function cards(d){return typeof window.cardOptions==='function'?window.cardOptions(d).map(c=>({id:c.id,name:c.name})):[];}
function cardName(id,d){return cards(d).find(c=>c.id===id)?.name||id;}
const key=(d,id)=>`${d}:${id}`;

function installReferenceDialog(){
 if($('notebookReferenceDialog'))return;
 const dialog=document.createElement('dialog');dialog.id='notebookReferenceDialog';
 dialog.innerHTML=`<div class="npr-head"><strong id="nprTitle">タロット手帳</strong><div class="npr-actions"><button type="button" class="secondary-btn" id="nprCopy">全文をコピー</button><button type="button" class="npr-close" id="nprClose" aria-label="閉じる">×</button></div></div><div class="npr-body" id="nprBody"></div>`;
 document.body.appendChild(dialog);
 $('nprClose').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 $('nprCopy').addEventListener('click',async()=>{
   const body=$('nprBody'),text=body.dataset.copyText||'';
   if(!text)return;
   try{
     if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
     else throw new Error('clipboard unavailable');
     window.showToast?.('手帳の内容をコピーしました');
   }catch(_){
     const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
     let ok=false;try{ok=document.execCommand('copy')}catch(e){}
     ta.remove();window.showToast?.(ok?'手帳の内容をコピーしました':'文章を長押ししてコピーしてください');
   }
 });
}
function addRefButton(entry,select,deck){
 const button=document.createElement('button');button.type='button';button.className='secondary-btn nb-reference-btn';
 button.textContent='▤ タロット手帳を参照';
 button.addEventListener('click',()=>openReference(select.value,deck,select.selectedOptions[0]?.textContent||''));
 entry.appendChild(button);
}
function wrapCardRenderer(){
 if(typeof window.renderCardEntries!=='function'||window.renderCardEntries.__notebookWrapped)return;
 const original=window.renderCardEntries;
 const wrapped=function(){
   original.apply(this,arguments);
   const deck=$('deckInput')?.value||'rws';
   document.querySelectorAll('#cardsContainer .card-entry').forEach(entry=>{
     if(entry.querySelector('.nb-reference-btn'))return;
     const select=entry.querySelector('.card-name');
     if(select)addRefButton(entry,select,deck);
   });
 };
 wrapped.__notebookWrapped=true;
 window.renderCardEntries=wrapped;
}
async function openReference(id,d,name){
 installReferenceDialog();
 const dialog=$('notebookReferenceDialog'),body=$('nprBody');
 $('nprTitle').textContent=name?`${name}の手帳`:'タロット手帳';
 body.innerHTML='<p class="npr-empty">手帳を読み込んでいます…</p>';
 body.dataset.copyText='';
 dialog.showModal();
 try{
   if(!db)db=await openDB();
   const entry=id&&id!=='custom'?await get(key(d,id)):null;
   const fields=[
     ['属性',[entry?.attributeType,entry?.attributeValue].filter(Boolean).join('：')],
     ['キーワード',entry?.keywords],
     ['リーディング',entry?.reading],
     ['象徴',entry?.symbol],
     ['その他',entry?.other]
   ].filter(([,v])=>String(v||'').trim());
   const allText=[name||cardName(id,d),deckLabel(d),...fields.map(([label,value])=>`${label}\n${value}`)].join('\n\n');
   body.dataset.copyText=allText;
   body.replaceChildren();
   if(!id||id==='custom'||!entry){
     const p=document.createElement('p');p.className='npr-empty';
     p.textContent=!id||id==='custom'?'カードを選択すると、そのカードの手帳を参照できます。':'このカードの手帳はまだ登録されていません。タロット手帳で記録できます。';
     body.appendChild(p);
   }else{
     const meta=document.createElement('p');meta.className='npr-label';meta.textContent=deckLabel(d);body.appendChild(meta);
     if(fields.length){
       fields.forEach(([label,value])=>{
         const section=document.createElement('section');section.className='npr-card';
         const heading=document.createElement('div');heading.className='npr-label';heading.textContent=label;
         const content=document.createElement('div');content.className='npr-value';content.textContent=value;
         section.append(heading,content);body.appendChild(section);
       });
     }else{
       const p=document.createElement('p');p.className='npr-empty';p.textContent='このカードの手帳はまだ空欄です。';body.appendChild(p);
     }
   }
 }catch(e){
   body.innerHTML='<p class="npr-empty">手帳を読み込めませんでした。画面を閉じて、もう一度お試しください。</p>';
 }
}

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
installReferenceDialog();
wrapCardRenderer();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{install();wrapCardRenderer();},{once:true});else install();
})();
