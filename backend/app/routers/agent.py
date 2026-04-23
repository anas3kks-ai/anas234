import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Query, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.agent import run_agent_turn
from app.auth import get_current_user
from app.config import get_settings
from app.db import SessionLocal, get_db
from app.models import Conversation, Memory, Message, User
from app.schemas import SendMessageIn

router = APIRouter(prefix="/api/agent", tags=["agent"])
settings = get_settings()


@router.post("/conversations/{conversation_id}/messages")
def post_message(
    conversation_id: int,
    data: SendMessageIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    conv = db.get(Conversation, conversation_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    content = (data.message or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="empty message")

    msg = Message(conversation_id=conv.id, role="user", content=content)
    db.add(msg)

    if conv.title in ("", "New chat"):
        conv.title = content[:80]

    db.commit()
    db.refresh(msg)
    return {"id": msg.id}


@router.get("/conversations/{conversation_id}/stream")
async def stream_agent(
    conversation_id: int,
    token: str = Query(..., description="JWT access token (EventSource can't set headers)"),
) -> EventSourceResponse:
    # EventSource cannot set Authorization headers, so accept token via query param.
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = int(payload.get("sub", 0))
    except (JWTError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="invalid token") from exc

    async def event_stream() -> AsyncIterator[dict]:
        db = SessionLocal()
        try:
            conv = db.get(Conversation, conversation_id)
            if not conv or conv.user_id != user_id:
                yield {"event": "error", "data": json.dumps({"message": "not found"})}
                return

            memories = (
                db.execute(
                    select(Memory)
                    .where(Memory.user_id == user_id)
                    .order_by(Memory.id.desc())
                    .limit(20)
                )
                .scalars()
                .all()
            )

            async for evt in run_agent_turn(db, conv, list(memories), user_id):
                yield {"event": evt.get("type", "message"), "data": json.dumps(evt)}
        finally:
            db.close()

    return EventSourceResponse(event_stream())
