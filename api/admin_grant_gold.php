<?php
require_once __DIR__ . '/../config.php';
require_login();
require_admin();
$pdo = db();

function admin_setup_tables($pdo){
  $pdo->exec("CREATE TABLE IF NOT EXISTS admin_settings (
    id INT PRIMARY KEY,
    force_next_weather_key VARCHAR(32) NULL,
    pack_weights_json TEXT NULL,
    version INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

  $pdo->exec("CREATE TABLE IF NOT EXISTS admin_broadcasts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

  // Ensure row exists
  $st = $pdo->prepare("SELECT id FROM admin_settings WHERE id=1 LIMIT 1");
  $st->execute();
  if(!$st->fetch()){
    $ins = $pdo->prepare("INSERT INTO admin_settings (id, force_next_weather_key, pack_weights_json, version) VALUES (1, NULL, NULL, 0)");
    $ins->execute();
  }
}

function read_json(){
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function json_out($arr, $code=200){
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($arr);
  exit;
}

function php_default_state(){
  $now = (int)(microtime(true)*1000);
  return [
    'gold'=>20000,
    'invCounts'=>['common'=>0,'rare'=>0,'epic'=>0,'mythical'=>0,'legendary'=>0,'cosmic'=>0,'interstellar'=>0],
    'cardsOwned'=>[],
    'cardsInDeck'=>[],
    'petsOwned'=>[],
    'petShopRestockAt'=>$now + 5*60*1000,
    'summoners'=>['selectedId'=>'3dm4rk','owned'=>['3dm4rk'],'levels'=>['3dm4rk'=>1],'nextBonusAt'=>$now+15000,'nextZenoAt'=>$now+60000],
    'towers'=>['stored'=>0,'lastTs'=>$now],
    'decks'=>['A'=>array_fill(0,9,null),'B'=>array_fill(0,9,null)],
    'deckSlotPurchases'=>['A'=>[true,true,true,false,false,false,false,false,false],'B'=>[false,false,false,false,false,false,false,false,false]],
    'weather'=>['currentKey'=>'normal','active'=>false,'endsAt'=>0,'nextEventAt'=>$now + (5*60*1000),'nextStrikeAt'=>0,'strikesDone'=>0,'nextAnnounceAt'=>0,'nextPreviewKey'=>null],
    'notifications'=>['tickets'=>0,'claimed'=>new stdClass()]
  ];
}

function load_user_state($pdo, $user_id){
  $st = $pdo->prepare("SELECT state_json FROM game_states WHERE user_id=? LIMIT 1");
  $st->execute([$user_id]);
  $row = $st->fetch();
  if ($row && !empty($row['state_json'])){
    $decoded = json_decode($row['state_json'], true);
    if (is_array($decoded)) return $decoded;
  }
  return php_default_state();
}
function save_user_state($pdo, $user_id, $state){
  $json = json_encode($state);
  $st = $pdo->prepare("INSERT INTO game_states (user_id, state_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_json=VALUES(state_json)");
  $st->execute([$user_id, $json]);
}
function find_user_by_username($pdo, $username){
  $st = $pdo->prepare("SELECT id, username FROM users WHERE username=? LIMIT 1");
  $st->execute([$username]);
  return $st->fetch();
}

$in = read_json();
$username = trim((string)($in['username'] ?? ''));
$amount = (int)($in['amount'] ?? 0);
if ($username === '') json_out(['ok'=>false,'error'=>'username required'], 400);
if ($amount === 0) json_out(['ok'=>false,'error'=>'amount must be non-zero'], 400);

$u = find_user_by_username($pdo, $username);
if (!$u) json_out(['ok'=>false,'error'=>'User not found'], 404);

$state = load_user_state($pdo, (int)$u['id']);
$state['gold'] = (int)($state['gold'] ?? 0) + $amount;
if ($state['gold'] < 0) $state['gold'] = 0;

save_user_state($pdo, (int)$u['id'], $state);
json_out(['ok'=>true,'new_gold'=>(int)$state['gold']]);
