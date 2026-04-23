"""Agent loop: multi-turn tool calling with streaming events."""

import json
from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy.orm import Session

from app.llm import InceptionClient
from app.models import Conversation, Memory, Message
from app.tools import TOOL_SCHEMAS, execute_tool

SYSTEM_PROMPT = """You are Omni, a capable AI agent that can browse the web, run code in a secure sandbox, read/write files, send emails, and remember things about the user long-term.

Principles:
- When a task requires external information, real-time data, or a URL, USE THE browse_web TOOL. Don't fabricate.
- When the user wants something shown or verified visually (a page, a design, a dashboard), use the screenshot tool.
- For math, data processing, scraping, automation, or any non-trivial computation, use run_code.
- Be concise in your own prose. Let the tool outputs speak.
- When the task is complete, give the user a short, clear summary.
- If a tool errors, adapt and try an alternative approach; explain briefly if something can't be done.
- Reply in the user's language. Most users here speak Arabic — respond in fluent Arabic unless they write in English.
"""

MAX_TOOL_ITERATIONS = 8


def _messages_for_llm(conv: Conversation, user_memories: list[Memory]) -> list[dict[str, Any]]:
    system = SYSTEM_PROMPT
    if user_memories:
        remembered = "\n".join(f"- {m.content}" for m in user_memories[-20:])
        system += f"\n\nLong-term memory about this user:\n{remembered}"

    msgs: list[dict[str, Any]] = [{"role": "system", "content": system}]
    for m in conv.messages:
        if m.role == "assistant" and m.tool_calls_json:
            msgs.append(
                {
                    "role": "assistant",
                    "content": m.content or "",
                    "tool_calls": json.loads(m.tool_calls_json),
                }
            )
        elif m.role == "tool":
            msgs.append(
                {
                    "role": "tool",
                    "tool_call_id": m.tool_call_id or "",
                    "name": m.name or "",
                    "content": m.content,
                }
            )
        else:
            msgs.append({"role": m.role, "content": m.content})
    return msgs


async def run_agent_turn(
    db: Session,
    conv: Conversation,
    user_memories: list[Memory],
    user_id: int,
) -> AsyncIterator[dict[str, Any]]:
    """Run one agent turn. Yields SSE-ready event dicts.

    Events emitted:
      {"type": "status", "message": str}
      {"type": "assistant_message", "content": str, "id": int}
      {"type": "tool_call", "name": str, "arguments": dict, "id": str}
      {"type": "tool_result", "tool_call_id": str, "name": str, "result": any}
      {"type": "done"}
      {"type": "error", "message": str}
    """
    client = InceptionClient()

    for iteration in range(MAX_TOOL_ITERATIONS):
        yield {"type": "status", "message": f"thinking (step {iteration + 1})…"}

        messages = _messages_for_llm(conv, user_memories)
        try:
            resp = await client.chat(messages=messages, tools=TOOL_SCHEMAS, max_tokens=4096)
        except Exception as exc:  # noqa: BLE001
            yield {"type": "error", "message": f"LLM request failed: {exc}"}
            return

        choice = (resp.get("choices") or [{}])[0]
        msg = choice.get("message") or {}
        content = (msg.get("content") or "").strip()
        tool_calls = msg.get("tool_calls") or []

        # Persist assistant message
        persisted = Message(
            conversation_id=conv.id,
            role="assistant",
            content=content,
            tool_calls_json=json.dumps(tool_calls) if tool_calls else None,
        )
        db.add(persisted)
        db.commit()
        db.refresh(persisted)
        conv.messages.append(persisted)

        if content:
            yield {"type": "assistant_message", "id": persisted.id, "content": content}

        if not tool_calls:
            yield {"type": "done"}
            return

        for tc in tool_calls:
            fn = tc.get("function") or {}
            name = fn.get("name", "")
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            tc_id = tc.get("id") or ""

            yield {"type": "tool_call", "id": tc_id, "name": name, "arguments": args}

            result = await execute_tool(
                name, args, db=db, user_id=user_id, conversation_id=conv.id
            )

            # Large image payloads: stream to client but store a compact version in DB.
            stored_result = result
            if isinstance(result, dict) and "image_data_url" in result:
                stored_result = {k: v for k, v in result.items() if k != "image_data_url"}
                stored_result["image_omitted_in_log"] = True

            tool_msg = Message(
                conversation_id=conv.id,
                role="tool",
                content=json.dumps(stored_result)[:50_000],
                tool_call_id=tc_id,
                name=name,
            )
            db.add(tool_msg)
            db.commit()
            db.refresh(tool_msg)
            conv.messages.append(tool_msg)

            yield {
                "type": "tool_result",
                "tool_call_id": tc_id,
                "name": name,
                "result": result,
            }

    yield {"type": "status", "message": "reached max tool iterations"}
    yield {"type": "done"}
