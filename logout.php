<?php
// logout.php
// Reliable logout for both GET navigation and POST/AJAX.
// - Recommended: navigate to logout.php (GET). This ensures the request completes.
// - POST: returns JSON.

if (session_status() !== PHP_SESSION_ACTIVE) session_start();

$userId = $_SESSION['user_id'] ?? null;
$token  = $_SESSION['session_token'] ?? null;

// Best-effort: release active session token in DB
if ($userId && $token) {
  try {
    require_once __DIR__ . '/config.php';
    $pdo = db();
    $st = $pdo->prepare("UPDATE users SET active_session_token=NULL WHERE id=? AND active_session_token=?");
    $st->execute([(int)$userId, (string)$token]);

    // Also clear single-tab lock if present
    try {
      $pdo->exec("ALTER TABLE users ADD COLUMN active_tab_token VARCHAR(64) DEFAULT NULL");
    } catch (Throwable $e) {}
    try {
      $pdo->exec("ALTER TABLE users ADD COLUMN tab_heartbeat INT DEFAULT NULL");
    } catch (Throwable $e) {}
    try {
      $st2 = $pdo->prepare("UPDATE users SET active_tab_token=NULL, tab_heartbeat=NULL WHERE id=?");
      $st2->execute([$userId]);
    } catch (Throwable $e) {}

  } catch (Throwable $e) {
    // ignore
  }
}



// Clear server-side session
$_SESSION = [];

// Expire cookie with configured params + safe "/" fallback
if (ini_get('session.use_cookies')) {
  $p = session_get_cookie_params();
  setcookie(session_name(), '', time()-42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
  setcookie(session_name(), '', time()-42000, '/', '', false, true);
}

session_destroy();

// Ensure changes are written
if (session_status() === PHP_SESSION_ACTIVE) {
  session_write_close();
}

// Default redirect target (allow override via ?next=...)
$next = $_GET['next'] ?? 'login.php';
// Safety: only allow same-site relative targets
if (!is_string($next) || $next === '' || strpos($next, '://') !== false || str_starts_with($next, '//')) {
  $next = 'login.php';
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  header('Location: ' . $next);
  exit;
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode(['ok'=>true]);
