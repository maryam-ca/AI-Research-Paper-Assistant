import os
import io
from pathlib import Path

from .blob_storage import (
    upload_thumbnail,
    delete_blob,
    extract_pdf_thumbnail_bytes,
    render_docx_thumbnail_bytes,
)

THUMBNAIL_PREFIX = "thumbnails/"


def extract_pdf_thumbnail(pdf_bytes: bytes, paper_id: str) -> str | None:
    """Extract thumbnail from PDF bytes and upload to Vercel Blob."""
    try:
        img_bytes = extract_pdf_thumbnail_bytes(pdf_bytes, paper_id)
        if not img_bytes:
            return None
        return upload_thumbnail_sync(img_bytes, paper_id, ".jpg")
    except Exception:
        return None


def render_docx_thumbnail(docx_bytes: bytes, filename: str, paper_id: str) -> str | None:
    """Render thumbnail from DOCX bytes and upload to Vercel Blob."""
    try:
        img_bytes = render_docx_thumbnail_bytes(docx_bytes, filename)
        if not img_bytes:
            return None
        return upload_thumbnail_sync(img_bytes, paper_id, ".jpg")
    except Exception:
        return None


def upload_thumbnail_sync(img_bytes: bytes, paper_id: str, ext: str = ".jpg") -> str:
    """Upload thumbnail synchronously."""
    import asyncio
    return asyncio.run(upload_thumbnail(img_bytes, paper_id, ext))


def get_thumbnail_url(paper_id: str) -> str | None:
    """Get the thumbnail URL from Vercel Blob."""
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        blob_path = f"{THUMBNAIL_PREFIX}{paper_id}{ext}"
        try:
            import asyncio
            return asyncio.run(get_download_url(blob_path))
        except Exception:
            continue
    return None


def save_custom_thumbnail(paper_id: str, data: bytes, ext: str = ".jpg") -> str:
    """Save custom thumbnail to Vercel Blob."""
    delete_thumbnail(paper_id)
    return upload_thumbnail_sync(data, paper_id, ext)


def delete_thumbnail(paper_id: str) -> bool:
    """Delete thumbnail from Vercel Blob."""
    deleted = False
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        blob_path = f"{THUMBNAIL_PREFIX}{paper_id}{ext}"
        try:
            import asyncio
            if asyncio.run(delete_blob(blob_path)):
                deleted = True
        except Exception:
            pass
    return deleted


async def get_download_url(path: str) -> str | None:
    """Get download URL from Vercel Blob."""
    from .blob_storage import get_download_url as blob_get_download_url
    return await blob_get_download_url(path)