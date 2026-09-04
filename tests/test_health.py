def test_health_endpoint(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "embedding" in data
    assert "llm" in data
    assert "database" in data


def test_health_has_demo_mode(client):
    resp = client.get("/api/health")
    data = resp.json()
    assert "demo_mode" in data
