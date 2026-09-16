import { useState, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const defaultCategoryOptions = ['Lace', 'Atampa', 'Passion', 'Shadda', 'Cotton', 'Hijab', 'Abaya'];
const formatAmount = (amount) => `₦${Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatCurrency = (amount) => formatAmount(amount);

const MiniBarChart = ({ data, color = '#9a6d43' }) => {
  const maxValue = Math.max(...data.map((item) => item.sales));

  return (
    <svg viewBox="0 0 320 220" className="mini-chart" role="img" aria-label="Sales chart">
      <g>
        {data.map((item, index) => {
          const barHeight = (item.sales / maxValue) * 150;
          const x = 18 + index * 48;
          const y = 190 - barHeight;

          return (
            <g key={item.name}>
              <rect x={x} y={y} width={28} height={barHeight} rx={8} fill={color} opacity={0.9} />
              <text x={x + 14} y={210} textAnchor="middle" fontSize="10" fill="#685d58">
                {item.name.slice(0, 3)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
};

const MiniLineChart = ({ data, color = '#1f1c1a' }) => {
  const values = data.map((item) => item.revenue);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);

  const points = data
    .map((item, index) => {
      const x = 20 + (index / (data.length - 1)) * 280;
      const y = 180 - ((item.revenue - minValue) / (maxValue - minValue || 1)) * 140;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 320 220" className="mini-chart" role="img" aria-label="Revenue chart">
      <g>
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((item, index) => {
          const x = 20 + (index / (data.length - 1)) * 280;
          const y = 180 - ((item.revenue - minValue) / (maxValue - minValue || 1)) * 140;
          return <circle key={item.name} cx={x} cy={y} r="4" fill={color} />;
        })}
      </g>
    </svg>
  );
};

const stats = [
  { label: 'Sales Stats', value: '₦0.00', delta: '+0%' },
  { label: 'Order Count', value: '0', delta: '+0%' },
  { label: 'Revenue', value: '₦0.00', delta: '+0%' },
  { label: 'Customers', value: '0', delta: '+0%' },
];

const salesData = [];
const revenueData = [];

const sideLinks = [
  'Admin Dashboard',
  'Admin Analytics',
  'Add Product',
  'Product List',
  'Order Alert',
  'Order History',
  'Customers',
  'Complaint',
  'Top Customer',
  'Settings',
];

const analyticsTabs = [
  'Sales Stats',
  'Order Count',
  'Revenue Trends',
  'Charts',
  'Top Products',
  'Customer Data',
];

export default function App() {
  const [selectedSidebar, setSelectedSidebar] = useState('Admin Dashboard');
  const [selectedTab, setSelectedTab] = useState('Sales Stats');
  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState({
    name: '',
    category: '',
    price: '',
    stock: '',
    description: '',
  });
  const [editingProductId, setEditingProductId] = useState(null);
  const [productImages, setProductImages] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken') || '');
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [adminReply, setAdminReply] = useState('');
  const [complaintReplyLoading, setComplaintReplyLoading] = useState(false);
  const [adminDataLoading, setAdminDataLoading] = useState(false);
  const [systemConfig, setSystemConfig] = useState(null);
  const [systemConfigLoading, setSystemConfigLoading] = useState(false);
  const [systemConfigSaving, setSystemConfigSaving] = useState(false);
  const [systemConfigMessage, setSystemConfigMessage] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const categoryOptions = useMemo(() => {
    const configCategories = Array.isArray(systemConfig?.categories) ? systemConfig.categories : [];
    const productCategories = products
      .map((product) => product.category)
      .filter((category) => typeof category === 'string' && category.trim())
      .map((category) => category.trim());

    return [...new Set([...defaultCategoryOptions, ...configCategories, ...productCategories])]
      .filter((category) => category && category.trim());
  }, [products, systemConfig]);

  const ensureAdminSession = async () => {
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        const data = await response.json();
        if (response.ok && data.user?.role === 'admin') {
          setAdminToken(savedToken);
          return savedToken;
        }
      } catch (error) {
        console.warn('Saved admin session validation failed:', error);
      }
      localStorage.removeItem('adminToken');
    }

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@jannatcollection.com',
          password: 'admin123',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Admin login failed');
      }

      localStorage.setItem('adminToken', data.token);
      setAdminToken(data.token);
      return data.token;
    } catch (error) {
      console.error('Admin session bootstrap failed:', error);
      return '';
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
    ensureAdminSession();
  }, []);

  useEffect(() => {
    const fetchAdminData = async () => {
      const token = await ensureAdminSession();
      if (!token) return;

      setAdminDataLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [ordersResponse, customersResponse, complaintsResponse, configResponse] = await Promise.all([
          fetch(`${API_URL}/orders`, { headers }),
          fetch(`${API_URL}/customers`, { headers }),
          fetch(`${API_URL}/complaints`, { headers }),
          fetch(`${API_URL}/config`, { headers }),
        ]);

        if (ordersResponse.ok) setOrders(await ordersResponse.json());
        if (customersResponse.ok) setCustomers(await customersResponse.json());
        if (complaintsResponse.ok) setComplaints(await complaintsResponse.json());
        if (configResponse.ok) setSystemConfig(await configResponse.json());
      } catch (error) {
        console.error('Failed to fetch admin data:', error);
      } finally {
        setAdminDataLoading(false);
      }
    };

    if (adminToken) fetchAdminData();
  }, [adminToken]);

  const updateOrderStatus = async (orderId, status) => {
    const token = await ensureAdminSession();
    const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (response.ok) {
      const updatedOrder = await response.json();
      setOrders((current) => current.map((order) => (order._id === orderId ? updatedOrder : order)));
    }
  };

  const updateComplaintStatus = async (complaintId, status) => {
    const token = await ensureAdminSession();
    const response = await fetch(`${API_URL}/complaints/${complaintId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (response.ok) {
      const updatedComplaint = await response.json();
      setComplaints((current) => current.map((item) => (item._id === complaintId ? updatedComplaint : item)));
      setSelectedComplaint((current) => (current?._id === complaintId ? updatedComplaint : current));
    }
  };

  const openComplaint = async (complaint) => {
    setSelectedComplaint(complaint);
    const token = await ensureAdminSession();
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/complaints/${complaint._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const conversation = await response.json();
        setSelectedComplaint(conversation);
        setComplaints((current) => current.map((item) => (item._id === conversation._id ? conversation : item)));
      }
      await fetch(`${API_URL}/complaints/${complaint._id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Failed to open complaint:', error);
    }
  };

  const sendAdminReply = async (event) => {
    event.preventDefault();
    const message = adminReply.trim();
    if (!message || !selectedComplaint) return;
    const token = await ensureAdminSession();
    if (!token) return;

    setComplaintReplyLoading(true);
    try {
      const response = await fetch(`${API_URL}/complaints/${selectedComplaint._id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message }),
      });
      if (response.ok) {
        const updatedComplaint = await response.json();
        setSelectedComplaint(updatedComplaint);
        setComplaints((current) => current.map((item) => (item._id === updatedComplaint._id ? updatedComplaint : item)));
        setAdminReply('');
      }
    } catch (error) {
      console.error('Failed to send admin reply:', error);
    } finally {
      setComplaintReplyLoading(false);
    }
  };

  useEffect(() => {
    if (!adminToken) return undefined;
    const socket = io(API_URL.replace('/api', ''), { auth: { token: adminToken } });
    socket.on('complaint:updated', (updatedComplaint) => {
      setComplaints((current) => {
        const exists = current.some((item) => item._id === updatedComplaint._id);
        if (!exists) return [updatedComplaint, ...current];
        return current
          .map((item) => (item._id === updatedComplaint._id ? updatedComplaint : item))
          .sort((a, b) => new Date(b.lastMessageAt || b.updatedAt) - new Date(a.lastMessageAt || a.updatedAt));
      });
      setSelectedComplaint((current) => (current?._id === updatedComplaint._id ? updatedComplaint : current));
    });
    return () => socket.disconnect();
  }, [adminToken]);

  const saveSystemConfig = async (e) => {
    e.preventDefault();
    if (!systemConfig) return;
    const token = await ensureAdminSession();
    if (!token) return;

    setSystemConfigSaving(true);
    setSystemConfigMessage('');
    try {
      const response = await fetch(`${API_URL}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(systemConfig),
      });

      if (response.ok) {
        const updated = await response.json();
        setSystemConfig(updated);
        setSystemConfigMessage('✓ Settings saved successfully');
        setTimeout(() => setSystemConfigMessage(''), 3000);
      } else {
        const data = await response.json();
        setSystemConfigMessage(data.message || 'Failed to save settings');
      }
    } catch (error) {
      setSystemConfigMessage('Error: ' + error.message);
    } finally {
      setSystemConfigSaving(false);
    }
  };

  const toggleCustomerSuspension = async (customer) => {
    const token = await ensureAdminSession();
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/customers/${customer._id}/suspension`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ suspended: !customer.suspended }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.message || 'Could not update customer status.');
        return;
      }

      const updatedCustomer = await response.json();
      setCustomers((current) => current.map((item) => (
        item._id === customer._id
          ? { ...item, ...updatedCustomer }
          : item
      )));
    } catch (error) {
      console.error('Failed to update customer suspension:', error);
      alert('Failed to update customer status. Please try again.');
    }
  };

  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files) return;

    setUploadingImages(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const base64 = event.target.result;
          const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: base64,
              filename: file.name,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            setProductImages((prev) => [...prev, {
              url: data.url,
              preview: base64,
              filename: data.filename,
            }]);
          }
        } catch (error) {
          console.error('Failed to upload image:', error);
        }

        // Mark as done when all files are processed
        if (i === files.length - 1) {
          setUploadingImages(false);
        }
      };
      
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (index) => {
    setProductImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!productForm.name || !productForm.category || !productForm.price) return;

    const token = await ensureAdminSession();
    if (!token) {
      alert('Admin session could not be created. Please try again.');
      return;
    }

    const productPayload = {
      name: productForm.name,
      description: productForm.description || 'No description',
      price: Number(productForm.price),
      category: productForm.category,
      stock: Number(productForm.stock) || 0,
      images: productImages.map((img) => img.url || img),
      featured: false,
      sizes: [],
      colors: [],
    };

    try {
      const response = await fetch(`${API_URL}/products${editingProductId ? `/${editingProductId}` : ''}`, {
        method: editingProductId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(productPayload),
      });

      if (response.ok) {
        const savedProduct = await response.json();
        setProducts((current) => editingProductId
          ? current.map((product) => product._id === editingProductId ? savedProduct : product)
          : [savedProduct, ...current]);
        setProductForm({
          name: '',
          category: '',
          price: '',
          stock: '',
          description: '',
        });
        setProductImages([]);
        setEditingProductId(null);
        setSelectedSidebar('Product List');
        return;
      }

      const errorData = await response.json().catch(() => ({}));
      alert(errorData.message || 'Could not add product.');
    } catch (error) {
      console.error('Failed to add product:', error);
      alert('Failed to add product. Please try again.');
    }
  };

  const startEditingProduct = (product) => {
    setEditingProductId(product._id);
    setProductForm({
      name: product.name || '',
      category: product.category || '',
      price: product.price || '',
      stock: product.stock || '',
      description: product.description || '',
    });
    setProductImages((product.images || []).map((url) => ({ url, preview: url, filename: url.split('/').pop() })));
    setSelectedSidebar('Add Product');
  };

  const cancelProductEdit = () => {
    setEditingProductId(null);
    setProductForm({ name: '', category: '', price: '', stock: '', description: '' });
    setProductImages([]);
  };

  const handleDeleteProduct = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const token = await ensureAdminSession();
      if (!token) {
        alert('Admin session could not be created. Please try again.');
        return;
      }

      const response = await fetch(`${API_URL}/products/${productId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setProducts((current) => current.filter((product) => product._id !== productId));
      }
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  };

  const handleToggleStock = async (productId, currentStock) => {
    try {
      const token = await ensureAdminSession();
      if (!token) {
        alert('Admin session could not be created. Please try again.');
        return;
      }

      const nextStock = currentStock > 0 ? 0 : 1;
      const response = await fetch(`${API_URL}/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stock: nextStock }),
      });

      if (response.ok) {
        const updatedProduct = await response.json();
        setProducts((current) =>
          current.map((product) => (product._id === productId ? updatedProduct : product))
        );
        return;
      }

      const errorData = await response.json().catch(() => ({}));
      alert(errorData.message || 'Could not update product stock.');
    } catch (error) {
      console.error('Failed to update stock:', error);
      alert('Failed to update stock. Please try again.');
    }
  };

  const renderAnalyticsTab = () => {
    const revenue = orders.reduce((sum, order) => sum + order.total, 0);
    const averageOrder = orders.length ? revenue / orders.length : 0;

    switch (selectedTab) {
      case 'Order Count':
        return (
          <section className="analytics-tab-panel">
            <div className="stats-grid">
              {['pending', 'paid', 'shipped', 'delivered'].map((status) => (
                <div className="stat-card" key={status}>
                  <p>{status} orders</p>
                  <h3>{orders.filter((order) => order.status === status).length}</h3>
                  <span>Live status</span>
                </div>
              ))}
            </div>
            <div className="data-card analytics-detail-card">
              <div className="card-header"><h3>Recent order activity</h3><span className="analytics-live-label">Live data</span></div>
              <div className="product-list">
                {orders.slice(0, 8).map((order) => <div className="product-row" key={order._id}><div><strong>#{order._id.slice(-6).toUpperCase()}</strong><small>{order.user?.name || order.customer?.name || 'Guest customer'}</small></div><span>{order.status}</span></div>)}
                {!orders.length && <p className="empty-state">No orders have been placed yet.</p>}
              </div>
            </div>
          </section>
        );
      case 'Revenue Trends':
        return (
          <section className="analytics-tab-panel">
            <div className="stats-grid">
              <div className="stat-card"><p>Gross revenue</p><h3>{formatCurrency(revenue)}</h3><span>All time</span></div>
              <div className="stat-card"><p>Average order</p><h3>{formatCurrency(averageOrder)}</h3><span>Per order</span></div>
              <div className="stat-card"><p>Paid revenue</p><h3>{formatCurrency(orders.filter((order) => order.paymentStatus === 'paid').reduce((sum, order) => sum + order.total, 0))}</h3><span>Confirmed payments</span></div>
              <div className="stat-card"><p>Pending value</p><h3>{formatCurrency(orders.filter((order) => order.status === 'pending').reduce((sum, order) => sum + order.total, 0))}</h3><span>Awaiting action</span></div>
            </div>
            <div className="data-card analytics-detail-card"><div className="card-header"><h3>Revenue by order</h3><span className="analytics-live-label">Live data</span></div><div className="product-list">{orders.slice(0, 8).map((order) => <div className="product-row" key={order._id}><div><strong>Order #{order._id.slice(-6).toUpperCase()}</strong><small>{new Date(order.createdAt).toLocaleDateString()}</small></div><span>{formatCurrency(order.total)}</span></div>)}{!orders.length && <p className="empty-state">Revenue data will appear after orders are placed.</p>}</div></div>
          </section>
        );
      case 'Charts':
        return (
          <section className="analytics-tab-panel">
            <section className="chart-grid"><div className="chart-card"><div className="card-header"><h3>Sales trend</h3><span className="analytics-live-label">Live data</span></div><MiniBarChart data={salesData} /></div><div className="chart-card"><div className="card-header"><h3>Revenue trend</h3><span className="analytics-live-label">Live data</span></div><MiniLineChart data={revenueData} /></div></section>
            <div className="data-card analytics-detail-card"><h3>Chart data is ready for order history and revenue events.</h3><p className="empty-state">Charts will populate as dated sales are recorded.</p></div>
          </section>
        );
      case 'Top Products':
        return (
          <section className="analytics-tab-panel"><div className="data-card analytics-detail-card"><div className="card-header"><h3>Top products</h3><span className="analytics-live-label">Catalog</span></div><div className="product-list">{[...products].sort((a, b) => b.price - a.price).map((product, index) => <div className="product-row" key={product._id || product.name}><div><strong>{index + 1}. {product.name}</strong><small>{product.category || 'Uncategorized'} · {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</small></div><span>{formatCurrency(product.price)}</span></div>)}{!products.length && <p className="empty-state">No products to analyze yet.</p>}</div></div></section>
        );
      case 'Customer Data':
        return (
          <section className="analytics-tab-panel"><div className="stats-grid"><div className="stat-card"><p>Total customers</p><h3>{customers.length}</h3><span>Registered</span></div><div className="stat-card"><p>Active customers</p><h3>{customers.filter((customer) => !customer.suspended).length}</h3><span>Not suspended</span></div><div className="stat-card"><p>Customer spend</p><h3>{formatCurrency(customers.reduce((sum, customer) => sum + customer.totalSpend, 0))}</h3><span>Tracked value</span></div><div className="stat-card"><p>Orders per customer</p><h3>{customers.length ? (orders.length / customers.length).toFixed(1) : '0.0'}</h3><span>Average</span></div></div><div className="data-card analytics-detail-card"><div className="card-header"><h3>Customer ranking</h3><span className="analytics-live-label">Live data</span></div><div className="product-list">{[...customers].sort((a, b) => b.totalSpend - a.totalSpend).map((customer, index) => <div className="product-row" key={customer._id}><div><strong>{index + 1}. {customer.name}</strong><small>{customer.email}</small></div><span>{formatCurrency(customer.totalSpend)}</span></div>)}{!customers.length && <p className="empty-state">No customer data yet.</p>}</div></div></section>
        );
      case 'Sales Stats':
      default:
        return (
          <section className="analytics-tab-panel"><section className="stats-grid">{stats.map((item) => <div className="stat-card" key={item.label}><p>{item.label}</p><h3>{item.label === 'Order Count' ? orders.length : item.label === 'Revenue' ? formatCurrency(revenue) : item.label === 'Customers' ? customers.length : item.value}</h3><span>{item.label === 'Sales Stats' ? 'Live overview' : 'Live data'}</span></div>)}</section><section className="chart-grid"><div className="chart-card"><div className="card-header"><h3>Sales trend</h3><span className="analytics-live-label">Overview</span></div><MiniBarChart data={salesData} /></div><div className="chart-card"><div className="card-header"><h3>Revenue trend</h3><span className="analytics-live-label">Overview</span></div><MiniLineChart data={revenueData} /></div></section></section>
        );
    }
  };

  const renderPage = () => {
    switch (selectedSidebar) {
      case 'Add Product':
        return (
          <div className="admin-form-card admin-form-shell">
            <div className="section-header-row">
              <div>
                <p className="eyebrow">Inventory</p>
                <h3>{editingProductId ? 'Edit Product' : 'Add New Product'}</h3>
              </div>
              {editingProductId ? (
                <button type="button" className="secondary-btn" onClick={cancelProductEdit}>Cancel edit</button>
              ) : <span className="form-pill">Fresh listing</span>}
            </div>

            <form className="admin-product-form" onSubmit={handleAddProduct}>
              <div className="admin-form-grid">
                <label className="input-group">
                  <span>Product name</span>
                  <input
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="Eg. Silk Wrap Dress"
                  />
                </label>

                <label className="input-group">
                  <span>Category</span>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  >
                    <option value="">Select a category</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>

                <label className="input-group">
                  <span>Price</span>
                  <input
                    type="number"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="0.00"
                  />
                </label>

                <label className="input-group">
                  <span>Stock</span>
                  <input
                    type="number"
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                    placeholder="0"
                  />
                </label>
              </div>

              <label className="input-group full-span">
                <span>Description</span>
                <textarea
                  rows="5"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Tell customers what makes this product special"
                />
              </label>

              <div className="upload-panel">
                <div className="upload-label-row">
                  <span>Product images</span>
                  <label className="upload-button">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                    Select images
                  </label>
                </div>

                {uploadingImages && (
                  <p className="upload-status">Uploading images...</p>
                )}

                {productImages.length > 0 && (
                  <div className="image-preview-grid">
                    {productImages.map((image, index) => (
                      <div key={index} className="image-thumb-wrap">
                        <img
                          src={typeof image === 'string' ? image : image.preview}
                          alt={`Product ${index + 1}`}
                          className="image-thumb"
                          title={typeof image === 'string' ? 'Image' : image.filename}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="remove-image-btn"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" className="dark-btn full-width-button" disabled={uploadingImages}>
                {uploadingImages ? 'Uploading...' : editingProductId ? 'Update product' : 'Save product'}
              </button>
            </form>
          </div>
        );

      case 'Product List':
        return (
          <div className="admin-form-card">
            <h3>Product List</h3>
            <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products..." aria-label="Search products" />
            <div className="product-table">
              {products.filter((product) => `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(productSearch.trim().toLowerCase())).length === 0 ? (
                <p className="empty-state">No products available yet.</p>
              ) : (
                products.filter((product) => `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(productSearch.trim().toLowerCase())).map((product) => (
                  <div key={product._id || product.name} className="product-row-admin">
                    <div className="product-main-info">
                      <strong>{product.name}</strong>
                      <small>{product.category || 'Uncategorized'}</small>
                    </div>

                    <div className="product-meta">
                      <span className={`stock-badge ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                        {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                      </span>
                      <span className="price-tag">{formatAmount(product.price)}</span>
                    </div>

                    <div className="product-actions">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => startEditingProduct(product)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="toggle-stock-btn"
                        onClick={() => handleToggleStock(product._id, product.stock)}
                      >
                        {product.stock > 0 ? 'Out of stock' : 'Restock'}
                      </button>
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => handleDeleteProduct(product._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 'Order Alert':
        return (
          <div className="admin-form-card">
            <h3>Order Alert</h3>
            <div className="live-list">
              {adminDataLoading && <p className="empty-state">Loading orders...</p>}
              {!adminDataLoading && orders.filter((order) => ['pending', 'paid'].includes(order.status)).length === 0 && (
                <p className="empty-state">No orders need attention.</p>
              )}
              {orders.filter((order) => ['pending', 'paid'].includes(order.status)).map((order) => (
                <div className="order-card alert-order-card" key={order._id}>
                  <div className="order-card-topline">
                    <span className="order-alert-label">Needs attention</span>
                    <small>{new Date(order.createdAt).toLocaleString()}</small>
                  </div>
                  <div className="order-card-main">
                    <div>
                      <strong>Order #{order._id.slice(-6).toUpperCase()}</strong>
                      <span>{order.user?.name || order.customer?.name || 'Guest customer'} · {order.items.length} item{order.items.length === 1 ? '' : 's'}</span>
                      <small>{order.customer?.address || 'No delivery address recorded'}</small>
                    </div>
                    <strong className="order-total">{formatCurrency(order.total)}</strong>
                  </div>
                  <div className="order-card-footer">
                    <span className="payment-state">Payment: {order.paymentStatus}</span>
                    <select className={`order-status-select status-select-${order.status}`} value={order.status} onChange={(e) => updateOrderStatus(order._id, e.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'Order History':
        return (
          <div className="admin-form-card">
            <h3>Order History</h3>
            <input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Search orders or customers..." aria-label="Search orders" />
            <div className="live-list">
              {orders.filter((order) => `${order._id} ${order.customer?.name || ''} ${order.customer?.email || ''} ${order.status}`.toLowerCase().includes(orderSearch.trim().toLowerCase())).length === 0 ? <p className="empty-state">No matching orders found.</p> : orders.filter((order) => `${order._id} ${order.customer?.name || ''} ${order.customer?.email || ''} ${order.status}`.toLowerCase().includes(orderSearch.trim().toLowerCase())).map((order) => (
                <div className="order-card" key={order._id}>
                  <div className="order-card-topline">
                    <span className={`order-status status-${order.status}`}>{order.status}</span>
                    <small>{new Date(order.createdAt).toLocaleString()}</small>
                  </div>
                  <div className="order-card-main">
                    <div>
                      <strong>Order #{order._id.slice(-6).toUpperCase()}</strong>
                      <span>{order.user?.name || order.customer?.name || 'Guest customer'} · {order.items.length} item{order.items.length === 1 ? '' : 's'}</span>
                      <small>{order.customer?.email || 'No email recorded'} · {order.customer?.phone || 'No phone recorded'}</small>
                    </div>
                    <strong className="order-total">{formatCurrency(order.total)}</strong>
                  </div>
                  <div className="order-card-footer">
                    <span className="payment-state">Payment: {order.paymentStatus}</span>
                    <span>{order.customer?.address || 'No delivery address recorded'}</span>
                    <span className={`order-status status-${order.status}`}>{order.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'Customers':
        return (
          <div className="admin-form-card">
            <h3>Customers</h3>
            <input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search customers..." aria-label="Search customers" />
            <div className="live-list">
              {customers.filter((customer) => `${customer.name} ${customer.email} ${customer.phone || ''}`.toLowerCase().includes(customerSearch.trim().toLowerCase())).length === 0 ? <p className="empty-state">No matching customers found.</p> : customers.filter((customer) => `${customer.name} ${customer.email} ${customer.phone || ''}`.toLowerCase().includes(customerSearch.trim().toLowerCase())).map((customer) => (
                <div className="live-item" key={customer._id}>
                  <div>
                    <strong>{customer.name}</strong>
                    <span>{customer.email} · {customer.suspended ? 'Suspended' : 'Active'}</span>
                  </div>
                  <div className="live-item-end">
                    <strong>{customer.orderCount} orders</strong>
                    <span>{formatCurrency(customer.totalSpend)} spent</span>
                    <button
                      type="button"
                      className={customer.suspended ? 'customer-action-btn restore' : 'customer-action-btn suspend'}
                      onClick={() => toggleCustomerSuspension(customer)}
                    >
                      {customer.suspended ? 'Restore access' : 'Suspend customer'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'Complaint':
        return (
          <div className="admin-form-card">
            <h3>Complaint</h3>
            <div className="complaint-workspace">
              <div className="live-list complaint-list">
                {complaints.length === 0 ? <p className="empty-state">No customer complaints yet.</p> : complaints.map((complaint) => {
                  const latestMessage = complaint.messages?.[complaint.messages.length - 1];
                  const unread = complaint.messages?.some((message) => !message.readByAdmin && message.senderRole === 'customer');
                  return (
                    <button className={`live-item complaint-list-item ${selectedComplaint?._id === complaint._id ? 'selected' : ''}`} type="button" key={complaint._id} onClick={() => openComplaint(complaint)}>
                      <span className="complaint-list-copy"><strong>{complaint.subject}</strong><span>{complaint.name || complaint.user?.name} · {latestMessage?.text || 'No messages yet'}</span></span>
                      <span className="complaint-list-meta"><span className={`complaint-status status-${complaint.status.replace(' ', '-')}`}>{complaint.status}</span>{unread && <span className="unread-dot" aria-label="Unread customer message" />}</span>
                    </button>
                  );
                })}
              </div>
              {selectedComplaint && (
                <section className="complaint-chat" aria-label="Complaint chat">
                  <div className="complaint-chat-header">
                    <div><span className="eyebrow">Support conversation</span><h4>{selectedComplaint.subject}</h4><p>{selectedComplaint.name || selectedComplaint.user?.name} · {selectedComplaint.user?.email || ''}</p></div>
                    <select value={selectedComplaint.status} onChange={(e) => updateComplaintStatus(selectedComplaint._id, e.target.value)} aria-label="Conversation status">
                      <option value="open">Open</option><option value="in review">In review</option><option value="resolved">Resolved</option>
                    </select>
                  </div>
                  <div className="complaint-messages">
                    {selectedComplaint.messages?.map((message) => <div className={`chat-message ${message.senderRole === 'admin' ? 'from-admin' : 'from-customer'}`} key={message._id}><p>{message.text}</p><small>{message.senderRole === 'admin' ? 'You' : selectedComplaint.name} · {new Date(message.createdAt).toLocaleString()}</small></div>)}
                  </div>
                  <form className="complaint-reply-form" onSubmit={sendAdminReply}><textarea value={adminReply} onChange={(e) => setAdminReply(e.target.value)} rows="3" placeholder="Write a reply to this customer..." /><button className="primary-btn" type="submit" disabled={complaintReplyLoading || !adminReply.trim()}>{complaintReplyLoading ? 'Sending...' : 'Send reply'}</button></form>
                </section>
              )}
            </div>
          </div>
        );

      case 'Top Customer':
        return (
          <div className="admin-form-card">
            <h3>Top Customer</h3>
            {customers.length === 0 ? <p className="empty-state">Top customers will appear after orders are placed.</p> : (
              <div className="leader-card">
                <div className="leader-badge">#1</div>
                <div>
                  <strong>{[...customers].sort((a, b) => b.totalSpend - a.totalSpend)[0].name}</strong>
                  <p>Lifetime purchase value: {formatCurrency([...customers].sort((a, b) => b.totalSpend - a.totalSpend)[0].totalSpend)}</p>
                </div>
              </div>
            )}
          </div>
        );

      case 'Settings':
        return (
          <div className="admin-form-card">
            <h3>Settings</h3>
            {systemConfigMessage && (
              <div style={{
                padding: '12px 14px',
                marginBottom: '14px',
                borderRadius: '8px',
                fontSize: '0.9rem',
                background: systemConfigMessage.includes('✓') ? '#eaf7ee' : '#fef1ee',
                color: systemConfigMessage.includes('✓') ? '#1e7d49' : '#b44232',
              }}>
                {systemConfigMessage}
              </div>
            )}
            <form className="settings-form" onSubmit={saveSystemConfig}>
              {systemConfig ? (
                <>
                  <fieldset className="settings-section">
                    <legend>Store Identity</legend>
                    <label>Store name<input type="text" value={systemConfig.storeName || ''} onChange={(e) => setSystemConfig({...systemConfig, storeName: e.target.value})} maxLength="100" /></label>
                    <label>Logo URL<input type="text" value={systemConfig.logoUrl || ''} onChange={(e) => setSystemConfig({...systemConfig, logoUrl: e.target.value})} maxLength="500" /></label>
                    <label>Tagline<textarea rows="2" value={systemConfig.tagline || ''} onChange={(e) => setSystemConfig({...systemConfig, tagline: e.target.value})} maxLength="240" /></label>
                    <label>Currency<input type="text" value={systemConfig.currency || ''} onChange={(e) => setSystemConfig({...systemConfig, currency: e.target.value?.toUpperCase()})} maxLength="5" /></label>
                  </fieldset>

                  <fieldset className="settings-section">
                    <legend>Customer Contact</legend>
                    <label>Contact email<input type="email" value={systemConfig.contactEmail || ''} onChange={(e) => setSystemConfig({...systemConfig, contactEmail: e.target.value})} maxLength="160" /></label>
                    <label>Phone<input type="tel" value={systemConfig.phone || ''} onChange={(e) => setSystemConfig({...systemConfig, phone: e.target.value})} maxLength="40" /></label>
                    <label>Address<textarea rows="2" value={systemConfig.address || ''} onChange={(e) => setSystemConfig({...systemConfig, address: e.target.value})} maxLength="240" /></label>
                    <label>Support hours<input type="text" placeholder="e.g. Monday - Friday, 9:00 AM - 5:00 PM" value={systemConfig.supportHours || ''} onChange={(e) => setSystemConfig({...systemConfig, supportHours: e.target.value})} maxLength="160" /></label>
                  </fieldset>

                  <fieldset className="settings-section">
                    <legend>Commerce Rules</legend>
                    <label>Shipping message<textarea rows="2" value={systemConfig.shippingMessage || ''} onChange={(e) => setSystemConfig({...systemConfig, shippingMessage: e.target.value})} maxLength="500" /></label>
                    <label>Return window (days)<input type="number" value={systemConfig.returnWindowDays || 14} onChange={(e) => setSystemConfig({...systemConfig, returnWindowDays: Math.max(0, parseInt(e.target.value) || 0)})} min="0" max="365" /></label>
                    <label style={{display: 'flex', alignItems: 'center', gap: '8px'}}><input type="checkbox" checked={systemConfig.newsletterEnabled} onChange={(e) => setSystemConfig({...systemConfig, newsletterEnabled: e.target.checked})} /> Enable newsletter</label>
                  </fieldset>

                  <fieldset className="settings-section">
                    <legend>Brand Categories</legend>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="Add a new category"
                        style={{ flex: 1 }}
                      />
                      <button
                        className="primary-btn"
                        type="button"
                        onClick={() => {
                          const trimmed = newCategory.trim();
                          if (!trimmed) return;

                          const existing = Array.isArray(systemConfig.categories) ? systemConfig.categories : [];
                          const nextCategories = [...new Set([...existing, trimmed])];
                          setSystemConfig({ ...systemConfig, categories: nextCategories });
                          setNewCategory('');
                        }}
                        style={{ background: '#2c2018', borderColor: '#2c2018', color: '#fff' }}
                      >
                        Add category
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(systemConfig.categories || []).map((category) => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => {
                            setSystemConfig({
                              ...systemConfig,
                              categories: (systemConfig.categories || []).filter((item) => item !== category),
                            });
                          }}
                          style={{ background: '#f7f1ea', border: '1px solid #d9c0a4', borderRadius: '999px', padding: '6px 12px', cursor: 'pointer', color: '#2a1d14', fontWeight: 600 }}
                        >
                          {category} ×
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="settings-section">
                    <legend>Social Links</legend>
                    <label>Instagram<input type="url" value={systemConfig.socialLinks?.instagram || ''} onChange={(e) => setSystemConfig({...systemConfig, socialLinks: {...systemConfig.socialLinks, instagram: e.target.value}})} maxLength="500" placeholder="https://instagram.com" /></label>
                    <label>Facebook<input type="url" value={systemConfig.socialLinks?.facebook || ''} onChange={(e) => setSystemConfig({...systemConfig, socialLinks: {...systemConfig.socialLinks, facebook: e.target.value}})} maxLength="500" placeholder="https://facebook.com" /></label>
                    <label>TikTok<input type="url" value={systemConfig.socialLinks?.tiktok || ''} onChange={(e) => setSystemConfig({...systemConfig, socialLinks: {...systemConfig.socialLinks, tiktok: e.target.value}})} maxLength="500" placeholder="https://tiktok.com" /></label>
                    <label>Pinterest<input type="url" value={systemConfig.socialLinks?.pinterest || ''} onChange={(e) => setSystemConfig({...systemConfig, socialLinks: {...systemConfig.socialLinks, pinterest: e.target.value}})} maxLength="500" placeholder="https://pinterest.com" /></label>
                  </fieldset>

                  <button className="primary-btn" type="submit" disabled={systemConfigSaving}>{systemConfigSaving ? 'Saving...' : 'Save settings'}</button>
                </>
              ) : (
                <p className="empty-state">Loading configuration...</p>
              )}
            </form>
          </div>
        );

      case 'Admin Analytics':
      case 'Analytics':
        return (
          <section className="analytics-page">
            <div className="analytics-intro">
              <p className="eyebrow">Live performance</p>
              <h2>Analytics that move with your store</h2>
              <p>Track orders, customer value, inventory, and the products getting attention right now.</p>
            </div>

            <section className="stats-grid">
              <div className="stat-card"><p>Total orders</p><h3>{orders.length}</h3><span>Live</span></div>
              <div className="stat-card"><p>Gross revenue</p><h3>{formatCurrency(orders.reduce((sum, order) => sum + order.total, 0))}</h3><span>All time</span></div>
              <div className="stat-card"><p>Customers</p><h3>{customers.length}</h3><span>Registered</span></div>
              <div className="stat-card"><p>Products</p><h3>{products.length}</h3><span>Catalog</span></div>
            </section>

            <section className="bottom-grid analytics-panels">
              <div className="data-card">
                <div className="card-header"><h3>Order status</h3><span className="analytics-live-label">Live data</span></div>
                <div className="customer-summary">
                  {['pending', 'paid', 'shipped', 'delivered', 'cancelled'].map((status) => (
                    <div key={status}><span>{status}</span><strong>{orders.filter((order) => order.status === status).length}</strong></div>
                  ))}
                </div>
              </div>
              <div className="data-card">
                <div className="card-header"><h3>Top products by price</h3><span className="analytics-live-label">Catalog</span></div>
                <div className="product-list">
                  {[...products].sort((a, b) => b.price - a.price).slice(0, 5).map((product) => (
                    <div className="product-row" key={product._id || product.name}>
                      <div><strong>{product.name}</strong><small>{product.category || 'Uncategorized'}</small></div>
                      <span>{formatAmount(product.price)}</span>
                    </div>
                  ))}
                  {products.length === 0 && <p className="empty-state">No products to analyze yet.</p>}
                </div>
              </div>
            </section>
          </section>
        );

      case 'Admin Dashboard':
      case 'Dashboard':
      default:
        return (
          <>
            <nav className="analytics-tabs">
              {analyticsTabs.map((tab) => (
                <button
                  className={selectedTab === tab ? 'active' : ''}
                  key={tab}
                  type="button"
                  onClick={() => setSelectedTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </nav>

            {renderAnalyticsTab()}
          </>
        );
    }
  };

  const pageTitle =
    selectedSidebar === 'Admin Dashboard' || selectedSidebar === 'Dashboard'
      ? 'Admin Dashboard'
      : selectedSidebar === 'Admin Analytics' || selectedSidebar === 'Analytics'
        ? 'Admin Analytics'
        : selectedSidebar;

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">JC</div>
          <div>
            <h3>JANNAT</h3>
            <p>Admin Console</p>
          </div>
        </div>

        <nav className="sidebar-menu">
          {sideLinks.map((item) => (
            <button
              className={selectedSidebar === item ? 'active' : ''}
              key={item}
              type="button"
              onClick={() => setSelectedSidebar(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="sidebar-logout-btn">
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">Business overview</p>
            <h1>{pageTitle}</h1>
          </div>

          <div className="admin-actions">
            <button className="ghost-btn" type="button">Export</button>
            <button className="dark-btn" type="button">Add Report</button>
          </div>
        </header>

        {renderPage()}
      </main>
    </div>
  );
}
