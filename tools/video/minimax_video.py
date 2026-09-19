from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from tools.base_tool import BaseTool, ToolResult, ToolRuntime, ToolTier

# API contract transcribed from MiniMax's own MCP server source
# (MiniMax-AI/MiniMax-MCP: server.py/client.py/const.py, read 2026-09-19):
#   POST {host}/v1/video_generation            {model,prompt[,duration,resolution,first_frame_image]} -> task_id
#   GET  {host}/v1/query/video_generation?task_id=...   -> status Prepare|Queueing|Processing|Success|Fail, file_id
#   GET  {host}/v1/files/retrieve?file_id=...           -> file.download_url
# Auth: Authorization: Bearer <key>. Errors come back HTTP-200 with
# base_resp.status_code != 0 (1004 = bad key, 2038 = real-name verification
# required on the platform).
_DEFAULT_HOST = "https://api.minimaxi.com"  # CN platform; intl uses api.minimax.io

MODELS = {
    "MiniMax-Hailuo-2.3": "latest default per official MCP consts",
    "MiniMax-Hailuo-02": "previous gen; duration 6|10, resolution 768P|1080P",
    "T2V-01": "legacy text-to-video",
    "T2V-01-Director": "legacy + [Pan left]/[Push in] camera instructions",
    "I2V-01": "image-to-video (needs first_frame_image)",
    "I2V-01-Director": "image-to-video + camera instructions",
    "I2V-01-live": "image-to-video, live (first frame kept)",
}


def _http_json(url: str, api_key: str, payload: dict[str, Any] | None) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code} from {url}: {exc.read().decode('utf-8', 'replace')[:300]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"cannot reach {url}: {exc.reason}") from exc
    base = body.get("base_resp") or {}
    if base.get("status_code", 0) != 0:
        raise RuntimeError(
            f"MiniMax API error {base.get('status_code')}: {base.get('status_msg')} "
            "(1004 = check MINIMAX_API_KEY/HOST; 2038 = complete real-name verification "
            "on platform.minimaxi.com)"
        )
    return body


class MinimaxVideoTool(BaseTool):
    """AI video generation via MiniMax (Hailuo) — the generation leg of
    "MiniMax 生成动画讲解 + zhiying 剪辑" (user request 2026-09-19).

    Synchronous submit->poll->download in one execute() call. Cost is real
    money per clip — the pipeline calling this must pass it through
    explicitly; never batch-fire generations the user didn't approve.
    """

    name = "minimax_video"
    capability = "video_generation"
    provider = "minimax"
    tier = ToolTier.PAID
    runtime = ToolRuntime.HTTP_API
    description = (
        "Generate a video clip from a prompt (or first-frame image) with "
        "MiniMax Hailuo models; polls until done and downloads the mp4."
    )
    best_for = [
        "animated explainer/b-roll clips to be assembled by the NLE layer",
        "bilingual prompts; camera instructions on *-Director models",
    ]
    not_good_for = [
        "text-heavy on-screen facts (AI video text is unreliable — put "
        "facts on jianying text overlays / Remotion cards instead)",
        "precise durations beyond 6/10s — plan narration to fit",
    ]
    dependencies = ["env:MINIMAX_API_KEY"]

    def execute(
        self,
        prompt: str,
        output_path: Path,
        model: str = "MiniMax-Hailuo-2.3",
        duration: int = 6,
        resolution: str = "768P",
        first_frame_image: Path | None = None,
        poll_interval_s: float = 10.0,
        max_wait_s: float = 900.0,
    ) -> ToolResult:
        self.check_dependencies()
        if model not in MODELS:
            return ToolResult(success=False, error=f"unknown model {model!r}; known: {sorted(MODELS)}")
        if duration not in (6, 10):
            return ToolResult(success=False, error="duration must be 6 or 10 seconds")
        if resolution not in ("768P", "1080P"):
            return ToolResult(success=False, error="resolution must be 768P or 1080P")

        host = (os.environ.get("MINIMAX_API_HOST") or _DEFAULT_HOST).rstrip("/")
        api_key = os.environ["MINIMAX_API_KEY"]

        payload: dict[str, Any] = {"model": model, "prompt": prompt, "duration": duration, "resolution": resolution}
        if first_frame_image is not None:
            first = Path(first_frame_image)
            if not first.exists():
                return ToolResult(success=False, error=f"first_frame_image not found: {first}")
            import base64

            payload["first_frame_image"] = "data:image/jpeg;base64," + base64.b64encode(first.read_bytes()).decode()

        try:
            submit = _http_json(f"{host}/v1/video_generation", api_key, payload)
        except RuntimeError as exc:
            return ToolResult(success=False, error=str(exc))
        task_id = submit.get("task_id")
        if not task_id:
            return ToolResult(success=False, error=f"no task_id in submit response: {str(submit)[:300]}")

        deadline = time.time() + max_wait_s
        file_id: str | None = None
        while time.time() < deadline:
            time.sleep(poll_interval_s)
            try:
                q = _http_json(f"{host}/v1/query/video_generation?task_id={task_id}", api_key, None)
            except RuntimeError as exc:
                return ToolResult(success=False, error=f"query failed for {task_id}: {exc}")
            status = q.get("status")
            if status == "Fail":
                return ToolResult(success=False, error=f"generation failed (task {task_id})", metadata=q)
            if status == "Success":
                file_id = q.get("file_id")
                break
        if not file_id:
            return ToolResult(success=False, error=f"timed out after {max_wait_s}s (task {task_id} still running)")

        try:
            retrieve = _http_json(f"{host}/v1/files/retrieve?file_id={file_id}", api_key, None)
            download_url = (retrieve.get("file") or {}).get("download_url")
        except RuntimeError as exc:
            return ToolResult(success=False, error=str(exc))
        if not download_url:
            return ToolResult(success=False, error=f"no download_url for file {file_id}")

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with urllib.request.urlopen(download_url, timeout=300) as resp, open(output_path, "wb") as fh:
                fh.write(resp.read())
        except (urllib.error.URLError, OSError) as exc:
            return ToolResult(success=False, error=f"download failed: {exc}")

        return ToolResult(
            success=True,
            output_path=output_path,
            metadata={
                "task_id": task_id,
                "model": model,
                "duration": duration,
                "resolution": resolution,
                "size_bytes": output_path.stat().st_size,
                "cost_note": "billed per clip by MiniMax — record the price from the platform console",
            },
        )

    def estimate_cost(self, **kwargs: Any) -> float:
        # Real per-clip price varies by model/resolution/duration and
        # changes over time; the caller must read it from the platform.
        return 0.0
