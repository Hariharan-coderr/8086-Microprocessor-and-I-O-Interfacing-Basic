"""
8086 Port-Mapped I/O Learning Tool - Web Application & API Server
Subject: EC2201 - Microprocessor and I/O Interfacing (Unit V)
Student: HARIHARAN MUTHU M (Section A)
"""

import os
import sys
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from simulator.cpu import CPU8086
from simulator.port_map import PortMap
from simulator.io_engine import IOEngine
from simulator.tests import TestCaseRunner
from simulator.ai_assistant import EducationalAIAssistant

app = FastAPI(
    title="8086 Port-Mapped I/O Learning Tool API",
    description="Educational simulation API for EC2201 Microprocessor and I/O Interfacing Unit V",
    version="1.0.0"
)

# Global simulation instance
engine = IOEngine()
test_runner = TestCaseRunner()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Request schemas
class InstructionRequest(BaseModel):
    instruction: str

class ProgramRequest(BaseModel):
    program: str

class CustomPortRequest(BaseModel):
    port: int
    name: str
    direction: str
    value: int
    desc: Optional[str] = ""

# API Endpoints
@app.get("/api/state")
def get_simulation_state():
    """Returns complete CPU, bus signals, and port device states."""
    return {
        "cpu": engine.cpu.get_state_dict(),
        "ports": engine.port_map.to_list(),
        "trace_count": len(engine.trace),
        "latest_trace": engine.trace[0] if engine.trace else None
    }

@app.get("/api/ports")
def get_ports():
    """Returns active port mapping table."""
    return engine.port_map.to_list()

@app.post("/api/execute")
def execute_instruction(req: InstructionRequest):
    """Executes single 8086 I/O instruction."""
    res = engine.execute_line(req.instruction)
    ai_feedback = EducationalAIAssistant.explain_instruction(req.instruction)
    return {
        "execution": res,
        "cpu": engine.cpu.get_state_dict(),
        "ai_feedback": ai_feedback
    }

@app.post("/api/run-program")
def run_program(req: ProgramRequest):
    """Executes multiple 8086 assembly instructions."""
    results = engine.run_program(req.program)
    return {
        "results": results,
        "cpu": engine.cpu.get_state_dict(),
        "ports": engine.port_map.to_list()
    }

@app.post("/api/reset")
def reset_simulation():
    """Resets CPU registers, peripherals, and execution trace."""
    engine.reset()
    return {"status": "SUCCESS", "message": "Simulation reset to power-on defaults."}

@app.get("/api/run-tests")
def run_test_suite():
    """Executes all 10 normal and 6 edge/fault test cases."""
    results = test_runner.run_all_tests()
    feedback = EducationalAIAssistant.generate_learning_feedback(results["summary"])
    return {
        "suite_results": results,
        "learning_feedback": feedback
    }

@app.get("/api/trace")
def get_trace():
    """Returns full execution audit trace."""
    return engine.trace

# Static File Endpoints
@app.get("/")
def serve_index():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/styles.css")
def serve_css():
    return FileResponse(os.path.join(BASE_DIR, "styles.css"))

@app.get("/app.js")
def serve_js():
    return FileResponse(os.path.join(BASE_DIR, "app.js"))

# Mount screenshots directory
screenshots_dir = os.path.join(BASE_DIR, "screenshots")
if os.path.exists(screenshots_dir):
    app.mount("/screenshots", StaticFiles(directory=screenshots_dir), name="screenshots")

# Mount data directory
data_dir = os.path.join(BASE_DIR, "data")
if os.path.exists(data_dir):
    app.mount("/data", StaticFiles(directory=data_dir), name="data")

def main():
    print("=" * 70)
    print(" 8086 Port-Mapped I/O Learning Tool")
    print(" Student: HARIHARAN MUTHU M | Section A | EC2201 Unit V")
    print(" Server running at: http://localhost:8000")
    print("=" * 70)
    uvicorn.run(app, host="127.0.0.1", port=8000)

if __name__ == "__main__":
    main()
