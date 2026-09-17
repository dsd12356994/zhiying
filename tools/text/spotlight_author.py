from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from tools.base_tool import BaseTool, ToolResult, ToolRuntime, ToolTier

# The authoring contract: an LLM (any provider — see lib/llm.py) turns a
# plain-language request into ONE project_spotlight cut's props. Keeping the
# model's output constrained to this shape is what makes "any AI API" safe:
# the model never writes code or arbitrary props, only values in a schema we
# validate before rendering (schemas/artifacts/spotlight_script.schema.json).
_SYSTEM_PROMPT = """You are the script author for a vertical (720x1280) short-video series
that spotlights open-source projects, one project per episode.

Output ONLY a JSON object, no prose, matching exactly this shape:
{
  "index": <int, episode number >= 1>,
  "total": <int, total episodes >= index>,
  "name": "<project name, latin/ascii, kebab-case if it is a repo name>",
  "stars": <int, GitHub star count, 0 if unknown>,
  "tags": ["<3-4 short keyword tags>"],
  "demoTitle": "<short title of the demo view shown in the dark panel>",
  "demoFooter": "<right-aligned caption under the demo, e.g. '<name> official demo'>",
  "subtitle": "<one sentence subtitle in the requested language that explains what the project does or what the viewer is looking at>",
  "brand": "<the channel brand string>"
}

Rules:
- Language of "tags" and "subtitle": {lang_name}. "name", "demoTitle" and
  "demoFooter" stay in English/latin.
- "subtitle" must be concrete and specific to THIS project, never generic
  marketing filler ("a powerful tool that changes everything" is forbidden).
- "tags" are topical keywords a viewer would search, not adjectives.
- Never invent a star count for a named real project if you do not know it;
  use 0 and the caller will display the count as unknown.
- Keep "subtitle" under 40 characters for {lang_name}; it renders inside a pill.
"""


class SpotlightAuthorTool(BaseTool):
    """LLM -> spotlight script props (provider-agnostic via lib/llm.py).

    This is the "接任何 AI 的 API" tool: point ZHIYING_LLM_* at DeepSeek /
    OpenAI / any OpenAI-compatible gateway, or leave them unset to use a
    local Ollama. The model's job is authoring VALUES, never code — the
    composition is the repo's, so output quality is bounded by the
    template, not by the model's ability to write React.
    """

    name = "spotlight_author"
    capability = "scene_authoring"
    provider = "llm"
    tier = ToolTier.LOCAL  # cost depends on the endpoint; local Ollama = free
    runtime = ToolRuntime.PYTHON
    description = (
        "Turn a plain-language project description into validated "
        "project_spotlight props (index/name/stars/tags/demo/subtitle) "
        "using whichever LLM endpoint is configured."
    )
    best_for = [
        "authoring spotlight episodes from a topic or repo description",
        "any LLM vendor (OpenAI-compatible) or a fully local Ollama",
    ]
    not_good_for = [
        "free-form scene code generation -- the template is fixed on purpose",
    ]
    dependencies = []

    def execute(
        self,
        request: str,
        lang: str = "zh",
        index: int | None = None,
        total: int | None = None,
        brand: str = "Oraink",
        provider: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
        api_key: str | None = None,
    ) -> ToolResult:
        from lib.llm import LLMClient, LLMError

        lang_name = {"zh": "Simplified Chinese", "zh-TW": "Traditional Chinese", "en": "English"}.get(lang, lang)
        try:
            client = LLMClient(provider=provider, base_url=base_url, api_key=api_key, model=model)
        except LLMError as exc:
            return ToolResult(success=False, error=str(exc))

        user = f"Request: {request}\nBrand: {brand}\n"
        if index is not None:
            user += f"Episode index: {index}\n"
        if total is not None:
            user += f"Total episodes: {total}\n"

        messages = [
            {"role": "system", "content": _SYSTEM_PROMPT.replace("{lang_name}", lang_name)},
            {"role": "user", "content": user},
        ]
        try:
            props, resp = client.complete_json(messages)
        except LLMError as exc:
            return ToolResult(success=False, error=str(exc), metadata={"llm": client.describe_target()})

        # Fill/normalize the fields the model may omit, then validate.
        props.setdefault("index", index or 1)
        props.setdefault("total", total or props.get("index", 1))
        props.setdefault("brand", brand)
        props.setdefault("demoFooter", f"{props.get('name', 'project')} official demo")
        props["type"] = "project_spotlight"

        errors = _validate(props)
        if errors:
            return ToolResult(
                success=False,
                error="model output failed schema validation: " + "; ".join(errors),
                metadata={"llm": client.describe_target(), "raw_props": props},
            )

        return ToolResult(
            success=True,
            metadata={
                "props": props,
                "llm": resp.provider,
                "model": resp.model,
                "usage": (resp.raw.get("usage") if isinstance(resp.raw, dict) else None),
            },
        )

    def dry_run(self, **kwargs: Any) -> ToolResult:  # pragma: no cover - introspection only
        return ToolResult(success=True, metadata={"dry_run": True, "would_call": "lib/llm.py LLMClient.complete_json"})

    def estimate_cost(self, **kwargs: Any) -> float:
        return 0.0  # local Ollama path; cloud cost is the endpoint's, tracked by the caller


_REQUIRED = {
    "index": int,
    "total": int,
    "name": str,
    "stars": int,
    "tags": list,
    "demoTitle": str,
    "subtitle": str,
    "brand": str,
}


def _validate(props: dict[str, Any]) -> list[str]:
    """Validates against schemas/artifacts/spotlight_script.schema.json (the
    single source of truth) and returns a flat error list."""
    import jsonschema

    root = Path(__file__).resolve().parents[2]
    schema_path = root / "schemas" / "artifacts" / "spotlight_script.schema.json"
    with open(schema_path, encoding="utf-8") as fh:
        schema = json.load(fh)
    validator = jsonschema.Draft202012Validator(schema)
    return [
        f"{'/'.join(str(p) for p in err.path) or '<root>'}: {err.message}"
        for err in sorted(validator.iter_errors(props), key=lambda e: list(e.path))
    ]
