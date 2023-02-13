import { boardLen } from './constants.js';
import board from './board.js';

/** Return an object pointing to two arrays, the first containing cellIds of empty cells directly adjacent to the given piece (max. 8) and the second containing cellIds of empty cells one cell away (max. 16). */
export default function getPossibleMoves(pieceId) {
    const isPieceNotAtLBorder = pieceId % boardLen > 0;
    const isPieceNotAtRBorder = pieceId % boardLen < 6;
    const isPieceNotByLBorder = pieceId % boardLen > 1;
    const isPieceNotByRBorder = pieceId % boardLen < 5;
    const neighborCells = [
        isPieceNotAtLBorder ? pieceId - 1 : -1,
        isPieceNotAtLBorder ? pieceId - boardLen - 1 : -1,
        isPieceNotAtLBorder ? pieceId + boardLen - 1 : -1,
        pieceId - boardLen,
        isPieceNotAtRBorder ? pieceId - boardLen + 1 : -1,
        isPieceNotAtRBorder ? pieceId + 1 : -1,
        isPieceNotAtRBorder ? pieceId + boardLen + 1 : -1,
        pieceId + boardLen,
    ];
    const cellsOneOff = [
        isPieceNotAtLBorder && isPieceNotByLBorder ? pieceId - 2 : -1,
        isPieceNotAtLBorder && isPieceNotByLBorder ? pieceId - boardLen - 2 : -1,
        isPieceNotAtLBorder && isPieceNotByLBorder ? pieceId - 2 * boardLen - 2 : -1,
        isPieceNotAtLBorder && isPieceNotByLBorder ? pieceId + 2 * boardLen - 2 : -1,
        isPieceNotAtLBorder && isPieceNotByLBorder ? pieceId + boardLen - 2 : -1,
        isPieceNotAtLBorder ? pieceId - 2 * boardLen - 1 : -1,
        isPieceNotAtLBorder ? pieceId + 2 * boardLen - 1 : -1,
        pieceId - 2 * boardLen,
        pieceId + 2 * boardLen,
        isPieceNotAtRBorder && isPieceNotByRBorder ? pieceId - 2 * boardLen + 2 : -1,
        isPieceNotAtRBorder && isPieceNotByRBorder ? pieceId - boardLen + 2 : -1,
        isPieceNotAtRBorder && isPieceNotByRBorder ? pieceId + 2 : -1,
        isPieceNotAtRBorder && isPieceNotByRBorder ? pieceId + boardLen + 2 : -1,
        isPieceNotAtRBorder && isPieceNotByRBorder ? pieceId + 2 * boardLen + 2 : -1,
        isPieceNotAtRBorder ? pieceId - 2 * boardLen + 1 : -1,
        isPieceNotAtRBorder ? pieceId + 2 * boardLen + 1 : -1,
    ];
    const nextTo = neighborCells.filter(findValidMoveTargets);
    const oneOff = cellsOneOff.filter(findValidMoveTargets);

    return { nextTo, oneOff };
}

function findValidMoveTargets(cellId) {
    return cellId >= 0 &&
        cellId < board.length &&
        board[cellId] === 0;
}
