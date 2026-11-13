:root {
            --primary: #0ea5e9;
            --primary-dark: #0284c7;
            --primary-light: #38bdf8;
            --secondary: #f43f5e;
            --accent: #14b8a6;
            --success: #10b981;
            --danger: #ef4444;
            --warning: #f59e0b;
            --info: #06b6d4;
            --whatsapp: #25d366;
            --radius: 22px;
            --radius-sm: 14px;
            --transition: all 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }

        [data-theme="dark"] {
            --bg-dark: #060913;
            --bg-mesh: radial-gradient(circle at 15% 15%, rgba(14, 165, 233, 0.12) 0%, transparent 45%),
                       radial-gradient(circle at 85% 80%, rgba(20, 184, 166, 0.1) 0%, transparent 45%);
            --bg-card: rgba(15, 23, 42, 0.65);
            --bg-sidebar: rgba(10, 15, 30, 0.78);
            --bg-hover: rgba(30, 41, 59, 0.85);
            --text-primary: #f8fafc;
            --text-secondary: #cbd5e1;
            --text-muted: #64748b;
            --border: rgba(255, 255, 255, 0.08);
            --border-highlight: rgba(56, 189, 248, 0.35);
            --shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
            --shadow-lg: 0 20px 40px -10px rgba(0, 0, 0, 0.6);
            --input-bg: rgba(2, 6, 23, 0.6);
            --chart-grid: rgba(255, 255, 255, 0.06);
            --chart-text: #94a3b8;
        }

        [data-theme="light"] {
            --bg-dark: #eef2f6;
            --bg-mesh: radial-gradient(circle at 10% 10%, rgba(14, 165, 233, 0.12) 0%, transparent 45%),
                       radial-gradient(circle at 90% 90%, rgba(244, 63, 94, 0.08) 0%, transparent 45%);
            --bg-card: rgba(255, 255, 255, 0.82);
            --bg-sidebar: rgba(255, 255, 255, 0.88);
            --bg-hover: rgba(241, 245, 249, 0.95);
            --text-primary: #0f172a;
            --text-secondary: #334155;
            --text-muted: #64748b;
            --border: rgba(15, 23, 42, 0.08);
            --border-highlight: rgba(14, 165, 233, 0.4);
            --shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
            --shadow-lg: 0 20px 35px -10px rgba(15, 23, 42, 0.12);
            --input-bg: rgba(255, 255, 255, 0.9);
            --chart-grid: rgba(15, 23, 42, 0.06);
            --chart-text: #475569;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Tajawal', sans-serif;
            background-color: var(--bg-dark);
            background-image: var(--bg-mesh);
            background-attachment: fixed;
            color: var(--text-primary);
            min-height: 100vh;
            overflow-x: hidden;
            transition: background 0.4s ease, color 0.3s ease;
        }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border-highlight); border-radius: 10px; }

        .app-container { display: flex; min-height: 100vh; padding: 16px; gap: 20px; }

        /* ===== FLOATING GLASS SIDEBAR & TABS ===== */
        .sidebar {
            width: 275px;
            background: var(--bg-sidebar);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid var(--border);
            border-radius: 28px;
            display: flex;
            flex-direction: column;
            position: fixed;
            right: 16px;
            top: 16px;
            height: calc(100vh - 32px);
            z-index: 100;
            transition: var(--transition);
            overflow-y: auto;
            box-shadow: var(--shadow);
        }
        .sidebar.collapsed { width: 82px; }

        /* ===== ترويسة الشريط الجانبي (أسلوب ChatGPT / Claude) ===== */
        .sidebar-header {
            padding: 22px 18px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            position: relative;
        }
        .logo-icon {
            width: 44px; height: 44px;
            background: linear-gradient(135deg, var(--primary), var(--accent));
            border-radius: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
            color: white;
            flex-shrink: 0;
            box-shadow: 0 8px 20px rgba(14, 165, 233, 0.35);
            transform: rotate(-6deg);
            transition: var(--transition);
        }
        .sidebar:not(.collapsed):hover .logo-icon {
            transform: rotate(0deg) scale(1.05);
        }
        .logo-text {
            font-size: 1.55rem;
            font-weight: 900;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, var(--primary-light), var(--accent));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            transition: var(--transition);
        }

        .sidebar-toggle {
            margin-right: auto;
            width: 32px;
            height: 32px;
            background: var(--bg-hover);
            border: 1px solid var(--border);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: var(--primary-light);
            font-size: 0.85rem;
            flex-shrink: 0;
            transition: var(--transition);
        }
        .sidebar-toggle:hover {
            background: var(--primary);
            color: white;
            border-color: transparent;
            transform: scale(1.06);
        }

        .sidebar.collapsed .sidebar-header {
            justify-content: center;
            padding: 20px 10px 14px;
            gap: 0;
        }
        .sidebar.collapsed .sidebar-toggle,
        .sidebar.collapsed .logo-text,
        .sidebar.collapsed .nav-text,
        .sidebar.collapsed .section-title,
        .sidebar.collapsed .user-details,
        .sidebar.collapsed .sidebar-wa-btn {
            display: none !important;
        }

        .sidebar.collapsed .logo-icon {
            cursor: pointer;
            transform: rotate(0deg);
        }
        .sidebar.collapsed .logo-icon:hover {
            background: var(--primary);
            box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.25);
            transform: scale(1.08);
        }

        .sidebar-nav {
            flex: 1;
            padding: 8px 14px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .section-title {
            font-size: 0.72rem;
            font-weight: 800;
            color: var(--text-muted);
            padding: 6px 10px;
            margin: 10px 0 4px;
            display: flex;
            align-items: center;
            gap: 10px;
            letter-spacing: 0.5px;
        }
        .section-title::before {
            content: '';
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--primary-light);
            box-shadow: 0 0 8px var(--primary);
        }
        .section-title::after {
            content: '';
            flex: 1;
            height: 1px;
            background: linear-gradient(to left, var(--border), transparent);
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            border-radius: 16px;
            cursor: pointer;
            transition: var(--transition);
            color: var(--text-secondary);
            text-decoration: none;
            position: relative;
            font-size: 0.95rem;
            border: 1px solid transparent;
            background: transparent;
            overflow: visible;
        }
        .nav-item::before {
            content: '';
            position: absolute;
            right: -14px;
            top: 50%;
            transform: translateY(-50%) scaleY(0);
            width: 4px;
            height: 24px;
            border-radius: 4px 0 0 4px;
            background: linear-gradient(to bottom, var(--primary-light), var(--accent));
            box-shadow: 0 0 12px var(--primary);
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .nav-item i {
            width: 36px;
            height: 36px;
            border-radius: 11px;
            background: var(--bg-hover);
            border: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.98rem;
            flex-shrink: 0;
            transition: var(--transition);
        }
        .nav-item .nav-text {
            font-weight: 600;
            white-space: nowrap;
            transition: var(--transition);
        }
        .nav-item .badge {
            margin-right: auto;
            background: var(--bg-hover);
            border: 1px solid var(--border);
            color: var(--text-secondary);
            font-size: 0.72rem;
            padding: 3px 9px;
            border-radius: 10px;
            font-weight: 800;
            transition: var(--transition);
        }
        .nav-item:hover {
            background: rgba(14, 165, 233, 0.06);
            border-color: rgba(14, 165, 233, 0.18);
            color: var(--text-primary);
            transform: translateX(-3px);
        }
        .nav-item:hover i {
            border-color: var(--primary-light);
            transform: scale(1.06);
        }
        .nav-item.active {
            background: linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(20, 184, 166, 0.12));
            border-color: rgba(56, 189, 248, 0.35);
            color: var(--text-primary);
            box-shadow: 0 6px 20px rgba(14, 165, 233, 0.12);
        }
        .nav-item.active::before {
            transform: translateY(-50%) scaleY(1);
        }
        .nav-item.active i {
            background: linear-gradient(135deg, var(--primary), var(--accent));
            color: #ffffff !important;
            border-color: transparent;
            box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
        }
        .nav-item.active .nav-text {
            font-weight: 800;
            color: var(--primary-light);
        }
        .nav-item.active .badge {
            background: linear-gradient(135deg, var(--primary), var(--accent));
            color: #ffffff !important;
            border-color: transparent;
            box-shadow: 0 2px 8px rgba(14, 165, 233, 0.35);
        }

        .sidebar.collapsed .nav-item { justify-content: center; padding: 8px; }
        .sidebar.collapsed .nav-item::before { right: -14px; height: 20px; }
        .sidebar.collapsed .nav-item i { width: 40px; height: 40px; border-radius: 13px; }
        .sidebar.collapsed .badge {
            position: absolute; top: 2px; left: 4px; font-size: 0.6rem; padding: 1px 5px; border-radius: 8px;
        }

        /* ===== تذييل الشريط الجانبي وتوسيط البروفايل بدقة 100% ===== */
        .sidebar-footer { padding: 14px; }
        .user-info {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            border-radius: 16px;
            background: var(--bg-hover);
            border: 1px solid var(--border);
            cursor: pointer;
            transition: var(--transition);
        }
        .user-info:hover, .user-info.active-settings {
            border-color: var(--primary);
            background: rgba(14, 165, 233, 0.12);
        }
        .sidebar.collapsed .sidebar-footer {
            padding: 12px 10px;
            display: flex;
            justify-content: center;
        }
        .sidebar.collapsed .user-info {
            width: 52px;
            height: 52px;
            padding: 0;
            gap: 0;
            justify-content: center;
            align-items: center;
            border-radius: 16px;
        }
        .user-avatar {
            width: 38px; height: 38px;
            border-radius: 12px;
            background: linear-gradient(135deg, var(--primary), var(--accent));
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900; color: white;
            flex-shrink: 0;
            font-size: 1.05rem;
        }
        .user-details { flex: 1; overflow: hidden; }
        .user-name { font-weight: 800; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .user-role { font-size: 0.72rem; color: var(--primary-light); display: flex; align-items: center; gap: 4px; }
        .sidebar-wa-btn {
            width: 32px; height: 32px;
            border-radius: 10px;
            background: rgba(37, 211, 102, 0.15);
            color: var(--whatsapp);
            border: 1px solid rgba(37, 211, 102, 0.3);
            display: flex; align-items: center; justify-content: center;
            text-decoration: none;
            font-size: 1rem;
            flex-shrink: 0;
            transition: var(--transition);
        }
        .sidebar-wa-btn:hover { background: var(--whatsapp); color: white; transform: scale(1.08); }

        /* ===== MAIN CONTENT & NAVBAR ===== */
        .main-content {
            flex: 1;
            min-width: 0;
            max-width: 100%;
            margin-right: 295px;
            transition: var(--transition);
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        .sidebar.collapsed + .main-content { margin-right: 102px; }

        .navbar {
            height: 70px;
            background: var(--bg-card);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--border);
            border-radius: 22px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 24px;
            position: sticky;
            top: 16px;
            z-index: 50;
            box-shadow: var(--shadow);
            gap: 16px;
        }
        .navbar-left { display: flex; align-items: center; gap: 14px; }
        .page-title {
            font-size: 1.35rem;
            font-weight: 900;
            display: flex;
            align-items: center;
            gap: 10px;
            white-space: nowrap;
        }
        .page-title::before {
            content: '';
            width: 8px; height: 24px;
            border-radius: 6px;
            background: linear-gradient(to bottom, var(--primary), var(--accent));
        }

        .navbar-right { display: flex; align-items: center; gap: 12px; }

        .search-bar { position: relative; width: 320px; }
        .search-bar input {
            width: 100%;
            padding: 10px 18px 10px 42px;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: 50px;
            color: var(--text-primary);
            font-family: 'Tajawal', sans-serif;
            font-size: 0.92rem;
            transition: var(--transition);
        }
        .search-bar input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.15);
        }
        .search-bar i {
            position: absolute;
            left: 16px; top: 50%;
            transform: translateY(-50%);
            color: var(--primary-light);
        }

        .nav-btn {
            width: 42px; height: 42px;
            border-radius: 14px;
            background: var(--bg-hover);
            border: 1px solid var(--border);
            color: var(--text-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: var(--transition);
            flex-shrink: 0;
        }
        .nav-btn:hover {
            background: linear-gradient(135deg, var(--primary), var(--accent));
            color: white;
            border-color: transparent;
            transform: translateY(-2px);
            box-shadow: 0 6px 15px rgba(14, 165, 233, 0.35);
        }

        /* ===== CONTENT AREA ===== */
        .content-area {
            flex: 1;
            min-width: 0;
            width: 100%;
            padding: 4px 2px;
        }
        .view-section { display: none; animation: fadeIn 0.4s ease; }
        .view-section.active { display: block; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

        /* ===== PINNED FAVORITES STRIP ===== */
        .pinned-favorites-wrapper {
            background: linear-gradient(135deg, rgba(244, 63, 94, 0.08), rgba(14, 165, 233, 0.08));
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(244, 63, 94, 0.25);
            border-radius: 22px;
            padding: 16px 20px;
            margin-bottom: 20px;
            box-shadow: var(--shadow);
        }
        .pinned-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
        }
        .pinned-title {
            font-size: 0.92rem;
            font-weight: 800;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .pinned-title i {
            color: var(--secondary);
            animation: pulseHeart 2s infinite;
        }
        @keyframes pulseHeart {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.18); }
        }
        .pinned-strip {
            display: flex;
            align-items: center;
            gap: 12px;
            overflow-x: auto;
            padding-bottom: 6px;
            scroll-behavior: smooth;
        }
        .pinned-strip::-webkit-scrollbar { height: 4px; }
        .pinned-strip::-webkit-scrollbar-thumb { background: rgba(244, 63, 94, 0.4); border-radius: 10px; }

        .pinned-item {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 16px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            cursor: pointer;
            transition: var(--transition);
            min-width: 165px;
            max-width: 220px;
        }
        .pinned-item:hover {
            transform: translateY(-3px);
            border-color: var(--secondary);
            box-shadow: 0 8px 20px rgba(244, 63, 94, 0.2);
        }
        .pinned-favicon {
            width: 34px;
            height: 34px;
            border-radius: 10px;
            background: var(--bg-sidebar);
            border: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .pinned-favicon img { width: 20px; height: 20px; object-fit: contain; border-radius: 4px; }
        .pinned-favicon i { color: var(--secondary); font-size: 0.95rem; }
        .pinned-info { overflow: hidden; flex: 1; }
        .pinned-name {
            font-size: 0.88rem;
            font-weight: 800;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .pinned-meta {
            font-size: 0.7rem;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 4px;
        }

        /* ===== SECTION HEADER & SORT/FILTER CONTROLS ===== */
        .section-header {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 16px;
            background: var(--bg-card);
            backdrop-filter: blur(12px);
            padding: 16px 22px;
            border-radius: 20px;
            border: 1px solid var(--border);
            flex-wrap: wrap;
            gap: 12px;
        }
        .section-header h2 { font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 10px; }
        .section-header h2 i { color: var(--primary-light); font-size: 1.2rem; }

        .header-controls {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }

        .sort-switcher {
            display: inline-flex;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 4px;
            gap: 4px;
        }
        .sort-btn {
            padding: 7px 14px;
            border-radius: 10px;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            font-family: 'Tajawal', sans-serif;
            font-size: 0.84rem;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: var(--transition);
        }
        .sort-btn:hover { color: var(--text-primary); }
        .sort-btn.active {
            background: var(--bg-hover);
            color: var(--primary-light);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        .sort-btn.active.popular-sort { color: var(--warning); }

        .filter-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 22px;
            width: 100%;
            max-width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            padding-bottom: 8px;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
        }
        .filter-bar::-webkit-scrollbar { height: 5px; }
        .filter-bar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.03); border-radius: 10px; }
        .filter-bar::-webkit-scrollbar-thumb { background: var(--border-highlight); border-radius: 10px; }
        .filter-chip {
            flex-shrink: 0;
            padding: 8px 16px;
            border-radius: 50px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            color: var(--text-secondary);
            font-family: 'Tajawal', sans-serif;
            font-size: 0.86rem;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 7px;
            white-space: nowrap;
            transition: var(--transition);
        }
        .filter-chip:hover {
            border-color: var(--primary-light);
            color: var(--text-primary);
            transform: translateY(-2px);
        }
        .filter-chip.active {
            background: linear-gradient(135deg, var(--primary), var(--accent));
            color: #ffffff;
            border-color: transparent;
            box-shadow: 0 4px 14px rgba(14, 165, 233, 0.35);
        }
        .filter-chip .chip-count {
            background: rgba(255, 255, 255, 0.15);
            padding: 1px 7px;
            border-radius: 20px;
            font-size: 0.72rem;
        }

        .btn {
            padding: 10px 22px; border-radius: 14px; border: none;
            font-family: 'Tajawal', sans-serif; font-weight: 700; font-size: 0.92rem;
            cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
            transition: var(--transition);
        }
        .btn-primary {
            background: linear-gradient(135deg, var(--primary), var(--accent));
            color: white;
            box-shadow: 0 6px 18px rgba(14, 165, 233, 0.35);
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(14, 165, 233, 0.5); }
        .btn-secondary { background: var(--bg-hover); color: var(--text-primary); border: 1px solid var(--border); }
        .btn-secondary:hover { border-color: var(--primary); }
        .btn-danger { background: rgba(239, 68, 68, 0.15); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.3); }
        .btn-danger:hover { background: var(--danger); color: white; }

        /* ===== LINK CARDS ===== */
        .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
            gap: 20px;
        }
        .link-card {
            background: var(--bg-card);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
            transition: var(--transition);
            position: relative;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            box-shadow: var(--shadow);
        }
        .link-card:hover {
            transform: translateY(-6px);
            border-color: var(--border-highlight);
            box-shadow: var(--shadow-lg);
        }
        .card-banner {
            height: 68px;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            padding: 0 20px;
            overflow: visible;
            opacity: 0.92;
        }
        .card-banner::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(to bottom, transparent, var(--bg-card));
            opacity: 0.35;
        }
        .card-favicon {
            width: 54px; height: 54px;
            background: var(--bg-sidebar);
            border: 2px solid var(--border);
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
            position: relative;
            z-index: 2;
            transform: translateY(22px);
            transition: var(--transition);
        }
        .link-card:hover .card-favicon {
            transform: translateY(18px) scale(1.08);
            border-color: var(--primary-light);
        }
        .card-favicon img { width: 30px; height: 30px; object-fit: contain; border-radius: 6px; }
        .card-favicon i { font-size: 1.4rem; color: var(--primary-light); }

        .card-body {
            padding: 32px 20px 18px;
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        .card-badges-top {
            position: absolute;
            top: 20px;
            left: 18px;
            z-index: 2;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .card-category {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            background: rgba(15, 23, 42, 0.75) !important;
            backdrop-filter: blur(8px);
            color: #fff !important;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 50px;
            font-size: 0.74rem;
            font-weight: 700;
        }
        .card-clicks-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(8px);
            color: var(--warning);
            border: 1px solid rgba(245, 158, 11, 0.35);
            border-radius: 50px;
            font-size: 0.72rem;
            font-weight: 800;
        }
        .card-title {
            font-size: 1.12rem;
            font-weight: 800;
            margin-bottom: 6px;
            color: var(--text-primary);
            line-height: 1.4;
        }
        .card-url {
            font-size: 0.8rem;
            color: var(--primary-light);
            margin-bottom: 12px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            direction: ltr;
            justify-content: flex-end;
            background: rgba(14, 165, 233, 0.08);
            padding: 3px 10px;
            border-radius: 8px;
            align-self: flex-start;
        }
        .card-description {
            font-size: 0.88rem;
            color: var(--text-secondary);
            line-height: 1.6;
            margin-bottom: 16px;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            flex: 1;
        }
        .card-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-top: 14px;
            border-top: 1px dashed var(--border);
            margin-top: auto;
        }
        .card-date { font-size: 0.76rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
        .card-actions { display: flex; gap: 6px; }
        .card-action-btn {
            width: 34px; height: 34px;
            border-radius: 11px;
            border: 1px solid var(--border);
            background: var(--bg-hover);
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: var(--transition);
            font-size: 0.85rem;
        }
        .card-action-btn.edit,
        .card-action-btn.delete { opacity: 0.45; }
        .link-card:hover .card-action-btn.edit,
        .link-card:hover .card-action-btn.delete { opacity: 1; }
        .card-action-btn:hover { transform: scale(1.1); color: white !important; border-color: transparent; opacity: 1 !important; }
        .card-action-btn.fav:hover { background: var(--secondary); }
        .card-action-btn.copy:hover { background: var(--success); }
        .card-action-btn.edit:hover { background: var(--primary); }
        .card-action-btn.delete:hover { background: var(--danger); }

        /* ===== CATEGORIES ===== */
        .categories-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 18px; }
        .category-card {
            background: var(--bg-card);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 20px;
            cursor: pointer;
            transition: var(--transition);
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            box-shadow: var(--shadow);
        }
        .category-card:hover {
            transform: translateY(-5px);
            border-color: var(--primary);
            box-shadow: var(--shadow-lg);
        }
        .category-icon {
            width: 60px; height: 60px;
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.6rem;
            margin-bottom: 14px;
            transition: var(--transition);
        }
        .category-card:hover .category-icon { transform: scale(1.1) rotate(5deg); }
        .category-name { font-size: 1.1rem; font-weight: 800; margin-bottom: 4px; }
        .category-count {
            font-size: 0.82rem;
            color: var(--text-muted);
            background: var(--bg-hover);
            padding: 3px 12px;
            border-radius: 50px;
        }
        .category-actions {
            display: flex; gap: 8px; justify-content: center;
            margin-top: 14px; opacity: 0.5; transition: var(--transition);
        }
        .category-card:hover .category-actions { opacity: 1; }
        .cat-action-btn {
            width: 32px; height: 32px; border-radius: 10px;
            border: 1px solid var(--border); background: var(--bg-hover);
            color: var(--text-secondary); display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: var(--transition);
        }
        .cat-action-btn.edit:hover { background: var(--primary); color: white; border-color: transparent; }
        .cat-action-btn.delete:hover { background: var(--danger); color: white; border-color: transparent; }

        /* ===== ULTRA-COMPACT STATISTICS VIEW ===== */
        .stats-dashboard {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 18px;
            margin-bottom: 22px;
        }
        .stat-box {
            background: var(--bg-card);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 22px 20px;
            transition: var(--transition);
            display: flex;
            align-items: center;
            gap: 16px;
            box-shadow: var(--shadow);
        }
        .stat-box:hover { transform: translateY(-4px); border-color: var(--border-highlight); }
        .stat-box-icon {
            width: 52px; height: 52px; border-radius: 16px;
            display: flex; align-items: center; justify-content: center;
            font-size: 1.35rem; flex-shrink: 0;
        }
        .stat-box-info { overflow: hidden; }
        .stat-box-value {
            font-size: 1.85rem;
            font-weight: 900;
            line-height: 1.2;
        }
        .stat-box-label { font-size: 0.85rem; color: var(--text-muted); font-weight: 600; margin-top: 2px; }

        .charts-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
        }
        .chart-card {
            background: var(--bg-card);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 22px;
            box-shadow: var(--shadow);
        }
        .chart-card h3 { font-size: 1.02rem; font-weight: 800; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
        .chart-card h3 i { color: var(--primary-light); }
        .chart-container { position: relative; height: 270px; }

        /* ===== SETTINGS & DEVELOPER CARD ===== */
        .settings-section {
            background: var(--bg-card);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: var(--shadow);
        }
        .settings-section h3 { font-size: 1.05rem; font-weight: 800; margin-bottom: 18px; display: flex; align-items: center; gap: 10px; }
        .settings-section h3 i { color: var(--primary-light); }
        .setting-item { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--border); gap: 12px; flex-wrap: wrap; }
        .setting-item:last-child { border-bottom: none; }
        .setting-info h4 { font-size: 0.98rem; font-weight: 700; margin-bottom: 3px; }
        .setting-info p { font-size: 0.84rem; color: var(--text-muted); }

        .toggle { position: relative; width: 52px; height: 28px; }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; cursor: pointer; inset: 0; background: var(--bg-hover); border: 1px solid var(--border); border-radius: 50px; transition: var(--transition); }
        .toggle-slider::before {
            content: ''; position: absolute; height: 20px; width: 20px; right: 4px; bottom: 3px;
            background: white; border-radius: 50%; transition: var(--transition);
        }
        .toggle input:checked + .toggle-slider { background: linear-gradient(135deg, var(--primary), var(--accent)); border-color: transparent; }
        .toggle input:checked + .toggle-slider::before { transform: translateX(-23px); }

        .import-export-area {
            background: var(--input-bg);
            border: 2px dashed var(--border);
            border-radius: 18px;
            padding: 28px;
            text-align: center;
            cursor: pointer;
            transition: var(--transition);
        }
        .import-export-area:hover { border-color: var(--primary); background: rgba(14, 165, 233, 0.06); transform: translateY(-2px); }
        .import-export-area i { font-size: 2.3rem; color: var(--primary-light); margin-bottom: 10px; }
        .import-export-area h4 { font-size: 1rem; font-weight: 800; margin-bottom: 4px; }
        .import-export-area p { font-size: 0.84rem; color: var(--text-muted); }

        /* ===== DEVELOPER FOOTER & WHATSAPP LINK (ALWAYS AT BOTTOM) ===== */
        .app-footer {
            margin-top: auto;
            padding: 16px 22px;
            background: var(--bg-card);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid var(--border);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
            box-shadow: var(--shadow);
        }
        .footer-rights {
            font-size: 0.88rem;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .footer-rights strong {
            color: var(--primary-light);
            font-weight: 800;
        }
        .whatsapp-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 50px;
            background: rgba(37, 211, 102, 0.14);
            border: 1px solid rgba(37, 211, 102, 0.35);
            color: var(--whatsapp);
            text-decoration: none;
            font-size: 0.86rem;
            font-weight: 800;
            transition: var(--transition);
        }
        .whatsapp-pill:hover {
            background: var(--whatsapp);
            color: #ffffff;
            transform: translateY(-2px);
            box-shadow: 0 6px 18px rgba(37, 211, 102, 0.35);
        }
        .whatsapp-pill span { direction: ltr; }

        /* ===== MODALS & TOASTS ===== */
        .modal-overlay {
            display: none; position: fixed; inset: 0;
            background: rgba(2, 6, 23, 0.75);
            backdrop-filter: blur(12px);
            z-index: 1000; justify-content: center; align-items: center; padding: 20px;
        }
        .modal-overlay.active { display: flex; }
        .modal {
            background: var(--bg-sidebar);
            border: 1px solid var(--border-highlight);
            border-radius: 26px;
            width: 100%; max-width: 490px; max-height: 90vh; overflow-y: auto;
            box-shadow: var(--shadow-lg);
            animation: slideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .modal-header {
            padding: 22px 26px; border-bottom: 1px solid var(--border);
            display: flex; align-items: center; justify-content: space-between;
        }
        .modal-header h2 { font-size: 1.18rem; font-weight: 800; display: flex; align-items: center; gap: 10px; }
        .modal-header h2 i { color: var(--primary-light); }
        .modal-close {
            width: 36px; height: 36px; border-radius: 12px; background: var(--bg-hover);
            border: 1px solid var(--border); color: var(--text-secondary);
            display: flex; align-items: center; justify-content: center; cursor: pointer; transition: var(--transition);
        }
        .modal-close:hover { background: var(--danger); color: white; border-color: transparent; }
        .modal-body { padding: 24px 26px; }
        .form-group { margin-bottom: 18px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: 700; font-size: 0.88rem; color: var(--text-secondary); }
        .form-group input, .form-group textarea, .form-group select {
            width: 100%; padding: 12px 16px; background: var(--input-bg);
            border: 1px solid var(--border); border-radius: 14px;
            color: var(--text-primary); font-family: 'Tajawal', sans-serif; font-size: 0.95rem; transition: var(--transition);
        }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus {
            outline: none; border-color: var(--primary); box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.15);
        }
        .form-group textarea { resize: vertical; min-height: 90px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .modal-footer { padding: 18px 26px; border-top: 1px solid var(--border); display: flex; justify-content: flex-start; gap: 10px; }

        .color-options { display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
        .color-option { width: 32px; height: 32px; border-radius: 12px; cursor: pointer; border: 3px solid transparent; transition: var(--transition); }
        .color-option.selected { border-color: white; transform: scale(1.15); box-shadow: 0 0 0 2px var(--primary); }

        #confirmModal .modal { max-width: 420px; text-align: center; }
        #confirmModal .modal-body { padding: 30px 24px; font-size: 1.02rem; line-height: 1.6; }
        #confirmModal .modal-footer { justify-content: center; }

        .toast-container { position: fixed; bottom: 24px; left: 24px; z-index: 2000; display: flex; flex-direction: column; gap: 10px; }
        .toast {
            background: var(--bg-sidebar);
            backdrop-filter: blur(20px);
            border: 1px solid var(--border-highlight);
            border-radius: 16px;
            padding: 14px 18px;
            display: flex; align-items: center; gap: 12px;
            box-shadow: var(--shadow-lg);
            animation: toastIn 0.35s ease;
            min-width: 290px; max-width: 370px;
        }
        .toast.hiding { animation: toastOut 0.35s ease forwards; }
        @keyframes toastIn { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes toastOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-100%); opacity: 0; } }
        .toast-icon { width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; }
        .toast.success .toast-icon { background: rgba(16, 185, 129, 0.2); color: var(--success); }
        .toast.error .toast-icon { background: rgba(239, 68, 68, 0.2); color: var(--danger); }
        .toast.info .toast-icon { background: rgba(14, 165, 233, 0.2); color: var(--primary-light); }
        .toast-content { flex: 1; }
        .toast-title { font-weight: 800; font-size: 0.92rem; margin-bottom: 2px; }
        .toast-message { font-size: 0.84rem; color: var(--text-secondary); }
        .toast-close { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; }

        .empty-state {
            text-align: center; padding: 70px 20px; color: var(--text-muted); grid-column: 1 / -1;
            background: var(--bg-card); border: 1px dashed var(--border); border-radius: var(--radius);
        }
        .empty-state i { font-size: 4rem; margin-bottom: 16px; color: var(--primary-light); opacity: 0.6; }
        .empty-state h3 { font-size: 1.35rem; font-weight: 800; color: var(--text-primary); margin-bottom: 6px; }

        /* ===== GOOGLE AUTH & CLOUD SYNC STYLES ===== */
        .google-nav-btn {
            height: 42px;
            padding: 0 14px;
            border-radius: 14px;
            background: var(--bg-hover);
            border: 1px solid var(--border);
            color: var(--text-primary);
            font-family: 'Tajawal', sans-serif;
            font-size: 0.86rem;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            transition: var(--transition);
            flex-shrink: 0;
        }
        .google-nav-btn:hover {
            border-color: var(--primary-light);
            background: rgba(14, 165, 233, 0.12);
            transform: translateY(-2px);
        }
        .google-nav-btn.connected {
            border-color: rgba(16, 185, 129, 0.4);
            background: rgba(16, 185, 129, 0.12);
            color: var(--success);
        }
        .google-nav-btn img {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            object-fit: cover;
        }

        .btn-google {
            background: #ffffff;
            color: #0f172a;
            border: 1px solid var(--border);
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
        }
        .btn-google:hover {
            background: #f8fafc;
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(14, 165, 233, 0.25);
        }
        .btn-google i {
            color: #ea4335;
        }

        .google-profile-card {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 16px;
            background: var(--input-bg);
            border: 1px solid var(--border-highlight);
            border-radius: 18px;
            margin-bottom: 12px;
        }
        .google-profile-card img {
            width: 54px;
            height: 54px;
            border-radius: 16px;
            object-fit: cover;
            border: 2px solid var(--primary-light);
        }
        .google-profile-info h4 {
            font-size: 1.05rem;
            font-weight: 800;
            margin-bottom: 2px;
        }
        .google-profile-info p {
            font-size: 0.84rem;
            color: var(--text-muted);
            margin-bottom: 6px;
            direction: ltr;
            text-align: right;
        }
        .sync-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 0.76rem;
            font-weight: 700;
            padding: 3px 10px;
            border-radius: 50px;
            background: rgba(16, 185, 129, 0.15);
            color: var(--success);
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 1024px) {
            .charts-grid { grid-template-columns: 1fr; }
            .search-bar { width: 240px; }
        }
        @media (max-width: 768px) {
            .app-container { padding: 10px; }
            .sidebar { right: 0; top: 0; height: 100vh; width: 100%; border-radius: 0; transform: translateX(100%); }
            .sidebar.active { transform: translateX(0); }
            .main-content { margin-right: 0; }
            .sidebar.collapsed + .main-content { margin-right: 0; }
            .stats-dashboard { grid-template-columns: 1fr; }
            .search-bar { width: 180px; }
            .cards-grid { grid-template-columns: 1fr; }
            .form-row { grid-template-columns: 1fr; }
            .app-footer { justify-content: center; text-align: center; }
            .google-nav-btn span { display: none; }
            .google-nav-btn { padding: 0 12px; }
        }
        .mobile-menu-btn {
            display: none; width: 40px; height: 40px; border-radius: 12px;
            background: var(--bg-hover); border: 1px solid var(--border); color: var(--text-primary);
            align-items: center; justify-content: center; cursor: pointer;
        }
        @media (max-width: 768px) { .mobile-menu-btn { display: flex; } }
