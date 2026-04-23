"""E2B sandbox wrapper — one sandbox per conversation, lazily created."""

from typing import Any

from app.config import get_settings

settings = get_settings()

_sandboxes: dict[int, Any] = {}


def _get_sandbox(conversation_id: int) -> Any:
    if conversation_id in _sandboxes:
        return _sandboxes[conversation_id]

    from e2b_code_interpreter import Sandbox

    sbx = Sandbox.create(api_key=settings.e2b_api_key)
    _sandboxes[conversation_id] = sbx
    return sbx


def run_code(conversation_id: int, language: str, code: str) -> dict[str, Any]:
    """Run code in the conversation's persistent sandbox.

    language: "python" | "javascript" | "bash"
    """
    if not settings.e2b_api_key:
        return {"error": "E2B_API_KEY is not configured"}

    try:
        sbx = _get_sandbox(conversation_id)
    except Exception as exc:  # noqa: BLE001
        return {"error": f"failed to create sandbox: {exc}"}

    try:
        if language in ("bash", "shell", "sh"):
            res = sbx.commands.run(code, timeout=120)
            return {
                "stdout": getattr(res, "stdout", "") or "",
                "stderr": getattr(res, "stderr", "") or "",
                "exit_code": getattr(res, "exit_code", 0),
            }

        lang = "python" if language in ("python", "py") else "javascript"
        execution = sbx.run_code(code, language=lang)
        logs = getattr(execution, "logs", None)
        stdout_lines = getattr(logs, "stdout", []) if logs else []
        stderr_lines = getattr(logs, "stderr", []) if logs else []
        results = []
        for r in getattr(execution, "results", []) or []:
            text = getattr(r, "text", None)
            if text:
                results.append(text)
        error = getattr(execution, "error", None)
        return {
            "stdout": "".join(stdout_lines),
            "stderr": "".join(stderr_lines),
            "results": results,
            "error": str(error) if error else None,
        }
    except Exception as exc:  # noqa: BLE001
        return {"error": f"execution failed: {exc}"}


def write_file(conversation_id: int, path: str, content: str) -> dict[str, Any]:
    try:
        sbx = _get_sandbox(conversation_id)
        sbx.files.write(path, content)
        return {"ok": True, "path": path, "bytes": len(content.encode("utf-8"))}
    except Exception as exc:  # noqa: BLE001
        return {"error": str(exc)}


def read_file(conversation_id: int, path: str) -> dict[str, Any]:
    try:
        sbx = _get_sandbox(conversation_id)
        data = sbx.files.read(path)
        if isinstance(data, bytes):
            try:
                data = data.decode("utf-8")
            except UnicodeDecodeError:
                return {"error": "file is binary", "path": path}
        return {"path": path, "content": data[:20000], "truncated": len(data) > 20000}
    except Exception as exc:  # noqa: BLE001
        return {"error": str(exc)}


def list_files(conversation_id: int, path: str = "/home/user") -> dict[str, Any]:
    try:
        sbx = _get_sandbox(conversation_id)
        entries = sbx.files.list(path)
        return {
            "path": path,
            "entries": [
                {"name": getattr(e, "name", str(e)), "type": getattr(e, "type", "unknown")}
                for e in entries
            ],
        }
    except Exception as exc:  # noqa: BLE001
        return {"error": str(exc)}


def close_sandbox(conversation_id: int) -> None:
    sbx = _sandboxes.pop(conversation_id, None)
    if sbx is None:
        return
    try:
        sbx.kill()
    except Exception:  # noqa: BLE001, S110
        pass
