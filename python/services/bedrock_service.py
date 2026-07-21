import boto3

from langchain_aws import ChatBedrockConverse

from config import get_bedrock_model_id, settings


class BedrockService:

    def __init__(self):

        self.client = boto3.client(
            "bedrock-runtime",
            region_name=settings.AWS_REGION
        )

        self._model_id: str | None = None
        self.llm = None
        self._ensure_llm()

    def _ensure_llm(self):
        """Recreate ChatBedrockConverse when Controls updates BEDROCK_MODEL_ID."""
        model_id = get_bedrock_model_id()
        if self.llm is not None and self._model_id == model_id:
            return
        self._model_id = model_id
        self.llm = ChatBedrockConverse(
            client=self.client,
            model=model_id,
            temperature=0,
            max_tokens=4096
        )

    def invoke(self, prompt):
        self._ensure_llm()
        response = self.llm.invoke(prompt)
        return response.content
