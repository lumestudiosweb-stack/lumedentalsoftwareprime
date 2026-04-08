"""LumeDental AI Service — 3D Processing & Simulation Engine."""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .segmentation.router import router as segmentation_router
from .simulation.router import router as simulation_router
from .texture.router import router as texture_router
from .llm_bridge.router import router as llm_router

app = FastAPI(
    title="LumeDental AI Service",
    version="1.0.0",
    description="3D Mesh Segmentation, Predictive Simulation & Texture Generation",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "http://localhost:5173")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(segmentation_router, prefix="/api", tags=["Segmentation"])
app.include_router(simulation_router, prefix="/api", tags=["Simulation"])
app.include_router(texture_router, prefix="/api", tags=["Texture"])
app.include_router(llm_router, prefix="/api", tags=["LLM Bridge"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "lumedental-ai"}
