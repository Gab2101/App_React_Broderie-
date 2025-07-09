import React from 'react';
import './NewButton.css';

export default function NewButton({ children, onClick }) {
  return (
    <button className="new-button" onClick={onClick}>
      {children}
    </button>
  );
}
