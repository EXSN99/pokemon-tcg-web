// Configuración de la API
const IDIOMA = 'es'; // Idioma español
const API_BASE_URL = `https://api.tcgdex.net/v2/${IDIOMA}`;

// Configuración de imágenes
const IMAGEN_CALIDAD = 'high'; // Opciones: 'high' o 'low'
const IMAGEN_EXTENSION = 'webp'; // Opciones: 'png', 'webp' o 'jpg'

// Variables globales para el carrito
let cartasGuardadas = [];
const STORAGE_KEY = 'tcg_cartas_guardadas';
const STORAGE_KEY_DOWNLOADS = 'tcg_cartas_descargadas';

// Variables globales
let expansiones = [];
let cartasActuales = [];
let cartasFiltradas = [];
let expansionSeleccionada = null;
let tipoSeleccionado = 'todos';
const energiasSeleccionadas = new Set();
let criterioEnergias = 'cualquiera';
let versionBusqueda = 0;
const cacheDetallesEnergia = new Map();
const CONCURRENCIA_ENERGIA = 6;
let categoriaSeleccionada = 'todas';
let nombreBuscado = '';
let paginaActual = 1;
const cartasPorPagina = 48;

// Configuración del servidor local
const SERVER_URL = ''; // backend y frontend en el mismo dominio
const PAGINAS_MAXIMAS_PDF = 20;
const CARTAS_POR_HOJA_A4 = 9;
const LIMITE_PDF = PAGINAS_MAXIMAS_PDF * CARTAS_POR_HOJA_A4; // 180 copias

// Elementos del DOM
const listaExpansiones = document.getElementById('lista-expansiones');
const tituloExpansion = document.getElementById('titulo-expansion');
const cartasContainer = document.getElementById('cartas-container');
const loadingExpansiones = document.getElementById('loading-expansiones');
const loadingCartas = document.getElementById('loading-cartas');
const btnAnterior = document.getElementById('anterior');
const btnSiguiente = document.getElementById('siguiente');
const paginaActualSpan = document.getElementById('pagina-actual');
const modal = document.getElementById('modal');
const detalleCartaDiv = document.getElementById('detalle-carta');
const closeModal = document.querySelector('.close');
const filtroTipo = document.getElementById('filtro-tipo');
const filtroCategoria = document.createElement('select');
const filtroNombre = document.createElement('input');
const filtroAtaqueTexto = document.createElement('input');
const buscadorExpansiones = document.getElementById('buscador-expansiones');

// Funciones para el manejo de cartas guardadas
// El catálogo guarda una entrada por carta con la cantidad de copias a imprimir.
// Los favoritos anteriores (sin "cantidad") se interpretan como una copia.
function cantidadDeCarta(carta) {
    const cantidad = Number(carta?.cantidad);
    return Number.isSafeInteger(cantidad) && cantidad > 0 ? Math.min(cantidad, LIMITE_PDF) : 1;
}

function obtenerCantidadFavorita(id) {
    const carta = cartasGuardadas.find(c => c.id === id);
    return carta ? cantidadDeCarta(carta) : 0;
}

function obtenerTotalCopiasFavoritas() {
    return cartasGuardadas.reduce((total, carta) => total + cantidadDeCarta(carta), 0);
}

function normalizarCartasGuardadas(datos) {
    if (!Array.isArray(datos)) return [];
    const normalizadas = [];
    for (const carta of datos) {
        if (!carta || typeof carta.id !== 'string' || !/^[a-zA-Z0-9_.-]{3,72}$/.test(carta.id)) continue;
        const cantidad = cantidadDeCarta(carta);
        const existente = normalizadas.find(c => c.id === carta.id);
        if (existente) existente.cantidad += cantidad;
        else normalizadas.push({ ...carta, cantidad });
    }
    // No recortar colecciones antiguas: el límite aplica al generar el PDF,
    // no a la migración de favoritos existentes.
    return normalizadas;
}

function obtenerIdsParaPDF() {
    return cartasGuardadas.flatMap(carta => Array(cantidadDeCarta(carta)).fill(carta.id));
}

function cargarCartasGuardadas() {
    try {
        cartasGuardadas = normalizarCartasGuardadas(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
    } catch (error) {
        console.warn('No se pudieron leer los favoritos anteriores:', error);
        cartasGuardadas = [];
    }
    // Migración transparente: los favoritos antiguos se conservan con cantidad 1.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cartasGuardadas));
    actualizarContadorCartas();
    if (!localStorage.getItem(STORAGE_KEY_DOWNLOADS)) {
        localStorage.setItem(STORAGE_KEY_DOWNLOADS, JSON.stringify({}));
    }
}

function guardarCartasEnStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cartasGuardadas));
    actualizarContadorCartas();
    actualizarVistaFavoritos();
    actualizarBotonesAgregar();
}

function agregarCartaGuardada(carta) {
    if (obtenerTotalCopiasFavoritas() >= LIMITE_PDF) {
        mostrarNotificacion('Máximo de ' + LIMITE_PDF + ' copias por PDF');
        return false;
    }
    const existente = cartasGuardadas.find(c => c.id === carta.id);
    if (existente) existente.cantidad = cantidadDeCarta(existente) + 1;
    else cartasGuardadas.push({ ...carta, cantidad: 1 });
    guardarCartasEnStorage();
    mostrarNotificacion('Copia añadida: ' + obtenerCantidadFavorita(carta.id));
    return true;
}

function cambiarCantidadCarta(cartaId, cambio) {
    const carta = cartasGuardadas.find(c => c.id === cartaId);
    if (!carta || !Number.isInteger(cambio) || cambio === 0) return;
    if (cambio > 0 && obtenerTotalCopiasFavoritas() + cambio > LIMITE_PDF) {
        mostrarNotificacion('Máximo de ' + LIMITE_PDF + ' copias por PDF');
        return;
    }
    const nuevaCantidad = cantidadDeCarta(carta) + cambio;
    if (nuevaCantidad <= 0) {
        eliminarCartaGuardada(cartaId);
        return;
    }
    carta.cantidad = nuevaCantidad;
    guardarCartasEnStorage();
}

function eliminarCartaGuardada(cartaId) {
    cartasGuardadas = cartasGuardadas.filter(c => c.id !== cartaId);
    guardarCartasEnStorage();
    mostrarNotificacion('Carta eliminada de favoritos');
}

function actualizarContadorCartas() {
    const contador = document.getElementById('contador-cartas');
    if (contador) {
        contador.textContent = obtenerTotalCopiasFavoritas();
        contador.title = obtenerTotalCopiasFavoritas() + ' copias en ' + cartasGuardadas.length + ' cartas diferentes';
    }
}

function actualizarBotonesAgregar() {
    document.querySelectorAll('[data-tcg-agregar]').forEach(boton => {
        const cantidad = obtenerCantidadFavorita(boton.dataset.tcgAgregar);
        if (boton.dataset.modo === 'detalle') {
            boton.textContent = cantidad ? '❤️ Añadir otra (' + cantidad + ')' : '🤍 Añadir a favoritos';
        } else {
            boton.textContent = cantidad ? '❤️ ' + cantidad + ' +' : '🤍 +';
        }
        boton.title = 'Añadir una copia más; ' + cantidad + ' seleccionadas';
        boton.setAttribute('aria-label', boton.title);
        boton.disabled = obtenerTotalCopiasFavoritas() >= LIMITE_PDF;
    });
}

function actualizarVistaFavoritos() {
    const modalGuardadas = document.getElementById('modal-guardadas');
    if (!modalGuardadas) return;
    const grid = modalGuardadas.querySelector('.cards-grid');
    if (!grid) return;
    grid.replaceChildren();
    const titulo = modalGuardadas.querySelector('.titulo-favoritos');
    if (titulo) {
        titulo.textContent = 'Favoritos: ' + obtenerTotalCopiasFavoritas()
            + ' copias de ' + cartasGuardadas.length + ' cartas';
    }
    for (const carta of cartasGuardadas) {
        const elemento = crearElementoCarta(carta, true);
        if (elemento) grid.appendChild(elemento);
    }
    if (!cartasGuardadas.length) {
        const aviso = document.createElement('p');
        aviso.className = 'no-cards';
        aviso.textContent = 'No hay cartas guardadas';
        grid.appendChild(aviso);
    }
    for (const selector of ['.btn-exportar', '.btn-compartir', '.btn-limpiar']) {
        const boton = modalGuardadas.querySelector(selector);
        if (boton) boton.disabled = cartasGuardadas.length === 0;
    }
}

function mostrarNotificacion(mensaje) {
    const notificacion = document.createElement('div');
    notificacion.className = 'notificacion';
    notificacion.textContent = mensaje;
    document.body.appendChild(notificacion);
    
    setTimeout(() => {
        notificacion.classList.add('mostrar');
        setTimeout(() => {
            notificacion.classList.remove('mostrar');
            setTimeout(() => {
                notificacion.remove();
            }, 300);
        }, 2000);
    }, 100);
}

function mostrarCartasGuardadas() {
    // Crear el modal
    const modalCartasGuardadas = document.createElement('div');
    modalCartasGuardadas.className = 'modal';
    modalCartasGuardadas.id = 'modal-guardadas';
    modalCartasGuardadas.style.display = 'block';
    
    const contenido = document.createElement('div');
    contenido.className = 'modal-content';
    
    const cerrar = document.createElement('span');
    cerrar.className = 'close';
    cerrar.innerHTML = '&times;';
    cerrar.onclick = () => {
        modalCartasGuardadas.remove();
        document.removeEventListener('keydown', handleEscapeGuardadas);
    };
    
    const titulo = document.createElement('h2');
    titulo.textContent = 'Favoritos';
    titulo.className = 'titulo-favoritos';
    titulo.title = `Máximo ${PAGINAS_MAXIMAS_PDF} páginas A4 (${LIMITE_PDF} copias)`;
    titulo.style.marginBottom = '20px';
    
    // Crear contenedor para los botones
    const botonesContainer = document.createElement('div');
    botonesContainer.className = 'botones-container';
    
    // Añadir botón de exportar a PDF
    const btnExportar = document.createElement('button');
    btnExportar.className = 'btn-exportar';
    btnExportar.innerHTML = '📥 Exportar a PDF';
    btnExportar.onclick = exportarCartasAPDF;
    
    // Añadir botón de limpiar favoritos
    const btnLimpiar = document.createElement('button');
    btnLimpiar.className = 'btn-limpiar';
    btnLimpiar.innerHTML = '🗑️ Limpiar favoritos';
    btnLimpiar.onclick = limpiarFavoritos;
    
    const btnCompartir = document.createElement('button');
    btnCompartir.className='btn-compartir'; btnCompartir.textContent='🔗 Compartir favoritos';
    btnCompartir.onclick=compartirFavoritos;
    botonesContainer.appendChild(btnCompartir);
    botonesContainer.appendChild(btnExportar);
    botonesContainer.appendChild(btnLimpiar);
    
    const grid = document.createElement('div');
    grid.className = 'cards-grid';
    grid.style.maxHeight = 'calc(90vh - 100px)';
    grid.style.overflowY = 'auto';
    grid.style.padding = '10px';
    
    // La vista se genera después de insertar el modal en el DOM.
    
    contenido.appendChild(cerrar);
    contenido.appendChild(titulo);
    contenido.appendChild(botonesContainer);
    contenido.appendChild(grid);
    modalCartasGuardadas.appendChild(contenido);
    
    modalCartasGuardadas.addEventListener('click', (e) => {
        if (e.target === modalCartasGuardadas) {
            modalCartasGuardadas.remove();
            document.removeEventListener('keydown', handleEscapeGuardadas);
        }
    });
    
    // Agregar funcionalidad de cerrar con Escape
    const handleEscapeGuardadas = (e) => {
        if (e.key === 'Escape') {
            modalCartasGuardadas.remove();
            document.removeEventListener('keydown', handleEscapeGuardadas);
        }
    };
    document.addEventListener('keydown', handleEscapeGuardadas);
    
    document.body.appendChild(modalCartasGuardadas);
    actualizarVistaFavoritos();
}

function marcarCartaComoDescargada(cartaId, fecha) {
    const descargas = JSON.parse(localStorage.getItem(STORAGE_KEY_DOWNLOADS) || '{}');
    if (!descargas[cartaId]) {
        descargas[cartaId] = [];
    }
    descargas[cartaId].push(fecha);
    localStorage.setItem(STORAGE_KEY_DOWNLOADS, JSON.stringify(descargas));
}

function obtenerDescargas(cartaId) {
    const descargas = JSON.parse(localStorage.getItem(STORAGE_KEY_DOWNLOADS) || '{}');
    return descargas[cartaId] || [];
}

// PDF generado por Flask sin subir imágenes desde el navegador
async function exportarCartasAPDF() {
    if (!cartasGuardadas.length) { mostrarNotificacion('Agrega cartas antes de exportar'); return; }
    const idsParaPDF = obtenerIdsParaPDF();
    if (idsParaPDF.length > LIMITE_PDF) {
        mostrarNotificacion('El máximo permitido es '+LIMITE_PDF+' copias por PDF'); return;
    }
    const btn = document.querySelector('.btn-exportar');
    try {
        if (btn) { btn.disabled = true; btn.textContent = 'Preparando PDF…'; }
        const response = await fetch('/api/pdf', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ids: idsParaPDF})
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'HTTP '+response.status);
        }
        const blob = await response.blob();
        if (!blob.size || !blob.type.includes('pdf')) throw new Error('PDF no válido');
        const url = URL.createObjectURL(blob);
        const nombre = 'pokemon_tcg_'+idsParaPDF.length+'_cartas.pdf';
        const old = document.querySelector('#enlace-ultimo-pdf');
        if (old) { URL.revokeObjectURL(old.href); old.remove(); }
        const link = document.createElement('a');
        link.id='enlace-ultimo-pdf'; link.href=url; link.download=nombre;
        link.textContent='📄 Abrir o descargar el último PDF';
        link.className='enlace-pdf'; link.target='_blank'; link.rel='noopener';
        document.querySelector('#modal-guardadas .botones-container')?.after(link);
        const download=document.createElement('a'); download.href=url; download.download=nombre;
        document.body.appendChild(download); download.click(); download.remove();
        const fecha=new Date().toISOString();
        cartasGuardadas.forEach(c => marcarCartaComoDescargada(c.id,fecha));
        mostrarNotificacion('PDF generado: imprime al 100 % de escala');
    } catch(err) { mostrarNotificacion('Error al generar PDF: '+err.message); }
    finally { if(btn) {btn.disabled=false; btn.textContent='📥 Exportar a PDF';} }
}
async function compartirFavoritos() {
    const ids = obtenerIdsParaPDF();
    if (!ids.length) { mostrarNotificacion('No hay cartas para compartir'); return; }
    // IDs repetidos representan las copias y conservan compatibilidad con enlaces anteriores.
    const u = new URL(location.href);
    u.searchParams.set('favoritos', ids.join(','));
    u.hash = '';
    try {
        if (navigator.share) await navigator.share({title: 'Cartas Pokémon', url: u.toString()});
        else if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(u.toString());
            mostrarNotificacion('Enlace copiado con las cantidades');
        } else window.prompt('Copia este enlace:', u.toString());
    } catch (error) {
        if (error.name !== 'AbortError') mostrarNotificacion('No se pudo compartir');
    }
}

async function importarFavoritosDesdeEnlace() {
    const raw = new URLSearchParams(location.search).get('favoritos');
    if (!raw) return;
    const ids = raw.split(',')
        .filter(id => /^[a-zA-Z0-9_.-]{3,72}$/.test(id))
        .slice(0, LIMITE_PDF);
    const espacio = Math.max(0, LIMITE_PDF - obtenerTotalCopiasFavoritas());
    const cantidades = new Map();
    for (const id of ids.slice(0, espacio)) {
        cantidades.set(id, (cantidades.get(id) || 0) + 1);
    }
    let total = 0;
    const pendientes = [];
    for (const [id, cantidad] of cantidades) {
        const existente = cartasGuardadas.find(c => c.id === id);
        if (existente) {
            existente.cantidad = cantidadDeCarta(existente) + cantidad;
            total += cantidad;
        } else pendientes.push({id, cantidad});
    }
    for (let i = 0; i < pendientes.length; i += 5) {
        const lote = pendientes.slice(i, i + 5);
        const cartas = await Promise.all(lote.map(({id}) =>
            fetchAPI('cards/' + encodeURIComponent(id)).catch(() => null)));
        cartas.forEach((carta, index) => {
            if (carta?.id === lote[index].id) {
                cartasGuardadas.push({ ...carta, cantidad: lote[index].cantidad });
                total += lote[index].cantidad;
            }
        });
    }
    if (total) {
        guardarCartasEnStorage();
        mostrarNotificacion(total + ' copias importadas a favoritos');
    }
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    inicializarApp();
    cargarCartasGuardadas();
    importarFavoritosDesdeEnlace();
    
    // Crear botón de cartas guardadas
    const header = document.querySelector('header');
    const btnGuardadas = document.createElement('button');
    btnGuardadas.className = 'btn-guardadas';
    btnGuardadas.innerHTML = `
        <span class="icono-guardadas">❤️</span>
        <span id="contador-cartas">0</span>
    `;
    btnGuardadas.onclick = mostrarCartasGuardadas;

    // Crear botón de histórico
    const btnHistorico = document.createElement('button');
    btnHistorico.className = 'btn-historico';
    btnHistorico.innerHTML = `
        <span class="icono-historico">📥</span>
        <span>Histórico</span>
    `;
    btnHistorico.onclick = mostrarHistorico;

    // Crear contenedor para los botones
    const botonesContainer = document.createElement('div');
    botonesContainer.className = 'botones-header';
    botonesContainer.appendChild(btnHistorico);
    botonesContainer.appendChild(btnGuardadas);
    
    header.appendChild(botonesContainer);
    // El contador se crea después de cargar localStorage; reflejar las copias ahora.
    actualizarContadorCartas();
    actualizarBotonesAgregar();
});

function inicializarApp() {
    // Configurar los filtros en el orden deseado
    configurarFiltroNombre();
    configurarFiltroCategoria();
    configurarFiltroTipo();
    configurarFiltroEnergiaAtaque();
    configurarFiltroAtaque();
    configurarFiltroHabilidad();
    configurarBuscadorExpansiones();
    
    // Ocultar el spinner de cartas al inicio
    loadingCartas.style.display = 'none';
    
    // Cargar las expansiones
    cargarExpansiones();
    
    // Cargar los tipos de Pokémon
    cargarTipos();
    
    // Cargar las categorías
    cargarCategorias();
    
    // Configurar eventos
    btnAnterior.addEventListener('click', irPaginaAnterior);
    btnSiguiente.addEventListener('click', irPaginaSiguiente);
    closeModal.addEventListener('click', cerrarModal);
    
    // Configurar evento para el filtro de tipo
    filtroTipo.addEventListener('change', async () => {
        tipoSeleccionado = filtroTipo.value;
        await aplicarFiltros();
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            cerrarModal();
        }
    });
}

// Configurar el filtro de nombre
function configurarFiltroNombre() {
    const filtroContainer = document.querySelector('.filtro-container');
    
    // Limpiar el contenedor de filtros
    filtroContainer.innerHTML = '';
    
    // Crear label para el filtro de nombre
    const labelNombre = document.createElement('label');
    labelNombre.className = 'filtro-label';
    labelNombre.textContent = 'Nombre:';
    
    // Configurar el input de búsqueda
    filtroNombre.type = 'text';
    filtroNombre.className = 'filtro-input';
    filtroNombre.placeholder = 'Buscar por nombre...';
    
    // Eliminar búsqueda automática - solo buscar con Enter o botón

    // Agregar evento de Enter en el input
    filtroNombre.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            nombreBuscado = filtroNombre.value.trim();
            await aplicarFiltros();
        }
    });
    
    filtroContainer.appendChild(labelNombre);
    filtroContainer.appendChild(filtroNombre);
}

// Configurar el filtro de categoría
function configurarFiltroCategoria() {
    const filtroContainer = document.querySelector('.filtro-container');
    
    // Crear label para el filtro de categoría
    const labelCategoria = document.createElement('label');
    labelCategoria.className = 'filtro-label';
    labelCategoria.textContent = 'Categoría:';
    
    // Configurar el select de categoría
    filtroCategoria.className = 'filtro-select';
    filtroCategoria.id = 'filtro-categoria';
    
    // Agregar opción por defecto
    const optionDefault = document.createElement('option');
    optionDefault.value = 'todas';
    optionDefault.textContent = 'Todas las categorías';
    filtroCategoria.appendChild(optionDefault);
    
    // Agregar evento de cambio
    filtroCategoria.addEventListener('change', async () => {
        categoriaSeleccionada = filtroCategoria.value;
        await aplicarFiltros();
    });
    
    // Insertar después del filtro de nombre
    filtroContainer.appendChild(labelCategoria);
    filtroContainer.appendChild(filtroCategoria);
}

// Configurar el filtro de tipo
function configurarFiltroTipo() {
    const filtroContainer = document.querySelector('.filtro-container');
    
    const labelTipo = document.createElement('label');
    labelTipo.className = 'filtro-label';
    labelTipo.htmlFor = 'filtro-tipo';
    labelTipo.textContent = 'Tipo:';
    
    filtroContainer.appendChild(labelTipo);
    filtroContainer.appendChild(filtroTipo);
}

// El endpoint /cards devuelve resúmenes sin ataques. La API devuelve []
// al usar attacks.cost=Incolora pese a existir cartas cuyo detalle tiene ese coste.
// Se descargan los detalles reales para evitar falsos negativos.
const OPCIONES_ENERGIA = [
    ['Grass','🌿 Planta'],['Fire','🔥 Fuego'],['Water','💧 Agua'],
    ['Lightning','⚡ Rayo'],['Psychic','🔮 Psíquica'],['Fighting','🥊 Lucha'],
    ['Darkness','🌑 Oscura'],['Metal','⚙️ Metálica'],['Fairy','🧚 Hada'],
    ['Colorless','⚪ Incolora']
];

function normalizarEnergiaCosto(energia) {
    const clave = String(energia || '').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const nombres = {
        grass:'Grass', planta:'Grass', fire:'Fire', fuego:'Fire',
        water:'Water', agua:'Water', lightning:'Lightning', rayo:'Lightning',
        electrica:'Lightning', electrico:'Lightning',
        psychic:'Psychic', psiquico:'Psychic', psiquica:'Psychic',
        fighting:'Fighting', lucha:'Fighting',
        darkness:'Darkness', oscura:'Darkness', oscuro:'Darkness',
        metal:'Metal', metalica:'Metal', metalico:'Metal',
        fairy:'Fairy', hada:'Fairy', colorless:'Colorless',
        incolora:'Colorless', incoloro:'Colorless'
    };
    return nombres[clave] || null;
}

function energiaDeAtaques(carta) {
    const energias = new Set();
    for (const ataque of (Array.isArray(carta?.attacks) ? carta.attacks : [])) {
        for (const costo of (Array.isArray(ataque?.cost) ? ataque.cost : [])) {
            const tipo = normalizarEnergiaCosto(costo);
            if (tipo) energias.add(tipo);
        }
    }
    return energias;
}

function coincideEnergia(carta, seleccionadas = energiasSeleccionadas, modo = criterioEnergias) {
    if (seleccionadas.size === 0) return true;
    const disponibles = energiaDeAtaques(carta);
    return modo === 'todas'
        ? [...seleccionadas].every(tipo => disponibles.has(tipo))
        : [...seleccionadas].some(tipo => disponibles.has(tipo));
}

function coincideTextoCarta(carta, texto) {
    const campos = [
        carta.name, carta.description, carta.rarity, carta.category,
        carta.set?.name, ...(Array.isArray(carta.types) ? carta.types : []),
        ...(Array.isArray(carta.attacks) ? carta.attacks.flatMap(a =>
            [a.name,a.effect,a.description]) : []),
        ...(Array.isArray(carta.abilities) ? carta.abilities.flatMap(a =>
            [a.name,a.effect]) : [])
    ];
    return campos.some(valor => String(valor || '').toLocaleLowerCase('es')
        .includes(texto.toLocaleLowerCase('es')));
}

// Índice generado por GitHub Actions. Se carga una vez por sesión para evitar
// cientos de solicitudes repetidas a TCGdex. El coste de las cartas todavía
// no indexadas se consulta bajo demanda con concurrencia limitada.
let promesaIndiceEnergia = null;
let indiceCartasActivo = null;

// No usar URLs construidas a partir del ID. Las imágenes de TCGdex son
// opcionales y su ruta oficial figura en el campo image del catálogo.
function baseImagenCarta(carta) {
    const id = carta?.id;
    if (!id) return null;
    const origen = carta.image
        || indiceCartasActivo?.catalog?.[id]?.image
        || indiceCartasActivo?.cards?.[id]?.image;
    if (typeof origen !== 'string'
        || !origen.startsWith('https://assets.tcgdex.net/')) return null;
    return origen;
}

function urlImagenCarta(carta, calidad = 'low') {
    const base = baseImagenCarta(carta);
    if (!base) return null;
    return /\.(?:png|jpg|webp)$/i.test(base)
        ? base : base.replace(/\/$/, '') + '/' + calidad + '.webp';
}

function normalizarTextoIndice(valor) {
    return String(valor || '').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()
        .replace(/\s+/g, ' ');
}

function mostrarEstadoBusqueda(texto, esAdvertencia = false) {
    const elemento = document.getElementById('estado-busqueda');
    if (!elemento) return;
    elemento.textContent = texto || '';
    elemento.className = esAdvertencia ? 'estado-busqueda advertencia' : 'estado-busqueda';
    elemento.style.display = texto ? 'block' : 'none';
}

async function cargarIndiceEnergia() {
    if (!promesaIndiceEnergia) {
        promesaIndiceEnergia = (async () => {
            try {
                if (typeof fetch !== 'function') throw new Error('fetch no disponible');
                const response = await fetch('/data/energy-index.json', {cache: 'no-store'});
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const indice = await response.json();
                if (![1, 2].includes(indice?.schemaVersion)
                    || indice.language !== 'es'
                    || !indice.cards || typeof indice.cards !== 'object'
                    || Array.isArray(indice.cards)) {
                    throw new Error('Índice incompatible');
                }
                indiceCartasActivo = indice;
                return indice;
            } catch (error) {
                console.warn('Índice no disponible; búsqueda limitada a TCGdex:', error);
                indiceCartasActivo = null;
                return {cards: {}, catalog: {}, indexedCount: 0,
                    searchIndexedCount: 0, catalogSize: 0, complete: false};
            }
        })();
    }
    const indice = await promesaIndiceEnergia;
    const estado = document.getElementById('energia-indice-estado');
    if (estado) {
        const total = Number(indice.catalogSize) || 0;
        const energias = Number(indice.indexedCount) || 0;
        const texto = Number(indice.searchIndexedCount) || 0;
        estado.textContent = total
            ? 'Índice: ' + energias.toLocaleString('es-PE') + '/'
                + total.toLocaleString('es-PE') + ' energías · '
                + texto.toLocaleString('es-PE') + ' textos completos'
            : 'Índice en preparación; búsqueda por detalles temporal';
    }
    return indice;
}

function coincideEnergiaIndexada(costos, seleccion, modo) {
    if (!Array.isArray(costos)) return false;
    const tipos = new Set(costos);
    return modo === 'todas'
        ? [...seleccion].every(e => tipos.has(e))
        : [...seleccion].some(e => tipos.has(e));
}

async function resolverDetallesEnergia(resumenes, version, seleccion, modo, textoGeneral) {
    const indice = await cargarIndiceEnergia();
    if (version !== versionBusqueda) return null;
    const aceptadas = new Map();
    const pendientes = [];

    for (const resumen of resumenes) {
        const detalles = cacheDetallesEnergia.get(resumen.id);
        if (detalles) {
            if (coincideEnergia(detalles, seleccion, modo)
                && (!textoGeneral || coincideTextoCarta(detalles, textoGeneral))) {
                aceptadas.set(resumen.id, detalles);
            }
            continue;
        }
        if (Object.prototype.hasOwnProperty.call(indice.cards, resumen.id)
            && Array.isArray(indice.cards[resumen.id])) {
            if (!coincideEnergiaIndexada(indice.cards[resumen.id], seleccion, modo)) {
                continue;
            }
            if (!textoGeneral) {
                aceptadas.set(resumen.id, resumen);
                continue;
            }
        }
        // No indexada, o necesita el detalle de ataques para buscar texto general.
        pendientes.push(resumen);
    }

    // La protección solo se aplica a las solicitudes que FALTAN del índice.
    // No existe límite de 400 candidatos cuando ya están indexados.
    // Evita disparar miles de consultas concurrentes durante la carga inicial.
    const LIMITE_PENDIENTES_TEMPORAL = 1000;
    if (pendientes.length > LIMITE_PENDIENTES_TEMPORAL) {
        const disponibles = Number(indice.indexedCount) || 0;
        const total = Number(indice.catalogSize) || 0;
        throw new Error('El índice de energías aún se está construyendo (' + disponibles
            + '/' + total + ' cartas). Esta búsqueda tiene ' + pendientes.length
            + ' cartas sin datos suficientes; por ahora selecciona una expansión '
            + 'o acota por nombre para evitar sobrecargar TCGdex. '
            + 'El límite de 400 candidatas ya no se aplica a cartas indexadas.');
    }

    let completadas = 0;
    for (let i = 0; i < pendientes.length; i += CONCURRENCIA_ENERGIA) {
        if (version !== versionBusqueda) return null;
        const lote = pendientes.slice(i, i + CONCURRENCIA_ENERGIA);
        const detalles = await Promise.all(lote.map(async resumen => {
            if (cacheDetallesEnergia.has(resumen.id)) return cacheDetallesEnergia.get(resumen.id);
            const completo = await fetchAPI('cards/' + encodeURIComponent(resumen.id));
            if (!completo || completo.id !== resumen.id) {
                throw new Error('No se pudo verificar el coste de ' + resumen.id);
            }
            cacheDetallesEnergia.set(resumen.id, completo);
            if (cacheDetallesEnergia.size > 800) {
                cacheDetallesEnergia.delete(cacheDetallesEnergia.keys().next().value);
            }
            return completo;
        }));
        for (const carta of detalles) {
            if (coincideEnergia(carta, seleccion, modo)
                && (!textoGeneral || coincideTextoCarta(carta, textoGeneral))) {
                aceptadas.set(carta.id, carta);
            }
        }
        completadas += lote.length;
        if (version !== versionBusqueda) return null;
        if (pendientes.length > 0) {
            loadingCartas.textContent = 'Verificando ' + completadas + ' / '
                + pendientes.length + ' cartas que faltan en el índice…';
        }
    }
    // Mantener el orden del listado original.
    return resumenes.filter(r => aceptadas.has(r.id)).map(r => aceptadas.get(r.id));
}

function configurarFiltroEnergiaAtaque() {
    const panel = document.createElement('fieldset');
    panel.className = 'energia-filtro';
    panel.id = 'filtro-energia-ataque';
    const legend = document.createElement('legend');
    legend.textContent = 'Energía requerida en ataques (elige varias)';
    panel.appendChild(legend);

    const opciones = document.createElement('div');
    opciones.className = 'energia-chips';
    for (const [tipo, nombre] of OPCIONES_ENERGIA) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.textContent = nombre;
        boton.className = 'energia-chip';
        boton.dataset.energia = tipo;
        boton.setAttribute('aria-pressed', 'false');
        boton.addEventListener('click', async () => {
            if (energiasSeleccionadas.has(tipo)) energiasSeleccionadas.delete(tipo);
            else energiasSeleccionadas.add(tipo);
            boton.classList.toggle('seleccionada', energiasSeleccionadas.has(tipo));
            boton.setAttribute('aria-pressed', String(energiasSeleccionadas.has(tipo)));
            await aplicarFiltros();
        });
        opciones.appendChild(boton);
    }
    panel.appendChild(opciones);

    const fila = document.createElement('div');
    fila.className = 'energia-combinacion';
    const label = document.createElement('label');
    label.htmlFor = 'energia-coincidencia';
    label.textContent = 'Combinar energías:';
    const select = document.createElement('select');
    select.id = 'energia-coincidencia';
    select.className = 'filtro-select';
    for (const [valor, descripcion] of [
        ['cualquiera','Cualquiera (Agua o Fuego)'],
        ['todas','Todas (Agua y Fuego)']
    ]) {
        const option = document.createElement('option');
        option.value = valor;
        option.textContent = descripcion;
        select.appendChild(option);
    }
    select.value = criterioEnergias;
    select.addEventListener('change', async () => {
        criterioEnergias = select.value;
        await aplicarFiltros();
    });
    fila.append(label,select);
    panel.appendChild(fila);

    const aviso = document.createElement('p');
    aviso.className = 'energia-ayuda';
    aviso.textContent = 'Se revisan las energías de los ataques, no el tipo del Pokémon. '
      + '«Todas» exige esas energías en uno o varios ataques.';
    panel.appendChild(aviso);
    const estado = document.createElement('p');
    estado.id = 'energia-indice-estado';
    estado.className = 'energia-indice-estado';
    estado.textContent = 'Cargando índice de energías…';
    panel.appendChild(estado);
    document.querySelector('.filtro-container').appendChild(panel);
    cargarIndiceEnergia();
}

// Configurar el filtro de texto de ataque
function configurarFiltroAtaque() {
    const filtroContainer = document.querySelector('.filtro-container');

    const labelAtaque = document.createElement('label');
    labelAtaque.className = 'filtro-label';
    labelAtaque.textContent = 'Búsqueda General:';

    filtroAtaqueTexto.type = 'text';
    filtroAtaqueTexto.className = 'filtro-input';
    filtroAtaqueTexto.placeholder = 'Buscar en toda la carta...';

    // Crear contenedor para el input y botón
    const busquedaContainer = document.createElement('div');
    busquedaContainer.className = 'busqueda-container';
    busquedaContainer.style.display = 'flex';
    busquedaContainer.style.gap = '5px';

    // Crear botón de búsqueda
    const btnBuscar = document.createElement('button');
    btnBuscar.className = 'btn-buscar';
    btnBuscar.textContent = '🔍 Buscar';
    btnBuscar.type = 'button';
    btnBuscar.onclick = async () => {
        await aplicarFiltros();
    };

    // Eliminar búsqueda automática - solo buscar con Enter o botón

    // Agregar evento de Enter en el input
    filtroAtaqueTexto.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            await aplicarFiltros();
        }
    });

    busquedaContainer.appendChild(filtroAtaqueTexto);
    busquedaContainer.appendChild(btnBuscar);

    filtroContainer.appendChild(labelAtaque);
    filtroContainer.appendChild(busquedaContainer);
}

// Configurar el checkbox de habilidad
function configurarFiltroHabilidad() {
    const filtroContainer = document.querySelector('.filtro-container');
    
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'checkbox-container';

    const checkboxHabilidad = document.createElement('input');
    checkboxHabilidad.type = 'checkbox';
    checkboxHabilidad.id = 'filtro-habilidad';
    checkboxHabilidad.className = 'filtro-checkbox';

    const labelHabilidad = document.createElement('label');
    labelHabilidad.htmlFor = 'filtro-habilidad';
    labelHabilidad.className = 'checkbox-label';
    labelHabilidad.textContent = 'Solo Pokémon con habilidad';

    checkboxContainer.appendChild(checkboxHabilidad);
    checkboxContainer.appendChild(labelHabilidad);
    filtroContainer.appendChild(checkboxContainer);

    // Agregar evento al checkbox
    checkboxHabilidad.addEventListener('change', async () => {
        await aplicarFiltros();
    });
}

// Configurar el buscador de expansiones
function configurarBuscadorExpansiones() {
    if (!buscadorExpansiones) return;
    
    buscadorExpansiones.addEventListener('input', () => {
        filtrarExpansiones();
    });
}

// Filtrar expansiones por nombre
function filtrarExpansiones() {
    const terminoBusqueda = buscadorExpansiones.value.toLowerCase().trim();
    const elementosExpansiones = document.querySelectorAll('#lista-expansiones li');
    
    elementosExpansiones.forEach(elemento => {
        const nombreExpansion = elemento.textContent.toLowerCase();
        if (nombreExpansion.includes(terminoBusqueda)) {
            elemento.style.display = 'block';
        } else {
            elemento.style.display = 'none';
        }
    });
}

// Aplicar todos los filtros
async function aplicarFiltros() {
    const version = ++versionBusqueda;
    const seleccion = new Set(energiasSeleccionadas);
    const modoEnergias = criterioEnergias;
    paginaActual = 1;
    loadingCartas.style.display = 'block';
    loadingCartas.textContent = 'Cargando cartas…';
    cartasContainer.innerHTML = '';
    try {
        let endpoint = 'cards?';
        let filtros = [];
        
        // Filtros básicos de la API
        if (expansionSeleccionada) filtros.push(`set.id=eq:${expansionSeleccionada.id}`);
        if (tipoSeleccionado !== 'todos') filtros.push(`types=${tipoSeleccionado}`);
        if (categoriaSeleccionada !== 'todas') filtros.push(`category=${categoriaSeleccionada}`);
        
        // Filtro de nombre usando el parámetro name de la API
        nombreBuscado = filtroNombre.value.trim();
        // Al usar Búsqueda General, no añadir filtro por nombre a la API.
        
        // Filtro de habilidad usando el parámetro abilities de la API
        const checkboxHabilidad = document.getElementById('filtro-habilidad');
        if (checkboxHabilidad && checkboxHabilidad.checked) {
            filtros.push('abilities=notnull:');
        }
        
        // Filtro de texto general (busca en toda la carta)
        const textoGeneral = filtroAtaqueTexto.value.trim();
        
        // Si hay texto general, no usar filtros de API para nombre (lo haremos manualmente)
        if (textoGeneral) {
            // No agregar filtro de nombre aquí, lo haremos en la búsqueda manual
        } else {
            // Solo usar filtro de nombre de la API si no hay texto general
            if (nombreBuscado) filtros.push(`name=like:${nombreBuscado}`);
        }
        
        endpoint += filtros.join('&');
        let cartasFiltro = await fetchAPI(endpoint);
        if (version !== versionBusqueda) return;
        if (seleccion.size) {
            if (!Array.isArray(cartasFiltro)) throw new Error('Respuesta de catálogo inválida');
            // El índice permite filtrar miles de cartas sin nuevas llamadas a la API.
            // Solo las no indexadas se revisan individualmente.
            const detalles = await resolverDetallesEnergia(
                cartasFiltro, version, seleccion, modoEnergias, textoGeneral);
            if (!detalles || version !== versionBusqueda) return;
            cartasFiltro = detalles;
        }

        // Si hay texto general sin energía, conservar la búsqueda completa original

        if (textoGeneral && !seleccion.size) {
            // Obtener detalles completos de las cartas para buscar en todos los campos
            let cartasConDetalles = [];
            
            if (cartasFiltro && cartasFiltro.length > 0) {
                // Obtener detalles completos de las cartas encontradas
                cartasConDetalles = await Promise.all(
                    cartasFiltro.map(async carta => {
                        try {
                            return await fetchAPI(`cards/${carta.id}`);
                        } catch (error) {
                            console.warn(`Error al obtener detalles de la carta ${carta.id}:`, error);
                            return carta; // Usar datos básicos si falla
                        }
                    })
                );
            } else {
                // Si no hay resultados iniciales, hacer búsqueda amplia
                const endpointAmplio = 'cards?';
                const filtrosAmplios = [];
                if (expansionSeleccionada) filtrosAmplios.push(`set.id=eq:${expansionSeleccionada.id}`);
                if (tipoSeleccionado !== 'todos') filtrosAmplios.push(`types=${tipoSeleccionado}`);
                if (categoriaSeleccionada !== 'todas') filtrosAmplios.push(`category=${categoriaSeleccionada}`);
                if (checkboxHabilidad && checkboxHabilidad.checked) {
                    filtrosAmplios.push('abilities=notnull:');
                }
                
                const endpointFinal = endpointAmplio + filtrosAmplios.join('&');
                const cartasAmplias = await fetchAPI(endpointFinal);
                
                if (cartasAmplias && cartasAmplias.length > 0) {
                    // Obtener detalles completos de un subconjunto de cartas para búsqueda
                    const limiteBusqueda = Math.min(100, cartasAmplias.length); // Limitar para evitar demasiadas llamadas
                    const cartasParaBuscar = cartasAmplias.slice(0, limiteBusqueda);
                    
                    cartasConDetalles = await Promise.all(
                        cartasParaBuscar.map(async carta => {
                            try {
                                return await fetchAPI(`cards/${carta.id}`);
                            } catch (error) {
                                console.warn(`Error al obtener detalles de la carta ${carta.id}:`, error);
                                return carta; // Usar datos básicos si falla
                            }
                        })
                    );
                }
            }
            
            // Filtrar por texto general en todos los campos
            if (cartasConDetalles && cartasConDetalles.length > 0) {
                const textoLower = textoGeneral.toLowerCase();
                cartasFiltro = cartasConDetalles.filter(carta => {
                    if (!carta) return false;
                    
                    // Buscar en nombre
                    if (carta.name && carta.name.toLowerCase().includes(textoLower)) return true;
                    
                    // Buscar en descripción
                    if (carta.description && carta.description.toLowerCase().includes(textoLower)) return true;
                    
                    // Buscar en rareza
                    if (carta.rarity && carta.rarity.toLowerCase().includes(textoLower)) return true;
                    
                    // Buscar en categoría
                    if (carta.category && carta.category.toLowerCase().includes(textoLower)) return true;
                    
                    // Buscar en tipos
                    if (carta.types && carta.types.some(tipo => tipo.toLowerCase().includes(textoLower))) return true;
                    
                    // Buscar en nombre de la expansión
                    if (carta.set && carta.set.name && carta.set.name.toLowerCase().includes(textoLower)) return true;
                    
                    // Buscar en ataques (nombre, efecto y descripción)
                    if (carta.attacks && carta.attacks.some(atk => {
                        return (atk.name && atk.name.toLowerCase().includes(textoLower)) ||
                               (atk.effect && atk.effect.toLowerCase().includes(textoLower)) ||
                               (atk.description && atk.description.toLowerCase().includes(textoLower));
                    })) return true;
                    
                    // Buscar en habilidades (nombre y efecto)
                    if (carta.abilities && carta.abilities.some(hab => {
                        return (hab.name && hab.name.toLowerCase().includes(textoLower)) ||
                               (hab.effect && hab.effect.toLowerCase().includes(textoLower));
                    })) return true;
                    
                    return false;
                });
            }
        }
        
        if (version !== versionBusqueda) return;
        if (cartasFiltro && cartasFiltro.length > 0) {
            cartasFiltradas = cartasFiltro;
            if (cartasFiltradas.length > 0) {
                mostrarCartas(cartasFiltradas);
                document.getElementById('paginacion').style.display = 'flex';
                actualizarExpansionesDisponibles(cartasFiltradas);
            } else {
                cartasContainer.innerHTML = '<p class="no-cards">No se encontraron cartas con los filtros seleccionados.</p>';
                document.getElementById('paginacion').style.display = 'none';
            }
        } else {
            cartasContainer.innerHTML = '<p class="no-cards">No se encontraron cartas con los filtros seleccionados.</p>';
            document.getElementById('paginacion').style.display = 'none';
            if (filtros.length > 0) {
                 actualizarExpansionesDisponibles([]);
            } else {
                 mostrarExpansiones(expansiones);
            }
        }
    } catch (error) {
        if (version === versionBusqueda) {
            cartasContainer.textContent = 'Error al filtrar las cartas: ' + error.message;
            document.getElementById('paginacion').style.display = 'none';
        }
    } finally {
        if (version === versionBusqueda) {
            loadingCartas.style.display = 'none';
            loadingCartas.textContent = 'Cargando…';
        }
    }
}

// Actualizar las expansiones disponibles según los resultados
function actualizarExpansionesDisponibles(cartas) {
    if (!nombreBuscado && !tipoSeleccionado && !categoriaSeleccionada) {
        // Si no hay filtros activos, mostrar todas las expansiones
        mostrarExpansiones(expansiones);
        return;
    }
    
    // Obtener las expansiones únicas de las cartas encontradas
    const expansionesConResultados = new Set();
    cartas.forEach(carta => {
        const setId = carta.id.split('-')[0];
        expansionesConResultados.add(setId);
    });
    
    // Marcar visualmente las expansiones que tienen resultados
    document.querySelectorAll('#lista-expansiones li').forEach(li => {
        if (expansionesConResultados.has(li.dataset.id)) {
            li.classList.add('has-results');
        } else {
            li.classList.remove('has-results');
            li.classList.remove('active');
        }
    });
}

// Mostrar las expansiones en la interfaz
function mostrarExpansiones(expansiones) {
    listaExpansiones.innerHTML = '';
    
    // Agregar opción "Todas las expansiones"
    const liTodas = document.createElement('li');
    liTodas.textContent = 'Todas las expansiones';
    liTodas.dataset.id = 'todas';
    liTodas.addEventListener('click', () => {
        expansionSeleccionada = null;
        document.querySelectorAll('#lista-expansiones li').forEach(li => li.classList.remove('active'));
        liTodas.classList.add('active');
        tituloExpansion.textContent = 'Todas las expansiones';
        aplicarFiltros();
    });
    listaExpansiones.appendChild(liTodas);
    
    // Agregar el resto de expansiones
    expansiones.forEach(expansion => {
        const li = document.createElement('li');
        li.textContent = expansion.name;
        li.dataset.id = expansion.id;
        
        li.addEventListener('click', () => seleccionarExpansion(expansion));
        
        listaExpansiones.appendChild(li);
    });
}

// Seleccionar una expansión
function seleccionarExpansion(expansion) {
    expansionSeleccionada = expansion;
    
    // Actualizar la UI
    document.querySelectorAll('#lista-expansiones li').forEach(li => {
        li.classList.remove('active');
        if (li.dataset.id === expansion.id) {
            li.classList.add('active');
        }
    });
    
    // Actualizar el título
    tituloExpansion.textContent = expansion.name;
    
    // Aplicar los filtros con la nueva expansión seleccionada
    aplicarFiltros();
}

// Cargar las expansiones
async function cargarExpansiones() {
    try {
        // Usar el endpoint con ordenamiento por fecha de lanzamiento descendente
        const todasExpansiones = await fetchAPI('sets?sort:field=releaseDate&sort:order=DESC');
        
        if (!todasExpansiones || todasExpansiones.length === 0) {
            throw new Error('No se pudieron cargar las expansiones');
        }
        
        // Guardar las expansiones ya ordenadas
        expansiones = todasExpansiones;
        
        // Mostrar las expansiones en la interfaz
        mostrarExpansiones(expansiones);
    } catch (error) {
        mostrarError('Error al cargar las expansiones: ' + error.message);
    } finally {
        loadingExpansiones.style.display = 'none';
    }
}

// Mostrar las cartas en la interfaz
function mostrarCartas(cartas) {
    cartasContainer.innerHTML = '';
    
    // Mostrar todas las cartas tal cual, sin agrupar
    const cartasParaMostrar = cartas;
    
    // Si no hay cartas, mostrar mensaje
    if (cartasParaMostrar.length === 0) {
        cartasContainer.innerHTML = '<p class="no-cards">No se encontraron cartas para los filtros seleccionados</p>';
        document.getElementById('paginacion').style.display = 'none';
        return;
    }
    
    // Calcular el rango de cartas a mostrar según la paginación
    const inicio = (paginaActual - 1) * cartasPorPagina;
    const fin = Math.min(inicio + cartasPorPagina, cartasParaMostrar.length);
    
    // Actualizar botones de paginación
    actualizarPaginacion(cartasParaMostrar.length);
    
    // Mostrar las cartas de la página actual
    for (let i = inicio; i < fin; i++) {
        const carta = cartasParaMostrar[i];
        const cardElement = crearElementoCarta(carta);
        if (cardElement) {
            cartasContainer.appendChild(cardElement);
        }
    }
}

// Crear elemento HTML para una carta
function crearElementoCarta(carta, esGuardada = false) {
    // Intentar generar URL directamente desde el ID
    const directUrl = generateCardImageUrl(carta.id);

    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';

    // Añadir indicador de descarga si la carta ha sido descargada
    const descargas = obtenerDescargas(carta.id);
    if (descargas.length > 0) {
        const descargaIndicador = document.createElement('div');
        descargaIndicador.className = 'descarga-indicador';
        
        // Crear tooltip con todas las descargas
        const fechasDescargas = descargas.map((fecha, index) => {
            const fechaObj = new Date(fecha);
            const fechaFormateada = fechaObj.toLocaleString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            return `${index + 1}. ${fechaFormateada}`;
        });
        
        const tooltipText = `📥 Descargada ${descargas.length} ${descargas.length === 1 ? 'vez' : 'veces'}:\n\n${fechasDescargas.join('\n')}`;
        descargaIndicador.title = tooltipText;
        descargaIndicador.innerHTML = '📥';
        cardDiv.appendChild(descargaIndicador);
    }

    // En el catálogo, cada clic en el corazón agrega UNA COPIA.
    // En Favoritos, la X elimina todas las copias de esa carta.
    const btnGuardar = document.createElement('button');
    btnGuardar.className = 'btn-guardar';
    btnGuardar.type = 'button';
    if (esGuardada) {
        btnGuardar.textContent = '✕';
        btnGuardar.title = 'Quitar esta carta y todas sus copias';
        btnGuardar.setAttribute('aria-label', btnGuardar.title);
        btnGuardar.onclick = (evento) => {
            evento.stopPropagation();
            eliminarCartaGuardada(carta.id);
        };
    } else {
        btnGuardar.dataset.tcgAgregar = carta.id;
        btnGuardar.dataset.modo = 'lista';
        const cantidad = obtenerCantidadFavorita(carta.id);
        btnGuardar.textContent = cantidad ? '❤️ ' + cantidad + ' +' : '🤍 +';
        btnGuardar.title = 'Añadir una copia más; ' + cantidad + ' seleccionadas';
        btnGuardar.setAttribute('aria-label', btnGuardar.title);
        btnGuardar.disabled = obtenerTotalCopiasFavoritas() >= LIMITE_PDF;
        btnGuardar.onclick = (evento) => {
            evento.stopPropagation();
            agregarCartaGuardada(carta);
        };
    }

    // Añadir evento para mostrar detalles al hacer clic
    cardDiv.addEventListener('click', () => mostrarDetalleCarta(carta, null, esGuardada));

    const infoDiv = document.createElement('div');
    infoDiv.className = 'card-info';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'card-name';
    nameDiv.textContent = carta.name;

    const numberDiv = document.createElement('div');
    numberDiv.className = 'card-number';
    const setId = carta.id.split('-')[0];
    const expansion = expansiones.find(exp => exp.id === setId);
    numberDiv.textContent = `${expansion ? expansion.name : setId} - ${carta.localId || carta.id.split('-')[1]}`;

    infoDiv.appendChild(nameDiv);
    infoDiv.appendChild(numberDiv);

    if (directUrl) {
        const img = document.createElement('img');
        img.src = directUrl;
        img.alt = carta.name;
        img.loading = 'lazy';
        img.onerror = function() {
            const noImageDiv = document.createElement('div');
            noImageDiv.className = 'no-image';
            noImageDiv.textContent = 'Imagen no disponible';
            cardDiv.replaceChild(noImageDiv, img);
        };
        cardDiv.appendChild(btnGuardar);
        cardDiv.appendChild(img);
    } else {
        const noImageDiv = document.createElement('div');
        noImageDiv.className = 'no-image';
        noImageDiv.textContent = 'Imagen no disponible';
        cardDiv.appendChild(btnGuardar);
        cardDiv.appendChild(noImageDiv);
    }
    cardDiv.appendChild(infoDiv);

    if (esGuardada) {
        const controles = document.createElement('div');
        controles.className = 'cantidad-controles';

        const menos = document.createElement('button');
        menos.type = 'button';
        menos.className = 'cantidad-menos';
        menos.textContent = '−';
        menos.title = 'Quitar una copia';
        menos.setAttribute('aria-label', 'Quitar una copia de ' + carta.name);
        menos.onclick = (evento) => {
            evento.stopPropagation();
            cambiarCantidadCarta(carta.id, -1);
        };

        const cantidad = document.createElement('span');
        cantidad.className = 'cantidad-valor';
        cantidad.textContent = obtenerCantidadFavorita(carta.id) + ' copias';

        const mas = document.createElement('button');
        mas.type = 'button';
        mas.className = 'cantidad-mas';
        mas.textContent = '+';
        mas.title = 'Agregar otra copia';
        mas.setAttribute('aria-label', 'Agregar una copia de ' + carta.name);
        mas.disabled = obtenerTotalCopiasFavoritas() >= LIMITE_PDF;
        mas.onclick = (evento) => {
            evento.stopPropagation();
            cambiarCantidadCarta(carta.id, 1);
        };
        controles.append(menos, cantidad, mas);
        cardDiv.appendChild(controles);
    }
    return cardDiv;
}

// Mostrar detalle de una carta en el modal
async function mostrarDetalleCarta(carta, indice = null, desdeGuardadas = false) {
    // Si se llama desde guardadas, crear un modal específico para el detalle
    const modalDetalle = desdeGuardadas ? document.createElement('div') : modal;
    const detalleDiv = desdeGuardadas ? document.createElement('div') : detalleCartaDiv;
    
    if (desdeGuardadas) {
        modalDetalle.className = 'modal';
        modalDetalle.style.zIndex = '1100'; // Mayor que el modal de guardadas
        detalleDiv.className = 'modal-content';
        modalDetalle.appendChild(detalleDiv);
        document.body.appendChild(modalDetalle);
        
        // Agregar botón de cerrar
        const cerrarDetalle = document.createElement('span');
        cerrarDetalle.className = 'close';
        cerrarDetalle.innerHTML = '&times;';
        cerrarDetalle.onclick = () => modalDetalle.remove();
        detalleDiv.appendChild(cerrarDetalle);
        
        // Cerrar al hacer clic fuera
        modalDetalle.addEventListener('click', (e) => {
            if (e.target === modalDetalle) {
                modalDetalle.remove();
            }
        });
    }
    
    detalleDiv.innerHTML = '<div class="loading-spinner">Cargando detalles...</div>';
    modalDetalle.style.display = 'block';
    
    try {
        // Obtener detalles completos de la carta usando el ID correcto
        const detallesCarta = await fetchAPI(`cards/${carta.id}`);
        
        if (!detallesCarta) {
            throw new Error('No se pudieron cargar los detalles de la carta');
        }
        
        // Obtener la expansión actual
        const setId = carta.id.split('-')[0];
        const expansion = expansiones.find(exp => exp.id === setId);
        
        detalleDiv.innerHTML = '';
        
        // Crear contenedor principal
        const mainContainer = document.createElement('div');
        mainContainer.className = 'card-detail-container';
        
        // Crear contenedor para la imagen principal
        const imageContainer = document.createElement('div');
        imageContainer.className = 'card-detail-image-main';
        
        // Añadir etiqueta de expansión
        if (expansion) {
            const expansionBadge = document.createElement('div');
            expansionBadge.className = 'expansion-badge';
            expansionBadge.textContent = expansion.name;
            imageContainer.appendChild(expansionBadge);
        }
        
        // Intentar generar URL directamente desde el ID
        const directUrl = generateCardImageUrl(detallesCarta.id);
        
        if (directUrl) {
            // Crear la imagen principal
            const img = document.createElement('img');
            img.src = directUrl;
            img.alt = detallesCarta.name;
            
            img.onerror = function() {
                const noImageDiv = document.createElement('div');
                noImageDiv.className = 'no-image-detail';
                noImageDiv.textContent = 'Imagen no disponible';
                imageContainer.replaceChild(noImageDiv, img);
            };
            
            imageContainer.appendChild(img);
            
            // Contenedor para tipos y categoría
            const infoContainer = document.createElement('div');
            infoContainer.className = 'card-info-container';
            
            // Mostrar categoría de la carta si existe
            if (detallesCarta.category) {
                const categoriaContainer = document.createElement('div');
                categoriaContainer.className = 'categoria-container';
                
                const categoriaSpan = document.createElement('span');
                categoriaSpan.className = 'categoria-badge';
                categoriaSpan.textContent = detallesCarta.category;
                categoriaContainer.appendChild(categoriaSpan);
                
                infoContainer.appendChild(categoriaContainer);
            }
            
            // Mostrar tipos de la carta si existen
            if (detallesCarta.types && detallesCarta.types.length > 0) {
                const tiposContainer = document.createElement('div');
                tiposContainer.className = 'tipos-container';
                
                detallesCarta.types.forEach(tipo => {
                    const tipoSpan = document.createElement('span');
                    tipoSpan.className = 'tipo-badge';
                    tipoSpan.textContent = tipo;
                    tiposContainer.appendChild(tipoSpan);
                });
                
                infoContainer.appendChild(tiposContainer);
            }
            
            imageContainer.appendChild(infoContainer);
        }
        
        mainContainer.appendChild(imageContainer);
        
        // Permite agregar varias copias sin cerrar el detalle.
        const btnFavorito = document.createElement('button');
        btnFavorito.className = 'btn-guardar btn-guardar-detalle';
        btnFavorito.type = 'button';
        btnFavorito.dataset.tcgAgregar = detallesCarta.id;
        btnFavorito.dataset.modo = 'detalle';
        const cantidadFavorita = obtenerCantidadFavorita(detallesCarta.id);
        btnFavorito.textContent = cantidadFavorita
            ? '❤️ Añadir otra (' + cantidadFavorita + ')' : '🤍 Añadir a favoritos';
        btnFavorito.disabled = obtenerTotalCopiasFavoritas() >= LIMITE_PDF;
        btnFavorito.onclick = (evento) => {
            evento.stopPropagation();
            agregarCartaGuardada(detallesCarta);
        };
        mainContainer.appendChild(btnFavorito);

        // Añadir el contenedor principal al detalle
        detalleDiv.appendChild(mainContainer);
        
        // Añadir botón de cerrar
        const btnCerrar = document.createElement('button');
        btnCerrar.className = 'btn-cerrar-detalle';
        btnCerrar.innerHTML = '✕ Cerrar';
        btnCerrar.onclick = () => {
            if (desdeGuardadas) {
                modalDetalle.remove();
            } else {
                cerrarModal();
            }
        };
        detalleDiv.appendChild(btnCerrar);
        
        // Agregar funcionalidad de cerrar con Escape
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                if (desdeGuardadas) {
                    modalDetalle.remove();
                } else {
                    cerrarModal();
                }
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Añadir navegación
        const navContainer = document.createElement('div');
        navContainer.className = 'modal-navigation';
        
        // Si estamos en favoritas, usar el índice de las cartas guardadas
        if (desdeGuardadas) {
            indice = cartasGuardadas.findIndex(c => c.id === carta.id);
            const totalCartas = cartasGuardadas.length;
            
            const prevButton = document.createElement('button');
            prevButton.className = 'nav-button prev';
            prevButton.innerHTML = '&#10094;';
            prevButton.disabled = indice <= 0;
            prevButton.addEventListener('click', () => {
                if (indice > 0) {
                    modalDetalle.remove();
                    mostrarDetalleCarta(cartasGuardadas[indice - 1], indice - 1, true);
                }
            });
            
            const nextButton = document.createElement('button');
            nextButton.className = 'nav-button next';
            nextButton.innerHTML = '&#10095;';
            nextButton.disabled = indice >= totalCartas - 1;
            nextButton.addEventListener('click', () => {
                if (indice < totalCartas - 1) {
                    modalDetalle.remove();
                    mostrarDetalleCarta(cartasGuardadas[indice + 1], indice + 1, true);
                }
            });
            
            navContainer.appendChild(prevButton);
            navContainer.appendChild(nextButton);
        } else {
            // Navegación normal para la vista principal
            if (indice === null) {
                indice = cartasFiltradas.findIndex(c => c.id === carta.id);
            }
            
            const prevButton = document.createElement('button');
            prevButton.className = 'nav-button prev';
            prevButton.innerHTML = '&#10094;';
            prevButton.disabled = indice <= 0;
            prevButton.addEventListener('click', () => {
                if (indice > 0) {
                    mostrarDetalleCarta(cartasFiltradas[indice - 1], indice - 1);
                }
            });
            
            const nextButton = document.createElement('button');
            nextButton.className = 'nav-button next';
            nextButton.innerHTML = '&#10095;';
            nextButton.disabled = indice >= cartasFiltradas.length - 1;
            nextButton.addEventListener('click', () => {
                if (indice < cartasFiltradas.length - 1) {
                    mostrarDetalleCarta(cartasFiltradas[indice + 1], indice + 1);
                }
            });
            
            navContainer.appendChild(prevButton);
            navContainer.appendChild(nextButton);
        }
        
        detalleDiv.appendChild(navContainer);
        
    } catch (error) {
        detalleDiv.innerHTML = '<p class="error">Error al cargar los detalles de la carta: ' + error.message + '</p>';
    }
}

// Cerrar el modal
function cerrarModal() {
    modal.style.display = 'none';
    // Limpiar event listeners de Escape
    document.removeEventListener('keydown', handleEscapeModal);
}

// Función para manejar Escape en modales
function handleEscapeModal(e) {
    if (e.key === 'Escape') {
        cerrarModal();
    }
}

// Actualizar la paginación
function actualizarPaginacion(totalCartas) {
    const totalPaginas = Math.ceil(totalCartas / cartasPorPagina);
    
    // Actualizar texto de página actual
    paginaActualSpan.textContent = `Página ${paginaActual} de ${totalPaginas}`;
    
    // Habilitar/deshabilitar botones según corresponda
    btnAnterior.disabled = paginaActual <= 1;
    btnSiguiente.disabled = paginaActual >= totalPaginas;
}

// Ir a la página anterior
function irPaginaAnterior() {
    if (paginaActual > 1) {
        paginaActual--;
        mostrarCartas(cartasFiltradas);
        window.scrollTo(0, 0);
    }
}

// Ir a la página siguiente
function irPaginaSiguiente() {
    const totalPaginas = Math.ceil(cartasFiltradas.length / cartasPorPagina);
    if (paginaActual < totalPaginas) {
        paginaActual++;
        mostrarCartas(cartasFiltradas);
        window.scrollTo(0, 0);
    }
}

// Mostrar mensaje de error
function mostrarError(mensaje) {
    cartasContainer.innerHTML = `<p class="error">${mensaje}</p>`;
}

// Función para realizar peticiones a la API
async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`);
        
        if (!response.ok) {
            throw new Error(`Error en la petición: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}

// Función para formatear URLs de imágenes
function formatImageUrl(baseUrl) {
    if (!baseUrl) return null;
    
    // Si la URL ya tiene extensión, devolverla tal cual
    if (baseUrl.endsWith('.png') || baseUrl.endsWith('.jpg') || baseUrl.endsWith('.webp')) {
        return baseUrl;
    }
    
    // Extraer las partes de la URL
    // Ejemplo: https://assets.tcgdex.net/es/swsh/swsh4/2
    try {
        // Dividir la URL por "/"
        const urlParts = baseUrl.split('/');
        
        // Verificar si la URL tiene suficientes partes
        if (urlParts.length < 4) {
            return baseUrl;
        }
        
        // Obtener el último elemento (ID de la carta o "logo"/"symbol")
        const lastPart = urlParts[urlParts.length - 1];
        
        // Verificar si es una carta o un logo/símbolo
        if (lastPart === 'logo' || lastPart === 'symbol') {
            // Para logos y símbolos: https://assets.tcgdex.net/en/swsh/swsh3/symbol.png
            const formattedUrl = `${baseUrl}.${IMAGEN_EXTENSION}`;
            return formattedUrl;
        } else {
            // Para cartas: https://assets.tcgdex.net/en/swsh/swsh3/136/high.png
            const formattedUrl = `${baseUrl}/${IMAGEN_CALIDAD}.${IMAGEN_EXTENSION}`;
            return formattedUrl;
        }
    } catch (error) {
        return baseUrl;
    }
}

// Función para generar URL de imagen directamente desde los IDs
function generateCardImageUrl(cardId) {
    if (!cardId) return null;
    
    try {
        // Dividir el ID de la carta (ejemplo: swsh4-2)
        let parts = cardId.split('-');
        
        // Si no tiene el formato esperado, intentar otros formatos
        if (parts.length !== 2) {
            // Intentar con formato alternativo (ejemplo: swsh4.5-2)
            const match = cardId.match(/([a-z]+\d+(?:\.\d+)?)-(.+)/i);
            if (match) {
                parts = [match[1], match[2]];
            } else {
                return null;
            }
        }
        
        const setId = parts[0]; // swsh4
        const localId = parts[1]; // 2
        
        // Extraer la serie (ejemplo: swsh4 -> swsh)
        let serieId = setId;
        const serieMatch = setId.match(/([a-z]+)\d*(?:\.\d+)?/i);
        if (serieMatch) {
            serieId = serieMatch[1];
        }
        
        // Construir la URL según la documentación
        // https://assets.tcgdex.net/en/swsh/swsh3/136/high.png
        const url = `https://assets.tcgdex.net/${IDIOMA}/${serieId}/${setId}/${localId}/${IMAGEN_CALIDAD}.${IMAGEN_EXTENSION}`;
        return url;
    } catch (error) {
        return null;
    }
}

// Cargar los tipos de Pokémon
async function cargarTipos() {
    try {
        const tipos = await fetchAPI('types');
        
        // Limpiar opciones existentes excepto "Todos los tipos"
        while (filtroTipo.options.length > 1) {
            filtroTipo.remove(1);
        }
        
        if (tipos && tipos.length > 0) {
            // Ordenar tipos alfabéticamente
            tipos.sort();
            
            // Añadir opciones al select
            tipos.forEach(tipo => {
                const option = document.createElement('option');
                option.value = tipo;
                option.textContent = tipo;
                filtroTipo.appendChild(option);
            });
        } else {
            // Deshabilitar el filtro si no hay tipos
            filtroTipo.disabled = true;
        }
    } catch (error) {
        // Deshabilitar el filtro en caso de error
        filtroTipo.disabled = true;
    }
}

// Cargar las categorías
async function cargarCategorias() {
    try {
        const categorias = await fetchAPI('categories');
        
        // Limpiar opciones existentes excepto "Todas las categorías"
        while (filtroCategoria.options.length > 1) {
            filtroCategoria.remove(1);
        }
        
        if (categorias && categorias.length > 0) {
            // Ordenar categorías alfabéticamente
            categorias.sort();
            
            // Añadir opciones al select
            categorias.forEach(categoria => {
                const option = document.createElement('option');
                option.value = categoria;
                option.textContent = categoria;
                filtroCategoria.appendChild(option);
            });
        } else {
            // Deshabilitar el filtro si no hay categorías
            filtroCategoria.disabled = true;
        }
    } catch (error) {
        // Deshabilitar el filtro en caso de error
        filtroCategoria.disabled = true;
    }
}

function mostrarHistorico() {
    // Crear el modal
    const modalHistorico = document.createElement('div');
    modalHistorico.className = 'modal';
    modalHistorico.id = 'modal-historico';
    modalHistorico.style.display = 'block';
    
    const contenido = document.createElement('div');
    contenido.className = 'modal-content';
    
    const cerrar = document.createElement('span');
    cerrar.className = 'close';
    cerrar.innerHTML = '&times;';
    cerrar.onclick = () => {
        modalHistorico.remove();
        document.removeEventListener('keydown', handleEscapeHistorico);
    };
    
    const titulo = document.createElement('h2');
    titulo.textContent = 'Histórico de Descargas';
    titulo.style.marginBottom = '20px';
    
    // Crear contenedor para los botones
    const botonesContainer = document.createElement('div');
    botonesContainer.className = 'botones-container';
    
    // Añadir botón de eliminar seleccionados
    const btnEliminarSeleccionados = document.createElement('button');
    btnEliminarSeleccionados.className = 'btn-limpiar';
    btnEliminarSeleccionados.innerHTML = '🗑️ Eliminar seleccionados';
    btnEliminarSeleccionados.onclick = eliminarDescargasSeleccionadas;
    
    // Añadir botón de limpiar historial completo
    const btnLimpiarTodo = document.createElement('button');
    btnLimpiarTodo.className = 'btn-limpiar';
    btnLimpiarTodo.innerHTML = '🗑️ Limpiar todo';
    btnLimpiarTodo.onclick = limpiarHistorial;
    
    botonesContainer.appendChild(btnEliminarSeleccionados);
    botonesContainer.appendChild(btnLimpiarTodo);
    
    // Obtener el histórico de descargas
    const descargas = JSON.parse(localStorage.getItem(STORAGE_KEY_DOWNLOADS) || '{}');
    
    // Crear contenedor para la lista
    const listaContainer = document.createElement('div');
    listaContainer.className = 'historico-lista';
    
    if (Object.keys(descargas).length === 0) {
        const mensaje = document.createElement('p');
        mensaje.className = 'no-cards';
        mensaje.textContent = 'No hay descargas registradas';
        listaContainer.appendChild(mensaje);
        btnEliminarSeleccionados.disabled = true;
        btnLimpiarTodo.disabled = true;
    } else {
        // Crear lista de todas las descargas
        const listaDescargas = document.createElement('ul');
        listaDescargas.className = 'lista-descargas';
        
        // Recopilar todas las descargas con información de carta
        const todasDescargas = [];
        Object.entries(descargas).forEach(([cartaId, fechas]) => {
            const carta = cartasGuardadas.find(c => c.id === cartaId);
            fechas.forEach(fecha => {
                todasDescargas.push({
                    cartaId,
                    carta: carta,
                    fecha: fecha,
                    timestamp: new Date(fecha).getTime()
                });
            });
        });
        
        // Ordenar por fecha (más reciente primero)
        todasDescargas.sort((a, b) => b.timestamp - a.timestamp);
        
        todasDescargas.forEach((descarga, index) => {
            const li = document.createElement('li');
            li.className = 'item-descarga';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'checkbox-descarga';
            checkbox.dataset.cartaId = descarga.cartaId;
            checkbox.dataset.fecha = descarga.fecha;
            
            const label = document.createElement('label');
            label.className = 'label-descarga';
            
            const fechaFormateada = new Date(descarga.fecha).toLocaleString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const nombreCarta = descarga.carta ? descarga.carta.name : `Carta ${descarga.cartaId}`;
            
            label.innerHTML = `
                <span class="fecha-descarga">${fechaFormateada}</span>
                <span class="nombre-carta">${nombreCarta}</span>
            `;
            
            li.appendChild(checkbox);
            li.appendChild(label);
            listaDescargas.appendChild(li);
        });
        
        listaContainer.appendChild(listaDescargas);
    }
    
    contenido.appendChild(cerrar);
    contenido.appendChild(titulo);
    contenido.appendChild(botonesContainer);
    contenido.appendChild(listaContainer);
    modalHistorico.appendChild(contenido);
    
    modalHistorico.addEventListener('click', (e) => {
        if (e.target === modalHistorico) {
            modalHistorico.remove();
            document.removeEventListener('keydown', handleEscapeHistorico);
        }
    });
    
    // Agregar funcionalidad de cerrar con Escape
    const handleEscapeHistorico = (e) => {
        if (e.key === 'Escape') {
            modalHistorico.remove();
            document.removeEventListener('keydown', handleEscapeHistorico);
        }
    };
    document.addEventListener('keydown', handleEscapeHistorico);
    
    document.body.appendChild(modalHistorico);
}

// Función para eliminar descargas seleccionadas
function eliminarDescargasSeleccionadas() {
    const checkboxesSeleccionados = document.querySelectorAll('.checkbox-descarga:checked');
    
    if (checkboxesSeleccionados.length === 0) {
        mostrarNotificacion('No hay descargas seleccionadas para eliminar');
        return;
    }
    
    if (confirm(`¿Estás seguro de que deseas eliminar ${checkboxesSeleccionados.length} descarga(s) seleccionada(s)?`)) {
        const descargas = JSON.parse(localStorage.getItem(STORAGE_KEY_DOWNLOADS) || '{}');
        
        checkboxesSeleccionados.forEach(checkbox => {
            const cartaId = checkbox.dataset.cartaId;
            const fecha = checkbox.dataset.fecha;
            
            if (descargas[cartaId]) {
                // Eliminar la fecha específica
                descargas[cartaId] = descargas[cartaId].filter(f => f !== fecha);
                
                // Si no quedan fechas para esta carta, eliminar la entrada completa
                if (descargas[cartaId].length === 0) {
                    delete descargas[cartaId];
                }
            }
        });
        
        localStorage.setItem(STORAGE_KEY_DOWNLOADS, JSON.stringify(descargas));
        mostrarNotificacion(`${checkboxesSeleccionados.length} descarga(s) eliminada(s)`);
        
        // Recargar el modal del historial
        const modalHistorico = document.getElementById('modal-historico');
        if (modalHistorico) {
            modalHistorico.remove();
            mostrarHistorico();
        }
    }
}

// Función para limpiar el historial de descargas
function limpiarHistorial() {
    if (confirm('¿Estás seguro de que deseas eliminar todo el historial de descargas?')) {
        localStorage.setItem(STORAGE_KEY_DOWNLOADS, JSON.stringify({}));
        mostrarNotificacion('Historial de descargas eliminado');
        const modalHistorico = document.getElementById('modal-historico');
        if (modalHistorico) {
            modalHistorico.remove();
            mostrarHistorico();
        }
    }
}

// Función para limpiar las cartas guardadas
function limpiarFavoritos() {
    if (confirm('¿Estás seguro de que deseas eliminar todas las cartas guardadas?')) {
        cartasGuardadas = [];
        guardarCartasEnStorage();
        mostrarNotificacion('Se han eliminado todas las cartas guardadas');
    }
}
