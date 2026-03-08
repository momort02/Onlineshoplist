/**
 * ShopList v3 — Firebase + Auth + Realtime Collab
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── DOM helpers ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ─── Firebase config ─────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyC-Jk6_u6vmwMXjV1gsIJQPZooCNnkU3sw",
  authDomain:        "onlineshoplist-f61ce.firebaseapp.com",
  projectId:         "onlineshoplist-f61ce",
  storageBucket:     "onlineshoplist-f61ce.firebasestorage.app",
  messagingSenderId: "968321361509",
  appId:             "1:968321361509:web:23c33f420db8c168e7088c",
};

// ─── App state ───────────────────────────────────────────────
let db, auth;
let currentUser        = null;
let activeListId       = null;
let activeFilter       = 'all';
let activeCategoryFilter = null;
let editingItemId      = null;
let unsubLists         = null;
let unsubItems         = null;
let listsCache         = {};
let itemsCache         = [];

// ─── Utils ───────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmt(n) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function genToken() {
  return Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,10);
}
function calcTotal(items) {
  return items.reduce((s, it) => it.price != null ? s + it.price * it.qty : s, 0);
}
function calcSpent(items) {
  return items.filter(i => i.done).reduce((s, it) => it.price != null ? s + it.price * it.qty : s, 0);
}

let toastTimer;
function showToast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  }
}

// ─── Screens ─────────────────────────────────────────────────
function showScreen(name) {
  $('loadingScreen').classList.add('hidden');
  $('authScreen').classList.add('hidden');
  $('mainApp').classList.add('hidden');
  if (name === 'loading') $('loadingScreen').classList.remove('hidden');
  if (name === 'auth')    $('authScreen').classList.remove('hidden');
  if (name === 'app')     $('mainApp').classList.remove('hidden');
}

// ─── Auth helpers ─────────────────────────────────────────────
function authErrMsg(e) {
  const map = {
    'auth/user-not-found':       'Aucun compte avec cet email.',
    'auth/wrong-password':       'Mot de passe incorrect.',
    'auth/invalid-credential':   'Email ou mot de passe incorrect.',
    'auth/email-already-in-use': 'Un compte existe déjà avec cet email.',
    'auth/weak-password':        'Mot de passe trop court (6 car. min.).',
    'auth/invalid-email':        'Email invalide.',
    'auth/network-request-failed': 'Erreur réseau.',
  };
  return map[e.code] || e.message;
}

// ─── Firestore — Lists ────────────────────────────────────────
function listenToLists() {
  if (unsubLists) unsubLists();
  const q = query(
    collection(db, 'lists'),
    where(`members.${currentUser.uid}`, '!=', null)
  );
  unsubLists = onSnapshot(q, snap => {
    listsCache = {};
    snap.forEach(d => { listsCache[d.id] = { id: d.id, ...d.data() }; });

    const ids = Object.keys(listsCache);
    if (!activeListId || !listsCache[activeListId]) {
      const saved = localStorage.getItem('shoplist_active_' + currentUser.uid);
      activeListId = (saved && listsCache[saved]) ? saved
                   : ids.length > 0 ? ids[0] : null;
      if (!activeListId) { createList('Ma Liste'); return; }
    }
    renderSidebar();
    renderHeader();
    renderMembers();
    renderBudget();
    listenToItems();
  }, err => {
    if (err.code === 'permission-denied') showToast('Accès refusé — vérifie les règles Firestore');
  });
}

function listenToItems() {
  if (unsubItems) unsubItems();
  if (!activeListId) return;
  setSyncDot('syncing');
  const q = query(collection(db, 'lists', activeListId, 'items'), orderBy('createdAt', 'asc'));
  unsubItems = onSnapshot(q, snap => {
    itemsCache = [];
    snap.forEach(d => itemsCache.push({ id: d.id, ...d.data() }));
    setSyncDot('online');
    renderFilters();
    renderStats();
    renderItems();
    renderBudget();
  }, () => setSyncDot('offline'));
}

// ─── List CRUD ────────────────────────────────────────────────
async function createList(name) {
  const uname = currentUser.displayName || currentUser.email.split('@')[0];
  const ref = await addDoc(collection(db, 'lists'), {
    name: (name || 'Nouvelle liste').trim(),
    ownerId: currentUser.uid,
    ownerName: uname,
    budget: null,
    shareToken: genToken(),
    members: { [currentUser.uid]: uname },
    createdAt: serverTimestamp(),
  });
  activeListId = ref.id;
  saveActiveList();
}

async function deleteList(listId) {
  const snap = await getDocs(collection(db, 'lists', listId, 'items'));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  await deleteDoc(doc(db, 'lists', listId));
}

function saveActiveList() {
  if (currentUser) localStorage.setItem('shoplist_active_' + currentUser.uid, activeListId || '');
}

// ─── Item CRUD ────────────────────────────────────────────────
async function addItem({ name, qty, category, price }) {
  if (!activeListId) return;
  setSyncDot('syncing');
  const uname = currentUser.displayName || currentUser.email.split('@')[0];
  await addDoc(collection(db, 'lists', activeListId, 'items'), {
    name: name.trim(),
    qty: parseFloat(qty) || 1,
    category: category || 'Autre',
    price: price !== '' && price != null ? parseFloat(price) : null,
    done: false,
    addedBy: currentUser.uid,
    addedByName: uname,
    editedBy: null,
    editedByName: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

async function toggleItem(itemId) {
  const item = itemsCache.find(i => i.id === itemId);
  if (!item || !activeListId) return;
  setSyncDot('syncing');
  await updateDoc(doc(db, 'lists', activeListId, 'items', itemId), {
    done: !item.done,
    editedBy: currentUser.uid,
    editedByName: currentUser.displayName || currentUser.email.split('@')[0],
    updatedAt: serverTimestamp(),
  });
}

async function deleteItem(itemId) {
  if (!activeListId) return;
  setSyncDot('syncing');
  await deleteDoc(doc(db, 'lists', activeListId, 'items', itemId));
}

async function updateItem(itemId, data) {
  if (!activeListId) return;
  setSyncDot('syncing');
  const uname = currentUser.displayName || currentUser.email.split('@')[0];
  await updateDoc(doc(db, 'lists', activeListId, 'items', itemId), {
    name: data.name.trim(),
    qty: parseFloat(data.qty) || 1,
    category: data.category,
    price: data.price !== '' && data.price != null ? parseFloat(data.price) : null,
    editedBy: currentUser.uid,
    editedByName: uname,
    updatedAt: serverTimestamp(),
  });
}

async function setBudget(val) {
  if (!activeListId) return;
  await updateDoc(doc(db, 'lists', activeListId), {
    budget: (!isNaN(val) && val > 0) ? val : null,
  });
}

// ─── Invite link ─────────────────────────────────────────────
async function handleInviteLink(shareToken) {
  try {
    const q = query(collection(db, 'lists'), where('shareToken', '==', shareToken));
    const snap = await getDocs(q);
    if (snap.empty) { showToast('Lien invalide ou expiré'); return; }
    const listDoc = snap.docs[0];
    const uname = currentUser.displayName || currentUser.email.split('@')[0];
    if (!listDoc.data().members?.[currentUser.uid]) {
      await updateDoc(doc(db, 'lists', listDoc.id), { [`members.${currentUser.uid}`]: uname });
      showToast(`Tu as rejoint « ${listDoc.data().name} » !`);
    } else {
      showToast(`Tu fais déjà partie de « ${listDoc.data().name} »`);
    }
    activeListId = listDoc.id;
    saveActiveList();
  } catch (e) {
    showToast('Erreur : ' + e.message);
  }
}

function getInviteLink() {
  const list = listsCache[activeListId];
  if (!list) return '';
  return window.location.origin + window.location.pathname + '?join=' + list.shareToken;
}

// ─── Sync dot ─────────────────────────────────────────────────
function setSyncDot(state) {
  const el = $('syncDot');
  if (!el) return;
  el.className = 'sync-dot' + (state === 'offline' ? ' offline' : state === 'syncing' ? ' syncing' : '');
}

// ─── Render ───────────────────────────────────────────────────
function renderSidebar() {
  const container = $('listsContainer');
  container.innerHTML = '';
  const lists = Object.values(listsCache)
    .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

  if (lists.length === 0) {
    container.innerHTML = '<div style="padding:12px 16px;font-size:.82rem;color:var(--text3)">Aucune liste</div>';
    return;
  }

  lists.forEach(list => {
    const isShared = Object.keys(list.members || {}).length > 1;
    const isOwner  = list.ownerId === currentUser.uid;
    const div = document.createElement('div');
    div.className = 'list-item' + (list.id === activeListId ? ' active' : '');
    div.innerHTML = `
      <span class="list-item-icon">${isShared ? '👥' : '📋'}</span>
      <span class="list-item-name">${escHtml(list.name)}</span>
      ${isShared ? '<span class="list-shared-badge">Partagée</span>' : ''}
      <span class="list-item-count" id="count-${list.id}">—</span>
      ${isOwner ? `<button class="list-item-del" data-id="${list.id}">✕</button>` : ''}
    `;
    div.addEventListener('click', async e => {
      const delBtn = e.target.closest('.list-item-del');
      if (delBtn) {
        e.stopPropagation();
        if (Object.keys(listsCache).length === 1) { showToast('Impossible de supprimer la dernière liste'); return; }
        if (!confirm(`Supprimer « ${listsCache[delBtn.dataset.id]?.name} » ?`)) return;
        await deleteList(delBtn.dataset.id);
        return;
      }
      if (activeListId === list.id) { closeSidebar(); return; }
      activeListId = list.id;
      activeFilter = 'all';
      activeCategoryFilter = null;
      saveActiveList();
      closeSidebar();
      renderHeader();
      renderMembers();
      renderBudget();
      listenToItems();
    });
    container.appendChild(div);
  });

  const countEl = $('count-' + activeListId);
  if (countEl) countEl.textContent = itemsCache.length;
}

function renderHeader() {
  const list = listsCache[activeListId];
  $('currentListName').textContent = list ? list.name : '—';
  const isShared = list && Object.keys(list.members || {}).length > 1;
  $('collabBadge').classList.toggle('hidden', !isShared);
}

function renderMembers() {
  const list = listsCache[activeListId];
  if (!list || Object.keys(list.members || {}).length <= 1) {
    $('membersBar').classList.add('hidden');
    return;
  }
  $('membersBar').classList.remove('hidden');
  const members = Object.entries(list.members);
  $('membersAvatars').innerHTML = members.map(([uid, name]) => {
    const isMe = uid === currentUser.uid;
    return `<div class="member-avatar" title="${escHtml(name)}${isMe ? ' (moi)' : ''}"
      style="${isMe ? 'border-color:var(--accent)' : ''}">${(name||'?')[0].toUpperCase()}</div>`;
  }).join('');
  $('membersLabel').textContent = `${members.length} membre${members.length > 1 ? 's' : ''}`;
}

function renderBudget() {
  const list  = listsCache[activeListId];
  const spent = calcSpent(itemsCache);
  $('budgetSpent').textContent = fmt(spent);
  if (list?.budget) {
    $('budgetDisplay').textContent = fmt(list.budget);
    const pct  = Math.min((spent / list.budget) * 100, 100);
    const fill = $('budgetFill');
    fill.style.width = pct + '%';
    fill.className   = 'budget-fill' + (pct >= 100 ? ' over' : pct >= 75 ? ' warn' : '');
  } else {
    $('budgetDisplay').textContent = 'Aucun';
    $('budgetFill').style.width    = '0%';
    $('budgetFill').className      = 'budget-fill';
  }
}

function renderFilters() {
  const filters = $('filters');
  qsa('.filter-cat', filters).forEach(e => e.remove());
  qsa('.filter-divider', filters).forEach(e => e.remove());
  qsa('.filter-chip[data-filter]', filters).forEach(chip => {
    chip.className = 'filter-chip' + (chip.dataset.filter === activeFilter && !activeCategoryFilter ? ' active' : '');
  });
  const cats = [...new Set(itemsCache.map(i => i.category))].sort();
  if (cats.length > 1) {
    const div = document.createElement('div');
    div.className = 'filter-divider';
    filters.appendChild(div);
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-chip filter-cat' + (activeCategoryFilter === cat ? ' active' : '');
      btn.textContent = cat.split(' ')[0];
      btn.title = cat;
      btn.addEventListener('click', () => {
        activeCategoryFilter = activeCategoryFilter === cat ? null : cat;
        if (activeCategoryFilter) activeFilter = 'all';
        renderFilters(); renderStats(); renderItems();
      });
      filters.appendChild(btn);
    });
  }
}

function getFilteredItems() {
  let items = itemsCache;
  if (activeCategoryFilter) items = items.filter(i => i.category === activeCategoryFilter);
  if (activeFilter === 'todo') items = items.filter(i => !i.done);
  if (activeFilter === 'done') items = items.filter(i =>  i.done);
  return items;
}

function renderStats() {
  const total = calcTotal(itemsCache);
  const done  = itemsCache.filter(i => i.done).length;
  const all   = itemsCache.length;
  $('statsText').textContent  = `${done}/${all} article${all !== 1 ? 's' : ''}`;
  $('statsTotal').textContent = total > 0 ? fmt(total) : '—';
  const countEl = $('count-' + activeListId);
  if (countEl) countEl.textContent = all;
}

function renderItems() {
  const container = $('itemsList');
  const emptyEl   = $('emptyState');

  if (itemsCache.length === 0) {
    container.innerHTML = '';
    emptyEl.querySelector('.empty-title').textContent = 'Liste vide';
    emptyEl.querySelector('.empty-sub').textContent   = 'Ajoute ton premier article ci-dessous';
    container.appendChild(emptyEl);
    emptyEl.style.display = '';
    return;
  }

  const items = getFilteredItems();
  if (items.length === 0) {
    container.innerHTML = '';
    emptyEl.querySelector('.empty-title').textContent = 'Aucun article';
    emptyEl.querySelector('.empty-sub').textContent   = 'Aucun article ne correspond au filtre';
    container.appendChild(emptyEl);
    emptyEl.style.display = '';
    return;
  }

  emptyEl.style.display = 'none';

  const groups = {};
  items.forEach(item => {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  });

  container.innerHTML = '';
  Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).forEach(([cat, catItems]) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'category-group';
    groupEl.innerHTML = `<div class="category-label">${escHtml(cat)}</div>`;

    catItems.forEach(item => {
      const card       = document.createElement('div');
      card.className   = 'item-card' + (item.done ? ' done' : '');
      const lineTotal  = item.price != null ? fmt(item.price * item.qty) : null;
      const editorName = item.editedByName || item.addedByName || '';
      const isMe       = (item.editedBy || item.addedBy) === currentUser.uid;
      const editorLabel = (editorName && !isMe) ? `par ${escHtml(editorName)}` : '';

      card.innerHTML = `
        <div class="item-check"></div>
        <div class="item-info">
          <div class="item-name">${escHtml(item.name)}</div>
          <div class="item-meta">
            <span class="item-qty">×${item.qty % 1 === 0 ? item.qty : item.qty.toFixed(2)}</span>
            ${!activeCategoryFilter ? `<span class="item-cat-badge">${escHtml(item.category.split(' ')[0])}</span>` : ''}
            ${editorLabel ? `<span class="item-editor">${editorLabel}</span>` : ''}
          </div>
        </div>
        <span class="${lineTotal ? 'item-price' : 'item-price no-price'}">${lineTotal || '—'}</span>
        <div class="item-actions">
          <button class="item-action-btn edit" aria-label="Modifier">✏</button>
          <button class="item-action-btn del"  aria-label="Supprimer">✕</button>
        </div>
      `;

      card.addEventListener('click', e => {
        if (e.target.closest('.item-action-btn')) return;
        toggleItem(item.id);
      });
      card.querySelector('.edit').addEventListener('click', e => {
        e.stopPropagation(); openEditModal(item);
      });
      card.querySelector('.del').addEventListener('click', e => {
        e.stopPropagation();
        deleteItem(item.id);
        showToast('Article supprimé');
      });
      groupEl.appendChild(card);
    });
    container.appendChild(groupEl);
  });
}

// ─── Sidebar ─────────────────────────────────────────────────
function openSidebar()  { $('sidebar').classList.add('open');    $('sidebarOverlay').classList.add('show'); }
function closeSidebar() { $('sidebar').classList.remove('open'); $('sidebarOverlay').classList.remove('show'); }

// ─── Modals ───────────────────────────────────────────────────
function openModal(id)  { $(id).classList.add('show'); }
function closeModal(id) { $(id).classList.remove('show'); }

function openEditModal(item) {
  editingItemId = item.id;
  $('editName').value     = item.name;
  $('editQty').value      = item.qty;
  $('editPrice').value    = item.price != null ? item.price : '';
  $('editCategory').value = item.category;
  openModal('modalEdit');
  setTimeout(() => $('editName').focus(), 120);
}

// ─── Export text ─────────────────────────────────────────────
function buildShareText() {
  const list = listsCache[activeListId];
  if (!list) return '';
  let txt = `🛒 ${list.name}\n\n`;
  const groups = {};
  itemsCache.forEach(i => { (groups[i.category] = groups[i.category] || []).push(i); });
  Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).forEach(([cat, items]) => {
    txt += `${cat}\n`;
    items.forEach(i => {
      txt += `  ${i.done ? '✅' : '☐'} ${i.name} ×${i.qty}${i.price != null ? ` (${fmt(i.price * i.qty)})` : ''}\n`;
    });
    txt += '\n';
  });
  const total = calcTotal(itemsCache);
  if (total > 0) txt += `Total : ${fmt(total)}`;
  if (list.budget) txt += `  /  Budget : ${fmt(list.budget)}`;
  return txt.trim();
}

// ─── Render user info ────────────────────────────────────────
function renderUserInfo() {
  const u    = currentUser;
  const name = u.displayName || u.email.split('@')[0];
  $('userName').textContent  = name;
  $('userEmail').textContent = u.email || '';
  $('userAvatar').textContent = name[0].toUpperCase();
}

// ─── Bind all app events (called once after login) ────────────
function bindAppEvents() {
  // Sidebar
  $('menuBtn').addEventListener('click', openSidebar);
  $('closeSidebar').addEventListener('click', closeSidebar);
  $('sidebarOverlay').addEventListener('click', closeSidebar);

  // Logout
  $('btnLogout').addEventListener('click', async () => {
    if (unsubLists) unsubLists();
    if (unsubItems) unsubItems();
    listsCache = {}; itemsCache = []; activeListId = null;
    await signOut(auth);
  });

  // New list
  $('btnNewList').addEventListener('click', () => {
    closeSidebar();
    $('newListName').value = '';
    openModal('modalNewList');
    setTimeout(() => $('newListName').focus(), 150);
  });
  $('cancelNewList').addEventListener('click', () => closeModal('modalNewList'));
  $('confirmNewList').addEventListener('click', async () => {
    const name = $('newListName').value.trim();
    if (!name) return;
    closeModal('modalNewList');
    await createList(name);
    showToast('Liste créée !');
  });
  $('newListName').addEventListener('keydown', e => { if (e.key === 'Enter') $('confirmNewList').click(); });

  // Delete list
  $('btnDeleteList').addEventListener('click', async () => {
    const list = listsCache[activeListId];
    if (!list) return;
    if (list.ownerId !== currentUser.uid) { showToast('Seul le créateur peut supprimer'); return; }
    if (!confirm(`Supprimer « ${list.name} » et tous ses articles ?`)) return;
    await deleteList(activeListId);
    showToast('Liste supprimée');
  });

  // Budget
  $('btnEditBudget').addEventListener('click', () => {
    $('budgetInput').value = listsCache[activeListId]?.budget ?? '';
    openModal('modalBudget');
    setTimeout(() => $('budgetInput').focus(), 150);
  });
  $('cancelBudget').addEventListener('click', () => closeModal('modalBudget'));
  $('confirmBudget').addEventListener('click', async () => {
    const val = parseFloat($('budgetInput').value);
    await setBudget(val);
    closeModal('modalBudget');
    showToast((!isNaN(val) && val > 0) ? `Budget : ${fmt(val)}` : 'Budget supprimé');
  });
  $('budgetInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('confirmBudget').click(); });

  // Filters
  qsa('.filter-chip[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      activeCategoryFilter = null;
      renderFilters(); renderStats(); renderItems();
    });
  });

  // Add form
  $('addForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('addName').value.trim();
    if (!name) return;
    await addItem({ name, qty: $('addQty').value, category: $('addCategory').value, price: $('addPrice').value });
    $('addName').value = ''; $('addQty').value = '1'; $('addPrice').value = '';
    $('addName').focus();
  });

  // Edit item
  $('cancelEdit').addEventListener('click', () => closeModal('modalEdit'));
  $('confirmEdit').addEventListener('click', async () => {
    if (!editingItemId) return;
    await updateItem(editingItemId, {
      name: $('editName').value, qty: $('editQty').value,
      price: $('editPrice').value, category: $('editCategory').value,
    });
    closeModal('modalEdit'); editingItemId = null;
    showToast('Article modifié');
  });

  // Invite link
  $('btnInvite').addEventListener('click', () => {
    $('inviteLinkInput').value = getInviteLink();
    openModal('modalInvite');
  });
  $('cancelInvite').addEventListener('click', () => closeModal('modalInvite'));
  $('btnCopyInvite').addEventListener('click', async () => {
    await copyText($('inviteLinkInput').value);
    showToast('Lien copié !');
  });
  $('inviteWhatsapp').addEventListener('click', () => {
    window.open('https://wa.me/?text=' + encodeURIComponent(`Rejoins ma liste 🛒 : ${getInviteLink()}`), '_blank');
    closeModal('modalInvite');
  });
  $('inviteSMS').addEventListener('click', () => {
    window.location.href = 'sms:?body=' + encodeURIComponent(`Rejoins ma liste 🛒 : ${getInviteLink()}`);
    closeModal('modalInvite');
  });

  // Export
  $('btnShare').addEventListener('click', () => openModal('modalShare'));
  $('cancelShare').addEventListener('click', () => closeModal('modalShare'));
  $('shareWhatsapp').addEventListener('click', () => {
    window.open('https://wa.me/?text=' + encodeURIComponent(buildShareText()), '_blank');
    closeModal('modalShare');
  });
  $('shareSMS').addEventListener('click', () => {
    window.location.href = 'sms:?body=' + encodeURIComponent(buildShareText());
    closeModal('modalShare');
  });
  $('shareCopy').addEventListener('click', async () => {
    await copyText(buildShareText()); showToast('Liste copiée !'); closeModal('modalShare');
  });

  // Modals close on overlay / Escape
  qsa('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('show'); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') qsa('.modal-overlay.show').forEach(m => m.classList.remove('show'));
  });
}

// ─── Bind auth events (called once at DOM ready) ──────────────
function bindAuthEvents() {
  // Tab switching
  qsa('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      qsa('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      $('formLogin').classList.toggle('hidden', target !== 'login');
      $('formRegister').classList.toggle('hidden', target !== 'register');
      $('loginError').textContent = '';
      $('registerError').textContent = '';
    });
  });

  // Login
  $('btnLogin').addEventListener('click', async () => {
    const email = $('loginEmail').value.trim();
    const pass  = $('loginPassword').value;
    if (!email || !pass) { $('loginError').textContent = 'Remplis tous les champs.'; return; }
    $('btnLogin').textContent = '…';
    $('loginError').textContent = '';
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
      $('loginError').textContent = authErrMsg(e);
      $('btnLogin').textContent = 'Se connecter';
    }
  });

  // Login on Enter
  [$('loginEmail'), $('loginPassword')].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') $('btnLogin').click(); });
  });

  // Register
  $('btnRegister').addEventListener('click', async () => {
    const name  = $('regName').value.trim();
    const email = $('regEmail').value.trim();
    const pass  = $('regPassword').value;
    if (!name || !email || !pass) { $('registerError').textContent = 'Remplis tous les champs.'; return; }
    $('btnRegister').textContent = '…';
    $('registerError').textContent = '';
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
    } catch (e) {
      $('registerError').textContent = authErrMsg(e);
      $('btnRegister').textContent = 'Créer mon compte';
    }
  });
}

// ─── App setup (called once after login confirmed) ────────────
let appEventsBound = false;
function setupApp() {
  renderUserInfo();
  if (!appEventsBound) { bindAppEvents(); appEventsBound = true; }
  listenToLists();
  const pending = localStorage.getItem('shoplist_pending_join');
  if (pending) { localStorage.removeItem('shoplist_pending_join'); handleInviteLink(pending); }
}

// ─── Boot ─────────────────────────────────────────────────────
// ES modules execute after DOM is parsed — DOM elements are guaranteed to exist.
// Call boot() directly instead of waiting for DOMContentLoaded.
function boot() {
  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db   = getFirestore(app);

  const urlParams  = new URLSearchParams(window.location.search);
  const shareToken = urlParams.get('join');

  bindAuthEvents();

  onAuthStateChanged(auth, async user => {
    if (user) {
      currentUser = user;
      if (shareToken) {
        await handleInviteLink(shareToken);
        window.history.replaceState({}, '', window.location.pathname);
      }
      showScreen('app');
      setupApp();
    } else {
      currentUser = null;
      if (shareToken) localStorage.setItem('shoplist_pending_join', shareToken);
      showScreen('auth');
    }
  });


}

boot();
