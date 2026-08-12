<!DOCTYPE html>
<html lang="en" translate="no">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="google" content="notranslate">
    <title>Database Setup - Flashcard Studio</title>
    <link href="https://fonts.cdnfonts.com/css/bubble-sans" rel="stylesheet">
    <link href="https://fonts.cdnfonts.com/css/stampatello-faceto" rel="stylesheet">
    <style>
        * { font-family: 'Stampatello Faceto', cursive !important; }
        h1, h2, button { font-family: 'Bubble Sans', sans-serif !important; text-transform: uppercase; letter-spacing: 0.02em; }
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .setup-card {
            background: white;
            border-radius: 24px;
            padding: 40px;
            max-width: 460px;
            width: 100%;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            border: 8px solid #374151;
        }
        .status-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            border-radius: 12px;
            border: 2px solid #e2e8f0;
            margin: 10px 0;
            font-size: 0.95rem;
        }
        .status-ok { background: #f0fdf4; border-color: #86efac; color: #166534; }
        .status-fail { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
        button {
            background: #16a34a;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 40px;
            font-size: 1.2rem;
            cursor: pointer;
            width: 100%;
            margin-top: 12px;
            box-shadow: 3px 3px 0px 0px rgba(0,0,0,0.2);
            transition: all 0.15s;
        }
        button:hover { transform: translateY(2px); box-shadow: 1px 1px 0px 0px rgba(0,0,0,0.2); }
        .error { color: #dc2626; text-align: center; margin-top: 10px; font-size: 0.9rem; }
        .hint { font-size: 0.8rem; color: #6b7280; margin: 10px 0; text-align: center; }
    </style>
</head>
<body>
    <div class="setup-card">
        <h1 class="text-2xl text-center marker-underline" style="margin-bottom: 12px;">🗄️ Database Setup</h1>
        <p class="text-center text-gray-600 mb-2">The database needs to be initialized before you can continue.</p>

        <div class="status-row <?= $dbConnected ? 'status-ok' : 'status-fail' ?>">
            <span><?= $dbConnected ? '✅' : '❌' ?></span>
            <span><?= $dbConnected ? 'Database connection OK' : 'Cannot connect to the database' ?></span>
        </div>
        <div class="status-row <?= $schemaReady ? 'status-ok' : 'status-fail' ?>">
            <span><?= $schemaReady ? '✅' : '❌' ?></span>
            <span><?= $schemaReady ? 'Tables already exist' : 'Tables missing or not initialized' ?></span>
        </div>

        <?php if (!$dbConnected): ?>
            <div class="hint">Check the credentials in config.php (host, name, user, pass) or the database exists on the server.</div>
        <?php endif; ?>

        <form method="post">
            <?= csrfField() ?>
            <button type="submit" name="create_db">Create Database</button>
            <?php if (isset($dbSetupError)): ?>
                <div class="error">❌ <?= escapeHtml($dbSetupError) ?></div>
            <?php endif; ?>
        </form>
        <a href="index.php" class="back-link" style="display:block;text-align:center;margin-top:20px;color:#64748b;text-decoration:none;">← Back to Flashcards</a>
    </div>
</body>
</html>
