(function () {
  const root = document.querySelector('[data-location-combo]');
  const dataEl = document.getElementById('travel-locations');
  if (!root || !dataEl) return;

  const locations = JSON.parse(dataEl.textContent || '[]');
  const input = root.querySelector('.combo-input');
  const hidden = root.querySelector('input[name="region"]');
  const list = root.querySelector('.combo-list');
  let activeIndex = -1;
  let current = [];

  function filterLocations(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return locations.slice();
    return locations
      .map(function (location) {
        const label = location.label.toLowerCase();
        const keywords = String(location.keywords || '').toLowerCase();
        let score = 0;
        if (label.indexOf(q) === 0) score = 3;
        else if (label.indexOf(q) !== -1) score = 2;
        else if (keywords.indexOf(q) !== -1) score = 1;
        return score ? { location: location, score: score } : null;
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return b.score - a.score || a.location.label.localeCompare(b.location.label);
      })
      .map(function (item) {
        return item.location;
      });
  }

  function highlight(label, query) {
    const q = String(query || '').trim();
    const node = document.createElement('span');
    if (!q) {
      node.textContent = label;
      return node;
    }
    const lower = label.toLowerCase();
    const index = lower.indexOf(q.toLowerCase());
    if (index === -1) {
      node.textContent = label;
      return node;
    }
    node.append(document.createTextNode(label.slice(0, index)));
    const mark = document.createElement('mark');
    mark.textContent = label.slice(index, index + q.length);
    node.append(mark);
    node.append(document.createTextNode(label.slice(index + q.length)));
    return node;
  }

  function openList() {
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function closeList() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    activeIndex = -1;
  }

  function render(query) {
    current = filterLocations(query);
    list.replaceChildren();
    if (!current.length) {
      const empty = document.createElement('li');
      empty.className = 'combo-empty';
      empty.textContent = 'No matching locations';
      list.append(empty);
      openList();
      return;
    }
    current.forEach(function (location, index) {
      const option = document.createElement('li');
      option.className = 'combo-option';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-label', location.label);
      option.id = 'destination-option-' + index;
      option.setAttribute('aria-selected', index === activeIndex ? 'true' : 'false');
      option.append(highlight(location.label, query));
      option.addEventListener('mousedown', function (event) {
        event.preventDefault();
        choose(location);
      });
      list.append(option);
    });
    openList();
  }

  function move(delta) {
    if (!current.length) return;
    activeIndex = (activeIndex + delta + current.length) % current.length;
    render(input.value);
    const active = list.querySelector('[aria-selected="true"]');
    if (active) {
      input.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    }
  }

  function choose(location) {
    input.value = location.label;
    hidden.value = location.id;
    closeList();
  }

  function syncHidden() {
    const typed = input.value.trim().toLowerCase();
    const exact = locations.find(function (location) {
      return location.label.toLowerCase() === typed;
    });
    if (exact) {
      hidden.value = exact.id;
      input.value = exact.label;
      return;
    }
    if (!typed) hidden.value = '';
  }

  input.addEventListener('focus', function () {
    activeIndex = -1;
    render(input.value);
    setTimeout(function () {
      if (document.activeElement === input) render(input.value);
    }, 0);
  });

  input.addEventListener('input', function () {
    activeIndex = -1;
    hidden.value = '';
    render(input.value);
    syncHidden();
  });

  input.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (list.hidden) render(input.value);
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.hidden) render(input.value);
      move(-1);
    } else if (event.key === 'Enter' && !list.hidden && current.length) {
      event.preventDefault();
      const pick = current[activeIndex] || current[0];
      if (pick) choose(pick);
    } else if (event.key === 'Escape') {
      closeList();
    }
  });

  input.addEventListener('blur', function () {
    syncHidden();
    if (!hidden.value) input.value = '';
    closeList();
  });

  document.addEventListener('click', function (event) {
    const label = input.closest('label');
    if (root.contains(event.target) || (label && label.contains(event.target))) return;
    closeList();
  });
})();
