"""Draw the device audio path (ADR 0012) and the input filter's frequency response.

Outputs, next to this folder: circuito-audio.png and filtro-audio-respuesta.png.
Requires schemdraw 0.19, matplotlib and numpy:
    uv venv /tmp/sd && uv pip install --python /tmp/sd/bin/python schemdraw==0.19 matplotlib numpy
    /tmp/sd/bin/python audio_circuit.py
"""
import pathlib

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import schemdraw
import schemdraw.elements as elm

OUT = pathlib.Path(__file__).resolve().parent.parent
R1 = R2 = 10e3
C1 = 4.7e-9
C2 = 2e-9  # two 1 nF capacitors in parallel
RI = 18e3  # PAM8403 input resistance (datasheet)


def response(f, load=None):
    """Two-stage RC ladder, inter-stage loading included; `load` is an optional resistor across C2."""
    s = 2j * np.pi * f
    z2 = 1 / (s * C2) if load is None else 1 / (s * C2 + 1 / load)
    zb = R2 + z2
    zp = 1 / (s * C1 + 1 / zb)
    return zp / (R1 + zp) * z2 / zb


def draw_circuit():
    schemdraw.config(fontsize=12)
    with schemdraw.Drawing(file=str(OUT / "circuito-audio.png"), dpi=250, show=False) as d:
        d += elm.Dot(open=True).label("Pin 12 (GPIO 18)\nPWM, 0 a 3,3 V", loc="left")
        d += elm.Resistor().right().label("R1 = 10 kΩ")
        d += (a := elm.Dot())
        d += elm.Resistor().right().label("R2 = 10 kΩ")
        d += (b := elm.Dot())
        d += elm.Line().right(3.2)
        amp = elm.Ic(
            pins=[
                elm.IcPin(name="IN L", side="left", slot="2/2", anchorname="inl"),
                elm.IcPin(name="GND", side="left", slot="1/2", anchorname="gndin"),
                elm.IcPin(name="L+", side="right", slot="2/2", anchorname="lp"),
                elm.IcPin(name="L−", side="right", slot="1/2", anchorname="lm"),
                elm.IcPin(name="5 V", side="top", slot="1/2", anchorname="vcc"),
                elm.IcPin(name="GND", side="top", slot="2/2", anchorname="gndp"),
            ],
            edgepadW=1.4, edgepadH=1.1, pinspacing=1.6, leadlen=0.6, label="PAM8403\n(24 dB)",
        ).anchor("inl")
        d += amp
        d += elm.Capacitor().at(a.center).down(d.unit * 1.2)
        d += elm.Label().at((a.center[0] + 0.25, a.center[1] - 1.8)).label("C1 = 4,7 nF", halign="left")
        d += (ga := elm.Dot())
        d += elm.Capacitor().at(b.center).down(d.unit * 1.2)
        d += elm.Label().at((b.center[0] + 0.25, b.center[1] - 1.8)).label("C2 = 2 nF\n(2 × 1 nF)", halign="left")
        d += (gb := elm.Dot())
        d += elm.Line().at(ga.center).to(gb.center)
        d += elm.Line().at(ga.center).left(d.unit * 1)
        d += elm.Dot(open=True).label("Pin 14 (GND)", loc="left")
        d += elm.Line().at(gb.center).tox(amp.gndin)
        d += elm.Line().toy(amp.gndin).at((amp.gndin[0], gb.center[1]))
        d += elm.Line().at(amp.lp).right(1.2)
        d += (sp := elm.Speaker().anchor("in1").label("Transductor de\nconducción ósea, 4 Ω", loc="right", ofst=0.3))
        d += elm.Line().at(amp.lm).tox(sp.in2)
        d += elm.Line().toy(sp.in2)
        d += elm.Label().at((amp.vcc[0], amp.vcc[1] + 0.35)).label("pin 2", fontsize=10)
        d += elm.Label().at((amp.gndp[0], amp.gndp[1] + 0.35)).label("pin 6", fontsize=10)


def draw_response():
    f = np.logspace(1, 6, 600)
    fig, ax = plt.subplots(figsize=(7, 3.6), dpi=200)
    ax.semilogx(f, 20 * np.log10(np.abs(response(f))), color="#1f5f4a", lw=2, label="Sin carga")
    ax.semilogx(f, 20 * np.log10(np.abs(response(f, RI))), color="#b5532a", lw=2, ls="--",
                label="Con la entrada del amplificador (18 kΩ)")
    ax.axvspan(300, 3400, color="#9cc9b6", alpha=0.35, label="Banda de la voz telefónica (300 Hz a 3,4 kHz)")
    for x, label in [(2.08e3, "−3 dB, 2,1 kHz"), (2e4, "−25 dB, 20 kHz"), (1e5, "−51,5 dB, 100 kHz")]:
        y = 20 * np.log10(abs(response(x)))
        ax.plot([x], [y], "o", color="#1f5f4a")
        ax.annotate(label, (x, y), textcoords="offset points", xytext=(6, 6), fontsize=8)
    ax.set_xlabel("Frecuencia (Hz)")
    ax.set_ylabel("Ganancia (dB)")
    ax.set_ylim(-90, 5)
    ax.grid(True, which="both", alpha=0.3)
    ax.legend(loc="lower left", fontsize=8)
    fig.tight_layout()
    fig.savefig(OUT / "filtro-audio-respuesta.png")


if __name__ == "__main__":
    draw_circuit()
    draw_response()
