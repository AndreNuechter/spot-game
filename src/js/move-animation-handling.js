let animationRequestId;

export function stopAnimation() {
    cancelAnimationFrame(animationRequestId);
}

export function startAnimation(action) {
    animationRequestId = requestAnimationFrame(action);
}
