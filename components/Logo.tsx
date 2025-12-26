
import React, { useState, useEffect } from 'react';

interface LogoProps {
  className?: string;
  showTagline?: boolean;
}

/**
 * Renders the Eko Prints brand logo.
 * Path: /assets/logo.png (ensure folder and filename are lowercase)
 */
const Logo: React.FC<LogoProps> = ({ className = "h-12", showTagline = false }) => {
  const [error, setError] = useState(false);
  const logoPath = "/assets/logo.png";

  useEffect(() => {
    // Pre-verify image existence to prevent flickering
    const img = new Image();
    img.src = logoPath;
    img.onload = () => setError(false);
    img.onerror = () => {
        console.warn(`Logo image not found at ${logoPath}. Using fallback UI.`);
        setError(true);
    };
  }, [logoPath]);

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {!error ? (
        <img 
          src={logoPath} 
          alt="Eko Prints Logo" 
          className="h-full w-auto object-contain max-w-full transition-opacity duration-300"
          onError={() => setError(true)}
        />
      ) : (
        <div className="logo-fallback flex flex-col items-center justify-center select-none animate-fade-in">
            <div className="flex items-center leading-none">
                <span className="text-3xl font-black tracking-tighter text-[#FBBF24]">Eko</span>
                <span className="text-2xl font-bold ml-1 text-white">Prints</span>
            </div>
            <div className="flex items-center w-full mt-1.5 px-0.5 opacity-80">
                <div className="h-1 flex-1 bg-yellow-400 rounded-l-full"></div>
                <div className="h-1 flex-1 bg-white/20 rounded-r-full"></div>
            </div>
        </div>
      )}
      
      {showTagline && (
        <span className="text-[9px] font-black tracking-[0.35em] uppercase mt-2 text-gray-400">
          Design | Print | Brand
        </span>
      )}
    </div>
  );
};

export default Logo;
