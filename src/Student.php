<?php
/**
 * Student model — queries on the students table.
 */
class Student
{
    public static function createOrGet(string $name): array
    {
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("SELECT id, name FROM students WHERE name = ?");
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
        ];
    }
}
