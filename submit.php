<?php
/**
 * submit.php  –  Tar imot besvarelser fra elever
 * Lagrer til mappen /submissions/ som <fornavn_etternavn>.json
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { http_response_code(405); echo json_encode(['ok'=>false,'error'=>'Method not allowed']); exit; }

// ---- Les innstillinger ----
$stateFile = __DIR__ . '/submissions/state.json';
ensureDir(__DIR__ . '/submissions');

$state = readJson($stateFile, ['open' => false, 'opened_at' => null, 'closed_at' => null]);

if (!$state['open']) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Innlevering er ikke åpen for øyeblikket.']);
    exit;
}

// ---- Les body ----
$body = file_get_contents('php://input');
$data = json_decode($body, true);

if (!$data || !isset($data['student']) || !isset($data['topology'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Ugyldig format.']);
    exit;
}

// ---- Sett server-timestamp og rens filnavn ----
$data['timestamp']     = date('c');
$data['submitted_ip']  = $_SERVER['REMOTE_ADDR'] ?? 'ukjent';

$studentName = trim($data['student']);
$safeName    = mb_strtolower(preg_replace('/[^a-zA-ZæøåÆØÅ0-9 ]/u', '', $studentName));
$safeName    = preg_replace('/\s+/', '_', trim($safeName));
if ($safeName === '') $safeName = 'ukjent';

$filename = $safeName . '.json';
$filepath = __DIR__ . '/submissions/' . $filename;

// Hvis det allerede finnes en fil med dette navnet, legg til timestamp for å ikke overskrive
if (file_exists($filepath)) {
    $ts = date('YmdHis');
    $filename = $safeName . '_' . $ts . '.json';
    $filepath = __DIR__ . '/submissions/' . $filename;
}

file_put_contents($filepath, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo json_encode(['ok' => true, 'message' => "Besvarelse mottatt! Fil: $filename"]);

// ---- Hjelpefunksjoner ----
function ensureDir($dir) {
    if (!is_dir($dir)) mkdir($dir, 0755, true);
}

function readJson($path, $default = []) {
    if (!file_exists($path)) return $default;
    $data = json_decode(file_get_contents($path), true);
    return $data !== null ? $data : $default;
}
