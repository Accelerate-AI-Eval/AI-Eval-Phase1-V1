from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
import os
import re


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Vendor Attestation AI"
    AWS_REGION: str = "us-east-1"
    BEDROCK_MODEL_ID: str = "anthropic.claude-3-sonnet-20240229-v1:0"
    EMBEDDING_MODEL_ID: str = "amazon.titan-embed-text-v2:0"
    EMBEDDING_DIMENSIONS: int = 1024
    # How many pgvector formula/scoring chunks to inject into VTS LLM prompt
    VTS_VECTOR_TOP_K: int = 6
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/vendor_ai"
    S3_BUCKET: str = "vendor-documents"
    LOG_LEVEL: str = "INFO"

    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    MAX_CHUNK_SIZE: int = 3500
    OVERLAP_SIZE: int = 250
    TEMPERATURE: float = 0
    MAX_TOKENS: int = 4096
    DOWNLOAD_DIRECTORY: str = "downloads"


settings = Settings()

_ENV_PATH = Path(__file__).resolve().parent / ".env"


def get_bedrock_model_id() -> str:
    """Active Bedrock chat model (Controls Apply updates this at runtime)."""
    model_id = (settings.BEDROCK_MODEL_ID or "").strip() or "anthropic.claude-3-sonnet-20240229-v1:0"
    print(f"[LLM] taking model from BEDROCK_MODEL_ID: {model_id}")
    return model_id


def set_bedrock_model_id(model_id: str) -> str:
    """
    Update the in-memory Bedrock model and persist to python/.env so restarts keep it.
    Called by PUT /config/llm-model from Node Controls Apply.
    """
    trimmed = (model_id or "").strip()
    if not trimmed:
        raise ValueError("modelId is required")
    previous = (settings.BEDROCK_MODEL_ID or "").strip()
    settings.BEDROCK_MODEL_ID = trimmed
    os.environ["BEDROCK_MODEL_ID"] = trimmed
    _upsert_env_file(_ENV_PATH, {"BEDROCK_MODEL_ID": trimmed})
    print(f"[LLM] model changed (Python sync): {previous!r} -> {trimmed!r}")
    return trimmed


def _upsert_env_file(path: Path, updates: dict[str, str]) -> None:
    if not updates:
        return
    lines: list[str] = []
    if path.exists():
        lines = path.read_text(encoding="utf-8").splitlines()

    touched: set[str] = set()
    next_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            next_lines.append(line)
            continue
        match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=", line)
        if not match:
            next_lines.append(line)
            continue
        key = match.group(1)
        if key in updates:
            next_lines.append(f"{key}={updates[key]}")
            touched.add(key)
        else:
            next_lines.append(line)

    for key, value in updates.items():
        if key not in touched:
            next_lines.append(f"{key}={value}")

    body = "\n".join(next_lines)
    if body and not body.endswith("\n"):
        body += "\n"
    path.write_text(body, encoding="utf-8")


# Back-compat aliases used by chunker / extraction helpers
AWS_ACCESS_KEY_ID = settings.AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY = settings.AWS_SECRET_ACCESS_KEY
MAX_CHUNK_SIZE = settings.MAX_CHUNK_SIZE
OVERLAP_SIZE = settings.OVERLAP_SIZE
TEMPERATURE = settings.TEMPERATURE
MAX_TOKENS = settings.MAX_TOKENS
DOWNLOAD_DIRECTORY = settings.DOWNLOAD_DIRECTORY
