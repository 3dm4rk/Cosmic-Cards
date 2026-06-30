<?php
require_once __DIR__.'/../config.php';
require_login();
header('Content-Type: application/json; charset=utf-8');
$u=current_user();$pdo=db();
$pdo->prepare('DELETE FROM game_states WHERE user_id=?')->execute([$u['id']]);
$pdo->prepare('UPDATE users SET highest_gps=0 WHERE id=?')->execute([$u['id']]);
echo json_encode(['ok'=>true],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
