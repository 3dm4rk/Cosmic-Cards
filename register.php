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

// If you open Register while logged in (common on shared browsers), force a fresh session.
if (!empty($_SESSION['user_id']) && $_SERVER['REQUEST_METHOD'] !== 'POST') {
  __hard_reset_session();
}

$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  // Rotate session id to avoid other open tabs writing the old account back into this session.
  __hard_reset_session();

  $username = trim((string)($_POST['username'] ?? ''));
  $email    = trim((string)($_POST['email'] ?? ''));
  $pass1    = (string)($_POST['password'] ?? '');
  $pass2    = (string)($_POST['password2'] ?? '');

  if ($username === '' || $email === '' || $pass1 === '') {
    $error = 'Please fill in all fields.';
  } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $error = 'Please use a valid email address.';
  } elseif (strlen($pass1) < 6) {
    $error = 'Password must be at least 6 characters.';
  } elseif ($pass1 !== $pass2) {
    $error = 'Passwords do not match.';
  } else {
    $pdo = db();

    // Unique checks
    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1');
    $stmt->execute([$username, $email]);

    if ($stmt->fetch()) {
      $error = 'Username or email is already taken.';
    } else {
      $hash = password_hash($pass1, PASSWORD_DEFAULT);
      $ins = $pdo->prepare('INSERT INTO users(username,email,password_hash,created_at) VALUES(?,?,?,NOW())');
      $ins->execute([$username, $email, $hash]);

      // IMPORTANT: Do NOT auto-login after registration.
      // Keep the session empty so a previous account session cannot "bleed" into this flow.
      $_SESSION = [];
      if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
      }

      $success = 'Account created successfully. You can now log in.';
    }
  }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Register • Cosmic Cards</title>
  <link rel="stylesheet" href="styles.css">
  <style>
    .authWrap{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(900px 520px at 30% 20%, rgba(82,255,240,.14), transparent 60%), radial-gradient(900px 520px at 70% 60%, rgba(255,85,135,.12), transparent 60%), #050712;}
    .authCard{width:min(560px, 94vw);border-radius:22px;background:rgba(0,0,0,.48);border:1px solid rgba(255,255,255,.14);box-shadow:0 28px 90px rgba(0,0,0,.6);backdrop-filter: blur(12px);padding:18px;}
    .authTitle{font-size:22px;font-weight:1000;letter-spacing:.2px;margin:2px 0 6px;}
    .authSub{color:rgba(255,255,255,.74);font-size:13px;margin-bottom:14px;}
    .grid2{display:grid;grid-template-columns: 1fr 1fr;gap:10px;}
    @media (max-width:560px){ .grid2{grid-template-columns:1fr;} }
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
      <div class="authTitle">Create Account</div>
      <div class="authSub">Register once, then your progress saves to the database.</div>

      <div class="grid2">
        <div class="authRow">
          <label for="username">Username</label>
          <input id="username" name="username" required value="<?php echo htmlspecialchars($_POST['username'] ?? '', ENT_QUOTES); ?>">
        </div>
        <div class="authRow">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" required value="<?php echo htmlspecialchars($_POST['email'] ?? '', ENT_QUOTES); ?>">
        </div>
      </div>

      <div class="grid2">
        <div class="authRow">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" required>
        </div>
        <div class="authRow">
          <label for="password2">Confirm Password</label>
          <input id="password2" name="password2" type="password" required>
        </div>
      </div>

      <div class="authActions">
        <button class="btn btnPrimary" type="submit">Create Account</button>
        <div class="authLink">Already have an account? <a href="login.php">Login</a></div>
      </div>

      <?php if ($success): ?>
        <div class="authError" style="background: rgba(82,255,240,.10); border-color: rgba(82,255,240,.25);">
          <?php echo htmlspecialchars($success, ENT_QUOTES); ?>
          <div style="margin-top:8px;">
            <a href="login.php" style="color: rgba(82,255,240,.95); text-decoration:none; font-weight:800;">Go to Login →</a>
          </div>
        </div>
      <?php endif; ?>

      <?php if ($error): ?>
        <div class="authError"><?php echo htmlspecialchars($error, ENT_QUOTES); ?></div>
      <?php endif; ?>
    </form>
  </div>
</body>
</html>
