import './js/service-worker-init.js';
import './js/wakelock.js';
import { boardLen, cssClasses, playerTypeIconIds } from './js/constants.js';
import { boardCells, gameOverModal, mainClassList, startBtn } from './js/dom-elements.js';
import { CalculatedMove, getPlaceStr, getRandomInt, Player, wait } from './js/helper-functions.js';

// TODO rework colors

/** `boardLen`^2 length array of cellIds meant for keeping track of cell-ownership.
 * 0 means a cell is unoccupied and otherwise the cell belongs to the player w that id. */
const board = new Array(Math.pow(boardLen, 2)).fill(0);
const players = [
    // TODO colors are duplicated in css
    new Player('#3399ff', 'human', 0, 1),
    new Player('#ff5050', 'inactive', boardLen - 1, 2),
    new Player('#ff9900', 'inactive', Math.pow(boardLen, 2) - boardLen, 3),
    new Player('#009900', 'robot', Math.pow(boardLen, 2) - 1, 4),
];
const abortControllers = {
    selectMoveOrigin: new AbortController(),
    selectMoveTarget: new AbortController()
};
/** List of 1-based ids of playing players */
let idsOfActivePlayers;
let turn;

players.forEach(changePlayerRole);
startBtn.addEventListener('click', () => {
    idsOfActivePlayers = players.reduce((ids, player) => {
        if (player.controllerType !== 'inactive') {
            ids.push(player.playerId);
        }
        return ids;
    }, []);

    if (idsOfActivePlayers.length < 2) return;

    if (!mainClassList.contains(cssClasses.gameIsRunning)) {
        startBtn.textContent = 'Restart Game';
        mainClassList.add(cssClasses.gameIsRunning);
    }

    turn = 0;
    setBoard();
});

function changePlayerRole(player) {
    player.roleChangeButton.addEventListener('click', () => {
        if (mainClassList.contains(cssClasses.gameIsRunning)) {
            resetBoard();
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

function resetBoard() {
    startBtn.textContent = 'Start Game';
    mainClassList.remove(cssClasses.gameIsRunning);
    clearBoard();
    players.forEach(player => player.roleChangeButton.classList.remove(cssClasses.activePlayer));
    turn = undefined;
}

function setPlayerRole(player, newRole) {
    player.controllerType = newRole;
    player.roleChangeButton.children[0].firstElementChild.setAttribute('href', playerTypeIconIds[newRole]);
}

function setBoard() {
    clearBoard();
    idsOfActivePlayers.forEach((idOfActivePlayer) => {
        const player = players[idOfActivePlayer - 1];

        boardCells[player.start].dataset.ownerId = idOfActivePlayer;
        board[player.start] = idOfActivePlayer;
        player.pieces.push(player.start);
        player.roleChangeButton.children[1].textContent = player.pieces.length;
    });
    move();
}

function clearBoard() {
    gameOverModal.classList.remove(cssClasses.visible);
    players.forEach((player) => {
        player.pieces.length = 0;
        player.roleChangeButton.children[1].textContent = '';
    });
    abortControllers.selectMoveOrigin.abort();
    abortControllers.selectMoveTarget.abort();
    boardCells.forEach((_, i) => clearCell(i));
}

function clearCell(cellId) {
    board[cellId] = 0;
    boardCells[cellId].dataset.ownerId = '';
}

function move() {
    if (turn === undefined) return;

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
        machineMove(possibleMoves);
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
    if (turn === undefined) {
        resetBoard();
        return;
    }

    // remove turn highlighting from button
    players[idsOfActivePlayers[turn] - 1].roleChangeButton.classList.remove(cssClasses.activePlayer);

    // advance turn
    if (turn < idsOfActivePlayers.length - 1) {
        turn += 1;
    } else {
        turn = 0;
    }

    // adjust piece counts
    idsOfActivePlayers.forEach((playerId) => {
        const player = players[playerId - 1];
        player.roleChangeButton.children[1].textContent = player.pieces.length;
    });

    // stop game when board is full or only one player w pieces remains
    if (
        board.filter((cell) => cell === 0).length === 0 ||
        players.filter((player) => player.pieces.length > 0).length <= 1
    ) {
        // rank players and communicate end of game
        idsOfActivePlayers
            .map((playerId) => ({
                playerId,
                pieceCount: players[playerId - 1].pieces.length
            }))
            .sort(({ pieceCount: a }, { pieceCount: b }) => b - a)
            .forEach(({ playerId }, i) => {
                players[playerId - 1].roleChangeButton.children[1].textContent = getPlaceStr(i);
            });
        gameOverModal.classList.add(cssClasses.visible);
        mainClassList.remove(cssClasses.gameIsRunning);
    } else {
        move();
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
                    const finalizeMoveToCell = (cellId) => {
                        classListOfSelectedPiece.remove(cssClasses.clickableCell);
                        classListOfSelectedPiece.remove(cssClasses.selectedForMove);
                        board[cellId] = player.playerId;
                        boardCells[cellId].dataset.ownerId = player.playerId;
                        stopWaitingForMove(possibleMove);
                        // check for neigbouring enemy pieces and turn them over
                        getEnemyNeighbors(cellId).forEach((idOfGainedPiece) => {
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

// FIXME restarting a game or changing a player role while a move is in progress can cause the move to happen in the next game (adding unwarranted pieces into the game) or on a blank board (which is cleaned up, but still)
async function machineMove(possibleMoves) {
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
    let most = [0, []];
    let secMost = [];
    let thrdMost;
    let candidates;

    // find highest payoffs and remember corresponding moves
    payoffs.forEach((payoff) => {
        [...payoff.nextTo, ...payoff.oneOff].forEach((move) => {
            const totalPayoff = move.bounty.length + move.type;

            if (most[0] < totalPayoff) {
                thrdMost = secMost.slice();
                secMost = most.slice();
                most = [totalPayoff, [move]];
            } else if (most[0] > totalPayoff) {
                if (secMost[0] < totalPayoff) {
                    thrdMost = secMost.slice();
                    secMost = [totalPayoff, [move]];
                } else if (secMost[0] > totalPayoff) {
                    if (thrdMost[0] < totalPayoff) {
                        thrdMost = [totalPayoff, [move]];
                    } else if (thrdMost[0] === totalPayoff) {
                        thrdMost[1].push(move);
                    }
                } else if (secMost[0] === totalPayoff) {
                    secMost[1].push(move);
                }
            } else if (most[0] === totalPayoff) {
                most[1].push(move);
            }
        });
    });

    // Randomnly pick one of the three highest payoffs (w strong bias towards highest)
    // There can be 1 (secMost[0] === 0), 2 (secMost[0] !== 0 && thrdMost[0] === 0) and 3 highest payoffs, here mapped to distributions of [1], [.9, .1], [.9, .09, .01].
    if (secMost[0] === 0) {
        candidates = most;
    } else if (secMost[0] !== 0 && thrdMost[0] === 0) {
        const dice = Math.random();
        if (dice > 0.1) candidates = most;
        else candidates = secMost;
    } else {
        const dice = Math.random();
        if (dice > 0.1) candidates = most;
        else if (dice > 0.01) candidates = secMost;
        else candidates = thrdMost;
    }

    // Randomnly pick one of the moves leading to chosen payoff
    const id = getRandomInt(0, candidates[1].length - 1);
    const move = candidates[1][id];

    // wait a bit and highlight selected piece
    await wait(200);
    boardCells[move.origin].classList.add(cssClasses.selectedForMove);
    // wait a bit more and highlight target cell
    await wait(400);
    boardCells[move.target].classList.add(cssClasses.highlightedTargetCell);
    // wait even more and make move
    await wait(500);
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
    boardCells[move.origin].classList.remove(cssClasses.selectedForMove);
    boardCells[move.target].classList.remove(cssClasses.highlightedTargetCell);

    // when jumped, remove piece from origin
    if (move.type === 0) {
        clearCell(move.origin);
        player.pieces.splice(player.pieces.indexOf(move.origin), 1);
    }

    endTurn();
}

function findFreeCells(cellId) {
    return cellId >= 0 && cellId < board.length && board[cellId] === 0;
}

/** Return array of cellIds surounding the given cellId, occupied by non-active players. */
function getEnemyNeighbors(pieceId) {
    const isPieceNotAtLBorder = pieceId % boardLen > 0;
    const isPieceNotAtRBorder = pieceId % boardLen < 6;
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
    [
        ...nextTo,
        ...oneOff
    ].forEach((cellId) => {
        boardCells[cellId].classList.remove(cssClasses.clickableCell);
    })
}