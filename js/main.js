// === TAB NAVIGATION ===

function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  const content = document.getElementById('tab-' + name);
  const btn     = document.querySelector(`.tab-btn[data-tab="${name}"]`);
  if (content) content.classList.add('active');
  if (btn)     btn.classList.add('active');

  // Refresh validation checklist when switching to Lever-tab
  if (name === 'lever') updateValidationUI();
}

// === TOOLBAR WIRING ===

function initToolbar() {
  document.getElementById('btn-add-pc')?.addEventListener('click',     () => addDevice('pc'));
  document.getElementById('btn-add-switch')?.addEventListener('click', () => addDevice('switch'));
  document.getElementById('btn-add-router')?.addEventListener('click', () => addDevice('router'));

  document.getElementById('btn-cable')?.addEventListener('click', function() {
    setCableMode(networkState.mode !== 'cable');
  });

  document.getElementById('btn-delete')?.addEventListener('click', deleteSelectedDevice);

  document.getElementById('btn-ping')?.addEventListener('click', function() {
    const results = runPing();
    renderPingResults(results);
  });

  document.getElementById('btn-clear')?.addEventListener('click', function() {
    if (!confirm('Vil du slette alle enheter og kabler?')) return;
    networkState.devices.forEach(d => removeDeviceElement(d.id));
    document.querySelectorAll('.cable-line').forEach(l => l.remove());
    clearAll();
    document.getElementById('ping-results').style.display = 'none';
    closeConfigPanel();
    deselectAll();
    updateValidationUI();
  });
}

// === TOAST ===

let _toastTimer = null;

function showToast(msg, duration) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), duration || 3000);
}

// === INIT ===

document.addEventListener('DOMContentLoaded', function() {
  const isTeacher = new URLSearchParams(location.search).get('laerer') === '1';

  if (isTeacher) {
    initTeacherPage();
    return;
  }

  // Start on Lær tab
  showTab('laer');
  initToolbar();
  updateValidationUI();
});
