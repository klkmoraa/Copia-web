# AG-010

# Exportación Vectorial CAD a Formato DXF (AutoCAD / FTOOL Compatible)

# Descartada

# 2026-08-05

# Importación / Exportación

> ## Nota de Descarte
>
> Descartada por decisión explícita del usuario en sesión del 2026-08-05 ("no me interesa la exportacion cad ni dxf"). El enfoque del producto prioriza la experiencia en la aplicación web, el rendimiento interactivo y la publicación en memorias de cálculo PDF nativas.

# Resumen ejecutivo

Propone desarrollar un generador de archivos DXF (`src/utils/dxfExport.ts`) para exportar la geometría del modelo estructural, apoyos y diagramas de esfuerzos hacia software CAD profesional como AutoCAD, Revit, Rhino o FTOOL.

# Problema

La aplicación actualmente exporta a JSON, SVG, PNG y PDF, pero carece de un formato de intercambio CAD nativo para ingenieros estructurales que redactan planos constructivos o intercambian archivos con otros programas de cálculo.

# Evidencia

- `src/utils/export.ts` y `src/utils/svgExport.ts`: Generadores de archivos de exportación vectoriales existentes.

# Objetivo

1. Crear `src/utils/dxfExport.ts` que convierta el modelo `ProjectModel` y los diagramas de resultados a entidades DXF vectoriales (LINE, POINT, TEXT, POLYLINE).
2. Integrar la opción de descarga "Exportar DXF (.dxf)" en el menú de exportación de la TopBar.
3. Organizar las entidades por capas limpias (CAPA_NODOS, CAPA_MIEMBROS, CAPA_APOYOS, CAPA_CARGAS, CAPA_DIAGRAMAS).
