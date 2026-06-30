<?php
require_once __DIR__ . '/config.php';
start_session();

function __hard_reset_session(){
  if (session_status() !== PHP_SESSION_ACTIVE) session_start();

  // Clear server session array
  $_SESSION = [];

  // Expire cookie (both configured path and "/" fallback)
  if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time()-42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    setcookie(session_name(), '', time()-42000, '/', '', false, true);
  }

  session_destroy();

  // Start brand new session id
  session_start();
  session_regenerate_id(true);
}

// If arriving while another account is logged-in in this browser/tab, force a fresh session.
if (!empty($_SESSION['user_id']) && $_SERVER['REQUEST_METHOD'] !== 'POST') {
  __hard_reset_session();
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  // Prevent session "bleed" from another open tab: rotate session id before switching accounts.
  __hard_reset_session();
  $login = trim((string)($_POST['login'] ?? ''));
  $pass  = (string)($_POST['password'] ?? '');

  if ($login === '' || $pass === '') {
    $error = 'Please enter your username/email and password.';
  } else {
    $pdo = db();
    $stmt = $pdo->prepare('SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ? LIMIT 1');
    $stmt->execute([$login, $login]);
    $u = $stmt->fetch();
    if ($u && password_verify($pass, $u['password_hash'])) {
      session_regenerate_id(true);
      $_SESSION['user_id'] = (int)$u['id'];
      $_SESSION['username'] = (string)$u['username'];
      $_SESSION['email'] = (string)$u['email'];
      // Single-session: generate a per-login token and store it in DB + session.
      $token = random_session_token(64);
      $_SESSION['session_token'] = $token;
      try {
        $st2 = $pdo->prepare("UPDATE users SET active_session_token=?, active_session_at=NOW() WHERE id=?");
        $st2->execute([$token, (int)$u['id']]);
      } catch (Throwable $e) {
        // If columns don't exist yet, login still works.
      }

      session_write_close();
      header('Location: game.php?fresh=1');
      exit;
    } else {
      $error = 'Invalid credentials.';
    }
  }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login • Cosmic Cards</title>
  <link rel="stylesheet" href="styles.css">
  <style>
    .authWrap{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(900px 520px at 30% 20%, rgba(82,255,240,.14), transparent 60%), radial-gradient(900px 520px at 70% 60%, rgba(255,85,135,.12), transparent 60%), #050712;}
    .authCard{width:min(520px, 94vw);border-radius:22px;background:rgba(0,0,0,.48);border:1px solid rgba(255,255,255,.14);box-shadow:0 28px 90px rgba(0,0,0,.6);backdrop-filter: blur(12px);padding:18px;}
    .authTitle{font-size:22px;font-weight:1000;letter-spacing:.2px;margin:2px 0 6px;}
    .authSub{color:rgba(255,255,255,.74);font-size:13px;margin-bottom:14px;}
    .authRow{display:flex;flex-direction:column;gap:8px;margin:10px 0;}
    .authRow label{font-size:12px;color:rgba(255,255,255,.74);}
    .authRow input{height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.25);color:rgba(255,255,255,.92);padding:0 12px;outline:none;}
    .authRow input:focus{border-color: rgba(82,255,240,.45);}
    .authActions{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-top:14px;flex-wrap:wrap;}
    .authError{margin-top:10px;border-radius:14px;padding:10px 12px;background:rgba(255,85,135,.10);border:1px solid rgba(255,85,135,.25);color:rgba(255,255,255,.9);font-size:13px;}
    .authLink{font-size:13px;color:rgba(255,255,255,.74);}
    .authLink a{color:rgba(82,255,240,.95);text-decoration:none;}
    .authLink a:hover{text-decoration:underline;}
  </style>
</head>
<body>
  <div class="authWrap">
    <form class="authCard" method="post" autocomplete="on">
      <div class="authTitle">Login</div>
      <div class="authSub">Enter your account to continue to the arena.</div>

      <div class="authRow">
        <label for="login">Username or Email</label>
        <input id="login" name="login" required value="<?php echo htmlspecialchars($_POST['login'] ?? '', ENT_QUOTES); ?>">
      </div>

      <div class="authRow">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" required>
      </div>

      <div class="authActions">
        <button class="btn btnPrimary" type="submit">Enter Game</button>
        <div class="authLink">No account? <a href="register.php">Create one</a></div>
      </div>

      <?php if ($error): ?>
        <div class="authError"><?php echo htmlspecialchars($error, ENT_QUOTES); ?></div>
      <?php endif; ?>
    </form>
  </div>
</body>
</html>
