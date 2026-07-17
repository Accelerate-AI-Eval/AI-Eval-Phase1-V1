import boto3

from langchain_aws import ChatBedrockConverse

from config import settings


class BedrockService:

    def __init__(self):

        self.client = boto3.client(
            "bedrock-runtime",
            region_name=settings.AWS_REGION
        )

        self.llm = ChatBedrockConverse(
            client=self.client,
            model=settings.BEDROCK_MODEL_ID,
            temperature=0,
            max_tokens=4096
        )

    def invoke(self, prompt):

        response = self.llm.invoke(prompt)

        return response.content