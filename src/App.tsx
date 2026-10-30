import React, { useState, useEffect } from 'react';
import { 
  Home, PlusCircle, LayoutList, Utensils, BarChart3, 
  Search, Filter, Trash2, CheckCircle2, AlertTriangle, 
  ChevronRight, Clock, Box, Calendar, ChevronDown, Camera,
  Download, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip 
} from 'recharts';

// --- TYPES ---
interface Item {
  id: number;
  name: string;
  category: string;
  quantity: number;
  expiry_date: string;
  status: 'active' | 'used' | 'expired';
  daysLeft: number;
  freshness: 'fresh' | 'expiring' | 'expired';
}

interface DashboardData {
  totalItems: number;
  expiringSoon: number;
  expired: number;
  wasteScore: number;
  useTheseFirst: Item[];
}

interface Recipe {
  id?: number;
  title: string;
  cookTime: string;
  ingredients: string[];
  usesExpiring?: string[];
  steps: string[];
  isCustom?: boolean;
}

interface StatsData {
  allTime: { saved: number; expired: number };
  last7Days: { saved: number; expired: number };
  byCategory: { category: string; count: number }[];
  wasteScore: number;
  motivationalMessage: string;
}

// --- COMPONENTS ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'add' | 'inventory' | 'recipes' | 'stats' | 'shopping'>('home');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Periodic check for items expiring in 1 day
  useEffect(() => {
    const checkExpiries = async () => {
      try {
        const res = await fetch('/api/alerts');
        const data = await res.json();
        const oneDayItems = data.items.filter((item: any) => item.daysLeft === 1);
        
        if (oneDayItems.length > 0 && Notification.permission === 'granted') {
          const names = oneDayItems.map((i: any) => i.name).join(', ');
          new Notification('FreshKeep Alert', {
            body: `Expiring tomorrow: ${names}. Use them soon!`,
            icon: '/icon-192x192.png'
          });
        }
      } catch (err) {
        console.error("Failed to check expiries for notifications", err);
      }
    };

    // Check once on load and then every 4 hours
    checkExpiries();
    const interval = setInterval(checkExpiries, 4 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  const refreshData = () => setRefreshKey(prev => prev + 1);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 lg:pb-0 lg:pl-64">
      {/* Sidebar (Desktop) / Bottom Nav (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 lg:top-0 lg:right-auto lg:w-64 lg:border-t-0 lg:border-r flex lg:flex-col shadow-lg lg:shadow-none">
        <div className="hidden lg:flex items-center gap-2 p-6 border-b border-slate-100">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
            <Box size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight">FreshKeep</span>
        </div>
        
        <div className="flex flex-1 lg:flex-col justify-around lg:justify-start lg:p-4 lg:gap-2">
          <NavItem active={activeTab === 'home'} icon={<Home />} label="Home" onClick={() => setActiveTab('home')} />
          <NavItem active={activeTab === 'inventory'} icon={<LayoutList />} label="Inventory" onClick={() => setActiveTab('inventory')} />
          <NavItem active={activeTab === 'shopping'} icon={<Search />} label="Shopping" onClick={() => setActiveTab('shopping')} />
          <NavItem active={activeTab === 'add'} icon={<PlusCircle />} label="Add Item" onClick={() => setActiveTab('add')} />
          <NavItem active={activeTab === 'recipes'} icon={<Utensils />} label="Recipes" onClick={() => setActiveTab('recipes')} />
          <NavItem active={activeTab === 'stats'} icon={<BarChart3 />} label="Stats" onClick={() => setActiveTab('stats')} />
        </div>
      </nav>

      <main className="p-4 md:p-8 max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && <HomeDashboard key={refreshKey} onAction={refreshData} />}
          {activeTab === 'inventory' && <InventoryView key={refreshKey} onAction={refreshData} />}
          {activeTab === 'shopping' && <ShoppingListView key={refreshKey} onAction={refreshData} />}
          {activeTab === 'add' && <AddItemView onAction={() => { setActiveTab('inventory'); refreshData(); }} />}
          {activeTab === 'recipes' && <RecipesView key={refreshKey} />}
          {activeTab === 'stats' && <StatsView key={refreshKey} />}
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col lg:flex-row items-center gap-1 lg:gap-3 p-3 lg:px-4 lg:py-3 rounded-xl transition-all duration-200 group ${
        active 
          ? 'text-emerald-600 bg-emerald-50 lg:bg-emerald-500 lg:text-white shadow-sm' 
          : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-50'
      }`}
    >
      <span className="group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-[10px] lg:text-sm font-medium">{label}</span>
    </button>
  );
}

// --- SCREEN: HOME DASHBOARD ---

function HomeDashboard({ onAction }: { onAction: () => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestedRecipes, setSuggestedRecipes] = useState<Recipe[] | null>(null);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch(err => console.error('Dashboard fetch failed:', err))
      .finally(() => setLoading(false));
  }, []);

  const getAiSuggestions = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/recipes');
      const recipes = await res.json();
      setSuggestedRecipes(recipes);
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!data) return <div>Error loading data</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-slate-500">Welcome back! Here's your kitchen status.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={getAiSuggestions}
            disabled={aiLoading || data.totalItems === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl font-bold hover:bg-emerald-200 transition-all border border-emerald-200 shadow-sm disabled:opacity-50"
          >
            {aiLoading ? <LoadingSpinner /> : <><Utensils size={18} /> Get AI Recipes</>}
          </button>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
            <div className="text-right">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Waste Score</p>
              <p className="text-2xl font-bold text-emerald-600">{data.wasteScore}%</p>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-emerald-100 flex items-center justify-center relative">
              <div className="absolute inset-0 border-4 border-emerald-500 rounded-full" style={{ clipPath: `inset(0 0 ${100 - data.wasteScore}% 0)` }}></div>
              <span className="text-emerald-500"><CheckCircle2 size={20} /></span>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {suggestedRecipes && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <div className="bg-slate-50 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">AI Cooking Ideas</h2>
                  <p className="text-slate-500 text-sm">Recipes using your soonest-expiring items.</p>
                </div>
                <button 
                  onClick={() => setSuggestedRecipes(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                >
                  <Trash2 size={24} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                {suggestedRecipes.map((recipe, idx) => (
                  <RecipeCard key={idx} recipe={recipe} />
                ))}
              </div>
              <div className="p-6 bg-white border-t border-slate-200 text-center">
                <button 
                  onClick={() => setSuggestedRecipes(null)}
                  className="px-8 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                >
                  Got it, thanks!
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {(data.expiringSoon > 0 || data.expired > 0) && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-4">
          <div className="bg-amber-500 p-2 rounded-lg text-white">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="font-bold text-amber-900">Attention Needed!</h3>
            <p className="text-amber-700 text-sm">
              You have {data.expiringSoon} items expiring soon and {data.expired} items already expired.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Active Items" value={data.totalItems} color="bg-blue-50 text-blue-600" />
        <StatCard label="Expiring Soon" value={data.expiringSoon} color="bg-amber-50 text-amber-600" />
        <StatCard label="Expired" value={data.expired} color="bg-rose-50 text-rose-600" />
      </div>

      <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold">Use These First</h2>
          <Clock size={20} className="text-slate-400" />
        </div>
        <div className="divide-y divide-slate-100">
          {data.useTheseFirst.length > 0 ? (
            data.useTheseFirst.map(item => (
              <ItemRow key={item.id} item={item} onAction={onAction} />
            ))
          ) : (
            <div className="p-8 text-center text-slate-400">
              Your fridge is empty! Time to go shopping.
            </div>
          )}
        </div>
      </section>
    </motion.div>
  );
}

function StatCard({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className={`p-6 rounded-3xl border border-slate-100 shadow-sm bg-white`}>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <p className={`text-4xl font-bold mt-2 ${color.split(' ')[1]}`}>{value}</p>
    </div>
  );
}

// --- SCREEN: INVENTORY ---

function InventoryView({ onAction }: { onAction: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ search: '', category: '', status: 'active' });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(filter);
    fetch(`/api/items?${params.toString()}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(setItems)
      .catch(err => console.error('Inventory fetch failed:', err))
      .finally(() => setLoading(false));
  }, [filter]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(i => i.id));
    }
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.length} items?`)) return;
    
    try {
      const res = await fetch('/api/items/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      if (res.ok) {
        setSelectedIds([]);
        onAction();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const bulkMarkUsed = async () => {
    try {
      const res = await fetch('/api/items/bulk-used', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      if (res.ok) {
        setSelectedIds([]);
        onAction();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const exportToCSV = () => {
    if (items.length === 0) {
      alert("No data to export");
      return;
    }
    
    const headers = ["ID", "Name", "Category", "Quantity", "Expiry Date", "Status", "Days Left", "Freshness"];
    const csvContent = [
      headers.join(','),
      ...items.map(item => [
        item.id,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.category}"`,
        item.quantity,
        item.expiry_date,
        `"${item.status}"`,
        item.daysLeft,
        `"${item.freshness}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `freshkeep_inventory_${filter.status}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <button 
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <Download size={18} /> Export CSV
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search items..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            value={filter.search}
            onChange={e => setFilter({ ...filter, search: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={filter.category}
            onChange={e => setFilter({ ...filter, category: e.target.value })}
          >
            <option value="">All Categories</option>
            <option value="dairy">Dairy</option>
            <option value="vegetables">Vegetables</option>
            <option value="meat">Meat</option>
            <option value="grains">Grains</option>
            <option value="other">Other</option>
          </select>
          <select 
            className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={filter.status}
            onChange={e => {
              setFilter({ ...filter, status: e.target.value });
              setSelectedIds([]);
            }}
          >
            <option value="active">Active</option>
            <option value="used">Used / Saved</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 10 }}
            className="bg-emerald-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <span className="font-bold">{selectedIds.length} items selected</span>
              <button 
                onClick={toggleSelectAll}
                className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors"
              >
                {selectedIds.length === items.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="flex gap-2">
              {filter.status === 'active' && (
                <button 
                  onClick={bulkMarkUsed}
                  className="flex items-center gap-1 bg-white text-emerald-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-colors"
                >
                  <CheckCircle2 size={16} /> Mark Used
                </button>
              )}
              <button 
                onClick={bulkDelete}
                className="flex items-center gap-1 bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-rose-600 transition-colors"
              >
                <Trash2 size={16} /> Delete Selected
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-4">
          <input 
            type="checkbox" 
            className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 transition-all cursor-pointer"
            checked={items.length > 0 && selectedIds.length === items.length}
            onChange={toggleSelectAll}
          />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select All</span>
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-12 text-center"><LoadingSpinner /></div>
          ) : items.length > 0 ? (
            items.map(item => (
              <div key={item.id} className="flex items-center pl-4">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 transition-all cursor-pointer"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggleSelect(item.id)}
                />
                <div className="flex-1">
                  <ItemRow item={item} onAction={onAction} showStatus />
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-slate-400">No items found matching your filters.</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// --- SCREEN: ADD ITEM ---

function AddItemView({ onAction }: { onAction: () => void }) {
  const [formData, setFormData] = useState({ name: '', category: 'other', quantity: 1, expiry_date: '' });
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'searching' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) onAction();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    setScanStatus('searching');
    try {
      // Lookup product using Open Food Facts API
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`);
      const data = await res.json();
      
      if (data.status === 1 && data.product) {
        const product = data.product;
        const name = product.product_name || product.generic_name || 'Unknown Product';
        
        // Map Open Food Facts categories to our categories
        let category = 'other';
        const offCategories = (product.categories || '').toLowerCase();
        if (offCategories.includes('dairy') || offCategories.includes('milk') || offCategories.includes('cheese')) category = 'dairy';
        else if (offCategories.includes('veg') || offCategories.includes('fruit')) category = 'vegetables';
        else if (offCategories.includes('meat') || offCategories.includes('chicken') || offCategories.includes('beef')) category = 'meat';
        else if (offCategories.includes('grain') || offCategories.includes('bread') || offCategories.includes('cereal')) category = 'grains';

        setFormData(prev => ({ ...prev, name, category }));
        setScanStatus('success');
        setShowScanner(false);
      } else {
        setScanStatus('error');
        alert("Product not found. Please enter manually.");
      }
    } catch (err) {
      console.error("Lookup error:", err);
      setScanStatus('error');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-center">Add New Item</h1>
      
      <div className="flex justify-center gap-4 mb-2">
        <button 
          onClick={() => setShowScanner(!showScanner)}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${
            showScanner ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {showScanner ? <><Trash2 size={20} /> Cancel Scan</> : <><Box size={20} /> Scan Barcode</>}
        </button>
      </div>

      <AnimatePresence>
        {showScanner && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-black rounded-3xl relative aspect-square md:aspect-video mb-6"
          >
            <BarcodeScanner onScan={handleScanSuccess} />
            <div className="absolute inset-0 border-2 border-emerald-500/50 rounded-3xl pointer-events-none flex items-center justify-center">
              <div className="w-2/3 h-1/3 border-2 border-emerald-500 rounded-lg animate-pulse" />
            </div>
            {scanStatus === 'searching' && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white gap-4">
                <LoadingSpinner />
                <p className="font-bold">Searching product database...</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Item Name</label>
          <input 
            type="text" 
            required 
            placeholder="e.g. Greek Yogurt"
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Category</label>
            <select 
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
            >
              <option value="dairy">Dairy</option>
              <option value="vegetables">Vegetables</option>
              <option value="meat">Meat</option>
              <option value="grains">Grains</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Quantity</label>
            <input 
              type="number" 
              min="1" 
              required
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={formData.quantity}
              onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Expiry Date</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="date" 
              required
              className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              value={formData.expiry_date}
              onChange={e => setFormData({ ...formData, expiry_date: e.target.value })}
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
        >
          {loading ? <LoadingSpinner /> : <><PlusCircle size={20} /> Add to Pantry</>}
        </button>
      </form>
    </motion.div>
  );
}

// --- SCREEN: RECIPES ---

function RecipesView() {
  const [aiRecipes, setAiRecipes] = useState<Recipe[]>([]);
  const [myRecipes, setMyRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'ai' | 'mine'>('ai');
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [aiRes, mineRes] = await Promise.all([
        fetch('/api/recipes'),
        fetch('/api/recipes/custom')
      ]);
      const [aiData, mineData] = await Promise.all([aiRes.json(), mineRes.json()]);
      setAiRecipes(aiData);
      setMyRecipes(mineData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredRecipes = (view === 'ai' ? aiRecipes : myRecipes).filter(recipe => {
    const query = searchQuery.toLowerCase();
    return (
      recipe.title.toLowerCase().includes(query) ||
      recipe.ingredients.some(ing => ing.toLowerCase().includes(query))
    );
  });

  if (loading) return <div className="p-12 flex flex-col items-center gap-4">
    <LoadingSpinner />
    <p className="text-slate-500 animate-pulse">Loading recipes...</p>
  </div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recipes</h1>
          <p className="text-slate-500">
            {view === 'ai' ? 'AI suggestions based on your items.' : 'Your personal cookbook.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search recipes or ingredients..." 
              className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="bg-white p-1 rounded-xl border border-slate-200 flex">
            <button 
              onClick={() => setView('ai')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'ai' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              AI Suggestions
            </button>
            <button 
              onClick={() => setView('mine')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'mine' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              My Recipes
            </button>
          </div>
          <button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 transition-colors border border-emerald-100 shadow-sm"
          >
            <PlusCircle size={20} /> Add Recipe
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <AddRecipeForm onCancel={() => setShowAddForm(false)} onSave={() => { setShowAddForm(false); fetchData(); }} />
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredRecipes.map((recipe, idx) => (
          <RecipeCard key={recipe.id || idx} recipe={recipe} onDelete={view === 'mine' ? fetchData : undefined} />
        ))}
        {filteredRecipes.length === 0 && (
          <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 text-slate-400">
            {searchQuery 
              ? `No recipes found matching "${searchQuery}"` 
              : (view === 'mine' 
                  ? "You haven't added any recipes yet. Click \"Add Recipe\" to start your cookbook!" 
                  : "No AI suggestions available at the moment.")
            }
          </div>
        )}
      </div>
    </motion.div>
  );
}

function AddRecipeForm({ onCancel, onSave }: { onCancel: () => void, onSave: () => void }) {
  const [title, setTitle] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [ingredients, setIngredients] = useState(['']);
  const [steps, setSteps] = useState(['']);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/recipes/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title, 
          cookTime, 
          ingredients: ingredients.filter(i => i.trim()), 
          steps: steps.filter(s => s.trim()) 
        })
      });
      if (res.ok) onSave();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: 20 }}
      className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">New Recipe</h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><Trash2 size={20} /></button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input 
            type="text" 
            placeholder="Recipe Title" 
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
          />
          <input 
            type="text" 
            placeholder="Cook Time (e.g. 20 mins)" 
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={cookTime}
            onChange={e => setCookTime(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ingredients</label>
          {ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2">
              <input 
                type="text" 
                className="flex-1 px-4 py-2 bg-slate-50 rounded-lg border border-slate-100"
                value={ing}
                onChange={e => {
                  const newIngs = [...ingredients];
                  newIngs[i] = e.target.value;
                  setIngredients(newIngs);
                }}
              />
              <button type="button" onClick={() => setIngredients(ingredients.filter((_, idx) => idx !== i))} className="text-rose-400"><Trash2 size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setIngredients([...ingredients, ''])} className="text-xs font-bold text-emerald-600 flex items-center gap-1"><PlusCircle size={14} /> Add Ingredient</button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Steps</label>
          {steps.map((step, i) => (
            <div key={i} className="flex gap-2">
              <textarea 
                className="flex-1 px-4 py-2 bg-slate-50 rounded-lg border border-slate-100 h-20"
                value={step}
                onChange={e => {
                  const newSteps = [...steps];
                  newSteps[i] = e.target.value;
                  setSteps(newSteps);
                }}
              />
              <button type="button" onClick={() => setSteps(steps.filter((_, idx) => idx !== i))} className="text-rose-400"><Trash2 size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setSteps([...steps, ''])} className="text-xs font-bold text-emerald-600 flex items-center gap-1"><PlusCircle size={14} /> Add Step</button>
        </div>

        <div className="flex gap-4 pt-4">
          <button type="button" onClick={onCancel} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all">
            {loading ? <LoadingSpinner /> : 'Save Recipe'}
          </button>
        </div>
      </form>
    </motion.div>
  );
}

function RecipeCard({ recipe, onDelete }: { recipe: Recipe, onDelete?: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!recipe.id || !confirm('Delete this recipe?')) return;
    try {
      await fetch(`/api/recipes/custom/${recipe.id}`, { method: 'DELETE' });
      if (onDelete) onDelete();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="p-6 flex-1">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-slate-800 leading-tight">{recipe.title}</h3>
          <div className="flex items-center gap-2">
            {recipe.isCustom && (
              <button onClick={handleDelete} className="text-slate-300 hover:text-rose-500 transition-colors p-1">
                <Trash2 size={16} />
              </button>
            )}
            <span className="text-xs font-bold px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full flex items-center gap-1 whitespace-nowrap">
              <Clock size={12} /> {recipe.cookTime}
            </span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-1 mb-4">
          {recipe.usesExpiring?.map((item, i) => (
            <span key={i} className="text-[10px] uppercase tracking-wider font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md">
              Uses: {item}
            </span>
          ))}
          {recipe.isCustom && (
            <span className="text-[10px] uppercase tracking-wider font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md">
              My Recipe
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ingredients</h4>
            <ul className="grid grid-cols-1 gap-1">
              {recipe.ingredients.slice(0, expanded ? undefined : 3).map((ing, i) => (
                <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full" />
                  {ing}
                </li>
              ))}
              {!expanded && recipe.ingredients.length > 3 && (
                <li className="text-xs text-slate-400">+{recipe.ingredients.length - 3} more...</li>
              )}
            </ul>
          </div>

          {expanded && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 pt-4 border-t border-slate-50">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Instructions</h4>
              <ol className="space-y-3">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="text-sm text-slate-600 flex gap-3">
                    <span className="font-bold text-emerald-500">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </motion.div>
          )}
        </div>
      </div>
      
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full py-4 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-bold text-slate-600 flex items-center justify-center gap-2 border-t border-slate-100"
      >
        {expanded ? 'Show Less' : 'View Full Recipe'}
        <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}

// --- SCREEN: STATS ---

function StatsView() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch(err => console.error('Stats fetch failed:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!data) return <div>Error loading data</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your Impact</h1>
        <p className="text-slate-500">Every meal saved counts.</p>
      </div>

      <div className="bg-emerald-600 p-8 rounded-3xl text-white shadow-xl shadow-emerald-100 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-2">Weekly Waste Score</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-black">{data.wasteScore}%</span>
            <span className="text-xl font-medium opacity-80">Efficiency</span>
          </div>
          <p className="mt-4 text-lg font-medium max-w-md leading-relaxed">{data.motivationalMessage}</p>
        </div>
        <div className="absolute -right-8 -bottom-8 opacity-10 rotate-12">
          <CheckCircle2 size={240} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-lg mb-6">Last 7 Days</h3>
          <div className="flex gap-4 items-end h-40 px-4">
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-emerald-500 rounded-t-xl" style={{ height: `${(data.last7Days.saved / (data.last7Days.saved + data.last7Days.expired || 1)) * 100}%` }} />
              <span className="text-xs font-bold text-emerald-600">{data.last7Days.saved} Saved</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-rose-400 rounded-t-xl" style={{ height: `${(data.last7Days.expired / (data.last7Days.saved + data.last7Days.expired || 1)) * 100}%` }} />
              <span className="text-xs font-bold text-rose-500">{data.last7Days.expired} Expired</span>
            </div>
          </div>
        </section>

        <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="font-bold text-lg mb-4">By Category</h3>
          <div className="flex-1 min-h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.byCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="category"
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {data.byCategory.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={
                        entry.category === 'dairy' ? '#3b82f6' : 
                        entry.category === 'vegetables' ? '#10b981' : 
                        entry.category === 'meat' ? '#f43f5e' : 
                        entry.category === 'grains' ? '#f59e0b' : '#94a3b8'
                      } 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </motion.div>
  );
}

// --- UTILS ---

function ItemRow({ item, onAction, showStatus }: { item: Item, onAction: () => void, showStatus?: boolean }) {
  const markAsUsed = async () => {
    await fetch(`/api/items/${item.id}/used`, { method: 'PATCH' });
    onAction();
  };

  const deleteItem = async () => {
    if (confirm('Delete this item?')) {
      await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
      onAction();
    }
  };

  const freshnessColors = {
    fresh: 'bg-emerald-50 text-emerald-600',
    expiring: 'bg-amber-50 text-amber-600',
    expired: 'bg-rose-50 text-rose-600'
  };

  return (
    <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold ${freshnessColors[item.freshness]}`}>
          {item.name[0]}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-800">{item.name}</h4>
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase tracking-wider">
              {item.category}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1"><Calendar size={12} /> {item.expiry_date}</span>
            <span className="flex items-center gap-1"><Box size={12} /> x{item.quantity}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className={`hidden md:block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${freshnessColors[item.freshness]}`}>
          {item.daysLeft < 0 ? 'Expired' : item.daysLeft === 0 ? 'Expires Today' : `In ${item.daysLeft} days`}
        </div>
        
        {item.status === 'active' && (
          <button 
            onClick={markAsUsed}
            className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-colors"
            title="Mark as used"
          >
            <CheckCircle2 size={20} />
          </button>
        )}
        
        <button 
          onClick={deleteItem}
          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
          title="Delete"
        >
          <Trash2 size={20} />
        </button>
      </div>
    </div>
  );
}

// --- SCREEN: SHOPPING LIST ---

function ShoppingListView({ onAction }: { onAction: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<{name: string, category: string}[]>([]);

  const fetchItems = () => {
    setLoading(true);
    fetch('/api/items?status=used')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        // Only show unique items based on name that have been used
        const unique = data.reduce((acc: any[], curr: any) => {
          if (!acc.find(item => item.name.toLowerCase() === curr.name.toLowerCase())) {
            acc.push(curr);
          }
          return acc;
        }, []);
        setItems(unique);
      })
      .catch(err => console.error('Shopping list fetch failed:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const restockItem = async (item: Item) => {
    try {
      const res = await fetch(`/api/items/${item.id}/restock`, { method: 'POST' });
      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== item.id));
        onAction();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatPrompt.trim()) return;
    setChatLoading(true);
    try {
      const res = await fetch('/api/shopping/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: chatPrompt })
      });
      const data = await res.json();
      setSuggestions(data);
      setChatPrompt('');
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  const addSuggestedItem = async (suggestion: {name: string, category: string}) => {
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...suggestion, 
          quantity: 1, 
          status: 'used' 
        })
      });
      if (res.ok) {
        setSuggestions(prev => prev.filter(s => s.name !== suggestion.name));
        fetchItems();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shopping List</h1>
          <p className="text-slate-500">Items to buy for your pantry.</p>
        </div>
        <button 
          onClick={() => setShowChat(!showChat)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all shadow-sm ${
            showChat ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
          }`}
        >
          <MessageSquare size={18} /> {showChat ? 'Close Assistant' : 'AI Assistant'}
        </button>
      </div>

      <AnimatePresence>
        {showChat && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-white rounded-3xl border border-blue-100 shadow-xl"
          >
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Shopping Assistant</h3>
                  <p className="text-xs text-slate-400">Ask me to suggest items for any occasion!</p>
                </div>
              </div>

              <form onSubmit={handleChatSubmit} className="relative">
                <input 
                  type="text" 
                  placeholder="e.g. Items for a summer salad or a weekend party..." 
                  className="w-full pl-4 pr-12 py-4 bg-slate-50 rounded-2xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={chatPrompt}
                  onChange={e => setChatPrompt(e.target.value)}
                  disabled={chatLoading}
                />
                <button 
                  type="submit"
                  disabled={chatLoading || !chatPrompt.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {chatLoading ? <LoadingSpinner /> : <ChevronRight size={20} />}
                </button>
              </form>

              {suggestions.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Suggested Items</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s, i) => (
                      <button 
                        key={i}
                        onClick={() => addSuggestedItem(s)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-bold hover:bg-blue-100 transition-all border border-blue-100 group"
                      >
                        <PlusCircle size={14} className="group-hover:scale-125 transition-transform" /> {s.name}
                        <span className="text-[10px] opacity-60 font-normal">({s.category})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-12 text-center"><LoadingSpinner /></div>
          ) : items.length > 0 ? (
            items.map(item => (
              <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold">
                    {item.name[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{item.name}</h4>
                    <p className="text-xs text-slate-400">Category: {item.category}</p>
                  </div>
                </div>
                <button 
                  onClick={() => restockItem(item)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors shadow-sm"
                >
                  <PlusCircle size={18} /> Restock
                </button>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-slate-400">
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 size={48} className="text-emerald-200" />
                <p>Your shopping list is empty. Great job using your pantry!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function LoadingSpinner() {
  return <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />;
}

function BarcodeScanner({ onScan }: { onScan: (text: string) => void }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 150 } },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        onScan(decodedText);
        scanner.clear();
      },
      (error) => {
        // Silently ignore scan errors
      }
    );

    return () => {
      scanner.clear().catch(err => console.error("Failed to clear scanner", err));
    };
  }, [onScan]);

  return <div id="reader" className="w-full h-full" />;
}
