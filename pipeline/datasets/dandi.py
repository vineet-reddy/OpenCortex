"""DANDI Archive dataset access.

No authentication required for reading public dandisets.
Uses the DANDI REST API directly (no dandi-cli install needed).

API docs: https://api.dandiarchive.org/swagger/
REST base: https://api.dandiarchive.org/api
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx

BASE_URL = "https://api.dandiarchive.org/api"
TIMEOUT = httpx.Timeout(15.0)


def list_dandisets(
    page_size: int = 10,
    ordering: str = "-created",
    search: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """List dandisets from the DANDI archive.

    Args:
        page_size: number of results per page (max 100)
        ordering: sort order ("-created", "created", "-name", "name")
        search: optional keyword search (e.g. "hippocampus", "visual cortex")
    """
    params: Dict[str, Any] = {"page_size": page_size, "ordering": ordering}
    if search:
        params["search"] = search

    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.get(f"{BASE_URL}/dandisets/", params=params)
        resp.raise_for_status()
    data = resp.json()
    results = data.get("results", [])

    # Flatten version info for easier use
    simplified = []
    for ds in results:
        version = ds.get("most_recent_published_version") or ds.get("draft_version") or {}
        simplified.append({
            "identifier": ds.get("identifier"),
            "name": version.get("name", ""),
            "size_bytes": version.get("size", 0),
            "size_gb": round(version.get("size", 0) / 1e9, 2),
            "asset_count": version.get("asset_count", 0),
            "status": version.get("status", ""),
            "created": ds.get("created"),
            "modified": ds.get("modified"),
        })
    return simplified


def get_dandiset(dandiset_id: str, version: str = "draft") -> Dict[str, Any]:
    """Get metadata for a specific dandiset."""
    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.get(f"{BASE_URL}/dandisets/{dandiset_id}/versions/{version}/")
        resp.raise_for_status()
    return resp.json()


def list_assets(
    dandiset_id: str,
    version: str = "draft",
    page_size: int = 10,
    path_prefix: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """List NWB assets (files) within a dandiset.

    Args:
        dandiset_id: e.g. "000006"
        version: "draft" or a published version like "0.210831.0416"
        page_size: max results
        path_prefix: filter by path prefix (e.g. "sub-anm372795/")
    """
    params: Dict[str, Any] = {"page_size": page_size}
    if path_prefix:
        params["path"] = path_prefix

    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.get(
            f"{BASE_URL}/dandisets/{dandiset_id}/versions/{version}/assets/",
            params=params,
        )
        resp.raise_for_status()
    data = resp.json()

    assets = []
    for a in data.get("results", []):
        assets.append({
            "asset_id": a.get("asset_id"),
            "path": a.get("path"),
            "size_bytes": a.get("size", 0),
            "size_mb": round(a.get("size", 0) / 1e6, 2),
            "created": a.get("created"),
        })
    return assets


def get_asset_download_url(
    dandiset_id: str,
    asset_id: str,
    version: str = "draft",
) -> str:
    """Get a direct S3 download URL for an asset (no auth needed)."""
    with httpx.Client(timeout=TIMEOUT, follow_redirects=False) as client:
        resp = client.get(
            f"{BASE_URL}/dandisets/{dandiset_id}/versions/{version}/assets/{asset_id}/download/",
        )
    if resp.status_code in (301, 302, 307):
        return resp.headers.get("location", "")
    resp.raise_for_status()
    return ""


def search_dandisets(query: str, page_size: int = 5) -> List[Dict[str, Any]]:
    """Search DANDI archive by keyword. Convenience wrapper around list_dandisets."""
    return list_dandisets(page_size=page_size, search=query)


# Small recommended dandisets for quick iteration
RECOMMENDED_DANDISETS = {
    "000006": {
        "name": "Bhatt et al. (2020) Mouse Ephys",
        "description": "Mouse electrophysiology from Bhatt/Bhattacharyya, ~1.4 GB total, many small NWB files",
        "size_gb": 1.4,
    },
    "000003": {
        "name": "Tolias Lab Calcium Imaging",
        "description": "Two-photon calcium imaging from mouse visual cortex",
        "size_gb": 0.3,
    },
    "000004": {
        "name": "Bhatt Lab Small Dataset",
        "description": "Small intracellular electrophysiology dataset",
        "size_gb": 0.1,
    },
}


def get_summary(dandiset_id: str = "000006") -> Dict[str, Any]:
    """Get a quick summary of a dandiset: name, size, file count, first few files."""
    meta = get_dandiset(dandiset_id)
    assets = list_assets(dandiset_id, page_size=5)
    return {
        "identifier": dandiset_id,
        "name": meta.get("name", ""),
        "asset_count": meta.get("asset_count", 0),
        "total_size_gb": round(meta.get("size", 0) / 1e9, 2),
        "sample_files": assets,
    }
