from __future__ import annotations

import asyncio
import smtplib
from email.message import EmailMessage

from lifetracker.core.config import Settings


async def send_password_reset_code(settings: Settings, recipient: str, code: str) -> None:
    if not settings.smtp_host or not settings.smtp_from_email:
        raise RuntimeError("SMTP is not configured")

    message = EmailMessage()
    message["Subject"] = "Your LifeTracker password reset code"
    message["From"] = settings.smtp_from_email
    message["To"] = recipient
    message.set_content(
        "Use this verification code to reset your LifeTracker password:\n\n"
        f"{code}\n\n"
        f"The code expires in {settings.password_reset_minutes} minutes. "
        "If you did not request this change, you can ignore this email."
    )

    def deliver() -> None:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password or "")
            smtp.send_message(message)

    await asyncio.to_thread(deliver)
