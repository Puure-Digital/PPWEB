// PayRoll Protect · privacy notice (privacy.html).
import { boot } from './boot.js';
import { initScroll } from './scroll.js';
import { initNav } from './nav.js';
import { initFx } from './fx.js';
import { initCursor } from './cursor.js';
import { initFoot } from './foot.js';
import { initFlow } from './flow.js';
import { initReveals } from './reveal.js';
import { initLive } from './engine.js';

boot([initFx, initCursor, initScroll, initFlow, initNav, initFoot, initReveals, initLive]);
