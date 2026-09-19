"""llm.py — provider-agnostic LLM access for zhiying.

The point of this module: an agent-driven pipeline must not be welded to
one vendor. Everything here speaks the two interfaces that cover
practically the whole market:

  - OpenAI-compatible  /chat/completions  (DeepSeek, OpenAI, Gemini's
    compat endpoint, OpenRouter, vLLM, LM Studio, ... ) — one base_url +
    key + model triple.
  - Ollama  /api/chat  (fully local, no key, http://127.0.0.1:11434).

Selection is by explicit argument or env:
    ZHIYING_LLM_PROVIDER = openai_compatible | ollama   (default: auto)
    ZHIYING_LLM_BASE_URL, ZHIYING_LLM_API_KEY, ZHIYING_LLM_MODEL
    OLLAMA_HOST (default http://127.0.0.1:11434)

"auto" prefers an explicitly configured openai_compatible endpoint, then
falls back to a running local Ollama — so a fresh clone works with zero
keys if the machine has Ollama, and switches to a cloud model by setting
env vars, with no code change.

No retries/failover chains: a stage that can't get a model should fail
loudly and let the agent decide (that decision is the agent's job, see
AGENT_GUIDE.md), not silently degrade into a different model's output.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


def _normalize_ollama_host(raw: str) -> str:
    """OLLAMA_HOST is a *server bind* setting on many machines (e.g.
    "0.0.0.0:11435"), which is not a usable client URL. Normalize it:
    add a scheme if missing, and map bind-all addresses to loopback.
    (Found live 2026-09-16: an unnormalized 0.0.0.0:11435 made urlopen
    fail with "unknown url type".)"""
    host = (raw or "").strip().rstrip("/")
    if not host:
        host = "http://127.0.0.1:11434"
    if "://" not in host:
        host = f"http://{host}"
    for bind_all in ("0.0.0.0", "[::]", "::"):
        if f"//{bind_all}" in host:
            host = host.replace(f"//{bind_all}", "//127.0.0.1")
    return host


class LLMError(RuntimeError):
    pass


@dataclass
class LLMResponse:
    text: str
    model: str
    provider: str
    raw: dict[str, Any]


def _post_json(url: str, payload: dict[str, Any], headers: dict[str, str], timeout: float) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:500]
        raise LLMError(f"{url} returned HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise LLMError(f"cannot reach {url}: {exc.reason}") from exc


class LLMClient:
    """One call surface: complete(messages) -> LLMResponse.

    messages: OpenAI-style [{"role": "system"|"user"|"assistant",
    "content": "..."}].
    """

    def __init__(
        self,
        provider: str | None = None,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
        timeout: float = 180.0,
    ) -> None:
        self.provider = (provider or os.environ.get("ZHIYING_LLM_PROVIDER") or "auto").lower()
        self.base_url = (base_url or os.environ.get("ZHIYING_LLM_BASE_URL") or "").rstrip("/")
        self.api_key = api_key or os.environ.get("ZHIYING_LLM_API_KEY") or ""
        self.model = model or os.environ.get("ZHIYING_LLM_MODEL") or ""
        self.timeout = timeout
        self.ollama_host = _normalize_ollama_host(os.environ.get("OLLAMA_HOST") or "")

        if self.provider == "auto":
            if self.base_url and self.api_key:
                self.provider = "openai_compatible"
            else:
                self.provider = "ollama"

        if self.provider == "openai_compatible":
            if not self.base_url or not self.api_key:
                raise LLMError(
                    "openai_compatible needs ZHIYING_LLM_BASE_URL and ZHIYING_LLM_API_KEY "
                    "(e.g. https://api.deepseek.com, or any OpenAI-compatible gateway)"
                )
            if not self.model:
                raise LLMError("openai_compatible needs ZHIYING_LLM_MODEL (e.g. deepseek-chat)")
        elif self.provider == "ollama":
            if not self.model:
                # Pick the first locally available model rather than
                # guessing a name that may not be pulled.
                self.model = self._first_ollama_model()
        else:
            raise LLMError(f"unknown provider {self.provider!r}; use openai_compatible or ollama")

    # -- ollama helpers -----------------------------------------------------
    def _first_ollama_model(self) -> str:
        try:
            with urllib.request.urlopen(f"{self.ollama_host}/api/tags", timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            raise LLMError(f"no ZHIYING_LLM_MODEL set and cannot list Ollama models at {self.ollama_host}: {exc}") from exc
        models = [m.get("name") for m in data.get("models", []) if m.get("name")]
        if not models:
            raise LLMError(f"Ollama at {self.ollama_host} has no models pulled")
        # Prefer a general instruct model over reasoning-only ones when both exist.
        for pref in ("qwen3:14b", "qwen3:8b", "llama3", "mistral"):
            for m in models:
                if m.startswith(pref):
                    return m
        return models[0]

    # -- the one call surface ----------------------------------------------
    def complete(self, messages: list[dict[str, str]], temperature: float = 0.4, think: bool | None = None) -> LLMResponse:
        if self.provider == "ollama":
            payload = {
                "model": self.model,
                "messages": messages,
                "stream": False,
                "options": {"temperature": temperature},
            }
            # Ollama >=0.9 accepts "think" for thinking-capable models
            # (qwen3 etc.). None = leave the server default; False = skip
            # chain-of-thought for long authoring jobs where it only burns
            # minutes (added for the review-audio run, 2026-09-19).
            if think is not None:
                payload["think"] = think
            data = _post_json(f"{self.ollama_host}/api/chat", payload, {}, self.timeout)
            text = (data.get("message") or {}).get("content", "")
            return LLMResponse(text=text, model=self.model, provider="ollama", raw=data)

        payload = {"model": self.model, "messages": messages, "temperature": temperature, "stream": False}
        data = _post_json(
            f"{self.base_url}/chat/completions",
            payload,
            {"Authorization": f"Bearer {self.api_key}"},
            self.timeout,
        )
        choices = data.get("choices") or []
        if not choices:
            raise LLMError(f"no choices in response: {str(data)[:300]}")
        return LLMResponse(
            text=(choices[0].get("message") or {}).get("content", ""),
            model=self.model,
            provider="openai_compatible",
            raw=data,
        )

    def complete_json(self, messages: list[dict[str, str]], temperature: float = 0.2) -> tuple[dict[str, Any], LLMResponse]:
        """complete() + tolerant JSON extraction. Models wrap JSON in prose
        or fences often enough that a strict json.loads is not enough; we
        take the outermost {...} block and parse that. Raises LLMError with
        the raw text if nothing parses -- the caller (agent) decides what to
        do, we don't invent a fallback."""
        resp = self.complete(messages, temperature=temperature)
        text = resp.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1] if "```" in text[3:] else text[3:]
            text = text.lstrip("json").strip()
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise LLMError(f"model returned no JSON object. Raw text:\n{resp.text[:800]}")
        try:
            return json.loads(text[start : end + 1]), resp
        except json.JSONDecodeError as exc:
            raise LLMError(f"model JSON did not parse ({exc}). Raw text:\n{resp.text[:800]}") from exc

    def describe_target(self) -> dict[str, str]:
        return {"provider": self.provider, "model": self.model,
                "base_url": self.base_url or self.ollama_host}
