import re
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
BACKUP = ROOT.parent / (ROOT.name + "_assets_backup")
SKIP_DIRS = {"icons"}
IMAGE_EXT = {".png", ".jpg", ".jpeg"}
TEXT_FILES = [ROOT / "index.html", ROOT / "sw.js", ROOT / "manifest.json"]
TEXT_FILES += list((ROOT / "css").glob("*.css")) + list((ROOT / "js").glob("*.js"))
BG_MAX_WIDTH = 2560
SPRITE_MAX_SIDE = 1600
QUALITY = 84
MUSIC_BITRATE = "96k"


def human(size):
    return f"{size / 1024:.0f} KB" if size < 1024 * 1024 else f"{size / 1024 / 1024:.2f} MB"


def backup(path):
    target = BACKUP / path.relative_to(ROOT)
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        shutil.copy2(path, target)


def convert_images():
    before = 0
    after = 0
    count = 0
    for path in sorted(ASSETS.rglob("*")):
        if path.suffix.lower() not in IMAGE_EXT:
            continue
        if SKIP_DIRS.intersection(path.relative_to(ASSETS).parts):
            continue
        before += path.stat().st_size
        image = Image.open(path)
        has_alpha = image.mode in ("RGBA", "LA") or "transparency" in image.info
        image = image.convert("RGBA" if has_alpha else "RGB")
        is_bg = path.stem.startswith("bg_") or "bushes" in path.stem
        limit = BG_MAX_WIDTH if is_bg else SPRITE_MAX_SIDE
        biggest = image.width if is_bg else max(image.size)
        if biggest > limit:
            ratio = limit / biggest
            image = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.LANCZOS)
        target = path.with_suffix(".webp")
        image.save(target, "WEBP", quality=QUALITY, method=6, alpha_quality=92)
        after += target.stat().st_size
        backup(path)
        path.unlink()
        count += 1
        print(f"{path.relative_to(ROOT)} -> {target.name}")
    return count, before, after


def rewrite_references():
    pattern = re.compile(r"(assets/(?!icons/)[A-Za-z0-9_\-./]+?)\.(png|jpg|jpeg)\b")
    ext_pattern = re.compile(r'imageExt:\s*"(png|jpg|jpeg)"')
    changed = 0
    for path in TEXT_FILES:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        updated = pattern.sub(r"\1.webp", text)
        updated = ext_pattern.sub('imageExt: "webp"', updated)
        if updated != text:
            path.write_text(updated, encoding="utf-8")
            changed += 1
    return changed


def probe_bitrate(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=bit_rate", "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True,
    )
    try:
        return int(result.stdout.strip()) // 1000
    except ValueError:
        return 0


def shrink_music():
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        print("ffmpeg not found, music left untouched")
        return 0, 0
    before = 0
    after = 0
    for path in sorted((ASSETS / "audio").glob("bgm_*.mp3")):
        bitrate = probe_bitrate(path)
        if bitrate and bitrate <= 112:
            continue
        before += path.stat().st_size
        temp = path.with_suffix(".tmp.mp3")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-codec:a", "libmp3lame",
             "-b:a", MUSIC_BITRATE, "-ar", "44100", "-map_metadata", "-1", str(temp)],
            check=True,
        )
        if temp.stat().st_size < path.stat().st_size:
            backup(path)
            temp.replace(path)
        else:
            temp.unlink()
        after += path.stat().st_size
        print(f"{path.name}: {bitrate} kbps -> {MUSIC_BITRATE}")
    return before, after


def main():
    if not ASSETS.exists():
        print("assets folder not found")
        sys.exit(1)
    count, img_before, img_after = convert_images()
    changed = rewrite_references()
    mus_before, mus_after = shrink_music()
    print()
    print(f"images converted: {count}, files with updated references: {changed}")
    print(f"images: {human(img_before)} -> {human(img_after)}")
    if mus_before:
        print(f"music: {human(mus_before)} -> {human(mus_after)}")
    print(f"originals saved to: {BACKUP}")


if __name__ == "__main__":
    main()
