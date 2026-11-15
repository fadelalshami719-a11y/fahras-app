// ===== إعدادات مصادقة Google و Drive =====
const GOOGLE_CLIENT_ID = '674857553188-s9tu07obk7eods4ffh8ds8aekuavjfiq.apps.googleusercontent.com';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
const DRIVE_BACKUP_FILENAME = 'fahras_backup.json';
const DEFAULT_CATEGORIES = Object.freeze([
    { id: 'general', name: 'عام', icon: 'fas fa-globe', color: '#0ea5e9', updatedAt: 1 },
    { id: 'dev', name: 'تطوير', icon: 'fas fa-code', color: '#10b981', updatedAt: 1 },
    { id: 'design', name: 'تصميم', icon: 'fas fa-paint-brush', color: '#f43f5e', updatedAt: 1 },
    { id: 'edu', name: 'تعليم', icon: 'fas fa-graduation-cap', color: '#14b8a6', updatedAt: 1 },
    { id: 'news', name: 'أخبار', icon: 'fas fa-newspaper', color: '#f59e0b', updatedAt: 1 }
]);
const MAX_LOCAL_SESSION_MS = 60 * 60 * 1000; // 60 دقيقة كحد أقصى للجلسة المحلية

let tokenClient = null;
let googleAccessToken = sessionStorage.getItem('fahras_google_token') || null;
let googleTokenExpiry = Number(sessionStorage.getItem('fahras_google_expiry') || 0);
let googleUserProfile = JSON.parse(localStorage.getItem('fahras_google_user') || 'null');
let needsReconnect = false;
let autoSyncTimeout = null;
let liveSyncInterval = null;
let lastKnownCloudModified = localStorage.getItem('fahras_cloud_mtime') || '';
let isSyncingNow = false;

// إعدادات المزامنة وسجل المحذوفات (لضمان عدم عودة العناصر المحذوفة بين الجوال واللابتوب)
let syncSettings = JSON.parse(localStorage.getItem('fahras_sync_settings')) || {
    frequency: 'instant', // 'instant' | 'daily' | 'manual'
    lastDailySync: 0
};

let syncTombstones = JSON.parse(localStorage.getItem('fahras_tombstones')) || {
    deletedLinks: {},      // { id: timestamp }
    deletedCategories: {}, // { id: timestamp }
    clearedAt: 0           // timestamp لآخر عملية "حذف الكل"
};

function saveSyncMeta() {
    localStorage.setItem('fahras_sync_settings', JSON.stringify(syncSettings));
    localStorage.setItem('fahras_tombstones', JSON.stringify(syncTombstones));
}

function generateUniqueId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 10);
}

// ===== دوال التحقق والتنظيف المركزية =====
function isValidHexColor(color) {
    return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color);
}

function isValidFontAwesomeIcon(icon) {
    return typeof icon === 'string'
        && icon.length > 0
        && icon.length <= 50
        && /^(fas|far|fab|fal) fa-[a-z0-9-]+$/.test(icon);
}

function sanitizeColor(color, fallback = '#0ea5e9') {
    return isValidHexColor(color) ? color.toLowerCase() : fallback;
}

function sanitizeIcon(icon, fallback = 'fas fa-folder') {
    return isValidFontAwesomeIcon(icon) ? icon : fallback;
}

// ===== دوال إدارة جلسة التوكن والحماية =====
function setTokenSession(accessToken, expiresInSeconds = 3500) {
    const lifetimeMs = Math.min(Number(expiresInSeconds || 3500) * 1000, MAX_LOCAL_SESSION_MS);
    googleAccessToken = accessToken;
    googleTokenExpiry = Date.now() + lifetimeMs;
    needsReconnect = false;
    sessionStorage.setItem('fahras_google_token', googleAccessToken);
    sessionStorage.setItem('fahras_google_expiry', String(googleTokenExpiry));
    // إزالة أي بقايا قديمة للتوكن من localStorage
    localStorage.removeItem('fahras_google_token');
    localStorage.removeItem('fahras_google_expiry');
}

function clearTokenSession(clearProfile = false) {
    googleAccessToken = null;
    googleTokenExpiry = 0;
    sessionStorage.removeItem('fahras_google_token');
    sessionStorage.removeItem('fahras_google_expiry');
    localStorage.removeItem('fahras_google_token');
    localStorage.removeItem('fahras_google_expiry');

    if (clearProfile) {
        googleUserProfile = null;
        needsReconnect = false;
        localStorage.removeItem('fahras_google_user');
    }
}

function isSessionExpired() {
    if (!googleAccessToken || !googleTokenExpiry) return true;
    return Date.now() >= (googleTokenExpiry - 60000);
}

let links = (() => {
    const stored = localStorage.getItem('linkvault_links');
    if (!stored) return [];
    let parsed = JSON.parse(stored);
    return parsed.map(link => {
        if (typeof link.id === 'number') link.id = String(link.id);
        if (typeof link.clicks !== 'number') link.clicks = 0;
        if (!link.updatedAt) link.updatedAt = link.timestamp || Date.now();
        return link;
    });
})();

let categories = JSON.parse(localStorage.getItem('linkvault_categories'))
    || DEFAULT_CATEGORIES.map(c => ({ ...c }));

let chartInstances = {};
let editingId = null;
let editingCategoryId = null;
let confirmCallback = null;
let currentView = 'dashboard';
let currentFilter = 'all';
let currentSort = 'recent';
let currentCategoryDetailId = null;

// ===== تهيئة عميل مصادقة جوجل =====
/*
 * ⚠️ ملاحظة أمنية:
 * هذا التطبيق يعمل بالكامل من جانب العميل ولا يملك backend، لذا
 * لا يمكن استخدام Authorization Code Flow مع PKCE ولا httpOnly
 * cookies — وهما الحل الجذري لتخزين Tokens بأمان.
 *
 * الحل الحالي (sessionStorage + تقصير الجلسة + إبطال عند الخروج)
 * هو تخفيف للأثر وليس إغلاقاً نهائياً للثغرة. الثغرة الحقيقية
 * مغلقة جزئياً فقط بشرط تطبيق CSP صارم (مهمة منفصلة) ومسح جميع
 * الثغرات الأخرى (XSS، حقن السمات).
 */
let googleAuthInitAttempts = 0;
const MAX_GOOGLE_AUTH_ATTEMPTS = 20;

function initGoogleAuth() {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        googleAuthInitAttempts++;
        if (googleAuthInitAttempts >= MAX_GOOGLE_AUTH_ATTEMPTS) {
            console.warn('تعذر تحميل مكتبة Google بعد 20 محاولة');
            return;
        }
        setTimeout(initGoogleAuth, 500);
        return;
    }
    googleAuthInitAttempts = 0;
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: async (tokenResponse) => {
            if (tokenResponse.error) {
                showToast('تعذر إتمام تسجيل الدخول عبر Google', 'error');
                return;
            }
            setTokenSession(tokenResponse.access_token, tokenResponse.expires_in);
            await fetchGoogleUserProfile();
            updateGoogleUI();
            showToast('تم تسجيل الدخول بنجاح! جارٍ مزامنة بياناتك...', 'success');
            await syncWithDrive(true);
        }
    });

    // عند فتح تبويب جديد والمستخدم ظاهر كـ"متصل"، نبدأ أول مزامنة لتجديد التوكن بصمت
    if (googleUserProfile && isSessionExpired()) {
        const dayMs = 24 * 60 * 60 * 1000;
        if (syncSettings.frequency === 'instant' || (syncSettings.frequency === 'daily' && (Date.now() - syncSettings.lastDailySync) >= dayMs)) {
            syncWithDrive(true);
        }
    }
}

function isGoogleTokenValid() {
    return !isSessionExpired();
}

async function ensureValidGoogleToken(interactive = false) {
    if (isGoogleTokenValid()) return true;

    if (googleAccessToken) {
        clearTokenSession(false);
    }

    if (!tokenClient) initGoogleAuth();
    if (!tokenClient) return false;

    return new Promise((resolve) => {
        const originalCallback = tokenClient.callback;
        tokenClient.callback = async (resp) => {
            tokenClient.callback = originalCallback;
            if (resp.error || !resp.access_token) {
                if (!interactive && googleUserProfile) {
                    needsReconnect = true;
                    updateGoogleUI();
                }
                resolve(false);
                return;
            }
            setTokenSession(resp.access_token, resp.expires_in);
            if (!googleUserProfile) await fetchGoogleUserProfile();
            updateGoogleUI();
            resolve(true);
        };
        tokenClient.requestAccessToken({ prompt: interactive ? '' : 'none' });
    });
}

function signInWithGoogle() {
    if (!tokenClient) {
        initGoogleAuth();
        if (!tokenClient) {
            showToast('مكتبة Google قيد التحميل، حاول بعد لحظة...', 'info');
            return;
        }
    }
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

function handleNavbarGoogleClick() {
    if (needsReconnect) {
        signInWithGoogle();
    } else if (googleUserProfile) {
        showView('settings', document.getElementById('settingsTrigger'));
    } else {
        signInWithGoogle();
    }
}

async function fetchGoogleUserProfile() {
    if (!googleAccessToken) return;
    try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${googleAccessToken}` }
        });
        if (res.ok) {
            const info = await res.json();
            googleUserProfile = {
                name: info.name || 'مستخدم فِهرِس',
                email: info.email || '',
                picture: info.picture || ''
            };
            localStorage.setItem('fahras_google_user', JSON.stringify(googleUserProfile));
        }
    } catch (err) {
        console.error('Error fetching profile:', err);
    }
}

function updateGoogleUI() {
    const loggedOutBox = document.getElementById('googleLoggedOutBox');
    const loggedInBox = document.getElementById('googleLoggedInBox');
    const navBtn = document.getElementById('navGoogleBtn');
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    const sidebarName = document.getElementById('sidebarUserName');
    const sidebarStatus = document.getElementById('sidebarSyncStatus');
    const lastSyncLabel = document.getElementById('lastSyncLabel');
    const freqSelect = document.getElementById('syncFrequencySelect');

    if (freqSelect) freqSelect.value = syncSettings.frequency || 'instant';

    if (googleUserProfile) {
        if (loggedOutBox) loggedOutBox.style.display = 'none';
        if (loggedInBox) loggedInBox.style.display = 'block';

        const avatarEl = document.getElementById('googleUserAvatar');
        const nameEl = document.getElementById('googleUserName');
        const emailEl = document.getElementById('googleUserEmail');
        if (avatarEl && googleUserProfile.picture) avatarEl.src = googleUserProfile.picture;
        if (nameEl) nameEl.textContent = googleUserProfile.name;
        if (emailEl) emailEl.textContent = googleUserProfile.email;

        if (navBtn) {
            if (needsReconnect) {
                navBtn.classList.remove('connected');
                navBtn.style.borderColor = 'var(--warning)';
                navBtn.style.background = 'rgba(245, 158, 11, 0.15)';
                navBtn.style.color = 'var(--warning)';
                navBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>إعادة الاتصال</span>`;
            } else {
                navBtn.classList.add('connected');
                navBtn.style.borderColor = '';
                navBtn.style.background = '';
                navBtn.style.color = '';
                navBtn.innerHTML = googleUserProfile.picture
                    ? `<img src="${escapeHtml(googleUserProfile.picture)}" alt=""><span>متصل</span>`
                    : `<i class="fab fa-google"></i><span>متصل</span>`;
            }
        }
        if (sidebarName) sidebarName.textContent = googleUserProfile.name;

        const modeText = {
            instant: 'مزامنة فورية',
            daily: 'مزامنة كل 24 ساعة',
            manual: 'مزامنة يدوية'
        }[syncSettings.frequency] || 'مزامنة مفعّلة';

        if (sidebarStatus) {
            sidebarStatus.innerHTML = needsReconnect
                ? `<i class="fas fa-exclamation-triangle" style="color:var(--warning);"></i> إعادة الاتصال`
                : `<i class="fas fa-cloud-check" style="color:var(--success);"></i> ${modeText}`;
        }

        if (lastSyncLabel && needsReconnect) {
            lastSyncLabel.style.background = 'rgba(245, 158, 11, 0.15)';
            lastSyncLabel.style.color = 'var(--warning)';
            lastSyncLabel.innerHTML = `<i class="fas fa-exclamation-triangle"></i> يلزم إعادة الاتصال`;
        } else if (lastSyncLabel) {
            lastSyncLabel.style.background = '';
            lastSyncLabel.style.color = '';
        }

        if (sidebarAvatar) {
            if (googleUserProfile.picture) {
                sidebarAvatar.innerHTML = `<img src="${escapeHtml(googleUserProfile.picture)}" style="width:100%;height:100%;border-radius:12px;object-fit:cover;">`;
            } else {
                sidebarAvatar.textContent = googleUserProfile.name.charAt(0);
            }
        }
    } else {
        if (loggedOutBox) loggedOutBox.style.display = 'block';
        if (loggedInBox) loggedInBox.style.display = 'none';
        if (navBtn) {
            navBtn.classList.remove('connected');
            navBtn.style.borderColor = '';
            navBtn.style.background = '';
            navBtn.style.color = '';
            navBtn.innerHTML = `<i class="fab fa-google"></i><span id="navGoogleText">دخول</span>`;
        }
        if (sidebarName) sidebarName.textContent = 'مستخدم جديد';
        if (sidebarStatus) sidebarStatus.innerHTML = `<i class="fas fa-cog"></i> الإعدادات والنسخ`;
        if (sidebarAvatar) sidebarAvatar.textContent = 'م';
    }
}

function changeSyncFrequency(newFreq) {
    syncSettings.frequency = newFreq;
    saveSyncMeta();
    updateGoogleUI();
    const labels = {
        instant: 'تم تفعيل المزامنة الفورية عند كل تعديل',
        daily: 'تم ضبط المزامنة التلقائية كل 24 ساعة',
        manual: 'تم ضبط المزامنة على الوضع اليدوي فقط'
    };
    showToast(labels[newFreq] || 'تم حفظ إعداد المزامنة', 'info');
    if (newFreq === 'instant' && googleUserProfile) {
        uploadBackupToDrive(true);
    }
}

// ===== دوال التعامل مع Google Drive (مزامنة ذكية ثنائية الاتجاه) =====
async function findDriveBackupFile() {
    const valid = await ensureValidGoogleToken(false);
    if (!valid) return null;

    const query = encodeURIComponent(`name='${DRIVE_BACKUP_FILENAME}' and 'appDataFolder' in parents and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)`, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.files && data.files.length > 0) ? data.files[0] : null;
}

async function uploadBackupToDrive(silent = false, interactiveAuth = false) {
    if (!googleUserProfile || isSyncingNow) return false;
    const valid = await ensureValidGoogleToken(interactiveAuth);
    if (!valid) {
        const syncLabel = document.getElementById('lastSyncLabel');
        const sidebarStatus = document.getElementById('sidebarSyncStatus');
        if (syncLabel) syncLabel.innerHTML = `<i class="fas fa-exclamation-triangle" style="color:var(--warning);"></i> يلزم إعادة الاتصال`;
        if (sidebarStatus) sidebarStatus.innerHTML = `<i class="fas fa-exclamation-triangle" style="color:var(--warning);"></i> إعادة الاتصال`;
        if (!silent) showToast('انتهت جلسة Google، اضغط على زر "رفع الآن" لتجديدها', 'info');
        return false;
    }

    isSyncingNow = true;
    try {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        Object.keys(syncTombstones.deletedLinks).forEach(id => {
            if (syncTombstones.deletedLinks[id] < thirtyDaysAgo) delete syncTombstones.deletedLinks[id];
        });
        Object.keys(syncTombstones.deletedCategories).forEach(id => {
            if (syncTombstones.deletedCategories[id] < thirtyDaysAgo) delete syncTombstones.deletedCategories[id];
        });
        saveSyncMeta();

        const existingFile = await findDriveBackupFile();
        const backupPayload = JSON.stringify({
            links,
            categories,
            tombstones: syncTombstones,
            updatedAt: new Date().toISOString(),
            app: 'فهرس - فاضل الشامي'
        });

        const metadata = {
            name: DRIVE_BACKUP_FILENAME,
            mimeType: 'application/json'
        };
        if (!existingFile) metadata.parents = ['appDataFolder'];

        const boundary = '-------fahras_boundary_2026';
        const multipartBody =
            `--${boundary}\r\n` +
            `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
            `${JSON.stringify(metadata)}\r\n` +
            `--${boundary}\r\n` +
            `Content-Type: application/json\r\n\r\n` +
            `${backupPayload}\r\n` +
            `--${boundary}--`;

        const url = existingFile
            ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart&fields=id,modifiedTime`
            : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime`;

        const res = await fetch(url, {
            method: existingFile ? 'PATCH' : 'POST',
            headers: {
                Authorization: `Bearer ${googleAccessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
        });

        if (res.ok) {
            const uploadedMeta = await res.json().catch(() => null);
            if (uploadedMeta && uploadedMeta.modifiedTime) {
                lastKnownCloudModified = uploadedMeta.modifiedTime;
                localStorage.setItem('fahras_cloud_mtime', lastKnownCloudModified);
            } else {
                const freshFile = await findDriveBackupFile();
                if (freshFile && freshFile.modifiedTime) {
                    lastKnownCloudModified = freshFile.modifiedTime;
                    localStorage.setItem('fahras_cloud_mtime', lastKnownCloudModified);
                }
            }
            syncSettings.lastDailySync = Date.now();
            saveSyncMeta();
            updateGoogleUI();
            const syncLabel = document.getElementById('lastSyncLabel');
            if (syncLabel) {
                const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
                syncLabel.innerHTML = `<i class="fas fa-check-circle"></i> آخر مزامنة: ${timeStr}`;
            }
            if (!silent) showToast('تمت المزامنة وحفظ التغييرات على السحابة!', 'success');
            return true;
        }
    } catch (err) {
        console.error('Drive upload error:', err);
        if (!silent) showToast('حدث خطأ أثناء الرفع إلى Google Drive', 'error');
    } finally {
        isSyncingNow = false;
    }
    return false;
}

// المزامنة الذكية: تدمج السحابة مع المحلي مع احترام عمليات الحذف وتحديثات الأجهزة الأخرى
async function syncWithDrive(silent = true, notifyOnChange = false) {
    if (!googleUserProfile || isSyncingNow) return;
    const valid = await ensureValidGoogleToken(false);
    if (!valid) return;

    const file = await findDriveBackupFile();
    if (!file) {
        await uploadBackupToDrive(true);
        return;
    }

    try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
            headers: { Authorization: `Bearer ${googleAccessToken}` }
        });
        if (!res.ok) return;
        const cloudData = await res.json();

        const cloudTomb = cloudData.tombstones || { deletedLinks: {}, deletedCategories: {}, clearedAt: 0 };

        // 1. توحيد سجل المحذوفات وتاريخ "حذف الكل" بين الجهاز والسحابة
        const effectiveClearedAt = Math.max(syncTombstones.clearedAt || 0, cloudTomb.clearedAt || 0);
        syncTombstones.clearedAt = effectiveClearedAt;

        const mergedDeletedLinks = { ...cloudTomb.deletedLinks, ...syncTombstones.deletedLinks };
        const mergedDeletedCats = { ...cloudTomb.deletedCategories, ...syncTombstones.deletedCategories };
        syncTombstones.deletedLinks = mergedDeletedLinks;
        syncTombstones.deletedCategories = mergedDeletedCats;
        saveSyncMeta();

        // 2. حذف العناصر المحلية التي تم حذفها في جهاز آخر أو قبل تاريخ "حذف الكل"
        let localChanged = false;
        const beforeLinksLen = links.length;
        links = links.filter(l => {
            const created = l.timestamp || 0;
            if (created < effectiveClearedAt) return false;
            if (mergedDeletedLinks[l.id]) return false;
            return true;
        });
        if (links.length !== beforeLinksLen) localChanged = true;

        const beforeCatsLen = categories.length;
        categories = categories.filter(c => !mergedDeletedCats[c.id]);
        if (categories.length !== beforeCatsLen) localChanged = true;

        // 3. جلب الروابط والتصنيفات الجديدة أو المحدثة من السحابة (التي لم تُحذف)
        if (Array.isArray(cloudData.categories)) {
            cloudData.categories.forEach(cCat => {
                if (mergedDeletedCats[cCat.id]) return;
                const localIdx = categories.findIndex(c => c.id === cCat.id);
                if (localIdx === -1) {
                    categories.push({
                        ...cCat,
                        color: sanitizeColor(cCat.color),
                        icon: sanitizeIcon(cCat.icon)
                    });
                    localChanged = true;
                } else if ((cCat.updatedAt || 0) > (categories[localIdx].updatedAt || 0)) {
                    categories[localIdx] = {
                        ...cCat,
                        color: sanitizeColor(cCat.color),
                        icon: sanitizeIcon(cCat.icon)
                    };
                    localChanged = true;
                }
            });
        }

        if (Array.isArray(cloudData.links)) {
            cloudData.links.forEach(cLink => {
                const created = cLink.timestamp || 0;
                if (created < effectiveClearedAt) return;
                if (mergedDeletedLinks[cLink.id]) return;

                const localIdx = links.findIndex(l => String(l.id) === String(cLink.id));
                if (localIdx === -1) {
                    links.push(cLink);
                    localChanged = true;
                } else if ((cLink.updatedAt || 0) > (links[localIdx].updatedAt || 0)) {
                    links[localIdx] = cLink;
                    localChanged = true;
                }
            });
        }

        // التحقق مما إذا كان الجهاز المحلي يملك بيانات أحدث تستدعي الرفع للسحابة
        let needUploadToCloud = false;
        if (Array.isArray(cloudData.links)) {
            needUploadToCloud = links.some(l => {
                const cLink = cloudData.links.find(cl => String(cl.id) === String(l.id));
                return !cLink || (l.updatedAt || 0) > (cLink.updatedAt || 0);
            });
        }
        if (Array.isArray(cloudData.categories) && !needUploadToCloud) {
            needUploadToCloud = categories.some(c => {
                const cCat = cloudData.categories.find(cc => cc.id === c.id);
                return !cCat || (c.updatedAt || 0) > (cCat.updatedAt || 0);
            });
        }
        if (Object.keys(syncTombstones.deletedLinks).length > Object.keys(cloudTomb.deletedLinks || {}).length) {
            needUploadToCloud = true;
        }
        if (syncTombstones.clearedAt > (cloudTomb.clearedAt || 0)) {
            needUploadToCloud = true;
        }

        if (localChanged) {
            localStorage.setItem('linkvault_links', JSON.stringify(links));
            localStorage.setItem('linkvault_categories', JSON.stringify(categories));
            updateCategorySelect();
            renderAll();
            if (file.modifiedTime) {
                lastKnownCloudModified = file.modifiedTime;
                localStorage.setItem('fahras_cloud_mtime', lastKnownCloudModified);
            }
            if (!silent || notifyOnChange) {
                showToast('تم تحديث الفهرس تلقائياً من جهاز آخر!', 'info');
            }
        } else if (!silent) {
            showToast('بياناتك محدّثة ومتطابقة مع السحابة', 'info');
        }

        // الرفع فقط إذا كان الجهاز يملك تغييرات أحدث من السحابة (لمنع الرفع المزدوج)
        if (needUploadToCloud) {
            await uploadBackupToDrive(true);
        }
    } catch (err) {
        console.error('Sync error:', err);
    }
}

async function manualSyncToDrive() {
    const valid = await ensureValidGoogleToken(true);
    if (!valid) {
        showToast('يرجى تسجيل الدخول لتجديد الجلسة', 'info');
        return;
    }
    await uploadBackupToDrive(false, true);
}

async function restoreFromDrive() {
    const valid = await ensureValidGoogleToken(true);
    if (!valid) return;
    await syncWithDrive(false);
}

function signOutGoogle() {
    showConfirmModal('هل تريد تسجيل الخروج من حساب Google؟ ستبقى نسختك الاحتياطية محفوظة بأمان على Drive.', () => {
        if (googleAccessToken && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
            google.accounts.oauth2.revoke(googleAccessToken, () => {});
        }
        clearTokenSession(true);
        updateGoogleUI();
        showToast('تم تسجيل الخروج بنجاح', 'info');
    }, 'confirm');
}

function deleteGoogleAccountAndData() {
    showConfirmModal('تحذير: سيتم حذف ملف النسخة الاحتياطية نهائياً من Google Drive وإلغاء ربط حسابك بالتطبيق. هل أنت متأكد؟', async () => {
        try {
            const valid = await ensureValidGoogleToken(true);
            if (valid) {
                const file = await findDriveBackupFile();
                if (file) {
                    await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${googleAccessToken}` }
                    });
                }
                if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                    google.accounts.oauth2.revoke(googleAccessToken, () => {});
                }
            }
        } catch (err) {
            console.error('Error deleting Drive file:', err);
        }

        clearTokenSession(true);
        updateGoogleUI();
        showToast('تم حذف النسخة السحابية وإلغاء ربط الحساب بنجاح', 'error');
    }, 'clear');
}

// ===== المظهر والتهيئة =====
function initTheme() {
    const saved = localStorage.getItem('linkvault_theme') || 'dark';
    document.body.setAttribute('data-theme', saved);
    document.getElementById('themeToggle').checked = saved === 'dark';
    updateThemeUI(saved);
}

function toggleTheme() {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('linkvault_theme', next);
    document.getElementById('themeToggle').checked = next === 'dark';
    updateThemeUI(next);
    showToast(next === 'dark' ? 'تم تفعيل الوضع الداكن' : 'تم تفعيل الوضع النهاري', 'info');
    if (currentView === 'statistics') setTimeout(() => renderCharts(), 200);
}

function updateThemeUI(theme) {
    document.getElementById('themeDesc').textContent = theme === 'dark'
        ? 'التطبيق يستخدم الوضع الداكن حالياً'
        : 'التطبيق يستخدم الوضع النهاري حالياً';
    const navIcon = document.getElementById('navbarThemeIcon');
    if (navIcon) navIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    updateGoogleUI(); // يعرض المستخدم كـ"متصل" فوراً من localStorage إذا كان مسجلاً
    initGoogleAuth();
    updateCategorySelect();
    renderAll();

    let searchDebounceTimer = null;
    document.getElementById('searchInput').addEventListener('input', function() {
        clearTimeout(searchDebounceTimer);
        const value = this.value;
        searchDebounceTimer = setTimeout(() => performSearch(value), 200);
    });

    // مستمعو الأحداث الموحدون (Event Delegation) - مسجلون مرة واحدة فقط
    document.getElementById('recentCards').addEventListener('click', handleCardClick);
    document.getElementById('pinnedFavoritesStrip').addEventListener('click', handleCardClick);
    document.getElementById('categoriesGrid').addEventListener('click', handleCategoryClick);
    document.getElementById('categoryDetailCards').addEventListener('click', handleCardClick);
    document.getElementById('quickFilterBar').addEventListener('click', handleFilterClick);

    document.querySelectorAll('[data-view]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            showView(el.dataset.view, el);
        });
    });

    startLiveSyncWatcher();
    if (!localStorage.getItem('linkvault_categories')) {
        localStorage.setItem('linkvault_categories', JSON.stringify(categories));
    }
});

// ===== معالجات الأحداث الموحدة (Event Delegation) =====
function handleCardClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const url = btn.dataset.url;

    // إذا كان الزر داخل البطاقة، نوقف انتشار الحدث لمنع فتح الرابط
    if (action !== 'visit') e.stopPropagation();

    switch (action) {
        case 'visit':    visitLink(url, id); break;
        case 'favorite': toggleFavorite(id); break;
        case 'copy':     copyLink(url); break;
        case 'edit':     editLink(id); break;
        case 'delete':   deleteLink(id); break;
    }
}

function handleCategoryClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action !== 'view-category') {
        e.stopPropagation();
    } else if (e.target.closest('.category-actions')) {
        return;
    }

    switch (action) {
        case 'view-category':   showCategoryDetail(id); break;
        case 'edit-category':   editCategory(id); break;
        case 'delete-category': deleteCategory(id); break;
    }
}

function handleFilterClick(e) {
    const btn = e.target.closest('[data-action="filter"]');
    if (!btn) return;
    setFilter(btn.dataset.filter);
}

// ===== الفحص التلقائي السريع للتحديثات من الأجهزة الأخرى =====
async function checkForRemoteUpdates() {
    if (!googleUserProfile || isSyncingNow || needsReconnect) return;
    if (syncSettings.frequency !== 'instant') return;
    if (document.visibilityState !== 'visible') return;

    // عدم المقاطعة إذا كان المستخدم يكتب داخل نافذة منبثقة
    const anyModalOpen = document.querySelector('.modal-overlay.active');
    if (anyModalOpen) return;

    const file = await findDriveBackupFile();
    if (!file || !file.modifiedTime) return;

    if (file.modifiedTime !== lastKnownCloudModified) {
        lastKnownCloudModified = file.modifiedTime;
        localStorage.setItem('fahras_cloud_mtime', lastKnownCloudModified);
        await syncWithDrive(true, true);
    }
}

function startLiveSyncWatcher() {
    if (liveSyncInterval) clearInterval(liveSyncInterval);
    liveSyncInterval = setInterval(checkForRemoteUpdates, 60000);
}

// مزامنة فورية عند العودة لتبويب التطبيق أو النقر على النافذة
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && googleUserProfile && syncSettings.frequency === 'instant') {
        checkForRemoteUpdates();
    }
});

window.addEventListener('focus', () => {
    if (googleUserProfile && syncSettings.frequency === 'instant') {
        checkForRemoteUpdates();
    }
});

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

function handleLogoClick() {
    toggleSidebar();
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

function showView(view, element) {
    currentView = view;
    currentCategoryDetailId = null;
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById('settingsTrigger').classList.remove('active-settings');
    if (element) {
        if (element.id === 'settingsTrigger') element.classList.add('active-settings');
        else element.classList.add('active');
    }
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    const viewMap = {
        'dashboard': 'dashboardView',
        'categories': 'categoriesView',
        'statistics': 'statisticsView',
        'settings': 'settingsView'
    };
    if (viewMap[view]) document.getElementById(viewMap[view]).classList.add('active');
    document.getElementById('pageTitle').textContent = {
        dashboard: 'فِهرِس - Fihris',
        categories: 'التصنيفات',
        statistics: 'الإحصائيات',
        settings: 'الإعدادات'
    }[view] || 'فِهرِس';

    document.getElementById('sidebar').classList.remove('active');
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.classList.remove('active');

    const fabBtn = document.querySelector('.mobile-fab-btn');
    if (fabBtn) {
        fabBtn.style.visibility = (view === 'dashboard') ? 'visible' : 'hidden';
    }

    if (view === 'dashboard') renderAll();
    if (view === 'categories') renderCategories();
    if (view === 'statistics') setTimeout(() => renderCharts(), 100);
}

function renderPinnedFavorites() {
    const section = document.getElementById('pinnedFavoritesSection');
    const strip = document.getElementById('pinnedFavoritesStrip');
    const countLabel = document.getElementById('pinnedCountLabel');
    if (!section || !strip) return;

    const favs = links
        .filter(l => l.favorite)
        .sort((a, b) => (b.clicks || 0) - (a.clicks || 0));

    if (favs.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    countLabel.textContent = `${favs.length} ${favs.length === 1 ? 'رابط' : 'روابط'}`;

    strip.innerHTML = favs.map(link => {
        const escapedId = escapeHtml(String(link.id));
        const escapedUrl = escapeHtml(link.url || '');
        const clicks = link.clicks || 0;
        return `
            <div class="pinned-item" data-action="visit" data-id="${escapedId}" data-url="${escapedUrl}" title="${escapedUrl}">
                <div class="pinned-favicon">
                    <img src="${escapeHtml(link.favicon || '')}" alt="${escapeHtml(link.name)}" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\'fas fa-heart\'></i>'">
                </div>
                <div class="pinned-info">
                    <div class="pinned-name">${escapeHtml(link.name)}</div>
                    <div class="pinned-meta">
                        <span>${escapeHtml(link.domain)}</span>
                        ${clicks > 0 ? `• <span style="color:var(--warning);font-weight:700;"><i class="fas fa-fire"></i> ${clicks}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function setSort(sortType) {
    currentSort = sortType;
    const recentBtn = document.getElementById('sortRecentBtn');
    const popularBtn = document.getElementById('sortPopularBtn');
    recentBtn.classList.toggle('active', sortType === 'recent');
    popularBtn.classList.toggle('active', sortType === 'popular');
    popularBtn.classList.toggle('popular-sort', sortType === 'popular');
    renderRecentCards();
}

function setFilter(filter) {
    currentFilter = filter;
    renderFilterBar();
    renderRecentCards();
}

function renderFilterBar() {
    const bar = document.getElementById('quickFilterBar');
    if (!bar) return;
    const favCount = links.filter(l => l.favorite).length;
    let html = `
        <button class="filter-chip ${currentFilter === 'all' ? 'active' : ''}" data-action="filter" data-filter="all">
            <i class="fas fa-globe"></i> الكل <span class="chip-count">${links.length}</span>
        </button>
        <button class="filter-chip ${currentFilter === 'favorites' ? 'active' : ''}" data-action="filter" data-filter="favorites">
            <i class="fas fa-heart"></i> المفضلة <span class="chip-count">${favCount}</span>
        </button>
    `;
    const activeCats = categories
        .map(cat => ({ ...cat, count: links.filter(l => l.category === cat.id).length }))
        .filter(cat => cat.count > 0)
        .sort((a, b) => b.count - a.count);

    activeCats.forEach(cat => {
        const escapedId = escapeHtml(String(cat.id));
        const safeIcon = sanitizeIcon(cat.icon);
        html += `
            <button class="filter-chip ${currentFilter === cat.id ? 'active' : ''}" data-action="filter" data-filter="${escapedId}">
                <i class="${safeIcon}"></i> ${escapeHtml(cat.name)} <span class="chip-count">${cat.count}</span>
            </button>
        `;
    });
    bar.innerHTML = html;
}

function getFavicon(url) {
    try {
        const hostname = new URL(url).hostname;
        return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
    } catch { return null; }
}
function getDomain(url) { try { return new URL(url).hostname.replace('www.',''); } catch { return url; } }
function updateCategorySelect() {
    const sel = document.getElementById('siteCategory');
    sel.innerHTML = '<option value="">بدون تصنيف</option>';
    categories.forEach(c => sel.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`);
}

function renderAll() {
    renderPinnedFavorites();
    renderFilterBar();
    renderRecentCards();
    renderCategories();
    updateBadges();
    if (currentView === 'statistics' &&
        document.getElementById('statisticsView').classList.contains('active')) {
        renderCharts();
    }
    if (currentView === 'categoryDetail' && currentCategoryDetailId) {
        showCategoryDetail(currentCategoryDetailId, false);
    }
}

function createCard(link) {
    const cat = categories.find(c => c.id === link.category) || { name: 'عام', color: '#0ea5e9' };
    const escapedId = escapeHtml(String(link.id));
    const escapedUrl = escapeHtml(link.url || '');
    const safeColor = sanitizeColor(cat.color);
    const clicks = link.clicks || 0;
    return `<div class="link-card" data-action="visit" data-id="${escapedId}" data-url="${escapedUrl}">
                <div class="card-banner" style="background:linear-gradient(135deg,${safeColor},${adjustColor(safeColor, -40)})">
                    <div class="card-favicon">
                        <img src="${escapeHtml(link.favicon || '')}" alt="${escapeHtml(link.name)}" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\'fas fa-globe\'></i>'">
                    </div>
                </div>
                <div class="card-body">
                    <div class="card-badges-top">
                        <span class="card-category"><i class="fas fa-folder"></i> ${escapeHtml(cat.name)}</span>
                        ${clicks > 0 ? `<span class="card-clicks-badge" title="عدد الزيارات"><i class="fas fa-fire"></i> ${clicks}</span>` : ''}
                    </div>
                    <div class="card-title">${escapeHtml(link.name)}</div>
                    <div class="card-url"><i class="fas fa-link"></i> ${escapeHtml(link.domain)}</div>
                    ${link.description ? `<div class="card-description">${escapeHtml(link.description)}</div>` : ''}
                    <div class="card-footer">
                        <span class="card-date"><i class="far fa-calendar"></i> ${escapeHtml(link.date)}</span>
                        <div class="card-actions">
                            <button class="card-action-btn fav" title="المفضلة" style="${link.favorite ? 'color:#f43f5e' : ''}" data-action="favorite" data-id="${escapedId}"><i class="${link.favorite ? 'fas' : 'far'} fa-heart"></i></button>
                            <button class="card-action-btn copy" title="نسخ الرابط" data-action="copy" data-url="${escapedUrl}"><i class="fas fa-copy"></i></button>
                            <button class="card-action-btn edit" title="تعديل" data-action="edit" data-id="${escapedId}"><i class="fas fa-edit"></i></button>
                            <button class="card-action-btn delete" title="حذف" data-action="delete" data-id="${escapedId}"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
}

function renderRecentCards() {
    const container = document.getElementById('recentCards');
    let filtered = [...links];

    if (currentFilter === 'favorites') {
        filtered = filtered.filter(l => l.favorite);
    } else if (currentFilter !== 'all') {
        filtered = filtered.filter(l => l.category === currentFilter);
    }

    if (currentSort === 'popular') {
        filtered.sort((a, b) => (b.clicks || 0) - (a.clicks || 0) || (b.timestamp || 0) - (a.timestamp || 0));
    } else {
        filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }

    container.innerHTML = filtered.length
        ? filtered.map(createCard).join('')
        : emptyHTML('لا توجد روابط هنا', 'جرّب تغيير الفلتر أو أضف رابطاً جديداً');
}

function renderCategories() {
    const container = document.getElementById('categoriesGrid');
    container.innerHTML = categories.map(cat => {
        const count = links.filter(l => l.category === cat.id).length;
        const escapedCatId = escapeHtml(String(cat.id));
        const safeColor = sanitizeColor(cat.color);
        const safeIcon = sanitizeIcon(cat.icon);
        return `<div class="category-card" data-action="view-category" data-id="${escapedCatId}">
                    <div class="category-icon" style="background:${safeColor}20;color:${safeColor}"><i class="${safeIcon}"></i></div>
                    <div class="category-name">${escapeHtml(cat.name)}</div>
                    <div class="category-count">${count} رابط</div>
                    <div class="category-actions">
                        <button class="cat-action-btn edit" title="تعديل التصنيف" data-action="edit-category" data-id="${escapedCatId}"><i class="fas fa-edit"></i></button>
                        <button class="cat-action-btn delete" title="حذف التصنيف" data-action="delete-category" data-id="${escapedCatId}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
    }).join('');
}

function showCategoryDetail(catId, switchView = true) {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    currentCategoryDetailId = catId;
    if (switchView) {
        currentView = 'categoryDetail';
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        document.getElementById('categoryDetailView').classList.add('active');
        const fabBtn = document.querySelector('.mobile-fab-btn');
        if (fabBtn) fabBtn.style.visibility = 'visible';
    }
    const safeColor = sanitizeColor(cat.color);
    document.getElementById('categoryDetailTitle').innerHTML = `<i class="fas fa-folder" style="color:${safeColor}"></i> ${escapeHtml(cat.name)}`;
    const catLinks = links.filter(l => l.category === catId);
    document.getElementById('categoryDetailCards').innerHTML = catLinks.length ? catLinks.map(createCard).join('') : emptyHTML('لا توجد روابط','في هذا التصنيف');
    document.getElementById('pageTitle').textContent = cat.name;
}

function updateBadges() {
    document.getElementById('totalBadge').textContent = links.length;
    document.getElementById('catBadge').textContent = categories.length;
}

function emptyHTML(title, desc) {
    return `<div class="empty-state"><i class="fas fa-bookmark"></i><h3>${escapeHtml(title)}</h3><p>${escapeHtml(desc)}</p></div>`;
}

function openModal() {
    editingId = null;
    document.getElementById('linkForm').reset();
    document.querySelector('#linkModal .modal-header h2').innerHTML = '<i class="fas fa-plus-circle"></i> إضافة رابط جديد';
    document.querySelector('#linkForm .btn-primary').innerHTML = '<i class="fas fa-save"></i> حفظ';
    document.getElementById('linkModal').classList.add('active');
    document.getElementById('siteName').focus();
}

function closeModal() {
    document.getElementById('linkModal').classList.remove('active');
    document.getElementById('linkForm').reset();
    editingId = null;
}

function openCategoryModal() {
    editingCategoryId = null;
    document.getElementById('categoryModalTitle').innerHTML = '<i class="fas fa-folder-plus"></i> تصنيف جديد';
    document.getElementById('categorySubmitBtn').innerHTML = '<i class="fas fa-save"></i> إنشاء';
    document.getElementById('editingCategoryId').value = '';
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryIcon').value = 'fas fa-folder';
    document.querySelectorAll('.color-option').forEach(c => c.classList.remove('selected'));
    document.querySelector('.color-option').classList.add('selected');
    document.getElementById('categoryModal').classList.add('active');
    document.getElementById('categoryName').focus();
}

function closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('active');
    editingCategoryId = null;
}

function selectColor(el) {
    document.querySelectorAll('.color-option').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
}

// ===== إجراءات الأزرار المرتبطة بالمزامنة =====
function saveLink(e) {
    e.preventDefault();
    const name = document.getElementById('siteName').value.trim();
    let url = document.getElementById('siteUrl').value.trim();
    const category = document.getElementById('siteCategory').value;
    const favorite = document.getElementById('siteFavorite').value === 'true';
    const description = document.getElementById('siteDesc').value.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    if (editingId) {
        const idx = links.findIndex(l => String(l.id) === String(editingId));
        if (idx !== -1) {
            links[idx] = {
                ...links[idx],
                name, url, category, favorite, description,
                favicon: getFavicon(url),
                domain: getDomain(url),
                updatedAt: Date.now()
            };
            showToast('تم تحديث الرابط بنجاح!', 'success');
        }
    } else {
        const now = Date.now();
        const newLink = {
            id: generateUniqueId(),
            name, url, category, favorite, description,
            favicon: getFavicon(url),
            domain: getDomain(url),
            date: new Date().toLocaleDateString('ar-SA'),
            timestamp: now,
            updatedAt: now,
            hour: new Date().getHours(),
            clicks: 0
        };
        links.unshift(newLink);
        showToast('تم حفظ الرابط في فهرسك بنجاح!', 'success');
    }

    saveData();
    renderPinnedFavorites();
    renderFilterBar();
    renderRecentCards();
    updateBadges();
    closeModal();
}

function saveCategory(e) {
    e.preventDefault();
    const name = document.getElementById('categoryName').value.trim();
    const rawIcon = document.getElementById('categoryIcon').value.trim();
    const rawColor = document.querySelector('.color-option.selected')?.dataset.color;

    const color = sanitizeColor(rawColor);
    const icon = sanitizeIcon(rawIcon);

    if ((rawIcon && !isValidFontAwesomeIcon(rawIcon)) || (rawColor && !isValidHexColor(rawColor))) {
        showToast('تم استبدال الأيقونة/اللون بقيمة افتراضية لعدم صلاحيتها', 'info');
    }

    if (editingCategoryId) {
        const idx = categories.findIndex(c => c.id === editingCategoryId);
        if (idx !== -1) {
            categories[idx] = { ...categories[idx], name, icon, color, updatedAt: Date.now() };
            showToast('تم تحديث التصنيف بنجاح!', 'success');
        }
    } else {
        categories.push({ id: 'cat_' + generateUniqueId(), name, icon, color, updatedAt: Date.now() });
        showToast('تم إنشاء التصنيف بنجاح!', 'success');
    }

    saveData();
    renderCategories();
    updateCategorySelect();
    closeCategoryModal();
}

function editCategory(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const safeColor = sanitizeColor(cat.color);
    const safeIcon = sanitizeIcon(cat.icon);

    editingCategoryId = id;
    document.getElementById('categoryModalTitle').innerHTML = '<i class="fas fa-edit"></i> تعديل تصنيف';
    document.getElementById('categorySubmitBtn').innerHTML = '<i class="fas fa-save"></i> حفظ التعديلات';
    document.getElementById('editingCategoryId').value = id;
    document.getElementById('categoryName').value = cat.name;
    document.getElementById('categoryIcon').value = safeIcon;
    document.querySelectorAll('.color-option').forEach(c => c.classList.toggle('selected', c.dataset.color === safeColor));
    document.getElementById('categoryModal').classList.add('active');
    document.getElementById('categoryName').focus();
}

function deleteLink(id) {
    const link = links.find(l => String(l.id) === String(id));
    if (!link) return;
    showConfirmModal(`هل أنت متأكد من حذف الرابط "${link.name}"؟ سيتم حذفه من السحابة أيضاً.`, () => {
        links = links.filter(l => String(l.id) !== String(id));
        syncTombstones.deletedLinks[String(id)] = Date.now();
        saveSyncMeta();
        saveData();
        renderAll();
        showToast('تم حذف الرابط بنجاح', 'error');
    }, 'delete');
}

function deleteCategory(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const count = links.filter(l => l.category === id).length;
    const msg = count > 0
        ? `التصنيف "${cat.name}" يحتوي على ${count} رابط. سيتم نقل الروابط إلى "بدون تصنيف". هل تريد المتابعة؟`
        : `هل أنت متأكد من حذف التصنيف "${cat.name}"؟`;
    showConfirmModal(msg, () => {
        links.forEach(l => {
            if (l.category === id) {
                l.category = '';
                l.updatedAt = Date.now();
            }
        });
        if (currentFilter === id) currentFilter = 'all';
        categories = categories.filter(c => c.id !== id);
        syncTombstones.deletedCategories[String(id)] = Date.now();
        saveSyncMeta();
        saveData();
        renderCategories();
        renderRecentCards();
        renderFilterBar();
        updateBadges();
        updateCategorySelect();
        showToast('تم حذف التصنيف بنجاح', 'error');
    }, 'delete');
}

function clearAllData() {
    showConfirmModal('تحذير: سيتم حذف جميع الروابط والتصنيفات نهائياً من هذا الجهاز ومن السحابة. هل أنت متأكد؟', async () => {
        links = [];
        currentFilter = 'all';
        categories = DEFAULT_CATEGORIES.map(c => ({ ...c, updatedAt: Date.now() }));

        syncTombstones.clearedAt = Date.now();
        syncTombstones.deletedLinks = {};
        saveSyncMeta();

        localStorage.setItem('linkvault_links', JSON.stringify(links));
        localStorage.setItem('linkvault_categories', JSON.stringify(categories));
        renderAll();
        updateCategorySelect();
        showToast('تم حذف جميع البيانات ومزامنة الحذف مع السحابة', 'error');

        if (googleUserProfile) {
            await uploadBackupToDrive(true, true);
        }
    }, 'clear');
}

function editLink(id) {
    const link = links.find(l => String(l.id) === String(id));
    if (!link) return;
    editingId = String(link.id);
    document.getElementById('siteName').value = link.name;
    document.getElementById('siteUrl').value = link.url;
    document.getElementById('siteCategory').value = link.category;
    document.getElementById('siteFavorite').value = link.favorite ? 'true' : 'false';
    document.getElementById('siteDesc').value = link.description || '';
    document.querySelector('#linkModal .modal-header h2').innerHTML = '<i class="fas fa-edit"></i> تعديل رابط';
    document.querySelector('#linkForm .btn-primary').innerHTML = '<i class="fas fa-save"></i> تحديث';
    document.getElementById('linkModal').classList.add('active');
    document.getElementById('siteName').focus();
}

function toggleFavorite(id) {
    const link = links.find(l => String(l.id) === String(id));
    if (link) {
        link.favorite = !link.favorite;
        link.updatedAt = Date.now();
        saveData();
        renderPinnedFavorites();
        renderRecentCards();
        showToast(link.favorite ? 'ثُبّت في شريط المفضلة!' : 'أُزيل من المفضلة', 'info');
    }
}

function copyLink(url) {
    navigator.clipboard.writeText(url).then(() => showToast('تم نسخ الرابط!', 'success'))
    .catch(() => {
        const t = document.createElement('textarea');
        t.value = url;
        document.body.appendChild(t);
        t.select();
        document.execCommand('copy');
        document.body.removeChild(t);
        showToast('تم نسخ الرابط!', 'success');
    });
}

function visitLink(url, id) {
    if (id) {
        const link = links.find(l => String(l.id) === String(id));
        if (link) {
            link.clicks = (link.clicks || 0) + 1;
            link.lastVisited = Date.now();
            link.updatedAt = Date.now();
            saveData();
            renderPinnedFavorites();
            renderRecentCards();
            if (currentView === 'statistics') renderCharts();
        }
    }
    window.open(url, '_blank');
}

function performSearch(term) {
    term = term.toLowerCase().trim();
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById('dashboardView').classList.add('active');
    document.getElementById('pageTitle').textContent = term ? 'نتائج البحث' : 'فِهرِس - Fihris';
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById('navDashboard').classList.add('active');
    currentView = 'dashboard';
    if (!term) {
        renderRecentCards();
        return;
    }
    const filtered = links.filter(l => {
        const cat = categories.find(c => c.id === l.category);
        const catName = cat ? cat.name.toLowerCase() : '';
        return l.name.toLowerCase().includes(term) ||
            (l.description && l.description.toLowerCase().includes(term)) ||
            l.domain.toLowerCase().includes(term) ||
            catName.includes(term);
    });
    document.getElementById('recentCards').innerHTML = filtered.length
        ? filtered.map(createCard).join('')
        : emptyHTML('لا توجد نتائج', 'جرب البحث بكلمات مختلفة');
}

function exportData() {
    const data = { links, categories, exportDate: new Date().toISOString(), app: 'فهرس - فاضل الشامي' };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fihris_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('تم تصدير نسخة فِهرِس بنجاح!', 'success');
}

function mergeImportedObject(data) {
    let addedLinks = 0, addedCategories = 0, skippedLinks = 0, skippedCategories = 0;

    if (data.categories && Array.isArray(data.categories)) {
        data.categories.forEach(importedCat => {
            if (!importedCat || typeof importedCat !== 'object' || typeof importedCat.name !== 'string') return;
            const exists = categories.some(c => c.name.trim().toLowerCase() === importedCat.name.trim().toLowerCase());
            if (!exists) {
                categories.push({
                    ...importedCat,
                    id: 'cat_' + generateUniqueId(),
                    color: sanitizeColor(importedCat.color),
                    icon: sanitizeIcon(importedCat.icon),
                    updatedAt: Date.now()
                });
                addedCategories++;
            } else {
                skippedCategories++;
            }
        });
    }

    if (data.links && Array.isArray(data.links)) {
        data.links.forEach(importedLink => {
            const normalizedUrl = (importedLink.url || '').replace(/\/+$/, '').toLowerCase();
            const existingIdx = links.findIndex(l =>
                (l.url || '').replace(/\/+$/, '').toLowerCase() === normalizedUrl
            );
            if (existingIdx === -1) {
                let catId = importedLink.category || '';
                if (catId && !categories.some(c => c.id === catId)) {
                    const oldCat = data.categories?.find(c => c.id === catId);
                    if (oldCat) {
                        const matchedCat = categories.find(c => c.name.trim().toLowerCase() === oldCat.name.trim().toLowerCase());
                        catId = matchedCat ? matchedCat.id : '';
                    } else {
                        catId = '';
                    }
                }
                const now = Date.now();
                links.push({
                    id: generateUniqueId(),
                    name: importedLink.name || 'بدون عنوان',
                    url: importedLink.url,
                    category: catId,
                    favorite: importedLink.favorite === true,
                    description: importedLink.description || '',
                    favicon: getFavicon(importedLink.url),
                    domain: getDomain(importedLink.url),
                    date: importedLink.date || new Date().toLocaleDateString('ar-SA'),
                    timestamp: now,
                    updatedAt: now,
                    hour: importedLink.hour !== undefined ? importedLink.hour : new Date().getHours(),
                    clicks: typeof importedLink.clicks === 'number' ? importedLink.clicks : 0
                });
                addedLinks++;
            } else if ((importedLink.updatedAt || 0) > (links[existingIdx].updatedAt || 0)) {
                links[existingIdx] = {
                    ...links[existingIdx],
                    name: importedLink.name || links[existingIdx].name,
                    description: importedLink.description || links[existingIdx].description,
                    favorite: importedLink.favorite === true,
                    category: links[existingIdx].category,
                    favicon: getFavicon(importedLink.url),
                    domain: getDomain(importedLink.url),
                    updatedAt: importedLink.updatedAt
                };
                skippedLinks++;
            } else {
                skippedLinks++;
            }
        });
    }

    saveData();
    updateCategorySelect();
    renderAll();

    if (addedLinks > 0 || addedCategories > 0) {
        let toastMsg = `تمت الإضافة: ${addedLinks} رابط و ${addedCategories} تصنيف.`;
        if (skippedLinks > 0 || skippedCategories > 0)
            toastMsg += ` (تجاهل ${skippedLinks} رابط و ${skippedCategories} تصنيف مكرر)`;
        showToast(toastMsg, 'success');
    } else {
        showToast('جميع العناصر متزامنة وموجودة مسبقاً.', 'info');
    }
}

function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const data = JSON.parse(ev.target.result);
            if (!data || typeof data !== 'object') {
                showToast('بنية ملف JSON غير صالحة.', 'error');
                return;
            }
            if (Array.isArray(data.categories)) {
                data.categories = data.categories.filter(
                    c => c !== null && typeof c === 'object' && !Array.isArray(c)
                );
            } else {
                data.categories = [];
            }
            mergeImportedObject(data);
        } catch (err) {
            console.error(err);
            showToast('خطأ في قراءة الملف! تأكد من أنه ملف JSON صحيح.', 'error');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function showConfirmModal(message, onConfirm, type = 'delete') {
    document.getElementById('confirmModalMessage').textContent = message;
    document.getElementById('confirmModal').classList.add('active');
    const titleEl = document.getElementById('confirmModalTitle');
    const btnEl = document.getElementById('confirmModalBtn');
    if (type === 'delete') {
        titleEl.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:var(--danger);"></i> تأكيد الحذف';
        btnEl.className = 'btn btn-danger';
        btnEl.innerHTML = '<i class="fas fa-trash"></i> حذف';
    } else if (type === 'clear') {
        titleEl.innerHTML = '<i class="fas fa-skull-crossbones" style="color:var(--danger);"></i> حذف نهائي';
        btnEl.className = 'btn btn-danger';
        btnEl.innerHTML = '<i class="fas fa-trash"></i> حذف الكل';
    } else {
        titleEl.innerHTML = '<i class="fas fa-question-circle" style="color:var(--warning);"></i> تأكيد';
        btnEl.className = 'btn btn-primary';
        btnEl.innerHTML = '<i class="fas fa-check"></i> تأكيد';
    }
    confirmCallback = onConfirm;
    document.getElementById('confirmModalBtn').onclick = function() {
        if (confirmCallback) confirmCallback();
        closeConfirmModal();
    };
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active');
    confirmCallback = null;
}

// دالة الحفظ المركزية السريعة
function saveData(skipCloudSync = false) {
    localStorage.setItem('linkvault_links', JSON.stringify(links));
    localStorage.setItem('linkvault_categories', JSON.stringify(categories));

    if (skipCloudSync || !googleUserProfile) return;

    if (syncSettings.frequency === 'instant') {
        clearTimeout(autoSyncTimeout);
        autoSyncTimeout = setTimeout(() => {
            uploadBackupToDrive(true, false);
        }, 400);
    } else if (syncSettings.frequency === 'daily') {
        const dayMs = 24 * 60 * 60 * 1000;
        if ((Date.now() - syncSettings.lastDailySync) >= dayMs) {
            uploadBackupToDrive(true, false);
        }
    }
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
    const titles = { success: 'تم!', error: 'خطأ!', info: 'تنبيه!' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-icon"><i class="fas ${icons[type]}"></i></div><div class="toast-content"><div class="toast-title">${titles[type]}</div><div class="toast-message">${msg}</div></div><button class="toast-close"><i class="fas fa-times"></i></button>`;
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) closeBtn.addEventListener('click', () => toast.remove());
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function adjustColor(color, amount) {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x00FF) + amount));
    return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

function getChartColors() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    return { text: isDark ? '#94a3b8' : '#475569', grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' };
}

function destroyCharts() {
    Object.values(chartInstances).forEach(c => { if (c) c.destroy(); });
    chartInstances = {};
}

function renderCharts() {
    destroyCharts();
    const total = links.length;
    const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);
    const favCount = links.filter(l => l.favorite).length;

    document.getElementById('statBoxTotal').textContent = total;
    document.getElementById('statBoxClicks').textContent = totalClicks;
    document.getElementById('statBoxFavorites').textContent = favCount;

    const catCounts = {};
    links.forEach(l => {
        const c = categories.find(x => x.id === l.category) || { name: 'بدون تصنيف' };
        catCounts[c.name] = (catCounts[c.name] || 0) + 1;
    });

    const colors = getChartColors();
    const chartColors = ['#0ea5e9','#14b8a6','#f43f5e','#f59e0b','#10b981','#6366f1','#8b5cf6','#ef4444'];

    chartInstances.category = new Chart(document.getElementById('categoryChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(catCounts).length ? Object.keys(catCounts) : ['لا توجد بيانات'],
            datasets: [{
                data: Object.keys(catCounts).length ? Object.values(catCounts) : [1],
                backgroundColor: Object.keys(catCounts).length
                    ? Object.keys(catCounts).map((_, i) => chartColors[i % chartColors.length])
                    : ['rgba(100, 116, 139, 0.25)'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: colors.text, font: { family: 'Tajawal', size: 12 }, padding: 16 } }
            },
            cutout: '64%'
        }
    });

    const topVisited = [...links]
        .filter(l => (l.clicks || 0) > 0)
        .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
        .slice(0, 5);

    chartInstances.topLinks = new Chart(document.getElementById('topLinksChart'), {
        type: 'bar',
        data: {
            labels: topVisited.length ? topVisited.map(l => l.name.length > 18 ? l.name.slice(0, 18) + '…' : l.name) : ['لا توجد زيارات بعد'],
            datasets: [{
                label: 'عدد الزيارات',
                data: topVisited.length ? topVisited.map(l => l.clicks) : [0],
                backgroundColor: 'rgba(245, 158, 11, 0.75)',
                borderColor: '#f59e0b',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: colors.grid, drawBorder: false }, ticks: { color: colors.text, font: { family: 'Tajawal' }, stepSize: 1 } },
                y: { grid: { display: false }, ticks: { color: colors.text, font: { family: 'Tajawal', weight: '700' } } }
            }
        }
    });
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
            if (overlay.id === 'confirmModal') confirmCallback = null;
        }
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        document.getElementById('sidebar')?.classList.remove('active');
        document.getElementById('sidebarOverlay')?.classList.remove('active');
        confirmCallback = null;
        editingId = null;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openModal();
    }
});

window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        document.getElementById('sidebar')?.classList.remove('active');
        document.getElementById('sidebarOverlay')?.classList.remove('active');
    }
});
