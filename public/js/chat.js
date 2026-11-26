(function () {
  const panel = document.querySelector('[data-chat-id]');
  const log = document.getElementById('chat-log');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-body');
  if (!panel || !log || !form || !input) return;

  const chatId = panel.getAttribute('data-chat-id');
  let lastId = Number(panel.getAttribute('data-last-id')) || 0;

  function append(message) {
    const empty = document.getElementById('chat-empty');
    if (empty) empty.remove();
    if (log.querySelector('[data-id="' + message.id + '"]')) return;
    const article = document.createElement('article');
    article.className = 'bubble' + (message.mine ? ' mine' : '');
    article.setAttribute('data-id', String(message.id));
    const who = document.createElement('div');
    who.className = 'who';
    who.textContent = '@' + message.fromUsername + ' · ' + message.createdAt;
    const body = document.createElement('p');
    body.textContent = message.body;
    article.appendChild(who);
    article.appendChild(body);
    log.appendChild(article);
    log.scrollTop = log.scrollHeight;
    if (message.id > lastId) lastId = message.id;
  }

  async function pull() {
    const response = await fetch('/chats/' + chatId + '/messages?after=' + lastId, {
      headers: { accept: 'application/json' }
    });
    if (!response.ok) return;
    const data = await response.json();
    (data.messages || []).forEach(append);
  }

  form.addEventListener('submit', async function (event) {
    const body = input.value.trim();
    if (!body) return;
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ body: body })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send.');
      append(data.message);
      input.value = '';
    } catch (error) {
      window.alert(error.message || 'Could not send that message.');
    } finally {
      button.disabled = false;
      input.focus();
    }
  });

  log.scrollTop = log.scrollHeight;
  setInterval(function () {
    pull().catch(function () {});
  }, 4000);
})();
