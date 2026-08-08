# Biblioteca de componentes · Fase 5

La biblioteca visual de structureCo vive en `src/ui/`. Es una capa de presentación tipada, accesible y sin dependencias del solver, del estado de proyectos ni de la persistencia. Su superficie de inspección es `/__components`, disponible únicamente con `npm run dev`; el código y los estilos del laboratorio se eliminan del build de producción.

## Cómo inspeccionarla

```powershell
npm run dev -- --host 127.0.0.1 --port 4185
```

Abrir `http://127.0.0.1:4185/__components`. El laboratorio permite alternar Light/Dark y ES/EN, probar escritorio/móvil, activar estados, abrir capas y comprobar callbacks en el indicador “Última interacción”.

Los estilos base se consumen con importación directa:

```tsx
import { Button, Field } from '../../ui/controls';
import { Banner } from '../../ui/feedback';
import '../../ui/ui.css';
```

No existe un archivo barril deliberadamente: las importaciones directas mantienen claras las dependencias y ayudan a separar primitivas, feedback, overlays, disclosure y patrones del editor.

## Inventario de primitivas

| Componente | Propósito | Props estables y variantes | Estados cubiertos |
| --- | --- | --- | --- |
| `Button` | Acción con texto | `variant`: primary, secondary, ghost, danger; `size`: sm, md, touch; iconos, `fullWidth` | default, hover, active, focus, disabled, loading |
| `IconButton` | Acción compacta solo con icono | `label` obligatorio; mismas variantes y tamaños de Button | default, hover, active, focus, disabled, loading |
| `Field` | Captura de texto o número | `label`, `hint`, `error`, `optionalLabel`, prefijo/sufijo, `controlSize` | normal, focus, error, disabled |
| `Select` | Selección nativa | Contrato de Field más atributos de `select` | normal, focus, error, disabled |
| `SegmentedControl` | Elegir una opción breve | `label`, `value`, `options`, `onValueChange`, sm/md | selected, hover, focus, disabled por opción |
| `Tooltip` | Ayuda breve no interactiva | `content`, trigger único, top/right/bottom/left | hover y focus del trigger |
| `Popover` | Contenido contextual interactivo | controlado con `open`/`onOpenChange`; start/center/end | abierto, cerrado, disabled, Escape, click exterior |
| `Dialog` | Decisión modal acotada | controlado; `title`, `description`, cuerpo, footer | foco inicial, trampa de foco, Escape, retorno de foco |
| `Drawer` | Panel modal con más contenido | contrato de Dialog; left/right/bottom | escritorio y sheet móvil, Escape, retorno de foco |
| `Tabs` | Alternar vistas relacionadas | controlado; horizontal/vertical; tabs deshabilitables | selected, hover, focus, disabled, teclado circular |
| `Accordion` | Divulgación progresiva | controlado; uno o varios abiertos | open, closed, focus, disabled |
| `Badge` | Estado o metadato corto | neutral, info, success, warning, error; punto opcional | contraste en Light/Dark |
| `Banner` | Mensaje persistente con contexto | info, success, warning, error; icono, acciones, dismiss | status/alert, con o sin cierre |
| `EmptyState` | Ausencia de contenido accionable | título, descripción, icono, acción, compacto | normal y compacto |
| `Spinner` | Progreso indeterminado | sm/md/lg; etiqueta accesible o decorativo | animado y reduced motion |
| `Divider` | Separación semántica | horizontal/vertical; etiqueta opcional | todos los temas |

## Inventario del editor

| Componente | Propósito | Props estables y variantes | Límite de dominio |
| --- | --- | --- | --- |
| `ToolButton` | Herramienta seleccionable del rail/dock | `label`, icono, shortcut, detail, active, compact, loading y tono técnico | Recibe callbacks; no conoce handlers del canvas |
| `ToolGroup` | Agrupar herramientas por tarea | `title`, children, compact | Sin IDs o reglas del registro de herramientas |
| `StatusStrip` | Estado resumido de análisis o tarea | ready, loading, success, stale, warning, error | Recibe textos/acciones ya derivados |
| `PanelHeader` | Encabezado consistente de panel | título, descripción, acciones | No administra paneles |
| `PropertyRow` | Alinear etiqueta, explicación y control | start/center | No interpreta propiedades estructurales |
| `UnitField` | Editar una cadena con unidad visible | `value`, `unit`, `onValueChange`, hint/error | No convierte unidades ni valida física |
| `ResultMetric` | Mostrar una métrica técnica | neutral, axial, shear, moment, deformed, reaction | No calcula ni redondea resultados de ingeniería |
| `LayerToggle` | Visibilidad de una capa | `checked`, `onCheckedChange`, descripción e icono | No muta geometría ni persistencia |
| `NumericValue` | Formato numérico tabular | locale, decimales, signo, unidad y tono | Solo usa `Intl.NumberFormat`; no hace operaciones |

Los tonos de `ToolButton` conservan la identidad del canvas: navegación neutral; estructura, carga puntual, carga distribuida, momento, cota/corte y eliminar resuelven mediante tokens técnicos. Azul queda reservado para selección y foco; el estado activo no sustituye el color del icono.

## Patrones de composición

### Formulario de panel

```tsx
import { Button } from '../../ui/controls';
import { PanelHeader, PropertyRow, UnitField } from '../../ui/editor';

<section>
  <PanelHeader title="Propiedades" description="Miembro M-04" />
  <PropertyRow label="Longitud" description="L">
    <UnitField
      label="Longitud"
      value={lengthDraft}
      unit="m"
      onValueChange={setLengthDraft}
    />
  </PropertyRow>
  <Button variant="primary" onClick={onSave}>Guardar</Button>
</section>
```

La pantalla propietaria transforma y valida `lengthDraft`; `UnitField` solo entrega la cadena editada.

### Herramienta controlada

```tsx
import { ToolButton, ToolGroup } from '../../ui/editor';

<ToolGroup title="Cargas">
  <ToolButton
    label="Carga puntual"
    icon={<PointLoadIcon />}
    shortcut="P"
    tone="load"
    active={activeTool === 'pointLoad'}
    onClick={() => onSelectTool('pointLoad')}
  />
</ToolGroup>
```

El registro existente conserva IDs, shortcuts y handlers. El componente solo representa el estado que recibe.

### Capa modal controlada

```tsx
import { Dialog } from '../../ui/overlays';

<Dialog
  open={confirmOpen}
  onOpenChange={setConfirmOpen}
  title="Confirmar cambio"
  footer={<Actions />}
>
  <p>Explicación breve de la consecuencia.</p>
</Dialog>
```

## Accesibilidad e interacción

- Todos los controles interactivos usan elementos nativos y exponen un nombre accesible. `IconButton` y `ToolButton` requieren `label`.
- Los objetivos táctiles usan la variante `touch` o alcanzan 44 px en el layout móvil. El modo compacto mantiene al menos 36 px para puntero.
- `SegmentedControl` y `Tabs` responden a flechas, Inicio y Fin, omiten opciones deshabilitadas y mantienen roving tabindex.
- `Dialog` y `Drawer` bloquean el scroll, mueven el foco dentro, lo atrapan con Tab, cierran con Escape y lo devuelven al invocador.
- `Popover` cierra con Escape o click exterior y también devuelve el foco al trigger.
- Errores, advertencias, selección y estados técnicos incluyen texto, geometría o iconografía; nunca dependen solo del color.
- `Field`, `Select` y `UnitField` enlazan hint/error mediante `aria-describedby` sin contaminar el nombre accesible de la etiqueta.
- Todas las transiciones consumen tokens y quedan prácticamente anuladas con `prefers-reduced-motion`.

## Uso correcto

- Usar `Button primary` una sola vez por grupo de decisión; secondary para alternativas y ghost para acciones de baja jerarquía.
- Usar `IconButton` solo cuando el icono sea familiar y siempre proporcionar `label`; añadir `Tooltip` si la acción necesita explicación visible.
- Usar `Banner` para un estado que afecta la tarea actual y `Badge` para metadatos cortos.
- Usar `Dialog` para decisiones breves; usar `Drawer` cuando el usuario necesita inspeccionar o editar varias propiedades sin perder el contexto.
- Mantener los componentes controlados: la pantalla posee `value/open/checked` y conecta los callbacks con su capa de aplicación.
- Preferir secciones abiertas, filas y divisores. Una superficie elevada se reserva para un panel, menú o agrupación funcional real.

## Antipatrones

- No importar desde `engine/`, `workers/`, `store/`, `data/` o `types.ts` dentro de `src/ui`.
- No introducir conversiones de unidades, tolerancias, validaciones físicas, persistencia ni efectos de canvas en componentes visuales.
- No crear un “mega componente” que reciba el proyecto completo o decida herramientas, resultados y navegación a la vez.
- No envolver cada texto o control en una tarjeta. La elevación comunica jerarquía y no debe convertirse en decoración repetitiva.
- No sustituir un control nativo por un `div` clicable ni eliminar el foco visible.
- No codificar colores hexadecimales o tokens primitivos en componentes; usar roles semánticos y técnicos de la Fase 4.
- No migrar pantallas de producción durante esta fase. La integración gradual corresponde a la Fase 6 y debe conservar handlers, IDs y atajos existentes.

## Verificación

`src/ui/*.test.tsx` cubre callbacks, teclado, disabled/loading, etiquetas, foco modal, switches y formato. `dependencyBoundary.test.ts` bloquea dependencias de dominio y consumo directo de la paleta primitiva. El gate local completo es:

```powershell
npm run verify
```
