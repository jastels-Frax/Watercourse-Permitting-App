/* app.js — Crossing Assessor
   Part 1 scaffold: settings drawer, toast, screen routing stubs.
   All data stays in localStorage — no server calls.
*/

'use strict';

// ── Constants ──────────────────────────────────────────────────────────────────
const STORAGE_KEY  = 'ca_records';
const SETTINGS_KEY = 'ca_settings';

// ── State ──────────────────────────────────────────────────────────────────────
let settings = { assessor: '' };

// ── DOM refs ───────────────────────────────────────────────────────────────────
const screenHome   = document.getElementById('screen-home');
const screenForm   = document.getElementById('screen-form');
const headerTitle  = document.getElementById('header-title');
const btnBack      = document.getElementById('btn-back');
const btnMenu      = document.getElementById('btn-menu');
const drawerOverlay = document.getElementById('drawer-overlay');
const settingsDrawer = document.getElementById('settings-drawer');
const btnDrawerClose = document.getElementById('btn-drawer-close');
const sAssessor    = document.getElementById('s-assessor');
const btnSaveSettings = document.getElementById('btn-save-settings');
const modalUnsaved = document.getElementById('modal-unsaved');
const btnModalDraft   = document.getElementById('btn-modal-draft');
const btnModalDiscard = document.getElementById('btn-modal-discard');
const btnModalCancel  = document.getElementById('btn-modal-cancel');

// ── Boot ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  showHome();
});

// ── Screen navigation ──────────────────────────────────────────────────────────
function showHome() {
  screenHome.removeAttribute('hidden');
  screenForm.setAttribute('hidden', '');
  btnBack.setAttribute('hidden', '');
  headerTitle.textContent = '';
  renderHome();
}

function showForm(record) {
  screenHome.setAttribute('hidden', '');
  screenForm.removeAttribute('hidden');
  btnBack.removeAttribute('hidden');
  headerTitle.textContent = record ? `Editing: ${record.crossingId}` : 'New Record';
}

btnBack.addEventListener('click', () => showHome());

// ── Settings drawer ────────────────────────────────────────────────────────────
function openDrawer() {
  sAssessor.value = settings.assessor;
  settingsDrawer.classList.add('open');
  drawerOverlay.classList.add('open');
  settingsDrawer.removeAttribute('aria-hidden');
  drawerOverlay.removeAttribute('aria-hidden');
  sAssessor.focus();
}

function closeDrawer() {
  settingsDrawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
  settingsDrawer.setAttribute('aria-hidden', 'true');
  drawerOverlay.setAttribute('aria-hidden', 'true');
}

btnMenu.addEventListener('click', openDrawer);
btnDrawerClose.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

btnSaveSettings.addEventListener('click', () => {
  settings.assessor = sAssessor.value.trim();
  saveSettings();
  closeDrawer();
  toast('Settings saved', 'success');
});

// ── Settings persistence ────────────────────────────────────────────────────────
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) settings = { ...settings, ...JSON.parse(raw) };
  } catch { /* keep defaults */ }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ── Unsaved-changes modal ──────────────────────────────────────────────────────
function openUnsavedModal(onSave, onDiscard) {
  modalUnsaved.removeAttribute('hidden');
  const cleanup = () => { modalUnsaved.setAttribute('hidden', ''); };
  btnModalDraft.onclick   = () => { cleanup(); onSave?.(); };
  btnModalDiscard.onclick = () => { cleanup(); onDiscard?.(); };
  btnModalCancel.onclick  = () => cleanup();
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className   = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 2900);
}

// ── Home screen renderer (stub — populated in later parts) ─────────────────────
function renderHome() {
  screenHome.innerHTML = `
    <div class="home-hero">
      <img src="./assets/LOGO w TEXT black bg.jpg" class="hero-logo"
           alt="Fraxinus Environmental &amp; Geomatics" />
      <p class="hero-tagline">Crossing Assessor — L8006 Field Survey</p>
      <button class="btn btn-primary btn-lg" id="btn-new-record">+ New Record</button>
    </div>
    <div class="list-header">
      <span class="list-count" id="list-count">0 records</span>
      <div class="list-export" id="list-export" style="display:none">
        <button class="btn btn-ghost btn-sm" id="btn-export-csv">↓ CSV</button>
        <button class="btn btn-ghost btn-sm" id="btn-export-geojson">↓ GeoJSON</button>
      </div>
    </div>
    <div class="record-list" id="record-list">
      <p class="no-records">
        No records saved yet.<br>
        Tap <strong>+ New Record</strong> to begin.
      </p>
    </div>
  `;
  document.getElementById('btn-new-record').addEventListener('click', () => showForm(null));
}

// ── Keyboard: Escape closes drawer / modal ─────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!modalUnsaved.hasAttribute('hidden')) { modalUnsaved.setAttribute('hidden', ''); return; }
  if (settingsDrawer.classList.contains('open')) closeDrawer();
});
