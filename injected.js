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

function processApiResponse(url, data) {
    if (/\/api\/widget\/GetEvents/i.test(url)) {
        const markets = data.markets || data?.result?.markets;
        if (markets) {
            for (const market of markets) {
                if (market.odds?.length) {
                    STATE.targetMarketId = market.id;
                    STATE.targetOddId = market.odds[0].id;
                    addLog(`Found marketId=${market.id}, oddId=${market.odds[0].id}`);
                    chrome.storage.local.set({ auto_ids: { marketId: market.id, oddId: market.odds[0].id } });
                    break;
                }
            }
        }
        return;
    }

    if (/\/api\/widget\/getoddsstates/i.test(url)) {
        const oddStates = data.oddStates || data?.result?.oddStates;
        if (Array.isArray(oddStates)) {
            let found = false;
            for (const st of oddStates) {
                const id = st.id ?? st.oddId;
                const status = st.oddStatus ?? st.status;
                if (STATE.targetOddId && id === STATE.targetOddId && status === 0) {
                    addLog("Freeze detected for auto target: " + JSON.stringify(st));
                    placeBet();
                    found = true;
                }
            }
            if (!found) addLog("Обновление пришло: фризов не обнаружено");
        } else {
            addLog("GetOddsStates: пустой ответ");
        }
    }
}

const _fetch = window.fetch;
window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    const resp = await _fetch(input, init);
    resp.clone().json().then(data => processApiResponse(url, data)).catch(() => {});
    return resp;
};

const _open = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._url = url;
    return _open.call(this, method, url, ...args);
};
const _send = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(body) {
    this.addEventListener("load", function() {
        try {
            const data = JSON.parse(this.responseText);
            processApiResponse(this._url, data);
        } catch (e) {
            // ignore
        }
    });
    return _send.call(this, body);
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
