if ('wakeLock' in navigator && 'request' in navigator.wakeLock) {
    const getWakeLock = () => navigator.wakeLock.request('screen');
    getWakeLock();

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            getWakeLock();
        }
    });
}