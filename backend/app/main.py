"""FastAPI entrypoint for Smart Grocery Agent Backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.v1.optimize import router as optimize_router
from backend.app.api.v1.forecast import router as forecast_router
from backend.app.api.v1.catalog import router as catalog_router
from backend.app.api.v1.offers import router as offers_router

app = FastAPI(
    title="Smart Grocery Agent API",
    version="1.0.0",
    description="Backend API for personal AI grocery optimization, price tracking, and household inventory.",
)

# CORS configuration: Allow local development and GitHub Pages hosting
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default dev server
        "http://localhost:3000",
        "https://*.github.io",    # GitHub Pages deployment
        "*",                      # Open for development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers under /api/v1
app.include_router(optimize_router, prefix="/api/v1")
app.include_router(forecast_router, prefix="/api/v1")
app.include_router(catalog_router, prefix="/api/v1")
app.include_router(offers_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for container orchestrators and monitoring."""
    return {"status": "ok", "service": "smart-grocery-agent-api", "version": "1.0.0"}
