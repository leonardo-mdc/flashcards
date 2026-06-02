<?php

class Student
{
    public static function createOrGet(string $name): array
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT id, username AS name, progress, english_level FROM users WHERE username = ?");
        $stmt->execute([$name]);
        $existing = $stmt->fetch();

        if ($existing) {
            return $existing;
        }

        $hash = password_hash($name, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
        $stmt->execute([$name, $hash]);
        return [
            'id' => (int) $pdo->lastInsertId(),
            'name' => $name,
            'progress' => 0,
            'english_level' => 'Beginner',
        ];
    }
}
