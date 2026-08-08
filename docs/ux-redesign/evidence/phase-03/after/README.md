# Evidencia after - Fase 3

Fecha: 2026-07-17  
Alcance: canvas, herramientas, chrome, capas, labels, selección, gestos y accesibilidad visual.

## Resultado

- 125/125 comprobaciones específicas de Fase 3.
- Nueve viewports CSS: 390×844, 430×932, 834×1194, 1024×768, 1194×834, 1280×800, 1366×768, 1440×900 y 1536×960.
- 19 capturas: matriz base, Light/Dark, Completo/Aula, ES/EN, listo/analizado, capas, selecciones y WebKit.
- Cero overflow horizontal, colisiones P0/P1, intersecciones de chrome, errores de consola o errores de página.
- Targets táctiles frecuentes de 44×44 px o mayores.

## Archivos de control

- `phase3-metrics.json`: checks, matriz geométrica y resultados de interacción.
- `phase3-after-manifest.json`: viewport, estado, bytes, ruta y SHA-256 de cada captura.

## Capturas clave

| Archivo | Cobertura |
| --- | --- |
| `phase3_after_1536x960_light_complete_ready.png` | Rail expandido y canvas listo. |
| `phase3_after_1366x768_dark_complete_load-selected.png` | Rail compacto, tema oscuro y carga seleccionada. |
| `phase3_after_1024x768_light_complete_multi-selected.png` | Multiselección, envolvente, handles y contador. |
| `phase3_after_834x1194_light_complete_layers-open.png` | Dock tablet y panel de ocho capas. |
| `phase3_after_430x932_light_complete_node-support-selected.png` | Nodo/apoyo seleccionado en móvil. |
| `phase3_after_390x844_dark_aula_analyzed.png` | Aula, Dark y resultado analizado en móvil estrecho. |
| `phase3_after_1440x900_light_complete_analyzed-moment.png` | Labels y diagrama de momento. |
| `phase3_after_webkit_430x932_light_member-selected.png` | WebKit móvil con selección de miembro. |

## Método e inspección

La automatización aplicó cada viewport CSS nativo, ejecutó flujos reales y capturó la superficie visible. La revisión integrada en navegador comprobó la geometría y el DOM; los PNG se revisaron después en contact sheet y a tamaño individual. El raster exportado puede normalizar dimensiones, por lo que el manifiesto conserva el viewport objetivo por separado.

Las referencias de las páginas 22, 24, 26, 27, 29, 30, 31, 32, 33 y 35 del PDF rector se usaron como dirección visual. La implementación mantiene la identidad y arquitectura existentes; no altera el motor matemático ni reproduce literalmente los conceptos.
