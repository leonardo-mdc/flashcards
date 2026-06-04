<?php

class CardSet
{
    public static function getAll(): array
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->query("SELECT id, name, description, created_at FROM card_sets ORDER BY name ASC");
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

    public static function create(string $name, string $description = ''): int
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("INSERT INTO card_sets (name, description) VALUES (?, ?)");
        $stmt->execute([$name, $description]);
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

    public static function update(int $id, string $name, string $description = ''): void
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("UPDATE card_sets SET name = ?, description = ? WHERE id = ?");
        $stmt->execute([$name, $description, $id]);
    }

    public static function delete(int $id): void
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM card_sets WHERE id = ?");
        $stmt->execute([$id]);
    }
}
