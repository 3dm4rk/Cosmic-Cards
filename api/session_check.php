<?php
require_once __DIR__ . '/../config.php';
start_session();

// Prevent caching (important for real-time presence)
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$TTL_SECONDS = 14; // lock expires if no heartbeat (tab/device closed)

// Not logged in
if (empty($_SESSION['user_id'])) {
  echo json_encode(['status' => 'LOGGED_OUT']);
  exit;
}

$userId = (int)$_SESSION['user_id'];
$sessionToken = (string)($_SESSION['session_token'] ?? '');
$tabToken = (string)($_POST['tab_token'] ?? $_GET['tab_token'] ?? '');
$action = (string)($_POST['action'] ?? $_GET['action'] ?? 'heartbeat');

$pdo = db();

// NOTE: Your SQL schema defines `users.tab_heartbeat` as DATETIME.
// Use DATETIME everywhere (NOT unix ints), or presence will always show offline.
function hb_to_ts($hbVal): int {
  if ($hbVal === null) return 0;
  $s = trim((string)$hbVal);
  if ($s === '' || $s === '0000-00-00 00:00:00') return 0;
  $t = strtotime($s);
  return $t ? $t : 0;
}

try {
  // Lock row to avoid races between tabs
  $pdo->beginTransaction();

  $st = $pdo->prepare("SELECT active_session_token, active_tab_token, tab_heartbeat FROM users WHERE id=? FOR UPDATE");
  $st->execute([$userId]);
  $row = $st->fetch(PDO::FETCH_ASSOC);

  if (!$row) {
    $pdo->rollBack();
    echo json_encode(['status' => 'INVALID']);
    exit;
  }

  $dbSession = (string)($row['active_session_token'] ?? '');
  $dbTab = (string)($row['active_tab_token'] ?? '');
  $dbHbTs = hb_to_ts($row['tab_heartbeat'] ?? null);

  // Enforce single-session (other device/browser)
  if ($sessionToken !== '' && $dbSession !== '' && !hash_equals($dbSession, $sessionToken)) {
    $pdo->commit();
    echo json_encode(['status' => 'SESSION_TAKEN', 'user_id' => $userId]);
    exit;
  }

  $now = time();
  $isStale = ($dbHbTs > 0 && ($now - $dbHbTs) > $TTL_SECONDS);

  if ($action === 'release') {
    // Only release if this tab owns it (or stale)
    if ($dbTab !== '' && $tabToken !== '' && hash_equals($dbTab, $tabToken)) {
      $u = $pdo->prepare("UPDATE users SET active_tab_token=NULL, tab_heartbeat=NULL WHERE id=?");
      $u->execute([$userId]);
    } elseif ($dbTab !== '' && $isStale) {
      $u = $pdo->prepare("UPDATE users SET active_tab_token=NULL, tab_heartbeat=NULL WHERE id=?");
      $u->execute([$userId]);
    }
    $pdo->commit();
    echo json_encode(['status' => 'OK', 'user_id' => $userId]);
    exit;
  }

  // If no tab token, we still update heartbeat so the UI can show Online.
  if ($tabToken === '') {
    $u = $pdo->prepare("UPDATE users SET tab_heartbeat=NOW() WHERE id=?");
    $u->execute([$userId]);
    $pdo->commit();
    echo json_encode(['status' => 'OK', 'user_id' => $userId]);
    exit;
  }

  // If someone else owns the tab lock and it's not stale -> deny
  if ($dbTab !== '' && !hash_equals($dbTab, $tabToken) && !$isStale) {
    $pdo->commit();
    echo json_encode(['status' => 'TAB_TAKEN', 'user_id' => $userId]);
    exit;
  }

  // Take / refresh the lock + heartbeat
  $u = $pdo->prepare("UPDATE users SET active_tab_token=?, tab_heartbeat=NOW() WHERE id=?");
  $u->execute([$tabToken, $userId]);

  $pdo->commit();
  echo json_encode(['status' => 'OK', 'user_id' => $userId]);
  exit;

} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  echo json_encode(['status' => 'ERROR']);
  exit;
}
