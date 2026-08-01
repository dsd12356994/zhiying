from __future__ import annotations

import importlib
import inspect
import pkgutil

from tools.base_tool import BaseTool


class ToolRegistry:
    """Passive catalog, not a dispatcher. discover() walks the tools/
    package and instantiates every concrete BaseTool subclass it finds --
    no manual registration list to keep in sync. The agent queries this
    (get_by_capability / provider_menu) and calls tool.execute() itself.
    """

    def __init__(self) -> None:
        self._tools: dict[str, BaseTool] = {}

    def discover(self, package_name: str = "tools") -> None:
        package = importlib.import_module(package_name)
        for _, module_name, is_pkg in pkgutil.walk_packages(
            package.__path__, prefix=f"{package_name}."
        ):
            if is_pkg:
                continue
            module = importlib.import_module(module_name)
            self.register_module(module)

    def register_module(self, module: object) -> None:
        for _, obj in inspect.getmembers(module, inspect.isclass):
            if not issubclass(obj, BaseTool):
                continue
            if obj is BaseTool or inspect.isabstract(obj):
                continue
            # Only register a class where it's defined, not everywhere it's
            # imported -- otherwise re-exports would register duplicates.
            if obj.__module__ != module.__name__:
                continue
            instance = obj()
            self._tools[instance.name] = instance

    def get(self, name: str) -> BaseTool:
        return self._tools[name]

    def get_by_capability(self, capability: str) -> list[BaseTool]:
        return [t for t in self._tools.values() if t.capability == capability]

    def all_tools(self) -> list[BaseTool]:
        return list(self._tools.values())

    def provider_menu(self) -> dict[str, list[str]]:
        menu: dict[str, list[str]] = {}
        for tool in self._tools.values():
            menu.setdefault(tool.capability, []).append(tool.name)
        return menu
