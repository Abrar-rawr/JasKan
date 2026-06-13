<?php
// Mengatur header agar response berupa JSON
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    // 1. Menerima variabel data dari AJAX jQuery
    $nama_barang = $_POST['nama_barang'] ?? '';
    $kategori    = $_POST['kategori'] ?? '';
    $estimasi    = $_POST['estimasi_harga'] ?? '';
    $titik_temu  = $_POST['titik_temu'] ?? '';
    $payment     = $_POST['payment_method'] ?? '';

    // Di sini biasanya ada proses query insert ke Database MySQL
    // ...

    // 2. Mengirim balasan kembali ke JavaScript
    echo json_encode([
        'status'  => 'success',
        'pesan'   => "Mantap! Pesanan '$nama_barang' untuk dikirim ke '$titik_temu' berhasil dikonfirmasi.",
        'id_resi' => 'JSK-' . time()
    ]);
} else {
    echo json_encode(['status' => 'error', 'pesan' => 'Gagal mengirim data']);
}
?>