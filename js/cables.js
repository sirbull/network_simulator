// === CABLE RENDERING ===

function getDeviceCenter(deviceId) {
  const el = document.getElementById('dev-' + deviceId);
  if (!el) return { x: 0, y: 0 };
  const wrapper = document.getElementById('canvas-wrapper');
  const elRect  = el.getBoundingClientRect();
  const wrRect  = wrapper.getBoundingClientRect();
  return {
    x: elRect.left - wrRect.left + elRect.width  / 2,
    y: elRect.top  - wrRect.top  + elRect.height / 2
  };
}

function renderCable(cable) {
  const svg  = document.getElementById('cable-svg');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.classList.add('cable-line');
  line.dataset.cableId = cable.id;
  line.addEventListener('click', onCableClick);

  const a = getDeviceCenter(cable.fromId);
  const b = getDeviceCenter(cable.toId);
  line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
  line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);

  svg.appendChild(line);
  return line;
}

function updateCableElement(cable) {
  const line = document.querySelector(`line[data-cable-id="${cable.id}"]`);
  if (!line) return;
  const a = getDeviceCenter(cable.fromId);
  const b = getDeviceCenter(cable.toId);
  line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
  line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
}

function updateAllCables() {
  networkState.cables.forEach(updateCableElement);
}

function removeCableElement(id) {
  const line = document.querySelector(`line[data-cable-id="${id}"]`);
  if (line) line.remove();
}

function addCable(fromId, toId) {
  if (cableExists(fromId, toId)) {
    showToast('Kabel finnes allerede mellom disse enhetene');
    return null;
  }
  const cable = { id: generateId('cable'), fromId, toId };
  networkState.cables.push(cable);
  renderCable(cable);
  scheduleValidation();
  return cable;
}

function onCableClick(e) {
  if (networkState.mode === 'cable') return;
  const id = e.currentTarget.dataset.cableId;
  if (confirm('Vil du slette denne kabelen?')) {
    removeCableElement(id);
    removeCable(id);
    scheduleValidation();
  }
}
