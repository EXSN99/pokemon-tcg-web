"""Pruebas del indexador sin realizar consultas externas a TCGdex."""
from unittest.mock import patch

import pytest

from scripts.build_energy_index import (
    construir_indice,
    normalizar,
    tipos_energia,
)


def test_normaliza_costos_en_espanol_y_en_ingles():
    carta = {
        "category": "Pokémon", "types": ["Dragón"],
        "attacks": [
            {"cost": ["Agua", "Fuego", "Incolora"]},
            {"cost": ["Water", "Incolora", "Rayo"]},
        ],
    }
    assert tipos_energia(carta) == ["Colorless", "Fire", "Lightning", "Water"]
    assert normalizar("Psíquica") == "psiquica"
    assert tipos_energia({"category": "Entrenador"}) == []


def test_indice_incremental_no_pierde_entradas_anteriores(tmp_path):
    ids = [f"sv01-{i}" for i in range(150)]
    catalogo = [{"id": id_} for id_ in ids]
    ruta = tmp_path / "data" / "energy-index.json"

    with (
        patch("scripts.build_energy_index.get_json", return_value=catalogo),
        patch("scripts.build_energy_index.descargar_carta",
              side_effect=lambda cid: (cid, ["Fire"] if cid.endswith("-1") else [])),
    ):
        primero = construir_indice(ruta, batch_size=30, workers=2)
        segundo = construir_indice(ruta, batch_size=30, workers=2)

    assert primero["catalogSize"] == 150
    assert primero["indexedCount"] == 30
    assert segundo["indexedCount"] == 60
    assert not segundo["complete"]
    assert segundo["cards"]["sv01-1"] == ["Fire"]
    # Una carta procesada sin energía se conserva como [] y no se pide otra vez.
    assert segundo["cards"]["sv01-2"] == []
    assert ruta.is_file()


def test_fallo_no_se_marca_como_carta_sin_energia(tmp_path):
    catalogo = [{"id": f"sv01-{i}"} for i in range(150)]
    ruta = tmp_path / "energy-index.json"

    def obtener(cid):
        if cid == "sv01-0":
            raise RuntimeError("TCGdex temporalmente no disponible")
        return cid, []

    with (
        patch("scripts.build_energy_index.get_json", return_value=catalogo),
        patch("scripts.build_energy_index.descargar_carta", side_effect=obtener),
    ):
        primer = construir_indice(ruta, batch_size=150, workers=1)

    assert primer["indexedCount"] == 149
    assert primer["failedThisRun"] == 1
    assert "sv01-0" not in primer["cards"]

    with (
        patch("scripts.build_energy_index.get_json", return_value=catalogo),
        patch("scripts.build_energy_index.descargar_carta",
              side_effect=lambda cid: (cid, ["Water"])),
    ):
        segundo = construir_indice(ruta, batch_size=5, workers=1)

    assert segundo["indexedCount"] == 150
    assert segundo["complete"]
    assert segundo["cards"]["sv01-0"] == ["Water"]


def test_no_sobrescribe_indice_si_catalogo_es_anormalmente_pequeno(tmp_path):
    ruta = tmp_path / "energy-index.json"
    ruta.write_text('{"schemaVersion":1,"cards":{"sv01-1":["Water"]}}', encoding="utf-8")
    with patch("scripts.build_energy_index.get_json", return_value=[{"id":"sv01-1"}]):
        with pytest.raises(ValueError, match="anormalmente"):
            construir_indice(ruta, batch_size=10)
    assert '"Water"' in ruta.read_text(encoding="utf-8")


def test_parametros_inseguros_se_rechazan(tmp_path):
    with pytest.raises(ValueError, match="batch_size"):
        construir_indice(tmp_path / "x.json", batch_size=10000)
