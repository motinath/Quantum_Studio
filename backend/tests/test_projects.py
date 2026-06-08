"""Tests for the projects CRUD router."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Project, User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_project(client: AsyncClient, headers: dict[str, str], name: str = "Test Project") -> dict:
    payload = {
        "name": name,
        "description": "A test project",
        "topology": "grid",
        "num_qubits": 4,
        "target_frequency_ghz": 5.2,
        "substrate_material": "sapphire",
        "metal_layer": "niobium",
    }
    response = await client.post("/api/projects", json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_projects_empty(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    response = await client.get("/api/projects", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_projects(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    await _create_project(client, auth_headers, "Project A")
    await _create_project(client, auth_headers, "Project B")

    response = await client.get("/api/projects", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    names = {p["name"] for p in data}
    assert names == {"Project A", "Project B"}


@pytest.mark.asyncio
async def test_list_projects_unauthorized(client: AsyncClient) -> None:
    response = await client.get("/api/projects")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_project(client: AsyncClient, auth_headers: dict[str, str], test_user: User) -> None:
    data = await _create_project(client, auth_headers)
    assert data["name"] == "Test Project"
    assert data["topology"] == "grid"
    assert data["num_qubits"] == 4
    assert data["owner_id"] == test_user.id
    assert data["status"] == "draft"
    assert data["has_design"] is False


@pytest.mark.asyncio
async def test_create_project_defaults(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    response = await client.post("/api/projects", json={"name": "Minimal"}, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["topology"] == "custom"
    assert data["num_qubits"] == 0
    assert data["target_frequency_ghz"] == 5.0
    assert data["substrate_material"] == "silicon"
    assert data["metal_layer"] == "aluminum"


# ---------------------------------------------------------------------------
# Get
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_project(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    created = await _create_project(client, auth_headers)
    response = await client.get(f"/api/projects/{created['id']}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == created["id"]
    assert "design_payload" in data


@pytest.mark.asyncio
async def test_get_project_not_found(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    response = await client.get("/api/projects/nonexistent-uuid", headers=auth_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_project_other_user(
    client: AsyncClient, auth_headers: dict[str, str], admin_user: User, admin_headers: dict[str, str]
) -> None:
    # Admin creates a project
    created = await _create_project(client, admin_headers)
    # Test user tries to access it
    response = await client.get(f"/api/projects/{created['id']}", headers=auth_headers)
    assert response.status_code == 404  # Should not leak existence


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_project(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    created = await _create_project(client, auth_headers)
    response = await client.patch(
        f"/api/projects/{created['id']}",
        json={"name": "Updated Name", "num_qubits": 8},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["num_qubits"] == 8
    assert data["topology"] == "grid"  # unchanged


@pytest.mark.asyncio
async def test_update_project_not_found(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    response = await client.patch(
        "/api/projects/nonexistent-uuid",
        json={"name": "X"},
        headers=auth_headers,
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_project(client: AsyncClient, auth_headers: dict[str, str], db: AsyncSession) -> None:
    created = await _create_project(client, auth_headers)
    response = await client.delete(f"/api/projects/{created['id']}", headers=auth_headers)
    assert response.status_code == 204

    # Verify gone
    result = await db.execute(select(Project).where(Project.id == created["id"]))
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_delete_project_not_found(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    response = await client.delete("/api/projects/nonexistent-uuid", headers=auth_headers)
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Save design
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_save_design(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    created = await _create_project(client, auth_headers)
    design = {"num_qubits": 5, "topology": "ring", "qubits": [{"id": "Q1"}]}
    response = await client.post(
        f"/api/projects/{created['id']}/save-design",
        json=design,
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["saved"] is True

    # Verify persisted
    get_resp = await client.get(f"/api/projects/{created['id']}", headers=auth_headers)
    assert get_resp.json()["design_payload"] == design
    assert get_resp.json()["num_qubits"] == 5
    assert get_resp.json()["topology"] == "ring"


# ---------------------------------------------------------------------------
# Versions
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_and_list_versions(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    created = await _create_project(client, auth_headers)

    # Create version
    response = await client.post(
        f"/api/projects/{created['id']}/versions",
        json={"tag": "v1.0", "message": "Initial layout"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    version = response.json()
    assert version["tag"] == "v1.0"
    assert version["message"] == "Initial layout"

    # List versions
    list_resp = await client.get(f"/api/projects/{created['id']}/versions", headers=auth_headers)
    assert list_resp.status_code == 200
    versions = list_resp.json()
    assert len(versions) == 1
    assert versions[0]["tag"] == "v1.0"
