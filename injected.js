let STATE = { auth: {}, targetOddId: null, targetMarketId: null };

function addLog(message) {
    chrome.storage.local.get({ logs: [] }, (res) => {
        const logs = [`[${new Date().toLocaleTimeString()}] ${message}`, ...res.logs].slice(0, 200);
        chrome.storage.local.set({ logs });
    });
}

async function refreshAuth() {
    const data = await chrome.storage.local.get("auth_data");
    STATE.auth = data.auth_data || {};
}
setInterval(refreshAuth, 3000);
refreshAuth();

// Перехватываем fetch, чтобы автоматически найти marketId и oddId
const _fetch = window.fetch;
window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;

    addLog("fetch url:" + url);

    // 1. Слушаем GetEvents
    if (/\/api\/widget\/GetEvents/i.test(url)) {
        const resp = await _fetch(input, init);
        const clone = resp.clone();
        clone.json().then(data => {
            if (data.markets && data.odds) {
                for (const market of data.markets) {
                    if (market.odds?.length) {
                        // Сохраняем первый открытый маркет
                        STATE.targetMarketId = market.id;
                        STATE.targetOddId = market.odds[0].id;
                        addLog(`Found marketId=${market.id}, oddId=${market.odds[0].id}`);
                        chrome.storage.local.set({
                            auto_ids: { marketId: market.id, oddId: market.odds[0].id }
                        });
                        break;
                    }
                }
            }
        }).catch(() => {});
        return resp;
    }

    // 2. Следим за обновлением коэффициентов и ставим при фризе
    if (/\/api\/widget\/getoddsstates/i.test(url)) {
        const resp = await _fetch(input, init);
        const data = await resp.clone().json().catch(() => null);

        if (data?.oddStates) {
            let found = false;
            for (const st of data.oddStates) {
                if (STATE.targetOddId && st.id === STATE.targetOddId && st.oddStatus === 0) {
                    addLog("Freeze detected for auto target: " + JSON.stringify(st));
                    placeBet();
                    found = true;
                }
            }
            if (!found) {
                addLog("Обновление пришло: фризов не обнаружено");
            }
        } else {
            addLog("GetOddsStates: пустой ответ");
        }

        return resp;
    }

    return _fetch(input, init);
};

function buildPlaceBody() {
    return {
        culture: "pt-BR",
        timezoneOffset: 180,
        integration: "mcgames2",
        deviceType: 1,
        numFormat: "en-GB",
        countryCode: "BR",
        betType: 0,
        isAutoCharge: false,
        stakes: [1],
        oddsChangeAction: 3,
        betMarkets: [
            {
                id: STATE.targetMarketId,
                isBanker: false,
                dbId: 10,
                sportName: "Futebol",
                rC: false,
                eventName: "Auto Event",
                catName: "Itália",
                champName: "Série A",
                sportTypeId: 1,
                odds: [
                    {
                        id: STATE.targetOddId,
                        marketId: STATE.targetMarketId,
                        price: 2.0,
                        marketName: "1x2",
                        marketTypeId: 1,
                        mostBalanced: false,
                        selectionTypeId: 1,
                        selectionName: "Auto",
                        widgetInfo: { widget: 20, page: 7 }
                    }
                ]
            }
        ],
        eachWays: [false],
        requestId: Date.now().toString(),
        confirmedByClient: false,
        device: 0
    };
}

async function placeBet() {
    const token = STATE.auth.token;
    if (!STATE.targetOddId || !STATE.targetMarketId) {
        addLog("No target ids found yet — cannot place bet");
        return;
    }
    addLog("Placing bet automatically...");
    const res = await fetch(CONFIG[CONFIG.environment].betEndpoint, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(buildPlaceBody())
    });
    addLog("Bet response: " + JSON.stringify(await res.json()));
}
