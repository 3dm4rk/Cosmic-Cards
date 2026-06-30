<?php
require_once __DIR__ . '/../config.php';
header('Content-Type: application/json; charset=utf-8');
require_login();

$pdo = db();
$u = current_user();

$limit = intval($_GET['limit'] ?? 50);
if ($limit < 1) $limit = 50;
if ($limit > 100) $limit = 100;

// Create/upgrade table (supports both legacy schemas)
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

$stmt = $pdo->prepare("
  SELECT m.id, m.body, UNIX_TIMESTAMP(m.created_at)*1000 AS created_at_ms,
         tu.username AS to_username
  FROM messages m
  JOIN users tu ON tu.id = m.to_user_id
  WHERE m.from_user_id = ?
  ORDER BY m.id DESC
  LIMIT $limit
");
$stmt->execute([$u['id']]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
  'ok' => true,
  'messages' => $rows
]);
