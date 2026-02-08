# Skill: Allen Brain Atlas Cell Types

## Overview

Access single-neuron characterization data from the Allen Institute.
Contains electrophysiology recordings, morphology reconstructions, and
pre-computed features for mouse and human brain cells.

- **Auth**: None required
- **Format**: JSON via REST API
- **Size**: Individual queries return KB-scale JSON. Single cell files ~50KB-20MB.
- **Python module**: `pipeline/datasets/allen_brain.py`

## When to Use

- You need real neuron electrophysiology data (firing rates, input resistance, rheobase)
- You want to compare neuron properties across brain regions or species
- You need morphology data (dendrite types, soma depth)
- You want structured, tabular data ready for analysis (no file downloads needed)

## Quick Start (Python)

```python
from pipeline.datasets.allen_brain import list_cells, get_ephys_features, search_cells, get_summary_stats

# Get 25 cell specimens with metadata
cells = list_cells(num_rows=25)
print(f"Got {len(cells)} cells")
print(f"First cell species: {cells[0]['donor__species']}")
print(f"First cell region: {cells[0]['structure__name']}")

# Get pre-computed electrophysiology features
features = get_ephys_features(num_rows=50)
# Each feature dict has: specimen_id, rheobase, ri, tau, avg_firing_rate, etc.

# Search by species and brain region
mouse_visp = search_cells(species="Mus musculus", brain_region="VISp", num_rows=20)

# Get summary statistics
stats = get_summary_stats()
print(stats)
# {"total_cells": 100, "species": {"Mus musculus": 80, ...}, "brain_regions": {...}}
```

## Quick Start (raw HTTP -- no Python module needed)

```bash
# List 10 cell specimens
curl "http://api.brain-map.org/api/v2/data/query.json?criteria=model::ApiCellTypesSpecimenDetail&num_rows=10"

# Get electrophysiology features
curl "http://api.brain-map.org/api/v2/data/query.json?criteria=model::EphysFeature&num_rows=10"

# Search mouse cells in primary visual cortex
curl "http://api.brain-map.org/api/v2/data/query.json?criteria=model::ApiCellTypesSpecimenDetail,rma::criteria,[donor__species\$eq'Mus+musculus'],[structure__acronym\$eq'VISp']&num_rows=10"
```

## Available Functions

| Function | Args | Returns |
|----------|------|---------|
| `list_cells(num_rows=25)` | max results | List of cell specimen metadata dicts |
| `get_cell(specimen_id)` | int specimen ID | Single cell metadata dict |
| `get_ephys_features(num_rows=25)` | max results | List of ephys feature dicts (rheobase, ri, tau, etc.) |
| `get_morphology_features(num_rows=25)` | max results | List of morphology reconstruction dicts |
| `search_cells(species, brain_region, num_rows)` | optional filters | Filtered cell list |
| `get_summary_stats(cells)` | optional cell list | Summary counts by species, region, dendrite type |

## Key Data Fields

### Cell Specimen
- `specimen__id` -- unique cell ID
- `donor__species` -- "Mus musculus" or "Homo Sapiens"
- `structure__name` / `structure__acronym` -- brain region (e.g. "Primary visual area" / "VISp")
- `tag__dendrite_type` -- "aspiny", "spiny", "sparsely spiny"
- `line_name` -- transgenic line (mouse)
- `donor__age` -- age of donor

### Electrophysiology Features
- `specimen_id` -- links to cell specimen
- `rheobase` -- minimum current to elicit spike (pA)
- `ri` -- input resistance (MOhm)
- `tau` -- membrane time constant (ms)
- `avg_firing_rate` -- average firing rate (Hz)
- `adaptation` -- spike frequency adaptation ratio
- `f_i_curve_slope` -- slope of frequency-current curve

## Example: Research Iteration

```python
from pipeline.datasets.allen_brain import search_cells, get_ephys_features

# Hypothesis: "Spiny neurons in VISp have lower input resistance than aspiny neurons"
cells = search_cells(species="Mus musculus", brain_region="VISp", num_rows=100)
spiny = [c for c in cells if c.get("tag__dendrite_type") == "spiny"]
aspiny = [c for c in cells if c.get("tag__dendrite_type") == "aspiny"]

features = get_ephys_features(num_rows=500)
feat_map = {f["specimen_id"]: f for f in features}

spiny_ri = [feat_map[c["specimen__id"]]["ri"] for c in spiny if c["specimen__id"] in feat_map and feat_map[c["specimen__id"]].get("ri")]
aspiny_ri = [feat_map[c["specimen__id"]]["ri"] for c in aspiny if c["specimen__id"] in feat_map and feat_map[c["specimen__id"]].get("ri")]

print(f"Spiny mean Ri: {sum(spiny_ri)/len(spiny_ri):.1f} MOhm (n={len(spiny_ri)})")
print(f"Aspiny mean Ri: {sum(aspiny_ri)/len(aspiny_ri):.1f} MOhm (n={len(aspiny_ri)})")
# Use these real numbers in your paper
```

## Rate Limits

The Allen Brain Map API has no documented rate limits for reasonable use.
Keep queries under ~1000 rows per request. No API key needed.
