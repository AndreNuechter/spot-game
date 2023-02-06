import './js/service-worker-init.js';
import './js/wakelock.js';
import { boardLen, cellCount, cssClasses, machineMoveDelays, playerTypeIconIds } from './js/constants.js';
import { boardCells, documentStyles, gameOverModal, mainClassList, startBtn } from './js/dom-objects.js';
import { CalculatedMove, getPlaceStr, getRandomInt, Player } from './js/helper-functions.js';

// TODO rework colors...
// semantic vars for css colors
// gradient for bg

/** `boardLen`^2 length array of cellIds meant for keeping track of cell-ownership.
 * 0 means a cell is unoccupied and otherwise the cell belongs to the player w that id. */
const board = new Array(cellCount).fill(0);
const players = [
    Player(
            documentStyles.getPropertyValue('--player-1-color'),
            'human',
            0,
            1
        ),
    Player(
            documentStyles.getPropertyValue('--player-2-color'),
            'inactive',
            boardLen - 1,
            2
        ),
    Player(
            documentStyles.getPropertyValue('--player-3-color'),
            'inactive',
            cellCount - boardLen,
            3
        ),
    Player(
            documentStyles.getPropertyValue('--player-4-color'),
            'robot',
            cellCount - 1,
            4
        ),
];
const abortControllers = {
    selectMovablePiece: new AbortController(),
    selectReachableFreeCell: new AbortController()
};
let turn = 0;
/** List of 1-based ids of playing players */
let idsOfActivePlayers = [];
let animationRequestId;

players.forEach(
    (player) => player.roleChangeButton.addEventListener('click', () => {
        if (mainClassList.contains(cssClasses.gameIsRunning)) {
            endGame();
        }

        switch (player.controllerType) {
            case 'inactive':
                setPlayerRole(player, 'robot');
                break;
            case 'robot':
                setPlayerRole(player, 'human');
                break;
            case 'human':
                setPlayerRole(player, 'inactive');
                break;
        }
    })
);
startBtn.addEventListener('click', () => {
    idsOfActivePlayers = players.reduce((ids, player) => {
        if (player.controllerType !== 'inactive') {
            ids.push(player.playerId);
        }
        return ids;
    }, []);

    if (idsOfActivePlayers.length < 2) return;

    if (mainClassList.contains(cssClasses.gameIsRunning)) {
        endGame();
    }

    startGame();
});

function endGame() {
    turn = 0;
    mainClassList.remove(cssClasses.gameIsRunning);
    players.forEach(player => player.roleChangeButton.classList.remove(cssClasses.activePlayer));
    abortControllers.selectMovablePiece.abort();
    abortControllers.selectReachableFreeCell.abort();
    cancelAnimationFrame(animationRequestId);
    clearBoard();
}

function startGame() {
    clearBoard();
    mainClassList.add(cssClasses.gameIsRunning);
    idsOfActivePlayers.forEach((idOfActivePlayer) => {
        const player = players[idOfActivePlayer - 1];
        
        boardCells[player.startPosition].dataset.ownerId = player.playerId;
        board[player.startPosition] = player.playerId;
        player.pieces.push(player.startPosition);
        updatePieceCount(player);
    });
    takeTurn();
}

function setPlayerRole(player, newRole) {
    player.controllerType = newRole;
    player.roleChangeButton.children[0].firstElementChild.setAttribute('href', playerTypeIconIds[newRole]);
}

function updatePieceCount(player) {
    setPlayerSelectButtonText(player, player.pieces.length);
}

function setPlayerSelectButtonText(player, text) {
    player.roleChangeButton.children[1].textContent = text;
}

function clearBoard() {
    gameOverModal.classList.remove(cssClasses.visible);
    players.forEach((player) => {
        player.pieces.length = 0;
        setPlayerSelectButtonText(player, '');
    });
    boardCells.forEach((_, i) => clearCell(i));
}

function clearCell(cellId) {
    board[cellId] = 0;
    boardCells[cellId].dataset.ownerId = '';
    boardCells[cellId].classList = '';
}

function takeTurn() {
    const player = players[idsOfActivePlayers[turn] - 1];
    /** { pieceId: 0-48, moves: { nextTo: [8; 0-48] oneOff: [16; 0-48] }[] }[] */
    const possibleMoves = player.pieces
        .map((piece) => ({ pieceId: piece, moves: getPossibleMoves(piece) }))
        .filter((option) =>
            option.moves.nextTo.length > 0 || option.moves.oneOff.length > 0
        );

    // highlight active player
    player.roleChangeButton.classList.add(cssClasses.activePlayer);

    if (possibleMoves.length === 0) {
        endTurn();
    } else if (player.controllerType === 'human') {
        humanMove(possibleMoves);
    } else if (player.controllerType === 'robot') {
        computerMove(possibleMoves);
    }
}

/** Return an object pointing to two arrays, the first containing cellIds of empty cells directly adjacent to the given piece (max. 8) and the second containing cellIds of empty cells one cell away (max. 16). */
function getPossibleMoves(pieceId) {
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
    const nextTo = neighborCells.filter(findFreeCells);
    const oneOff = cellsOneOff.filter(findFreeCells);

    return { nextTo, oneOff };
}

function endTurn() {
    players[idsOfActivePlayers[turn] - 1].roleChangeButton.classList.remove(cssClasses.activePlayer);
    idsOfActivePlayers.forEach((playerId) => updatePieceCount(players[playerId - 1]));

    // end or progress game
    if (
        board.find((cell) => cell === 0) === undefined ||
        players.filter((player) => player.pieces.length > 0).length === 1
    ) {
        // rank players and communicate end of game
        idsOfActivePlayers
            .map((playerId) => ({
                playerId,
                pieceCount: players[playerId - 1].pieces.length
            }))
            .sort(({ pieceCount: a }, { pieceCount: b }) => b - a)
            .forEach(
                ({ playerId }, i) => setPlayerSelectButtonText(
                        players[playerId - 1],
                        getPlaceStr(i)
                    )
            );
        gameOverModal.classList.add(cssClasses.visible);
        mainClassList.remove(cssClasses.gameIsRunning);
    } else {
        if (turn < idsOfActivePlayers.length - 1) {
            turn += 1;
        } else {
            turn = 0;
        }

        takeTurn();
    }
}

/** Set up event handlers for a human player move.
 * 1) For selecting a movable piece and
 * 2) for selecting an empty target cell to move to.
 * @param { Object } possibleMoves { pieceId: 0-48, moves: { nextTo: [max. 8; 0-48] oneOff: [max. 16; 0-48] }[] }[] */
function humanMove(possibleMoves) {
    const player = players[idsOfActivePlayers[turn] - 1];

    Object.assign(abortControllers, {
        selectMovablePiece: new AbortController(),
        selectReachableFreeCell: new AbortController()
    });

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
                        (possibleMove) => boardCells[possibleMove.pieceId].classList.replace(
                            cssClasses.disabledCell,
                            cssClasses.clickableCell
                        )
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
                                ...previousOwner.pieces.splice(previousOwner.pieces.indexOf(idOfGainedPiece), 1),
                            );
                            // update internal board state
                            board[idOfGainedPiece] = player.playerId;
                            // update display
                            boardCells[idOfGainedPiece].dataset.ownerId = player.playerId;
                        });
                        // clean up
                        abortControllers.selectMovablePiece.abort();
                        abortControllers.selectReachableFreeCell.abort();
                        possibleMoves.forEach(
                            (possibleMove) => boardCells[possibleMove.pieceId].classList.remove(
                                cssClasses.disabledCell,
                                cssClasses.clickableCell,
                                cssClasses.selectedForMove
                            )
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
                            (cellId) => boardCells[cellId].classList.replace(
                                cssClasses.clickableCell,
                                cssClasses.disabledCell
                            )
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
                            { signal: abortControllers.selectReachableFreeCell.signal }
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
                            { signal: abortControllers.selectReachableFreeCell.signal }
                        );
                    });
                }
            },
            { signal: abortControllers.selectMovablePiece.signal }
        );
    });
}

function computerMove(possibleMoves) {
    const player = players[idsOfActivePlayers[turn] - 1];
    const payoffs = possibleMoves
        .map((possibleMove) => ({
            nextTo: possibleMove.moves.nextTo
                .map((closeNeighbor) => CalculatedMove(
                    possibleMove.pieceId,
                    closeNeighbor,
                    getEnemyNeighbors(closeNeighbor),
                    1
                )),
            oneOff: possibleMove.moves.oneOff
                .map((farNeighbor) => CalculatedMove(
                    possibleMove.pieceId,
                    farNeighbor,
                    getEnemyNeighbors(farNeighbor),
                    0
                )),
        }));
    let highestPayoff = [0, []];
    let secondHighestPayoff = [];
    let thirdHighestPayoff;
    let bestMoves;

    // find highest payoffs and remember corresponding moves
    payoffs.forEach((payoff) => {
        [...payoff.nextTo, ...payoff.oneOff].forEach((move) => {
            const totalPayoff = move.bounty.length + move.type;

            if (highestPayoff[0] < totalPayoff) {
                thirdHighestPayoff = secondHighestPayoff.slice();
                secondHighestPayoff = highestPayoff.slice();
                highestPayoff = [totalPayoff, [move]];
            } else if (highestPayoff[0] > totalPayoff) {
                if (secondHighestPayoff[0] < totalPayoff) {
                    thirdHighestPayoff = secondHighestPayoff.slice();
                    secondHighestPayoff = [totalPayoff, [move]];
                } else if (secondHighestPayoff[0] > totalPayoff) {
                    if (thirdHighestPayoff[0] < totalPayoff) {
                        thirdHighestPayoff = [totalPayoff, [move]];
                    } else if (thirdHighestPayoff[0] === totalPayoff) {
                        thirdHighestPayoff[1].push(move);
                    }
                } else if (secondHighestPayoff[0] === totalPayoff) {
                    secondHighestPayoff[1].push(move);
                }
            } else {
                highestPayoff[1].push(move);
            }
        });
    });

    // Randomnly pick one of the three highest payoffs (w strong bias towards highest)
    // There can be 1 (secMost[0] === 0), 2 (secMost[0] !== 0 && thrdMost[0] === 0) and 3 highest payoffs, here mapped to distributions of [1], [.9, .1], [.9, .09, .01].
    if (secondHighestPayoff[0] === 0) {
        bestMoves = highestPayoff;
    } else if (thirdHighestPayoff[0] === 0) {
        if (Math.random() > 0.1) {
            bestMoves = highestPayoff;
        } else {
            bestMoves = secondHighestPayoff;
        }
    } else {
        const diceRoll = Math.random();

        if (diceRoll > 0.1) {
            bestMoves = highestPayoff;
        } else if (diceRoll > 0.01) {
            bestMoves = secondHighestPayoff;
        } else {
            bestMoves = thirdHighestPayoff;
        }
    }

    // Randomnly pick one of the moves leading to chosen payoff
    const move = bestMoves[1][getRandomInt(0, bestMoves[1].length - 1)];
    // to make it easier to follow the computer,
    // we delay the different phases of the move
    const startChosenAt = performance.now();
    const endChosenAt = startChosenAt + machineMoveDelays.highlightStart;
    const moveMadeAt = endChosenAt + machineMoveDelays.highlightEnd;
    const turnEndedAt = moveMadeAt + machineMoveDelays.finalize;
    // phase 4) finalize the move
    const finalizeMove = (timestamp) => {
        if (timestamp - turnEndedAt >= machineMoveDelays.finalize) {
            // if the player jumped, rm the original piece
            if (move.type === 0) {
                clearCell(move.origin);
                player.pieces.splice(player.pieces.indexOf(move.origin), 1);
            }
            // rm highlighting
            boardCells[move.origin].classList.remove(cssClasses.selectedForMove);
            boardCells[move.target].classList.remove(cssClasses.highlightedTargetCell);
            animationRequestId = requestAnimationFrame(endTurn);
        } else {
            animationRequestId = requestAnimationFrame(finalizeMove);
        }
    };
    // phase 3) make the move
    const makeMove = (timestamp) => {
        if (timestamp - moveMadeAt >= machineMoveDelays.makeMove) {
            [move.target, ...move.bounty].forEach((cellId) => {
                // Place piece in chosen cell
                if (board[cellId] === 0) player.pieces.push(cellId);
                else {
                    const owner = players[board[cellId] - 1];
                    // Flip neighboring enemy pieces
                    player.pieces.push(...owner.pieces.splice(owner.pieces.indexOf(cellId), 1));
                }
                // Update board and display
                board[cellId] = player.playerId;
                boardCells[cellId].dataset.ownerId = player.playerId;
            });
            animationRequestId = requestAnimationFrame(finalizeMove);
        } else {
            animationRequestId = requestAnimationFrame(makeMove);
        }
    };
    // phase 2) highlight the target cell
    const highlightSelectedCell = (timestamp) => {
        if (timestamp - endChosenAt >= machineMoveDelays.highlightEnd) {
            boardCells[move.target].classList.add(cssClasses.highlightedTargetCell);
            animationRequestId = requestAnimationFrame(makeMove);
        } else {
            animationRequestId = requestAnimationFrame(highlightSelectedCell);
        }
    };
    // phase 1) highlight the selected piece
    const highlightSelectedPiece = (timestamp) => {
        if (timestamp - startChosenAt >= machineMoveDelays.highlightStart) {
            boardCells[move.origin].classList.add(cssClasses.selectedForMove);
            animationRequestId = requestAnimationFrame(highlightSelectedCell);
        } else {
            animationRequestId = requestAnimationFrame(highlightSelectedPiece);
        }
    };

    animationRequestId = requestAnimationFrame(highlightSelectedPiece);
}

function findFreeCells(cellId) {
    return cellId >= 0 && cellId < board.length && board[cellId] === 0;
}

/** Return array of ids of cells surounding the given cell, occupied by non-active players. */
function getEnemyNeighbors(cellId) {
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
        cell >= 0
        && cell < board.length
        && ![0, idsOfActivePlayers[turn]].includes(board[cell])
    );
}

function removeHighlightFromTargetCells({ moves: { nextTo, oneOff } }) {
    [...nextTo, ...oneOff].forEach(
        (cellId) => boardCells[cellId].classList.remove(cssClasses.clickableCell)
    );
}