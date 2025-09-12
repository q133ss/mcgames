const inject = (file) => {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL(file);
    (document.head || document.documentElement).appendChild(s);
    s.onload = () => s.remove();
};

inject('config.js');
inject('injected.js');
