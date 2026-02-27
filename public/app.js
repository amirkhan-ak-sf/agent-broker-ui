(function () {
  const CONFIG_KEY = 'agent-broker-config';
  const DEFAULT_BROKER_URL = 'https://agent-network-ingress-gw-b2jb0y.1d6nel.usa-e1.cloudhub.io/clinical-trial-broker/';
  const DEFAULT_API_INSTANCE_ID = '20551771';

  function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        const c = JSON.parse(raw);
        return {
          brokerUrl: c.brokerUrl || DEFAULT_BROKER_URL,
          apiInstanceId: c.apiInstanceId ?? DEFAULT_API_INSTANCE_ID
        };
      }
    } catch (_) {}
    return { brokerUrl: DEFAULT_BROKER_URL, apiInstanceId: DEFAULT_API_INSTANCE_ID };
  }

  function setConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  function extractBrokerResponse(data) {
    const result = data?.result;
    let text = '';
    const artifacts = result?.artifacts || [];
    for (let i = 0; i < artifacts.length; i++) {
      const parts = artifacts[i].parts || [];
      for (let j = 0; j < parts.length; j++) {
        if (parts[j].kind === 'text' && parts[j].text) {
          text += (text ? '\n\n' : '') + parts[j].text;
        }
      }
    }
    if (!text) text = '(No text in response.)';
    return {
      text,
      state: result?.status?.state ?? '—',
      timestamp: result?.status?.timestamp ?? '—'
    };
  }

  const chatMessages = document.getElementById('chat-messages');
  const chatEmpty = document.getElementById('chat-empty');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-send');
  const btnSettings = document.getElementById('btn-settings');
  const openSettingsFromEmpty = document.getElementById('open-settings-from-empty');
  const configDialog = document.getElementById('config-dialog');
  const configForm = document.getElementById('config-form');
  const configBrokerUrl = document.getElementById('config-broker-url');
  const configApiInstanceId = document.getElementById('config-api-instance-id');
  const configCancel = document.getElementById('config-cancel');

  function hideEmpty() {
    chatEmpty.classList.add('hidden');
  }

  function showEmpty() {
    chatEmpty.classList.remove('hidden');
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function appendMessage(role, content, meta) {
    hideEmpty();
    const wrap = document.createElement('div');
    wrap.className = 'msg-wrap msg-wrap--' + role;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble msg-bubble--' + role;

    if (meta && (meta.state || meta.timestamp)) {
      const metaEl = document.createElement('div');
      metaEl.className = 'msg-meta';
      if (meta.state) metaEl.appendChild(document.createElement('span')).appendChild(document.createTextNode('State: ' + meta.state));
      if (meta.timestamp) {
        const ts = document.createElement('span');
        ts.textContent = 'Timestamp: ' + meta.timestamp;
        if (metaEl.firstChild) metaEl.appendChild(document.createTextNode(' · '));
        metaEl.appendChild(ts);
      }
      bubble.appendChild(metaEl);
    }

    const body = document.createElement('div');
    body.className = 'msg-body';
    body.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
    bubble.appendChild(body);

    wrap.appendChild(bubble);
    chatMessages.appendChild(wrap);
    scrollToBottom();
  }

  function appendError(message) {
    hideEmpty();
    const wrap = document.createElement('div');
    wrap.className = 'msg-wrap msg-wrap--error';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble msg-bubble--error';
    bubble.textContent = message;
    wrap.appendChild(bubble);
    chatMessages.appendChild(wrap);
    scrollToBottom();
  }

  function appendProcessing() {
    hideEmpty();
    const wrap = document.createElement('div');
    wrap.className = 'msg-wrap msg-wrap--assistant msg-wrap--processing';
    wrap.setAttribute('data-processing', 'true');
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble msg-bubble--assistant msg-bubble--processing';
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = 'processing-text';
    text.textContent = 'Processing your request...';
    bubble.appendChild(spinner);
    bubble.appendChild(text);
    wrap.appendChild(bubble);
    chatMessages.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  function removeProcessing(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function setLoading(loading) {
    btnSend.disabled = loading;
    chatInput.disabled = loading;
  }

  chatForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    const config = getConfig();
    if (!config.brokerUrl) {
      appendError('Set your broker URL in Settings first.');
      configDialog.showModal();
      return;
    }

    chatInput.value = '';
    appendMessage('user', text);
    setLoading(true);
    const processingEl = appendProcessing();

    const payload = {
      jsonrpc: '2.0',
      id: Math.floor(Date.now() % 1e8),
      method: 'message/send',
      params: {
        message: {
          role: 'user',
          kind: 'message',
          parts: [{ kind: 'text', text: text }],
          messageId: crypto.randomUUID ? crypto.randomUUID() : 'msg-' + Date.now()
        },
        metadata: {}
      }
    };

    try {
      const res = await fetch('/api/broker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerUrl: config.brokerUrl,
          payload: payload,
          apiInstanceId: config.apiInstanceId || undefined
        })
      });

      const data = await res.json().catch(function () { return {}; });

      if (!res.ok) {
        appendError(data.error?.message || data.error || res.statusText || 'Request failed');
        setLoading(false);
        return;
      }

      if (data.error) {
        appendError(data.error.message || JSON.stringify(data.error));
        setLoading(false);
        return;
      }

      const { text: answerText, state, timestamp } = extractBrokerResponse(data);
      appendMessage('assistant', answerText, { state, timestamp });
    } catch (err) {
      appendError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  });

  function openConfig() {
    const config = getConfig();
    configBrokerUrl.value = config.brokerUrl;
    configApiInstanceId.value = config.apiInstanceId || '';
    configDialog.showModal();
  }

  function closeConfig() {
    configDialog.close();
  }

  btnSettings.addEventListener('click', openConfig);
  openSettingsFromEmpty.addEventListener('click', openConfig);

  configForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const brokerUrl = configBrokerUrl.value.trim();
    const apiInstanceId = configApiInstanceId.value.trim();
    if (!brokerUrl) return;
    setConfig({ brokerUrl, apiInstanceId: apiInstanceId || DEFAULT_API_INSTANCE_ID });
    closeConfig();
  });

  configCancel.addEventListener('click', closeConfig);
  configDialog.addEventListener('click', function (e) {
    if (e.target === configDialog) closeConfig();
  });
  configDialog.addEventListener('cancel', closeConfig);

  // Optional: auto-resize textarea
  chatInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });
})();
