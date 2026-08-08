# Color y accesibilidad

## Criterios

StructureCo aplica WCAG 2.2 AA como piso visual:

- Texto normal: contraste mínimo 4.5:1.
- Texto grande y componentes gráficos esenciales: 3:1.
- Focus ring y límites de controles: 3:1 contra el color adyacente.
- Estados, herramientas y resultados nunca dependen sólo del color.
- El texto disabled no comunica información indispensable por sí solo.

Los valores siguientes se calculan sobre los tokens efectivos de `tokens.css`.

## Contraste de interfaz

| Tema | Combinación | Relación | Resultado |
| --- | --- | ---: | --- |
| Light | Texto principal / superficie 1 | 16.67:1 | AA |
| Light | Texto secundario / superficie 1 | 5.49:1 | AA |
| Light | Acción primaria / texto de acción | 5.32:1 | AA |
| Light | Foco / superficie 1 | 5.01:1 | AA gráfico |
| Light | Warning foreground / superficie 1 | 6.56:1 | AA |
| Light | Error foreground / superficie 1 | 6.70:1 | AA |
| Dark | Texto principal / superficie 1 | 16.15:1 | AA |
| Dark | Texto secundario / superficie 1 | 8.34:1 | AA |
| Dark | Acción primaria / texto de acción | 7.54:1 | AA |
| Dark | Foco / superficie 1 | 6.82:1 | AA gráfico |
| Dark | Warning / superficie 1 | 8.82:1 | AA |
| Dark | Error / superficie 1 | 5.94:1 | AA |

`text-muted` se reserva para metadatos auxiliares de tamaño suficiente. Para párrafos, instrucciones o valores que afecten una decisión se usa `text-secondary` o `text-primary`.

## Paleta técnica sobre el canvas

La paleta técnica se valida como elemento gráfico contra `bg-canvas`.

| Magnitud | Light | Contraste | Dark | Contraste |
| --- | --- | ---: | --- | ---: |
| Carga | `#E25D32` | 3.43:1 | `#FF825C` | 7.95:1 |
| Axial N | `#0E7490` | 5.11:1 | `#51BDD2` | 8.84:1 |
| Cortante V | `#2F8F59` | 3.86:1 | `#58CF83` | 9.86:1 |
| Momento M | `#B94B43` | 4.83:1 | `#FF8279` | 8.06:1 |
| Deformada | `#2F8F9D` | 3.62:1 | `#65CBD1` | 10.19:1 |
| Reacción | `#2867E8` | 4.77:1 | `#78A8FF` | 8.18:1 |
| Cota | `#8D6C19` | 4.67:1 | `#E7BD55` | 10.92:1 |
| Eje/corte | `#A9552D` | 4.98:1 | `#ED8B58` | 7.80:1 |

Los colores técnicos no son tokens de estado. Un resultado correcto no se pinta con `technical-shear`, ni un error con `technical-moment`, aunque los tonos sean cercanos.

## Redundancia perceptiva

| Significado | Señal de color | Señal adicional obligatoria |
| --- | --- | --- |
| Selección | Azul | Halo, contorno, handles o geometría redundante. |
| Foco | Azul | Outline visible y posición de teclado. |
| Carga puntual | Naranja | Flecha individual. |
| Carga distribuida | Verde | Serie de flechas y línea de distribución. |
| Momento | Coral | Flecha circular. |
| Cota | Ocre | Extensiones, línea y puntas de cota. |
| Error | Rojo | Icono, texto y mensaje explicativo. |
| Warning | Ámbar | Icono y etiqueta de advertencia. |
| Éxito | Verde de estado | Icono de confirmación y texto. |

El color propio del icono de herramienta se conserva en hover, active y focus. El active puede sumar fondo o borde suave, pero no reemplaza la identidad del icono. Disabled reduce prominencia manteniendo forma y nombre accesible.

## Reglas por tema

- No usar filtros de inversión, `brightness()` global ni opacidad para fabricar Dark.
- Texto técnico dentro del canvas usa el token del dato y, cuando es pequeño, `paint-order`, halo o fondo para mantener lectura.
- La cuadrícula siempre queda por debajo del miembro y de resultados.
- Overlays tienen niveles soft, sheet y strong; nunca se usa negro arbitrario en el componente.
- El azul de interacción no se usa como color activo genérico de herramientas. Las reacciones conservan su rol técnico únicamente dentro de la representación estructural.

## Verificación al agregar un color

1. Definir el rol semántico antes del valor.
2. Proponer valores Light y Dark juntos.
3. Medir contraste contra todos los fondos donde aparecerá.
4. Agregar una señal no cromática.
5. Probar normal, hover, active, focus y disabled.
6. Añadir el par al contrato automático de tokens si es texto, foco o dato técnico esencial.
