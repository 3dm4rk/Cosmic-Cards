<?php
require_once __DIR__ . '/../config.php';
require_login();
header('Content-Type: application/json; charset=utf-8');

function ensure_trade_tables(PDO $pdo){
  $pdo->exec("CREATE TABLE IF NOT EXISTS trade_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    from_user_id INT NOT NULL,
    to_user_id INT NOT NULL,
    payload_json JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_to_user (to_user_id),
    INDEX idx_from_user (from_user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
}

$pdo = db();
ensure_trade_tables($pdo);

$u = current_user();
if (!$u){
  http_response_code(401);
  echo json_encode(['ok'=>false,'error'=>'not_logged_in'], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
  exit;
}

try{
  $pdo->beginTransaction();

  // Fetch queued messages for this user, newest first
  $st = $pdo->prepare("SELECT tm.id, tm.payload_json, UNIX_TIMESTAMP(tm.created_at) AS ts
                       FROM trade_messages tm
                       WHERE tm.to_user_id = ?
                       ORDER BY tm.id DESC
                       LIMIT 50
                       FOR UPDATE");
  $st->execute([(int)$u['id']]);
  $rows = $st->fetchAll(PDO::FETCH_ASSOC);

  $messages = [];
  $ids = [];
  foreach ($rows as $r){
    $ids[] = (int)$r['id'];
    $payload = json_decode($r['payload_json'], true);
    if (!is_array($payload)) $payload = [];
    $messages[] = [
      'id' => (string)$r['id'],
      'from_username' => (string)($payload['from_username'] ?? 'Someone'),
      'card' => $payload['card'] ?? null,
      'created_at_ms' => ((int)$r['ts']) * 1000
    ];
  }

  if (count($ids) > 0){
    // Delete them now to guarantee at-most-once delivery
    $in = implode(',', array_fill(0, count($ids), '?'));
    $del = $pdo->prepare("DELETE FROM trade_messages WHERE id IN ($in) AND to_user_id = ?");
    $params = array_merge($ids, [(int)$u['id']]);
    $del->execute($params);
  }

  $pdo->commit();

  echo json_encode(['ok'=>true,'messages'=>$messages], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
}catch(Throwable $e){
  if ($pdo->inTransaction()) $pdo->rollBack();
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'server_error'], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
}
