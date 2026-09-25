from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from app.middleware import RequestLimitMiddleware


def test_chunked_body_is_bounded_and_valid_body_is_replayed():
    app = FastAPI()
    app.add_middleware(RequestLimitMiddleware, max_bytes=16)
    @app.post("/")
    async def echo(request: Request):
        return {"body": (await request.body()).decode()}
    with TestClient(app) as client:
        response = client.post("/", content=iter([b"a" * 9, b"b" * 8]))
        assert response.status_code == 413
        response = client.post("/", content=iter([b"hello", b" world"]))
        assert response.status_code == 200
        assert response.json()["body"] == "hello world"
