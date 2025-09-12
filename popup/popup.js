function updateLog() {
    chrome.storage.local.get({ logs: [] }, (res) => {
        document.getElementById('log').textContent = res.logs.join("\n");
    });
}
setInterval(updateLog, 1500);
updateLog();
