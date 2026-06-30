<?php
require_once __DIR__ . '/../config.php';
header('Content-Type: application/json; charset=utf-8');
require_login();

$pdo = db();
$u = current_user();

$limit = intval($_GET['limit'] ?? 50);
if ($limit < 1) $limit = 50;
if ($limit > 100) $limit = 100;

// Create/upgrade table (supports both legacy schemas: is_read OR read_at)
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

$stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM messages WHERE to_user_id = ? AND is_read = 0 AND read_at IS NULL");
$stmt->execute([$u['id']]);
$unread = intval($stmt->fetchColumn() ?: 0);

$stmt = $pdo->prepare("
  SELECT m.id,
         m.body,
         CASE WHEN (m.read_at IS NOT NULL OR m.is_read = 1) THEN 1 ELSE 0 END AS is_read,
         UNIX_TIMESTAMP(m.created_at)*1000 AS created_at_ms,
         fu.username AS from_username
  FROM messages m
  JOIN users fu ON fu.id = m.from_user_id
  WHERE m.to_user_id = ?
  ORDER BY m.id DESC
  LIMIT $limit
");
$stmt->execute([$u['id']]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
  'ok' => true,
  'unread_count' => $unread,
  'messages' => $rows
]);
