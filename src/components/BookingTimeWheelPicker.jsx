import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock3 } from 'lucide-react';

const ROW_HEIGHT = 34;

function WheelColumn({ label, options, value, onChange }) {
  const listRef = useRef(null);
  const scrollTimer = useRef(null);
  const selectedIndex = Math.max(0, options.indexOf(value));
  const optionsKey = options.join('|');

  useEffect(() => {
    const list = listRef.current;
    if (!list || !options.length) return;
    list.scrollTop = selectedIndex * ROW_HEIGHT;
  }, [optionsKey, selectedIndex]);

  useEffect(() => () => {
    if (scrollTimer.current !== null) window.clearTimeout(scrollTimer.current);
  }, []);

  function chooseIndex(index) {
    if (!options.length) return;
    const nextIndex = Math.max(0, Math.min(options.length - 1, index));
    const list = listRef.current;
    if (list) list.scrollTo({ top: nextIndex * ROW_HEIGHT, behavior: 'smooth' });
    onChange(options[nextIndex]);
  }

  function handleScroll() {
    if (scrollTimer.current !== null) window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const list = listRef.current;
      if (!list || !options.length) return;
      const index = Math.max(0, Math.min(options.length - 1, Math.round(list.scrollTop / ROW_HEIGHT)));
      if (options[index] !== value) onChange(options[index]);
    }, 80);
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      chooseIndex(selectedIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      chooseIndex(selectedIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      chooseIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      chooseIndex(options.length - 1);
    }
  }

  return (
    <div className="time-wheel-column">
      <span className="time-wheel-label">{label}</span>
      <div
        className="time-wheel-list"
        role="listbox"
        aria-label={label}
        aria-activedescendant={options.length ? 'wheel-' + label + '-' + value : undefined}
        tabIndex={options.length ? 0 : -1}
        ref={listRef}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
      >
        <div className="time-wheel-spacer" aria-hidden="true"/>
        {options.map(option => (
          <div
            id={'wheel-' + label + '-' + option}
            className={'time-wheel-option' + (option === value ? ' is-selected' : '')}
            role="option"
            aria-selected={option === value}
            key={option}
            onClick={() => chooseIndex(options.indexOf(option))}
          >
            {option}
          </div>
        ))}
        <div className="time-wheel-spacer" aria-hidden="true"/>
      </div>
    </div>
  );
}

export default function BookingTimeWheelPicker({ slots, value, onChange, disabled = false, id = 'booking-time' }) {
  const [open, setOpen] = useState(false);
  const validValue = slots.includes(value) ? value : '';
  const displayTime = validValue || slots[0] || '';
  const hourOptions = [...new Set(slots.map(slot => slot.slice(0, 2)))];
  const hour = displayTime.slice(0, 2);
  const minuteOptions = slots.filter(slot => slot.startsWith(hour + ':')).map(slot => slot.slice(3, 5));
  const minute = displayTime.slice(3, 5);

  function chooseHour(nextHour) {
    const options = slots.filter(slot => slot.startsWith(nextHour + ':'));
    if (!options.length) return;
    const sameMinute = options.find(slot => slot.slice(3, 5) === minute);
    onChange(sameMinute || options[0]);
  }

  function chooseMinute(nextMinute) {
    const candidate = hour + ':' + nextMinute;
    if (slots.includes(candidate)) onChange(candidate);
  }

  return (
    <div className={'time-wheel-picker' + (open ? ' is-open' : '')}>
      <button
        id={id}
        type="button"
        className="time-wheel-trigger"
        aria-expanded={open}
        aria-controls={id + '-panel'}
        disabled={disabled || slots.length === 0}
        onClick={() => setOpen(current => !current)}
      >
        <Clock3 size={17} aria-hidden="true"/>
        <span>{validValue || 'Selecionar horário'}</span>
        <ChevronDown size={16} aria-hidden="true" className="time-wheel-trigger-chevron"/>
      </button>
      {open && slots.length > 0 && (
        <div id={id + '-panel'} className="time-wheel-panel">
          <div className="time-wheel-columns">
            <WheelColumn label="Hora" options={hourOptions} value={hour} onChange={chooseHour}/>
            <span className="time-wheel-colon" aria-hidden="true">:</span>
            <WheelColumn label="Minuto" options={minuteOptions} value={minute} onChange={chooseMinute}/>
          </div>
          <div className="time-wheel-footer">
            <span>{validValue ? 'Selecionado: ' + validValue : 'Role para escolher um horário'}</span>
            <button type="button" className="time-wheel-done" onClick={() => setOpen(false)}>Concluir</button>
          </div>
        </div>
      )}
    </div>
  );
}
