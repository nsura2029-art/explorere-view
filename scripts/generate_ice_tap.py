"""
Generates the original "ice tap" UI sounds used for the crystalline touch burst.

Fully synthetic (no samples, nothing taken from any film or library): struck-ice/glass partials,
a cascade of tiny crystal pings, a shimmering bell chord and an airy frost tail, timed to the
visual burst (~1 s):

    0 ms       soft glassy contact "tink"            (contact flash)
    0-60 ms    bright bell chord, the highlight      (large feature stars)
    10-260 ms  cascade of tiny ice pings             (small / medium sparkles)
    0-1000 ms  frosty shimmer tail, fading out       (particles drifting and fading)

Usage:  python scripts/generate_ice_tap.py   (needs numpy, scipy, ffmpeg on PATH)
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
LENGTH_S = 1.1
VARIANTS = 5
OUT_DIR = os.path.join("src", "assets", "sounds")

# E major pentatonic, high register: bright and "magical" without being shrill.
NOTES = {
    "E6": 1318.51, "F#6": 1479.98, "G#6": 1661.22, "B6": 1975.53, "C#7": 2217.46,
    "E7": 2637.02, "F#7": 2959.96, "G#7": 3322.44, "B7": 3951.07,
}
CHORDS = [("E6", "B6", "E7", "G#7"), ("G#6", "B6", "E7", "B7"), ("E6", "G#6", "C#7", "F#7"), ("B6", "E7", "G#7", "B7")]
GRAIN_NOTES = ["B6", "C#7", "E7", "F#7", "G#7", "B7"]
# Free-bar (struck glass / ice rod) partial ratios: inharmonic, which reads as "crystal".
BAR_PARTIALS = [(1.0, 1.0), (2.756, 0.42), (5.404, 0.18), (8.933, 0.07)]

t = np.arange(int(SR * LENGTH_S)) / SR


def envelope(start: float, decay: float, attack: float = 0.0015) -> np.ndarray:
    """Fast attack, exponential decay, zero before `start`."""
    x = t - start
    env = np.where(x < 0, 0.0, np.exp(-np.clip(x, 0, None) / decay))
    ramp = np.clip(x / attack, 0, 1)
    return env * ramp


def struck(freq: float, start: float, decay: float, amp: float, rng: np.random.Generator) -> np.ndarray:
    """One struck ice/glass note: inharmonic partials, higher ones die faster, slight detune shimmer."""
    out = np.zeros_like(t)
    for ratio, weight in BAR_PARTIALS:
        f = freq * ratio
        if f > SR * 0.45:
            continue
        d = decay / (1 + 0.9 * (ratio - 1))
        detune = 1 + rng.uniform(-0.0025, 0.0025)
        phase = rng.uniform(0, 2 * np.pi)
        voice = np.sin(2 * np.pi * f * t + phase) + 0.6 * np.sin(2 * np.pi * f * detune * t + phase * 1.3)
        out += weight * voice * envelope(start, d)
    return amp * out


def bandpass(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return sosfilt(butter(4, [lo, hi], btype="band", fs=SR, output="sos"), x)


def make_variant(seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    left = np.zeros_like(t)
    right = np.zeros_like(t)

    def add(sig: np.ndarray, pan: float) -> None:  # pan -1..1, equal power
        a = (pan + 1) * np.pi / 4
        nonlocal left, right
        left = left + sig * np.cos(a)
        right = right + sig * np.sin(a)

    # 1) contact "tink": very short, very high, centred
    tink = struck(NOTES["E7"] * 2, 0.0, 0.035, 0.35, rng)
    click = bandpass(rng.standard_normal(len(t)), 5000, 12000) * envelope(0.0, 0.006, 0.0005) * 0.25
    add(tink + click, 0.0)

    # 2) bell chord (the highlight), slightly rolled like a sparkle
    chord = CHORDS[seed % len(CHORDS)]
    for i, name in enumerate(chord):
        add(struck(NOTES[name], 0.004 + i * rng.uniform(0.006, 0.014), rng.uniform(0.13, 0.2), 0.34 - i * 0.04, rng),
            rng.uniform(-0.35, 0.35))

    # 3) cascade of tiny ice pings: dense at first, thinning out (like the sparkles flying out)
    n = rng.integers(10, 16)
    starts = np.sort(0.01 + rng.exponential(0.07, n).clip(0, 0.26))
    for s in starts:
        f = NOTES[rng.choice(GRAIN_NOTES)] * rng.choice([1.0, 1.0, 2.0])
        add(struck(f, s, rng.uniform(0.03, 0.08), rng.uniform(0.07, 0.16), rng), rng.uniform(-0.8, 0.8))

    # 4) frosty shimmer tail: airy high noise with glittering amplitude flicker
    noise = bandpass(rng.standard_normal(len(t)), 5500, 14000)
    flicker = 0.55 + 0.45 * np.abs(np.sin(2 * np.pi * rng.uniform(17, 23) * t + rng.uniform(0, 6)))
    shimmer = noise * flicker * envelope(0.015, 0.2, 0.04) * 0.08
    add(shimmer, rng.uniform(-0.2, 0.2))

    stereo = np.stack([left, right], axis=1)

    # 5) small icy "hall": decaying high-passed noise impulse, 22% wet
    ir_len = int(SR * 0.55)
    ir = rng.standard_normal((ir_len, 2)) * np.exp(-np.arange(ir_len) / (SR * 0.11))[:, None]
    ir = np.stack([bandpass(ir[:, c], 1500, 15000) for c in range(2)], axis=1)
    ir /= np.abs(ir).sum(axis=0).max() / 6
    wet = np.stack([fftconvolve(stereo[:, c], ir[:, c])[: len(t)] for c in range(2)], axis=1)
    mix = stereo + 0.22 * wet

    # gentle fade-out so it ends cleanly at ~1 s, then normalise to -3 dBFS peak
    fade = np.clip((LENGTH_S - 0.02 - t) / 0.25, 0, 1) ** 2
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
    spans = [(0, 50, "flash"), (20, 60, "small"), (50, 120, "medium"), (80, 180, "large"), (400, 900, "visual fade")]
    for k, (x0, x1, label) in enumerate(spans):
        ax.axvspan(x0, x1, color="#9058ff", alpha=0.08)
        ax.text(x1 + 4, -8 - 4.5 * (k % 4), label, color="#c9b0ff", ha="left", fontsize=8)
    ax.set_ylim(-70, -5)
    ax.set_ylabel("level (dB)", color="#ccd")
    ax.legend(fontsize=7, loc="upper right", facecolor="#0b0d24", labelcolor="#ccd")
    ax.set_title("Ice tap — loudness over time vs. the visual burst timeline", color="#eef")
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
    variants = [make_variant(seed) for seed in range(1, VARIANTS + 1)]
    for i, v in enumerate(variants, start=1):
        encode_mp3(v, os.path.join(OUT_DIR, f"ice-tap-{i}.mp3"))
    preview_png(variants, os.path.join("docs", "ice-tap-preview.png"))
    print(f"wrote {VARIANTS} variants to {OUT_DIR} and docs/ice-tap-preview.png")


if __name__ == "__main__":
    main()
