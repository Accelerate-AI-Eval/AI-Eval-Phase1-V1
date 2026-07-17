"""
Application Exceptions
"""


class VendorAttestationException(Exception):

    def __init__(
        self,
        message: str
    ):

        self.message = message

        super().__init__(message)


class BedrockException(VendorAttestationException):
    pass


class ExtractionException(VendorAttestationException):
    pass


class ValidationException(VendorAttestationException):
    pass


class RiskCalculationException(VendorAttestationException):
    pass


class S3Exception(VendorAttestationException):
    pass


class UnsupportedDocumentException(
    VendorAttestationException
):
    pass


class DocumentEmptyException(
    VendorAttestationException
):
    pass


def raise_http_exception(
    message: str,
    status_code: int = 500
):
    from fastapi import HTTPException

    raise HTTPException(
        status_code=status_code,
        detail=message
    )