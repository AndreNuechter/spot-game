export const boardLen = 7;
export const cellCount = Math.pow(boardLen, 2);
export const cellSize = 36;
export const cssClasses = {
    activePlayer: 'active',
    clickableCell: 'clickable',
    gameIsRunning: 'game-is-running',
    highlightedTargetCell: 'targeted',
    selectedForMove: 'selected',
    visible: 'visible',
};
export const playerTypeIconIds = {
    human: '#human-player',
    robot: '#ai-player',
    inactive: '#no-player'
};