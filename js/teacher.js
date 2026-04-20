// === TEACHER PAGE ===
// Activated when URL contains ?laerer=1

function initTeacherPage() {
  document.getElementById('tab-bar')    && (document.getElementById('tab-bar').style.display    = 'none');
  document.getElementById('app-header') && (document.getElementById('app-header').style.display = 'none');
  document.querySelectorAll('.tab-content').forEach(el => (el.style.display = 'none'));
  const tp = document.getElementById('teacher-page');
  if (tp) tp.style.display = 'block';

  const uploadInput = document.getElementById('teacher-upload');
  if (uploadInput) {
    uploadInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        try {
          const data = JSON.parse(ev.target.result);
          renderTeacherView(data);
        } catch (err) {
          document.getElementById('teacher-results').style.display = 'block';
          document.getElementById('teacher-results').innerHTML =
            `<div style="color:var(--danger);padding:16px">
              Feil: Kunne ikke lese filen. Er det en gyldig JSON-besvarelse?<br>
              <small>${escHtml(String(err))}</small>
            </div>`;
        }
      };
      reader.readAsText(file);
    });
  }
}

function renderTeacherView(data) {
  const resultsEl = document.getElementById('teacher-results');
  resultsEl.style.display = 'block';

  if (!data || !data.topology) {
    resultsEl.innerHTML = '<div style="color:var(--danger);padding:16px">Ugyldig format på innlevert fil.</div>';
    return;
  }

  const { student, timestamp, topology, validation } = data;
  const passed   = validation && validation.passed;
  const checks   = (validation && validation.checks) || {};
  const dateStr  = timestamp ? formatNorwegianDateTime(timestamp) : '(ukjent tid)';

  // Verdict banner
  const verdictHtml = `
    <div class="verdict-banner ${passed ? 'verdict-pass' : 'verdict-fail'}">
      ${passed ? '✅ BESTÅTT' : '❌ IKKE BESTÅTT'}
    </div>`;

  // Meta info
  const metaHtml = `
    <div class="teacher-section">
      <h2>Informasjon</h2>
      <table class="teacher-meta-table">
        <tr><td>Elev</td><td>${escHtml(student || '(ukjent)')}</td></tr>
        <tr><td>Innlevert</td><td>${escHtml(dateStr)}</td></tr>
        <tr><td>Antall enheter</td><td>${(topology.devices || []).length}</td></tr>
        <tr><td>Antall kabler</td><td>${(topology.cables  || []).length}</td></tr>
      </table>
    </div>`;

  // Validation checklist
  const checkItems = [
    { key: 'twoCorrectSubnets',   text: 'Subnettene 192.168.10.0/25 og 192.168.10.128/25 finnes' },
    { key: 'eachSubnetHasTwoPCs', text: 'Hvert subnett har minst 2 PCer via svitsj' },
    { key: 'connectedViaRouter',  text: 'Subnettene er koblet via en ruter' },
    { key: 'allPCsCanPing',       text: 'Alle PCer kan pinge hverandre' }
  ];
  const checkRows = checkItems.map(item => {
    const pass = checks[item.key];
    return `<div class="check-item">
      <span class="check-icon ${pass ? 'pass' : 'fail'}">${pass ? '✓' : '✗'}</span>
      <span>${item.text}</span>
    </div>`;
  }).join('');

  const validationHtml = `
    <div class="teacher-section">
      <h2>Validering</h2>
      ${checkRows}
    </div>`;

  // IP config table
  const devices  = topology.devices || [];
  const ipRows   = devices.map(dev => {
    const ifaceStr = (dev.interfaces || [])
      .filter(i => i.ip)
      .map(i => `${escHtml(i.name)}: ${escHtml(i.ip)}/${escHtml(i.mask)}`)
      .join('<br>') || '—';
    const typeLabel = { pc: 'PC', switch: 'Svitsj', router: 'Ruter' }[dev.type] || dev.type;
    return `<tr>
      <td>${escHtml(dev.label)}</td>
      <td>${typeLabel}</td>
      <td>${escHtml(dev.ip   || '—')}</td>
      <td>${escHtml(dev.mask || '—')}</td>
      <td>${escHtml(dev.gateway || '—')}</td>
      <td>${ifaceStr}</td>
    </tr>`;
  }).join('');

  const ipTableHtml = `
    <div class="teacher-section">
      <h2>IP-konfigurasjon</h2>
      <table class="ip-config-table">
        <thead><tr>
          <th>Enhet</th><th>Type</th><th>IP</th><th>Nettmaske</th><th>Gateway</th><th>Grensesnitt</th>
        </tr></thead>
        <tbody>${ipRows}</tbody>
      </table>
    </div>`;

  // Network topology diagram
  const topoHtml = `
    <div class="teacher-section">
      <h2>Nettverkstopologi</h2>
      <div id="teacher-topology-wrapper">
        <div id="teacher-canvas"></div>
        <svg id="teacher-svg"></svg>
      </div>
    </div>`;

  resultsEl.innerHTML = verdictHtml + metaHtml + validationHtml + ipTableHtml + topoHtml;

  // Render read-only diagram after DOM insert
  renderTeacherTopology(topology);
}

function renderTeacherTopology(topology) {
  const canvas = document.getElementById('teacher-canvas');
  const svg    = document.getElementById('teacher-svg');
  if (!canvas || !svg) return;

  const devices = topology.devices || [];
  const cables  = topology.cables  || [];

  // Scale positions to fit 600px wide, maintain aspect ratio
  const wrapper = document.getElementById('teacher-topology-wrapper');
  const W = wrapper.clientWidth  || 600;
  const H = wrapper.clientHeight || 420;

  if (devices.length > 0) {
    const maxX = Math.max(...devices.map(d => d.x), 1);
    const maxY = Math.max(...devices.map(d => d.y), 1);
    const scaleX = Math.min(1, (W - 80) / maxX);
    const scaleY = Math.min(1, (H - 80) / maxY);
    const scale  = Math.min(scaleX, scaleY);

    devices.forEach(device => {
      const el = document.createElement('div');
      el.className = 'device device-' + device.type;
      el.id = 'teacher-dev-' + device.id;
      el.style.left         = (device.x * scale + 40) + 'px';
      el.style.top          = (device.y * scale + 40) + 'px';
      el.style.pointerEvents = 'none';
      el.style.cursor        = 'default';

      const ifaceStr = (device.interfaces || [])
        .filter(i => i.ip)
        .map(i => `${i.name}: ${i.ip}`)
        .join(', ');

      el.innerHTML =
        ICONS[device.type] +
        `<span class="device-label">${escHtml(device.label)}</span>` +
        `<span class="device-ip-label">${escHtml(device.ip || ifaceStr || '')}</span>`;

      canvas.appendChild(el);
    });

    // Draw cables after devices are in DOM (need bounding rects)
    requestAnimationFrame(() => {
      cables.forEach(cable => {
        const fromEl = document.getElementById('teacher-dev-' + cable.fromId);
        const toEl   = document.getElementById('teacher-dev-' + cable.toId);
        if (!fromEl || !toEl) return;

        const wrapRect = wrapper.getBoundingClientRect();
        const fRect    = fromEl.getBoundingClientRect();
        const tRect    = toEl.getBoundingClientRect();

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('cable-line');
        line.setAttribute('x1', fRect.left - wrapRect.left + fRect.width  / 2);
        line.setAttribute('y1', fRect.top  - wrapRect.top  + fRect.height / 2);
        line.setAttribute('x2', tRect.left - wrapRect.left + tRect.width  / 2);
        line.setAttribute('y2', tRect.top  - wrapRect.top  + tRect.height / 2);
        svg.appendChild(line);
      });
    });
  } else {
    canvas.innerHTML = '<p style="padding:20px;color:var(--text-muted)">Ingen enheter i topologien.</p>';
  }
}

function formatNorwegianDateTime(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('nb-NO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return isoString; }
}
