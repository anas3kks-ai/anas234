from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db
from app.routers import agent as agent_router
from app.routers import auth as auth_router
from app.routers import conversations as conv_router

settings = get_settings()


def create_app() -> FastAPI:
    app = FastAPI(title="Omni Agent API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def _startup() -> None:
        init_db()

    @app.get("/healthz")
    def healthz() -> dict:
        return {"ok": True}

    app.include_router(auth_router.router)
    app.include_router(conv_router.router)
    app.include_router(agent_router.router)

    return app


app = create_app()
