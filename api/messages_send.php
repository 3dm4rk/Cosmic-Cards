<?php
require_once __DIR__ . '/../config.php';
header('Content-Type: application/json; charset=utf-8');
require_login();

$pdo = db();
$u = current_user();

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) { echo json_encode(['ok'=>false,'error'=>'Invalid JSON']); exit; }

$to_username = trim($data['to_username'] ?? '');
$body = trim($data['body'] ?? '');

if ($to_username === '' || strlen($to_username) < 2 || strlen($to_username) > 32){
  echo json_encode(['ok'=>false,'error'=>'Invalid receiver']); exit;
}
if ($body === '' || strlen($body) > 500){
  echo json_encode(['ok'=>false,'error'=>'Message must be 1-500 characters']); exit;
}
if (strcasecmp($to_username, $u['username']) === 0){
  echo json_encode(['ok'=>false,'error'=>'You cannot message yourself']); exit;
}

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

$stmt = $pdo->prepare("SELECT id, username FROM users WHERE username = ? LIMIT 1");
$stmt->execute([$to_username]);
$to = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$to){ echo json_encode(['ok'=>false,'error'=>'User not found']); exit; }

$stmt = $pdo->prepare("INSERT INTO messages (from_user_id, to_user_id, body, is_read, read_at) VALUES (?,?,?,0,NULL)");
$stmt->execute([$u['id'], $to['id'], $body]);
$id = intval($pdo->lastInsertId());

echo json_encode([
  'ok' => true,
  'id' => $id
]);
