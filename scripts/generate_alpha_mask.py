from pathlib import Path
import shutil
import subprocess
import sys

import cv2
import imageio_ffmpeg
import numpy as np
from PIL import Image
from rembg import new_session, remove


def main():
    if len(sys.argv) != 3:
        raise SystemExit('usage: generate_alpha_mask.py INPUT.mp4 OUTPUT.mp4')

    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    frames_dir = Path('mask_frames')

    if frames_dir.exists():
        shutil.rmtree(frames_dir)
    frames_dir.mkdir(parents=True)
    dst.parent.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        raise RuntimeError(f'Cannot open {src}')

    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    print(f'input: {width}x{height}, {fps:.3f} fps, {frame_count} frames')

    session = new_session('isnet-general-use')
    close_kernel = np.ones((3, 3), np.uint8)

    i = 0
    while True:
        ok, frame_bgr = cap.read()
        if not ok:
            break

        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mask_pil = remove(Image.fromarray(frame_rgb), session=session, only_mask=True)
        mask = np.array(mask_pil, dtype=np.uint8, copy=True)

        if mask.ndim == 3:
            mask = mask[..., 0].copy()

        # Process only the matching RGB frame. Do not merge neighbouring
        # masks: temporal unions leave visible ghosts when the subject moves.
        # Preserve faint hair/foot edges, close only tiny holes, and soften
        # the boundary without expanding the silhouette into the background.
        mask[mask < 12] = 0
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, close_kernel, iterations=1)
        mask = cv2.GaussianBlur(mask, (0, 0), 0.75)

        cv2.imwrite(str(frames_dir / f'{i:05d}.png'), mask)
        i += 1
        if i % 10 == 0:
            print(f'processed {i}/{frame_count or "?"}')

    cap.release()
    if i == 0:
        raise RuntimeError('No frames decoded')

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg, '-y',
        '-framerate', f'{fps:.8f}',
        '-i', str(frames_dir / '%05d.png'),
        '-an',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '16',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        str(dst),
    ]
    subprocess.run(cmd, check=True)
    print(f'wrote {dst} from {i} mask frames')


if __name__ == '__main__':
    main()
