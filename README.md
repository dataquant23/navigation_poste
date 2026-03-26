# Navigation vers poste - Django

Projet Django prêt à lancer pour :
- charger les postes depuis `navigation_app/data/poste_hta_bt.xlsx`
- rechercher un poste à partir de `libelle` et `nom_poste`
- convertir `coordx` / `coordy` en coordonnées GPS affichables
- afficher une carte Leaflet
- récupérer la position actuelle de l'utilisateur
- tracer un itinéraire routier vers le poste
- ouvrir Google Maps ou Apple Maps avec la destination préremplie

## Installation

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Puis ouvre :
`http://127.0.0.1:8000/`

## Fichier source des postes

Place ton fichier ici :

`navigation_app/data/poste_hta_bt.xlsx`

Colonnes utilisées :
- `libelle`
- `nom_poste`
- `coordx`
- `coordy`

Colonnes aussi affichées si présentes :
- `quartier`
- `commune`
- `region`
- `departemen`
- `depart`
- `dr`
- `type`
- `fonction`

## Coordonnées

Le projet suppose que :
- `coordx` / `coordy` sont des coordonnées projetées en mètres
- le CRS source par défaut est **EPSG:32630**
- la carte Leaflet est en **WGS84 / EPSG:4326**

Si tes coordonnées utilisent un autre CRS, modifie dans :
`navigation_app/services.py`

```python
SOURCE_CRS = "EPSG:32630"
TARGET_CRS = "EPSG:4326"
```

## Important

Ton fichier d'exemple montre des valeurs comme :
- `387250,4607`
- `588575,4747`

Le projet les convertit automatiquement en nombres.


## Correctif v3
- `pyproj` est inclus pour convertir correctement `coordx` / `coordy`.
- Le poste s'affiche maintenant sur la carte si les coordonnées GPS sont valides.
- Les coordonnées s'affichent dans 3 formats :
  - source X / Y
  - GPS décimal
  - GPS DMS
