// Simple in-memory rate limiter (per-instance; not perfect across serverless
// replicas but raises the bar against casual abuse).
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5;

function rateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return { allowed: true };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false };
  }
  entry.count++;
  return { allowed: true };
}

function sanitize(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[\d\s\-+()]{6,20}$/.test(phone);
}

export default async function handler(req, res) {
  const allowedOrigins = [
    "https://juristech.com.ng",
    "https://www.juristech.com.ng",
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : null,
    process.env.NODE_ENV === "development" ? "http://localhost:3000" : null,
  ].filter(Boolean);

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    // Same-origin requests and non-browser clients
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigins[0] || "");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Rate limiting
  const ip =
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    "unknown";
  const { allowed } = rateLimit(ip);
  if (!allowed) {
    return res
      .status(429)
      .json({ error: "Too many requests. Please try again later." });
  }

  const { name, email, phone, company, urgency, track, score } = req.body;

  // Validation
  if (!name || !email || !phone || !company) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const trimmed = { name: name.trim(), email: email.trim(), phone: phone.trim(), company: company.trim() };

  if (!isValidEmail(trimmed.email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  if (!isValidPhone(trimmed.phone)) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  if (trimmed.name.length > 100 || trimmed.company.length > 200 || trimmed.email.length > 254) {
    return res.status(400).json({ error: "Field exceeds maximum length" });
  }

  const brevoApiKey = process.env.BREVO_API_KEY;
  const yourEmail =
    process.env.YOUR_EMAIL || "lukman@juristech.com.ng";
  // IMPORTANT: The sender email MUST be verified in your Brevo account.
  // Set BREVO_SENDER_EMAIL if it differs from YOUR_EMAIL.
  const senderEmail =
    process.env.BREVO_SENDER_EMAIL || yourEmail;

  if (!brevoApiKey) {
    return res.status(500).json({ error: "Email service not configured" });
  }

  // Sanitize all user-supplied values before injecting into HTML
  const sName = sanitize(trimmed.name);
  const sEmail = sanitize(trimmed.email);
  const sPhone = sanitize(trimmed.phone);
  const sCompany = sanitize(trimmed.company);
  const sUrgency = sanitize(urgency || "");
  const sTrack =
    sanitize(typeof track === "object" ? track.label : track) || "N/A";
  const sScorePct = score?.percent != null ? String(score.percent) : "N/A";
  const sScoreTier = sanitize(score?.tier) || "N/A";

  const errors = [];

  // --- Notification email to the firm ---
  try {
    await sendBrevoEmail({
      apiKey: brevoApiKey,
      senderEmail,
      to: [{ email: yourEmail, name: "LexSuite Team" }],
      subject: `New Lead: ${sName} - ${sTrack}`,
      htmlContent: `
        <h2>New Legal Health Check Submission</h2>
        <p><strong>Name:</strong> ${sName}</p>
        <p><strong>Email:</strong> ${sEmail}</p>
        <p><strong>Phone:</strong> ${sPhone}</p>
        <p><strong>Company:</strong> ${sCompany}</p>
        <p><strong>Track:</strong> ${sTrack}</p>
        <p><strong>Score:</strong> ${sScorePct}% (${sScoreTier})</p>
        <p><strong>Primary Concern:</strong> ${sUrgency}</p>
        <hr />
        <p>Reply directly to ${sEmail} or call ${sPhone}</p>
      `,
      replyTo: { email: sEmail, name: sName },
    });
  } catch (err) {
    errors.push("notification");
    console.error("Notification email failed:", err);
  }

  // --- Confirmation email to the lead ---
  try {
    await sendBrevoEmail({
      apiKey: brevoApiKey,
      senderEmail,
      to: [{ email: sEmail, name: sName }],
      subject: "Your LexSuite Legal Health Check - Next Steps",
      htmlContent: `
        <h2>Thank you, ${sName}!</h2>
        <p>Your legal health diagnostic has been received and reviewed.</p>
        <p><strong>Your Score:</strong> ${sScorePct}% (${sScoreTier})</p>
        <p>Lukman Asinmi, Esq. will reach out to you within 24 hours at:</p>
        <ul>
          <li>Phone: ${sPhone}</li>
          <li>Email: ${sEmail}</li>
        </ul>
        <p>In the meantime, connect with LexSuite Solicitors:</p>
        <ul>
          <li><strong>Website:</strong> <a href="https://juristech.com.ng">juristech.com.ng</a></li>
          <li><strong>WhatsApp:</strong> <a href="https://wa.me/2349021649021">Message us on WhatsApp</a></li>
        </ul>
      `,
    });
  } catch (err) {
    errors.push("confirmation");
    console.error("Confirmation email failed:", err);
  }

  if (errors.length === 2) {
    return res.status(500).json({
      error: "Failed to send emails. Please try again later.",
    });
  }

  return res.status(200).json({
    success: true,
    message:
      errors.length === 0
        ? "Lead submitted successfully"
        : "Lead submitted, but one of the confirmation emails may not have been delivered.",
  });
}

async function sendBrevoEmail({ apiKey, senderEmail, to, subject, htmlContent, replyTo }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "LexSuite Solicitors",
          email: senderEmail,
        },
        to,
        subject,
        htmlContent,
        replyTo,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let errBody = null;
      try {
        errBody = await response.json();
      } catch (e) {
        try {
          errBody = await response.text();
        } catch (e2) {
          errBody = `Status ${response.status}`;
        }
      }
      throw new Error(
        `Brevo API error: ${typeof errBody === "string" ? errBody : JSON.stringify(errBody)}`,
      );
    }

    try {
      return await response.json();
    } catch {
      return { ok: true };
    }
  } finally {
    clearTimeout(timeout);
  }
}
