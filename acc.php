<?php
// ================================
// ADMIN ACCOUNTS VIEWER + RESET PW
// ================================

// ✅ CHANGE THESE:
$DB_HOST = "127.0.0.1";
$DB_NAME = "cosmic_cards";   // <-- your DB name
$DB_USER = "root";
$DB_PASS = "";

// ✅ CHANGE THESE to match your table/columns:
$TABLE_NAME = "users";
$COL_ID     = "id";
$COL_USER   = "username";
$COL_PASS   = "password_hash"; // <-- IMPORTANT: your real password/hash column name

// --------------------
// PDO connect
// --------------------
try {
    $pdo = new PDO(
        "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (Exception $e) {
    http_response_code(500);
    die("DB Connection Failed: " . htmlspecialchars($e->getMessage()));
}

// --------------------
// Helpers
// --------------------
function looks_like_hash($p) {
    if (!$p) return false;
    return str_starts_with($p, '$2y$') || str_starts_with($p, '$argon2');
}

function gen_temp_password($len = 10) {
    $chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    $out = "";
    for ($i=0; $i<$len; $i++) $out .= $chars[random_int(0, strlen($chars)-1)];
    return $out;
}

// --------------------
// Reset password handler
// --------------------
$flash = "";
$tempShown = ""; // will show temp password once after action

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'reset_pw') {
    $id = isset($_POST['user_id']) ? (int)$_POST['user_id'] : 0;

    // Mode: manual or auto temp
    $mode = $_POST['mode'] ?? 'temp';

    if ($id <= 0) {
        $flash = "Invalid user.";
    } else {
        try {
            if ($mode === 'manual') {
                $newPw = (string)($_POST['new_password'] ?? '');
                if (strlen($newPw) < 6) {
                    $flash = "Password too short (min 6).";
                } else {
                    $hash = password_hash($newPw, PASSWORD_DEFAULT);
                    $stmt = $pdo->prepare("UPDATE {$TABLE_NAME} SET {$COL_PASS} = ? WHERE {$COL_ID} = ?");
                    $stmt->execute([$hash, $id]);
                    $flash = "✅ Password reset successfully (manual).";
                }
            } else {
                // temp password
                $tempPw = gen_temp_password(10);
                $hash = password_hash($tempPw, PASSWORD_DEFAULT);
                $stmt = $pdo->prepare("UPDATE {$TABLE_NAME} SET {$COL_PASS} = ? WHERE {$COL_ID} = ?");
                $stmt->execute([$hash, $id]);

                $flash = "✅ Temporary password generated and set.";
                $tempShown = $tempPw; // shown once on page load after POST
            }
        } catch (Exception $e) {
            $flash = "Reset failed: " . htmlspecialchars($e->getMessage());
        }
    }
}

// --------------------
// Fetch accounts
// --------------------
$sql = "SELECT {$COL_ID} AS id, {$COL_USER} AS username, {$COL_PASS} AS passcol
        FROM {$TABLE_NAME}
        ORDER BY {$COL_ID} DESC";

try {
    $accounts = $pdo->query($sql)->fetchAll();
} catch (Exception $e) {
    http_response_code(500);
    die("Query Failed: " . htmlspecialchars($e->getMessage()) . "<br><br>Check your table/column names.");
}
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Admin - Accounts</title>
    <style>
        body{margin:0;padding:24px;background:#0b0b0f;color:#eaeaea;font-family:Arial,sans-serif}
        .wrap{max-width:1200px;margin:0 auto}
        h1{margin:0 0 10px 0;font-size:22px}
        .note{margin:0 0 12px 0;color:#b9b9b9;font-size:13px;line-height:1.4}
        .flash{margin:0 0 14px 0;padding:10px 12px;border:1px solid #2a2a2a;border-radius:10px;background:#101018}
        .warn{background:#1a0f12;border:1px solid #ff4d6d33;padding:12px 14px;border-radius:10px;margin:0 0 14px 0;color:#ff9aaa;font-size:13px}
        .ok{background:#0f1a14;border-color:#2d7a46;color:#9ff0b8}
        .bar{display:flex;gap:10px;align-items:center;margin:0 0 16px 0}
        input[type="text"]{flex:1;padding:10px 12px;border-radius:10px;border:1px solid #2b2b2b;background:#111118;color:#fff;outline:none}
        table{width:100%;border-collapse:collapse;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.35)}
        thead th{background:#12121a;color:#ff4d6d;text-align:left;padding:12px 12px;font-size:13px;border-bottom:1px solid #222}
        tbody td{padding:12px 12px;border-bottom:1px solid #1d1d1d;font-size:13px;vertical-align:top}
        tbody tr:hover{background:#0f0f15}
        .mono{font-family:Consolas,monospace;font-size:12px;word-break:break-all;color:#cfcfcf}
        .tag{display:inline-block;padding:3px 8px;border-radius:999px;font-size:12px;border:1px solid #333;color:#ddd;background:#14141c}
        .tag.good{border-color:#2d7a46;color:#9ff0b8;background:#0f1a14}
        .tag.bad{border-color:#7a2d2d;color:#ffb0b0;background:#1a0f0f}
        .btn{cursor:pointer;padding:8px 10px;border-radius:10px;border:1px solid #2b2b2b;background:#14141c;color:#fff}
        .btn:hover{background:#1a1a25}
        .modalBack{position:fixed;inset:0;background:rgba(0,0,0,.65);display:none;align-items:center;justify-content:center;padding:18px}
        .modal{width:min(720px,100%);background:#0f0f15;border:1px solid #2b2b2b;border-radius:16px;padding:16px;box-shadow:0 20px 60px rgba(0,0,0,.6)}
        .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .modal h2{margin:0 0 10px 0;font-size:18px}
        .modal input{padding:10px 12px;border-radius:10px;border:1px solid #2b2b2b;background:#111118;color:#fff;outline:none;flex:1;min-width:220px}
        .small{color:#9a9a9a;font-size:12px}
    </style>
</head>
<body>
<div class="wrap">
    <h1>👑 Admin Accounts Viewer</h1>
    <p class="note">
        You <b>cannot</b> reverse hashes to passwords. Use <b>Reset Password</b> instead.
    </p>

    <?php if ($flash): ?>
        <div class="flash <?= $tempShown ? 'ok' : '' ?>"><?= htmlspecialchars($flash) ?></div>
    <?php endif; ?>

    <?php if ($tempShown): ?>
        <div class="warn ok">
            Temporary password (shown once): <b class="mono"><?= htmlspecialchars($tempShown) ?></b><br>
            <span class="small">Copy it now. Refreshing will not show it again.</span>
        </div>
    <?php else: ?>
        <div class="warn">
            ⚠ If your DB stores readable passwords, that’s insecure. Store hashes only.
        </div>
    <?php endif; ?>

    <div class="bar">
        <input id="search" type="text" placeholder="Search username...">
        <span class="small">Total: <b id="count"><?= count($accounts) ?></b></span>
    </div>

    <table id="tbl">
        <thead>
            <tr>
                <th style="width:70px;">ID</th>
                <th style="width:240px;">Username</th>
                <th style="width:120px;">Type</th>
                <th>Password (hash)</th>
                <th style="width:150px;">Actions</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($accounts as $a):
            $pwd = (string)($a['passcol'] ?? '');
            $isHash = looks_like_hash($pwd);
        ?>
            <tr>
                <td><?= htmlspecialchars($a['id']) ?></td>
                <td class="u"><?= htmlspecialchars($a['username']) ?></td>
                <td>
                    <?= $isHash ? '<span class="tag good">HASH</span>' : '<span class="tag bad">UNSAFE</span>' ?>
                </td>
                <td class="mono"><?= htmlspecialchars($pwd) ?></td>
                <td>
                    <button class="btn" onclick="openReset(<?= (int)$a['id'] ?>,'<?= htmlspecialchars($a['username'], ENT_QUOTES) ?>')">
                        Reset Password
                    </button>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>

<!-- Modal -->
<div class="modalBack" id="modalBack" onclick="closeModal(event)">
    <div class="modal" onclick="event.stopPropagation()">
        <h2>Reset Password</h2>
        <div class="small" id="who"></div>
        <div style="height:10px"></div>

        <form method="POST">
            <input type="hidden" name="action" value="reset_pw">
            <input type="hidden" name="user_id" id="user_id" value="">

            <div class="row">
                <button class="btn" type="submit" name="mode" value="temp">
                    Generate TEMP password
                </button>

                <span class="small">or set manual:</span>

                <input type="text" name="new_password" placeholder="New password (min 6)">
                <button class="btn" type="submit" name="mode" value="manual">
                    Set manual password
                </button>

                <button class="btn" type="button" onclick="hideModal()">Cancel</button>
            </div>

            <div style="height:10px"></div>
            <div class="small">
                TEMP password will be shown once after submit.
            </div>
        </form>
    </div>
</div>

<script>
const search = document.getElementById('search');
const rows = Array.from(document.querySelectorAll('#tbl tbody tr'));
const count = document.getElementById('count');

search.addEventListener('input', () => {
  const q = search.value.toLowerCase().trim();
  let shown = 0;
  rows.forEach(r => {
    const u = r.querySelector('.u').textContent.toLowerCase();
    const ok = u.includes(q);
    r.style.display = ok ? '' : 'none';
    if (ok) shown++;
  });
  count.textContent = shown;
});

function openReset(id, user){
  document.getElementById('user_id').value = id;
  document.getElementById('who').textContent = "User: " + user + " (ID " + id + ")";
  document.getElementById('modalBack').style.display = 'flex';
}
function hideModal(){
  document.getElementById('modalBack').style.display = 'none';
}
function closeModal(e){
  hideModal();
}
</script>
</body>
</html>
