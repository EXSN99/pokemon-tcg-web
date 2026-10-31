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
let categoriaSeleccionada = 'todas';
let nombreBuscado = '';
let paginaActual = 1;
const cartasPorPagina = 48;

// Configuración del servidor local
const SERVER_URL = ''; // backend y frontend en el mismo dominio
const LIMITE_PDF = 54;

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
function cargarCartasGuardadas() {
    const cartasStorage = localStorage.getItem(STORAGE_KEY);
    if (cartasStorage) {
        cartasGuardadas = JSON.parse(cartasStorage);
        actualizarContadorCartas();
    }
    
    // Cargar el registro de descargas
    if (!localStorage.getItem(STORAGE_KEY_DOWNLOADS)) {
        localStorage.setItem(STORAGE_KEY_DOWNLOADS, JSON.stringify({}));
    }
}

function guardarCartasEnStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cartasGuardadas));
    actualizarContadorCartas();
}

function agregarCartaGuardada(carta) {
    if (!cartasGuardadas.some(c => c.id === carta.id)) {
        cartasGuardadas.push(carta);
        guardarCartasEnStorage();
        mostrarNotificacion('Carta añadida a favoritos');
    }
}

function eliminarCartaGuardada(cartaId) {
    cartasGuardadas = cartasGuardadas.filter(c => c.id !== cartaId);
    guardarCartasEnStorage();
    mostrarNotificacion('Carta eliminada de favoritos');
}

function actualizarContadorCartas() {
    const contador = document.getElementById('contador-cartas');
    if (contador) {
        contador.textContent = cartasGuardadas.length;
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
    titulo.textContent = 'Cartas Guardadas';
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
    
    if (cartasGuardadas.length === 0) {
        const mensaje = document.createElement('p');
        mensaje.className = 'no-cards';
        mensaje.textContent = 'No hay cartas guardadas';
        mensaje.style.gridColumn = '1 / -1';
        grid.appendChild(mensaje);
    } else {
        cartasGuardadas.forEach(carta => {
            const cardElement = crearElementoCarta(carta, true);
            if (cardElement) {
                grid.appendChild(cardElement);
            }
        });
    }
    
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
    if (cartasGuardadas.length > LIMITE_PDF) {
        mostrarNotificacion('El máximo permitido es '+LIMITE_PDF+' cartas por PDF'); return;
    }
    const btn = document.querySelector('.btn-exportar');
    try {
        if (btn) { btn.disabled = true; btn.textContent = 'Preparando PDF…'; }
        const response = await fetch('/api/pdf', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ids: cartasGuardadas.map(c => c.id)})
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'HTTP '+response.status);
        }
        const blob = await response.blob();
        if (!blob.size || !blob.type.includes('pdf')) throw new Error('PDF no válido');
        const url = URL.createObjectURL(blob);
        const nombre = 'pokemon_tcg_'+cartasGuardadas.length+'_cartas.pdf';
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
    if (!cartasGuardadas.length) { mostrarNotificacion('No hay cartas para compartir'); return; }
    const u=new URL(location.href); u.searchParams.set('favoritos',cartasGuardadas.map(c=>c.id).join(','));u.hash='';
    try {
        if(navigator.share) await navigator.share({title:'Cartas Pokémon',url:u.toString()});
        else if(navigator.clipboard?.writeText) {await navigator.clipboard.writeText(u.toString()); mostrarNotificacion('Enlace copiado');}
        else window.prompt('Copia este enlace:',u.toString());
    } catch(e){if(e.name!=='AbortError') mostrarNotificacion('No se pudo compartir');}
}
async function importarFavoritosDesdeEnlace(){
    const raw=new URLSearchParams(location.search).get('favoritos'); if(!raw)return;
    const ids=[...new Set(raw.split(',').filter(id=>/^[a-zA-Z0-9_.-]{3,72}$/.test(id)))].slice(0,LIMITE_PDF)
        .filter(id=>!cartasGuardadas.some(c=>c.id===id));
    let total=0;
    for(let i=0;i<ids.length;i+=5){
        const cards=await Promise.all(ids.slice(i,i+5).map(id=>fetchAPI('cards/'+encodeURIComponent(id)).catch(()=>null)));
        for(const card of cards)if(card?.id&&!cartasGuardadas.some(c=>c.id===card.id)){cartasGuardadas.push(card);total++;}
    }
    if(total){guardarCartasEnStorage();mostrarNotificacion(total+' cartas importadas');}
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
});

function inicializarApp() {
    // Configurar los filtros en el orden deseado
    configurarFiltroNombre();
    configurarFiltroCategoria();
    configurarFiltroTipo();
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
    paginaActual = 1;
    loadingCartas.style.display = 'block';
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
        if (nombreBuscado) filtros.push(`name=like:${nombreBuscado}`);
        
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
        
        // Si hay texto general, hacer búsqueda completa en todos los campos
        if (textoGeneral) {
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
        cartasContainer.innerHTML = `<p class=\"error\">Error al filtrar las cartas: ${error.message}</p>`;
        document.getElementById('paginacion').style.display = 'none';
    } finally {
        loadingCartas.style.display = 'none';
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

    // Añadir botón de guardar
    const btnGuardar = document.createElement('button');
    btnGuardar.className = 'btn-guardar';
    btnGuardar.innerHTML = cartasGuardadas.some(c => c.id === carta.id) ? '❤️' : '🤍';
    
    btnGuardar.onclick = (e) => {
        e.stopPropagation(); // Evitar que se abra el modal de detalles
        if (cartasGuardadas.some(c => c.id === carta.id)) {
            eliminarCartaGuardada(carta.id);
            btnGuardar.innerHTML = '🤍';
            // Si estamos en el modal de cartas guardadas, eliminar la carta visualmente
            const modalGuardadas = document.getElementById('modal-guardadas');
            if (modalGuardadas && esGuardada) {
                cardDiv.remove();
                // Si no quedan cartas, mostrar mensaje
                const grid = modalGuardadas.querySelector('.cards-grid');
                if (grid && grid.children.length === 0) {
                    const mensaje = document.createElement('p');
                    mensaje.className = 'no-cards';
                    mensaje.textContent = 'No hay cartas guardadas';
                    mensaje.style.gridColumn = '1 / -1';
                    grid.appendChild(mensaje);
                }
            }
        } else {
            agregarCartaGuardada(carta);
            btnGuardar.innerHTML = '❤️';
        }
    };

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
        
        // Botón para agregar o quitar de favoritos
        const btnFavorito = document.createElement('button');
        btnFavorito.className = 'btn-guardar btn-guardar-detalle';
        const yaGuardada = cartasGuardadas.some(c => c.id === detallesCarta.id);
        btnFavorito.innerHTML = yaGuardada ? '❤️ Quitar de favoritos' : '🤍 Añadir a favoritos';
        btnFavorito.onclick = (e) => {
            e.stopPropagation();
            if (cartasGuardadas.some(c => c.id === detallesCarta.id)) {
                eliminarCartaGuardada(detallesCarta.id);
                btnFavorito.innerHTML = '🤍 Añadir a favoritos';
            } else {
                agregarCartaGuardada(detallesCarta);
                btnFavorito.innerHTML = '❤️ Quitar de favoritos';
            }
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
        const modalGuardadas = document.getElementById('modal-guardadas');
        if (modalGuardadas) {
            modalGuardadas.remove();
            mostrarCartasGuardadas();
        }
    }
}