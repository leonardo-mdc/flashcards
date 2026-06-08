<?php

session_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/CardSet.php';
require_once __DIR__ . '/../src/Card.php';

$currentUser = $_SESSION['admin_user'] ?? null;
$isAdmin = $currentUser !== null && ($currentUser['is_admin'] ?? false);
if (!$isAdmin) {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'POST required']);
    exit;
}

try {
    if (!isset($_FILES['csv']) || $_FILES['csv']['error'] !== UPLOAD_ERR_OK) {
        echo json_encode(['success' => false, 'error' => 'CSV file required']);
        exit;
    }

    $handle = fopen($_FILES['csv']['tmp_name'], 'r');
    if (!$handle) {
        echo json_encode(['success' => false, 'error' => 'Cannot read file']);
        exit;
    }

    $header = fgetcsv($handle);
    if (!$header) {
        fclose($handle);
        echo json_encode(['success' => false, 'error' => 'Empty CSV']);
        exit;
    }

    $header = array_map('trim', $header);
    $colMap = array_flip($header);

    $required = ['type', 'title'];
    foreach ($required as $r) {
        if (!isset($colMap[$r])) {
            fclose($handle);
            echo json_encode(['success' => false, 'error' => "Missing column: $r"]);
            exit;
        }
    }

    $imported = 0;
    $errors = [];
    $rowNum = 1;

    while (($row = fgetcsv($handle)) !== false) {
        $rowNum++;
        $data = array_combine($header, array_pad($row, count($header), ''));

        $type = trim($data['type'] ?? '');
        $title = trim($data['title'] ?? '');
        $level = trim($data['level'] ?? '');
        $setName = trim($data['set'] ?? '');
        $setIdRaw = trim($data['set_id'] ?? '');

        if (empty($title) || empty($type)) continue;

        $validTypes = ['usage_cases', 'deep_dive', 'formula_table', 'multiple_choice', 'gap_fill', 'image_description', 'audio_listening', 'image_mcq'];
        if (!in_array($type, $validTypes)) {
            $errors[] = "Row $rowNum: Invalid type '$type'";
            continue;
        }

        $levelMap = [
            'beginner' => 'Beginner', 'a1' => 'Beginner', 'a2' => 'Beginner',
            'intermediate' => 'Intermediate', 'b1' => 'Intermediate', 'b2' => 'Intermediate',
            'advanced' => 'Advanced', 'c1' => 'Advanced', 'c2' => 'Advanced',
        ];
        $levelKey = strtolower(trim($level));
        $level = $levelMap[$levelKey] ?? 'Beginner';

        $setId = 0;
        if ($setIdRaw !== '' && is_numeric($setIdRaw) && (int)$setIdRaw > 0) {
            $setId = (int) $setIdRaw;
        }
        if (!empty($setName)) {
            $existing = CardSet::getIdByName($setName);
            if ($existing !== null) {
                $setId = $existing;
            } elseif ($setId === 0) {
                $setId = CardSet::create($setName);
            }
        }
        if ($setId === 0) {
            $setId = 1;
        }

        $questionText = trim($data['question_text'] ?? '');
        $definition = trim($data['definition'] ?? '');
        $sentence = trim($data['sentence'] ?? '');
        $correctAnswer = trim($data['correct_answer'] ?? '');
        $explanation = trim($data['explanation'] ?? '');
        $usage1 = trim($data['usage1'] ?? '');
        $tip = trim($data['tip'] ?? '');

        $examples = [];
        for ($i = 1; $i <= 4; $i++) {
            $val = trim($data["example$i"] ?? '');
            if (!empty($val)) $examples[] = $val;
        }

        $contentData = [];

        $imageUrl = trim($data['image_url'] ?? '');
        $audioUrl = trim($data['audio_url'] ?? '');
        $description = trim($data['description'] ?? '');
        $prompt = trim($data['prompt'] ?? '');
        $transcript = trim($data['transcript'] ?? '');

        if ($type === 'multiple_choice') {
            $options = [];
            for ($i = 1; $i <= 4; $i++) {
                $val = trim($data["opt$i"] ?? '');
                if (!empty($val)) $options[] = $val;
            }
            if (empty($options)) {
                $errors[] = "Row $rowNum: Multiple choice needs at least one option";
                continue;
            }
            $correctIdx = 0;
            if ($correctAnswer !== '') {
                $correctIdx = (int) $correctAnswer;
                if ($correctIdx < 0 || $correctIdx >= count($options)) $correctIdx = 0;
            }
            $contentData = [
                'options' => $options,
                'correct_index' => $correctIdx,
                'question_text' => $questionText ?: 'Select the correct answer:',
                'explanation' => $explanation,
                'image_url' => $imageUrl,
                'audio_url' => $audioUrl,
            ];
        } elseif ($type === 'gap_fill') {
            $answers = !empty($correctAnswer) ? array_map('trim', explode(',', $correctAnswer)) : ['answer'];
            $contentData = [
                'sentence' => $sentence ?: 'Complete: ______',
                'correct_answers' => $answers,
                'example' => $examples[0] ?? '',
                'image_url' => $imageUrl,
                'audio_url' => $audioUrl,
            ];
        } elseif ($type === 'image_mcq') {
            $options = [];
            for ($i = 1; $i <= 4; $i++) {
                $val = trim($data["opt$i"] ?? '');
                if (!empty($val)) $options[] = $val;
            }
            if (empty($options)) {
                $errors[] = "Row $rowNum: image_mcq needs at least one option";
                continue;
            }
            $correctIdx = 0;
            if ($correctAnswer !== '') {
                $correctIdx = (int) $correctAnswer;
                if ($correctIdx < 0 || $correctIdx >= count($options)) $correctIdx = 0;
            }
            $contentData = [
                'image_url' => $imageUrl,
                'options' => $options,
                'correct_index' => $correctIdx,
                'question_text' => $questionText ?: 'Select the correct answer:',
                'explanation' => $explanation,
            ];
        } elseif ($type === 'image_description') {
            $contentData = [
                'image_url' => $imageUrl,
                'description' => $description ?: $definition ?: 'No description',
            ];
        } elseif ($type === 'audio_listening') {
            $answers = !empty($correctAnswer) ? array_map('trim', explode(',', $correctAnswer)) : [];
            $contentData = [
                'audio_url' => $audioUrl,
                'prompt' => $prompt,
                'correct_answers' => $answers,
                'transcript' => $transcript,
                'notes' => $transcript,
            ];
        } else {
            $contentData = [
                'definition' => $definition ?: 'No definition',
                'image_url' => $imageUrl,
                'audio_url' => $audioUrl,
            ];
            if (!empty($usage1)) $contentData['usage1'] = $usage1;
            if (!empty($examples)) $contentData['example1a'] = $examples[0];
            if (!empty($tip)) $contentData['tip'] = $tip;
            if (count($examples) > 1) $contentData['example'] = $examples[1] ?? $examples[0];
        }

        if ($type === 'usage_cases' && empty($usage1) && !empty($examples)) {
            $contentData['usage1'] = $examples[0];
        }

        $cardId = isset($data['id']) && is_numeric($data['id']) ? (int) $data['id'] : 0;

        Card::save([
            'id' => $cardId,
            'set_id' => $setId,
            'title' => $title,
            'pattern_type' => $type,
            'level' => $level,
            'question_text' => ($type === 'multiple_choice' || $type === 'image_mcq') ? $questionText : '',
            'content_data' => $contentData,
        ]);
        $imported++;
    }

    fclose($handle);

    echo json_encode([
        'success' => true,
        'imported' => $imported,
        'errors' => $errors,
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
    ]);
}
