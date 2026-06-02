<?php

session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/User.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? 'login';
    $name = isset($input['name']) ? trim($input['name']) : '';
    $password = $input['password'] ?? '';

    if (empty($name) || empty($password)) {
        echo json_encode(['success' => false, 'error' => 'Name and password are required']);
        exit;
    }

    if ($action === 'register') {
        if (strlen($password) < 4) {
            echo json_encode(['success' => false, 'error' => 'Password must be at least 4 characters']);
            exit;
        }
        $user = User::register($name, $password);
        if (!$user) {
            echo json_encode(['success' => false, 'error' => 'Name already taken. Please log in.']);
            exit;
        }
        $_SESSION['student_user'] = $user;
        echo json_encode(['success' => true, 'student' => $user, 'new' => true]);
    } else {
        $user = User::authenticate($name, $password);
        if (!$user) {
            echo json_encode(['success' => false, 'error' => 'Invalid name or password']);
            exit;
        }
        $_SESSION['student_user'] = $user;
        echo json_encode(['success' => true, 'student' => $user, 'new' => false]);
    }
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
