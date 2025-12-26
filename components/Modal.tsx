import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const timer = setTimeout(() => setShow(true), 10);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[99999] flex justify-center items-start overflow-y-auto bg-black/60 backdrop-blur-sm transition-opacity duration-300 p-4 sm:p-8"
      style={{ opacity: show ? 1 : 0 }}
    >
      {/* Background overlay click to close */}
      <div className="fixed inset-0 cursor-default" onClick={onClose}></div>
      
      <div 
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col transform transition-all duration-300 ease-out z-10 my-auto"
        style={{ 
          transform: show ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-20px)',
          maxHeight: 'calc(100% - 2rem)'
        }}
      >
        {/* Header - Fixed Height */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 shrink-0 bg-white rounded-t-3xl">
          <h2 className="text-sm font-black text-gray-800 tracking-[0.1em] uppercase">{title}</h2>
          <button 
            onClick={onClose} 
            className="p-2 -mr-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;