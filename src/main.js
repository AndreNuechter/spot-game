import './js/service-worker-init.js';
import './js/wakelock.js';
import { cssClasses, playerRoleTransitions } from './js/constants.js';
import { mainClassList, startBtn } from './js/dom-objects.js';
import { players, setPlayerRole } from './js/players.js';
import { endGame, startGame } from './js/turn.js';

players.forEach(
    (player) =>
        player.roleChangeButton.addEventListener('click', () => {
            if (mainClassList.contains(cssClasses.gameIsRunning)) {
                endGame();
            }

            setPlayerRole(player, playerRoleTransitions[player.controllerType]);
        }),
);
startBtn.addEventListener('click', () => {
    if (mainClassList.contains(cssClasses.gameIsRunning)) {
        endGame();
    }

    startGame();
});
