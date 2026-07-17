from fastapi import FastAPI

from api.health import router as health_router
from api.scoring import router as scoring_router
from api.assessment_llm import router as assessment_llm_router
from api.cots_scoring import router as cots_scoring_router

from config import settings

app = FastAPI(
    title=settings.APP_NAME
)

app.include_router(health_router)
app.include_router(scoring_router)
app.include_router(assessment_llm_router)
app.include_router(cots_scoring_router)

try:
    from api.assessment import router as assessment_router
    app.include_router(assessment_router)
except Exception as exc:
    # Extraction stack is optional; scoring still runs without langchain/boto/docs deps.
    print(f"[warn] assessment router not loaded: {exc}")


@app.get("/")
def root():
    return {
        "application": settings.APP_NAME,
        "status": "Running"
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)