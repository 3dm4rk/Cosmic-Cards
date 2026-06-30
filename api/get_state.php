<?php
require_once __DIR__ . '/../config.php';
header('Content-Type: application/json; charset=utf-8');
require_login();
$u = current_user();
$pdo = db();

$stmt = $pdo->prepare('SELECT state_json FROM game_states WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1');
$stmt->execute([$u['id']]);
$row = $stmt->fetch();
echo json_encode([
  'ok' => true,
  'state' => $row ? json_decode($row['state_json'], true) : null
]);
