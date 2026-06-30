<?php
// config.php - DB + session auth helpers
const DB_HOST='127.0.0.1';
const DB_NAME='cosmic_cards';
const DB_USER='root';
const DB_PASS='';
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
function db(){
  static $pdo=null;
  if($pdo) return $pdo;
  $dsn='mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4';
  $pdo=new PDO($dsn,DB_USER,DB_PASS,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
  return $pdo;
}
function current_user(){
  if(empty($_SESSION['user_id'])) return null;
  $pdo=db();
  $st=$pdo->prepare('SELECT id,username,email,highest_gps FROM users WHERE id=? LIMIT 1');
  $st->execute([$_SESSION['user_id']]);
  $u=$st->fetch();
  return $u?:null;
}
function require_login(){
  if(!current_user()){
    header('Location: login.php');
    exit;
  }
}


// Back-compat helper (older pages call start_session())
function start_session(){
  if (session_status() !== PHP_SESSION_ACTIVE) session_start();
}


// Single-session helper
if (!function_exists('random_session_token')) {
  function random_session_token(int $length = 64): string {
    // 64 hex chars = 32 bytes
    return bin2hex(random_bytes((int)($length/2)));
  }
}

