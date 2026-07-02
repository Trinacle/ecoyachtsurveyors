/**
 * Eco Yacht Surveyors — static site + contact-form email handler.
 *
 * - Serves all static files (index.html, services/*, assets/*, …)
 * - POST /api/contact  →  validates the lead, builds an HTML email from
 *   email-template.html, and sends it to NOTIFY_TO via SparkPost SMTP.
 *
 * Run:  npm install  &&  npm start
 * Then open http://localhost:8000
 */
require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json({ limit: "100kb" }));

/* ---- API routes (registered BEFORE static + 404 fallback) ---- */

/* ---- SparkPost SMTP transporter ---- */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.sparkpostmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,                       // STARTTLS on 587
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,       // SMTP_Injection
    pass: process.env.SMTP_PASS,       // SparkPost API key
  },
});

/* ---- Load + render the email template ---- */
let TEMPLATE = null;
function getTemplate() {
  if (TEMPLATE) return TEMPLATE;
  const file = path.join(__dirname, "email-template.html");
  TEMPLATE = fs.readFileSync(file, "utf-8");
  return TEMPLATE;
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function row(label, value) {
  if (!value) return "";
  return (
    `<tr>` +
    `<td style="padding:10px 0;border-bottom:1px solid #f0eee8;vertical-align:top;width:140px;">` +
    `<span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#7c8a9e;">${esc(label)}</span>` +
    `</td>` +
    `<td style="padding:10px 0;border-bottom:1px solid #f0eee8;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#16233a;">${esc(value)}</td>` +
    `</tr>`
  );
}

function buildEmail(b) {
  const rows = [
    row("Name", `${b.first_name || ""} ${b.last_name || ""}`.trim()),
    row("Email", b.email),
    row("Phone", b.phone),
    row("Service", b.service),
    row("Vessel", b.vessel),
    row("Length (LOA)", b.loa ? `${b.loa} ft` : ""),
    row("Location", b.location),
    row("Source", b.source),
  ].join("");

  return getTemplate()
    .replace("{{ROWS}}", rows)
    .replace("{{MESSAGE}}", esc(b.message || "— No message provided —"))
    .replace(/{{REPLY_TO}}/g, esc(b.email || ""))
    .replace(/{{FIRST_NAME}}/g, esc(b.first_name || "the enquirer"));
}

/* ---- POST /api/contact ---- */
app.post("/api/contact", async (req, res) => {
  const b = req.body || {};

  // Basic validation
  const required = ["first_name", "last_name", "email", "phone", "service"];
  const missing = required.filter((k) => !String(b[k] || "").trim());
  if (missing.length) {
    return res.status(400).json({ ok: false, error: "Missing required fields: " + missing.join(", ") });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) {
    return res.status(400).json({ ok: false, error: "Invalid email address." });
  }

  const fullName = `${b.first_name} ${b.last_name}`.trim();
  const notifyTo = process.env.NOTIFY_TO || "admin@ecoyachtsurveyors.com";
  const fromAddr = process.env.FROM_ADDRESS || "no-reply@ecoyachtsurveyors.com";
  const fromName = process.env.FROM_NAME || "Eco Yacht Surveyors Website";

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: notifyTo,
      replyTo: `${fullName} <${b.email}>`,
      subject: `New survey request — ${fullName} (${b.service})`,
      text:
        `New survey request from ecoyachtsurveyors.com\n\n` +
        `Name: ${fullName}\n` +
        `Email: ${b.email}\n` +
        `Phone: ${b.phone}\n` +
        `Service: ${b.service}\n` +
        `Vessel: ${b.vessel || "—"}\n` +
        `Length: ${b.loa ? b.loa + " ft" : "—"}\n` +
        `Location: ${b.location || "—"}\n\n` +
        `Message:\n${b.message || "—"}`,
      html: buildEmail(b),
    });

    console.log(`[${new Date().toISOString()}] Email sent to ${notifyTo}: ${info.messageId || info.response}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("Email send failed:", err);
    res.status(500).json({ ok: false, error: "Unable to send notification email." });
  }
});

/* ---- Health check ---- */
app.get("/api/health", (req, res) => res.json({ ok: true }));

/* ---- Static files (the website) — served AFTER API routes ---- */
app.use(express.static(__dirname, {
  extensions: ["html"],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".webp")) res.setHeader("Content-Type", "image/webp");
  }
}));

// Friendly 404 for unknown non-API routes → our 404 page
app.use((req, res, next) => {
  if (req.method === "GET" && req.accepts("html") && !req.path.startsWith("/api/")) {
    const f = path.join(__dirname, "404.html");
    if (fs.existsSync(f)) return res.status(404).sendFile(f);
  }
  next();
});

app.listen(PORT, () => {
  console.log(`\n  Eco Yacht Surveyors running on http://localhost:${PORT}`);
  console.log(`  Contact form → ${process.env.NOTIFY_TO || "(NOTIFY_TO not set)"} via SparkPost\n`);
});
