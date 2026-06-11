<?php

require_once __DIR__ . '/../src/session_init.php';
initSession();

header('Content-Type: application/json');

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Student.php';
require_once __DIR__ . '/../src/helpers.php';

try {
    $sessionUser = sessionStudentUser();
    if (!$sessionUser) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Forbidden']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $studentName = isset($input['name']) ? trim($input['name']) : '';

    if (empty($studentName)) {
        echo json_encode(['success' => false, 'error' => 'Student name is required']);
        exit;
    }

    $student = Student::createOrGet($studentName);
    echo json_encode([
        'success' => true,
        'student' => $student,
        'existing' => isset($student['id']),
    ]);
} catch (PDOException $e) {
    error_log('Create student error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error' => 'A database error occurred.',
    ]);
}
