import os
import sys
import time
import socket
import subprocess
import webbrowser
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"

def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1.0)
        return s.connect_ex((host, port)) == 0

def is_http_ready(url: str, timeout: float = 2.0) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "HealthCheck"})
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status in (200, 304)
    except Exception:
        return False

def main():
    print("=" * 65)
    print("Starting AI Air Quality Prediction & Pollution Source Clustering")
    print("=" * 65)

    backend_proc = None
    frontend_proc = None

    # 1. Start or Verify FastAPI Backend
    backend_url = "http://127.0.0.1:8000"
    if is_http_ready(f"{backend_url}/api/cities"):
        print("\n[1/2] FastAPI Backend is already running on http://127.0.0.1:8000 (Active)")
    elif is_port_in_use(8000):
        print("\n[1/2] Port 8000 is occupied. Connecting to existing service on http://127.0.0.1:8000 ...")
    else:
        print("\n[1/2] Starting FastAPI Backend on http://127.0.0.1:8000 ...")
        backend_cmd = [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"]
        backend_proc = subprocess.Popen(backend_cmd, cwd=str(BACKEND_DIR))
        # Wait up to 10 seconds for backend to be ready
        for _ in range(20):
            if is_http_ready(f"{backend_url}/api/cities"):
                break
            time.sleep(0.5)

    # 2. Start or Verify Vite Frontend
    frontend_url = "http://localhost:5173"
    if is_http_ready(f"{frontend_url}/"):
        print("[2/2] Frontend Vite Server is already running on http://localhost:5173 (Active)")
    elif is_port_in_use(5173):
        print("[2/2] Port 5173 is occupied. Connecting to existing service on http://localhost:5173 ...")
    else:
        print("[2/2] Starting Frontend Vite Server on http://localhost:5173 ...")
        npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
        frontend_proc = subprocess.Popen([npm_cmd, "run", "dev"], cwd=str(FRONTEND_DIR))
        # Wait up to 10 seconds for frontend to be ready
        for _ in range(20):
            if is_http_ready(f"{frontend_url}/"):
                break
            time.sleep(0.5)

    print("\n" + "=" * 65)
    print("Both servers are running!")
    print("  -> Web Dashboard:  http://localhost:5173")
    print("  -> API Swagger:    http://127.0.0.1:8000/docs")
    print("Press Ctrl+C to stop servers.")
    print("=" * 65 + "\n")

    try:
        webbrowser.open("http://localhost:5173")
    except Exception:
        pass

    try:
        while True:
            time.sleep(1)
            if backend_proc and backend_proc.poll() is not None:
                if backend_proc.returncode != 0:
                    print(f"\nBackend process exited with code {backend_proc.returncode}")
                break
            if frontend_proc and frontend_proc.poll() is not None:
                if frontend_proc.returncode != 0:
                    print(f"\nFrontend process exited with code {frontend_proc.returncode}")
                break
    except KeyboardInterrupt:
        print("\nStopping servers...")
    finally:
        if backend_proc and backend_proc.poll() is None:
            backend_proc.terminate()
        if frontend_proc and frontend_proc.poll() is None:
            frontend_proc.terminate()
        print("Servers stopped.")

if __name__ == "__main__":
    main()
