import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { RouterProvider } from './context/RouterContext';
import { CssBaseline } from '@mui/material';
import { CustomThemeProvider } from './context/ThemeContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <CustomThemeProvider>
      <CssBaseline />
      <RouterProvider>
        <App />
      </RouterProvider>
    </CustomThemeProvider>
  </React.StrictMode>
); 