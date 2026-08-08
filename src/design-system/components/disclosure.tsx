import { useId, useRef, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  label: string;
  items: readonly TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const Tabs = ({
  label,
  items,
  value,
  onValueChange,
  orientation = 'horizontal',
  className = '',
}: TabsProps) => {
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = items.find((item) => item.id === value && !item.disabled)
    ?? items.find((item) => !item.disabled);

  const move = (currentIndex: number, key: string) => {
    const enabled = items.map((item, index) => item.disabled ? -1 : index).filter((index) => index >= 0);
    if (!enabled.length) return;
    const currentPosition = Math.max(0, enabled.indexOf(currentIndex));
    let nextPosition = currentPosition;
    if (key === 'Home') nextPosition = 0;
    else if (key === 'End') nextPosition = enabled.length - 1;
    else if (key === 'ArrowRight' || key === 'ArrowDown') nextPosition = (currentPosition + 1) % enabled.length;
    else if (key === 'ArrowLeft' || key === 'ArrowUp') nextPosition = (currentPosition - 1 + enabled.length) % enabled.length;
    else return;
    const nextIndex = enabled[nextPosition];
    onValueChange(items[nextIndex].id);
    window.requestAnimationFrame(() => tabRefs.current[nextIndex]?.focus());
  };

  return <div className={`sc-tabs sc-tabs--${orientation}${className ? ` ${className}` : ''}`}>
    <div className="sc-tabs__list" role="tablist" aria-label={label} aria-orientation={orientation}>
      {items.map((item, index) => {
        const active = item.id === selected?.id;
        return <button
          key={item.id}
          ref={(element) => { tabRefs.current[index] = element; }}
          id={`${baseId}-tab-${item.id}`}
          type="button"
          role="tab"
          aria-selected={active}
          aria-controls={`${baseId}-panel-${item.id}`}
          tabIndex={active ? 0 : -1}
          disabled={item.disabled}
          onClick={() => onValueChange(item.id)}
          onKeyDown={(event) => {
            if (!['Home', 'End', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return;
            event.preventDefault();
            move(index, event.key);
          }}
        >{item.label}</button>;
      })}
    </div>
    {selected ? <div
      id={`${baseId}-panel-${selected.id}`}
      className="sc-tabs__panel"
      role="tabpanel"
      aria-labelledby={`${baseId}-tab-${selected.id}`}
      tabIndex={0}
    >{selected.content}</div> : null}
  </div>;
};

export interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface AccordionProps {
  items: readonly AccordionItem[];
  expanded: readonly string[];
  onExpandedChange: (expanded: string[]) => void;
  multiple?: boolean;
  className?: string;
}

export const Accordion = ({
  items,
  expanded,
  onExpandedChange,
  multiple = false,
  className = '',
}: AccordionProps) => {
  const baseId = useId();
  const toggle = (id: string) => {
    const isOpen = expanded.includes(id);
    if (multiple) onExpandedChange(isOpen ? expanded.filter((item) => item !== id) : [...expanded, id]);
    else onExpandedChange(isOpen ? [] : [id]);
  };

  return <div className={`sc-accordion${className ? ` ${className}` : ''}`}>
    {items.map((item) => {
      const open = expanded.includes(item.id);
      const triggerId = `${baseId}-trigger-${item.id}`;
      const panelId = `${baseId}-panel-${item.id}`;
      return <section key={item.id} className={`sc-accordion__item${open ? ' is-open' : ''}`}>
        <h3>
          <button
            id={triggerId}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            disabled={item.disabled}
            onClick={() => toggle(item.id)}
          >
            <span>{item.title}</span>
            <ChevronDown size={17} aria-hidden="true" />
          </button>
        </h3>
        <div id={panelId} role="region" aria-labelledby={triggerId} hidden={!open} className="sc-accordion__panel">{item.content}</div>
      </section>;
    })}
  </div>;
};
