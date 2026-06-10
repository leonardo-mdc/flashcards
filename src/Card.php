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

    public static function getAll(): array
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->query("SELECT c.id, c.set_id, c.title, c.pattern_type, c.level, c.question_text, c.content_data, s.name AS set_name FROM cards c LEFT JOIN card_sets s ON c.set_id = s.id ORDER BY s.name, c.id");
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

        self::ensurePatternTypeEnum($patternType);

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

    public static function updateType(int $id, string $type): void
    {
        self::ensurePatternTypeEnum($type);
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("UPDATE cards SET pattern_type = ? WHERE id = ?");
        $stmt->execute([$type, $id]);
    }

    public static function delete(int $id): void
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM cards WHERE id = ?");
        $stmt->execute([$id]);
    }

    private static function ensurePatternTypeEnum(string $type): void
    {
        $known = ['usage_cases','deep_dive','formula_table','multiple_choice','gap_fill','image_description','audio_listening','image_mcq'];
        if (!in_array($type, $known)) return;

        $pdo = Database::getConnection();
        $col = $pdo->query("SHOW COLUMNS FROM cards WHERE Field = 'pattern_type'")->fetch();
        if (!$col) return;

        $enum = $col['Type'];
        if (strpos($enum, $type) !== false) return;

        $escaped = array_map(fn($v) => "'" . str_replace("'", "''", $v) . "'", $known);
        $pdo->exec("ALTER TABLE cards MODIFY pattern_type ENUM(" . implode(',', $escaped) . ") DEFAULT 'usage_cases'");
    }

    public static function fixTruncatedPatternTypes(): array
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->query("SELECT id, pattern_type, title, content_data FROM cards WHERE pattern_type IS NULL OR pattern_type = ''");
        $broken = $stmt->fetchAll();
        $fixed = [];

        foreach ($broken as $card) {
            $data = json_decode($card['content_data'], true) ?: [];
            $guessed = self::guessPatternType($data, $card['title'] ?? '');
            if ($guessed) {
                $pdo->prepare("UPDATE cards SET pattern_type = ? WHERE id = ?")
                    ->execute([$guessed, (int) $card['id']]);
                self::ensurePatternTypeEnum($guessed);
                $fixed[] = ['id' => (int) $card['id'], 'title' => $card['title'], 'set_type' => $guessed];
            }
        }
        return $fixed;
    }

    private static function guessPatternType(array $data, string $title): ?string
    {
        $hasImage = !empty($data['image_url']);
        $hasAudio = !empty($data['audio_url']);
        $hasOptions = isset($data['options']) && is_array($data['options']);
        $hasCorrectIndex = isset($data['correct_index']);
        $hasSentence = !empty($data['sentence']);
        $hasDescription = !empty($data['description']);
        $hasPrompt = !empty($data['prompt']);
        $hasCorrectAnswers = !empty($data['correct_answers']);

        if ($hasImage && $hasOptions) return 'image_mcq';
        if ($hasImage && $hasDescription) return 'image_description';
        if ($hasAudio && ($hasPrompt || $hasCorrectAnswers)) return 'audio_listening';
        if ($hasOptions && $hasCorrectIndex) return 'multiple_choice';
        if ($hasSentence && $hasCorrectAnswers) return 'gap_fill';

        return null;
    }
}
