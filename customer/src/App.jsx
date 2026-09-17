import { useMemo, useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const defaultStoreCategories = ['Lace', 'Atampa', 'Passion', 'Shadda', 'Cotton', 'Hijab', 'Abaya'];
const normalizeCategoryName = (category) => String(category ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
const categoryMatches = (productCategory, selectedCategory) => {
  const productValue = normalizeCategoryName(productCategory);
  const selectedValue = normalizeCategoryName(selectedCategory);

  if (!productValue || !selectedValue) return false;

  const productTokens = productValue.split(/\s+/).filter(Boolean);
  const selectedTokens = selectedValue.split(/\s+/).filter(Boolean);

  if (productValue === selectedValue) return true;

  const productSet = new Set(productTokens);
  const selectedSet = new Set(selectedTokens);

  return selectedTokens.length > 0 && productTokens.length > 0
    && [...selectedSet].every((token) => productSet.has(token));
};
const formatAmount = (amount) => `₦${Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const profileTabs = ['Profile', 'Purchase History', 'Complaints', 'Settings'];

export default function App() {
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('Profile');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [openSupportAfterLogin, setOpenSupportAfterLogin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authFormData, setAuthFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '+234 800 000 0000',
    address: 'Lagos, Nigeria',
  });
  const [profileImage, setProfileImage] = useState('');
  const [complaint, setComplaint] = useState({ name: '', email: '', subject: '', message: '' });
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckoutDetails, setShowCheckoutDetails] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [checkoutDetails, setCheckoutDetails] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [checkoutError, setCheckoutError] = useState('');
  const [paymentResult, setPaymentResult] = useState(null);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [complaintStatus, setComplaintStatus] = useState('');
  const [newsLetterStatus, setNewsLetterStatus] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeInfoPage, setActiveInfoPage] = useState('');
  const [storeCategories, setStoreCategories] = useState(defaultStoreCategories);
  const collectionRef = useRef(null);

  const categoryOptions = useMemo(() => {
    const productCategories = products
      .map((product) => product.category)
      .filter((category) => typeof category === 'string' && category.trim())
      .map((category) => category.trim());

    return [...new Set([
      ...storeCategories.map((category) => category.trim()).filter(Boolean),
      ...productCategories,
    ])];
  }, [products, storeCategories]);

  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    const fetchStoreConfig = async () => {
      try {
        const response = await fetch(`${API_URL.replace('/api', '')}/api/config/public`);
        if (!response.ok) return;

        const config = await response.json();
        const nextCategories = Array.isArray(config.categories) && config.categories.length
          ? config.categories
          : defaultStoreCategories;

        setStoreCategories(nextCategories);
      } catch (error) {
        console.error('Failed to load store categories:', error);
      }
    };

    fetchStoreConfig();
  }, []);

  useEffect(() => {
    if (window.location.pathname !== '/payment/callback') return;

    const reference = new URLSearchParams(window.location.search).get('reference');
    if (!reference) {
      setPaymentResult({ success: false, message: 'Payment reference was not found.' });
      return;
    }

    fetch(`${API_URL}/paystack/verify/${encodeURIComponent(reference)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.verified) throw new Error(data.message || 'Payment was not completed.');
        setPaymentResult({ success: true, message: 'Payment successful. Your order has been confirmed.' });
        setCart([]);
        setShowCart(false);
        setShowCheckoutDetails(false);
        window.history.replaceState({}, '', '/');
        if (localStorage.getItem('authToken')) fetchPurchaseHistory(localStorage.getItem('authToken'));
      })
      .catch((error) => setPaymentResult({ success: false, message: error.message }));
  }, []);

  const profileSummary = useMemo(
    () => ({
      name: profileForm.name,
      email: profileForm.email,
      phone: profileForm.phone,
      address: profileForm.address,
    }),
    [profileForm]
  );

  const visibleProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory = activeCategory === 'All'
        || categoryMatches(product.category, activeCategory);
      const searchableText = [product.name, product.category, product.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, products, searchTerm]);

  const showCollection = (category = 'All') => {
    setActiveCategory(category);
    setActiveInfoPage('');
    setShowProfile(false);
    requestAnimationFrame(() => collectionRef.current?.scrollIntoView({ behavior: 'smooth' }));
  };

  const openInfoPage = (page) => {
    if (page === 'home') {
      showCollection();
      return;
    }
    setActiveInfoPage(page);
    setShowProfile(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const newestProducts = useMemo(
    () => [...products].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [products]
  );

  const renderInfoPage = () => {
    const pageContent = {
      about: {
        type: 'about',
        eyebrow: 'Our story',
        title: 'Style with intention.',
        body: 'Jannat Collection brings together refined essentials for confident everyday living. We curate pieces that feel considered, comfortable, and expressive without losing their sense of ease.',
        ceo: {
          name: 'CEO profile coming soon',
          role: 'Chief Executive Officer',
          bio: 'Meet the person shaping the next chapter of Jannat Collection. The CEO name, portrait, and personal message will be added here soon.',
        },
        sections: [
          ['Curated, not crowded', 'Every piece is selected to work beautifully in a modern wardrobe, with room for personal expression.'],
          ['Made for real days', 'From first plans to late evenings, our collection is designed around comfort, confidence, and repeat wear.'],
          ['A considered standard', 'We believe good style should feel effortless, thoughtful, and lasting.'],
        ],
      },
      contact: {
        type: 'contact',
        eyebrow: 'Get in touch',
        title: 'We are here to help.',
        body: 'Our customer care team is available Monday to Friday, 9:00 AM to 5:00 PM. Reach us at hello@jannatcollection.com or +234 800 000 0000.',
        details: [['Email', 'hello@jannatcollection.com'], ['Phone', '+234 800 000 0000'], ['Hours', 'Monday - Friday, 9:00 AM - 5:00 PM']],
      },
      shipping: {
        type: 'service',
        eyebrow: 'Customer care',
        title: 'Shipping & Delivery',
        body: 'Orders are carefully prepared within 1 to 3 business days. Standard delivery usually arrives within 3 to 7 business days, with tracking shared after dispatch.',
        steps: [['01', 'Order confirmed', 'We review and prepare your items.'], ['02', 'Packed with care', 'Your order is checked and handed to our delivery partner.'], ['03', 'On its way', 'Tracking details are shared as soon as your package leaves us.']],
      },
      returns: {
        type: 'service',
        eyebrow: 'Customer care',
        title: 'Returns made simple.',
        body: 'Request a return within 14 days of delivery. Items should be unworn, unused, and returned with their original packaging. Our team will guide you through the next step.',
        steps: [['01', 'Check eligibility', 'Make sure the item is unworn and in its original condition.'], ['02', 'Contact our team', 'Send us your order number and reason for the return.'], ['03', 'Send it back', 'We will share the return instructions and next steps.']],
      },
      privacy: {
        type: 'legal',
        eyebrow: 'Legal',
        title: 'Privacy Policy',
        body: 'We use your information to process orders, provide support, and improve your shopping experience. We do not sell your personal information. Contact us for questions about your data.',
        sections: [['Information we collect', 'We collect the details needed to create your account, process purchases, deliver orders, and answer support requests.'], ['How we use it', 'Your information helps us provide services, improve the store, and communicate about orders or subscriptions.'], ['Your choices', 'You can contact us to ask about, update, or remove personal information associated with your account.']],
      },
      terms: {
        type: 'legal',
        eyebrow: 'Legal',
        title: 'Terms & Conditions',
        body: 'By using Jannat Collection, you agree to provide accurate account information, keep your login details secure, and use the store for lawful purchases. Product availability and pricing may change without notice.',
        sections: [['Orders', 'Orders are subject to product availability and confirmation. Please review your details before completing a purchase.'], ['Products and pricing', 'We work to keep product descriptions and prices accurate, but occasional updates may occur.'], ['Account responsibility', 'Keep your account details secure and notify us if you believe your account has been used without permission.']],
      },
    };

    if (activeInfoPage === 'support') {
      return (
        <section className="info-page support-page">
          <div className="info-page-hero">
            <p className="eyebrow">Customer care</p>
            <h1>How can we help?</h1>
            <p>Find a quick answer below or send our team a message about your order.</p>
          </div>
          <div className="support-grid">
            <div className="info-card"><strong>Order support</strong><p>Have your order number ready and we can help with delivery, returns, or product questions.</p></div>
            <div className="info-card"><strong>Response time</strong><p>We usually respond within one business day through email or the complaint form.</p></div>
          </div>
          <button className="primary-btn" type="button" onClick={openSupportForm}>
            {isLoggedIn ? 'Open support form' : 'Contact support'}
          </button>
          <div className="complaint-form-box public-complaint-form">
            <h4>Send us a message</h4>
            {complaintStatus && (
              <div style={{
                padding: '12px 14px',
                marginBottom: '14px',
                borderRadius: '8px',
                fontSize: '0.9rem',
                background: complaintStatus.includes('✓') ? '#eaf7ee' : '#fef1ee',
                color: complaintStatus.includes('✓') ? '#1e7d49' : '#b44232',
              }}>
                {complaintStatus}
              </div>
            )}
            <form className="complaint-form" onSubmit={handleSubmitComplaint}>
              {!isLoggedIn && (
                <>
                  <input type="text" value={complaint.name} onChange={(e) => setComplaint({ ...complaint, name: e.target.value })} placeholder="Your name" required />
                  <input type="email" value={complaint.email} onChange={(e) => setComplaint({ ...complaint, email: e.target.value })} placeholder="Your email" required />
                </>
              )}
              <input type="text" value={complaint.subject} onChange={(e) => setComplaint({ ...complaint, subject: e.target.value })} placeholder="Subject" required />
              <textarea rows="5" value={complaint.message} onChange={(e) => setComplaint({ ...complaint, message: e.target.value })} placeholder="Tell us how we can help" required />
              <button type="submit" className="primary-btn">Send message</button>
            </form>
          </div>
        </section>
      );
    }

    if (activeInfoPage === 'new-arrivals') {
      return (
        <section className="info-page">
          <div className="info-page-hero">
            <p className="eyebrow">Just in</p>
            <h1>New Arrivals</h1>
            <p>The newest pieces added to the collection, selected for your next everyday look.</p>
          </div>
          <section className="product-grid info-product-grid">
            {(newestProducts.length ? newestProducts : products).slice(0, 8).map((product) => (
              <article className="product-card" key={product._id || product.id} onClick={() => openProductPreview(product)}>
                <div className="product-image">
                  <img src={product.images?.[0]?.startsWith('/') ? `${API_URL.replace('/api', '')}${product.images[0]}` : (product.images?.[0] || 'https://via.placeholder.com/300x400?text=No+Image')} alt={product.name} />
                  <span className="badge">New</span>
                </div>
                <div className="product-info"><h3>{product.name}</h3><div className="meta-row"><span>{formatAmount(product.price)}</span><button type="button" disabled={!product.stock} onClick={(event) => { event.stopPropagation(); handleAddToCart(product); }}>{product.stock > 0 ? 'Add to Cart' : 'Out of stock'}</button></div></div>
              </article>
            ))}
            {!products.length && <p className="empty-state">New arrivals will appear here as products are added.</p>}
          </section>
        </section>
      );
    }

    if (activeInfoPage === 'shop') {
      return (
        <section className="info-page">
          <div className="info-page-hero">
            <p className="eyebrow">The collection</p>
            <h1>Shop Jannat Collection</h1>
            <p>Explore every available piece in one considered edit, from everyday essentials to occasion-ready details.</p>
          </div>
          <section className="product-grid info-product-grid">
            {products.map((product) => (
              <article className="product-card" key={product._id || product.id} onClick={() => openProductPreview(product)}>
                <div className="product-image">
                  <img src={product.images?.[0]?.startsWith('/') ? `${API_URL.replace('/api', '')}${product.images[0]}` : (product.images?.[0] || 'https://via.placeholder.com/300x400?text=No+Image')} alt={product.name} />
                  <span className="badge">{product.featured ? 'Featured' : 'Available'}</span>
                </div>
                <div className="product-info"><h3>{product.name}</h3><div className="meta-row"><span>{formatAmount(product.price)}</span><button type="button" disabled={!product.stock} onClick={(event) => { event.stopPropagation(); handleAddToCart(product); }}>{product.stock > 0 ? 'Add to Cart' : 'Out of stock'}</button></div></div>
              </article>
            ))}
            {!products.length && <p className="empty-state">Products will appear here as the collection grows.</p>}
          </section>
        </section>
      );
    }

    const content = pageContent[activeInfoPage];
    if (!content) return null;

    if (content.type === 'about') {
      return (
        <section className="info-page about-page">
          <div className="info-page-hero info-page-hero-split">
            <div><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1></div>
            <p>{content.body}</p>
          </div>
          <div className="info-card-grid">
            {content.sections.map(([title, text]) => <article className="info-card" key={title}><strong>{title}</strong><p>{text}</p></article>)}
          </div>
          <section className="ceo-profile" aria-labelledby="ceo-profile-title">
            <div className="ceo-portrait-wrap">
              <img className="ceo-portrait" src="/Brand-logo.jpg" alt="Jannat Collection branded CEO placeholder" />
            </div>
            <div className="ceo-profile-copy">
              <p className="eyebrow">Leadership</p>
              <h2 id="ceo-profile-title">{content.ceo.name}</h2>
              <strong>{content.ceo.role}</strong>
              <p>{content.ceo.bio}</p>
            </div>
          </section>
          <section className="future-team" aria-labelledby="future-team-title">
            <p className="eyebrow">The people behind the collection</p>
            <h2 id="future-team-title">More of our story, soon.</h2>
            <p>Additional leadership and team profiles will be introduced here as we share more about the people who make Jannat Collection possible.</p>
          </section>
          <button className="primary-btn" type="button" onClick={() => openInfoPage('shop')}>Shop the collection</button>
        </section>
      );
    }

    if (content.type === 'contact') {
      return (
        <section className="info-page contact-page">
          <div className="info-page-hero"><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1><p>{content.body}</p></div>
          <div className="contact-details">
            {content.details.map(([label, value]) => <div className="contact-detail" key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </div>
          <button className="primary-btn" type="button" onClick={() => openInfoPage('support')}>Open support</button>
        </section>
      );
    }

    if (content.type === 'service') {
      return (
        <section className="info-page service-page">
          <div className="info-page-hero"><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1><p>{content.body}</p></div>
          <div className="service-steps">
            {content.steps.map(([number, title, text]) => <article className="service-step" key={number}><span className="step-number">{number}</span><div><strong>{title}</strong><p>{text}</p></div></article>)}
          </div>
          <button className="primary-btn" type="button" onClick={() => openInfoPage('support')}>Contact support</button>
        </section>
      );
    }

    if (content.type === 'legal') {
      return (
        <section className="info-page legal-page">
          <div className="info-page-hero"><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1><p>{content.body}</p></div>
          <div className="legal-sections">
            {content.sections.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}
          </div>
          <button className="secondary-btn" type="button" onClick={() => openInfoPage('contact')}>Questions? Contact us</button>
        </section>
      );
    }

    return (
      <section className="info-page">
        <div className="info-page-hero">
          <p className="eyebrow">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p>{content.body}</p>
          <button className="primary-btn" type="button" onClick={() => openInfoPage(content.actionPage)}>{content.action}</button>
        </div>
      </section>
    );
  };

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');
    if (token && user) {
      setIsLoggedIn(true);
      const userData = JSON.parse(user);
      setCurrentUser(userData);
      setProfileForm((prev) => ({
        ...prev,
        name: userData.name || '',
        email: userData.email || '',
      }));
      setCheckoutDetails((prev) => ({
        ...prev,
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone || prev.phone,
        address: userData.address || prev.address,
      }));
      const initials = userData.name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase() || userData.email[0].toUpperCase();
      setProfileImage(initials);
      if (openSupportAfterLogin) {
        setOpenSupportAfterLogin(false);
        setActiveInfoPage('');
        setShowProfile(true);
        setActiveTab('Complaints');
      }
      
      // Fetch user's purchase history
      fetchPurchaseHistory(token);
    }
  }, []);

  const fetchPurchaseHistory = async (token) => {
    try {
      const response = await fetch(`${API_URL}/orders/my-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const orders = await response.json();
        setPurchaseHistory(orders);
      } else if (response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        setIsLoggedIn(false);
        setShowProfile(false);
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(`${API_URL}/products`);
        if (response.ok) {
          const data = await response.json();
          setProducts(data);
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
      }
    };
    fetchProducts();
  }, []);

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setProfileImage(imageUrl);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const payload =
        authMode === 'login'
          ? { email: authFormData.email, password: authFormData.password }
          : authFormData;

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.message || 'Authentication failed');
        return;
      }

      // Store token and user info
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));

      setCurrentUser(data.user);
      setIsLoggedIn(true);
      setShowProfile(true);
      setShowLoginModal(false);
      setAuthFormData({ name: '', email: '', password: '' });
      setProfileForm((prev) => ({
        ...prev,
        name: data.user.name || '',
        email: data.user.email || '',
      }));
      setCheckoutDetails((prev) => ({
        ...prev,
        name: data.user.name || '',
        email: data.user.email || '',
        phone: data.user.phone || prev.phone,
        address: data.user.address || prev.address,
      }));

      const initials = data.user.name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase() || data.user.email[0].toUpperCase();
      setProfileImage(initials);
      if (openSupportAfterLogin) {
        setOpenSupportAfterLogin(false);
        setActiveInfoPage('');
        setShowProfile(true);
        setActiveTab('Complaints');
      }
    } catch (error) {
      setAuthError(error.message || 'An error occurred');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAddToCart = (product) => {
    if (!product.stock || product.stock < 1) return;

    setCart((prev) => {
      const existingItem = prev.find((item) => item._id === product._id);
      if (existingItem) {
        return prev.map((item) =>
          item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const openProductPreview = (product) => {
    setSelectedProduct(product);
  };

  const openSupportForm = () => {
    if (isLoggedIn) {
      setActiveInfoPage('');
      setShowProfile(true);
      setActiveTab('Complaints');
      return;
    }

    document.querySelector('.public-complaint-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleRemoveFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item._id !== productId));
  };

  const openCheckout = () => {
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }

    setCheckoutError('');
    setShowCheckoutDetails(true);
  };

  const handleCheckout = async (event) => {
    event.preventDefault();

    if (!checkoutDetails.name || !checkoutDetails.email || !checkoutDetails.phone || !checkoutDetails.address) {
      setCheckoutError('Please provide your name, email, phone number and delivery address.');
      return;
    }

    const token = localStorage.getItem('authToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const response = await fetch(`${API_URL}/paystack/initialize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item._id,
            quantity: item.quantity,
          })),
          email: checkoutDetails.email,
          customer: checkoutDetails,
        }),
      });

      if (response.ok) {
        const payment = await response.json();
        window.location.assign(payment.authorization_url);
      } else {
        const data = await response.json();
        setCheckoutError(data.message || 'Unable to start payment');
      }
    } catch (error) {
      console.error('Checkout failed:', error);
      alert('Checkout error: ' + error.message);
    }
  };

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();

    if (!complaint.subject || !complaint.message) {
      setComplaintStatus('Subject and message are required');
      return;
    }

    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch(`${API_URL}/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...complaint,
          name: complaint.name || currentUser?.name,
          email: complaint.email || currentUser?.email,
        }),
      });

      if (response.ok) {
        setComplaintStatus('✓ Complaint submitted successfully');
        setComplaint({ name: '', email: '', subject: '', message: '' });
        setTimeout(() => setComplaintStatus(''), 3000);
      } else {
        const data = await response.json();
        setComplaintStatus(data.message || 'Failed to submit complaint');
      }
    } catch (error) {
      setComplaintStatus('Error: ' + error.message);
    }
  };

  const handleSubscribeNewsletter = async (e) => {
    e.preventDefault();
    if (!newsletterEmail) {
      setNewsLetterStatus('Email is required');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setNewsLetterStatus('✓ Subscribed successfully');
        setNewsletterEmail('');
        setTimeout(() => setNewsLetterStatus(''), 3000);
      } else {
        setNewsLetterStatus(data.message || 'Subscription failed');
      }
    } catch (error) {
      setNewsLetterStatus('Error: ' + error.message);
    }
  };

  const renderProfileContent = () => {
    switch (activeTab) {
      case 'Purchase History':
        return (
          <div className="history-list">
            {purchaseHistory.length > 0 ? (
              purchaseHistory.map((order) => (
                <div key={order._id} className="history-item">
                  <div>
                    <strong>Order #{order._id.slice(-6).toUpperCase()}</strong>
                    <small>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </small>
                  </div>
                  <div>
                    <strong>{formatAmount(order.total)}</strong>
                  </div>
                  <span style={{
                    background: order.paymentStatus === 'completed' ? '#eaf7ee' : '#f2eee9',
                    color: order.paymentStatus === 'completed' ? '#1e7d49' : '#5f554f',
                  }}>
                    {order.paymentStatus === 'completed' ? 'Paid' : 'Pending'}
                  </span>
                </div>
              ))
            ) : (
              <p className="empty-state">No purchases yet</p>
            )}
          </div>
        );
      case 'Complaints':
        return (
          <div className="complaint-form-box">
            <h4>Submit a complaint</h4>
            {complaintStatus && (
              <div style={{
                padding: '12px 14px',
                marginBottom: '14px',
                borderRadius: '8px',
                fontSize: '0.9rem',
                background: complaintStatus.includes('✓') ? '#eaf7ee' : '#fef1ee',
                color: complaintStatus.includes('✓') ? '#1e7d49' : '#b44232',
              }}>
                {complaintStatus}
              </div>
            )}
            <form className="complaint-form" onSubmit={handleSubmitComplaint}>
              <input
                type="text"
                value={complaint.subject}
                onChange={(e) => setComplaint({ ...complaint, subject: e.target.value })}
                placeholder="Complaint subject"
              />
              <textarea
                rows="5"
                value={complaint.message}
                onChange={(e) => setComplaint({ ...complaint, message: e.target.value })}
                placeholder="Tell us what happened"
              />
              <button type="submit" className="primary-btn">
                Send complaint
              </button>
            </form>
          </div>
        );
      case 'Settings':
        return (
          <div className="settings-panel">
            <div className="avatar-upload-box">
              {typeof profileImage === 'string' && profileImage.length <= 2 ? (
                <div className="profile-avatar large">{profileImage}</div>
              ) : (
                <img className="profile-avatar large uploaded" src={profileImage} alt="user avatar" />
              )}
              <label className="upload-label">
                Upload profile image
                <input type="file" accept="image/*" onChange={handleAvatarUpload} />
              </label>
            </div>

            <div className="settings-fields">
              <label>
                Full name
                <input
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                />
              </label>
              <label>
                Email
                <input
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                />
              </label>
              <label>
                Phone
                <input
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                />
              </label>
              <label>
                Address
                <input
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                />
              </label>
            </div>
          </div>
        );
      default:
        return (
          <div className="profile-content-grid">
            <div className="profile-card profile-overview-card">
              <div className="overview-heading">
                <div>
                  <p className="eyebrow">Account details</p>
                  <h4>Profile Overview</h4>
                </div>
                <span className="profile-status-pill">Active member</span>
              </div>
              <div className="overview-identity">
                {typeof profileImage === 'string' && profileImage.length <= 2 ? (
                  <div className="profile-avatar overview-avatar">{profileImage}</div>
                ) : (
                  <img className="profile-avatar overview-avatar uploaded" src={profileImage} alt="user avatar" />
                )}
                <div>
                  <strong>{profileSummary.name || 'Customer'}</strong>
                  <span>Jannat Collection member</span>
                </div>
              </div>
              <div className="profile-detail-grid">
                <div className="profile-detail-item"><span className="detail-icon">@</span><div><label>Email</label><p>{profileSummary.email || 'Not provided'}</p></div></div>
                <div className="profile-detail-item"><span className="detail-icon">+ </span><div><label>Phone</label><p>{profileSummary.phone || 'Not provided'}</p></div></div>
                <div className="profile-detail-item profile-detail-wide"><span className="detail-icon">⌂</span><div><label>Delivery address</label><p>{profileSummary.address || 'Not provided'}</p></div></div>
              </div>
            </div>

            <div className="profile-card">
              <h4>Recent Purchase</h4>
              <p className="empty-state">No orders yet</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <img className="brand-logo-header" src="/Brand-logo.jpg" alt="Jannat Collection" />
          <span>JANNAT COLLECTION</span>
        </div>

        <div className="search-box">
          <span>⌕</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              aria-label="Search products"
            />
        </div>

        <div className="header-actions">
          <button
            className="theme-toggle"
            type="button"
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setIsDarkMode((current) => !current)}
          >
            {isDarkMode ? '☀' : '☾'}
          </button>
          <button
            className="cart-btn"
            type="button"
            aria-label={`Open cart with ${cart.length} items`}
            title="Open cart"
            onClick={() => setShowCart(!showCart)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 7H6" />
              <circle cx="9" cy="20" r="1.2" />
              <circle cx="18" cy="20" r="1.2" />
            </svg>
            <span>{cart.length}</span>
          </button>
          {isLoggedIn ? (
            <div className="account-menu-wrap">
              <button
                className="account-trigger"
                type="button"
                aria-expanded={showAccountMenu}
                aria-label="Open account menu"
                onClick={() => setShowAccountMenu((current) => !current)}
              >
                {typeof profileImage === 'string' && profileImage.length <= 2 ? (
                  <span className="header-avatar">{profileImage}</span>
                ) : (
                  <img className="header-avatar" src={profileImage} alt="Profile" />
                )}
                <span className="account-chevron">⌄</span>
              </button>
              {showAccountMenu && (
                <div className="account-dropdown">
                  <strong>{currentUser?.name}</strong>
                  <span>{currentUser?.email}</span>
                  <button type="button" onClick={() => { setShowProfile(true); setShowAccountMenu(false); }}>
                    Profile
                  </button>
                  <button type="button" onClick={() => {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('currentUser');
                    setIsLoggedIn(false);
                    setShowProfile(false);
                    setShowAccountMenu(false);
                    setCurrentUser(null);
                    setAuthMode('login');
                    setAuthFormData({ name: '', email: '', password: '' });
                  }}>
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="login-btn" type="button" onClick={() => setShowLoginModal(true)}>
              Login
            </button>
          )}
        </div>
      </header>

      {isLoggedIn && currentUser ? (
        <div className="welcome-banner">
          <img className="welcome-mark" src="/Brand-logo.jpg" alt="Jannat Collection" />
          <span>Welcome, {currentUser.name}!</span>
        </div>
      ) : null}

      {paymentResult ? (
        <section className="info-page payment-result-page">
          <div className="info-page-hero">
            <p className="eyebrow">Payment update</p>
            <h1>{paymentResult.success ? 'Thank you for your order.' : 'Payment not completed.'}</h1>
            <p>{paymentResult.message}</p>
            <button className="primary-btn" type="button" onClick={() => setPaymentResult(null)}>Continue shopping</button>
          </div>
        </section>
      ) : activeInfoPage ? renderInfoPage() : isLoggedIn && showProfile ? (
        <section className="profile-panel">
          <div className="profile-header">
            {typeof profileImage === 'string' && profileImage.length <= 2 ? (
              <div className="profile-avatar">{profileImage}</div>
            ) : (
              <img className="profile-avatar uploaded" src={profileImage} alt="user avatar" />
            )}

            <div>
              <h3>{profileForm.name}</h3>
              <p>Premium Member</p>
            </div>
            <button className="back-home-btn" type="button" onClick={() => setShowProfile(false)}>
              Back to home
            </button>
          </div>

          <div className="profile-body">
            <nav className="profile-tabs">
              {profileTabs.map((tab) => (
                <button
                  className={activeTab === tab ? 'active' : ''}
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </nav>

            <div className="profile-content">{renderProfileContent()}</div>
          </div>
        </section>
      ) : (
        <>
          <section className="hero">
        <img className="hero-side-mark" src="/Brand-logo.jpg" alt="" aria-hidden="true" />
        <div className="hero-content">
          <p className="eyebrow">Curated modern elegance</p>
          <h1>Wear confidence every day.</h1>
          <p>
            Discover refined essentials designed for modern living, premium
            comfort, and a luxurious everyday presence.
          </p>
          <div className="hero-actions">
            <button className="primary-btn" type="button" onClick={() => showCollection()}>
              Shop Collection
            </button>
            <button className="secondary-btn" type="button" onClick={() => showCollection('Luxury')}>
              Explore Lookbook
            </button>
          </div>
        </div>
        <img className="hero-side-mark" src="/Brand-logo.jpg" alt="" aria-hidden="true" />
      </section>

      <main className="content">
        <section className="category-strip">
          {['All', ...categoryOptions].map((category) => (
            <button
              className={activeCategory === category ? 'active' : ''}
              key={category}
              type="button"
              onClick={() => showCollection(category)}
            >
              {category}
            </button>
          ))}
        </section>

        <section className="section-heading">
          <div>
            <p className="eyebrow">Featured Picks</p>
            <h2>Trending this week</h2>
          </div>
          <a href="#">View all</a>
        </section>

        <section className="product-grid" ref={collectionRef}>
          {visibleProducts.length > 0 ? (
            visibleProducts.map((product) => (
              <article className="product-card" key={product._id || product.id} onClick={() => openProductPreview(product)}>
                <div className="product-image">
                  <img 
                    src={product.images?.[0]?.startsWith('/') ? `${API_URL.replace('/api', '')}${product.images[0]}` : (product.images?.[0] || 'https://via.placeholder.com/300x400?text=No+Image')} 
                    alt={product.name} 
                  />
                  <span className="badge">{product.featured ? 'Featured' : 'New'}</span>
                </div>
                <div className="product-info">
                  <h3>{product.name}</h3>
                  <div className="meta-row">
                    <span>{formatAmount(product.price)}</span>
                    <button 
                      type="button"
                      disabled={!product.stock}
                      onClick={(event) => { event.stopPropagation(); handleAddToCart(product); }}
                    >
                      {product.stock > 0 ? 'Add to Cart' : 'Out of stock'}
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
              No products found in the {activeCategory} collection yet.
            </p>
          )}
        </section>
      </main>

        </>
      )}

      {showLoginModal && (
        <div className="auth-modal-backdrop" onClick={() => { setShowLoginModal(false); setOpenSupportAfterLogin(false); }}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="close-modal-btn"
              onClick={() => { setShowLoginModal(false); setOpenSupportAfterLogin(false); }}
            >
              ×
            </button>

            <div className="auth-header">
              <p className="eyebrow">Customer access</p>
              <h3>{authMode === 'login' ? 'Welcome back' : 'Create account'}</h3>
            </div>

            {authError && (
              <div style={{
                padding: '12px 14px',
                background: '#fef1ee',
                color: '#b44232',
                borderRadius: '8px',
                marginBottom: '14px',
                fontSize: '0.9rem',
              }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleLogin} className="auth-form">
              {authMode === 'register' && (
                <input
                  type="text"
                  placeholder="Full name"
                  value={authFormData.name}
                  onChange={(e) =>
                    setAuthFormData({ ...authFormData, name: e.target.value })
                  }
                  required
                />
              )}
              <input
                type="email"
                placeholder="Email address"
                value={authFormData.email}
                onChange={(e) =>
                  setAuthFormData({ ...authFormData, email: e.target.value })
                }
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={authFormData.password}
                onChange={(e) =>
                  setAuthFormData({ ...authFormData, password: e.target.value })
                }
                required
              />

              <button
                type="submit"
                className="primary-btn full-width"
                disabled={authLoading}
              >
                {authLoading
                  ? 'Processing...'
                  : authMode === 'login'
                  ? 'Login to account'
                  : 'Create account'}
              </button>
            </form>

            <p className="auth-toggle">
              {authMode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setAuthError('');
                }}
              >
                {authMode === 'login' ? 'Create account' : 'Login'}
              </button>
            </p>
          </div>
        </div>
      )}

      {showCart && (
        <div className="cart-modal-backdrop">
          <div className="cart-modal">
            <button
              type="button"
              className="cart-modal-close"
              onClick={() => setShowCart(false)}
            >
              ×
            </button>

            <h3 className="cart-modal-title">Shopping Cart</h3>

            {cart.length > 0 ? (
              <>
                <div className="cart-items-list">
                  {cart.map((item) => (
                    <div key={item._id} className="cart-item-row">
                      <div>
                        <strong>{item.name}</strong>
                        <div className="cart-item-subtitle">
                          {item.quantity} × {formatAmount(item.price)}
                        </div>
                      </div>
                      <div className="cart-item-actions">
                        <span className="cart-item-total">
                          {formatAmount(item.price * item.quantity)}
                        </span>
                        <button
                          type="button"
                          className="cart-remove-btn"
                          onClick={() => handleRemoveFromCart(item._id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cart-summary">
                  <div className="cart-summary-row">
                    <span>Subtotal:</span>
                          <span>{formatAmount(cart.reduce((sum, item) => sum + item.price * item.quantity, 0))}</span>
                  </div>
                  <div className="cart-summary-row cart-summary-total">
                    <span>Total:</span>
                          <span>{formatAmount(cart.reduce((sum, item) => sum + item.price * item.quantity, 0))}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openCheckout}
                  className="primary-btn full-width"
                >
                  Proceed to Checkout
                </button>
              </>
            ) : (
              <p className="cart-empty-state">
                Your cart is empty
              </p>
            )}
          </div>
        </div>
      )}

      {showCheckoutDetails && (
        <div className="auth-modal-backdrop" onClick={() => setShowCheckoutDetails(false)}>
          <div className="checkout-modal" onClick={(event) => event.stopPropagation()}>
            <button className="close-modal-btn" type="button" onClick={() => setShowCheckoutDetails(false)}>×</button>
            <p className="eyebrow">Delivery details</p>
            <h3>{isLoggedIn ? 'Confirm your information' : 'Complete your order'}</h3>
            <p className="checkout-helper">
              {isLoggedIn ? 'Your account information has been added automatically. Check your address before placing the order.' : 'Enter your contact and delivery details to continue as a guest.'}
            </p>
            {checkoutError && <div className="checkout-error">{checkoutError}</div>}
            <form className="checkout-form" onSubmit={handleCheckout}>
              <label>Full name<input value={checkoutDetails.name} onChange={(event) => setCheckoutDetails({ ...checkoutDetails, name: event.target.value })} required /></label>
              <label>Email address<input type="email" value={checkoutDetails.email} onChange={(event) => setCheckoutDetails({ ...checkoutDetails, email: event.target.value })} required /></label>
              <label>Phone number<input type="tel" value={checkoutDetails.phone} onChange={(event) => setCheckoutDetails({ ...checkoutDetails, phone: event.target.value })} required /></label>
              <label>Delivery address<textarea rows="3" value={checkoutDetails.address} onChange={(event) => setCheckoutDetails({ ...checkoutDetails, address: event.target.value })} placeholder="Street, city, state" required /></label>
              <button className="primary-btn full-width" type="submit">Place order</button>
            </form>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="product-preview-backdrop" onClick={() => setSelectedProduct(null)}>
          <div className="product-preview-modal" onClick={(event) => event.stopPropagation()}>
            <button className="preview-close-btn" type="button" onClick={() => setSelectedProduct(null)} aria-label="Close product preview">×</button>
            <div className="preview-image-wrap">
              <img
                src={selectedProduct.images?.[0]?.startsWith('/') ? `${API_URL.replace('/api', '')}${selectedProduct.images[0]}` : (selectedProduct.images?.[0] || 'https://via.placeholder.com/500x600?text=No+Image')}
                alt={selectedProduct.name}
              />
              <span className="preview-badge">{selectedProduct.featured ? 'Featured piece' : 'Jannat edit'}</span>
            </div>
            <div className="preview-details">
              <p className="eyebrow">{selectedProduct.category || 'Collection'}</p>
              <h2>{selectedProduct.name}</h2>
              <p className="preview-price">{formatAmount(selectedProduct.price)}</p>
              <p className="preview-description">{selectedProduct.description || 'A considered piece designed for effortless everyday style.'}</p>
              <div className="preview-meta">
                <span>{selectedProduct.stock > 0 ? `${selectedProduct.stock} available` : 'Currently out of stock'}</span>
                <span>{selectedProduct.colors?.length ? `${selectedProduct.colors.length} colors` : 'Curated finish'}</span>
              </div>
              <button
                className="primary-btn full-width"
                type="button"
                disabled={!selectedProduct.stock}
                onClick={() => { handleAddToCart(selectedProduct); setSelectedProduct(null); setShowCart(true); }}
              >
                {selectedProduct.stock > 0 ? 'Add to cart' : 'Out of stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="site-footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <img className="brand-logo-footer" src="/Brand-logo.jpg" alt="Jannat Collection" />
            <h3>JANNAT COLLECTION</h3>
            <p>
              Curated fashion for confident living, refined style, and everyday
              elegance.
            </p>
            <div className="social-links" aria-label="Social media links">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" title="Instagram">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" className="social-dot" /></svg>
              </a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook" title="Facebook">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 21v-8h2.7l.4-3H14V8.1c0-.9.3-1.6 1.7-1.6h1.8V3.8c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2V10H8.3v3H11v8" /></svg>
              </a>
              <a href="https://tiktok.com" target="_blank" rel="noreferrer" aria-label="TikTok" title="TikTok">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4v10.2a3.8 3.8 0 1 1-3-3.7" /><path d="M14 4c.7 2.2 2 3.5 4.2 4" /></svg>
              </a>
              <a href="https://pinterest.com" target="_blank" rel="noreferrer" aria-label="Pinterest" title="Pinterest">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.2a7.5 7.5 0 0 0-2.7 14.5c-.1-1.2 0-2.5.3-3.6l1-4.1s-.3-.7-.3-1.7c0-1.6.9-2.8 2.1-2.8 1 0 1.5.7 1.5 1.6 0 1-.6 2.4-.9 3.7-.3 1.1.6 2 1.7 2 2.1 0 3.7-2.2 3.7-5.4 0-2.8-2-4.8-4.9-4.8-3.3 0-5.2 2.5-5.2 5.1 0 1 .4 2 .9 2.6.1.1.1.2.1.4l-.3 1.1c-.1.4-.4.5-.7.3-1.5-.7-2.4-2.8-2.4-4.5 0-3.7 2.7-7.1 7.8-7.1 4.1 0 7.3 2.9 7.3 6.7 0 4-2.5 7.2-6 7.2-1.2 0-2.3-.6-2.7-1.3l-.7 2.8c-.3 1.1-.9 2.5-1.3 3.3.9.3 1.8.5 2.8.5A7.5 7.5 0 0 0 12 4.2Z" /></svg>
              </a>
            </div>
          </div>

          <div className="footer-newsletter">
            <p className="eyebrow">Join our style list</p>
            <h4>Be first to know about new arrivals and exclusive offers.</h4>
            {newsLetterStatus && (
              <p style={{
                margin: '10px 0',
                fontSize: '0.85rem',
                color: newsLetterStatus.includes('✓') ? '#1e7d49' : '#b44232',
              }}>
                {newsLetterStatus}
              </p>
            )}
            <form className="newsletter-form" onSubmit={handleSubscribeNewsletter}>
              <input
                type="email"
                placeholder="Your email address"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
              />
              <button type="submit">Subscribe</button>
            </form>
          </div>

          <div className="footer-links">
            <h4>Quick Links</h4>
            <ul>
              <li><button type="button" onClick={() => openInfoPage('home')}>Home</button></li>
              <li><button type="button" onClick={() => openInfoPage('shop')}>Shop</button></li>
              <li><button type="button" onClick={() => openInfoPage('new-arrivals')}>New Arrivals</button></li>
              <li><button type="button" onClick={() => openInfoPage('about')}>About Us</button></li>
              <li><button type="button" onClick={() => openInfoPage('contact')}>Contact</button></li>
            </ul>
          </div>

          <div className="footer-links">
            <h4>Customer Care</h4>
            <ul>
              <li><button type="button" onClick={() => openInfoPage('shipping')}>Shipping &amp; Delivery</button></li>
              <li><button type="button" onClick={() => openInfoPage('returns')}>Returns</button></li>
              <li><button type="button" onClick={() => openInfoPage('privacy')}>Privacy Policy</button></li>
              <li><button type="button" onClick={() => openInfoPage('terms')}>Terms</button></li>
              <li><button type="button" onClick={() => openInfoPage('support')}>Support</button></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 Jannat Collection</span>
          <span>Instagram · Facebook · TikTok</span>
        </div>
      </footer>
    </div>
  );
}
