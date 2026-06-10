import sys
import os
import json

# Add parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app

def run_diagnostics():
    print("Initializing TestClient and executing SMTP connection diagnostics...")
    client = TestClient(app)
    
    with client:
        response = client.get("/api/auth/test-email")
        print("\n=== DIAGNOSTICS ENDPOINT RESPONSE ===")
        print(json.dumps(response.json(), indent=2))
        print("======================================\n")

if __name__ == "__main__":
    run_diagnostics()
