// ============ CONFIG ============
const engines = {
    google: { name: 'Google', url: 'https://www.google.com/search?q=', icon: 'assets/search-engines/google.svg' },
    baidu: { name: '百度', url: 'https://www.baidu.com/s?wd=', icon: 'assets/brand-icons/baidu.svg' },
    bing: { name: 'Bing', url: 'https://www.bing.com/search?q=', icon: 'assets/search-engines/bing.svg' },
    github: { name: 'GitHub', url: 'https://github.com/search?q=', icon: 'assets/brand-icons/github.svg' }
};

const defaultBg = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const BACKGROUND_FORMAT_VERSION = 2;
const BRAND_ICON_DIR = 'assets/brand-icons';
const SVG_NS = 'http://www.w3.org/2000/svg';
const FAVICON_REQUEST_SIZE = 128;
const FAVICON_CACHE_MAX_AGE = 5 * 60 * 1000;
const PRIVATE_BOOKMARKS_FOLDER_NAME = '稍后整理';
const PRIVATE_BOOKMARKS_LEGACY_FOLDER_NAMES = new Set(['私密收藏']);
const PRIVATE_BOOKMARKS_FOLDER_ID_KEY = 'privateBookmarksFolderId';
const PRIVATE_BOOKMARK_ORIGINS_KEY = 'privateBookmarkOrigins';
const OTHER_BOOKMARKS_ROOT_ID = '2';
const SEARCH_HISTORY_STORAGE_KEY = 'searchHistory';
const SEARCH_HISTORY_LIMIT = 20;
const SEARCH_HISTORY_DISPLAY_LIMIT = 8;

let currentEngine = 'google';
let desktopTags = [];
let contextTagUrl = null;
let showSeconds = false;
let clockTimerId = null;
let currentBgObjectUrl = null;
let currentPage = 0;
let currentPageSize = getPageSize();
let dragSrcEl = null;
let isInitialRender = true;
let lastFocusedElement = null;
let contextMenuTrigger = null;
let bookmarkMenuTrigger = null;
let bookmarkMenuNode = null;
let bookmarkMenuIsPrivate = false;
let privateBookmarksFolderId = null;
let privateBookmarkOrigins = {};
let privateBookmarkDescendantIds = new Set();
let privateBookmarksRevealed = false;
let privateBookmarksHeader = null;
let privateBookmarksContent = null;
let bookmarkLoadRequestId = 0;
let bookmarkNoticeTimer = null;
let searchHistory = [];
const pendingFaviconRefreshes = new Map();
const bookmarkIconMetadata = new WeakMap();
let bookmarkIconObserver = null;

// ============ DOM ELEMENTS ============
const $ = id => document.getElementById(id);
const clock = $('clock');
const dateEl = $('date');
const engineBtn = $('engineBtn');
const engineIcon = $('engineIcon');
const engineDropdown = $('engineDropdown');
const searchInput = $('searchInput');
const searchBtn = $('searchBtn');
const searchContainer = searchInput.closest('.search-container');
const searchHistoryDropdown = $('searchHistoryDropdown');
const searchHistoryList = $('searchHistoryList');
const clearSearchHistoryBtn = $('clearSearchHistoryBtn');
const searchHistoryStatus = $('searchHistoryStatus');
const bgUpload = $('bgUpload');
const resetBgBtn = $('resetBgBtn');
const bookmarksBtn = $('bookmarksBtn');
const sidebar = $('bookmarksSidebar');
const sidebarOverlay = $('sidebarOverlay');
const closeSidebarBtn = $('closeSidebarBtn');
const bookmarkList = $('bookmarkList');
const bookmarkSearchInput = $('bookmarkSearchInput');
const bookmarkNotice = $('bookmarkNotice');
const tagsGrid = $('tagsGrid');
const contextMenu = $('contextMenu');
const bookmarkContextMenu = $('bookmarkContextMenu');
const movePrivateBookmarkBtn = $('movePrivateBookmarkBtn');
const movePrivateBookmarkLabel = $('movePrivateBookmarkLabel');
const deleteTagBtn = $('deleteTagBtn');
const changeIconBtn = $('changeIconBtn');
const iconPickerModal = $('iconPickerModal');
const iconPickerOverlay = $('iconPickerOverlay');
const closeIconPicker = $('closeIconPicker');
const iconSearchInput = $('iconSearchInput');
const iconGrid = $('iconGrid');
const customIconSection = $('customIconSection');
const customIconUrl = $('customIconUrl');
const customIconError = $('customIconError');
const applyCustomIcon = $('applyCustomIcon');
const prevPageBtn = $('prevPageBtn');
const nextPageBtn = $('nextPageBtn');

// ============ CLOCK ============
function updateClock() {
    const now = new Date();
    if (showSeconds) {
        clock.textContent = now.toTimeString().slice(0, 8);
    } else {
        clock.textContent = now.toTimeString().slice(0, 5);
    }
    dateEl.textContent = now.toLocaleDateString('zh-CN', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });
}

function scheduleClock() {
    clearTimeout(clockTimerId);
    updateClock();

    const now = new Date();
    const interval = showSeconds ? 1000 : 60000;
    const elapsed = showSeconds
        ? now.getMilliseconds()
        : now.getSeconds() * 1000 + now.getMilliseconds();
    clockTimerId = setTimeout(scheduleClock, Math.max(100, interval - elapsed));
}

scheduleClock();

// ============ SEARCH ENGINE ============
function setEngine(key, { restoreFocus = false } = {}) {
    if (!engines[key]) key = 'google';
    currentEngine = key;
    engineIcon.src = engines[key].icon;
    engineIcon.alt = '';
    engineBtn.dataset.engine = key;
    engineBtn.setAttribute('aria-label', `选择搜索引擎，当前为${engines[key].name}`);
    document.querySelectorAll('.engine-option').forEach(option => {
        option.setAttribute('aria-checked', String(option.dataset.engine === key));
    });
    localStorage.setItem('engine', key);
    closeEngineDropdown({ restoreFocus });
}

function openEngineDropdown() {
    closeSearchHistory();
    engineDropdown.classList.add('show');
    engineDropdown.setAttribute('aria-hidden', 'false');
    engineBtn.setAttribute('aria-expanded', 'true');
}

function closeEngineDropdown({ restoreFocus = false } = {}) {
    if (restoreFocus) engineBtn.focus();
    engineDropdown.classList.remove('show');
    engineDropdown.setAttribute('aria-hidden', 'true');
    engineBtn.setAttribute('aria-expanded', 'false');
}

engineBtn.onclick = e => {
    e.stopPropagation();
    if (engineDropdown.classList.contains('show')) {
        closeEngineDropdown();
    } else {
        openEngineDropdown();
    }
};

engineBtn.onkeydown = e => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openEngineDropdown();
        const options = Array.from(document.querySelectorAll('.engine-option'));
        const selectedIndex = options.findIndex(option => option.dataset.engine === currentEngine);
        options[Math.max(0, selectedIndex)].focus();
    }
};

document.querySelectorAll('.engine-option').forEach(btn => {
    btn.onclick = () => {
        setEngine(btn.dataset.engine, { restoreFocus: true });
    };
    btn.onkeydown = e => {
        const options = Array.from(document.querySelectorAll('.engine-option'));
        const index = options.indexOf(btn);
        let nextIndex = index;
        if (e.key === 'ArrowDown') nextIndex = (index + 1) % options.length;
        if (e.key === 'ArrowUp') nextIndex = (index - 1 + options.length) % options.length;
        if (e.key === 'Home') nextIndex = 0;
        if (e.key === 'End') nextIndex = options.length - 1;
        if (nextIndex !== index) {
            e.preventDefault();
            options[nextIndex].focus();
        }
    };
});

document.addEventListener('click', event => {
    closeEngineDropdown();
    if (!event.target.closest('.search-container')) closeSearchHistory();
});

setEngine(localStorage.getItem('engine') || 'google');

// ============ SEARCH ============
function normalizeSearchHistory(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const normalized = [];
    value.forEach(item => {
        if (typeof item !== 'string') return;
        const query = item.trim();
        const key = query.toLocaleLowerCase();
        if (!query || seen.has(key)) return;
        seen.add(key);
        normalized.push(query);
    });
    return normalized.slice(0, SEARCH_HISTORY_LIMIT);
}

function readFallbackSearchHistory() {
    try {
        return normalizeSearchHistory(JSON.parse(localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY) || '[]'));
    } catch {
        return [];
    }
}

async function readSearchHistory() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await callChromeApi(chrome.storage.local, 'get', [SEARCH_HISTORY_STORAGE_KEY]);
        return normalizeSearchHistory(result?.[SEARCH_HISTORY_STORAGE_KEY]);
    }
    return readFallbackSearchHistory();
}

async function persistSearchHistory() {
    const value = normalizeSearchHistory(searchHistory);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await callChromeApi(chrome.storage.local, 'set', { [SEARCH_HISTORY_STORAGE_KEY]: value });
    } else {
        localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(value));
    }
    searchHistory = value;
}

function announceSearchHistory(message) {
    if (!searchHistoryStatus) return;
    searchHistoryStatus.textContent = '';
    requestAnimationFrame(() => {
        searchHistoryStatus.textContent = message;
    });
}

function getVisibleSearchHistory() {
    const filter = searchInput.value.trim().toLocaleLowerCase();
    return searchHistory
        .filter(query => !filter || query.toLocaleLowerCase().includes(filter))
        .slice(0, SEARCH_HISTORY_DISPLAY_LIMIT);
}

function openSearchHistory() {
    const visibleHistory = getVisibleSearchHistory();
    if (!visibleHistory.length) {
        closeSearchHistory();
        return;
    }
    closeEngineDropdown();
    searchHistoryDropdown.classList.add('show');
    searchHistoryDropdown.setAttribute('aria-hidden', 'false');
    searchInput.setAttribute('aria-expanded', 'true');
}

function closeSearchHistory({ restoreFocus = false } = {}) {
    searchHistoryDropdown.classList.remove('show');
    searchHistoryDropdown.setAttribute('aria-hidden', 'true');
    searchInput.setAttribute('aria-expanded', 'false');
    if (restoreFocus) searchInput.focus();
}

function renderSearchHistory() {
    searchHistoryList.replaceChildren();
    const visibleHistory = getVisibleSearchHistory();
    visibleHistory.forEach(query => {
        const item = document.createElement('div');
        item.className = 'search-history-item';
        item.setAttribute('role', 'listitem');

        const queryButton = document.createElement('button');
        queryButton.type = 'button';
        queryButton.className = 'search-history-query';
        queryButton.dataset.query = query;
        queryButton.setAttribute('aria-label', `搜索：${query}`);
        queryButton.appendChild(createSvg([
            'M3 12a9 9 0 1 0 3-6.7L3 8',
            'M3 3v5h5',
            'M12 7v5l3 2'
        ]));
        const label = document.createElement('span');
        label.textContent = query;
        queryButton.appendChild(label);
        queryButton.addEventListener('click', event => {
            event.stopPropagation();
            searchInput.value = query;
            void doSearch();
        });

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'delete-search-history-btn';
        deleteButton.setAttribute('aria-label', `删除搜索记录：${query}`);
        deleteButton.appendChild(createSvg(['M18 6 6 18', 'm6 6 12 12']));
        deleteButton.addEventListener('click', event => {
            event.stopPropagation();
            void deleteSearchHistoryItem(query);
        });

        item.appendChild(queryButton);
        item.appendChild(deleteButton);
        searchHistoryList.appendChild(item);
    });

    clearSearchHistoryBtn.hidden = searchHistory.length === 0;
    if (document.activeElement === searchInput) openSearchHistory();
    else if (!visibleHistory.length) closeSearchHistory();
}

async function updateSearchHistory(nextHistory, successMessage, { render = true } = {}) {
    const previousHistory = searchHistory;
    searchHistory = normalizeSearchHistory(nextHistory);
    if (render) renderSearchHistory();
    try {
        await persistSearchHistory();
        if (successMessage) announceSearchHistory(successMessage);
        return true;
    } catch {
        searchHistory = previousHistory;
        if (render) renderSearchHistory();
        announceSearchHistory('搜索记录更新失败');
        return false;
    }
}

async function addSearchHistoryItem(query) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;
    const key = normalizedQuery.toLocaleLowerCase();
    const nextHistory = [
        normalizedQuery,
        ...searchHistory.filter(item => item.toLocaleLowerCase() !== key)
    ];
    await updateSearchHistory(nextHistory, null, { render: false });
}

async function deleteSearchHistoryItem(query) {
    const key = query.toLocaleLowerCase();
    const deletedIndex = getVisibleSearchHistory().findIndex(item => item.toLocaleLowerCase() === key);
    const updated = await updateSearchHistory(
        searchHistory.filter(item => item.toLocaleLowerCase() !== key),
        `已删除搜索记录：${query}`
    );
    if (!updated) return;

    const deleteButtons = Array.from(searchHistoryList.querySelectorAll('.delete-search-history-btn'));
    if (deleteButtons.length) deleteButtons[Math.min(Math.max(0, deletedIndex), deleteButtons.length - 1)].focus();
    else closeSearchHistory({ restoreFocus: true });
}

async function clearSearchHistory() {
    const updated = await updateSearchHistory([], '搜索记录已清空');
    if (updated) closeSearchHistory({ restoreFocus: true });
}

async function doSearch() {
    const query = searchInput.value.trim();
    if (!query) return;
    closeSearchHistory();
    try {
        await addSearchHistoryItem(query);
    } catch {
        // 历史记录属于增强功能，保存失败时仍需继续搜索。
    }
    location.href = engines[currentEngine].url + encodeURIComponent(query);
}

searchBtn.onclick = () => void doSearch();
clearSearchHistoryBtn.onclick = event => {
    event.stopPropagation();
    void clearSearchHistory();
};

searchInput.addEventListener('focus', renderSearchHistory);
searchInput.addEventListener('input', renderSearchHistory);
searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        void doSearch();
        return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    renderSearchHistory();
    const queryButtons = Array.from(searchHistoryList.querySelectorAll('.search-history-query'));
    if (!queryButtons.length) return;
    event.preventDefault();
    (event.key === 'ArrowDown' ? queryButtons[0] : queryButtons[queryButtons.length - 1]).focus();
});

searchHistoryDropdown.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        event.preventDefault();
        closeSearchHistory({ restoreFocus: true });
        return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const queryButtons = Array.from(searchHistoryList.querySelectorAll('.search-history-query'));
    if (!queryButtons.length) return;
    const activeItem = document.activeElement.closest?.('.search-history-item');
    const currentQueryButton = activeItem?.querySelector('.search-history-query');
    let index = Math.max(0, queryButtons.indexOf(currentQueryButton));
    if (event.key === 'ArrowDown') index = (index + 1) % queryButtons.length;
    if (event.key === 'ArrowUp') index = (index - 1 + queryButtons.length) % queryButtons.length;
    if (event.key === 'Home') index = 0;
    if (event.key === 'End') index = queryButtons.length - 1;
    event.preventDefault();
    queryButtons[index].focus();
});

searchContainer.addEventListener('focusout', () => {
    requestAnimationFrame(() => {
        if (!searchContainer.contains(document.activeElement)) closeSearchHistory();
    });
});

readSearchHistory()
    .then(history => {
        searchHistory = history;
        if (document.activeElement === searchInput) renderSearchHistory();
    })
    .catch(() => {
        searchHistory = [];
    });

// ============ BACKGROUND ============
const DB_NAME = 'YZBNewTabDB';
const DB_VERSION = 2;
const BACKGROUND_STORE_NAME = 'backgrounds';
const ICON_CACHE_STORE_NAME = 'iconCache';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('IndexedDB 升级被其他新标签页阻塞'));
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(BACKGROUND_STORE_NAME)) {
                db.createObjectStore(BACKGROUND_STORE_NAME);
            }
            if (!db.objectStoreNames.contains(ICON_CACHE_STORE_NAME)) {
                db.createObjectStore(ICON_CACHE_STORE_NAME);
            }
        };
    });
}

function saveBackgroundToDB(file, formatVersion = BACKGROUND_FORMAT_VERSION) {
    return initDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(BACKGROUND_STORE_NAME, 'readwrite');
        const store = tx.objectStore(BACKGROUND_STORE_NAME);
        store.put(file, 'customBg');
        store.put(formatVersion, 'backgroundFormatVersion');
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
        tx.onabort = () => {
            db.close();
            reject(tx.error);
        };
    }));
}

function getBackgroundStateFromDB() {
    return initDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(BACKGROUND_STORE_NAME, 'readonly');
        const store = tx.objectStore(BACKGROUND_STORE_NAME);
        const backgroundRequest = store.get('customBg');
        const versionRequest = store.get('backgroundFormatVersion');

        tx.oncomplete = () => {
            db.close();
            resolve({
                blob: backgroundRequest.result,
                formatVersion: versionRequest.result || 1
            });
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
        tx.onabort = () => {
            db.close();
            reject(tx.error);
        };
    }));
}

function deleteBackgroundFromDB() {
    return initDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(BACKGROUND_STORE_NAME, 'readwrite');
        const store = tx.objectStore(BACKGROUND_STORE_NAME);
        store.delete('customBg');
        store.delete('backgroundFormatVersion');
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
        tx.onabort = () => {
            db.close();
            reject(tx.error);
        };
    }));
}

function setBg(value) {
    if (currentBgObjectUrl) {
        URL.revokeObjectURL(currentBgObjectUrl);
        currentBgObjectUrl = null;
    }

    if (value instanceof Blob) {
        currentBgObjectUrl = URL.createObjectURL(value);
        document.body.style.background = `url('${currentBgObjectUrl}') center/cover no-repeat`;
    } else if (value.startsWith('http') || value.startsWith('data:')) {
        document.body.style.background = `url('${value}') center/cover no-repeat`;
    } else {
        document.body.style.background = value;
    }
}

function scheduleIdleTask(task) {
    if ('requestIdleCallback' in window) {
        requestIdleCallback(task, { timeout: 2500 });
    } else {
        setTimeout(task, 500);
    }
}

async function loadBg() {
    try {
        const { blob, formatVersion } = await getBackgroundStateFromDB();
        if (blob) {
            setBg(blob);
            if (formatVersion < BACKGROUND_FORMAT_VERSION) {
                scheduleIdleTask(async () => {
                    try {
                        const optimized = await compressImage(blob);
                        await saveBackgroundToDB(optimized);
                    } catch (error) {
                        console.warn('旧背景迁移失败，将继续使用原图。', error);
                    }
                });
            }
            return;
        }

        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.get(['customBg'], result => {
                if (!result.customBg) return;
                setBg(result.customBg);
                scheduleIdleTask(async () => {
                    try {
                        const response = await fetch(result.customBg);
                        const optimized = await compressImage(await response.blob());
                        await saveBackgroundToDB(optimized);
                        chrome.storage.local.remove('customBg');
                    } catch (error) {
                        console.warn('旧版背景迁移失败，将继续使用原图。', error);
                    }
                });
            });
        }
    } catch (error) {
        console.warn('背景读取失败，将使用默认背景。', error);
    }
}

function getBackgroundMaxDimension() {
    const viewportPixels = Math.ceil(Math.max(window.innerWidth, window.innerHeight) * (window.devicePixelRatio || 1));
    return Math.min(3840, Math.max(1920, viewportPixels));
}

function loadImageElement(blob) {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('无法解码背景图片'));
        };
        image.src = objectUrl;
    });
}

async function compressImage(file) {
    const source = 'createImageBitmap' in window
        ? await createImageBitmap(file)
        : await loadImageElement(file);
    const sourceWidth = source.width || source.naturalWidth;
    const sourceHeight = source.height || source.naturalHeight;
    const maxDimension = getBackgroundMaxDimension();
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    context.drawImage(source, 0, 0, width, height);
    source.close?.();

    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('背景图片压缩失败'));
        }, 'image/webp', 0.85);
    });
}

bgUpload.onchange = async e => {
    const file = e.target.files[0];
    if (file) {
        setBg(file);

        try {
            const compressedBlob = await compressImage(file);
            await saveBackgroundToDB(compressedBlob);
            if (typeof chrome !== 'undefined') chrome.storage?.local.remove('customBg');
        } catch (err) {
            console.warn('背景图片处理失败，将保存原图。', err);
            saveBackgroundToDB(file, 1).catch(console.error);
        }
    }
};

resetBgBtn.onclick = () => {
    setBg(defaultBg);
    deleteBackgroundFromDB().catch(console.error);
    if (typeof chrome !== 'undefined') chrome.storage?.local.remove('customBg');
};

loadBg();

// ============ SIDEBAR ============
function openSidebar() {
    lastFocusedElement = document.activeElement;
    resetPrivateBookmarksDisclosure();
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('show');
    sidebar.inert = false;
    sidebar.setAttribute('aria-hidden', 'false');
    bookmarksBtn.setAttribute('aria-expanded', 'true');
    loadBookmarks();
    requestAnimationFrame(() => bookmarkSearchInput?.focus());
}

function closeSidebar({ restoreFocus = true } = {}) {
    hideBookmarkContextMenu();
    resetPrivateBookmarksDisclosure();
    bookmarkLoadRequestId++;
    if (restoreFocus) (lastFocusedElement || bookmarksBtn).focus?.();
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('show');
    sidebar.inert = true;
    sidebar.setAttribute('aria-hidden', 'true');
    bookmarksBtn.setAttribute('aria-expanded', 'false');
}

bookmarksBtn.onclick = openSidebar;
closeSidebarBtn.onclick = closeSidebar;
sidebarOverlay.onclick = closeSidebar;

let bookmarkSearchTimer = null;
bookmarkSearchInput?.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    clearTimeout(bookmarkSearchTimer);
    bookmarkSearchTimer = setTimeout(() => {
        if (query) searchBookmarks(query);
        else loadBookmarks({ preserveSearch: true });
    }, 120);
});

function createSvg(paths, viewBox = '0 0 24 24') {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    paths.forEach(d => {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
    });
    return svg;
}

function createPlaceholder(message) {
    const placeholder = document.createElement('p');
    placeholder.className = 'placeholder-text';
    placeholder.textContent = message;
    return placeholder;
}

function getSafeBookmarkUrl(value) {
    try {
        const url = new URL(value);
        const allowedProtocols = new Set(['http:', 'https:', 'file:', 'chrome:', 'edge:', 'about:']);
        return allowedProtocols.has(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
}

function createBookmarkIcon(siteUrl, title, size = 32) {
    const image = document.createElement('img');
    image.alt = '';
    image.decoding = 'async';
    image.width = size;
    image.height = size;
    image.src = generateFallbackIcon(title);

    if ('IntersectionObserver' in window) {
        if (!bookmarkIconObserver) {
            bookmarkIconObserver = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const metadata = bookmarkIconMetadata.get(entry.target);
                    bookmarkIconObserver.unobserve(entry.target);
                    bookmarkIconMetadata.delete(entry.target);
                    if (metadata) loadSiteIcon(entry.target, null, metadata.siteUrl, metadata.title);
                });
            }, { root: sidebar, rootMargin: '80px' });
        }
        bookmarkIconMetadata.set(image, { siteUrl, title });
        bookmarkIconObserver.observe(image);
    } else {
        loadSiteIcon(image, null, siteUrl, title);
    }
    return image;
}

function createAddedBadge() {
    const badge = document.createElement('span');
    badge.className = 'added-badge';
    badge.textContent = '✓ 已添加';
    return badge;
}

function getChromeLastError() {
    try {
        return chrome.runtime?.lastError || null;
    } catch {
        return null;
    }
}

function callChromeApi(target, method, ...args) {
    return new Promise((resolve, reject) => {
        try {
            target[method](...args, result => {
                const error = getChromeLastError();
                if (error) reject(new Error(error.message || 'Chrome API 调用失败'));
                else resolve(result);
            });
        } catch (error) {
            reject(error);
        }
    });
}

function bookmarkApi(method, ...args) {
    return callChromeApi(chrome.bookmarks, method, ...args);
}

function localStorageGet(keys) {
    return callChromeApi(chrome.storage.local, 'get', keys);
}

function localStorageSet(items) {
    return callChromeApi(chrome.storage.local, 'set', items);
}

function showBookmarkNotice(message, type = 'success') {
    if (!bookmarkNotice) return;
    clearTimeout(bookmarkNoticeTimer);
    bookmarkNotice.textContent = message;
    bookmarkNotice.dataset.type = type;
    bookmarkNotice.classList.add('show');
    bookmarkNoticeTimer = setTimeout(() => {
        bookmarkNotice.classList.remove('show');
    }, 2800);
}

async function loadPrivateBookmarkState() {
    const stored = await localStorageGet([
        PRIVATE_BOOKMARKS_FOLDER_ID_KEY,
        PRIVATE_BOOKMARK_ORIGINS_KEY
    ]);
    privateBookmarksFolderId = typeof stored[PRIVATE_BOOKMARKS_FOLDER_ID_KEY] === 'string'
        ? stored[PRIVATE_BOOKMARKS_FOLDER_ID_KEY]
        : null;
    const origins = stored[PRIVATE_BOOKMARK_ORIGINS_KEY];
    privateBookmarkOrigins = origins && typeof origins === 'object' && !Array.isArray(origins)
        ? origins
        : {};
}

async function getFolderById(id) {
    if (!id) return null;
    try {
        const nodes = await bookmarkApi('get', id);
        const node = nodes?.[0];
        return node && !node.url ? node : null;
    } catch {
        return null;
    }
}

function findOtherBookmarksRoot(tree) {
    const roots = tree?.[0]?.children || [];
    return roots.find(node => node.id === OTHER_BOOKMARKS_ROOT_ID && !node.url)
        || roots.find(node => /^(其他书签|其他收藏夹|other bookmarks)$/i.test(node.title || '') && !node.url)
        || roots.find((node, index) => index === 1 && !node.url)
        || null;
}

async function resolvePrivateBookmarksFolder({ create = false } = {}) {
    await loadPrivateBookmarkState();
    const tree = await bookmarkApi('getTree');
    const otherRoot = findOtherBookmarksRoot(tree);
    if (!otherRoot) throw new Error('无法定位“其他书签”目录');

    let savedFolder = await getFolderById(privateBookmarksFolderId);
    if (savedFolder) {
        if (PRIVATE_BOOKMARKS_LEGACY_FOLDER_NAMES.has(savedFolder.title)) {
            savedFolder = await bookmarkApi('update', savedFolder.id, { title: PRIVATE_BOOKMARKS_FOLDER_NAME });
        }
        return { folder: savedFolder, otherRoot };
    }

    if (privateBookmarksFolderId) {
        privateBookmarksFolderId = null;
        await localStorageSet({ [PRIVATE_BOOKMARKS_FOLDER_ID_KEY]: null });
    }

    const children = await bookmarkApi('getChildren', otherRoot.id);
    const matches = (children || []).filter(node =>
        !node.url
        && (node.title === PRIVATE_BOOKMARKS_FOLDER_NAME || PRIVATE_BOOKMARKS_LEGACY_FOLDER_NAMES.has(node.title))
    );
    let folder = matches.length === 1 ? matches[0] : null;

    if (folder && PRIVATE_BOOKMARKS_LEGACY_FOLDER_NAMES.has(folder.title)) {
        folder = await bookmarkApi('update', folder.id, { title: PRIVATE_BOOKMARKS_FOLDER_NAME });
    }

    if (!folder && create) {
        folder = await bookmarkApi('create', {
            parentId: otherRoot.id,
            title: PRIVATE_BOOKMARKS_FOLDER_NAME
        });
    }

    if (folder) {
        privateBookmarksFolderId = folder.id;
        await localStorageSet({ [PRIVATE_BOOKMARKS_FOLDER_ID_KEY]: folder.id });
    }

    return { folder, otherRoot };
}

function collectBookmarkIds(node, ids = new Set()) {
    if (!node) return ids;
    if (node.id) ids.add(node.id);
    node.children?.forEach(child => collectBookmarkIds(child, ids));
    return ids;
}

async function preparePrivateBookmarksContext(options = {}) {
    const context = await resolvePrivateBookmarksFolder(options);
    if (context.folder) {
        const subtree = await bookmarkApi('getSubTree', context.folder.id);
        privateBookmarkDescendantIds = collectBookmarkIds(subtree?.[0]);
    } else {
        privateBookmarkDescendantIds = new Set();
    }

    const validOrigins = Object.fromEntries(
        Object.entries(privateBookmarkOrigins).filter(([bookmarkId]) => privateBookmarkDescendantIds.has(bookmarkId))
    );
    if (Object.keys(validOrigins).length !== Object.keys(privateBookmarkOrigins).length) {
        privateBookmarkOrigins = validOrigins;
        await localStorageSet({ [PRIVATE_BOOKMARK_ORIGINS_KEY]: privateBookmarkOrigins });
    }

    return context;
}

function resetPrivateBookmarksDisclosure() {
    privateBookmarksRevealed = false;
    if (privateBookmarksContent) {
        releaseCachedIconUrls(privateBookmarksContent);
        privateBookmarksContent.replaceChildren();
        privateBookmarksContent.hidden = true;
    }
    if (privateBookmarksHeader) {
        privateBookmarksHeader.setAttribute('aria-expanded', 'false');
    }
    privateBookmarksHeader = null;
    privateBookmarksContent = null;
}

async function setPrivateBookmarksExpanded(folder, expanded) {
    if (!privateBookmarksHeader || !privateBookmarksContent) return;
    privateBookmarksRevealed = expanded;
    privateBookmarksHeader.setAttribute('aria-expanded', String(expanded));
    privateBookmarksHeader.querySelector('.private-bookmarks-chevron')?.classList.toggle('expanded', expanded);

    releaseCachedIconUrls(privateBookmarksContent);
    privateBookmarksContent.replaceChildren();
    privateBookmarksContent.hidden = !expanded;
    if (!expanded) return;

    if (!folder) {
        privateBookmarksContent.appendChild(createPlaceholder('这里还没有书签'));
        return;
    }

    const content = privateBookmarksContent;
    content.appendChild(createPlaceholder('正在读取…'));
    try {
        const subtree = await bookmarkApi('getSubTree', folder.id);
        if (!privateBookmarksRevealed || content !== privateBookmarksContent || !sidebar.classList.contains('open')) return;
        content.replaceChildren();
        const children = subtree?.[0]?.children || [];
        children.forEach(child => renderNode(child, content, { isPrivate: true }));
        if (!content.children.length) content.appendChild(createPlaceholder('这里还没有书签'));
    } catch {
        if (content === privateBookmarksContent) {
            content.replaceChildren(createPlaceholder('无法读取此文件夹'));
            showBookmarkNotice('读取“稍后整理”失败，请稍后重试', 'error');
        }
    }
}

function createPrivateBookmarksSection(folder) {
    const section = document.createElement('section');
    section.className = 'private-bookmarks-section';

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'folder-header private-bookmarks-header';
    header.setAttribute('aria-expanded', 'false');
    header.setAttribute('aria-controls', 'privateBookmarksContent');

    const chevron = createSvg(['m9 18 6-6-6-6']);
    chevron.classList.add('private-bookmarks-chevron');
    header.appendChild(chevron);
    header.appendChild(createSvg(['M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z']));

    const label = document.createElement('span');
    label.className = 'private-bookmarks-label';
    label.textContent = PRIVATE_BOOKMARKS_FOLDER_NAME;
    header.appendChild(label);

    const content = document.createElement('div');
    content.id = 'privateBookmarksContent';
    content.className = 'folder-content private-bookmarks-content';
    content.hidden = true;

    privateBookmarksHeader = header;
    privateBookmarksContent = content;
    header.addEventListener('click', () => setPrivateBookmarksExpanded(folder, content.hidden));

    section.appendChild(header);
    section.appendChild(content);
    return section;
}

function showBookmarkContextMenu(x, y, node, isPrivate, trigger) {
    hideContextMenu();
    bookmarkMenuNode = { ...node };
    bookmarkMenuIsPrivate = isPrivate;
    bookmarkMenuTrigger = trigger;
    movePrivateBookmarkLabel.textContent = isPrivate ? '移出稍后整理' : '移入稍后整理';
    bookmarkContextMenu.dataset.private = String(isPrivate);
    bookmarkContextMenu.classList.add('show');
    bookmarkContextMenu.setAttribute('aria-hidden', 'false');
    const rect = bookmarkContextMenu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 8);
    const top = Math.min(y, window.innerHeight - rect.height - 8);
    bookmarkContextMenu.style.left = `${Math.max(8, left)}px`;
    bookmarkContextMenu.style.top = `${Math.max(8, top)}px`;
    movePrivateBookmarkBtn.focus();
}

function hideBookmarkContextMenu({ restoreFocus = false } = {}) {
    if (!bookmarkContextMenu) return;
    const trigger = bookmarkMenuTrigger;
    bookmarkContextMenu.classList.remove('show');
    bookmarkContextMenu.setAttribute('aria-hidden', 'true');
    bookmarkMenuNode = null;
    bookmarkMenuIsPrivate = false;
    bookmarkMenuTrigger = null;
    if (restoreFocus) trigger?.focus();
}

async function refreshBookmarksAfterMutation({ revealPrivate = false } = {}) {
    privateBookmarksRevealed = revealPrivate;
    const query = bookmarkSearchInput?.value.trim().toLowerCase();
    if (query) await searchBookmarks(query);
    else await loadBookmarks({ preserveSearch: true, revealPrivate });
}

async function moveBookmarkToPrivate(node) {
    const { folder } = await preparePrivateBookmarksContext({ create: true });
    if (!folder) throw new Error('无法创建稍后整理目录');

    const previousOrigins = { ...privateBookmarkOrigins };
    privateBookmarkOrigins[node.id] = {
        parentId: node.parentId,
        index: Number.isInteger(node.index) ? node.index : 0
    };
    await localStorageSet({ [PRIVATE_BOOKMARK_ORIGINS_KEY]: privateBookmarkOrigins });

    try {
        await bookmarkApi('move', node.id, { parentId: folder.id });
    } catch (error) {
        privateBookmarkOrigins = previousOrigins;
        await localStorageSet({ [PRIVATE_BOOKMARK_ORIGINS_KEY]: privateBookmarkOrigins }).catch(() => {});
        throw error;
    }

    showBookmarkNotice('已移入“稍后整理”');
    try {
        await refreshBookmarksAfterMutation();
    } catch {
        showBookmarkNotice('已移入“稍后整理”，请重新打开收藏夹刷新', 'error');
    }
}

async function restorePrivateBookmark(node) {
    const { otherRoot } = await preparePrivateBookmarksContext();
    const origin = privateBookmarkOrigins[node.id];
    const originalParent = await getFolderById(origin?.parentId);
    const fallbackUsed = !originalParent;
    const destination = {
        parentId: originalParent?.id || otherRoot.id
    };
    if (originalParent && Number.isInteger(origin?.index)) destination.index = origin.index;

    await bookmarkApi('move', node.id, destination);
    delete privateBookmarkOrigins[node.id];
    let originCleanupFailed = false;
    try {
        await localStorageSet({ [PRIVATE_BOOKMARK_ORIGINS_KEY]: privateBookmarkOrigins });
    } catch {
        originCleanupFailed = true;
    }

    if (originCleanupFailed) {
        showBookmarkNotice('书签已移出，但原位置记录清理失败', 'error');
    } else {
        showBookmarkNotice(fallbackUsed ? '原文件夹已失效，已移到“其他书签”' : '已移回原位置');
    }
    try {
        await refreshBookmarksAfterMutation({ revealPrivate: true });
    } catch {
        showBookmarkNotice('书签已移出，请重新打开收藏夹刷新', 'error');
    }
}

movePrivateBookmarkBtn?.addEventListener('click', async () => {
    const node = bookmarkMenuNode;
    const isPrivate = bookmarkMenuIsPrivate;
    const trigger = bookmarkMenuTrigger;
    if (!node) return;
    movePrivateBookmarkBtn.disabled = true;
    hideBookmarkContextMenu();
    try {
        if (isPrivate) await restorePrivateBookmark(node);
        else await moveBookmarkToPrivate(node);
    } catch (error) {
        showBookmarkNotice(isPrivate ? '移出失败，书签仍保留在“稍后整理”' : '移入失败，书签位置未改变', 'error');
        trigger?.focus();
    } finally {
        movePrivateBookmarkBtn.disabled = false;
    }
});

function createBookmarkItem(node, { isPrivate = false } = {}) {
    const safeUrl = getSafeBookmarkUrl(node.url);
    if (!safeUrl) return null;

    const item = document.createElement('div');
    item.className = 'bookmark-item';
    item.dataset.bookmarkId = node.id || '';

    const link = document.createElement('a');
    link.className = 'bookmark-link';
    link.href = safeUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `${node.title || safeUrl}，按 Shift+F10 管理私密状态`);
    link.appendChild(createBookmarkIcon(safeUrl, node.title || safeUrl, 32));

    link.addEventListener('contextmenu', event => {
        event.preventDefault();
        showBookmarkContextMenu(event.clientX, event.clientY, node, isPrivate, link);
    });
    link.addEventListener('keydown', event => {
        if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
        event.preventDefault();
        const rect = link.getBoundingClientRect();
        showBookmarkContextMenu(rect.left + 20, rect.top + Math.min(40, rect.height), node, isPrivate, link);
    });

    const title = document.createElement('span');
    title.textContent = node.title || safeUrl;
    link.appendChild(title);
    item.appendChild(link);

    const isAdded = desktopTags.some(tag => tag.url === safeUrl || tag.url === node.url);
    if (isAdded) {
        item.appendChild(createAddedBadge());
    } else {
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'add-btn';
        addButton.setAttribute('aria-label', `添加${node.title || safeUrl}到桌面`);
        addButton.appendChild(createSvg(['M12 5v14', 'M5 12h14']));
        addButton.addEventListener('click', event => {
            event.stopPropagation();
            if (addTag({ url: safeUrl, title: node.title || safeUrl })) {
                addButton.replaceWith(createAddedBadge());
            }
        });
        item.appendChild(addButton);
    }

    return item;
}

async function searchBookmarks(query) {
    if (typeof chrome === 'undefined' || !chrome.bookmarks) return;
    const requestId = ++bookmarkLoadRequestId;
    resetPrivateBookmarksDisclosure();
    try {
        const [{ folder }, results] = await Promise.all([
            preparePrivateBookmarksContext(),
            bookmarkApi('search', query)
        ]);
        if (requestId !== bookmarkLoadRequestId || !sidebar.classList.contains('open')) return;
        releaseCachedIconUrls(bookmarkList);
        bookmarkList.replaceChildren();

        const bookmarks = (results || []).filter(item =>
            item.url
            && getSafeBookmarkUrl(item.url)
            && !privateBookmarkDescendantIds.has(item.id)
        );
        if (bookmarks.length === 0) {
            bookmarkList.appendChild(createPlaceholder('未找到匹配的书签'));
        } else {
            bookmarks.forEach(node => {
                const item = createBookmarkItem(node);
                if (item) bookmarkList.appendChild(item);
            });
        }

        bookmarkList.appendChild(createPrivateBookmarksSection(folder));
    } catch {
        if (requestId !== bookmarkLoadRequestId) return;
        releaseCachedIconUrls(bookmarkList);
        bookmarkList.replaceChildren(createPlaceholder('书签搜索失败'));
    }
}

async function loadBookmarks({ preserveSearch = false, revealPrivate = privateBookmarksRevealed } = {}) {
    if (typeof chrome === 'undefined' || !chrome.bookmarks) {
        releaseCachedIconUrls(bookmarkList);
        bookmarkList.replaceChildren(createPlaceholder('书签功能仅在扩展中可用'));
        return;
    }

    const requestId = ++bookmarkLoadRequestId;
    releaseCachedIconUrls(bookmarkList);
    bookmarkList.replaceChildren(createPlaceholder('正在读取书签…'));
    if (bookmarkSearchInput && !preserveSearch) bookmarkSearchInput.value = '';
    try {
        const [{ folder }, recentItems, tree] = await Promise.all([
            preparePrivateBookmarksContext(),
            bookmarkApi('getRecent', 30),
            bookmarkApi('getTree')
        ]);
        if (requestId !== bookmarkLoadRequestId || !sidebar.classList.contains('open')) return;
        releaseCachedIconUrls(bookmarkList);
        bookmarkList.replaceChildren();

        const visibleRecentItems = (recentItems || []).filter(item =>
            item.url
            && getSafeBookmarkUrl(item.url)
            && !privateBookmarkDescendantIds.has(item.id)
        );
        if (visibleRecentItems.length > 0) {
            const recentFolder = {
                title: '最近添加',
                children: visibleRecentItems
            };
            renderNode(recentFolder, bookmarkList);

            const separator = document.createElement('div');
            separator.className = 'bookmark-separator';
            bookmarkList.appendChild(separator);
        }

        tree?.[0]?.children?.forEach(node => renderNode(node, bookmarkList));
        const privateSeparator = document.createElement('div');
        privateSeparator.className = 'bookmark-separator private-bookmarks-separator';
        bookmarkList.appendChild(privateSeparator);
        bookmarkList.appendChild(createPrivateBookmarksSection(folder));
        if (revealPrivate) await setPrivateBookmarksExpanded(folder, true);
    } catch {
        if (requestId !== bookmarkLoadRequestId) return;
        releaseCachedIconUrls(bookmarkList);
        bookmarkList.replaceChildren(createPlaceholder('无法读取书签'));
    }
}

function renderNode(node, container, { isPrivate = false } = {}) {
    if (!isPrivate && node.id && privateBookmarkDescendantIds.has(node.id)) return;
    if (node.url) {
        const item = createBookmarkItem(node, { isPrivate });
        if (item) container.appendChild(item);
    } else if (node.children) {
        const folder = document.createElement('div');
        folder.className = 'bookmark-folder';
        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'folder-header';
        header.setAttribute('aria-expanded', 'false');
        header.appendChild(createSvg(['m9 18 6-6-6-6']));
        header.appendChild(createSvg(['M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z']));
        const label = document.createElement('span');
        label.textContent = node.title || '文件夹';
        header.appendChild(label);

        const content = document.createElement('div');
        content.className = 'folder-content';
        content.hidden = true;

        header.onclick = () => {
            const open = content.hidden;
            content.hidden = !open;
            header.setAttribute('aria-expanded', String(open));
            header.querySelector('svg').style.transform = open ? 'rotate(90deg)' : '';
        };

        node.children.forEach(c => renderNode(c, content, { isPrivate }));
        folder.appendChild(header);
        folder.appendChild(content);
        container.appendChild(folder);
    }
}

// ============ DESKTOP TAGS ============
function getPageSize() {
    if (window.innerWidth >= 1100) return 21;
    if (window.innerWidth >= 800) return 15;
    if (window.innerWidth >= 560) return 12;
    return 9;
}

function addTag(tag) {
    if (desktopTags.some(t => t.url === tag.url)) return false;
    // Limit removed: if (desktopTags.length >= MAX_TAGS) ...
    desktopTags.push(tag);
    saveTags();

    // Jump to the last page where the new tag is added
    const totalPages = Math.ceil(desktopTags.length / currentPageSize);
    currentPage = totalPages - 1;

    renderTags();
    return true;
}

function removeTag(url) {
    desktopTags = desktopTags.filter(t => t.url !== url);
    saveTags();

    // Adjust page if current page becomes empty
    const totalPages = Math.ceil(desktopTags.length / currentPageSize) || 1;
    if (currentPage >= totalPages) currentPage = totalPages - 1;

    renderTags();
    if (sidebar.classList.contains('open')) loadBookmarks();
}

function saveTags() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ desktopTags });
    } else {
        localStorage.setItem('desktopTags', JSON.stringify(desktopTags));
    }
}

function normalizeStoredIcon(iconUrl) {
    if (!iconUrl || typeof iconUrl !== 'string') return undefined;
    if (iconUrl.includes('google.com/s2/favicons')) return undefined;

    try {
        const url = new URL(iconUrl);
        if (url.hostname === 'cdn.simpleicons.org') {
            const slug = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
            if (slug && popularIcons.includes(slug)) return `${BRAND_ICON_DIR}/${slug}.svg`;
            return undefined;
        }
    } catch {
        // 相对路径和 data URL 会在下面原样保留。
    }

    return iconUrl;
}

function migrateStoredTags(tags) {
    let changed = false;
    const migrated = tags.filter(tag => tag && typeof tag.url === 'string').map(tag => {
        const icon = normalizeStoredIcon(tag.icon);
        if (icon !== tag.icon) changed = true;
        const nextTag = { url: tag.url, title: String(tag.title || tag.url) };
        if (icon) nextTag.icon = icon;
        return nextTag;
    });
    return { migrated, changed: changed || migrated.length !== tags.length };
}

function loadTags() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['desktopTags'], r => {
            if (Array.isArray(r.desktopTags)) {
                const result = migrateStoredTags(r.desktopTags);
                desktopTags = result.migrated;
                if (result.changed) saveTags();
            } else {
                const local = localStorage.getItem('desktopTags');
                if (local) {
                    try {
                        const parsed = JSON.parse(local);
                        if (Array.isArray(parsed)) desktopTags = migrateStoredTags(parsed).migrated;
                    } catch (error) {
                        console.warn('本地标签数据无法解析。', error);
                    }
                }
            }
            renderTags();
        });
    } else {
        const local = localStorage.getItem('desktopTags');
        if (local) {
            try {
                const parsed = JSON.parse(local);
                if (Array.isArray(parsed)) desktopTags = migrateStoredTags(parsed).migrated;
            } catch (error) {
                console.warn('本地标签数据无法解析。', error);
            }
        }
        renderTags();
    }
}

function getFaviconUrl(pageUrl, size = 64) {
    try {
        const page = new URL(pageUrl);
        if (!['http:', 'https:'].includes(page.protocol)) return null;
        if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return null;
        const favicon = new URL(chrome.runtime.getURL('/_favicon/'));
        favicon.searchParams.set('pageUrl', page.href);
        favicon.searchParams.set('size', String(size));
        return favicon.href;
    } catch {
        return null;
    }
}

const localBrandIconHosts = new Map([
    ['notebooklm.google.com', 'notebooklm'],
    ['scholar.google.com', 'googlescholar'],
    ['gemini.google.com', 'googlegemini'],
    ['aistudio.google.com', 'googlegemini'],
    ['ai.google.dev', 'googlegemini'],
    ['chatgpt.com', 'chatgpt'],
    ['openai.com', 'openai'],
    ['claude.ai', 'claude'],
    ['anthropic.com', 'claude'],
    ['github.com', 'github'],
    ['bilibili.com', 'bilibili'],
    ['youtube.com', 'youtube'],
    ['notion.so', 'notion'],
    ['figma.com', 'figma'],
    ['reddit.com', 'reddit'],
    ['zhihu.com', 'zhihu'],
    ['weibo.com', 'weibo'],
    ['taobao.com', 'taobao'],
    ['baidu.com', 'baidu']
]);

function getLocalBrandIcon(siteUrl) {
    try {
        const hostname = new URL(siteUrl).hostname.toLowerCase().replace(/^www\./, '');
        for (const [domain, iconName] of localBrandIconHosts) {
            if (hostname === domain || hostname.endsWith(`.${domain}`)) {
                return `${BRAND_ICON_DIR}/${iconName}.svg`;
            }
        }
        if (hostname === 'google.com') return 'assets/search-engines/google.svg';
    } catch {
        // 非网页地址继续使用本地字母图标。
    }
    return null;
}

function getFaviconCacheKey(siteUrl) {
    try {
        const url = new URL(siteUrl);
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        return `site:${url.protocol}//${url.host.toLowerCase()}`;
    } catch {
        return null;
    }
}

function getIconCacheEntry(cacheKey) {
    if (!cacheKey) return Promise.resolve(null);
    return initDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(ICON_CACHE_STORE_NAME, 'readonly');
        const request = tx.objectStore(ICON_CACHE_STORE_NAME).get(cacheKey);
        tx.oncomplete = () => {
            db.close();
            resolve(request.result || null);
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
        tx.onabort = () => {
            db.close();
            reject(tx.error);
        };
    }));
}

function saveIconCacheEntry(cacheKey, blob, sourceUrl) {
    return initDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(ICON_CACHE_STORE_NAME, 'readwrite');
        tx.objectStore(ICON_CACHE_STORE_NAME).put({
            blob,
            sourceUrl,
            size: FAVICON_REQUEST_SIZE,
            updatedAt: Date.now()
        }, cacheKey);
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
        tx.onabort = () => {
            db.close();
            reject(tx.error);
        };
    }));
}

async function fetchIconBlob(sourceUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
        const response = await fetch(sourceUrl, {
            cache: 'no-store',
            credentials: 'omit',
            signal: controller.signal
        });
        if (!response.ok) throw new Error(`图标请求失败：${response.status}`);
        const blob = await response.blob();
        if (!blob.type.startsWith('image/') || blob.size < 64) {
            throw new Error('图标响应不是有效图片');
        }
        return blob;
    } finally {
        clearTimeout(timeoutId);
    }
}

function refreshIconCache(cacheKey, sourceUrl) {
    if (pendingFaviconRefreshes.has(cacheKey)) {
        return pendingFaviconRefreshes.get(cacheKey);
    }

    const refresh = fetchIconBlob(sourceUrl)
        .then(async blob => {
            await saveIconCacheEntry(cacheKey, blob, sourceUrl);
            return { blob, sourceUrl, size: FAVICON_REQUEST_SIZE, updatedAt: Date.now() };
        })
        .finally(() => pendingFaviconRefreshes.delete(cacheKey));

    pendingFaviconRefreshes.set(cacheKey, refresh);
    return refresh;
}

function revokeImageObjectUrl(image) {
    const objectUrl = image.dataset.iconObjectUrl;
    if (!objectUrl) return;
    URL.revokeObjectURL(objectUrl);
    delete image.dataset.iconObjectUrl;
}

function setImageSource(image, source, fallback) {
    revokeImageObjectUrl(image);
    image.onerror = () => {
        image.onerror = null;
        revokeImageObjectUrl(image);
        image.src = fallback;
    };
    image.src = source || fallback;
}

function setImageBlob(image, blob, fallback) {
    revokeImageObjectUrl(image);
    const objectUrl = URL.createObjectURL(blob);
    image.dataset.iconObjectUrl = objectUrl;
    image.onerror = () => {
        image.onerror = null;
        revokeImageObjectUrl(image);
        image.src = fallback;
    };
    image.src = objectUrl;
}

function releaseCachedIconUrls(container) {
    container.querySelectorAll('img').forEach(image => {
        bookmarkIconObserver?.unobserve(image);
        bookmarkIconMetadata.delete(image);
        revokeImageObjectUrl(image);
    });
}

function loadSiteIcon(image, iconUrl, siteUrl, title) {
    const fallback = generateFallbackIcon(title);
    const normalizedIcon = normalizeStoredIcon(iconUrl);
    const localBrandIcon = normalizedIcon ? null : getLocalBrandIcon(siteUrl);

    if (localBrandIcon || (normalizedIcon && !/^https?:\/\//i.test(normalizedIcon))) {
        setImageSource(image, localBrandIcon || normalizedIcon, fallback);
        return;
    }

    const isCustomRemoteIcon = Boolean(normalizedIcon);
    const sourceUrl = normalizedIcon || getFaviconUrl(siteUrl, FAVICON_REQUEST_SIZE);
    const cacheKey = isCustomRemoteIcon
        ? `custom:${normalizedIcon}`
        : getFaviconCacheKey(siteUrl);

    if (!sourceUrl || !cacheKey) {
        setImageSource(image, sourceUrl, fallback);
        return;
    }

    image.dataset.iconCacheKey = cacheKey;
    setImageSource(image, fallback, fallback);

    getIconCacheEntry(cacheKey).then(entry => {
        if (!image.isConnected || image.dataset.iconCacheKey !== cacheKey) return;

        if (entry?.blob instanceof Blob) {
            setImageBlob(image, entry.blob, fallback);
        } else {
            setImageSource(image, sourceUrl, fallback);
        }

        const isFresh = entry?.updatedAt && Date.now() - entry.updatedAt < FAVICON_CACHE_MAX_AGE;
        if (isFresh) return;

        scheduleIdleTask(() => {
            refreshIconCache(cacheKey, sourceUrl).then(refreshed => {
                if (!image.isConnected || image.dataset.iconCacheKey !== cacheKey) return;
                setImageBlob(image, refreshed.blob, fallback);
            }).catch(() => {
                // 保留当前图标或本地兜底；网络恢复后会再次尝试。
            });
        });
    }).catch(() => {
        if (image.isConnected && image.dataset.iconCacheKey === cacheKey) {
            setImageSource(image, sourceUrl, fallback);
        }
    });
}

function escapeXml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
    })[character]);
}

function generateFallbackIcon(title) {
    const char = escapeXml((title || '?').charAt(0).toUpperCase());

    // Generate consistent color based on first character
    const colors = [
        ['#667eea', '#764ba2'], // Purple
        ['#f093fb', '#f5576c'], // Pink
        ['#4facfe', '#00f2fe'], // Blue
        ['#43e97b', '#38f9d7'], // Green
        ['#fa709a', '#fee140'], // Orange-Pink
        ['#a8edea', '#fed6e3'], // Soft cyan-pink
        ['#ff9a9e', '#fecfef'], // Light pink
        ['#ffecd2', '#fcb69f'], // Peach
        ['#a18cd1', '#fbc2eb'], // Lavender
        ['#fad0c4', '#ffd1ff'], // Rose
        ['#89f7fe', '#66a6ff'], // Sky blue
        ['#cd9cf2', '#f6f3ff'], // Light purple
    ];

    const colorIndex = char.charCodeAt(0) % colors.length;
    const [color1, color2] = colors[colorIndex];

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${color1}"/>
                <stop offset="100%" style="stop-color:${color2}"/>
            </linearGradient>
        </defs>
        <rect width="100" height="100" rx="22" fill="url(#grad)"/>
        <text x="50" y="62" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="45" font-weight="600" fill="white">${char}</text>
    </svg>`;

    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function renderTags() {
    releaseCachedIconUrls(tagsGrid);
    tagsGrid.replaceChildren();

    const totalPages = Math.ceil(desktopTags.length / currentPageSize) || 1;
    currentPage = Math.min(currentPage, totalPages - 1);
    const hasMultiplePages = totalPages > 1;

    prevPageBtn.classList.toggle('hidden', !hasMultiplePages);
    nextPageBtn.classList.toggle('hidden', !hasMultiplePages);

    if (currentPage > 0) {
        prevPageBtn.classList.remove('disabled');
        prevPageBtn.disabled = false;
        prevPageBtn.onclick = () => {
            currentPage--;
            renderTags();
        };
    } else {
        prevPageBtn.classList.add('disabled');
        prevPageBtn.disabled = true;
        prevPageBtn.onclick = null;
    }

    if (currentPage < totalPages - 1) {
        nextPageBtn.classList.remove('disabled');
        nextPageBtn.disabled = false;
        nextPageBtn.onclick = () => {
            currentPage++;
            renderTags();
        };
    } else {
        nextPageBtn.classList.add('disabled');
        nextPageBtn.disabled = true;
        nextPageBtn.onclick = null;
    }

    const start = currentPage * currentPageSize;
    const pageTags = desktopTags.slice(start, start + currentPageSize);

    pageTags.forEach((tag, i) => {
        const a = document.createElement('a');
        const safeUrl = getSafeBookmarkUrl(tag.url);
        a.href = safeUrl || '#';
        a.className = isInitialRender ? 'tag-item animate-in' : 'tag-item';
        a.draggable = true;
        a.dataset.index = start + i;
        a.dataset.url = tag.url;
        a.setAttribute('aria-label', safeUrl ? `打开${tag.title}` : `${tag.title}，地址不可用`);
        if (!safeUrl) a.setAttribute('aria-disabled', 'true');

        const img = document.createElement('img');
        img.className = 'tag-icon';
        img.draggable = false;
        img.alt = '';
        img.decoding = 'async';

        loadSiteIcon(img, tag.icon, tag.url, tag.title);

        const span = document.createElement('span');
        span.className = 'tag-title';
        span.textContent = truncate(tag.title, 10);

        a.appendChild(img);
        a.appendChild(span);

        a.oncontextmenu = e => {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, tag.url, a);
        };

        a.addEventListener('keydown', e => {
            if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
                e.preventDefault();
                const rect = a.getBoundingClientRect();
                showContextMenu(rect.left + 12, rect.top + 12, tag.url, a);
            }
        });

        a.onclick = e => {
            if (!safeUrl || a.classList.contains('dragging')) {
                e.preventDefault();
            }
        };

        addDragHandlers(a);

        tagsGrid.appendChild(a);
    });

    if (isInitialRender) {
        isInitialRender = false;
    }
}

let resizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        const nextPageSize = getPageSize();
        if (nextPageSize === currentPageSize) return;
        const firstVisibleIndex = currentPage * currentPageSize;
        currentPageSize = nextPageSize;
        currentPage = Math.floor(firstVisibleIndex / currentPageSize);
        renderTags();
    }, 120);
});

function addDragHandlers(el) {
    let isDragging = false;
    let startX, startY;
    let initialX, initialY;
    let dragClone = null;
    let currentDropTarget = null;

    el.addEventListener('mousedown', startDrag);
    el.addEventListener('touchstart', startDrag, { passive: false });

    function startDrag(e) {
        if (e.button && e.button !== 0) return;

        const touch = e.touches ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;

        const rect = el.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        isDragging = false;

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('touchend', endDrag);
    }

    function onDrag(e) {
        const touch = e.touches ? e.touches[0] : e;
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;

        // Start dragging after threshold
        if (!isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
            isDragging = true;
            dragSrcEl = el;
            el.classList.add('dragging');

            // Create drag clone
            dragClone = el.cloneNode(true);
            dragClone.classList.remove('dragging');
            dragClone.classList.add('drag-clone');
            dragClone.style.cssText = `
                position: fixed;
                width: ${el.offsetWidth}px;
                height: ${el.offsetHeight}px;
                left: ${initialX}px;
                top: ${initialY}px;
                z-index: 1000;
                pointer-events: none;
                transform: translate3d(0, 0, 0) scale(1.05);
                opacity: 1;
                transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s ease-out;
                box-shadow: 0 15px 35px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(dragClone);
        }

        if (isDragging && dragClone) {
            e.preventDefault(); // Only prevent default when actually dragging
            dragClone.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) scale(1.05)`;

            // Find element under cursor
            dragClone.style.visibility = 'hidden';
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            dragClone.style.visibility = 'visible';

            const targetItem = elementBelow?.closest('.tag-item');

            // Update hover states
            if (currentDropTarget && currentDropTarget !== targetItem) {
                currentDropTarget.classList.remove('drag-over');
            }

            if (targetItem && targetItem !== el && !targetItem.classList.contains('dragging')) {
                targetItem.classList.add('drag-over');
                currentDropTarget = targetItem;
            } else {
                currentDropTarget = null;
            }
        }
    }

    function endDrag(e) {
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('touchend', endDrag);

        if (isDragging) {
            const srcIndex = parseInt(el.dataset.index);
            const targetIndex = currentDropTarget ? parseInt(currentDropTarget.dataset.index) : srcIndex;

            // If dropped on a valid target, perform the swap
            if (currentDropTarget && srcIndex !== targetIndex) {
                // Reorder data array
                const movedItem = desktopTags.splice(srcIndex, 1)[0];
                desktopTags.splice(targetIndex, 0, movedItem);
                saveTags();

                // Animate and re-render
                performSwapAnimation(el, currentDropTarget, dragClone, () => {
                    renderTags();
                });
            } else {
                // Return clone to original position
                if (dragClone) {
                    dragClone.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease-out';
                    dragClone.style.transform = 'translate3d(0, 0, 0) scale(1)';
                    dragClone.style.boxShadow = 'none';

                    setTimeout(() => {
                        dragClone?.remove();
                        dragClone = null;
                        el.classList.remove('dragging');
                    }, 250);
                } else {
                    el.classList.remove('dragging');
                }
            }

            // Clean up
            document.querySelectorAll('.tag-item').forEach(item => {
                item.classList.remove('drag-over');
            });

            isDragging = false;
            dragSrcEl = null;
            currentDropTarget = null;
        }
    }

    el.addEventListener('dragstart', e => e.preventDefault());
}

// Perform swap animation then callback
function performSwapAnimation(srcEl, targetEl, dragClone, callback) {
    const targetRect = targetEl.getBoundingClientRect();

    // Animate clone to target position
    if (dragClone) {
        const originX = Number.parseFloat(dragClone.style.left) || 0;
        const originY = Number.parseFloat(dragClone.style.top) || 0;
        dragClone.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease-out';
        dragClone.style.transform = `translate3d(${targetRect.left - originX}px, ${targetRect.top - originY}px, 0) scale(1)`;
        dragClone.style.boxShadow = 'none';
    }

    // Clean up after animation
    setTimeout(() => {
        dragClone?.remove();
        srcEl.classList.remove('dragging');
        callback();
    }, 250);
}

// Animate tag deletion with iOS-style effect
function animateTagDeletion(url) {
    const items = Array.from(tagsGrid.querySelectorAll('.tag-item'));
    const targetItem = items.find(item => item.dataset.url === url);

    if (targetItem) {
        // Get positions before removal
        const rects = items.map(item => item.getBoundingClientRect());

        // Animate the deleted item
        targetItem.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out';
        targetItem.style.transform = 'scale(0)';
        targetItem.style.opacity = '0';

        setTimeout(() => {
            // Remove from data
            desktopTags = desktopTags.filter(t => t.url !== url);
            saveTags();

            // Adjust page if needed
            const totalPages = Math.ceil(desktopTags.length / currentPageSize) || 1;
            if (currentPage >= totalPages) currentPage = totalPages - 1;

            // Remove element and animate others
            targetItem.remove();

            // Animate remaining items to fill gap
            const remainingItems = Array.from(tagsGrid.querySelectorAll('.tag-item'));
            const start = currentPage * currentPageSize;

            remainingItems.forEach((item, i) => {
                const oldIndex = items.findIndex(old => old.dataset.url === item.dataset.url);
                if (oldIndex !== -1) {
                    const oldRect = rects[oldIndex];
                    const newRect = item.getBoundingClientRect();
                    const deltaX = oldRect.left - newRect.left;
                    const deltaY = oldRect.top - newRect.top;

                    if (deltaX !== 0 || deltaY !== 0) {
                        item.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                        item.style.transition = 'none';

                        requestAnimationFrame(() => {
                            item.style.transition = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
                            item.style.transform = 'translate(0, 0)';
                        });
                    }
                }

                item.dataset.index = start + i;
            });

            // Update sidebar if open
            if (sidebar.classList.contains('open')) loadBookmarks();

            // Full re-render only if we need to load items from next page
            const expectedCount = desktopTags.slice(start, start + currentPageSize).length;
            if (remainingItems.length === 0 && expectedCount > 0) {
                // Page is empty but there are items to show - re-render
                setTimeout(() => renderTags(), 350);
            }
        }, 300);
    } else {
        // Fallback to normal removal
        removeTagDirect(url);
    }
}

function removeTagDirect(url) {
    desktopTags = desktopTags.filter(t => t.url !== url);
    saveTags();
    const totalPages = Math.ceil(desktopTags.length / currentPageSize) || 1;
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    renderTags();
    if (sidebar.classList.contains('open')) loadBookmarks();
}

function truncate(str, len) {
    return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

// ============ CONTEXT MENU ============
function showContextMenu(x, y, url, trigger) {
    hideBookmarkContextMenu();
    contextTagUrl = url;
    contextMenuTrigger = trigger;
    contextMenu.classList.add('show');
    contextMenu.setAttribute('aria-hidden', 'false');
    const rect = contextMenu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 8);
    const top = Math.min(y, window.innerHeight - rect.height - 8);
    contextMenu.style.left = `${Math.max(8, left)}px`;
    contextMenu.style.top = `${Math.max(8, top)}px`;
    contextMenu.querySelector('[role="menuitem"]')?.focus();
}

function hideContextMenu({ restoreFocus = false } = {}) {
    if (restoreFocus) contextMenuTrigger?.focus();
    contextMenu.classList.remove('show');
    contextMenu.setAttribute('aria-hidden', 'true');
    contextTagUrl = null;
    contextMenuTrigger = null;
}

deleteTagBtn.onclick = () => {
    if (contextTagUrl) {
        animateTagDeletion(contextTagUrl);
        hideContextMenu({ restoreFocus: true });
    }
};

// ============ ICON PICKER ============
const popularIcons = [
    'google', 'github', 'youtube', 'twitter', 'facebook', 'instagram', 'linkedin', 'discord',
    'apple', 'microsoft', 'amazon', 'netflix', 'spotify', 'reddit', 'tiktok', 'twitch',
    'slack', 'notion', 'figma', 'dribbble', 'behance', 'medium', 'stackoverflow', 'npm',
    'docker', 'kubernetes', 'react', 'vue', 'angular', 'nodejs', 'python', 'java',
    'bilibili', 'wechat', 'weibo', 'zhihu', 'taobao', 'alipay', 'baidu', 'tencent',
    'openai', 'chatgpt', 'claude', 'googlegemini', 'googlescholar', 'notebooklm',
    'gmail', 'googledrive', 'googlecloud', 'firebase', 'vercel', 'netlify'
];

// Color icon fallbacks (for custom colored letters)
const colorIcons = [
    { name: 'A', colors: ['#667eea', '#764ba2'] },
    { name: 'B', colors: ['#f093fb', '#f5576c'] },
    { name: 'C', colors: ['#4facfe', '#00f2fe'] },
    { name: 'D', colors: ['#43e97b', '#38f9d7'] },
    { name: 'E', colors: ['#fa709a', '#fee140'] },
    { name: 'F', colors: ['#a8edea', '#fed6e3'] },
    { name: 'G', colors: ['#ff9a9e', '#fecfef'] },
    { name: 'H', colors: ['#ffecd2', '#fcb69f'] },
    { name: 'I', colors: ['#a18cd1', '#fbc2eb'] },
    { name: 'J', colors: ['#89f7fe', '#66a6ff'] },
    { name: 'K', colors: ['#cd9cf2', '#f6f3ff'] },
    { name: 'L', colors: ['#667eea', '#764ba2'] },
];

let currentTab = 'brands';

changeIconBtn.onclick = () => {
    const urlToEdit = contextTagUrl;
    contextTagUrl = urlToEdit;
    openIconPicker();
    contextMenu.classList.remove('show');
    contextMenu.setAttribute('aria-hidden', 'true');
};

function openIconPicker() {
    lastFocusedElement = contextMenuTrigger || document.activeElement;
    iconPickerModal.classList.add('show');
    iconPickerOverlay.classList.add('show');
    iconPickerModal.setAttribute('aria-hidden', 'false');
    iconSearchInput.value = '';
    customIconError.textContent = '';
    currentTab = 'brands';
    document.querySelectorAll('.icon-tab').forEach(tab => {
        const active = tab.dataset.tab === 'brands';
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
    });
    iconGrid.style.display = 'grid';
    customIconSection.style.display = 'none';
    loadIcons('brands');
    iconSearchInput.focus();
}

function closeIconPickerModal({ restoreFocus = true } = {}) {
    if (restoreFocus) (lastFocusedElement || contextMenuTrigger)?.focus?.();
    iconPickerModal.classList.remove('show');
    iconPickerOverlay.classList.remove('show');
    iconPickerModal.setAttribute('aria-hidden', 'true');
    contextTagUrl = null;
    contextMenuTrigger = null;
}

closeIconPicker.onclick = closeIconPickerModal;
iconPickerOverlay.onclick = closeIconPickerModal;

// Tab switching
document.querySelectorAll('.icon-tab').forEach(tab => {
    tab.onclick = () => {
        document.querySelectorAll('.icon-tab').forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        currentTab = tab.dataset.tab;

        if (currentTab === 'custom') {
            iconGrid.style.display = 'none';
            customIconSection.style.display = 'block';
        } else {
            iconGrid.style.display = 'grid';
            customIconSection.style.display = 'none';
            loadIcons(currentTab);
        }
    };

    tab.onkeydown = event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const tabs = Array.from(document.querySelectorAll('.icon-tab'));
        const currentIndex = tabs.indexOf(tab);
        let nextIndex = currentIndex;
        if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        event.preventDefault();
        tabs[nextIndex].focus();
        tabs[nextIndex].click();
    };
});

// Load icons based on tab
function loadIcons(tab, searchQuery = '') {
    iconGrid.replaceChildren();

    if (tab === 'brands') {
        const icons = searchQuery
            ? popularIcons.filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
            : popularIcons;

        if (icons.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'no-icons';
            empty.textContent = '未找到匹配的图标';
            iconGrid.appendChild(empty);
            return;
        }

        icons.forEach(name => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'icon-option';
            button.title = name;
            button.setAttribute('role', 'option');
            button.setAttribute('aria-label', name);
            const iconUrl = `${BRAND_ICON_DIR}/${name}.svg`;
            const image = document.createElement('img');
            image.src = iconUrl;
            image.alt = '';
            image.onerror = () => image.replaceWith(document.createTextNode(name.charAt(0).toUpperCase()));
            button.appendChild(image);
            button.onclick = () => selectIcon(iconUrl);
            iconGrid.appendChild(button);
        });
    } else if (tab === 'colors') {
        colorIcons.forEach(icon => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'icon-option';
            button.setAttribute('role', 'option');
            button.setAttribute('aria-label', icon.name);
            const svg = generateColorIcon(icon.name, icon.colors);
            const image = document.createElement('img');
            image.src = svg;
            image.alt = '';
            button.appendChild(image);
            button.onclick = () => selectIcon(svg);
            iconGrid.appendChild(button);
        });

        'MNOPQRSTUVWXYZ0123456789'.split('').forEach((char, i) => {
            const colors = colorIcons[i % colorIcons.length].colors;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'icon-option';
            button.setAttribute('role', 'option');
            button.setAttribute('aria-label', char);
            const svg = generateColorIcon(char, colors);
            const image = document.createElement('img');
            image.src = svg;
            image.alt = '';
            button.appendChild(image);
            button.onclick = () => selectIcon(svg);
            iconGrid.appendChild(button);
        });
    }
}

// Generate colored letter icon
function generateColorIcon(char, [color1, color2]) {
    // Use unique ID and proper encoding
    const id = 'grad' + char + Date.now();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${color1}"/><stop offset="100%" stop-color="${color2}"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#${id})"/><text x="50" y="65" text-anchor="middle" font-family="system-ui,sans-serif" font-size="50" font-weight="600" fill="white">${char}</text></svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

// Search icons
iconSearchInput.oninput = (e) => {
    const query = e.target.value.trim();
    if (currentTab !== 'custom') {
        loadIcons(currentTab, query);
    }
};

// Select an icon
function selectIcon(iconUrl) {
    if (!contextTagUrl) return;

    const tag = desktopTags.find(t => t.url === contextTagUrl);

    if (tag) {
        tag.icon = iconUrl;
        saveTags();
        renderTags();
    }

    closeIconPickerModal({ restoreFocus: true });
    contextTagUrl = null;
    contextMenuTrigger = null;
}

applyCustomIcon.onclick = () => {
    const url = customIconUrl.value.trim();
    customIconError.textContent = '';
    if (!url || !contextTagUrl) return;

    try {
        const parsed = new URL(url);
        if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('unsupported');
        selectIcon(parsed.href);
        customIconUrl.value = '';
    } catch {
        customIconError.textContent = '请输入有效的 HTTP 或 HTTPS 图片地址';
        customIconUrl.focus();
    }
};

document.addEventListener('click', (e) => {
    if (bookmarkContextMenu.classList.contains('show') && !e.target.closest('#bookmarkContextMenu')) {
        hideBookmarkContextMenu();
    }
    // Only hide context menu and clear URL if icon picker is not open
    if (contextMenu.classList.contains('show')) {
        if (contextMenu.contains(document.activeElement)) contextMenuTrigger?.focus();
        contextMenu.classList.remove('show');
        contextMenu.setAttribute('aria-hidden', 'true');
        if (!iconPickerModal.classList.contains('show') &&
            !e.target.closest('#changeIconBtn')) {
            contextTagUrl = null;
            contextMenuTrigger = null;
        }
    }
});

// ============ CLOCK SETTINGS ============
const clockSettingsBtn = $('clockSettingsBtn');
const clockSettingsModal = $('clockSettingsModal');
const clockSettingsOverlay = $('clockSettingsOverlay');
const closeClockSettings = $('closeClockSettings');
const clockColorInput = $('clockColorInput');
const clockColorText = $('clockColorText');
const dateColorInput = $('dateColorInput');
const dateColorText = $('dateColorText');
const resetColorsBtn = $('resetColorsBtn');
const showSecondsToggle = $('showSecondsToggle');

function openClockSettings() {
    lastFocusedElement = document.activeElement;
    clockSettingsModal.classList.add('show');
    clockSettingsOverlay.classList.add('show');
    clockSettingsModal.setAttribute('aria-hidden', 'false');
    clockSettingsBtn.setAttribute('aria-expanded', 'true');

    // Load current colors from CSS variables
    const clockColor = getComputedStyle(document.body).getPropertyValue('--clock-color').trim();
    const dateColor = getComputedStyle(document.body).getPropertyValue('--date-color').trim();

    clockColorInput.value = rgbToHex(clockColor) || '#ffffff';
    clockColorText.value = clockColorInput.value;
    dateColorInput.value = rgbToHex(dateColor) || '#ffffff';
    dateColorText.value = dateColorInput.value;

    showSecondsToggle.checked = showSeconds;
    requestAnimationFrame(() => clockColorText.focus());
}

function closeClockSettingsModal({ restoreFocus = true } = {}) {
    if (restoreFocus) (lastFocusedElement || clockSettingsBtn).focus?.();
    clockSettingsModal.classList.remove('show');
    clockSettingsOverlay.classList.remove('show');
    clockSettingsModal.setAttribute('aria-hidden', 'true');
    clockSettingsBtn.setAttribute('aria-expanded', 'false');
}

function rgbToHex(color) {
    if (!color) return null;
    if (color.startsWith('#')) return color;
    const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
    if (!match) return null;
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function updateColor(type, value) {
    if (!value) return;
    document.body.style.setProperty(`--${type}-color`, value);
    if (type === 'clock') {
        clockColorInput.value = rgbToHex(value);
        clockColorText.value = value;
    } else {
        dateColorInput.value = rgbToHex(value);
        dateColorText.value = value;
    }
    saveColorSettings();
}

function saveColorSettings() {
    const clockColor = document.body.style.getPropertyValue('--clock-color');
    const dateColor = document.body.style.getPropertyValue('--date-color');
    if (typeof chrome !== 'undefined') chrome.storage?.local.set({ clockColor, dateColor, showSeconds });
    localStorage.setItem('clockColor', clockColor);
    localStorage.setItem('dateColor', dateColor);
    localStorage.setItem('showSeconds', showSeconds);
}

function loadColorSettings() {
    const applySettings = (settings) => {
        if (settings.clockColor) document.body.style.setProperty('--clock-color', settings.clockColor);
        if (settings.dateColor) document.body.style.setProperty('--date-color', settings.dateColor);
        if (settings.showSeconds !== undefined) {
            showSeconds = settings.showSeconds;
            scheduleClock();
        }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(['clockColor', 'dateColor', 'showSeconds'], r => {
            if (r.clockColor !== undefined || r.dateColor !== undefined || r.showSeconds !== undefined) {
                applySettings(r);
            } else {
                const clockColor = localStorage.getItem('clockColor');
                const dateColor = localStorage.getItem('dateColor');
                const showSecondsVal = localStorage.getItem('showSeconds');
                applySettings({
                    clockColor,
                    dateColor,
                    showSeconds: showSecondsVal === null ? undefined : showSecondsVal === 'true'
                });
            }
        });
    } else {
        const clockColor = localStorage.getItem('clockColor');
        const dateColor = localStorage.getItem('dateColor');
        const showSecondsVal = localStorage.getItem('showSeconds');
        applySettings({
            clockColor,
            dateColor,
            showSeconds: showSecondsVal === null ? undefined : showSecondsVal === 'true'
        });
    }
}

clockSettingsBtn.onclick = openClockSettings;
closeClockSettings.onclick = closeClockSettingsModal;
clockSettingsOverlay.onclick = closeClockSettingsModal;

clockColorInput.oninput = e => updateColor('clock', e.target.value);
dateColorInput.oninput = e => updateColor('date', e.target.value);

clockColorText.onchange = e => updateColor('clock', e.target.value);
dateColorText.onchange = e => updateColor('date', e.target.value);

showSecondsToggle.onchange = e => {
    showSeconds = e.target.checked;
    scheduleClock();
    saveColorSettings();
};

resetColorsBtn.onclick = () => {
    updateColor('clock', '#ffffff');
    updateColor('date', 'rgba(255, 255, 255, 0.9)');
};

function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(element => !element.hidden && element.offsetParent !== null);
}

function trapFocus(event, container) {
    const focusable = getFocusableElements(container);
    if (!focusable.length) {
        event.preventDefault();
        container.focus();
        return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

function moveMenuFocus(event, container) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = getFocusableElements(container);
    if (!items.length) return;
    event.preventDefault();
    const currentIndex = Math.max(0, items.indexOf(document.activeElement));
    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % items.length;
    if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + items.length) % items.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = items.length - 1;
    items[nextIndex].focus();
}

contextMenu.addEventListener('keydown', event => moveMenuFocus(event, contextMenu));
bookmarkContextMenu.addEventListener('keydown', event => moveMenuFocus(event, bookmarkContextMenu));
iconGrid.addEventListener('keydown', event => moveMenuFocus(event, iconGrid));

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        if (iconPickerModal.classList.contains('show')) {
            event.preventDefault();
            closeIconPickerModal();
            return;
        }
        if (clockSettingsModal.classList.contains('show')) {
            event.preventDefault();
            closeClockSettingsModal();
            return;
        }
        if (bookmarkContextMenu.classList.contains('show')) {
            event.preventDefault();
            hideBookmarkContextMenu({ restoreFocus: true });
            return;
        }
        if (contextMenu.classList.contains('show')) {
            event.preventDefault();
            hideContextMenu({ restoreFocus: true });
            return;
        }
        if (searchHistoryDropdown.classList.contains('show')) {
            event.preventDefault();
            closeSearchHistory({ restoreFocus: true });
            return;
        }
        if (engineDropdown.classList.contains('show')) {
            event.preventDefault();
            closeEngineDropdown({ restoreFocus: true });
            return;
        }
        if (sidebar.classList.contains('open')) {
            event.preventDefault();
            closeSidebar();
        }
    }

    if (event.key === 'Tab') {
        if (iconPickerModal.classList.contains('show')) trapFocus(event, iconPickerModal);
        else if (clockSettingsModal.classList.contains('show')) trapFocus(event, clockSettingsModal);
        else if (sidebar.classList.contains('open')) trapFocus(event, sidebar);
    }
});

// ============ INIT ============
window.addEventListener('pagehide', () => {
    releaseCachedIconUrls(tagsGrid);
    releaseCachedIconUrls(bookmarkList);
});

loadTags();
loadColorSettings();
