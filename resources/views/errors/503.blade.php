@extends('errors.layout')

@section('title', 'Sedang Pemeliharaan')
@section('code', 'PEMELIHARAAN')
@section('message', 'ISTURA sedang diperbarui untuk meningkatkan layanan. Halaman akan kembali normal dalam beberapa menit. Terima kasih atas kesabarannya.')

@section('head')
    {{-- Auto-refresh tiap 20 detik supaya pengunjung otomatis masuk kembali
         begitu pemeliharaan selesai, tanpa perlu refresh manual. --}}
    <meta http-equiv="refresh" content="20" />
@endsection
