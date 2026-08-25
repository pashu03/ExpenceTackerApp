from fastapi import APIRouter

from lifetracker.features.auth.api import router as auth_router
from lifetracker.features.tracking.api import router as tracking_router
from lifetracker.features.users.api import router as settings_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(tracking_router)
api_router.include_router(settings_router)
