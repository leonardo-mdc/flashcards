<?php
/**
 * Database connection singleton.
 * All PDO instances share the same connection via ::getConnection().
 */
class Database
{
    private static ?PDO $instance = null;

    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            $config = require __DIR__ . '/../config.php';
            $db = $config['db'];
            self::$instance = new PDO(
                "mysql:host={$db['host']};dbname={$db['name']};charset=utf8mb4",
                $db['user'],
                $db['pass'],
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                ]
            );
        }
        return self::$instance;
    }

    public static function testConnection(): bool
    {
        try {
            self::getConnection();
            return true;
        } catch (PDOException $e) {
            return false;
        }
    }
}
