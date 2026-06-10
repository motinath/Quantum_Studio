import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import settings

log = logging.getLogger(__name__)

def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send an email using Outlook SMTP settings.
    Falls back to console/terminal logging if SMTP settings are missing or if sending fails.
    """
    # 1. Print connection details to console for developer testing
    print("\n" + "=" * 60)
    print(f"SMTP SEND ATTEMPT TO: {to_email}")
    print(f"Subject: {subject}")
    print(body)
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
        msg = MIMEMultipart()
        msg["From"] = f"{settings.smtp_from_name} <{mail_from}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))
        
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

def send_otp_email(email: str, otp: str, name: str = "User") -> bool:
    """Send OTP email using Outlook SMTP settings."""
    subject = "Verify Your Quantum Studio Account"
    body = f"""Hello {name},

Welcome to Quantum Studio.

To complete your account registration, please use the verification code below:

Verification Code: {otp}

This code will expire in 5 minutes.

If you did not create a Quantum Studio account, you can safely ignore this email.

Thank you,

Quantum Studio Team"""
    return send_email(email, subject, body)
