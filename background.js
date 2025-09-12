importScripts('config.js');

function addLog(message) {
    const entry = `[${new Date().toLocaleTimeString()}] ${message}`;
    chrome.storage.local.get({ logs: [] }, (res) => {
        const logs = [entry, ...(res.logs || [])].slice(0, 200);
        chrome.storage.local.set({ logs });
    });
}

// стартовый лог
(function initLog() {
    addLog("Сервис-воркер запущен, ожидаем обновлений...");
})();

function readJwtCookie() {
    return new Promise((resolve) => {
        chrome.cookies.get({ url: CONFIG[CONFIG.environment].baseUrl, name: "jwt_token" }, (c) =>
            resolve(c?.value || null)
        );
    });
}

async function syncJwt() {
    try {
        const token = await readJwtCookie();
        if (token) {
            chrome.storage.local.get({ auth_data: {} }, async (res) => {
                const current = res.auth_data || {};
                if (current.token !== token) {
                    await chrome.storage.local.set({ auth_data: { ...current, token } });
                    addLog("JWT updated");
                }
            });
        } else {
            addLog("JWT cookie not found");
        }
    } catch (e) {
        addLog("JWT read error: " + (e?.message || e));
    }
}
chrome.runtime.onInstalled.addListener(syncJwt);
chrome.runtime.onStartup.addListener(syncJwt);
setInterval(syncJwt, 5000);

// 💡 Слушаем сообщения от content-script — вот единственный актуальный способ мониторинга запросов
chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "odds-update") {
        addLog("Обновление пришло (GetOddsStates): фризов не обнаружено");
    }
});

// Логируем прямые запросы GetOddsStates
chrome.webRequest.onCompleted.addListener(
    () => addLog("GetOddsStates request completed"),
    { urls: ["https://sb2frontend-altenar2.biahosted.com/api/Widget/GetOddsStates*"] }
);
