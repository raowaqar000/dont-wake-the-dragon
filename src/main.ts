import Phaser from 'phaser';
import './style.css';
import { createGameConfig } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { installMobileGuards } from './systems/MobileGuards';
import { SoundSystem } from './systems/SoundSystem';

installMobileGuards();
// Audio unlocks on the first touch (mobile browser rule).
SoundSystem.install();

new Phaser.Game(createGameConfig([BootScene, GameScene]));
