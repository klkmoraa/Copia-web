#!/usr/bin/env python3
"""Deriva los valores esperados del corpus manual de Space 3D.

Este script NO usa el solver de structureCo: evalúa exclusivamente las formas
cerradas documentadas en `manual-cases.md` y la definicion geometrica de la
triada local. Es la ruta independiente contra la que se compara el motor.

Uso (desde la raiz del repositorio):

    python validation/space3d/derive-expected.py

Sobrescribe `oracles/expected/*.result.json`. Los `*.project.json` se escriben
tambien aqui para que modelo y esperado viajen juntos y no puedan divergir.
"""
from __future__ import annotations

import json
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
EXPECTED = ROOT / "oracles" / "expected"

STEEL = dict(E=2.0e8, G=8.0e7, A=0.01, Iy=3.0e-5, Iz=8.0e-5, J=2.0e-5)


def sub(a, b):
    return [a[i] - b[i] for i in range(3)]


def scale(a, k):
    return [a[i] * k for i in range(3)]


def dot(a, b):
    return sum(a[i] * b[i] for i in range(3))


def cross(a, b):
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]


def norm(a):
    return math.sqrt(dot(a, a))


def unit(a):
    n = norm(a)
    return [a[i] / n for i in range(3)]


def basis(start, end, reference, roll=0.0):
    """Triada local segun la definicion de S3D-1 (ver `docs`/`types.ts`)."""
    x = unit(sub(end, start))
    projected = sub(reference, scale(x, dot(reference, x)))
    y0 = unit(projected)
    z0 = unit(cross(x, y0))
    c, s = math.cos(roll), math.sin(roll)
    y = [y0[i] * c + z0[i] * s for i in range(3)]
    z = [-y0[i] * s + z0[i] * c for i in range(3)]
    return x, y, z


def restraint(fixed):
    return {k: fixed for k in ("ux", "uy", "uz", "rx", "ry", "rz")}


def project(pid, name, nodes, members, loads):
    return {
        "analysisSpace": "space-3d",
        "schemaVersion": 1,
        "id": pid,
        "name": name,
        "units": "kN-m",
        "nodes": nodes,
        "members": members,
        "nodalLoads": loads,
        "loadCases": [{"id": "LC1", "name": "LC1"}],
        "loadCombinations": [{"id": "CO1", "name": "CO1", "terms": [{"caseId": "LC1", "factor": 1}]}],
    }


def member(mid, i, j, reference=(0.0, 1.0, 0.0), roll=0.0, **overrides):
    props = dict(STEEL)
    props.update(overrides)
    return {
        "id": mid,
        "i": i,
        "j": j,
        **props,
        "orientation": {"localYReferenceGlobal": list(reference), "rollRadians": roll},
    }


def load(lid, node_id, **components):
    body = {"id": lid, "caseId": "LC1", "nodeId": node_id,
            "fx": 0.0, "fy": 0.0, "fz": 0.0, "mx": 0.0, "my": 0.0, "mz": 0.0}
    body.update(components)
    return body


def straight(pid, name, length, load_components, **overrides):
    nodes = [
        {"id": "I", "x": 0.0, "y": 0.0, "z": 0.0, "restraints": restraint(True)},
        {"id": "J", "x": length, "y": 0.0, "z": 0.0, "restraints": restraint(False)},
    ]
    return project(pid, name, nodes, [member("M1", "I", "J", **overrides)], [load("L1", "J", **load_components)])


def dofs(ux=0.0, uy=0.0, uz=0.0, rx=0.0, ry=0.0, rz=0.0):
    return {"ux": ux, "uy": uy, "uz": uz, "rx": rx, "ry": ry, "rz": rz}


CASES = {}


# --- S3D-AXIAL-001 ---------------------------------------------------------
L, P = 2.0, 100.0
CASES["S3D-AXIAL-001"] = (
    straight("S3D-AXIAL-001", "Voladizo axial", L, {"fx": P}),
    {
        "nodes": {"I": dofs(), "J": dofs(ux=P * L / (STEEL["E"] * STEEL["A"]))},
        "reactions": {"I": dofs(ux=-P), "J": dofs()},
    },
)

# --- S3D-TORSION-001 -------------------------------------------------------
L, T = 2.0, 10.0
CASES["S3D-TORSION-001"] = (
    straight("S3D-TORSION-001", "Voladizo a torsion", L, {"mx": T}),
    {
        "nodes": {"I": dofs(), "J": dofs(rx=T * L / (STEEL["G"] * STEEL["J"]))},
        "reactions": {"I": dofs(rx=-T), "J": dofs()},
    },
)

# --- S3D-BENDING-Z-001 (carga fy, trabaja Iz) ------------------------------
L, P = 2.0, 10.0
Iz = STEEL["Iz"]
CASES["S3D-BENDING-Z-001"] = (
    straight("S3D-BENDING-Z-001", "Voladizo flexion plano x-y", L, {"fy": P}),
    {
        "nodes": {
            "I": dofs(),
            "J": dofs(uy=P * L ** 3 / (3 * STEEL["E"] * Iz), rz=P * L ** 2 / (2 * STEEL["E"] * Iz)),
        },
        "reactions": {"I": dofs(uy=-P, rz=-P * L), "J": dofs()},
    },
)

# --- S3D-BENDING-Y-001 (carga fz, trabaja Iy) ------------------------------
Iy = STEEL["Iy"]
CASES["S3D-BENDING-Y-001"] = (
    straight("S3D-BENDING-Y-001", "Voladizo flexion plano x-z", L, {"fz": P}),
    {
        "nodes": {
            "I": dofs(),
            "J": dofs(uz=P * L ** 3 / (3 * STEEL["E"] * Iy), ry=-P * L ** 2 / (2 * STEEL["E"] * Iy)),
        },
        "reactions": {"I": dofs(uz=-P, ry=P * L), "J": dofs()},
    },
)

# --- S3D-FRAME-001 (miembro inclinado, carga axial + transversal local) ----
END = [2.0, 3.0, 6.0]
LENGTH = norm(END)  # exactamente 7 m
X, Y, Z = basis([0.0, 0.0, 0.0], END, [0.0, 1.0, 0.0])
PX, PY = 100.0, 10.0
FORCE = [PX * X[i] + PY * Y[i] for i in range(3)]
AXIAL = PX * LENGTH / (STEEL["E"] * STEEL["A"])
FLEX = PY * LENGTH ** 3 / (3 * STEEL["E"] * STEEL["Iz"])
SLOPE = PY * LENGTH ** 2 / (2 * STEEL["E"] * STEEL["Iz"])
TIP = [AXIAL * X[i] + FLEX * Y[i] for i in range(3)]
TWIST = [SLOPE * Z[i] for i in range(3)]
REACTION_MOMENT = [-PY * LENGTH * Z[i] for i in range(3)]

CASES["S3D-FRAME-001"] = (
    project(
        "S3D-FRAME-001",
        "Voladizo inclinado en el espacio",
        [
            {"id": "I", "x": 0.0, "y": 0.0, "z": 0.0, "restraints": restraint(True)},
            {"id": "J", "x": END[0], "y": END[1], "z": END[2], "restraints": restraint(False)},
        ],
        [member("M1", "I", "J")],
        [load("L1", "J", fx=FORCE[0], fy=FORCE[1], fz=FORCE[2])],
    ),
    {
        "nodes": {
            "I": dofs(),
            "J": dofs(ux=TIP[0], uy=TIP[1], uz=TIP[2], rx=TWIST[0], ry=TWIST[1], rz=TWIST[2]),
        },
        "reactions": {
            "I": dofs(ux=-FORCE[0], uy=-FORCE[1], uz=-FORCE[2],
                      rx=REACTION_MOMENT[0], ry=REACTION_MOMENT[1], rz=REACTION_MOMENT[2]),
            "J": dofs(),
        },
    },
)


def main() -> None:
    EXPECTED.mkdir(parents=True, exist_ok=True)
    for case_id, (model, result) in CASES.items():
        (EXPECTED / f"{case_id}.project.json").write_text(
            json.dumps(model, indent=2) + "\n", encoding="utf-8")
        (EXPECTED / f"{case_id}.result.json").write_text(
            json.dumps({"case": case_id, "target": "LC1", "source": "manual-closed-form", **result},
                       indent=2) + "\n", encoding="utf-8")
        print(f"wrote {case_id}")
    print(f"S3D-FRAME-001 length = {LENGTH!r}")
    print(f"S3D-FRAME-001 x = {X!r}")
    print(f"S3D-FRAME-001 y = {Y!r}")
    print(f"S3D-FRAME-001 z = {Z!r}")


if __name__ == "__main__":
    main()
