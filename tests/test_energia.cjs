const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function elemento() {
    const clases = new Set();
    return {
        style: {}, dataset: {}, value: '', textContent: '', innerHTML: '',
        children: [], listeners: {}, attributes: {},
        classList: {
            toggle(cls, enabled) { if (enabled) clases.add(cls); else clases.delete(cls); },
            add(cls) { clases.add(cls); }, remove(cls) { clases.delete(cls); },
            contains(cls) { return clases.has(cls); }
        },
        appendChild(hijo) { this.children.push(hijo); return hijo; },
        append(...hijos) { this.children.push(...hijos); },
        addEventListener(evt, cb) { (this.listeners[evt] ||= []).push(cb); },
        setAttribute(k, v) { this.attributes[k] = v; },
    };
}

function preparar({resumenes = [], detalles = {}} = {}) {
    const elements = new Map();
    const get = id => {
        if (!elements.has(id)) elements.set(id, elemento());
        return elements.get(id);
    };
    const ctx = vm.createContext({
        console,
        document: {
            getElementById: get,
            createElement: elemento,
            querySelector: get,
            querySelectorAll: () => [],
            addEventListener() {},
        },
        window: {addEventListener() {}},
    });
    ctx.resumenesFixture = resumenes;
    ctx.detallesFixture = detalles;
    vm.runInContext(source, ctx);
    vm.runInContext(
        "globalThis.llamadas = [];"
        + "fetchAPI = async endpoint => {"
        + "globalThis.llamadas.push(endpoint);"
        + "if(endpoint.startsWith('cards?')) return globalThis.resumenesFixture;"
        + "return globalThis.detallesFixture[endpoint.slice(6)];"
        + "};"
        + "mostrarCartas = cards => {globalThis.resultados = cards.map(c => c.id);};"
        + "actualizarExpansionesDisponibles = () => {};"
        + "mostrarExpansiones = () => {};",
        ctx
    );
    return {ctx, get, eval: code => vm.runInContext(code, ctx)};
}

const furret = {
    id: 'swsh3-136', name: 'Furret', category: 'Pokémon',
    types: ['Incolora'], attacks: [{cost: ['Incolora'], name: 'Buen Rollito'}]
};
const dragon = {
    id: 'dragon-101', name: 'Dragón', category: 'Pokémon',
    types: ['Dragón'], attacks: [{cost: ['Agua', 'Fuego', 'Incolora'], name: 'Llama Azul'}]
};
const rayquaza = {
    id: 'dragon-102', name: 'Rayquaza', category: 'Pokémon',
    types: ['Dragón'], attacks: [{cost: ['Rayo'], name: 'Chispa'}, {cost: ['Fuego'], name: 'Llamarada'}]
};

test('normaliza energías localizadas de la API en español', () => {
    const app = preparar();
    assert.equal(app.eval("normalizarEnergiaCosto('Agua')"), 'Water');
    assert.equal(app.eval("normalizarEnergiaCosto('Incolora')"), 'Colorless');
    assert.equal(app.eval("normalizarEnergiaCosto('Psíquica')"), 'Psychic');
    assert.equal(app.eval("normalizarEnergiaCosto('Rayo')"), 'Lightning');
    assert.equal(app.eval("normalizarEnergiaCosto('Metálica')"), 'Metal');
});

test('permite elegir más de una energía con chips y aria-pressed', async () => {
    const app = preparar();
    app.eval('configurarFiltroEnergiaAtaque()');
    const panel = app.get('.filtro-container').children[0];
    const chips = panel.children.find(n => n.className === 'energia-chips');
    assert.equal(chips.children.length, 10);
    const agua = chips.children.find(c => c.dataset.energia === 'Water');
    const fuego = chips.children.find(c => c.dataset.energia === 'Fire');
    await agua.listeners.click[0]();
    await fuego.listeners.click[0]();
    assert.equal(app.eval('energiasSeleccionadas.size'), 2);
    assert.equal(agua.attributes['aria-pressed'], 'true');
    assert.equal(fuego.attributes['aria-pressed'], 'true');
    assert.equal(agua.classList.contains('seleccionada'), true);
    await agua.listeners.click[0]();
    assert.equal(app.eval('energiasSeleccionadas.size'), 1);
});

test('Cualquiera (OR) y Todas (AND) comparan ataques, no tipos Pokémon', () => {
    const app = preparar();
    app.ctx.dragon = dragon;
    app.ctx.rayquaza = rayquaza;
    assert.equal(app.eval("coincideEnergia(dragon,new Set(['Water','Fire']),'todas')"), true);
    assert.equal(app.eval("coincideEnergia(dragon,new Set(['Water','Metal']),'cualquiera')"), true);
    assert.equal(app.eval("coincideEnergia(dragon,new Set(['Water','Metal']),'todas')"), false);
    assert.equal(app.eval("coincideEnergia(rayquaza,new Set(['Lightning','Fire']),'todas')"), true);
    assert.equal(app.eval("coincideEnergia(rayquaza,new Set(['Water']),'cualquiera')"), false);
    assert.equal(app.eval("coincideEnergia(dragon,new Set(['Dragon']),'cualquiera')"), false);
});

test('busca en detalles reales sin enviar attacks.cost al catálogo', async () => {
    const resumenes = [furret, dragon, rayquaza].map(({id,name}) => ({id,name}));
    const detalles = Object.fromEntries([furret, dragon, rayquaza].map(x => [x.id,x]));
    const app = preparar({resumenes,detalles});
    app.eval("expansionSeleccionada = {id:'swsh3'}");
    app.eval("energiasSeleccionadas.add('Water')");
    app.eval("energiasSeleccionadas.add('Fire')");
    app.eval("criterioEnergias='todas'");
    await app.eval('aplicarFiltros()');
    assert.deepEqual(Array.from(app.ctx.resultados), ['dragon-101']);
    assert.ok(app.ctx.llamadas[0].includes('set.id=eq:swsh3'));
    assert.ok(app.ctx.llamadas.every(x => !x.includes('attacks.cost=')));
    assert.equal(app.ctx.llamadas.length,4); // 1 lista + 3 detalles
    app.ctx.llamadas = [];
    app.eval("criterioEnergias='cualquiera'");
    await app.eval('aplicarFiltros()');
    assert.deepEqual(Array.from(app.ctx.resultados), ['dragon-101','dragon-102']);
    assert.equal(app.ctx.llamadas.length,1); // detalles almacenados en caché
});

test('combina energía con texto general de los ataques', async () => {
    const resumenes = [{id:dragon.id,name:dragon.name},{id:furret.id,name:furret.name}];
    const detalles = {[dragon.id]:dragon,[furret.id]:furret};
    const app = preparar({resumenes,detalles});
    app.eval("energiasSeleccionadas.add('Fire')");
    app.eval("filtroAtaqueTexto.value = 'Llama Azul'");
    await app.eval('aplicarFiltros()');
    assert.deepEqual(Array.from(app.ctx.resultados), ['dragon-101']);
});

test('no devuelve resultados parciales si la búsqueda sin expansión es demasiado amplia', async () => {
    const resumenes = Array.from({length:401},(_,i)=>({id:'swsh3-'+i,name:'Carta'}));
    const app = preparar({resumenes});
    app.eval("energiasSeleccionadas.add('Fire')");
    await app.eval('aplicarFiltros()');
    assert.match(app.get('cartas-container').textContent,/Selecciona una expansión/i);
    assert.equal(app.ctx.llamadas.length,1); // no descarga 401 detalles
});
