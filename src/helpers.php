<?php

function escapeHtml($str): string
{
    if ($str === null) return '';
    return htmlspecialchars((string) $str, ENT_QUOTES, 'UTF-8');
}

function formatBreaks($text): string
{
    if ($text === null) return '';
    return str_replace(['\\br', '\\br '], '<br>', (string) $text);
}

function assetVersion(string $path): string
{
    $full = __DIR__ . '/../' . $path;
    $mtime = file_exists($full) ? filemtime($full) : 0;
    return $path . '?v=' . $mtime;
}

function csrfToken(): string
{
    if (!isset($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}

function csrfField(): string
{
    return '<input type="hidden" name="csrf_token" value="' . escapeHtml(csrfToken()) . '">';
}

function verifyCsrfToken(?string $token): bool
{
    if (!$token || empty($_SESSION['csrf_token'])) {
        return false;
    }

    return hash_equals($_SESSION['csrf_token'], $token);
}

function sessionStudentUser(): ?array
{
    $user = $_SESSION['student_user'] ?? null;
    return is_array($user) ? $user : null;
}

function isAdminUser(?array $user): bool
{
    return is_array($user) && !empty($user['is_admin']);
}

function requireSessionStudent(int $requestedUserId): ?array
{
    $user = sessionStudentUser();
    if (!$user || empty($user['id'])) {
        return null;
    }

    if ((int) $user['id'] !== (int) $requestedUserId) {
        return null;
    }

    return $user;
}
