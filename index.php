<?php
require_once __DIR__ . '/config.php';

session_start(); // ✅ correct PHP session function

if (!empty($_SESSION['user_id'])) {
    header('Location: game.php');
    exit;
}

header('Location: login.php');
exit;
