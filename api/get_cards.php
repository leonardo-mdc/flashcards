<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Card.php';
require_once __DIR__ . '/../src/Review.php';

try {
    $setId = null;
    $studentId = 0;
    $selectedLevels = [];
    $studentLevel = null;
    $randomMode = false;
    $setIds = [];

    $input = json_decode(file_get_contents('php://input'), true);
    if ($input) {
        $setId = isset($input['set_id']) ? (int) $input['set_id'] : null;
        $studentId = isset($input['student_id']) ? (int) $input['student_id'] : 0;
        $selectedLevels = isset($input['levels']) ? $input['levels'] : [];
        $randomMode = isset($input['random_mode']) && ($input['random_mode'] === true || $input['random_mode'] === 'true');
        $studentLevel = isset($input['student_level']) ? $input['student_level'] : null;
        $setIds = isset($input['set_ids']) ? (array) $input['set_ids'] : [];
        $dueOnly = isset($input['due_only']) ? filter_var($input['due_only'], FILTER_VALIDATE_BOOLEAN) : false;
    }

    if (!$input) {
        $setId = isset($_POST['set_id']) ? (int) $_POST['set_id'] : (isset($_GET['set_id']) ? (int) $_GET['set_id'] : null);
        $studentId = isset($_POST['student_id']) ? (int) $_POST['student_id'] : (isset($_GET['student_id']) ? (int) $_GET['student_id'] : 0);
        $randomMode = isset($_POST['random_mode']) ? ($_POST['random_mode'] === 'true') : (isset($_GET['random_mode']) ? ($_GET['random_mode'] === 'true') : false);
        $studentLevel = isset($_POST['student_level']) ? $_POST['student_level'] : (isset($_GET['student_level']) ? $_GET['student_level'] : null);

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
        if (isset($_POST['set_ids'])) {
            $setIds = is_array($_POST['set_ids']) ? $_POST['set_ids'] : explode(',', $_POST['set_ids']);
        } elseif (isset($_GET['set_ids'])) {
            $setIds = explode(',', $_GET['set_ids']);
        }
    }

    if (empty($selectedLevels)) {
        if ($studentLevel && $studentLevel !== '') {
            $selectedLevels = [$studentLevel, 'Beginner', 'Intermediate', 'Advanced'];
        } else {
            $selectedLevels = ['Beginner', 'Intermediate', 'Advanced'];
        }
    }

    Review::checkAndResetCycle($studentId);

    $totalAvailable = 0;
    $pdo = Database::getConnection();
    $countSql = "SELECT COUNT(*) FROM cards c WHERE 1=1";
    $countParams = [];

    if (!$randomMode && $setId !== null && $setId > 0) {
        $countSql .= " AND c.set_id = ?";
        $countParams[] = $setId;
    } elseif (!$randomMode && ($setId === null || $setId === 0)) {
        $countSql .= " AND c.set_id = 1";
    }
    if ($randomMode && !empty($setIds)) {
        $placeholders = implode(',', array_fill(0, count($setIds), '?'));
        $countSql .= " AND c.set_id IN ($placeholders)";
        foreach ($setIds as $sid) {
            $countParams[] = (int) $sid;
        }
    }
    if (!empty($selectedLevels)) {
        $placeholders = implode(',', array_fill(0, count($selectedLevels), '?'));
        $countSql .= " AND c.level IN ($placeholders)";
        foreach ($selectedLevels as $lvl) {
            $countParams[] = $lvl;
        }
    }
    $stmt = $pdo->prepare($countSql);
    $stmt->execute($countParams);
    $totalAvailable = (int) $stmt->fetchColumn();

    $cards = Card::getBySetAndLevels($setId, $selectedLevels, $randomMode, 500, $studentId, !empty($setIds) ? $setIds : null);

    if ($dueOnly && $studentId > 0) {
        $dueStmt = $pdo->prepare("SELECT card_id FROM user_card_progress WHERE user_id = ? AND next_review <= CURDATE()");
        $dueStmt->execute([$studentId]);
        $dueIds = $dueStmt->fetchAll(PDO::FETCH_COLUMN);
        $dueIds = array_map('intval', $dueIds);
        $cards = array_values(array_filter($cards, fn($c) => in_array((int)$c['id'], $dueIds)));
    }

    $allDueReviewed = $totalAvailable > 0 && empty($cards);

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
        'all_due_reviewed' => $allDueReviewed,
        'total_available' => $totalAvailable,
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Database error: ' . $e->getMessage(),
        'cards' => [],
    ]);
}
