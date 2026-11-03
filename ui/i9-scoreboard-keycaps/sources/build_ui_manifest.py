#!/usr/bin/env python3
"""Build the deterministic create-ui-package manifest for I9 raster deliverables."""

from __future__ import annotations

import json
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parent.parent


def asset_id(path: Path) -> str:
    value = path.as_posix().lower()
    for token in ("/", "_", "."):
        value = value.replace(token, "-")
    while "--" in value:
        value = value.replace("--", "-")
    return value.strip("-")


def record(path: Path) -> dict[str, object]:
    relative = path.relative_to(PACKAGE_ROOT)
    result: dict[str, object] = {
        "id": asset_id(relative), "role": "source", "path": relative.as_posix(),
        "version": 4, "status": "draft",
    }
    if relative.parts[0] == "canonical":
        result["role"] = "canonical"
    elif relative.parts[:2] in (("deliverables", "tutorial-panel"), ("sources", "tutorial-panel")):
        result["role"] = "reference"
        result["status"] = "superseded"
        result["metadata"] = {
            "targetIds": ["tutorial-panel"],
        }
    elif relative.parts[0] == "deliverables":
        result["role"] = "deliverable"
        result["productionProfile"] = "runtime-raster"
        result["metadata"] = {
            "targetIds": ["standard-keycap", "wide-keycap", "world-material-prompt", "world-production-prompt", "world-reset-prompt"],
            "stateIds": ["default", "lit", "disabled"],
            "breakpointIds": ["bplus-800", "hd-1280", "full-hd-1920"],
        }
    elif relative.parts[0] == "qa":
        result["role"] = "qa-evidence"
    return result


def main() -> None:
    excluded = {"ui-package.json", "sources/build_ui_manifest.py"}
    files = sorted(path for path in PACKAGE_ROOT.rglob("*") if path.is_file() and
                   path.relative_to(PACKAGE_ROOT).as_posix() not in excluded)
    manifest = {
        "schemaVersion": "1.0", "id": "i9-scoreboard-keycaps", "revision": 4, "status": "draft",
        "creativeBrief": {
            "objective": "Provide reusable PNG keycaps for data-driven panel compositing and world prompts while the physical shell is swappable through a semantic screen-surface adapter.",
            "audience": "First-stage Just Make Bread players on B+ scaled views.",
            "approval": "Technical package correction in progress; final visual adoption remains HUMAN VISUAL PENDING.",
        },
        "classification": {"packageScope": "component-family", "renderStrategy": "hybrid", "usageContexts": ["world-scoreboard", "tutorial", "lifecycle-results", "world-prompts"]},
        "visualIdentity": {
            "palette": ["frame #34454C", "panel #263746", "glyph #F2F1EA", "key outer border #000000", "available fill #B9F3F5"],
            "geometryRules": ["true physical 3D nine-slice with fixed corners and axis-only edges", "default central 4.15x1.55x0.26", "standard keycap 1:1 and wide keycap 2:1 with equal apparent outline thickness"],
            "hierarchyRules": ["exactly nine shell segments plus one independent semantic screen", "all board content is rendered into the semantic screen material map", "each board instance owns an independent screen material and texture"],
            "continuityAnchors": ["Galmuri labels", "muted steel frame", "slate panel face", "warm off-white glyphs"],
            "forbiddenChanges": ["floating board text", "standalone tutorial keycap scene children", "role-specific frame or panel construction", "runtime CSS/SVG/canvas keycap construction", "runtime use of the full tutorial-panel-v002 reference image", "brittle GLB node-name coupling"],
        },
        "style": {
            "profile": "default-style",
            "embeddedSummary": {"family": "Primary physical scoreboard", "tone": "casual readable factory signage", "contentOwnership": "semantic panelSurface material map"},
            "referenceAssets": ["canonical/i9-scoreboard-keycaps-system-v003-black-outline.png", "qa/keycap-border-comparison-v002-v003.png"],
        },
        "targets": [
            {"id": "standard-keycap", "kind": "component", "role": "input-keycap", "description": "Blank, legacy W/A/S/D/E, and current Q/arrow transparent PNG keys.", "requiredForProduction": True},
            {"id": "wide-keycap", "kind": "component", "role": "wide-input-keycap", "description": "Blank, SPACE, and unbound SHIFT transparent PNG keys.", "requiredForProduction": True},
            {"id": "dynamic-panel-compositor", "kind": "component", "role": "semantic-screen-renderer", "description": "Shared CanvasTexture foundation for central, tutorial and result panels; keycaps are PNG drawImage inputs.", "requiredForProduction": True},
            {"id": "scoreboard-surface-adapter", "kind": "component", "role": "asset-surface-boundary", "description": "True width+height 3D nine-slice fallback/future asset shell with independent semantic screen materials.", "requiredForProduction": True},
            {"id": "tutorial-panel", "kind": "component", "role": "qa-only-reference", "description": "Superseded full-panel v002 raster; forbidden as a runtime map.", "requiredForProduction": False},
            {"id": "world-material-prompt", "kind": "component", "role": "world-prompt-e-q", "description": "Canonical material pickup E and floor-drop Q atlas planes.", "requiredForProduction": True},
            {"id": "world-production-prompt", "kind": "component", "role": "world-prompt-space", "description": "Production-block SPACE atlas plane.", "requiredForProduction": True},
            {"id": "world-reset-prompt", "kind": "component", "role": "world-prompt-reset-e", "description": "Failed-awaiting-reset E atlas plane.", "requiredForProduction": True},
        ],
        "states": [
            {"id": "default", "description": "Normal key state.", "requiredForProduction": True},
            {"id": "lit", "description": "Available or highlighted key state.", "requiredForProduction": True},
            {"id": "disabled", "description": "Unavailable key state.", "requiredForProduction": True},
            {"id": "tutorial-dynamic", "description": "Tutorial composed from atlas image regions plus dynamic Galmuri labels.", "requiredForProduction": True},
            {"id": "central-dynamic", "description": "Authoritative timer, score and result content.", "requiredForProduction": True},
            {"id": "breakdown-dynamic", "description": "Authoritative ordered score breakdown rows.", "requiredForProduction": True},
            {"id": "tutorial-static", "description": "Rejected full-panel static tutorial reference; runtime forbidden.", "requiredForProduction": False},
        ],
        "breakpoints": [
            {"id": "bplus-800", "description": "800x600 4:3 landscape fixture.", "orientation": "landscape", "minWidth": 800, "maxWidth": 800, "minHeight": 600, "maxHeight": 600, "requiredForProduction": True},
            {"id": "hd-1280", "description": "1280x720 16:9 landscape fixture.", "orientation": "landscape", "minWidth": 1280, "maxWidth": 1280, "minHeight": 720, "maxHeight": 720, "requiredForProduction": True},
            {"id": "full-hd-1920", "description": "1920x1080 16:9 landscape fixture.", "orientation": "landscape", "minWidth": 1920, "maxWidth": 1920, "minHeight": 1080, "maxHeight": 1080, "requiredForProduction": True},
        ],
        "tokens": [
            {"id": "scoreboard-frame", "category": "color", "value": "#34454C"},
            {"id": "scoreboard-panel", "category": "color", "value": "#263746"},
            {"id": "scoreboard-glyph", "category": "color", "value": "#F2F1EA"},
            {"id": "keycap-outer-border", "category": "color", "value": "#000000"},
            {"id": "keycap-border-thickness", "category": "layout", "value": {"source4x": 20, "atlas1x": 5, "atlas2x": 10}},
            {"id": "panel-aspect-fallback", "category": "layout", "value": 3.04},
            {"id": "panel-safe-padding", "category": "spacing", "value": {"horizontalRatio": 0.06, "verticalRatio": 0.1}},
            {"id": "textured-material-multiplier", "category": "color", "value": "#FFFFFF"},
            {"id": "panel-tone-mapping", "category": "other", "value": False},
            {"id": "board-rise", "category": "motion", "value": {"authority": "presentation-only", "reducedMotion": "exact endpoint", "cancel": "hidden endpoint"}},
        ],
        "dependencies": [],
        "productionProfiles": [{"id": "runtime-raster", "medium": "world-space-panel-texture", "deliveryMode": "raster-assets", "platform": "web-threejs", "usage": ["srgb-dynamic-panel-map", "png-keycap-atlas"], "density": 2, "fileFormat": "png", "colorMode": "srgb"}],
        "assets": [record(path) for path in files],
        "provenance": {
            "inputReferences": [
                {"id": "primary-scoreboard-runtime", "path": "../../../src/main.ts", "usage": "read-only fallback geometry and material authority"},
                {"id": "galmuri-ofl", "path": "sources/font/OFL-1.1.txt", "usage": "dynamic Korean and score labels"},
            ],
            "generationRecords": [
                {"id": "deterministic-raster-v003-black-outline", "method": "offline deterministic PNG correction and atlas assembly", "date": "2026-08-11", "source": "sources/regenerate_keycaps_v003.py", "outputHashes": "SHA256SUMS.txt"},
                {"id": "tutorial-composition-v002", "method": "superseded full-panel composition retained as QA reference only", "source": "sources/tutorial-panel/composition-v002.json"},
            ],
        },
        "qa": {"interactionClarity": "pending", "visualConsistency": "pending", "responsiveValidation": "pending", "technicalValidation": "pending"},
        "extensions": {
            "humanVisualGate": "pending",
            "rejectedPredecessors": ["I9-TUTORIAL-TEMPLATE-001", "I9-KEYCAP-ASSET-001", "static-full-panel-runtime-handoff"],
            "activeMajorFinding": "I9-SCOREBOARD-SHELL-ADAPTER-001",
            "runtimeVisualStatus": "primary-integration-blocked",
            "tutorialPanelV002Usage": "reference-only-do-not-copy-to-public",
            "runtimeAtlasAllowlist": {
                "1x": {"path": "deliverables/keycaps/keycaps-atlas-1x.png", "sha256": "3520da92a522b2c6e5be54ad9a51bec1740e1c7ea5a11a3e1a2677ab394711c2"},
                "2x": {"path": "deliverables/keycaps/keycaps-atlas-2x.png", "sha256": "9eaba93c5fe6a45c09490c6b554cad458252ef7440780699b56d2487d5696512"},
            },
            "assetHashIndex": "qa/asset-metadata.json", "sha256Manifest": "SHA256SUMS.txt",
        },
    }
    (PACKAGE_ROOT / "ui-package.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
