import './js/service-worker-init.js';
import './js/wakelock.js';

// TODO rework colors (see manifest and index.html too)
// TODO refactor...rm inline styles, rm compound assignments, 

window.addEventListener('DOMContentLoaded', () => {
    const getElementById = (id) => document.getElementById(id);
    const getElementByClass = (cls) => document.getElementsByClassName(cls);
    const startBtn = getElementById('start');
    const boardLen = 7;
    const board = new Array(Math.pow(boardLen, 2)).fill(0);
    const mainClassList = document.querySelector('main').classList;
    const boardObject = getElementById('board');
    const playerSelects = getElementByClass('slct');
    const players = [
        // TODO colors are duplicated in css
        new Player('#3399ff', 'user', 0),
        new Player('#ff5050', 'inactive', boardLen - 1),
        new Player('#ff9900', 'inactive', Math.pow(boardLen, 2) - boardLen),
        new Player('#009900', 'robot', Math.pow(boardLen, 2) - 1),
    ];
    const gameOverModal = getElementById('game-over-indicator');
    const boardCells = [];
    const boardWidth = 7;
    const cellSize = 32;
    const circleTmpl = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'circle',
    );
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
    for (let playerSelect of playerSelects) {
        changeRole(playerSelect);
    }

    startBtn.addEventListener('click', () => {
        if (!mainClassList.contains('game-is-running')) {
            startBtn.innerText = 'Restart Game';
            mainClassList.add('game-is-running');
        }

        idsOfActivePlayers = players.reduce((ids, currentPlayer, i) => {
            if (currentPlayer.state !== 'inactive') {
                ids.push(i);
            }
            return ids;
        }, []);
        turn = 0;
        setBoard(idsOfActivePlayers);
    });

    function resetBoard() {
        startBtn.innerText = 'Start Game';
        mainClassList.remove('game-is-running');
        clearBoard();
        turn = undefined;
    }

    function Player(color, state, start) {
        return { color, state, start, pieces: [] };
    }

    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function getMoves(piece) {
        const isPieceNotAtLBorder = piece % boardLen > 0,
            isPieceNotAtRBorder = piece % boardLen < 6,
            isPieceNotByLBorder = piece % boardLen > 1,
            isPieceNotByRBorder = piece % boardLen < 5,
            neighborCells = [
                isPieceNotAtLBorder ? piece - 1 : -1,
                isPieceNotAtLBorder ? piece - boardLen - 1 : -1,
                isPieceNotAtLBorder ? piece + boardLen - 1 : -1,
                piece - boardLen,
                isPieceNotAtRBorder ? piece - boardLen + 1 : -1,
                isPieceNotAtRBorder ? piece + 1 : -1,
                isPieceNotAtRBorder ? piece + boardLen + 1 : -1,
                piece + boardLen,
            ],
            cellsOneOff = [
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
            ],
            nextTo = neighborCells.filter(findFreeCells),
            oneOff = cellsOneOff.filter(findFreeCells);

            return { nextTo, oneOff };
    }

    function findFreeCells(val) {
        return 0 <= val && val < board.length && board[val] === 0;
    }

    function getEnemyNeighbors(piece) {
        const isPieceNotAtLBorder = piece % boardLen > 0,
            isPieceNotAtRBorder = piece % boardLen < 6,
            neighborCells = [
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
            && board[cell] !== idsOfActivePlayers[turn] + 1
        );
    }

    function clearCell(cell) {
        board[cell] = 0;
        boardCells[cell].style.fill = 'beige';
        boardCells[cell].classList = '';
        boardCells[cell].onclick = null;
    }

    function clearBoard() {
        gameOverModal.classList.remove('visible');
        players.forEach((plr, i) => {
            plr.pieces.length = 0;
            getElementById(`plr${i + 1}`).children[1].textContent = '';
        });
        for (let i = 0; i < boardCells.length; i += 1) {
            clearCell(i);
        }
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
        getElementById('plr' + (idsOfActivePlayers[turn] + 1)).classList.remove('active');

        // advance turn
        if (turn < idsOfActivePlayers.length - 1) {
            turn += 1;
        } else {
            turn = 0;
        }

        // adjust piece counts
        idsOfActivePlayers.forEach((playerId) => {
            getElementById(`plr${playerId + 1}`).children[1].textContent = players[playerId].pieces.length;
        });

        // stop game when board is full or only one player w pieces remains
        if (
            board.filter((cell) => cell === 0).length === 0 ||
            players.filter((e) => e.pieces.length > 0).length <= 1
        ) {
            // rank players and communicate end of game
            idsOfActivePlayers
                .map((id) => ({
                    playerId: id + 1,
                    pieces: players[id].pieces.length
                }))
                .sort(({ pieces: a }, { pieces: b }) => b - a)
                .forEach(({ playerId }, i) => {
                    getElementById(`plr${playerId}`).children[1].textContent = getPlaceStr(i);
                });
            gameOverModal.classList.add('visible');
            document.querySelector('main').classList.remove('game-is-running');
        } else {
            move();
        }
    }

    function humanMove(options) {
        const plr = players[idsOfActivePlayers[turn]];
        // allow selection of a piece
        options.forEach((option) => {
            // change cursor for selectable pieces
            boardCells[option.piece].style.cursor = 'pointer';
            boardCells[option.piece].onclick = () => {
                // allow deselection of a piece
                if (boardCells[option.piece].classList.contains('selected')) {
                    // remove highlighting
                    boardCells[option.piece].classList.remove('selected');
                    // re-allow selection
                    humanMove(options);
                    // remove listeners for move and cursor-highlighting
                    [...option.moves.nextTo, ...option.moves.oneOff].forEach((e) => {
                        boardCells[e].onclick = null;
                        boardCells[e].style.cursor = 'initial';
                    });
                } else {
                    const helper = (e) => {
                        [...option.moves.nextTo, ...option.moves.oneOff].forEach((e2) => {
                            boardCells[e2].onclick = null;
                            boardCells[e2].style.cursor = 'initial';
                        });
                        board[e] = idsOfActivePlayers[turn] + 1;
                        boardCells[e].style.fill = plr.color;
                        // check for neigbouring enemy pieces and turn them over
                        getEnemyNeighbors(e).forEach((gained) => {
                            const owner = players[board[gained] - 1];
                            // remove piece from current owner and give it to player
                            plr.pieces.push(
                                ...owner.pieces.splice(owner.pieces.indexOf(gained), 1),
                            );
                            // update internal board state
                            board[gained] = idsOfActivePlayers[turn] + 1;
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

    async function machineMove(options) {
        const plr = players[idsOfActivePlayers[turn]],
            payoffs = [];
        let most = [0, []],
            secMost = [],
            thrdMost;
        // get payoffs
        options.forEach((o) => {
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
        let candidates;
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
        const id = getRandomInt(0, candidates[1].length - 1),
            move = candidates[1][id];
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
            board[cell] = idsOfActivePlayers[turn] + 1;
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
        // highlight active player
        getElementById('plr' + (idsOfActivePlayers[turn] + 1)).classList.add('active');
        // go thru players' pieces, see if there're moves and bundle em up for later use
        const plr = players[idsOfActivePlayers[turn]],
            options = plr.pieces
                .map((piece) => ({ piece: piece, moves: getMoves(piece) }))
                .filter((option) =>
                    option.moves.nextTo.length > 0 || option.moves.oneOff.length > 0
                );

        if (options.length === 0) endTurn();
        else if (plr.state === 'user') humanMove(options);
        else if (plr.state === 'robot') machineMove(options);
    }

    function setBoard(actives) {
        if (actives.length < 2) return;
        clearBoard();
        actives.forEach((e) => {
            boardCells[players[e].start].style.fill = players[e].color;
            players[e].pieces.push(players[e].start);
            board[players[e].start] = e + 1;
            getElementById('plr' + (e + 1)).children[1].textContent = players[e].pieces.length;
        });
        move();
    }

    const playerCssClasses = {
        human: '#human-player',
        ai: '#ai-player',
        none: '#no-player'
    };

    function changeRole(playerSelect) {
        const player = players[playerSelect.id.slice(-1) - 1];

        playerSelect.onclick = () => {
            if (mainClassList.contains('game-is-running')) {
                resetBoard();
            }

            switch (player.state) {
                case 'inactive':
                    playerSelect.children[0].firstElementChild.setAttribute('href', playerCssClasses.ai);
                    player.state = 'robot';
                    break;
                case 'robot':
                    playerSelect.children[0].firstElementChild.setAttribute('href', playerCssClasses.human);
                    player.state = 'user';
                    break;
                case 'user':
                    playerSelect.children[0].firstElementChild.setAttribute('href', playerCssClasses.none);
                    player.state = 'inactive';
                    break;
            }
        };
    }
}, { once: true });
