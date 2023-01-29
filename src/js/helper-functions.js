export function CalculatedMove(origin, target, bounty, type) {
    return {
        origin,
        target,
        bounty,
        type
    };
}

export function getPlaceStr(place) {
    switch (place) {
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

export function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function Player(color, controllerType, startPosition, playerId) {
    return {
        color,
        controllerType,
        startPosition,
        playerId,
        /** Will contain ids of boardCells belonging to that player */
        pieces: [],
        roleChangeButton: document.getElementById(`plr${playerId}`)
    };
}

export function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
}