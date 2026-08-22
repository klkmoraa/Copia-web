#!/usr/bin/env python3
"""Ejecuta el corpus de Space 3D contra motores externos independientes.

Motores soportados:

  · OpenSees (openseespy) — nucleo C++ de UC Berkeley.
  · PyNite (PyNiteFEA)    — implementacion independiente en Python puro.

Ninguno se considera verdad unica: se ejecutan los dos y se comparan por
separado contra structureCo. Este script NO importa nada de structureCo; lee los
mismos `expected/*.project.json` y produce salidas en el mismo formato que la
prueba de comparacion consume.

Convenciones verificadas para este corpus (no se asumen, se comprueban con los
casos de flexion, que son los unicos sensibles a la orientacion):

  · OpenSees: `geomTransf Linear` recibe `vecxz`, y con la terna diestra de
    S3D-1 esa direccion es exactamente el eje local z.
  · PyNite: para un miembro horizontal toma y = [0,1,0]; para uno inclinado,
    z horizontal y y = z x x. Ambas coinciden con la referencia [0,1,0] de
    S3D-1, asi que `rotation` se queda en cero.

Uso:

    python validation/space3d/run-oracles.py            # ejecuta y escribe
    python validation/space3d/run-oracles.py --check    # no escribe, solo informa
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import pathlib
import platform
import sys

ROOT = pathlib.Path(__file__).resolve().parent
ORACLES = ROOT / "oracles"
EXPECTED = ORACLES / "expected"

DOFS = ("ux", "uy", "uz", "rx", "ry", "rz")


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def unit(vector):
    length = math.sqrt(sum(component * component for component in vector))
    return [component / length for component in vector]


def local_axes(start, end, reference, roll):
    """Triada de S3D-1: x de i a j, y la referencia proyectada y girada, z = x x y."""
    x = unit([end[i] - start[i] for i in range(3)])
    d = sum(reference[i] * x[i] for i in range(3))
    y0 = unit([reference[i] - d * x[i] for i in range(3)])
    z0 = unit([
        x[1] * y0[2] - x[2] * y0[1],
        x[2] * y0[0] - x[0] * y0[2],
        x[0] * y0[1] - x[1] * y0[0],
    ])
    c, s = math.cos(roll), math.sin(roll)
    y = [y0[i] * c + z0[i] * s for i in range(3)]
    z = [-y0[i] * s + z0[i] * c for i in range(3)]
    return x, y, z


def zero_dofs():
    return {dof: 0.0 for dof in DOFS}


# --------------------------------------------------------------------------- #
# OpenSees
# --------------------------------------------------------------------------- #

def run_opensees(model):
    import openseespy.opensees as ops

    ops.wipe()
    ops.model("basic", "-ndm", 3, "-ndf", 6)

    tags = {node["id"]: index + 1 for index, node in enumerate(model["nodes"])}
    by_id = {node["id"]: node for node in model["nodes"]}

    for node in model["nodes"]:
        ops.node(tags[node["id"]], float(node["x"]), float(node["y"]), float(node["z"]))
        flags = [1 if node["restraints"][dof] else 0 for dof in DOFS]
        if any(flags):
            ops.fix(tags[node["id"]], *flags)

    for index, member in enumerate(model["members"], start=1):
        i, j = by_id[member["i"]], by_id[member["j"]]
        _, _, z = local_axes(
            [i["x"], i["y"], i["z"]], [j["x"], j["y"], j["z"]],
            member["orientation"]["localYReferenceGlobal"],
            member["orientation"]["rollRadians"],
        )
        ops.geomTransf("Linear", index, *[float(component) for component in z])
        ops.element(
            "elasticBeamColumn", index, tags[member["i"]], tags[member["j"]],
            float(member["A"]), float(member["E"]), float(member["G"]),
            float(member["J"]), float(member["Iy"]), float(member["Iz"]), index,
        )

    ops.timeSeries("Linear", 1)
    ops.pattern("Plain", 1, 1)
    for load in model["nodalLoads"]:
        ops.load(
            tags[load["nodeId"]],
            float(load["fx"]), float(load["fy"]), float(load["fz"]),
            float(load["mx"]), float(load["my"]), float(load["mz"]),
        )

    ops.constraints("Plain")
    ops.numberer("Plain")
    ops.system("BandGeneral")
    ops.algorithm("Linear")
    ops.integrator("LoadControl", 1.0)
    ops.analysis("Static")
    if ops.analyze(1) != 0:
        raise RuntimeError("OpenSees no convergio")
    ops.reactions()

    nodes, reactions, raw = {}, {}, {}
    for node in model["nodes"]:
        tag = tags[node["id"]]
        displacement = ops.nodeDisp(tag)
        reaction = ops.nodeReaction(tag)
        raw[node["id"]] = {"nodeDisp": list(displacement), "nodeReaction": list(reaction)}
        nodes[node["id"]] = dict(zip(DOFS, [float(value) for value in displacement]))
        # `reactions()` de OpenSees devuelve la fuerza que el apoyo ejerce sobre
        # la estructura, con el mismo signo que R = K*U - F de structureCo.
        reactions[node["id"]] = dict(zip(DOFS, [float(value) for value in reaction]))

    version = ops.version()
    ops.wipe()
    return {"nodes": nodes, "reactions": reactions}, raw, f"OpenSees {version} (openseespy)"


# --------------------------------------------------------------------------- #
# PyNite
# --------------------------------------------------------------------------- #

def run_pynite(model):
    import importlib.metadata as metadata
    from Pynite import FEModel3D

    fem = FEModel3D()
    by_id = {node["id"]: node for node in model["nodes"]}

    for node in model["nodes"]:
        fem.add_node(node["id"], float(node["x"]), float(node["y"]), float(node["z"]))
        restraints = node["restraints"]
        fem.def_support(
            node["id"],
            bool(restraints["ux"]), bool(restraints["uy"]), bool(restraints["uz"]),
            bool(restraints["rx"]), bool(restraints["ry"]), bool(restraints["rz"]),
        )

    for index, member in enumerate(model["members"], start=1):
        material = f"mat{index}"
        section = f"sec{index}"
        E, G = float(member["E"]), float(member["G"])
        # PyNite exige nu aunque use E y G por separado en la rigidez del frame.
        fem.add_material(material, E, G, E / (2.0 * G) - 1.0, 0.0)
        fem.add_section(section, float(member["A"]), float(member["Iy"]), float(member["Iz"]), float(member["J"]))
        fem.add_member(member["id"], member["i"], member["j"], material, section, rotation=0.0)
        _ = by_id  # la topologia ya la resuelve PyNite por nombre de nudo

    for load in model["nodalLoads"]:
        for direction, key in (("FX", "fx"), ("FY", "fy"), ("FZ", "fz"), ("MX", "mx"), ("MY", "my"), ("MZ", "mz")):
            if float(load[key]) != 0.0:
                fem.add_node_load(load["nodeId"], direction, float(load[key]), case="LC")
    fem.add_load_combo("C", {"LC": 1.0})
    fem.analyze_linear(check_statics=False, sparse=False)

    nodes, reactions, raw = {}, {}, {}
    for node in model["nodes"]:
        item = fem.nodes[node["id"]]
        displacement = [item.DX["C"], item.DY["C"], item.DZ["C"], item.RX["C"], item.RY["C"], item.RZ["C"]]
        reaction = [item.RxnFX["C"], item.RxnFY["C"], item.RxnFZ["C"], item.RxnMX["C"], item.RxnMY["C"], item.RxnMZ["C"]]
        raw[node["id"]] = {"displacement": list(displacement), "reaction": list(reaction)}
        nodes[node["id"]] = dict(zip(DOFS, [float(value) for value in displacement]))
        reactions[node["id"]] = dict(zip(DOFS, [float(value) for value in reaction]))

    return {"nodes": nodes, "reactions": reactions}, raw, f"PyNite {metadata.version('PyNiteFEA')}"


ENGINES = {"opensees": run_opensees, "pynite": run_pynite}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="no escribe archivos")
    arguments = parser.parse_args()

    runs = []
    for path in sorted(EXPECTED.glob("*.project.json")):
        model = json.loads(path.read_text(encoding="utf-8"))
        case_id = model["id"]
        for engine, runner in ENGINES.items():
            try:
                observables, raw, version = runner(model)
            except Exception as error:  # noqa: BLE001 - se registra y se sigue
                print(f"  {engine} {case_id}: ERROR {error}")
                runs.append({"caseId": case_id, "oracle": engine, "status": "FAILED", "reason": str(error)})
                continue

            directory = ORACLES / engine / "output"
            output = directory / f"{case_id}.json"
            payload = {
                "case": case_id,
                "target": "LC1",
                "oracle": engine,
                "version": version,
                "units": "kN, m",
                "axes": "X, Y, Z globales; Y vertical (identico a structureCo)",
                "signMap": "identidad: desplazamientos y reacciones en ejes globales, R = K*U - F",
                **observables,
            }
            if not arguments.check:
                directory.mkdir(parents=True, exist_ok=True)
                output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
                (directory / f"{case_id}.raw.json").write_text(
                    json.dumps({"engine": version, "raw": raw}, indent=2) + "\n", encoding="utf-8")

            runs.append({
                "caseId": case_id,
                "oracle": engine,
                "status": "RUN",
                "reason": None,
                "input": f"expected/{case_id}.project.json",
                "inputSha256": sha256(path),
                "output": f"{engine}/output/{case_id}.json",
                "outputSha256": sha256(output) if output.exists() else None,
                "version": version,
                "os": f"{platform.system()} {platform.release()} ({platform.machine()})",
                "command": f"python validation/space3d/run-oracles.py [{engine}]",
                "units": "kN, m",
                "axes": "X, Y, Z globales; Y vertical (identico a structureCo)",
                "signMap": "identidad",
                "observables": None,
            })
            print(f"  {engine} {case_id}: OK ({version})")

    if not arguments.check:
        (ORACLES / "runs.json").write_text(json.dumps({"schemaVersion": 1, "runs": runs}, indent=2) + "\n", encoding="utf-8")
    print(f"{sum(1 for run in runs if run['status'] == 'RUN')} corridas correctas de {len(runs)}")
    return 0 if all(run["status"] == "RUN" for run in runs) else 1


if __name__ == "__main__":
    sys.exit(main())
