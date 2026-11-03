from __future__ import annotations

import hashlib
import json
import struct
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
METADATA_PATH = PACKAGE_ROOT / "qa" / "asset-metadata.json"
SUMS_PATH = PACKAGE_ROOT / "SHA256SUMS.txt"


def png_info(path: Path) -> dict[str, object]:
    payload = path.read_bytes()
    if payload[:8] != b"\x89PNG\r\n\x1a\n" or payload[12:16] != b"IHDR":
        raise ValueError(f"not a PNG: {path}")
    width, height, bit_depth, color_type = struct.unpack(">IIBB", payload[16:26])
    return {
        "path": path.relative_to(PACKAGE_ROOT).as_posix(),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "width": width,
        "height": height,
        "bitDepth": bit_depth,
        "colorType": color_type,
        "hasAlpha": color_type in (4, 6),
        "bytes": len(payload),
    }


def file_info(path: Path) -> dict[str, object]:
    payload = path.read_bytes()
    return {
        "path": path.relative_to(PACKAGE_ROOT).as_posix(),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "bytes": len(payload),
    }


def main() -> None:
    pngs = sorted(PACKAGE_ROOT.rglob("*.png"))
    supporting = sorted(
        path for path in PACKAGE_ROOT.rglob("*")
        if path.is_file() and path.suffix.lower() in {".json", ".woff2", ".txt", ".md", ".py"}
        and path not in {METADATA_PATH, SUMS_PATH, PACKAGE_ROOT / "ui-package.json"}
    )
    png_metadata = [png_info(path) for path in pngs]
    supporting_metadata = [file_info(path) for path in supporting]
    metadata = {
        "schemaVersion": 1,
        "generatorContract": "i9-keycap-raster-v003-black-outline",
        "keycapBorder": {
            "rgb": "#000000",
            "sourceThicknessPx4x": 20,
            "atlasThicknessPx": {"1x": 5, "2x": 10},
            "qa": "qa/keycap-border-v003.json",
        },
        "panelAspect": 3.8 / 1.25,
        "scoreboardGeometry": {"width": 4.15, "height": 1.55, "depth": 0.26},
        "scoreboardPanel": {"width": 3.8, "height": 1.25},
        "runtimePolicy": {
            "surface": "dynamic-atlas-plus-galmuri",
            "approvedAtlases": [
                "deliverables/keycaps/keycaps-atlas-1x.png",
                "deliverables/keycaps/keycaps-atlas-2x.png",
            ],
            "referenceOnlyAssets": [
                "deliverables/tutorial-panel/tutorial-panel-v002-1x.png",
                "deliverables/tutorial-panel/tutorial-panel-v002-2x.png",
                "deliverables/tutorial-panel/tutorial-panel-v002.json",
                "sources/tutorial-panel/tutorial-panel-v002-4x.png",
                "sources/tutorial-panel/composition-v002.json",
            ],
        },
        "pngs": png_metadata,
        "supportingFiles": supporting_metadata,
    }
    METADATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    METADATA_PATH.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    all_entries = sorted(png_metadata + supporting_metadata, key=lambda entry: str(entry["path"]))
    SUMS_PATH.write_text(
        "".join(f'{entry["sha256"]}  {entry["path"]}\n' for entry in all_entries),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
