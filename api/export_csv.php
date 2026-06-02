<?php

session_start();

$currentUser = $_SESSION['admin_user'] ?? null;
$isAdmin = $currentUser !== null && ($currentUser['is_admin'] ?? false);
if (!$isAdmin) {
    header('HTTP/1.0 401 Unauthorized');
    echo 'Unauthorized';
    exit;
}

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/CardSet.php';
require_once __DIR__ . '/../src/Card.php';

$pdo = Database::getConnection();
$stmt = $pdo->query("
    SELECT c.id, c.set_id, c.title, c.pattern_type, c.level, c.question_text, c.content_data, s.name AS set_name
    FROM cards c
    LEFT JOIN card_sets s ON c.set_id = s.id
    ORDER BY s.name, c.id
");
$cards = $stmt->fetchAll();

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="cards_export.csv');

$out = fopen('php://output', 'w');

fputcsv($out, [
    'id', 'set', 'set_id', 'type', 'title', 'level',
    'question_text', 'definition', 'sentence',
    'opt1', 'opt2', 'opt3', 'opt4',
    'correct_answer', 'explanation',
    'example1', 'example2', 'example3', 'example4',
    'usage1', 'tip',
]);

foreach ($cards as $card) {
    $cd = json_decode($card['content_data'], true) ?: [];
    $type = $card['pattern_type'];

    $row = [
        'id'             => $card['id'],
        'set'            => $card['set_name'] ?? '',
        'set_id'         => $card['set_id'],
        'type'           => $type,
        'title'          => $card['title'] ?? '',
        'level'          => $card['level'] ?? 'Beginner',
        'question_text'  => '',
        'definition'     => '',
        'sentence'       => '',
        'opt1'           => '', 'opt2' => '', 'opt3' => '', 'opt4' => '',
        'correct_answer' => '',
        'explanation'    => '',
        'example1'       => '', 'example2' => '', 'example3' => '', 'example4' => '',
        'usage1'         => '',
        'tip'            => '',
    ];

    if ($type === 'multiple_choice') {
        $options = $cd['options'] ?? [];
        $row['question_text'] = $cd['question_text'] ?? $card['question_text'] ?? '';
        for ($i = 0; $i < min(4, count($options)); $i++) {
            $row['opt' . ($i + 1)] = $options[$i];
        }
        $row['correct_answer'] = $cd['correct_index'] ?? 0;
        $row['explanation'] = $cd['explanation'] ?? '';
    } elseif ($type === 'gap_fill') {
        $row['sentence'] = $cd['sentence'] ?? '';
        $row['correct_answer'] = implode(',', $cd['correct_answers'] ?? ['answer']);
        $row['example1'] = $cd['example'] ?? '';
    } else {
        $row['definition'] = $cd['definition'] ?? '';
        $row['example1'] = $cd['example1a'] ?? $cd['example'] ?? '';
        if ($type === 'usage_cases') {
            $row['usage1'] = $cd['usage1'] ?? '';
            $row['tip'] = $cd['tip'] ?? '';
        }
        if ($type === 'deep_dive' || $type === 'formula_table') {
            $row['example2'] = !empty($cd['example']) && empty($row['example1']) ? '' : ($cd['example'] ?? '');
            $row['tip'] = $cd['tip'] ?? '';
        }
    }

    fputcsv($out, $row);
}

fclose($out);
