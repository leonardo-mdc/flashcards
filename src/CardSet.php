<?php

class CardSet
{
    public static function getAll(): array
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->query("SELECT id, name FROM card_sets ORDER BY name ASC");
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

    public static function create(string $name): int
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("INSERT INTO card_sets (name) VALUES (?)");
        $stmt->execute([$name]);
        return (int) $pdo->lastInsertId();
    }

    public static function update(int $id, string $name): void
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("UPDATE card_sets SET name = ? WHERE id = ?");
        $stmt->execute([$name, $id]);
    }

    public static function delete(int $id): void
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM card_sets WHERE id = ?");
        $stmt->execute([$id]);
    }
}
