import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { DisplayApp } from './display/DisplayApp';
import { isDisplayView } from './displays/protocol';
import './styles/tokens.css';
import './styles/explorer.css';

// `?view=display` = a window on an external screen; anything else = the touchscreen controller.
createRoot(document.getElementById('root')!).render(
  <StrictMode>{isDisplayView() ? <DisplayApp /> : <App />}</StrictMode>,
);
