<?php
/**
 * CardSet model — queries the card_sets table.
 */
class CardSet
{
    public static function getAll(): array
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->query("SELECT id, name FROM card_sets ORDER BY id ASC");
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
            ORDER BY cs.id ASC
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
}
