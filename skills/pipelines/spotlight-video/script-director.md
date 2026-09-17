# Stage: script director (spotlight-video)

Goal: one `spotlight_script` artifact — the authored VALUES for the card —
produced by whichever LLM is configured, and validated before it reaches
the renderer.

## Procedure

1. Load the `brief` checkpoint.
2. Configure the model (no code change needed — see `lib/llm.py`):
   - **Any OpenAI-compatible API**: set `ZHIYING_LLM_BASE_URL`,
     `ZHIYING_LLM_API_KEY`, `ZHIYING_LLM_MODEL`
     (DeepSeek `https://api.deepseek.com`, OpenRouter, vLLM, LM Studio…).
   - **Local, free, no key**: leave them unset; the loader picks a running
     Ollama (`OLLAMA_HOST`, auto-normalized) and a sensible local model.
   - Note for vision-capable endpoints (e.g. a DeepSeek
     `*-vision*` model): text-only models are fine here — this stage
     writes text, it doesn't look at images. Image work belongs to the
     QC/demo-image steps.
3. Call `spotlight_author` with the brief's topic, language, index/total,
   brand. It builds the prompt, calls the model, extracts JSON, fills
   defaults and validates against `schemas/artifacts/spotlight_script.schema.json`.
4. **Read the returned subtitle out loud.** The one failure mode that
   matters: generic marketing filler. If the subtitle would fit any
   project, re-run with the takeaway from the brief injected explicitly
   (the tool accepts free-form `request` text — put the facts there).
   This is a judgment call the agent makes; the schema cannot detect it.
5. Star count: if the brief says unknown, keep 0. Never let the model
   guess a real repo's count — the render shows it to viewers as fact.
6. Checkpoint `spotlight_script` with the props (plus which provider/model
   produced them, for auditability).

## Retry policy

The model's JSON may fail validation or read badly — retry once with a
tightened request, then surface the raw output to the user. Do not fall
back to a different model silently: switching models is a decision the
user should see (AGENT_GUIDE's "no hidden degradation" rule).
