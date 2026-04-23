"""Tool registry: JSON schemas (OpenAI format) + dispatcher."""

import asyncio
from typing import Any

from sqlalchemy.orm import Session

from app.tools import browser, email_tool, memory, sandbox


TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "browse_web",
            "description": (
                "Fetch the fully rendered text content of a web page (JS-rendered). "
                "Use this to read news, docs, product pages, etc."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "Full URL including https://"},
                    "full_page": {
                        "type": "boolean",
                        "description": "Return the entire page text (default truncates at ~12k chars)",
                        "default": False,
                    },
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "screenshot",
            "description": "Capture a full-page PNG screenshot of a URL and show it to the user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string"},
                    "full_page": {"type": "boolean", "default": True},
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_code",
            "description": (
                "Run code in a secure Linux sandbox (Python/JavaScript/Bash). "
                "Use this for calculations, data processing, running scripts, installing packages, etc. "
                "The sandbox is persistent within the conversation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "language": {
                        "type": "string",
                        "enum": ["python", "javascript", "bash"],
                    },
                    "code": {"type": "string"},
                },
                "required": ["language", "code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write a text file to the sandbox filesystem.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Absolute path, e.g. /home/user/out.txt"},
                    "content": {"type": "string"},
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a text file from the sandbox filesystem.",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string"}},
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List entries under a directory in the sandbox filesystem.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "default": "/home/user"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Send a plain-text email via SMTP.",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {"type": "string"},
                    "subject": {"type": "string"},
                    "body": {"type": "string"},
                },
                "required": ["to", "subject", "body"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "remember",
            "description": (
                "Save a persistent fact or preference about the user "
                "that will be recalled in future conversations."
            ),
            "parameters": {
                "type": "object",
                "properties": {"fact": {"type": "string"}},
                "required": ["fact"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "recall",
            "description": "Retrieve saved long-term memories about the user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Optional keyword filter"}
                },
            },
        },
    },
]


async def execute_tool(
    name: str,
    args: dict[str, Any],
    *,
    db: Session,
    user_id: int,
    conversation_id: int,
) -> dict[str, Any]:
    try:
        if name == "browse_web":
            return await browser.browse_web(args.get("url", ""), args.get("full_page", False))
        if name == "screenshot":
            return await browser.screenshot(args.get("url", ""), args.get("full_page", True))
        if name == "run_code":
            return await asyncio.to_thread(
                sandbox.run_code,
                conversation_id,
                args.get("language", "python"),
                args.get("code", ""),
            )
        if name == "write_file":
            return await asyncio.to_thread(
                sandbox.write_file,
                conversation_id,
                args.get("path", ""),
                args.get("content", ""),
            )
        if name == "read_file":
            return await asyncio.to_thread(sandbox.read_file, conversation_id, args.get("path", ""))
        if name == "list_files":
            return await asyncio.to_thread(
                sandbox.list_files, conversation_id, args.get("path", "/home/user")
            )
        if name == "send_email":
            return await asyncio.to_thread(
                email_tool.send_email,
                args.get("to", ""),
                args.get("subject", ""),
                args.get("body", ""),
            )
        if name == "remember":
            return memory.remember(db, user_id, args.get("fact", ""))
        if name == "recall":
            return memory.recall(db, user_id, args.get("query", ""))
    except Exception as exc:  # noqa: BLE001
        return {"error": f"tool {name} crashed: {exc}"}

    return {"error": f"unknown tool: {name}"}
