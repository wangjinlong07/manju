export function getApiBase() {
    try {
        if (typeof location !== 'undefined') {
            if (location.protocol === 'file:') {
                return 'http://127.0.0.1:8777';
            }
            // Dynamically detect subdirectory deployment (e.g. /manju/)
            const pathname = location.pathname;
            const parts = pathname.split('/');
            // If we are in a subdirectory like /manju/index.html or /manju/, parts[1] is 'manju'
            if (parts.length > 1 && parts[1] && !parts[1].endsWith('.html') && parts[1] !== 'index.html') {
                return '/' + parts[1];
            }
        }
    } catch (e) {}
    return '';
}

export function buildApiUrl(url) {
    const base = getApiBase();
    const cleanUrl = String(url || '');
    if (!cleanUrl) return base || '';
    if (!cleanUrl.startsWith('/')) {
        return base + '/' + cleanUrl;
    }
    return base + cleanUrl;
}
