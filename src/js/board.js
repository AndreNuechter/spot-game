import { cellCount } from './constants.js';
import { boardCells } from './dom-objects.js';

/** `boardLen`^2 length array of cellIds meant for keeping track of cell-ownership.
 * 0 means a cell is unoccupied and otherwise the cell belongs to the player w that id. */
const board = new Array(cellCount).fill(0);

export default board;

export function clearCell(cellId) {
    board[cellId] = 0;
    boardCells[cellId].dataset.ownerId = '';
    boardCells[cellId].classList = '';
}
