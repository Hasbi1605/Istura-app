@extends('errors.layout')

@section('title', 'Sesi Kedaluwarsa')
@section('code', '419')
@section('message', 'Sesi Anda telah berakhir demi keamanan. Silakan muat ulang halaman dan coba lagi.')

@section('actions')
    <a href="/" class="error-button">Muat Ulang</a>
@endsection
