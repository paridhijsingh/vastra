"""Minimal FastAPI application for Vastra AI."""

from fastapi import FastAPI

app = FastAPI(title="Vastra AI")


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "Vastra AI", "status": "running"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
