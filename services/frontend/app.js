(function () {
  const config = window.SNEAKERTAIL_CONFIG || {};
  const catalogApi = config.catalogApi || 'http://localhost:4001';
  const cartApi = config.cartApi || 'http://localhost:4002';

  const fallbackProducts = [
    {
      id: 'air-stride-neo',
      slug: 'air-stride-neo',
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
      slug: 'court-legacy-pro',
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
      slug: 'retro-high-77',
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
    featuredTimer: null,
    sessionId: getSessionId()
  };

  const elements = {
    featuredTrack: document.getElementById('featuredTrack'),
    previousFeatured: document.getElementById('previousFeatured'),
    nextFeatured: document.getElementById('nextFeatured'),
    categoryRail: document.getElementById('categoryRail'),
    productGrid: document.getElementById('productGrid'),
    catalogTitle: document.getElementById('catalogTitle'),
    notice: document.getElementById('notice'),
    searchInput: document.getElementById('searchInput'),
    clearFiltersButton: document.getElementById('clearFiltersButton'),
    cartCount: document.getElementById('cartCount'),
    cartDrawer: document.getElementById('cartDrawer'),
    cartItems: document.getElementById('cartItems'),
    cartTotal: document.getElementById('cartTotal'),
    scrim: document.getElementById('scrim'),
    openCartButton: document.getElementById('openCartButton'),
    closeCartButton: document.getElementById('closeCartButton'),
    heroCartButton: document.getElementById('heroCartButton'),
    checkoutForm: document.getElementById('checkoutForm'),
    checkoutButton: document.getElementById('checkoutButton'),
    customerEmail: document.getElementById('customerEmail')
  };

  function getSessionId() {
    const stored = localStorage.getItem('sneakertail-session');
    if (stored) return stored;
    const next = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem('sneakertail-session', next);
    return next;
  }

  function money(cents) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format((cents || 0) / 100);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function setNotice(message) {
    elements.notice.textContent = message || '';
  }

  async function request(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || `Request failed with ${response.status}`);
    }

    return payload;
  }

  async function loadProducts() {
    try {
      const payload = await request(`${catalogApi}/api/products`);
      state.products = payload.data;
      setNotice('');
    } catch (error) {
      setNotice('Using demo catalog until the API is reachable.');
    }

    render();
  }

  async function loadCart() {
    try {
      const payload = await request(`${cartApi}/api/cart/${state.sessionId}`);
      state.cart = payload.data;
      setNotice('');
    } catch (error) {
      setNotice('Cart service is warming up.');
    }

    renderCart();
  }

  function featuredProducts() {
    const featured = state.products.filter((product) => product.isFeatured);
    return featured.length ? featured : state.products.slice(0, 3);
  }

  function visibleProducts() {
    return state.products.filter((product) => {
      const categoryMatch = state.selectedCategory === 'All' || product.category === state.selectedCategory;
      const queryMatch = !state.query
        || product.name.toLowerCase().includes(state.query)
        || product.brand.toLowerCase().includes(state.query)
        || product.category.toLowerCase().includes(state.query);

      return categoryMatch && queryMatch;
    });
  }

  function renderFeatured() {
    const featured = featuredProducts();
    state.featuredIndex = Math.min(state.featuredIndex, Math.max(featured.length - 1, 0));
    elements.featuredTrack.innerHTML = featured
      .map((product) => `
        <article class="featured-slide">
          <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" />
          <div class="featured-caption">
            <p>${escapeHtml(product.brand)}</p>
            <h2>${escapeHtml(product.name)}</h2>
            <span>${money(product.priceCents)}</span>
          </div>
        </article>
      `)
      .join('');
    updateFeaturedPosition();
  }

  function updateFeaturedPosition() {
    elements.featuredTrack.style.transform = `translateY(-${state.featuredIndex * 100}%)`;
  }

  function moveFeatured(direction) {
    const featured = featuredProducts();
    if (!featured.length) return;
    state.featuredIndex = (state.featuredIndex + direction + featured.length) % featured.length;
    updateFeaturedPosition();
  }

  function startFeaturedTimer() {
    window.clearInterval(state.featuredTimer);
    state.featuredTimer = window.setInterval(() => moveFeatured(1), 4200);
  }

  function renderCategories() {
    const categories = ['All', ...new Set(state.products.map((product) => product.category))];
    elements.categoryRail.innerHTML = categories
      .map((category) => `
        <button class="category-chip ${category === state.selectedCategory ? 'active' : ''}" data-category="${escapeHtml(category)}">
          ${escapeHtml(category)}
        </button>
      `)
      .join('');
  }

  function renderProducts() {
    const products = visibleProducts();
    elements.catalogTitle.textContent = state.selectedCategory === 'All'
      ? 'All Shoes'
      : `${state.selectedCategory} Shoes`;

    if (!products.length) {
      elements.productGrid.innerHTML = '<p class="empty-cart">No sneakers match that search.</p>';
      return;
    }

    elements.productGrid.innerHTML = products
      .map((product) => `
        <article class="product-card">
          <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" />
          <div class="product-meta">
            <span class="product-kicker">${product.stock ? 'Available now' : 'Sold out'}</span>
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.brand)} ${escapeHtml(product.category)} Shoes</p>
            <p>${escapeHtml(product.description)}</p>
            <div class="product-price-row">
              <strong>${money(product.priceCents)}</strong>
              <button data-add-product="${escapeHtml(product.id)}" ${product.stock ? '' : 'disabled'}>Add to Bag</button>
            </div>
          </div>
        </article>
      `)
      .join('');
  }

  function renderCart() {
    const items = state.cart.items || [];
    elements.cartCount.textContent = items.reduce((sum, item) => sum + item.quantity, 0);
    elements.cartTotal.textContent = money(state.cart.totalCents);
    elements.checkoutButton.disabled = items.length === 0;

    if (!items.length) {
      elements.cartItems.innerHTML = '<p class="empty-cart">Your bag is empty.</p>';
      return;
    }

    elements.cartItems.innerHTML = items
      .map((item) => `
        <article class="cart-line">
          <div class="cart-line-info">
            <strong>${escapeHtml(item.productName)}</strong>
            <span>${money(item.unitPriceCents)}</span>
          </div>
          <div class="quantity-controls">
            <button data-quantity="${item.quantity - 1}" data-item-id="${escapeHtml(item.id)}" aria-label="Decrease quantity">-</button>
            <strong>${item.quantity}</strong>
            <button data-quantity="${item.quantity + 1}" data-item-id="${escapeHtml(item.id)}" aria-label="Increase quantity">+</button>
          </div>
        </article>
      `)
      .join('');
  }

  function render() {
    renderFeatured();
    renderCategories();
    renderProducts();
    renderCart();
    startFeaturedTimer();
  }

  function openCart() {
    elements.cartDrawer.classList.add('open');
    elements.scrim.classList.add('open');
    elements.cartDrawer.setAttribute('aria-hidden', 'false');
  }

  function closeCart() {
    elements.cartDrawer.classList.remove('open');
    elements.scrim.classList.remove('open');
    elements.cartDrawer.setAttribute('aria-hidden', 'true');
  }

  async function addToCart(productId) {
    try {
      const payload = await request(`${cartApi}/api/cart/${state.sessionId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: 1 })
      });
      state.cart = payload.data;
      renderCart();
      openCart();
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function updateQuantity(itemId, quantity) {
    try {
      const payload = await request(`${cartApi}/api/cart/${state.sessionId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity })
      });
      state.cart = payload.data;
      renderCart();
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function checkout(event) {
    event.preventDefault();

    try {
      const payload = await request(`${cartApi}/api/cart/${state.sessionId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerEmail: elements.customerEmail.value })
      });
      setNotice(`Order ${payload.data.id.slice(0, 8)} accepted.`);
      await loadCart();
    } catch (error) {
      setNotice(error.message);
    }
  }

  function wireEvents() {
    elements.previousFeatured.addEventListener('click', () => moveFeatured(-1));
    elements.nextFeatured.addEventListener('click', () => moveFeatured(1));
    elements.openCartButton.addEventListener('click', openCart);
    elements.heroCartButton.addEventListener('click', openCart);
    elements.closeCartButton.addEventListener('click', closeCart);
    elements.scrim.addEventListener('click', closeCart);
    elements.checkoutForm.addEventListener('submit', checkout);

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

    let isDragging = false;
    let startX = 0;
    let scrollLeft = 0;

    elements.categoryRail.addEventListener('pointerdown', (event) => {
      isDragging = true;
      startX = event.clientX;
      scrollLeft = elements.categoryRail.scrollLeft;
      elements.categoryRail.setPointerCapture(event.pointerId);
    });

    elements.categoryRail.addEventListener('pointermove', (event) => {
      if (!isDragging) return;
      elements.categoryRail.scrollLeft = scrollLeft - (event.clientX - startX);
    });

    elements.categoryRail.addEventListener('pointerup', () => {
      isDragging = false;
    });
  }

  wireEvents();
  render();
  loadProducts();
  loadCart();
})();
