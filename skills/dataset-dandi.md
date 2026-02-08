# Skill: DANDI Archive

## Overview

Search and browse the DANDI Archive -- the BRAIN Initiative's primary repository
for cellular neurophysiology data. Contains 1000+ dandisets with electrophysiology,
calcium imaging, and behavioral data in NWB format.

- **Auth**: None required for reading public data
- **Format**: JSON metadata via REST API, NWB data files via S3
- **Size**: Metadata queries are KB-scale. Individual NWB files range 50KB-50MB.
- **Python module**: `pipeline/datasets/dandi.py`
- **Swagger UI**: https://api.dandiarchive.org/swagger/

## When to Use

- You want to search for datasets by keyword (e.g. "hippocampus", "fear conditioning")
- You need to browse what neurophysiology data exists for a topic
- You want metadata about experiments (species, methods, sample sizes)
- You need download URLs for NWB files for deeper analysis

## Quick Start (Python)

```python
from pipeline.datasets.dandi import list_dandisets, search_dandisets, get_summary, list_assets

# List recent dandisets
recent = list_dandisets(page_size=5)
for ds in recent:
    print(f"  {ds['identifier']}: {ds['name']} ({ds['size_gb']} GB, {ds['asset_count']} files)")

# Search by keyword
hippo = search_dandisets("hippocampus", page_size=5)
for ds in hippo:
    print(f"  {ds['identifier']}: {ds['name']}")

# Get summary of a specific dandiset
summary = get_summary("000006")
print(f"Name: {summary['name']}")
print(f"Files: {summary['asset_count']}, Size: {summary['total_size_gb']} GB")
for f in summary['sample_files']:
    print(f"  {f['path']} ({f['size_mb']} MB)")

# List files in a dandiset
files = list_assets("000006", page_size=10)
```

## Quick Start (raw HTTP -- no Python module needed)

```bash
# List 5 recent dandisets
curl "https://api.dandiarchive.org/api/dandisets/?page_size=5&ordering=-created"

# Search by keyword
curl "https://api.dandiarchive.org/api/dandisets/?search=hippocampus&page_size=5"

# Get dandiset metadata
curl "https://api.dandiarchive.org/api/dandisets/000006/versions/draft/"

# List files in a dandiset
curl "https://api.dandiarchive.org/api/dandisets/000006/versions/draft/assets/?page_size=5"
```

## Available Functions

| Function | Args | Returns |
|----------|------|---------|
| `list_dandisets(page_size, ordering, search)` | pagination + optional keyword | List of simplified dandiset dicts |
| `get_dandiset(dandiset_id, version)` | ID + version ("draft") | Full dandiset metadata dict |
| `list_assets(dandiset_id, version, page_size, path_prefix)` | ID + filters | List of asset dicts (path, size, id) |
| `get_asset_download_url(dandiset_id, asset_id, version)` | IDs | Direct S3 download URL string |
| `search_dandisets(query, page_size)` | keyword + max results | List of matching dandiset dicts |
| `get_summary(dandiset_id)` | ID (default "000006") | Name, size, file count, sample files |

## Recommended Small Dandisets

These are small enough for quick iteration during a hackathon:

| ID | Name | Size | Good for |
|----|------|------|----------|
| `000003` | Tolias Lab Calcium Imaging | ~0.3 GB | Visual cortex two-photon imaging |
| `000004` | Bhatt Lab Intracellular | ~0.1 GB | Small intracellular ephys |
| `000006` | Mouse Electrophysiology | ~1.4 GB | Many small NWB files, good variety |

Access the recommendations programmatically:
```python
from pipeline.datasets.dandi import RECOMMENDED_DANDISETS
print(RECOMMENDED_DANDISETS)
```

## Key Data Fields

### Dandiset (from list_dandisets)
- `identifier` -- dandiset ID (e.g. "000006")
- `name` -- human-readable name
- `size_gb` -- total size in gigabytes
- `asset_count` -- number of NWB files
- `created` / `modified` -- timestamps

### Asset (from list_assets)
- `asset_id` -- unique asset identifier
- `path` -- file path within dandiset (e.g. "sub-anm372795/sub-anm372795_ses-20170718.nwb")
- `size_mb` -- file size in megabytes

## Example: Research Iteration

```python
from pipeline.datasets.dandi import search_dandisets, get_summary, list_assets

# Exploring fear conditioning data
results = search_dandisets("fear conditioning")
print(f"Found {len(results)} dandisets about fear conditioning")
for ds in results:
    print(f"  {ds['identifier']}: {ds['name']} ({ds['asset_count']} files, {ds['size_gb']} GB)")

# Dive into the most relevant one
if results:
    best = results[0]
    summary = get_summary(best['identifier'])
    print(f"\nBest match: {summary['name']}")
    print(f"Contains {summary['asset_count']} NWB files")

    # List actual data files
    files = list_assets(best['identifier'], page_size=20)
    for f in files:
        print(f"  {f['path']} ({f['size_mb']} MB)")

# Use the metadata (file counts, sizes, species, recording types)
# to ground your paper's methods section with real dataset references
```

## Rate Limits

DANDI API has no strict rate limits for reasonable read access.
Keep page sizes under 100 and avoid rapid-fire requests.
