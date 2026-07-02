<?php
/**
 * Eco Yacht Surveyors — diagnostics endpoint.
 * Visit /api/debug in a browser to see what the email handler can see.
 * REMOVE THIS FILE before going fully live (it exposes config presence).
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

function load_env(string $path): array {
    $out = [];
    if (!file_exists($path)) return $out;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (!str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $out[trim($k)] = trim(trim($v), '"\'');
    }
    return $out;
}

$env = load_env(__DIR__ . '/../.env');
$hasPhpMailer = file_exists(__DIR__ . '/../PHPMailer/src/PHPMailer.php');

// Test outbound SMTP connectivity (non-blocking, 5s timeout)
$smtpReachable = 'unknown';
$smtpHost = $env['SMTP_HOST'] ?? 'smtp.sparkpostmail.com';
$smtpPort = (int)($env['SMTP_PORT'] ?? 587);
$start = microtime(true);
$fp = @fsockopen($smtpHost, $smtpPort, $errno, $errstr, 5);
if ($fp) {
    fclose($fp);
    $smtpReachable = 'yes (' . round((microtime(true) - $start) * 1000) . 'ms)';
} else {
    $smtpReachable = "no ($errstr)";
}

echo json_encode([
    'php_version' => PHP_VERSION,
    'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
    'env_loaded' => !empty($env),
    'env_keys' => array_keys($env),
    'notify_to_set' => !empty($env['NOTIFY_TO']),
    'from_address_set' => !empty($env['FROM_ADDRESS']),
    'smtp_pass_set' => !empty($env['SMTP_PASS']),
    'phpmailer_installed' => $hasPhpMailer,
    'phpmailer_path_checked' => __DIR__ . '/../PHPMailer/src/PHPMailer.php',
    'smtp_host' => $smtpHost,
    'smtp_port' => $smtpPort,
    'smtp_reachable' => $smtpReachable,
    'mail_function_exists' => function_exists('mail'),
    'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'unknown',
    'script_dir' => __DIR__,
    'env_path_checked' => __DIR__ . '/../.env',
], JSON_PRETTY_PRINT);
