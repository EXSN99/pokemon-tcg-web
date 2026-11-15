const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function prepararApp(favoritos = [], search = '') {
    const storage = new Map([['tcg_cartas_guardadas', JSON.stringify(favoritos)]]);
    const counter = {textContent: '', title: ''};
    const notificaciones = [];
    let enlaceCompartido = '';
    const contexto = vm.createContext({
        console,
        URL,
        URLSearchParams,
        location: {href: 'https://ejemplo.test/' + search, search},
        navigator: {
            clipboard: {writeText: async url => { enlaceCompartido = url; }}
        },
        localStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
        },
        document: {
            getElementById: key => key === 'contador-cartas' ? counter : null,
            querySelectorAll: () => [],
            querySelector: () => null,
            createElement: () => ({classList: {add() {}}, remove() {}}),
            body: {appendChild: node => notificaciones.push(node.textContent)},
            addEventListener() {},
        },
        setTimeout() {},
        confirm: () => true,
    });
    vm.runInContext(source, contexto);
    vm.runInContext('cargarCartasGuardadas()', contexto);
    return {
        eval: exp => vm.runInContext(exp, contexto),
        current: () => JSON.parse(storage.get('tcg_cartas_guardadas')),
        counter,
        notificaciones,
        contexto,
        sharedLink: () => enlaceCompartido,
    };
}

test('migra favoritos antiguos a una copia sin perder cartas', () => {
    const app = prepararApp([{id: 'swsh3-136', name: 'Pikachu'}, {id: 'swsh3-137', name: 'Charizard'}]);
    assert.deepEqual(app.current().map(c => c.cantidad), [1, 1]);
    assert.equal(app.counter.textContent, 2);
});

test('el corazón agrega copias de la misma carta y el PDF recibe IDs repetidos', () => {
    const app = prepararApp([{id: 'swsh3-136', name: 'Pikachu'}]);
    app.eval("agregarCartaGuardada({id: 'swsh3-136', name: 'Pikachu'})");
    app.eval("agregarCartaGuardada({id: 'swsh3-136', name: 'Pikachu'})");
    assert.equal(app.current().length, 1);
    assert.equal(app.current()[0].cantidad, 3);
    assert.equal(app.counter.textContent, 3);
    assert.deepEqual(Array.from(app.eval('obtenerIdsParaPDF()')), ['swsh3-136', 'swsh3-136', 'swsh3-136']);
});

test('los botones restan copias, y al llegar a cero eliminan la carta', () => {
    const app = prepararApp([{id: 'swsh3-136', name: 'Pikachu', cantidad: 2}]);
    app.eval("cambiarCantidadCarta('swsh3-136', -1)");
    assert.equal(app.current()[0].cantidad, 1);
    app.eval("cambiarCantidadCarta('swsh3-136', -1)");
    assert.equal(app.current().length, 0);
    assert.equal(app.counter.textContent, 0);
});

test('limita las nuevas copias a 54 y no borra favoritos históricos mayores', () => {
    const ids = Array.from({length: 55}, (_, i) => ({id: 'tcg-' + String(i).padStart(3, '0'), name: 'Carta ' + i}));
    const app = prepararApp(ids);
    assert.equal(app.current().length, 55);
    const added = app.eval("agregarCartaGuardada({id: 'extra-10', name: 'Nueva'})");
    assert.equal(added, false);
    assert.equal(app.current().length, 55);
    const nuevo = prepararApp([{id: 'swsh3-136', name: 'Pikachu', cantidad: 54}]);
    assert.equal(nuevo.eval("agregarCartaGuardada({id: 'swsh3-136'})"), false);
    assert.equal(nuevo.current()[0].cantidad, 54);
});

test('comparte e importa enlaces con copias repetidas', async () => {
    const app = prepararApp([{id: 'swsh3-136', name: 'Pikachu', cantidad: 3}]);
    await app.eval('compartirFavoritos()');
    const u = new URL(app.sharedLink());
    assert.equal(u.searchParams.get('favoritos'), 'swsh3-136,swsh3-136,swsh3-136');
    const otra = prepararApp([], u.search);
    otra.eval("fetchAPI = async endpoint => ({id: endpoint.split('/')[1], name: 'Pikachu'})");
    await otra.eval('importarFavoritosDesdeEnlace()');
    assert.equal(otra.current().length, 1);
    assert.equal(otra.current()[0].cantidad, 3);
});
