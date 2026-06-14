(function ($) {
  "use strict";

  var STORAGE_KEY = "jaskan_mode";
  var ROUTES_STORAGE_KEY = "jaskan_routes";
  var ORDERS_STORAGE_KEY = "jaskan_orders";
  var MESSAGES_STORAGE_KEY = "jaskan_messages";
  var ACCOUNTS_STORAGE_KEY = "jaskan_accounts";
  var SESSION_STORAGE_KEY = "jaskan_session";
  var INDONESIA_TIME_ZONE = "Asia/Makassar";
  var INDONESIA_TIME_LABEL = "WITA";
  var currentMode = getStoredMode();
  var root = document.body.dataset.root || "";
  var currentSection = "home";
  var selectedRouteId = "";
  var selectedChatOrderId = "";
  var pendingPaymentProof = null;
  var lastProfileTap = 0;
  var suppressProfileClickUntil = 0;
  var pageAlertTimer = null;
  var verificationTimers = {};
  var PROFILE_STORAGE_PREFIX = "jaskan_profile_";
  var VERIFICATION_STORAGE_PREFIX = "jaskan_verification_";
  var PAYMENT_DESTINATIONS = {
    "QRIS": {
      type: "QRIS",
      label: "QRIS JasKan"
    },
    "E-Wallet / DANA": {
      type: "DANA",
      name: "JasKan Payment",
      number: "0812-3456-7890",
      accountName: "JasKan Demo"
    },
    "Transfer Bank": {
      type: "Bank",
      bank: "BCA",
      number: "1234567890",
      accountName: "JasKan Demo"
    },
    "Bayar di Tempat / Tunai": {
      type: "Tunai",
      note: "Pembayaran dilakukan saat barang diterima."
    }
  };

  var profileDefaults = {
    pemesan: {
      name: "User123",
      phone: "0812-3456-xxxx",
      address: "Jl. Brigjen H. Hasan Basri, Banjarmasin",
      status: "Belum Diverifikasi",
      totalLabel: "Total Titipan",
      totalValue: "12",
      reputationLabel: "Poin",
      reputationValue: "150",
      notifications: {
        orders: true,
        messages: true,
        delivery: true
      }
    },
    penyedia: {
      name: "User123",
      phone: "0812-3456-xxxx",
      primaryRoute: "Kampus ULM → Gambut / Banjarbaru sesuai rute aktif",
      status: "Belum Diverifikasi",
      totalLabel: "Total Pesanan Diterima",
      totalValue: "28",
      reputationLabel: "Rating",
      reputationValue: "4.8",
      notifications: {
        orders: true,
        messages: true,
        delivery: true
      }
    }
  };

  var defaultRoutes = [
    { id: "route-budi", providerName: "Budi", image: "Budi.png", start: "Hasan Basri", destination: "Gambut", departure: "15.30", cutoff: "15.00", notes: "Bisa menerima dokumen, makanan, dan paket ringan.", rating: "4.8" },
    { id: "route-siti", providerName: "Siti", image: "Siti.png", start: "Sungai Andai", destination: "Banjarbaru", departure: "16.00", cutoff: "15.20", notes: "Titik temu dapat disesuaikan di sekitar kampus.", rating: "4.9" },
    { id: "route-irfan", providerName: "Irfan", image: "Irfan.png", start: "Kayu Tangi", destination: "Kampus ULM", departure: "13.00", cutoff: "12.30", notes: "Cocok untuk keperluan kampus dan alat tulis.", rating: "4.7" }
  ];

  var defaultOrders = [
    { id: "order-adit", requesterName: "Adit", image: "Adit.png", itemName: "Ambil Sertifikat", maxPrice: 15000, address: "Fakultas Teknik, Gedung B", notes: "Mohon dibawa dalam map agar tidak terlipat.", routeId: "route-irfan", routeLabel: "Kayu Tangi → Kampus ULM", status: "Menunggu konfirmasi", paymentMethod: "Transfer Bank", paymentDestination: PAYMENT_DESTINATIONS["Transfer Bank"], paymentStatus: "Menunggu Pembayaran", createdAt: "2026-06-10T08:00:00.000Z" },
    { id: "order-irfan", requesterName: "Irfan", image: "Irfan.png", itemName: "Kopi dan Snack", maxPrice: 25000, address: "Gerbang utama Kampus ULM", notes: "Kopi tanpa gula dan satu roti.", routeId: "route-budi", routeLabel: "Hasan Basri → Gambut", status: "Diterima", paymentMethod: "Bayar di Tempat / Tunai", paymentDestination: PAYMENT_DESTINATIONS["Bayar di Tempat / Tunai"], paymentStatus: "Bayar di Tempat", createdAt: "2026-06-11T09:30:00.000Z" }
  ];

  function getStoredMode() {
    var savedMode = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("jaskan-current-mode");
    return savedMode === "penyedia" ? "penyedia" : "pemesan";
  }

  function getCurrentMode() {
    return currentMode;
  }

  function setMode(mode) {
    if (mode !== "pemesan" && mode !== "penyedia") {
      return;
    }
    localStorage.setItem(STORAGE_KEY, mode);
    localStorage.removeItem("jaskan-current-mode");
  }

  function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function loadCollection(key, defaults) {
    try {
      var saved = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(saved)) {
        return saved;
      }
    } catch (error) {
      localStorage.removeItem(key);
    }
    var initialData = cloneData(defaults);
    localStorage.setItem(key, JSON.stringify(initialData));
    return initialData;
  }

  function loadRoutes() {
    var routes = loadCollection(ROUTES_STORAGE_KEY, defaultRoutes);
    var changed = false;
    routes.forEach(function (route) {
      var departure = normalizeRouteTime(route.departure);
      var cutoff = normalizeRouteTime(route.cutoff);
      if (departure && route.departure !== departure) {
        route.departure = departure;
        changed = true;
      }
      if (cutoff && route.cutoff !== cutoff) {
        route.cutoff = cutoff;
        changed = true;
      }
    });
    if (changed) {
      saveRoutes(routes);
    }
    return routes;
  }

  function saveRoutes(routes) {
    localStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(routes));
  }

  function loadOrders() {
    return loadCollection(ORDERS_STORAGE_KEY, defaultOrders);
  }

  function saveOrders(orders) {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  }

  function loadMessages() {
    return loadCollection(MESSAGES_STORAGE_KEY, []);
  }

  function saveMessages(messages) {
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
  }

  function loadAccounts() {
    return loadCollection(ACCOUNTS_STORAGE_KEY, []);
  }

  function saveAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)) || null;
    } catch (error) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  }

  function getCurrentAccount() {
    var session = getSession();
    if (!session) {
      return null;
    }
    return loadAccounts().find(function (account) {
      return account.id === session.accountId;
    }) || null;
  }

  function setSession(account) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      accountId: account.id,
      loginAt: new Date().toISOString()
    }));
  }

  function renderAuth(activeTab, message, type) {
    var tab = activeTab === "register" ? "register" : "login";
    document.body.classList.add("auth-state");
    $(".app-navbar").addClass("d-none");
    document.title = (tab === "login" ? "Masuk" : "Daftar") + " - JasKan";
    var alert = message
      ? '<div class="alert alert-' + (type || "success") + ' py-2 px-3 small" role="alert">' + escapeHtml(message) + "</div>"
      : "";
    var loginForm = '<form id="login-form" class="auth-form" novalidate><div class="mb-3"><label for="login-phone" class="form-label fw-bold">Nomor HP</label>' +
      '<input id="login-phone" class="form-control" type="tel" placeholder="Contoh: 081234567890"></div>' +
      '<div class="mb-4"><label for="login-password" class="form-label fw-bold">Password</label><input id="login-password" class="form-control" type="password" placeholder="Masukkan password"></div>' +
      '<button class="btn btn-theme btn-lg w-100" type="submit">Masuk ke JasKan</button></form>';
    var registerForm = '<form id="register-form" class="auth-form" novalidate><div class="mb-3"><label for="register-name" class="form-label fw-bold">Nama lengkap</label>' +
      '<input id="register-name" class="form-control" placeholder="Nama yang tampil di profil"></div>' +
      '<div class="mb-3"><label for="register-phone" class="form-label fw-bold">Nomor HP</label><input id="register-phone" class="form-control" type="tel" placeholder="Contoh: 081234567890"></div>' +
      '<div class="mb-3"><label for="register-password" class="form-label fw-bold">Password</label><input id="register-password" class="form-control" type="password" minlength="4" placeholder="Minimal 4 karakter"></div>' +
      '<div class="mb-4"><label for="register-role" class="form-label fw-bold">Mulai sebagai</label><select id="register-role" class="form-select"><option value="pemesan">Pemesan</option><option value="penyedia">Penyedia</option></select></div>' +
      '<button class="btn btn-theme btn-lg w-100" type="submit">Buat Akun</button></form>';

    $("#app").html('<section class="auth-shell"><div class="auth-card"><div class="auth-brand"><img src="' + root + 'Asset/logobiru.png" alt="Logo JasKan">' +
      '<div><strong>JasKan</strong><span>Jasa Titip Berbasis Rute</span></div></div><div class="auth-intro"><span class="section-eyebrow">Selamat datang</span>' +
      '<h1>Perjalanan searah, titipan lebih mudah.</h1><p>Kelola rute, pesanan, dan koordinasi dalam satu aplikasi.</p></div>' +
      '<div class="auth-panel"><div class="auth-tabs" role="tablist"><button class="auth-tab ' + (tab === "login" ? "active" : "") + '" data-auth-tab="login">Masuk</button>' +
      '<button class="auth-tab ' + (tab === "register" ? "active" : "") + '" data-auth-tab="register">Daftar</button></div><div id="auth-alert">' + alert + "</div>" +
      (tab === "login" ? loginForm : registerForm) + '<p class="auth-note mb-0"><i class="bi bi-shield-check"></i> Akun tetap tersedia pada perangkat ini.</p></div></div></section>');
    bindAuthEvents();
  }

  function bindAuthEvents() {
    $("[data-auth-tab]").on("click", function () {
      renderAuth($(this).data("auth-tab"));
    });

    $("#register-form").on("submit", function (event) {
      event.preventDefault();
      var name = $("#register-name").val().trim();
      var phone = normalizePhone($("#register-phone").val());
      var password = $("#register-password").val();
      var initialMode = $("#register-role").val();
      if (!name || !phone || password.length < 4) {
        renderAuth("register", "Lengkapi nama, nomor HP, dan password minimal 4 karakter.", "warning");
        return;
      }
      var accounts = loadAccounts();
      if (accounts.some(function (account) { return account.phone === phone; })) {
        renderAuth("login", "Nomor HP sudah terdaftar. Silakan masuk.", "warning");
        return;
      }
      var account = {
        id: "account-" + Date.now(),
        name: name,
        phone: phone,
        password: password,
        initialMode: initialMode,
        createdAt: new Date().toISOString()
      };
      accounts.push(account);
      saveAccounts(accounts);
      setSession(account);
      currentMode = initialMode;
      setMode(currentMode);
      syncAccountProfiles(account);
      finishAuthentication("Akun berhasil dibuat. Selamat datang, " + name + ".");
    });

    $("#login-form").on("submit", function (event) {
      event.preventDefault();
      var phone = normalizePhone($("#login-phone").val());
      var password = $("#login-password").val();
      var account = loadAccounts().find(function (item) {
        return item.phone === phone && item.password === password;
      });
      if (!account) {
        renderAuth("login", "Nomor HP atau password belum sesuai.", "danger");
        return;
      }
      setSession(account);
      currentMode = account.initialMode === "penyedia" ? "penyedia" : "pemesan";
      setMode(currentMode);
      syncAccountProfiles(account);
      finishAuthentication("Berhasil masuk. Selamat datang kembali, " + account.name + ".");
    });
  }

  function finishAuthentication(message) {
    document.body.classList.remove("auth-state");
    $(".app-navbar").removeClass("d-none");
    renderMode();
    navigateToSection("home");
    showPageAlert(message);
  }

  function logout() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    selectedRouteId = "";
    selectedChatOrderId = "";
    renderAuth("login", "Kamu telah keluar dari akun.", "success");
  }

  function normalizePhone(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function syncAccountProfiles(account) {
    ["pemesan", "penyedia"].forEach(function (mode) {
      var key = PROFILE_STORAGE_PREFIX + mode;
      var saved = {};
      try {
        saved = JSON.parse(localStorage.getItem(key)) || {};
      } catch (error) {
        saved = {};
      }
      saved.name = account.name;
      saved.phone = account.phone;
      if (!saved.status) {
        saved.status = "Belum Diverifikasi";
      }
      localStorage.setItem(key, JSON.stringify(saved));
    });
  }

  function toggleMode() {
    currentMode = currentMode === "pemesan" ? "penyedia" : "pemesan";
    setMode(currentMode);
    renderMode();
    renderSection(currentSection);
    showPageAlert(
      currentMode === "pemesan"
        ? "Berhasil berpindah ke Mode Pemesan"
        : "Berhasil berpindah ke Mode Penyedia"
    );
  }

  function renderMode() {
    document.body.classList.remove("mode-pemesan", "mode-penyedia");
    document.body.classList.add("mode-" + currentMode);
    document.body.dataset.mode = currentMode;
    setMode(currentMode);
    $("[data-mode-label]").text(currentMode === "pemesan" ? "Mode Pemesan" : "Mode Penyedia");
    $("[data-form-label]").text(currentMode === "pemesan" ? "Titip Barang" : "Buka Rute");
    $("[data-logo]")
      .attr("src", root + "Asset/" + (currentMode === "pemesan" ? "logobiru.png" : "logohijau.png"))
      .attr("alt", "Logo JasKan " + (currentMode === "pemesan" ? "Pemesan" : "Penyedia"));
  }

  function renderSection(section) {
    var allowedSections = ["home", "activity", "inbox", "form", "profile"];
    currentSection = allowedSections.indexOf(section) === -1 ? "home" : section;
    $("#app").html(getSectionContent(currentSection));
    $("[data-section]").removeClass("active").removeAttr("aria-current");
    $("[data-section='" + currentSection + "']").addClass("active").attr("aria-current", "page");
    document.title = getSectionTitle(currentSection);
    bindSectionEvents();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function getSectionContent(section) {
    var sections = {
      home: renderHome,
      activity: renderActivity,
      inbox: renderInbox,
      form: renderForm,
      profile: renderProfile
    };
    var content = sections[section]();
    var alertHost = '<div id="page-alert-container" class="page-alert" aria-live="polite"></div>';
    content = content.replace("</section>", "</section>" + alertHost);
    return '<div class="app-section">' + content + "</div>" + renderPaymentProofModal();
  }

  function getSectionTitle(section) {
    var titles = {
      home: "Beranda",
      activity: "Aktivitas",
      inbox: "Pesan",
      form: currentMode === "pemesan" ? "Titip Barang" : "Buka Rute",
      profile: "Profil"
    };
    return titles[section] + " - JasKan " + (currentMode === "pemesan" ? "Pemesan" : "Penyedia");
  }

  function renderHome() {
    var routes = loadRoutes();
    var orders = loadOrders();
    if (currentMode === "pemesan") {
      return '<section class="home-hero"><div class="row align-items-center g-4 g-xl-5"><div class="col-lg-7">' +
        '<span class="hero-kicker"><i class="bi bi-compass"></i> Jasa titip berdasarkan rute perjalanan</span>' +
        '<h1>Titip Barang Lebih Mudah di Sekitar Kamu</h1>' +
        '<p class="hero-lead">Temukan penyedia yang sedang menuju lokasi tujuanmu, kirim detail titipan, dan koordinasikan pengantaran dalam satu tempat.</p>' +
        '<div class="hero-actions"><button class="btn btn-hero btn-lg section-link" data-target="home" data-focus-search="true">Cari Rute Titipan <i class="bi bi-arrow-right"></i></button>' +
        '<button class="btn btn-hero-ghost btn-lg section-link" data-target="activity">Lihat Aktivitas</button></div>' +
        '<div class="hero-trust"><span><i class="bi bi-check-circle-fill"></i> Rute aktif</span><span><i class="bi bi-check-circle-fill"></i> Koordinasi mudah</span><span><i class="bi bi-check-circle-fill"></i> Kebutuhan harian</span></div></div>' +
        '<div class="col-lg-5"><div class="hero-route-preview"><div class="hero-preview-top"><span class="hero-preview-icon"><i class="bi bi-geo-alt-fill"></i></span><div><small>Rute tersedia</small><strong>' + routes.length + ' perjalanan aktif</strong></div><span class="live-dot">Aktif</span></div>' +
        '<div class="hero-route-line"><span><small>Titik awal</small><strong>Lokasi terdekat</strong></span><i class="bi bi-arrow-right"></i><span><small>Tujuan</small><strong>Sesuai kebutuhanmu</strong></span></div>' +
        '<div class="hero-preview-note"><i class="bi bi-chat-dots"></i><span><strong>Koordinasi langsung</strong><small>Atur detail barang dan titik temu dengan jelas.</small></span></div></div></div></div></section>' +
        '<section class="home-highlights"><div class="row g-3"><div class="col-md-4"><div class="highlight-item"><i class="bi bi-signpost-split"></i><div><strong>Pilih rute searah</strong><span>Cari perjalanan yang paling sesuai.</span></div></div></div>' +
        '<div class="col-md-4"><div class="highlight-item"><i class="bi bi-bag-check"></i><div><strong>Kirim detail titipan</strong><span>Barang dan anggaran tercatat rapi.</span></div></div></div>' +
        '<div class="col-md-4"><div class="highlight-item"><i class="bi bi-chat-heart"></i><div><strong>Koordinasi mudah</strong><span>Pantau status dan titik temu.</span></div></div></div></div></section>' +
        '<section class="card app-card search-card mb-5"><div class="card-body p-3 p-md-4">' +
        '<label for="route-search" class="form-label fw-bold">Cari rute tujuan</label><div class="input-group">' +
        '<input id="route-search" class="form-control" type="search" placeholder="Contoh: Gambut atau Banjarbaru">' +
        '<button class="btn btn-theme px-4" id="search-route" type="button"><i class="bi bi-search me-1"></i> Cari</button></div></div></section>' +
        '<div class="section-heading-row"><div><span class="section-eyebrow">Pilihan perjalanan</span><h2>Rute Aktif</h2>' +
        '<p>Penyedia yang siap menerima titipan di sepanjang perjalanannya.</p></div><span class="count-badge">' + routes.length + ' rute tersedia</span></div>' +
        '<section id="route-list" class="row g-4">' + (routes.length ? routes.map(renderRouteCard).join("") : renderEmptyState("Belum ada rute aktif yang dapat dipilih.")) + "</section>";
    }

    var pendingOrders = orders.filter(function (order) {
      return order.status === "Menunggu konfirmasi";
    });
    return '<section class="home-hero"><div class="row align-items-center g-4 g-xl-5"><div class="col-lg-7">' +
      '<span class="hero-kicker"><i class="bi bi-signpost-2"></i> Bagikan perjalanan, bantu kebutuhan sekitar</span>' +
      '<h1>Buka Rute dan Terima Titipan</h1>' +
      '<p class="hero-lead">Publikasikan perjalananmu, pilih pesanan yang sesuai, lalu kelola proses titipan hingga selesai dengan lebih teratur.</p>' +
      '<div class="hero-actions"><button class="btn btn-hero btn-lg section-link" data-target="form">Buka Rute Baru <i class="bi bi-arrow-right"></i></button>' +
      '<button class="btn btn-hero-ghost btn-lg section-link" data-target="activity">Lihat Aktivitas</button></div>' +
      '<div class="hero-trust"><span><i class="bi bi-check-circle-fill"></i> Atur cut-off</span><span><i class="bi bi-check-circle-fill"></i> Kelola pesanan</span><span><i class="bi bi-check-circle-fill"></i> Pantau pengantaran</span></div></div>' +
      '<div class="col-lg-5"><div class="hero-route-preview"><div class="hero-preview-top"><span class="hero-preview-icon"><i class="bi bi-inboxes-fill"></i></span><div><small>Pesanan baru</small><strong>' + pendingOrders.length + ' menunggu konfirmasi</strong></div><span class="live-dot">Aktif</span></div>' +
      '<div class="hero-route-line"><span><small>Rute aktif</small><strong>' + routes.length + ' perjalanan</strong></span><i class="bi bi-arrow-right"></i><span><small>Pengantaran aktif</small><strong>' + orders.filter(function (order) { return order.status === "Diterima" || order.status === "Dalam proses"; }).length + ' pesanan</strong></span></div>' +
      '<div class="hero-preview-note"><i class="bi bi-shield-check"></i><span><strong>Kontrol tetap di tanganmu</strong><small>Terima titipan yang cocok dengan rute dan kapasitas.</small></span></div></div></div></div></section>' +
      '<section class="home-highlights"><div class="row g-3"><div class="col-md-4"><div class="highlight-item"><i class="bi bi-map"></i><div><strong>Publikasikan rute</strong><span>Tentukan tujuan dan waktu perjalanan.</span></div></div></div>' +
      '<div class="col-md-4"><div class="highlight-item"><i class="bi bi-ui-checks-grid"></i><div><strong>Pilih pesanan</strong><span>Terima titipan yang paling sesuai.</span></div></div></div>' +
      '<div class="col-md-4"><div class="highlight-item"><i class="bi bi-check2-circle"></i><div><strong>Selesaikan pengantaran</strong><span>Perbarui status secara langsung.</span></div></div></div></div></section>' +
      '<div class="section-heading-row"><div><span class="section-eyebrow">Perjalanan tersedia</span><h2>Rute Aktif</h2>' +
      '<p>Rute yang sedang tersedia dan dapat dipilih oleh pemesan.</p></div><span class="count-badge">' + routes.length + ' rute aktif</span></div>' +
      '<section class="row g-4 mb-5">' + (routes.length ? routes.map(renderProviderRouteSummary).join("") : renderEmptyState("Belum ada rute aktif. Publikasikan rute pertama melalui form Buka Rute.")) + "</section>" +
      '<div class="section-heading-row"><div><span class="section-eyebrow">Perlu tindakan</span><h2>Pesanan Masuk</h2>' +
      '<p>Pilih pesanan yang sesuai dengan rute dan kapasitasmu.</p></div><span class="count-badge">' + pendingOrders.length + ' menunggu</span></div>' +
      '<section id="provider-orders" class="row g-4">' + (pendingOrders.length ? pendingOrders.map(renderProviderOrder).join("") : renderEmptyState("Tidak ada pesanan yang menunggu konfirmasi.")) + "</section>";
  }

  function renderRouteCard(route) {
    var providerImage = route.image || "Penyedia.png";
    var searchText = [route.providerName, route.start, route.destination, route.notes].join(" ").toLowerCase();
    return '<div class="col-12 col-md-6 col-xl-4 route-item" data-search="' + escapeHtml(searchText) + '">' +
      '<article class="card app-card route-card"><div class="card-body p-4 d-flex flex-column">' +
      '<div class="d-flex gap-3 mb-3"><img class="route-avatar" src="' + root + 'Asset/' + providerImage + '" alt="Foto ' + escapeHtml(route.providerName) + '">' +
      '<div><div class="d-flex align-items-center gap-2"><h3 class="h5 fw-bold mb-0">' + escapeHtml(route.providerName) + '</h3><span class="badge mode-badge">' + escapeHtml(route.rating || "4.8") + '</span></div>' +
      '<p class="small text-muted-app mb-0">' + escapeHtml(route.verificationStatus || "Penyedia Terverifikasi") + '</p></div></div>' +
      '<div class="route-path mb-3"><span>' + escapeHtml(route.start) + '</span><strong>→</strong><span>' + escapeHtml(route.destination) + '</span></div>' +
      '<div class="row g-2 small mb-3"><div class="col-6"><div class="soft-panel p-2 h-100"><span class="d-block text-muted-app">Berangkat</span><strong>' + escapeHtml(formatRouteTime(route.departure)) + '</strong></div></div>' +
      '<div class="col-6"><div class="soft-panel p-2 h-100"><span class="d-block text-muted-app">Batas titip</span><strong>' + escapeHtml(formatRouteTime(route.cutoff)) + '</strong></div></div></div>' +
      '<p class="text-muted-app small flex-grow-1 mb-3">' + escapeHtml(route.notes) + '</p>' +
      '<button class="btn btn-theme w-100 choose-route" data-route-id="' + escapeHtml(route.id) + '">Titip Sekarang <i class="bi bi-arrow-right ms-1"></i></button></div></article></div>';
  }

  function renderProviderRouteSummary(route) {
    return '<div class="col-12 col-md-6 col-xl-4"><article class="card app-card route-summary-card"><div class="card-body p-4">' +
      '<span class="badge mode-badge mb-2">Berangkat ' + escapeHtml(formatRouteTime(route.departure)) + '</span><h3 class="h5 fw-bold">' +
      escapeHtml(route.start) + ' → ' + escapeHtml(route.destination) + '</h3><p class="small text-muted-app mb-2">Batas titip ' +
      escapeHtml(formatRouteTime(route.cutoff)) + '</p><p class="small mb-0">' + escapeHtml(route.notes) + '</p></div></article></div>';
  }

  function renderProviderOrder(order) {
    var actions = "";
    if (order.status === "Menunggu konfirmasi") {
      actions = '<div class="d-grid d-sm-flex gap-2"><button class="btn btn-theme flex-fill order-action" data-action="accept" data-order="' + escapeHtml(order.id) + '">Terima</button>' +
        '<button class="btn btn-outline-danger flex-fill order-action" data-action="reject" data-order="' + escapeHtml(order.id) + '">Tolak</button></div>';
    } else if (order.status === "Diterima" || order.status === "Dalam proses") {
      actions = '<button class="btn btn-theme w-100 order-action" data-action="complete" data-order="' + escapeHtml(order.id) + '">Konfirmasi Selesai</button>';
    }
    return '<div class="col-12 col-lg-6" id="' + escapeHtml(order.id) + '"><article class="card app-card order-card status-strip"><div class="card-body p-4">' +
      '<div class="d-flex gap-3 align-items-center mb-3"><img class="chat-avatar" src="' + root + 'Asset/' + escapeHtml(order.image || "Pengguna.png") + '" alt="Foto ' + escapeHtml(order.requesterName) + '">' +
      '<div class="flex-grow-1"><h3 class="h5 fw-bold mb-0">' + escapeHtml(order.requesterName) + '</h3><span class="text-muted-app small d-block">' + escapeHtml(order.address) + '</span>' +
      renderOrderTimestamp(order) + '</div>' +
      '<span class="badge ' + getStatusBadgeClass(order.status) + '">' + escapeHtml(order.status) + '</span></div>' +
      '<div class="soft-panel p-3 mb-3"><div class="d-flex justify-content-between gap-3"><p class="fw-bold mb-1">' + escapeHtml(order.itemName) + '</p><strong class="text-theme">' + formatCurrency(order.maxPrice) + '</strong></div>' +
      '<p class="small mb-1">' + escapeHtml(order.routeLabel) + '</p><p class="small text-muted-app mb-0">' + escapeHtml(order.notes || "Tidak ada catatan tambahan.") + '</p></div>' +
      renderPaymentSummary(order) + actions + '</div></article></div>';
  }

  function renderActivity() {
    var orders = loadOrders();
    if (currentMode === "pemesan") {
      var requesterOrders = orders.filter(isCurrentRequesterOrder);
      return '<section class="page-heading"><span class="badge mode-badge mb-2">Riwayat titipan</span><h1 class="display-6 fw-bold">Aktivitas Pemesan</h1>' +
        '<p class="lead mb-0">Pantau titipan yang sedang berjalan dan pesanan sebelumnya.</p></section>' +
        '<section class="row g-4">' + (requesterOrders.length ? requesterOrders.map(renderRequesterActivityCard).join("") : renderEmptyState("Belum ada titipan. Pilih rute aktif untuk membuat pesanan pertama.")) + "</section>";
    }

    var providerTasks = orders.filter(function (order) {
      return order.status === "Diterima" || order.status === "Dalam proses" || order.status === "Selesai";
    });
    return '<section class="page-heading"><span class="badge mode-badge mb-2">Pengantaran aktif</span><h1 class="display-6 fw-bold">Aktivitas Penyedia</h1>' +
      '<p class="lead mb-0">Pantau pesanan aktif dan selesaikan pengantaran sesuai rute.</p></section>' +
      '<section class="row g-4">' + (providerTasks.length ? providerTasks.map(renderProviderActivityCard).join("") : renderEmptyState("Belum ada pengantaran aktif. Terima pesanan dari halaman Beranda.")) + "</section>";
  }

  function renderRequesterActivityCard(order) {
    return '<div class="col-12 col-lg-6"><article class="card app-card activity-card status-strip"><div class="card-body p-4">' +
      '<div class="d-flex flex-wrap justify-content-between gap-2 mb-3"><div><span class="badge ' + getStatusBadgeClass(order.status) + ' mb-2">' + escapeHtml(order.status) + '</span>' +
      '<h2 class="h5 fw-bold mb-1">' + escapeHtml(order.itemName) + '</h2>' + renderOrderTimestamp(order) + '</div><strong class="text-theme">' + formatCurrency(order.maxPrice) + '</strong></div>' +
      '<div class="soft-panel p-3"><p class="small fw-bold mb-1">' + escapeHtml(order.routeLabel) + '</p><p class="small mb-1">' + escapeHtml(order.address) + '</p>' +
      '<p class="small text-muted-app mb-0">' + escapeHtml(order.notes || "Tidak ada catatan tambahan.") + '</p></div>' +
      renderPaymentSummary(order) + renderPaymentProofForm(order) + renderReviewSection(order) + '</div></article></div>';
  }

  function renderProviderActivityCard(order) {
    var actions = "";
    if (order.status === "Diterima") {
      actions = '<div class="d-grid d-sm-flex gap-2 mt-3"><button class="btn btn-outline-theme flex-fill order-action" data-action="process" data-order="' + escapeHtml(order.id) + '">Mulai Proses</button>' +
        '<button class="btn btn-theme flex-fill order-action" data-action="complete" data-order="' + escapeHtml(order.id) + '">Konfirmasi Selesai</button></div>';
    } else if (order.status === "Dalam proses") {
      actions = '<button class="btn btn-theme w-100 mt-3 order-action" data-action="complete" data-order="' + escapeHtml(order.id) + '">Konfirmasi Selesai</button>';
    }
    return '<div class="col-12 col-lg-6"><article class="card app-card activity-card status-strip"><div class="card-body p-4">' +
      '<div class="d-flex flex-wrap justify-content-between gap-2 mb-3"><div><span class="badge ' + getStatusBadgeClass(order.status) + ' mb-2">' + escapeHtml(order.status) + '</span>' +
      '<h2 class="h5 fw-bold mb-1">' + escapeHtml(order.itemName) + '</h2><span class="small text-muted-app d-block">Pemesan: ' + escapeHtml(order.requesterName) + '</span>' +
      renderOrderTimestamp(order) + '</div><strong class="text-theme">' + formatCurrency(order.maxPrice) + '</strong></div>' +
      '<div class="soft-panel p-3"><p class="small fw-bold mb-1">' + escapeHtml(order.routeLabel) + '</p><p class="small mb-1">' + escapeHtml(order.address) + '</p>' +
      '<p class="small text-muted-app mb-0">' + escapeHtml(order.notes || "Tidak ada catatan tambahan.") + '</p></div>' +
      renderPaymentSummary(order) + renderReviewSummary(order) + actions + '</div></article></div>';
  }

  function renderPaymentSummary(order) {
    var method = getOrderPaymentMethod(order);
    var status = getOrderPaymentStatus(order);
    var destination = order.paymentDestination || getPaymentDestination(method);
    var proof = order.paymentProof || null;
    var proofName = getProofFileName(proof);
    var proofPreview = getProofPreview(proof);
    return '<div class="payment-summary mt-3"><div class="d-flex flex-wrap justify-content-between gap-2 align-items-center"><div><span class="small text-muted-app d-block">Metode Pembayaran</span>' +
      '<strong class="small">' + escapeHtml(method) + '</strong></div><span class="badge ' + getPaymentBadgeClass(status) + '">' + escapeHtml(status) + '</span></div>' +
      renderPaymentDestinationSummary(method, destination) +
      (proof ? '<div class="payment-proof-preview mt-2">' + (proofPreview ? '<img src="' + proofPreview + '" alt="Bukti bayar ' + escapeHtml(proofName) + '">' : '<i class="bi bi-file-earmark-image"></i>') +
        '<span class="flex-grow-1"><strong>' + escapeHtml(proofName || "Bukti bayar") + '</strong><small>' + (proofPreview ? "Terlampir pada pesanan" : "Pratinjau tidak tersedia") +
        '</small></span><button class="btn btn-sm btn-outline-theme view-payment-proof" type="button" data-order-id="' + escapeHtml(order.id) +
        '" data-bs-toggle="modal" data-bs-target="#payment-proof-modal">Lihat Bukti</button></div>' : "") + "</div>";
  }

  function renderPaymentProofModal() {
    return '<div class="modal fade" id="payment-proof-modal" tabindex="-1" aria-labelledby="payment-proof-modal-title" aria-hidden="true">' +
      '<div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content payment-proof-modal-content"><div class="modal-header">' +
      '<h2 class="modal-title fs-5 fw-bold" id="payment-proof-modal-title">Bukti Bayar</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button></div>' +
      '<div class="modal-body text-center"><img id="payment-proof-modal-image" class="payment-proof-modal-image d-none" alt="Bukti bayar ukuran besar">' +
      '<div id="payment-proof-modal-fallback" class="payment-proof-modal-fallback d-none"><i class="bi bi-file-earmark-image"></i><strong>Pratinjau tidak tersedia</strong></div>' +
      '<p id="payment-proof-modal-name" class="small text-muted-app mt-3 mb-0"></p></div><div class="modal-footer justify-content-center">' +
      '<button type="button" class="btn btn-theme px-4" data-bs-dismiss="modal">Tutup</button></div></div></div></div>';
  }

  function renderPaymentProofForm(order) {
    if (order.paymentProof || !paymentNeedsProof(getOrderPaymentMethod(order))) {
      return "";
    }
    return '<form class="payment-proof-form mt-3" data-order-id="' + escapeHtml(order.id) + '" novalidate><label class="form-label fw-bold" for="proof-' +
      escapeHtml(order.id) + '">Upload bukti bayar</label><div class="input-group"><input class="form-control payment-proof-input" id="proof-' +
      escapeHtml(order.id) + '" type="file" accept="image/*"><button class="btn btn-outline-theme" type="submit">Lampirkan</button></div>' +
      '<small class="file-name payment-proof-name">Belum ada file dipilih</small></form>';
  }

  function renderReviewSection(order) {
    if (order.status !== "Selesai") {
      return "";
    }
    if (order.review) {
      return renderReviewSummary(order);
    }
    return '<form class="review-form mt-3" data-order-id="' + escapeHtml(order.id) + '" novalidate><h3 class="h6 fw-bold mb-2">Beri rating perjalanan</h3>' +
      '<div class="row g-2"><div class="col-sm-4"><select class="form-select review-rating"><option value="">Pilih rating</option><option value="5">5 - Sangat baik</option>' +
      '<option value="4">4 - Baik</option><option value="3">3 - Cukup</option><option value="2">2 - Kurang</option><option value="1">1 - Buruk</option></select></div>' +
      '<div class="col-sm-8"><textarea class="form-control review-text" rows="2" placeholder="Tulis ulasan singkat"></textarea></div>' +
      '<div class="col-12"><button class="btn btn-theme btn-sm" type="submit">Kirim Ulasan</button></div></div></form>';
  }

  function renderReviewSummary(order) {
    if (!order.review) {
      return "";
    }
    return '<div class="review-summary mt-3"><span class="review-stars">' + "★".repeat(Number(order.review.rating) || 0) + "☆".repeat(5 - (Number(order.review.rating) || 0)) +
      '</span><p class="small mb-0">' + escapeHtml(order.review.text) + '</p><time class="order-timestamp" datetime="' +
      escapeHtml(order.review.createdAt || "") + '">' + escapeHtml(formatDate(order.review.createdAt)) + "</time></div>";
  }

  function renderInbox() {
    var orders = loadOrders();
    var routes = loadRoutes();
    var relevantOrders = currentMode === "pemesan"
      ? orders.filter(isCurrentRequesterOrder)
      : orders.filter(function (order) { return order.status !== "Ditolak"; });
    var relevantOrder = relevantOrders.find(function (order) { return order.id === selectedChatOrderId; }) || relevantOrders[0] || null;
    selectedChatOrderId = relevantOrder ? relevantOrder.id : "";
    var relatedRoute = relevantOrder
      ? routes.find(function (route) { return route.id === relevantOrder.routeId; })
      : null;
    var partner = currentMode === "pemesan"
      ? (relatedRoute ? relatedRoute.providerName : "Penyedia JasKan")
      : (relevantOrder ? relevantOrder.requesterName : "Pemesan JasKan");
    var image = currentMode === "pemesan"
      ? (relatedRoute ? relatedRoute.image : "Penyedia.png")
      : (relevantOrder ? relevantOrder.image : "Pengguna.png");
    var orderLabel = relevantOrder ? relevantOrder.itemName : "Belum ada pesanan aktif";
    var chatDisabled = relevantOrder ? "" : " disabled";
    var conversation = relevantOrder
      ? loadMessages().filter(function (message) { return message.orderId === relevantOrder.id; })
      : [];
    var chatContent = conversation.length
      ? conversation.map(renderChatMessage).join("")
      : '<div class="chat-empty"><i class="bi bi-chat-square-text"></i><strong>Mulai koordinasi pesanan</strong><span>Kirim pesan pertama untuk membahas detail titipan.</span></div>';
    var conversationList = relevantOrders.map(function (order) {
      var route = routes.find(function (item) { return item.id === order.routeId; });
      var chatPartner = currentMode === "pemesan" ? (route ? route.providerName : "Penyedia JasKan") : order.requesterName;
      var chatImage = currentMode === "pemesan" ? (route ? route.image : "Penyedia.png") : (order.image || "Pengguna.png");
      return '<button class="conversation-item ' + (order.id === selectedChatOrderId ? "active" : "") + '" data-chat-order="' + escapeHtml(order.id) + '">' +
        '<img class="chat-avatar" src="' + root + 'Asset/' + escapeHtml(chatImage) + '" alt="Foto ' + escapeHtml(chatPartner) + '"><span><strong>' +
        escapeHtml(chatPartner) + '</strong><small>' + escapeHtml(order.itemName) + '</small></span><span class="badge ' +
        getStatusBadgeClass(order.status) + '">' + escapeHtml(order.status) + "</span></button>";
    }).join("");

    return '<section class="page-heading"><span class="badge mode-badge mb-2">Koordinasi pesanan</span><h1 class="display-6 fw-bold">Pesan</h1>' +
      '<p class="lead mb-0">Koordinasikan titik temu dan perkembangan pesanan.</p></section><div class="row g-4">' +
      '<div class="col-12 col-md-4"><article class="card app-card conversation-card"><div class="card-body p-3"><h2 class="h5 fw-bold px-2 pt-2">Percakapan</h2>' +
      '<div class="conversation-list mt-2">' + (conversationList || '<div class="empty-state py-4"><span class="empty-state-icon"><i class="bi bi-chat"></i></span><p class="text-muted-app mb-0">Belum ada percakapan.</p></div>') +
      '</div></div></article></div>' +
      '<div class="col-12 col-md-8"><article class="card app-card chat-window"><div class="card-header bg-white p-3 d-flex gap-3 align-items-center">' +
      '<img class="chat-avatar" src="' + root + 'Asset/' + image + '" alt="Foto ' + escapeHtml(partner) + '"><div><strong>' + escapeHtml(partner) + '</strong><small class="d-block text-success">' + escapeHtml(orderLabel) + '</small></div></div>' +
      '<div class="card-body chat-messages" id="chat-messages">' + chatContent + '</div>' +
      '<div class="card-footer bg-white p-3"><form id="chat-form" class="input-group" data-order-id="' + (relevantOrder ? escapeHtml(relevantOrder.id) : "") + '"><label for="chat-input" class="visually-hidden">Ketik pesan</label>' +
      '<input id="chat-input" class="form-control" type="text" placeholder="' + (relevantOrder ? "Ketik pesan..." : "Belum ada pesanan aktif") + '" required' + chatDisabled + '><button class="btn btn-theme" type="submit"' + chatDisabled + '>Kirim</button></form></div></article></div></div>';
  }

  function renderChatMessage(message) {
    var bubbleClass = message.senderRole === currentMode ? "mine" : "theirs";
    return '<div class="chat-bubble ' + bubbleClass + ' mb-3"><span class="chat-message-text">' + escapeHtml(message.text) +
      '</span><time datetime="' + escapeHtml(message.createdAt || "") + '">' + escapeHtml(formatTime(message.createdAt)) + "</time></div>";
  }

  function renderForm() {
    if (currentMode === "pemesan") {
      var routes = loadRoutes();
      var routeOptions = routes.map(function (route) {
        var selected = route.id === selectedRouteId ? " selected" : "";
        return '<option value="' + escapeHtml(route.id) + '"' + selected + '>' + escapeHtml(route.start + " → " + route.destination + " | " + route.providerName) + "</option>";
      }).join("");
      return '<section class="page-heading"><span class="badge mode-badge mb-2">Form titip barang</span><h1 class="display-6 fw-bold">Buat Titipan</h1>' +
        '<p class="lead mb-0">Lengkapi kebutuhan barang dan titik temu dengan jelas.</p></section><form id="request-form" class="card app-card">' +
        '<div class="card-body p-4 p-md-5"><div class="form-card-heading"><span><i class="bi bi-bag-plus"></i></span><div><h2>Detail Titipan</h2><p>Informasi lengkap membantu penyedia memproses pesanan dengan tepat.</p></div></div><div class="row g-4"><div class="col-12"><label for="item-name" class="form-label fw-bold">Nama barang</label>' +
        '<input id="item-name" class="form-control" required placeholder="Contoh: Cetak makalah 20 lembar"></div><div class="col-12 col-md-6">' +
        '<label for="price" class="form-label fw-bold">Estimasi harga maksimal</label><input id="price" class="form-control" type="number" min="1" required placeholder="Contoh: 50000"></div>' +
        '<div class="col-12 col-md-6"><label for="request-route" class="form-label fw-bold">Pilih rute</label><select id="request-route" class="form-select" required>' +
        '<option value="">Pilih rute aktif</option>' + routeOptions + '</select></div>' +
        '<div class="col-12"><label for="meeting-point" class="form-label fw-bold">Alamat atau titik antar</label><input id="meeting-point" class="form-control" required value="' + escapeHtml(loadProfileData().address) + '" placeholder="Contoh: Gerbang Fakultas Teknik"></div>' +
        '<div class="col-12"><label for="request-notes" class="form-label fw-bold">Catatan tambahan</label><textarea id="request-notes" class="form-control" rows="3" required placeholder="Tuliskan jumlah, ukuran, atau detail barang"></textarea></div>' +
        '<div class="col-12 col-md-6"><label for="payment-method" class="form-label fw-bold">Metode Pembayaran</label><select id="payment-method" class="form-select" required>' +
        '<option value="">Pilih metode pembayaran</option><option value="QRIS">QRIS</option><option value="E-Wallet / DANA">E-Wallet / DANA</option>' +
        '<option value="Transfer Bank">Transfer Bank</option><option value="Bayar di Tempat / Tunai">Bayar di Tempat / Tunai</option></select></div>' +
        '<div class="col-12 qris-payment-panel d-none"><div class="qris-card"><span class="profile-eyebrow">Pembayaran QRIS</span><h3 class="h5 fw-bold mb-1">Pindai kode QRIS</h3>' +
        '<p class="text-muted-app qris-instruction">Scan QRIS untuk menyelesaikan pembayaran, lalu upload bukti bayar.</p><div class="qris-image-wrap">' +
        '<img id="qris-image" class="qris-image d-none" data-src="' + root + 'Asset/qris.png" alt="Kode pembayaran QRIS JasKan">' +
        '<span id="qris-fallback" class="qris-fallback d-none"><i class="bi bi-qr-code"></i> QRIS belum tersedia</span></div>' +
        '<button id="enlarge-qris" class="btn btn-outline-theme qris-enlarge d-none" type="button" data-bs-toggle="modal" data-bs-target="#qris-modal"><i class="bi bi-arrows-fullscreen me-1"></i> Perbesar QRIS</button></div>' +
        '<div class="modal fade" id="qris-modal" tabindex="-1" aria-labelledby="qris-modal-title" aria-hidden="true"><div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content qris-modal-content">' +
        '<div class="modal-header"><h2 class="modal-title fs-5 fw-bold" id="qris-modal-title">QRIS JasKan</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button></div>' +
        '<div class="modal-body text-center"><p class="text-muted-app mb-3">Scan QRIS untuk menyelesaikan pembayaran, lalu upload bukti bayar.</p>' +
        '<img id="qris-modal-image" class="qris-modal-image d-none" alt="Kode pembayaran QRIS JasKan ukuran besar"><span id="qris-modal-fallback" class="qris-fallback d-none"><i class="bi bi-qr-code"></i> QRIS belum tersedia</span></div>' +
        '<div class="modal-footer justify-content-center"><button type="button" class="btn btn-theme px-4" data-bs-dismiss="modal">Tutup</button></div></div></div></div></div>' +
        '<div class="col-12 dana-payment-panel payment-method-panel d-none"><div class="payment-destination-card"><span class="payment-destination-icon"><i class="bi bi-phone"></i></span>' +
        '<div class="payment-destination-heading"><span class="profile-eyebrow">E-Wallet / DANA</span><h3 class="h5 fw-bold mb-1">JasKan Payment</h3><p class="text-muted-app mb-0">Transfer ke nomor DANA berikut, lalu upload bukti bayar.</p></div>' +
        '<dl class="payment-destination-details"><div><dt>Nama</dt><dd>JasKan Payment</dd></div><div><dt>Nomor DANA</dt><dd>0812-3456-7890</dd></div><div><dt>Atas Nama</dt><dd>JasKan Demo</dd></div></dl>' +
        '<button class="btn btn-outline-theme copy-payment-number" type="button" data-copy-value="081234567890" data-copy-label="Nomor DANA">Salin Nomor DANA</button></div></div>' +
        '<div class="col-12 bank-payment-panel payment-method-panel d-none"><div class="payment-destination-card"><span class="payment-destination-icon"><i class="bi bi-bank"></i></span>' +
        '<div class="payment-destination-heading"><span class="profile-eyebrow">Transfer Bank</span><h3 class="h5 fw-bold mb-1">BCA</h3><p class="text-muted-app mb-0">Transfer ke rekening berikut, lalu upload bukti bayar.</p></div>' +
        '<dl class="payment-destination-details"><div><dt>Nomor Rekening</dt><dd>1234567890</dd></div><div><dt>Atas Nama</dt><dd>JasKan Demo</dd></div></dl>' +
        '<button class="btn btn-outline-theme copy-payment-number" type="button" data-copy-value="1234567890" data-copy-label="Nomor rekening">Salin Nomor Rekening</button></div></div>' +
        '<div class="col-12 cash-payment-panel payment-method-panel d-none"><div class="payment-destination-card payment-cash-card"><span class="payment-destination-icon"><i class="bi bi-cash-coin"></i></span>' +
        '<div><span class="profile-eyebrow">Bayar di Tempat</span><p class="fw-bold mb-0">Pembayaran dilakukan saat barang diterima.</p></div></div></div>' +
        '<div class="col-12 payment-proof-field d-none"><label for="initial-payment-proof" class="form-label fw-bold">Upload Bukti Bayar <span class="fw-normal text-danger">(wajib)</span></label>' +
        '<input id="initial-payment-proof" class="form-control" type="file" accept="image/*"><div id="initial-proof-preview" class="file-preview mt-2"><span>Belum ada file dipilih</span></div></div>' +
        '<div class="col-12 d-grid d-sm-flex justify-content-sm-end"><button class="btn btn-theme btn-lg px-5" type="submit">Kirim Titipan</button></div></div></div></form>';
    }

    return '<section class="page-heading"><span class="badge mode-badge mb-2">Form buka rute</span><h1 class="display-6 fw-bold">Buka Rute Baru</h1>' +
      '<p class="lead mb-0">Bagikan perjalanan dan kapasitas titipan yang dapat kamu bawa.</p></section><form id="route-form" class="card app-card">' +
      '<div class="card-body p-4 p-md-5"><div class="form-card-heading"><span><i class="bi bi-signpost-split"></i></span><div><h2>Detail Perjalanan</h2><p>Pastikan waktu dan tujuan rute sudah sesuai sebelum dipublikasikan.</p></div></div><div class="row g-4"><div class="col-12 col-md-6"><label for="route-start" class="form-label fw-bold">Titik awal</label>' +
      '<input id="route-start" class="form-control" required placeholder="Contoh: Kampus ULM"></div><div class="col-12 col-md-6"><label for="route-destination" class="form-label fw-bold">Tujuan</label>' +
      '<input id="route-destination" class="form-control" required placeholder="Contoh: Banjarbaru"></div><div class="col-12 col-md-6">' +
      '<label for="departure" class="form-label fw-bold">Estimasi waktu berangkat (WITA)</label><input id="departure" class="form-control route-time-input" type="text" inputmode="numeric" maxlength="5" pattern="(?:[01][0-9]|2[0-3])[.:][0-5][0-9]" placeholder="Contoh: 15.30" autocomplete="off" required>' +
      '<div class="form-text">Gunakan format 24 jam, misalnya 15.30.</div></div>' +
      '<div class="col-12 col-md-6"><label for="route-cutoff" class="form-label fw-bold">Batas waktu titip (WITA)</label><input id="route-cutoff" class="form-control route-time-input" type="text" inputmode="numeric" maxlength="5" pattern="(?:[01][0-9]|2[0-3])[.:][0-5][0-9]" placeholder="Contoh: 15.00" autocomplete="off" required>' +
      '<div class="form-text">Batas titip sebaiknya lebih awal dari waktu berangkat.</div></div>' +
      '<div class="col-12"><label for="notes" class="form-label fw-bold">Catatan rute</label><textarea id="notes" class="form-control" rows="3" required placeholder="Contoh: Maksimal paket ukuran sedang"></textarea></div>' +
      '<div class="col-12 d-grid d-sm-flex justify-content-sm-end"><button class="btn btn-theme btn-lg px-5" type="submit">Publikasikan Rute</button></div></div></div></form>';
  }

  function renderProfile() {
    var requester = currentMode === "pemesan";
    var profile = loadProfileData();
    var orders = loadOrders();
    profile.totalValue = requester
      ? String(orders.filter(isCurrentRequesterOrder).length)
      : String(orders.filter(function (order) {
        return order.status === "Diterima" || order.status === "Dalam proses" || order.status === "Selesai";
      }).length);
    if (!requester) {
      profile.reputationValue = calculateProviderRating(orders);
    }
    var image = requester ? "Pengguna.png" : "Penyedia.png";
    var profileDescription = requester
      ? "Kelola identitas, nomor telepon, dan alamat pengantaran agar proses titip barang lebih jelas."
      : "Kelola identitas, nomor telepon, dan rute utama agar proses titip barang lebih jelas.";

    return '<section class="page-heading"><span class="badge mode-badge mb-2">Profil terhubung</span><h1 class="display-6 fw-bold">Profil Akun</h1>' +
      '<p class="lead mb-0">' + profileDescription + '</p></section><div class="row g-4">' +
      '<div class="col-12 col-lg-4"><article class="card app-card text-center profile-summary-card"><div class="card-body p-4 p-md-5"><img class="profile-avatar mb-3" src="' + root + 'Asset/' + image + '" alt="Foto profil ' + escapeHtml(profile.name) + '">' +
      '<h2 class="h3 fw-bold">' + escapeHtml(profile.name) + '</h2><span class="badge mode-badge mb-3">' + escapeHtml(profile.status) + '</span><p class="profile-switch-hint mb-0">Ketuk Profil 2x untuk ganti mode</p>' +
      '<div class="row g-3 mt-3"><div class="col-6"><div class="soft-panel p-3"><small class="d-block">' + escapeHtml(profile.totalLabel) + '</small><strong class="fs-4">' + escapeHtml(profile.totalValue) + '</strong></div></div>' +
      '<div class="col-6"><div class="soft-panel p-3"><small class="d-block">' + escapeHtml(profile.reputationLabel) + '</small><strong class="fs-4">' + escapeHtml(profile.reputationValue) + '</strong></div></div></div></div></article></div>' +
      '<div class="col-12 col-lg-8"><article class="card app-card profile-information-card"><div class="card-body p-4"><div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">' +
      '<div><span class="profile-eyebrow">Informasi akun aktif</span><h2 class="h4 fw-bold mb-0">Informasi Profil</h2></div><span class="badge rounded-pill ' +
      getVerificationBadgeClass(profile.status) + ' profile-status-badge">' + escapeHtml(profile.status) + '</span></div>' +
      renderProfileInformation(profile, requester) + '</div></article></div>' +
      '<div class="col-12 col-lg-4"><article class="card app-card"><div class="card-body p-3"><h2 class="h5 fw-bold px-2 pt-2">Kelola Profil</h2>' +
      '<div class="list-group list-group-flush profile-menu"><button class="btn list-group-item list-group-item-action text-start py-3 profile-setting" data-profile-action="name">Ubah Nama</button>' +
      '<button class="btn list-group-item list-group-item-action text-start py-3 profile-setting" data-profile-action="phone">Nomor Telepon</button>' +
      (requester
        ? '<button class="btn list-group-item list-group-item-action text-start py-3 profile-setting" data-profile-action="address">Alamat Pengantaran</button>'
        : '<button class="btn list-group-item list-group-item-action text-start py-3 profile-setting" data-profile-action="route">Rute Utama</button>') +
      '<button class="btn list-group-item list-group-item-action text-start py-3 profile-setting" data-profile-action="notifications">Pengaturan Notifikasi</button></div></div></article></div>' +
      '<div class="col-12 col-lg-8"><article class="card app-card profile-editor"><div class="card-body p-4" id="profile-editor">' + renderProfileDetail("overview") + '</div></article></div>' +
      '<div class="col-12">' + renderVerificationCard(profile, currentMode) + '</div>' +
      '<div class="col-12 d-flex flex-wrap justify-content-between gap-2"><button class="btn btn-sm btn-outline-danger" id="logout-account" type="button"><i class="bi bi-box-arrow-right me-1"></i> Keluar</button>' +
      '<button class="btn btn-sm btn-link text-secondary text-decoration-none" id="reset-demo-data" type="button">Pulihkan Data Awal</button></div></div>';
  }

  function renderVerificationCard(profile, mode) {
    var requester = mode === "pemesan";
    var verification = loadVerificationData(mode);
    var documents = verification.documents || {};
    var status = profile.status || "Belum Diverifikasi";
    return '<article class="card app-card verification-card"><div class="card-body p-4"><div class="d-flex flex-wrap justify-content-between gap-2 mb-4"><div>' +
      '<span class="profile-eyebrow">Kepercayaan akun</span><h2 class="h4 fw-bold mb-1">Verifikasi ' + (requester ? "Pemesan" : "Penyedia") + '</h2><p class="text-muted-app mb-0">Lengkapi dokumen agar profil ' +
      (requester ? "pemesan" : "penyedia") + ' lebih meyakinkan.</p></div>' +
      '<span class="badge ' + getVerificationBadgeClass(status) + ' align-self-start">' + escapeHtml(status) + '</span></div><form id="verification-form" data-verification-mode="' + mode + '" novalidate><div class="row g-3">' +
      '<div class="' + (requester ? "col-12" : "col-md-6") + '"><label for="identity-document" class="form-label fw-bold">Foto KTP atau KTM</label><input id="identity-document" class="form-control" type="file" accept="image/*">' +
      '<small class="file-name" id="identity-file-name">' + escapeHtml(documents.identityName || "Belum ada file dipilih") + '</small></div>' +
      (requester ? "" : '<div class="col-md-6"><label for="vehicle-document" class="form-label fw-bold">Foto kendaraan atau pelat nomor</label><input id="vehicle-document" class="form-control" type="file" accept="image/*">' +
      '<small class="file-name" id="vehicle-file-name">' + escapeHtml(documents.vehicleName || "Belum ada file dipilih") + '</small></div>') +
      '<div class="col-12"><button class="btn btn-theme" type="submit">Ajukan Verifikasi</button>' +
      (status === "Menunggu Verifikasi" ? '<p class="verification-note mb-0 mt-3"><i class="bi bi-clock-history"></i> Dokumen berhasil diajukan. Status: Menunggu Verifikasi</p>' : "") +
      (status === getVerifiedStatus(mode) ? '<p class="verification-note verification-note-complete mb-0 mt-3"><i class="bi bi-patch-check-fill"></i> Dokumen telah diperiksa. Akun ' +
      (requester ? "pemesan" : "penyedia") + ' terverifikasi.</p>' : "") +
      '</div></div></form></div></article>';
  }

  function renderProfileInformation(profile, requester) {
    var items = requester
      ? [
        ["Nama Pengguna", profile.name],
        ["Nomor Telepon", profile.phone],
        ["Alamat Pengantaran", profile.address],
        ["Status Verifikasi", profile.status]
      ]
      : [
        ["Nama Penyedia", profile.name],
        ["Nomor Telepon", profile.phone],
        ["Rute Utama", profile.primaryRoute],
        ["Status Verifikasi", profile.status]
      ];

    return '<dl class="row g-3 profile-detail-list mb-0">' + items.map(function (item) {
      return '<div class="col-12 col-md-6"><div class="profile-info-item h-100"><dt>' + item[0] + '</dt><dd>' +
        escapeHtml(item[1]) + '</dd></div></div>';
    }).join("") + "</dl>";
  }

  function renderProfileDetail(section) {
    var profile = loadProfileData();
    var requester = currentMode === "pemesan";

    if (section === "name") {
      return profileFormHeader("Ubah Nama", "Perbarui nama yang tampil pada profil.") +
        '<form class="profile-form" data-profile-form="name"><label for="profile-name" class="form-label fw-bold">Nama lengkap</label>' +
        '<input id="profile-name" class="form-control" value="' + escapeHtml(profile.name) + '" required>' + profileFormActions() + "</form>";
    }

    if (section === "phone") {
      return profileFormHeader("Nomor Telepon", "Nomor ini digunakan untuk koordinasi pesanan.") +
        '<form class="profile-form" data-profile-form="phone"><label for="profile-phone" class="form-label fw-bold">Nomor telepon</label>' +
        '<input id="profile-phone" class="form-control" type="tel" value="' + escapeHtml(profile.phone) + '" required>' + profileFormActions() + "</form>";
    }

    if (section === "address" && requester) {
      return profileFormHeader("Alamat Pengantaran", "Atur alamat utama penerimaan barang titipan.") +
        '<form class="profile-form" data-profile-form="address"><label for="profile-address" class="form-label fw-bold">Alamat Pengantaran</label>' +
        '<textarea id="profile-address" class="form-control" rows="4" required>' + escapeHtml(profile.address) + '</textarea>' + profileFormActions("Simpan Alamat") + "</form>";
    }

    if (section === "route" && !requester) {
      return profileFormHeader("Rute Utama", "Tuliskan jalur perjalanan yang paling sering kamu layani.") +
        '<form class="profile-form" data-profile-form="route"><label for="profile-route" class="form-label fw-bold">Rute Utama</label>' +
        '<textarea id="profile-route" class="form-control" rows="4" required>' + escapeHtml(profile.primaryRoute) + '</textarea>' + profileFormActions("Simpan Rute") + "</form>";
    }

    if (section === "notifications") {
      return profileFormHeader("Pengaturan Notifikasi", "Pilih informasi yang ingin kamu terima.") +
        '<form class="profile-form" data-profile-form="notifications">' +
        notificationCheckbox("notification-orders", "orders", "Notifikasi pesanan", profile.notifications.orders) +
        notificationCheckbox("notification-messages", "messages", "Notifikasi pesan", profile.notifications.messages) +
        notificationCheckbox("notification-delivery", "delivery", "Notifikasi status pengiriman", profile.notifications.delivery) +
        profileFormActions() + "</form>";
    }

    return '<span class="badge mode-badge mb-3">Detail Profil</span><h2 class="h4 fw-bold">Pilih informasi yang ingin diperbarui</h2>' +
      '<p class="text-muted-app mb-0">Gunakan menu di samping untuk mengubah data profil. Setiap perubahan akan tersimpan otomatis pada perangkat ini.</p>';
  }

  function profileFormHeader(title, description) {
    return '<h2 class="h4 fw-bold">' + title + '</h2><p class="text-muted-app">' + description + "</p>";
  }

  function profileFormActions(saveLabel) {
    return '<div class="d-flex flex-wrap gap-2 mt-4"><button class="btn btn-theme" type="submit">' + (saveLabel || "Simpan") + '</button>' +
      '<button class="btn btn-outline-secondary profile-cancel" type="button">Batal</button></div>';
  }

  function notificationCheckbox(id, key, label, checked) {
    return '<div class="form-check"><input class="form-check-input" type="checkbox" id="' + id + '" data-notification-key="' + key + '"' +
      (checked ? " checked" : "") + '><label class="form-check-label" for="' + id + '">' + label + "</label></div>";
  }

  function loadProfileDataForMode(mode) {
    var defaults = profileDefaults[mode];
    var savedData = {};
    try {
      savedData = JSON.parse(localStorage.getItem(PROFILE_STORAGE_PREFIX + mode) || localStorage.getItem("jaskan-profile-" + mode)) || {};
    } catch (error) {
      savedData = {};
    }
    delete savedData.payment;
    delete savedData.vehicle;
    var hasRemovedProfileFields = Object.prototype.hasOwnProperty.call(savedData, "serviceArea") ||
      Object.prototype.hasOwnProperty.call(savedData, "coordination");
    var profileNeedsSave = hasRemovedProfileFields;
    delete savedData.serviceArea;
    delete savedData.coordination;
    if (mode === "pemesan") {
      if (savedData.status === "Pemesan terverifikasi") {
        savedData.status = "Pemesan Terverifikasi";
        profileNeedsSave = true;
      }
    } else {
      if (savedData.status === "Belum diverifikasi") {
        savedData.status = "Belum Diverifikasi";
        profileNeedsSave = true;
      } else if (savedData.status === "Penyedia terverifikasi") {
        savedData.status = "Penyedia Terverifikasi";
        profileNeedsSave = true;
      }
    }
    if (profileNeedsSave) {
      localStorage.setItem(PROFILE_STORAGE_PREFIX + mode, JSON.stringify(savedData));
      localStorage.removeItem("jaskan-profile-" + mode);
    }
    var profile = $.extend(true, {}, defaults, savedData);
    var verification = loadVerificationData(mode, profile);
    profile.status = verification.status;
    profile.verificationDocuments = verification.documents;
    return profile;
  }

  function loadProfileData() {
    return loadProfileDataForMode(currentMode);
  }

  function saveProfileDataForMode(mode, profile) {
    localStorage.setItem(PROFILE_STORAGE_PREFIX + mode, JSON.stringify(profile));
    localStorage.removeItem("jaskan-profile-" + mode);
  }

  function getVerifiedStatus(mode) {
    return mode === "pemesan" ? "Pemesan Terverifikasi" : "Penyedia Terverifikasi";
  }

  function normalizeVerificationStatus(mode, status) {
    if (status === "Menunggu Verifikasi" || status === "Menunggu verifikasi") {
      return "Menunggu Verifikasi";
    }
    if (status === getVerifiedStatus(mode) ||
        status === (mode === "pemesan" ? "Pemesan terverifikasi" : "Penyedia terverifikasi")) {
      return getVerifiedStatus(mode);
    }
    return "Belum Diverifikasi";
  }

  function loadVerificationData(mode, profileFallback) {
    var key = VERIFICATION_STORAGE_PREFIX + mode;
    var saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(key)) || {};
    } catch (error) {
      localStorage.removeItem(key);
    }
    var fallback = profileFallback || {};
    var verification = {
      status: normalizeVerificationStatus(mode, saved.status || fallback.status),
      documents: $.extend({}, fallback.verificationDocuments || {}, saved.documents || {}),
      submittedAt: saved.submittedAt || fallback.verificationSubmittedAt || "",
      dueAt: Number(saved.dueAt || fallback.verificationDueAt || 0),
      completedAt: saved.completedAt || fallback.verificationCompletedAt || ""
    };
    if (!localStorage.getItem(key) && (fallback.status || fallback.verificationDocuments)) {
      saveVerificationData(mode, verification);
    }
    return verification;
  }

  function saveVerificationData(mode, verification) {
    var normalized = {
      status: normalizeVerificationStatus(mode, verification.status),
      documents: $.extend({}, verification.documents || {}),
      submittedAt: verification.submittedAt || "",
      dueAt: Number(verification.dueAt || 0),
      completedAt: verification.completedAt || ""
    };
    localStorage.setItem(VERIFICATION_STORAGE_PREFIX + mode, JSON.stringify(normalized));

    var profileKey = PROFILE_STORAGE_PREFIX + mode;
    var profile = {};
    try {
      profile = JSON.parse(localStorage.getItem(profileKey)) || {};
    } catch (error) {
      profile = {};
    }
    profile.status = normalized.status;
    profile.verificationDocuments = normalized.documents;
    profile.verificationSubmittedAt = normalized.submittedAt;
    profile.verificationDueAt = normalized.dueAt;
    profile.verificationCompletedAt = normalized.completedAt;
    saveProfileDataForMode(mode, profile);
  }

  function saveProfileData(key, value) {
    var profile = loadProfileData();
    profile[key] = value;
    saveProfileDataForMode(currentMode, profile);
  }

  function escapeHtml(value) {
    return $("<div>").text(String(value || "")).html();
  }

  function bindSectionEvents() {
    $("#request-form, #route-form").attr("novalidate", "novalidate");

    $(".section-link").on("click", function () {
      navigateToSection($(this).data("target"));
      if ($(this).data("focus-search")) {
        window.setTimeout(function () {
          var searchInput = document.getElementById("route-search");
          if (searchInput) {
            searchInput.focus();
            searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 80);
      }
    });

    $(".choose-route").on("click", function () {
      selectedRouteId = String($(this).data("route-id"));
      navigateToSection("form");
    });

    $("#route-search").on("input", function () {
      filterRoutes($(this).val());
    });

    $("#search-route").on("click", function () {
      filterRoutes($("#route-search").val());
    });

    $(".order-action").on("click", function () {
      handleOrderAction($(this));
    });

    $(".conversation-item").on("click", function () {
      selectedChatOrderId = String($(this).data("chat-order"));
      renderSection("inbox");
    });

    $(".view-payment-proof").on("click", function () {
      var orderId = String($(this).data("order-id"));
      var order = loadOrders().find(function (item) { return item.id === orderId; });
      var proof = order ? order.paymentProof : null;
      var preview = getProofPreview(proof);
      var fileName = getProofFileName(proof) || "Nama file tidak tersedia";
      $("#payment-proof-modal-name").text(fileName);
      if (preview) {
        $("#payment-proof-modal-image").attr("src", preview).removeClass("d-none");
        $("#payment-proof-modal-fallback").addClass("d-none");
      } else {
        $("#payment-proof-modal-image").addClass("d-none").removeAttr("src");
        $("#payment-proof-modal-fallback").removeClass("d-none");
      }
    });

    $("#payment-proof-modal-image").on("error", function () {
      $(this).addClass("d-none").removeAttr("src");
      $("#payment-proof-modal-fallback").removeClass("d-none");
    });

    $("#qris-image").on("load", function () {
      $(this).removeClass("d-none");
      $("#qris-fallback").addClass("d-none");
      $("#enlarge-qris").removeClass("d-none");
      $("#qris-modal-image").attr("src", $(this).attr("src")).removeClass("d-none");
      $("#qris-modal-fallback").addClass("d-none");
    }).on("error", function () {
      $(this).addClass("d-none").removeAttr("src");
      $("#qris-fallback").removeClass("d-none");
      $("#enlarge-qris").addClass("d-none");
      $("#qris-modal-image").addClass("d-none").removeAttr("src");
      $("#qris-modal-fallback").removeClass("d-none");
    });

    $("#payment-method").on("change", function () {
      var method = $(this).val();
      var proofField = $(".payment-proof-field");
      var qrisPanel = $(".qris-payment-panel");
      var qrisImage = $("#qris-image");
      pendingPaymentProof = null;
      $("#initial-payment-proof").val("");
      $("#initial-proof-preview").html("<span>Belum ada file dipilih</span>");
      $(".payment-method-panel").addClass("d-none");
      if (method === "QRIS") {
        qrisPanel.removeClass("d-none");
        $("#qris-fallback").addClass("d-none");
        qrisImage.addClass("d-none").attr("src", qrisImage.data("src"));
      } else {
        qrisPanel.addClass("d-none");
        $("#enlarge-qris").addClass("d-none");
        qrisImage.addClass("d-none").removeAttr("src");
        $("#qris-modal-image").addClass("d-none").removeAttr("src");
      }
      if (method === "E-Wallet / DANA") {
        $(".dana-payment-panel").removeClass("d-none");
      } else if (method === "Transfer Bank") {
        $(".bank-payment-panel").removeClass("d-none");
      } else if (method === "Bayar di Tempat / Tunai") {
        $(".cash-payment-panel").removeClass("d-none");
      }
      if (paymentNeedsProof(method)) {
        proofField.removeClass("d-none");
        return;
      }
      proofField.addClass("d-none");
    });

    $(".copy-payment-number").on("click", function () {
      var value = String($(this).data("copy-value"));
      var label = String($(this).data("copy-label"));
      copyTextToClipboard(value, function (copied) {
        showPageAlert(copied ? label + " berhasil disalin" : label + " belum dapat disalin", copied ? "success" : "warning");
      });
    });

    $("#initial-payment-proof").on("change", function () {
      var file = this.files && this.files[0];
      pendingPaymentProof = null;
      if (!file) {
        $("#initial-proof-preview").html("<span>Belum ada file dipilih</span>");
        return;
      }
      readLocalImage(file, function (proof) {
        pendingPaymentProof = proof;
        $("#initial-proof-preview").html(renderFilePreview(proof));
      });
    });

    $("#chat-form").on("submit", function (event) {
      event.preventDefault();
      var input = $("#chat-input");
      var text = input.val().trim();
      var orderId = String($(this).data("order-id") || "");
      if (!text || !orderId) {
        return;
      }
      var messagesData = loadMessages();
      var message = {
        id: "message-" + Date.now(),
        orderId: orderId,
        senderRole: currentMode,
        text: text,
        createdAt: new Date().toISOString()
      };
      messagesData.push(message);
      saveMessages(messagesData);
      $("#chat-messages").append(renderChatMessage(message));
      input.val("");
      var messages = document.getElementById("chat-messages");
      messages.scrollTop = messages.scrollHeight;
    });

    $("#request-form").on("submit", function (event) {
      event.preventDefault();
      var routeId = $("#request-route").val();
      var route = loadRoutes().find(function (item) { return item.id === routeId; });
      var itemName = $("#item-name").val().trim();
      var maxPrice = Number($("#price").val());
      var address = $("#meeting-point").val().trim();
      var notes = $("#request-notes").val().trim();
      var paymentMethod = $("#payment-method").val();
      if (!route || !itemName || !Number.isFinite(maxPrice) || maxPrice <= 0 || !address || !notes || !paymentMethod) {
        showPageAlert("Lengkapi seluruh data titipan terlebih dahulu", "warning");
        return;
      }
      if (paymentNeedsProof(paymentMethod) && !pendingPaymentProof) {
        showPageAlert("Upload bukti bayar wajib untuk metode non-tunai", "warning");
        return;
      }
      var requesterProfile = loadProfileData();
      var orders = loadOrders();
      var account = getCurrentAccount();
      var newOrder = {
        id: "order-" + Date.now(),
        requesterId: account ? account.id : "current-requester",
        requesterName: requesterProfile.name,
        image: "Pengguna.png",
        itemName: itemName,
        maxPrice: maxPrice,
        address: address,
        notes: notes,
        routeId: route.id,
        routeLabel: route.start + " → " + route.destination,
        status: "Menunggu konfirmasi",
        paymentMethod: paymentMethod,
        paymentDestination: cloneData(getPaymentDestination(paymentMethod)),
        paymentStatus: paymentNeedsProof(paymentMethod)
          ? (pendingPaymentProof ? "Bukti Bayar Terlampir" : "Menunggu Pembayaran")
          : "Bayar di Tempat",
        paymentProof: paymentNeedsProof(paymentMethod) ? pendingPaymentProof : null,
        createdAt: new Date().toISOString()
      };
      orders.unshift(newOrder);
      saveOrders(orders);
      var messagesData = loadMessages();
      messagesData.push({
        id: "message-" + Date.now(),
        orderId: newOrder.id,
        senderRole: "pemesan",
        text: "Halo, saya baru membuat titipan " + itemName + ". Mohon konfirmasi jika rute sesuai.",
        createdAt: new Date().toISOString()
      });
      saveMessages(messagesData);
      this.reset();
      selectedRouteId = "";
      selectedChatOrderId = newOrder.id;
      pendingPaymentProof = null;
      navigateToSection("activity");
      showPageAlert("Titipan berhasil dibuat dan dikirim ke penyedia");
    });

    $("#route-form").on("submit", function (event) {
      event.preventDefault();
      var start = $("#route-start").val().trim();
      var destination = $("#route-destination").val().trim();
      var departure = normalizeRouteTime($("#departure").val());
      var cutoff = normalizeRouteTime($("#route-cutoff").val());
      var notes = $("#notes").val().trim();
      if (!start || !destination || !$("#departure").val().trim() || !$("#route-cutoff").val().trim() || !notes) {
        showPageAlert("Lengkapi seluruh data rute terlebih dahulu", "warning");
        return;
      }
      if (!departure || !cutoff) {
        showPageAlert("Gunakan format jam 24 jam yang valid, misalnya 15.30", "warning");
        return;
      }
      if (routeTimeToMinutes(cutoff) >= routeTimeToMinutes(departure)) {
        showPageAlert("Batas waktu titip harus lebih awal dari waktu berangkat", "warning");
        return;
      }
      var providerProfile = loadProfileData();
      var routes = loadRoutes();
      routes.unshift({
        id: "route-" + Date.now(),
        providerName: providerProfile.name,
        image: "Penyedia.png",
        start: start,
        destination: destination,
        departure: departure,
        cutoff: cutoff,
        timeZone: INDONESIA_TIME_ZONE,
        notes: notes,
        rating: calculateProviderRating(loadOrders()),
        verificationStatus: providerProfile.status
      });
      saveRoutes(routes);
      this.reset();
      navigateToSection("home");
      showPageAlert("Rute berhasil dipublikasikan dan sudah tampil di daftar aktif");
    });

    $("#reset-demo-data").on("click", function () {
      resetJasKanLocalData();
    });

    $("#logout-account").on("click", logout);

    $(".route-time-input").on("input", function () {
      this.value = formatRouteTimeInput(this.value);
    }).on("blur", function () {
      var normalized = normalizeRouteTime(this.value);
      if (normalized) {
        this.value = normalized;
      }
    });

    $("#identity-document, #vehicle-document").on("change", function () {
      var target = this.id === "identity-document" ? "#identity-file-name" : "#vehicle-file-name";
      $(target).text(this.files && this.files[0] ? this.files[0].name : "Belum ada file dipilih");
    });

    $("#verification-form").on("submit", function (event) {
      event.preventDefault();
      var mode = String($(this).data("verification-mode"));
      var identityFile = document.getElementById("identity-document").files[0];
      var vehicleInput = document.getElementById("vehicle-document");
      var vehicleFile = vehicleInput && vehicleInput.files[0];
      if (!identityFile) {
        showPageAlert("Pilih foto KTP atau KTM terlebih dahulu", "warning");
        return;
      }
      if (mode === "penyedia" && !vehicleFile) {
        showPageAlert("Pilih foto kendaraan atau pelat nomor terlebih dahulu", "warning");
        return;
      }
      var submittedAt = Date.now();
      var verification = {
        status: "Menunggu Verifikasi",
        documents: {
          identityName: identityFile.name,
          vehicleName: vehicleFile ? vehicleFile.name : ""
        },
        submittedAt: new Date(submittedAt).toISOString(),
        dueAt: submittedAt + 4000,
        completedAt: ""
      };
      saveVerificationData(mode, verification);
      renderSection("profile");
      showPageAlert("Dokumen verifikasi berhasil diajukan.");
      scheduleVerification(mode);
    });

    $(".payment-proof-input").on("change", function () {
      var file = this.files && this.files[0];
      $(this).closest(".payment-proof-form").find(".payment-proof-name").text(file ? file.name : "Belum ada file dipilih");
    });

    $(".payment-proof-form").on("submit", function (event) {
      event.preventDefault();
      var form = this;
      var file = $(form).find(".payment-proof-input")[0].files[0];
      if (!file) {
        showPageAlert("Pilih gambar bukti bayar terlebih dahulu", "warning");
        return;
      }
      readLocalImage(file, function (proof) {
        updateOrder($(form).data("order-id"), function (order) {
          order.paymentProof = proof;
          order.paymentStatus = "Bukti Bayar Terlampir";
          order.updatedAt = new Date().toISOString();
        });
        renderSection("activity");
        showPageAlert("Bukti bayar berhasil dilampirkan");
      });
    });

    $(".review-form").on("submit", function (event) {
      event.preventDefault();
      var form = $(this);
      var rating = Number(form.find(".review-rating").val());
      var reviewText = form.find(".review-text").val().trim();
      if (rating < 1 || rating > 5 || !reviewText) {
        showPageAlert("Pilih rating dan tulis ulasan singkat", "warning");
        return;
      }
      updateOrder(form.data("order-id"), function (order) {
        order.review = {
          rating: rating,
          text: reviewText,
          createdAt: new Date().toISOString()
        };
      });
      renderSection("activity");
      showPageAlert("Rating dan ulasan berhasil disimpan");
    });

    $(".profile-setting").on("click", function () {
      $(".profile-setting").removeClass("active");
      $(this).addClass("active");
      $("#profile-editor").html(renderProfileDetail($(this).data("profile-action")));
      bindProfileFormEvents();
    });
  }

  function bindProfileFormEvents() {
    $(".profile-form").attr("novalidate", "novalidate");

    $(".profile-cancel").on("click", function () {
      $(".profile-setting").removeClass("active");
      $("#profile-editor").html(renderProfileDetail("overview"));
    });

    $(".profile-form").on("submit", function (event) {
      event.preventDefault();
      var action = $(this).data("profile-form");
      var message = "Profil berhasil diperbarui";
      var value = "";

      if (action === "name") {
        value = $("#profile-name").val().trim();
        if (!value) {
          showPageAlert("Nama tidak boleh kosong", "warning");
          return;
        }
        saveProfileData("name", value);
        updateCurrentAccount("name", value);
        message = "Nama berhasil diperbarui";
      } else if (action === "phone") {
        value = $("#profile-phone").val().trim();
        if (!value) {
          showPageAlert("Nomor telepon tidak boleh kosong", "warning");
          return;
        }
        saveProfileData("phone", value);
        updateCurrentAccount("phone", normalizePhone(value));
        message = "Nomor telepon berhasil diperbarui";
      } else if (action === "address") {
        value = $("#profile-address").val().trim();
        if (!value) {
          showPageAlert("Alamat pengantaran tidak boleh kosong", "warning");
          return;
        }
        saveProfileData("address", value);
        message = "Alamat pengantaran berhasil diperbarui";
      } else if (action === "route") {
        value = $("#profile-route").val().trim();
        if (!value) {
          showPageAlert("Rute utama tidak boleh kosong", "warning");
          return;
        }
        saveProfileData("primaryRoute", value);
        message = "Rute utama berhasil diperbarui";
      } else if (action === "notifications") {
        var notifications = {};
        $("[data-notification-key]").each(function () {
          notifications[$(this).data("notification-key")] = $(this).is(":checked");
        });
        saveProfileData("notifications", notifications);
        message = "Pengaturan notifikasi berhasil diperbarui";
      }

      renderSection("profile");
      showPageAlert(message);
    });
  }

  function navigateToSection(section) {
    window.location.hash = section;
    renderSection(section);
    var navbarMenu = document.getElementById("main-nav");
    if (navbarMenu && navbarMenu.classList.contains("show") && window.bootstrap) {
      bootstrap.Collapse.getOrCreateInstance(navbarMenu).hide();
    }
  }

  function updateOrder(orderId, updater) {
    var orders = loadOrders();
    var order = orders.find(function (item) { return item.id === orderId; });
    if (!order) {
      return null;
    }
    updater(order);
    saveOrders(orders);
    return order;
  }

  function updateCurrentAccount(key, value) {
    var session = getSession();
    if (!session) {
      return;
    }
    var accounts = loadAccounts();
    var account = accounts.find(function (item) { return item.id === session.accountId; });
    if (!account) {
      return;
    }
    account[key] = value;
    saveAccounts(accounts);
    ["pemesan", "penyedia"].forEach(function (mode) {
      var storageKey = PROFILE_STORAGE_PREFIX + mode;
      var profile = {};
      try {
        profile = JSON.parse(localStorage.getItem(storageKey)) || {};
      } catch (error) {
        profile = {};
      }
      profile[key] = value;
      localStorage.setItem(storageKey, JSON.stringify(profile));
    });
  }

  function readLocalImage(file, callback) {
    var proof = {
      fileName: file.name,
      fileType: file.type,
      preview: ""
    };
    var maxFileSize = 8 * 1024 * 1024;
    if (file.size > maxFileSize) {
      showPageAlert("Ukuran file terlalu besar. Gunakan gambar yang lebih kecil.", "warning");
      return;
    }
    if (!file.type.match(/^image\//)) {
      callback(proof);
      return;
    }
    var reader = new FileReader();
    reader.onload = function (event) {
      var image = new Image();
      image.onload = function () {
        var maxDimension = 900;
        var scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        var context = canvas.getContext("2d");
        if (!context) {
          callback(proof);
          return;
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        try {
          var preview = canvas.toDataURL("image/jpeg", 0.78);
          if (preview.length <= 700000) {
            proof.preview = preview;
          }
        } catch (error) {
          proof.preview = "";
        }
        callback(proof);
      };
      image.onerror = function () {
        callback(proof);
      };
      image.src = event.target.result;
    };
    reader.onerror = function () {
      callback(proof);
    };
    reader.readAsDataURL(file);
  }

  function getProofFileName(proof) {
    return proof ? (proof.fileName || proof.name || "") : "";
  }

  function getProofPreview(proof) {
    return proof ? (proof.preview || proof.dataUrl || "") : "";
  }

  function copyTextToClipboard(value, callback) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(value).then(function () {
        callback(true);
      }).catch(function () {
        copyTextWithFallback(value, callback);
      });
      return;
    }
    copyTextWithFallback(value, callback);
  }

  function copyTextWithFallback(value, callback) {
    var input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    var copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    }
    document.body.removeChild(input);
    callback(copied);
  }

  function renderFilePreview(proof) {
    var preview = getProofPreview(proof);
    var fileName = getProofFileName(proof);
    return (preview ? '<img src="' + preview + '" alt="Pratinjau ' + escapeHtml(fileName) + '">' : '<i class="bi bi-file-earmark-image"></i>') +
      '<span><strong>' + escapeHtml(fileName) + '</strong><small>' + (preview ? "Siap dilampirkan" : "Pratinjau tidak tersedia") + "</small></span>";
  }

  function renderEmptyState(message) {
    return '<div class="col-12"><div class="card app-card"><div class="card-body empty-state">' +
      '<span class="empty-state-icon"><i class="bi bi-inbox"></i></span><h3 class="h5 fw-bold mb-2">Belum ada data</h3>' +
      '<p class="text-muted-app mb-0">' + escapeHtml(message) + '</p></div></div></div>';
  }

  function isCurrentRequesterOrder(order) {
    var account = getCurrentAccount();
    return order.requesterId === "current-requester" ||
      (account && order.requesterId === account.id) ||
      (!order.requesterId && order.image === "Pengguna.png");
  }

  function calculateProviderRating(orders) {
    var reviews = orders.filter(function (order) {
      return order.review && Number(order.review.rating) > 0;
    });
    if (!reviews.length) {
      return "4.8";
    }
    var total = reviews.reduce(function (sum, order) {
      return sum + Number(order.review.rating);
    }, 0);
    return (total / reviews.length).toFixed(1);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function formatRouteTime(value) {
    var time = normalizeRouteTime(value);
    if (!time) {
      return "-";
    }
    return time + " " + INDONESIA_TIME_LABEL;
  }

  function formatRouteTimeInput(value) {
    var raw = String(value || "").replace(/[^\d.:]/g, "").replace(":", ".");
    if (/^\d{4}$/.test(raw)) {
      return raw.slice(0, 2) + "." + raw.slice(2);
    }
    if (/^\d{2}\.\d{0,2}$/.test(raw)) {
      return raw.slice(0, 5);
    }
    return raw.slice(0, 5);
  }

  function normalizeRouteTime(value) {
    var raw = String(value || "").trim().replace(":", ".");
    if (/^\d{3,4}$/.test(raw)) {
      raw = raw.padStart(4, "0");
      raw = raw.slice(0, 2) + "." + raw.slice(2);
    }
    var match = raw.match(/^(\d{1,2})\.(\d{2})$/);
    if (!match) {
      return "";
    }
    var hour = Number(match[1]);
    var minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return "";
    }
    return String(hour).padStart(2, "0") + "." + String(minute).padStart(2, "0");
  }

  function routeTimeToMinutes(value) {
    var normalized = normalizeRouteTime(value);
    if (!normalized) {
      return NaN;
    }
    var parts = normalized.split(".");
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  function formatDate(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) {
      return "";
    }
    var parts = getIndonesiaDateParts(date, {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    return parts.day + " " + parts.month + " " + parts.year + ", " + parts.hour + "." + parts.minute + " " + INDONESIA_TIME_LABEL;
  }

  function formatTime(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) {
      return "";
    }
    var parts = getIndonesiaDateParts(date, {
      hour: "2-digit",
      minute: "2-digit"
    });
    return parts.hour + "." + parts.minute + " " + INDONESIA_TIME_LABEL;
  }

  function getIndonesiaDateParts(date, options) {
    var formatterOptions = Object.assign({}, options, {
      hour12: false,
      hourCycle: "h23",
      timeZone: INDONESIA_TIME_ZONE
    });
    return new Intl.DateTimeFormat("id-ID", formatterOptions).formatToParts(date).reduce(function (result, part) {
      if (part.type !== "literal") {
        result[part.type] = part.value;
      }
      return result;
    }, {});
  }

  function renderOrderTimestamp(order) {
    var value = order.updatedAt || order.createdAt;
    if (!value) {
      return "";
    }
    var label = order.updatedAt ? "Diperbarui " : "Dibuat ";
    return '<time class="order-timestamp" datetime="' + escapeHtml(value) + '">' + label + escapeHtml(formatDate(value)) + "</time>";
  }

  function getStatusBadgeClass(status) {
    var classes = {
      "Menunggu konfirmasi": "text-bg-warning",
      "Diterima": "text-bg-primary",
      "Ditolak": "text-bg-danger",
      "Dalam proses": "text-bg-info",
      "Selesai": "text-bg-success"
    };
    return classes[status] || "text-bg-secondary";
  }

  function paymentNeedsProof(method) {
    return method === "QRIS" || method === "E-Wallet / DANA" || method === "E-Wallet" || method === "Transfer Bank";
  }

  function getOrderPaymentMethod(order) {
    if (order.paymentMethod === "E-Wallet") {
      return "E-Wallet / DANA";
    }
    var validMethods = ["QRIS", "E-Wallet / DANA", "Transfer Bank", "Bayar di Tempat / Tunai"];
    if (validMethods.indexOf(order.paymentMethod) !== -1) {
      return order.paymentMethod;
    }
    return order.paymentProof ? "Transfer Bank" : "Bayar di Tempat / Tunai";
  }

  function getPaymentDestination(method) {
    var normalizedMethod = method === "E-Wallet" ? "E-Wallet / DANA" : method;
    return PAYMENT_DESTINATIONS[normalizedMethod] || {};
  }

  function renderPaymentDestinationSummary(method, destination) {
    if (method === "E-Wallet / DANA") {
      return '<div class="payment-destination-summary mt-2"><i class="bi bi-phone"></i><span><small>DANA</small><strong>' +
        escapeHtml(destination.number || "0812-3456-7890") + ' · ' + escapeHtml(destination.accountName || "JasKan Demo") + "</strong></span></div>";
    }
    if (method === "Transfer Bank") {
      return '<div class="payment-destination-summary mt-2"><i class="bi bi-bank"></i><span><small>' +
        escapeHtml(destination.bank || "BCA") + '</small><strong>' + escapeHtml(destination.number || "1234567890") + " · " +
        escapeHtml(destination.accountName || "JasKan Demo") + "</strong></span></div>";
    }
    if (method === "QRIS") {
      return '<div class="payment-destination-summary mt-2"><i class="bi bi-qr-code"></i><span><small>Tujuan Pembayaran</small><strong>QRIS JasKan</strong></span></div>';
    }
    return '<div class="payment-destination-summary mt-2"><i class="bi bi-cash-coin"></i><span><small>Pembayaran</small><strong>Pembayaran dilakukan saat barang diterima.</strong></span></div>';
  }

  function getOrderPaymentStatus(order) {
    var method = getOrderPaymentMethod(order);
    if (!paymentNeedsProof(method)) {
      return "Bayar di Tempat";
    }
    return order.paymentProof ? "Bukti Bayar Terlampir" : "Menunggu Pembayaran";
  }

  function getPaymentBadgeClass(status) {
    var classes = {
      "Menunggu Pembayaran": "text-bg-warning",
      "Bukti Bayar Terlampir": "text-bg-info",
      "Bayar di Tempat": "text-bg-success"
    };
    return classes[status] || "text-bg-secondary";
  }

  function getVerificationBadgeClass(status) {
    if (status === "Menunggu Verifikasi" || status === "Menunggu verifikasi") {
      return "verification-status-badge verification-status-waiting";
    }
    if (status === "Pemesan Terverifikasi" || status === "Penyedia Terverifikasi" ||
        status === "Pemesan terverifikasi" || status === "Penyedia terverifikasi") {
      return "verification-status-badge verification-status-complete";
    }
    return "verification-status-badge verification-status-unverified";
  }

  function scheduleVerification(mode) {
    window.clearTimeout(verificationTimers[mode]);
    var verification = loadVerificationData(mode);
    if (verification.status !== "Menunggu Verifikasi" || !verification.dueAt) {
      return;
    }
    var delay = Math.max(0, Number(verification.dueAt) - Date.now());
    verificationTimers[mode] = window.setTimeout(function () {
      completeVerification(mode);
    }, delay);
  }

  function completeVerification(mode) {
    var verification = loadVerificationData(mode);
    if (verification.status !== "Menunggu Verifikasi" || !verification.dueAt) {
      return;
    }
    if (Date.now() < Number(verification.dueAt)) {
      scheduleVerification(mode);
      return;
    }
    verification.status = getVerifiedStatus(mode);
    verification.completedAt = new Date().toISOString();
    verification.dueAt = 0;
    saveVerificationData(mode, verification);
    if (currentMode === mode && currentSection === "profile") {
      renderSection("profile");
    }
    showPageAlert("Akun " + mode + " berhasil terverifikasi.");
  }

  function filterRoutes(keyword) {
    var query = String(keyword || "").trim().toLowerCase();
    var visible = 0;
    $(".route-item").each(function () {
      var match = $(this).data("search").indexOf(query) !== -1;
      $(this).toggleClass("d-none", !match);
      if (match) {
        visible += 1;
      }
    });
    if (query && visible === 0) {
      showPageAlert("Rute yang dicari belum tersedia", "warning");
    }
  }

  function handleOrderAction(button) {
    var orderId = button.data("order");
    var action = button.data("action");
    var orders = loadOrders();
    var order = orders.find(function (item) { return item.id === orderId; });
    if (!order) {
      showPageAlert("Pesanan tidak ditemukan", "warning");
      return;
    }
    var message = "";
    var alertType = "success";
    if (action === "accept") {
      order.status = "Diterima";
      message = "Pesanan diterima dan masuk ke Aktivitas";
    } else if (action === "reject") {
      order.status = "Ditolak";
      message = "Pesanan telah ditolak";
      alertType = "warning";
    } else if (action === "process") {
      order.status = "Dalam proses";
      message = "Pesanan sedang diproses";
    } else if (action === "complete") {
      order.status = "Selesai";
      message = "Pesanan berhasil diselesaikan";
    }
    order.updatedAt = new Date().toISOString();
    saveOrders(orders);
    renderSection(currentSection);
    showPageAlert(message, alertType);
  }

  function resetJasKanLocalData() {
    var confirmationMessage = "Pulihkan data awal? Semua data lokal seperti akun, rute, pesanan, pesan, bukti bayar, dan verifikasi akan dihapus dari perangkat ini.";
    if (!window.confirm(confirmationMessage)) {
      return;
    }
    Object.keys(localStorage).forEach(function (key) {
      var normalizedKey = key.toLowerCase();
      if (normalizedKey.indexOf("jaskan_") === 0 || normalizedKey.indexOf("jaskan-") === 0) {
        localStorage.removeItem(key);
      }
    });
    localStorage.setItem(STORAGE_KEY, "pemesan");
    sessionStorage.setItem("jaskan_reset_notice", "Data lokal berhasil dipulihkan.");
    window.location.reload();
  }

  function showPageAlert(message, type) {
    var alertType = type || "success";
    var container = $("#page-alert-container");
    if (!container.length) {
      return;
    }
    window.clearTimeout(pageAlertTimer);
    container.html('<div class="alert alert-' + alertType + ' alert-dismissible fade show py-2 px-3 mb-0" role="alert">' +
      escapeHtml(message) + '<button type="button" class="btn-close py-2" data-bs-dismiss="alert" aria-label="Tutup"></button></div>');
    pageAlertTimer = window.setTimeout(function () {
      container.find(".alert").fadeOut(200, function () {
        container.empty();
      });
    }, 2600);
  }

  function bindNavigation() {
    $("[data-section]:not([data-profile-switch])").on("click", function () {
      navigateToSection($(this).data("section"));
    });

    $("[data-profile-switch]").on("dblclick", function (event) {
      event.preventDefault();
      if (Date.now() < suppressProfileClickUntil) {
        return;
      }
      suppressProfileClickUntil = Date.now() + 500;
      toggleMode();
    });

    $("[data-profile-switch]").on("click", function (event) {
      event.preventDefault();
      var now = Date.now();
      if (now < suppressProfileClickUntil) {
        return;
      }
      if (now - lastProfileTap <= 420) {
        lastProfileTap = 0;
        suppressProfileClickUntil = now + 500;
        toggleMode();
        return;
      }
      lastProfileTap = now;
      navigateToSection("profile");
    });

    $(window).on("hashchange", function () {
      var section = window.location.hash.replace("#", "") || "home";
      if (section !== currentSection) {
        renderSection(section);
      }
    });
  }

  window.getCurrentMode = getCurrentMode;
  window.setMode = setMode;
  window.toggleMode = toggleMode;
  window.renderMode = renderMode;
  window.showPageAlert = showPageAlert;
  window.renderProfileDetail = renderProfileDetail;
  window.saveProfileData = saveProfileData;
  window.loadProfileData = loadProfileData;
  window.resetJasKanLocalData = resetJasKanLocalData;

  $(function () {
    bindNavigation();
    var resetNotice = sessionStorage.getItem("jaskan_reset_notice");
    if (resetNotice) {
      sessionStorage.removeItem("jaskan_reset_notice");
      loadRoutes();
      loadOrders();
      loadMessages();
    }
    var account = getCurrentAccount();
    if (!account) {
      renderAuth("login", resetNotice || "", resetNotice ? "success" : "");
      return;
    }
    syncAccountProfiles(account);
    scheduleVerification("pemesan");
    scheduleVerification("penyedia");
    renderMode();
    renderSection(window.location.hash.replace("#", "") || "home");
  });
})(jQuery);
