# LexSuite Legal Health Check — Email & WhatsApp Setup

## What We've Built

✅ **Email API** — Backend serverless function to send emails via Brevo
✅ **WhatsApp Button** — Direct WhatsApp link on confirmation page
✅ **Lead Notification** — Email sent to you when someone submits
✅ **Confirmation Email** — Auto-reply to the lead with next steps

---

## Step 1: Get Your Brevo API Key (Free Tier)

1. Go to **[Brevo](https://www.brevo.com)** and create a free account
2. Navigate to **Settings → SMTP & API → API Keys**
3. Click **"Create a new API key"**
4. Copy the API key (starts with `xkeysib-...`)
5. Keep it safe — don't commit to Git

---

## Step 2: Local Setup

### Create `.env.local` file in your project root:

```bash
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxx
YOUR_EMAIL=eemandigitalconcept@gmail.com
BREVO_SENDER_EMAIL=eemandigitalconcept@gmail.com
WHATSAPP_NUMBER=2349021649021
```

### Replace the values:

- **BREVO_API_KEY** — Your actual Brevo API key
- **YOUR_EMAIL** — Where you receive lead notifications
- **BREVO_SENDER_EMAIL** — The "from" address for all emails. **This MUST be verified in your Brevo account** (Brevo → Senders → Add/verify email). If not set, falls back to `YOUR_EMAIL`.
- **WHATSAPP_NUMBER** — Your WhatsApp number (include country code, no + or spaces)

### ⚠️ Critical: Sender Verification

If you do not verify `BREVO_SENDER_EMAIL` in your Brevo account, **all emails will be silently rejected by Brevo**. To verify:
1. Go to [Brevo Senders](https://app.brevo.com/senders/)
2. Click "Add a Sender" → enter your email
3. Check your inbox for the verification email and click confirm
4. That sender can now be used in the API

---

## Step 3: Update WhatsApp Number

Edit `index.html` and find the WhatsApp link (search for "wa.me"):

```html
<a href="https://wa.me/2349021649021?text=..."></a>
```

Replace the number with your actual WhatsApp number (country code, no `+`).

---

## Step 4: Vercel Deployment

### 1. Push to Git:

```bash
git add .
git commit -m "Add email and WhatsApp integration"
git push
```

### 2. In Vercel Dashboard:

- Go to your project settings
- Click **Environment Variables**
- Add:
  - Name: `BREVO_API_KEY` → Value: (your key)
  - Name: `YOUR_EMAIL` → Value: (your email)
  - Name: `BREVO_SENDER_EMAIL` → Value: (verified sender email)

### 3. Redeploy:

- Vercel will auto-deploy when it detects the changes
- Or manually trigger a deployment

---

## Step 5: Verify It Works

1. Visit your Vercel deployment
2. Complete a health check questionnaire
3. Submit the form
4. You should receive an email within seconds
5. The user should see the WhatsApp button on confirmation

---

## Email Flow

### When a user submits:

1. **API Route** (`/api/submit-lead`) processes the request
2. **Email to You** — Lead notification with score & contact info
3. **Email to User** — Confirmation with next steps
4. **User sees** — Confirmation page with WhatsApp button

---

## Brevo Free Tier Limits

- ✅ 300 emails per day
- ✅ Unlimited contacts
- ✅ Basic automation
- Perfect for a lead magnet

---

## Troubleshooting

### Email not sending?

1. **Check sender is verified** — Go to Brevo → Senders. Is `BREVO_SENDER_EMAIL` listed as verified? If not, verify it.
2. Check API key is correct in `.env.local` or Vercel settings
3. Verify email addresses are valid
4. Check browser console for error messages
5. Check Vercel Functions logs for Brevo API error details
6. Test with Brevo dashboard directly

### WhatsApp link not working?

- Make sure the number includes country code (no `+`)
- Example: `2347000000000` (Nigeria), `44201234567` (UK)

### Still have issues?

Check the `api/submit-lead.js` serverless function logs:

- In Vercel Dashboard → Functions → `submit-lead`

---

## Files Added/Modified

- `api/submit-lead.js` — Email serverless function
- `index.html` — Updated form submission + WhatsApp button
- `vercel.json` — Vercel configuration
- `.env.local.example` — Template for environment variables

---

## Next Steps

1. Get Brevo API key ✅
2. Create `.env.local` with your credentials
3. Test locally (email will work on Vercel deploy)
4. Deploy to Vercel
5. Set environment variables in Vercel Dashboard
6. Test from live URL

You're all set! 🚀
