const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function mockElement() {
    return {
        style: {}, value: '', textContent: '', innerHTML: '',
        children: [], appendChild(child) { this.children.push(child); },
        addEventListener() {}, setAttribute() {},
    };
}

function preparar() {
    const elements = new Map();
    const get = id => {
        if (!elements.has(id)) elements.set(id, mockElement());
        return elements.get(id);
    };
    const context = vm.createContext({
        console,
        document: {
            getElementById: get,
            createElement: mockElement,
            querySelector: selector => get(selector),
            querySelectorAll: () => [],
            addEventListener() {},
        },
        window: { addEventListener() {} },
    });
    vm.runInContext(source, context);
    vm.runInContext(
        "fetchAPI = async endpoint => { (globalThis.requests ||= []).push(endpoint); return []; };"
        + "actualizarExpansionesDisponibles = function() {};",
        context
    );
    return {context, get, eval: expression => vm.runInContext(expression, context)};
}

test('el nuevo selector muestra energías de ataque y no reemplaza al tipo Pokémon', () => {
    const app = preparar();
    app.eval('configurarFiltroEnergiaAtaque()');
    const selector = app.get('filtro-energia-ataque');
    // La referencia al selector creado se inspecciona desde el contexto VM.
    const values = Array.from(app.eval('filtroEnergiaAtaque.children.map(o => o.value)'));
    assert.ok(values.includes('Water'));
    assert.ok(values.includes('Fire'));
    assert.ok(values.includes('Colorless'));
    assert.ok(!values.includes('Dragon')); // Dragon es tipo Pokémon, no energía estándar.
    assert.ok(app.get('.filtro-container').children.length >= 2);
});

test('aplica filtro attacks.cost independiente del tipo Dragon', async () => {
    const app = preparar();
    app.eval("expansionSeleccionada = {id: 'sv01'}");
    app.eval("tipoSeleccionado = 'Dragon'");
    app.eval("categoriaSeleccionada = 'Pokemon'");
    app.eval("energiaAtaqueSeleccionada = 'Water'");
    await app.eval('aplicarFiltros()');
    const url = app.eval('globalThis.requests[0]');
    assert.ok(url.includes('types=Dragon'), url);
    assert.ok(url.includes('attacks.cost=Water'), url);
    assert.ok(url.includes('category=Pokemon'), url);
    assert.ok(url.includes('set.id=eq:sv01'), url);
});

test('respeta la energía tanto en búsqueda general como en su búsqueda alternativa', async () => {
    const app = preparar();
    app.eval("energiaAtaqueSeleccionada = 'Fire'");
    app.eval("filtroAtaqueTexto.value = 'draco'");
    await app.eval('aplicarFiltros()');
    const queries = Array.from(app.eval('globalThis.requests'));
    assert.equal(queries.length, 2);
    assert.ok(queries.every(q => q.includes('attacks.cost=Fire')), queries.join('\n'));
});

test('sin energía seleccionada no agrega restricciones de ataques', async () => {
    const app = preparar();
    await app.eval('aplicarFiltros()');
    const url = app.eval('globalThis.requests[0]');
    assert.ok(!url.includes('attacks.cost'), url);
});
