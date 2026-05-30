#!/usr/bin/env python3
"""FastAPI microservice wrapping penaltyblog_bridge logic."""

import json
import os
import sys
import traceback
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI
from pydantic import BaseModel

# ── Ensure penaltyblog is importable ──────────────────────────────────────────
frontbet_root = Path(__file__).resolve().parents[1]
workspace_root = frontbet_root.parent
penaltyblog_root = workspace_root / "penaltyblog"

os.environ.setdefault("MPLBACKEND", "Agg")
sys.path.insert(0, str(penaltyblog_root))

# Import the bridge logic (functions + OPERATIONS map)
import penaltyblog_bridge as pb_bridge

# Ensure library paths are configured before any penaltyblog usage
pb_bridge.load_penaltyblog_paths()

app = FastAPI(title="penaltyblog-service")


class PredictRequest(BaseModel):
    operation: str
    payload: Dict[str, Any] = {}


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/predict")
def predict(req: PredictRequest) -> Dict[str, Any]:
    operation = req.operation
    payload = req.payload

    if operation not in pb_bridge.OPERATIONS:
        return {
            "ok": False,
            "error": f"Unknown penaltyblog operation: {operation}",
        }

    try:
        result = pb_bridge.OPERATIONS[operation](payload)
        response = {
            "ok": True,
            "result": {
                "operation": operation,
                "result": pb_bridge.serialize_value(result),
            },
        }
    except Exception as exc:
        response = {
            "ok": False,
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }

    return response


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8001)
