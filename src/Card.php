<?php

class Card
{
    public static function getBySetAndLevels(
        ?int $setId,
        array $levels,
        bool $randomMode = false,
        int $limit = 500,
        ?int $excludeUserId = null,
        ?array $setIds = null
    ): array {
        $pdo = Database::getConnection();
        $sql = "SELECT c.id, c.set_id, c.title, c.pattern_type, c.level, c.question_text, c.content_data, s.name AS set_name FROM cards c LEFT JOIN card_sets s ON c.set_id = s.id WHERE 1=1";
        $params = [];

        if (!$randomMode && $setId !== null && $setId > 0) {
            $sql .= " AND c.set_id = ?";
            $params[] = $setId;
        } elseif (!$randomMode && ($setId === null || $setId === 0)) {
            $sql .= " AND c.set_id = 1";
        }

        if ($randomMode && !empty($setIds)) {
            $placeholders = implode(',', array_fill(0, count($setIds), '?'));
            $sql .= " AND c.set_id IN ($placeholders)";
            foreach ($setIds as $sid) {
                $params[] = (int) $sid;
            }
        }

        if (!empty($levels)) {
            $placeholders = implode(',', array_fill(0, count($levels), '?'));
            $sql .= " AND c.level IN ($placeholders)";
            foreach ($levels as $level) {
                $params[] = $level;
            }
        }

        if ($excludeUserId !== null && $excludeUserId > 0) {
            $sql .= " AND c.id NOT IN (SELECT card_id FROM user_card_progress WHERE user_id = ? AND next_review > CURDATE())";
            $params[] = $excludeUserId;
        }

        $sql .= " ORDER BY c.id ASC LIMIT " . (int) $limit;

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
            $stmt = $pdo->prepare("UPDATE cards SET set_id=?, title=?, pattern_type=?, level=?, question_text=?, content_data=? WHERE id=?");
            $stmt->execute([$setId, $title, $patternType, $level, $questionText, $contentData, $id]);
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
