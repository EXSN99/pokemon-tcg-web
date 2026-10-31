from io import BytesIO
from unittest.mock import patch

from PIL import Image
from pypdf import PdfReader

from impresion import generar_pdf
from server import app

def test_generate_pdf_10_cards_two_pages():
    image = Image.new("RGB", (600, 825), "yellow")
    pdf = generar_pdf([image] * 10)
    reader = PdfReader(BytesIO(pdf))
    assert len(reader.pages) == 2
    assert all(float(p.mediabox.width) > 595 for p in reader.pages)

def test_health_and_static():
    client = app.test_client()
    assert client.get("/health").json == {"status": "ok"}
    assert client.get("/").status_code == 200
    assert client.get("/app.js").status_code == 200

def test_validation():
    client = app.test_client()
    assert client.post("/api/pdf", json={"ids": []}).status_code == 400
    assert client.post("/api/pdf", json={"ids": ["http://evil.test/"]}).status_code == 400
    assert client.post("/api/pdf", json={"ids": ["swsh3-136"] * 55}).status_code == 400

def test_pdf_endpoint_with_mocked_tcg_images():
    with patch("server._get_image", return_value=Image.new("RGB", (600, 825), "red")):
        response = app.test_client().post("/api/pdf", json={"ids": ["swsh3-136", "swsh3-136"]})
    assert response.status_code == 200
    assert response.mimetype == "application/pdf"
    assert len(PdfReader(BytesIO(response.data)).pages) == 1
