from fastapi import FastAPI

from app.suggestions import router as suggestions_router

app = FastAPI(title="AI Service")

app.include_router(suggestions_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "Healthy", "service": "AiService"}
