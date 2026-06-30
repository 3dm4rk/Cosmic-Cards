<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';

// ---- Authentication ----
$user = current_user();
if (!$user) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Not logged in']);
    exit;
}

// ---- Read & validate ----
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
$message = trim($data['message'] ?? '');

if (strlen($message) === 0) {
    echo json_encode(['ok' => false, 'error' => 'Message cannot be empty']);
    exit;
}
if (strlen($message) > 500) {
    echo json_encode(['ok' => false, 'error' => 'Message too long (max 500 chars)']);
    exit;
}

// ---- Store ----
try {
    $pdo = db();
    $stmt = $pdo->prepare("INSERT INTO global_chat (username, message, created_at) VALUES (?, ?, ?)");
    $nowMs = round(microtime(true) * 1000);
    $stmt->execute([$user['username'], $message, $nowMs]);
    echo json_encode(['ok' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}