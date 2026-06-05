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
