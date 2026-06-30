<?php
// admin_abuse.php (PIN-GATED)
// PIN prompt: 062100
session_start();

define('ADMIN_ABUSE_PIN', '062100');

// Optional: ?logout=1 to require PIN again
if (isset($_GET['logout'])) {
  unset($_SESSION['admin_abuse_pin_ok']);
  header('Location: ' . ($_SERVER['PHP_SELF'] ?? 'admin_abuse.php'));
  exit;
}

$__pin_ok = !empty($_SESSION['admin_abuse_pin_ok']);
$__pin_error = '';

// If not PIN-verified, block all admin actions and show PIN prompt
if (!$__pin_ok) {
  // Handle PIN submit
  if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['pin'])) {
    $pin = (string)($_POST['pin'] ?? '');
    if (hash_equals(ADMIN_ABUSE_PIN, $pin)) {
      $_SESSION['admin_abuse_pin_ok'] = 1;
      header('Location: ' . ($_SERVER['PHP_SELF'] ?? 'admin_abuse.php'));
      exit;
    } else {
      $__pin_error = 'Invalid PIN.';
    }
  }

  // If an AJAX admin action is attempted without PIN, deny
  if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'PIN required'], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    exit;
  }

  header('Content-Type: text/html; charset=utf-8');
  ?>
  <!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Admin Abuse — PIN Required</title>
    <style>
      :root { color-scheme: dark; }
      body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#070814; color:#fff; }
      .card { width:min(440px, 92vw); background: rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14);
        border-radius: 16px; padding: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.55); }
      h1 { margin:0 0 8px; font-size: 20px; letter-spacing: .3px; }
      p { margin:0 0 16px; opacity:.85; font-size: 13px; line-height: 1.4; }
      .row { display:flex; gap:10px; }
      input { flex:1; padding: 12px 12px; border-radius: 12px; border:1px solid rgba(255,255,255,0.18);
        background: rgba(0,0,0,0.35); color:#fff; outline:none; font-size: 16px; letter-spacing: 2px; text-align:center; }
      button { padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.18);
        background: linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.10));
        color:#fff; cursor:pointer; font-weight:700; }
      .err { margin-top: 12px; color: #ff7a7a; font-size: 13px; }
      .hint { margin-top: 12px; opacity:.55; font-size: 12px; }
    

    .statsBar{
      margin: 10px auto 16px;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.30);
      box-shadow: 0 18px 48px rgba(0,0,0,.45);
      display:flex;
      align-items:center;
      justify-content:center;
      gap:10px;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .2px;
      color: rgba(255,255,255,.92);
      white-space: nowrap;
      max-width: min(720px, 94vw);
    }
    .statItem b{ font-variant-numeric: tabular-nums; }
    .statSep{ width:1px; height: 16px; background: rgba(255,255,255,.12); }
    @media (max-width: 520px){
      .statsBar{ flex-wrap: wrap; gap:8px; }
      .statSep{ display:none; }
    }


    .livePill{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:6px 10px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.22);
      font-size:11px;
      font-weight: 1000;
      letter-spacing:.6px;
      opacity:.92;
    }
    .liveDot{
      width:10px;height:10px;border-radius:50%;
      background: radial-gradient(circle at 30% 30%, rgba(190,255,220,1), rgba(20,255,120,.9) 60%, rgba(0,120,60,1));
      box-shadow: 0 0 14px rgba(20,255,120,.35);
      display:inline-block;
    }
    .liveDot.off{
      opacity:.35;
      filter: grayscale(1);
      box-shadow:none;
    }



    /* ===== Premium polish ===== */
    .card{
      transition: transform .14s ease, filter .14s ease, border-color .14s ease, background .14s ease;
    }
    .card:hover{
      transform: translateY(-2px);
      filter: brightness(1.03);
      border-color: rgba(255,255,255,.18);
      background: rgba(255,255,255,.07);
    }
    button{
      transition: transform .12s ease, filter .12s ease, background .12s ease;
    }
    button:active{
      transform: translateY(1px) scale(.995);
    }

    .statsBar{
      position: relative;
      gap: 12px;
    }
    #onlineSpark{
      width: 160px;
      height: 34px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.04);
      box-shadow: inset 0 0 12px rgba(0,0,0,.35);
    }
    .updatedAt{
      font-size: 11px;
      opacity: .72;
      font-weight: 900;
      letter-spacing: .2px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.10);
      background: rgba(0,0,0,.20);
      white-space: nowrap;
    }

    /* Number pulse when it changes */
    .statPulse{
      animation: statPulse .35s ease-out;
    }
    @keyframes statPulse{
      0%{ transform: translateY(0) scale(1); filter: brightness(1); }
      60%{ transform: translateY(-1px) scale(1.06); filter: brightness(1.18); }
      100%{ transform: translateY(0) scale(1); filter: brightness(1); }
    }

    /* Toast types */
    .toast.success{
      border-color: rgba(20,255,120,.20);
      box-shadow: 0 18px 48px rgba(0,0,0,.55), 0 0 24px rgba(20,255,120,.12);
    }
    .toast.error{
      border-color: rgba(255,80,80,.22);
      box-shadow: 0 18px 48px rgba(0,0,0,.55), 0 0 24px rgba(255,80,80,.10);
    }

    @media (max-width: 700px){
      #onlineSpark{ width: 140px; }
    }
</style>
  </head>
  <body>
    <div class="card">
      <h1>Enter Admin PIN</h1>
      <p>This admin panel is protected by a PIN. Enter the PIN to continue.</p>
      <form method="POST">
        <div class="row">
          <input name="pin" type="password" inputmode="numeric" autocomplete="one-time-code" placeholder="••••••" required />
          <button type="submit">Unlock</button>
        </div>
        <?php if (!empty($__pin_error)) { echo '<div class="err">' . htmlspecialchars($__pin_error, ENT_QUOTES, 'UTF-8') . '</div>'; } ?>
      </form>
      <div class="hint">Tip: add <code>?logout=1</code> to lock again.</div>
    </div>
  </body>
  </html>
  <?php
  exit;
}

require_once __DIR__ . '/config.php';

// --- Stats (Total / Online / Offline) ---
$__total_players = 0;
$__online_players = 0;
$__offline_players = 0;

try{
  $pdo_stats = db();
  $__total_players = (int)$pdo_stats->query("SELECT COUNT(*) AS c FROM users")->fetchColumn();

  // Keep this TTL consistent with your real-time online dot
  $TTL_SECONDS = 25;
  $st = $pdo_stats->prepare(
    "SELECT COUNT(*) AS c FROM users
     WHERE tab_heartbeat IS NOT NULL
       AND tab_heartbeat <> '0000-00-00 00:00:00'
       AND TIMESTAMPDIFF(SECOND, tab_heartbeat, NOW()) BETWEEN 0 AND ?"
  );
  $st->execute([$TTL_SECONDS]);
  $__online_players = (int)$st->fetchColumn();
  $__offline_players = max(0, $__total_players - $__online_players);
}catch(Throwable $e){
  // keep zeros if query fails
}

header('Content-Type: text/html; charset=utf-8');

function json_response($ok, $payload=[], $http=200){
  http_response_code($http);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(array_merge(['ok'=>$ok], $payload), JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
  exit;
}

// AJAX handler
if ($_SERVER['REQUEST_METHOD']==='POST' && isset($_POST['action'])){
  $pdo = db();
  $action = (string)($_POST['action'] ?? '');

  
  // Fast stats endpoint (AJAX)
  if ($action === 'stats'){
    $TTL_SECONDS = 25;
    try{
      $total = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
      $st = $pdo->prepare(
        "SELECT COUNT(*) FROM users
         WHERE tab_heartbeat IS NOT NULL
           AND tab_heartbeat <> '0000-00-00 00:00:00'
           AND TIMESTAMPDIFF(SECOND, tab_heartbeat, NOW()) BETWEEN 0 AND ?"
      );
      $st->execute([$TTL_SECONDS]);
      $online = (int)$st->fetchColumn();
      $offline = max(0, $total - $online);
      json_response(true, ['total'=>$total,'online'=>$online,'offline'=>$offline]);
    }catch(Throwable $e){
      json_response(false, ['error'=>'Stats query failed'], 500);
    }
  }

// Ensure command queue table exists
  // Compatibility: use LONGTEXT instead of JSON (some MySQL/MariaDB installs are picky about JSON)
  $pdo->exec("CREATE TABLE IF NOT EXISTS admin_commands(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,to_user_id INT NOT NULL,type VARCHAR(64) NOT NULL,payload_json LONGTEXT NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,INDEX(to_user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $pdo->exec("CREATE TABLE IF NOT EXISTS admin_broadcasts(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,message TEXT NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $pdo->exec("CREATE TABLE IF NOT EXISTS admin_globals(`key` VARCHAR(64) PRIMARY KEY,value_json LONGTEXT NOT NULL,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

  $findUserId = function(string $username) use ($pdo){
    $st=$pdo->prepare('SELECT id, username FROM users WHERE username=? LIMIT 1');
    $st->execute([$username]);
    $u=$st->fetch(PDO::FETCH_ASSOC);
    return $u ? (int)$u['id'] : 0;
  };

  $queue = function(int $toUserId, string $type, array $payload) use ($pdo){
    $st=$pdo->prepare('INSERT INTO admin_commands (to_user_id,type,payload_json) VALUES (?,?,?)');
    $st->execute([$toUserId, $type, json_encode($payload, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
  };

  // Online players (real-time)
  // Uses users.tab_heartbeat, updated by api/session_check.php while the player is active.
  // Fallback: recent game_states.updated_at (older clients).
  $onlineUserIds = function() use ($pdo){
    // Online if heartbeat within last ~35 seconds
    $rows=$pdo->query("SELECT id FROM users WHERE tab_heartbeat IS NOT NULL AND tab_heartbeat <> '0000-00-00 00:00:00' AND tab_heartbeat >= (NOW() - INTERVAL 35 SECOND)")->fetchAll(PDO::FETCH_ASSOC);
    $ids=[]; foreach($rows as $r){ $ids[]=(int)$r['id']; }
    if (!empty($ids)) return $ids;

    // Fallback (best-effort): players whose game_states were updated very recently
    $rows=$pdo->query("SELECT DISTINCT user_id FROM game_states WHERE updated_at >= (NOW() - INTERVAL 2 MINUTE)")->fetchAll(PDO::FETCH_ASSOC);
    $ids=[]; foreach($rows as $r){ $ids[]=(int)$r['user_id']; }
    return $ids;
  };


  // Backwards-compat alias (older UI might still send scope=active)
  $activeUserIds = $onlineUserIds;

  // All players
  $allUserIds = function() use ($pdo){
    $rows=$pdo->query("SELECT id FROM users")->fetchAll(PDO::FETCH_ASSOC);
    $ids=[]; foreach($rows as $r){ $ids[]=(int)$r['id']; }
    return $ids;
  };

  // Resolve targets for commands
  $resolveTargets = function(string $scopeRaw, string $userRaw) use ($pdo, $findUserId, $onlineUserIds, $allUserIds){
    $scope=strtolower(trim($scopeRaw));
    if ($scope==='active') $scope='online'; // legacy
    if ($scope==='user') $scope='custom';   // legacy

    if ($scope==='all') {
      return $allUserIds();
    }
    if ($scope==='online') {
      return $onlineUserIds();
    }

    // Custom player name(s)
    $raw = trim($userRaw);
    if ($raw==='') json_response(false,['error'=>'Missing username'],400);

    // Allow comma, newline, or multiple spaces separated usernames
    $parts=preg_split('/[\s,]+/u', $raw, -1, PREG_SPLIT_NO_EMPTY);
    $parts=array_values(array_unique(array_map('trim',$parts)));
    $ids=[];
    $missing=[];
    foreach($parts as $name){
      $uid=$findUserId($name);
      if ($uid) $ids[]=$uid;
      else $missing[]=$name;
    }
    if (!empty($missing)){
      $preview=array_slice($missing,0,5);
      $msg='User not found: '.implode(', ',$preview).(count($missing)>5 ? ' …' : '');
      json_response(false,['error'=>$msg],404);
    }
    // de-dupe ids
    $ids=array_values(array_unique(array_map('intval',$ids)));
    return $ids;
  };


  try{
    if ($action==='grant_gold'){
      $scope=strtolower(trim((string)($_POST['scope'] ?? 'custom')));
      $username=trim((string)($_POST['username'] ?? ''));
      $amount=(float)($_POST['amount'] ?? 0);

      $targets=$resolveTargets($scope, $username);
      foreach($targets as $tid){
        $queue((int)$tid, 'grant_gold', ['amount'=>$amount]);
      }
      json_response(true,['message'=>'Queued gold grant for '.count($targets).' player(s).']);
    }


    if ($action==='grant_diamond'){
      $scope=strtolower(trim((string)($_POST['scope'] ?? 'custom')));
      $username=trim((string)($_POST['username'] ?? ''));
      $amount=(float)($_POST['amount'] ?? 0);

      $targets=$resolveTargets($scope, $username);
      foreach($targets as $tid){
        $queue((int)$tid, 'grant_diamond', ['amount'=>$amount]);
      }
      json_response(true,['message'=>'Queued diamond grant for '.count($targets).' player(s).']);
    }


    if ($action==='add_packs' || $action==='set_packs'){
      $scope=strtolower(trim((string)($_POST['scope'] ?? 'custom')));
      $username=trim((string)($_POST['username'] ?? ''));
      $rarity=strtolower(trim((string)($_POST['rarity'] ?? 'common')));
      $amount=(int)($_POST['amount'] ?? 0);

      $targets=$resolveTargets($scope, $username);
      foreach($targets as $tid){
        $queue((int)$tid, $action, ['rarity'=>$rarity,'amount'=>$amount]);
      }
      json_response(true,['message'=>'Queued pack update for '.count($targets).' player(s).']);
    }

    if ($action==='add_card'){
      $scope=strtolower(trim((string)($_POST['scope'] ?? 'custom')));
      $username=trim((string)($_POST['username'] ?? ''));
      $name=trim((string)($_POST['card_name'] ?? ''));
      $rarity=strtolower(trim((string)($_POST['card_rarity'] ?? 'common')));
      $base_gps=(float)($_POST['base_gps'] ?? 0);
      $img=trim((string)($_POST['img'] ?? ''));
      $mutations=trim((string)($_POST['mutations'] ?? ''));

      if ($name==='') json_response(false,['error'=>'Missing card name'],400);

      $card = [
        'name'=>$name,
        'rarity'=>$rarity,
        'base_gps'=>$base_gps,
        'img'=>$img,
      ];
      if ($mutations!=='') $card['mutations']=$mutations;

      $targets=$resolveTargets($scope, $username);
      foreach($targets as $tid){
        $queue((int)$tid, 'add_card', ['card'=>$card]);
      }
      json_response(true,['message'=>'Queued card add for '.count($targets).' player(s).']);
    }

    if ($action==='force_weather'){
      $scope=strtolower(trim((string)($_POST['scope'] ?? 'online')));
      $username=trim((string)($_POST['username'] ?? ''));
      $key=strtolower(trim((string)($_POST['key'] ?? 'normal')));
      $duration_ms=(int)($_POST['duration_ms'] ?? 90000);

      $targets=$resolveTargets($scope, $username);
      foreach($targets as $tid){
        $queue((int)$tid, 'force_weather', ['key'=>$key,'duration_ms'=>$duration_ms]);
      }
      json_response(true,['message'=>'Queued weather for '.count($targets).' player(s).']);
    }

    if ($action==='reroll_shop'){
      $scope=strtolower(trim((string)($_POST['scope'] ?? 'online')));
      $username=trim((string)($_POST['username'] ?? ''));

      $targets=$resolveTargets($scope, $username);
      foreach($targets as $tid){
        $queue((int)$tid, 'reroll_shop', []);
      }
      json_response(true,['message'=>'Queued shop reroll for '.count($targets).' player(s).']);
    }

    if ($action==='broadcast'){
      $scope=strtolower(trim((string)($_POST['scope'] ?? 'all')));
      $username=trim((string)($_POST['username'] ?? ''));
      $text=trim((string)($_POST['text'] ?? ''));
      if ($text==='') json_response(false,['error'=>'Missing message'],400);

      if ($scope==='all' || $scope===''){
        $st=$pdo->prepare("INSERT INTO admin_broadcasts (message) VALUES (?)");
        $st->execute([$text]);
        json_response(true,['message'=>'Broadcast stored for ALL players.']);
      }

      $targets=$resolveTargets($scope, $username);
      foreach($targets as $tid){
        $queue((int)$tid, 'admin_message', ['text'=>$text]);
      }
      json_response(true,['message'=>'Queued broadcast for '.count($targets).' player(s).']);
    }

    if ($action==='shop_lock_set'){
      $rarity=strtolower(trim((string)($_POST['rarity'] ?? '')));
      $allowed=['common','rare','epic','mythical','legendary','cosmic','interstellar','dragon','valentines','limited edition'];
      if (!in_array($rarity,$allowed,true)) json_response(false,['error'=>'Invalid rarity'],400);

      // Persist as JSON so api/admin_poll.php can reliably json_decode it.
      $payload = json_encode($rarity, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);

      $st=$pdo->prepare("INSERT INTO admin_globals (`key`, value_json) VALUES ('shop_lock', ?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)");
      $st->execute([$payload]);
      json_response(true,['message'=>"Shop lock set to: $rarity"]);
    }

    if ($action==='shop_lock_clear'){
      // Keep NOT NULL column happy by storing JSON null as the literal string 'null'
      $st=$pdo->prepare("INSERT INTO admin_globals (`key`, value_json) VALUES ('shop_lock', 'null') ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)");
      $st->execute();
      json_response(true,['message'=>"Shop lock cleared."]);
    }


    if ($action==='clear_leaderboards'){
      // Best-effort; keep compatible with your schema
      try{ $pdo->exec("UPDATE users SET gold=0"); }catch(Throwable $e){}
      try{ $pdo->exec("UPDATE game_states SET total_gps=0, total_cards=0"); }catch(Throwable $e){}
      json_response(true,['message'=>'Leaderboards cleared (best-effort).']);
    }

    json_response(false,['error'=>'Unknown action'],400);

  }catch(Throwable $e){
    json_response(false,['error'=>'Server error: '.$e->getMessage()],500);
  }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Admin Abuse Panel</title>
  <style>
    body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;background:#070814;color:#eaf0ff;}
    .wrap{max-width:1100px;margin:0 auto;padding:18px;}
    h1{margin:0 0 10px;font-size:22px;}
    .note{opacity:.85;margin:0 0 18px;}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;}
    .card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:14px;box-shadow:0 18px 60px rgba(0,0,0,.35);}
    .card h2{margin:0 0 10px;font-size:14px;letter-spacing:.3px;text-transform:uppercase;opacity:.9;}
    label{display:block;font-size:12px;opacity:.85;margin:10px 0 6px;}
    input,select,textarea{width:100%;box-sizing:border-box;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.35);color:#fff;padding:10px 12px;outline:none;}
    textarea{min-height:90px;resize:vertical;}
    button{margin-top:12px;width:100%;border:0;border-radius:12px;padding:11px 12px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#7c3aed,#22d3ee);color:#0b0b12;}
    button:active{transform:translateY(1px);}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
    .toast{position:fixed;right:14px;bottom:14px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.14);padding:10px 12px;border-radius:14px;max-width:min(520px,92vw);display:none;}
    .toast.show{display:block;}

    .modalOverlay{position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(10px);z-index:99;}

    .danger{color:#ffb4b4;opacity:.95;margin-top:10px;font-size:12px;}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Admin Abuse Panel (NO AUTH)</h1>
    <p class="note">This page queues live commands into <code>admin_commands</code>. Players receive and apply them every 5 seconds via <code>/api/admin_poll.php</code>.</p>
    <div class="statsBar" title="Live counts (tab heartbeat)">
      <span class="livePill"><i class="liveDot" id="statsLiveDot"></i>LIVE</span>
      <span class="statItem">👥 <b id="statTotal"><?php echo (int)$__total_players; ?></b> Total</span>
      <span class="statSep"></span>
      <span class="statItem">🟢 <b id="statOnline"><?php echo (int)$__online_players; ?></b> Online</span>
      <span class="statSep"></span>
      <span class="statItem">⚪ <b id="statOffline"><?php echo (int)$__offline_players; ?></b> Offline</span>
    
      <canvas id="onlineSpark" width="160" height="34" aria-label="Online trend" role="img"></canvas>
      <span class="updatedAt" id="statsUpdatedAt">Updated: --:--:--</span>
    </div>


    <div class="grid">
      <div class="card">
        <h2>Send Gold (Online / All / Custom)</h2>
        <label>Scope</label>
        <select id="goldScope">
          <option value="online">Online players only</option>
          <option value="all">All players (online + offline)</option>
          <option value="custom" selected>Custom player name</option>
        </select>
        <label>Username(s) (only for custom target)</label>
        <input id="goldUser" placeholder="player username" />
        <label>Amount (can be negative)</label>
        <input id="goldAmt" type="number" step="1" value="1000" />
        <button onclick="doGold()">Queue Gold</button>
      </div>

      <div class="card">
        <h2>Send Diamonds (Specific Player)</h2>
        <label>Username</label>
        <input id="diamondUser" placeholder="player username" />
        <label>Amount (can be negative)</label>
        <input id="diamondAmt" type="number" step="1" value="10" />
        <button onclick="doDiamond()">Queue Diamonds</button>
        <div class="hint">This sends diamonds to a specific player only.</div>
      </div>


      <div class="card">
        <h2>Modify Pack Stock (User / Active / All)</h2>
        <label>Scope</label>
        <select id="packScope">
          <option value="online">Online players only</option>
          <option value="all">All players (online + offline)</option>
          <option value="custom" selected>Custom player name</option>
        </select>
        <label>Username(s) (only for custom target)</label>
        <input id="packUser" placeholder="player username" />
        <div class="row">
          <div>
            <label>Rarity</label>
            <select id="packRarity">
              <option>common</option>
              <option>rare</option>
              <option>epic</option>
              <option>mythical</option>
              <option>legendary</option>
              <option>cosmic</option>
              <option>interstellar</option>
              <option>dragon</option>
              <option>valentines</option>
              <option>limited edition</option>
            </select>
          </div>
          <div>
            <label>Amount</label>
            <input id="packAmt" type="number" step="1" value="5" />
          </div>
        </div>
        <div class="row">
          <button onclick="doPacks('add_packs')">Add Packs</button>
          <button onclick="doPacks('set_packs')">Set Packs</button>
        </div>
        <div class="danger">This controls the player's Inventory pack counts (the most practical "shop stock" lever without rewriting shop RNG).</div>
      </div>

      <div class="card">
        <h2>Generate / Send Card (User / Active / All)</h2>
        <label>Scope</label>
        <select id="cardScope">
          <option value="online">Online players only</option>
          <option value="all">All players (online + offline)</option>
          <option value="custom" selected>Custom player name</option>
        </select>
        <label>Username(s) (only for custom target)</label>
        <input id="cardUser" placeholder="player username" />
        <div class="row">
          <div>
            <label>Card Name</label>
            <input id="cardName" placeholder="Portia the God of Love" />
          </div>
          <div>
            <label>Rarity</label>
            <select id="cardRarity">
              <option>common</option>
              <option>rare</option>
              <option>epic</option>
              <option>mythical</option>
              <option>legendary</option>
              <option>cosmic</option>
              <option>interstellar</option>
              <option>valentines</option>
              <option>limited edition</option>
            </select>
          </div>
        </div>
        <div class="row">
          <div>
            <label>Base GPS</label>
            <input id="cardGps" type="number" step="1" value="0" />
          </div>
          <div>
            <label>Image Path</label>
            <input id="cardImg" value="card.png" placeholder="cards/portia.png" />
          </div>
        </div>
        <label>Mutations (comma separated, e.g. Gold,Love,Thunder)</label>
        <input id="cardMuts" placeholder="Gold" />
        <button onclick="doCard()">Queue Card</button>
      </div>

      <div class="card">
        <h2>Force Weather (User / Active / All)</h2>
        <label>Scope</label>
        <select id="wxScope">
          <option value="online">Online players only</option>
          <option value="all">All players (online + offline)</option>
          <option value="custom" >Custom player name</option>
        </select>
        <label>Username(s) (only for custom target)</label>
        <input id="wxUser" placeholder="player username" />
        <div class="row">
          <div>
            <label>Weather</label>
            <select id="wxKey">
              <option value="normal">normal</option>
              <option value="spacestorm">spacestorm</option>
              <option value="antigravity">antigravity</option>
              <option value="ascension">ascension</option>
              <option value="multiverse">multiverse</option>
              <option value="cupid">cupid</option>
              <option value="bloodmoon">bloodmoon</option>
              <option value="solarflare">solarflare</option>
              <option value="eclipse">eclipse</option>
              <option value="secret">secret</option>
            </select>
          </div>
          <div>
            <label>Duration (ms)</label>
            <input id="wxDur" type="number" step="1000" value="90000" />
          </div>
        </div>
        <button onclick="doWeather()">Queue Weather</button>
      </div>

      <div class="card">
        <h2>Reroll Main Shop Cards (User / Active / All)</h2>
        <label>Scope</label>
        <select id="shopScope">
          <option value="online">Online players only</option>
          <option value="all">All players (online + offline)</option>
          <option value="custom" >Custom player name</option>
        </select>
        <label>Username(s) (only for custom target)</label>
        <input id="shopUser" placeholder="player username" />
        <button onclick="doReroll()">Queue Shop Reroll</button>
      </div>

      <div class="card">
        <h2>Global Admin Message (Upper-left)</h2>
        <label>Target</label>
        <select id="broadcastScope">
          <option value="online">Online players only</option>
          <option value="all" selected>All players (online + offline)</option>
          <option value="custom">Custom player name</option>
        </select>
        <label>Username(s) (only for custom target)</label>
        <input id="broadcastUser" placeholder="e.g. player1, player2" />
        <label>Message</label>
        <textarea id="msgText" placeholder="Server maintenance in 2 minutes..."></textarea>
        <button onclick="doBroadcast()">Send Message</button>
      </div>

      <div class="card">
        <h2>🛒 Main Shop Stock Lock (Always show 1 rarity)</h2>
        <div class="danger">Forces the Main Shop RNG to only roll the selected rarity (Common → Interstellar). Applies to all players in real time.</div>
        <label>Locked Rarity</label>
        <select id="shopLockRarity">
          <option>common</option>
          <option>rare</option>
          <option>epic</option>
          <option>mythical</option>
          <option>legendary</option>
          <option>cosmic</option>
          <option>interstellar</option>
          <option>dragon</option>
        </select>
        <div class="row">
          <button onclick="doShopLock()">Apply Lock</button>
          <button onclick="doShopNormal()">Back to Normal</button>
        </div>
      </div>
    
      <div class="card">
        <h2>🧹 Clear Leaderboards</h2>
        <div class="danger">Resets ALL stored leaderboard scores back to <b>0</b>. This cannot be undone.</div>
        <button onclick="openClearLbModal()">Clear Leaderboards</button>
      </div>

    </div>

    <p class="danger" style="margin-top:16px;">SECURITY WARNING: This panel has NO AUTH. Anyone who can access this URL can abuse it. Use only locally / behind your own protection.</p>
  </div>


  <!-- Clear Leaderboards Confirm Modal -->
  <div id="clearLbOverlay" class="modalOverlay" style="display:none;align-items:center;justify-content:center;padding:18px;">
    <div class="card" style="width:min(520px,92vw);">
      <h2 style="margin-top:0;">Confirm Reset</h2>
      <div style="opacity:.9;line-height:1.4;">
        Are you sure you want to reset <b>all</b> leaderboard scores to <b>0</b>?
      </div>
      <div class="row" style="margin-top:12px;">
        <button onclick="confirmClearLb()" style="background:linear-gradient(135deg,#ef4444,#fb7185);color:#12060b;">Yes, Reset</button>
        <button onclick="closeClearLbModal()" style="background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.14);color:#fff;">No</button>
      </div>
    </div>
  </div>


  <div id="toast" class="toast"></div>

  <script>
    async function post(action, data){
      const fd = new FormData();
      fd.append('action', action);
      for (const [k,v] of Object.entries(data||{})) fd.append(k, String(v));
      const res = await fetch('admin_abuse.php', { method:'POST', body:fd });
      const j = await res.json().catch(()=>({ok:false,error:'bad_json'}));
      if (!res.ok || !j.ok) throw new Error(j.error || 'request_failed');
      return j;
    }

    function toast(msg){
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(toast._t);
      toast._t = setTimeout(()=> el.classList.remove('show'), 3500);
    }

    async function doGold(){
      try{
        const j = await post('grant_gold', { scope: goldScope.value, username: goldUser.value, amount: goldAmt.value });
        toast(j.message || 'Queued', 'success');
      }catch(e){ toast(e.message, 'error'); }
    }

    async function doDiamond(){
      try{
        const user = (diamondUser?.value||"").trim();
        if (!user){ toast("Missing username"); return; }
        const j = await post('grant_diamond', { scope: 'custom', username: user, amount: diamondAmt.value });
        toast(j.message || 'Queued', 'success');
      }catch(e){ toast(e.message, 'error'); }
    }

    async function doPacks(kind){
      try{
        const j = await post(kind, { scope: packScope.value, username: packUser.value, rarity: packRarity.value, amount: packAmt.value });
        toast(j.message || 'Queued', 'success');
      }catch(e){ toast(e.message, 'error'); }
    }
    async function doCard(){
      try{
        const j = await post('add_card', { scope: cardScope.value, username: cardUser.value, card_name: cardName.value, card_rarity: cardRarity.value, base_gps: cardGps.value, img: cardImg.value, mutations: cardMuts.value });
        toast(j.message || 'Queued', 'success');
      }catch(e){ toast(e.message, 'error'); }
    }
    async function doWeather(){
      try{
        const j = await post('force_weather', { scope: wxScope.value, username: wxUser.value, key: wxKey.value, duration_ms: wxDur.value });
        toast(j.message || 'Queued', 'success');
      }catch(e){ toast(e.message, 'error'); }
    }
    async function doReroll(){
      try{
        const j = await post('reroll_shop', { scope: shopScope.value, username: shopUser.value });
        toast(j.message || 'Queued', 'success');
      }catch(e){ toast(e.message, 'error'); }
    }
    async function doBroadcast(){
      try{
        const j = await post('broadcast', { scope: broadcastScope.value, username: broadcastUser.value, text: msgText.value });
        toast(j.message || 'Queued', 'success');
      }catch(e){ toast(e.message, 'error'); }
    }

    async function doShopLock(){
      try{
        const j = await post('shop_lock_set', { rarity: shopLockRarity.value });
        toast(j.message || 'Applied', 'success');
      }catch(e){ toast(e.message, 'error'); }
    }
    async function doShopNormal(){
      try{
        const j = await post('shop_lock_clear', {});
        toast(j.message || 'Cleared', 'success');
      }catch(e){ toast(e.message, 'error'); }
    }
    // ==== Clear Leaderboards Confirm Modal ====
    function openClearLbModal(){
      const o = document.getElementById('clearLbOverlay');
      if (!o) return;
      o.style.display = 'flex';
      o.setAttribute('aria-hidden','false');
    }
    function closeClearLbModal(){
      const o = document.getElementById('clearLbOverlay');
      if (!o) return;
      o.style.display = 'none';
      o.setAttribute('aria-hidden','true');
    }
    async function confirmClearLb(){
      try{
        const j = await post('clear_leaderboards', {});
        toast(j.message || 'Leaderboards cleared', 'success');
      }catch(e){ toast(e.message, 'error'); }finally{
        closeClearLbModal();
      }
    }
    // Close modal when clicking outside card
    document.addEventListener('click', (e)=>{
      const o = document.getElementById('clearLbOverlay');
      if (!o || o.style.display === 'none') return;
      if (e.target === o) closeClearLbModal();
    });
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape') closeClearLbModal();
    });


    // --- Live header stats (premium: animated counters + sparkline) ---
    const statTotalEl = document.getElementById('statTotal');
    const statOnlineEl = document.getElementById('statOnline');
    const statOfflineEl = document.getElementById('statOffline');
    const liveDot = document.getElementById('statsLiveDot');
    const updatedAtEl = document.getElementById('statsUpdatedAt');

    const spark = document.getElementById('onlineSpark');
    const sparkCtx = spark ? spark.getContext('2d') : null;

    // Keep a short history (about 4 minutes at 5s interval => 48 points)
    const onlineHistory = [];
    const HISTORY_MAX = 48;

    const counters = {
      total: { current: Number(statTotalEl?.textContent||0), target: Number(statTotalEl?.textContent||0) },
      online:{ current: Number(statOnlineEl?.textContent||0), target: Number(statOnlineEl?.textContent||0) },
      offline:{ current:Number(statOfflineEl?.textContent||0), target: Number(statOfflineEl?.textContent||0) },
    };

    function pulse(el){
      if (!el) return;
      el.classList.remove('statPulse');
      void el.offsetWidth;
      el.classList.add('statPulse');
    }

    function setUpdatedAt(){
      if (!updatedAtEl) return;
      const d = new Date();
      const hh = String(d.getHours()).padStart(2,'0');
      const mm = String(d.getMinutes()).padStart(2,'0');
      const ss = String(d.getSeconds()).padStart(2,'0');
      updatedAtEl.textContent = `Updated: ${hh}:${mm}:${ss}`;
    }

    function animateCounters(){
      const step = () => {
        let any = false;
        for (const k of Object.keys(counters)){
          const c = counters[k];
          const diff = c.target - c.current;
          if (Math.abs(diff) > 0.01){
            any = true;
            c.current += diff * 0.20;
          }else{
            c.current = c.target;
          }
        }
        if (statTotalEl) statTotalEl.textContent = String(Math.round(counters.total.current));
        if (statOnlineEl) statOnlineEl.textContent = String(Math.round(counters.online.current));
        if (statOfflineEl) statOfflineEl.textContent = String(Math.round(counters.offline.current));
        if (any) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    function drawSparkline(){
      if (!sparkCtx || !spark) return;
      const w = spark.width, h = spark.height;
      sparkCtx.clearRect(0,0,w,h);

      sparkCtx.fillStyle = 'rgba(0,0,0,0.18)';
      sparkCtx.fillRect(0,0,w,h);

      const n = onlineHistory.length;
      if (n < 2) return;

      const minV = Math.min(...onlineHistory);
      const maxV = Math.max(...onlineHistory);
      const pad = 4;

      const range = Math.max(1, maxV - minV);
      const xStep = (w - pad*2) / (HISTORY_MAX - 1);

      sparkCtx.beginPath();
      for (let i=0;i<n;i++){
        const v = onlineHistory[i];
        const x = pad + i * xStep;
        const y = (h - pad) - ((v - minV) / range) * (h - pad*2);
        if (i === 0) sparkCtx.moveTo(x,y);
        else sparkCtx.lineTo(x,y);
      }
      sparkCtx.strokeStyle = 'rgba(255,255,255,0.80)';
      sparkCtx.lineWidth = 2;
      sparkCtx.stroke();

      sparkCtx.lineTo(pad + (n-1)*xStep, h - pad);
      sparkCtx.lineTo(pad, h - pad);
      sparkCtx.closePath();
      sparkCtx.fillStyle = 'rgba(255,255,255,0.08)';
      sparkCtx.fill();

      const last = onlineHistory[n-1];
      const x = pad + (n-1) * xStep;
      const y = (h - pad) - ((last - minV) / range) * (h - pad*2);
      sparkCtx.beginPath();
      sparkCtx.arc(x, y, 2.6, 0, Math.PI*2);
      sparkCtx.fillStyle = 'rgba(255,255,255,0.95)';
      sparkCtx.fill();
    }

    async function refreshStats(){
      try{
        const j = await post('stats', {});
        const total = Number(j.total ?? 0);
        const online = Number(j.online ?? 0);
        const offline = Number(j.offline ?? 0);

        const prevTotal = counters.total.target;
        const prevOnline = counters.online.target;
        const prevOffline = counters.offline.target;

        counters.total.target = total;
        counters.online.target = online;
        counters.offline.target = offline;

        if (total !== prevTotal) pulse(statTotalEl);
        if (online !== prevOnline) pulse(statOnlineEl);
        if (offline !== prevOffline) pulse(statOfflineEl);

        animateCounters();

        onlineHistory.push(online);
        while (onlineHistory.length > HISTORY_MAX) onlineHistory.shift();
        drawSparkline();

        setUpdatedAt();
        if (liveDot) liveDot.classList.remove('off');
      }catch(e){
        if (liveDot) liveDot.classList.add('off');
      }
    }

    // Upgrade toast: success/error styling (backwards compatible)
    const _toastFn = toast;
    window.toast = function(msg, type){
      const el = document.getElementById('toast');
      if (el){
        el.classList.remove('success','error');
        if (type === 'success') el.classList.add('success');
        if (type === 'error') el.classList.add('error');
      }
      _toastFn(msg);
    };

    refreshStats();
    setInterval(refreshStats, 5000);
</script>
</body>
</html>
