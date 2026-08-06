import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const Tooltip = ({ children, content, position = 'top', className = '' }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = tooltipRef.current?.offsetWidth || 200;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 40;

    let x = rect.left + rect.width / 2;
    let y = rect.top;

    switch (position) {
      case 'top':
        y = rect.top - tooltipHeight - 8;
        break;
      case 'bottom':
        y = rect.bottom + 8;
        break;
      case 'left':
        x = rect.left - tooltipWidth / 2;
        y = rect.top + rect.height / 2;
        break;
      case 'right':
        x = rect.right + 8;
        y = rect.top + rect.height / 2;
        break;
      default:
        y = rect.top - tooltipHeight - 8;
    }

    setCoords({ x, y });
  }, [position]);

  useEffect(() => {
    if (visible) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      return () => window.removeEventListener('scroll', updatePosition, true);
    }
  }, [visible, updatePosition]);

  const show = () => {
    setVisible(true);
    requestAnimationFrame(updatePosition);
  };

  const hide = () => setVisible(false);

  const tooltip = visible && createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      className={`fixed z-50 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg shadow-lg pointer-events-none transition-opacity duration-150 ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      style={{
        left: coords.x,
        top: coords.y,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {content}
      <div
        className="absolute w-2 h-2 bg-slate-900 rotate-45"
        style={{
          bottom: position === 'top' ? -4 : 'auto',
          top: position === 'bottom' ? -4 : 'auto',
          left: '50%',
          transform: 'translateX(-50%) rotate-45',
        }}
      />
    </div>,
    document.body
  );

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-block"
      >
        {children}
      </div>
      {tooltip}
    </>
  );
};

export default Tooltip;