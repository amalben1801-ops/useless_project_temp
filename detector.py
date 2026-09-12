"""Appearance comparison, not a trained sock/object detector.

Histograms compare colour distribution. Gray-level differences compare texture.
Thresholds are provisional and require validation on real sock photos.
"""
import warnings
from io import BytesIO
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 20_000_000


def read_image(stream):
    raw = stream.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError('Each image must be smaller than 10 MB.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(raw)) as opened:
                if opened.format not in {'JPEG', 'PNG', 'WEBP'}:
                    raise ValueError('Please use JPG, PNG or WebP images.')
                if opened.width * opened.height > MAX_PIXELS:
                    raise ValueError('Image is too large. Resize it below 20 megapixels.')
                if min(opened.size) < 32:
                    raise ValueError('Image is too small. Use a clearer photo at least 32 pixels wide and tall.')
                oriented = ImageOps.exif_transpose(opened)
                # Composite transparency on white rather than treating transparent RGB as fabric.
                rgba = oriented.convert('RGBA')
                base = Image.new('RGBA', rgba.size, 'white')
                base.alpha_composite(rgba)
                return base.convert('RGB').resize((160, 160), Image.Resampling.LANCZOS)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError,
            Image.DecompressionBombWarning) as error:
        raise ValueError('Could not read an image. Choose a valid JPG, PNG or WebP photo.') from error


def features(image):
    rgb = np.asarray(image, dtype=np.float64) / 255.0
    bins = np.minimum((rgb * 6).astype(int), 5)
    indexes = bins[:, :, 0] * 36 + bins[:, :, 1] * 6 + bins[:, :, 2]
    histogram = np.bincount(indexes.ravel(), minlength=216) / indexes.size
    gray = rgb @ np.array([0.2126, 0.7152, 0.0722])
    edge = (np.abs(np.diff(gray, axis=0)).mean() + np.abs(np.diff(gray, axis=1)).mean()) / 2
    return dict(hist=histogram, mean=rgb.mean(axis=(0, 1)), edge=float(edge),
                std=float(gray.std()), dark=float((gray < .025).mean()),
                bright=float((gray > .975).mean()))


def compare_uploads(first, second):
    a, b = features(read_image(first)), features(read_image(second))
    overlap = np.minimum(a['hist'], b['hist']).sum()
    distance = np.linalg.norm(a['mean'] - b['mean']) / np.sqrt(3)
    colour = float(np.clip(.55 * overlap + .45 * (1 - distance), 0, 1))
    texture = float(np.clip(1 - 5 * abs(a['edge'] - b['edge']) - 2 * abs(a['std'] - b['std']), 0, 1))
    poor_light = max(a['dark'], b['dark']) > .7 or max(a['bright'], b['bright']) > .8
    if poor_light:
        status, label = 'uncertain', 'Uncertain'
        explanation = 'A photo is mostly near-black or near-white. This may be the sock colour or poor exposure. Retake in even light with visible fabric detail.'
    elif colour > .79 and texture > .78:
        status, label = 'match', 'Likely match'
        explanation = 'The selected areas have similar colours and texture. Check the full pattern, logo and length yourself too.'
    elif colour < .57 or texture < .42:
        status, label = 'different', 'Likely different'
        explanation = 'The selected areas differ in colour or texture. Make sure both photos show similar parts of the socks in similar lighting.'
    else:
        status, label = 'uncertain', 'Uncertain'
        explanation = 'There is no clear result. Crop closer to each sock or retake both photos in the same light.'
    colour_score, texture_score = round(colour * 100), round(texture * 100)
    return dict(status=status, label=label, explanation=explanation,
                match_score=min(colour_score, texture_score),
                colour_score=colour_score, texture_score=texture_score,
                method='Colour and texture similarity; these scores are not confidence probabilities.')
