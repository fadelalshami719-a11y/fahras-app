// ===== إعدادات مصادقة Google و Drive =====
const GOOGLE_CLIENT_ID = '674857553188-s9tu07obk7eods4ffh8ds8aekuavjfiq.apps.googleusercontent.com';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
const DRIVE_BACKUP_FILENAME = 'fahras_backup.json';

let tokenClient = null;
let googleAccessToken = localStorage.getItem('fahras_google_token') || null;
let googleTokenExpiry = Number(localStorage.getItem('fahras_google_expiry') || 0);
let googleUserProfile = JSON.parse(localStorage.getItem('fahras_google_user') || 'null');
let autoSyncTimeout = null;

function generateUniqueId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 10);
}

let links = (() => {
    const stored = localStorage.getItem('linkvault_links');
    if (!stored) return [];
    let parsed = JSON.parse(stored);
    return parsed.map(link => {
        if (typeof link.id === 'number') link.id = String(link.id);
        if (typeof link.clicks !== 'number') link.clicks = 0;
        return link;
    });
})();

let categories = JSON.parse(localStorage.getItem('linkvault_categories')) || [
    { id: 'general', name: 'عام', icon: 'fas fa-globe', color: '#0ea5e9' },
    { id: 'dev', name: 'تطوير', icon: 'fas fa-code', color: '#10b981' },
    { id: 'design', name: 'تصميم', icon: 'fas fa-paint-brush', color: '#f43f5e' },
    { id: 'edu', name: 'تعليم', icon: 'fas fa-graduation-cap', color: '#14b8a6' },
    { id: 'news', name: 'أخبار', icon: 'fas fa-newspaper', color: '#f59e0b' }
];

let chartInstances = {};
let editingId = null;
let editingCategoryId = null;
let confirmCallback = null;
let currentView = 'dashboard';
let currentFilter = 'all';
let currentSort = 'recent';
let currentCategoryDetailId = null;

// ===== تهيئة عميل مصادقة جوجل =====
function initGoogleAuth() {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        setTimeout(initGoogleAuth, 500);
        return;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: async (tokenResponse) => {
            if (tokenResponse.error) {
                showToast('تعذر إتمام تسجيل الدخول عبر Google', 'error');
                return;
            }
            googleAccessToken = tokenResponse.access_token;
            googleTokenExpiry = Date.now() + ((tokenResponse.expires_in || 3500) * 1000);
            localStorage.setItem('fahras_google_token', googleAccessToken);
            localStorage.setItem('fahras_google_expiry', String(googleTokenExpiry));

            await fetchGoogleUserProfile();
            updateGoogleUI();
            showToast('تم تسجيل الدخول بنجاح! جارٍ مزامنة بياناتك...', 'success');
            await syncOnLogin();
        }
    });
}

function isGoogleTokenValid() {
    return googleAccessToken && Date.now() < (googleTokenExpiry - 60000);
}

async function ensureValidGoogleToken(interactive = true) {
    if (isGoogleTokenValid()) return true;
    if (!tokenClient) initGoogleAuth();
    if (!tokenClient) return false;

    return new Promise((resolve) => {
        const originalCallback = tokenClient.callback;
        tokenClient.callback = async (resp) => {
            tokenClient.callback = originalCallback;
            if (resp.error || !resp.access_token) {
                resolve(false);
                return;
            }
            googleAccessToken = resp.access_token;
            googleTokenExpiry = Date.now() + ((resp.expires_in || 3500) * 1000);
            localStorage.setItem('fahras_google_token', googleAccessToken);
            localStorage.setItem('fahras_google_expiry', String(googleTokenExpiry));
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
    if (googleUserProfile) {
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
            navBtn.classList.add('connected');
            navBtn.innerHTML = googleUserProfile.picture
                ? `<img src="${googleUserProfile.picture}" alt=""><span>متصل</span>`
                : `<i class="fab fa-google"></i><span>متصل</span>`;
        }
        if (sidebarName) sidebarName.textContent = googleUserProfile.name;
        if (sidebarStatus) sidebarStatus.innerHTML = `<i class="fas fa-cloud-check" style="color:var(--success);"></i> مزامنة مفعّلة`;
        if (sidebarAvatar && googleUserProfile.picture) {
            sidebarAvatar.innerHTML = `<img src="${googleUserProfile.picture}" style="width:100%;height:100%;border-radius:12px;object-fit:cover;">`;
        }
    } else {
        if (loggedOutBox) loggedOutBox.style.display = 'block';
        if (loggedInBox) loggedInBox.style.display = 'none';
        if (navBtn) {
            navBtn.classList.remove('connected');
            navBtn.innerHTML = `<i class="fab fa-google"></i><span id="navGoogleText">دخول</span>`;
        }
        if (sidebarName) sidebarName.textContent = 'مستخدم جديد';
        if (sidebarStatus) sidebarStatus.innerHTML = `<i class="fas fa-cog"></i> الإعدادات والنسخ`;
        if (sidebarAvatar) sidebarAvatar.textContent = 'م';
    }
}

// ===== دوال التعامل مع Google Drive (appDataFolder) =====
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

async function uploadBackupToDrive(silent = false) {
    if (!googleUserProfile) return false;
    const valid = await ensureValidGoogleToken(!silent);
    if (!valid) return false;

    try {
        const existingFile = await findDriveBackupFile();
        const backupPayload = JSON.stringify({
            links,
            categories,
            updatedAt: new Date().toISOString(),
            app: 'فهرس - فاضل الشامي'
        });

        const metadata = {
            name: DRIVE_BACKUP_FILENAME,
            mimeType: 'application/json'
        };
        if (!existingFile) {
            metadata.parents = ['appDataFolder'];
        }

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
            ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`
            : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

        const method = existingFile ? 'PATCH' : 'POST';

        const res = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${googleAccessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
        });

        if (res.ok) {
            const syncLabel = document.getElementById('lastSyncLabel');
            if (syncLabel) {
                const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
                syncLabel.innerHTML = `<i class="fas fa-check-circle"></i> آخر مزامنة: ${timeStr}`;
            }
            if (!silent) showToast('تم حفظ النسخة الاحتياطية على Google Drive!', 'success');
            return true;
        }
    } catch (err) {
        console.error('Drive upload error:', err);
        if (!silent) showToast('حدث خطأ أثناء الرفع إلى Google Drive', 'error');
    }
    return false;
}

async function syncOnLogin() {
    const file = await findDriveBackupFile();
    if (file) {
        await downloadAndMergeDriveBackup(file.id, true);
    } else {
        await uploadBackupToDrive(true);
    }
}

async function manualSyncToDrive() {
    const valid = await ensureValidGoogleToken(true);
    if (!valid) {
        showToast('يرجى إعادة تسجيل الدخول لتجديد الجلسة', 'info');
        return;
    }
    await uploadBackupToDrive(false);
}

async function restoreFromDrive() {
    const valid = await ensureValidGoogleToken(true);
    if (!valid) return;

    const file = await findDriveBackupFile();
    if (!file) {
        showToast('لا توجد نسخة احتياطية محفوظة على Google Drive حتى الآن', 'info');
        return;
    }
    await downloadAndMergeDriveBackup(file.id, false);
}

async function downloadAndMergeDriveBackup(fileId, isAutoLogin = false) {
    try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${googleAccessToken}` }
        });
        if (!res.ok) return;
        const data = await res.json();

        if (isAutoLogin && links.length === 0 && Array.isArray(data.links)) {
            links = data.links;
            if (Array.isArray(data.categories) && data.categories.length > 0) {
                categories = data.categories;
            }
            saveData(true);
            updateCategorySelect();
            renderAll();
            showToast(`تمت استعادة ${links.length} رابط من Google Drive!`, 'success');
        } else {
            mergeImportedObject(data);
        }
    } catch (err) {
        console.error('Restore error:', err);
        showToast('تعذر قراءة النسخة الاحتياطية من Drive', 'error');
    }
}

function signOutGoogle() {
    showConfirmModal('هل تريد تسجيل الخروج من حساب Google؟ ستبقى نسختك الاحتياطية محفوظة بأمان على Drive.', () => {
        googleAccessToken = null;
        googleTokenExpiry = 0;
        googleUserProfile = null;
        localStorage.removeItem('fahras_google_token');
        localStorage.removeItem('fahras_google_expiry');
        localStorage.removeItem('fahras_google_user');
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

        googleAccessToken = null;
        googleTokenExpiry = 0;
        googleUserProfile = null;
        localStorage.removeItem('fahras_google_token');
        localStorage.removeItem('fahras_google_expiry');
        localStorage.removeItem('fahras_google_user');
        updateGoogleUI();
        showToast('تم حذف النسخة السحابية وإلغاء ربط الحساب بنجاح', 'error');
    }, 'clear');
}

// ===== بقية منطق التطبيق الأساسي =====
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
    if (currentView === 'statistics') setTimeout(() => renderCharts(), 300);
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
    initGoogleAuth();
    updateGoogleUI();
    updateCategorySelect();
    renderAll();

    if (googleUserProfile && isGoogleTokenValid()) {
        syncOnLogin();
    }

    document.getElementById('searchInput').addEventListener('input', function() {
        performSearch(this.value);
    });

    const logoBox = document.querySelector('.logo-icon');
    const logoIcon = document.getElementById('logoMainIcon');
    const sidebar = document.getElementById('sidebar');

    if (logoBox && logoIcon && sidebar) {
        logoBox.addEventListener('mouseenter', () => {
            if (sidebar.classList.contains('collapsed')) {
                logoIcon.className = 'fas fa-chevron-left';
            }
        });
        logoBox.addEventListener('mouseleave', () => {
            logoIcon.className = 'fas fa-compass';
        });
    }
});

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const logoIcon = document.getElementById('logoMainIcon');
    sidebar.classList.toggle('collapsed');
    if (!sidebar.classList.contains('collapsed')) {
        logoIcon.className = 'fas fa-compass';
    }
}

function handleLogoClick() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('collapsed')) {
        toggleSidebar();
    }
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
        dashboard: 'فِهرِس الروابط',
        categories: 'التصنيفات',
        statistics: 'الإحصائيات',
        settings: 'الإعدادات'
    }[view] || 'فِهرِس';

    // إغلاق قائمة الهاتف والطبقة المعتمة عند الانتقال لأي قسم
    document.getElementById('sidebar').classList.remove('active');
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.classList.remove('active');

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
        const safeId = String(link.id).replace(/'/g, "\\'");
        const safeUrl = (link.url || '').replace(/'/g, "\\'");
        const clicks = link.clicks || 0;
        return `
            <div class="pinned-item" onclick="visitLink('${safeUrl}', '${safeId}')" title="${escapeHtml(link.url)}">
                <div class="pinned-favicon">
                    <img src="${link.favicon}" alt="${escapeHtml(link.name)}" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\'fas fa-heart\'></i>'">
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
        <button class="filter-chip ${currentFilter === 'all' ? 'active' : ''}" onclick="setFilter('all')">
            <i class="fas fa-globe"></i> الكل <span class="chip-count">${links.length}</span>
        </button>
        <button class="filter-chip ${currentFilter === 'favorites' ? 'active' : ''}" onclick="setFilter('favorites')">
            <i class="fas fa-heart"></i> المفضلة <span class="chip-count">${favCount}</span>
        </button>
    `;
    const activeCats = categories
        .map(cat => ({ ...cat, count: links.filter(l => l.category === cat.id).length }))
        .filter(cat => cat.count > 0)
        .sort((a, b) => b.count - a.count);

    activeCats.forEach(cat => {
        const safeId = String(cat.id).replace(/'/g, "\\'");
        html += `
            <button class="filter-chip ${currentFilter === cat.id ? 'active' : ''}" onclick="setFilter('${safeId}')">
                <i class="${cat.icon}"></i> ${escapeHtml(cat.name)} <span class="chip-count">${cat.count}</span>
            </button>
        `;
    });
    bar.innerHTML = html;
}

function getFavicon(url) { try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=128`; } catch { return null; } }
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
    if (currentView === 'statistics') renderCharts();
    if (currentView === 'categoryDetail' && currentCategoryDetailId) {
        showCategoryDetail(currentCategoryDetailId, false);
    }
}

function createCard(link) {
    const cat = categories.find(c => c.id === link.category) || { name:'عام', color:'#0ea5e9' };
    const safeId = String(link.id).replace(/'/g, "\\'");
    const safeUrl = (link.url || '').replace(/'/g, "\\'");
    const clicks = link.clicks || 0;
    return `<div class="link-card" onclick="visitLink('${safeUrl}', '${safeId}')">
                <div class="card-banner" style="background:linear-gradient(135deg,${cat.color},${adjustColor(cat.color,-40)})">
                    <div class="card-favicon">
                        <img src="${link.favicon}" alt="${escapeHtml(link.name)}" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\'fas fa-globe\'></i>'">
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
                            <button class="card-action-btn fav" title="المفضلة" style="${link.favorite?'color:#f43f5e':''}" onclick="event.stopPropagation();toggleFavorite('${safeId}')"><i class="${link.favorite?'fas':'far'} fa-heart"></i></button>
                            <button class="card-action-btn copy" title="نسخ الرابط" onclick="event.stopPropagation();copyLink('${safeUrl}')"><i class="fas fa-copy"></i></button>
                            <button class="card-action-btn edit" title="تعديل" onclick="event.stopPropagation();editLink('${safeId}')"><i class="fas fa-edit"></i></button>
                            <button class="card-action-btn delete" title="حذف" onclick="event.stopPropagation();deleteLink('${safeId}')"><i class="fas fa-trash"></i></button>
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
        const safeCatId = String(cat.id).replace(/'/g, "\\'");
        return `<div class="category-card" onclick="showCategoryDetail('${safeCatId}')">
                    <div class="category-icon" style="background:${cat.color}20;color:${cat.color}"><i class="${cat.icon}"></i></div>
                    <div class="category-name">${escapeHtml(cat.name)}</div>
                    <div class="category-count">${count} رابط</div>
                    <div class="category-actions" onclick="event.stopPropagation()">
                        <button class="cat-action-btn edit" title="تعديل التصنيف" onclick="editCategory('${safeCatId}')"><i class="fas fa-edit"></i></button>
                        <button class="cat-action-btn delete" title="حذف التصنيف" onclick="deleteCategory('${safeCatId}')"><i class="fas fa-trash"></i></button>
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
    }
    document.getElementById('categoryDetailTitle').innerHTML = `<i class="fas fa-folder" style="color:${cat.color}"></i> ${escapeHtml(cat.name)}`;
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
                domain: getDomain(url)
            };
            showToast('تم تحديث الرابط بنجاح!', 'success');
        }
    } else {
        const newLink = {
            id: generateUniqueId(),
            name, url, category, favorite, description,
            favicon: getFavicon(url),
            domain: getDomain(url),
            date: new Date().toLocaleDateString('ar-SA'),
            timestamp: Date.now(),
            hour: new Date().getHours(),
            clicks: 0
        };
        links.unshift(newLink);
        showToast('تم حفظ الرابط في فهرسك بنجاح!', 'success');
    }

    saveData();
    renderAll();
    closeModal();
}

function saveCategory(e) {
    e.preventDefault();
    const name = document.getElementById('categoryName').value.trim();
    const icon = document.getElementById('categoryIcon').value.trim() || 'fas fa-folder';
    const color = document.querySelector('.color-option.selected')?.dataset.color || '#0ea5e9';

    if (editingCategoryId) {
        const idx = categories.findIndex(c => c.id === editingCategoryId);
        if (idx !== -1) {
            categories[idx] = { ...categories[idx], name, icon, color };
            showToast('تم تحديث التصنيف بنجاح!', 'success');
        }
    } else {
        categories.push({ id: 'cat_' + generateUniqueId(), name, icon, color });
        showToast('تم إنشاء التصنيف بنجاح!', 'success');
    }

    saveData();
    updateCategorySelect();
    renderAll();
    closeCategoryModal();
}

function editCategory(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    editingCategoryId = id;
    document.getElementById('categoryModalTitle').innerHTML = '<i class="fas fa-edit"></i> تعديل تصنيف';
    document.getElementById('categorySubmitBtn').innerHTML = '<i class="fas fa-save"></i> حفظ التعديلات';
    document.getElementById('editingCategoryId').value = id;
    document.getElementById('categoryName').value = cat.name;
    document.getElementById('categoryIcon').value = cat.icon;
    document.querySelectorAll('.color-option').forEach(c => c.classList.toggle('selected', c.dataset.color === cat.color));
    document.getElementById('categoryModal').classList.add('active');
    document.getElementById('categoryName').focus();
}

function deleteLink(id) {
    const link = links.find(l => String(l.id) === String(id));
    if (!link) return;
    showConfirmModal(`هل أنت متأكد من حذف الرابط "${link.name}"؟ لا يمكن التراجع.`, () => {
        links = links.filter(l => String(l.id) !== String(id));
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
        links.forEach(l => { if (l.category === id) l.category = ''; });
        if (currentFilter === id) currentFilter = 'all';
        categories = categories.filter(c => c.id !== id);
        saveData();
        renderAll();
        updateCategorySelect();
        showToast('تم حذف التصنيف بنجاح', 'error');
    }, 'delete');
}

function clearAllData() {
    showConfirmModal('تحذير: سيتم حذف جميع الروابط والتصنيفات المحلية بشكل نهائي. هل أنت متأكد؟', () => {
        links = [];
        currentFilter = 'all';
        categories = [
            { id:'general', name:'عام', icon:'fas fa-globe', color:'#0ea5e9' },
            { id:'dev', name:'تطوير', icon:'fas fa-code', color:'#10b981' },
            { id:'design', name:'تصميم', icon:'fas fa-paint-brush', color:'#f43f5e' },
            { id:'edu', name:'تعليم', icon:'fas fa-graduation-cap', color:'#14b8a6' },
            { id:'news', name:'أخبار', icon:'fas fa-newspaper', color:'#f59e0b' }
        ];
        saveData();
        renderAll();
        updateCategorySelect();
        showToast('تم حذف جميع البيانات المحلية', 'error');
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
        saveData();
        renderAll();
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
    document.getElementById('pageTitle').textContent = term ? 'نتائج البحث' : 'فِهرِس الروابط';
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector('a[onclick*=dashboard]').classList.add('active');
    currentView = 'dashboard';
    if (!term) {
        renderRecentCards();
        return;
    }
    const filtered = links.filter(l =>
        l.name.toLowerCase().includes(term) ||
        (l.description && l.description.toLowerCase().includes(term)) ||
        l.domain.toLowerCase().includes(term)
    );
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
            const exists = categories.some(c => c.name.trim().toLowerCase() === importedCat.name.trim().toLowerCase());
            if (!exists) {
                categories.push({ ...importedCat, id: 'cat_' + generateUniqueId() });
                addedCategories++;
            } else {
                skippedCategories++;
            }
        });
    }

    if (data.links && Array.isArray(data.links)) {
        data.links.forEach(importedLink => {
            const normalizedUrl = (importedLink.url || '').replace(/\/+$/, '').toLowerCase();
            const exists = links.some(l => (l.url || '').replace(/\/+$/, '').toLowerCase() === normalizedUrl);
            if (!exists) {
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
                    timestamp: importedLink.timestamp || Date.now(),
                    hour: importedLink.hour !== undefined ? importedLink.hour : new Date().getHours(),
                    clicks: typeof importedLink.clicks === 'number' ? importedLink.clicks : 0
                });
                addedLinks++;
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

function saveData(skipCloudSync = false) {
    localStorage.setItem('linkvault_links', JSON.stringify(links));
    localStorage.setItem('linkvault_categories', JSON.stringify(categories));

    if (!skipCloudSync && googleUserProfile && isGoogleTokenValid()) {
        clearTimeout(autoSyncTimeout);
        autoSyncTimeout = setTimeout(() => {
            uploadBackupToDrive(true);
        }, 2000);
    }
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
    const titles = { success: 'تم!', error: 'خطأ!', info: 'تنبيه!' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-icon"><i class="fas ${icons[type]}"></i></div><div class="toast-content"><div class="toast-title">${titles[type]}</div><div class="toast-message">${msg}</div></div><button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
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

// إغلاق قائمة الهاتف والطبقة المعتمة تلقائياً عند الانتقال لشاشة أكبر
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        document.getElementById('sidebar')?.classList.remove('active');
        document.getElementById('sidebarOverlay')?.classList.remove('active');
    }
});
