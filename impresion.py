"""Generación de PDF A4: nueve cartas de 63 x 88 mm por página."""
from io import BytesIO
from typing import Iterable
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
# ~300 DPI para una carta de 63x88 mm: suficiente para impresión y RAM acotada.
MAX_PRINT_PIXELS = (744, 1039)

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
    result = image.convert("RGB")
    if result.width > MAX_PRINT_PIXELS[0] or result.height > MAX_PRINT_PIXELS[1]:
        result.thumbnail(MAX_PRINT_PIXELS, Image.Resampling.LANCZOS)
    return result

def generar_pdf(images: Iterable[Image.Image]) -> bytes:
    """Genera el PDF por páginas sin retener toda la lista de imágenes en RAM.

    images puede ser una lista o un generador que descarga cartas bajo demanda.
    Las imágenes originales son propiedad del llamador; solamente se cierran las
    copias redimensionadas creadas durante el dibujo.
    """
    width, height = A4
    x_origin = (width - COLUMNS * CARD_WIDTH) / 2
    y_origin = (height - ROWS * CARD_HEIGHT) / 2
    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=A4, pageCompression=1)
    pdf.setTitle("Cartas Pokémon TCG para imprimir")

    def terminar_pagina():
        # Guías de corte hasta los bordes A4, como en la versión original.
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

    iterator = iter(images)
    cantidad = 0
    try:
        # Dibujar una carta tan pronto como llega. No preconsumir la última hoja:
        # un generador bajo demanda puede liberar sus imágenes al agotarse.
        for image in iterator:
            row, col = divmod(cantidad % CARDS_PER_PAGE, COLUMNS)
            x = x_origin + col * CARD_WIDTH
            y = y_origin + (ROWS - 1 - row) * CARD_HEIGHT
            cropped = _crop_to_card(image)
            try:
                pdf.drawImage(ImageReader(cropped), x, y,
                              width=CARD_WIDTH, height=CARD_HEIGHT,
                              preserveAspectRatio=False)
            finally:
                cropped.close()
            cantidad += 1
            if cantidad % CARDS_PER_PAGE == 0:
                terminar_pagina()
    finally:
        close = getattr(iterator, "close", None)
        if callable(close):
            close()

    if cantidad == 0:
        raise ValueError("No se recibieron imágenes para el PDF")
    if cantidad % CARDS_PER_PAGE:
        terminar_pagina()
    pdf.save()
    return output.getvalue()
