import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyles = "relative px-5 py-2.5 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden";
  
  const variants = {
    primary: "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5",
    secondary: "bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 backdrop-blur-sm",
    outline: "bg-transparent border border-white/20 hover:border-primary/50 text-muted hover:text-white",
    ghost: "bg-transparent hover:bg-white/5 text-muted hover:text-white"
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {/* Loading State Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-inherit flex items-center justify-center z-10 backdrop-blur-sm">
           <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
      
      {/* Content */}
      <span className={`flex items-center gap-2 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        {children}
      </span>
    </button>
  );
};