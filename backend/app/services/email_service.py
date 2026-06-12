import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import settings

log = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, body_html: str, body_plain: str = "") -> bool:
    """Send an email using Outlook SMTP settings.
    Falls back to console/terminal logging if SMTP settings are missing or if sending fails.
    """
    # 1. Print connection details to console for developer testing
    print("\n" + "=" * 60)
    print(f"SMTP SEND ATTEMPT TO: {to_email}")
    print(f"Subject: {subject}")
    if body_plain:
        print(body_plain)
    print("=" * 60 + "\n")

    # 2. Get SMTP settings
    smtp_user = settings.smtp_user or settings.smtp_username
    smtp_password = settings.smtp_password
    mail_from = settings.mail_from or settings.smtp_from_email or smtp_user
    smtp_host = settings.smtp_host or "smtp.office365.com"
    smtp_port = settings.smtp_port or 587

    if not smtp_user or not smtp_password:
        log.warning(
            "SMTP credentials not fully configured (SMTP_USER or SMTP_PASSWORD empty). "
            "Skipping real email transmission."
        )
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{settings.smtp_from_name} <{mail_from}>"
        msg["To"] = to_email
        msg["Subject"] = subject

        # Attach plain text fallback first, then HTML (email clients prefer the last part)
        if body_plain:
            msg.attach(MIMEText(body_plain, "plain"))
        msg.attach(MIMEText(body_html, "html"))
        
        log.info(f"Connecting to Outlook SMTP server at {smtp_host}:{smtp_port}...")
        server = smtplib.SMTP(smtp_host, int(smtp_port))
        server.ehlo()
        server.starttls()  # Secure connection via TLS
        server.ehlo()
        
        log.info(f"Logging in to SMTP as {smtp_user}...")
        server.login(smtp_user, smtp_password)
        
        log.info(f"Sending SMTP email to {to_email}...")
        server.sendmail(mail_from, to_email, msg.as_string())
        server.quit()
        
        log.info(f"Email successfully sent to {to_email}.")
        return True
    except Exception as e:
        log.error(
            f"Failed to send email via Outlook SMTP: {e}. "
            f"Make sure SMTP settings in .env are correct."
        )
        return False


def _build_otp_html(name: str, otp: str) -> str:
    """Build a premium HTML email template for OTP verification."""
    # Split OTP into individual digits for styled display
    otp_digits_html = "".join(
        f'<span style="display:inline-block;width:48px;height:56px;line-height:56px;'
        f'text-align:center;font-size:28px;font-weight:700;font-family:\'SF Mono\',\'Fira Code\','
        f'\'Cascadia Code\',Consolas,monospace;color:#ffffff;background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);'
        f'border-radius:8px;margin:0 4px;letter-spacing:0;">{digit}</span>'
        for digit in otp
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verify Your Quantum Studio Account</title>
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#09090b;">
<tr>
<td align="center" style="padding:60px 20px;">

<!-- Main Container -->
<table role="presentation" width="480" cellspacing="0" cellpadding="0" border="0"
       style="background-color:#18181b;
              border:1px solid #27272a;
              border-radius:12px;
              overflow:hidden;
              box-shadow:0 8px 30px rgba(0,0,0,0.3);">

  <!-- Logo & Header -->
  <tr>
    <td align="center" style="padding:40px 40px 16px;">
      <!-- CSS-Based Professional Tech Logo -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
        <tr>
          <td style="vertical-align:middle; padding-right:12px;">
            <div style="width:36px;height:36px;line-height:36px;text-align:center;border-radius:8px;
                        background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);
                        color:#ffffff;font-size:18px;font-weight:800;font-family:inherit;">
              S
            </div>
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:18px;font-weight:700;letter-spacing:-0.4px;color:#ffffff;font-family:inherit;text-transform:uppercase;">
              Quantum <span style="color:#6366f1;">Studio</span>
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Greeting -->
  <tr>
    <td style="padding:24px 40px 8px;">
      <p style="margin:0;font-size:15px;color:#e4e4e7;line-height:1.6;font-family:inherit;">
        Hello <strong>{name}</strong>,
      </p>
    </td>
  </tr>

  <!-- Body text -->
  <tr>
    <td style="padding:8px 40px 0;">
      <p style="margin:0;font-size:15px;color:#a1a1aa;line-height:1.6;font-family:inherit;">
        Welcome to Quantum Studio. To complete your account registration, please enter the verification code below:
      </p>
    </td>
  </tr>

  <!-- Verification Code Label -->
  <tr>
    <td align="center" style="padding:32px 40px 8px;">
      <p style="margin:0;font-size:11px;font-weight:600;color:#6366f1;
                text-transform:uppercase;letter-spacing:1.5px;font-family:inherit;">
        Verification Code
      </p>
    </td>
  </tr>

  <!-- OTP Digits -->
  <tr>
    <td align="center" style="padding:8px 40px 8px;">
      <div style="display:inline-block;">
        {otp_digits_html}
      </div>
    </td>
  </tr>

  <!-- Expiry notice -->
  <tr>
    <td align="center" style="padding:16px 40px 0;">
      <p style="margin:0;font-size:13px;color:#71717a;font-family:inherit;">
        ⏱ This code will expire in <strong style="color:#a5b4fc;">5 minutes</strong>.
      </p>
    </td>
  </tr>

  <!-- Divider -->
  <tr>
    <td style="padding:32px 40px 0;">
      <div style="height:1px;background-color:#27272a;"></div>
    </td>
  </tr>

  <!-- Safety notice -->
  <tr>
    <td style="padding:20px 40px 0;">
      <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;font-family:inherit;">
        If you did not create a Quantum Studio account, you can safely ignore this email.
      </p>
    </td>
  </tr>

  <!-- Thank you -->
  <tr>
    <td style="padding:24px 40px 0;">
      <p style="margin:0;font-size:14px;color:#a1a1aa;font-family:inherit;">Thank you,</p>
      <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#ffffff;font-family:inherit;">Quantum Studio Team</p>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:32px 40px 0;">
      <div style="height:1px;background-color:#27272a;"></div>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:24px 40px 40px;">
      <p style="margin:0;font-size:11px;color:#52525b;font-family:inherit;">
        &copy; 2026 Quantum Studio
      </p>
      <p style="margin:4px 0 0;font-size:11px;color:#3f3f46;font-family:inherit;">
        Powered by <strong style="color:#52525b;">Silicofeller Technologies</strong>
      </p>
    </td>
  </tr>

</table>
<!-- /Main Container -->

</td>
</tr>
</table>
</body>
</html>"""


def send_otp_email(email: str, otp: str, name: str = "there") -> bool:
    """Send OTP verification email with a premium HTML template."""
    subject = f"{otp} is your Quantum Studio verification code"

    body_html = _build_otp_html(name, otp)

    body_plain = f"""Hello {name},

Welcome to Quantum Studio.

To complete your account registration, please enter the verification code below:

Verification Code: {otp}

This code will expire in 5 minutes.

If you did not create a Quantum Studio account, you can safely ignore this email.

Thank you,
Quantum Studio Team

© 2026 Quantum Studio
Powered by Silicofeller Technologies"""

    return send_email(email, subject, body_html, body_plain)
