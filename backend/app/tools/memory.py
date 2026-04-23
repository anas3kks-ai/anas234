from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Memory


def remember(db: Session, user_id: int, fact: str) -> dict[str, Any]:
    fact = fact.strip()
    if not fact:
        return {"error": "empty fact"}
    mem = Memory(user_id=user_id, content=fact)
    db.add(mem)
    db.commit()
    db.refresh(mem)
    return {"ok": True, "id": mem.id}


def recall(db: Session, user_id: int, query: str = "") -> dict[str, Any]:
    stmt = select(Memory).where(Memory.user_id == user_id).order_by(Memory.id.desc()).limit(50)
    rows = db.execute(stmt).scalars().all()
    items = [{"id": r.id, "content": r.content} for r in rows]
    if query:
        q = query.lower()
        items = [i for i in items if q in i["content"].lower()] or items
    return {"count": len(items), "items": items}
