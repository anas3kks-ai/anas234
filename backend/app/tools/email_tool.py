import smtplib
import ssl
from email.message import EmailMessage
from typing import Any

from app.config import get_settings

settings = get_settings()


def send_email(to: str, subject: str, body: str) -> dict[str, Any]:
    if not (settings.smtp_host and settings.smtp_user and settings.smtp_password):
        return {
            "error": (
                "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD "
                "(and optionally SMTP_FROM / SMTP_PORT) in the backend .env."
            )
        }

    msg = EmailMessage()
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        context = ssl.create_default_context()
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context) as s:
                s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as s:
                s.ehlo()
                s.starttls(context=context)
                s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)
    except Exception as exc:  # noqa: BLE001
        return {"error": f"failed to send: {exc}"}

    return {"ok": True, "to": to, "subject": subject}
