from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import logging

from routes.enrich import router as enrich_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("enrichment-service")

app = FastAPI(
    title="Tudumm Enrichment Service",
    description="AI-powered data enrichment: personalized messages, email finding, profile summarization",
    version="1.0.0",
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "enrichment-service"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url}: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"error": str(exc)})


app.include_router(enrich_router, prefix="/enrich", tags=["enrichment"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8009, reload=True)
