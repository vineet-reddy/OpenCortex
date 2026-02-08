"""Allen Brain Atlas Cell Types dataset access.

No authentication required. Uses the Allen Brain Map REST API directly
so agents don't need to install the full AllenSDK.

API docs: https://alleninstitute.github.io/AllenSDK/cell_types.html
REST base: http://api.brain-map.org/api/v2
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx

BASE_URL = "http://api.brain-map.org/api/v2"
TIMEOUT = httpx.Timeout(15.0)


def list_cells(num_rows: int = 25) -> List[Dict[str, Any]]:
    """Fetch cell specimen metadata from the Cell Types database.

    Returns a list of dicts with keys like specimen__id, donor__species,
    structure__name, line_name, etc.
    """
    url = f"{BASE_URL}/data/query.json"
    params = {
        "criteria": "model::ApiCellTypesSpecimenDetail",
        "num_rows": num_rows,
    }
    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
    data = resp.json()
    return data.get("msg", [])


def get_cell(specimen_id: int) -> Dict[str, Any]:
    """Fetch metadata for a single cell specimen by ID."""
    url = f"{BASE_URL}/data/query.json"
    params = {
        "criteria": f"model::ApiCellTypesSpecimenDetail,rma::criteria,[specimen__id$eq{specimen_id}]",
        "num_rows": 1,
    }
    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
    data = resp.json()
    rows = data.get("msg", [])
    if not rows:
        raise ValueError(f"No cell found with specimen_id={specimen_id}")
    return rows[0]


def get_ephys_features(num_rows: int = 25) -> List[Dict[str, Any]]:
    """Fetch pre-computed electrophysiology features.

    Returns features like rheobase, input resistance (ri), membrane time
    constant (tau), firing rate, etc. as a list of dicts.
    """
    url = f"{BASE_URL}/data/query.json"
    params = {
        "criteria": "model::EphysFeature",
        "num_rows": num_rows,
    }
    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
    data = resp.json()
    return data.get("msg", [])


def get_morphology_features(num_rows: int = 25) -> List[Dict[str, Any]]:
    """Fetch neuron morphology features (soma depth, dendrite type, etc.)."""
    url = f"{BASE_URL}/data/query.json"
    params = {
        "criteria": "model::NeuronReconstruction",
        "num_rows": num_rows,
    }
    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
    data = resp.json()
    return data.get("msg", [])


def search_cells(
    species: Optional[str] = None,
    brain_region: Optional[str] = None,
    num_rows: int = 25,
) -> List[Dict[str, Any]]:
    """Search cells by species and/or brain region.

    Args:
        species: e.g. "Mus musculus" or "Homo Sapiens"
        brain_region: e.g. "VISp" (primary visual cortex)
        num_rows: max results to return
    """
    filters = []
    if species:
        filters.append(f"[donor__species$eq'{species}']")
    if brain_region:
        filters.append(f"[structure__acronym$eq'{brain_region}']")

    criteria = "model::ApiCellTypesSpecimenDetail"
    if filters:
        criteria += ",rma::criteria," + ",".join(filters)

    url = f"{BASE_URL}/data/query.json"
    params = {"criteria": criteria, "num_rows": num_rows}
    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
    data = resp.json()
    return data.get("msg", [])


def get_summary_stats(cells: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """Compute summary statistics from a list of cell specimens.

    If cells is None, fetches 100 cells first. Returns counts by species,
    brain region, and dendrite type.
    """
    if cells is None:
        cells = list_cells(num_rows=100)

    species_counts: Dict[str, int] = {}
    region_counts: Dict[str, int] = {}
    dendrite_counts: Dict[str, int] = {}

    for c in cells:
        sp = c.get("donor__species") or "unknown"
        species_counts[sp] = species_counts.get(sp, 0) + 1

        region = c.get("structure__name") or c.get("structure__acronym") or "unknown"
        region_counts[region] = region_counts.get(region, 0) + 1

        dt = c.get("tag__dendrite_type") or "unknown"
        dendrite_counts[dt] = dendrite_counts.get(dt, 0) + 1

    return {
        "total_cells": len(cells),
        "species": species_counts,
        "brain_regions": region_counts,
        "dendrite_types": dendrite_counts,
    }
