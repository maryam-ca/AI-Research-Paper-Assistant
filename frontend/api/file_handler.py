"""File handling: Vercel Blob upload/download + deterministic thumbnails.

Iteration 10 lesson: DOCX thumbnails were added late and used non-deterministic
colors. We generate a deterministic color per paper id and a text-based
thumbnail so every paper (PDF or DOCX) always has a cover image.
"""
import os
import io
import logging
import requests
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger("file_handler")

BLOB_BASE = "https://blob.vercel-storage.com"
BLOB_TOKEN = os.getenv("BLOB_READ_WRITE_TOKEN")

# Local-disk fallback so the app runs without a Vercel Blob token (dev only).
LOCAL_BLOB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".blobs")


def is_cloud() -> bool:
    return bool(BLOB_TOKEN)


def _local_path(name: str) -> str:
    os.makedirs(LOCAL_BLOB_DIR, exist_ok=True)
    return os.path.join(LOCAL_BLOB_DIR, name)


def get_deterministic_color(paper_id: str) -> str:
    hue = abs(hash(paper_id)) % 360
    return f"hsl({hue}, 55%, 45%)"


def _hsl_to_rgb(hsl: str):
    # crude hsl->rgb for thumbnail background
    import colorsys
    nums = hsl.replace("hsl(", "").replace(")", "").split(",")
    h = int(nums[0]) / 360.0
    s = float(nums[1].strip().rstrip("%")) / 100.0
    l = float(nums[2].strip().rstrip("%")) / 100.0
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return int(r * 255), int(g * 255), int(b * 255)


def generate_thumbnail(title: str, paper_id: str, size=(400, 520)) -> bytes:
    bg = get_deterministic_color(paper_id)
    rgb = _hsl_to_rgb(bg)
    img = Image.new("RGB", size, rgb)
    draw = ImageDraw.Draw(img)
    # title text, wrapped
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 26)
    except IOError:
        font = ImageFont.load_default()
    words = (title or "Untitled").split()
    lines, cur = [], ""
    for w in words:
        if len(cur + " " + w) > 22:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur:
        lines.append(cur)
    lines = lines[:10]
    y = 40
    for line in lines:
        draw.text((20, y), line, fill="white", font=font)
        y += 34
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def upload_bytes(data: bytes, pathname: str, content_type: str = "application/octet-stream") -> str:
    """Upload bytes to Vercel Blob (cloud) or local disk (dev fallback)."""
    if is_cloud():
        resp = requests.put(
            f"{BLOB_BASE}?pathname={requests.utils.quote(pathname)}",
            headers={
                "Authorization": f"Bearer {BLOB_TOKEN}",
                "x-api-version": "3",
                "Content-Type": content_type,
            },
            data=data,
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()["url"]
    # Dev fallback: write to local .blobs directory
    filename = os.path.basename(pathname)
    with open(_local_path(filename), "wb") as f:
        f.write(data)
    return f"local://{filename}"


def download_bytes(url: str) -> bytes:
    if url and url.startswith("local://"):
        with open(_local_path(url[len("local://"):]), "rb") as f:
            return f.read()
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    return resp.content
