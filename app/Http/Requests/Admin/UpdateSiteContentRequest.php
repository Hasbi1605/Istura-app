<?php

namespace App\Http\Requests\Admin;

use App\Rules\SafePublicUrl;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSiteContentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        $iconKeys = ['clock', 'file-check', 'message-circle', 'calendar', 'pen', 'upload', 'map-pin', 'image'];

        return [
            'nav' => ['required', 'array'],
            'nav.logoSrc' => ['nullable', 'string', 'max:500', SafePublicUrl::image()],
            'nav.logoAlt' => ['nullable', 'string', 'max:120'],
            'nav.brandText' => ['required', 'string', 'max:40'],
            'nav.ctaLabel' => ['required', 'string', 'max:48'],
            'nav.items' => ['required', 'array', 'min:1', 'max:8'],
            'nav.items.*.label' => ['required', 'string', 'max:48'],
            'nav.items.*.target' => ['required', 'string', 'max:120', SafePublicUrl::navTarget()],

            'quickInfo' => ['required', 'array'],
            'quickInfo.title' => ['required', 'string', 'max:160'],
            'quickInfo.description' => ['required', 'string', 'max:255'],
            'quickInfo.cards' => ['required', 'array', 'min:1', 'max:6'],
            'quickInfo.cards.*.iconKey' => ['required', Rule::in($iconKeys)],
            'quickInfo.cards.*.title' => ['required', 'string', 'max:80'],
            'quickInfo.cards.*.body' => ['required', 'string', 'max:255'],
            'quickInfo.cards.*.points' => ['required', 'array', 'min:1', 'max:6'],
            'quickInfo.cards.*.points.*' => ['required', 'string', 'max:120'],

            'schedule' => ['required', 'array'],
            'schedule.title' => ['required', 'string', 'max:160'],
            'schedule.description' => ['required', 'string', 'max:255'],

            'video' => ['required', 'array'],
            'video.title' => ['required', 'string', 'max:160'],
            'video.url' => ['required', 'string', 'max:500', SafePublicUrl::youtube()],

            'bookingSteps' => ['required', 'array'],
            'bookingSteps.title' => ['required', 'string', 'max:120'],
            'bookingSteps.story' => ['required', 'string', 'max:255'],
            'bookingSteps.cards' => ['required', 'array', 'min:1', 'max:8'],
            'bookingSteps.cards.*.iconKey' => ['required', Rule::in($iconKeys)],
            'bookingSteps.cards.*.title' => ['required', 'string', 'max:80'],
            'bookingSteps.cards.*.body' => ['required', 'string', 'max:255'],

            'activities' => ['required', 'array'],
            'activities.title' => ['required', 'string', 'max:160'],
            'activities.description' => ['required', 'string', 'max:255'],
            'activities.items' => ['required', 'array', 'min:1', 'max:8'],
            'activities.items.*.title' => ['required', 'string', 'max:100'],
            'activities.items.*.body' => ['required', 'string', 'max:255'],
            'activities.items.*.image' => ['required', 'string', 'max:500', SafePublicUrl::image()],

            'rulesSection' => ['required', 'array'],
            'rulesSection.title' => ['required', 'string', 'max:160'],
            'rulesSection.description' => ['required', 'string', 'max:255'],
            'rulesSection.rulesKicker' => ['required', 'string', 'max:80'],
            'rulesSection.rulesTitle' => ['required', 'string', 'max:120'],
            'rulesSection.rulesList' => ['required', 'array', 'min:1', 'max:15'],
            'rulesSection.rulesList.*' => ['required', 'string', 'max:255'],
            'rulesSection.buttonLabel' => ['required', 'string', 'max:60'],

            'letterSection' => ['required', 'array'],
            'letterSection.title' => ['required', 'string', 'max:160'],
            'letterSection.description' => ['required', 'string', 'max:255'],
            'letterSection.formatKicker' => ['required', 'string', 'max:80'],
            'letterSection.formatTitle' => ['required', 'string', 'max:120'],
            'letterSection.uploadNote' => ['required', 'string', 'max:160'],
            'letterSection.buttonLabel' => ['required', 'string', 'max:60'],

            'faq' => ['required', 'array'],
            'faq.title' => ['required', 'string', 'max:160'],
            'faq.description' => ['required', 'string', 'max:255'],

            'cta' => ['required', 'array'],
            'cta.title' => ['required', 'string', 'max:160'],
            'cta.body' => ['required', 'string', 'max:255'],
            'cta.buttonLabel' => ['required', 'string', 'max:60'],
            'cta.backgroundImage' => ['nullable', 'string', 'max:500', SafePublicUrl::image()],

            'footer' => ['required', 'array'],
            'footer.logoSrc' => ['nullable', 'string', 'max:500', SafePublicUrl::image()],
            'footer.logoAlt' => ['nullable', 'string', 'max:120'],
            'footer.scheduleLabel' => ['required', 'string', 'max:80'],
            'footer.scheduleDays' => ['required', 'string', 'max:80'],
            'footer.scheduleHours' => ['required', 'string', 'max:80'],
            'footer.mapUrl' => ['required', 'string', 'max:500', SafePublicUrl::mapLink()],
            'footer.mapEmbedUrl' => ['required', 'string', 'max:500', SafePublicUrl::mapEmbed()],
            'footer.address' => ['required', 'string', 'max:500'],
            'footer.copyright' => ['required', 'string', 'max:255'],

            'floatingContact' => ['required', 'array'],
            'floatingContact.greeting' => ['required', 'string', 'max:255'],
            'floatingContact.topics' => ['required', 'array', 'min:1', 'max:6'],
            'floatingContact.topics.*.label' => ['required', 'string', 'max:60'],
            'floatingContact.topics.*.message' => ['required', 'string', 'max:500'],
        ];
    }
}
