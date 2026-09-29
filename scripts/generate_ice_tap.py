"""
Generates the original "ice tap" UI sounds used for the crystalline touch burst.

Fully synthetic (no samples, nothing taken from any film or library): one soft glassy ping, then
a glittery shimmer that rises right behind it and fades slowly, timed to the visual burst (~2.4 s):

    0 ms         soft struck-glass ping (two notes, an open fifth)    (contact flash + burst)
    50-200 ms    shimmer swells: a cloud of tiny high grains           (stars bursting out)
    200-2400 ms  shimmer thins and fades slowly                        (stars drifting and fading)

The ping is kept short and glassy (inharmonic partials, no bell chord) so it doesn't read as a
chime; the shimmer carries the magic. Grains are at random, non-musical pitches.

Usage:  python scripts/generate_ice_tap.py   (needs numpy, scipy, matplotlib, ffmpeg on PATH)
Writes: src/assets/sounds/ice-tap-{1..5}.mp3 and docs/ice-tap-preview.png
"""

from __future__ import annotations

import os
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48_000
LENGTH_S = 2.4
VARIANTS = 5
OUT_DIR = os.path.join("src", "assets", "sounds")

# Ping pairs (Hz), high E-major pentatonic open fifths/fourths: bright but soft.
PINGS = [(2637.02, 3951.07), (2217.46, 3322.44), (2959.96, 3951.07), (2489.02, 3729.31), (2637.02, 3520.00)]
# Struck glass / ice rod partial ratios: inharmonic, which reads as "crystal", not "bell".
GLASS_PARTIALS = [(1.0, 1.0), (2.756, 0.35), (5.404, 0.12)]

t = np.arange(int(SR * LENGTH_S)) / SR


def highpass(x: np.ndarray, f: float) -> np.ndarray:
    return sosfilt(butter(2, f, btype="high", fs=SR, output="sos"), x)


def glass_ping(f0: float, start: float, decay: float, amp: float) -> np.ndarray:
    """One struck-glass ping: inharmonic partials, higher ones die faster, 1.5 ms attack."""
    x = t - start
    out = np.zeros_like(t)
    for ratio, weight in GLASS_PARTIALS:
        f = f0 * ratio
        if f > SR * 0.45:
            continue
        d = decay / (1 + 0.9 * (ratio - 1))
        out += weight * np.sin(2 * np.pi * f * x) * np.where(x < 0, 0, np.exp(-np.clip(x, 0, None) / d))
    return out * np.clip(x / 0.0015, 0, 1) * amp


def shimmer(rng: np.random.Generator, delay: float) -> tuple[np.ndarray, np.ndarray]:
    """Glittery shimmer (stereo): ~400 tiny high grains, dense early and thinning, plus airy noise."""
    left = np.zeros_like(t)
    right = np.zeros_like(t)
    for _ in range(420):
        s = delay + rng.gamma(1.6, 0.22)
        if s > LENGTH_S - 0.15:
            continue
        f = rng.uniform(6000, 13500)
        d = rng.uniform(0.015, 0.06)
        m = int(SR * d * 5)
        k = np.arange(m) / SR
        g = np.sin(2 * np.pi * f * k + rng.uniform(0, 2 * np.pi)) * np.exp(-k / d) * np.clip(k / 0.002, 0, 1)
        g *= rng.uniform(0.2, 1.0)
        i = int(s * SR)
        n = len(left[i: i + m])
        a = (rng.uniform(-0.8, 0.8) + 1) * np.pi / 4  # equal-power pan
        left[i: i + n] += g[:n] * np.cos(a)
        right[i: i + n] += g[:n] * np.sin(a)
    x = np.clip(t - delay, 0, None)
    swell = np.clip(x / 0.12, 0, 1) * np.exp(-np.clip(x - 0.12, 0, None) / 0.7) * (t >= delay)
    air_l = highpass(rng.standard_normal(len(t)), 9000) * 0.12
    air_r = highpass(rng.standard_normal(len(t)), 9000) * 0.12
    return (left + air_l) * swell, (right + air_r) * swell


def icy_hall(stereo: np.ndarray, rng: np.random.Generator, secs: float, mix: float) -> np.ndarray:
    """Small icy reverb: decaying high-passed noise impulse per channel."""
    n = int(SR * secs)
    out = stereo.copy()
    for c in range(2):
        ir = highpass(rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * secs / 5)), 1500)
        wet = fftconvolve(stereo[:, c], ir)[: len(t)]
        out[:, c] += mix * wet / (np.abs(wet).max() + 1e-9) * np.abs(stereo[:, c]).max()
    return out


def make_variant(seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)

    # 1) the ping, centred: root then the upper note 12 ms later, softer
    lo, hi = PINGS[(seed - 1) % len(PINGS)]
    ping = glass_ping(lo, 0.0, rng.uniform(0.28, 0.36), 1.0) + glass_ping(hi, 0.012, rng.uniform(0.18, 0.25), 0.5)
    ping_st = np.stack([ping, ping], axis=1)
    ping_st = icy_hall(ping_st, rng, 1.0, 0.25)
    ping_st /= np.abs(ping_st).max()

    # 2) the shimmer, rising ~50 ms after the ping
    sl, sr = shimmer(rng, 0.05)
    sh = icy_hall(np.stack([sl, sr], axis=1), rng, 1.4, 0.35)
    sh /= np.abs(sh).max()

    mix = 0.55 * ping_st + 0.8 * sh

    # slow fade into silence by the end, then normalise to -3 dBFS peak
    fade = np.clip((LENGTH_S - 0.02 - t) / 0.4, 0, 1) ** 2
    mix *= fade[:, None]
    mix *= 10 ** (-3 / 20) / np.abs(mix).max()
    return mix.astype(np.float32)


def encode_mp3(samples: np.ndarray, path: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "v.wav")
        wavfile.write(wav, SR, samples)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "160k", path],
            check=True,
        )


def preview_png(variants: list[np.ndarray], path: str) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(2, 1, figsize=(10, 5.2), sharex=True, facecolor="#0b0d24")
    mono = variants[0].mean(axis=1)
    ax = axes[0]
    ax.set_facecolor("#0b0d24")
    for i, v in enumerate(variants):
        env = np.sqrt(np.convolve(v.mean(axis=1) ** 2, np.ones(480) / 480, mode="same"))
        ax.plot(t * 1000, 20 * np.log10(env + 1e-6), lw=1.1, label=f"variant {i + 1}", alpha=0.85)
    spans = [(0, 300, "flash"), (0, 240, "burst out"), (240, 2400, "stars drift + fade")]
    for k, (x0, x1, label) in enumerate(spans):
        ax.axvspan(x0, x1, color="#9058ff", alpha=0.08)
        ax.text(x0 + 10, -8 - 4.5 * k, label, color="#c9b0ff", ha="left", fontsize=8)
    ax.set_ylim(-70, -5)
    ax.set_ylabel("level (dB)", color="#ccd")
    ax.legend(fontsize=7, loc="upper right", facecolor="#0b0d24", labelcolor="#ccd")
    ax.set_title("Ice tap (ping + shimmer): loudness over time vs. the visual burst", color="#eef")
    axes[1].specgram(mono, NFFT=1024, Fs=SR, noverlap=896, cmap="magma", vmin=-120, xextent=(0, LENGTH_S * 1000))
    axes[1].set_ylim(0, 16000)
    axes[1].set_ylabel("Hz", color="#ccd")
    axes[1].set_xlabel("ms after the sound starts", color="#ccd")
    for a in axes:
        a.tick_params(colors="#99a")
    fig.tight_layout()
    fig.savefig(path, dpi=110, facecolor=fig.get_facecolor())


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs("docs", exist_ok=True)
    variants = [make_variant(seed) for seed in range(1, VARIANTS + 1)]
    for i, v in enumerate(variants, start=1):
        encode_mp3(v, os.path.join(OUT_DIR, f"ice-tap-{i}.mp3"))
    preview_png(variants, os.path.join("docs", "ice-tap-preview.png"))
    print(f"wrote {VARIANTS} variants to {OUT_DIR} and docs/ice-tap-preview.png")


if __name__ == "__main__":
    main()
