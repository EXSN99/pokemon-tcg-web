# Pokémon TCG — catálogo web en español + PDF de impresión

Adaptación del proyecto original HTML/CSS/JavaScript/Flask/ReportLab para acceso desde celulares y computadoras, sin servidor Python local en cada dispositivo.

## Características conservadas

- Cartas de TCGdex en español; expansiones, tipos, categorías, nombre, habilidad y búsqueda general.
- Favoritos por navegador; historial local de PDFs descargados.
- Visor de imágenes, navegación y diseño responsive.
- Exportar **PDF A4 con 9 cartas de 63 × 88 mm por página**, centradas y con guías de corte.

## Cambios de esta versión

- Un solo origen HTTPS: Flask sirve HTML, CSS, JavaScript y `POST /api/pdf`.
- El navegador **ya no** llama a `127.0.0.1` ni sube imágenes a carpetas del servidor.
- Flask obtiene las imágenes directamente desde URLs oficiales validadas de TCGdex y crea el PDF en memoria.
- Se incluyen un límite de 54 cartas por PDF, límites de tamaño, tiempos de espera y validación de IDs.
- Imágenes `low.webp` para el catálogo y `high.webp` para el detalle y PDF.
- Botón **Compartir favoritos**: envía un enlace con los identificadores y los importa al abrirlo desde otro dispositivo.
- Botón para abrir manualmente el PDF generado cuando un navegador móvil bloquea la descarga automática.
- `render.yaml` para Render, pruebas y GitHub Actions.

## 1. Ejecutar localmente (Windows, PowerShell)

```powershell
cd pokemon-tcg-web
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python server.py
```

Abrir <http://127.0.0.1:5000>. `index.html` debe servirse mediante Flask; no abras el HTML como un archivo `file://` para generar PDFs.

En macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

## 2. Publicar en GitHub

Crear un repositorio nuevo en GitHub y subir **todo el contenido de esta carpeta a la raíz** del repositorio (incluidos `render.yaml`, `server.py` y `requirements.txt`). Por línea de comandos:

```bash
git init
git add .
git commit -m "Publicar catálogo Pokémon TCG"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

Puedes usar repositorio privado en Render si autorizas el acceso a GitHub.

## 3. Desplegar gratis con Render

1. Ingresar a <https://dashboard.render.com/>.
2. **New → Blueprint**, enlazar el repositorio que contiene `render.yaml` y aplicar el Blueprint. Se crea un servicio web `Free`.
3. Esperar a que el estado del servicio sea **Live** y abrir la URL HTTPS asignada, por ejemplo `https://pokemon-tcg-cartas-XXXX.onrender.com`. La URL exacta la entrega Render; no está reservada por esta carpeta.
4. Para usar desde el celular, abrir esa URL directamente. Al hacer `git push`, Render despliega de nuevo si está vinculado correctamente.

Alternativa: **New → Web Service** → conectar GitHub → elegir **Free** y configurar:

- Runtime: `Python`.
- Build Command: `pip install -r requirements.txt`.
- Start Command: `gunicorn server:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 180`.
- Health Check Path: `/health`.

**Limitaciones del plan gratuito:** suspensión tras unos 15 minutos sin tráfico, arranque en frío, límites de memoria/horas/tráfico; no es un SLA productivo. No se guardan PDFs en el servidor.

## 4. Uso

1. Escoge una expansión y filtra cartas. Agrégalas con el corazón.
2. En **Favoritos** selecciona **Exportar a PDF**; máximo 54 cartas por PDF.
3. Imprime el PDF sobre papel A4 en **escala 100 % / Tamaño real**, sin activar «Ajustar a página». Cada carta debe medir **63 × 88 mm**.
4. Para pasar una selección a otro dispositivo, pulsa **Compartir favoritos**, envía el enlace y ábrelo en el otro navegador. Las cartas se importarán a sus favoritos locales.
5. El histórico muestra las generaciones de PDF registradas en el navegador; no son archivos persistidos en el servidor.

## 5. Pruebas y endpoints

```bash
pip install pytest pypdf
pytest -q
node --check app.js
```

- `GET /` : visor web.
- `GET /health` : salud del servicio.
- `POST /api/pdf` : JSON `{ "ids": ["swsh3-136", "swsh3-136"] }`. Permite IDs repetidos para obtener copias.

## 6. Límites y siguientes mejoras

- Los **favoritos e historial se almacenan mediante `localStorage`**: se mantienen en ese mismo navegador si no borras sus datos, pero no se sincronizan automáticamente. Compartir enlaces funciona sin cuentas.
- Si necesitas sincronización continua, añadir autenticación y una base de datos persistente (por ejemplo Supabase Auth + PostgreSQL) con listas asociadas a cada cuenta.
- La **búsqueda general** original consulta el detalle de hasta 100 candidatos. No es una búsqueda integral de todas las cartas: conviene acotar por expansión/tipo/nombre o implementar posteriormente búsqueda indexada.
- Algunas cartas no tienen imagen en español; una selección con una carta que no se puede descargar hará que la exportación falle con un error, en lugar de generar un PDF incompleto.
- No se cuenta con caché de imágenes, cuotas de uso por usuario, monitorización externa ni tests de carga. Antes de promocionar el sitio públicamente, añadir estas protecciones.
- Uso personal/no comercial recomendado. Las imágenes y marcas pertenecen a sus titulares; revisa condiciones de uso antes de redistribuir o comercializar las cartas impresas.

**Fuentes técnicas:** [TCGdex API](https://tcgdex.dev/), [Imágenes TCGdex](https://tcgdex.dev/assets), [Render Web Services](https://render.com/docs/web-services), [Render Free](https://render.com/docs/free).