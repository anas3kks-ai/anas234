import base64
from typing import Any

import httpx

from app.config import get_settings

settings = get_settings()


async def browse_web(url: str, full_page: bool = False) -> dict[str, Any]:
    """Fetch fully rendered HTML + extracted text + title from a URL."""
    if not settings.browserless_token:
        return {"error": "BROWSERLESS_TOKEN is not configured"}

    endpoint = f"{settings.browserless_base_url}/content?token={settings.browserless_token}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            endpoint,
            json={"url": url, "gotoOptions": {"waitUntil": "networkidle2"}},
        )
        if resp.status_code != 200:
            return {"error": f"browserless returned {resp.status_code}: {resp.text[:300]}"}
        html = resp.text

    text = _html_to_text(html)
    title = _extract_title(html)
    return {
        "url": url,
        "title": title,
        "text": text[:12000] if not full_page else text,
        "text_truncated": not full_page and len(text) > 12000,
    }


async def screenshot(url: str, full_page: bool = True) -> dict[str, Any]:
    """Capture a PNG screenshot of a URL and return it as a data URL."""
    if not settings.browserless_token:
        return {"error": "BROWSERLESS_TOKEN is not configured"}

    endpoint = f"{settings.browserless_base_url}/screenshot?token={settings.browserless_token}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            endpoint,
            json={"url": url, "options": {"type": "png", "fullPage": full_page}},
        )
        if resp.status_code != 200:
            return {"error": f"browserless returned {resp.status_code}"}
        b64 = base64.b64encode(resp.content).decode("ascii")
        return {
            "url": url,
            "image_data_url": f"data:image/png;base64,{b64}",
            "bytes": len(resp.content),
        }


def _extract_title(html: str) -> str:
    lower = html.lower()
    start = lower.find("<title")
    if start == -1:
        return ""
    gt = lower.find(">", start)
    end = lower.find("</title>", gt)
    if gt == -1 or end == -1:
        return ""
    return html[gt + 1 : end].strip()


def _html_to_text(html: str) -> str:
    """Naive HTML → text. Good enough for agent grounding without extra deps."""
    import re

    # Remove script & style blocks
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    # Replace block tags with newlines
    html = re.sub(
        r"</?(p|div|br|li|h[1-6]|tr|section|article|header|footer)[^>]*>",
        "\n",
        html,
        flags=re.IGNORECASE,
    )
    # Strip remaining tags
    html = re.sub(r"<[^>]+>", " ", html)
    # Decode a few HTML entities
    html = (
        html.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
    )
    # Collapse whitespace
    html = re.sub(r"[ \t]+", " ", html)
    html = re.sub(r"\n{3,}", "\n\n", html)
    return html.strip()
