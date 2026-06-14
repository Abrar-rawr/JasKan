(function ($) {
  "use strict";

  var STORAGE_KEY = "jaskan_mode";
  var ROUTES_STORAGE_KEY = "jaskan_routes";
  var ORDERS_STORAGE_KEY = "jaskan_orders";
  var INDONESIA_TIME_ZONE = "Asia/Makassar";
  var INDONESIA_TIME_LABEL = "WITA";
  var currentMode = getStoredMode();
  var root = document.body.dataset.root || "";
  var currentSection = "home";
  var selectedRouteId = "";
  var lastProfileTap = 0;
  var suppressProfileClickUntil = 0;
  var pageAlertTimer = null;
  var PROFILE_STORAGE_PREFIX = "jaskan_profile_";

  var profileDefaults = {
    pemesan: {
      name: "User123",
      phone: "0812-3456-xxxx",
      address: "Jl. Brigjen H. Hasan Basri, Banjarmasin",
      serviceArea: "Kampus ULM Banjarmasin - Kayu Tangi",
      coordination: "WhatsApp aktif untuk koordinasi titipan",
      status: "Pemesan terverifikasi",
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
      serviceArea: "Kampus ULM, Kayu Tangi, Sultan Adam, dan sekitarnya",
      primaryRoute: "Kampus ULM → Gambut / Banjarbaru sesuai rute aktif",
      coordination: "WhatsApp aktif untuk konfirmasi titik temu",
      status: "Penyedia terverifikasi",
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
    { id: "route-budi", providerName: "Budi", image: "Budi.png", start: "Hasan Basri", destination: "Gambut", departure: "15:30", cutoff: "15:00", notes: "Bisa menerima dokumen, makanan, dan paket ringan.", rating: "4.8" },
    { id: "route-siti", providerName: "Siti", image: "Siti.png", start: "Sungai Andai", destination: "Banjarbaru", departure: "16:00", cutoff: "15:20", notes: "Titik temu dapat disesuaikan di sekitar kampus.", rating: "4.9" },
    { id: "route-irfan", providerName: "Irfan", image: "Irfan.png", start: "Kayu Tangi", destination: "Kampus ULM", departure: "13:00", cutoff: "12:30", notes: "Cocok untuk keperluan kampus dan alat tulis.", rating: "4.7" }
  ];

  var defaultOrders = [
    { id: "order-adit", requesterName: "Adit", image: "Adit.png", itemName: "Ambil Sertifikat", maxPrice: 15000, address: "Fakultas Teknik, Gedung B", notes: "Mohon dibawa dalam map agar tidak terlipat.", routeId: "route-irfan", routeLabel: "Kayu Tangi → Kampus ULM", status: "Menunggu konfirmasi", createdAt: "2026-06-10T08:00:00.000Z" },
    { id: "order-irfan", requesterName: "Irfan", image: "Irfan.png", itemName: "Kopi dan Snack", maxPrice: 25000, address: "Gerbang utama Kampus ULM", notes: "Kopi tanpa gula dan satu roti.", routeId: "route-budi", routeLabel: "Hasan Basri → Gambut", status: "Diterima", createdAt: "2026-06-11T09:30:00.000Z" }
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
    return loadCollection(ROUTES_STORAGE_KEY, defaultRoutes);
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
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    return '<div class="app-section">' + content + "</div>";
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
      return '<section class="page-heading">' +
        '<span class="badge mode-badge mb-2">Cari penyedia yang searah</span>' +
        '<h1 class="display-6 fw-bold">Mau titip apa hari ini?</h1>' +
        '<p class="lead mb-0">Temukan rute aktif di sekitar kampus dan kirim kebutuhanmu dengan mudah.</p></section>' +
        '<section class="card app-card mb-4"><div class="card-body p-3 p-md-4">' +
        '<label for="route-search" class="form-label fw-bold">Cari rute tujuan</label><div class="input-group">' +
        '<input id="route-search" class="form-control" type="search" placeholder="Contoh: Gambut atau Banjarbaru">' +
        '<button class="btn btn-theme" id="search-route" type="button">Cari</button></div></div></section>' +
        '<div class="d-flex justify-content-between align-items-center mb-3"><div><h2 class="h4 fw-bold mb-1">Rute Aktif</h2>' +
        '<p class="text-muted-app mb-0">Penyedia yang siap menerima titipan.</p></div><span class="badge mode-badge">' + routes.length + ' rute</span></div>' +
        '<section id="route-list" class="row g-4">' + routes.map(renderRouteCard).join("") + "</section>";
    }

    return '<section class="page-heading"><span class="badge mode-badge mb-2">Kelola perjalanan jastip</span>' +
      '<h1 class="display-6 fw-bold">Siap buka rute hari ini?</h1>' +
      '<p class="lead mb-0">Bagikan rute perjalananmu dan kelola pesanan kampus yang masuk.</p></section>' +
      '<div class="d-grid d-sm-flex mb-4"><button class="btn btn-theme btn-lg px-4 section-link" data-target="form">Buka Rute Baru</button></div>' +
      '<div class="d-flex justify-content-between align-items-center mb-3"><div><h2 class="h4 fw-bold mb-1">Rute Aktif</h2>' +
      '<p class="text-muted-app mb-0">Rute yang sedang tersedia untuk pemesan.</p></div><span class="badge mode-badge">' + routes.length + ' rute</span></div>' +
      '<section class="row g-4 mb-5">' + routes.map(renderProviderRouteSummary).join("") + "</section>" +
      '<div class="d-flex justify-content-between align-items-center mb-3"><div><h2 class="h4 fw-bold mb-1">Pesanan Masuk</h2>' +
      '<p class="text-muted-app mb-0">Pilih pesanan yang sesuai dengan rutemu.</p></div><span class="badge mode-badge">' + orders.filter(function (order) { return order.status === "Menunggu konfirmasi"; }).length + ' menunggu</span></div>' +
      '<section id="provider-orders" class="row g-4">' + (orders.length ? orders.map(renderProviderOrder).join("") : renderEmptyState("Belum ada pesanan masuk.")) + "</section>";
  }

  function renderRouteCard(route) {
    var providerImage = route.image || "Penyedia.png";
    var searchText = [route.providerName, route.start, route.destination, route.notes].join(" ").toLowerCase();
    return '<div class="col-12 col-md-6 col-xl-4 route-item" data-search="' + escapeHtml(searchText) + '">' +
      '<article class="card app-card"><div class="card-body p-4 d-flex flex-column">' +
      '<div class="d-flex gap-3 mb-3"><img class="route-avatar" src="' + root + 'Asset/' + providerImage + '" alt="Foto ' + escapeHtml(route.providerName) + '">' +
      '<div><div class="d-flex align-items-center gap-2"><h3 class="h5 fw-bold mb-0">' + escapeHtml(route.providerName) + '</h3><span class="badge mode-badge">' + escapeHtml(route.rating || "4.8") + '</span></div>' +
      '<p class="small text-muted-app mb-0">Penyedia terverifikasi</p></div></div>' +
      '<div class="route-path mb-3"><span>' + escapeHtml(route.start) + '</span><strong>→</strong><span>' + escapeHtml(route.destination) + '</span></div>' +
      '<div class="row g-2 small mb-3"><div class="col-6"><div class="soft-panel p-2 h-100"><span class="d-block text-muted-app">Berangkat</span><strong>' + escapeHtml(formatRouteTime(route.departure)) + '</strong></div></div>' +
      '<div class="col-6"><div class="soft-panel p-2 h-100"><span class="d-block text-muted-app">Batas titip</span><strong>' + escapeHtml(formatRouteTime(route.cutoff)) + '</strong></div></div></div>' +
      '<p class="text-muted-app small flex-grow-1 mb-3">' + escapeHtml(route.notes) + '</p>' +
      '<button class="btn btn-theme w-100 choose-route" data-route-id="' + escapeHtml(route.id) + '">Titip Sekarang</button></div></article></div>';
  }

  function renderProviderRouteSummary(route) {
    return '<div class="col-12 col-md-6 col-xl-4"><article class="card app-card"><div class="card-body p-4">' +
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
    return '<div class="col-12 col-lg-6" id="' + escapeHtml(order.id) + '"><article class="card app-card status-strip"><div class="card-body p-4">' +
      '<div class="d-flex gap-3 align-items-center mb-3"><img class="chat-avatar" src="' + root + 'Asset/' + escapeHtml(order.image || "Pengguna.png") + '" alt="Foto ' + escapeHtml(order.requesterName) + '">' +
      '<div class="flex-grow-1"><h3 class="h5 fw-bold mb-0">' + escapeHtml(order.requesterName) + '</h3><span class="text-muted-app small">' + escapeHtml(order.address) + '</span></div>' +
      '<span class="badge ' + getStatusBadgeClass(order.status) + '">' + escapeHtml(order.status) + '</span></div>' +
      '<div class="soft-panel p-3 mb-3"><div class="d-flex justify-content-between gap-3"><p class="fw-bold mb-1">' + escapeHtml(order.itemName) + '</p><strong class="text-theme">' + formatCurrency(order.maxPrice) + '</strong></div>' +
      '<p class="small mb-1">' + escapeHtml(order.routeLabel) + '</p><p class="small text-muted-app mb-0">' + escapeHtml(order.notes || "Tidak ada catatan tambahan.") + '</p></div>' + actions + '</div></article></div>';
  }

  function renderActivity() {
    var orders = loadOrders();
    if (currentMode === "pemesan") {
      return '<section class="page-heading"><span class="badge mode-badge mb-2">Riwayat titipan</span><h1 class="display-6 fw-bold">Aktivitas Pemesan</h1>' +
        '<p class="lead mb-0">Pantau titipan yang sedang berjalan dan pesanan sebelumnya.</p></section>' +
        '<section class="row g-4">' + (orders.length ? orders.map(renderRequesterActivityCard).join("") : renderEmptyState("Belum ada titipan. Pilih rute aktif untuk membuat pesanan pertama.")) + "</section>";
    }

    var providerTasks = orders.filter(function (order) {
      return order.status === "Diterima" || order.status === "Dalam proses" || order.status === "Selesai";
    });
    return '<section class="page-heading"><span class="badge mode-badge mb-2">Tugas pengantaran</span><h1 class="display-6 fw-bold">Aktivitas Penyedia</h1>' +
      '<p class="lead mb-0">Pantau tugas aktif dan selesaikan pengantaran sesuai rute.</p></section>' +
      '<section class="row g-4">' + (providerTasks.length ? providerTasks.map(renderProviderActivityCard).join("") : renderEmptyState("Belum ada tugas aktif. Terima pesanan dari halaman Beranda.")) + "</section>";
  }

  function renderRequesterActivityCard(order) {
    return '<div class="col-12 col-lg-6"><article class="card app-card status-strip"><div class="card-body p-4">' +
      '<div class="d-flex flex-wrap justify-content-between gap-2 mb-3"><div><span class="badge ' + getStatusBadgeClass(order.status) + ' mb-2">' + escapeHtml(order.status) + '</span>' +
      '<h2 class="h5 fw-bold mb-1">' + escapeHtml(order.itemName) + '</h2><span class="small text-muted-app">' + escapeHtml(formatDate(order.createdAt)) + '</span></div><strong class="text-theme">' + formatCurrency(order.maxPrice) + '</strong></div>' +
      '<div class="soft-panel p-3"><p class="small fw-bold mb-1">' + escapeHtml(order.routeLabel) + '</p><p class="small mb-1">' + escapeHtml(order.address) + '</p>' +
      '<p class="small text-muted-app mb-0">' + escapeHtml(order.notes || "Tidak ada catatan tambahan.") + '</p></div></div></article></div>';
  }

  function renderProviderActivityCard(order) {
    var actions = "";
    if (order.status === "Diterima") {
      actions = '<div class="d-grid d-sm-flex gap-2 mt-3"><button class="btn btn-outline-theme flex-fill order-action" data-action="process" data-order="' + escapeHtml(order.id) + '">Mulai Proses</button>' +
        '<button class="btn btn-theme flex-fill order-action" data-action="complete" data-order="' + escapeHtml(order.id) + '">Konfirmasi Selesai</button></div>';
    } else if (order.status === "Dalam proses") {
      actions = '<button class="btn btn-theme w-100 mt-3 order-action" data-action="complete" data-order="' + escapeHtml(order.id) + '">Konfirmasi Selesai</button>';
    }
    return '<div class="col-12 col-lg-6"><article class="card app-card status-strip"><div class="card-body p-4">' +
      '<div class="d-flex flex-wrap justify-content-between gap-2 mb-3"><div><span class="badge ' + getStatusBadgeClass(order.status) + ' mb-2">' + escapeHtml(order.status) + '</span>' +
      '<h2 class="h5 fw-bold mb-1">' + escapeHtml(order.itemName) + '</h2><span class="small text-muted-app">Pemesan: ' + escapeHtml(order.requesterName) + '</span></div><strong class="text-theme">' + formatCurrency(order.maxPrice) + '</strong></div>' +
      '<div class="soft-panel p-3"><p class="small fw-bold mb-1">' + escapeHtml(order.routeLabel) + '</p><p class="small mb-1">' + escapeHtml(order.address) + '</p>' +
      '<p class="small text-muted-app mb-0">' + escapeHtml(order.notes || "Tidak ada catatan tambahan.") + '</p></div>' + actions + '</div></article></div>';
  }

  function renderInbox() {
    var partner = currentMode === "pemesan" ? "Budi" : "Adit";
    var image = currentMode === "pemesan" ? "Budi.png" : "Adit.png";
    var theirMessage = currentMode === "pemesan"
      ? "Iya kak, sebentar lagi saya sampai di titik temu."
      : "Halo kak, ruang pengambilan sertifikat ada di Gedung B.";
    var myMessage = currentMode === "pemesan"
      ? "Baik, saya tunggu di depan fakultas."
      : "Siap, ruangannya sudah ditemukan.";

    return '<section class="page-heading"><span class="badge mode-badge mb-2">Pesan pesanan</span><h1 class="display-6 fw-bold">Inbox</h1>' +
      '<p class="lead mb-0">Koordinasikan titik temu dan perkembangan pesanan.</p></section><div class="row g-4">' +
      '<div class="col-12 col-md-4"><article class="card app-card"><div class="card-body p-3"><h2 class="h5 fw-bold px-2 pt-2">Percakapan</h2>' +
      '<div class="soft-panel p-3 mt-2"><div class="d-flex gap-3 align-items-center"><img class="chat-avatar" src="' + root + 'Asset/' + image + '" alt="Foto ' + partner + '">' +
      '<div><strong>' + partner + '</strong><small class="d-block text-muted-app">Pesanan aktif</small></div></div></div></div></article></div>' +
      '<div class="col-12 col-md-8"><article class="card app-card chat-window"><div class="card-header bg-white p-3 d-flex gap-3 align-items-center">' +
      '<img class="chat-avatar" src="' + root + 'Asset/' + image + '" alt="Foto ' + partner + '"><div><strong>' + partner + '</strong><small class="d-block text-success">Aktif sekarang</small></div></div>' +
      '<div class="card-body chat-messages" id="chat-messages"><div class="chat-bubble theirs mb-3">' + theirMessage + '</div><div class="chat-bubble mine mb-3">' + myMessage + '</div></div>' +
      '<div class="card-footer bg-white p-3"><form id="chat-form" class="input-group"><label for="chat-input" class="visually-hidden">Ketik pesan</label>' +
      '<input id="chat-input" class="form-control" type="text" placeholder="Ketik pesan..." required><button class="btn btn-theme" type="submit">Kirim</button></form></div></article></div></div>';
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
        '<div class="card-body p-4 p-md-5"><div class="row g-4"><div class="col-12"><label for="item-name" class="form-label fw-bold">Nama barang</label>' +
        '<input id="item-name" class="form-control" required placeholder="Contoh: Cetak makalah 20 lembar"></div><div class="col-12 col-md-6">' +
        '<label for="price" class="form-label fw-bold">Estimasi harga maksimal</label><input id="price" class="form-control" type="number" min="1" required placeholder="Contoh: 50000"></div>' +
        '<div class="col-12 col-md-6"><label for="request-route" class="form-label fw-bold">Pilih rute</label><select id="request-route" class="form-select" required>' +
        '<option value="">Pilih rute aktif</option>' + routeOptions + '</select></div>' +
        '<div class="col-12"><label for="meeting-point" class="form-label fw-bold">Alamat atau titik antar</label><input id="meeting-point" class="form-control" required value="' + escapeHtml(loadProfileData().address) + '" placeholder="Contoh: Gerbang Fakultas Teknik"></div>' +
        '<div class="col-12"><label for="request-notes" class="form-label fw-bold">Catatan tambahan</label><textarea id="request-notes" class="form-control" rows="3" required placeholder="Tuliskan jumlah, ukuran, atau detail barang"></textarea></div>' +
        '<div class="col-12 d-grid d-sm-flex justify-content-sm-end"><button class="btn btn-theme btn-lg px-5" type="submit">Kirim Titipan</button></div></div></div></form>';
    }

    return '<section class="page-heading"><span class="badge mode-badge mb-2">Form buka rute</span><h1 class="display-6 fw-bold">Buka Rute Baru</h1>' +
      '<p class="lead mb-0">Bagikan perjalanan dan kapasitas titipan yang dapat kamu bawa.</p></section><form id="route-form" class="card app-card">' +
      '<div class="card-body p-4 p-md-5"><div class="row g-4"><div class="col-12 col-md-6"><label for="route-start" class="form-label fw-bold">Titik awal</label>' +
      '<input id="route-start" class="form-control" required placeholder="Contoh: Kampus ULM"></div><div class="col-12 col-md-6"><label for="route-destination" class="form-label fw-bold">Tujuan</label>' +
      '<input id="route-destination" class="form-control" required placeholder="Contoh: Banjarbaru"></div><div class="col-12 col-md-6">' +
      '<label for="departure" class="form-label fw-bold">Estimasi waktu berangkat (WITA)</label><input id="departure" class="form-control" type="time" step="300" required>' +
      '<div class="form-text">Gunakan waktu Indonesia Tengah dengan format 24 jam.</div></div>' +
      '<div class="col-12 col-md-6"><label for="route-cutoff" class="form-label fw-bold">Batas waktu titip (WITA)</label><input id="route-cutoff" class="form-control" type="time" step="300" required>' +
      '<div class="form-text">Batas titip sebaiknya lebih awal dari waktu berangkat.</div></div>' +
      '<div class="col-12"><label for="notes" class="form-label fw-bold">Catatan rute</label><textarea id="notes" class="form-control" rows="3" required placeholder="Contoh: Maksimal paket ukuran sedang"></textarea></div>' +
      '<div class="col-12 d-grid d-sm-flex justify-content-sm-end"><button class="btn btn-theme btn-lg px-5" type="submit">Publikasikan Rute</button></div></div></div></form>';
  }

  function renderProfile() {
    var requester = currentMode === "pemesan";
    var profile = loadProfileData();
    var image = requester ? "Pengguna.png" : "Penyedia.png";

    return '<section class="page-heading"><span class="badge mode-badge mb-2">Profil terhubung</span><h1 class="display-6 fw-bold">Profil Akun</h1>' +
      '<p class="lead mb-0">Kelola identitas, kontak, alamat, dan area layanan agar proses titip barang lebih jelas dan mudah dikoordinasikan.</p></section><div class="row g-4">' +
      '<div class="col-12 col-lg-4"><article class="card app-card text-center profile-summary-card"><div class="card-body p-4 p-md-5"><img class="profile-avatar mb-3" src="' + root + 'Asset/' + image + '" alt="Foto profil ' + escapeHtml(profile.name) + '">' +
      '<h2 class="h3 fw-bold">' + escapeHtml(profile.name) + '</h2><span class="badge mode-badge mb-3">' + escapeHtml(profile.status) + '</span><p class="profile-switch-hint mb-0">Ketuk Profil 2x untuk ganti mode</p>' +
      '<div class="row g-3 mt-3"><div class="col-6"><div class="soft-panel p-3"><small class="d-block">' + escapeHtml(profile.totalLabel) + '</small><strong class="fs-4">' + escapeHtml(profile.totalValue) + '</strong></div></div>' +
      '<div class="col-6"><div class="soft-panel p-3"><small class="d-block">' + escapeHtml(profile.reputationLabel) + '</small><strong class="fs-4">' + escapeHtml(profile.reputationValue) + '</strong></div></div></div></div></article></div>' +
      '<div class="col-12 col-lg-8"><article class="card app-card profile-information-card"><div class="card-body p-4"><div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">' +
      '<div><span class="profile-eyebrow">Informasi akun aktif</span><h2 class="h4 fw-bold mb-0">Informasi Profil</h2></div><span class="badge rounded-pill text-bg-success profile-status-badge">' + escapeHtml(profile.status) + '</span></div>' +
      renderProfileInformation(profile, requester) + '</div></article></div>' +
      '<div class="col-12 col-lg-4"><article class="card app-card"><div class="card-body p-3"><h2 class="h5 fw-bold px-2 pt-2">Kelola Profil</h2>' +
      '<div class="list-group list-group-flush profile-menu"><button class="btn list-group-item list-group-item-action text-start py-3 profile-setting" data-profile-action="name">Ubah Nama</button>' +
      '<button class="btn list-group-item list-group-item-action text-start py-3 profile-setting" data-profile-action="phone">Nomor Telepon</button>' +
      (requester
        ? '<button class="btn list-group-item list-group-item-action text-start py-3 profile-setting" data-profile-action="address">Alamat Pengantaran</button>'
        : '<button class="btn list-group-item list-group-item-action text-start py-3 profile-setting" data-profile-action="route">Rute Utama</button>') +
      '<button class="btn list-group-item list-group-item-action text-start py-3 profile-setting" data-profile-action="area">Area Layanan</button>' +
      '<button class="btn list-group-item list-group-item-action text-start py-3 profile-setting" data-profile-action="notifications">Pengaturan Notifikasi</button></div></div></article></div>' +
      '<div class="col-12 col-lg-8"><article class="card app-card profile-editor"><div class="card-body p-4" id="profile-editor">' + renderProfileDetail("overview") + '</div></article></div>' +
      '<div class="col-12 text-end"><button class="btn btn-sm btn-link text-secondary text-decoration-none" id="reset-demo-data" type="button">Reset Data Demo</button></div></div>';
  }

  function renderProfileInformation(profile, requester) {
    var items = requester
      ? [
        ["Nama Pengguna", profile.name],
        ["Nomor Telepon", profile.phone],
        ["Alamat Pengantaran", profile.address],
        ["Area Layanan", profile.serviceArea],
        ["Status Verifikasi", profile.status],
        ["Kontak Koordinasi", profile.coordination]
      ]
      : [
        ["Nama Penyedia", profile.name],
        ["Nomor Telepon", profile.phone],
        ["Area Layanan", profile.serviceArea],
        ["Rute Utama", profile.primaryRoute],
        ["Status Verifikasi", profile.status],
        ["Kontak Koordinasi", profile.coordination]
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

    if (section === "area") {
      return profileFormHeader("Area Layanan", requester ? "Tentukan lokasi utama untuk mencari dan menerima titipan." : "Tentukan wilayah yang dapat kamu jangkau saat membuka rute.") +
        '<form class="profile-form" data-profile-form="area"><label for="profile-area" class="form-label fw-bold">Area Layanan</label>' +
        '<textarea id="profile-area" class="form-control" rows="4" required>' + escapeHtml(profile.serviceArea) + '</textarea>' + profileFormActions("Simpan Area") + "</form>";
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

  function loadProfileData() {
    var defaults = profileDefaults[currentMode];
    var savedData = {};
    try {
      savedData = JSON.parse(localStorage.getItem(PROFILE_STORAGE_PREFIX + currentMode) || localStorage.getItem("jaskan-profile-" + currentMode)) || {};
    } catch (error) {
      savedData = {};
    }
    delete savedData.payment;
    delete savedData.vehicle;
    return $.extend(true, {}, defaults, savedData);
  }

  function saveProfileData(key, value) {
    var profile = loadProfileData();
    profile[key] = value;
    localStorage.setItem(PROFILE_STORAGE_PREFIX + currentMode, JSON.stringify(profile));
    localStorage.removeItem("jaskan-profile-" + currentMode);
  }

  function escapeHtml(value) {
    return $("<div>").text(String(value || "")).html();
  }

  function bindSectionEvents() {
    $(".section-link").on("click", function () {
      navigateToSection($(this).data("target"));
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

    $("#chat-form").on("submit", function (event) {
      event.preventDefault();
      var input = $("#chat-input");
      var text = input.val().trim();
      if (!text) {
        return;
      }
      $("#chat-messages").append($("<div>", { class: "chat-bubble mine mb-3", text: text }));
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
      if (!route || !itemName || !maxPrice || !address || !notes) {
        showPageAlert("Lengkapi seluruh data titipan terlebih dahulu", "warning");
        return;
      }
      var requesterProfile = loadProfileData();
      var orders = loadOrders();
      orders.unshift({
        id: "order-" + Date.now(),
        requesterName: requesterProfile.name,
        image: "Pengguna.png",
        itemName: itemName,
        maxPrice: maxPrice,
        address: address,
        notes: notes,
        routeId: route.id,
        routeLabel: route.start + " → " + route.destination,
        status: "Menunggu konfirmasi",
        createdAt: new Date().toISOString()
      });
      saveOrders(orders);
      this.reset();
      selectedRouteId = "";
      navigateToSection("activity");
      showPageAlert("Titipan berhasil dibuat dan dikirim ke penyedia");
    });

    $("#route-form").on("submit", function (event) {
      event.preventDefault();
      var start = $("#route-start").val().trim();
      var destination = $("#route-destination").val().trim();
      var departure = $("#departure").val();
      var cutoff = $("#route-cutoff").val();
      var notes = $("#notes").val().trim();
      if (!start || !destination || !departure || !cutoff || !notes) {
        showPageAlert("Lengkapi seluruh data rute terlebih dahulu", "warning");
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
        rating: providerProfile.reputationValue
      });
      saveRoutes(routes);
      this.reset();
      navigateToSection("home");
      showPageAlert("Rute berhasil dipublikasikan dan sudah tampil di daftar aktif");
    });

    $("#reset-demo-data").on("click", function () {
      resetJaskanData();
    });

    $(".profile-setting").on("click", function () {
      $(".profile-setting").removeClass("active");
      $(this).addClass("active");
      $("#profile-editor").html(renderProfileDetail($(this).data("profile-action")));
      bindProfileFormEvents();
    });
  }

  function bindProfileFormEvents() {
    $(".profile-cancel").on("click", function () {
      $(".profile-setting").removeClass("active");
      $("#profile-editor").html(renderProfileDetail("overview"));
    });

    $(".profile-form").on("submit", function (event) {
      event.preventDefault();
      var action = $(this).data("profile-form");
      var message = "Profil berhasil diperbarui";

      if (action === "name") {
        saveProfileData("name", $("#profile-name").val().trim());
        message = "Nama berhasil diperbarui";
      } else if (action === "phone") {
        saveProfileData("phone", $("#profile-phone").val().trim());
        message = "Nomor telepon berhasil diperbarui";
      } else if (action === "address") {
        saveProfileData("address", $("#profile-address").val().trim());
        message = "Alamat pengantaran berhasil diperbarui";
      } else if (action === "area") {
        saveProfileData("serviceArea", $("#profile-area").val().trim());
        message = "Area layanan berhasil diperbarui";
      } else if (action === "route") {
        saveProfileData("primaryRoute", $("#profile-route").val().trim());
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
    if (navbarMenu && navbarMenu.classList.contains("show")) {
      bootstrap.Collapse.getOrCreateInstance(navbarMenu).hide();
    }
  }

  function renderEmptyState(message) {
    return '<div class="col-12"><div class="card app-card"><div class="card-body p-4 text-center">' +
      '<h3 class="h5 fw-bold mb-2">Belum ada data</h3><p class="text-muted-app mb-0">' + escapeHtml(message) + '</p></div></div></div>';
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function formatRouteTime(value) {
    var time = String(value || "").trim();
    if (!time) {
      return "-";
    }
    return time.replace(":", ".") + " " + INDONESIA_TIME_LABEL;
  }

  function formatDate(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) {
      return "";
    }
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: INDONESIA_TIME_ZONE
    }).format(date).replace(" pukul ", ", ") + " " + INDONESIA_TIME_LABEL;
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
    saveOrders(orders);
    renderSection(currentSection);
    showPageAlert(message, alertType);
  }

  function resetJaskanData() {
    Object.keys(localStorage).forEach(function (key) {
      if (key.indexOf("jaskan") === 0) {
        localStorage.removeItem(key);
      }
    });
    currentMode = "pemesan";
    selectedRouteId = "";
    saveRoutes(cloneData(defaultRoutes));
    saveOrders(cloneData(defaultOrders));
    setMode(currentMode);
    renderMode();
    navigateToSection("profile");
    showPageAlert("Data JasKan telah dikembalikan ke kondisi awal");
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
      window.setTimeout(function () {
        if (lastProfileTap && Date.now() - lastProfileTap >= 400) {
          lastProfileTap = 0;
          navigateToSection("profile");
        }
      }, 430);
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

  $(function () {
    renderMode();
    bindNavigation();
    renderSection(window.location.hash.replace("#", "") || "home");
  });
})(jQuery);
