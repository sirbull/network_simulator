// === STATE ===

const networkState = {
  devices: [],  // Device[]
  cables: [],   // Cable[]
  mode: 'select' // 'select' | 'cable'
};

// Counters for generating unique IDs
const _counters = { pc: 0, switch: 0, router: 0, cable: 0 };

function generateId(type) {
  _counters[type] = (_counters[type] || 0) + 1;
  return `${type}-${_counters[type]}`;
}

function getDevice(id) {
  return networkState.devices.find(d => d.id === id) || null;
}

function getCable(id) {
  return networkState.cables.find(c => c.id === id) || null;
}

function cableExists(fromId, toId) {
  return networkState.cables.some(
    c => (c.fromId === fromId && c.toId === toId) ||
         (c.fromId === toId   && c.toId === fromId)
  );
}

function getDeviceCables(deviceId) {
  return networkState.cables.filter(
    c => c.fromId === deviceId || c.toId === deviceId
  );
}

function removeDevice(id) {
  // Remove all cables touching this device first
  const toRemove = getDeviceCables(id).map(c => c.id);
  toRemove.forEach(cid => removeCable(cid));
  networkState.devices = networkState.devices.filter(d => d.id !== id);
}

function removeCable(id) {
  networkState.cables = networkState.cables.filter(c => c.id !== id);
}

function clearAll() {
  networkState.devices = [];
  networkState.cables  = [];
  networkState.mode    = 'select';
  _counters.pc = 0; _counters.switch = 0; _counters.router = 0; _counters.cable = 0;
}

// Default labels
function defaultLabel(type, id) {
  const num = id.split('-')[1];
  if (type === 'pc')     return `PC ${num}`;
  if (type === 'switch') return `Svitsj ${num}`;
  if (type === 'router') return `Ruter ${num}`;
  return id;
}
