import React, { createContext, useState, useContext, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { lightTheme, darkTheme } from '../theme';

// Create theme context
const ThemeContext = createContext();

// Theme provider component
export const CustomThemeProvider = ({ children }) => {
  // Check if user previously selected dark mode
  const getInitialMode = () => {
    const savedMode = localStorage.getItem('themeMode');
    
    // Use saved preference or OS preference or fallback to light mode
    if (savedMode) {
      return savedMode;
    }
    
    // Check if user's OS prefers dark mode
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    
    // Default to light mode
    return 'light';
  };

  const [themeMode, setThemeMode] = useState(getInitialMode);
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  // Save theme preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);
  }, [themeMode]);

  // Toggle between light and dark mode
  const toggleTheme = () => {
    setThemeMode(prevMode => prevMode === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ themeMode, toggleTheme }}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};

// Custom hook for accessing theme context
export const useTheme = () => useContext(ThemeContext);

export default ThemeContext; 