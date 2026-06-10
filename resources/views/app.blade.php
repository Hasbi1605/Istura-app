<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    <title>{{ $seo['title'] }}</title>
    <meta name="description" content="{{ $seo['description'] }}" />
    <link rel="canonical" href="{{ $seo['canonicalUrl'] }}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="{{ $seo['siteName'] }}" />
    <meta property="og:title" content="{{ $seo['title'] }}" />
    <meta property="og:description" content="{{ $seo['description'] }}" />
    <meta property="og:url" content="{{ $seo['canonicalUrl'] }}" />
    <meta property="og:image" content="{{ $seo['image'] }}" />
    <meta property="og:image:secure_url" content="{{ $seo['image'] }}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1024" />
    <meta property="og:image:height" content="1280" />
    <meta property="og:image:alt" content="{{ $seo['imageAlt'] }}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{{ $seo['title'] }}" />
    <meta name="twitter:description" content="{{ $seo['description'] }}" />
    <meta name="twitter:image" content="{{ $seo['image'] }}" />
    <link rel="icon" type="image/webp" href="/assets/gedung-agung-gold.webp" />
    <link rel="preload" as="image" href="/assets/hero-istana.webp" fetchpriority="high" />
    <link rel="preload" as="image" href="/assets/miky-greeting.webp" fetchpriority="high" />
    <link rel="prefetch" as="image" href="/assets/miky-step-4.webp" />
    <link rel="prefetch" as="image" href="/assets/miky-hero-3.webp" />
    <script type="application/ld+json">{!! $structuredDataJson !!}</script>
    @viteReactRefresh
    @vite(['resources/js/main.tsx'])
</head>
<body>
    <div id="root">
        <noscript>
            <main aria-label="Ringkasan ISTURA">
                <h1>{{ $seoContent['headline'] }}</h1>
                <p>{{ $seoContent['subheadline'] }}</p>
                <p>{{ $seoContent['description'] }}</p>

                <section aria-labelledby="seo-schedule-title">
                    <h2 id="seo-schedule-title">{{ $seoContent['schedule']['title'] ?? 'Jadwal Kunjungan ISTURA' }}</h2>
                    <p>{{ $seoContent['schedule']['description'] ?? 'Cek slot tersedia sebelum booking kunjungan ISTURA.' }}</p>
                </section>

                @if (! empty($seoContent['quickInfo']['cards']))
                    <section aria-labelledby="seo-quick-info-title">
                        <h2 id="seo-quick-info-title">{{ $seoContent['quickInfo']['title'] }}</h2>
                        <p>{{ $seoContent['quickInfo']['description'] ?? '' }}</p>
                        <ul>
                            @foreach ($seoContent['quickInfo']['cards'] as $card)
                                <li>
                                    <strong>{{ $card['title'] }}</strong>
                                    <span>{{ $card['body'] }}</span>
                                    @if (! empty($card['points']))
                                        <span>{{ implode(', ', $card['points']) }}</span>
                                    @endif
                                </li>
                            @endforeach
                        </ul>
                    </section>
                @endif

                @if (! empty($seoContent['bookingSteps']['cards']))
                    <section aria-labelledby="seo-booking-title">
                        <h2 id="seo-booking-title">{{ $seoContent['bookingSteps']['title'] }}</h2>
                        <p>{{ $seoContent['bookingSteps']['story'] ?? '' }}</p>
                        <ol>
                            @foreach ($seoContent['bookingSteps']['cards'] as $step)
                                <li>
                                    <strong>{{ $step['title'] }}</strong>
                                    <span>{{ $step['body'] }}</span>
                                </li>
                            @endforeach
                        </ol>
                    </section>
                @endif

                @if (! empty($seoContent['rulesSection']['rulesList']))
                    <section aria-labelledby="seo-rules-title">
                        <h2 id="seo-rules-title">{{ $seoContent['rulesSection']['title'] }}</h2>
                        <p>{{ $seoContent['rulesSection']['description'] }}</p>
                        <ul>
                            @foreach ($seoContent['rulesSection']['rulesList'] as $rule)
                                <li>{{ $rule }}</li>
                            @endforeach
                        </ul>
                    </section>
                @endif

                @if (! empty($seoContent['letterSection']))
                    <section aria-labelledby="seo-letter-title">
                        <h2 id="seo-letter-title">{{ $seoContent['letterSection']['title'] }}</h2>
                        <p>{{ $seoContent['letterSection']['description'] }}</p>
                    </section>
                @endif

                @if (! empty($seoContent['activities']['items']))
                    <section aria-labelledby="seo-activities-title">
                        <h2 id="seo-activities-title">{{ $seoContent['activities']['title'] }}</h2>
                        <p>{{ $seoContent['activities']['description'] ?? '' }}</p>
                        <ul>
                            @foreach ($seoContent['activities']['items'] as $activity)
                                <li>
                                    <strong>{{ $activity['title'] }}</strong>
                                    <span>{{ $activity['body'] }}</span>
                                </li>
                            @endforeach
                        </ul>
                    </section>
                @endif

                <section aria-labelledby="seo-faq-title">
                    <h2 id="seo-faq-title">{{ $seoContent['faq']['title'] ?? 'Pertanyaan yang paling sering muncul.' }}</h2>
                    <p>{{ $seoContent['faq']['description'] ?? '' }}</p>
                    @foreach ($seoContent['faqs'] as $item)
                        <article>
                            <h3>{{ $item['question'] }}</h3>
                            <p>{{ $item['answer'] }}</p>
                        </article>
                    @endforeach
                </section>

                @if (! empty($seoContent['footer']['address']))
                    <section aria-labelledby="seo-location-title">
                        <h2 id="seo-location-title">Lokasi ISTURA Gedung Agung Yogyakarta</h2>
                        <p>{{ $seoContent['footer']['address'] }}</p>
                    </section>
                @endif
            </main>
        </noscript>
    </div>
</body>
</html>
