import Phaser from 'phaser';
import './style.css';
import { createGameConfig } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { installMobileGuards } from './systems/MobileGuards';

installMobileGuards();

new Phaser.Game(createGameConfig([BootScene, GameScene]));
