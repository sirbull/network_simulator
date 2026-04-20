<?php
/**
 * admin.php  –  Lærerpanel for Subnett-simulator
 * Passordbeskyttet side for å åpne/lukke innlevering og se besvarelser.
 *
 * SETT DITT EGET PASSORD I LINJEN UNDER:
 */
define('ADMIN_PASSWORD', 'Vinterferie1987');   // <-- endre dette!

session_start();

$submissionsDir = __DIR__ . '/submissions';
$stateFile      = $submissionsDir . '/state.json';

if (!is_dir($submissionsDir)) mkdir($submissionsDir, 0755, true);

// ---- Logg ut ----
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: admin.php');
    exit;
}

// ---- Logg inn ----
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    if ($_POST['password'] === ADMIN_PASSWORD) {
        $_SESSION['admin'] = true;
    } else {
        $loginError = 'Feil passord.';
    }
}

// ---- Ikke innlogget: vis innloggingsskjema ----
if (empty($_SESSION['admin'])) {
    loginPage($loginError ?? null);
    exit;
}

// ---- Admin-handlinger ----
function readState($file) {
    if (!file_exists($file)) return ['open' => false];
    $d = json_decode(file_get_contents($file), true);
    return $d ?: ['open' => false];
}
function writeState($file, $state) {
    file_put_contents($file, json_encode($state, JSON_PRETTY_PRINT));
}

$state = readState($stateFile);

if (isset($_POST['action'])) {
    if ($_POST['action'] === 'open') {
        $state = ['open' => true,  'opened_at' => date('c'), 'closed_at' => null];
        writeState($stateFile, $state);
    } elseif ($_POST['action'] === 'close') {
        $state['open']      = false;
        $state['closed_at'] = date('c');
        writeState($stateFile, $state);
    } elseif ($_POST['action'] === 'delete' && isset($_POST['file'])) {
        $target = realpath($submissionsDir . '/' . basename($_POST['file']));
        if ($target && strpos($target, realpath($submissionsDir)) === 0 && file_exists($target)) {
            unlink($target);
        }
    }
    header('Location: admin.php');
    exit;
}

// ---- Last besvarelser ----
$files = glob($submissionsDir . '/*.json');
$submissions = [];
foreach ($files as $f) {
    if (basename($f) === 'state.json') continue;
    $data = json_decode(file_get_contents($f), true);
    if ($data) {
        $data['_filename'] = basename($f);
        $data['_filesize'] = filesize($f);
        $submissions[] = $data;
    }
}
usort($submissions, fn($a, $b) => strcmp($b['timestamp'] ?? '', $a['timestamp'] ?? ''));

// ---- Last ned ----
if (isset($_GET['download'])) {
    $target = realpath($submissionsDir . '/' . basename($_GET['download']));
    if ($target && strpos($target, realpath($submissionsDir)) === 0 && file_exists($target)) {
        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="' . basename($target) . '"');
        readfile($target);
        exit;
    }
}

$isOpen     = !empty($state['open']);
$openedAt   = $state['opened_at']  ?? null;
$closedAt   = $state['closed_at']  ?? null;

// Statistikk
$passCount = count(array_filter($submissions, fn($s) => !empty($s['validation']['passed'])));
$failCount = count($submissions) - $passCount;

adminPage($isOpen, $openedAt, $closedAt, $submissions, $passCount, $failCount);

// ===========================================================================
// HTML-funksjoner
// ===========================================================================

function loginPage($error) { ?>
<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Lærerpanel – logg inn</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f0f4f8; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .box { background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 24px #0002; width: 320px; }
    h1 { font-size: 1.3rem; margin: 0 0 24px; color: #1a237e; }
    input[type=password] { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; box-sizing: border-box; margin-bottom: 12px; }
    button { width: 100%; padding: 11px; background: #1a237e; color: #fff; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; }
    button:hover { background: #283593; }
    .err { color: #c62828; font-size: 0.88rem; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>🔒 Lærerpanel</h1>
    <?php if ($error) echo '<p class="err">' . htmlspecialchars($error) . '</p>'; ?>
    <form method="post">
      <input type="password" name="password" placeholder="Passord" autofocus>
      <button type="submit">Logg inn</button>
    </form>
  </div>
</body>
</html>
<?php }

function adminPage($isOpen, $openedAt, $closedAt, $submissions, $passCount, $failCount) {
  $statusColor = $isOpen ? '#2e7d32' : '#c62828';
  $statusText  = $isOpen ? '🟢 Åpen for innlevering' : '🔴 Innlevering stengt';
  $total = count($submissions);
?>
<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Lærerpanel – Subnett-simulator</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f0f4f8; margin: 0; padding: 0; color: #1a1a2e; }

    header { background: #1a237e; color: white; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; }
    header h1 { margin: 0; font-size: 1.3rem; }
    header a { color: #90caf9; font-size: 0.85rem; text-decoration: none; }
    header a:hover { text-decoration: underline; }

    main { max-width: 1000px; margin: 32px auto; padding: 0 20px; }

    .card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px #0001; margin-bottom: 24px; }
    .card h2 { margin: 0 0 16px; font-size: 1.1rem; color: #1a237e; }

    .status-badge { font-size: 1.1rem; font-weight: 700; color: <?php echo $statusColor; ?>; margin-bottom: 12px; }
    .meta { font-size: 0.82rem; color: #666; margin-bottom: 16px; line-height: 1.8; }

    .btn { display: inline-block; padding: 10px 22px; border: none; border-radius: 6px; font-size: 0.95rem; cursor: pointer; font-weight: 600; }
    .btn-open  { background: #2e7d32; color: #fff; }
    .btn-close { background: #c62828; color: #fff; }
    .btn:hover { opacity: 0.88; }

    .stats { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 0; }
    .stat-box { flex: 1; min-width: 120px; background: #f5f5f5; border-radius: 8px; padding: 14px; text-align: center; }
    .stat-box .num { font-size: 2rem; font-weight: 800; }
    .stat-box .lbl { font-size: 0.78rem; color: #666; }
    .num-pass { color: #2e7d32; } .num-fail { color: #c62828; } .num-total { color: #1a237e; }

    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    thead th { background: #e8eaf6; padding: 10px 12px; text-align: left; font-size: 0.8rem; text-transform: uppercase; letter-spacing: .04em; color: #3949ab; white-space: nowrap; }
    tbody tr:nth-child(even) { background: #fafafa; }
    tbody tr:hover { background: #e8f5e9; }
    td { padding: 10px 12px; vertical-align: middle; }

    .badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; }
    .badge-pass { background: #c8e6c9; color: #2e7d32; }
    .badge-fail { background: #ffcdd2; color: #c62828; }

    .checks { font-size: 0.75rem; color: #555; line-height: 1.7; }
    .checks .ok  { color: #2e7d32; }
    .checks .nok { color: #c62828; }

    .btn-sm { padding: 5px 12px; font-size: 0.8rem; border-radius: 5px; text-decoration: none; display: inline-block; margin-right: 4px; }
    .btn-dl  { background: #1a237e; color: white; border: none; cursor: pointer; }
    .btn-del { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; cursor: pointer; }

    .empty { color: #888; text-align: center; padding: 32px; font-size: 0.95rem; }
  </style>
</head>
<body>
<header>
  <h1>🖥️ Lærerpanel – Subnett-simulator</h1>
  <a href="?logout=1">Logg ut</a>
</header>
<main>

  <!-- Status + kontroll -->
  <div class="card">
    <h2>Innlevering</h2>
    <div class="status-badge"><?php echo $statusText; ?></div>
    <div class="meta">
      <?php if ($openedAt)  echo '📂 Åpnet: <strong>' . fmtDate($openedAt)  . '</strong><br>'; ?>
      <?php if ($closedAt && !$isOpen) echo '🔒 Stengt: <strong>' . fmtDate($closedAt) . '</strong><br>'; ?>
    </div>
    <form method="post" style="display:inline">
      <?php if ($isOpen): ?>
        <button class="btn btn-close" name="action" value="close">🔒 Steng innlevering</button>
      <?php else: ?>
        <button class="btn btn-open" name="action" value="open">📂 Åpne innlevering</button>
      <?php endif; ?>
    </form>
  </div>

  <!-- Statistikk -->
  <div class="card">
    <h2>Statistikk</h2>
    <div class="stats">
      <div class="stat-box"><div class="num num-total"><?php echo $total; ?></div><div class="lbl">Innleverte</div></div>
      <div class="stat-box"><div class="num num-pass"><?php echo $passCount; ?></div><div class="lbl">Bestått</div></div>
      <div class="stat-box"><div class="num num-fail"><?php echo $failCount; ?></div><div class="lbl">Ikke bestått</div></div>
    </div>
  </div>

  <!-- Besvarelser -->
  <div class="card">
    <h2>Besvarelser (<?php echo $total; ?>)</h2>
    <?php if (empty($submissions)): ?>
      <div class="empty">Ingen besvarelser mottatt ennå.</div>
    <?php else: ?>
    <table>
      <thead>
        <tr>
          <th>Elev</th>
          <th>Innlevert</th>
          <th>Status</th>
          <th>Sjekkliste</th>
          <th>Enheter / kabler</th>
          <th>Fil</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($submissions as $s):
          $passed  = !empty($s['validation']['passed']);
          $checks  = $s['validation']['checks'] ?? [];
          $devices = count($s['topology']['devices'] ?? []);
          $cables  = count($s['topology']['cables']  ?? []);
          $ts      = $s['timestamp'] ?? '';
          $checkLabels = [
            'twoCorrectSubnets'   => 'To subnett',
            'eachSubnetHasTwoPCs' => '2 PCer/subnett',
            'connectedViaRouter'  => 'Koblet via ruter',
            'allPCsCanPing'       => 'Ping OK',
          ];
        ?>
        <tr>
          <td><strong><?php echo htmlspecialchars($s['student'] ?? '?'); ?></strong></td>
          <td><?php echo $ts ? fmtDate($ts) : '?'; ?></td>
          <td><span class="badge <?php echo $passed ? 'badge-pass' : 'badge-fail'; ?>"><?php echo $passed ? '✓ Bestått' : '✗ Ikke bestått'; ?></span></td>
          <td>
            <div class="checks">
              <?php foreach ($checkLabels as $key => $label):
                $ok = !empty($checks[$key]);
              ?>
                <span class="<?php echo $ok ? 'ok' : 'nok'; ?>"><?php echo $ok ? '✓' : '✗'; ?> <?php echo $label; ?></span><br>
              <?php endforeach; ?>
            </div>
          </td>
          <td><?php echo $devices; ?> / <?php echo $cables; ?></td>
          <td><small style="color:#888"><?php echo htmlspecialchars($s['_filename']); ?></small></td>
          <td>
            <a class="btn btn-sm btn-dl" href="?download=<?php echo urlencode($s['_filename']); ?>">⬇ Last ned</a>
            <form method="post" style="display:inline" onsubmit="return confirm('Slette denne besvarelsen?')">
              <input type="hidden" name="action" value="delete">
              <input type="hidden" name="file"   value="<?php echo htmlspecialchars($s['_filename']); ?>">
              <button class="btn btn-sm btn-del" type="submit">🗑</button>
            </form>
          </td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <?php endif; ?>
  </div>

</main>
</body>
</html>
<?php }

function fmtDate($iso) {
    try {
        $dt = new DateTime($iso);
        $dt->setTimezone(new DateTimeZone('Europe/Oslo'));
        return $dt->format('d.m.Y H:i');
    } catch (Exception $e) {
        return htmlspecialchars($iso);
    }
}
