"""LLM Bridge API routes."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .engine import PromptParser

router = APIRouter()
parser = PromptParser()


class ParsePromptRequest(BaseModel):
    simulation_id: str
    prompt: str
    module: str | None = None


class ParsePromptResponse(BaseModel):
    simulation_id: str
    intent: dict
    parser_used: str


@router.post("/parse-prompt", response_model=ParsePromptResponse)
async def parse_clinician_prompt(req: ParsePromptRequest):
    """Parse a clinician's natural language prompt into simulation parameters."""
    try:
        intent = parser.parse(req.prompt, req.module)

        return ParsePromptResponse(
            simulation_id=req.simulation_id,
            intent=intent,
            parser_used="llm" if parser.client else "rules",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prompt parsing failed: {str(e)}")
