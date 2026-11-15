"""Diagnóstico temporal de respuestas TCGdex."""
import requests
base="https://api.tcgdex.net/v2/es"
checks=[
    "cards?set.id=eq:swsh3",
    "cards?set.id=eq:swsh3&attacks.cost=Agua",
    "cards?set.id=eq:swsh3&attacks.cost=Incolora",
    "cards?set.id=eq:swsh3&attacks.cost=Oscura",
    "cards?set.id=eq:swsh3&attacks.cost=Water",
    "cards/swsh3-55",
]
for path in checks:
    try:
        r=requests.get(f"{base}/{path}",timeout=(5,15))
        print(f"PATH={path} STATUS={r.status_code} CONTENT_TYPE={r.headers.get('content-type')} LENGTH={len(r.content)} PREVIEW={r.text[:120]!r}")
        if r.ok:
            obj=r.json()
            if isinstance(obj,list):print("COUNT",len(obj),"FIRST",[x.get("id") for x in obj[:3]])
            elif isinstance(obj,dict):print("DETAIL",{k:obj.get(k) for k in ("id","name","types","attacks")})
    except Exception as e: print(f"PATH={path} ERROR={type(e).__name__}: {e}")

for graphql in [
    {"query":"query { cards(pagination: {page: 1, itemsPerPage: 3}) { id name attacks { cost } } }"},
    {"query":"query { cards(pagination: {page: 1, itemsPerPage: 3}) { id name } }"}
]:
    try:
        r=requests.post("https://api.tcgdex.net/v2/graphql",json=graphql,timeout=(5,20))
        print("GRAPHQL",r.status_code,r.headers.get("content-type"),len(r.content),r.text[:1100])
    except Exception as e:print("GRAPHQL_ERROR",type(e).__name__,str(e))
