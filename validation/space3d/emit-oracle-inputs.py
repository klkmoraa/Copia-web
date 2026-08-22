#!/usr/bin/env python3
"""Genera los modelos nativos OpenSees (.tcl) y Frame3DD (.3dd) del corpus.

Los archivos se derivan de `oracles/expected/*.project.json`, de modo que el
modelo comparado y el modelo externo no pueden divergir por transcripcion.

IMPORTANTE: generar no es ejecutar. Mientras `manifest.json` marque una corrida
como `NOT_RUN`, la equivalencia de convenciones de ejes de cada archivo es una
afirmacion no verificada.

Uso:  python validation/space3d/emit-oracle-inputs.py
"""
from __future__ import annotations

import json
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
EXPECTED = ROOT / "oracles" / "expected"
OPENSEES = ROOT / "oracles" / "opensees"
FRAME3DD = ROOT / "oracles" / "frame3dd"

DOF_ORDER = ("fx", "fy", "fz", "mx", "my", "mz")


def unit(a):
    n = math.sqrt(sum(v * v for v in a))
    return [v / n for v in a]


def basis(start, end, reference, roll):
    x = unit([end[i] - start[i] for i in range(3)])
    d = sum(reference[i] * x[i] for i in range(3))
    y0 = unit([reference[i] - d * x[i] for i in range(3)])
    z0 = unit([x[1] * y0[2] - x[2] * y0[1], x[2] * y0[0] - x[0] * y0[2], x[0] * y0[1] - x[1] * y0[0]])
    c, s = math.cos(roll), math.sin(roll)
    y = [y0[i] * c + z0[i] * s for i in range(3)]
    z = [-y0[i] * s + z0[i] * c for i in range(3)]
    return x, y, z


def emit_opensees(model) -> str:
    nodes = {node["id"]: node for node in model["nodes"]}
    order = {node["id"]: index + 1 for index, node in enumerate(model["nodes"])}
    lines = [
        f'# {model["id"]} - {model["name"]}',
        "# Generado por validation/space3d/emit-oracle-inputs.py",
        "# Unidades kN, m. Ejes globales identicos a structureCo (Y vertical).",
        "wipe",
        "model BasicBuilder -ndm 3 -ndf 6",
        "",
    ]
    for node in model["nodes"]:
        lines.append(f'node {order[node["id"]]} {node["x"]!r} {node["y"]!r} {node["z"]!r}')
    lines.append("")
    for node in model["nodes"]:
        r = node["restraints"]
        flags = " ".join("1" if r[k] else "0" for k in ("ux", "uy", "uz", "rx", "ry", "rz"))
        if any(r.values()):
            lines.append(f'fix {order[node["id"]]} {flags}')
    lines.append("")
    for index, member in enumerate(model["members"], start=1):
        i, j = nodes[member["i"]], nodes[member["j"]]
        _, _, z = basis(
            [i["x"], i["y"], i["z"]], [j["x"], j["y"], j["z"]],
            member["orientation"]["localYReferenceGlobal"], member["orientation"]["rollRadians"],
        )
        # vecxz de OpenSees define el plano local x-z y cumple y_local = vecxz x x_local.
        # Con la terna diestra de S3D-1, z_local satisface exactamente esa relacion.
        lines.append(f"geomTransf Linear {index} {z[0]!r} {z[1]!r} {z[2]!r}")
        lines.append(
            f'element elasticBeamColumn {index} {order[member["i"]]} {order[member["j"]]} '
            f'{member["A"]!r} {member["E"]!r} {member["G"]!r} {member["J"]!r} {member["Iy"]!r} {member["Iz"]!r} {index}'
        )
    lines += ["", "timeSeries Linear 1", "pattern Plain 1 1 {"]
    for load in model["nodalLoads"]:
        values = " ".join(repr(float(load[k])) for k in DOF_ORDER)
        lines.append(f'    load {order[load["nodeId"]]} {values}')
    lines += [
        "}",
        "",
        "constraints Plain",
        "numberer Plain",
        "system BandGeneral",
        "algorithm Linear",
        "integrator LoadControl 1.0",
        "analysis Static",
        "",
        "file mkdir output",
    ]
    free = [n["id"] for n in model["nodes"] if not any(n["restraints"].values())]
    fixed = [n["id"] for n in model["nodes"] if any(n["restraints"].values())]
    if free:
        tags = " ".join(str(order[i]) for i in free)
        lines.append(f'recorder Node -file output/{model["id"]}.disp.out -node {tags} -dof 1 2 3 4 5 6 disp')
    if fixed:
        tags = " ".join(str(order[i]) for i in fixed)
        lines.append(f'recorder Node -file output/{model["id"]}.reaction.out -node {tags} -dof 1 2 3 4 5 6 reaction')
    lines += ["", "analyze 1", "reactions", "wipe"]
    return "\n".join(lines) + "\n"


def emit_frame3dd(model) -> str:
    nodes = {node["id"]: node for node in model["nodes"]}
    order = {node["id"]: index + 1 for index, node in enumerate(model["nodes"])}
    restrained = [n for n in model["nodes"] if any(n["restraints"].values())]
    lines = [
        f'{model["id"]} - {model["name"]} (generado, NO ejecutado)',
        "# Unidades kN, m. Asy=Asz=0 desactiva la deformacion por cortante,",
        "# para igualar la hipotesis Euler-Bernoulli de structureCo.",
        "",
        f'{len(model["nodes"])}\t\t# numero de nudos',
    ]
    for node in model["nodes"]:
        lines.append(f'{order[node["id"]]}\t{node["x"]!r}\t{node["y"]!r}\t{node["z"]!r}\t0.0')
    lines += ["", f"{len(restrained)}\t\t# nudos con reaccion"]
    for node in restrained:
        r = node["restraints"]
        flags = "\t".join("1" if r[k] else "0" for k in ("ux", "uy", "uz", "rx", "ry", "rz"))
        lines.append(f'{order[node["id"]]}\t{flags}')
    lines += ["", f'{len(model["members"])}\t\t# numero de barras']
    for index, member in enumerate(model["members"], start=1):
        roll_degrees = math.degrees(member["orientation"]["rollRadians"])
        lines.append(
            f'{index}\t{order[member["i"]]}\t{order[member["j"]]}\t'
            f'{member["A"]!r}\t0.0\t0.0\t{member["J"]!r}\t{member["Iy"]!r}\t{member["Iz"]!r}\t'
            f'{member["E"]!r}\t{member["G"]!r}\t{roll_degrees!r}\t0.0'
        )
    lines += ["", "1\t\t# 1: incluir geometria deformada en la salida", "1.0\t\t# escala de la deformada",
              "0\t\t# puntos por barra para el modal/deformada", "", "1\t\t# numero de casos de carga"]
    loads = model["nodalLoads"]
    lines += ["", f"{len(loads)}\t\t# cargas nodales"]
    for load in loads:
        values = "\t".join(repr(float(load[k])) for k in DOF_ORDER)
        lines.append(f'{order[load["nodeId"]]}\t{values}')
    lines += ["", "0\t\t# cargas uniformes", "0\t\t# cargas trapezoidales", "0\t\t# cargas internas concentradas",
              "0\t\t# cargas termicas", "0\t\t# desplazamientos prescritos", "", "0\t\t# modos dinamicos"]
    _ = nodes
    return "\n".join(lines) + "\n"


def main() -> None:
    OPENSEES.mkdir(parents=True, exist_ok=True)
    FRAME3DD.mkdir(parents=True, exist_ok=True)
    for path in sorted(EXPECTED.glob("*.project.json")):
        model = json.loads(path.read_text(encoding="utf-8"))
        (OPENSEES / f'{model["id"]}.tcl').write_text(emit_opensees(model), encoding="utf-8")
        (FRAME3DD / f'{model["id"]}.3dd').write_text(emit_frame3dd(model), encoding="utf-8")
        print(f'emitted {model["id"]}')


if __name__ == "__main__":
    main()
