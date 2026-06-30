<?php
require_once __DIR__ . '/../config.php';
header('Content-Type: application/json; charset=utf-8');
require_login();

$pdo = db();
$u = current_user();

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) $data = [];

$mode = $data['mode'] ?? 'all';

$pdo->exec("CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  from_user_id INT NOT NULL,
  to_user_id INT NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_to_created (to_user_id, created_at),
  KEY idx_to_read (to_user_id, is_read, read_at),
  KEY idx_from_created (from_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// Backfill/ensure columns exist if table was created with an older schema
try {
  $cols = $pdo->query("SHOW COLUMNS FROM messages")?->fetchAll(PDO::FETCH_COLUMN, 0);
  $cols = is_array($cols) ? $cols : [];
  if (!in_array('is_read', $cols, true)) {
    $pdo->exec("ALTER TABLE messages ADD COLUMN is_read TINYINT(1) NOT NULL DEFAULT 0");
  }
  if (!in_array('read_at', $cols, true)) {
    $pdo->exec("ALTER TABLE messages ADD COLUMN read_at DATETIME NULL DEFAULT NULL");
  }
} catch (Throwable $e) {
  // ignore
}

if ($mode === 'ids' && is_array($data['ids'] ?? null) && count($data['ids'])){
  $ids = array_values(array_filter($data['ids'], fn($x)=>is_numeric($x)));
  if (!count($ids)){ echo json_encode(['ok'=>true,'updated'=>0]); exit; }
  $in = implode(',', array_fill(0, count($ids), '?'));
  $params = array_merge([$u['id']], $ids);
  $stmt = $pdo->prepare("UPDATE messages SET is_read = 1, read_at = NOW() WHERE to_user_id = ? AND id IN ($in)");
  $stmt->execute($params);
  echo json_encode(['ok'=>true,'updated'=>$stmt->rowCount()]);
  exit;
}

$stmt = $pdo->prepare("UPDATE messages SET is_read = 1, read_at = NOW() WHERE to_user_id = ? AND is_read = 0 AND read_at IS NULL");
$stmt->execute([$u['id']]);
echo json_encode(['ok'=>true,'updated'=>$stmt->rowCount()]);
