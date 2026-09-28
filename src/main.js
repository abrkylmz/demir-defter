import './styles/index.css';
import { bindEvents } from './events.js';
import { initCloud } from './services/sync.js';
import { loadLocal } from './state/store.js';
import { initSheet } from './ui/sheet.js';
import { render } from './views/render.js';

loadLocal();
initSheet();
bindEvents();
render();
initCloud();
