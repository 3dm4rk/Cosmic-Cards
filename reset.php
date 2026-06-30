<?php
// reset_leaderboard.php
// HARD RESET: users.highest_gps -> 0

require_once __DIR__ . '/config.php'; // uses your existing DB connection

try {
    $pdo = db(); // must return PDO connected to cosmic_cards

    // Reset leaderboard
    $stmt = $pdo->prepare("UPDATE users SET highest_gps = 0");
    $stmt->execute();

    $affected = $stmt->rowCount();

    echo "<h2>✅ Leaderboard Reset Successful</h2>";
    echo "<p>Database: <b>" . htmlspecialchars($pdo->query("SELECT DATABASE()")->fetchColumn()) . "</b></p>";
    echo "<p>Rows affected: <b>{$affected}</b></p>";
    echo "<p>All users.highest_gps are now <b>0</b>.</p>";

} catch (Throwable $e) {
    http_response_code(500);
    echo "<h2>❌ Error</h2>";
    echo "<pre>" . htmlspecialchars($e->getMessage()) . "</pre>";
}
