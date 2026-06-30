<?php
require_once __DIR__ . '/../config.php';
require_login();

header('Content-Type: application/json; charset=utf-8');

function read_json_body() {
  $raw = file_get_contents('php://input');
  if (!$raw) return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function respond($ok, $payload = [], $http = 200){
  http_response_code($http);
  echo json_encode(array_merge(['ok'=>$ok], $payload), JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
  exit;
}

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

$u = current_user();
$pdo = db();
ensure_trade_tables($pdo);

$body = read_json_body();
$to_username = trim((string)($body['to_username'] ?? ''));
$card_id     = trim((string)($body['card_id'] ?? ''));

if ($to_username === '' || $card_id === ''){
  respond(false, ['error'=>'Missing receiver username or card id.'], 400);
}

if (strcasecmp($to_username, (string)$u['username']) === 0){
  respond(false, ['error'=>'You cannot send a gift to yourself.'], 400);
}

// Find receiver
$stmt = $pdo->prepare('SELECT id, username FROM users WHERE username = ? LIMIT 1');
$stmt->execute([$to_username]);
$toUser = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$toUser){
  respond(false, ['error'=>'Receiver username not found.'], 404);
}

$pdo->beginTransaction();
try{
  // Lock sender state row
  $stmt = $pdo->prepare('SELECT state_json FROM game_states WHERE user_id = ? LIMIT 1 FOR UPDATE');
  $stmt->execute([(int)$u['id']]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);

  $senderState = ($row && !empty($row['state_json'])) ? json_decode($row['state_json'], true) : null;
  if (!is_array($senderState)) $senderState = [];

  $cardsOwned = $senderState['cardsOwned'] ?? [];
  if (!is_array($cardsOwned)) $cardsOwned = [];

  // Find the card in sender account
  $card = null;
  foreach ($cardsOwned as $c){
    if (is_array($c) && isset($c['id']) && (string)$c['id'] === $card_id){
      $card = $c;
      break;
    }
  }
  if (!$card){
    throw new Exception('Card not found in your account.');
  }

  // Safety: do not allow sending hearted/favorited cards
  if (!empty($card['fav'])){
    throw new Exception('That card is locked (hearted). Unheart it first to send.');
  }

  // Remove from sender cardsOwned
  $senderState['cardsOwned'] = array_values(array_filter($cardsOwned, function($c) use ($card_id){
    return !(is_array($c) && isset($c['id']) && (string)$c['id'] === $card_id);
  }));

  // Remove from decks if referenced
  if (isset($senderState['decks']) && is_array($senderState['decks'])){
    foreach ($senderState['decks'] as $dk => $arr){
      if (!is_array($arr)) continue;
      foreach ($arr as $i => $val){
        if ((string)$val === $card_id){
          $senderState['decks'][$dk][$i] = null;
        }
      }
    }
  }
  if (isset($senderState['cardsInDeck']) && is_array($senderState['cardsInDeck'])){
    $senderState['cardsInDeck'] = array_values(array_filter($senderState['cardsInDeck'], function($id) use ($card_id){
      return (string)$id !== $card_id;
    }));
  }

  // Save sender state
  $stmt = $pdo->prepare('INSERT INTO game_states (user_id, state_json, updated_at) VALUES (?, ?, NOW())
                         ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = NOW()');
  $stmt->execute([(int)$u['id'], json_encode($senderState, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);

  // Clone card with NEW id for receiver (avoid collisions)
  $newCard = $card;
  $newCard['id'] = bin2hex(random_bytes(8)) . '-' . bin2hex(random_bytes(8));
  $newCard['location'] = 'inventory';
  $newCard['fav'] = false;

  // Queue message for receiver (receiver client applies + saves without logout)
  $payload = [
    'from_username' => (string)$u['username'],
    'card' => $newCard
  ];

  $ins = $pdo->prepare('INSERT INTO trade_messages (from_user_id, to_user_id, payload_json) VALUES (?, ?, ?)');
  $ins->execute([(int)$u['id'], (int)$toUser['id'], json_encode($payload, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);

  $pdo->commit();
  respond(true, ['message'=>'Sent.']);
}catch(Exception $e){
  if ($pdo->inTransaction()) $pdo->rollBack();
  respond(false, ['error'=>$e->getMessage()], 400);
}
