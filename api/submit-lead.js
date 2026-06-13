export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, phone, company, urgency, track, score } = req.body;

  // Validation
  if (!name || !email || !phone || !company) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const brevoApiKey = process.env.BREVO_API_KEY;
  const yourEmail = process.env.YOUR_EMAIL || "lukman@juristech.com.ng";

  if (!brevoApiKey) {
    return res.status(500).json({ error: "Email service not configured" });
  }

  try {
    // Send lead notification email to you
    await sendBrevoEmail({
      apiKey: brevoApiKey,
      to: [{ email: yourEmail, name: "LexSuite Team" }],
      subject: `New Lead: ${name} - ${track}`,
      htmlContent: `
        <h2>New Legal Health Check Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Company:</strong> ${company}</p>
        <p><strong>Track:</strong> ${track}</p>
        <p><strong>Score:</strong> ${score.percent}% (${score.tier})</p>
        <p><strong>Primary Concern:</strong> ${urgency}</p>
        <hr />
        <p>Reply directly to ${email} or call ${phone}</p>
      `,
      replyTo: { email, name },
    });

    // Send confirmation email to the user
    await sendBrevoEmail({
      apiKey: brevoApiKey,
      to: [{ email, name }],
      subject: "Your LexSuite Legal Health Check - Next Steps",
      htmlContent: `
        <h2>Thank you, ${name}!</h2>
        <p>Your legal health diagnostic has been received and reviewed.</p>
        <p><strong>Your Score:</strong> ${score.percent}% (${score.tier})</p>
        <p>Lukman Asinmi, Esq. will reach out to you within 24 hours at:</p>
        <ul>
          <li>Phone: ${phone}</li>
          <li>Email: ${email}</li>
        </ul>
        <p>In the meantime, connect with LexSuite Solicitors:</p>
        <ul>
          <li><strong>Website:</strong> <a href="https://juristech.com.ng">juristech.com.ng</a></li>
          <li><strong>WhatsApp:</strong> <a href="https://wa.me/09021649021">Message us on WhatsApp</a></li>
        </ul>
      `,
    });

    res.status(200).json({
      success: true,
      message: "Lead submitted successfully",
    });
  } catch (error) {
    console.error("Email submission error:", error);
    res.status(500).json({
      error: "Failed to submit lead",
      details: error.message,
    });
  }
}

async function sendBrevoEmail({ apiKey, to, subject, htmlContent, replyTo }) {
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
        email: "noreply@juristech.com.ng",
      },
      to,
      subject,
      htmlContent,
      replyTo,
    }),
  });

  if (!response.ok) {
    // Try to parse JSON error, fall back to text
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
  } catch (e) {
    return { ok: true };
  }
}
