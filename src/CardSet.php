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
    }

    public static function getAll(): array
    {
        self::ensureTable();
        $pdo = Database::getConnection();
        $stmt = $pdo->query("SELECT id, name, exclusive_to FROM card_sets ORDER BY name ASC");
        return $stmt->fetchAll();
    }

    public static function getWithCards(string $username = ''): array
    {
        self::ensureTable();
        $pdo = Database::getConnection();
        $sql = "
            SELECT DISTINCT cs.id, cs.name
            FROM card_sets cs
            INNER JOIN cards c ON c.set_id = cs.id
        ";
        if ($username !== '') {
            $sql .= " WHERE cs.exclusive_to = '' OR FIND_IN_SET(" . $pdo->quote($username) . ", cs.exclusive_to)";
        }
        $sql .= " GROUP BY cs.id, cs.name ORDER BY cs.name ASC";
        $stmt = $pdo->query($sql);
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

    public static function create(string $name, string $exclusiveTo = ''): int
    {
        self::ensureTable();
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("INSERT INTO card_sets (name, exclusive_to) VALUES (?, ?)");
        $stmt->execute([$name, $exclusiveTo]);
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

    public static function update(int $id, string $name, string $exclusiveTo = ''): void
    {
        self::ensureTable();
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("UPDATE card_sets SET name = ?, exclusive_to = ? WHERE id = ?");
        $stmt->execute([$name, $exclusiveTo, $id]);
    }

    public static function delete(int $id): void
    {
        $pdo = Database::getConnection();
        $pdo->prepare("DELETE FROM card_sets WHERE id = ?")->execute([$id]);
    }
}
