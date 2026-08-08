# Riesgos residuales y limitaciones conocidas

Estado de release: structureCo 0.8.0, deploy `6a68469008f16649235e8075`.

No hay defectos funcionales, estructurales, visuales o de accesibilidad conocidos que bloqueen la release. Los siguientes límites permanecen explícitamente aceptados:

| Riesgo o límite | Impacto | Mitigación / evidencia | Owner |
| --- | --- | --- | --- |
| WebKit, touch y tamaños móviles se validan mediante emulación automatizada, no en hardware iOS/iPadOS/Android ni con stylus real. | Puede existir una diferencia específica del dispositivo o del teclado virtual. | Matriz Chromium/WebKit, targets touch, focus y overflow; repetir smoke test en hardware antes de una distribución administrada. | QA de release |
| La cobertura accesible incluye teclado, foco, semántica, contraste y reduced motion, pero no constituye una certificación WCAG ni una auditoría exhaustiva con cada lector de pantalla. | Una combinación concreta de AT/navegador puede requerir ajuste. | Gates automatizados y revisión manual de los recorridos críticos; auditoría con usuarios/AT como seguimiento. | Accesibilidad |
| Las mediciones de rendimiento se ejecutan localmente y en navegador headless. | No sustituyen datos de campo, redes lentas ni equipos de gama baja. | Presupuestos reproducibles de bundle y tiempos comparables del mismo entorno; instrumentar RUM si se publica a una audiencia amplia. | Plataforma UI |
| El preload oportunista del workspace puede comenzar durante Welcome y no existe recuperación offline garantizada si falla un chunk diferido. | En red lenta puede competir por ancho de banda o exigir recarga. | El costo se mide como “workspace temprano”; mantener fallback accesible y evaluar service worker/reintento en una fase funcional separada. | Plataforma UI |
| PDF.js, generación PDF y workers de análisis permanecen como chunks grandes bajo demanda. | Su primer uso puede ser perceptible en red lenta. | No forman parte del arranque síncrono; se conservan aislados para no arriesgar contratos de importación, exportación o cálculo. | Importación / análisis |
| El gzip de entrada síncrona de Fase 13 aumentó 1.33 %, aunque el costo temprano combinado bajó 2.71 %. | Variación menor del primer documento descargado. | Umbral de no regresión de 2 % aprobado y costo temprano total mejorado; cifras completas en `BUNDLE_REPORT.md`. | Plataforma UI |
| No se modificaron schema, persistencia ni contratos de proyecto durante el rediseño. | No existe migración nueva que valide proyectos de una futura versión de schema. | Fixtures portables y migraciones existentes siguen bajo la suite; cualquier cambio futuro exige fase funcional separada. | Datos |

## Criterio de reapertura

Una falla reproducible que cambie resultados físicos, rompa importación/exportación, impida completar un flujo crítico con teclado o genere overflow horizontal en la matriz aprobada reabre el gate y bloquea publicación.
