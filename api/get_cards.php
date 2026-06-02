<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Card.php';

try {
    $setId = null;
    $studentId = 0;
    $selectedLevels = [];
    $randomMode = false;

    $input = json_decode(file_get_contents('php://input'), true);
    if ($input) {
        $setId = isset($input['set_id']) ? (int) $input['set_id'] : null;
        $studentId = isset($input['student_id']) ? (int) $input['student_id'] : 0;
        $selectedLevels = isset($input['levels']) ? $input['levels'] : [];
        $randomMode = isset($input['random_mode']) && ($input['random_mode'] === true || $input['random_mode'] === 'true');
    }

    if (!$input) {
        $setId = isset($_POST['set_id']) ? (int) $_POST['set_id'] : (isset($_GET['set_id']) ? (int) $_GET['set_id'] : null);
        $studentId = isset($_POST['student_id']) ? (int) $_POST['student_id'] : (isset($_GET['student_id']) ? (int) $_GET['student_id'] : 0);
        $randomMode = isset($_POST['random_mode']) ? ($_POST['random_mode'] === 'true') : (isset($_GET['random_mode']) ? ($_GET['random_mode'] === 'true') : false);

        if (isset($_POST['levels'])) {
            if (is_array($_POST['levels'])) {
                $selectedLevels = $_POST['levels'];
            } else {
                $selectedLevels = json_decode($_POST['levels'], true);
                if (!is_array($selectedLevels)) {
                    $selectedLevels = explode(',', $_POST['levels']);
                }
            }
        } elseif (isset($_GET['levels'])) {
            if (is_array($_GET['levels'])) {
                $selectedLevels = $_GET['levels'];
            } else {
                $selectedLevels = explode(',', $_GET['levels']);
            }
        }
    }

    if (empty($selectedLevels)) {
        $selectedLevels = ['Beginner', 'Intermediate', 'Advanced'];
    }

    $cards = Card::getBySetAndLevels($setId, $selectedLevels, $randomMode);

    $setName = null;
    if (!$randomMode && $setId !== null && $setId > 0) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT name FROM card_sets WHERE id = ?");
        $stmt->execute([$setId]);
        $row = $stmt->fetch();
        $setName = $row ? $row['name'] : null;
    }

    echo json_encode([
        'success' => true,
        'cards' => $cards,
        'count' => count($cards),
        'set_id' => $setId,
        'set_name' => $setName,
        'random_mode' => $randomMode,
        'levels_used' => $selectedLevels,
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Database error: ' . $e->getMessage(),
        'cards' => [],
    ]);
}
