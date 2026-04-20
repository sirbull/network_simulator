// === DRAG AND DROP + CABLE DRAWING MODE ===

let dragging    = null;  // { deviceId, offsetX, offsetY, moved }
let cableFrom   = null;  // deviceId of first endpoint
let selectedId  = null;  // currently selected device (config panel)

function attachDeviceEvents(el) {
  el.addEventListener('mousedown',  onDeviceMouseDown,  false);
  el.addEventListener('touchstart', onDeviceTouchStart, { passive: false });
  el.addEventListener('click',      onDeviceClick,      false);
  el.addEventListener('mouseenter', onDeviceMouseEnter, false);
  el.addEventListener('mouseleave', onDeviceMouseLeave, false);
}

// ---- Drag (mouse) ----

function onDeviceMouseDown(e) {
  if (e.button !== 0) return;
  e.stopPropagation();
  const deviceId  = e.currentTarget.dataset.id;
  const device    = getDevice(deviceId);
  const wrapRect  = document.getElementById('canvas-wrapper').getBoundingClientRect();

  dragging = {
    deviceId,
    offsetX: e.clientX - wrapRect.left - device.x,
    offsetY: e.clientY - wrapRect.top  - device.y,
    moved: false
  };
}

document.addEventListener('mousemove', function(e) {
  if (!dragging) return;
  const wrapRect = document.getElementById('canvas-wrapper').getBoundingClientRect();
  const dx = e.clientX - wrapRect.left - dragging.offsetX;
  const dy = e.clientY - wrapRect.top  - dragging.offsetY;

  // Mark as moved if cursor travelled more than 5px
  if (!dragging.moved) {
    const device = getDevice(dragging.deviceId);
    if (Math.abs(dx - device.x) > 5 || Math.abs(dy - device.y) > 5) {
      dragging.moved = true;
    }
  }

  const device = getDevice(dragging.deviceId);
  const wrapper = document.getElementById('canvas-wrapper');
  device.x = Math.max(36, Math.min(wrapper.clientWidth  - 36, dx));
  device.y = Math.max(36, Math.min(wrapper.clientHeight - 36, dy));
  updateDeviceElement(device);
  updateAllCables();
});

document.addEventListener('mouseup', function(e) {
  dragging = null;
});

// ---- Drag (touch) ----

function onDeviceTouchStart(e) {
  e.preventDefault();
  e.stopPropagation();
  const touch    = e.touches[0];
  const deviceId = e.currentTarget.dataset.id;
  const device   = getDevice(deviceId);
  const wrapRect = document.getElementById('canvas-wrapper').getBoundingClientRect();

  dragging = {
    deviceId,
    offsetX: touch.clientX - wrapRect.left - device.x,
    offsetY: touch.clientY - wrapRect.top  - device.y,
    moved: false
  };
}

document.addEventListener('touchmove', function(e) {
  if (!dragging) return;
  e.preventDefault();
  const touch    = e.touches[0];
  const wrapRect = document.getElementById('canvas-wrapper').getBoundingClientRect();
  const dx = touch.clientX - wrapRect.left - dragging.offsetX;
  const dy = touch.clientY - wrapRect.top  - dragging.offsetY;

  if (!dragging.moved) {
    const device = getDevice(dragging.deviceId);
    if (Math.abs(dx - device.x) > 5 || Math.abs(dy - device.y) > 5) {
      dragging.moved = true;
    }
  }

  const device  = getDevice(dragging.deviceId);
  const wrapper = document.getElementById('canvas-wrapper');
  device.x = Math.max(36, Math.min(wrapper.clientWidth  - 36, dx));
  device.y = Math.max(36, Math.min(wrapper.clientHeight - 36, dy));
  updateDeviceElement(device);
  updateAllCables();
}, { passive: false });

document.addEventListener('touchend', function() {
  dragging = null;
});

// ---- Click (select / cable) ----

function onDeviceClick(e) {
  e.stopPropagation();
  if (dragging && dragging.moved) return;  // was a drag, not a click

  const deviceId = e.currentTarget.dataset.id;

  if (networkState.mode === 'cable') {
    handleCableClick(deviceId);
  } else {
    selectDevice(deviceId);
  }
}

// ---- Cable mode ----

function handleCableClick(deviceId) {
  if (cableFrom === null) {
    cableFrom = deviceId;
    highlightCableSource(deviceId, true);
    showToast('Klikk på en annen enhet for å koble til');
    return;
  }
  if (cableFrom === deviceId) {
    highlightCableSource(deviceId, false);
    cableFrom = null;
    return;
  }
  highlightCableSource(cableFrom, false);
  addCable(cableFrom, deviceId);
  cableFrom = null;
}

function highlightCableSource(deviceId, on) {
  const el = document.getElementById('dev-' + deviceId);
  if (!el) return;
  el.classList.toggle('cable-source', on);
}

function onDeviceMouseEnter(e) {
  if (networkState.mode === 'cable' && cableFrom && cableFrom !== e.currentTarget.dataset.id) {
    e.currentTarget.classList.add('cable-mode-hover');
  }
}

function onDeviceMouseLeave(e) {
  e.currentTarget.classList.remove('cable-mode-hover');
}

// ---- Cable mode toggle ----

function setCableMode(on) {
  networkState.mode = on ? 'cable' : 'select';
  const wrapper = document.getElementById('canvas-wrapper');
  const btn     = document.getElementById('btn-cable');
  wrapper.classList.toggle('cable-mode', on);
  btn.classList.toggle('active', on);

  if (!on && cableFrom) {
    highlightCableSource(cableFrom, false);
    cableFrom = null;
  }
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (networkState.mode === 'cable') setCableMode(false);
    closeConfigPanel();
  }
});

// Click on canvas background to deselect
document.addEventListener('DOMContentLoaded', function() {
  const wrapper = document.getElementById('canvas-wrapper');
  if (wrapper) {
    wrapper.addEventListener('click', function(e) {
      if (e.target === wrapper || e.target === document.getElementById('canvas')) {
        if (networkState.mode === 'cable') {
          if (cableFrom) { highlightCableSource(cableFrom, false); cableFrom = null; }
        } else {
          deselectAll();
        }
      }
    });
  }
});

// ---- Selection ----

function selectDevice(deviceId) {
  deselectAll();
  selectedId = deviceId;
  const el = document.getElementById('dev-' + deviceId);
  if (el) el.classList.add('selected');
  openConfigPanel(deviceId);
}

function deselectAll() {
  if (selectedId) {
    const el = document.getElementById('dev-' + selectedId);
    if (el) el.classList.remove('selected');
    selectedId = null;
  }
}

function deleteSelectedDevice() {
  if (!selectedId) return;
  const id = selectedId;
  deselectAll();
  closeConfigPanel();
  getDeviceCables(id).forEach(c => removeCableElement(c.id));
  removeDevice(id);
  removeDeviceElement(id);
  scheduleValidation();
}
