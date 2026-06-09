<?php

header('Content-Type: application/json');

try {
    $config = require __DIR__ . '/../config.php';
    $db = $config['db'];
    $host = $db['host'];
    $dbname = $db['name'];
    $user = $db['user'];
    $pass = $db['pass'];

    $pdo = new PDO("mysql:host=$host", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("CREATE DATABASE IF NOT EXISTS $dbname");
    $pdo->exec("USE $dbname");

    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(30) NOT NULL UNIQUE,
        full_name VARCHAR(100) NOT NULL DEFAULT '',
        password_hash VARCHAR(255) NOT NULL,
        is_admin TINYINT(1) DEFAULT 0,
        progress INT DEFAULT 0,
        english_level VARCHAR(50) DEFAULT 'Beginner',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS card_sets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        description TEXT
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS cards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        set_id INT NOT NULL,
        title VARCHAR(200),
        pattern_type ENUM('usage_cases','deep_dive','formula_table','multiple_choice','gap_fill','image_mcq','image_description','audio_listening') DEFAULT 'usage_cases',
        level ENUM('Beginner','Intermediate','Advanced') DEFAULT 'Beginner',
        question_text TEXT,
        content_data JSON,
        FOREIGN KEY (set_id) REFERENCES card_sets(id) ON DELETE CASCADE
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS user_card_progress (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        card_id INT NOT NULL,
        ease_factor FLOAT DEFAULT 2.5,
        interval_days INT DEFAULT 0,
        next_review DATE,
        last_review DATE,
        correct_streak INT DEFAULT 0,
        was_correct TINYINT(1) DEFAULT 1,
        total_reviews INT DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
        UNIQUE KEY unique_pair (user_id, card_id)
    )");

    $stmt = $pdo->query("SELECT COUNT(*) FROM card_sets");
    if ($stmt->fetchColumn() == 0) {
        $pdo->prepare("INSERT INTO card_sets (name, description) VALUES ('English Essentials', 'Present Simple & Daily Life')")->execute();
        $sid = $pdo->lastInsertId();
        $sample = $pdo->prepare("INSERT INTO cards (set_id, title, pattern_type, level, question_text, content_data) VALUES (?,?,?,?,?,?)");
        $sample->execute([$sid, 'Present Simple Usage', 'usage_cases', 'Beginner', 'Uses of present simple', json_encode(['usage1'=>'Routines','example1a'=>'I wake up at 7','usage2'=>'Facts','example2'=>'The sun rises in east'])]);
        $sample->execute([$sid, 'Daily Routine Gap', 'gap_fill', 'Beginner', 'Complete: She ___ (go) to school', json_encode(['sentence'=>'She ______ (go) to school every day.','correct_answers'=>['goes']])]);
        $sample->execute([$sid, 'Verb to be Quiz', 'multiple_choice', 'Intermediate', 'She ____ a doctor.', json_encode(['options'=>['am','is','are'],'correct_index'=>1])]);
    }

    echo json_encode(['success'=>true]);
} catch(Exception $e) {
    echo json_encode(['error'=>$e->getMessage()]);
}
