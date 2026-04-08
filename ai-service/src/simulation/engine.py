"""
Simulation Engine — Layer 2 of the AI Pipeline.

Converts parsed clinical intent into geometric mesh transformations.
Each module (caries, perio, surgery, esthetics, ortho) has its own
deformation logic.
"""
import numpy as np
import trimesh
from scipy.spatial import KDTree
from dataclasses import dataclass
from typing import Optional


@dataclass
class SimulationState:
    """A single state in the simulation timeline."""
    state_order: int
    label: str
    vertex_displacements: np.ndarray  # (N, 3) displacement vectors
    color_map: Optional[np.ndarray]  # (N, 4) RGBA per vertex
    clinical_metrics: dict


class SimulationEngine:
    """Applies clinical simulation logic to segmented meshes."""

    def __init__(self, mesh: trimesh.Trimesh, segments: list[dict]):
        self.mesh = mesh
        self.vertices = np.array(mesh.vertices, dtype=np.float64)
        self.faces = np.array(mesh.faces)
        self.segments = segments
        self.kdtree = KDTree(self.vertices)

    def simulate(self, intent: dict) -> list[SimulationState]:
        """Route to the correct module based on parsed intent."""
        module = intent.get("module", "general")

        if module == "caries_endo":
            return self._simulate_caries_endo(intent)
        elif module == "surgery_3rd_molar":
            return self._simulate_3rd_molar(intent)
        elif module == "perio":
            return self._simulate_perio(intent)
        elif module == "esthetics_whitening":
            return self._simulate_whitening(intent)
        elif module == "esthetics_veneers":
            return self._simulate_veneers(intent)
        elif module == "ortho_aligners":
            return self._simulate_aligners(intent)
        else:
            return self._simulate_generic(intent)

    # ─── CARIES / ENDO ───────────────────────────────────────────────

    def _simulate_caries_endo(self, intent: dict) -> list[SimulationState]:
        """
        Simulate caries progression: enamel → dentin → pulp.
        Then simulate treatment outcome (filling/crown).
        """
        target_teeth = intent.get("target_teeth", [])
        tooth_vertices = self._get_tooth_vertices(target_teeth)

        states = []

        # State 0: Current
        states.append(SimulationState(
            state_order=0,
            label="Current State",
            vertex_displacements=np.zeros_like(self.vertices),
            color_map=None,
            clinical_metrics={"stage": "initial"},
        ))

        # State 1: Enamel caries — small surface depression
        enamel_disp = np.zeros_like(self.vertices)
        enamel_colors = np.ones((len(self.vertices), 4))  # White default
        for vi in tooth_vertices:
            # Push occlusal vertices inward (simulate cavity)
            normal = self.mesh.vertex_normals[vi]
            depth = 0.3  # mm
            enamel_disp[vi] = -normal * depth
            enamel_colors[vi] = [0.45, 0.30, 0.15, 1.0]  # Brown

        states.append(SimulationState(
            state_order=1,
            label="Enamel Caries (3-6 months untreated)",
            vertex_displacements=enamel_disp,
            color_map=enamel_colors,
            clinical_metrics={"stage": "enamel", "depth_mm": 0.3, "reversible": True},
        ))

        # State 2: Dentin caries — deeper depression
        dentin_disp = np.zeros_like(self.vertices)
        dentin_colors = np.ones((len(self.vertices), 4))
        for vi in tooth_vertices:
            normal = self.mesh.vertex_normals[vi]
            depth = 1.2
            dentin_disp[vi] = -normal * depth
            dentin_colors[vi] = [0.3, 0.15, 0.05, 1.0]  # Dark brown

        states.append(SimulationState(
            state_order=2,
            label="Dentin Caries (6-12 months untreated)",
            vertex_displacements=dentin_disp,
            color_map=dentin_colors,
            clinical_metrics={"stage": "dentin", "depth_mm": 1.2, "reversible": False},
        ))

        # State 3: Pulpitis — inflammation indicator
        pulp_disp = np.zeros_like(self.vertices)
        pulp_colors = np.ones((len(self.vertices), 4))
        for vi in tooth_vertices:
            normal = self.mesh.vertex_normals[vi]
            depth = 2.5
            pulp_disp[vi] = -normal * depth
            pulp_colors[vi] = [0.8, 0.1, 0.1, 1.0]  # Red inflamed

        states.append(SimulationState(
            state_order=3,
            label="Pulp Involvement / Pulpitis (12+ months)",
            vertex_displacements=pulp_disp,
            color_map=pulp_colors,
            clinical_metrics={"stage": "pulp", "depth_mm": 2.5, "needs_rct": True},
        ))

        # State 4: Treatment outcome — restored
        if intent.get("treatment") in ("crown", "rct_crown"):
            restore_disp = np.zeros_like(self.vertices)
            restore_colors = np.ones((len(self.vertices), 4))
            for vi in tooth_vertices:
                restore_colors[vi] = [0.95, 0.95, 0.90, 1.0]  # Crown color

            states.append(SimulationState(
                state_order=4,
                label="Post-Treatment (RCT + Crown)",
                vertex_displacements=restore_disp,
                color_map=restore_colors,
                clinical_metrics={"stage": "restored", "treatment": "rct_crown"},
            ))

        return states

    # ─── 3RD MOLAR / SURGERY ────────────────────────────────────────

    def _simulate_3rd_molar(self, intent: dict) -> list[SimulationState]:
        """Simulate impaction risks: resorption of adjacent root, pericoronitis."""
        target_teeth = intent.get("target_teeth", [])
        tooth_vertices = self._get_tooth_vertices(target_teeth)
        impaction_angle = intent.get("impaction_angle", 45)

        states = []

        states.append(SimulationState(
            state_order=0,
            label="Current Impaction State",
            vertex_displacements=np.zeros_like(self.vertices),
            color_map=None,
            clinical_metrics={"impaction_angle_deg": impaction_angle},
        ))

        # Simulate collision vector
        if impaction_angle > 45:
            collision_disp = np.zeros_like(self.vertices)
            collision_colors = np.ones((len(self.vertices), 4))

            # Push impacted tooth toward 2nd molar
            direction = np.array([np.cos(np.radians(impaction_angle)), 0, np.sin(np.radians(impaction_angle))])
            for vi in tooth_vertices:
                collision_disp[vi] = direction * 0.5
                collision_colors[vi] = [1.0, 0.5, 0.0, 1.0]  # Orange warning

            states.append(SimulationState(
                state_order=1,
                label=f"Projected Collision ({impaction_angle}° mesioangular)",
                vertex_displacements=collision_disp,
                color_map=collision_colors,
                clinical_metrics={
                    "risk_level": "high" if impaction_angle > 60 else "moderate",
                    "adjacent_root_resorption_risk": True,
                    "pericoronitis_risk": True,
                },
            ))

        # Post-extraction state
        extract_disp = np.zeros_like(self.vertices)
        for vi in tooth_vertices:
            extract_disp[vi] = self.mesh.vertex_normals[vi] * -5.0  # "Remove"

        states.append(SimulationState(
            state_order=2,
            label="Post-Extraction Outcome",
            vertex_displacements=extract_disp,
            color_map=None,
            clinical_metrics={"stage": "extracted", "healing_weeks": 4},
        ))

        return states

    # ─── PERIO ───────────────────────────────────────────────────────

    def _simulate_perio(self, intent: dict) -> list[SimulationState]:
        """Simulate periodontal bone loss and gingival recession."""
        pocket_depth = intent.get("pocket_depth_mm", 4.0)
        target_teeth = intent.get("target_teeth", [])

        # Get gingiva segment
        gingiva_vertices = []
        for seg in self.segments:
            if seg.get("structure_type") == "gingiva":
                gingiva_vertices = seg.get("vertex_indices", [])
                break

        states = []

        states.append(SimulationState(
            state_order=0,
            label="Current Periodontal State",
            vertex_displacements=np.zeros_like(self.vertices),
            color_map=None,
            clinical_metrics={"pocket_depth_mm": pocket_depth},
        ))

        # Gingival recession — sink the gumline
        recession_disp = np.zeros_like(self.vertices)
        recession_colors = np.ones((len(self.vertices), 4))
        recession_mm = max(0, pocket_depth - 3.0)

        for vi in gingiva_vertices:
            # Move gingival vertices apically (downward for upper, upward for lower)
            recession_disp[vi] = np.array([0, 0, -recession_mm])
            recession_colors[vi] = [0.85, 0.3, 0.3, 1.0]  # Inflamed red

        states.append(SimulationState(
            state_order=1,
            label=f"Projected Recession ({recession_mm:.1f}mm bone loss)",
            vertex_displacements=recession_disp,
            color_map=recession_colors,
            clinical_metrics={
                "bone_loss_mm": recession_mm,
                "recession_mm": recession_mm * 0.7,
                "root_exposure": recession_mm > 2.0,
            },
        ))

        # Post-treatment (scaling & root planing)
        treated_colors = np.ones((len(self.vertices), 4))
        for vi in gingiva_vertices:
            treated_colors[vi] = [0.9, 0.7, 0.7, 1.0]  # Healthy pink

        states.append(SimulationState(
            state_order=2,
            label="Post-SRP Treatment (3 month healing)",
            vertex_displacements=recession_disp * 0.3,  # Partial recovery
            color_map=treated_colors,
            clinical_metrics={"stage": "post_treatment", "pocket_reduction_mm": pocket_depth * 0.4},
        ))

        return states

    # ─── ESTHETICS ───────────────────────────────────────────────────

    def _simulate_whitening(self, intent: dict) -> list[SimulationState]:
        """Simulate whitening shade change."""
        target_shade = intent.get("target_shade", "B1")
        tooth_vertices = self._get_tooth_vertices(intent.get("target_teeth", []))

        states = []

        states.append(SimulationState(
            state_order=0,
            label="Current Shade",
            vertex_displacements=np.zeros_like(self.vertices),
            color_map=None,
            clinical_metrics={"shade": intent.get("current_shade", "A3")},
        ))

        white_colors = np.ones((len(self.vertices), 4))
        for vi in tooth_vertices:
            white_colors[vi] = [0.97, 0.97, 0.95, 1.0]  # Bright white

        states.append(SimulationState(
            state_order=1,
            label=f"Post-Whitening (Target: {target_shade})",
            vertex_displacements=np.zeros_like(self.vertices),
            color_map=white_colors,
            clinical_metrics={"shade": target_shade},
        ))

        return states

    def _simulate_veneers(self, intent: dict) -> list[SimulationState]:
        """Simulate veneer placement — thin layer overlay on labial surface."""
        target_teeth = intent.get("target_teeth", [])
        tooth_vertices = self._get_tooth_vertices(target_teeth)

        states = []

        states.append(SimulationState(
            state_order=0,
            label="Current State",
            vertex_displacements=np.zeros_like(self.vertices),
            color_map=None,
            clinical_metrics={},
        ))

        # Veneer: slight outward displacement on labial surface
        veneer_disp = np.zeros_like(self.vertices)
        veneer_colors = np.ones((len(self.vertices), 4))
        for vi in tooth_vertices:
            normal = self.mesh.vertex_normals[vi]
            # Only displace labial-facing vertices (positive z in typical orientation)
            if normal[2] > 0.3:
                veneer_disp[vi] = normal * 0.5  # 0.5mm veneer thickness
            veneer_colors[vi] = [0.96, 0.96, 0.93, 1.0]

        states.append(SimulationState(
            state_order=1,
            label="With Veneers",
            vertex_displacements=veneer_disp,
            color_map=veneer_colors,
            clinical_metrics={"veneer_thickness_mm": 0.5, "teeth_count": len(target_teeth)},
        ))

        return states

    # ─── ALIGNERS ────────────────────────────────────────────────────

    def _simulate_aligners(self, intent: dict) -> list[SimulationState]:
        """Simulate orthodontic tooth movement across tray stages."""
        movements = intent.get("planned_movements", [])
        total_trays = intent.get("total_trays", 20)

        states = []

        states.append(SimulationState(
            state_order=0,
            label="Pre-Treatment (Tray 0)",
            vertex_displacements=np.zeros_like(self.vertices),
            color_map=None,
            clinical_metrics={"tray": 0, "total_trays": total_trays},
        ))

        # Generate intermediate states at 25%, 50%, 75%, 100%
        for i, pct in enumerate([0.25, 0.50, 0.75, 1.0]):
            tray_num = int(total_trays * pct)
            disp = np.zeros_like(self.vertices)

            for movement in movements:
                tooth = movement.get("tooth")
                vector = np.array(movement.get("displacement_mm", [0, 0, 0]))
                tooth_verts = self._get_tooth_vertices([tooth])
                for vi in tooth_verts:
                    disp[vi] = vector * pct

            states.append(SimulationState(
                state_order=i + 1,
                label=f"Tray {tray_num} ({int(pct*100)}% complete)",
                vertex_displacements=disp,
                color_map=None,
                clinical_metrics={"tray": tray_num, "progress_pct": pct * 100},
            ))

        return states

    # ─── GENERIC ─────────────────────────────────────────────────────

    def _simulate_generic(self, intent: dict) -> list[SimulationState]:
        """Fallback for unrecognized simulation types."""
        return [SimulationState(
            state_order=0,
            label="Current State",
            vertex_displacements=np.zeros_like(self.vertices),
            color_map=None,
            clinical_metrics={"note": "Generic simulation — no module-specific logic applied"},
        )]

    # ─── HELPERS ─────────────────────────────────────────────────────

    def _get_tooth_vertices(self, tooth_labels: list[int]) -> list[int]:
        """Get vertex indices for specified teeth."""
        vertices = []
        for seg in self.segments:
            if seg.get("structure_type") == "tooth" and seg.get("tooth_label") in tooth_labels:
                vertices.extend(seg.get("vertex_indices", []))
        return vertices
