<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';

$since = isset($_GET['since']) ? (int)$_GET['since'] : 0;

try {
    $pdo = db();
    $stmt = $pdo->prepare("SELECT id, username, message, created_at FROM global_chat WHERE id > ? ORDER BY created_at DESC LIMIT 100");
    $stmt->execute([$since]);
    $rows = $stmt->fetchAll();

    // Return oldest first (frontend renders top‑to‑bottom)
    $rows = array_reverse($rows);
    $messages = [];
    foreach ($rows as $row) {
        $messages[] = [
            'id'            => (int)$row['id'],
            'username'      => $row['username'],
            'message'       => $row['message'],
            'created_at_ms' => (int)$row['created_at']
        ];
    }
    echo json_encode(['ok' => true, 'messages' => $messages]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}