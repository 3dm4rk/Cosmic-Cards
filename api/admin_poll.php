<?php
// api/admin_poll.php
// - Players (logged-in) poll this endpoint to receive queued admin commands + global broadcasts + global admin settings.
// - Admin Abuse page (no auth) writes into the same DB tables.

require_once __DIR__ . '/../config.php';
require_login();
header('Content-Type: application/json; charset=utf-8');

$pdo = db();

// Compatibility: use LONGTEXT instead of JSON (some MySQL/MariaDB installs are picky about JSON)
$pdo->exec("CREATE TABLE IF NOT EXISTS admin_commands(
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  to_user_id INT NOT NULL,
  type VARCHAR(64) NOT NULL,
  payload_json LONGTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX(to_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$pdo->exec("CREATE TABLE IF NOT EXISTS admin_broadcasts(
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$pdo->exec("CREATE TABLE IF NOT EXISTS admin_globals(
  `key` VARCHAR(64) PRIMARY KEY,
  value_json LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$u = current_user();
$uid = (int)$u['id'];

$lastBroadcastId = isset($_GET['last_broadcast_id']) ? (int)$_GET['last_broadcast_id'] : 0;

try {
  $pdo->beginTransaction();

  // --- 1) Fetch & delete per-user commands ---
  $st = $pdo->prepare("SELECT id,type,payload_json,UNIX_TIMESTAMP(created_at) ts
                       FROM admin_commands
                       WHERE to_user_id=?
                       ORDER BY id ASC
                       LIMIT 100
                       FOR UPDATE");
  $st->execute([$uid]);
  $rows = $st->fetchAll(PDO::FETCH_ASSOC);

  $cmds = [];
  $ids = [];
  foreach ($rows as $r) {
    $ids[] = (int)$r['id'];
    $pl = json_decode($r['payload_json'], true);
    if (!is_array($pl)) $pl = [];
    $cmds[] = [
      'id' => (string)$r['id'],
      'type' => (string)$r['type'],
      'payload' => $pl,
      'created_at_ms' => ((int)$r['ts']) * 1000,
    ];
  }

  if (!empty($ids)) {
    $in = implode(',', array_fill(0, count($ids), '?'));
    $del = $pdo->prepare("DELETE FROM admin_commands WHERE id IN ($in) AND to_user_id=?");
    $del->execute(array_merge($ids, [$uid]));
  }

  // --- 2) Global broadcasts (admin message to everyone) ---
  $bst = $pdo->prepare("SELECT id,message,UNIX_TIMESTAMP(created_at) ts
                        FROM admin_broadcasts
                        WHERE id > ?
                        ORDER BY id ASC
                        LIMIT 50");
  $bst->execute([$lastBroadcastId]);
  $brows = $bst->fetchAll(PDO::FETCH_ASSOC);

  $broadcasts = [];
  foreach ($brows as $b) {
    $broadcasts[] = [
      'id' => (string)$b['id'],
      'message' => (string)$b['message'],
      'created_at_ms' => ((int)$b['ts']) * 1000,
    ];
  }

  // --- 3) Global admin settings (e.g., shop lock) ---
  $globals = [];
  $gst = $pdo->prepare("SELECT `key`, value_json FROM admin_globals WHERE `key` IN ('shop_lock')");
  $gst->execute();
  $grows = $gst->fetchAll(PDO::FETCH_ASSOC);
  foreach ($grows as $g) {
    $k = (string)$g['key'];
    $raw = (string)$g['value_json'];
    $v = json_decode($raw, true);

    // Fallback for older rows that stored plain strings (not JSON-encoded).
    // Example: value_json = common  (json_decode -> null)
    if ($v === null && strtolower(trim($raw)) !== 'null' && $raw !== '') {
      $v = $raw;
    }
    $globals[$k] = $v;
  }

  $pdo->commit();

  echo json_encode([
    'ok' => true,
    'commands' => $cmds,
    'broadcasts' => $broadcasts,
    'globals' => $globals,
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  http_response_code(500);
  echo json_encode([
    'ok' => false,
    'error' => 'server_error'
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
