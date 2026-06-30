<?php
// checker.php
// Totals cards across accounts by reading game_states.state_json -> cardsOwned[]
// Adds: rarity selector + limited edition rarity + Portia price + Top Expensive Cards tab

$DB_HOST = "127.0.0.1";
$DB_NAME = "cosmic_cards";   // <-- change if needed
$DB_USER = "root";           // <-- change
$DB_PASS = "";               // <-- change

header("Content-Type: text/html; charset=utf-8");
$generatedAt = time();

function try_decode_state_json($raw) {
    if (!is_string($raw) || $raw === "") return null;

    $data = json_decode($raw, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($data)) return $data;

    $raw2 = stripslashes($raw);
    $data = json_decode($raw2, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($data)) return $data;

    $raw3 = html_entity_decode($raw2, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $data = json_decode($raw3, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($data)) return $data;

    return null;
}

function clamp_val($v, $allowed, $fallback) {
    $x = strtolower(trim((string)$v));
    return in_array($x, $allowed, true) ? $x : $fallback;
}

function peso_format($value) {
    if (!is_numeric($value)) return "₱0.00";
    return "₱" . number_format((float)$value, 2, ".", ",");
}

// Normalize rarity values from JSON
function normalize_rarity($rarity) {
    $r = strtolower(trim((string)$rarity));
    // Support various spellings
    if ($r === "limited edition" || $r === "limited_edition" || $r === "limitededition") return "limited";
    return $r;
}

// ---- PRICE RULES ----
// Price = base / copies
function base_value_for_card($rarity, $cardName) {
    $r = normalize_rarity($rarity);
    $n = strtolower(trim((string)$cardName));

    // Common: base 5.00
    if ($r === "common") return 5.00;

    // Rare: Dr Nemesis base 20.00, others 6.00
    if ($r === "rare") {
        if ($n === "dr nemesis") return 20.00;
        return 6.00;
    }

    // Epic: Spidigong base 25, others 5
    if ($r === "epic") {
        if ($n === "spidigong") return 25.00;
        return 5.00;
    }

    // Mythical: Space Duelist base 20, others 5
    if ($r === "mythical") {
        if ($n === "space duelist") return 20.00;
        return 5.00;
    }

    // Legendary: LeiRality base 30, others 10
    if ($r === "legendary") {
        if ($n === "leirality") return 30.00;
        return 10.00;
    }

    // Cosmic: Omni 35, The World 25, Cosmo Revelation 20, Awakened Monster 20, others 15
    if ($r === "cosmic") {
        if ($n === "omni") return 35.00;
        if ($n === "the world") return 25.00;
        if ($n === "cosmo revelation") return 20.00;
        if ($n === "awakened monster") return 20.00;
        return 15.00;
    }

    // Interstellar: Meowl 200, Emerald Emperor 150, others 20
    if ($r === "interstellar") {
        if ($n === "meowl") return 200.00;
        if ($n === "emerald emperor") return 150.00;
        return 20.00;
    }

    // Limited Edition: Portia base 300 (same method). Others default 0 (so you don't get wrong pricing).
    if ($r === "limited") {
        if ($n === "portia" || $n === "portia the god of love" || $n === "portia, god of love") return 300.00;
        return 0.00;
    }

    return 0.00;
}

$RARITY_ORDER = ["common", "rare", "epic", "mythical", "legendary", "cosmic", "interstellar", "limited"];

$mode = isset($_GET["mode"]) ? strtolower(trim((string)$_GET["mode"])) : "rarity";
$mode = in_array($mode, ["rarity", "top"], true) ? $mode : "rarity";

$selectedRarity = isset($_GET["rarity"]) ? normalize_rarity($_GET["rarity"]) : "common";
if (!in_array($selectedRarity, $RARITY_ORDER, true)) $selectedRarity = "common";

try {
    $dsn = "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4";
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $rows = $pdo->query("SELECT user_id, state_json FROM game_states")->fetchAll();

    // Total players (distinct accounts with saved state)
    $totalPlayers = (int)$pdo->query("SELECT COUNT(DISTINCT user_id) FROM game_states")->fetchColumn();

    // Aggregation:
    // $cards[rarity][key] = ['name','img','total','owners'=>[user=>true]]
    $cards = [];
    foreach ($RARITY_ORDER as $r) $cards[$r] = [];

    $totalUsersWithState = 0;
    $totalCardsSeen = 0;
    $badJsonCount = 0;

    foreach ($rows as $row) {
        $userId = (string)$row["user_id"];
        $state = try_decode_state_json($row["state_json"]);
        if (!$state) { $badJsonCount++; continue; }

        $totalUsersWithState++;

        if (!isset($state["cardsOwned"]) || !is_array($state["cardsOwned"])) continue;

        foreach ($state["cardsOwned"] as $c) {
            if (!is_array($c)) continue;

            // Support multiple shapes for cardsOwned entries:
            // - array item like ["name"=>"X","rarity"=>"rare","img"=>"...","count"=>3]
            // - array item like ["cardName"=>"X","cardRarity"=>"rare","image"=>"...","copies"=>3]
            // - string item like "Card Name" (rarity unknown -> skip)
            if (is_string($c)) { continue; }

            $rarity = "";
            if (isset($c["rarity"])) $rarity = normalize_rarity($c["rarity"]);
            else if (isset($c["cardRarity"])) $rarity = normalize_rarity($c["cardRarity"]);
            else if (isset($c["r"])) $rarity = normalize_rarity($c["r"]);

            $name = "";
            if (isset($c["name"])) $name = trim((string)$c["name"]);
            else if (isset($c["cardName"])) $name = trim((string)$c["cardName"]);
            else if (isset($c["id"])) $name = trim((string)$c["id"]);

            $img = "";
            if (isset($c["img"])) $img = trim((string)$c["img"]);
            else if (isset($c["image"])) $img = trim((string)$c["image"]);
            else if (isset($c["imagePath"])) $img = trim((string)$c["imagePath"]);

            // Count/copies support (default 1)
            $count = 1;
            if (isset($c["count"]) && is_numeric($c["count"])) $count = max(1, (int)$c["count"]);
            else if (isset($c["copies"]) && is_numeric($c["copies"])) $count = max(1, (int)$c["copies"]);
            else if (isset($c["qty"]) && is_numeric($c["qty"])) $count = max(1, (int)$c["qty"]);

            if ($rarity === "" || $name === "") continue;
            if (!in_array($rarity, $RARITY_ORDER, true)) continue;

            $key = $rarity . "::" . $name;

            if (!isset($cards[$rarity][$key])) {
                $cards[$rarity][$key] = [
                    "rarity" => $rarity,
                    "name" => $name,
                    "img" => $img,
                    "total" => 0,
                    "owners" => []
                ];
            }

            if ($cards[$rarity][$key]["img"] === "" && $img !== "") {
                $cards[$rarity][$key]["img"] = $img;
            }

            $cards[$rarity][$key]["total"] += $count;
            $cards[$rarity][$key]["owners"][$userId] = true;

            $totalCardsSeen += $count;
        }
    }

    // Sort each rarity by total desc then name asc
    foreach ($RARITY_ORDER as $r) {
        uasort($cards[$r], function($a, $b) {
            if ($a["total"] === $b["total"]) return strcasecmp($a["name"], $b["name"]);
            return ($b["total"] <=> $a["total"]);
        });
    }

    // Build TOP EXPENSIVE list across all rarities
    $topList = [];
    foreach ($RARITY_ORDER as $r) {
        foreach ($cards[$r] as $it) {
            $copies = max(1, (int)$it["total"]);
            $base = base_value_for_card($r, $it["name"]);
            $price = ($base > 0) ? ($base / $copies) : 0.00;

            $topList[] = [
                "rarity" => $r,
                "name" => $it["name"],
                "img" => $it["img"],
                "total" => $copies,
                "ownersCount" => is_array($it["owners"]) ? count($it["owners"]) : 0,
                "base" => $base,
                "price" => $price
            ];
        }
    }

    usort($topList, function($a, $b) {
        // Highest price first
        if ($a["price"] == $b["price"]) {
            // Higher base first, then fewer copies first, then name
            if ($a["base"] == $b["base"]) {
                if ($a["total"] == $b["total"]) return strcasecmp($a["name"], $b["name"]);
                return ($a["total"] <=> $b["total"]);
            }
            return ($b["base"] <=> $a["base"]);
        }
        return ($b["price"] <=> $a["price"]);
    });

    // Optional: limit top list size for performance/UI
    $TOP_LIMIT = 200;
    $topList = array_slice($topList, 0, $TOP_LIMIT);

} catch (Exception $e) {
    http_response_code(500);
    echo "<h1>Checker Error</h1>";
    echo "<pre>" . htmlspecialchars($e->getMessage()) . "</pre>";
    exit;
}

// View data
$selectedList = $cards[$selectedRarity];
$uniqueCount = count($selectedList);
$rarityCopies = 0;
foreach ($selectedList as $it) $rarityCopies += (int)$it["total"];

?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Card Checker</title>
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
  <meta http-equiv="Pragma" content="no-cache" />
  <meta http-equiv="Expires" content="0" />
  <style>
    :root{
      --bg1:#0b0f1f; --bg2:#050712;
      --glass: rgba(255,255,255,0.06);
      --border: rgba(255,255,255,0.12);
      --muted: rgba(233,236,255,0.78);
      --shadow: 0 10px 30px rgba(0,0,0,0.35);
    }
    body{
      margin:0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      background: radial-gradient(1200px 800px at 20% 0%, #1b2140 0%, var(--bg1) 55%, var(--bg2) 100%);
      color:#e9ecff;
    }
    .wrap{ max-width:1200px; margin:0 auto; padding:18px; }
    .stickyBar{
      position: sticky; top:0; z-index:50;
      padding:12px 0;
      backdrop-filter: blur(12px);
      background: linear-gradient(180deg, rgba(5,7,18,0.92), rgba(5,7,18,0.65));
      border-bottom:1px solid rgba(255,255,255,0.08);
    }
    .barInner{
      max-width:1200px; margin:0 auto; padding:0 18px;
      display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap;
    }
    .titleBlock{ display:flex; flex-direction:column; gap:2px; }
    h1{ margin:0; font-size:18px; letter-spacing:0.2px; }
    .sub{ font-size:12px; color:var(--muted); }
    .controls{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
    .select, .btn{
      border-radius:999px;
      border:1px solid var(--border);
      background: rgba(255,255,255,0.08);
      color:#e9ecff;
      padding:9px 12px;
      font-size:13px;
      outline:none;
      box-shadow: 0 8px 20px rgba(0,0,0,0.20);
    }
    .select{ padding-right:34px; }
    .btn{
      cursor:pointer;
      transition: transform .12s ease, background .12s ease;
      text-decoration:none;
      display:inline-flex; align-items:center; gap:8px;
      user-select:none;
    }
    .btn:hover{ transform: translateY(-1px); background: rgba(255,255,255,0.12); }
    .btnActive{
      background: rgba(255,255,255,0.16);
      border-color: rgba(255,255,255,0.20);
    }
    .pill{
      display:inline-flex; align-items:center; gap:8px;
      padding:8px 12px; border-radius:999px;
      background: rgba(255,255,255,0.07);
      border:1px solid rgba(255,255,255,0.10);
      font-size:12px; color:var(--muted);
      white-space:nowrap;
    }
    .panel{
      margin-top:14px;
      border-radius:16px;
      background: var(--glass);
      border:1px solid var(--border);
      box-shadow: var(--shadow);
      overflow:hidden;
    }
    .panelHeader{
      padding:12px 14px;
      display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap;
      background: linear-gradient(90deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03));
      border-bottom:1px solid rgba(255,255,255,0.10);
    }
    .panelHeader h2{ margin:0; font-size:14px; text-transform:capitalize; letter-spacing:0.3px; }
    .panelHeader .stats{ display:flex; gap:10px; flex-wrap:wrap; }
    table{ width:100%; border-collapse:collapse; }
    th, td{ padding:10px 12px; text-align:left; border-bottom:1px solid rgba(255,255,255,0.08); }
    th{ font-size:11px; text-transform:uppercase; letter-spacing:0.12em; color: rgba(233,236,255,0.70); }
    td{ font-size:14px; }
    tr:hover td{ background: rgba(255,255,255,0.04); }
    .imgCell{ width:72px; }
    .cardImg{
      width:52px; height:52px; border-radius:12px;
      object-fit:cover;
      background: rgba(255,255,255,0.10);
      border:1px solid rgba(255,255,255,0.10);
      box-shadow: 0 8px 18px rgba(0,0,0,0.35);
      display:block;
    }
    .mutedLine{ opacity:0.70; font-size:12px; }
    .price{ font-weight:800; letter-spacing:0.2px; }
    .right{ text-align:right; }
    .empty{ padding:14px; opacity:0.85; }
    .footer{ margin-top:14px; opacity:0.7; font-size:12px; }
    code{ background: rgba(255,255,255,0.08); padding:2px 6px; border-radius:8px; }

    /* Total Players (top-center) */
    #totalPlayersCounter{
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.12);
      padding: 8px 14px;
      border-radius: 999px;
      color: #fff;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: .4px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      pointer-events: none;
      user-select: none;
      text-shadow: 0 1px 0 rgba(0,0,0,0.35);
    }

  </style>
</head>
<body>

  <div id="totalPlayersCounter">👥 Players: <span id="totalPlayersValue"><?php echo number_format((int)$totalPlayers); ?></span></div>


  <div class="stickyBar">
    <div class="barInner">
      <div class="titleBlock">
        <h1>Checker — Card Totals & ₱ Value</h1>
        <div class="sub">Switch rarities fast + Top Expensive cards tab 🔥 · Last updated: <b><?php echo date("Y-m-d H:i:s", $generatedAt); ?></b></div>
      </div>

      <div class="controls">
        <!-- Mode tabs -->
        <a class="btn <?php echo ($mode === "rarity") ? "btnActive" : ""; ?>"
           href="checker.php?mode=rarity&rarity=<?php echo urlencode($selectedRarity); ?>">
          Rarity View
        </a>
        <a class="btn <?php echo ($mode === "top") ? "btnActive" : ""; ?>"
           href="checker.php?mode=top">
          Top Expensive Cards
        </a>

        <button type="button" class="btn" id="autoRefreshBtn" title="Toggle auto refresh">
          Auto Refresh: <span id="autoRefreshState">OFF</span>
        </button>

        <?php if ($mode === "rarity"): ?>
          <form id="rarityForm" method="GET" action="checker.php" style="margin:0;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <input type="hidden" name="mode" value="rarity">
            <select class="select" name="rarity" id="raritySelect" onchange="document.getElementById('rarityForm').submit()">
              <?php foreach ($RARITY_ORDER as $r): ?>
                <option value="<?php echo htmlspecialchars($r); ?>" <?php echo ($selectedRarity === $r) ? "selected" : ""; ?>>
                  <?php echo ($r === "limited") ? "Limited Edition" : ucfirst($r); ?>
                </option>
              <?php endforeach; ?>
            </select>

            <?php foreach ($RARITY_ORDER as $r): ?>
              <a class="btn <?php echo ($selectedRarity === $r) ? "btnActive" : ""; ?>"
                 href="checker.php?mode=rarity&rarity=<?php echo urlencode($r); ?>">
                <?php echo ($r === "limited") ? "Limited Edition" : ucfirst($r); ?>
              </a>
            <?php endforeach; ?>
          </form>
        <?php endif; ?>

        <div class="pill">Accounts w/ state: <b style="color:#fff"><?php echo (int)$totalUsersWithState; ?></b></div>
        <div class="pill">All cards counted: <b style="color:#fff"><?php echo (int)$totalCardsSeen; ?></b></div>
        <div class="pill">Bad JSON rows: <b style="color:#fff"><?php echo (int)$badJsonCount; ?></b></div>
      </div>
    </div>
  </div>

  <div class="wrap">
    <div class="panel">
      <div class="panelHeader">
        <?php if ($mode === "rarity"): ?>
          <h2><?php echo ($selectedRarity === "limited") ? "Limited Edition cards" : htmlspecialchars($selectedRarity) . " cards"; ?></h2>
          <div class="stats">
            <div class="pill">Unique names: <b style="color:#fff"><?php echo (int)$uniqueCount; ?></b></div>
            <div class="pill">Total copies: <b style="color:#fff"><?php echo (int)$rarityCopies; ?></b></div>
          </div>
        <?php else: ?>
          <h2>Top Expensive Cards (₱) — highest to lowest</h2>
          <div class="stats">
            <div class="pill">Showing top: <b style="color:#fff"><?php echo (int)count($topList); ?></b></div>
          </div>
        <?php endif; ?>
      </div>

      <?php if ($mode === "rarity"): ?>
        <?php if ($uniqueCount === 0): ?>
          <div class="empty">No cards found in this rarity.</div>
        <?php else: ?>
          <table>
            <thead>
              <tr>
                <th class="imgCell">Image</th>
                <th>Name</th>
                <th class="right">Total Copies</th>
                <th class="right">Accounts Owning</th>
                <th class="right">Price (₱)</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($selectedList as $item): ?>
                <?php
                  $img = $item["img"] ?: "";
                  $ownersCount = is_array($item["owners"]) ? count($item["owners"]) : 0;
                  $copies = max(1, (int)$item["total"]);
                  $base = base_value_for_card($selectedRarity, $item["name"]);
                  $price = ($base > 0) ? ($base / $copies) : 0.00;
                ?>
                <tr>
                  <td class="imgCell">
                    <?php if ($img !== ""): ?>
                      <img class="cardImg" src="<?php echo htmlspecialchars($img); ?>" alt="">
                    <?php else: ?>
                      <div class="cardImg" title="No image"></div>
                    <?php endif; ?>
                  </td>
                  <td>
                    <div><b><?php echo htmlspecialchars($item["name"]); ?></b></div>
                    <?php if ($img !== ""): ?>
                      <div class="mutedLine"><?php echo htmlspecialchars($img); ?></div>
                    <?php endif; ?>
                    <div class="mutedLine">
                      Base: <b><?php echo peso_format($base); ?></b> / Copies: <b><?php echo (int)$copies; ?></b>
                    </div>
                  </td>
                  <td class="right"><b><?php echo (int)$copies; ?></b></td>
                  <td class="right"><b><?php echo (int)$ownersCount; ?></b></td>
                  <td class="right"><span class="price"><?php echo peso_format($price); ?></span></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        <?php endif; ?>

      <?php else: ?>
        <?php if (count($topList) === 0): ?>
          <div class="empty">No cards found.</div>
        <?php else: ?>
          <table>
            <thead>
              <tr>
                <th class="imgCell">Image</th>
                <th>Card</th>
                <th>Rarity</th>
                <th class="right">Copies</th>
                <th class="right">Accounts</th>
                <th class="right">Base</th>
                <th class="right">Price (₱)</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($topList as $row): ?>
                <tr>
                  <td class="imgCell">
                    <?php if (!empty($row["img"])): ?>
                      <img class="cardImg" src="<?php echo htmlspecialchars($row["img"]); ?>" alt="">
                    <?php else: ?>
                      <div class="cardImg" title="No image"></div>
                    <?php endif; ?>
                  </td>
                  <td>
                    <div><b><?php echo htmlspecialchars($row["name"]); ?></b></div>
                    <?php if (!empty($row["img"])): ?>
                      <div class="mutedLine"><?php echo htmlspecialchars($row["img"]); ?></div>
                    <?php endif; ?>
                  </td>
                  <td>
                    <b><?php echo ($row["rarity"] === "limited") ? "Limited Edition" : ucfirst($row["rarity"]); ?></b>
                  </td>
                  <td class="right"><b><?php echo (int)$row["total"]; ?></b></td>
                  <td class="right"><b><?php echo (int)$row["ownersCount"]; ?></b></td>
                  <td class="right"><b><?php echo peso_format($row["base"]); ?></b></td>
                  <td class="right"><span class="price"><?php echo peso_format($row["price"]); ?></span></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        <?php endif; ?>
      <?php endif; ?>

    </div>

    <div class="footer">
      Data source: <code>game_states.state_json</code> → <code>cardsOwned[]</code> (summed across accounts).
      <?php if ($mode === "top"): ?>
        <br/>Sorted by <b>Price</b> (base / copies), highest first.
      <?php endif; ?>
    </div>
  </div>

<script>
(function(){
  const BTN = document.getElementById('autoRefreshBtn');
  const STATE = document.getElementById('autoRefreshState');
  const KEY = 'checker_auto_refresh_on';
  const INTERVAL_MS = 5000;

  function isOn(){ return localStorage.getItem(KEY) === '1'; }
  function setOn(v){ localStorage.setItem(KEY, v ? '1' : '0'); }

  function sync(){
    const on = isOn();
    if (STATE) STATE.textContent = on ? 'ON' : 'OFF';
    if (BTN) BTN.classList.toggle('btnActive', on);
  }

  let timer = null;
  function start(){
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      // keep query params (rarity/mode) and force fresh fetch
      const u = new URL(window.location.href);
      u.searchParams.set('_t', String(Date.now())); // bust cache
      window.location.replace(u.toString());
    }, INTERVAL_MS);
  }
  function stop(){
    if (timer) clearInterval(timer);
    timer = null;
  }

  if (BTN){
    BTN.addEventListener('click', () => {
      const next = !isOn();
      setOn(next);
      sync();
      if (next) start(); else stop();
    });
  }

  sync();
  if (isOn()) start();
})();
</script>
</body>
</html>
