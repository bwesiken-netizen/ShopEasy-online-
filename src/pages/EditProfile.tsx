import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { useI18nStore } from '../i18n';
import { db, storage } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ArrowLeft, Camera, Loader2, Check } from 'lucide-react';

export default function EditProfile() {
  const navigate = useNavigate();
  const { user, saveUserProfile } = useAuthStore();
  const { t } = useI18nStore();

  const [name, setName] = useState(user?.name || '');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Prefer not to say' | string>(
    (user as any)?.gender || 'Prefer not to say'
  );
  const [city, setCity] = useState(user?.city || user?.location || 'Lilongwe');
  
  const [avatarUrl, setAvatarUrl] = useState(
    user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if user loads late
  useEffect(() => {
    if (user) {
      setName(user.name);
      if ((user as any).gender) setGender((user as any).gender);
      setCity(user.city || user.location || 'Lilongwe');
      if (user.avatar) setAvatarUrl(user.avatar);
    }
  }, [user]);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    // Read preview local URL
    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);

    if (!user?.uid) {
      setErrorMsg("User must be logged in to upload avatars.");
      return;
    }

    setUploading(true);
    setErrorMsg('');

    try {
      const storageRef = ref(storage, `users/${user.uid}/avatar.jpg`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      setAvatarUrl(downloadUrl);

      // Save to Firestore right away
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { avatar: downloadUrl });

      // Update local store in real-time
      if (useAuthStore.getState().user) {
        useAuthStore.setState({
          user: {
            ...useAuthStore.getState().user!,
            avatar: downloadUrl
          }
        });
      }

      setToastMsg("Avatar uploaded successfully!");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err: any) {
      console.error("Avatar upload failed: ", err);
      setErrorMsg("Failed to upload image to Firebase Storage.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Full Name is required.");
      return;
    }

    if (!user?.uid) return;

    setSaving(true);
    setErrorMsg('');

    try {
      // Save user profile details
      const userRef = doc(db, 'users', user.uid);
      const profileUpdates = {
        name: name.trim(),
        gender,
        city,
        location: city,
        avatar: avatarUrl
      };

      await updateDoc(userRef, profileUpdates);

      // Update Zustand in real-time
      useAuthStore.setState({
        user: {
          ...user!,
          name: name.trim(),
          city,
          location: city,
          avatar: avatarUrl,
          ...(profileUpdates as any)
        }
      });

      setToastMsg(t('profileUpdated'));
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        navigate('/settings');
      }, 1500);

    } catch (err: any) {
      console.error("Profile save error: ", err);
      setErrorMsg("Failed to save profile. Please check your network.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 animate-[fadeIn_0.3s_ease]" id="edit-profile-view">
      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3.5 flex items-center justify-between" id="edit-profile-header">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => navigate('/settings')}
            className="p-1 rounded-full text-neutral-500 hover:bg-neutral-100 active:bg-neutral-200 transition-all"
            id="back-to-settings-btn"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display font-black text-base text-neutral-900 uppercase tracking-tight" id="edit-profile-title">
            {t('editProfile')}
          </h1>
        </div>

        <button
          type="button"
          disabled={saving || uploading}
          onClick={() => handleSave()}
          className="text-xs font-black uppercase text-[#E53935] hover:text-[#c62828] select-none disabled:opacity-50 transition-colors"
          id="header-save-btn"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#E53935]" />
          ) : (
            t('save')
          )}
        </button>
      </div>

      {/* CONTENT FORM */}
      <div className="flex-1 p-4" id="edit-profile-form-container">
        {errorMsg && (
          <div className="mb-4 bg-orange-50 border border-orange-200 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs text-orange-800 font-semibold" id="profile-error-banner">
            <span>⚠</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-neutral-100 p-5 shadow-sm space-y-6" id="edit-profile-card">
          {/* AVATAR SECTION */}
          <div className="flex flex-col items-center gap-2.5 py-2" id="avatar-section">
            <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-[#E53935]/20 group" id="avatar-img-wrapper">
              <img 
                src={avatarUrl} 
                alt="Profile Avatar" 
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
                id="avatar-img-element"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center" id="avatar-saving-spinner">
                  <Loader2 className="h-7 w-7 text-white animate-spin" />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={triggerFileSelect}
              disabled={uploading}
              className="text-xs font-bold text-neutral-500 hover:text-[#E53935] flex items-center gap-1 bg-neutral-100 hover:bg-neutral-200/60 px-3 py-1.5 rounded-full transition-all"
              id="avatar-upload-trigger"
            >
              <Camera className="h-3.5 w-3.5" />
              <span>{t('changePhoto')}</span>
            </button>

            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
              id="avatar-file-input"
            />
          </div>

          <form onSubmit={handleSave} className="space-y-4" id="form-inner-fields">
            {/* FULL NAME */}
            <div className="flex flex-col gap-1.5" id="fullname-field-group">
              <label className="text-[10px] uppercase font-black tracking-wider text-neutral-450" htmlFor="full-name-input">
                {t('fullName')} *
              </label>
              <input
                id="full-name-input"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g. Chimwemwe Phiri"
                className="w-full bg-neutral-50 border border-neutral-150 rounded-2xl px-3.5 py-3 text-xs font-semibold focus:outline-none focus:border-[#E53935] focus:bg-white transition-all text-neutral-905"
              />
            </div>

            {/* EMAIL (READ ONLY) */}
            <div className="flex flex-col gap-1.5" id="email-field-group">
              <label className="text-[10px] uppercase font-black tracking-wider text-neutral-450" htmlFor="email-input">
                {t('email')}
              </label>
              <div className="flex items-center justify-between gap-3 bg-neutral-100 border border-neutral-200 rounded-2xl px-3.5 py-3 text-xs font-semibold">
                <input
                  id="email-input"
                  type="email"
                  readOnly
                  value={user?.email || 'No email associated'}
                  className="bg-transparent text-neutral-400 focus:outline-none flex-1 font-mono text-xs cursor-not-allowed"
                />
                <button
                  type="button"
                  disabled
                  className="text-[10px] font-bold text-neutral-450 cursor-not-allowed select-none transition-all"
                  id="change-email-btn"
                >
                  Change email
                </button>
              </div>
            </div>

            {/* GENDER */}
            <div className="flex flex-col gap-2" id="gender-field-group">
              <label className="text-[10px] uppercase font-black tracking-wider text-neutral-450" id="gender-label">
                {t('gender')}
              </label>
              <div className="grid grid-cols-3 gap-2" id="gender-options-grid">
                {['Male', 'Female', 'Prefer not to say'].map((opt) => (
                  <label
                    key={opt}
                    onClick={() => setGender(opt)}
                    className={`py-3 rounded-2xl border text-[11px] font-black text-center cursor-pointer select-none transition-all ${
                      gender === opt
                        ? 'border-[#E53935] bg-red-50/40 text-[#E53935]'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                    }`}
                    id={`gender-opt-${opt.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <input 
                      type="radio" 
                      name="gender" 
                      value={opt} 
                      checked={gender === opt}
                      onChange={() => {}}
                      className="hidden" 
                    />
                    <span>
                      {opt === 'Male' ? t('male') : opt === 'Female' ? t('female') : t('preferNotToSay')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* CITY DROPDOWN */}
            <div className="flex flex-col gap-1.5 animate-fadeIn" id="city-field-group">
              <label className="text-[10px] uppercase font-black tracking-wider text-neutral-450" id="city-dropdown-label">
                {t('city')}
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-150 rounded-2xl px-3.5 py-3 text-xs font-semibold focus:outline-none focus:border-[#E53935] focus:bg-white transition-all text-neutral-900"
                id="city-dropdown-element"
              >
                {['Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba'].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {/* BOTTOM LARGE SAVE BUTTON */}
            <button
              type="submit"
              disabled={saving || uploading}
              className="w-full h-11 bg-[#E53935] hover:bg-[#c62828] text-white text-xs font-black uppercase rounded-full shadow-md flex items-center justify-center gap-1.5 transition-all mt-6"
              id="bottom-profile-save-btn"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>{t('save')}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* TOAST NOTIFICATION */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-neutral-900/90 text-white font-semibold text-xs py-3 px-5 rounded-full shadow-lg flex items-center gap-2 z-50 animate-[slideUp_0.2s_ease-out]" id="toast-notif-profile">
          <Check className="h-4 w-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
