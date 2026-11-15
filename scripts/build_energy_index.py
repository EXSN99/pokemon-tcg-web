#!/usr/bin/env python3
"""Índice incremental de energías de ataques TCGdex (idioma español).

Se almacena una entrada por carta, incluso cuando no tiene ataques (lista []).
Los fallos HTTP no se marcan como completados: se reintentan en ejecuciones futuras.
El índice es un caché derivado; la fuente de verdad sigue siendo TCGdex.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import re
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import requests

API = "https://api.tcgdex.net/v2/es"
DEST = Path(__file__).resolve().parents[1] / "data" / "energy-index.json"
CARD_ID_RE = re.compile(r"^[A-Za-z0-9_.-]{3,72}$")
ENERGIES = {
    "grass": "Grass", "planta": "Grass",
    "fire": "Fire", "fuego": "Fire",
    "water": "Water", "agua": "Water",
    "lightning": "Lightning", "rayo": "Lightning",
    "electrica": "Lightning", "electrico": "Lightning",
    "psychic": "Psychic", "psiquica": "Psychic", "psiquico": "Psychic",
    "fighting": "Fighting", "lucha": "Fighting",
    "darkness": "Darkness", "oscura": "Darkness", "oscuro": "Darkness",
    "metal": "Metal", "metalica": "Metal", "metalico": "Metal",
    "fairy": "Fairy", "hada": "Fairy",
    "colorless": "Colorless", "incolora": "Colorless", "incoloro": "Colorless",
}


def normalizar(texto: object) -> str:
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", str(texto or ""))
                   if unicodedata.category(c) != "Mn").strip().lower()


def tipos_energia(carta: dict) -> list[str]:
    """Unión de costes de todos los ataques, no del tipo del Pokémon."""
    tipos: set[str] = set()
    for ataque in carta.get("attacks") or []:
        if not isinstance(ataque, dict):
            continue
        for energia in (ataque.get("cost") or []):
            tipo = ENERGIES.get(normalizar(energia))
            if tipo:
                tipos.add(tipo)
    return sorted(tipos)


def get_json(url: str, session: requests.Session | None = None) -> object:
    requester = session or requests
    for intento in range(4):
        try:
            response = requester.get(url, timeout=(8, 25),
                                     headers={"Accept": "application/json",
                                              "User-Agent": "pokemon-tcg-web-energy-index/1.0"})
            if response.status_code in (429, 500, 502, 503, 504):
                raise requests.HTTPError(f"Respuesta temporal {response.status_code}")
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError):
            if intento == 3:
                raise
            time.sleep(min(8, 2 ** intento))
    raise RuntimeError("No se pudo consultar TCGdex")


def texto_busqueda(carta: dict) -> str:
    """Texto español normalizado para encontrar nombres, ataques y habilidades."""
    campos = [
        carta.get("name"), carta.get("description"), carta.get("effect"),
        carta.get("trainerEffect"), carta.get("rarity"), carta.get("category"),
        carta.get("illustrator"),
    ]
    campos.extend(carta.get("types") or [])
    conjunto = carta.get("set")
    if isinstance(conjunto, dict):
        campos.append(conjunto.get("name"))
    for llave in ("attacks", "abilities"):
        for bloque in carta.get(llave) or []:
            if isinstance(bloque, dict):
                campos.extend([bloque.get("name"), bloque.get("effect"),
                               bloque.get("description"), bloque.get("damage")])
    return " ".join(normalizar(campo) for campo in campos
                    if campo is not None and str(campo).strip())


def descargar_carta(card_id: str) -> tuple[str, dict]:
    # Una sesión por llamada evita compartir objetos requests.Session entre hilos.
    carta = get_json(f"{API}/cards/{requests.utils.quote(card_id, safe='')}")
    if not isinstance(carta, dict) or carta.get("id") != card_id:
        raise ValueError(f"ID o respuesta inválidos: {card_id}")
    return card_id, {
        "energies": tipos_energia(carta),
        "search": texto_busqueda(carta),
        "image": carta.get("image") if isinstance(carta.get("image"), str) else None,
    }


def leer_indice(path: Path) -> dict:
    if not path.is_file():
        return {}
    contenido = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(contenido, dict) or contenido.get("schemaVersion") not in (1, 2):
        raise ValueError("Índice existente con versión inesperada")
    return contenido


def construir_indice(path: Path = DEST, batch_size: int = 1200, workers: int = 4) -> dict:
    if not 1 <= batch_size <= 5000 or not 1 <= workers <= 8:
        raise ValueError("batch_size (1..5000), workers (1..8)")
    resumenes = get_json(f"{API}/cards")
    if not isinstance(resumenes, list) or not resumenes:
        raise ValueError("TCGdex devolvió un catálogo vacío, no sobrescribir índice")

    ids = list(dict.fromkeys(c.get("id") for c in resumenes
                             if isinstance(c, dict) and isinstance(c.get("id"), str)
                             and CARD_ID_RE.fullmatch(c["id"])))
    if len(ids) < 100:
        raise ValueError("Catálogo anormalmente pequeño; índice preservado")

    previo = leer_indice(path)
    anteriores = previo.get("cards", {})
    if not isinstance(anteriores, dict):
        raise ValueError("Índice previo inválido")
    ids_validos = set(ids)
    cards = {
        cid: info for cid, info in anteriores.items()
        if cid in ids_validos and (
            isinstance(info, list)
            or (isinstance(info, dict) and isinstance(info.get("energies"), list))
        )
    }
    # Catálogo completo: datos breves para búsquedas por nombre y URL de imagen
    # tomada de TCGdex, no fabricada a partir del ID.
    catalog = {
        item["id"]: {
            "name": item.get("name") or "",
            "image": item.get("image") if isinstance(item.get("image"), str) else None,
            "localId": item.get("localId") or "",
        }
        for item in resumenes
        if isinstance(item, dict) and item.get("id") in ids_validos
    }

    # Prioriza enriquecer entradas viejas (listas solo con energía);
    # lo demás se llena progresivamente en las siguientes ejecuciones.
    pendientes = [
        cid for cid in dict.fromkeys(["swsh3-136"] + ids)
        if cid not in cards or not (
            isinstance(cards[cid], dict) and isinstance(cards[cid].get("search"), str)
        )
    ][:batch_size]
    logging.info("Catálogo: %d | indexadas: %d | nuevas: %d", len(ids), len(cards), len(pendientes))

    errores: list[str] = []
    if pendientes:
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futuros = {executor.submit(descargar_carta, cid): cid for cid in pendientes}
            for numero, futuro in enumerate(as_completed(futuros), start=1):
                cid = futuros[futuro]
                try:
                    carta_id, energia = futuro.result()
                    cards[carta_id] = energia
                except Exception as exc:
                    errores.append(cid)
                    logging.warning("Error indexando %s: %s", cid, exc)
                if numero % 100 == 0:
                    logging.info("Procesadas %d/%d (fallidas %d)", numero, len(pendientes), len(errores))

    # Ningún fallo externo destruye o invalida el índice anterior.
    ahora = datetime.now(timezone.utc).isoformat(timespec="seconds")
    resultado = {
        "schemaVersion": 2,
        "language": "es",
        "source": "TCGdex REST v2",
        "generatedAt": ahora,
        "catalogSize": len(ids),
        "indexedCount": len(cards),
        "searchIndexedCount": sum(1 for c in cards.values() if isinstance(c, dict) and isinstance(c.get("search"), str)),
        "catalog": catalog,
        "complete": len(cards) == len(ids),
        "failedThisRun": len(errores),
        "cards": dict(sorted(cards.items())),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent,
                                     prefix="energy-", suffix=".json", delete=False) as handle:
        tmp = Path(handle.name)
        json.dump(resultado, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")
    os.replace(tmp, path)
    logging.info("Índice escrito: %s; %d/%d (%.1f%%); fallidos %d",
                 path, len(cards), len(ids), len(cards) / len(ids) * 100, len(errores))
    return resultado


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=1200)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--output", type=Path, default=DEST)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    construir_indice(args.output, args.batch_size, args.workers)


if __name__ == "__main__":
    main()
