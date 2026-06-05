<?php

if (session_status() === PHP_SESSION_NONE) { session_start(); }

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/User.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? 'login';

    if ($action === 'update_profile') {
        $userId = (int) ($input['user_id'] ?? 0);
        $fullName = trim($input['full_name'] ?? '');
        $englishLevel = $input['english_level'] ?? 'Beginner';
        if ($userId <= 0) {
            echo json_encode(['success' => false, 'error' => 'Invalid user']);
            exit;
        }
        $user = User::getById($userId);
        if (!$user) {
            echo json_encode(['success' => false, 'error' => 'User not found']);
            exit;
        }
        User::update($userId, $user['username'], $fullName, $englishLevel, $user['is_admin']);
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
        if (strlen($password) < 4) {
            echo json_encode(['success' => false, 'error' => 'Password must be at least 4 characters']);
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
        echo json_encode(['success' => true, 'student' => $user, 'new' => false]);
    }
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
