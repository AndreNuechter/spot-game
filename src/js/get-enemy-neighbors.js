import { boardLen } from './constants.js';
import { idsOfActivePlayers } from './players.js';
import { turn } from './turn.js';
import board from './board.js';

/** Return array of ids of cells surounding the given cell, occupied by non-active players. */
export default function getEnemyNeighbors(cellId) {
    const isPieceNotAtLBorder = cellId % boardLen > 0;
    const isPieceNotAtRBorder = cellId % boardLen < 6;
    const neighborCells = [
        isPieceNotAtLBorder ? cellId - 1 : -1,
        isPieceNotAtLBorder ? cellId - boardLen - 1 : -1,
        isPieceNotAtLBorder ? cellId + boardLen - 1 : -1,
        cellId - boardLen,
        isPieceNotAtRBorder ? cellId - boardLen + 1 : -1,
        isPieceNotAtRBorder ? cellId + 1 : -1,
        isPieceNotAtRBorder ? cellId + boardLen + 1 : -1,
        cellId + boardLen,
    ];

    return neighborCells.filter((cell) =>
        cell >= 0 &&
        cell < board.length &&
        ![0, idsOfActivePlayers[turn]].includes(board[cell])
    );
}
