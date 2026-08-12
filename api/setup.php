<?php

header('Content-Type: application/json');

try {
    require_once __DIR__ . '/../src/Database.php';
    require_once __DIR__ . '/../src/User.php';
    require_once __DIR__ . '/../src/CardSet.php';
    require_once __DIR__ . '/../src/Card.php';
    require_once __DIR__ . '/../src/Review.php';
    require_once __DIR__ . '/../src/Schema.php';

    $config = require __DIR__ . '/../config.php';
    $db = $config['db'];
    $dbname = str_replace('`', '', $db['name']);

    Schema::createDatabaseIfMissing();
    Schema::createAll();

    $pdo = Database::getConnection();

    $stmt = $pdo->query("SELECT COUNT(*) FROM users WHERE is_admin = 1");
    if ($stmt->fetchColumn() > 0) {
        echo json_encode(['success' => false, 'error' => 'Setup already completed.']);
        exit;
    }

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
    error_log('Setup error: ' . $e->getMessage());
    echo json_encode(['error'=>'Setup failed']);
}
