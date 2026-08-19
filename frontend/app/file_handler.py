"""
File handling for Vercel Blob.

Uses the official Vercel Python Blob SDK in production.
Falls back to local .blobs storage during local development.
"""

import io
import logging
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger("file_handler")

BLOB_TOKEN = os.getenv("BLOB_READ_WRITE_TOKEN")

LOCAL_BLOB_DIR = Path(__file__).resolve().parent / ".blobs"


def is_cloud() -> bool:
    """Return True when Vercel Blob credentials are available."""
    return bool(BLOB_TOKEN)


def _local_path(name: str) -> Path:
    LOCAL_BLOB_DIR.mkdir(parents=True, exist_ok=True)
    return LOCAL_BLOB_DIR / name


def get_deterministic_color(paper_id: str) -> str:
    hue = abs(hash(paper_id)) % 360
    return f"hsl({hue}, 55%, 45%)"


def _hsl_to_rgb(hsl: str):
    """Convert HSL string to RGB."""
    import colorsys

    nums = (
        hsl.replace("hsl(", "")
        .replace(")", "")
        .split(",")
    )

    h = int(nums[0]) / 360.0
    s = float(nums[1].strip().rstrip("%")) / 100.0
    l = float(nums[2].strip().rstrip("%")) / 100.0

    r, g, b = colorsys.hls_to_rgb(h, l, s)

    return (
        int(r * 255),
        int(g * 255),
        int(b * 255),
    )


def generate_thumbnail(
    title: str,
    paper_id: str,
    size=(400, 520),
) -> bytes:
    """Generate deterministic paper thumbnail."""

    bg = get_deterministic_color(paper_id)
    rgb = _hsl_to_rgb(bg)

    img = Image.new("RGB", size, rgb)
    draw = ImageDraw.Draw(img)

    try:
        font = ImageFont.truetype(
            "DejaVuSans-Bold.ttf",
            26,
        )
    except IOError:
        font = ImageFont.load_default()

    words = (title or "Untitled").split()

    lines = []
    current = ""

    for word in words:
        candidate = f"{current} {word}".strip()

        if len(candidate) > 22:
            if current:
                lines.append(current)

            current = word
        else:
            current = candidate

    if current:
        lines.append(current)

    lines = lines[:10]

    y = 40

    for line in lines:
        draw.text(
            (20, y),
            line,
            fill="white",
            font=font,
        )
        y += 34

    buffer = io.BytesIO()

    img.save(
        buffer,
        format="JPEG",
    )

    return buffer.getvalue()


async def upload_bytes(
    data: bytes,
    pathname: str,
    content_type: str = "application/octet-stream",
) -> str:
    """
    Upload bytes to Vercel Blob in production.

    Uses local disk when running without Vercel Blob credentials.
    """

    if is_cloud():
        from vercel.blob import AsyncBlobClient

        try:
            client = AsyncBlobClient()

            blob = await client.put(
                pathname,
                data,
                access="private",
                content_type=content_type,
                add_random_suffix=False,
            )

            logger.info(
                "Uploaded blob successfully: %s",
                blob.url,
            )

            return blob.url

        except Exception:
            logger.exception(
                "Vercel Blob upload failed for %s",
                pathname,
            )
            raise

    # ---------------------------------------------------------
    # Local development fallback
    # ---------------------------------------------------------

    filename = os.path.basename(pathname)

    local_file = _local_path(filename)

    with open(local_file, "wb") as f:
        f.write(data)

    logger.info(
        "Saved file locally: %s",
        local_file,
    )

    return f"local://{filename}"


async def download_bytes(url: str) -> bytes:
    """
    Download a file from local storage or Vercel Blob.
    """

    if url and url.startswith("local://"):
        filename = url[len("local://") :]

        with open(
            _local_path(filename),
            "rb",
        ) as f:
            return f.read()

    if is_cloud():
        from vercel.blob import AsyncBlobClient

        client = AsyncBlobClient()

        # Extract pathname from the stored Blob URL.
        marker = ".blob.vercel-storage.com/"

        if marker in url:
            pathname = url.split(marker, 1)[1]
        else:
            pathname = url

        result = await client.get(
            pathname,
            access="private",
        )

        if result is None or result.status_code != 200:
            raise FileNotFoundError(
                f"Blob not found: {pathname}"
            )

        chunks = []

        async for chunk in result.stream:
            chunks.append(chunk)

        return b"".join(chunks)

    # Local/non-cloud URL fallback
    import requests

    response = requests.get(
        url,
        timeout=60,
    )

    response.raise_for_status()

    return response.content