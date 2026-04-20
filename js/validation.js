// === ASSIGNMENT VALIDATION + EXPORT ===

const TARGET_A    = '192.168.10.0';
const TARGET_B    = '192.168.10.128';
const TARGET_MASK = '255.255.255.128';  // /25

// Debounce handle
let _validationTimer = null;

function scheduleValidation() {
  clearTimeout(_validationTimer);
  _validationTimer = setTimeout(updateValidationUI, 300);
}

function validateAssignment() {
  const checks = {
    twoCorrectSubnets:  false,
    eachSubnetHasTwoPCs: false,
    connectedViaRouter: false,
    allPCsCanPing:      false
  };

  const pcs = networkState.devices.filter(d => d.type === 'pc');
  const configuredPCs = pcs.filter(pc => isValidIp(pc.ip) && isValidMask(pc.mask));

  // CHECK 1: All configured PCs are in exactly the two target subnets (and no others)
  if (configuredPCs.length >= 2) {
    const nets = configuredPCs.map(pc => getNetworkAddress(pc.ip, TARGET_MASK));
    const uniqueNets = new Set(nets);
    checks.twoCorrectSubnets =
      uniqueNets.size === 2 &&
      uniqueNets.has(TARGET_A) &&
      uniqueNets.has(TARGET_B);
  }

  // CHECK 2: Each target subnet has ≥2 PCs, all connected via a switch
  if (checks.twoCorrectSubnets) {
    const pcsA = configuredPCs.filter(pc => getNetworkAddress(pc.ip, TARGET_MASK) === TARGET_A);
    const pcsB = configuredPCs.filter(pc => getNetworkAddress(pc.ip, TARGET_MASK) === TARGET_B);
    checks.eachSubnetHasTwoPCs =
      pcsA.length >= 2 && pcsA.every(pc => connectedViaSwitch(pc)) &&
      pcsB.length >= 2 && pcsB.every(pc => connectedViaSwitch(pc));
  }

  // CHECK 3: A router has an interface on each target subnet
  if (checks.twoCorrectSubnets) {
    const routers = networkState.devices.filter(d => d.type === 'router');
    checks.connectedViaRouter = routers.some(r => {
      const onA = r.interfaces.some(i =>
        isValidIp(i.ip) && isValidMask(i.mask) &&
        getNetworkAddress(i.ip, i.mask) === TARGET_A);
      const onB = r.interfaces.some(i =>
        isValidIp(i.ip) && isValidMask(i.mask) &&
        getNetworkAddress(i.ip, i.mask) === TARGET_B);
      return onA && onB;
    });
  }

  // CHECK 4: All PCs can ping each other
  if (checks.connectedViaRouter) {
    const pingResults = runPing();
    checks.allPCsCanPing = pingResults.length > 0 && pingResults.every(r => r.ok);
  }

  return {
    passed: Object.values(checks).every(Boolean),
    checks
  };
}

// Does a PC have at least one switch in its L2 neighborhood?
function connectedViaSwitch(pc) {
  const neighbors = networkState.cables
    .filter(c => c.fromId === pc.id || c.toId === pc.id)
    .map(c => c.fromId === pc.id ? c.toId : c.fromId);
  return neighbors.some(id => {
    const d = getDevice(id);
    return d && d.type === 'switch';
  });
}

// ---- Update checklist UI ----

function updateValidationUI() {
  const result = validateAssignment();
  const panel  = document.getElementById('validation-status');
  if (!panel) return;

  const items = [
    {
      key:  'twoCorrectSubnets',
      text: 'Subnettene 192.168.10.0/25 og 192.168.10.128/25 finnes'
    },
    {
      key:  'eachSubnetHasTwoPCs',
      text: 'Hvert subnett har minst 2 PCer koblet via en svitsj'
    },
    {
      key:  'connectedViaRouter',
      text: 'Subnettene er koblet til en ruter med riktige grensesnitt'
    },
    {
      key:  'allPCsCanPing',
      text: 'Alle PCer kan pinge hverandre'
    }
  ];

  const rows = items.map(item => {
    const pass = result.checks[item.key];
    return `<div class="check-item">
      <span class="check-icon ${pass ? 'pass' : 'fail'}">${pass ? '✓' : '✗'}</span>
      <span>${item.text}</span>
    </div>`;
  }).join('');

  panel.innerHTML = `<h3>Krav til oppgaven</h3>${rows}`;

  const btn = document.getElementById('submit-btn');
  if (btn) btn.disabled = !result.passed;
}

// ---- JSON export ----

function submitAssignment() {
  const nameInput = document.getElementById('student-name');
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    nameInput && nameInput.focus();
    showToast('Du må skrive inn navnet ditt før du leverer');
    return;
  }

  const validation = validateAssignment();
  const payload = {
    student:   name,
    timestamp: new Date().toISOString(),
    topology: {
      devices: networkState.devices,
      cables:  networkState.cables
    },
    validation
  };

  const btn = document.getElementById('submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sender…'; }

  fetch('submit.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  })
  .then(r => r.json())
  .then(res => {
    if (res.ok) {
      showToast('✅ Besvarelse levert! Læreren din kan nå se resultatet ditt.');
      if (btn) { btn.textContent = '✅ Levert!'; }
    } else {
      // Innlevering stengt eller annen feil – gi tydelig melding
      showToast('⚠️ ' + (res.error || 'Kunne ikke levere. Prøv igjen.'), 6000);
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined">upload_file</span> Lever besvarelse'; }
    }
  })
  .catch(() => {
    showToast('❌ Kunne ikke nå serveren. Sjekk at du er på nett.', 5000);
    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined">upload_file</span> Lever besvarelse'; }
  });
}
