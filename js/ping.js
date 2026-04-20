// === PING SIMULATION ===
// BFS helpers and per-pair connectivity checks.

// BFS through the cable graph.
// If allowRouters=false, stops at router boundaries (L2 only).
function bfsReachable(startId, allowRouters) {
  const visited = new Set([startId]);
  const queue   = [startId];
  while (queue.length) {
    const cur = queue.shift();
    const neighbors = networkState.cables
      .filter(c => c.fromId === cur || c.toId === cur)
      .map(c => c.fromId === cur ? c.toId : c.fromId);
    for (const nbId of neighbors) {
      if (visited.has(nbId)) continue;
      const nb = getDevice(nbId);
      if (!nb) continue;
      if (!allowRouters && nb.type === 'router') continue;
      visited.add(nbId);
      queue.push(nbId);
    }
  }
  return visited;
}

// Check if two devices are in the same L2 broadcast domain (no routers in path)
function findLayer2Path(srcId, dstId) {
  return bfsReachable(srcId, false).has(dstId);
}

// Check physical connectivity (through switches AND routers)
function isPhysicallyReachable(srcId, dstId) {
  return bfsReachable(srcId, true).has(dstId);
}

// Find a router reachable from a PC whose interface IP matches the PC's gateway
function findRouterForGateway(pc) {
  const reachable = bfsReachable(pc.id, true);
  const routers   = networkState.devices.filter(d => d.type === 'router' && reachable.has(d.id));
  return routers.find(r =>
    r.interfaces.some(i => i.ip === pc.gateway && i.ip !== '')
  ) || null;
}

// ---- Main connectivity test ----

function testConnectivity(src, dst) {
  const fail = msg => ({ src: src.label, dst: dst.label, ok: false, message: msg });
  const ok   = msg => ({ src: src.label, dst: dst.label, ok: true,  message: msg });

  // Step 0: both must have valid IP + mask
  if (!isValidIp(src.ip) || !isValidMask(src.mask)) {
    return fail(`${src.label} mangler gyldig IP-konfigurasjon`);
  }
  if (!isValidIp(dst.ip) || !isValidMask(dst.mask)) {
    return fail(`${dst.label} mangler gyldig IP-konfigurasjon`);
  }

  // Step 1: IP conflict
  if (src.ip === dst.ip) {
    return fail(`IP-konflikt: ${src.label} og ${dst.label} har samme adresse (${src.ip})`);
  }

  // Step 2: Same subnet check (use src's mask; dst should ideally use same)
  const srcNet = getNetworkAddress(src.ip, src.mask);
  const dstNet = getNetworkAddress(dst.ip, dst.mask);

  if (srcNet === dstNet) {
    // Same network — must be connected at L2
    if (!findLayer2Path(src.id, dst.id)) {
      return fail(`${src.label} og ${dst.label} er på samme subnett (${srcNet}) men er ikke koblet sammen`);
    }
    return ok(`Ping OK – samme subnett (${srcNet})`);
  }

  // Step 3: Different subnets — need gateway + router
  if (!src.gateway || !isValidIp(src.gateway)) {
    return fail(`Gateway mangler på ${src.label}`);
  }
  if (!dst.gateway || !isValidIp(dst.gateway)) {
    return fail(`Gateway mangler på ${dst.label}`);
  }

  // Step 4: Find router for src's gateway
  const srcRouter = findRouterForGateway(src);
  if (!srcRouter) {
    return fail(`Ingen ruter er koblet til ${src.label} sitt subnett med gateway ${src.gateway}`);
  }

  // Step 5: Router must have interface on src's subnet
  const srcIface = srcRouter.interfaces.find(i =>
    isValidIp(i.ip) && isValidMask(i.mask) &&
    getNetworkAddress(i.ip, i.mask) === srcNet
  );
  if (!srcIface) {
    return fail(`Ruter (${srcRouter.label}) mangler grensesnitt mot ${src.label} sitt subnett (${srcNet})`);
  }

  // Step 6: src.gateway must equal the router interface IP on src's subnet
  if (src.gateway !== srcIface.ip) {
    return fail(`Gateway på ${src.label} (${src.gateway}) stemmer ikke med ruterens grensesnitt (${srcIface.ip})`);
  }

  // Step 7: Router must have interface on dst's subnet
  const dstIface = srcRouter.interfaces.find(i =>
    isValidIp(i.ip) && isValidMask(i.mask) &&
    getNetworkAddress(i.ip, i.mask) === dstNet
  );
  if (!dstIface) {
    return fail(`Ruter (${srcRouter.label}) mangler grensesnitt mot ${dst.label} sitt subnett (${dstNet})`);
  }

  // Step 8: dst.gateway must equal the router interface IP on dst's subnet
  if (dst.gateway !== dstIface.ip) {
    return fail(`Gateway på ${dst.label} (${dst.gateway}) stemmer ikke med ruterens grensesnitt (${dstIface.ip})`);
  }

  // Step 9: Physical cable path src → router
  if (!isPhysicallyReachable(src.id, srcRouter.id)) {
    return fail(`Ingen kabelforbindelse mellom ${src.label} og ${srcRouter.label}`);
  }

  // Step 10: Physical cable path dst → router
  if (!isPhysicallyReachable(dst.id, srcRouter.id)) {
    return fail(`Ingen kabelforbindelse mellom ${dst.label} og ${srcRouter.label}`);
  }

  return ok(`Ping OK – via ${srcRouter.label}`);
}

// Run connectivity test for all PC pairs
function runPing() {
  const pcs = networkState.devices.filter(d => d.type === 'pc');
  const results = [];
  for (let i = 0; i < pcs.length; i++) {
    for (let j = i + 1; j < pcs.length; j++) {
      results.push(testConnectivity(pcs[i], pcs[j]));
    }
  }
  return results;
}

// ---- Render ping results ----

function renderPingResults(results) {
  const panel = document.getElementById('ping-results');
  if (!results || results.length === 0) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';

  const rows = results.map(r => {
    const icon   = r.ok ? '✅' : '❌';
    const cls    = r.ok ? 'ping-ok' : 'ping-fail';
    const status = r.ok ? 'OK' : 'Feil';
    return `<tr>
      <td>${escHtml(r.src)}</td>
      <td>${escHtml(r.dst)}</td>
      <td class="${cls}"><span class="ping-icon">${icon}</span>${status}</td>
      <td>${escHtml(r.message)}</td>
    </tr>`;
  }).join('');

  panel.innerHTML = `
    <h3>Ping-resultater</h3>
    <table class="ping-table">
      <thead><tr><th>Fra</th><th>Til</th><th>Status</th><th>Melding</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
