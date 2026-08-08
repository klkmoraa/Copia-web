# Línea base reproducible — Fase 1

Fecha: 2026-07-17  
Aplicación: structureCo 0.7.0  
Entorno: Windows, Node.js 24.18.0, npm 11.16.0  
Servidor auditado: Vite local en `http://127.0.0.1:4173/`

## Frontera de alcance

Esta línea base congela cómo se ve y se comporta la interfaz antes del rediseño. No congela una nueva respuesta matemática: los resultados, contratos y fixtures existentes son la referencia que cualquier implementación posterior debe preservar.

## Comandos y resultado

| Comando | Resultado |
| --- | --- |
| `npm.cmd run verify` | Aprobado: lint, 40 archivos/229 pruebas y build de producción. |
| `npm.cmd run qa` | Aprobado en Chromium; todos los checks `true`, sin errores de consola o página. |
| `npm.cmd run qa:webkit` | Aprobado en perfiles iPhone 13 e iPad Pro 11. |

Se usó `npm.cmd` porque la política local de PowerShell bloquea el shim `npm.ps1`; no es una falla del producto.

## Fixture y recorrido principal

1. Abrir la pantalla de bienvenida.
2. Cargar **Pórtico de ejemplo**.
3. Seleccionar un nodo y revisar el inspector.
4. Ejecutar **Analizar**.
5. Recorrer Resumen, Reacciones, Axial, Cortante y Momento.
6. Abrir resultados e inspector en móvil.
7. Cambiar entre Completo/Aula y claro/oscuro.
8. Activar predicción de Aula.
9. Revisar el fixture de mecanismo/error.

## Cobertura visual

| Clase | Viewport | Tema | Modo/estado |
| --- | ---: | --- | --- |
| Escritorio amplio | 1536×960 | Claro | listo |
| Escritorio | 1440×900 | Claro | Completo, analizado |
| Escritorio | 1440×900 | Oscuro | Aula, predicción |
| Laptop | 1366×768 | Claro | Completo, analizado |
| Tableta horizontal | 1194×834 | Claro | Completo, analizado |
| Tableta vertical | 834×1194 | Claro | Completo, analizado |
| Móvil | 390×844 | Claro | Completo, analizado |
| Móvil | 430×932 | Oscuro | inspector abierto |
| Móvil y escritorio | 430×932 / 1536×960 | Oscuro | mecanismo/error |
| WebKit emulado | iPhone 13 / iPad Pro 11 | Claro | centro de importación |

Las imágenes y su manifiesto están en [`evidence/baseline/`](evidence/baseline/README.md).

## Límites conocidos de la línea base

- La auditoría de WebKit usa emulación; no sustituye pruebas en hardware real ni con stylus.
- No se ejecutó una auditoría completa a 200 % de zoom del navegador.
- Se comprobó restauración de foco en el inspector móvil, pero no un recorrido exhaustivo de tabulación en todas las superficies.
- La automatización funcional no detecta por sí sola colisiones, microtexto o jerarquía visual; esos puntos se registran en la auditoría manual.

