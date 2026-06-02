<?php

class Student
{
    public static function ensureTable(): void
    {
        $pdo = Database::getConnection();
        $pdo->exec("CREATE TABLE IF NOT EXISTS students (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            password_hash VARCHAR(255) NOT NULL DEFAULT '',
            progress INT DEFAULT 0,
            english_level VARCHAR(50) DEFAULT 'Beginner',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");

        $stmt = $pdo->query("SHOW COLUMNS FROM students LIKE 'password_hash'");
        if (!$stmt->fetch()) {
            $pdo->exec("ALTER TABLE students ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '' AFTER name");
        }
        $stmt = $pdo->query("SHOW COLUMNS FROM students LIKE 'progress'");
        if (!$stmt->fetch()) {
            $pdo->exec("ALTER TABLE students ADD COLUMN progress INT DEFAULT 0 AFTER password_hash");
        }
        $stmt = $pdo->query("SHOW COLUMNS FROM students LIKE 'english_level'");
        if (!$stmt->fetch()) {
            $pdo->exec("ALTER TABLE students ADD COLUMN english_level VARCHAR(50) DEFAULT 'Beginner' AFTER progress");
        }
    }

    public static function register(string $name, string $password): ?array
    {
        self::ensureTable();
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("SELECT id FROM students WHERE name = ?");
        $stmt->execute([$name]);
        if ($stmt->fetch()) {
            return null;
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare("INSERT INTO students (name, password_hash) VALUES (?, ?)");
        $stmt->execute([$name, $hash]);
        return [
            'id' => (int) $pdo->lastInsertId(),
            'name' => $name,
            'progress' => 0,
            'english_level' => 'Beginner',
        ];
    }

    public static function authenticate(string $name, string $password): ?array
    {
        self::ensureTable();
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT id, name, password_hash, progress, english_level FROM students WHERE name = ?");
        $stmt->execute([$name]);
        $student = $stmt->fetch();

        if ($student && !empty($student['password_hash']) && password_verify($password, $student['password_hash'])) {
            unset($student['password_hash']);
            return $student;
        }

        return null;
    }

    public static function createOrGet(string $name): array
    {
        self::ensureTable();
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("SELECT id, name, progress, english_level FROM students WHERE name = ?");
        $stmt->execute([$name]);
        $existing = $stmt->fetch();

        if ($existing) {
            return $existing;
        }

        $stmt = $pdo->prepare("INSERT INTO students (name) VALUES (?)");
        $stmt->execute([$name]);
        return [
            'id' => (int) $pdo->lastInsertId(),
            'name' => $name,
            'progress' => 0,
            'english_level' => 'Beginner',
        ];
    }

    public static function getById(int $id): ?array
    {
        self::ensureTable();
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT id, name, progress, english_level, created_at FROM students WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function updateProgress(int $id, int $progress, string $englishLevel): void
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("UPDATE students SET progress = ?, english_level = ? WHERE id = ?");
        $stmt->execute([$progress, $englishLevel, $id]);
    }
}
