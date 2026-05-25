import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowUp, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import './styles.css';

const catalogApi = import.meta.env.VITE_CATALOG_API_URL || 'http://localhost:4001';
const cartApi = import.meta.env.VITE_CART_API_URL || 'http://localhost:4002';
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

function currency(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(cents / 100);
}

function useSessionId() {
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem('sneakertail-session');
    if (stored) return stored;
    const next = crypto.randomUUID();
    localStorage.setItem('sneakertail-session', next);
    return next;
  });
  return sessionId;
}

function FeaturedCarousel({ products }) {
  const featured = products.filter((product) => product.isFeatured).slice(0, 4);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (featured.length < 2) return undefined;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % featured.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [featured.length]);

  if (!featured.length) return null;

  return (
    <section className="hero-grid">
      <div className="hero-copy">
        <span className="eyebrow">sneakertail.online</span>
        <h1>Fresh rotations for every street, court, and commute.</h1>
        <p>Browse new drops, build your cart, and checkout through small services designed for cloud-native growth.</p>
      </div>
      <div className="vertical-carousel" aria-label="Featured sneakers">
        <div
          className="vertical-track"
          style={{ transform: `translateY(-${index * 100}%)` }}
        >
          {featured.map((product) => (
            <article className="featured-slide" key={product.id}>
              <img src={product.imageUrl} alt={product.name} />
              <div>
                <span>{product.brand}</span>
                <h2>{product.name}</h2>
                <p>{product.description}</p>
                <strong>{currency(product.priceCents)}</strong>
              </div>
            </article>
          ))}
        </div>
        <div className="carousel-controls">
          <button
            aria-label="Previous featured sneaker"
            onClick={() => setIndex((current) => (current - 1 + featured.length) % featured.length)}
          >
            <ArrowUp size={18} />
          </button>
          <button
            aria-label="Next featured sneaker"
            onClick={() => setIndex((current) => (current + 1) % featured.length)}
          >
            <ArrowDown size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}

function CategoryRail({ categories, selected, onSelect }) {
  const railRef = useRef(null);
  const drag = useRef({ active: false, left: 0, x: 0 });

  function startDrag(event) {
    const rail = railRef.current;
    drag.current = {
      active: true,
      left: rail.scrollLeft,
      x: event.clientX
    };
    rail.setPointerCapture(event.pointerId);
  }

  function moveDrag(event) {
    if (!drag.current.active) return;
    const walk = event.clientX - drag.current.x;
    railRef.current.scrollLeft = drag.current.left - walk;
  }

  function stopDrag() {
    drag.current.active = false;
  }

  return (
    <div
      ref={railRef}
      className="category-rail"
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      {['All', ...categories].map((category) => (
        <button
          key={category}
          className={selected === category ? 'active' : ''}
          onClick={() => onSelect(category)}
        >
          {category}
        </button>
      ))}
    </div>
  );
}

function ProductCard({ product, onAdd }) {
  return (
    <article className="product-card">
      <img src={product.imageUrl} alt={product.name} />
      <div className="product-card-body">
        <span>{product.brand} / {product.category}</span>
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        <div className="product-card-footer">
          <strong>{currency(product.priceCents)}</strong>
          <button onClick={() => onAdd(product)} disabled={!product.stock}>
            <ShoppingBag size={17} />
            Add
          </button>
        </div>
      </div>
    </article>
  );
}

function CartDrawer({ open, cart, onClose, onQuantity, onCheckout }) {
  return (
    <aside className={`cart-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="cart-header">
        <div>
          <span>Shopping cart</span>
          <h2>{cart.items.length} items</h2>
        </div>
        <button onClick={onClose}>Close</button>
      </div>
      <div className="cart-items">
        {cart.items.length === 0 && <p className="empty-cart">Your rotation is waiting.</p>}
        {cart.items.map((item) => (
          <div className="cart-line" key={item.id}>
            <div>
              <strong>{item.productName}</strong>
              <span>{currency(item.unitPriceCents)}</span>
            </div>
            <div className="quantity-controls">
              <button aria-label="Decrease quantity" onClick={() => onQuantity(item, item.quantity - 1)}>
                {item.quantity === 1 ? <Trash2 size={16} /> : <Minus size={16} />}
              </button>
              <span>{item.quantity}</span>
              <button aria-label="Increase quantity" onClick={() => onQuantity(item, item.quantity + 1)}>
                <Plus size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="checkout-bar">
        <span>Total</span>
        <strong>{currency(cart.totalCents || 0)}</strong>
        <button disabled={!cart.items.length} onClick={onCheckout}>Checkout</button>
      </div>
    </aside>
  );
}

function App() {
  const sessionId = useSessionId();
  const [products, setProducts] = useState(fallbackProducts);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState({ items: [], totalCents: 0 });
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category))],
    [products]
  );
  const visibleProducts = selectedCategory === 'All'
    ? products
    : products.filter((product) => product.category === selectedCategory);

  async function loadProducts() {
    const response = await fetch(`${catalogApi}/api/products`);
    const payload = await response.json();
    setProducts(payload.data);
  }

  async function loadCart() {
    const response = await fetch(`${cartApi}/api/cart/${sessionId}`);
    const payload = await response.json();
    setCart(payload.data);
  }

  useEffect(() => {
    loadProducts().catch(() => setNotice('Using demo catalog until the API is reachable.'));
    loadCart().catch(() => setNotice('Cart service is warming up.'));
  }, []);

  async function addToCart(product) {
    const response = await fetch(`${cartApi}/api/cart/${sessionId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, quantity: 1 })
    });
    const payload = await response.json();
    setCart(payload.data);
    setCartOpen(true);
  }

  async function updateQuantity(item, quantity) {
    const response = await fetch(`${cartApi}/api/cart/${sessionId}/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity })
    });
    const payload = await response.json();
    setCart(payload.data);
  }

  async function checkout() {
    const response = await fetch(`${cartApi}/api/cart/${sessionId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerEmail: 'buyer@sneakertail.online' })
    });
    const payload = await response.json();
    setNotice(`Order ${payload.data.id.slice(0, 8)} accepted.`);
    await loadCart();
  }

  return (
    <main>
      <nav className="topbar">
        <strong>sneakertail.online</strong>
        <button className="cart-button" onClick={() => setCartOpen(true)}>
          <ShoppingBag size={18} />
          {cart.items.length}
        </button>
      </nav>

      <FeaturedCarousel products={products} />

      <section className="catalog-section">
        <div className="section-heading">
          <div>
            <span>Catalog</span>
            <h2>Choose your next pair</h2>
          </div>
          {notice && <p>{notice}</p>}
        </div>
        <CategoryRail categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
        <div className="product-grid">
          {visibleProducts.map((product) => (
            <ProductCard product={product} key={product.id} onAdd={addToCart} />
          ))}
        </div>
      </section>

      <CartDrawer
        open={cartOpen}
        cart={cart}
        onClose={() => setCartOpen(false)}
        onQuantity={updateQuantity}
        onCheckout={checkout}
      />
      {cartOpen && <button className="scrim" aria-label="Close cart" onClick={() => setCartOpen(false)} />}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
