"""
Quick setup script — creates virtual environment and installs dependencies.
Run: py setup.py   (Windows)
     python3 setup.py  (macOS/Linux)
"""
import subprocess
import sys
import os


def run(cmd, check=True):
    print(f"\n>>> {cmd}")
    result = subprocess.run(cmd, shell=True)
    if check and result.returncode != 0:
        print(f"ERROR: command failed with code {result.returncode}")
        sys.exit(result.returncode)
    return result.returncode


# Detect Python executable — on Windows `python` may be a Store alias, so
# prefer the Launcher (`py`) or the current interpreter path.
def find_python() -> str:
    if sys.platform == "win32":
        # Try py launcher first
        try:
            r = subprocess.run("py --version", shell=True, capture_output=True, timeout=5)
            if r.returncode == 0:
                return "py"
        except Exception:
            pass
    return sys.executable


python = find_python()
print(f"Using Python: {python}")


# Create venv if not present
if not os.path.exists(".venv"):
    run(f'"{python}" -m venv .venv')
else:
    print(">>> .venv already exists, skipping creation")

# Detect venv paths
if sys.platform == "win32":
    venv_python = r".venv\Scripts\python.exe"
    venv_pip    = r".venv\Scripts\pip.exe"
else:
    venv_python = ".venv/bin/python"
    venv_pip    = ".venv/bin/pip"

# Install requirements (skip pip self-upgrade to avoid Windows lock issue)
run(f'"{venv_pip}" install -r requirements.txt')

print("\n✅ Setup complete!")
print("\nTo start the backend:")
if sys.platform == "win32":
    print(f"  .venv\\Scripts\\python run.py")
else:
    print(f"  .venv/bin/python run.py")
print(f"\nAPI docs: http://localhost:5000/docs")
