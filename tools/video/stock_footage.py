from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import requests

from tools.base_tool import BaseTool, ToolResult, ToolRuntime, ToolTier


class PexelsStockFootageTool(BaseTool):
    name = "pexels_stock_footage"
    capability = "stock_footage_search"
    provider = "pexels"
    tier = ToolTier.FREE_API
    runtime = ToolRuntime.HTTP_API
    description = "Search Pexels' free stock video library and download results."
    best_for = ["generic b-roll", "establishing shots", "nature/city/abstract scenery"]
    not_good_for = ["branded content", "specific real people, places, or products"]
    dependencies = ["env:PEXELS_API_KEY"]

    def execute(
        self,
        query: str,
        output_dir: Path,
        per_page: int = 5,
        orientation: str = "landscape",
    ) -> ToolResult:
        self.check_dependencies()
        response = requests.get(
            "https://api.pexels.com/videos/search",
            headers={"Authorization": os.environ["PEXELS_API_KEY"]},
            params={"query": query, "per_page": per_page, "orientation": orientation},
            timeout=30,
        )
        response.raise_for_status()
        data: dict[str, Any] = response.json()

        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        downloaded: list[str] = []
        for video in data.get("videos", []):
            best_file = max(video["video_files"], key=lambda f: f.get("width", 0))
            dest = output_dir / f"pexels_{video['id']}.mp4"
            with requests.get(best_file["link"], stream=True, timeout=60) as r:
                r.raise_for_status()
                with open(dest, "wb") as fh:
                    for chunk in r.iter_content(chunk_size=8192):
                        fh.write(chunk)
            downloaded.append(str(dest))

        return ToolResult(
            success=True,
            metadata={"query": query, "downloaded": downloaded, "count": len(downloaded)},
        )
