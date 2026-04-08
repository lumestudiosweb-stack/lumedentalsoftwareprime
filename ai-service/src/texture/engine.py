"""
Texture Mapping Engine — Layer 3 of the AI Pipeline.

Generates per-vertex or UV-mapped textures for simulated mesh states.
Maps clinical conditions to realistic visual appearance:
  - Healthy enamel: smooth ivory/white
  - Caries: brown/black with rough surface
  - Inflammation: red/swollen gingiva
  - Restorations: material-specific (composite, ceramic, metal)
"""
import numpy as np
from dataclasses import dataclass


@dataclass
class TextureResult:
    """Generated texture data for a simulation state."""
    state_order: int
    vertex_colors: np.ndarray  # (N, 4) RGBA
    material_type: str


# Clinical condition → color palettes (RGBA)
CONDITION_PALETTES = {
    "healthy_enamel": {
        "base": np.array([0.95, 0.93, 0.88, 1.0]),
        "variation": 0.03,
    },
    "healthy_gingiva": {
        "base": np.array([0.85, 0.55, 0.55, 1.0]),
        "variation": 0.05,
    },
    "caries_enamel": {
        "base": np.array([0.55, 0.40, 0.20, 1.0]),
        "variation": 0.08,
    },
    "caries_dentin": {
        "base": np.array([0.35, 0.20, 0.08, 1.0]),
        "variation": 0.06,
    },
    "caries_pulp": {
        "base": np.array([0.20, 0.08, 0.05, 1.0]),
        "variation": 0.04,
    },
    "inflammation": {
        "base": np.array([0.90, 0.25, 0.20, 1.0]),
        "variation": 0.07,
    },
    "necrotic": {
        "base": np.array([0.30, 0.30, 0.30, 1.0]),
        "variation": 0.05,
    },
    "composite_restoration": {
        "base": np.array([0.92, 0.90, 0.85, 1.0]),
        "variation": 0.02,
    },
    "ceramic_crown": {
        "base": np.array([0.96, 0.95, 0.92, 1.0]),
        "variation": 0.02,
    },
    "metal_crown": {
        "base": np.array([0.75, 0.75, 0.75, 1.0]),
        "variation": 0.03,
    },
    "whitened": {
        "base": np.array([0.98, 0.98, 0.96, 1.0]),
        "variation": 0.01,
    },
    "veneer": {
        "base": np.array([0.97, 0.96, 0.93, 1.0]),
        "variation": 0.02,
    },
    "bone_exposed": {
        "base": np.array([0.90, 0.85, 0.75, 1.0]),
        "variation": 0.04,
    },
}


class TextureGenerator:
    """Generates realistic per-vertex colors for dental simulation states."""

    def __init__(self, vertex_count: int):
        self.vertex_count = vertex_count

    def generate_for_state(
        self,
        state_order: int,
        color_map: np.ndarray | None,
        clinical_metrics: dict,
        segments: list[dict],
    ) -> TextureResult:
        """Generate or refine texture for a simulation state."""

        if color_map is not None and len(color_map) == self.vertex_count:
            # Enhance existing color map with natural variation
            enhanced = self._add_natural_variation(color_map, 0.02)
            material = self._infer_material(clinical_metrics)
            return TextureResult(
                state_order=state_order,
                vertex_colors=enhanced,
                material_type=material,
            )

        # Generate from scratch based on segments and metrics
        colors = np.ones((self.vertex_count, 4))  # Default white

        for seg in segments:
            indices = seg.get("vertex_indices", [])
            structure = seg.get("structure_type", "tooth")

            if structure == "tooth":
                condition = self._determine_tooth_condition(clinical_metrics)
                palette = CONDITION_PALETTES.get(condition, CONDITION_PALETTES["healthy_enamel"])
            elif structure == "gingiva":
                condition = self._determine_gingiva_condition(clinical_metrics)
                palette = CONDITION_PALETTES.get(condition, CONDITION_PALETTES["healthy_gingiva"])
            else:
                palette = CONDITION_PALETTES["bone_exposed"]

            for vi in indices:
                if vi < self.vertex_count:
                    noise = np.random.uniform(-palette["variation"], palette["variation"], 3)
                    colors[vi, :3] = np.clip(palette["base"][:3] + noise, 0, 1)

        return TextureResult(
            state_order=state_order,
            vertex_colors=colors,
            material_type=self._infer_material(clinical_metrics),
        )

    def _add_natural_variation(self, colors: np.ndarray, magnitude: float) -> np.ndarray:
        """Add subtle random variation to make textures look natural."""
        noise = np.random.uniform(-magnitude, magnitude, (len(colors), 3))
        result = colors.copy()
        result[:, :3] = np.clip(colors[:, :3] + noise, 0, 1)
        return result

    def _determine_tooth_condition(self, metrics: dict) -> str:
        """Map clinical metrics to a tooth condition palette."""
        stage = metrics.get("stage", "")
        treatment = metrics.get("treatment", "")

        if treatment == "rct_crown":
            return "ceramic_crown"
        if treatment == "composite":
            return "composite_restoration"
        if treatment == "whitening" or metrics.get("shade") in ("B1", "A1"):
            return "whitened"
        if treatment == "veneer":
            return "veneer"

        if stage == "pulp":
            return "caries_pulp"
        if stage == "dentin":
            return "caries_dentin"
        if stage == "enamel":
            return "caries_enamel"

        return "healthy_enamel"

    def _determine_gingiva_condition(self, metrics: dict) -> str:
        """Map clinical metrics to a gingival condition palette."""
        pocket = metrics.get("pocket_depth_mm", 0)
        if pocket > 5:
            return "inflammation"
        if metrics.get("root_exposure"):
            return "inflammation"
        return "healthy_gingiva"

    def _infer_material(self, metrics: dict) -> str:
        """Infer the PBR material type for 3D rendering."""
        treatment = metrics.get("treatment", "")
        if "crown" in treatment:
            return "ceramic"
        if "composite" in treatment:
            return "composite"
        if "metal" in treatment:
            return "metal"
        return "organic"
