"""Texture generation API routes."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import numpy as np

from .engine import TextureGenerator

router = APIRouter()


class TextureRequest(BaseModel):
    simulation_id: str
    states: list[dict]
    vertex_count: int = 1000
    segments: list[dict] = []


class TextureResponse(BaseModel):
    simulation_id: str
    textures: list[dict]


@router.post("/texture", response_model=TextureResponse)
async def generate_textures(req: TextureRequest):
    """Generate textures for all simulation states."""
    try:
        generator = TextureGenerator(req.vertex_count)
        textures = []

        for state in req.states:
            color_map = None
            if state.get("has_color_map") and state.get("vertex_colors"):
                color_map = np.array(state["vertex_colors"])

            result = generator.generate_for_state(
                state_order=state.get("state_order", 0),
                color_map=color_map,
                clinical_metrics=state.get("clinical_metrics", {}),
                segments=req.segments,
            )

            textures.append({
                "state_order": result.state_order,
                "material_type": result.material_type,
                "vertex_color_sample": result.vertex_colors[:10].tolist(),
                "total_vertices": len(result.vertex_colors),
            })

        return TextureResponse(
            simulation_id=req.simulation_id,
            textures=textures,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
