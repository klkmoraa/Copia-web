# Referencia de comportamiento inspirada en FTool

structureCo usa FTool como referencia de **flujo de trabajo**, no como fuente de código.

Características de comportamiento adoptadas:

1. El modelo y los resultados comparten el mismo lienzo.
2. Nodos, miembros, apoyos y cargas se crean gráficamente.
3. El análisis principal es estático lineal de estructuras planas 2D.
4. Los resultados incluyen reacciones, desplazamientos, deformada y diagramas internos.
5. El lado visual del diagrama puede cambiar sin alterar el signo numérico.
6. Los apoyos inclinados tienen sistema local y reacciones en ese sistema.
7. Los tamaños gráficos se mantienen legibles en píxeles al cambiar el zoom.
8. Las unidades de visualización son configurables.
9. Los casos y combinaciones operan sobre resultados completos.

Mejoras propias de structureCo:

- carga por longitud real/proyección horizontal/proyección vertical explícita;
- procedimiento educativo generado desde el mismo registro de cálculo;
- cortes con lectura exacta de `N(x)`, `V(x)` y `M(x)`;
- curvas Bézier analíticamente exactas por tramo;
- validaciones con explicación física;
- proyecto local-first, web, móvil y open source.
