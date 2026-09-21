import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.database import engine
from app.logging_config import configure_logging
from app.middleware import RequestLoggingMiddleware
from app.routers.botchain import router as botchain_router
from app.routers.guard import router as guard_router


configure_logging()

logger = logging.getLogger("agentguard.application")


app = FastAPI(
    title=settings.app_name,
    description="Backend safety checkpoint for AI Agent blockchain payments",
    version=settings.app_version,
)


app.add_middleware(RequestLoggingMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


app.include_router(guard_router)
app.include_router(botchain_router)


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "agentguard-api",
    }


@app.get("/api/ready")
def readiness_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "ready",
            "service": "agentguard-api",
            "database": "ok",
        }

    except SQLAlchemyError:
        return {
            "status": "not_ready",
            "service": "agentguard-api",
            "database": "error",
        }


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Request validation failed",
        },
    )


@app.exception_handler(Exception)
async def unexpected_exception_handler(
    request: Request,
    exc: Exception,
):
    logger.exception(
        "Unhandled exception | method=%s | path=%s",
        request.method,
        request.url.path,
    )

    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
        },
    )