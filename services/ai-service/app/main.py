from fastapi import FastAPI

app = FastAPI(title="AI Service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "Healthy", "service": "AiService"}
