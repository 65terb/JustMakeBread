#!/usr/bin/env python3
"""Regenerate I9 keycap sources and atlases with the approved black outline.

This is an offline asset build step. Runtime code consumes the resulting PNG
bytes and never reconstructs, tints, or draws the keycap silhouette.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = PACKAGE_ROOT / "sources" / "keycaps"
DELIVERABLE_ROOT = PACKAGE_ROOT / "deliverables" / "keycaps"
QA_PATH = PACKAGE_ROOT / "qa" / "keycap-border-v003.json"
CANONICAL_V002 = PACKAGE_ROOT / "canonical" / "i9-scoreboard-keycaps-system-v002.png"
CANONICAL_V003 = PACKAGE_ROOT / "canonical" / "i9-scoreboard-keycaps-system-v003-black-outline.png"
COMPARISON_PATH = PACKAGE_ROOT / "qa" / "keycap-border-comparison-v002-v003.png"

STATES = ("normal", "lit", "disabled")
STANDARD = ("blank", "w", "a", "s", "d", "e", "q", "arrow-up", "arrow-left", "arrow-down", "arrow-right")
WIDE = ("blank", "space", "shift")
OLD_BORDER_BY_STATE = {
    "normal": (57, 124, 131),
    "lit": (185, 243, 245),
    "disabled": (128, 147, 152),
}
BLACK = (0, 0, 0)
EXTENDED = ("q", "arrow-up", "arrow-left", "arrow-down", "arrow-right")
GLYPH_BY_STATE = {"normal": (38, 55, 70, 255), "lit": (38, 55, 70, 255), "disabled": (95, 109, 115, 255)}


def source_path(kind: str, label: str, state: str) -> Path:
    return SOURCE_ROOT / f"{kind}-{label}-{state}-4x.png"


def clean_source(path: Path, state: str) -> None:
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    previous = OLD_BORDER_BY_STATE[state]
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                pixels[x, y] = (0, 0, 0, 0)
            elif alpha == 255 and (red, green, blue) == previous:
                pixels[x, y] = (*BLACK, 255)
    image.save(path, optimize=True)


def build_extended_source(label: str, state: str) -> None:
    image = Image.open(source_path("standard", "blank", state)).convert("RGBA")
    draw = ImageDraw.Draw(image)
    color = GLYPH_BY_STATE[state]
    if label == "q":
        draw.rounded_rectangle((174, 126, 338, 310), radius=12, outline=color, width=36)
        draw.polygon(((270, 260), (300, 260), (342, 326), (306, 326)), fill=color)
    else:
        points = ((256, 128), (160, 236), (212, 236), (212, 324), (300, 324), (300, 236), (352, 236))
        direction = label.removeprefix("arrow-")
        rotations = {"up": 0, "left": 90, "down": 180, "right": 270}
        glyph = Image.new("RGBA", image.size, (0, 0, 0, 0))
        ImageDraw.Draw(glyph).polygon(points, fill=color)
        if rotations[direction] != 0:
            glyph = glyph.rotate(rotations[direction], center=(256, 256), resample=Image.Resampling.NEAREST)
        image.alpha_composite(glyph)
    image.save(source_path("standard", label, state), optimize=True)


def build_atlas(scale: int) -> Image.Image:
    cell = 128 * scale
    atlas = Image.new("RGBA", (cell * 17, cell * 3), (0, 0, 0, 0))
    layout = (
        ("standard", "blank", 0, 1),
        ("standard", "w", 1, 1),
        ("standard", "a", 2, 1),
        ("standard", "s", 3, 1),
        ("standard", "d", 4, 1),
        ("standard", "e", 5, 1),
        ("wide", "blank", 6, 2),
        ("wide", "space", 8, 2),
        ("wide", "shift", 10, 2),
        ("standard", "q", 12, 1),
        ("standard", "arrow-up", 13, 1),
        ("standard", "arrow-left", 14, 1),
        ("standard", "arrow-down", 15, 1),
        ("standard", "arrow-right", 16, 1),
    )
    for row, state in enumerate(STATES):
        for kind, label, column, width_cells in layout:
            source = Image.open(source_path(kind, label, state)).convert("RGBA")
            resized = source.resize((cell * width_cells, cell), Image.Resampling.LANCZOS)
            atlas.alpha_composite(resized, (column * cell, row * cell))
    return atlas


def count_black(image: Image.Image) -> int:
    return sum(1 for red, green, blue, alpha in image.get_flattened_data()
               if alpha == 255 and (red, green, blue) == BLACK)


def alpha_zero_rgb_clean(image: Image.Image) -> bool:
    return all((red, green, blue) == BLACK for red, green, blue, alpha in image.get_flattened_data() if alpha == 0)


def side_outline_thickness(image: Image.Image) -> int:
    """Sample the straight left outline at display center; source contract is 20px at 4x."""
    y = image.height // 2
    row = [image.getpixel((x, y)) for x in range(image.width)]
    runs: list[int] = []
    current = 0
    for red, green, blue, alpha in row:
        if alpha == 255 and (red, green, blue) == BLACK:
            current += 1
        elif current:
            runs.append(current)
            current = 0
    if current:
        runs.append(current)
    return min(runs) if runs else 0


def atlas_apparent_outline_thickness(image: Image.Image, x: int, width: int) -> int:
    """Measure the left opaque near-black run after Lanczos display-scale filtering."""
    y = image.height // 6
    row = [image.getpixel((sample_x, y)) for sample_x in range(x, x + width)]
    runs: list[int] = []
    current = 0
    for red, green, blue, alpha in row:
        if alpha >= 238 and max(red, green, blue) <= 16:
            current += 1
        elif current:
            runs.append(current)
            current = 0
    if current:
        runs.append(current)
    return max(runs) if runs else 0


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_atlas_manifest(scale: int) -> None:
    cell = 128 * scale
    layout = (("standard", "blank", 0, 1), ("standard", "w", 1, 1), ("standard", "a", 2, 1),
              ("standard", "s", 3, 1), ("standard", "d", 4, 1), ("standard", "e", 5, 1),
              ("wide", "blank", 6, 2), ("wide", "space", 8, 2), ("wide", "shift", 10, 2),
              ("standard", "q", 12, 1), ("standard", "arrow-up", 13, 1),
              ("standard", "arrow-left", 14, 1), ("standard", "arrow-down", 15, 1),
              ("standard", "arrow-right", 16, 1))
    width = cell * 17
    height = cell * 3
    entries = []
    for row, state in enumerate(STATES):
        for kind, label, column, width_cells in layout:
            x = column * cell
            rect_width = width_cells * cell
            entries.append({
                "id": f"{kind}-{label}-{state}", "label": label.upper().replace("ARROW-", "ARROW"),
                "kind": kind, "state": state,
                "rect": {"x": x, "y": row * cell, "width": rect_width, "height": cell},
                "uv": {"u0": x / width, "v0": row / 3, "u1": (x + rect_width) / width, "v1": (row + 1) / 3},
            })
    (DELIVERABLE_ROOT / f"keycaps-atlas-{scale}x.json").write_text(json.dumps({
        "schemaVersion": 1, "scale": scale, "width": width, "height": height,
        "alpha": True, "colorSpace": "srgb", "entries": entries,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    for state in STATES:
        for label in EXTENDED:
            build_extended_source(label, state)
    for state in STATES:
        for label in STANDARD:
            clean_source(source_path("standard", label, state), state)
        for label in WIDE:
            clean_source(source_path("wide", label, state), state)

    DELIVERABLE_ROOT.mkdir(parents=True, exist_ok=True)
    atlas_records = []
    for scale in (1, 2):
        cell = 128 * scale
        atlas = build_atlas(scale)
        output = DELIVERABLE_ROOT / f"keycaps-atlas-{scale}x.png"
        atlas.save(output, optimize=True)
        write_atlas_manifest(scale)
        atlas_records.append({
            "scale": scale,
            "path": output.relative_to(PACKAGE_ROOT).as_posix(),
            "sha256": sha256(output),
            "width": atlas.width,
            "height": atlas.height,
            "alphaZeroRgbClean": alpha_zero_rgb_clean(atlas),
            "pureBlackOpaquePixels": count_black(atlas),
            "apparentThicknessPx": {
                "standard": atlas_apparent_outline_thickness(atlas, cell, cell),
                "wide": atlas_apparent_outline_thickness(atlas, cell * 8, cell * 2),
            },
        })

    baseline = Image.open(CANONICAL_V002).convert("RGBA")
    corrected = baseline.copy()
    corrected_pixels = corrected.load()
    for y in range(corrected.height):
        for x in range(corrected.width):
            red, green, blue, alpha = corrected_pixels[x, y]
            if alpha == 0:
                corrected_pixels[x, y] = (0, 0, 0, 0)
            elif alpha == 255 and (red, green, blue) == OLD_BORDER_BY_STATE["normal"]:
                corrected_pixels[x, y] = (*BLACK, 255)
    corrected.save(CANONICAL_V003, optimize=True)
    preview_width = 1660
    preview_height = round(baseline.height * preview_width / baseline.width)
    comparison = Image.new("RGBA", (preview_width * 2, preview_height), (0, 0, 0, 0))
    comparison.alpha_composite(baseline.resize((preview_width, preview_height), Image.Resampling.LANCZOS), (0, 0))
    comparison.alpha_composite(corrected.resize((preview_width, preview_height), Image.Resampling.LANCZOS),
                               (preview_width, 0))
    comparison.save(COMPARISON_PATH, optimize=True)

    samples = []
    for label in ("w", "a", "s", "d", "e", "q", "arrow-up", "arrow-left", "arrow-down", "arrow-right"):
        path = source_path("standard", label, "normal")
        image = Image.open(path).convert("RGBA")
        samples.append({
            "label": label.upper(), "kind": "standard", "source": path.relative_to(PACKAGE_ROOT).as_posix(),
            "sourceThicknessPx4x": side_outline_thickness(image), "pureBlackOpaquePixels": count_black(image),
            "alphaZeroRgbClean": alpha_zero_rgb_clean(image),
        })
    for label in ("space", "shift"):
        path = source_path("wide", label, "normal")
        image = Image.open(path).convert("RGBA")
        samples.append({
            "label": label.upper(), "kind": "wide", "source": path.relative_to(PACKAGE_ROOT).as_posix(),
            "sourceThicknessPx4x": side_outline_thickness(image), "pureBlackOpaquePixels": count_black(image),
            "alphaZeroRgbClean": alpha_zero_rgb_clean(image),
        })

    QA_PATH.parent.mkdir(parents=True, exist_ok=True)
    QA_PATH.write_text(json.dumps({
        "schemaVersion": 1,
        "generatorContract": "i9-keycap-raster-v003-black-outline",
        "borderRgb": "#000000",
        "sourceDisplayScale": 4,
        "expectedSourceThicknessPx4x": 20,
        "expectedAtlasThicknessPx": {"1x": 5, "2x": 10},
        "atlasGeometryPreserved": True,
        "samples": samples,
        "atlases": atlas_records,
        "canonical": {
            "baselineReference": CANONICAL_V002.relative_to(PACKAGE_ROOT).as_posix(),
            "approvedCandidate": CANONICAL_V003.relative_to(PACKAGE_ROOT).as_posix(),
            "approvedCandidateSha256": sha256(CANONICAL_V003),
            "comparison": COMPARISON_PATH.relative_to(PACKAGE_ROOT).as_posix(),
            "comparisonSha256": sha256(COMPARISON_PATH),
        },
        "shiftRuntimeBinding": None,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
