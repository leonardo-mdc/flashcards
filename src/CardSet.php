<?php

class CardSet
{
    public static function ensureTable(): void
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->query("SHOW COLUMNS FROM card_sets LIKE 'exclusive_to'");
        if (!$stmt->fetch()) {
            $pdo->exec("ALTER TABLE card_sets ADD COLUMN exclusive_to VARCHAR(255) DEFAULT '' AFTER name");
        }
        $stmt = $pdo->query("SHOW COLUMNS FROM card_sets LIKE 'description'");
        if (!$stmt->fetch()) {
            $pdo->exec("ALTER TABLE card_sets ADD COLUMN description TEXT AFTER name");
        }
    }

    public static function ensureIndexes(): void
    {
        $pdo = Database::getConnection();
        try {
            $pdo->exec("ALTER TABLE cards ADD INDEX idx_level (level)");
        } catch (\PDOException $e) {
            if ($e->getCode() !== '42000') throw $e;
        }
        try {
            $pdo->exec("ALTER TABLE cards ADD INDEX idx_pattern_type (pattern_type)");
        } catch (\PDOException $e) {
            if ($e->getCode() !== '42000') throw $e;
        }
        try {
            $pdo->exec("ALTER TABLE cards ADD INDEX idx_set_id (set_id)");
        } catch (\PDOException $e) {
            if ($e->getCode() !== '42000') throw $e;
        }
    }

    public static function getAll(): array
    {
        self::ensureTable();
        self::ensureIndexes();
        $pdo = Database::getConnection();
        $stmt = $pdo->query("
            SELECT cs.id, cs.name, cs.description, cs.exclusive_to,
                   (SELECT COUNT(*) FROM cards c WHERE c.set_id = cs.id) AS card_count
            FROM card_sets cs
            ORDER BY cs.name ASC
        ");
        return $stmt->fetchAll();
    }

    public static function getWithCards(): array
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->query("
            SELECT DISTINCT cs.id, cs.name
            FROM card_sets cs
            INNER JOIN cards c ON c.set_id = cs.id
            GROUP BY cs.id, cs.name
            ORDER BY cs.name ASC
        ");
        return $stmt->fetchAll();
    }

    public static function getName(int $id): ?string
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT name FROM card_sets WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? $row['name'] : null;
    }

    public static function create(string $name, string $exclusiveTo = '', string $description = ''): int
    {
        self::ensureTable();
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("INSERT INTO card_sets (name, description, exclusive_to) VALUES (?, ?, ?)");
        $stmt->execute([$name, $description, $exclusiveTo]);
        return (int) $pdo->lastInsertId();
    }

    public static function getIdByName(string $name): ?int
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT id FROM card_sets WHERE name = ?");
        $stmt->execute([$name]);
        $row = $stmt->fetch();
        return $row ? (int) $row['id'] : null;
    }

    public static function update(int $id, string $name, string $exclusiveTo = '', string $description = ''): void
    {
        self::ensureTable();
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("UPDATE card_sets SET name = ?, description = ?, exclusive_to = ? WHERE id = ?");
        $stmt->execute([$name, $description, $exclusiveTo, $id]);
    }

    public static function delete(int $id): void
    {
        $pdo = Database::getConnection();
        $pdo->prepare("DELETE FROM card_sets WHERE id = ?")->execute([$id]);
    }
}
