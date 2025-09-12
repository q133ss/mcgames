// Настройки окружения
const CONFIG = {
    environment: "prod", // "local" | "prod"

    local: {
        baseUrl: "http://localhost:8000",
        betEndpoint: "http://localhost:8000/api/widget/placeWidget",
        targetOddId: 2780516018,
        targetMarketId: 1141449109
    },

    prod: {
        baseUrl: "https://mcgames.bet.br",
        betEndpoint: "https://sb2betgateway-altenar2.biahosted.com/api/widget/placeWidget",
        targetOddId: null,      // заменить на актуальные
        targetMarketId: null    // заменить на актуальные
    }
};