import { idsOfActivePlayers, players } from './players.js';
import { endTurn, turn } from './turn.js';
import { boardCells } from './dom-objects.js';
import { cssClasses } from './constants.js';
import { removeHighlightFromTargetCells } from './move.js';
import { clearCell } from './board.js';
import board from './board.js';
import getEnemyNeighbors from './get-enemy-neighbors.js';

const abortControllers = {
    selectMovablePiece: new AbortController(),
    selectReachableFreeCell: new AbortController(),
};

function resetAbortControllers() {
    Object.assign(abortControllers, {
        selectMovablePiece: new AbortController(),
        selectReachableFreeCell: new AbortController(),
    });
}

export function disableHumanInput() {
    abortControllers.selectMovablePiece.abort();
    abortControllers.selectReachableFreeCell.abort();
}

/** Set up event handlers for a human player move.
 * 1) For selecting a movable piece and
 * 2) for selecting an empty target cell to move to.
 * @param { Object } possibleMoves { pieceId: 0-48, moves: { nextTo: [max. 8; 0-48] oneOff: [max. 16; 0-48] }[] }[] */
export default function humanMove(possibleMoves) {
    const player = players[idsOfActivePlayers[turn] - 1];

    resetAbortControllers();

    // allow selection of movable pieces
    possibleMoves.forEach((possibleMove) => {
        const movableCell = boardCells[possibleMove.pieceId];

        movableCell.classList.add(cssClasses.clickableCell);
        movableCell.addEventListener(
            'click',
            ({ target: { classList: classListOfClickedPiece } }) => {
                // clicked on previously selected movable-piece
                if (classListOfClickedPiece.contains(cssClasses.selectedForMove)) {
                    // remove highlighting from selected piece
                    classListOfClickedPiece.remove(cssClasses.selectedForMove);
                    removeHighlightFromTargetCells(possibleMove);
                    // re-allow pointing at other movable pieces
                    possibleMoves.forEach(
                        (possibleMove) =>
                            boardCells[possibleMove.pieceId].classList.replace(
                                cssClasses.disabledCell,
                                cssClasses.clickableCell,
                            ),
                    );
                } else {
                    const finalizeMoveToCell = (idOfTargetCell) => {
                        // take ownership of target cell
                        board[idOfTargetCell] = player.playerId;
                        boardCells[idOfTargetCell].dataset.ownerId = player.playerId;
                        // flip neighbouring enemy pieces
                        getEnemyNeighbors(idOfTargetCell).forEach((idOfGainedPiece) => {
                            const previousOwner = players[board[idOfGainedPiece] - 1];
                            // remove piece from current owner and give it to player
                            player.pieces.push(
                                ...previousOwner.pieces.splice(
                                    previousOwner.pieces.indexOf(idOfGainedPiece),
                                    1,
                                ),
                            );
                            // update internal board state
                            board[idOfGainedPiece] = player.playerId;
                            // update display
                            boardCells[idOfGainedPiece].dataset.ownerId = player.playerId;
                        });
                        disableHumanInput();
                        possibleMoves.forEach(
                            (possibleMove) =>
                                boardCells[possibleMove.pieceId].classList.remove(
                                    cssClasses.disabledCell,
                                    cssClasses.clickableCell,
                                    cssClasses.selectedForMove,
                                ),
                        );
                        removeHighlightFromTargetCells(possibleMove);
                        endTurn();
                    };

                    // mark piece as selected
                    classListOfClickedPiece.add(cssClasses.selectedForMove);
                    // prevent selecting another movable piece
                    player.pieces
                        .filter((cellId) => cellId !== possibleMove.pieceId)
                        .forEach(
                            (cellId) =>
                                boardCells[cellId].classList.replace(
                                    cssClasses.clickableCell,
                                    cssClasses.disabledCell,
                                ),
                        );
                    // listen for clicks on possible target-cells
                    possibleMove.moves.nextTo.forEach((cellId) => {
                        boardCells[cellId].classList.add(cssClasses.clickableCell);
                        boardCells[cellId].addEventListener(
                            'click',
                            () => {
                                // player gains a new piece at the target-cell
                                player.pieces.push(cellId);
                                finalizeMoveToCell(cellId);
                            },
                            { signal: abortControllers.selectReachableFreeCell.signal },
                        );
                    });
                    possibleMove.moves.oneOff.forEach((cellId) => {
                        boardCells[cellId].classList.add(cssClasses.clickableCell);
                        boardCells[cellId].addEventListener(
                            'click',
                            () => {
                                // player moves the origin-piece to the target-cell
                                player.pieces[player.pieces.indexOf(possibleMove.pieceId)] = cellId;
                                clearCell(possibleMove.pieceId);
                                finalizeMoveToCell(cellId);
                            },
                            { signal: abortControllers.selectReachableFreeCell.signal },
                        );
                    });
                }
            },
            { signal: abortControllers.selectMovablePiece.signal },
        );
    });
}

function removeHighlightFromTargetCells({ moves: { nextTo, oneOff } }) {
    [...nextTo, ...oneOff].forEach(
        (cellId) => boardCells[cellId].classList.remove(cssClasses.clickableCell),
    );
}
