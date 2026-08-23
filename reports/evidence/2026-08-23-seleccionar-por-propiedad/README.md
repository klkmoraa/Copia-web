# Evidencia · Seleccionar por propiedad

**Ejecutado:** 2026-08-23 · Chromium real sobre el `dist/` de producción.
**Clasificación:** `AUDIT/TEMPORARY` — ver [reports/README.md](../../README.md).

| Captura | Qué enseña |
|---|---|
| `1-paleta-consultas-con-recuento.png` | La paleta (`Ctrl+K`) con el grupo **«Seleccionar por propiedad»**. El recuento viaja en la etiqueta —«Apoyos articulados · 2»— así que se sabe qué va a pasar **antes** de pulsar. |
| `2-seleccion-multiple-resultante.png` | La cadena completa: la consulta deja `N1, N2` como selección múltiple y el panel de edición masiva se abre solo, con «Apoyo · 2 de 2 compatibles» listo para cambiar los dos a la vez. **Ni una línea de pegamento**: es la misma selección que produce arrastrar un rectángulo. |
| `3-barra-contextual-con-similares.png` | «Seleccionar similares» en el desbordamiento del zócalo contextual, con una barra seleccionada. |

## Lo que estas capturas dejan medir

El producto ya tenía una edición masiva completa —agrupación por familia, cálculo
de compatibilidades, intenciones reversibles— y la única forma de llegar a ella era
señalar los objetos **uno a uno**. En un pórtico de ejemplo eso es un clic; en una malla
generada son cincuenta, y el error de haberse dejado uno no se ve hasta después de
aplicar.

En `1` sólo aparece «Apoyos articulados»: el pórtico de ejemplo no tiene armaduras ni
empotramientos, y una consulta que devuelve cero no es una opción, es ruido.

## Lo que NO cambia

Nada del motor, ningún modo de selección nuevo y ningún estado añadido. `Selection` ya
admitía `{ kind: 'multi'; nodeIds; memberIds }` desde antes; estas consultas sólo
producen una.
