# StructureCo

StructureCo es una aplicación web local-first para modelar, analizar y explicar estructuras. El producto principal trabaja con estructuras planas 2D; además incluye un espacio 3D funcional separado, todavía experimental. La aplicación corre en el navegador con React, TypeScript y Vite, sin backend obligatorio.

La autoridad del repositorio sigue este orden: código, pruebas y gates ejecutables → documentación canónica → referencias → documentación histórica y evidencia de auditoría. El [índice canónico de documentación](docs/README.md) detalla esa jerarquía.

## Capacidades actuales

| Área | Estado | Alcance comprobable |
|---|---|---|
| Modelado y análisis 2D | Vigente | Nodos, barras, apoyos, cargas, casos y combinaciones; marcos, vigas y armaduras; análisis lineal, P-Delta, líneas de influencia, diagramas y deformada. |
| Resultados | Vigente | Desplazamientos, reacciones, acciones internas, extremos, confiabilidad numérica, auditorías y explicaciones trazables. |
| Aula | Vigente | Ejercicios, recorrido guiado, predicciones, niveles pedagógicos y progreso local por proyecto. |
| Project Hub y persistencia | Vigente | Proyectos en IndexedDB, migración desde almacenamiento heredado y recuperaciones antes de operaciones sensibles. |
| Importación y exportación | Vigente con límites declarados | JSON, expediente `.structureco`, SVG, PNG, CSV y PDF portable; importación DXF ASCII de un subconjunto experimental. |
| PDF y PWA | Vigente | Memoria de cálculo PDF reimportable, manifiesto web, shell offline generado durante el build y aviso controlado de actualización. |
| `ProjectCommand` | Vigente, contrato interno | Comandos tipados, patches reversibles y una ruta común para historial/undo-redo; no es una interfaz de IA. |
| Space 3D · S3D-1 | Experimental funcional | Marco espacial elástico lineal con 6 GDL por nudo, edición, análisis, resultados, persistencia, import/export y vista 3D en un dominio separado del 2D. |
| IA mediante `CommandProposal` | No implementada | Existe únicamente un pre-RFC de referencia; no hay proveedor, SDK, llamadas de red ni mutación automática del proyecto. |

## Límites relevantes

- StructureCo es una ayuda de modelado y cálculo; no sustituye revisión, criterio ni certificación profesional.
- Space 3D sigue marcado como experimental. S3D-1 no incluye cargas en barra, liberaciones, muelles, asentamientos, deformación por cortante, dinámica ni no linealidad.
- El puente 2D → 3D es explícito y de una sola dirección: no inventa propiedades espaciales ausentes ni convierte el solver 2D en uno híbrido.
- La importación DXF admite sólo un subconjunto ASCII y muestra diagnósticos antes de crear geometría.

El alcance técnico y las convenciones de Space 3D están en el [mapa de arquitectura](docs/architecture/README.md).

## Inicio local

Requiere la versión de Node indicada en `.nvmrc`.

```powershell
npm.cmd ci
npm.cmd run dev
```

## Verificación

```powershell
npm.cmd run verify:docs
npm.cmd run verify
npm.cmd run verify:space3d
npm.cmd run validate:ci
```

`npm run verify` cubre lint, documentación, frontera protegida, pruebas, build y presupuesto de rendimiento. No se publican cantidades de pruebas en este README porque cambian con frecuencia.

## Documentación

- [Índice canónico y clasificación completa](docs/README.md)
- [Mapa de arquitectura vigente](docs/architecture/README.md)
- [Identidad visual oficial protegida](brand/README.md)
- [Política de reportes y evidencia](reports/README.md)

El roadmap y el backlog viven fuera de la documentación canónica del repositorio y no se duplican aquí.
