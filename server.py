"""Flask web: catálogo público y PDFs de cartas TCGdex."""
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from urllib.parse import quote, urlparse

import requests
from flask import Flask, jsonify, request, send_file, send_from_directory
from PIL import Image, UnidentifiedImageError
from impresion import generar_pdf

BASE_DIR = Path(__file__).resolve().parent
API_BASE = "https://api.tcgdex.net/v2/es/cards"
MAX_CARDS = 54
MAX_IMAGE_BYTES = 6 * 1024 * 1024
CARD_ID_RE = re.compile(r"^[A-Za-z0-9_.-]{3,72}$")
Image.MAX_IMAGE_PIXELS = 12_000_000

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024
logging.basicConfig(level=logging.INFO)

@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")

@app.get("/app.js")
def javascript():
    return send_from_directory(BASE_DIR, "app.js")

@app.get("/styles.css")
def styles():
    return send_from_directory(BASE_DIR, "styles.css")

@app.get("/health")
def health():
    return jsonify(status="ok")

def _get_image(card_id: str) -> Image.Image:
    api_url = f"{API_BASE}/{quote(card_id, safe='')}"
    response = requests.get(api_url, timeout=(5, 15), allow_redirects=False)
    response.raise_for_status()
    if response.status_code != 200:
        raise ValueError("La API redirigió la consulta de la carta")
    card = response.json()
    if not isinstance(card, dict) or card.get("id") != card_id:
        raise ValueError("La API no devolvió la carta solicitada")
    asset = card.get("image")
    if not isinstance(asset, str) or not asset:
        raise ValueError("No hay imagen en español para esta carta")

    parsed = urlparse(asset)
    if (parsed.scheme != "https" or parsed.hostname != "assets.tcgdex.net"
            or parsed.port not in (None, 443) or parsed.username is not None
            or parsed.password is not None or parsed.query or parsed.fragment
            or not parsed.path.startswith("/es/")):
        raise ValueError("La fuente de imagen no pertenece a TCGdex en español")
    image_url = asset if asset.endswith((".png", ".jpg", ".webp")) else f"{asset.rstrip('/')}/high.webp"

    with requests.get(image_url, timeout=(5, 20), stream=True, allow_redirects=False) as image_resp:
        image_resp.raise_for_status()
        if image_resp.status_code != 200:
            raise ValueError("La descarga de la imagen redirigió la solicitud")
        if not image_resp.headers.get("Content-Type", "").lower().startswith("image/"):
            raise ValueError("La URL no devolvió una imagen")
        content = bytearray()
        for chunk in image_resp.iter_content(chunk_size=65536):
            content.extend(chunk)
            if len(content) > MAX_IMAGE_BYTES:
                raise ValueError("Imagen demasiado grande")
    try:
        with Image.open(BytesIO(content)) as image:
            image.load()
            if image.width < 200 or image.height < 250:
                raise ValueError("La imagen es demasiado pequeña para imprimir")
            return image.copy()
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Formato de imagen inválido") from exc

@app.post("/api/pdf")
def create_pdf():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("ids"), list):
        return jsonify(error="Envía JSON con una lista 'ids'."), 400
    ids = payload["ids"]
    if not 1 <= len(ids) <= MAX_CARDS:
        return jsonify(error=f"Selecciona entre 1 y {MAX_CARDS} cartas."), 400
    if any(not isinstance(item, str) or not CARD_ID_RE.fullmatch(item) for item in ids):
        return jsonify(error="Se encontraron identificadores de carta inválidos."), 400
    try:
        with ThreadPoolExecutor(max_workers=4) as pool:
            images = list(pool.map(_get_image, ids))
    except (requests.RequestException, ValueError, OSError) as exc:
        app.logger.warning("PDF no generado: %s", exc)
        return jsonify(error=f"No se pudo obtener una de las cartas: {exc}"), 422
    try:
        pdf = generar_pdf(images)
    except Exception:
        app.logger.exception("Fallo al crear PDF")
        return jsonify(error="No se pudo crear el documento PDF."), 500
    finally:
        for image in images:
            image.close()
    date = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return send_file(
        BytesIO(pdf), mimetype="application/pdf", as_attachment=True,
        download_name=f"pokemon_tcg_{len(ids)}_cartas_{date}.pdf",
        max_age=0,
    )

@app.errorhandler(413)
def size_limit(_error):
    return jsonify(error="Solicitud demasiado grande."), 413

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
