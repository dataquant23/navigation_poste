from __future__ import annotations

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET

from .services import get_poste_by_id, load_postes, search_postes


@ensure_csrf_cookie
def index(request):
    try:
        postes = load_postes()[:10]
        error = ""
    except Exception as e:
        postes = []
        error = str(e)

    return render(
        request,
        "navigation_app/index.html",
        {
            "postes_initiaux": postes,
            "load_error": error,
        },
    )


@require_GET
def api_search_postes(request):
    q = request.GET.get("q", "")
    try:
        results = search_postes(q)
        return JsonResponse({"ok": True, "results": results})
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e), "results": []}, status=400)


@require_GET
def api_poste_detail(request):
    poste_id = request.GET.get("id")
    try:
        poste = get_poste_by_id(poste_id)
        if not poste:
            return JsonResponse({"ok": False, "error": "Poste introuvable"}, status=404)
        return JsonResponse({"ok": True, "poste": poste})
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)
