import { Player } from './helper-functions.js';
import { documentStyles } from './dom-objects.js';
import { boardLen, cellCount, playerTypeIconIds } from './constants.js';

export const players = [
    Player(
        documentStyles.getPropertyValue('--player-1-color'),
        'human',
        0,
        1,
    ),
    Player(
        documentStyles.getPropertyValue('--player-2-color'),
        'inactive',
        boardLen - 1,
        2,
    ),
    Player(
        documentStyles.getPropertyValue('--player-3-color'),
        'inactive',
        cellCount - boardLen,
        3,
    ),
    Player(
        documentStyles.getPropertyValue('--player-4-color'),
        'robot',
        cellCount - 1,
        4,
    ),
];
/** List of 1-based ids of playing players */
export let idsOfActivePlayers = [];
export function updateActivePlayers() {
    idsOfActivePlayers = players.reduce((ids, player) => {
        if (player.controllerType !== 'inactive') {
            ids.push(player.playerId);
        }
        return ids;
    }, []);
}
export function updatePieceCount(player) {
    setPlayerSelectButtonText(player, player.pieces.length);
}
export function setPlayerSelectButtonText(player, text) {
    player.roleChangeButton.children[1].textContent = text;
}
export function setPlayerRole(player, newRole) {
    player.controllerType = newRole;
    player.roleChangeButton.children[0].firstElementChild.setAttribute(
        'href',
        playerTypeIconIds[newRole],
    );
}
