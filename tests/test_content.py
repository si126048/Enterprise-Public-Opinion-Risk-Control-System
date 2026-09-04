def test_content_list_empty(client):
    resp = client.get("/api/content")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert data["pagination"]["total"] == 0


def test_content_not_found(client):
    resp = client.get("/api/content/nonexistent-id")
    assert resp.status_code == 404
