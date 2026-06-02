<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Student.php';

try {
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
    echo json_encode([
        'success' => false,
        'error' => 'Database error: ' . $e->getMessage(),
    ]);
}
