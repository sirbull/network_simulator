// === DEVICE ICONS ===

const ICONS = {
  pc: `<svg class="device-icon" viewBox="0 0 44 44" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="36" height="26" rx="3" fill="#e3f2fd" stroke="#1976d2" stroke-width="2"/>
    <rect x="8" y="8" width="28" height="18" rx="1" fill="#bbdefb"/>
    <rect x="17" y="30" width="10" height="5" fill="#90a4ae"/>
    <rect x="13" y="35" width="18" height="3" rx="1" fill="#78909c"/>
  </svg>`,

  switch: `<svg class="device-icon" viewBox="0 0 44 44" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="14" width="38" height="16" rx="3" fill="#f3e5f5" stroke="#7b1fa2" stroke-width="2"/>
    <circle cx="10" cy="22" r="3" fill="#7b1fa2"/>
    <circle cx="18" cy="22" r="3" fill="#7b1fa2"/>
    <circle cx="26" cy="22" r="3" fill="#7b1fa2"/>
    <circle cx="34" cy="22" r="3" fill="#7b1fa2"/>
    <line x1="10" y1="19" x2="10" y2="14" stroke="#7b1fa2" stroke-width="1.5"/>
    <line x1="18" y1="19" x2="18" y2="14" stroke="#7b1fa2" stroke-width="1.5"/>
    <line x1="26" y1="19" x2="26" y2="14" stroke="#7b1fa2" stroke-width="1.5"/>
    <line x1="34" y1="19" x2="34" y2="14" stroke="#7b1fa2" stroke-width="1.5"/>
  </svg>`,

  router: `<svg class="device-icon" viewBox="0 0 44 44" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22" cy="22" r="18" fill="#e8f5e9" stroke="#2e7d32" stroke-width="2"/>
    <circle cx="22" cy="22" r="5" fill="#2e7d32"/>
    <line x1="22" y1="4"  x2="22" y2="17" stroke="#2e7d32" stroke-width="2"/>
    <line x1="22" y1="27" x2="22" y2="40" stroke="#2e7d32" stroke-width="2"/>
    <line x1="4"  y1="22" x2="17" y2="22" stroke="#2e7d32" stroke-width="2"/>
    <line x1="27" y1="22" x2="40" y2="22" stroke="#2e7d32" stroke-width="2"/>
    <polygon points="22,4 19,10 25,10" fill="#2e7d32"/>
    <polygon points="40,22 34,19 34,25" fill="#2e7d32"/>
  </svg>`
};

// === DEVICE RENDERING ===

function renderDevice(device) {
  const el = document.createElement('div');
  el.className = 'device device-' + device.type;
  el.id = 'dev-' + device.id;
  el.dataset.id = device.id;
  el.style.left = device.x + 'px';
  el.style.top  = device.y + 'px';

  el.innerHTML = ICONS[device.type] +
    `<span class="device-label">${escHtml(device.label)}</span>` +
    `<span class="device-ip-label">${escHtml(device.ip || '')}</span>`;

  attachDeviceEvents(el);
  document.getElementById('canvas').appendChild(el);
  return el;
}

function updateDeviceElement(device) {
  const el = document.getElementById('dev-' + device.id);
  if (!el) return;
  el.querySelector('.device-label').textContent = device.label;
  el.querySelector('.device-ip-label').textContent = device.ip || '';
  el.style.left = device.x + 'px';
  el.style.top  = device.y + 'px';
}

function removeDeviceElement(id) {
  const el = document.getElementById('dev-' + id);
  if (el) el.remove();
}

function addDevice(type) {
  const id = generateId(type);
  const canvas = document.getElementById('canvas');
  const rect   = canvas.getBoundingClientRect();
  const device = {
    id,
    type,
    x: 120 + Math.random() * Math.max(200, rect.width  - 240),
    y:  80 + Math.random() * Math.max(100, rect.height - 160),
    label: defaultLabel(type, id),
    ip: '', mask: '', gateway: '',
    interfaces: type === 'router'
      ? [{ name: 'fa0/0', ip: '', mask: '' }, { name: 'fa0/1', ip: '', mask: '' }]
      : []
  };
  networkState.devices.push(device);
  renderDevice(device);
  scheduleValidation();
  return device;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
