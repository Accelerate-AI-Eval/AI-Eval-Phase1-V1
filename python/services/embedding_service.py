"""LangChain Bedrock embeddings for pgvector storage."""

from __future__ import annotations

import boto3
from langchain_aws import BedrockEmbeddings

from config import settings


class EmbeddingService:
    """Thin wrapper around LangChain BedrockEmbeddings (Titan v2)."""

    def __init__(self) -> None:
        client_kwargs: dict = {"region_name": settings.AWS_REGION}
        if settings.AWS_ACCESS_KEY_ID:
            client_kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        if settings.AWS_SECRET_ACCESS_KEY:
            client_kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY

        self.model_id = settings.EMBEDDING_MODEL_ID
        self.dimensions = settings.EMBEDDING_DIMENSIONS
        self._embeddings = BedrockEmbeddings(
            client=boto3.client("bedrock-runtime", **client_kwargs),
            model_id=self.model_id,
            model_kwargs={
                "dimensions": self.dimensions,
                "normalize": True,
            },
        )

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        # Titan has a hard input limit; keep chunks within a safe bound.
        trimmed = [text[:50_000] for text in texts]
        vectors = self._embeddings.embed_documents(trimmed)
        for vector in vectors:
            if len(vector) != self.dimensions:
                raise RuntimeError(
                    f"Expected {self.dimensions}-d embedding, got {len(vector)}"
                )
        return vectors

    def embed_query(self, text: str) -> list[float]:
        vectors = self.embed_documents([text])
        return vectors[0]
