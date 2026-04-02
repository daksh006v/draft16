import React, { useState, useRef, useEffect } from 'react';

const Dropdown = ({ value, onChange, options, placeholder = "Select...", className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between transition-all duration-200 text-left outline-none"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--bg-border)',
          padding: '10px 14px',
          borderRadius: '8px',
          color: 'var(--text-main)',
          borderColor: isOpen ? 'var(--accent-primary)' : 'var(--bg-border)',
          boxShadow: isOpen ? '0 0 12px rgba(99,102,241,0.2)' : 'none'
        }}
      >
        <span className="truncate text-sm font-medium">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 opacity-60 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Menu */}
      <div
        className={`dropdown-menu absolute w-full z-[1000] overflow-hidden transition-all duration-200 origin-top`}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--bg-border)',
          borderRadius: '8px',
          padding: '6px',
          marginTop: '6px',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'translateY(0)' : 'translateY(-8px)',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        <div className="max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-1">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`truncate text-sm transition-colors duration-150 cursor-pointer`}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: isSelected ? 'var(--accent-primary)' : 'transparent',
                  color: isSelected ? '#ffffff' : 'var(--text-main)',
                  fontWeight: isSelected ? 600 : 500,
                  opacity: isSelected ? 0.9 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dropdown;

