"""Segmentation API routes."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import os

from .engine import segment_mesh

router = APIRouter()

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3001")


class SegmentRequest(BaseModel):
    scan_id: str
    file_path: str


class SegmentResponse(BaseModel):
    scan_id: str
    segment_count: int
    teeth_found: int
    segments: list[dict]


@router.post("/segment", response_model=SegmentResponse)
async def segment_scan(req: SegmentRequest):
    """Segment a 3D scan into individual anatomical structures."""
    try:
        results = segment_mesh(req.file_path)

        # Convert to serializable dicts
        segments = []
        for seg in results:
            segments.append({
                "structure_type": seg.structure_type,
                "tooth_label": seg.tooth_label,
                "vertex_indices": seg.vertex_indices[:100],  # Truncate for API response
                "vertex_count": len(seg.vertex_indices),
                "face_count": len(seg.face_indices),
                "centroid": seg.centroid,
                "bounding_box": seg.bounding_box,
                "surface_area": seg.surface_area,
                "volume": seg.volume,
                "confidence": seg.confidence,
            })

        teeth_count = sum(1 for s in results if s.structure_type == "tooth")

        # Callback to backend to store mesh segments
        async with httpx.AsyncClient() as client:
            for seg in results:
                try:
                    await client.post(f"{BACKEND_URL}/api/scans/{req.scan_id}/meshes", json={
                        "scan_id": req.scan_id,
                        "tooth_label": seg.tooth_label,
                        "structure_type": seg.structure_type,
                        "vertex_indices": seg.vertex_indices,
                        "face_indices": seg.face_indices,
                        "centroid": seg.centroid,
                        "bounding_box": seg.bounding_box,
                        "surface_area_mm2": seg.surface_area,
                        "volume_mm3": seg.volume,
                        "segmentation_confidence": seg.confidence,
                    })
                except httpx.HTTPError:
                    pass  # Non-critical: backend may store later

            # Update scan status to ready
            try:
                await client.patch(
                    f"{BACKEND_URL}/api/scans/{req.scan_id}/status",
                    json={"status": "ready"},
                )
            except httpx.HTTPError:
                pass

        return SegmentResponse(
            scan_id=req.scan_id,
            segment_count=len(results),
            teeth_found=teeth_count,
            segments=segments,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Scan file not found: {req.file_path}")
    except Exception as e:
        # Update scan status to failed
        async with httpx.AsyncClient() as client:
            try:
                await client.patch(
                    f"{BACKEND_URL}/api/scans/{req.scan_id}/status",
                    json={"status": "failed", "error": str(e)},
                )
            except httpx.HTTPError:
                pass
        raise HTTPException(status_code=500, detail=str(e))
