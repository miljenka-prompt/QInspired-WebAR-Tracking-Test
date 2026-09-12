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
    raw_masks = []

    while True:
        ok, frame_bgr = cap.read()
        if not ok:
            break

        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mask_pil = remove(Image.fromarray(frame_rgb), session=session, only_mask=True)
        mask = np.array(mask_pil, dtype=np.uint8, copy=True)
        if mask.ndim == 3:
            mask = mask[..., 0].copy()
        raw_masks.append(mask)

        if len(raw_masks) % 10 == 0:
            print(f'extracted {len(raw_masks)}/{frame_count or "?"}')

    cap.release()
    if not raw_masks:
        raise RuntimeError('No frames decoded')

    # Stabilise the independently segmented video frames. A one-frame temporal
    # maximum protects moving heads/hands/feet from brief segmentation dropouts.
    # A very small dilation then preserves dark extremities without creating a
    # visibly inflated silhouette.
    close_kernel = np.ones((3, 3), np.uint8)
    dilate_kernel = np.ones((3, 3), np.uint8)

    for i, current in enumerate(raw_masks):
        neighbours = [current]
        if i > 0:
            neighbours.append(raw_masks[i - 1])
        if i + 1 < len(raw_masks):
            neighbours.append(raw_masks[i + 1])
        mask = np.maximum.reduce(neighbours)

        # Keep faint edge evidence instead of deleting it before morphology.
        mask[mask < 10] = 0
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, close_kernel, iterations=2)
        mask = cv2.dilate(mask, dilate_kernel, iterations=1)
        mask = cv2.GaussianBlur(mask, (0, 0), 1.0)

        cv2.imwrite(str(frames_dir / f'{i:05d}.png'), mask)
        if (i + 1) % 10 == 0:
            print(f'processed {i + 1}/{len(raw_masks)}')

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
    print(f'wrote {dst} from {len(raw_masks)} mask frames')


if __name__ == '__main__':
    main()
