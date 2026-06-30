<?php
require_once __DIR__.'/../config.php';
require_login();
header('Content-Type: application/json; charset=utf-8');
$u=current_user();
$pdo=db();
$raw=file_get_contents('php://input');
$data=json_decode($raw,true);
if(!is_array($data)) $data=[];
$state=$data['state']??null;
if(!is_array($state) && is_string($state)) $state=json_decode($state,true);
if(!is_array($state)){ http_response_code(400); echo json_encode(['ok'=>false,'error'=>'missing_state']); exit; }
$json=json_encode($state,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
$now=date('Y-m-d H:i:s');

// IMPORTANT FIX (packs returning after refresh):
// If the game_states table does NOT have a UNIQUE key on user_id, then
// "ON DUPLICATE KEY" never triggers and multiple rows can be created.
// Then game.php/get_state.php may read an older row (LIMIT 1) and it looks
// like packs "come back" on refresh.
//
// To be robust even without schema changes, force a single latest row
// by deleting any previous rows for this user, then inserting the new snapshot.
try{
  $pdo->beginTransaction();
  $pdo->prepare('DELETE FROM game_states WHERE user_id = ?')->execute([$u['id']]);
  $pdo->prepare('INSERT INTO game_states (user_id, state_json, updated_at) VALUES (?,?,?)')->execute([$u['id'], $json, $now]);
  $pdo->commit();
}catch(Throwable $e){
  if($pdo->inTransaction()) $pdo->rollBack();
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'db_save_failed'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
  exit;
}
$gps=(int)($data['current_gps']??0); if($gps<0) $gps=0;
$st2=$pdo->prepare('UPDATE users SET highest_gps=GREATEST(highest_gps, ?) WHERE id=?');
$st2->execute([$gps,$u['id']]);
echo json_encode(['ok'=>true],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
