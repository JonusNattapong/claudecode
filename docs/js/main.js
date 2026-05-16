// Claude Code Docs — Mobile Navigation & Responsive Helpers
(function () {
  'use strict';

  var menuToggle = document.querySelector('.menu-toggle');
  var sidebar = document.querySelector('.sidebar');
  var overlay = document.querySelector('.sidebar-overlay');
  var body = document.body;

  function openSidebar() {
    body.classList.add('sidebar-open');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'true');
    if (sidebar) sidebar.setAttribute('aria-hidden', 'false');
    if (overlay) overlay.style.display = '';
  }

  function closeSidebar() {
    body.classList.remove('sidebar-open');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    if (sidebar) sidebar.setAttribute('aria-hidden', 'true');
    if (overlay) overlay.style.display = 'none';
  }

  function toggleSidebar() {
    if (body.classList.contains('sidebar-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', toggleSidebar);
  }

  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && body.classList.contains('sidebar-open')) {
      closeSidebar();
    }
  });

  // Wrap tables and <pre> blocks in scroll containers
  function wrapScroll(el) {
    if (el.parentElement && el.parentElement.classList.contains('scroll-wrap')) {
      return;
    }
    var wrapper = document.createElement('div');
    wrapper.className = 'scroll-wrap';
    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);
  }

  document.querySelectorAll('.page-content table, .main-content table').forEach(wrapScroll);
  document.querySelectorAll('pre').forEach(wrapScroll);

  // Highlight active sidebar link based on current page
  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar-link').forEach(function (link) {
    var href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
})();