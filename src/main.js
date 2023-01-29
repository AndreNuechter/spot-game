import './js/service-worker-init.js';
import './js/wakelock.js';
import { boardLen, cellCount, cssClasses, playerTypeIconIds } from './js/constants.js';
import { boardCells, documentStyles, gameOverModal, mainClassList, startBtn } from './js/dom-objects.js';
import { CalculatedMove, getPlaceStr, getRandomInt, Player, wait } from './js/helper-functions.js';

// TODO rework colors

/** `boardLen`^2 length array of cellIds meant for keeping track of cell-ownership.
 * 0 means a cell is unoccupied and otherwise the cell belongs to the player w that id. */
const board = new Array(cellCount).fill(0);
const players = [
    new Player(
            documentStyles.getPropertyValue('--player-1-color'),
            'human',
            0,
            1
        ),
    new Player(
            documentStyles.getPropertyValue('--player-2-color'),
            'inactive',
            boardLen - 1,
            2
        ),
    new Player(
            documentStyles.getPropertyValue('--player-3-color'),
            'inactive',
            cellCount - boardLen,
            3
        ),
    new Player(
            documentStyles.getPropertyValue('--player-4-color'),
            'robot',
            cellCount - 1,
            4
        ),
];
const abortControllers = {
    selectMoveOrigin: new AbortController(),
    selectMoveTarget: new AbortController(),
    computerMove: new AbortController()
};
let turn = 0;
/** List of 1-based ids of playing players */
let idsOfActivePlayers;

players.forEach(changePlayerRole);
startBtn.addEventListener('click', () => {
    idsOfActivePlayers = players.reduce((ids, player) => {
        if (player.controllerType !== 'inactive') {
            ids.push(player.playerId);
        }
        return ids;
    }, []);

    if (idsOfActivePlayers.length < 2) return;

    if (mainClassList.contains(cssClasses.gameIsRunning)) {
        // FIXME cant just restart ai game. prob cuz endgame is called immediately in machineMove
        endGame();
    } else {
        startBtn.textContent = 'Restart Game';
        mainClassList.add(cssClasses.gameIsRunning);
    }

    startGame();
});

function changePlayerRole(player) {
    player.roleChangeButton.addEventListener('click', () => {
        if (mainClassList.contains(cssClasses.gameIsRunning)) {
            endGame();
            startBtn.textContent = 'Start Game';
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
    });
}

function endGame() {
    turn = 0;
    mainClassList.remove(cssClasses.gameIsRunning);
    players.forEach(player => player.roleChangeButton.classList.remove(cssClasses.activePlayer));
    clearBoard();
}

function startGame() {
    clearBoard();
    idsOfActivePlayers.forEach((idOfActivePlayer) => {
        const player = players[idOfActivePlayer - 1];
        
        boardCells[player.startPosition].dataset.ownerId = player.playerId;
        board[player.startPosition] = player.playerId;
        player.pieces.push(player.startPosition);
        updatePieceCount(player);
    });
    abortControllers.computerMove = new AbortController();
    makeMove();
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
    abortControllers.selectMoveOrigin.abort();
    abortControllers.selectMoveTarget.abort();
    abortControllers.computerMove.abort();
    boardCells.forEach((_, i) => clearCell(i));
}

function clearCell(cellId) {
    board[cellId] = 0;
    boardCells[cellId].dataset.ownerId = '';
    boardCells[cellId].classList = '';
}

function makeMove() {
    if (abortControllers.computerMove.signal.aborted) {
        return;
    }

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
        machineMove(possibleMoves, abortControllers.computerMove.signal)
            .then(endTurn);
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
    if (abortControllers.computerMove.signal.aborted) {
        return;
    }

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

        makeMove();
    }
}

/** @param { Object } possibleMoves { pieceId: 0-48, moves: { nextTo: [max. 8; 0-48] oneOff: [max. 16; 0-48] }[] }[] */
function humanMove(possibleMoves) {
    const player = players[idsOfActivePlayers[turn] - 1];
    
    Object.assign(abortControllers, {
        selectMoveOrigin: new AbortController(),
        selectMoveTarget: new AbortController()
    });

    // allow selection of movable pieces
    possibleMoves.forEach((possibleMove) => {
        const movableCell = boardCells[possibleMove.pieceId];

        movableCell.classList.add(cssClasses.clickableCell);
        movableCell.addEventListener(
            'click',
            ({ target: { classList: classListOfSelectedPiece } }) => {
                // allow deselection of selected movable-piece
                if (classListOfSelectedPiece.contains(cssClasses.selectedForMove)) {
                    // remove highlighting
                    classListOfSelectedPiece.remove(cssClasses.selectedForMove);
                    stopWaitingForMove(possibleMove);
                    // start listening
                    humanMove(possibleMoves);
                } else {
                    const finalizeMoveToCell = (idOfTargetCell) => {
                        classListOfSelectedPiece.remove(cssClasses.clickableCell);
                        classListOfSelectedPiece.remove(cssClasses.selectedForMove);
                        board[idOfTargetCell] = player.playerId;
                        boardCells[idOfTargetCell].dataset.ownerId = player.playerId;
                        stopWaitingForMove(possibleMove);
                        // check for neigbouring enemy pieces and turn them over
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
                        endTurn();
                    };

                    classListOfSelectedPiece.add(cssClasses.selectedForMove);
                    // remove eventlisteners and cursor-highlighting from other possible selection targets
                    abortControllers.selectMoveOrigin.abort();
                    player.pieces.forEach((cellId) => {
                        if (cellId !== possibleMove.pieceId) {
                            boardCells[cellId].classList.remove(cssClasses.clickableCell);
                        }
                    });
                    // listen for clicks on possible target-pieces
                    possibleMove.moves.nextTo.forEach((cellId) => {
                        boardCells[cellId].classList.add(cssClasses.clickableCell);
                        boardCells[cellId].addEventListener(
                            'click',
                            () => {
                                // player gains a new piece at the target-cell
                                player.pieces.push(cellId);
                                finalizeMoveToCell(cellId);
                            },
                            { signal: abortControllers.selectMoveTarget.signal }
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
                            { signal: abortControllers.selectMoveTarget.signal }
                        );
                    });
                }
            },
            { signal: abortControllers.selectMoveOrigin.signal }
        );
    });
}

async function machineMove(possibleMoves, abortSignal) {
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
            } else if (highestPayoff[0] === totalPayoff) {
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
    const id = getRandomInt(0, bestMoves[1].length - 1);
    const move = bestMoves[1][id];

    // wait a bit and highlight the selected piece
    await wait(200);

    if (abortSignal.aborted) {
        endGame();
        return;
    }

    boardCells[move.origin].classList.add(cssClasses.selectedForMove);

    // wait a bit more and highlight target cell
    await wait(400);

    if (abortSignal.aborted) {
        endGame();
        return;
    }

    boardCells[move.target].classList.add(cssClasses.highlightedTargetCell);

    // wait even more and make the move
    await wait(500);

    if (abortSignal.aborted) {
        endGame();
        return;
    }

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

    // wait again and undo highlighting of move
    await wait(200);

    if (abortSignal.aborted) {
        endGame();
        return;
    }

    boardCells[move.origin].classList.remove(cssClasses.selectedForMove);
    boardCells[move.target].classList.remove(cssClasses.highlightedTargetCell);

    // when jumped, remove piece from origin
    if (move.type === 0) {
        clearCell(move.origin);
        player.pieces.splice(player.pieces.indexOf(move.origin), 1);
    }
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
        && board[cell] !== 0
        && board[cell] !== idsOfActivePlayers[turn]
    );
}

function stopWaitingForMove({ moves: { nextTo, oneOff } }) {
    // rm listeners
    abortControllers.selectMoveTarget.abort();
    // rm highlighting
    [...nextTo, ...oneOff].forEach(
        (cellId) => boardCells[cellId].classList.remove(cssClasses.clickableCell)
    );
}