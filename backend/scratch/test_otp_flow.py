import secrets
import sys
import os
from unittest.mock import patch

# Add parent directory to sys.path to resolve imports correctly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Global dictionary to store captured OTPs: { email: otp }
captured_otps = {}

def mock_send_otp_email(email: str, otp: str, name: str = "User"):
    print(f"\n[MOCK EMAIL SERVICE] Captured OTP for {email} (User: {name}): {otp}\n")
    captured_otps[email] = otp
    return True

# Mock the send_otp_email function inside app.routers.auth
@patch("app.routers.auth.send_otp_email", side_effect=mock_send_otp_email)
def test_flow(mock_send):
    print("Starting integration test for OTP flow...")
    email = f"user_{secrets.token_hex(4)}@example.com"
    password = "securePassword123!"
    
    # Wrap in TestClient context manager to run lifespan startup database migrations
    with client:
        # 1. Register User
        print(f"Registering user: {email}...")
        reg_response = client.post("/api/auth/register", json={
            "name": "OTP Test User",
            "email": email,
            "password": password,
            "organization": "OTP Labs",
            "role": "engineer"
        })
        
        assert reg_response.status_code == 201, f"Reg failed: {reg_response.text}"
        print("Registration successful! OTP email triggered.")
        
        # Retrieve the captured OTP
        otp = captured_otps.get(email)
        assert otp is not None, "Failed to capture OTP from email mock"
        print(f"Captured OTP from mock: {otp}")

        # 2. Assert unverified user cannot login
        print("Testing login block for unverified user...")
        login_response = client.post("/api/auth/token", data={
            "username": email,
            "password": password
        })
        assert login_response.status_code == 400, f"Expected 400 for unverified login, got {login_response.status_code}: {login_response.text}"
        assert "Please verify your email address." in login_response.json()["detail"]
        print("Login successfully blocked for unverified user.")

        # 3. Test Resend OTP Cooldown (60 seconds)
        print("Testing resend-otp cooldown...")
        resend_resp = client.post("/api/auth/resend-otp", json={"email": email})
        assert resend_resp.status_code == 429, f"Expected 429 cooldown error, got {resend_resp.status_code}: {resend_resp.text}"
        print("Resend cooldown check works perfectly (429 Rate Limited).")

        # 4. Test OTP Attempts Limit (5 attempts)
        print("Testing failed attempts limit...")
        for i in range(1, 5):
            verify_resp = client.post("/api/auth/verify-otp", json={
                "email": email,
                "otp": "000000" # incorrect code
            })
            assert verify_resp.status_code == 400, f"Expected 400, got {verify_resp.status_code}"
            print(f"Attempt {i} failed as expected. Response: {verify_resp.json()['detail']}")
            
        # The 5th attempt should lock the account / code
        verify_resp_5 = client.post("/api/auth/verify-otp", json={
            "email": email,
            "otp": "000000"
        })
        assert verify_resp_5.status_code == 400
        print(f"Attempt 5 locked verification as expected: {verify_resp_5.json()['detail']}")
        
        # Try correct code after lock, should fail
        verify_correct_after_lock = client.post("/api/auth/verify-otp", json={
            "email": email,
            "otp": otp
        })
        assert verify_correct_after_lock.status_code == 400
        assert "Too many failed verification attempts" in verify_correct_after_lock.json()["detail"]
        print("Attempts locked block verified.")

        # 5. Create a new user to test successful verification flow
        email_success = f"user_{secrets.token_hex(4)}@example.com"
        print(f"\nRegistering second user for success path: {email_success}...")
        reg_response_success = client.post("/api/auth/register", json={
            "name": "OTP Success User",
            "email": email_success,
            "password": password,
            "organization": "OTP Labs",
            "role": "engineer"
        })
        assert reg_response_success.status_code == 201
        
        otp_success = captured_otps.get(email_success)
        assert otp_success is not None
        print(f"Captured success OTP: {otp_success}")

        # Verify with correct code
        print("Verifying with correct code...")
        verify_success_resp = client.post("/api/auth/verify-otp", json={
            "email": email_success,
            "otp": otp_success
        })
        assert verify_success_resp.status_code == 200, f"Expected 200, got {verify_success_resp.status_code}: {verify_success_resp.text}"
        token_data = verify_success_resp.json()
        assert "access_token" in token_data
        assert token_data["user"]["email"] == email_success
        print("Verification successful! Issued access token.")

        # Login user now
        print("Testing login again with verified credentials...")
        login_success_resp = client.post("/api/auth/token", data={
            "username": email_success,
            "password": password
        })
        assert login_success_resp.status_code == 200, f"Expected 200, got {login_success_resp.status_code}: {login_success_resp.text}"
        print("Login successful for verified user!")

    print("\nAll OTP integration tests completed successfully!")

if __name__ == "__main__":
    test_flow()
