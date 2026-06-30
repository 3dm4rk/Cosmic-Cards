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

admin_setup_tables($pdo);

$in = read_json();
$force = array_key_exists('force_next_weather_key', $in) ? $in['force_next_weather_key'] : null;
if ($force !== null){
  $force = trim((string)$force);
  if ($force === '') $force = null;
}

$pack = isset($in['pack_weights']) && is_array($in['pack_weights']) ? $in['pack_weights'] : null;
$pack_json = $pack ? json_encode($pack) : null;

$up = $pdo->prepare("UPDATE admin_settings SET force_next_weather_key = ?, pack_weights_json = ?, version = version + 1 WHERE id=1");
$up->execute([$force, $pack_json]);

json_out(['ok'=>true]);
