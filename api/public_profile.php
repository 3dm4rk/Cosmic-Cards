<?php
require_once __DIR__ . '/../config.php';
header('Content-Type: application/json; charset=utf-8');
require_login();

$pdo = db();

$username = trim($_GET['username'] ?? ($_GET['u'] ?? ''));
if ($username === '') { echo json_encode(['ok'=>false,'error'=>'Missing username']); exit; }
if (strlen($username) < 2 || strlen($username) > 32) { echo json_encode(['ok'=>false,'error'=>'Invalid username']); exit; }

$stmt = $pdo->prepare('SELECT id, username FROM users WHERE username = ? LIMIT 1');
$stmt->execute([$username]);
$usr = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$usr) { echo json_encode(['ok'=>false,'error'=>'User not found']); exit; }

$stmt = $pdo->prepare('SELECT state_json FROM game_states WHERE user_id = ? LIMIT 1');
$stmt->execute([$usr['id']]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

$state = null;
if ($row && !empty($row['state_json'])) {
  $decoded = json_decode($row['state_json'], true);
  if (is_array($decoded)) $state = $decoded;
}

$profile = is_array($state['profile'] ?? null) ? $state['profile'] : [];
$cos = is_array($profile['cosmetics'] ?? null) ? $profile['cosmetics'] : [];


$avatar = $profile['avatar'] ?? 'profile/profile.png';
if (!is_string($avatar) || trim($avatar)==='') $avatar = 'profile/profile.png';

$equippedFrame = $cos['frame'] ?? ($profile['cosmetics']['frame'] ?? 'default'); // backward compat
if (!is_string($equippedFrame) || trim($equippedFrame)==='') $equippedFrame = 'default';
$equippedAura  = $cos['aura']  ?? ($profile['cosmetics']['aura'] ?? 'none');
$equippedTitle = $cos['title'] ?? ($profile['cosmetics']['title'] ?? null);
if (!is_string($equippedTitle) || trim($equippedTitle)==='') $equippedTitle = null;

if (!is_string($equippedAura) || trim($equippedAura)==='') $equippedAura = 'none';


$ownedFrames = $cos['ownedFrames'] ?? ['default']; if (!is_array($ownedFrames)) $ownedFrames = ['default'];
$ownedAuras  = $cos['ownedAuras']  ?? ['none'];    if (!is_array($ownedAuras))  $ownedAuras  = ['none'];
$ownedTitles = $cos['ownedTitles'] ?? [];          if (!is_array($ownedTitles)) $ownedTitles = [];

$ach = $profile['achievements'] ?? []; if (!is_array($ach)) $ach = [];

$featured = $profile['featured'] ?? [null, null, null];
if (!is_array($featured)) $featured = [null, null, null];
$featured = array_values($featured);
for ($i=0;$i<3;$i++){
  if (!array_key_exists($i, $featured)) $featured[$i] = null;
  if ($featured[$i] !== null && !is_string($featured[$i])) $featured[$i] = null;
}

$cardsOwned = $state['cardsOwned'] ?? [];
if (!is_array($cardsOwned)) $cardsOwned = [];

$flexCards = [];
foreach ($featured as $nm){
  if (!$nm) { $flexCards[] = null; continue; }
  $found = null;
  foreach ($cardsOwned as $c){
    if (is_array($c) && ($c['name'] ?? '') === $nm){ $found = $c; break; }
  }
  if (!$found){ $flexCards[] = ['name'=>$nm]; continue; }
  $flexCards[] = [
    'name' => $found['name'] ?? $nm,
    'rarity' => $found['rarity'] ?? ($found['tier'] ?? ''),
    'img' => $found['img'] ?? ($found['image'] ?? ''),
    'mutations' => is_array($found['mutations'] ?? null) ? $found['mutations'] : (isset($found['mutation']) ? [$found['mutation']] : []),
    'baseGps' => $found['baseGps'] ?? ($found['gps'] ?? null),
    'gps' => $found['gps'] ?? ($found['baseGps'] ?? null),
  ];
}

echo json_encode([
  'ok' => true,
  'user' => [
    'username' => $usr['username'],
    'avatar' => $avatar,
    'equippedFrame' => $equippedFrame,
    'equippedAura' => $equippedAura,
    'equippedTitle' => $equippedTitle,
    'cosmeticsOwned' => [
      'frames' => array_values(array_unique($ownedFrames)),
      'auras'  => array_values(array_unique($ownedAuras)),
    ],
    'titlesOwned' => array_values(array_unique($ownedTitles)),
    'achievements' => $ach,
    'flex' => $featured,
    'flexCards' => $flexCards
  ]
]);
