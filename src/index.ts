import './localization';
import options from './options';
import penaltyStats from './penaltyStats';
import { Roulette } from './roulette';

const roulette = new Roulette();

(window as any).roulette = roulette;
(window as any).options = options;
(window as any).penaltyStats = penaltyStats;
