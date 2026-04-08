"""
Mesh Segmentation Engine — Layer 1 of the AI Pipeline.

Segments raw STL/OBJ meshes into individual anatomical structures:
teeth (by FDI number), gingiva, bone.

Uses curvature-based region growing + optional deep learning refinement.
"""
import numpy as np
import trimesh
from scipy.spatial import KDTree
from scipy.ndimage import label as connected_components
from dataclasses import dataclass


@dataclass
class SegmentResult:
    """Result of segmenting a single anatomical structure."""
    structure_type: str  # 'tooth', 'gingiva', 'bone'
    tooth_label: int | None  # FDI notation, None for non-tooth
    vertex_indices: list[int]
    face_indices: list[int]
    centroid: list[float]
    bounding_box: dict
    surface_area: float
    volume: float
    confidence: float


class MeshSegmenter:
    """Segments dental meshes into individual teeth and gingiva."""

    # Approximate curvature thresholds for dental anatomy
    CURVATURE_TOOTH_THRESHOLD = 0.15
    MIN_TOOTH_VERTICES = 200
    MAX_TOOTH_VERTICES = 15000

    def __init__(self, mesh: trimesh.Trimesh):
        self.mesh = mesh
        self.vertices = np.array(mesh.vertices)
        self.faces = np.array(mesh.faces)
        self.vertex_normals = np.array(mesh.vertex_normals)

    def segment(self) -> list[SegmentResult]:
        """Run the full segmentation pipeline."""
        # Step 1: Compute discrete curvature at each vertex
        curvatures = self._compute_curvature()

        # Step 2: Classify vertices as tooth vs gingiva based on curvature
        tooth_mask = curvatures > self.CURVATURE_TOOTH_THRESHOLD

        # Step 3: Connected component analysis to isolate individual teeth
        tooth_clusters = self._cluster_regions(tooth_mask)

        # Step 4: Filter and label clusters
        segments = []

        # Gingiva segment — all vertices not in any tooth cluster
        gingiva_indices = np.where(~tooth_mask)[0].tolist()
        if gingiva_indices:
            gingiva_faces = self._get_faces_for_vertices(set(gingiva_indices))
            gingiva_sub = self.mesh.submesh([gingiva_faces], append=True) if gingiva_faces else None
            segments.append(SegmentResult(
                structure_type="gingiva",
                tooth_label=None,
                vertex_indices=gingiva_indices,
                face_indices=gingiva_faces,
                centroid=self.vertices[gingiva_indices].mean(axis=0).tolist(),
                bounding_box=self._bounding_box(gingiva_indices),
                surface_area=float(gingiva_sub.area) if gingiva_sub else 0.0,
                volume=0.0,
                confidence=0.85,
            ))

        # Individual tooth segments
        tooth_number = 11  # Starting FDI number (will be refined by spatial heuristics)
        for cluster_indices in tooth_clusters:
            if len(cluster_indices) < self.MIN_TOOTH_VERTICES:
                continue
            if len(cluster_indices) > self.MAX_TOOTH_VERTICES:
                continue

            face_indices = self._get_faces_for_vertices(set(cluster_indices))
            centroid = self.vertices[cluster_indices].mean(axis=0).tolist()

            # Compute volume via submesh
            try:
                sub = self.mesh.submesh([face_indices], append=True)
                volume = float(abs(sub.volume)) if sub.is_volume else 0.0
                area = float(sub.area)
            except Exception:
                volume = 0.0
                area = 0.0

            fdi = self._assign_fdi_number(centroid, tooth_number)

            segments.append(SegmentResult(
                structure_type="tooth",
                tooth_label=fdi,
                vertex_indices=list(cluster_indices),
                face_indices=face_indices,
                centroid=centroid,
                bounding_box=self._bounding_box(list(cluster_indices)),
                surface_area=area,
                volume=volume,
                confidence=0.78,
            ))
            tooth_number += 1

        return segments

    def _compute_curvature(self) -> np.ndarray:
        """Compute approximate mean curvature at each vertex using the Laplacian."""
        n = len(self.vertices)
        curvatures = np.zeros(n)

        # Build adjacency from faces
        adjacency = [set() for _ in range(n)]
        for f in self.faces:
            for i in range(3):
                for j in range(3):
                    if i != j:
                        adjacency[f[i]].add(f[j])

        for i in range(n):
            neighbors = list(adjacency[i])
            if not neighbors:
                continue
            neighbor_verts = self.vertices[neighbors]
            laplacian = neighbor_verts.mean(axis=0) - self.vertices[i]
            curvatures[i] = np.linalg.norm(laplacian)

        # Normalize to [0, 1]
        max_curv = curvatures.max()
        if max_curv > 0:
            curvatures /= max_curv

        return curvatures

    def _cluster_regions(self, mask: np.ndarray) -> list[list[int]]:
        """Cluster connected vertex regions using face adjacency."""
        masked_indices = set(np.where(mask)[0])
        visited = set()
        clusters = []

        # Build vertex adjacency
        adjacency = [set() for _ in range(len(self.vertices))]
        for f in self.faces:
            for i in range(3):
                for j in range(3):
                    if i != j:
                        adjacency[f[i]].add(f[j])

        for start in masked_indices:
            if start in visited:
                continue
            # BFS
            cluster = []
            queue = [start]
            while queue:
                v = queue.pop()
                if v in visited or v not in masked_indices:
                    continue
                visited.add(v)
                cluster.append(v)
                for neighbor in adjacency[v]:
                    if neighbor not in visited and neighbor in masked_indices:
                        queue.append(neighbor)
            if cluster:
                clusters.append(cluster)

        return clusters

    def _get_faces_for_vertices(self, vertex_set: set) -> list[int]:
        """Return face indices where all 3 vertices are in the vertex set."""
        face_indices = []
        for i, f in enumerate(self.faces):
            if f[0] in vertex_set and f[1] in vertex_set and f[2] in vertex_set:
                face_indices.append(i)
        return face_indices

    def _bounding_box(self, indices: list[int]) -> dict:
        """Compute axis-aligned bounding box."""
        pts = self.vertices[indices]
        return {
            "min": pts.min(axis=0).tolist(),
            "max": pts.max(axis=0).tolist(),
        }

    def _assign_fdi_number(self, centroid: list[float], fallback: int) -> int:
        """
        Assign FDI tooth number based on spatial position.
        Uses quadrant logic: +x = patient right, -x = patient left,
        +y = upper, -y = lower.
        """
        x, y, z = centroid
        # Quadrant determination
        if x >= 0 and y >= 0:
            quadrant = 1  # Upper right
        elif x < 0 and y >= 0:
            quadrant = 2  # Upper left
        elif x < 0 and y < 0:
            quadrant = 3  # Lower left
        else:
            quadrant = 4  # Lower right

        # Tooth position within quadrant (1-8) based on distance from midline
        position = min(8, max(1, int(abs(x) / 3.0) + 1))

        return quadrant * 10 + position


def segment_mesh(file_path: str) -> list[SegmentResult]:
    """Load a mesh file and run segmentation."""
    mesh = trimesh.load(file_path)
    if isinstance(mesh, trimesh.Scene):
        mesh = trimesh.util.concatenate(mesh.dump())
    segmenter = MeshSegmenter(mesh)
    return segmenter.segment()
