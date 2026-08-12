from pydantic import BaseModel, field_validator
from typing import Optional
import re


class ScrapeRequest(BaseModel):
    location: str
    specialty: str
    limit: Optional[int] = 50

    @field_validator("location")
    @classmethod
    def validate_location(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Location cannot be empty")
        if not re.match(r"^[a-zA-Z0-9\s\-]+$", v):
            raise ValueError(
                f"Invalid location '{v}' — only letters, numbers, spaces, and hyphens are allowed"
            )
        return v

    @field_validator("specialty")
    @classmethod
    def validate_specialty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Specialty cannot be empty")
        if not re.match(r"^[a-zA-Z0-9\s\-/&]+$", v):
            raise ValueError(
                f"Invalid specialty '{v}' — only letters, numbers, spaces, hyphens, slashes, and ampersands are allowed"
            )
        return v

    @field_validator("limit")
    @classmethod
    def validate_limit(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("Limit must be non-negative")
        if v == 0:
            return None  # 0 means unlimited
        return v


class ScrapeMetadata(BaseModel):
    timestamp: str
    location: str
    specialty: str
    limit_requested: Optional[int]
    total_found: int = 0
    total_scraped: int = 0
    total_failed: int = 0
    total_skipped_dedup: int = 0
    failed_urls: list[str] = []
    warnings: list[str] = []
