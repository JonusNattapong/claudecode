// Clew Docs — Mobile Nav & Helpers
(function () {
  'use strict';

  var menuBtn = document.getElementById('menuToggle');
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('sidebarOverlay');

  // Calculate relative root path dynamically from the script tag src
  var rootPrefix = '';
  var currentScript = document.currentScript;
  if (currentScript) {
    var scriptSrc = currentScript.getAttribute('src');
    if (scriptSrc && scriptSrc.indexOf('js/main.js') !== -1) {
      rootPrefix = scriptSrc.replace('js/main.js', '');
    }
  } else {
    // Fallback: check all script tags
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute('src');
      if (src && src.indexOf('js/main.js') !== -1) {
        rootPrefix = src.replace('js/main.js', '');
        break;
      }
    }
  }

  // Inject unified sidebar HTML template if the container exists
  if (sidebar) {
    sidebar.innerHTML =
      '<div class="sidebar-section">' +
      '  <div class="sidebar-label">Getting Started</div>' +
      '  <nav>' +
      '    <a href="' + rootPrefix + 'index.html" class="sidebar-link"><span class="link-icon"></span>Overview</a>' +
      '    <a href="' + rootPrefix + 'quick-start.html" class="sidebar-link"><span class="link-icon"></span>Quick Start</a>' +
      '    <a href="' + rootPrefix + 'installation.html" class="sidebar-link"><span class="link-icon"></span>Installation</a>' +
      '    <a href="' + rootPrefix + 'configuration.html" class="sidebar-link"><span class="link-icon"></span>Configuration</a>' +
      '    <a href="' + rootPrefix + 'cli-reference.html" class="sidebar-link"><span class="link-icon"></span>CLI Reference</a>' +
      '    <a href="' + rootPrefix + 'env-vars.html" class="sidebar-link"><span class="link-icon"></span>Environment Variables</a>' +
      '    <a href="' + rootPrefix + 'troubleshooting.html" class="sidebar-link"><span class="link-icon"></span>Troubleshooting</a>' +
      '    <a href="' + rootPrefix + 'errors.html" class="sidebar-link"><span class="link-icon"></span>Error Reference</a>' +
      '    <a href="' + rootPrefix + 'best-practices.html" class="sidebar-link"><span class="link-icon"></span>Best Practices</a>' +
      '    <a href="' + rootPrefix + 'glossary.html" class="sidebar-link"><span class="link-icon"></span>Glossary</a>' +
      '    <a href="' + rootPrefix + 'changelog.html" class="sidebar-link"><span class="link-icon"></span>Changelog</a>' +
      '  </nav>' +
      '</div>' +
      '<div class="sidebar-section">' +
      '  <div class="sidebar-label">Core Concepts</div>' +
      '  <nav>' +
      '    <a href="' + rootPrefix + 'providers.html" class="sidebar-link"><span class="link-icon"></span>Providers</a>' +
      '    <a href="' + rootPrefix + 'models.html" class="sidebar-link"><span class="link-icon"></span>Models</a>' +
      '    <a href="' + rootPrefix + 'commands.html" class="sidebar-link"><span class="link-icon"></span>Commands</a>' +
      '    <a href="' + rootPrefix + 'tools.html" class="sidebar-link"><span class="link-icon"></span>Tools</a>' +
      '    <a href="' + rootPrefix + 'context-window.html" class="sidebar-link"><span class="link-icon"></span>Context Window</a>' +
      '    <a href="' + rootPrefix + 'sessions.html" class="sidebar-link"><span class="link-icon"></span>Sessions</a>' +
      '    <a href="' + rootPrefix + 'keybindings.html" class="sidebar-link"><span class="link-icon"></span>Keybindings</a>' +
      '    <a href="' + rootPrefix + 'permission-model.html" class="sidebar-link"><span class="link-icon"></span>Permission Model</a>' +
      '    <a href="' + rootPrefix + 'sandbox-security.html" class="sidebar-link"><span class="link-icon"></span>Sandbox & Security</a>' +
      '  </nav>' +
      '</div>' +
      '<div class="sidebar-section">' +
      '  <div class="sidebar-label">Extending</div>' +
      '  <nav>' +
      '    <a href="' + rootPrefix + 'plugins.html" class="sidebar-link"><span class="link-icon"></span>Plugins</a>' +
      '    <a href="' + rootPrefix + 'skills.html" class="sidebar-link"><span class="link-icon"></span>Skills</a>' +
      '    <a href="' + rootPrefix + 'hooks.html" class="sidebar-link"><span class="link-icon"></span>Hooks</a>' +
      '    <a href="' + rootPrefix + 'architecture.html" class="sidebar-link"><span class="link-icon"></span>Architecture</a>' +
      '    <a href="' + rootPrefix + 'mcp.html" class="sidebar-link"><span class="link-icon"></span>MCP</a>' +
      '  </nav>' +
      '</div>' +
      '<div class="sidebar-section">' +
      '  <div class="sidebar-label">Autonomous</div>' +
      '  <nav>' +
      '    <a href="' + rootPrefix + 'daemon.html" class="sidebar-link"><span class="link-icon"></span>Daemon Mode</a>' +
      '    <a href="' + rootPrefix + 'agent-teams.html" class="sidebar-link"><span class="link-icon"></span>Agent Teams</a>' +
      '    <a href="' + rootPrefix + 'scheduled-tasks.html" class="sidebar-link"><span class="link-icon"></span>Scheduled Tasks</a>' +
      '    <a href="' + rootPrefix + 'worktrees.html" class="sidebar-link"><span class="link-icon"></span>Worktrees</a>' +
      '  </nav>' +
      '</div>' +
      '<div class="sidebar-section">' +
      '  <div class="sidebar-label">Features</div>' +
      '  <nav>' +
      '    <a href="' + rootPrefix + 'research-memory.html" class="sidebar-link"><span class="link-icon"></span>Research & Memory</a>' +
      '    <a href="' + rootPrefix + 'features/searxng-search.html" class="sidebar-link"><span class="link-icon"></span>SearXNG Search</a>' +
      '    <a href="' + rootPrefix + 'features/bridge-mode.html" class="sidebar-link"><span class="link-icon"></span>Bridge Mode</a>' +
      '    <a href="' + rootPrefix + 'features/evals.html" class="sidebar-link"><span class="link-icon"></span>Evaluation Harness</a>' +
      '    <a href="' + rootPrefix + 'features/sentry-setup.html" class="sidebar-link"><span class="link-icon"></span>Sentry Setup</a>' +
      '  </nav>' +
      '</div>' +
      '<div class="sidebar-section">' +
      '  <div class="sidebar-label">Internals</div>' +
      '  <nav>' +
      '    <a href="' + rootPrefix + 'internals/hidden-features.html" class="sidebar-link"><span class="link-icon"></span>Hidden Features</a>' +
      '    <a href="' + rootPrefix + 'internals/growthbook-ab-testing.html" class="sidebar-link"><span class="link-icon"></span>A/B Testing</a>' +
      '  </nav>' +
      '</div>';
  }

  function open() {
    if (sidebar) sidebar.classList.add('open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (sidebar) sidebar.classList.remove('open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (menuBtn) menuBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    sidebar && sidebar.classList.contains('open') ? close() : open();
  });

  if (overlay) overlay.addEventListener('click', close);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sidebar && sidebar.classList.contains('open')) close();
  });

  // Close sidebar on link click (mobile)
  if (sidebar) {
    sidebar.querySelectorAll('.sidebar-link').forEach(function (link) {
      link.addEventListener('click', close);
    });
  }

  // Wrap tables and <pre> in scroll containers
  function wrapScroll(el) {
    if (el.parentElement && el.parentElement.classList.contains('scroll-wrap')) return;
    var wrapper = document.createElement('div');
    wrapper.className = 'scroll-wrap';
    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);
  }

  document.querySelectorAll('.content table').forEach(wrapScroll);
  document.querySelectorAll('.content pre').forEach(wrapScroll);

  // Highlight active sidebar link
  var currentPath = window.location.pathname;
  var currentPage = currentPath.split('/').pop() || 'index.html';
  if (currentPage === '') currentPage = 'index.html';

  document.querySelectorAll('.sidebar-link').forEach(function (link) {
    var href = link.getAttribute('href');
    if (!href) return;
    var hrefPage = href.split('/').pop().split('#')[0];
    if (hrefPage === currentPage) link.classList.add('active');
  });

  // Highlight current page in header nav
  document.querySelectorAll('.header-nav a').forEach(function (link) {
    var href = link.getAttribute('href');
    if (!href) return;
    var hrefPage = href.split('/').pop().split('#')[0];
    if (hrefPage === currentPage) link.classList.add('active');
  });
})();
