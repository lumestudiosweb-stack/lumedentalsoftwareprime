"""Simulation API routes."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import trimesh
import numpy as np

from .engine import SimulationEngine

router = APIRouter()


class SimulateRequest(BaseModel):
    simulation_id: str
    scan_id: str
    intent: dict
    module: str
    parameters: dict | None = None


class SimulateResponse(BaseModel):
    simulation_id: str
    states: list[dict]
    total_states: int


@router.post("/simulate", response_model=SimulateResponse)
async def run_simulation(req: SimulateRequest):
    """Execute geometric simulation based on parsed clinical intent."""
    try:
        # In production, load mesh from S3 via scan_id lookup
        # For now, expect file_path in intent or use a test mesh
        file_path = req.intent.get("mesh_file_path")
        segments = req.intent.get("segments", [])

        if file_path:
            mesh = trimesh.load(file_path)
            if isinstance(mesh, trimesh.Scene):
                mesh = trimesh.util.concatenate(mesh.dump())
        else:
            # Create a placeholder mesh for API testing
            mesh = trimesh.creation.icosphere(subdivisions=3, radius=5.0)

        engine = SimulationEngine(mesh, segments)

        # Merge module into intent
        intent = {**req.intent, "module": req.module}
        if req.parameters:
            intent.update(req.parameters)

        sim_states = engine.simulate(intent)

        # Serialize states
        states = []
        for state in sim_states:
            states.append({
                "state_order": state.state_order,
                "label": state.label,
                "vertex_displacements": state.vertex_displacements.tolist()[:50],  # Truncate for response
                "displacement_count": len(state.vertex_displacements),
                "has_color_map": state.color_map is not None,
                "clinical_metrics": state.clinical_metrics,
            })

        return SimulateResponse(
            simulation_id=req.simulation_id,
            states=states,
            total_states=len(states),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/aligner-fit")
async def analyze_aligner_fit(image_path: str = "", tray_number: int = 0):
    """
    Analyze aligner fit from a patient photo.
    Uses CV to measure gap between aligner edge and incisal edge.
    """
    try:
        # In production: load image, run edge detection, measure gap
        # Placeholder: return simulated measurement
        gap_mm = float(np.random.uniform(0.1, 1.5))
        fit_status = "good" if gap_mm < 0.5 else "acceptable" if gap_mm < 1.0 else "poor"

        return {
            "image_path": image_path,
            "tray_number": tray_number,
            "gap_mm": round(gap_mm, 2),
            "fit_status": fit_status,
            "recommendation": (
                f"Gap: {gap_mm:.2f}mm — "
                + ("Advance to next tray." if gap_mm < 0.5
                   else "Continue current tray 2 more days." if gap_mm < 1.0
                   else "Extend wear 3+ days. Consider clinician review.")
            ),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
