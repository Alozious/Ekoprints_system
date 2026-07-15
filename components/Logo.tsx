import React, { useState } from 'react';

interface LogoProps {
  className?: string;
  showTagline?: boolean;
}

/**
 * Renders the Eko Prints brand logo.
 * Served from local /public/logo.png for faster load times.
 */
const Logo: React.FC<LogoProps> = ({ className = "h-12", showTagline = false }) => {
  const [error, setError] = useState(false);
  
  // Local asset — served from /public/logo.png via Vite's static file server
  const logoPath = '/logo.png';

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {!error ? (
        <img 
          src={logoPath} 
          alt="Eko Prints Logo" 
          className="h-full w-auto object-contain max-w-full transition-opacity duration-300"
          onError={(e) => {
            console.warn("Logo image failed to load from Google Drive, switching to CSS fallback.");
            setError(true);
          }}
        />
      ) : (
        <div className="logo-fallback flex flex-col items-center justify-center select-none">
            <div className="flex items-center leading-none">
                <span className="text-3xl font-black tracking-tighter text-[#FBBF24]">Eko</span>
                <span className="text-2xl font-bold ml-1 text-white">Prints</span>
            </div>
            <div className="flex items-center w-full mt-1.5 px-0.5 opacity-80">
                <div className="h-0.5 flex-1 bg-yellow-400 rounded-l-full shadow-[0_0_10px_rgba(251,191,36,0.3)]"></div>
                <div className="h-0.5 flex-1 bg-white/10 rounded-r-full"></div>
            </div>
        </div>
      )}
      
      {showTagline && (
        <span className="text-[10px] font-black tracking-[0.4em] uppercase mt-2 text-gray-400/70">
          Design | Print | Brand
        </span>
      )}
    </div>
  );
};

export default Logo;