<?php

class User
{
    public static function ensureTable(): void
    {
        $pdo = Database::getConnection();
        $pdo->exec("CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            is_admin TINYINT(1) DEFAULT 0,
            progress INT DEFAULT 0,
            english_level VARCHAR(50) DEFAULT 'Beginner',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");

        $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'progress'");
        if (!$stmt->fetch()) {
            $pdo->exec("ALTER TABLE users ADD COLUMN progress INT DEFAULT 0 AFTER is_admin");
        }
        $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'english_level'");
        if (!$stmt->fetch()) {
            $pdo->exec("ALTER TABLE users ADD COLUMN english_level VARCHAR(50) DEFAULT 'Beginner' AFTER progress");
        }
    }

    public static function authenticate(string $username, string $password): ?array
    {
        self::ensureTable();
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT id, username, password_hash, is_admin, progress, english_level FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password_hash'])) {
            unset($user['password_hash']);
            $user['is_admin'] = (bool) $user['is_admin'];
            return $user;
        }

        return null;
    }

    public static function create(string $username, string $password, bool $isAdmin = false): array
    {
        self::ensureTable();
        $pdo = Database::getConnection();
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)");
        $stmt->execute([$username, $hash, $isAdmin ? 1 : 0]);
        return [
            'id' => (int) $pdo->lastInsertId(),
            'username' => $username,
            'is_admin' => $isAdmin,
            'progress' => 0,
            'english_level' => 'Beginner',
        ];
    }

    public static function register(string $username, string $password): ?array
    {
        self::ensureTable();
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            return null;
        }

        return self::create($username, $password, false);
    }

    public static function getAll(): array
    {
        self::ensureTable();
        $pdo = Database::getConnection();
        $stmt = $pdo->query("SELECT id, username, is_admin, progress, english_level, created_at FROM users ORDER BY id ASC");
        $users = $stmt->fetchAll();
        foreach ($users as &$user) {
            $user['is_admin'] = (bool) $user['is_admin'];
        }
        return $users;
    }

    public static function getById(int $id): ?array
    {
        self::ensureTable();
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT id, username, is_admin, progress, english_level, created_at FROM users WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if ($row) {
            $row['is_admin'] = (bool) $row['is_admin'];
        }
        return $row ?: null;
    }

    public static function hasAdmins(): bool
    {
        self::ensureTable();
        $pdo = Database::getConnection();
        $stmt = $pdo->query("SELECT COUNT(*) FROM users WHERE is_admin = 1");
        return $stmt->fetchColumn() > 0;
    }

    public static function delete(int $id): void
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$id]);
    }

    public static function updateProgress(int $id, int $progress, string $englishLevel): void
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("UPDATE users SET progress = ?, english_level = ? WHERE id = ?");
        $stmt->execute([$progress, $englishLevel, $id]);
    }
}
