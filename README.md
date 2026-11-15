# Pokémon TCG — Cartas en español para imprimir

**Explora cartas Pokémon TCG en español, crea tu selección de favoritas y descárgalas en PDF, listas para imprimir y recortar.** Una aplicación web gratuita de uso personal, accesible desde computadoras, tablets y celulares.

### 🌐 [Abrir la aplicación web](https://pokemon-tcg-cartas-0nch.onrender.com/)

**No requiere instalación ni registro.** Solo necesitas un navegador y conexión a Internet.

---

## ¿Qué puedes hacer?

| Función | Descripción |
| --- | --- |
| 🃏 **Explorar cartas** | Visualiza cartas Pokémon TCG en español organizadas por expansiones, con imágenes y vista ampliada. |
| 🔍 **Buscar y filtrar** | Filtra por expansión, nombre, tipo, energías de los ataques y **Búsqueda General** sobre nombres, ataques, efectos y habilidades según la cobertura del índice. |
| ❤️ **Guardar favoritas y copias** | Añade la misma carta varias veces. Ajusta sus copias con los botones **− / +** antes de exportar. |
| 📄 **Descargar PDF** | Genera un documento A4 con hasta **9 cartas por hoja** y **180 copias por PDF (20 páginas A4)**, incluidas las cartas repetidas. |
| ✂️ **Usar guías de corte** | El PDF incluye líneas extendidas hasta los bordes de la página para facilitar el recorte. |
| 🔗 **Compartir favoritas** | Envía un enlace a otra persona o dispositivo para importar tu selección de cartas. |
| 🕘 **Consultar historial** | Revisa cuándo generaste PDFs con cada carta desde el navegador actual. |

## Cómo usar la aplicación

1. **Entra a la web:** [pokemon-tcg-cartas-0nch.onrender.com](https://pokemon-tcg-cartas-0nch.onrender.com/).
2. **Explora las expansiones:** selecciona una de la lista o utiliza el buscador de expansiones.
3. **Encuentra tus cartas:** busca por nombre, categoría, tipo o energía de los ataques. En **Búsqueda General**, introduce una palabra o frase de ataques, efectos o habilidades y pulsa **Buscar** o **Enter**. Si el índice aún no cubre todo el catálogo, aparecerá un aviso de resultados parciales. El filtro **Solo cartas con imagen disponible** viene marcado para facilitar la impresión; desmárcalo para consultar también cartas sin escaneo.
4. **Abre una carta:** selecciónala para ver su imagen ampliada y navegar entre cartas.
5. **Añádela a favoritos:** pulsa el corazón 🤍. Cada pulsación suma **una copia** de esa carta y el contador ❤️ muestra el total de copias.
6. **Elige cuántas copias imprimir:** abre ❤️ **Favoritos** y usa **+** para añadir otra copia o **−** para quitar una. La **✕** elimina todas las copias de esa carta. El contador te indica el total seleccionado.
7. **Descarga el PDF:** pulsa **📥 Exportar a PDF**. Las cartas repetidas aparecen tantas veces como indiques. Si el navegador no descarga el archivo automáticamente, utiliza **«Abrir o descargar el último PDF»**.
8. **Imprime y recorta:** imprime el PDF en papel A4 con **escala 100 % / Tamaño real**. No actives «Ajustar a página».

### Tamaños de impresión

| Elemento | Medida |
| --- | --- |
| Papel | **A4 — 210 × 297 mm** |
| Cada carta | **63 × 88 mm** |
| Distribución | **3 columnas × 3 filas** |
| Cartas por página | **9** |
| Copias totales por PDF | **Máximo 180** (20 páginas, suma de todas las cantidades) |
| Cuadrícula de 9 cartas | **189 × 264 mm** |
| Márgenes | **10,5 mm laterales / 16,5 mm verticales** |

Las líneas de corte se prolongan hasta los bordes del documento. El tamaño de cada carta se define en el PDF, pero una impresora puede reducirlo si se selecciona alguna opción de ajuste de escala.

## Filtro por energía requerida en los ataques

Este filtro **no es el tipo del Pokémon**. Por ejemplo, un Pokémon de tipo Dragón puede tener ataques que exijan Agua, Fuego y energía Incolora.

1. Selecciona una **expansión** (o acota las cartas por nombre/tipo).
2. Marca una o varias energías: Agua, Fuego, Planta, Rayo, Psíquica, Lucha, Oscura, Metálica, Hada o Incolora.
3. En **Combinar energías**, elige:
   - **Cualquiera (OR):** muestra cartas si al menos una de las energías seleccionadas aparece en algún ataque.
   - **Todas (AND):** muestra cartas si todas las energías seleccionadas aparecen entre los costes de sus ataques, incluso si están distribuidas entre distintos ataques.
4. Para quitar un filtro, vuelve a pulsar su botón. Puedes combinarlo con el filtro **Tipo de Pokémon**.

**Ejemplo:** un Dragón con un ataque que utiliza Agua y Fuego aparecerá con las dos energías seleccionadas y el modo **Todas**.

**Índice unificado de búsqueda:** GitHub Actions genera y actualiza `data/energy-index.json`. En el esquema v2 guarda las **energías de ataque, texto normalizado de nombres, ataques, efectos y habilidades, imágenes oficiales de TCGdex y un catálogo breve**. Este último incluye los nombres e imágenes disponibles de todo el catálogo. La web puede filtrar registros indexados sin realizar peticiones individuales a TCGdex. Se conservan también las cartas que no tienen costes de ataque (lista vacía).

**Mientras se completa el índice de texto completo**, las búsquedas por nombre trabajan con el catálogo disponible, y las búsquedas sobre ataques, efectos y habilidades verifican los registros ya indexados. Si quedan demasiadas cartas sin texto completo, la web indica explícitamente **«Búsqueda parcial»**, muestra únicamente coincidencias verificadas y explica que puede haber más; así evita confundir ausencia de resultados con ausencia de datos. Para búsquedas acotadas también verifica directamente detalles pendientes mediante consultas limitadas. El panel de energías muestra la cobertura de energías y de texto.

**Incolora** es un símbolo de coste genérico, no necesariamente una carta de Energía Incolora.

Referencia: [TCGdex, estructura de las cartas](https://tcgdex.dev/es/reference/card).

### Cómo se mantiene el índice

- **Fuente:** `https://api.tcgdex.net/v2/es/cards` y el detalle de cada carta.
- **Datos:** `data/energy-index.json`, con ID, energías, texto completo normalizado, URL de imagen oficial, catálogo breve y metadatos de cobertura.
- **Carga:** `scripts/build_energy_index.py`, incremental e idempotente; procesa hasta 3.000 cartas pendientes por ejecución programada, con tres consultas concurrentes y reintentos ante errores.
- **Programación:** `.github/workflows/energy-index.yml`, automática una vez al día y con ejecución manual habilitada desde GitHub Actions.
- **Actualización de la web:** el archivo se publica con el proyecto; tras el despliegue del commit, los usuarios consultan una versión ampliada de forma automática. La cobertura de texto se incrementa progresivamente.

Puedes seguir las ejecuciones en [GitHub Actions — Actualizar índice de energías](https://github.com/EXSN99/pokemon-tcg-web/actions/workflows/energy-index.yml). La cobertura y la fecha de generación aparecen en el propio JSON. No se almacenan imágenes ni datos personales, solo un índice derivado de los costes de ataques publicados por TCGdex.


### Generación de PDF de hasta 20 páginas

El PDF mantiene **63 × 88 mm por carta**, las nueve cartas por hoja A4 y las líneas de corte extendidas hasta el borde. Las imágenes se procesan por lotes de una hoja para reducir el consumo de memoria en el servidor. En selecciones grandes, especialmente con muchos diseños distintos, la generación puede tardar más y depende de la respuesta de TCGdex y de los recursos del alojamiento gratuito. El límite de 180 es un máximo configurado de la aplicación, no una garantía de tiempo de generación.

## Compartir tus cartas favoritas

1. Abre ❤️ **Favoritos** y pulsa **🔗 Compartir favoritos**.
2. Comparte el enlace generado o cópialo desde el navegador. El enlace incluye las **cantidades seleccionadas**.
3. Al abrir el enlace, la otra persona podrá importar las cartas y sus copias a sus propios favoritos (hasta el límite disponible de 180 copias).

**Importante:** compartir la selección **no** crea una cuenta ni sincroniza automáticamente los cambios posteriores entre dispositivos.

## Imágenes de cartas

La página utiliza el campo oficial `image` de TCGdex y, cuando es necesario, prueba variantes de calidad o formato. Si TCGdex no publica una imagen para una carta, esta no puede generarse a partir de su identificador. Para facilitar la selección de cartas imprimibles, la opción **Mostrar solo cartas con imagen disponible** está activada por defecto; desactívala para ver también fichas sin imagen.

## Historial y almacenamiento

- Los **favoritos**, sus **cantidades** y el **historial de descargas** se guardan en el navegador mediante almacenamiento local. Los favoritos existentes de versiones anteriores se mantienen como una copia por carta.
- Puedes eliminar favoritos o entradas del historial desde la aplicación.
- Si borras los datos del navegador o cambias de dispositivo, esa información puede perderse. Puedes usar **Compartir favoritos** para transferir una selección.
- **Histórico** registra las generaciones de PDF por carta, pero **no conserva copias descargables de los PDF anteriores**.
- Las imágenes y las cartas dependen de la disponibilidad de los datos en español de [TCGdex](https://tcgdex.dev/). Algunas cartas pueden no disponer de imagen.

## Preguntas frecuentes

**¿Puedo utilizarla desde el celular?**  
Sí. La web se adapta a pantallas móviles y funciona con un navegador moderno.

**¿Necesito instalar Python o alguna aplicación?**  
No. Abre el enlace de la aplicación desde tu navegador.

**¿Puedo imprimir varias cartas a la vez?**  
Sí. Puedes guardar varias copias de una misma carta o combinar cartas distintas. Un PDF admite hasta **180 copias en total (20 páginas)**, distribuidas en hojas A4 de nueve cartas.

**¿Por qué mis cartas impresas se ven más pequeñas?**  
Verifica que el visor o la impresora esté configurado en **100 % / Tamaño real**, sin escalado ni ajuste automático.

**¿Puedo utilizar la búsqueda para encontrar texto de ataques o habilidades?**  
La **Búsqueda General** revisa el texto indexado de nombres, ataques, efectos y habilidades, y completa búsquedas pequeñas con detalles de TCGdex. **Mientras la indexación no alcance el 100 %, los resultados sobre ataques y habilidades pueden ser parciales**; la página lo indica para que no se interpreten como exhaustivos.

**¿Mis favoritos se comparten automáticamente con otros dispositivos?**  
No. Cada navegador guarda sus favoritos localmente. Puedes transferirlos mediante **Compartir favoritos**.

## Sobre el proyecto

Proyecto personal y comunitario para explorar cartas en español y preparar hojas imprimibles de Pokémon TCG. Utiliza el catálogo y las imágenes disponibles a través de **[TCGdex](https://tcgdex.dev/)**.

La interfaz está construida con **HTML, CSS y JavaScript**; el servicio de PDF utiliza **Python, Flask y ReportLab**.

> **Aviso:** aplicación no oficial y sin afiliación con Nintendo, The Pokémon Company o TCGdex. Pokémon, las cartas, las ilustraciones y sus marcas pertenecen a sus respectivos titulares. El proyecto está destinado a uso personal y no comercial; antes de distribuir copias impresas, revisa los derechos y condiciones correspondientes.
