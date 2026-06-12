<?php

require_once __DIR__ . '/../src/session_init.php';
initSession();

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

$setId = isset($_GET['set_id']) ? (int) $_GET['set_id'] : 0;
$type  = $_GET['type'] ?? '';
$cardIds = $_GET['card_ids'] ?? '';

$sql = "SELECT c.id, c.set_id, c.title, c.pattern_type, c.level, c.question_text, c.content_data, s.name AS set_name
    FROM cards c
    LEFT JOIN card_sets s ON c.set_id = s.id
    WHERE 1=1";
$params = [];

if ($setId > 0) {
    $sql .= " AND c.set_id = ?";
    $params[] = $setId;
}
if ($type !== '') {
    $sql .= " AND c.pattern_type = ?";
    $params[] = $type;
}
if ($cardIds !== '') {
    $ids = array_map('intval', explode(',', $cardIds));
    $ids = array_filter($ids, fn($v) => $v > 0);
    if (!empty($ids)) {
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $sql .= " AND c.id IN ($placeholders)";
        $params = array_merge($params, $ids);
    }
}

$sql .= " ORDER BY s.name, c.id";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$cards = $stmt->fetchAll();

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="cards_export.csv"');

$out = fopen('php://output', 'w');

fputcsv($out, [
    'id', 'set', 'set_id', 'type', 'title', 'level',
    'question_text', 'definition', 'sentence',
    'opt1', 'opt2', 'opt3', 'opt4',
    'correct_answer', 'explanation',
    'example1', 'example2', 'example3', 'example4',
    'usage1', 'tip',
    'image_url', 'description', 'audio_url', 'prompt', 'transcript',
    'front_fields', 'back_fields',
], ';');

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
        'image_url'      => '',
        'description'    => '',
        'audio_url'      => '',
        'prompt'         => '',
        'transcript'     => '',
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
    } elseif ($type === 'image_mcq') {
        $options = $cd['options'] ?? [];
        $row['image_url'] = $cd['image_url'] ?? '';
        $row['question_text'] = $cd['question_text'] ?? $card['question_text'] ?? '';
        for ($i = 0; $i < min(4, count($options)); $i++) {
            $row['opt' . ($i + 1)] = $options[$i];
        }
        $row['correct_answer'] = $cd['correct_index'] ?? 0;
        $row['explanation'] = $cd['explanation'] ?? '';
    } elseif ($type === 'image_description') {
        $row['image_url'] = $cd['image_url'] ?? '';
        $row['description'] = $cd['description'] ?? '';
    } elseif ($type === 'audio_listening') {
        $row['audio_url'] = $cd['audio_url'] ?? '';
        $row['prompt'] = $cd['prompt'] ?? '';
        $row['correct_answer'] = implode(',', $cd['correct_answers'] ?? []);
        $row['transcript'] = $cd['transcript'] ?? $cd['notes'] ?? '';
    } else {
        $row['definition'] = $cd['definition'] ?? '';
        if (!empty($cd['examples'])) {
            $row['example1'] = $cd['examples'][0] ?? '';
            $row['example2'] = $cd['examples'][1] ?? '';
            $row['example3'] = $cd['examples'][2] ?? '';
            $row['example4'] = $cd['examples'][3] ?? '';
        } else {
            $row['example1'] = $cd['example1a'] ?? $cd['examples'][0] ?? $cd['example'] ?? '';
            $row['example2'] = $cd['example2a'] ?? $cd['examples'][1] ?? '';
        }
        if ($type === 'usage_cases') {
            $row['usage1'] = $cd['usage1'] ?? '';
            $row['tip'] = $cd['tip'] ?? '';
        }
        if ($type === 'deep_dive' || $type === 'formula_table') {
            $row['tip'] = $cd['tip'] ?? '';
        }
    }

    $row['front_fields'] = !empty($cd['front_fields']) ? implode(',', $cd['front_fields']) : '';
    $row['back_fields'] = !empty($cd['back_fields']) ? implode(',', $cd['back_fields']) : '';
    $row['image_url'] = $cd['image_url'] ?? '';
    $row['description'] = $cd['description'] ?? '';
    $row['audio_url'] = $cd['audio_url'] ?? '';
    $row['prompt'] = $cd['prompt'] ?? '';
    $row['transcript'] = $cd['transcript'] ?? $cd['notes'] ?? '';

    fputcsv($out, $row, ';');
}

fclose($out);
