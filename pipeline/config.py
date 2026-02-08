import re
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class Section:
    name: str
    text: str
    page: Optional[int] = None


SECTION_ALIASES: Dict[str, str] = {
    "abstract": "abstract",
    "introduction": "introduction",
    "background": "background",
    "related work": "related_work",
    "methods": "methods",
    "method": "methods",
    "materials and methods": "methods",
    "results": "results",
    "discussion": "discussion",
    "conclusion": "conclusion",
}


SECTION_WEIGHTS: Dict[str, float] = {
    "abstract": 1.2,
    "introduction": 1.0,
    "background": 0.7,
    "related_work": 0.6,
    "methods": 0.9,
    "results": 1.3,
    "discussion": 1.1,
    "conclusion": 1.0,
    "other": 0.8,
}


CUE_PHRASES: List[str] = [
    "we propose",
    "we introduce",
    "we present",
    "we show",
    "we demonstrate",
    "we discover",
    "we report",
    "we find",
    "we identify",
    "novel",
    "first",
    "new",
    "previously unknown",
    "outperforms",
    "significant improvement",
]

BREAKTHROUGH_CUES: List[str] = [
    "first",
    "novel",
    "previously unknown",
    "unprecedented",
    "paradigm",
    "breakthrough",
    "major",
    "substantial",
    "large-scale",
]

EVIDENCE_PATTERNS: List[re.Pattern] = [
    re.compile(r"p\s*<\s*0\.\d+"),
    re.compile(r"p\s*=\s*0\.\d+"),
    re.compile(r"\b\d+(\.\d+)?%\b"),
    re.compile(r"\bCI\b"),
    re.compile(r"\bF\(\d+,\s*\d+\)"),
    re.compile(r"\bt\(\d+\)"),
]

NEUROSCIENCE_KEYWORDS: List[str] = [
    "neuron",
    "neurons",
    "synapse",
    "synaptic",
    "cortex",
    "hippocampus",
    "amygdala",
    "striatum",
    "thalamus",
    "prefrontal",
    "glia",
    "astrocyte",
    "microglia",
    "spike",
    "spiking",
    "action potential",
    "membrane potential",
    "neurotransmitter",
    "dopamine",
    "serotonin",
    "gaba",
    "glutamate",
    "plasticity",
    "ltp",
    "ltd",
    "connectome",
    "circuit",
    "oscillation",
    "eeg",
    "fmri",
    "calcium imaging",
    "optogenetics",
    "whole-cell",
]
