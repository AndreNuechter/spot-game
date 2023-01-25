import './js/service-worker-init.js';
import './js/wakelock.js';

// TODO rework colors
// TODO refactor...rm onclick handler
// TODO stashing in deploy is anoying as the stash is not reapllied (how would we ensure there has been one created and we're in fact restoring that?)

window.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start');
    const boardLen = 7;
    /** 0 means a cell is unoccupied and otherwise the cell belongs to the player w that id */
    const board = new Array(Math.pow(boardLen, 2)).fill(0);
    const mainClassList = document.querySelector('main').classList;
    const boardObject = document.getElementById('board');
    const players = [
        // TODO colors are duplicated in css
        new Player('#3399ff', 'human', 0, 1),
        new Player('#ff5050', 'inactive', boardLen - 1, 2),
        new Player('#ff9900', 'inactive', Math.pow(boardLen, 2) - boardLen, 3),
        new Player('#009900', 'robot', Math.pow(boardLen, 2) - 1, 4),
    ];
    const playerTypeIconIds = {
        human: '#human-player',
        robot: '#ai-player',
        inactive: '#no-player'
    };
    const cssClasses = {
        activePlayer: 'active',
        clickableCell: 'clickable',
        gameIsRunning: 'game-is-running',
        highlightedTargetCell: 'targeted',
        selectedForMove: 'selected',
        visible: 'visible',
    };
    const gameOverModal = document.getElementById('game-over-indicator');
    const boardCells = [];
    const cellSize = 36;
    const circleTmpl = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'circle',
    );
    /** List of 1-based ids of playing players */
    let idsOfActivePlayers;
    let turn;

    circleTmpl.setAttribute('r', '16');

    for (let i = 0; i < boardLen; i += 1) {
        for (let j = 0; j < boardLen; j += 1) {
            const circle = circleTmpl.cloneNode(true);

            circle.setAttribute('cx', cellSize * j + (cellSize * 0.5));
            circle.setAttribute('cy', cellSize * i + (cellSize * 0.5));

            boardCells.push(circle);
        }
    }

    boardObject.append(...boardCells);
    // register eventlisteners for player-selection
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

    function Player(color, controllerType, start, playerId) {
        return {
            color,
            controllerType,
            start,
            playerId,
            /** Will contain ids of boardCells belonging to that player */
            pieces: [],
            roleChangeButton: document.getElementById(`plr${playerId}`)
        };
    }

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
        players.forEach((plr) => {
            plr.pieces.length = 0;
            plr.roleChangeButton.children[1].textContent = '';
        });
        boardCells.forEach((_, i) => clearCell(i));
    }

    function clearCell(cellId) {
        board[cellId] = 0;
        boardCells[cellId].dataset.ownerId = '';
        boardCells[cellId].onclick = null;
    }

    function move() {
        if (turn === undefined) return;

        const plr = players[idsOfActivePlayers[turn] - 1];
        const possibleMoves = plr.pieces
            .map((piece) => ({ pieceId: piece, moves: getMoves(piece) }))
            .filter((option) =>
                option.moves.nextTo.length > 0 || option.moves.oneOff.length > 0
            );

        // highlight active player
        plr.roleChangeButton.classList.add(cssClasses.activePlayer);

        if (possibleMoves.length === 0) {
            endTurn();
        } else if (plr.controllerType === 'human') {
            humanMove(possibleMoves);
        } else if (plr.controllerType === 'robot') {
            machineMove(possibleMoves);
        }
    }

    function getMoves(piece) {
        const isPieceNotAtLBorder = piece % boardLen > 0;
        const isPieceNotAtRBorder = piece % boardLen < 6;
        const isPieceNotByLBorder = piece % boardLen > 1;
        const isPieceNotByRBorder = piece % boardLen < 5;
        const neighborCells = [
                isPieceNotAtLBorder ? piece - 1 : -1,
                isPieceNotAtLBorder ? piece - boardLen - 1 : -1,
                isPieceNotAtLBorder ? piece + boardLen - 1 : -1,
                piece - boardLen,
                isPieceNotAtRBorder ? piece - boardLen + 1 : -1,
                isPieceNotAtRBorder ? piece + 1 : -1,
                isPieceNotAtRBorder ? piece + boardLen + 1 : -1,
                piece + boardLen,
            ];
        const cellsOneOff = [
                isPieceNotAtLBorder && isPieceNotByLBorder ? piece - 2 : -1,
                isPieceNotAtLBorder && isPieceNotByLBorder ? piece - boardLen - 2 : -1,
                isPieceNotAtLBorder && isPieceNotByLBorder ? piece - 2 * boardLen - 2 : -1,
                isPieceNotAtLBorder && isPieceNotByLBorder ? piece + 2 * boardLen - 2 : -1,
                isPieceNotAtLBorder && isPieceNotByLBorder ? piece + boardLen - 2 : -1,
                isPieceNotAtLBorder ? piece - 2 * boardLen - 1 : -1,
                isPieceNotAtLBorder ? piece + 2 * boardLen - 1 : -1,
                piece - 2 * boardLen,
                piece + 2 * boardLen,
                isPieceNotAtRBorder && isPieceNotByRBorder ? piece - 2 * boardLen + 2 : -1,
                isPieceNotAtRBorder && isPieceNotByRBorder ? piece - boardLen + 2 : -1,
                isPieceNotAtRBorder && isPieceNotByRBorder ? piece + 2 : -1,
                isPieceNotAtRBorder && isPieceNotByRBorder ? piece + boardLen + 2 : -1,
                isPieceNotAtRBorder && isPieceNotByRBorder ? piece + 2 * boardLen + 2 : -1,
                isPieceNotAtRBorder ? piece - 2 * boardLen + 1 : -1,
                isPieceNotAtRBorder ? piece + 2 * boardLen + 1 : -1,
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
                .map((id) => ({
                    playerId: id,
                    pieces: players[id - 1].pieces.length
                }))
                .sort(({ pieces: a }, { pieces: b }) => b - a)
                .forEach(({ playerId }, i) => {
                    players[playerId - 1].roleChangeButton.children[1].textContent = getPlaceStr(i);
                });
            gameOverModal.classList.add(cssClasses.visible);
            mainClassList.remove(cssClasses.gameIsRunning);
        } else {
            move();
        }
    }

    function humanMove(possibleMoves) {
        const plr = players[idsOfActivePlayers[turn] - 1];
        // TODO can we use AbortController to rm those listeners all at once?
        // remove listeners for move and cursor-highlighting
        const disableClickListener = (possibleMove) => [
            ...possibleMove.moves.nextTo,
            ...possibleMove.moves.oneOff
            ].forEach((cellId) => {
                boardCells[cellId].onclick = null;
                boardCells[cellId].classList.remove(cssClasses.clickableCell);
            });
        // allow selection of a piece
        possibleMoves.forEach((possibleMove) => {
            boardCells[possibleMove.pieceId].classList.add(cssClasses.clickableCell);
            boardCells[possibleMove.pieceId].onclick = () => {
                // allow deselection of a piece
                if (boardCells[possibleMove.pieceId].classList.contains(cssClasses.selectedForMove)) {
                    // remove highlighting
                    boardCells[possibleMove.pieceId].classList.remove(cssClasses.selectedForMove);
                    // re-allow selection
                    humanMove(possibleMoves);
                    disableClickListener(possibleMove);
                } else {
                    // TODO rename this. it helps w what?
                    const helper = (cellId) => {
                        board[cellId] = plr.playerId;
                        boardCells[cellId].dataset.ownerId = plr.playerId;
                        disableClickListener(possibleMove);
                        // check for neigbouring enemy pieces and turn them over
                        getEnemyNeighbors(cellId).forEach((gained) => {
                            const previousOwner = players[board[gained] - 1];
                            // remove piece from current owner and give it to player
                            plr.pieces.push(
                                ...previousOwner.pieces.splice(previousOwner.pieces.indexOf(gained), 1),
                            );
                            // update internal board state
                            board[gained] = plr.playerId;
                            // update display
                            boardCells[gained].dataset.ownerId = plr.playerId;
                        });
                        endTurn();
                    };
                    // highlight selected piece
                    boardCells[possibleMove.pieceId].classList.add(cssClasses.selectedForMove);
                    // remove eventlisteners and cursor-highlighting from other possible selection targets
                    plr.pieces.forEach((cellId) => {
                        if (cellId !== possibleMove.pieceId) {
                            boardCells[cellId].onclick = null;
                            boardCells[cellId].classList.remove(cssClasses.clickableCell);
                        }
                    });
                    // listen for click on possible target
                    possibleMove.moves.nextTo.forEach((cellId) => {
                        boardCells[cellId].classList.add(cssClasses.clickableCell);
                        boardCells[cellId].onclick = () => {
                            boardCells[possibleMove.pieceId].onclick = null;
                            boardCells[possibleMove.pieceId].classList.remove(cssClasses.clickableCell);
                            boardCells[possibleMove.pieceId].classList.remove(cssClasses.selectedForMove);
                            plr.pieces.push(cellId);
                            helper(cellId);
                        };
                    });
                    possibleMove.moves.oneOff.forEach((cellId) => {
                        boardCells[cellId].classList.add(cssClasses.clickableCell);
                        boardCells[cellId].onclick = () => {
                            clearCell(possibleMove.pieceId);
                            boardCells[possibleMove.pieceId].classList.remove(cssClasses.clickableCell);
                            boardCells[possibleMove.pieceId].classList.remove(cssClasses.selectedForMove);
                            plr.pieces[plr.pieces.indexOf(possibleMove.pieceId)] = cellId;
                            helper(cellId);
                        };
                    });
                }
            };
        });
    }

    // FIXME restarting a game or changing a player role while a move is in progress can cause the move to happen in the next game (adding unwarranted pieces into the game) or on a blank board (which is cleaned up, but still)
    async function machineMove(possibleMoves) {
        const plr = players[idsOfActivePlayers[turn] - 1];
        const payoffs = [];
        let most = [0, []];
        let secMost = [];
        let thrdMost;
        let candidates;

        // get payoffs
        possibleMoves.forEach((possibleMove) => {
            payoffs.push({
                nextTo: possibleMove.moves.nextTo.map((closeNeighbor) => ({
                    origin: possibleMove.pieceId,
                    target: closeNeighbor,
                    bounty: getEnemyNeighbors(closeNeighbor),
                    type: 1,
                })),
                oneOff: possibleMove.moves.oneOff.map((farNeighbor) => ({
                    origin: possibleMove.pieceId,
                    target: farNeighbor,
                    bounty: getEnemyNeighbors(farNeighbor),
                    type: 0,
                })),
            });
        });
        // determine highest payoffs and remember corresponding moves
        payoffs.forEach((startingPiece) => {
            [...startingPiece.nextTo, ...startingPiece.oneOff].forEach((move) => {
                if (most[0] < move.bounty.length + move.type) {
                    thrdMost = secMost.slice();
                    secMost = most.slice();
                    most = [move.bounty.length + move.type, [move]];
                } else if (most[0] > move.bounty.length + move.type) {
                    if (secMost[0] < move.bounty.length + move.type) {
                        thrdMost = secMost.slice();
                        secMost = [move.bounty.length + move.type, [move]];
                    } else if (secMost[0] > move.bounty.length + move.type) {
                        if (thrdMost[0] < move.bounty.length + move.type) {
                            thrdMost = [move.bounty.length + move.type, [move]];
                        } else if (thrdMost[0] === move.bounty.length + move.type) {
                            thrdMost[1].push(move);
                        }
                    } else if (secMost[0] === move.bounty.length + move.type) {
                        secMost[1].push(move);
                    }
                } else if (most[0] === move.bounty.length + move.type) {
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
            if (board[cellId] === 0) plr.pieces.push(cellId);
            else {
                const owner = players[board[cellId] - 1];
                // Flip neighboring enemy pieces
                plr.pieces.push(...owner.pieces.splice(owner.pieces.indexOf(cellId), 1));
            }
            // Update board and display
            board[cellId] = plr.playerId;
            boardCells[cellId].dataset.ownerId = plr.playerId;
        });
        // wait again and undo highlighting of move
        await wait(200);
        boardCells[move.origin].classList.remove(cssClasses.selectedForMove);
        boardCells[move.target].classList.remove(cssClasses.highlightedTargetCell);

        // when jumped, remove piece from origin
        if (move.type === 0) {
            clearCell(move.origin);
            plr.pieces.splice(plr.pieces.indexOf(move.origin), 1);
        }

        endTurn();
    }

    function findFreeCells(val) {
        return 0 <= val && val < board.length && board[val] === 0;
    }

    function getEnemyNeighbors(piece) {
        const isPieceNotAtLBorder = piece % boardLen > 0;
        const isPieceNotAtRBorder = piece % boardLen < 6;
        const neighborCells = [
            isPieceNotAtLBorder ? piece - 1 : -1,
            isPieceNotAtLBorder ? piece - boardLen - 1 : -1,
            isPieceNotAtLBorder ? piece + boardLen - 1 : -1,
            piece - boardLen,
            isPieceNotAtRBorder ? piece - boardLen + 1 : -1,
            isPieceNotAtRBorder ? piece + 1 : -1,
            isPieceNotAtRBorder ? piece + boardLen + 1 : -1,
            piece + boardLen,
        ];

        return neighborCells.filter((cell) =>
            0 <= cell
            && cell < board.length
            && board[cell] !== 0
            && board[cell] !== idsOfActivePlayers[turn]
        );
    }

    function getPlaceStr(i) {
        switch (i) {
            case 0:
                return '1st';
            case 1:
                return '2nd';
            case 2:
                return '3rd';
            case 3:
                return '4th';
        }
    }

    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function wait(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }
}, { once: true });