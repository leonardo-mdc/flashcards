<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - Flashcard Studio</title>
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
        .login-card {
            background: white;
            border-radius: 24px;
            padding: 40px;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            border: 8px solid #374151;
        }
        input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            font-size: 1rem;
            margin: 16px 0;
        }
        button {
            background: #1d4ed8;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 40px;
            font-size: 1.2rem;
            cursor: pointer;
            width: 100%;
            box-shadow: 3px 3px 0px 0px rgba(0,0,0,0.2);
            transition: all 0.15s;
        }
        button:hover { transform: translateY(2px); box-shadow: 1px 1px 0px 0px rgba(0,0,0,0.2); }
        .error { color: #dc2626; text-align: center; margin-top: 10px; }
        .back-link {
            display: block;
            text-align: center;
            margin-top: 20px;
            color: #64748b;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="login-card">
        <h1 class="text-2xl text-center marker-underline" style="margin-bottom: 20px;">🔒 Admin Access</h1>
        <form method="post">
            <input type="password" name="password" placeholder="Enter admin password" autofocus>
            <button type="submit" name="login">Enter</button>
            <?php if (isset($loginError)): ?>
                <div class="error">❌ <?= escapeHtml($loginError) ?></div>
            <?php endif; ?>
        </form>
        <a href="index.php" class="back-link">← Back to Flashcards</a>
    </div>
</body>
</html>
