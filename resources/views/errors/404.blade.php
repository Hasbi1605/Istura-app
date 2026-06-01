@extends('errors.layout')

@section('title', 'Halaman Tidak Ditemukan')
@section('code', '404')
@section('message', 'Halaman yang Anda cari tidak ada atau sudah dipindahkan.')

@section('actions')
    <a href="/" class="error-button">Kembali ke Beranda</a>
@endsection
