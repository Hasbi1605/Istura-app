@extends('errors.layout')

@section('title', 'Terjadi Kesalahan')
@section('code', '500')
@section('message', 'Maaf, sistem sedang mengalami kendala. Tim kami sudah diberi tahu. Silakan coba beberapa saat lagi.')

@section('actions')
    <a href="/" class="error-button">Kembali ke Beranda</a>
@endsection
