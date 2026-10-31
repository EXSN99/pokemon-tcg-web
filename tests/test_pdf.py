from io import BytesIO
from unittest.mock import patch

from PIL import Image
from pypdf import PdfReader
from pypdf.generic import ContentStream
from reportlab.lib.units import mm

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

def test_original_card_dimensions_and_full_page_cut_lines():
    """Valida tamaño físico en PDF y ocho guías hasta el borde A4."""
    image = Image.new("RGB", (600, 825), "yellow")
    reader = PdfReader(BytesIO(generar_pdf([image] * 9)))
    page = reader.pages[0]
    page_width = float(page.mediabox.width)
    page_height = float(page.mediabox.height)
    assert abs(page_width - 210 * mm) < 0.01
    assert abs(page_height - 297 * mm) < 0.01

    operations = ContentStream(page.get_contents(), reader).operations
    image_placements = []
    segments = []
    for index, (operands, operator) in enumerate(operations):
        if operator == b"Do":
            previous_operands, previous_operator = operations[index - 1]
            assert previous_operator == b"cm"
            image_placements.append([float(n) for n in previous_operands])
        if operator == b"m" and index + 1 < len(operations):
            next_operands, next_operator = operations[index + 1]
            if next_operator == b"l":
                segments.append([float(n) for n in (*operands, *next_operands)])

    assert len(image_placements) == 9
    for a, b, c, d, x, y in image_placements:
        assert abs(a - 63 * mm) < 0.01
        assert abs(d - 88 * mm) < 0.01
        assert abs(b) < 0.01 and abs(c) < 0.01

    vertical = [s for s in segments if abs(s[0] - s[2]) < 0.01]
    horizontal = [s for s in segments if abs(s[1] - s[3]) < 0.01]
    assert len(vertical) == 4
    assert len(horizontal) == 4
    assert all(min(s[1], s[3]) <= 0 and max(s[1], s[3]) >= page_height for s in vertical)
    assert all(min(s[0], s[2]) <= 0 and max(s[0], s[2]) >= page_width for s in horizontal)

    # Las líneas deben coincidir con cada límite de carta, no solo llegar al borde.
    x_origin = (page_width - 3 * 63 * mm) / 2
    y_origin = (page_height - 3 * 88 * mm) / 2
    for index, segment in enumerate(sorted(vertical, key=lambda s: s[0])):
        assert abs(segment[0] - (x_origin + index * 63 * mm)) < 0.01
    for index, segment in enumerate(sorted(horizontal, key=lambda s: s[1])):
        assert abs(segment[1] - (y_origin + index * 88 * mm)) < 0.01
