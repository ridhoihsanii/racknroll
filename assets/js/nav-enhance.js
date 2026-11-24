// Keyboard access + scroll-spy highlighting for the top/bottom navigation.
(function () {
  if (typeof document === 'undefined') return;

  function init() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.top-taskbar .sidebar-nav-item'));
    if (!items.length) return;

    var nav = document.querySelector('.top-taskbar');
    if (nav) nav.setAttribute('aria-label', 'Menu utama');

    items.forEach(function (item) {
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        }
      });
    });

    var sections = items
      .map(function (item) { return document.getElementById('section-' + item.dataset.section); })
      .filter(Boolean);
    var current = null;
    var ticking = false;
    var lockUntil = 0;

    // Keep the clicked tab active while the smooth scroll is still travelling.
    items.forEach(function (item) {
      item.addEventListener('click', function () { lockUntil = Date.now() + 1200; });
    });

    function update() {
      ticking = false;
      if (Date.now() < lockUntil) return;

      var offset = 90;
      var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      var activeSection = sections[0];
      sections.forEach(function (section) {
        if (section.getBoundingClientRect().top <= offset) activeSection = section;
      });
      if (atBottom) activeSection = sections[sections.length - 1];
      if (!activeSection || activeSection === current) return;

      current = activeSection;
      items.forEach(function (item) {
        item.classList.toggle('active', 'section-' + item.dataset.section === activeSection.id);
      });
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
