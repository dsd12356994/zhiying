from __future__ import annotations

import os
import shutil
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any


class ToolTier(str, Enum):
    LOCAL = "local"  # runs entirely on this machine, no network, no key
    FREE_API = "free_api"  # external service, no cost, but needs an API key/signup
    PAID = "paid"  # costs money per call


class ToolRuntime(str, Enum):
    PYTHON = "python"
    SUBPROCESS = "subprocess"  # shells out to a local binary (ffmpeg, say, ...)
    HTTP_API = "http_api"


@dataclass
class ToolResult:
    success: bool
    output_path: Path | None = None
    cost_usd: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


class DependencyError(RuntimeError):
    def __init__(self, tool_name: str, missing: list[str]):
        self.tool_name = tool_name
        self.missing = missing
        super().__init__(f"{tool_name} is missing dependencies: {', '.join(missing)}")


class BaseTool(ABC):
    """Every tool subclasses this. Instances are auto-discovered and
    instantiated by ToolRegistry -- the agent queries the registry by
    capability, then calls .execute() itself; there's no separate
    orchestrator process dispatching calls (see AGENT_GUIDE.md).
    """

    name: str
    capability: str
    provider: str
    tier: ToolTier
    runtime: ToolRuntime
    description: str = ""
    best_for: list[str] = []
    not_good_for: list[str] = []
    # "env:VAR_NAME" or "cmd:binary_name" -- checked by check_dependencies().
    dependencies: list[str] = []

    def check_dependencies(self) -> None:
        missing: list[str] = []
        for dep in self.dependencies:
            kind, _, value = dep.partition(":")
            if kind == "env" and not os.environ.get(value):
                missing.append(dep)
            elif kind == "cmd" and shutil.which(value) is None:
                missing.append(dep)
        if missing:
            raise DependencyError(self.name, missing)

    def estimate_cost(self, **kwargs: Any) -> float:
        return 0.0

    def dry_run(self, **kwargs: Any) -> ToolResult:
        self.check_dependencies()
        return ToolResult(success=True, metadata={"dry_run": True, "kwargs": kwargs})

    @abstractmethod
    def execute(self, **kwargs: Any) -> ToolResult: ...
