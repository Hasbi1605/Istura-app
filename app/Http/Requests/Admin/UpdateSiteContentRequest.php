<?php

namespace App\Http\Requests\Admin;

use App\Rules\SafePublicUrl;
use App\Services\CmsImageService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use JsonException;

class UpdateSiteContentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOperator() ?? false;
    }

    protected function prepareForValidation(): void
    {
        $content = $this->input('content');
        if (! is_string($content)) {
            return;
        }

        try {
            $decoded = json_decode($content, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return;
        }

        if (is_array($decoded)) {
            $this->merge($decoded);
        }
    }

    public function rules(): array
    {
        $iconKeys = ['clock', 'file-check', 'message-circle', 'calendar', 'pen', 'upload', 'map-pin', 'image'];
        $imageRules = [
            'file',
            'image',
            'mimes:jpg,jpeg,png,webp',
            'max:5120',
            'dimensions:max_width='.CmsImageService::MAX_INPUT_WIDTH.',max_height='.CmsImageService::MAX_INPUT_HEIGHT,
        ];

        return [
            'content' => ['sometimes', 'string', 'json', 'max:200000'],
            'navLogo' => ['sometimes', ...$imageRules],
            'footerLogo' => ['sometimes', ...$imageRules],
            'ctaBackground' => ['sometimes', ...$imageRules],
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
            'activityImages' => ['sometimes', 'array', 'max:8'],
            'activityImages.*' => $imageRules,

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

            'openBanner' => ['sometimes', 'array'],
            'openBanner.tickerText' => ['sometimes', 'string', 'max:500'],

            'bookingWizard' => ['sometimes', 'array'],
            'bookingWizard.steps' => ['required_with:bookingWizard', 'array', 'size:8'],
            'bookingWizard.steps.*.title' => ['required', 'string', 'max:80'],
            'bookingWizard.steps.*.helper' => ['required', 'string', 'max:255'],
            'bookingWizard.steps.*.miky' => ['required', 'string', 'max:255'],
            'bookingWizard.preparation' => ['required_with:bookingWizard', 'array'],
            'bookingWizard.preparation.items' => ['required_with:bookingWizard.preparation', 'array', 'min:1', 'max:6'],
            'bookingWizard.preparation.items.*' => ['required', 'string', 'max:80'],
            'bookingWizard.preparation.scheduleLinkLabel' => ['required_with:bookingWizard.preparation', 'string', 'max:48'],
            'bookingWizard.preparation.letterLinkLabel' => ['required_with:bookingWizard.preparation', 'string', 'max:48'],
            'bookingWizard.fields' => ['required_with:bookingWizard', 'array'],
            'bookingWizard.fields.contactNameLabel' => ['required_with:bookingWizard.fields', 'string', 'max:80'],
            'bookingWizard.fields.nikLabel' => ['required_with:bookingWizard.fields', 'string', 'max:80'],
            'bookingWizard.fields.whatsappLabel' => ['required_with:bookingWizard.fields', 'string', 'max:80'],
            'bookingWizard.fields.whatsappHelper' => ['required_with:bookingWizard.fields', 'string', 'max:120'],
            'bookingWizard.fields.institutionLabel' => ['required_with:bookingWizard.fields', 'string', 'max:80'],
            'bookingWizard.fields.groupSizeLabel' => ['required_with:bookingWizard.fields', 'string', 'max:80'],
            'bookingWizard.schedule' => ['required_with:bookingWizard', 'array'],
            'bookingWizard.schedule.timeTitle' => ['required_with:bookingWizard.schedule', 'string', 'max:80'],
            'bookingWizard.schedule.emptyDateLabel' => ['required_with:bookingWizard.schedule', 'string', 'max:120'],
            'bookingWizard.schedule.emptySlotLabel' => ['required_with:bookingWizard.schedule', 'string', 'max:120'],
            'bookingWizard.schedule.legendLabel' => ['required_with:bookingWizard.schedule', 'string', 'max:48'],
            'bookingWizard.schedule.largeGroupTitle' => ['required_with:bookingWizard.schedule', 'string', 'max:80'],
            'bookingWizard.schedule.largeGroupBody' => ['required_with:bookingWizard.schedule', 'string', 'max:500'],
            'bookingWizard.schedule.largeGroupActionLabel' => ['required_with:bookingWizard.schedule', 'string', 'max:48'],
            'bookingWizard.upload' => ['required_with:bookingWizard', 'array'],
            'bookingWizard.upload.readyLabel' => ['required_with:bookingWizard.upload', 'string', 'max:80'],
            'bookingWizard.upload.emptyTitle' => ['required_with:bookingWizard.upload', 'string', 'max:80'],
            'bookingWizard.upload.selectedTitle' => ['required_with:bookingWizard.upload', 'string', 'max:80'],
            'bookingWizard.upload.helper' => ['required_with:bookingWizard.upload', 'string', 'max:160'],
            'bookingWizard.upload.chooseLabel' => ['required_with:bookingWizard.upload', 'string', 'max:48'],
            'bookingWizard.upload.replaceLabel' => ['required_with:bookingWizard.upload', 'string', 'max:48'],
            'bookingWizard.agreementText' => ['required_with:bookingWizard', 'string', 'max:500'],
            'bookingWizard.successTitle' => ['required_with:bookingWizard', 'string', 'max:120'],
            'bookingWizard.successMessage' => ['required_with:bookingWizard', 'string', 'max:500'],
            'bookingWizard.actions' => ['required_with:bookingWizard', 'array'],
            'bookingWizard.actions.backLabel' => ['required_with:bookingWizard.actions', 'string', 'max:48'],
            'bookingWizard.actions.nextLabel' => ['required_with:bookingWizard.actions', 'string', 'max:48'],
            'bookingWizard.actions.submitLabel' => ['required_with:bookingWizard.actions', 'string', 'max:48'],
            'bookingWizard.actions.homeLabel' => ['required_with:bookingWizard.actions', 'string', 'max:80'],

            'feedbackWizard' => ['sometimes', 'array'],
            'feedbackWizard.intro' => ['required_with:feedbackWizard', 'string', 'max:255'],
            'feedbackWizard.steps' => ['required_with:feedbackWizard', 'array'],
            'feedbackWizard.steps.rating' => ['required_with:feedbackWizard.steps', 'array'],
            'feedbackWizard.steps.rating.title' => ['required_with:feedbackWizard.steps.rating', 'string', 'max:80'],
            'feedbackWizard.steps.rating.bubbleTitle' => ['required_with:feedbackWizard.steps.rating', 'string', 'max:80'],
            'feedbackWizard.steps.rating.bubbleEmpty' => ['required_with:feedbackWizard.steps.rating', 'string', 'max:255'],
            'feedbackWizard.steps.rating.bubbleLow' => ['required_with:feedbackWizard.steps.rating', 'string', 'max:255'],
            'feedbackWizard.steps.rating.bubbleNeutral' => ['required_with:feedbackWizard.steps.rating', 'string', 'max:255'],
            'feedbackWizard.steps.rating.bubbleHigh' => ['required_with:feedbackWizard.steps.rating', 'string', 'max:255'],
            'feedbackWizard.steps.visit' => ['required_with:feedbackWizard.steps', 'array'],
            'feedbackWizard.steps.visit.title' => ['required_with:feedbackWizard.steps.visit', 'string', 'max:80'],
            'feedbackWizard.steps.visit.bubbleTitle' => ['required_with:feedbackWizard.steps.visit', 'string', 'max:80'],
            'feedbackWizard.steps.visit.bubbleEmpty' => ['required_with:feedbackWizard.steps.visit', 'string', 'max:255'],
            'feedbackWizard.steps.visit.bubbleDone' => ['required_with:feedbackWizard.steps.visit', 'string', 'max:255'],
            'feedbackWizard.steps.details' => ['required_with:feedbackWizard.steps', 'array'],
            'feedbackWizard.steps.details.title' => ['required_with:feedbackWizard.steps.details', 'string', 'max:80'],
            'feedbackWizard.steps.details.bubbleTitle' => ['required_with:feedbackWizard.steps.details', 'string', 'max:80'],
            'feedbackWizard.steps.details.bubbleEmpty' => ['required_with:feedbackWizard.steps.details', 'string', 'max:255'],
            'feedbackWizard.steps.details.bubbleHighlightsEmpty' => ['required_with:feedbackWizard.steps.details', 'string', 'max:255'],
            'feedbackWizard.steps.details.bubbleDone' => ['required_with:feedbackWizard.steps.details', 'string', 'max:255'],
            'feedbackWizard.steps.comment' => ['required_with:feedbackWizard.steps', 'array'],
            'feedbackWizard.steps.comment.title' => ['required_with:feedbackWizard.steps.comment', 'string', 'max:80'],
            'feedbackWizard.steps.comment.bubbleTitle' => ['required_with:feedbackWizard.steps.comment', 'string', 'max:80'],
            'feedbackWizard.steps.comment.bubbleEmpty' => ['required_with:feedbackWizard.steps.comment', 'string', 'max:255'],
            'feedbackWizard.steps.comment.bubbleDone' => ['required_with:feedbackWizard.steps.comment', 'string', 'max:255'],
            'feedbackWizard.fields' => ['required_with:feedbackWizard', 'array'],
            'feedbackWizard.fields.visitorNameLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:80'],
            'feedbackWizard.fields.visitorNamePlaceholder' => ['required_with:feedbackWizard.fields', 'string', 'max:120'],
            'feedbackWizard.fields.genderLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:80'],
            'feedbackWizard.fields.genderPlaceholder' => ['required_with:feedbackWizard.fields', 'string', 'max:80'],
            'feedbackWizard.fields.genderMaleLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:48'],
            'feedbackWizard.fields.genderFemaleLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:48'],
            'feedbackWizard.fields.ageLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:80'],
            'feedbackWizard.fields.agePlaceholder' => ['required_with:feedbackWizard.fields', 'string', 'max:80'],
            'feedbackWizard.fields.originLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:80'],
            'feedbackWizard.fields.originPlaceholder' => ['required_with:feedbackWizard.fields', 'string', 'max:120'],
            'feedbackWizard.fields.ratingLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:80'],
            'feedbackWizard.fields.bookingEaseLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:100'],
            'feedbackWizard.fields.serviceLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:100'],
            'feedbackWizard.fields.guideQualityLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:120'],
            'feedbackWizard.fields.facilityComfortLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:120'],
            'feedbackWizard.fields.visitedBeforeLegend' => ['required_with:feedbackWizard.fields', 'string', 'max:160'],
            'feedbackWizard.fields.visitedBeforeFirstLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:80'],
            'feedbackWizard.fields.visitedBeforeReturnLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:80'],
            'feedbackWizard.fields.discoverySourceLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:160'],
            'feedbackWizard.fields.discoverySourcePlaceholder' => ['required_with:feedbackWizard.fields', 'string', 'max:80'],
            'feedbackWizard.fields.discoverySourceOtherLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:100'],
            'feedbackWizard.fields.discoverySourceOtherPlaceholder' => ['required_with:feedbackWizard.fields', 'string', 'max:120'],
            'feedbackWizard.fields.recommendLegend' => ['required_with:feedbackWizard.fields', 'string', 'max:160'],
            'feedbackWizard.fields.recommendLowLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:48'],
            'feedbackWizard.fields.recommendHighLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:48'],
            'feedbackWizard.fields.highlightsLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:80'],
            'feedbackWizard.fields.improvementsLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:100'],
            'feedbackWizard.fields.commentLabel' => ['required_with:feedbackWizard.fields', 'string', 'max:100'],
            'feedbackWizard.fields.commentPlaceholder' => ['required_with:feedbackWizard.fields', 'string', 'max:180'],
            'feedbackWizard.fields.publishConsent' => ['required_with:feedbackWizard.fields', 'string', 'max:255'],
            'feedbackWizard.fields.ratingLabels' => ['required_with:feedbackWizard.fields', 'array', 'size:6'],
            'feedbackWizard.fields.ratingLabels.*' => ['required', 'string', 'max:48'],
            'feedbackWizard.options' => ['required_with:feedbackWizard', 'array'],
            'feedbackWizard.options.discoverySources' => ['required_with:feedbackWizard.options', 'array', 'size:6'],
            'feedbackWizard.options.discoverySources.*.value' => [
                'required',
                'string',
                'distinct',
                Rule::in(['social_media', 'friends_family', 'school_institution', 'web_search', 'previous_visit', 'other']),
            ],
            'feedbackWizard.options.discoverySources.*.label' => ['required', 'string', 'max:80'],
            'feedbackWizard.options.highlights' => ['required_with:feedbackWizard.options', 'array', 'min:1', 'max:12'],
            'feedbackWizard.options.highlights.*' => ['required', 'string', 'max:80'],
            'feedbackWizard.options.improvements' => ['required_with:feedbackWizard.options', 'array', 'min:1', 'max:12'],
            'feedbackWizard.options.improvements.*' => ['required', 'string', 'max:80'],
            'feedbackWizard.gates' => ['required_with:feedbackWizard', 'array'],
            'feedbackWizard.gates.loadingTitle' => ['required_with:feedbackWizard.gates', 'string', 'max:80'],
            'feedbackWizard.gates.loadingMessage' => ['required_with:feedbackWizard.gates', 'string', 'max:255'],
            'feedbackWizard.gates.invalidTitle' => ['required_with:feedbackWizard.gates', 'string', 'max:80'],
            'feedbackWizard.gates.invalidMessage' => ['required_with:feedbackWizard.gates', 'string', 'max:255'],
            'feedbackWizard.gates.alreadySubmittedTitle' => ['required_with:feedbackWizard.gates', 'string', 'max:80'],
            'feedbackWizard.gates.alreadySubmittedMessage' => ['required_with:feedbackWizard.gates', 'string', 'max:255'],
            'feedbackWizard.gates.unavailableTitle' => ['required_with:feedbackWizard.gates', 'string', 'max:80'],
            'feedbackWizard.gates.unavailableMessage' => ['required_with:feedbackWizard.gates', 'string', 'max:255'],
            'feedbackWizard.gates.restrictedLoadingTitle' => ['required_with:feedbackWizard.gates', 'string', 'max:80'],
            'feedbackWizard.gates.restrictedTitle' => ['required_with:feedbackWizard.gates', 'string', 'max:80'],
            'feedbackWizard.gates.restrictedLoadingMessage' => ['required_with:feedbackWizard.gates', 'string', 'max:255'],
            'feedbackWizard.gates.restrictedMessage' => ['required_with:feedbackWizard.gates', 'string', 'max:255'],
            'feedbackWizard.gates.busyLabel' => ['required_with:feedbackWizard.gates', 'string', 'max:48'],
            'feedbackWizard.success' => ['required_with:feedbackWizard', 'array'],
            'feedbackWizard.success.eyebrow' => ['required_with:feedbackWizard.success', 'string', 'max:48'],
            'feedbackWizard.success.title' => ['required_with:feedbackWizard.success', 'string', 'max:100'],
            'feedbackWizard.success.message' => ['required_with:feedbackWizard.success', 'string', 'max:500'],
            'feedbackWizard.actions' => ['required_with:feedbackWizard', 'array'],
            'feedbackWizard.actions.backLabel' => ['required_with:feedbackWizard.actions', 'string', 'max:48'],
            'feedbackWizard.actions.nextLabel' => ['required_with:feedbackWizard.actions', 'string', 'max:48'],
            'feedbackWizard.actions.submitLabel' => ['required_with:feedbackWizard.actions', 'string', 'max:48'],
            'feedbackWizard.actions.homeLabel' => ['required_with:feedbackWizard.actions', 'string', 'max:80'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                foreach (['navLogo', 'footerLogo', 'ctaBackground'] as $attribute) {
                    $image = $this->file($attribute);
                    if ($image instanceof UploadedFile) {
                        $this->validateImagePixels($validator, $attribute, $image);
                    }
                }

                $items = $this->input('activities.items', []);
                $images = $this->file('activityImages', []);
                if (! is_array($images)) {
                    return;
                }

                foreach ($images as $index => $image) {
                    $attribute = "activityImages.{$index}";
                    if (! is_array($items) || ! array_key_exists((int) $index, $items)) {
                        $validator->errors()->add($attribute, 'Panel aktivitas untuk gambar ini tidak ditemukan.');

                        continue;
                    }

                    if (! $image instanceof UploadedFile || ! $image->isValid()) {
                        continue;
                    }

                    $this->validateImagePixels($validator, $attribute, $image);
                }
            },
        ];
    }

    private function validateImagePixels(Validator $validator, string $attribute, UploadedFile $image): void
    {
        if (! $image->isValid()) {
            return;
        }

        $realPath = $image->getRealPath();
        $dimensions = is_string($realPath) && $realPath !== '' ? @getimagesize($realPath) : false;
        if (! is_array($dimensions)) {
            $validator->errors()->add($attribute, 'Gambar tidak dapat dibaca.');

            return;
        }

        $width = (int) ($dimensions[0] ?? 0);
        $height = (int) ($dimensions[1] ?? 0);
        if ($width < 1 || $height < 1 || $height > intdiv(CmsImageService::MAX_INPUT_PIXELS, max(1, $width))) {
            $validator->errors()->add($attribute, 'Total piksel gambar terlalu besar.');
        }
    }
}
