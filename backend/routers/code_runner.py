"""
Code Runner Router - lightweight sandboxed execution for quick practice.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import time

from fastapi import APIRouter, Depends, HTTPException

from models.database import User
from models.schemas import CodeRunRequest, CodeRunResponse
from routers.auth import get_current_user

router = APIRouter()


_MAX_CODE_CHARS = 20_000
_MAX_STDOUT_CHARS = 30_000
_TIMEOUT_SECONDS = 8


def _truncate(value: str) -> str:
    if len(value) <= _MAX_STDOUT_CHARS:
        return value
    return value[:_MAX_STDOUT_CHARS] + "\n...output truncated..."


@router.post("/code/run", response_model=CodeRunResponse)
def run_code(
    request: CodeRunRequest,
    current_user: User = Depends(get_current_user),
):
    language = (request.language or "").strip().lower()
    code = request.code or ""
    stdin = request.stdin or ""

    if language not in {"python", "javascript", "c", "cpp", "java"}:
        raise HTTPException(400, "Unsupported language. Use python/javascript/c/cpp/java.")
    if not code.strip():
        raise HTTPException(400, "Code cannot be empty.")
    if len(code) > _MAX_CODE_CHARS:
        raise HTTPException(400, f"Code is too large. Max {_MAX_CODE_CHARS} characters.")

    if language == "javascript" and shutil.which("node") is None:
        raise HTTPException(503, "JavaScript runtime not available (node not installed).")
    if language == "c" and shutil.which("gcc") is None:
        raise HTTPException(503, "C compiler not available (gcc not installed).")
    if language == "cpp" and shutil.which("g++") is None:
        raise HTTPException(503, "C++ compiler not available (g++ not installed).")
    if language == "java" and (shutil.which("javac") is None or shutil.which("java") is None):
        raise HTTPException(503, "Java runtime/compiler not available (javac/java not installed).")

    started = time.perf_counter()
    with tempfile.TemporaryDirectory(prefix="arcadia-run-") as temp_dir:
        if language == "python":
            file_name = "main.py"
        elif language == "javascript":
            file_name = "main.js"
        elif language == "c":
            file_name = "main.c"
        elif language == "cpp":
            file_name = "main.cpp"
        else:
            file_name = "Main.java"
        file_path = os.path.join(temp_dir, file_name)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)

        try:
            if language == "python":
                completed = subprocess.run(
                    ["python3", file_path],
                    input=stdin,
                    capture_output=True,
                    text=True,
                    cwd=temp_dir,
                    timeout=_TIMEOUT_SECONDS,
                )
            elif language == "javascript":
                completed = subprocess.run(
                    ["node", file_path],
                    input=stdin,
                    capture_output=True,
                    text=True,
                    cwd=temp_dir,
                    timeout=_TIMEOUT_SECONDS,
                )
            elif language == "c":
                compile_result = subprocess.run(
                    ["gcc", file_path, "-O2", "-std=c11", "-o", os.path.join(temp_dir, "main_c")],
                    capture_output=True,
                    text=True,
                    cwd=temp_dir,
                    timeout=_TIMEOUT_SECONDS,
                )
                if compile_result.returncode != 0:
                    duration_ms = int((time.perf_counter() - started) * 1000)
                    return CodeRunResponse(
                        language=language,
                        stdout="",
                        stderr=_truncate(compile_result.stderr or "Compilation failed"),
                        exit_code=int(compile_result.returncode),
                        duration_ms=duration_ms,
                    )
                completed = subprocess.run(
                    [os.path.join(temp_dir, "main_c")],
                    input=stdin,
                    capture_output=True,
                    text=True,
                    cwd=temp_dir,
                    timeout=_TIMEOUT_SECONDS,
                )
            elif language == "cpp":
                compile_result = subprocess.run(
                    ["g++", file_path, "-O2", "-std=c++17", "-o", os.path.join(temp_dir, "main_cpp")],
                    capture_output=True,
                    text=True,
                    cwd=temp_dir,
                    timeout=_TIMEOUT_SECONDS,
                )
                if compile_result.returncode != 0:
                    duration_ms = int((time.perf_counter() - started) * 1000)
                    return CodeRunResponse(
                        language=language,
                        stdout="",
                        stderr=_truncate(compile_result.stderr or "Compilation failed"),
                        exit_code=int(compile_result.returncode),
                        duration_ms=duration_ms,
                    )
                completed = subprocess.run(
                    [os.path.join(temp_dir, "main_cpp")],
                    input=stdin,
                    capture_output=True,
                    text=True,
                    cwd=temp_dir,
                    timeout=_TIMEOUT_SECONDS,
                )
            else:
                compile_result = subprocess.run(
                    ["javac", file_path],
                    capture_output=True,
                    text=True,
                    cwd=temp_dir,
                    timeout=_TIMEOUT_SECONDS,
                )
                if compile_result.returncode != 0:
                    duration_ms = int((time.perf_counter() - started) * 1000)
                    return CodeRunResponse(
                        language=language,
                        stdout="",
                        stderr=_truncate(compile_result.stderr or "Compilation failed"),
                        exit_code=int(compile_result.returncode),
                        duration_ms=duration_ms,
                    )
                completed = subprocess.run(
                    ["java", "-cp", temp_dir, "Main"],
                    input=stdin,
                    capture_output=True,
                    text=True,
                    cwd=temp_dir,
                    timeout=_TIMEOUT_SECONDS,
                )
            duration_ms = int((time.perf_counter() - started) * 1000)
            return CodeRunResponse(
                language=language,
                stdout=_truncate(completed.stdout or ""),
                stderr=_truncate(completed.stderr or ""),
                exit_code=int(completed.returncode),
                duration_ms=duration_ms,
            )
        except subprocess.TimeoutExpired as exc:
            duration_ms = int((time.perf_counter() - started) * 1000)
            raise HTTPException(
                408,
                f"Execution timed out after {_TIMEOUT_SECONDS}s. Partial output:\n{_truncate((exc.stdout or '') + (exc.stderr or ''))}",
            ) from exc
