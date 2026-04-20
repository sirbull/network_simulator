// === HINT SYSTEM ===
// Gives context-sensitive, progressive hints based on current network state.
// Cooldown: 5 minutes between each hint click.

(function () {
  var COOLDOWN_MS = 5 * 60 * 1000;  // 5 minutes
  var lastHintTime = 0;
  var hintLevel = 0;  // 0 = never shown, increments per click per "phase"
  var lastPhase = null;

  // -----------------------------------------------------------------------
  // Analyse the current network state and return a "phase" key + details
  // -----------------------------------------------------------------------
  function analyseState() {
    var devices = (networkState && networkState.devices) || [];
    var cables  = (networkState && networkState.cables)  || [];

    var pcs      = devices.filter(function(d){ return d.type === 'pc'; });
    var switches = devices.filter(function(d){ return d.type === 'switch'; });
    var routers  = devices.filter(function(d){ return d.type === 'router'; });

    // No devices at all
    if (devices.length === 0) {
      return { phase: 'empty' };
    }

    // Has devices but no PCs
    if (pcs.length === 0) {
      return { phase: 'no_pcs' };
    }

    // Use validation checks from validation.js
    var result = (typeof validateAssignment === 'function') ? validateAssignment() : { checks: {} };
    var checks = result.checks || {};

    // All done
    if (result.passed) {
      return { phase: 'done' };
    }

    // Check 1 failing: subnets not correct
    if (!checks.twoCorrectSubnets) {
      var configuredPCs = pcs.filter(function(pc){
        return pc.ip && pc.ip.match(/^\d+\.\d+\.\d+\.\d+$/) && pc.mask;
      });
      if (configuredPCs.length === 0) {
        return { phase: 'pcs_not_configured' };
      }
      // Check if they're using wrong subnet
      var wrongSubnet = configuredPCs.some(function(pc){
        var net = (typeof getNetworkAddress === 'function') ? getNetworkAddress(pc.ip, '255.255.255.128') : '';
        return net !== '192.168.10.0' && net !== '192.168.10.128';
      });
      if (wrongSubnet) {
        return { phase: 'wrong_subnet' };
      }
      // Only one subnet covered
      return { phase: 'only_one_subnet' };
    }

    // Check 2 failing: not enough PCs or not via switch
    if (!checks.eachSubnetHasTwoPCs) {
      if (switches.length === 0) {
        return { phase: 'no_switch' };
      }
      var pcCount = pcs.length;
      if (pcCount < 4) {
        return { phase: 'too_few_pcs', count: pcCount };
      }
      return { phase: 'pcs_not_via_switch' };
    }

    // Check 3 failing: no router or wrong router config
    if (!checks.connectedViaRouter) {
      if (routers.length === 0) {
        return { phase: 'no_router' };
      }
      // Router exists but interfaces not configured
      var routerConfigured = routers.some(function(r){
        return r.interfaces && r.interfaces.some(function(i){ return i.ip; });
      });
      if (!routerConfigured) {
        return { phase: 'router_not_configured' };
      }
      return { phase: 'router_wrong_config' };
    }

    // Check 4 failing: ping fails
    if (!checks.allPCsCanPing) {
      return { phase: 'ping_fails' };
    }

    return { phase: 'unknown' };
  }

  // -----------------------------------------------------------------------
  // Hint data: each phase has up to 3 hint levels
  // -----------------------------------------------------------------------
  var HINTS = {
    empty: [
      {
        title: '🖥️ Kom i gang',
        text: 'Du har ikke lagt til noen enheter ennå. Start med å trykke «+ PC» i verktøylinjen for å legge til din første PC.'
      },
      {
        title: '🗺️ Planlegg nettverket',
        text: 'Du trenger totalt: minst 4 PCer (2 per subnett), 2 svitsjer og 1 ruter. Tegn det gjerne på papir først!'
      },
      {
        title: '🔍 Google-tips',
        text: 'Søk etter: «network topology subnetting example» for å se bilder av hvordan et slikt nettverk ser ut.'
      }
    ],
    no_pcs: [
      {
        title: '🖥️ Legg til PCer',
        text: 'Du har lagt til enheter, men ingen PCer. Trykk «+ PC» for å legge til PCer – du trenger minst 4 totalt (2 i hvert subnett).'
      },
      {
        title: '📋 Huskeliste',
        text: 'Du trenger: 4 PCer, 2 svitsjer og 1 ruter. Legg til det som mangler med knappene øverst.'
      }
    ],
    pcs_not_configured: [
      {
        title: '⚙️ Konfigurer PCene dine',
        text: 'Du har PCer, men de mangler IP-adresse. Klikk på en PC for å åpne innstillingene og fylle inn IP-adresse, nettmaske og gateway.'
      },
      {
        title: '📖 Les teorien',
        text: 'Gå til «Lær»-fanen, steg 6 («Din oppgave»). Der finner du nøyaktig hvilke adresser du skal bruke på PCene.'
      },
      {
        title: '🔍 Google-tips',
        text: 'Søk etter: «IPv4 address configuration subnetting» for å forstå hvordan IP-adresser settes opp.'
      }
    ],
    wrong_subnet: [
      {
        title: '⚠️ Feil subnett',
        text: 'En eller flere PCer har feil IP-adresse. Subnett 1 skal ha adresser fra 192.168.10.1 til 192.168.10.126. Subnett 2 skal ha adresser fra 192.168.10.129 til 192.168.10.254.'
      },
      {
        title: '📖 Sjekk teorien',
        text: 'Gå til «Lær»-fanen, steg 4 (Nettmaske og /25) og steg 6 (Din oppgave). Tabellen viser nøyaktig hvilke adresser som hører til hvert subnett.'
      },
      {
        title: '🔍 Google-tips',
        text: 'Søk etter: «subnet calculator 192.168.10.0/25» for å se hvilke adresser som hører til subnettet.'
      }
    ],
    only_one_subnet: [
      {
        title: '🔀 Du trenger to subnett',
        text: 'Alle PCene dine ser ut til å være i samme subnett. Du trenger PCer i BEGGE subnettene: noen i 192.168.10.0/25 (.1–.126) og noen i 192.168.10.128/25 (.129–.254).'
      },
      {
        title: '📋 Fordel PCene',
        text: 'Gi 2 PCer adresser i området .1–.126 (subnett 1) og 2 PCer adresser i området .129–.254 (subnett 2). Husk samme nettmaske: 255.255.255.128.'
      },
      {
        title: '🔍 Google-tips',
        text: 'Søk etter: «subnetting /25 two subnets» for å forstå hvordan man deler et nettverk i to.'
      }
    ],
    no_switch: [
      {
        title: '🔀 Du mangler svitsj',
        text: 'PCene dine trenger en svitsj å kobles til. Trykk «+ Svitsj» for å legge til to svitsjer – én per subnett.'
      },
      {
        title: '📖 Les om svitsjer',
        text: 'Gå til «Lær»-fanen, steg 5 (Svitsj, ruter og gateway). En svitsj kobler alle enheter i samme subnett sammen.'
      },
      {
        title: '🔍 Google-tips',
        text: 'Søk etter: «what is a network switch vs router» for å forstå forskjellen på svitsj og ruter.'
      }
    ],
    too_few_pcs: [
      {
        title: '🖥️ Du trenger flere PCer',
        text: 'Du har foreløpig for få PCer. Du trenger minst 2 PCer i hvert subnett – totalt minst 4 PCer.'
      },
      {
        title: '➕ Legg til flere',
        text: 'Trykk «+ PC» og legg til flere datamaskiner. Husk at hver halvdel av nettverket skal ha minst 2 PCer koblet til sin egen svitsj.'
      }
    ],
    pcs_not_via_switch: [
      {
        title: '🔌 Kabler mangler',
        text: 'PCene dine er ikke koblet til en svitsj. Bruk «Tegn kabel» og klikk på en PC og deretter svitsjen i samme subnett for å koble dem sammen.'
      },
      {
        title: '🗺️ Sjekk koblingene',
        text: 'Hvert subnett skal se slik ut: PC → Svitsj. Alle PCer i subnett 1 kobles til svitsj 1, alle PCer i subnett 2 kobles til svitsj 2.'
      },
      {
        title: '🔍 Google-tips',
        text: 'Søk etter: «network topology star topology switch» for å se bilder av hvordan PCer kobles til en svitsj.'
      }
    ],
    no_router: [
      {
        title: '🗺️ Du mangler en ruter',
        text: 'Subnettene dine er ikke koblet sammen ennå. Du trenger en ruter! Trykk «+ Ruter» for å legge til en.'
      },
      {
        title: '📖 Les om ruteren',
        text: 'Gå til «Lær»-fanen, steg 5. Ruteren er «heisen» mellom subnettene – den trenger én tilkobling (grensesnitt) til hvert subnett.'
      },
      {
        title: '🔍 Google-tips',
        text: 'Søk etter: «router connects two subnets gateway» for å forstå ruterens rolle.'
      }
    ],
    router_not_configured: [
      {
        title: '⚙️ Konfigurer ruteren',
        text: 'Du har en ruter, men den mangler IP-adresser på grensesnittene. Klikk på ruteren og fyll inn en IP-adresse på hvert grensesnitt (ett per subnett).'
      },
      {
        title: '📋 Ruterens adresser',
        text: 'Grensesnitt mot subnett 1: IP 192.168.10.1, maske 255.255.255.128. Grensesnitt mot subnett 2: IP 192.168.10.129, maske 255.255.255.128. Koble hvert grensesnitt til riktig svitsj!'
      },
      {
        title: '🔍 Google-tips',
        text: 'Søk etter: «router interface IP address configuration» for å forstå hvordan rutergrensesnitt konfigureres.'
      }
    ],
    router_wrong_config: [
      {
        title: '⚠️ Noe er feil med ruteroppsettet',
        text: 'Ruteren er lagt til, men grensesnittene er ikke riktig satt opp. Sjekk at ruteren er koblet til begge svitsjene med kabel, og at grensesnittadressene stemmer.'
      },
      {
        title: '📋 Fasit for ruteren',
        text: 'Ruterens grensesnitt mot subnett 1 skal ha IP 192.168.10.1 og maske 255.255.255.128. Grensesnittet mot subnett 2 skal ha IP 192.168.10.129 og maske 255.255.255.128. Nettverksadressen på grensesnittet MÅ stemme med subnettet det kobles til.'
      },
      {
        title: '📖 Sjekk teorien igjen',
        text: 'Gå til «Lær»-fanen, steg 6 (Din oppgave). Der står nøyaktig hva ruterens grensesnitt skal hete. Husk at PCenes gateway-adresse skal peke på ruterens IP i samme subnett.'
      }
    ],
    ping_fails: [
      {
        title: '🏓 Ping feiler – sjekk gateway',
        text: 'Nettverket ser nesten riktig ut, men PCene finner ikke hverandre. Den vanligste årsaken er feil gateway. Sjekk at hver PC har riktig gateway (ruterens IP i samme subnett som PCen).'
      },
      {
        title: '📋 Gateway-fasit',
        text: 'PCer i subnett 1 (adresser .1–.126) skal ha gateway 192.168.10.1. PCer i subnett 2 (adresser .129–.254) skal ha gateway 192.168.10.129. Klikk på hver PC og sjekk gateway-feltet!'
      },
      {
        title: '🔍 Google-tips',
        text: 'Søk etter: «default gateway why important subnetting» for å forstå hvorfor riktig gateway er avgjørende.'
      }
    ],
    done: [
      {
        title: '🎉 Du er ferdig!',
        text: 'Nettverket ditt er korrekt konfigurert og alle PCer kan pinge hverandre. Gå til «Lever oppgave»-fanen for å levere besvarelsen din!'
      }
    ],
    unknown: [
      {
        title: '🤔 Noe er ikke helt riktig',
        text: 'Gå til «Lever oppgave»-fanen og se hvilke krav som ikke er oppfylt (rødt kryss). Klikk tilbake hit og prøv å fikse det punktet.'
      }
    ]
  };

  // -----------------------------------------------------------------------
  // Show hint
  // -----------------------------------------------------------------------
  window.showHint = function () {
    var now = Date.now();
    var btn = document.getElementById('hint-btn');
    var box = document.getElementById('hint-box');
    if (!btn || !box) return;

    var state = analyseState();
    var phase = state.phase;

    // Reset hint level if phase changed
    if (phase !== lastPhase) {
      hintLevel = 0;
      lastPhase = phase;
      lastHintTime = 0; // allow immediate hint on new phase
    }

    // Cooldown check (skip on first hint of a new phase)
    var elapsed = now - lastHintTime;
    if (lastHintTime > 0 && elapsed < COOLDOWN_MS) {
      var remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      var mins = Math.floor(remaining / 60);
      var secs = remaining % 60;
      var timeStr = mins > 0 ? (mins + ' min ' + secs + ' sek') : (secs + ' sek');
      box.style.display = 'block';
      box.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<span class="material-symbols-outlined" style="color:#f9a825">timer</span>' +
        '<strong>Vent litt!</strong></div>' +
        '<p style="margin:8px 0 0">Neste hint er tilgjengelig om <strong>' + timeStr + '</strong>.<br>' +
        '<small style="color:var(--text-muted)">Bruk ventetiden til å prøve deg frem på egen hånd – det er slik du lærer best!</small></p>';
      return;
    }

    var hintList = HINTS[phase] || HINTS['unknown'];
    var idx = Math.min(hintLevel, hintList.length - 1);
    var hint = hintList[idx];

    // Display hint
    box.style.display = 'block';
    var levelText = (hintList.length > 1)
      ? '<span style="font-size:0.75rem;color:var(--text-muted);float:right">Hint ' + (idx + 1) + ' av ' + hintList.length + '</span>'
      : '';

    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
      '<strong>' + hint.title + '</strong>' + levelText +
      '</div>' +
      '<p style="margin:0">' + hint.text + '</p>';

    // Update button label
    if (idx + 1 < hintList.length) {
      btn.innerHTML = '<span class="material-symbols-outlined">lightbulb</span> Nytt hint om 5 min';
    } else {
      btn.innerHTML = '<span class="material-symbols-outlined">lightbulb</span> Hint (siste)';
    }

    hintLevel++;
    lastHintTime = now;
  };

  // Start countdown display on the button while cooldown is active
  function tickBtn() {
    var btn = document.getElementById('hint-btn');
    if (!btn) return;
    var now = Date.now();
    var elapsed = now - lastHintTime;
    if (lastHintTime > 0 && elapsed < COOLDOWN_MS) {
      var remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      var mins = Math.floor(remaining / 60);
      var secs = remaining % 60;
      btn.innerHTML = '<span class="material-symbols-outlined">timer</span> Hint om ' +
        (mins > 0 ? mins + ':' + (secs < 10 ? '0' : '') + secs : secs + ' sek');
      btn.style.opacity = '0.6';
    } else {
      btn.innerHTML = '<span class="material-symbols-outlined">lightbulb</span> Trenger du et hint?';
      btn.style.opacity = '';
    }
  }
  setInterval(tickBtn, 1000);

})();
