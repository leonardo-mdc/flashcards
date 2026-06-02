<?php
/**
 * Card model — queries and mutations on the cards table.
 */
class Card
{
    public static function getBySetAndLevels(
        ?int $setId,
        array $levels,
        bool $randomMode = false,
        int $limit = 500
    ): array {
        $pdo = Database::getConnection();
        $sql = "SELECT id, set_id, title, pattern_type, level, question_text, content_data FROM cards WHERE 1=1";
        $params = [];

        if (!$randomMode && $setId !== null && $setId > 0) {
            $sql .= " AND set_id = ?";
            $params[] = $setId;
        } elseif (!$randomMode && ($setId === null || $setId === 0)) {
            $sql .= " AND set_id = 1";
            $params[] = 1;
        }

        if (!empty($levels)) {
            $placeholders = implode(',', array_fill(0, count($levels), '?'));
            $sql .= " AND level IN ($placeholders)";
            foreach ($levels as $level) {
                $params[] = $level;
            }
        }

        $sql .= " ORDER BY id ASC LIMIT " . (int) $limit;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $cards = $stmt->fetchAll();

        foreach ($cards as &$card) {
            if (!empty($card['content_data'])) {
                $decoded = json_decode($card['content_data'], true);
                $card['content_data'] = $decoded ?: [];
            } else {
                $card['content_data'] = [];
            }
        }

        return $cards;
    }

    public static function getBySet(int $setId): array
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT id, set_id, title, pattern_type, level, question_text, content_data FROM cards WHERE set_id = ? ORDER BY id");
        $stmt->execute([$setId]);
        return $stmt->fetchAll();
    }

    public static function getById(int $id): ?array
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM cards WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function save(array $data): int
    {
        $pdo = Database::getConnection();
        $id = (int) ($data['id'] ?? 0);
        $setId = (int) ($data['set_id'] ?? 1);
        $title = $data['title'] ?? '';
        $patternType = $data['pattern_type'] ?? 'usage_cases';
        $level = $data['level'] ?? 'Beginner';
        $questionText = $data['question_text'] ?? '';
        $contentData = json_encode($data['content_data'] ?? []);

        if ($id > 0) {
            $stmt = $pdo->prepare("UPDATE cards SET title=?, pattern_type=?, level=?, question_text=?, content_data=? WHERE id=?");
            $stmt->execute([$title, $patternType, $level, $questionText, $contentData, $id]);
            return $id;
        } else {
            $stmt = $pdo->prepare("INSERT INTO cards (set_id, title, pattern_type, level, question_text, content_data) VALUES (?,?,?,?,?,?)");
            $stmt->execute([$setId, $title, $patternType, $level, $questionText, $contentData]);
            return (int) $pdo->lastInsertId();
        }
    }

    public static function delete(int $id): void
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM cards WHERE id = ?");
        $stmt->execute([$id]);
    }
}
