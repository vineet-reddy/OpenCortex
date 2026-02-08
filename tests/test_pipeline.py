import json
import tempfile
import unittest
from pathlib import Path

from pipeline.claim_extract import extract_claims
from pipeline.extract import run_pipeline
from pipeline.text_extract import extract_metadata_from_tex, parse_latex_sections


TEX_SAMPLE = r"""
\title{Neural Circuit Discovery}
\author{A. Researcher, B. Scientist}
\date{2024}

\begin{abstract}
We propose a novel circuit model for hippocampal memory encoding.
\end{abstract}

\section{Introduction}
We introduce a new hippocampal circuit hypothesis. We show it explains behavior.

\section{Results}
We demonstrate a significant improvement (p < 0.01) in decoding accuracy.

\section{Conclusion}
We report previously unknown synaptic dynamics.
"""


class PipelineTests(unittest.TestCase):
    def test_metadata_and_sections_from_tex(self) -> None:
        metadata = extract_metadata_from_tex(TEX_SAMPLE)
        self.assertEqual(metadata.title, "Neural Circuit Discovery")
        self.assertIn("Researcher", metadata.authors or "")
        self.assertEqual(metadata.year, "2024")

        sections = parse_latex_sections(TEX_SAMPLE)
        names = [s.name for s in sections]
        self.assertIn("abstract", names)
        self.assertIn("introduction", names)
        self.assertIn("results", names)

    def test_claim_extraction_detects_cues(self) -> None:
        claims = extract_claims("results", "We demonstrate a significant improvement (p < 0.01).", None, "tex")
        self.assertTrue(any("demonstrate" in c.cues[0] for c in claims))
        self.assertGreaterEqual(len(claims), 1)

    def test_run_pipeline_tex_only(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tex_path = Path(temp_dir) / "paper.tex"
            tex_path.write_text(TEX_SAMPLE, encoding="utf-8")

            result = run_pipeline(pdf_path=None, tex_path=tex_path, top_key_ideas=3, top_breakthroughs=2)
            data = result.to_dict()

            self.assertEqual(data["metadata"]["title"], "Neural Circuit Discovery")
            self.assertGreaterEqual(len(data["key_ideas"]), 1)
            self.assertIsInstance(json.dumps(data), str)


if __name__ == "__main__":
    unittest.main()
