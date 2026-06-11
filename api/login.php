<?php

require_once __DIR__ . '/../src/session_init.php';
initSession();
header('Content-Type: application/json');

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/Review.php';

$rateLimitFile = sys_get_temp_dir() . '/login_attempts_' . md5($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$rateLimitWindow = 300;
$rateLimitMax = 20;

function checkRateLimit(string $file, int $window, int $max): bool
{
    $attempts = [];
    if (file_exists($file)) {
        $attempts = json_decode(file_get_contents($file), true) ?: [];
        $attempts = array_filter($attempts, fn($t) => $t > time() - $window);
    }
    if (count($attempts) >= $max) return false;
    $attempts[] = time();
    file_put_contents($file, json_encode($attempts));
    return true;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? 'login';

    if ($action === 'login' || $action === 'register') {
        if (!checkRateLimit($rateLimitFile, $rateLimitWindow, $rateLimitMax)) {
            echo json_encode(['success' => false, 'error' => 'Too many attempts. Please try again later.']);
            exit;
        }
    }

    if ($action === 'update_profile') {
        $userId = (int) ($input['user_id'] ?? 0);
        $fullName = trim($input['full_name'] ?? '');
        $englishLevel = $input['english_level'] ?? 'Beginner';
        $password = isset($input['password']) ? trim($input['password']) : null;
        if ($userId <= 0) {
            echo json_encode(['success' => false, 'error' => 'Invalid user']);
            exit;
        }
        $user = User::getById($userId);
        if (!$user) {
            echo json_encode(['success' => false, 'error' => 'User not found']);
            exit;
        }
        User::update($userId, $user['username'], $fullName, $englishLevel, $user['is_admin'], $password);
        if (isset($_SESSION['student_user']) && $_SESSION['student_user']['id'] === $userId) {
            $_SESSION['student_user']['full_name'] = $fullName;
            $_SESSION['student_user']['english_level'] = $englishLevel;
        }
        echo json_encode(['success' => true]);
        exit;
    }

    $name = isset($input['name']) ? trim($input['name']) : '';
    $password = $input['password'] ?? '';

    if (empty($name) || empty($password)) {
        echo json_encode(['success' => false, 'error' => 'Name and password are required']);
        exit;
    }

    if (strlen($name) > 30) {
        echo json_encode(['success' => false, 'error' => 'Username must be 30 characters or less']);
        exit;
    }

    if ($action === 'register') {
        if (strlen($password) < 6) {
            echo json_encode(['success' => false, 'error' => 'Password must be at least 6 characters']);
            exit;
        }
        $fullName = isset($input['full_name']) ? trim($input['full_name']) : '';
        $englishLevel = isset($input['english_level']) ? trim($input['english_level']) : 'Beginner';
        $user = User::register($name, $password, $fullName, $englishLevel);
        if (!$user) {
            echo json_encode(['success' => false, 'error' => 'Name already taken. Please log in.']);
            exit;
        }
        session_regenerate_id(true);
        $_SESSION['student_user'] = $user;
        if (!empty($user['is_admin'])) {
            $_SESSION['admin_user'] = $user;
        }
        $user['accessible_set_ids'] = Review::getAccessibleSets((int) $user['id'], $user['username'] ?? '');
        echo json_encode(['success' => true, 'student' => $user, 'new' => true]);
    } else {
        $user = User::authenticate($name, $password);
        if (!$user) {
            echo json_encode(['success' => false, 'error' => 'Invalid name or password']);
            exit;
        }
        session_regenerate_id(true);
        $_SESSION['student_user'] = $user;
        if (!empty($user['is_admin'])) {
            $_SESSION['admin_user'] = $user;
        }
        $user['accessible_set_ids'] = Review::getAccessibleSets((int) $user['id'], $user['username'] ?? '');
        echo json_encode(['success' => true, 'student' => $user, 'new' => false]);
    }
} catch (PDOException $e) {
    error_log('Login API error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'A database error occurred.']);
}
