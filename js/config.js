// === CONFIG PANEL ===

function openConfigPanel(deviceId) {
  const device = getDevice(deviceId);
  if (!device) return;

  const panel = document.getElementById('config-panel');
  panel.style.display = 'block';
  panel.dataset.deviceId = deviceId;
  renderConfigPanel(device);
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeConfigPanel() {
  const panel = document.getElementById('config-panel');
  panel.style.display = 'none';
  panel.dataset.deviceId = '';
}

function renderConfigPanel(device) {
  const panel = document.getElementById('config-panel');

  if (device.type === 'router') {
    panel.innerHTML = buildRouterConfig(device);
    attachRouterConfigEvents(device);
  } else {
    panel.innerHTML = buildHostConfig(device);
    attachHostConfigEvents(device);
  }
}

// ---- PC / Switch config ----

function buildHostConfig(device) {
  const showGateway = device.type === 'pc';
  return `
    <h3><span class="material-symbols-outlined">${device.type === 'pc' ? 'computer' : 'device_hub'}</span> ${escHtml(device.label)}</h3>
    <div class="config-row">
      <label>Enhetsnavn</label>
      <input type="text" id="cfg-label" value="${escHtml(device.label)}" maxlength="30">
    </div>
    <div class="config-row">
      <label>IP-adresse</label>
      <input type="text" id="cfg-ip" value="${escHtml(device.ip)}" placeholder="f.eks. 192.168.10.10" spellcheck="false">
      <span class="field-hint" id="hint-ip"></span>
    </div>
    <div class="config-row">
      <label>Nettmaske</label>
      <input type="text" id="cfg-mask" value="${escHtml(device.mask)}" placeholder="f.eks. 255.255.255.128" spellcheck="false">
      <span class="field-hint" id="hint-mask"></span>
    </div>
    ${showGateway ? `
    <div class="config-row">
      <label>Standard gateway</label>
      <input type="text" id="cfg-gw" value="${escHtml(device.gateway)}" placeholder="f.eks. 192.168.10.1" spellcheck="false">
      <span class="field-hint" id="hint-gw"></span>
    </div>` : ''}
    <div class="config-actions">
      <button class="btn-primary" onclick="applyHostConfig()">Lagre</button>
      <button class="btn-secondary" onclick="closeConfigPanel()">Lukk</button>
      <button class="btn-danger" onclick="deleteSelectedDevice()">Slett enhet</button>
    </div>`;
}

function attachHostConfigEvents(device) {
  const ipInput   = document.getElementById('cfg-ip');
  const maskInput = document.getElementById('cfg-mask');
  const gwInput   = document.getElementById('cfg-gw');

  function validate() {
    validateField(ipInput,   document.getElementById('hint-ip'),
      v => v === '' || isValidIp(v)   ? '' : 'Ugyldig IP-adresse');
    validateField(maskInput, document.getElementById('hint-mask'),
      v => v === '' || isValidMask(v) ? '' : 'Ugyldig nettmaske');
    if (gwInput) validateField(gwInput, document.getElementById('hint-gw'),
      v => v === '' || isValidIp(v)   ? '' : 'Ugyldig gateway-adresse');

    // Duplicate IP warning
    if (ipInput && isValidIp(ipInput.value)) {
      const conflict = networkState.devices.find(
        d => d.id !== device.id && d.ip === ipInput.value
      );
      if (conflict) {
        setFieldInvalid(ipInput, document.getElementById('hint-ip'),
          `IP-konflikt med ${conflict.label}`);
      }
    }
  }

  [ipInput, maskInput, gwInput].filter(Boolean).forEach(el => {
    el.addEventListener('input', validate);
  });
}

function applyHostConfig() {
  const panel    = document.getElementById('config-panel');
  const deviceId = panel.dataset.deviceId;
  const device   = getDevice(deviceId);
  if (!device) return;

  const label  = document.getElementById('cfg-label');
  const ipEl   = document.getElementById('cfg-ip');
  const maskEl = document.getElementById('cfg-mask');
  const gwEl   = document.getElementById('cfg-gw');

  if (label)  device.label   = label.value.trim() || device.label;
  if (ipEl)   device.ip      = ipEl.value.trim();
  if (maskEl) device.mask    = maskEl.value.trim();
  if (gwEl)   device.gateway = gwEl.value.trim();

  updateDeviceElement(device);
  scheduleValidation();
  showToast('Konfigurasjon lagret');
}

// ---- Router config ----

function buildRouterConfig(device) {
  const ifaceRows = device.interfaces.map((iface, i) => `
    <div class="interface-row" data-iface-index="${i}">
      <span class="iface-name">${escHtml(iface.name)}</span>
      <input type="text" class="iface-ip"   value="${escHtml(iface.ip)}"   placeholder="IP" spellcheck="false">
      <input type="text" class="iface-mask" value="${escHtml(iface.mask)}" placeholder="Maske" spellcheck="false">
      <button class="btn-remove-iface" onclick="removeRouterInterface(${i})" title="Fjern">✕</button>
    </div>`).join('');

  return `
    <h3><span class="material-symbols-outlined">router</span> ${escHtml(device.label)}</h3>
    <div class="config-row">
      <label>Enhetsnavn</label>
      <input type="text" id="cfg-label" value="${escHtml(device.label)}" maxlength="30">
    </div>
    <div class="config-row">
      <label>Grensesnitt (interfaces)</label>
      <div id="iface-list">${ifaceRows}</div>
      <button class="btn-secondary" style="margin-top:6px;font-size:0.82rem" onclick="addRouterInterface()">+ Legg til grensesnitt</button>
    </div>
    <div class="config-actions">
      <button class="btn-primary" onclick="applyRouterConfig()">Lagre</button>
      <button class="btn-secondary" onclick="closeConfigPanel()">Lukk</button>
      <button class="btn-danger" onclick="deleteSelectedDevice()">Slett enhet</button>
    </div>`;
}

function attachRouterConfigEvents(device) {
  attachRouterInputValidation();
}

function attachRouterInputValidation() {
  document.querySelectorAll('#iface-list .iface-ip, #iface-list .iface-mask').forEach(el => {
    el.addEventListener('input', function() {
      const isIp = el.classList.contains('iface-ip');
      const ok   = el.value === '' || (isIp ? isValidIp(el.value) : isValidMask(el.value));
      el.classList.toggle('invalid', !ok);
    });
  });
}

function addRouterInterface() {
  const panel    = document.getElementById('config-panel');
  const deviceId = panel.dataset.deviceId;
  const device   = getDevice(deviceId);
  if (!device) return;
  const idx  = device.interfaces.length;
  const name = `fa0/${idx}`;
  device.interfaces.push({ name, ip: '', mask: '' });
  renderConfigPanel(device);
}

function removeRouterInterface(index) {
  const panel    = document.getElementById('config-panel');
  const deviceId = panel.dataset.deviceId;
  const device   = getDevice(deviceId);
  if (!device || device.interfaces.length <= 1) return;
  device.interfaces.splice(index, 1);
  renderConfigPanel(device);
  scheduleValidation();
}

function applyRouterConfig() {
  const panel    = document.getElementById('config-panel');
  const deviceId = panel.dataset.deviceId;
  const device   = getDevice(deviceId);
  if (!device) return;

  const label = document.getElementById('cfg-label');
  if (label) device.label = label.value.trim() || device.label;

  document.querySelectorAll('#iface-list .interface-row').forEach(row => {
    const i     = parseInt(row.dataset.ifaceIndex, 10);
    const ipEl  = row.querySelector('.iface-ip');
    const maskEl= row.querySelector('.iface-mask');
    if (device.interfaces[i]) {
      device.interfaces[i].ip   = ipEl   ? ipEl.value.trim()   : '';
      device.interfaces[i].mask = maskEl ? maskEl.value.trim() : '';
    }
  });

  updateDeviceElement(device);
  scheduleValidation();
  showToast('Ruterkonfigurasjon lagret');
}

// ---- Helpers ----

function validateField(input, hintEl, validator) {
  if (!input) return;
  const msg = validator(input.value.trim());
  if (hintEl) {
    hintEl.textContent = msg;
    hintEl.classList.toggle('visible', !!msg);
  }
  input.classList.toggle('invalid', !!msg && input.value.trim() !== '');
  input.classList.toggle('valid',   !msg  && input.value.trim() !== '');
}

function setFieldInvalid(input, hintEl, msg) {
  if (input)  input.classList.add('invalid');
  if (hintEl) { hintEl.textContent = msg; hintEl.classList.add('visible'); }
}
