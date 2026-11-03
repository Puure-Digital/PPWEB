// PayRoll Protect · home page.
// Pinned scenes are created top to bottom so ScrollTrigger measures pin spacing correctly.
import { boot } from './boot.js';
import { initScroll } from './scroll.js';
import { initNav } from './nav.js';
import { initHero } from './hero.js';
import { initFacts } from './facts.js';
import { initWatch } from './watch.js';
import { initGap } from './gap.js';
import { initMatch } from './match.js';
import { initLeaks } from './leaks.js';
import { initHow } from './how.js';
import { mountOdometers } from './odometer.js';
import { initCalc } from './calc.js';
import { initCharts } from './charts.js';
import { initScrubs } from './scrubs.js';
import { initFilms } from './film.js';
import { initGlobe } from './globe.js';
import { initPilot } from './pilot.js';
import { initFaq } from './faq.js';
import { initRisk } from './risk.js';
import { initFx } from './fx.js';
import { initCursor } from './cursor.js';
import { initFoot } from './foot.js';
import { initFlow } from './flow.js';
import { initReveals } from './reveal.js';
import { initLive } from './engine.js';

boot([initFx, initCursor, initScroll, initFlow, initHero, initFacts, initWatch, initGap, initMatch, initLeaks, initHow, mountOdometers, initCalc, initCharts, initScrubs, initFilms, initGlobe, initPilot, initFaq, initRisk, initFoot, initNav, initReveals, initLive]);
