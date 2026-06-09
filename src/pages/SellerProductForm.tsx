import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, storage, auth } from '../firebase';
import { doc, getDoc, setDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MALAWI_CITIES, CATEGORIES } from '../data/malawiProducts';
import { 
  ArrowLeft, 
  Upload, 
  Trash2, 
  Plus, 
  Check, 
  Sparkles, 
  Truck, 
  Info,
  DollarSign,
  Briefcase
} from 'lucide-react';

export default function SellerProductForm() {
  const navigate = useNavigate();
  const { id } = useParams(); // Extract product ID if editing
  const isEditing = !!id;
  
  const uid = auth.currentUser?.uid;

  // Generate unique product ID immediately if creating
  const [productId] = useState(() => id || doc(collection(db, 'products')).id);

  // Core product details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]?.name || 'Farm Produce');
  const [tags, setTags] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [comparePrice, setComparePrice] = useState<number | ''>('');
  const [stock, setStock] = useState<number | ''>('');

  // Variants (Optional arrays)
  const [colors, setColors] = useState<string[]>([]);
  const [newColor, setNewColor] = useState('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [newSize, setNewSize] = useState('');

  // Bulk Pricing option
  const [hasBulkPricing, setHasBulkPricing] = useState(false);
  const [bulkMinQty, setBulkMinQty] = useState<number | ''>('');
  const [bulkDiscountPct, setBulkDiscountPct] = useState<number | ''>('');

  // Delivery
  const [deliveryFee, setDeliveryFee] = useState<number | ''>(0); // 0 = Free
  const [allowedCities, setAllowedCities] = useState<string[]>([...MALAWI_CITIES]);
  const [allowPickup, setAllowPickup] = useState(true);

  // Photos List (up to 9 files or URL strings)
  const [images, setImages] = useState<string[]>([]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  // Page States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (!uid) return;
    if (isEditing) {
      fetchProductDetails();
    }
  }, [isEditing, uid]);

  const fetchProductDetails = async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'products', id!));
      if (snap.exists()) {
        const d = snap.data();
        
        // Prevent editing another seller's products
        if (d.storeId && d.storeId !== uid) {
          alert("Authorization Error: You don't have access to this store product!");
          navigate('/seller/products');
          return;
        }

        setTitle(d.title || d.name || '');
        setDescription(d.description || '');
        setCategory(d.category || CATEGORIES[0]?.name);
        setTags(d.tags ? (Array.isArray(d.tags) ? d.tags.join(', ') : d.tags) : '');
        setPrice(d.price || '');
        setComparePrice(d.compareAtPrice || d.comparePrice || '');
        setStock(d.stock ?? '');
        setImages(d.images || (d.imageUrl ? [d.imageUrl] : []));
        
        setColors(d.variants?.colors || d.colors || []);
        setSizes(d.variants?.sizes || d.sizes || []);

        if (d.bulkPricing && d.bulkPricing.minQuantity) {
          setHasBulkPricing(true);
          setBulkMinQty(d.bulkPricing.minQuantity);
          setBulkDiscountPct(d.bulkPricing.discountPct || d.bulkPricing.discountPercentage);
        }

        setDeliveryFee(d.delivery?.fee ?? d.deliveryFee ?? 0);
        setAllowedCities(d.delivery?.allowedCities || d.allowedCities || [...MALAWI_CITIES]);
        setAllowPickup(d.delivery?.allowPickup ?? d.allowPickup ?? true);
      }
    } catch (err) {
      console.error("Error loaded product edit item details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSlotUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;

    setUploadingIndex(index);
    try {
      // Upload images into products/{productId}/image_{n}.jpg paths
      const imageRef = ref(storage, `products/${productId}/image_${index}.jpg`);
      await uploadBytes(imageRef, file);
      const downloadUrl = await getDownloadURL(imageRef);

      // Mutate images list in state
      const updatedList = [...images];
      updatedList[index] = downloadUrl;
      // Filter out empty spaces
      setImages(updatedList.filter(Boolean));
    } catch (err: any) {
      console.error("Storage upload failure:", err);
      alert("Error uploading product image to cloud storage: " + err.message);
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleRemoveImageSlot = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    setImages(updated);
  };

  // Multiple Cities check handlers
  const toggleCityAllowed = (cityName: string) => {
    if (allowedCities.includes(cityName)) {
      setAllowedCities(allowedCities.filter((c) => c !== cityName));
    } else {
      setAllowedCities([...allowedCities, cityName]);
    }
  };

  const selectAllCities = () => {
    setAllowedCities([...MALAWI_CITIES]);
  };

  const clearAllCities = () => {
    setAllowedCities([]);
  };

  // Add Item Variants items
  const handleAddColor = () => {
    if (newColor.trim() && !colors.includes(newColor.trim())) {
      setColors([...colors, newColor.trim()]);
    }
    setNewColor('');
  };

  const handleRemoveColor = (col: string) => {
    setColors(colors.filter((c) => c !== col));
  };

  const handleAddSize = () => {
    if (newSize.trim() && !sizes.includes(newSize.trim())) {
      setSizes([...sizes, newSize.trim()]);
    }
    setNewSize('');
  };

  const handleRemoveSize = (sz: string) => {
    setSizes(sizes.filter((s) => s !== sz));
  };

  // CORE SAVING ACTION
  const handleSaveProduct = async (publish: boolean) => {
    setErrorText('');

    if (!title.trim()) {
      setErrorText('Product Title is required.');
      return;
    }
    if (!description.trim()) {
      setErrorText('Product Description is required.');
      return;
    }
    if (price === '' || isNaN(Number(price)) || Number(price) <= 0) {
      setErrorText('A valid Catalog price of at least MWK 1 is required.');
      return;
    }
    if (stock === '' || isNaN(Number(stock)) || Number(stock) < 0) {
      setErrorText('Stock quantity is required (can enter 0 for out of stock).');
      return;
    }
    if (images.length === 0) {
      setErrorText('Please upload at least 1 image for your product.');
      return;
    }
    if (hasBulkPricing) {
      if (!bulkMinQty || Number(bulkMinQty) <= 1) {
        setErrorText('Bulk minimum quantity must be more than 1 unit.');
        return;
      }
      if (!bulkDiscountPct || Number(bulkDiscountPct) <= 0 || Number(bulkDiscountPct) > 100) {
        setErrorText('Bulk discount percentage must be between 1% and 100%.');
        return;
      }
    }
    if (!allowPickup && allowedCities.length === 0) {
      setErrorText('If pickup option is disabled, you must select at least one City for delivery coverage.');
      return;
    }

    setSaving(true);
    try {
      // Get store business city from user session if needed
      const storeValSnap = await getDoc(doc(db, 'stores', uid!));
      const storeName = storeValSnap.exists() ? storeValSnap.data().name : 'ShopEasy Merchant';
      const storeCity = storeValSnap.exists() ? storeValSnap.data().city : 'Lilongwe';

      const tagArray = tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const payload: any = {
        id: productId,
        storeId: uid,
        storeName: storeName,
        name: title.trim(),
        title: title.trim(),
        description: description.trim(),
        category: category,
        tags: tagArray,
        price: Number(price),
        stock: Number(stock),
        city: storeCity,
        isActive: publish,
        active: publish,
        images: images,
        imageUrl: images[0] || '📦',
        variants: {
          colors,
          sizes
        },
        delivery: {
          fee: deliveryFee === '' ? 0 : Number(deliveryFee),
          allowedCities,
          allowPickup
        },
        updatedAt: serverTimestamp()
      };

      if (comparePrice !== '') {
        payload.compareAtPrice = Number(comparePrice);
        payload.comparePrice = Number(comparePrice);
      }

      if (hasBulkPricing) {
        payload.bulkPricing = {
          minQuantity: Number(bulkMinQty),
          discountPct: Number(bulkDiscountPct)
        };
      } else {
        payload.bulkPricing = null;
      }

      if (!isEditing) {
        payload.createdAt = serverTimestamp();
        payload.sold = 0;
      }

      // Write changes to Firestore Database
      await setDoc(doc(db, 'products', productId), payload, { merge: true });

      alert(publish ? `✓ "${title}" is now published on ShopEasy!` : `✓ "${title}" saved as draft safely.`);
      navigate('/seller/products');
    } catch (err: any) {
      console.error("Save product item failed:", err);
      setErrorText('Failed to save product listing. Error details: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500" id="form-loader">
        <div className="w-8 h-8 border-3 border-red-650 border-red-600 border-t-transparent rounded-full animate-spin mb-3 animate-pulse" />
        <span className="text-xs font-semibold font-sans">Retrieving catalog file details...</span>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-5 animate-[fadeIn_0.2s_ease]" id="seller-product-form">
      
      {/* Back to list */}
      <button
        onClick={() => navigate('/seller/products')}
        className="text-xs text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 my-1"
      >
        <ArrowLeft className="w-4 h-4" /> Back to My Inventory
      </button>

      {/* Main card */}
      <div className="bg-white rounded-2xl p-5 shadow-3xs border border-slate-100 space-y-4">
        
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
          <Sparkles className="w-5 h-5 text-red-600 animate-pulse" />
          <h3 className="font-bold text-slate-900 text-sm">
            {isEditing ? 'Edit Catalog Listing' : 'List a New Product'}
          </h3>
        </div>

        {errorText && (
          <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-rose-800 font-bold text-xs">
            {errorText}
          </div>
        )}

        {/* 1. Photos upload slots */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
            Listing Photos (Up to 9 slots) *
          </label>
          <span className="text-[9px] text-slate-400 block pb-1">First photo acts as the main catalog cover photo. Click empty slot to upload.</span>
          
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, idx) => {
              const currentUrl = images[idx];
              const isUploading = uploadingIndex === idx;

              return (
                <div 
                  key={idx}
                  className="aspect-square rounded-xl bg-slate-50 border border-dashed flex flex-col items-center justify-center text-slate-400 font-bold text-[10px] relative overflow-hidden group select-none hover:bg-slate-100/50 transition"
                >
                  {isUploading ? (
                    <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                  ) : currentUrl ? (
                    <>
                      <img referrerPolicy="no-referrer" src={currentUrl} alt={`Product slot ${idx}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImageSlot(idx)}
                        className="absolute right-1 top-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-md transition"
                        title="Remove image"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <label className="w-full h-full cursor-pointer flex flex-col items-center justify-center space-y-1 text-slate-400">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => handleImageSlotUpload(idx, e)}
                        className="hidden" 
                      />
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span>Slot {idx + 1}</span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Basic details */}
        <div className="space-y-3.5 pt-2">
          
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
              Product Title *
            </label>
            <input 
              type="text"
              placeholder="E.g. Karonga Aromatic Kilombero Rice 5kg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs font-semibold px-3.5 py-3 border rounded-xl focus:border-red-500 focus:outline-none bg-slate-50/50 text-slate-900" 
            />
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
              Product Description *
            </label>
            <textarea 
              placeholder="What makes your article high quality? Mention sizes, materials, origin details, harvest date..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full text-xs font-semibold px-3.5 py-3 border rounded-xl focus:border-red-500 focus:outline-none bg-slate-50/50 text-slate-900 resize-none h-24" 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs text-slate-900 font-semibold px-2 py-3 border rounded-xl focus:border-red-500 focus:outline-none bg-slate-50/50"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                Search Tags
              </label>
              <input 
                type="text"
                placeholder="rice, organic, grain"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full text-xs font-semibold px-3.5 py-3 border rounded-xl focus:border-red-500 focus:outline-none bg-slate-50/50 text-slate-900" 
              />
            </div>
          </div>

        </div>

        {/* 3. Pricing & Inventory */}
        <div className="bg-slate-50/40 p-4.5 rounded-2xl border space-y-3.5">
          <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-slate-500" /> Pricing & Stock levels
          </span>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">
                Selling Price (MWK) *
              </label>
              <input 
                type="number"
                placeholder="1500"
                value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full text-xs font-mono font-bold px-3 py-2.5 border rounded-xl focus:border-red-500 focus:outline-none bg-white text-slate-900" 
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">
                Retail Price (Compare)
              </label>
              <input 
                type="number"
                placeholder="1800"
                value={comparePrice}
                onChange={(e) => setComparePrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full text-xs font-mono font-bold px-3 py-2.5 border rounded-xl focus:border-red-500 focus:outline-none bg-white text-slate-900" 
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">
              Available Stock Quantity *
            </label>
            <input 
              type="number"
              placeholder="30"
              value={stock}
              onChange={(e) => setStock(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full text-xs font-mono font-bold px-3 py-2.5 border rounded-xl focus:border-red-500 focus:outline-none bg-white text-slate-900" 
            />
          </div>
        </div>

        {/* 4. Variants configuration (Colors, Sizes) */}
        <div className="bg-slate-50/40 p-4.5 rounded-2xl border space-y-3">
          <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-700 block">
            Product Variants (Optional)
          </span>

          {/* Color variation */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-slate-500 font-bold block uppercase">Item Colors</span>
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="Red, Blue, XL"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="flex-1 text-xs font-semibold px-3 py-2 border rounded-xl focus:outline-none bg-white" 
              />
              <button
                type="button"
                onClick={handleAddColor}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 rounded-xl transition"
              >
                Add
              </button>
            </div>
            {colors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {colors.map((c) => (
                  <span key={c} className="text-[10px] bg-white border font-bold text-slate-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    {c}
                    <button type="button" onClick={() => handleRemoveColor(c)} className="text-rose-500 font-bold hover:text-rose-700">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Size variation */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-slate-500 font-bold block uppercase">Item Sizes</span>
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="Medium, Large, Small"
                value={newSize}
                onChange={(e) => setNewSize(e.target.value)}
                className="flex-1 text-xs font-semibold px-3 py-2 border rounded-xl focus:outline-none bg-white" 
              />
              <button
                type="button"
                onClick={handleAddSize}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 rounded-xl transition"
              >
                Add
              </button>
            </div>
            {sizes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {sizes.map((s) => (
                  <span key={s} className="text-[10px] bg-white border font-bold text-slate-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    {s}
                    <button type="button" onClick={() => handleRemoveSize(s)} className="text-rose-500 font-bold hover:text-rose-700">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* 5. Bulk Pricing */}
        <div className="bg-slate-50/40 p-4.5 rounded-2xl border space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input 
              type="checkbox"
              checked={hasBulkPricing}
              onChange={(e) => setHasBulkPricing(e.target.checked)}
              className="w-4 h-4 border rounded border-slate-300 accent-red-650 cursor-pointer text-red-600" 
            />
            <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-700">
              Offer Bulk Discount Pricing
            </span>
          </label>

          {hasBulkPricing && (
            <div className="grid grid-cols-2 gap-3 pt-1 animate-[fadeIn_0.15s_ease]">
              <div>
                <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">
                  Min Quantity (Units)
                </label>
                <input 
                  type="number"
                  placeholder="5"
                  value={bulkMinQty}
                  onChange={(e) => setBulkMinQty(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full text-xs font-bold px-3 py-2 border rounded-xl focus:outline-none bg-white" 
                />
              </div>

              <div>
                <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">
                  Discount Amount (%)
                </label>
                <input 
                  type="number"
                  placeholder="10"
                  value={bulkDiscountPct}
                  onChange={(e) => setBulkDiscountPct(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full text-xs font-bold px-3 py-2 border rounded-xl focus:outline-none bg-white" 
                />
              </div>
            </div>
          )}
        </div>

        {/* 6. Shipping & Delivery coverage */}
        <div className="bg-slate-50/40 p-4.5 rounded-2xl border space-y-3.5">
          <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1">
            <Truck className="w-5 h-5 text-indigo-600" /> Delivery & Logistics Options
          </span>

          {/* Delivery Fee */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Flat Delivery Fee (MWK) — 0 represents Free Shipping
            </label>
            <input 
              type="number"
              placeholder="3500"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full text-xs font-mono font-bold px-3 py-2 border rounded-xl focus:outline-none bg-white text-slate-900" 
            />
          </div>

          {/* Allowed Regions checklist */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-[10px] font-bold">
              <span className="text-slate-500 uppercase pb-1">Delivery Regions Coverage</span>
              <div className="flex gap-2">
                <button type="button" onClick={selectAllCities} className="text-indigo-600 hover:underline">Select All</button>
                <button type="button" onClick={clearAllCities} className="text-rose-600 hover:underline">Clear</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto bg-white p-2.5 rounded-xl border">
              {MALAWI_CITIES.map((cName) => {
                const checked = allowedCities.includes(cName);
                return (
                  <label key={cName} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-semibold py-0.5 select-none">
                    <input 
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCityAllowed(cName)}
                      className="w-4 h-4 border rounded border-slate-300 accent-indigo-600" 
                    />
                    <span>{cName}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Allow Pickup */}
          <div className="pt-1.5 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={allowPickup}
                onChange={(e) => setAllowPickup(e.target.checked)}
                className="w-4 h-4 border rounded border-slate-300 accent-indigo-600 cursor-pointer" 
              />
              <span className="text-[10px] font-bold text-indigo-900 uppercase">
                Allow Direct Buyer Pickup at Warehouse / Shop
              </span>
            </label>
          </div>

        </div>

        {/* Submit action buttons footer */}
        <div className="grid grid-cols-2 gap-3.5 pt-4">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveProduct(false)}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs py-3.5 rounded-xl transition uppercase tracking-wider"
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
          
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveProduct(true)}
            className="w-full bg-red-650 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs py-3.5 rounded-xl transition uppercase tracking-wider flex items-center justify-center gap-1 shadow-md"
          >
            {saving ? 'Publishing...' : 'Publish Listing 🚀'}
          </button>
        </div>

      </div>
    </div>
  );
}
