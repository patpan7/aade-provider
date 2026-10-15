/**
 * Client-side router (pushState) for AADE myDATA Provider
 * Loads page templates via XHR and renders them inside #page-content.
 * Each template must be a self-contained Alpine component wrapped in a <div>.
 */
(() => {
  const ROUTES = {
    '/':         { title: 'Dashboard',          roles: ['SUPER_ADMIN','RESELLER_ADMIN','CLIENT_ADMIN','USER'] },
    '/invoices': { title: 'Invoices',           roles: ['SUPER_ADMIN','RESELLER_ADMIN','CLIENT_ADMIN','USER'] },
    '/issue':    { title: 'Issue Invoice',      roles: ['SUPER_ADMIN','RESELLER_ADMIN','CLIENT_ADMIN','USER'] },
    '/tenants':  { title: 'Tenants',            roles: ['SUPER_ADMIN','RESELLER_ADMIN'] },
    '/users':    { title: 'Users',              roles: ['SUPER_ADMIN','RESELLER_ADMIN','CLIENT_ADMIN'] },
    '/api-keys': { title: 'API Keys',           roles: ['SUPER_ADMIN','RESELLER_ADMIN','CLIENT_ADMIN'] },
    '/credits':  { title: 'Credits',            roles: ['SUPER_ADMIN','RESELLER_ADMIN','CLIENT_ADMIN'] },
    '/webhooks': { title: 'Webhooks',           roles: ['SUPER_ADMIN','RESELLER_ADMIN','CLIENT_ADMIN'] },
    '/resellers':{ title: 'Resellers',          roles: ['SUPER_ADMIN'] },
    '/audit':    { title: 'Audit Log',          roles: ['SUPER_ADMIN'] },
    '/settings': { title: 'Settings',           roles: ['SUPER_ADMIN'] },
  };

  // Sidebar menu items (in order)
  const MENU_ITEMS = [
    { path: '/',          label: 'Dashboard',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { path: '/invoices',  label: 'Invoices',    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { path: '/issue',     label: 'Issue Invoice',icon: 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-3m-4 0H7m4 0v12m0 0l4-4m-4 4l-4-4' },
    { path: '/tenants',   label: 'Tenants',     icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { path: '/users',     label: 'Users',       icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { path: '/api-keys',  label: 'API Keys',    icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
    { path: '/credits',   label: 'Credits',     icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { path: '/webhooks',  label: 'Webhooks',    icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
    { path: '/resellers', label: 'Resellers',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { path: '/audit',     label: 'Audit Log',   icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { path: '/settings',  label: 'Settings',    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  ];

  let currentPage = '/';

  // Page components are registered by the pages.js module. The initial route
  // can finish fetching before that module has executed, so wait before Alpine
  // evaluates the template's x-data expression.
  function waitForPageComponents() {
    if (window.__pagesLoaded || window.dashboardPage) {
      console.log('[routes] pages loaded, __pagesLoaded=', !!window.__pagesLoaded, 'dashboardPage=', !!window.dashboardPage);
      return Promise.resolve();
    }
    console.log('[routes] waiting for pages... __pagesLoaded=', !!window.__pagesLoaded, 'dashboardPage=', !!window.dashboardPage);
    return new Promise(resolve => {
      const check = () => {
        if (window.__pagesLoaded || window.dashboardPage) {
          console.log('[routes] pages ready via poll');
          resolve();
          return;
        }
        setTimeout(check, 100);
      };
      check();
    });
  }

  function currentRole() {
    return window.__dashboard?.currentUser?.role || null;
  }

  function isAllowed(path) {
    const route = ROUTES[path];
    if (!route || !route.roles || route.roles.length === 0) return true;
    const role = currentRole();
    return !!role && route.roles.includes(role);
  }

  async function navigate(path) {
    let target = path;
    if (!ROUTES[target] || !isAllowed(target)) target = '/';
    history.pushState({ path: target }, '', target);
    await loadPage(target, ROUTES[target]);
  }

  async function loadPage(path, route) {
    currentPage = path;
    document.title = (route?.title || 'AADE myDATA') + ' — Provider';

    // Update sidebar active state
    document.querySelectorAll('.nav-link').forEach(el => {
      const isActive = el.dataset.path === path;
      ['bg-blue-700/40', 'border-l-2', 'border-blue-400'].forEach(className => {
        el.classList.toggle(className, isActive);
      });
      el.classList.toggle('text-gray-300', el.dataset.path === path);
      el.classList.toggle('text-gray-400', el.dataset.path !== path);
    });

    // Show loading
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="flex items-center justify-center h-64"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div></div>`;

    try {
      const file = path === '/' ? '/pages/dashboard.html' : '/pages' + path + '.html';
      // Use no-cache fetch to avoid stale HTML
      const resp = await fetch(file + (file.includes('?') ? '&' : '?') + '_t=' + Date.now());
      console.log('[routes] fetch', file, 'status=', resp.status, 'ok=', resp.ok);
      if (!resp.ok) throw new Error('Not found: ' + file);
      const html = await resp.text();
      console.log('[routes] html loaded, length=', html.length, 'dashboardPage=', !!window.dashboardPage);
      await waitForPageComponents();
      content.innerHTML = html;
      console.log('[routes] innerHTML set, Alpine=', !!(window.Alpine && Alpine.initTree));
      // Compile any Alpine components in the loaded template
      if (window.Alpine && Alpine.initTree) {
        try {
          Alpine.initTree(content);
          console.log('[routes] Alpine.initTree done');
        } catch (e) {
          console.error('[routes] Alpine.initTree failed', e);
          content.innerHTML = `<div class="p-8 text-center text-red-400">Σφάλμα Alpine init<br><span class="text-xs">${e.message}</span></div>`;
        }
      } else {
        console.warn('[routes] Alpine not available');
        content.innerHTML = `<div class="p-8 text-center text-red-400">Alpine.js δεν φορτώθηκε<br><span class="text-xs">Έλεγχος internet για CDN</span></div>`;
      }
    } catch (e) {
      console.error('[routes] loadPage FAILED for', path, e);
      content.innerHTML = `<div class="p-8 text-center text-red-400">Σφάλμα φόρτωσης: ${path}<br><span class="text-xs text-gray-500">${e.message}</span><br><a href="#" onclick="location.reload()" class="text-blue-400 mt-4 inline-block">Reload</a></div>`;
    }
  }

  window.addEventListener('popstate', (e) => {
    let path = e.state?.path || location.pathname || '/';
    if (!ROUTES[path] || !isAllowed(path)) {
      path = '/';
      history.pushState({ path }, '', path);
    }
    loadPage(path, ROUTES[path]);
  });

  // Expose to global scope
  console.log('[routes] IIFE starting, page-components-ready exists?', typeof window.dispatchEvent !== 'undefined');
  window.navigate = navigate;
  window.currentPage = () => currentPage;

  // Initial load
  let initPath = location.pathname || '/';
  if (!ROUTES[initPath] || !isAllowed(initPath)) {
    if (ROUTES[initPath]) {
      history.replaceState({ path: '/' }, '', '/');
    }
    initPath = '/';
  }
  loadPage(initPath, ROUTES[initPath]);

  // Safety: if for any reason the page is stuck loading >30s, show error
  setTimeout(() => {
    const content = document.getElementById('page-content');
    if (content && content.querySelector('.animate-spin')) {
      content.innerHTML = `<div class="p-8 text-center text-red-400">Φόρτωση σελίδας — περίμενε ή κάνε hard refresh (Ctrl+Shift+R)<br><span class="text-xs text-gray-500">Αν συνεχίζει, άνοιξε Console (F12)</span></div>`;
    }
  }, 30000);
})();
