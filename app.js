'use strict';

/* =========================================================
   Toast
   ========================================================= */
const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(msg){
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  toastTimer = setTimeout(()=> toastEl.classList.remove('show'), 2200);
}
function escapeHtml(s){
  const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML;
}
function money(n){
  n = Number(n) || 0;
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 });
}

/* =========================================================
   IndexedDB
   ========================================================= */
const DB_NAME = 'rookieVaultDB';
const DB_VERSION = 1;
let dbPromise = null;
function openDB(){
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e)=>{
      const db = e.target.result;
      if(!db.objectStoreNames.contains('cards')){
        const store = db.createObjectStore('cards', { keyPath: 'id' });
        store.createIndex('sport', 'sport');
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
  return dbPromise;
}
async function cardsAll(){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction('cards', 'readonly');
    const req = tx.objectStore('cards').getAll();
    req.onsuccess = ()=> resolve(req.result || []);
    req.onerror = ()=> reject(req.error);
  });
}
async function cardGet(id){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction('cards', 'readonly');
    const req = tx.objectStore('cards').get(id);
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}
async function cardPut(item){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction('cards', 'readwrite');
    tx.objectStore('cards').put(item);
    tx.oncomplete = ()=> resolve(item);
    tx.onerror = ()=> reject(tx.error);
  });
}
async function cardDelete(id){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction('cards', 'readwrite');
    tx.objectStore('cards').delete(id);
    tx.oncomplete = ()=> resolve();
    tx.onerror = ()=> reject(tx.error);
  });
}

/* =========================================================
   Tab navigation
   ========================================================= */
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
function setActiveTab(target){
  tabs.forEach(t=> t.classList.toggle('active', t.dataset.target === target));
  panels.forEach(p=> p.classList.toggle('active', p.dataset.panel === target));
  if(target !== 'collection'){ stopCamera(cardStream); cardStream = null; }
  if(target === 'collection') renderCollection();
  if(target === 'stats') renderStats();
}
tabs.forEach(t=> t.addEventListener('click', ()=> setActiveTab(t.dataset.target)));

function showView(containerSelector, viewId){
  document.querySelectorAll(containerSelector + ' .view').forEach(v=>{
    v.classList.toggle('active', v.id === viewId);
  });
}
document.querySelectorAll('[data-back]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const target = btn.dataset.back;
    if(target === 'collection-home'){ stopCamera(cardStream); cardStream = null; renderCollection(); }
    if(target === 'card-capture'){ startCardCamera(); }
    showView('#panel-collection', target);
  });
});

/* =========================================================
   Camera helpers
   ========================================================= */
async function startCamera(videoEl){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }, audio:false
    });
    videoEl.srcObject = stream;
    return stream;
  }catch(err){
    showToast('Camera unavailable — you can still upload a photo.');
    return null;
  }
}
function stopCamera(stream){ if(stream){ stream.getTracks().forEach(t=> t.stop()); } }

/* =========================================================
   CAPTURE
   ========================================================= */
let cardStream = null;
const cardVideo = document.getElementById('cardVideo');
let captureTarget = 'front'; // 'front' | 'back'
let editingCardId = null;
let pendingFrontImage = '';
let pendingBackImage = '';

async function startCardCamera(){ cardStream = await startCamera(cardVideo); }

document.getElementById('cardFab').addEventListener('click', async ()=>{
  editingCardId = null;
  pendingFrontImage = ''; pendingBackImage = '';
  captureTarget = 'front';
  clearForm();
  document.getElementById('deleteCardBtn').classList.add('hidden');
  document.getElementById('captureTitle').textContent = 'Front of card';
  showView('#panel-collection', 'card-capture');
  await startCardCamera();
});

document.getElementById('cardShutter').addEventListener('click', ()=>{
  if(!cardVideo.videoWidth){ showToast('Camera still starting up, try again.'); return; }
  const c = document.createElement('canvas');
  c.width = cardVideo.videoWidth; c.height = cardVideo.videoHeight;
  c.getContext('2d').drawImage(cardVideo, 0, 0);
  stopCamera(cardStream); cardStream = null;
  loadImageToEditor(c.toDataURL('image/jpeg', 0.92));
  showView('#panel-collection', 'card-edit');
});
document.getElementById('cardUploadBtn').addEventListener('click', ()=> document.getElementById('cardFileInput').click());
document.getElementById('cardFileInput').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    stopCamera(cardStream); cardStream = null;
    loadImageToEditor(reader.result);
    showView('#panel-collection', 'card-edit');
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

/* =========================================================
   CROP EDITOR (rotate + rectangular crop)
   ========================================================= */
const cropCanvas = document.getElementById('cardCropCanvas');
const cropCtx = cropCanvas.getContext('2d');
const editor = { rawImage:null, rotation:0, processedCanvas:null, scale:1, rect:null, dragMode:null, dragHandle:null, dragStart:null };

function loadImageToEditor(src){
  const img = new Image();
  img.onload = ()=>{
    editor.rawImage = img; editor.rotation = 0;
    processEditorBase(); resetCropRect(); renderEditor();
  };
  img.src = src;
}
function processEditorBase(){
  const img = editor.rawImage;
  const MAXDIM = 1200;
  let sw = img.width, sh = img.height;
  const scaleDown = Math.min(1, MAXDIM / Math.max(sw, sh));
  sw = Math.round(sw*scaleDown); sh = Math.round(sh*scaleDown);
  const rotated = document.createElement('canvas');
  const rot = editor.rotation;
  if(rot===90 || rot===270){ rotated.width = sh; rotated.height = sw; } else { rotated.width = sw; rotated.height = sh; }
  const rctx = rotated.getContext('2d');
  rctx.save();
  rctx.translate(rotated.width/2, rotated.height/2);
  rctx.rotate(rot*Math.PI/180);
  rctx.drawImage(img, -sw/2, -sh/2, sw, sh);
  rctx.restore();
  editor.processedCanvas = rotated;
}
function resetCropRect(){
  const pc = editor.processedCanvas;
  const maxW = Math.min(560, pc.width);
  editor.scale = maxW / pc.width;
  cropCanvas.width = maxW; cropCanvas.height = Math.round(pc.height*editor.scale);
  const inset = 0.04;
  editor.rect = { x:cropCanvas.width*inset, y:cropCanvas.height*inset, w:cropCanvas.width*(1-inset*2), h:cropCanvas.height*(1-inset*2) };
}
function renderEditor(){
  cropCtx.clearRect(0,0,cropCanvas.width, cropCanvas.height);
  cropCtx.drawImage(editor.processedCanvas, 0, 0, cropCanvas.width, cropCanvas.height);
  const r = editor.rect;
  cropCtx.fillStyle = 'rgba(0,0,0,.55)';
  cropCtx.fillRect(0,0,cropCanvas.width, r.y);
  cropCtx.fillRect(0, r.y+r.h, cropCanvas.width, cropCanvas.height-r.y-r.h);
  cropCtx.fillRect(0, r.y, r.x, r.h);
  cropCtx.fillRect(r.x+r.w, r.y, cropCanvas.width-r.x-r.w, r.h);
  cropCtx.strokeStyle = '#d9b34d'; cropCtx.lineWidth = 2;
  cropCtx.strokeRect(r.x, r.y, r.w, r.h);
  cropCtx.fillStyle = '#d9b34d';
  cropHandlePositions().forEach(h=>{ cropCtx.beginPath(); cropCtx.arc(h.x,h.y,8,0,Math.PI*2); cropCtx.fill(); });
}
function cropHandlePositions(){
  const r = editor.rect;
  return [{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x,y:r.y+r.h},{x:r.x+r.w,y:r.y+r.h}];
}
function canvasPoint(e){
  const rect = cropCanvas.getBoundingClientRect();
  const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
  return { x: cx*(cropCanvas.width/rect.width), y: cy*(cropCanvas.height/rect.height) };
}
function pointerDownEditor(e){
  const p = canvasPoint(e);
  const handles = cropHandlePositions();
  for(let i=0;i<handles.length;i++){
    if(Math.hypot(p.x-handles[i].x, p.y-handles[i].y) < 26){ editor.dragMode='handle'; editor.dragHandle=i; return; }
  }
  const r = editor.rect;
  if(p.x>r.x && p.x<r.x+r.w && p.y>r.y && p.y<r.y+r.h){ editor.dragMode='move'; editor.dragStart={x:p.x-r.x,y:p.y-r.y}; }
}
function pointerMoveEditor(e){
  if(!editor.dragMode) return;
  e.preventDefault();
  const p = canvasPoint(e); const r = editor.rect; const minSize = 40;
  if(editor.dragMode==='move'){
    r.x = Math.max(0, Math.min(cropCanvas.width-r.w, p.x-editor.dragStart.x));
    r.y = Math.max(0, Math.min(cropCanvas.height-r.h, p.y-editor.dragStart.y));
  } else if(editor.dragMode==='handle'){
    const idx = editor.dragHandle; let {x,y,w,h} = r; const right=x+w, bottom=y+h;
    if(idx===0){ x=Math.min(p.x,right-minSize); y=Math.min(p.y,bottom-minSize); w=right-x; h=bottom-y; }
    if(idx===1){ const nr=Math.max(p.x,x+minSize); w=nr-x; y=Math.min(p.y,bottom-minSize); h=bottom-y; }
    if(idx===2){ x=Math.min(p.x,right-minSize); w=right-x; const nb=Math.max(p.y,y+minSize); h=nb-y; }
    if(idx===3){ const nr=Math.max(p.x,x+minSize); w=nr-x; const nb=Math.max(p.y,y+minSize); h=nb-y; }
    r.x=Math.max(0,x); r.y=Math.max(0,y);
    r.w=Math.min(w, cropCanvas.width-r.x); r.h=Math.min(h, cropCanvas.height-r.y);
  }
  renderEditor();
}
function pointerUpEditor(){ editor.dragMode = null; }
cropCanvas.addEventListener('pointerdown', pointerDownEditor);
cropCanvas.addEventListener('pointermove', pointerMoveEditor);
window.addEventListener('pointerup', pointerUpEditor);

document.getElementById('cardRotateBtn').addEventListener('click', ()=>{
  editor.rotation = (editor.rotation+90)%360;
  processEditorBase(); resetCropRect(); renderEditor();
});

document.getElementById('cardUseCropBtn').addEventListener('click', ()=>{
  const r = editor.rect;
  const sx = r.x/editor.scale, sy = r.y/editor.scale, sw = r.w/editor.scale, sh = r.h/editor.scale;
  const out = document.createElement('canvas');
  out.width = Math.round(sw); out.height = Math.round(sh);
  out.getContext('2d').drawImage(editor.processedCanvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
  const dataUrl = out.toDataURL('image/jpeg', 0.88);
  if(captureTarget === 'front') pendingFrontImage = dataUrl; else pendingBackImage = dataUrl;
  openCardForm();
});

/* =========================================================
   CARD FORM
   ========================================================= */
function openCardForm(){
  document.getElementById('formTitle').textContent = editingCardId ? 'Edit card' : 'Card details';
  document.getElementById('formFrontImg').src = pendingFrontImage || '';
  document.getElementById('formBackImg').src = pendingBackImage || '';
  document.getElementById('addBackBtn').textContent = pendingBackImage ? 'Retake back' : '+ Add back';
  showView('#panel-collection', 'card-form');
}
document.getElementById('retakeFrontBtn').addEventListener('click', async ()=>{
  captureTarget = 'front';
  document.getElementById('captureTitle').textContent = 'Front of card';
  showView('#panel-collection', 'card-capture');
  await startCardCamera();
});
document.getElementById('addBackBtn').addEventListener('click', async ()=>{
  captureTarget = 'back';
  document.getElementById('captureTitle').textContent = 'Back of card';
  showView('#panel-collection', 'card-capture');
  await startCardCamera();
});

document.getElementById('fGraded').addEventListener('change', (e)=>{
  document.getElementById('gradedFields').classList.toggle('hidden', !e.target.checked);
  document.getElementById('conditionField').classList.toggle('hidden', e.target.checked);
});

function buildEbayUrl(){
  const parts = [
    document.getElementById('fYear').value,
    document.getElementById('fBrand').value,
    document.getElementById('fPlayer').value,
    document.getElementById('fCardNum').value ? '#'+document.getElementById('fCardNum').value : '',
    document.getElementById('fParallel').value
  ].filter(Boolean).join(' ');
  const q = encodeURIComponent(parts || 'sports card');
  return `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`;
}
document.getElementById('checkPriceBtn').addEventListener('click', ()=>{
  window.open(buildEbayUrl(), '_blank', 'noopener');
});

function fillFormFromCard(c){
  document.getElementById('fPlayer').value = c.player || '';
  document.getElementById('fTeam').value = c.team || '';
  document.getElementById('fSport').value = c.sport || 'baseball';
  document.getElementById('fYear').value = c.year || '';
  document.getElementById('fBrand').value = c.brand || '';
  document.getElementById('fCardNum').value = c.cardNumber || '';
  document.getElementById('fParallel').value = c.parallel || '';
  document.getElementById('fRookie').checked = !!c.rookie;
  document.getElementById('fGraded').checked = !!c.graded;
  document.getElementById('gradedFields').classList.toggle('hidden', !c.graded);
  document.getElementById('conditionField').classList.toggle('hidden', !!c.graded);
  document.getElementById('fGradingCo').value = c.gradingCo || 'PSA';
  document.getElementById('fGrade').value = c.grade || '';
  document.getElementById('fCondition').value = c.condition || 'nm';
  document.getElementById('fPurchase').value = c.purchasePrice ?? '';
  document.getElementById('fValue').value = c.currentValue ?? '';
  document.getElementById('fNotes').value = c.notes || '';
}
function clearForm(){
  ['fPlayer','fTeam','fYear','fBrand','fCardNum','fParallel','fGrade','fPurchase','fValue','fNotes'].forEach(id=> document.getElementById(id).value = '');
  document.getElementById('fSport').value = 'baseball';
  document.getElementById('fRookie').checked = false;
  document.getElementById('fGraded').checked = false;
  document.getElementById('gradedFields').classList.add('hidden');
  document.getElementById('conditionField').classList.remove('hidden');
  document.getElementById('fCondition').value = 'nm';
}

document.getElementById('saveCardBtn').addEventListener('click', async ()=>{
  const player = document.getElementById('fPlayer').value.trim();
  if(!player){ showToast('Add a player name first.'); return; }
  if(!pendingFrontImage){ showToast('Add a front photo first.'); return; }

  const newValue = parseFloat(document.getElementById('fValue').value) || 0;
  let history = [];
  let createdAt = new Date().toISOString();
  if(editingCardId){
    const existing = await cardGet(editingCardId);
    if(existing){
      history = existing.valueHistory || [];
      createdAt = existing.createdAt || createdAt;
      if(existing.currentValue !== newValue){
        history = history.concat([{ date: new Date().toISOString(), value: newValue }]).slice(-24);
      }
    }
  } else {
    history = [{ date: createdAt, value: newValue }];
  }

  const item = {
    id: editingCardId || ('c_' + Date.now() + '_' + Math.random().toString(36).slice(2,7)),
    player,
    team: document.getElementById('fTeam').value.trim(),
    sport: document.getElementById('fSport').value,
    year: document.getElementById('fYear').value.trim(),
    brand: document.getElementById('fBrand').value.trim(),
    cardNumber: document.getElementById('fCardNum').value.trim(),
    parallel: document.getElementById('fParallel').value.trim(),
    rookie: document.getElementById('fRookie').checked,
    graded: document.getElementById('fGraded').checked,
    gradingCo: document.getElementById('fGradingCo').value,
    grade: document.getElementById('fGrade').value.trim(),
    condition: document.getElementById('fCondition').value,
    purchasePrice: parseFloat(document.getElementById('fPurchase').value) || 0,
    currentValue: newValue,
    valueHistory: history,
    frontImage: pendingFrontImage,
    backImage: pendingBackImage,
    notes: document.getElementById('fNotes').value.trim(),
    createdAt,
    updatedAt: new Date().toISOString()
  };
  await cardPut(item);
  showToast(editingCardId ? 'Card updated' : 'Card added');
  editingCardId = null;
  showView('#panel-collection', 'collection-home');
  renderCollection();
});

document.getElementById('deleteCardBtn').addEventListener('click', async ()=>{
  if(!editingCardId) return;
  if(!confirm('Remove this card from the collection?')) return;
  await cardDelete(editingCardId);
  showToast('Removed');
  editingCardId = null;
  showView('#panel-collection', 'collection-home');
  renderCollection();
});

/* =========================================================
   COLLECTION GRID
   ========================================================= */
let currentSort = 'newest';
document.querySelectorAll('[data-sort]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    currentSort = btn.dataset.sort;
    document.querySelectorAll('[data-sort]').forEach(b=> b.classList.toggle('active', b===btn));
    renderCollection();
  });
});
document.getElementById('cardSearch').addEventListener('input', renderCollection);
document.getElementById('sportFilter').addEventListener('change', renderCollection);

async function renderCollection(){
  const all = await cardsAll();
  const q = document.getElementById('cardSearch').value.trim().toLowerCase();
  const sport = document.getElementById('sportFilter').value;

  let filtered = all.filter(c=>{
    if(sport && c.sport !== sport) return false;
    if(!q) return true;
    return (c.player+' '+c.team+' '+c.brand+' '+c.year).toLowerCase().includes(q);
  });

  if(currentSort === 'newest') filtered.sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
  if(currentSort === 'value') filtered.sort((a,b)=> (b.currentValue||0) - (a.currentValue||0));
  if(currentSort === 'player') filtered.sort((a,b)=> (a.player||'').localeCompare(b.player||''));

  const totalValue = all.reduce((s,c)=> s + (Number(c.currentValue)||0), 0);
  document.getElementById('collectionSummary').textContent = all.length
    ? `${all.length} card${all.length===1?'':'s'} · worth ${money(totalValue)}`
    : 'No cards yet.';

  const grid = document.getElementById('cardGrid');
  const empty = document.getElementById('cardGridEmpty');
  grid.innerHTML = '';
  empty.classList.toggle('hidden', filtered.length > 0);

  filtered.forEach(c=>{
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'card-tile';
    tile.innerHTML = `
      <div class="stripe" style="background:var(--s-${c.sport||'other'})"></div>
      <img src="${c.frontImage}" alt="">
      ${c.rookie ? '<span class="rookie-badge">RC</span>' : ''}
      <div class="ct-body">
        <div class="ct-player">${escapeHtml(c.player)}</div>
        <div class="ct-meta">${escapeHtml(c.year||'')} ${escapeHtml(c.brand||'')}</div>
        <div class="ct-value">${money(c.currentValue)}</div>
      </div>`;
    tile.addEventListener('click', ()=> openCardDetail(c.id));
    grid.appendChild(tile);
  });
}

/* =========================================================
   CARD DETAIL OVERLAY
   ========================================================= */
let detailCardId = null;
let showingBack = false;
async function openCardDetail(id){
  const c = await cardGet(id);
  if(!c) return;
  detailCardId = id;
  showingBack = false;
  renderDetail(c);
  document.getElementById('cardDetailOverlay').classList.remove('hidden');
}
function renderDetail(c){
  document.getElementById('detailFrontImg').src = showingBack && c.backImage ? c.backImage : c.frontImage;
  document.getElementById('detailBackToggle').classList.toggle('hidden', !c.backImage);
  document.getElementById('detailBackToggle').textContent = showingBack ? 'Show front' : 'Show back';

  document.getElementById('detailPlayer').textContent = c.player;
  const subParts = [c.year, c.brand, c.cardNumber ? '#'+c.cardNumber : '', c.parallel].filter(Boolean);
  document.getElementById('detailSub').textContent = subParts.join(' · ') + (c.rookie ? ' · Rookie' : '');

  document.getElementById('detailPaid').textContent = money(c.purchasePrice);
  document.getElementById('detailValue').textContent = money(c.currentValue);
  const change = (Number(c.currentValue)||0) - (Number(c.purchasePrice)||0);
  const pct = c.purchasePrice ? (change/c.purchasePrice*100) : 0;
  const changeEl = document.getElementById('detailChange');
  changeEl.textContent = (change>=0?'+':'') + money(change).replace('$','$') + (c.purchasePrice ? ` (${change>=0?'+':''}${pct.toFixed(0)}%)` : '');
  changeEl.className = change > 0 ? 'pos' : (change < 0 ? 'neg' : '');

  const sparkCanvas = document.getElementById('sparkline');
  if(c.valueHistory && c.valueHistory.length >= 2){
    sparkCanvas.classList.remove('hidden');
    drawSparkline(sparkCanvas, c.valueHistory.map(h=>h.value));
  } else {
    sparkCanvas.classList.add('hidden');
  }

  let meta = `Team: ${escapeHtml(c.team||'—')}<br>Condition: ${c.graded ? escapeHtml(c.gradingCo+' '+c.grade) : escapeHtml(condLabel(c.condition))}`;
  if(c.notes) meta += `<br>${escapeHtml(c.notes)}`;
  document.getElementById('detailMeta').innerHTML = meta;
}
function condLabel(c){
  return { mint:'Mint', nm:'Near Mint', ex:'Excellent', vg:'Very Good', poor:'Poor / played' }[c] || c;
}
function drawSparkline(canvas, values){
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 300, h = 60;
  canvas.width = w*dpr; canvas.height = h*dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0,0,w,h);
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max-min) || 1;
  const pad = 6;
  ctx.strokeStyle = '#d9b34d'; ctx.lineWidth = 2; ctx.beginPath();
  values.forEach((v,i)=>{
    const x = pad + (i/(values.length-1)) * (w-pad*2);
    const y = h - pad - ((v-min)/range) * (h-pad*2);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
  const lastX = pad + (w-pad*2);
  const lastY = h - pad - ((values[values.length-1]-min)/range)*(h-pad*2);
  ctx.fillStyle = '#d9b34d';
  ctx.beginPath(); ctx.arc(lastX, lastY, 3.5, 0, Math.PI*2); ctx.fill();
}
document.getElementById('detailBackToggle').addEventListener('click', async ()=>{
  showingBack = !showingBack;
  const c = await cardGet(detailCardId);
  renderDetail(c);
});
document.getElementById('detailCheckPrice').addEventListener('click', async ()=>{
  const c = await cardGet(detailCardId);
  const parts = [c.year, c.brand, c.player, c.cardNumber?'#'+c.cardNumber:'', c.parallel].filter(Boolean).join(' ');
  window.open(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(parts)}&LH_Sold=1&LH_Complete=1`, '_blank', 'noopener');
});
document.getElementById('closeDetailBtn').addEventListener('click', ()=>{
  document.getElementById('cardDetailOverlay').classList.add('hidden');
});
document.getElementById('detailEdit').addEventListener('click', async ()=>{
  const c = await cardGet(detailCardId);
  if(!c) return;
  document.getElementById('cardDetailOverlay').classList.add('hidden');
  editingCardId = c.id;
  pendingFrontImage = c.frontImage; pendingBackImage = c.backImage || '';
  fillFormFromCard(c);
  document.getElementById('deleteCardBtn').classList.remove('hidden');
  openCardForm();
});

/* =========================================================
   STATS
   ========================================================= */
async function renderStats(){
  const all = await cardsAll();
  const totalValue = all.reduce((s,c)=> s+(Number(c.currentValue)||0), 0);
  const totalPaid = all.reduce((s,c)=> s+(Number(c.purchasePrice)||0), 0);
  const gain = totalValue - totalPaid;
  const gainPct = totalPaid ? (gain/totalPaid*100) : 0;

  const statGrid = document.getElementById('statGrid');
  statGrid.innerHTML = `
    <div class="stat-card"><div class="sc-label">Total cards</div><div class="sc-value">${all.length}</div></div>
    <div class="stat-card"><div class="sc-label">Collection worth</div><div class="sc-value">${money(totalValue)}</div></div>
    <div class="stat-card"><div class="sc-label">Total invested</div><div class="sc-value">${money(totalPaid)}</div></div>
    <div class="stat-card"><div class="sc-label">Gain / loss</div><div class="sc-value ${gain>0?'pos':gain<0?'neg':''}">${gain>=0?'+':''}${money(gain)} <span style="font-size:12px">(${gainPct>=0?'+':''}${gainPct.toFixed(0)}%)</span></div></div>
  `;

  const top = [...all].sort((a,b)=> (b.currentValue||0)-(a.currentValue||0)).slice(0,5);
  const topList = document.getElementById('topCardsList');
  topList.innerHTML = '';
  if(!top.length){ topList.innerHTML = '<p class="empty-state small">No cards yet.</p>'; }
  top.forEach(c=>{
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `
      <img src="${c.frontImage}" alt="">
      <div class="lr-info">
        <div class="lr-title">${escapeHtml(c.player)}</div>
        <div class="lr-sub">${escapeHtml(c.year||'')} ${escapeHtml(c.brand||'')}</div>
      </div>
      <div class="lr-value">${money(c.currentValue)}</div>`;
    row.addEventListener('click', ()=> openCardDetail(c.id));
    topList.appendChild(row);
  });

  const bySport = {};
  all.forEach(c=>{
    const s = c.sport || 'other';
    bySport[s] = bySport[s] || { count:0, value:0 };
    bySport[s].count++; bySport[s].value += Number(c.currentValue)||0;
  });
  const sportEl = document.getElementById('sportBreakdown');
  sportEl.innerHTML = '';
  const sportLabels = { football:'Football', baseball:'Baseball', basketball:'Basketball', hockey:'Hockey', soccer:'Soccer', other:'Other' };
  Object.keys(bySport).sort((a,b)=> bySport[b].value - bySport[a].value).forEach(s=>{
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `
      <span class="sport-dot" style="background:var(--s-${s})"></span>
      <div class="lr-info">
        <div class="lr-title">${sportLabels[s]||s}</div>
        <div class="lr-sub">${bySport[s].count} card${bySport[s].count===1?'':'s'}</div>
      </div>
      <div class="lr-value">${money(bySport[s].value)}</div>`;
    sportEl.appendChild(row);
  });
  if(!Object.keys(bySport).length){ sportEl.innerHTML = '<p class="empty-state small">No cards yet.</p>'; }
}

/* =========================================================
   SETTINGS — CardSight API key
   ========================================================= */
const API_KEY_STORAGE = 'rookieVault_cardsightApiKey';
function getApiKey(){ return localStorage.getItem(API_KEY_STORAGE) || ''; }
function setApiKey(key){ if(key) localStorage.setItem(API_KEY_STORAGE, key); else localStorage.removeItem(API_KEY_STORAGE); }

document.getElementById('settingsBtn').addEventListener('click', ()=>{
  document.getElementById('apiKeyInput').value = getApiKey();
  document.getElementById('apiKeyStatus').textContent = getApiKey() ? 'A key is currently saved.' : 'No key saved yet — AI identification is off.';
  document.getElementById('settingsOverlay').classList.remove('hidden');
});
document.getElementById('closeSettingsBtn').addEventListener('click', ()=>{
  document.getElementById('settingsOverlay').classList.add('hidden');
});
document.getElementById('saveApiKeyBtn').addEventListener('click', ()=>{
  const key = document.getElementById('apiKeyInput').value.trim();
  if(!key){ showToast('Paste a key first.'); return; }
  setApiKey(key);
  showToast('API key saved');
  document.getElementById('settingsOverlay').classList.add('hidden');
});
document.getElementById('clearApiKeyBtn').addEventListener('click', ()=>{
  setApiKey('');
  document.getElementById('apiKeyInput').value = '';
  document.getElementById('apiKeyStatus').textContent = 'No key saved yet — AI identification is off.';
  showToast('Key removed');
});

/* =========================================================
   AI IDENTIFICATION (CardSight AI)
   ========================================================= */
const SPORT_TO_SEGMENT = { baseball:'baseball', football:'football', basketball:'basketball', hockey:'hockey' };

function setIdentifyStatus(msg){
  const el = document.getElementById('identifyStatus');
  if(!msg){ el.classList.add('hidden'); el.textContent = ''; return; }
  el.textContent = msg;
  el.classList.remove('hidden');
}

document.getElementById('identifyBtn').addEventListener('click', async ()=>{
  const apiKey = getApiKey();
  if(!apiKey){
    showToast('Add a free CardSight API key in Settings first.');
    document.getElementById('settingsOverlay').classList.remove('hidden');
    return;
  }
  if(!pendingFrontImage){ showToast('Add a front photo first.'); return; }
  const sport = document.getElementById('fSport').value;
  const segment = SPORT_TO_SEGMENT[sport];
  if(!segment){
    showToast("AI identification doesn't cover this sport yet — enter details manually.");
    return;
  }

  const btn = document.getElementById('identifyBtn');
  btn.disabled = true;
  setIdentifyStatus('Identifying card…');

  try{
    const mod = await import('https://cdn.jsdelivr.net/npm/cardsightai/+esm');
    const client = new mod.CardSightAI({ apiKey });
    const blob = await fetch(pendingFrontImage).then(r=> r.blob());
    const result = await client.identify.cardBySegment(segment, blob);

    const detection = mod.getHighestConfidenceDetection ? mod.getHighestConfidenceDetection(result.data) : (result.data?.detections || [])[0];
    if(!detection || !detection.card || (!detection.card.id && !detection.card.setId)){
      setIdentifyStatus('');
      showToast("Couldn't identify this card — enter the details manually.");
      return;
    }

    const card = detection.card;
    const exact = !!card.id;

    if(card.name) document.getElementById('fPlayer').value = card.name;
    if(card.year) document.getElementById('fYear').value = card.year;
    if(card.manufacturer) document.getElementById('fBrand').value = card.manufacturer;
    if(card.number) document.getElementById('fCardNum').value = card.number;
    if(card.parallel){
      const p = card.parallel;
      document.getElementById('fParallel').value = p.numberedTo ? `${p.name} /${p.numberedTo}` : (p.name || '');
    }

    if(mod.hasGrading && mod.hasGrading(detection)){
      const grading = mod.getGradingInfo(detection);
      document.getElementById('fGraded').checked = true;
      document.getElementById('gradedFields').classList.remove('hidden');
      document.getElementById('conditionField').classList.add('hidden');
      const knownCos = ['PSA','BGS','SGC'];
      document.getElementById('fGradingCo').value = knownCos.includes(grading.company?.name) ? grading.company.name : 'other';
      if(grading.grade?.value) document.getElementById('fGrade').value = grading.grade.value;
    }

    setIdentifyStatus(exact
      ? `Identified — ${detection.confidence} confidence. Double-check before saving.`
      : `Matched the set, but not the exact card — fill in what's missing.`);
    showToast(exact ? 'Card identified' : 'Set identified — check the details');

    // Pull a value estimate from recent sales, when we have an exact card match
    if(exact && card.id){
      setIdentifyStatus('Looking up recent sale prices…');
      try{
        const pricing = await client.pricing.get(card.id, { period:'1y', listing_type:'both' });
        const estimate = estimateValueFromPricing(pricing.data, document.getElementById('fGraded').checked, document.getElementById('fGradingCo').value, document.getElementById('fGrade').value);
        if(estimate != null){
          document.getElementById('fValue').value = estimate.toFixed(2);
          setIdentifyStatus(`Identified — ${detection.confidence} confidence. Value estimate from ${pricing.data.meta?.total_records || 'recent'} sales — double-check before saving.`);
        } else {
          setIdentifyStatus(`Identified — ${detection.confidence} confidence. No recent sales data found — enter your own estimate.`);
        }
      }catch(e){
        // pricing lookup failing shouldn't block the identification result
      }
    }
  }catch(err){
    setIdentifyStatus('');
    showToast('Could not reach the identification service — enter details manually.');
  }finally{
    btn.disabled = false;
  }
});

function estimateValueFromPricing(data, isGraded, gradingCo, gradeValue){
  if(!data) return null;
  if(isGraded && data.graded && data.graded.length){
    const company = data.graded.find(c => (c.company_name||'').toUpperCase() === (gradingCo||'').toUpperCase());
    if(company){
      const grade = company.grades.find(g => String(g.grade_value) === String(gradeValue));
      if(grade && grade.records && grade.records.length){
        return average(grade.records.map(r=> Number(r.price)).filter(n=> !isNaN(n)));
      }
    }
  }
  if(data.raw && data.raw.records && data.raw.records.length){
    return average(data.raw.records.map(r=> Number(r.price)).filter(n=> !isNaN(n)));
  }
  return null;
}
function average(nums){
  if(!nums.length) return null;
  return nums.reduce((a,b)=>a+b,0) / nums.length;
}

/* =========================================================
   PWA install + service worker
   ========================================================= */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt = e;
  document.getElementById('installBtn').classList.remove('hidden');
});
document.getElementById('installBtn').addEventListener('click', async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('installBtn').classList.add('hidden');
});
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}

/* =========================================================
   Init
   ========================================================= */
renderCollection();
