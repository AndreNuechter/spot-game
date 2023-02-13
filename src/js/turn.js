import {
    idsOfActivePlayers,
    players,
    setPlayerSelectButtonText,
    updateActivePlayers,
    updatePieceCount,
} from './players.js';
import { getPlaceStr } from './helper-functions.js';
import { boardCells, gameOverModal, mainClassList } from './dom-objects.js';
import { cssClasses } from './constants.js';
import { stopAnimation } from './move-animation-handling.js';
import board, { clearCell } from './board.js';
import humanMove, { disableHumanInput } from './human-move.js';
import getPossibleMoves from './get-possible-moves.js';
import robotMove from './robot-move.js';

export let turn = 0;

export function resetTurn() {
    turn = 0;
}

export function incrementTurn() {
    if (turn < idsOfActivePlayers.length - 1) {
        turn += 1;
    } else {
        resetTurn();
    }
}

export function endTurn() {
    players[idsOfActivePlayers[turn] - 1].roleChangeButton.classList.remove(
        cssClasses.activePlayer,
    );
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
                pieceCount: players[playerId - 1].pieces.length,
            }))
            .sort(({ pieceCount: a }, { pieceCount: b }) => b - a)
            .forEach(
                ({ playerId }, i) =>
                    setPlayerSelectButtonText(
                        players[playerId - 1],
                        getPlaceStr(i),
                    ),
            );
        gameOverModal.classList.add(cssClasses.visible);
        mainClassList.remove(cssClasses.gameIsRunning);
    } else {
        incrementTurn();
        takeTurn();
    }
}

export function takeTurn() {
    const player = players[idsOfActivePlayers[turn] - 1];
    /** { pieceId: 0-48, moves: { nextTo: [8; 0-48] oneOff: [16; 0-48] }[] }[] */
    const possibleMoves = player.pieces
        .map((piece) => ({ pieceId: piece, moves: getPossibleMoves(piece) }))
        .filter((option) => option.moves.nextTo.length > 0 || option.moves.oneOff.length > 0);

    // highlight active player
    player.roleChangeButton.classList.add(cssClasses.activePlayer);

    if (possibleMoves.length === 0) {
        endTurn();
    } else if (player.controllerType === 'human') {
        humanMove(possibleMoves);
    } else if (player.controllerType === 'robot') {
        robotMove(possibleMoves);
    }
}

export function endGame() {
    mainClassList.remove(cssClasses.gameIsRunning);
    players.forEach((player) => player.roleChangeButton.classList.remove(cssClasses.activePlayer));
    disableHumanInput();
    stopAnimation();
    clearBoard();
}

export function startGame() {
    updateActivePlayers();

    if (idsOfActivePlayers.length < 2) return;

    resetTurn();
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

function clearBoard() {
    gameOverModal.classList.remove(cssClasses.visible);
    players.forEach((player) => {
        player.pieces.length = 0;
        setPlayerSelectButtonText(player, '');
    });
    boardCells.forEach((_, i) => clearCell(i));
}
