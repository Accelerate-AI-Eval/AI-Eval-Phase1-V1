from pydantic_settings import BaseSettings, SettingsConfigDict


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

# Back-compat aliases used by chunker / extraction helpers
AWS_ACCESS_KEY_ID = settings.AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY = settings.AWS_SECRET_ACCESS_KEY
MAX_CHUNK_SIZE = settings.MAX_CHUNK_SIZE
OVERLAP_SIZE = settings.OVERLAP_SIZE
TEMPERATURE = settings.TEMPERATURE
MAX_TOKENS = settings.MAX_TOKENS
DOWNLOAD_DIRECTORY = settings.DOWNLOAD_DIRECTORY
