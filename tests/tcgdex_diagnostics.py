"""Diagnóstico temporal de respuestas TCGdex, no contiene credenciales."""
import requests

base="https://api.tcgdex.net/v2/es"
checks=[
    "cards?set.id=eq:swsh3&attacks.cost=Agua",
    "cards?set.id=eq:swsh3&attacks.cost=Fuego",
    "cards?set.id=eq:swsh3&attacks.cost=Incolora",
    "cards?set.id=eq:swsh3&attacks.cost=Agua%7CFuego",
    "cards?set.id=eq:swsh3&attacks.cost=Agua|Fuego",
    "cards?set.id=eq:swsh3&attacks.cost=Planta",
    "cards?set.id=eq:swsh3&attacks.cost=Metal",
    "cards?set.id=eq:swsh3&attacks.cost=Rayo",
    "cards?set.id=eq:swsh3&attacks.cost=Ps%C3%ADquico",
    "cards?set.id=eq:swsh3&attacks.cost=Oscura",
    "cards?set.id=eq:swsh3&attacks.cost=Lucha",
    "cards/swsh3-136",
]
for path in checks:
    try:
        r=requests.get(f"{base}/{path}",timeout=(5,15))
        obj=r.json()
        print(f"PATH={path} STATUS={r.status_code} TYPE={type(obj).__name__} COUNT={len(obj) if isinstance(obj,list) else None}")
        if isinstance(obj,list): print("FIRST",[(x.get("id"),x.get("name")) for x in obj[:3]])
        elif isinstance(obj,dict):print("DETAIL",{k:obj.get(k) for k in ("id","name","types","attacks","error")})
    except Exception as e: print(f"PATH={path} ERROR={type(e).__name__}: {e}")
