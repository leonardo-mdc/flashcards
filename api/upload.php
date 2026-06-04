<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$type = $_POST['type'] ?? ''; // 'image' or 'audio'
if (!in_array($type, ['image', 'audio'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid type. Must be "image" or "audio".']);
    exit;
}

$dir = $type === 'image' ? __DIR__ . '/../uploads/images' : __DIR__ . '/../uploads/audio';
if (!is_dir($dir)) mkdir($dir, 0755, true);

$field = $type === 'image' ? 'image' : 'audio';
if (!isset($_FILES[$field]) || $_FILES[$field]['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded or upload error.']);
    exit;
}

$allowedImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
$allowedAudio = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-wav'];
$allowed = $type === 'image' ? $allowedImage : $allowedAudio;

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $_FILES[$field]['tmp_name']);
finfo_close($finfo);

if (!in_array($mime, $allowed)) {
    http_response_code(400);
    echo json_encode(['error' => "Invalid $type type: " . $mime]);
    exit;
}

$ext = match ($mime) {
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/gif' => 'gif',
    'image/webp' => 'webp',
    'audio/mpeg' => 'mp3',
    'audio/wav', 'audio/x-wav' => 'wav',
    'audio/ogg' => 'ogg',
    'audio/mp4' => 'mp4',
    default => pathinfo($_FILES[$field]['name'], PATHINFO_EXTENSION),
};

$filename = uniqid() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '', basename($_FILES[$field]['name']));
$dest = $dir . '/' . $filename;

if (!move_uploaded_file($_FILES[$field]['tmp_name'], $dest)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save file.']);
    exit;
}

$url = ($type === 'image' ? 'uploads/images/' : 'uploads/audio/') . $filename;

echo json_encode(['success' => true, 'url' => $url, 'filename' => $filename]);
