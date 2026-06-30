<?php
require_once __DIR__ . '/../config.php';
start_session();

// Prevent caching (very important for real-time online/offline)
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$TTL_SECONDS = 25; // Online if heartbeat within this window

$username = trim((string)($_GET['username'] ?? ''));
if ($username === '') {
  echo json_encode(['ok' => false, 'error' => 'Missing username']);
  exit;
}

$pdo = db();

// NOTE: Your DB schema uses users.tab_heartbeat as DATETIME.
// We compute "last seen" using TIMESTAMPDIFF.

try {
  $st = $pdo->prepare(
    "SELECT tab_heartbeat, " .
    "CASE " .
      "WHEN tab_heartbeat IS NULL OR tab_heartbeat='0000-00-00 00:00:00' THEN NULL " .
      "ELSE TIMESTAMPDIFF(SECOND, tab_heartbeat, NOW()) " .
    "END AS last_seen_seconds " .
    "FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1"
  );
  $st->execute([$username]);
  $row = $st->fetch(PDO::FETCH_ASSOC);

  if (!$row) {
    echo json_encode(['ok' => false, 'error' => 'User not found']);
    exit;
  }

  $last = $row['last_seen_seconds'];
  $lastSeenSecondsAgo = is_null($last) ? null : (int)$last;

  $isOnline = ($lastSeenSecondsAgo !== null && $lastSeenSecondsAgo >= 0 && $lastSeenSecondsAgo <= $TTL_SECONDS);

  echo json_encode([
    'ok' => true,
    'username' => $username,
    'isOnline' => $isOnline,
    'lastSeenSecondsAgo' => $lastSeenSecondsAgo,
    'ttlSeconds' => $TTL_SECONDS
  ]);
} catch (Throwable $e) {
  echo json_encode(['ok' => false, 'error' => 'Server error']);
}
