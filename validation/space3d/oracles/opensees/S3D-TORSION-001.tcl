# S3D-TORSION-001 - Voladizo a torsion
# Generado por validation/space3d/emit-oracle-inputs.py
# Unidades kN, m. Ejes globales identicos a structureCo (Y vertical).
wipe
model BasicBuilder -ndm 3 -ndf 6

node 1 0.0 0.0 0.0
node 2 2.0 0.0 0.0

fix 1 1 1 1 1 1 1

geomTransf Linear 1 0.0 0.0 1.0
element elasticBeamColumn 1 1 2 0.01 200000000.0 80000000.0 2e-05 3e-05 8e-05 1

timeSeries Linear 1
pattern Plain 1 1 {
    load 2 0.0 0.0 0.0 10.0 0.0 0.0
}

constraints Plain
numberer Plain
system BandGeneral
algorithm Linear
integrator LoadControl 1.0
analysis Static

file mkdir output
recorder Node -file output/S3D-TORSION-001.disp.out -node 2 -dof 1 2 3 4 5 6 disp
recorder Node -file output/S3D-TORSION-001.reaction.out -node 1 -dof 1 2 3 4 5 6 reaction

analyze 1
reactions
wipe
