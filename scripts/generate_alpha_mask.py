from pathlib import Path
import shutil
import subprocess
import sys

import cv2
import imageio_ffmpeg
import numpy as np
from PIL import Image
from rembg import new_session, remove


def largest_component(mask):
    binary = (mask > 24).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    if count <= 1:
        return mask
    idx = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    keep = (labels == idx).astype(np.uint8)
    return mask * keep


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

    is_neanderthal = 'neanderthal' in src.name.lower() or 'neanderthal' in dst.name.lower()

    # The person-specific model proved too eager to absorb background around
    # the Neanderthal's moving head. Use the more conservative general model,
    # then stabilize the result temporally for this clip.
    model_name = 'isnet-general-use'
    print(f'foreground model: {model_name}')
    session = new_session(model_name)

    close_kernel = np.ones((3, 3), np.uint8)
    erode_kernel = np.ones((3, 3), np.uint8)
    motion_kernel = np.ones((15, 15), np.uint8)
    previous_binary = None

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

        mask[mask < (22 if is_neanderthal else 12)] = 0
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, close_kernel, iterations=1)

        if is_neanderthal:
            # Keep only the dominant subject component. Then constrain each
            # new mask to a modestly dilated version of the previous frame.
            # This allows natural head/arm motion but blocks sudden foliage or
            # forest patches from appearing as foreground beside the subject.
            mask = largest_component(mask)
            current_binary = (mask > 24).astype(np.uint8)

            if previous_binary is not None:
                allowed = cv2.dilate(previous_binary, motion_kernel, iterations=1)
                current_binary = cv2.bitwise_and(current_binary, allowed)
                mask = mask * current_binary

            mask = cv2.erode(mask, erode_kernel, iterations=1)
            mask = cv2.GaussianBlur(mask, (0, 0), 0.65)
            previous_binary = (mask > 18).astype(np.uint8)
        else:
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
