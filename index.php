<?php

session_start();

require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/helpers.php';
require_once __DIR__ . '/src/CardSet.php';
require_once __DIR__ . '/src/User.php';

$dbConnected = Database::testConnection();
$cardSets = $dbConnected ? CardSet::getWithCards() : [];

$loggedInStudent = isset($_SESSION['student_user']) ? $_SESSION['student_user'] : null;

if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: index.php');
    exit;
}

if (!$loggedInStudent) {
    ?><!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, viewport-fit=cover">
        <title>Flashcard Studio | Spaced Repetition</title>
        <link href="https://fonts.cdnfonts.com/css/bubble-sans" rel="stylesheet">
        <link href="https://fonts.cdnfonts.com/css/stampatello-faceto" rel="stylesheet">
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="assets/css/app.css">
    </head>
    <body class="flex items-center justify-center">
        <a href="admin_cards.php" class="admin-link">⚙️ Admin Panel</a>
        <div id="appRoot" class="w-full max-w-5xl mx-auto"></div>

        <script>
            window.FLASHCARD_DATA = {
                cardSets: [],
                dbConnected: <?= $dbConnected ? 'true' : 'false' ?>,
                loggedInStudent: null
            };
        </script>
        <script src="assets/js/app.js"></script>
    </body>
    </html>
    <?php
    exit;
}
?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, viewport-fit=cover">
    <title>Flashcard Studio | Spaced Repetition</title>
    <link href="https://fonts.cdnfonts.com/css/bubble-sans" rel="stylesheet">
    <link href="https://fonts.cdnfonts.com/css/stampatello-faceto" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="assets/css/app.css">
</head>
<body class="flex items-center justify-center">
    <a href="admin_cards.php" class="admin-link">⚙️ Admin Panel</a>
    <div id="appRoot" class="w-full max-w-5xl mx-auto"></div>

    <script>
        window.FLASHCARD_DATA = {
            cardSets: <?= json_encode($cardSets) ?>,
            dbConnected: <?= $dbConnected ? 'true' : 'false' ?>,
            loggedInStudent: <?= json_encode($loggedInStudent) ?>
        };
    </script>
    <script src="assets/js/app.js"></script>
</body>
</html>
