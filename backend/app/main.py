import sys
from pathlib import Path

# Add backend directory to sys.path so direct execution works from any working directory
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import router

app = FastAPI(
    title="AI-Based Air Quality Prediction & Pollution Source Clustering",
    description="Intelligent Smart City Environmental Analytics Engine with Explainable ML and Pattern Clustering",
    version="2.0.0"
)

# Enable CORS for frontend development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True, app_dir=str(backend_dir))

