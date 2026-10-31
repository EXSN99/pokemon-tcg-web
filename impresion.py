"""Generación de PDF A4: nueve cartas de 63 x 88 mm por página."""
from io import BytesIO
from PIL import Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

CARD_WIDTH = 6.3 * cm
CARD_HEIGHT = 8.8 * cm
COLUMNS = 3
ROWS = 3
CARDS_PER_PAGE = COLUMNS * ROWS

def _crop_to_card(image: Image.Image) -> Image.Image:
    width, height = image.size
    expected_ratio = CARD_WIDTH / CARD_HEIGHT
    original_ratio = width / height
    if original_ratio > expected_ratio:
        new_width = round(height * expected_ratio)
        x0 = (width - new_width) // 2
        image = image.crop((x0, 0, x0 + new_width, height))
    elif original_ratio < expected_ratio:
        new_height = round(width / expected_ratio)
        y0 = (height - new_height) // 2
        image = image.crop((0, y0, width, y0 + new_height))
    if image.mode in ("RGBA", "LA"):
        background = Image.new("RGB", image.size, "white")
        background.paste(image, mask=image.getchannel("A"))
        return background
    return image.convert("RGB")

def generar_pdf(images: list[Image.Image]) -> bytes:
    """Return PDF in bytes, with cut guides."""
    if not images:
        raise ValueError("No se recibieron imágenes para el PDF")
    width, height = A4
    x_origin = (width - COLUMNS * CARD_WIDTH) / 2
    y_origin = (height - ROWS * CARD_HEIGHT) / 2
    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=A4, pageCompression=1)
    pdf.setTitle("Cartas Pokémon TCG para imprimir")
    for offset in range(0, len(images), CARDS_PER_PAGE):
        for index, image in enumerate(images[offset:offset + CARDS_PER_PAGE]):
            row, col = divmod(index, COLUMNS)
            x = x_origin + col * CARD_WIDTH
            y = y_origin + (ROWS - 1 - row) * CARD_HEIGHT
            cropped = _crop_to_card(image)
            pdf.drawImage(ImageReader(cropped), x, y, width=CARD_WIDTH, height=CARD_HEIGHT,
                          preserveAspectRatio=False)
            cropped.close()
        # Guías de corte como en la versión original: cruzan toda la página.
        # El tramo fuera del A4 se recorta naturalmente al visualizar o imprimir.
        pdf.setStrokeColor(colors.black)
        pdf.setLineWidth(0.8)
        extension = 1 * cm
        for col in range(COLUMNS + 1):
            x = x_origin + col * CARD_WIDTH
            pdf.line(x, -extension, x, height + extension)
        for row in range(ROWS + 1):
            y = y_origin + row * CARD_HEIGHT
            pdf.line(-extension, y, width + extension, y)
        pdf.showPage()
    pdf.save()
    return output.getvalue()
