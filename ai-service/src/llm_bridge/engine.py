"""
LLM-to-Geometry Bridge — Clinician Prompt Parser.

Parses natural language clinical prompts into structured geometric
transformation parameters using Claude API.

Example:
  Input:  "Simulate RCT + Crown on #36"
  Output: {
    "module": "caries_endo",
    "target_teeth": [36],
    "treatment": "rct_crown",
    "stages": ["current", "caries_progression", "treatment_outcome"]
  }
"""
import os
import json
from anthropic import Anthropic


SYSTEM_PROMPT = """You are a dental clinical AI parser. Convert clinician prompts into structured simulation parameters.

Output ONLY valid JSON with these fields:
- module: One of [caries_endo, surgery_3rd_molar, perio, esthetics_whitening, esthetics_veneers, ortho_aligners, implant, general]
- target_teeth: Array of FDI tooth numbers (11-48)
- treatment: The treatment being simulated (e.g., "rct_crown", "extraction", "composite_filling", "veneer", "whitening", "aligner_therapy", "scaling_root_planing")
- simulation_type: One of [disease_progression, treatment_outcome, comparison]
- stages: Array of stage labels to generate
- Additional module-specific parameters:
  - For perio: pocket_depth_mm, bone_loss_mm
  - For 3rd molar: impaction_angle (degrees), impaction_type
  - For aligners: total_trays, planned_movements [{tooth, displacement_mm: [x,y,z]}]
  - For esthetics: current_shade, target_shade

FDI Notation Reference:
- Upper Right: 11-18 (central incisor to 3rd molar)
- Upper Left: 21-28
- Lower Left: 31-38
- Lower Right: 41-48

Common shorthand: #36 = tooth 36 (lower left first molar)"""


class PromptParser:
    """Parses clinician prompts into simulation parameters using Claude."""

    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if api_key:
            self.client = Anthropic(api_key=api_key)
        else:
            self.client = None

    def parse(self, prompt: str, module_hint: str | None = None) -> dict:
        """Parse a clinician prompt into structured simulation intent."""
        if self.client:
            return self._parse_with_llm(prompt, module_hint)
        return self._parse_with_rules(prompt, module_hint)

    def _parse_with_llm(self, prompt: str, module_hint: str | None) -> dict:
        """Use Claude API to parse the prompt."""
        user_msg = f"Parse this dental clinician prompt into simulation parameters:\n\n\"{prompt}\""
        if module_hint:
            user_msg += f"\n\nModule hint: {module_hint}"

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )

        text = response.content[0].text.strip()
        # Extract JSON from response
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]

        return json.loads(text)

    def _parse_with_rules(self, prompt: str, module_hint: str | None) -> dict:
        """Rule-based fallback parser when no API key is configured."""
        lower = prompt.lower()
        result = {
            "module": module_hint or "general",
            "target_teeth": [],
            "treatment": "",
            "simulation_type": "comparison",
            "stages": ["current"],
        }

        # Extract tooth numbers (#NN or tooth NN)
        import re
        tooth_matches = re.findall(r'#(\d{2})', prompt) + re.findall(r'tooth\s+(\d{2})', lower)
        result["target_teeth"] = [int(t) for t in tooth_matches if 11 <= int(t) <= 48]

        # Detect module and treatment
        if any(w in lower for w in ["rct", "root canal", "endo"]):
            result["module"] = "caries_endo"
            result["treatment"] = "rct_crown" if "crown" in lower else "root_canal"
            result["stages"] = ["current", "enamel_caries", "dentin_caries", "pulpitis", "post_treatment"]
        elif any(w in lower for w in ["caries", "cavity", "decay", "filling"]):
            result["module"] = "caries_endo"
            result["treatment"] = "composite_filling"
            result["stages"] = ["current", "caries_progression", "post_treatment"]
        elif any(w in lower for w in ["crown"]):
            result["module"] = "caries_endo"
            result["treatment"] = "rct_crown"
            result["stages"] = ["current", "post_treatment"]
        elif any(w in lower for w in ["impaction", "3rd molar", "third molar", "wisdom"]):
            result["module"] = "surgery_3rd_molar"
            result["treatment"] = "extraction"
            result["stages"] = ["current", "collision_risk", "post_extraction"]
            angle_match = re.search(r'(\d+)\s*(?:deg|°)', lower)
            if angle_match:
                result["impaction_angle"] = int(angle_match.group(1))
        elif any(w in lower for w in ["perio", "pocket", "bone loss", "recession", "scaling"]):
            result["module"] = "perio"
            result["treatment"] = "scaling_root_planing"
            result["stages"] = ["current", "progression", "post_treatment"]
            depth_match = re.search(r'(\d+(?:\.\d+)?)\s*mm', lower)
            if depth_match:
                result["pocket_depth_mm"] = float(depth_match.group(1))
        elif any(w in lower for w in ["whiten", "bleach"]):
            result["module"] = "esthetics_whitening"
            result["treatment"] = "whitening"
            result["stages"] = ["current", "post_whitening"]
        elif any(w in lower for w in ["veneer"]):
            result["module"] = "esthetics_veneers"
            result["treatment"] = "veneer"
            result["stages"] = ["current", "with_veneers"]
        elif any(w in lower for w in ["aligner", "ortho", "invisalign", "straighten"]):
            result["module"] = "ortho_aligners"
            result["treatment"] = "aligner_therapy"
            result["stages"] = ["tray_0", "tray_25pct", "tray_50pct", "tray_75pct", "tray_100pct"]

        if not result["target_teeth"]:
            result["target_teeth"] = [36]  # Default to lower left first molar

        result["simulation_type"] = "comparison"

        return result
