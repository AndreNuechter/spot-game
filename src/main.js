import './js/service-worker-init.js';
import './js/wakelock.js';

// https://codepen.io/AndreNuechter/pen/bmJLVr

// TODO icons (fontawesome)
// TODO refactor

window.addEventListener('DOMContentLoaded', () => {
    const id = (id) => document.getElementById(id);
    const cls = (cls) => document.getElementsByClassName(cls);
    const start = id('start');
    const boardLen = 7;
    const board = new Array(Math.pow(boardLen, 2)).fill(0);
    const slct = cls('slct');
    const plrs = [
        new Player(slct[0].style.color, 'user', 0),
        new Player(slct[2].style.color, 'inactive', boardLen - 1),
        new Player(slct[3].style.color, 'robot', Math.pow(boardLen, 2) - 1),
        new Player(
            slct[1].style.color,
            'inactive',
            Math.pow(boardLen, 2) - boardLen,
        ),
    ];
    const gameOver = id('game-over-indicator');
    const circles = [];
    const boardWidth = 7;
    const boardObject = id('board');
    const circleTmpl = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'circle',
    );
    let actives;
    let turn;

    circleTmpl.setAttribute('fill', 'beige');
    circleTmpl.setAttribute('stroke', 'black');
    circleTmpl.setAttribute('stroke-width', '2');
    circleTmpl.setAttribute('r', '13');

    for (let i = 1; i <= boardWidth; i += 1) {
        for (let j = 1; j <= boardWidth; j += 1) {
            const circle = circleTmpl.cloneNode(true);

            circle.setAttribute('cx', 32 * j);
            circle.setAttribute('cy', 32 * i);

            circles.push(circle);
        }
    }

    boardObject.append(...circles);

    // Register eventlisteners for plr-selection
    for (let plr of slct) {
        changeRole(plr);
    }

    start.onclick = () => {
        start.innerText = 'Restart Game';
        actives = [];
        plrs.forEach((plr, i) => {
            if (plr.state !== 'inactive') actives.push(i);
        });
        setBoard(actives);
    };

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
            findFreeCells = (val) => 0 <= val && val < board.length && board[val] === 0,
            neighbors = neighborCells.filter(findFreeCells),
            oneOff = cellsOneOff.filter(findFreeCells);
        return {
            nextTo: neighbors,
            oneOff: oneOff,
        };
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
            0 <= cell && cell < board.length && board[cell] !== 0 &&
            board[cell] !== actives[turn] + 1
        );
    }

    function clearCell(cell) {
        board[cell] = 0;
        circles[cell].style.fill = 'beige';
        circles[cell].classList = circles[cell].onclick = '';
    }

    function clearBoard() {
        gameOver.style.zIndex = -1;
        plrs.forEach((plr, i) => {
            plr.pieces.length = 0;
            id('plr' + (i + 1)).children[1].textContent = '';
        });
        for (let i = 0; i < circles.length; i += 1) {
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
        // log pieces at turn's end
        // log('player', actives[turn] + 1, 'now has', plrs[actives[turn]].pieces);
        // remove turn highlighting
        id('plr' + (actives[turn] + 1)).classList.remove('active');
        // advance turn
        if (turn < actives.length - 1) turn += 1;
        else turn = 0;
        // adjust piece counts
        actives.forEach((e) => id('plr' + (e + 1)).children[1].textContent = plrs[e].pieces.length);
        // stop game when board is full or only one player w pieces remains
        if (
            board.filter((cell) => cell === 0).length === 0 ||
            plrs.filter((e) => e.pieces.length > 0).length <= 1
        ) {
            // find plr placement and communicate end of game
            const places = actives.map((i) => [i + 1, plrs[i].pieces.length]).sort((
                a,
                b,
            ) => b[1] - a[1]);
            places.forEach((pl, i) => {
                id('plr' + (pl[0])).children[1].textContent = getPlaceStr(i);
            });
            gameOver.style.zIndex = 1;
        } else move();
    }

    function humanMove(options) {
        const plr = plrs[actives[turn]];
        // allow selection of a piece
        options.forEach((o) => {
            // change cursor for selectable pieces
            circles[o.piece].style.cursor = 'pointer';
            circles[o.piece].onclick = () => {
                // allow deselection of a piece
                if (circles[o.piece].classList.contains('selected')) {
                    // remove highlighting
                    circles[o.piece].classList.remove('selected');
                    // re-allow selection
                    humanMove(options);
                    // remove listeners for move and cursor-highlighting
                    [...o.moves.nextTo, ...o.moves.oneOff].forEach((e) => {
                        circles[e].onclick = '';
                        circles[e].style.cursor = 'initial';
                    });
                } else {
                    const helper = (e) => {
                        [...o.moves.nextTo, ...o.moves.oneOff].forEach((e2) => {
                            circles[e2].onclick = '';
                            circles[e2].style.cursor = 'initial';
                        });
                        board[e] = actives[turn] + 1;
                        circles[e].style.fill = plr.color;
                        // check for neigbouring enemy pieces and turn them over
                        getEnemyNeighbors(e).forEach((gained) => {
                            const owner = plrs[board[gained] - 1];
                            // remove piece from current owner and give it to player
                            plr.pieces.push(
                                ...owner.pieces.splice(owner.pieces.indexOf(gained), 1),
                            );
                            // update internal board state
                            board[gained] = actives[turn] + 1;
                            // update display
                            circles[gained].style.fill = plr.color;
                        });
                        endTurn();
                    };
                    // highlight selected piece
                    circles[o.piece].classList.add('selected');
                    // remove eventlisteners and cursor-highlighting from other possible selection targets
                    plr.pieces.forEach((j) => {
                        if (j !== o.piece) {
                            circles[j].onclick = '';
                            circles[j].style.cursor = 'initial';
                        }
                    });
                    // listen for click on possible target
                    o.moves.nextTo.forEach((e) => {
                        circles[e].style.cursor = 'pointer';
                        circles[e].onclick = () => {
                            circles[o.piece].onclick = circles[o.piece].classList = '';
                            circles[o.piece].style.cursor = 'initial';
                            plr.pieces.push(e);
                            helper(e);
                        };
                    });
                    o.moves.oneOff.forEach((e) => {
                        circles[e].style.cursor = 'pointer';
                        circles[e].onclick = () => {
                            clearCell(o.piece);
                            circles[o.piece].style.cursor = 'initial';
                            plr.pieces[plr.pieces.indexOf(o.piece)] = e;
                            helper(e);
                        };
                    });
                }
            };
        });
    }

    async function machineMove(options) {
        const plr = plrs[actives[turn]],
            payoffs = [],
            wait = (ms) => new Promise((r, j) => setTimeout(r, ms));
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
        circles[move.origin].classList.add('selected');
        // wait a bit more and highlight target cell
        await wait(400);
        circles[move.target].style.stroke = 'Yellow';
        // wait even more and make move
        await wait(500);
        [move.target, ...move.bounty].forEach((cell) => {
            // Place piece in chosen cell
            if (board[cell] === 0) plr.pieces.push(cell);
            else {
                const owner = plrs[board[cell] - 1];
                // Flip neighboring enemy pieces
                plr.pieces.push(...owner.pieces.splice(owner.pieces.indexOf(cell), 1));
            }
            // Update board and display
            board[cell] = actives[turn] + 1;
            circles[cell].style.fill = plr.color;
        });
        // wait again and undo highlighting of move
        await wait(200);
        circles[move.origin].classList.remove('selected');
        circles[move.target].style.stroke = 'black';
        // when jumped, remove piece from origin
        if (move.type === 0) {
            clearCell(move.origin);
            plr.pieces.splice(plr.pieces.indexOf(move.origin), 1);
        }
        endTurn();
    }

    function move() {
        // highlight active player
        id('plr' + (actives[turn] + 1)).classList.add('active');
        // log current pieces
        // log('player', actives[turn] + 1, 'has', plrs[actives[turn]].pieces);
        // go thru players' pieces, see if there're moves and bundle em up for later use
        const plr = plrs[actives[turn]],
            options = plr.pieces
                .map((piece) => ({ piece: piece, moves: getMoves(piece) }))
                .filter((option) =>
                    option.moves.nextTo.length > 0 || option.moves.oneOff.length > 0
                );
        if (options.length === 0 || plr.state === 'inactive') endTurn();
        else if (plr.state === 'user') humanMove(options);
        else if (plr.state === 'robot') machineMove(options);
    }

    function setBoard(actives) {
        if (actives.length < 2) return;
        clearBoard();
        actives.forEach((e) => {
            circles[plrs[e].start].style.fill = plrs[e].color;
            plrs[e].pieces.push(plrs[e].start);
            board[plrs[e].start] = e + 1;
            id('plr' + (e + 1)).children[1].textContent = plrs[e].pieces.length;
        });
        turn = 0;
        move();
    }

    function changeRole(plr) {
        const i = plr.id.slice(-1) - 1;
        plr.onclick = () => {
            switch (plrs[i].state) {
                case 'inactive':
                    plr.children[0].classList.remove('fa-robot');
                    plr.children[0].classList.add('fa-robot');
                    plrs[i].state = 'robot';
                    break;
                case 'robot':
                    plr.children[0].classList.remove('fa-robot');
                    plr.children[0].classList.add('fa-user');
                    plrs[i].state = 'user';
                    break;
                case 'user':
                    plr.children[0].classList.remove('fa-robot');
                    plr.children[0].classList.add('fa-inactive');
                    plrs[i].state = 'inactive';
                    break;
            }
        };
    }
}, { once: true });
