# Local model evaluation

This evaluation compares locally served language models for generating playable guitar chord progressions from selected vibe labels. It is a screening tool: the rubric is deterministic and inspectable, but its tonal and vibe checks are proxies for musical quality.

## Gates and scoring

Each scored response must parse as the exact structured output, resolve to supported guitar chords, contain 3–8 chords, and include at least two distinct chords. This is the **valid/playable gate**; the required rate is 100%. A progression also passes the **proxy gate** only when its requested vibe expectations pass and its harmony is coherent: at least 75% of whole chords must fit one common major or natural-minor scale, or a blues progression must use all and only I, IV, and V as dominant sevenths. Vibe checks cover minor harmony for dark/melancholy cases, a major opening for joyful/hopeful cases, sevenths for jazz/neo-soul, and triads for folk/pop. The required proxy-pass rate is 80%. The corpus must also produce at least three distinct exact ordered progressions.

The 14-case corpus includes nine single-vibe cases, one vague era/setting/energy case with no additional vibe assertion, and four combination holdouts. Holdouts are generated from catalog combinations and are not prompt examples. A model is eligible only if it passes all three gates. The runner returns no winner if none qualify.

## Reproduce the five-model run

Install the five model tags listed below in Ollama, start Ollama, then run from the repository root:

```sh
npm run eval:models -- --models qwen2.5:0.5b-instruct-q4_K_M,qwen2.5:1.5b-instruct-q4_K_M,qwen3:4b-q4_K_M,qwen3.5:2b-nvfp4,granite4:micro --runs 3 --out evals/results/final-five-models.json
```

The runner uses temperature 0.2, context 2048, prediction limit 128, thinking disabled, a five-minute keep-alive, concurrency 1, and seeds 4242–4244. For each model it records a first request and a discarded warmup, then scores every one of the 14 cases at each seed (42 scored samples per model). Warm wall-time percentiles include scored requests, including failures, and exclude the first request and warmup. Percentiles use nearest rank. The report includes installed/loaded model metadata, host details, the Ollama API version, and a SHA-256 fingerprint of the exact prompt template (with the selected-vibe placeholder). The original-prompt report predates those fields; its prompt source is commit `6c9cfad`, and the recorded benchmark environment used Ollama 0.40.2. The initial shortlist report is the same tuned-prompt capture as the tuned-iteration report; both carry version and prompt fingerprint as post-run provenance metadata. The final report recorded them at capture. The command exits nonzero when no model clears the gates; that is an evaluation result, not a runner failure.

## Five-model results

Captured on an M3 Max with 16 logical CPUs and 48 GiB RAM. All five produced 42 valid/playable outputs with zero request failures, but none met the 0.80 proxy gate. Therefore there is **no winner and no default-model change**.

| Candidate (Ollama tag) | Weights on disk | Ollama residency | Valid / failures | Proxy pass | Warm p50 / p95 (ms) | License and source |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `qwen2.5:0.5b-instruct-q4_K_M` | 397,821,319 B | 452,691,229 B | 42/42 · 0 | 0.190476 | 204.5 / 238.4 | Apache 2.0 · [Ollama model and tags](https://ollama.com/library/qwen2.5/tags) · [Qwen2.5 model card](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct) · [license](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/blob/main/LICENSE) |
| `qwen2.5:1.5b-instruct-q4_K_M` | 986 MB | 1,102,263,090 B | 42/42 · 0 | 0.309524 | 274.0 / 333.8 | Apache 2.0 · [Ollama model and tags](https://ollama.com/library/qwen2.5/tags) · [Qwen2.5 model card](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct) · [license](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct/blob/main/LICENSE) |
| `qwen3:4b-q4_K_M` | 2.6 GB | 2,989,175,602 B | 42/42 · 0 | 0.238095 | 591.0 / 740.9 | Apache 2.0 · [Ollama Qwen3 tags](https://ollama.com/library/qwen3/tags) · [Qwen3-4B model card](https://huggingface.co/Qwen/Qwen3-4B) · [license](https://huggingface.co/Qwen/Qwen3-4B/blob/main/LICENSE) |
| `qwen3.5:2b-nvfp4` | 2.5 GB | 3,829,490,000 B | 42/42 · 0 | 0.476190 | 263.4 / 334.5 | Apache 2.0 · MLX, Mac only · [Ollama tag](https://ollama.com/library/qwen3.5/tags) · [Qwen3.5-2B model card](https://huggingface.co/Qwen/Qwen3.5-2B) · [license](https://huggingface.co/Qwen/Qwen3.5-2B/blob/main/LICENSE) |
| `granite4:micro` | 2.1 GB | 2,326,632,856 B | 42/42 · 0 | 0.785714 | 320.8 / 517.3 | Apache 2.0 · [Ollama Granite4 tags](https://ollama.com/library/granite4/tags) · [Granite 4.0 Micro model card](https://huggingface.co/ibm-granite/granite-4.0-micro) · [license](https://huggingface.co/ibm-granite/granite-4.0-micro/blob/main/LICENSE) |

“Weights on disk” comes from the installed model metadata (human-readable rounded sizes where provided); “Ollama residency” is the loaded size reported by `ollama ps`/`/api/ps`, not process RSS or total memory use. The exact run report is [final-five-models.json](results/final-five-models.json). An earlier three-candidate report is [local-model-benchmark.json](results/local-model-benchmark.json).

## Prompt iteration

The original prompt gave compact category rules: minor harmony for dark/melancholy moods, major harmony for joyful/hopeful moods, sevenths for jazz/neo-soul, and I–IV–V dominant sevenths for blues. The tuned prompt made the rules explicit: pick one tonal center and keep chords inside one major or natural-minor scale; choose minor or major centers for the corresponding moods and start joyful/hopeful progressions on a major chord; use in-key sevenths for jazz/neo-soul; prefer triads without sevenths for folk/pop; and restrict blues to dominant sevenths on I, IV, and V.

On the same three candidates, 14 cases, three seeds, and sampling settings, the proxy pass rates changed as follows:

| Model | Original prompt | Tuned prompt |
| --- | ---: | ---: |
| Qwen2.5 0.5B | 0.071429 | 0.190476 |
| Qwen2.5 1.5B | 0.285714 | 0.309524 |
| Qwen3 4B | 0.119048 | 0.238095 |

The tuning improved the measured proxy rates, especially for the 0.5B and Qwen3 runs, but no candidate passed the gate. These are finite-run observations, not evidence that the prompt change will improve other models or unseen inputs. See the [original prompt report](results/prompt-original.json) and [tuned iteration report](results/prompt-tuned-iteration1.json); `local-model-benchmark.json` is a second copy of that same tuned capture. New reports' `prompt.templateSha256` identifies the exact template; `ollama.version` records the local server version.

## Runtime comparison

The native/container reports compare the same application container and 14 cases with `qwen2.5:1.5b`, one scored repetition, temperature 0.2, context 2048, prediction limit 128, and seed 4242. On the M3 Max, native Ollama reported 100% GPU residency at context 2048, with p50 282.7 ms, p95 335.1 ms, and zero failures. The container Ollama CPU run reported 100% CPU residency at context 2048, with p50 2,729.1 ms, p95 3,814.2 ms, and zero failures. These single-run numbers are directional for this setup; they do not establish general native-versus-container performance. Raw reports: [native](results/runtime-native.json) and [container](results/runtime-container.json).

## Limits

The auto-scored checks cannot judge whether a progression sounds good, suits a vibe, or is comfortable to play in context. The common-scale heuristic can penalize intentional borrowed harmony; the blues rule is intentionally narrow. Results apply only to this shortlist, prompt, corpus, quantizations, runtime configuration, and M3 Max. Three scored repetitions per case are a small sample, and warm latency does not include a truly cold load: the runner does not unload a model between requests. Residency bytes are Ollama's loaded-model estimate, not process RSS or system memory. The runtime comparison has only one scored repetition per case. Listen to examples and use human musical review before choosing a production default.
