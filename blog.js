/**
 * BOPS blog magazine filters — reads posts.json when present.
 * Ghost-inspired (static): tag chips, search, author filter.
 */
(function () {
  'use strict';

  var FEED = './posts.json';
  var posts = [];
  var activeTag = 'all';
  var query = '';

  var elGrid = document.getElementById('blog-grid');
  var elTags = document.getElementById('blog-tags');
  var elSearch = document.getElementById('blog-search');
  var elEmpty = document.getElementById('blog-empty');
  var elCount = document.getElementById('blog-count');
  var elStatus = document.getElementById('blog-feed-status');

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function card(p) {
    var cat = esc(p.category || 'Guides');
    var date = esc(p.date || '');
    var title = esc(p.title || 'Untitled');
    var desc = esc(p.description || '');
    var path = esc(p.path || '#');
    var author = esc(p.author || 'Board of Project Stewardship Editorial');
    var slug = esc(p.slug || '');
    return (
      '<article class="bg-charcoal border border-white/5 hover:border-primary/30 p-6 rounded-xl card-hover" data-category="' +
      cat +
      '" data-slug="' +
      slug +
      '">' +
      '<div class="text-[11px] uppercase tracking-widest text-secondary font-bold mb-2">' +
      cat +
      ' · ' +
      date +
      '</div>' +
      '<h2 class="text-xl font-bold text-white mb-2"><a href="' +
      path +
      '" class="hover:text-secondary transition">' +
      title +
      '</a></h2>' +
      '<p class="text-sm text-slate-400 font-light leading-relaxed mb-4">' +
      desc +
      '</p>' +
      '<p class="text-xs text-slate-500">By ' +
      author +
      '</p>' +
      '</article>'
    );
  }

  function uniqueTags(list) {
    var set = {};
    list.forEach(function (p) {
      var c = (p.category || 'Guides').trim();
      if (c) set[c] = true;
    });
    return Object.keys(set).sort();
  }

  function renderTags() {
    if (!elTags) return;
    var tags = uniqueTags(posts);
    var html =
      '<button type="button" data-tag="all" class="blog-tag px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest border transition ' +
      (activeTag === 'all'
        ? 'bg-primary/30 border-secondary text-secondary'
        : 'bg-white/5 border-white/10 text-slate-400 hover:border-secondary/50 hover:text-secondary') +
      '">All</button>';
    tags.forEach(function (t) {
      var on = activeTag === t;
      html +=
        '<button type="button" data-tag="' +
        esc(t) +
        '" class="blog-tag px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest border transition ' +
        (on
          ? 'bg-primary/30 border-secondary text-secondary'
          : 'bg-white/5 border-white/10 text-slate-400 hover:border-secondary/50 hover:text-secondary') +
        '">' +
        esc(t) +
        '</button>';
    });
    elTags.innerHTML = html;
    elTags.querySelectorAll('.blog-tag').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeTag = btn.getAttribute('data-tag') || 'all';
        renderTags();
        renderGrid();
      });
    });
  }

  function filtered() {
    var q = query.trim().toLowerCase();
    return posts.filter(function (p) {
      var cat = (p.category || '').trim();
      if (activeTag !== 'all' && cat !== activeTag) return false;
      if (!q) return true;
      var hay = [p.title, p.description, p.category, p.slug, p.author]
        .join(' ')
        .toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function renderGrid() {
    if (!elGrid) return;
    var list = filtered();
    if (elCount) {
      elCount.textContent =
        list.length + (list.length === 1 ? ' article' : ' articles');
    }
    if (!list.length) {
      elGrid.innerHTML = '';
      if (elEmpty) elEmpty.classList.remove('hidden');
      return;
    }
    if (elEmpty) elEmpty.classList.add('hidden');
    elGrid.innerHTML = list.map(card).join('\n');
  }

  function useFallbackDom() {
    if (elStatus) {
      elStatus.textContent = 'Showing static index (feed unavailable).';
    }
    var articles = elGrid ? elGrid.querySelectorAll('article') : [];
    posts = [];
    articles.forEach(function (a) {
      var h = a.querySelector('h2 a');
      var meta = a.querySelector('[class*="tracking-widest"]');
      var desc = a.querySelector('p.text-sm');
      var by = a.querySelector('p.text-xs');
      var metaText = meta ? meta.textContent : '';
      var parts = metaText.split('\u00b7');
      var catAttr = a.getAttribute('data-category');
      var slugAttr = a.getAttribute('data-slug');
      posts.push({
        title: h ? h.textContent.trim() : '',
        path: h ? h.getAttribute('href') : '#',
        description: desc ? desc.textContent.trim() : '',
        category: (catAttr || (parts[0] || 'Guides')).trim(),
        date: (parts[1] || '').trim(),
        author: by ? by.textContent.replace(/^By\s+/i, '').trim() : '',
        slug: slugAttr || '',
      });
    });
    renderTags();
    renderGrid();
  }

  function boot(data) {
    posts = Array.isArray(data) ? data.slice() : [];
    posts.sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
    if (elStatus) {
      elStatus.textContent =
        posts.length + ' published · open magazine · reviewed before live';
    }
    renderTags();
    renderGrid();
  }

  if (elSearch) {
    elSearch.addEventListener('input', function () {
      query = elSearch.value || '';
      renderGrid();
    });
  }

  if (!elGrid) return;

  fetch(FEED, { credentials: 'same-origin' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(boot)
    .catch(function () {
      useFallbackDom();
    });
})();