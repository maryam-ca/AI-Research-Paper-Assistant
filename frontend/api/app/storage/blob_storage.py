import io
import os
import time
from pathlib import Path

import vercel_blob as blob

TARGET_WIDTH = 400
MAX_FILE_SIZE = 80 * 1024


async def upload_paper(file_bytes: bytes, filename: str, paper_id: str) -> str:
    ext = Path(filename).suffix or ".pdf"
    blob_path = f"papers/{paper_id}{ext}"
    result = await blob.upload(
        file_bytes,
        blob_path,
        access="public",
        token=os.environ.get("BLOB_READ_WRITE_TOKEN", ""),
    )
    return result["url"]


async def upload_thumbnail(file_bytes: bytes, paper_id: str, ext: str = ".jpg") -> str:
    blob_path = f"thumbnails/{paper_id}{ext}"
    result = await blob.upload(
        file_bytes,
        blob_path,
        access="public",
        token=os.environ.get("BLOB_READ_WRITE_TOKEN", ""),
    )
    return result["url"]


async def delete_blob(path: str) -> bool:
    try:
        await blob.delete(path, token=os.environ.get("BLOB_READ_WRITE_TOKEN", ""))
        return True
    except Exception:
        return False


async def get_download_url(path: str) -> str | None:
    try:
        result = await blob.get(path, token=os.environ.get("BLOB_READ_WRITE_TOKEN", ""))
        return result["url"]
    except Exception:
        return None


def extract_pdf_thumbnail_bytes(pdf_bytes: bytes, paper_id: str) -> bytes | None:
    try:
        import pymupdf
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        if doc.page_count == 0:
            doc.close()
            return None
        page = doc[0]
        zoom = TARGET_WIDTH / page.rect.width
        mat = pymupdf.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img_bytes = pix.tobytes("jpeg")
        doc.close()
        return _compress_bytes(img_bytes, ".jpg")
    except Exception:
        return None


def render_docx_thumbnail_bytes(docx_bytes: bytes, filename: str) -> bytes | None:
    try:
        import docx2txt
        text = docx2txt.process(io.BytesIO(docx_bytes))
        if not text or not text.strip():
            return None
        from PIL import Image, ImageDraw
        img = Image.new("RGB", (400, 560), (248, 249, 250))
        draw = ImageDraw.Draw(img)
        draw.rectangle([(0, 0), (400, 60)], fill=(41, 121, 255))
        title = filename.replace(".docx", "")[:35]
        try:
            draw.text((20, 20), title, fill="white")
        except Exception:
            pass
        lines = text.replace("\r", "").split("\n")
        y = 80
        for line in lines:
            line = line.strip()
            if not line:
                y += 8
                continue
            words = line.split()
            current_line = ""
            for word in words:
                test = current_line + " " + word if current_line else word
                bbox = draw.textbbox((0, 0), test)
                if bbox[2] > 370:
                    if current_line:
                        draw.text((20, y), current_line, fill=(33, 33, 33))
                        y += 20
                    current_line = word
                else:
                    current_line = test
            if current_line:
                draw.text((20, y), current_line, fill=(33, 33, 33))
                y += 20
            if y > 530:
                break
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=85, optimize=True)
        return buf.getvalue()
    except Exception:
        return None


def _compress_bytes(data: bytes, ext: str) -> bytes:
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(data))
        w, h = img.size
        if w > TARGET_WIDTH:
            new_h = int(h * (TARGET_WIDTH / w))
            img = img.resize((TARGET_WIDTH, new_h), Image.LANCZOS)
        buf = io.BytesIO()
        if ext in (".jpg", ".jpeg"):
            img.save(buf, "JPEG", quality=80, optimize=True)
        elif ext == ".png":
            img.save(buf, "PNG", optimize=True)
        elif ext == ".webp":
            img.save(buf, "WEBP", quality=80)
        else:
            img.save(buf, "JPEG", quality=80, optimize=True)
        return buf.getvalue()
    except Exception:
        return data
