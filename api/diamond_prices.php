<?php
// api/diamond_prices.php
// Returns JSON pricing + copies for the Diamond Conversion modal.
//
// IMPORTANT CHANGE (per request):
// - Uses BASE PRICE converted to DIAMOND (fixed), NOT base/copies.
// - Still returns total copies across all accounts for display/progress purposes.
//
// Diamond price model:
//   diamond_price = base_value_gold * DIAMOND_RATE
//
// Where base_value_gold values come from checker.php's BASE_VALUES (and extended for higher tiers).

require_once __DIR__ . '/../config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$DIAMOND_RATE = 0.0002; // 50 gold base => 0.01 diamond

// Base values (gold-like units) — matches checker.php for existing tiers.
$BASE_VALUES = [
  "Common" => 50,
  "Rare" => 600,
  "Epic" => 2500,
  "Legendary" => 9000,
  "Mythical" => 25000,

  // Extended tiers (you can tweak these later if you want a different economy)
  "Cosmic" => 50000,
  "Interstellar" => 100000,
  "Dragon" => 200000,
  "Valentines" => 50000,
];

// The exact "rarest" card names you want shown/used.
$RAREST = [
  "common" => ["rarity" => "Common", "name" => "Patrick the Destroyer"],
  "rare" => ["rarity" => "Rare", "name" => "Dr. Nemesis"],
  "epic" => ["rarity" => "Epic", "name" => "Spidigong"],
  "legendary" => ["rarity" => "Legendary", "name" => "Leirality"],
  "mythical" => ["rarity" => "Mythical", "name" => "Space Duelist"],
  "cosmic" => ["rarity" => "Cosmic", "name" => "Omni"],
  "interstellar" => ["rarity" => "Interstellar", "name" => "Emerald Emperor"],
  "dragon" => ["rarity" => "Dragon", "name" => "AI"],
  "valentines" => ["rarity" => "Valentines", "name" => "Omnight"],
];

// Normalizes a card name for matching (case-insensitive + punctuation-insensitive).
function norm_name($s) {
  $s = mb_strtolower((string)$s, 'UTF-8');
  $s = preg_replace('/[^a-z0-9]+/u', '', $s);
  return $s;
}

function base_value_for_rarity($rarity, $BASE_VALUES) {
  return isset($BASE_VALUES[$rarity]) ? (float)$BASE_VALUES[$rarity] : 0.0;
}

try {
  $pdo = get_db();

  // Load all state_json rows and count copies across all accounts.
  $stmt = $pdo->query("SELECT state_json FROM game_states");
  $copiesByNormName = [];

  while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $state = json_decode($row['state_json'], true);
    if (!is_array($state)) continue;

    $cardsOwned = $state['cardsOwned'] ?? [];
    if (!is_array($cardsOwned)) continue;

    foreach ($cardsOwned as $entry) {
      if (!is_array($entry)) continue;
      $n = $entry['name'] ?? '';
      $c = (int)($entry['count'] ?? 0);
      if ($c <= 0 || $n === '') continue;
      $k = norm_name($n);
      if (!isset($copiesByNormName[$k])) $copiesByNormName[$k] = 0;
      $copiesByNormName[$k] += $c;
    }
  }

  $out = [];
  foreach ($RAREST as $key => $meta) {
    $rarity = $meta['rarity'];
    $name = $meta['name'];

    $base = base_value_for_rarity($rarity, $BASE_VALUES);
    $diamondPrice = ($base > 0) ? ($base * $DIAMOND_RATE) : 0.0;
    // Keep precision and avoid "+0" display in UI
    $diamondPrice = round($diamondPrice, 6);
    if ($diamondPrice > 0 && $diamondPrice < 0.01) { $diamondPrice = 0.01; }

    $copies = $copiesByNormName[norm_name($name)] ?? 0;

    $out[$key] = [
      "name" => $name,
      "rarity" => $rarity,
      "copies" => (int)$copies,
      "base" => (float)$base,
      "diamondRate" => (float)$DIAMOND_RATE,
      "price" => (float)$diamondPrice
    ];
  }

  echo json_encode([
    "ok" => true,
    "generatedAt" => time(),
    "data" => $out
  ]);
  exit;

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode([
    "ok" => false,
    "error" => $e->getMessage()
  ]);
  exit;
}
