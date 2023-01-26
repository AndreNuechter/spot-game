import { boardLen, cellSize } from './constants.js';

export const gameOverModal = document.getElementById('game-over-indicator');
export const mainClassList = document.querySelector('main').classList;
export const startBtn = document.getElementById('start');
/** Array of 49 svg-circles forming the board. */
export const boardCells = [];

const circleTmpl = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'circle',
);
circleTmpl.setAttribute('r', '16');

for (let i = 0; i < boardLen; i += 1) {
    for (let j = 0; j < boardLen; j += 1) {
        const circle = circleTmpl.cloneNode(true);

        circle.setAttribute('cx', cellSize * j + (cellSize * 0.5));
        circle.setAttribute('cy', cellSize * i + (cellSize * 0.5));

        boardCells.push(circle);
    }
}

document.getElementById('board').append(...boardCells);