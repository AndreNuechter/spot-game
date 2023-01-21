import './js/service-worker-init.js';
import './js/wakelock.js';

// TODO rework colors (see manifest and index.html too)
// TODO refactor...rm inline styles

window.addEventListener('DOMContentLoaded', () => {
    const getElementById = (id) => document.getElementById(id);
    const startBtn = getElementById('start');
    const boardLen = 7;
    /** 0 means a cell is unoccupied and otherwise the cell belongs to the player w that id */
    const board = new Array(Math.pow(boardLen, 2)).fill(0);
    const mainClassList = document.querySelector('main').classList;
    const boardObject = getElementById('board');
    const players = [
        // TODO colors are duplicated in css
        new Player('#3399ff', 'user', 0, 1),
        new Player('#ff5050', 'inactive', boardLen - 1, 2),
        new Player('#ff9900', 'inactive', Math.pow(boardLen, 2) - boardLen, 3),
        new Player('#009900', 'robot', Math.pow(boardLen, 2) - 1, 4),
    ];
    const playerIconIds = {
        human: '#human-player',
        ai: '#ai-player',
        none: '#no-player'
    };
    const gameOverModal = getElementById('game-over-indicator');
    const boardCells = [];
    const boardWidth = 7;
    const cellSize = 32;
    const circleTmpl = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'circle',
    );
    /** List of 1-based ids of playing players */
    let idsOfActivePlayers;
    let turn;

    circleTmpl.setAttribute('r', '13');

    for (let i = 1; i <= boardWidth; i += 1) {
        for (let j = 1; j <= boardWidth; j += 1) {
            const circle = circleTmpl.cloneNode(true);

            circle.setAttribute('cx', cellSize * j);
            circle.setAttribute('cy', cellSize * i);

            boardCells.push(circle);
        }
    }

    boardObject.append(...boardCells);
    // register eventlisteners for player-selection
    players.forEach(changePlayerRole);

    startBtn.addEventListener('click', () => {
        if (!mainClassList.contains('game-is-running')) {
            startBtn.textContent = 'Restart Game';
            mainClassList.add('game-is-running');
        }

        idsOfActivePlayers = players.reduce((ids, player) => {
            if (player.state !== 'inactive') {
                ids.push(player.playerId);
            }
            return ids;
        }, []);
        turn = 0;
        setBoard();
    });

    function resetBoard() {
        startBtn.textContent = 'Start Game';
        mainClassList.remove('game-is-running');
        clearBoard();
        players.forEach(p => p.roleChangeButton.classList.remove('active'));
        turn = undefined;
    }

    function Player(color, state, start, playerId) {
        return {
            color,
            state,
            start,
            playerId,
            pieces: [],
            roleChangeButton: getElementById(`plr${playerId}`)
        };
    }

    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
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

    function clearCell(cellIndex) {
        board[cellIndex] = 0;
        boardCells[cellIndex].style.fill = 'beige';
        boardCells[cellIndex].classList = '';
        boardCells[cellIndex].onclick = null;
    }

    function clearBoard() {
        gameOverModal.classList.remove('visible');
        players.forEach((plr) => {
            plr.pieces.length = 0;
            plr.roleChangeButton.children[1].textContent = '';
        });
        boardCells.forEach((_, i) => clearCell(i));
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

    function endTurn() {
        if (turn === undefined) {
            resetBoard();
            return;
        }

        // remove turn highlighting
        players[idsOfActivePlayers[turn] - 1].roleChangeButton.classList.remove('active');

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
            gameOverModal.classList.add('visible');
            document.querySelector('main').classList.remove('game-is-running');
        } else {
            move();
        }
    }

    function humanMove(possibleMoves) {
        const plr = players[idsOfActivePlayers[turn] - 1];
        // allow selection of a piece
        possibleMoves.forEach((option) => {
            // change cursor for selectable pieces
            boardCells[option.piece].style.cursor = 'pointer';
            boardCells[option.piece].onclick = () => {
                // allow deselection of a piece
                if (boardCells[option.piece].classList.contains('selected')) {
                    // remove highlighting
                    boardCells[option.piece].classList.remove('selected');
                    // re-allow selection
                    humanMove(possibleMoves);
                    // remove listeners for move and cursor-highlighting
                    [...option.moves.nextTo, ...option.moves.oneOff].forEach((e) => {
                        boardCells[e].onclick = null;
                        boardCells[e].style.cursor = 'initial';
                    });
                } else {
                    // TODO rename this. it helps w what?
                    const helper = (e) => {
                        [...option.moves.nextTo, ...option.moves.oneOff].forEach((e2) => {
                            boardCells[e2].onclick = null;
                            boardCells[e2].style.cursor = 'initial';
                        });
                        board[e] = idsOfActivePlayers[turn];
                        boardCells[e].style.fill = plr.color;
                        // check for neigbouring enemy pieces and turn them over
                        getEnemyNeighbors(e).forEach((gained) => {
                            const owner = players[board[gained] - 1];
                            // remove piece from current owner and give it to player
                            plr.pieces.push(
                                ...owner.pieces.splice(owner.pieces.indexOf(gained), 1),
                            );
                            // update internal board state
                            board[gained] = idsOfActivePlayers[turn];
                            // update display
                            boardCells[gained].style.fill = plr.color;
                        });
                        endTurn();
                    };
                    // highlight selected piece
                    boardCells[option.piece].classList.add('selected');
                    // remove eventlisteners and cursor-highlighting from other possible selection targets
                    plr.pieces.forEach((j) => {
                        if (j !== option.piece) {
                            boardCells[j].onclick = null;
                            boardCells[j].style.cursor = 'initial';
                        }
                    });
                    // listen for click on possible target
                    option.moves.nextTo.forEach((e) => {
                        boardCells[e].style.cursor = 'pointer';
                        boardCells[e].onclick = () => {
                            boardCells[option.piece].onclick = null;
                            boardCells[option.piece].classList = '';
                            boardCells[option.piece].style.cursor = 'initial';
                            plr.pieces.push(e);
                            helper(e);
                        };
                    });
                    option.moves.oneOff.forEach((e) => {
                        boardCells[e].style.cursor = 'pointer';
                        boardCells[e].onclick = () => {
                            clearCell(option.piece);
                            boardCells[option.piece].style.cursor = 'initial';
                            plr.pieces[plr.pieces.indexOf(option.piece)] = e;
                            helper(e);
                        };
                    });
                }
            };
        });
    }

    function wait(ms) {
        return new Promise((r) => setTimeout(r, ms));
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
        possibleMoves.forEach((o) => {
            payoffs.push({
                next: o.moves.nextTo.map((closeNeighbor) => ({
                    origin: o.piece,
                    target: closeNeighbor,
                    bounty: getEnemyNeighbors(closeNeighbor),
                    type: 1,
                })),
                oneOff: o.moves.oneOff.map((farNeighbor) => ({
                    origin: o.piece,
                    target: farNeighbor,
                    bounty: getEnemyNeighbors(farNeighbor),
                    type: 0,
                })),
            });
        });
        // determine highest payoffs and remember corresponding moves
        payoffs.forEach((o) => { // o === a movable piece owned by active player
            [...o.next, ...o.oneOff].forEach((n) => {
                if (most[0] < n.bounty.length + n.type) {
                    thrdMost = secMost.slice();
                    secMost = most.slice();
                    most = [n.bounty.length + n.type, [n]];
                } else if (most[0] > n.bounty.length + n.type) {
                    if (secMost[0] < n.bounty.length + n.type) {
                        thrdMost = secMost.slice();
                        secMost = [n.bounty.length + n.type, [n]];
                    } else if (secMost[0] > n.bounty.length + n.type) {
                        if (thrdMost[0] < n.bounty.length + n.type) {
                            thrdMost = [n.bounty.length + n.type, [n]];
                        } else if (thrdMost[0] === n.bounty.length + n.type) {
                            thrdMost[1].push(n);
                        }
                    } else if (secMost[0] === n.bounty.length + n.type) {
                        secMost[1].push(n);
                    }
                } else if (most[0] === n.bounty.length + n.type) most[1].push(n);
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
        boardCells[move.origin].classList.add('selected');
        // wait a bit more and highlight target cell
        await wait(400);
        boardCells[move.target].style.stroke = 'Yellow';
        // wait even more and make move
        await wait(500);
        [move.target, ...move.bounty].forEach((cell) => {
            // Place piece in chosen cell
            if (board[cell] === 0) plr.pieces.push(cell);
            else {
                const owner = players[board[cell] - 1];
                // Flip neighboring enemy pieces
                plr.pieces.push(...owner.pieces.splice(owner.pieces.indexOf(cell), 1));
            }
            // Update board and display
            board[cell] = idsOfActivePlayers[turn];
            boardCells[cell].style.fill = plr.color;
        });
        // wait again and undo highlighting of move
        await wait(200);
        boardCells[move.origin].classList.remove('selected');
        boardCells[move.target].style.stroke = 'black';

        // when jumped, remove piece from origin
        if (move.type === 0) {
            clearCell(move.origin);
            plr.pieces.splice(plr.pieces.indexOf(move.origin), 1);
        }

        endTurn();
    }

    function move() {
        if (turn === undefined) return;

        const plr = players[idsOfActivePlayers[turn] - 1];
        const possibleMoves = plr.pieces
            .map((piece) => ({ piece: piece, moves: getMoves(piece) }))
            .filter((option) =>
                option.moves.nextTo.length > 0 || option.moves.oneOff.length > 0
            );

        // highlight active player
        plr.roleChangeButton.classList.add('active');

        if (possibleMoves.length === 0) {
            endTurn();
        } else if (plr.state === 'user') {
            humanMove(possibleMoves);
        } else if (plr.state === 'robot') {
            machineMove(possibleMoves);
        }
    }

    function setBoard() {
        if (idsOfActivePlayers.length < 2) return;

        clearBoard();
        idsOfActivePlayers.forEach((idOfActivePlayer) => {
            const player = players[idOfActivePlayer - 1];

            boardCells[player.start].style.fill = player.color;
            board[player.start] = idOfActivePlayer;
            player.pieces.push(player.start);
            player.roleChangeButton.children[1].textContent = player.pieces.length;
        });
        move();
    }

    function changePlayerRole(player) {
        const roleChangeButton = player.roleChangeButton;

        roleChangeButton.onclick = () => {
            if (mainClassList.contains('game-is-running')) {
                resetBoard();
            }

            switch (player.state) {
                case 'inactive':
                    roleChangeButton.children[0].firstElementChild.setAttribute('href', playerIconIds.ai);
                    player.state = 'robot';
                    break;
                case 'robot':
                    roleChangeButton.children[0].firstElementChild.setAttribute('href', playerIconIds.human);
                    player.state = 'user';
                    break;
                case 'user':
                    roleChangeButton.children[0].firstElementChild.setAttribute('href', playerIconIds.none);
                    player.state = 'inactive';
                    break;
            }
        };
    }
}, { once: true });