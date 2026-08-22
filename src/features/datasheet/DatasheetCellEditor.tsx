import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { DatasheetField } from './datasheetEditModel';
import type { DatasheetFieldOption } from './datasheetPresentation';

/**
 * Editor dentro de la celda enfocada.
 *
 * Guarda **texto**, no un valor interpretado: interpretar en cada pulsación
 * convertiría `1.` o `-` en `NaN` mientras el usuario todavía está escribiendo.
 * La interpretación ocurre una sola vez, al confirmar, en
 * `interpretDatasheetEdits`.
 *
 * `Escape` cancela sin tocar el borrador; la rejilla devuelve entonces el foco a
 * la celda, para que no pierda su única parada de tabulación.
 */

export interface DatasheetCellEditorProps {
  field: DatasheetField;
  /** Valor de la celda ya en las unidades del proyecto, sin redondear. */
  initialText: string;
  options: readonly DatasheetFieldOption[];
  label: string;
  onCommit: (raw: string) => void;
  onCancel: () => void;
}

export const DatasheetCellEditor = ({
  field,
  initialText,
  options,
  label,
  onCommit,
  onCancel,
}: DatasheetCellEditorProps) => {
  const [text, setText] = useState(initialText);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.focus();
      // Seleccionar el contenido deja teclear el valor nuevo de un tirón, que es
      // lo que se hace en una hoja de datos; corregir un dígito sigue siendo
      // posible con una flecha.
      if (input.type === 'text') input.select();
      return;
    }
    selectRef.current?.focus();
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    // La rejilla navega con flechas; dentro del editor son del propio control.
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      onCommit(text);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  };

  if (field.kind === 'boolean') {
    return <input
      ref={inputRef}
      className="datasheet-cell-editor"
      type="checkbox"
      aria-label={label}
      checked={text === 'true'}
      onKeyDown={onKeyDown}
      onChange={(event) => onCommit(event.target.checked ? 'true' : 'false')}
    />;
  }

  if (field.kind === 'number') {
    return <input
      ref={inputRef}
      className="datasheet-cell-editor"
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={text}
      onKeyDown={onKeyDown}
      onChange={(event) => setText(event.target.value)}
      // Salir del editor confirma, como en cualquier hoja de datos: escribir un
      // número y pinchar fuera no puede significar «descártalo».
      onBlur={() => onCommit(text)}
    />;
  }

  const groups = [...new Set(options.map((option) => option.group))];
  return <select
    ref={selectRef}
    className="datasheet-cell-editor"
    aria-label={label}
    value={text}
    onKeyDown={onKeyDown}
    onChange={(event) => onCommit(event.target.value)}
  >
    {groups.map((group) => {
      const inGroup = options.filter((option) => option.group === group);
      if (group === undefined) {
        return inGroup.map((option) => <option key={option.value} value={option.value}>{option.label}</option>);
      }
      return <optgroup key={group} label={group}>
        {inGroup.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </optgroup>;
    })}
  </select>;
};
