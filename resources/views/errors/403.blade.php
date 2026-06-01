@extends('errors.layout')

@section('title', 'Akses Ditolak')
@section('code', '403')
@section('message', 'Anda tidak memiliki izin untuk mengakses halaman ini.')

@section('actions')
    <a href="/" class="error-button">Kembali ke Beranda</a>
@endsection
