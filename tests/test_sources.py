def test_sources_empty(client):
    resp = client.get("/api/sources")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["sources"] == []


def test_sources_create_and_get(client):
    resp = client.post("/api/sources", json={
        "source_name": "test-source",
        "data_type": "csv_import",
        "record_count": 10,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "created"
    source_id = data["source"]["id"]

    resp2 = client.get(f"/api/sources/{source_id}")
    assert resp2.status_code == 200
    detail = resp2.json()
    assert detail["source"]["source_name"] == "test-source"
    assert detail["source"]["record_count"] == 10


def test_sources_delete(client):
    resp = client.post("/api/sources", json={
        "source_name": "to-delete",
        "data_type": "manual",
    })
    source_id = resp.json()["source"]["id"]

    resp2 = client.delete(f"/api/sources/{source_id}")
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "deleted"

    resp3 = client.get(f"/api/sources/{source_id}")
    assert resp3.status_code == 404


def test_sources_sync(client):
    resp = client.post("/api/sources/sync")
    assert resp.status_code == 200
    assert "synced" in resp.json()
