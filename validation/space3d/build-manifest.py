#!/usr/bin/env python3
"""Construye `oracles/manifest.json` a partir del corpus ya generado.

Cada caso declara observables por grupo (`nodes.<id>` y `reactions.<id>`), que
la prueba `oracleComparison.test.ts` expande a los seis GDL. La prueba exige que
todo valor del archivo esperado quede cubierto por algun observable, de modo que
ningun numero pueda quedar sin comparar en silencio.

Las corridas externas se registran con `status: "NOT_RUN"` hasta que exista una
salida real con version y hash. Este script nunca inventa `outputSha256`.

Uso:  python validation/space3d/build-manifest.py
"""
from __future__ import annotations

import hashlib
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
ORACLES = ROOT / "oracles"
EXPECTED = ORACLES / "expected"

TOLERANCES = {
    "nodes.fixed": {"unit": "m, rad", "atol": 1e-15, "rtol": 0.0},
    "nodes.free": {"unit": "m, rad", "atol": 1e-12, "rtol": 1e-9},
    "reactions.fixed": {"unit": "kN, kN·m", "atol": 1e-9, "rtol": 1e-9},
    "reactions.free": {"unit": "kN, kN·m", "atol": 1e-15, "rtol": 0.0},
}


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def executed_runs() -> dict:
    """Corridas reales registradas por `run-oracles.py`, indexadas por caso y motor."""
    path = ORACLES / "runs.json"
    if not path.exists():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {(run["caseId"], run["oracle"]): run for run in payload["runs"] if run.get("status") == "RUN"}


RUNS = executed_runs()

# Frame3DD sigue pendiente y la razon es concreta, no generica: los espejos de
# descarga de SourceForge responden 403, el paquete PyPI que comparte nombre es
# un generador de archivos y no el solver, y no hay toolchain de C en el equipo
# para compilar la fuente oficial.
NOT_RUN_REASONS = {
    "frame3dd": (
        "frame3dd executable unavailable: SourceForge mirrors return 403, the PyPI "
        "package of the same name is an input-file generator rather than the solver, "
        "and no C toolchain is present to build the official source"
    ),
}


# structureCo pone a cero exacto la reaccion en los GDL libres: ahi no hay
# reaccion, hay un residuo numerico, y publicarlo seria ruido con aspecto de
# dato. OpenSees y PyNite si lo publican. Exigirle cero exacto a un motor
# externo compararia esa decision de presentacion, no la fisica, asi que la
# comparacion externa usa en los GDL libres el mismo suelo absoluto que ya
# emplea en los restringidos: 1e-9 kN sobre acciones de 100 kN son 1e-11
# relativo, un limite que sigue siendo severo.
def external_observables(observables: list) -> list:
    adjusted = []
    for observable in observables:
        if observable["path"].startswith("reactions.") and observable["rtol"] == 0.0:
            adjusted.append({**observable, **TOLERANCES["reactions.fixed"]})
        else:
            adjusted.append(dict(observable))
    return adjusted


def external_run(case_id: str, oracle: str, model_path: pathlib.Path, observables: list) -> dict:
    executed = RUNS.get((case_id, oracle))
    if executed:
        output = ORACLES / executed["output"]
        return {
            "caseId": case_id,
            "oracle": oracle,
            "status": "RUN",
            "reason": None,
            "input": executed["input"],
            "inputSha256": executed["inputSha256"],
            "output": executed["output"],
            "outputSha256": sha256(output),
            "version": executed["version"],
            "os": executed["os"],
            "command": executed["command"],
            "units": executed["units"],
            "axes": executed["axes"],
            "signMap": executed["signMap"],
            "observables": external_observables(observables),
        }

    native = {"frame3dd": ("frame3dd", "3dd"), "opensees": ("opensees", "tcl")}.get(oracle)
    source = ORACLES / native[0] / f"{case_id}.{native[1]}" if native else None
    return {
        "caseId": case_id,
        "oracle": oracle,
        "status": "NOT_RUN",
        "reason": NOT_RUN_REASONS.get(oracle, "oracle executable unavailable"),
        "input": f"{native[0]}/{case_id}.{native[1]}" if native else None,
        "inputSha256": sha256(source) if source and source.exists() else None,
        "output": None,
        "outputSha256": None,
        "version": None,
        "os": None,
        "command": None,
        "units": "kN, m",
        "axes": "X, Y, Z globales; Y vertical (identico a structureCo)",
        "signMap": None,
        "observables": None,
    }


def main() -> None:
    cases = []
    external = []
    for path in sorted(EXPECTED.glob("*.project.json")):
        model = json.loads(path.read_text(encoding="utf-8"))
        case_id = model["id"]
        fixed = [n["id"] for n in model["nodes"] if any(n["restraints"].values())]
        free = [n["id"] for n in model["nodes"] if not any(n["restraints"].values())]

        observables = []
        for node_id in free:
            observables.append({"path": f"nodes.{node_id}", **TOLERANCES["nodes.free"]})
        for node_id in fixed:
            observables.append({"path": f"nodes.{node_id}", **TOLERANCES["nodes.fixed"]})
        for node_id in fixed:
            observables.append({"path": f"reactions.{node_id}", **TOLERANCES["reactions.fixed"]})
        for node_id in free:
            observables.append({"path": f"reactions.{node_id}", **TOLERANCES["reactions.free"]})

        cases.append({
            "id": case_id,
            "source": "manual",
            "target": "LC1",
            "model": f"expected/{case_id}.project.json",
            "result": f"expected/{case_id}.result.json",
            "modelSha256": sha256(path),
            "resultSha256": sha256(EXPECTED / f"{case_id}.result.json"),
            "observables": observables,
        })

        for oracle in ("opensees", "pynite", "frame3dd"):
            external.append(external_run(case_id, oracle, path, observables))

    manifest = {
        "schemaVersion": 1,
        "generatedBy": "validation/space3d/build-manifest.py",
        "engine": "structureCo 0.8.2 · src/space3d",
        "notes": [
            "Los casos `manual` comparan el solver contra formas cerradas derivadas en manual-cases.md.",
            "Los valores esperados los produce validation/space3d/derive-expected.py, que no usa el solver.",
            "Una corrida externa sólo pasa a PASS cuando tiene output, versión y hash reales.",
            "Las corridas externas las produce validation/space3d/run-oracles.py, que no importa nada de structureCo.",
        ],
        "cases": cases,
        "externalRuns": external,
    }
    (ORACLES / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"manifest with {len(cases)} manual cases and {len(external)} external runs")


if __name__ == "__main__":
    main()
