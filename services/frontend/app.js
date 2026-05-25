(function () {
  const config = window.SNEAKERTAIL_CONFIG || {};
  const catalogApis = [config.catalogApi || '/catalog-api', config.fallbackCatalogApi || 'http://localhost:4001'];
  const cartApis = [config.cartApi || '/cart-api', config.fallbackCartApi || 'http://localhost:4002'];

  const fallbackProducts = [
    {
      id: 'air-stride-neo',
      name: 'Air Stride Neo',
      brand: 'Nike',
      category: 'Running',
      description: 'Responsive everyday runner with a sculpted foam midsole.',
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
      priceCents: 14900,
      stock: 24,
      isFeatured: true
    },
    {
      id: 'court-legacy-pro',
      name: 'Court Legacy Pro',
      brand: 'Adidas',
      category: 'Lifestyle',
      description: 'Clean court profile with a premium leather upper.',
      imageUrl: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80',
      priceCents: 12900,
      stock: 18,
      isFeatured: true
    },
    {
      id: 'retro-high-77',
      name: 'Retro High 77',
      brand: 'Converse',
      category: 'High Tops',
      description: 'Vintage-inspired high top with cushioned street comfort.',
      imageUrl: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80',
      priceCents: 9900,
      stock: 15,
      isFeatured: true
    }
  ];

  const state = {
    products: fallbackProducts,
    selectedCategory: 'All',
    query: '',
    cart: { items: [], totalCents: 0 },
    featuredIndex: 0,
    token: localStorage.getItem('sneakertail-token') || '',
    user: JSON.parse(localStorage.getItem('sneakertail-user') || 'null')
  };

  const elements = {
    views: document.querySelectorAll('.view'),
    notice: document.getElementById('notice'),
    homeButton: document.getElementById('homeButton'),
    authNavButton: document.getElementById('authNavButton'),
    heroLoginButton: document.getElementById('heroLoginButton'),
    cartNavButton: document.getElementById('cartNavButton'),
    userLabel: document.getElementById('userLabel'),
    cartCount: document.getElementById('cartCount'),
    searchInput: document.getElementById('searchInput'),
    clearFiltersButton: document.getElementById('clearFiltersButton'),
    featuredTrack: document.getElementById('featuredTrack'),
    previousFeatured: document.getElementById('previousFeatured'),
    nextFeatured: document.getElementById('nextFeatured'),
    categoryRail: document.getElementById('categoryRail'),
    productGrid: document.getElementById('productGrid'),
    catalogTitle: document.getElementById('catalogTitle'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    cartItems: document.getElementById('cartItems'),
    cartTotal: document.getElementById('cartTotal'),
    checkoutItems: document.getElementById('checkoutItems'),
    checkoutTotal: document.getElementById('checkoutTotal'),
    continueShoppingButton: document.getElementById('continueShoppingButton'),
    goCheckoutButton: document.getElementById('goCheckoutButton'),
    backToCartButton: document.getElementById('backToCartButton'),
    checkoutForm: document.getElementById('checkoutForm'),
    customerEmail: document.getElementById('customerEmail'),
    cardNumber: document.getElementById('cardNumber'),
    successMessage: document.getElementById('successMessage'),
    successShopButton: document.getElementById('successShopButton')
  };

  function money(cents) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function setNotice(message, type = 'info') {
    elements.notice.textContent = message || '';
    elements.notice.dataset.type = type;
  }

  function joinUrl(baseUrl, path) {
    return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
      throw new Error(payload?.error || `Request failed with ${response.status}`);
    }

    if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'data')) {
      throw new Error('API response was not valid JSON data');
    }

    return payload;
  }

  async function requestFrom(baseUrls, path, options = {}) {
    const errors = [];

    for (const baseUrl of baseUrls) {
      try {
        return await request(joinUrl(baseUrl, path), options);
      } catch (error) {
        errors.push(error.message);
      }
    }

    throw new Error(errors[errors.length - 1] || 'API request failed');
  }

  function authHeaders() {
    return state.token ? { Authorization: `Bearer ${state.token}` } : {};
  }

  function jsonOptions(body, includeAuth = false) {
    return {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(includeAuth ? authHeaders() : {})
      },
      body: JSON.stringify(body)
    };
  }

  function showView(viewId) {
    elements.views.forEach((view) => view.classList.toggle('active', view.id === viewId));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function saveAuth(data) {
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('sneakertail-token', state.token);
    localStorage.setItem('sneakertail-user', JSON.stringify(state.user));
    renderAuth();
  }

  function logout() {
    state.token = '';
    state.user = null;
    state.cart = { items: [], totalCents: 0 };
    localStorage.removeItem('sneakertail-token');
    localStorage.removeItem('sneakertail-user');
    renderAuth();
    renderCart();
    setNotice('Logged out.');
    showView('storeView');
  }

  function renderAuth() {
    elements.userLabel.textContent = state.user ? state.user.name : 'Guest';
    elements.authNavButton.textContent = state.user ? 'Logout' : 'Login';
    elements.heroLoginButton.textContent = state.user ? 'View cart' : 'Login to buy';
    if (state.user && !elements.customerEmail.value) {
      elements.customerEmail.value = state.user.email;
    }
  }

  async function loadProducts() {
    try {
      const payload = await requestFrom(catalogApis, '/api/products');
      state.products = Array.isArray(payload.data) ? payload.data : fallbackProducts;
      setNotice('');
    } catch (error) {
      state.products = fallbackProducts;
      setNotice('Using demo catalog until the Catalog API is reachable.', 'warn');
    }

    renderStore();
  }

  async function loadCart() {
    if (!state.token) {
      state.cart = { items: [], totalCents: 0 };
      renderCart();
      return;
    }

    try {
      const payload = await requestFrom(cartApis, '/api/cart/current', { headers: authHeaders() });
      state.cart = payload.data || { items: [], totalCents: 0 };
      setNotice('');
    } catch (error) {
      setNotice(error.message, 'warn');
    }

    renderCart();
  }

  function categories() {
    return ['All', ...new Set(state.products.map((product) => product.category))];
  }

  function featuredProducts() {
    const featured = state.products.filter((product) => product.isFeatured);
    return featured.length ? featured : state.products.slice(0, 3);
  }

  function visibleProducts() {
    return state.products.filter((product) => {
      const q = state.query;
      const matchesCategory = state.selectedCategory === 'All' || product.category === state.selectedCategory;
      const matchesQuery = !q
        || product.name.toLowerCase().includes(q)
        || product.brand.toLowerCase().includes(q)
        || product.category.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }

  function renderFeatured() {
    const featured = featuredProducts();
    state.featuredIndex = Math.min(state.featuredIndex, Math.max(featured.length - 1, 0));
    elements.featuredTrack.innerHTML = featured.map((product) => `
      <article class="featured-slide">
        <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" />
        <div>
          <span>${escapeHtml(product.brand)}</span>
          <strong>${escapeHtml(product.name)}</strong>
          <small>${money(product.priceCents)}</small>
        </div>
      </article>
    `).join('');
    elements.featuredTrack.style.transform = `translateY(-${state.featuredIndex * 100}%)`;
  }

  function moveFeatured(direction) {
    const total = featuredProducts().length;
    if (!total) return;
    state.featuredIndex = (state.featuredIndex + direction + total) % total;
    renderFeatured();
  }

  function renderCategories() {
    elements.categoryRail.innerHTML = categories().map((category) => `
      <button class="category-chip ${category === state.selectedCategory ? 'active' : ''}" type="button" data-category="${escapeHtml(category)}">
        ${escapeHtml(category)}
      </button>
    `).join('');
  }

  function renderProducts() {
    const products = visibleProducts();
    elements.catalogTitle.textContent = state.selectedCategory === 'All' ? 'All Shoes' : `${state.selectedCategory} Shoes`;

    if (!products.length) {
      elements.productGrid.innerHTML = '<p class="empty-state">No sneakers match your filters.</p>';
      return;
    }

    elements.productGrid.innerHTML = products.map((product) => `
      <article class="product-card">
        <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" />
        <div class="product-body">
          <span>${escapeHtml(product.brand)} / ${escapeHtml(product.category)}</span>
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.description)}</p>
          <div class="product-actions">
            <strong>${money(product.priceCents)}</strong>
            <button class="primary-button small" type="button" data-add-product="${escapeHtml(product.id)}" ${product.stock ? '' : 'disabled'}>
              ${state.user ? 'Add to cart' : 'Login to add'}
            </button>
          </div>
        </div>
      </article>
    `).join('');
  }

  function renderCart() {
    const items = state.cart.items || [];
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    elements.cartCount.textContent = count;
    elements.cartTotal.textContent = money(state.cart.totalCents);
    elements.checkoutTotal.textContent = money(state.cart.totalCents);
    elements.goCheckoutButton.disabled = !items.length;

    if (!items.length) {
      elements.cartItems.innerHTML = '<p class="empty-state">Your cart is empty.</p>';
      elements.checkoutItems.innerHTML = '<p class="empty-state">No items yet.</p>';
      return;
    }

    elements.cartItems.innerHTML = items.map((item) => `
      <article class="cart-row">
        <div>
          <h3>${escapeHtml(item.productName)}</h3>
          <p>${money(item.unitPriceCents)} each</p>
        </div>
        <div class="quantity-controls">
          <button type="button" data-item-id="${escapeHtml(item.id)}" data-quantity="${item.quantity - 1}">-</button>
          <strong>${item.quantity}</strong>
          <button type="button" data-item-id="${escapeHtml(item.id)}" data-quantity="${item.quantity + 1}">+</button>
        </div>
        <strong>${money(item.unitPriceCents * item.quantity)}</strong>
      </article>
    `).join('');

    elements.checkoutItems.innerHTML = items.map((item) => `
      <div class="summary-row">
        <span>${escapeHtml(item.productName)} x ${item.quantity}</span>
        <strong>${money(item.unitPriceCents * item.quantity)}</strong>
      </div>
    `).join('');
  }

  function renderStore() {
    renderFeatured();
    renderCategories();
    renderProducts();
  }

  async function addToCart(productId) {
    if (!state.token) {
      setNotice('Please log in or register before adding items to cart.', 'warn');
      showView('authView');
      return;
    }

    try {
      const payload = await requestFrom(cartApis, '/api/cart/current/items', jsonOptions({ productId, quantity: 1 }, true));
      state.cart = payload.data;
      renderCart();
      setNotice('Added to cart.');
      showView('cartView');
    } catch (error) {
      setNotice(error.message, 'warn');
    }
  }

  async function updateQuantity(itemId, quantity) {
    try {
      const payload = await requestFrom(cartApis, `/api/cart/current/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ quantity })
      });
      state.cart = payload.data;
      renderCart();
    } catch (error) {
      setNotice(error.message, 'warn');
    }
  }

  async function login(event) {
    event.preventDefault();
    try {
      const payload = await requestFrom(cartApis, '/api/auth/login', jsonOptions({
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPassword').value
      }));
      saveAuth(payload.data);
      await loadCart();
      setNotice(`Welcome back, ${payload.data.user.name}.`);
      showView('storeView');
    } catch (error) {
      setNotice(error.message, 'warn');
    }
  }

  async function register(event) {
    event.preventDefault();
    try {
      const payload = await requestFrom(cartApis, '/api/auth/register', jsonOptions({
        name: document.getElementById('registerName').value,
        email: document.getElementById('registerEmail').value,
        password: document.getElementById('registerPassword').value
      }));
      saveAuth(payload.data);
      await loadCart();
      setNotice(`Account created. Welcome, ${payload.data.user.name}.`);
      showView('storeView');
    } catch (error) {
      setNotice(error.message, 'warn');
    }
  }

  async function checkout(event) {
    event.preventDefault();

    try {
      const payload = await requestFrom(cartApis, '/api/cart/current/checkout', jsonOptions({
        customerEmail: elements.customerEmail.value,
        cardholderName: document.getElementById('cardholderName').value,
        cardNumber: elements.cardNumber.value,
        expiry: document.getElementById('cardExpiry').value,
        cvv: document.getElementById('cardCvv').value
      }, true));

      const order = payload.data;
      elements.successMessage.textContent = `Order ${order.id.slice(0, 8)} accepted for ${order.customerEmail}. Paid with card ending ${order.cardLast4}.`;
      state.cart = { items: [], totalCents: 0 };
      renderCart();
      showView('successView');
    } catch (error) {
      setNotice(error.message, 'warn');
    }
  }

  function wireEvents() {
    elements.homeButton.addEventListener('click', () => showView('storeView'));
    elements.previousFeatured.addEventListener('click', () => moveFeatured(-1));
    elements.nextFeatured.addEventListener('click', () => moveFeatured(1));
    elements.heroLoginButton.addEventListener('click', () => showView(state.user ? 'cartView' : 'authView'));
    elements.cartNavButton.addEventListener('click', () => showView(state.user ? 'cartView' : 'authView'));
    elements.continueShoppingButton.addEventListener('click', () => showView('storeView'));
    elements.backToCartButton.addEventListener('click', () => showView('cartView'));
    elements.successShopButton.addEventListener('click', () => showView('storeView'));
    elements.goCheckoutButton.addEventListener('click', () => showView(state.cart.items?.length ? 'checkoutView' : 'cartView'));
    elements.authNavButton.addEventListener('click', () => {
      if (state.user) {
        logout();
      } else {
        showView('authView');
      }
    });

    elements.searchInput.addEventListener('input', (event) => {
      state.query = event.target.value.trim().toLowerCase();
      renderProducts();
    });

    elements.clearFiltersButton.addEventListener('click', () => {
      state.selectedCategory = 'All';
      state.query = '';
      elements.searchInput.value = '';
      renderCategories();
      renderProducts();
    });

    elements.categoryRail.addEventListener('click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      state.selectedCategory = button.dataset.category;
      renderCategories();
      renderProducts();
    });

    elements.productGrid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-add-product]');
      if (!button) return;
      addToCart(button.dataset.addProduct);
    });

    elements.cartItems.addEventListener('click', (event) => {
      const button = event.target.closest('[data-item-id]');
      if (!button) return;
      updateQuantity(button.dataset.itemId, Number(button.dataset.quantity));
    });

    elements.loginForm.addEventListener('submit', login);
    elements.registerForm.addEventListener('submit', register);
    elements.checkoutForm.addEventListener('submit', checkout);

    elements.cardNumber.addEventListener('input', (event) => {
      event.target.value = event.target.value
        .replace(/\D/g, '')
        .replace(/(.{4})/g, '$1 ')
        .trim()
        .slice(0, 19);
    });
  }

  wireEvents();
  renderAuth();
  renderStore();
  loadProducts();
  loadCart();
})();
