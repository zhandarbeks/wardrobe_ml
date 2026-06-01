import os
import smtplib
import textwrap
from email.message import EmailMessage
from typing import Optional


def _backend() -> str:
    return (os.getenv("EMAIL_BACKEND") or "console").strip().lower()


def _frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def _from_addr() -> tuple[str, str]:
    return (
        os.getenv("EMAIL_FROM_NAME", "WarDrobe AI"),
        os.getenv("EMAIL_FROM",      "no-reply@wardrobe.local"),
    )


def _send_console(to: str, subject: str, text_body: str, html_body: Optional[str] = None):
    """Print everything to stdout. Verification link is highlighted so it's
    easy to copy-paste during local development."""
    line = "─" * 70
    print()
    print(f"📧 [email_service / console]")
    print(line)
    print(f"  To:      {to}")
    print(f"  From:    {_from_addr()[0]} <{_from_addr()[1]}>")
    print(f"  Subject: {subject}")
    print(line)
    print(textwrap.indent(text_body, "  "))
    print(line)
    print()


def _send_smtp(to: str, subject: str, text_body: str, html_body: Optional[str] = None):
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    pwd  = os.getenv("SMTP_PASS")
    if not (user and pwd):
        raise RuntimeError("EMAIL_BACKEND=smtp but SMTP_USER / SMTP_PASS are not set")

    msg = EmailMessage()
    msg["From"]    = f'{_from_addr()[0]} <{_from_addr()[1]}>'
    msg["To"]      = to
    msg["Subject"] = subject
    msg.set_content(text_body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(host, port, timeout=15) as s:
        s.starttls()
        s.login(user, pwd)
        s.send_message(msg)


def _send_sendgrid(to: str, subject: str, text_body: str, html_body: Optional[str] = None):
    api_key = os.getenv("SENDGRID_API_KEY")
    if not api_key:
        raise RuntimeError("EMAIL_BACKEND=sendgrid but SENDGRID_API_KEY is not set")
    import httpx
    payload = {
        "personalizations": [{"to": [{"email": to}]}],
        "from": {"email": _from_addr()[1], "name": _from_addr()[0]},
        "subject": subject,
        "content": [{"type": "text/plain", "value": text_body}],
    }
    if html_body:
        payload["content"].append({"type": "text/html", "value": html_body})
    r = httpx.post(
        "https://api.sendgrid.com/v3/mail/send",
        json=payload,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=10.0,
    )
    if r.status_code >= 300:
        raise RuntimeError(f"sendgrid {r.status_code}: {r.text[:200]}")


def _send(to: str, subject: str, text_body: str, html_body: Optional[str] = None):
    backend = _backend()
    fn = {"console": _send_console, "smtp": _send_smtp, "sendgrid": _send_sendgrid}.get(backend)
    if fn is None:
        print(f"[email_service] unknown EMAIL_BACKEND={backend!r}, falling back to console")
        fn = _send_console
    try:
        fn(to, subject, text_body, html_body)
    except Exception as e:
        print(f"[email_service] {backend} send failed: {e}")
        if backend != "console":
            print("[email_service] mirroring to console as a fallback so the link is recoverable:")
            _send_console(to, subject, text_body, html_body)


def send_password_reset_email(user, token: str) -> str:
    link = f"{_frontend_url()}/reset-password?token={token}"
    subject = "Reset your T*T password"
    text_body = (
        f"Hi {user.name or 'there'},\n\n"
        f"A password reset was requested for your T*T account.\n"
        f"Open this link to choose a new password:\n\n"
        f"  {link}\n\n"
        f"The link expires in 1 hour. If you did not request this, ignore this email.\n"
    )
    html_body = (
        f"<p>Hi {user.name or 'there'},</p>"
        f"<p>A password reset was requested for your <strong>T*T</strong> account. "
        f"Click below to choose a new password:</p>"
        f'<p><a href="{link}" '
        f'style="display:inline-block;padding:10px 20px;background:#6FA000;'
        f'color:#0A0A0A;text-decoration:none;font-weight:600;">'
        f'Reset password</a></p>'
        f'<p>Or copy this link: <a href="{link}">{link}</a></p>'
        f"<p style='color:#6b7280;font-size:13px;'>Expires in 1 hour.</p>"
    )
    _send(user.email, subject, text_body, html_body)
    return link


def send_verification_email(user, token: str) -> str:
    """Compose & send the email-verification message.
    Returns the verification URL so the caller can return it in dev mode.
    """
    link = f"{_frontend_url()}/verify-email?token={token}"
    subject = "Verify your WarDrobe AI account"
    text_body = (
        f"Hi {user.name or 'there'},\n\n"
        f"Welcome to WarDrobe AI! Confirm your email by opening this link:\n\n"
        f"  {link}\n\n"
        f"The link expires in 24 hours. If you didn't create this account, "
        f"you can safely ignore this email.\n\n"
        f"— The WarDrobe AI team"
    )
    html_body = (
        f"<p>Hi {user.name or 'there'},</p>"
        f"<p>Welcome to <strong>WarDrobe AI</strong>! Confirm your email by clicking below:</p>"
        f'<p><a href="{link}" '
        f'style="display:inline-block;padding:10px 20px;background:#2563eb;'
        f'color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">'
        f'Verify email</a></p>'
        f'<p>Or copy this link: <a href="{link}">{link}</a></p>'
        f"<p style='color:#6b7280;font-size:13px;'>The link expires in 24 hours. "
        f"If you didn't create this account, you can ignore this email.</p>"
    )
    _send(user.email, subject, text_body, html_body)
    return link
