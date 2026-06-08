<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

echo "<h1>Health Check</h1>\n";

echo "<h2>1. PHP Info</h2>\n";
echo "PHP Version: " . PHP_VERSION . "<br>\n";
echo "Server: " . ($_SERVER['SERVER_SOFTWARE'] ?? 'unknown') . "<br>\n";

echo "<h2>2. File Checks</h2>\n";
$files = [
    'index.php',
    'src/Database.php',
    'src/helpers.php',
    'src/CardSet.php',
    'src/User.php',
    'src/Review.php',
    'src/Card.php',
    'src/Student.php',
    'config.php',
];
foreach ($files as $f) {
    $path = __DIR__ . '/' . $f;
    echo "$f: " . (file_exists($path) ? 'OK' : 'MISSING') . "<br>\n";
}

echo "<h2>3. Config Check</h2>\n";
$configPath = __DIR__ . '/config.php';
if (file_exists($configPath)) {
    echo "config.php exists<br>\n";
    try {
        $config = require $configPath;
        echo "db host: " . ($config['db']['host'] ?? 'not set') . "<br>\n";
        echo "db name: " . ($config['db']['name'] ?? 'not set') . "<br>\n";
        echo "db user: " . ($config['db']['user'] ?? 'not set') . "<br>\n";
    } catch (Throwable $e) {
        echo "config.php error: " . $e->getMessage() . "<br>\n";
    }
} else {
    echo "config.php MISSING<br>\n";
}

echo "<h2>4. Database Connection</h2>\n";
try {
    require_once __DIR__ . '/src/Database.php';
    $conn = Database::getConnection();
    echo "Connected: OK<br>\n";
    echo "Server: " . $conn->getAttribute(PDO::ATTR_SERVER_VERSION) . "<br>\n";
} catch (Throwable $e) {
    echo "Database error: " . $e->getMessage() . "<br>\n";
}

echo "<h2>5. Includes Test</h2>\n";
try {
    require_once __DIR__ . '/src/helpers.php';
    require_once __DIR__ . '/src/CardSet.php';
    require_once __DIR__ . '/src/User.php';
    require_once __DIR__ . '/src/Review.php';
    require_once __DIR__ . '/src/Card.php';
    echo "All includes OK<br>\n";
} catch (Throwable $e) {
    echo "Include error: " . $e->getMessage() . "<br>\n";
}

echo "<h2>6. CardSet Query</h2>\n";
try {
    $sets = CardSet::getWithCards();
    echo count($sets) . " sets found<br>\n";
} catch (Throwable $e) {
    echo "CardSet error: " . $e->getMessage() . "<br>\n";
}

echo "<h2>Done</h2>\n";
