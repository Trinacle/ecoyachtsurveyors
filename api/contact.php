<?php
/**
 * Eco Yacht Surveyors — contact form handler (PHP, for cPanel/Apache hosting).
 *
 * POST a JSON body to /api/contact  (the .htaccess maps it here).
 * Validates the lead, builds an HTML email, and sends it to the office inbox
 * via SparkPost SMTP using the PHPMailer library.
 *
 * Exposed via .htaccess:
 *   RewriteRule ^api/contact$ api/contact.php [L]
 *
 * Requires PHPMailer. Easiest install on cPanel:
 *   - Upload the PHPMailer folder to /PHPMailer/  (get it from github.com/PHPMailer/PHPMailer)
 *   OR ask your host to enable the `smtp` mailer and use PHP's mail() fallback below.
 */

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

/* ---------- Read JSON body ---------- */
$raw = file_get_contents('php://input');
$b = json_decode($raw, true) ?: [];

/* ---------- Validate ---------- */
$required = ['first_name', 'last_name', 'email', 'phone', 'service'];
$missing = [];
foreach ($required as $k) {
    if (!isset($b[$k]) || trim((string)$b[$k]) === '') $missing[] = $k;
}
if ($missing) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing required fields: ' . implode(', ', $missing)]);
    exit;
}
if (!filter_var($b['email'] ?? '', FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid email address.']);
    exit;
}

/* ---------- Config ---------- */
$NOTIFY_TO = 'admin@ecoyachtsurveyors.com';
$FROM_ADDR = 'no-reply@ecoyachtsurveyors.com';   // must be a SparkPost-verified domain
$FROM_NAME = 'Eco Yacht Surveyors Website';
$SMTP_HOST = 'smtp.sparkpostmail.com';
$SMTP_PORT = 587;
$SMTP_USER = 'SMTP_Injection';
$SMTP_PASS = 'REDACTED-ROTATED';

/* ---------- Build the email ---------- */
function e(?string $s): string { return htmlspecialchars((string)($s ?? ''), ENT_QUOTES, 'UTF-8'); }

$fullName = trim(($b['first_name'] ?? '') . ' ' . ($b['last_name'] ?? ''));
$subject = "New survey request — {$fullName} ({$b['service']})";

function row(string $label, ?string $value): string {
    if (!$value) return '';
    return '<tr>'
        . '<td style="padding:10px 0;border-bottom:1px solid #f0eee8;vertical-align:top;width:140px;">'
        . '<span style="font-family:Arial;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#7c8a9e;">' . e($label) . '</span>'
        . '</td>'
        . '<td style="padding:10px 0;border-bottom:1px solid #f0eee8;font-family:Arial;font-size:15px;color:#16233a;">' . e($value) . '</td>'
        . '</tr>';
}

$rows = implode('', [
    row('Name', $fullName),
    row('Email', $b['email'] ?? ''),
    row('Phone', $b['phone'] ?? ''),
    row('Service', $b['service'] ?? ''),
    row('Vessel', $b['vessel'] ?? ''),
    row('Length (LOA)', !empty($b['loa']) ? $b['loa'] . ' ft' : ''),
    row('Location', $b['location'] ?? ''),
    row('Source', $b['source'] ?? ''),
]);

$tpl = file_get_contents(__DIR__ . '/../email-template.html');
$html = strtr($tpl, [
    '{{ROWS}}'        => $rows,
    '{{MESSAGE}}'     => e($b['message'] ?? '— No message provided —'),
    '{{REPLY_TO}}'    => e($b['email'] ?? ''),
    '{{FIRST_NAME}}'  => e($b['first_name'] ?? 'the enquirer'),
]);

$text = "New survey request from ecoyachtsurveyors.com\n\n"
    . "Name: {$fullName}\nEmail: {$b['email']}\nPhone: {$b['phone']}\n"
    . "Service: {$b['service']}\nVessel: " . ($b['vessel'] ?? '—') . "\n"
    . "Length: " . (!empty($b['loa']) ? $b['loa'] . ' ft' : '—') . "\n"
    . "Location: " . ($b['location'] ?? '—') . "\n\nMessage:\n" . ($b['message'] ?? '—');

/* ---------- Send via PHPMailer (preferred) ---------- */
$phpmailerPath = __DIR__ . '/../PHPMailer/src/PHPMailer.php';
if (file_exists($phpmailerPath)) {
    require_once __DIR__ . '/../PHPMailer/src/PHPMailer.php';
    require_once __DIR__ . '/../PHPMailer/src/SMTP.php';
    require_once __DIR__ . '/../PHPMailer/src/Exception.php';

    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = $SMTP_HOST;
        $mail->Port       = $SMTP_PORT;
        $mail->SMTPAuth   = true;
        $mail->Username   = $SMTP_USER;
        $mail->Password   = $SMTP_PASS;
        $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;

        $mail->setFrom($FROM_ADDR, $FROM_NAME);
        $mail->addAddress($NOTIFY_TO);
        $mail->addReplyTo($b['email'], $fullName);

        $mail->Subject = $subject;
        $mail->Body    = $html;
        $mail->AltBody = $text;
        $mail->isHTML(true);

        $mail->send();
        echo json_encode(['ok' => true]);
    } catch (Exception $ex) {
        http_response_code(500);
        error_log('Contact form mail error: ' . $ex->getMessage());
        echo json_encode(['ok' => false, 'error' => 'Unable to send email.']);
    }
    exit;
}

/* ---------- Fallback: PHP mail() ---------- */
$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'From: ' . $FROM_NAME . ' <' . $FROM_ADDR . '>',
    'Reply-To: ' . $fullName . ' <' . $b['email'] . '>',
];
if (@mail($NOTIFY_TO, $subject, $html, implode("\r\n", $headers))) {
    echo json_encode(['ok' => true]);
} else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Unable to send email.']);
}
