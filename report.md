# Untitled Paper

## Key Ideas
- (2) The base model entropy- accuracy relationship is reshaped: for Mbase, higher en- tropy monotonically reduces accuracy, but for MRL-base, ac- curacy first declines then recovers with increasing entropy, as shown in Figure 6(b), indicating that moderate uncer- tainty supports productive exploration. (pdf_page, p.8, cues: first)
- These case studies provide visual evidence for our main findings: (1) Round-1 dynamics are critical: entropy patterns established in the first round largely persist or determine the trajectory in round 2; (2) Moderate, stable entropy correlates with success: both excessively high entropy (erratic reasoning) and near-zero entropy (premature collapse) predict failure; (3) Model family shapes uncertainty style: Qwen and LLaMA exhibit distinct entropy profiles that influence MAS effectiveness across different tasks. (pdf_page, p.28, cues: first)
- Prior work shows MAS performance depends on Mbase capa- bility (Zhang et al., 2025c), a trend we also observe in Figure 1; moreover, we find that Mbase uncertainty further constrains MAS effectiveness. (pdf_page, p.4, cues: we find)
- Comparing R = 2 and R = 5, we find that extending delib- eration rarely improves performance and often harms it, even at the cost of higher token consumption, as shown in Figure 5(a). (pdf_page, p.7, cues: we find)
- By analyzing 245 features span- ning token-, trajectory-, and round-level entropy, we counterintuitively find that a single agent out- performs MAS in approximately 43.3% of cases, and that uncertainty dynamics are largely deter- mined during the first round of interaction. (pdf_page, p.1, cues: first)

## Breakthroughs
- (2) The base model entropy- accuracy relationship is reshaped: for Mbase, higher en- tropy monotonically reduces accuracy, but for MRL-base, ac- curacy first declines then recovers with increasing entropy, as shown in Figure 6(b), indicating that moderate uncer- tainty supports productive exploration. (pdf_page, p.8, cues: first)
- These case studies provide visual evidence for our main findings: (1) Round-1 dynamics are critical: entropy patterns established in the first round largely persist or determine the trajectory in round 2; (2) Moderate, stable entropy correlates with success: both excessively high entropy (erratic reasoning) and near-zero entropy (premature collapse) predict failure; (3) Model family shapes uncertainty style: Qwen and LLaMA exhibit distinct entropy profiles that influence MAS effectiveness across different tasks. (pdf_page, p.28, cues: first)
- By analyzing 245 features span- ning token-, trajectory-, and round-level entropy, we counterintuitively find that a single agent out- performs MAS in approximately 43.3% of cases, and that uncertainty dynamics are largely deter- mined during the first round of interaction. (pdf_page, p.1, cues: first)

## Leaderboard Fields (stub)
- impact_score: None
- pagerank_score: None
- novelty_score: None
- evidence_score: None