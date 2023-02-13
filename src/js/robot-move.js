import { cssClasses, robotMoveDelays } from './constants.js';
import { CalculatedMove, getRandomInt } from './helper-functions.js';
import { idsOfActivePlayers, players } from './players.js';
import { endTurn, turn } from './turn.js';
import getEnemyNeighbors from './get-enemy-neighbors.js';
import { startAnimation } from './move-animation-handling.js';
import { boardCells } from './dom-objects.js';
import board, { clearCell } from './board.js';

export default function robotMove(possibleMoves) {
    const player = players[idsOfActivePlayers[turn] - 1];
    const payoffs = possibleMoves
        .map((possibleMove) => ({
            nextTo: possibleMove.moves.nextTo
                .map((closeNeighbor) =>
                    CalculatedMove(
                        possibleMove.pieceId,
                        closeNeighbor,
                        getEnemyNeighbors(closeNeighbor),
                        1,
                    )
                ),
            oneOff: possibleMove.moves.oneOff
                .map((farNeighbor) =>
                    CalculatedMove(
                        possibleMove.pieceId,
                        farNeighbor,
                        getEnemyNeighbors(farNeighbor),
                        0,
                    )
                ),
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
    const movablePieceChosenAt = performance.now() + robotMoveDelays.highlightStart;
    const targetCellChosenAt = movablePieceChosenAt + robotMoveDelays.highlightEnd;
    const moveMadeAt = targetCellChosenAt + robotMoveDelays.finalize;
    const turnEndedAt = moveMadeAt + robotMoveDelays.finalize;
    // phase 4) finalize the move
    const finalizeMove = partialRobotMove(
        turnEndedAt,
        () => {
            // if the player jumped, rm the original piece
            if (move.type === 0) {
                clearCell(move.origin);
                player.pieces.splice(player.pieces.indexOf(move.origin), 1);
            }
            // rm highlighting
            boardCells[move.origin].classList.remove(cssClasses.selectedForMove);
            boardCells[move.target].classList.remove(cssClasses.highlightedTargetCell);
        },
        endTurn,
    );
    // phase 3) make the move
    const makeMove = partialRobotMove(
        moveMadeAt,
        () => {
            [move.target, ...move.bounty].forEach((cellId) => {
                // Place piece in chosen cell
                if (board[cellId] === 0) {
                    player.pieces.push(cellId);
                } else {
                    const owner = players[board[cellId] - 1];
                    // Flip neighboring enemy pieces
                    player.pieces.push(...owner.pieces.splice(owner.pieces.indexOf(cellId), 1));
                }
                // Update board and display
                board[cellId] = player.playerId;
                boardCells[cellId].dataset.ownerId = player.playerId;
            });
        },
        finalizeMove,
    );
    // phase 2) highlight the target cell
    const highlightSelectedCell = partialRobotMove(
        targetCellChosenAt,
        () => boardCells[move.target].classList.add(cssClasses.highlightedTargetCell),
        makeMove,
    );
    // phase 1) highlight the selected piece
    const highlightSelectedPiece = partialRobotMove(
        movablePieceChosenAt,
        () => boardCells[move.origin].classList.add(cssClasses.selectedForMove),
        highlightSelectedCell,
    );

    startAnimation(highlightSelectedPiece);
}

function partialRobotMove(scheduledTime, action, nextStep) {
    const currentStep = (timestamp) => {
        if (timestamp >= scheduledTime) {
            action();
            startAnimation(nextStep);
        } else {
            startAnimation(currentStep);
        }
    };

    return currentStep;
}
