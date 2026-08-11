# Mason Gallery R2 assets

These files are the source-of-truth backup for the landing-page preview images
served from the `mason-gallery` R2 bucket at `/r2/<filename>`.

| Object key | Dimensions | Subject prompt |
| --- | ---: | --- |
| `interior.webp` | 480 × 640 | Serene vertical interior detail with a sunlit linen curtain, pale plaster wall, light oak chair, and ceramic vessel. |
| `lake.webp` | 640 × 420 | Misty lake shoreline at dawn with still gray-blue water, distant trees, and pale foreground reeds. |
| `flowers.webp` | 500 × 500 | Close-up of pale blush and cream garden flowers against a soft ivory background. |
| `desk.webp` | 640 × 430 | Warm desk still life with an open notebook, mechanical pencil, amber glass, and sculptural stone. |
| `stairwell.webp` | 420 × 700 | Minimal warm-concrete stairwell with a slim black handrail and geometric afternoon shadows. |
| `glass.webp` | 480 × 600 | Faceted glass prism on pale stone, splitting sunlight into a soft rainbow and long shadow. |
| `coast.webp` | 680 × 420 | Dune grass overlooking a quiet slate-blue ocean under a hazy cream sky. |
| `street.webp` | 480 × 620 | Quiet residential street after rain with warm plaster facades and reflections on stone pavement. |

All eight images share this generation direction:

> Cohesive quiet editorial photography for a refined image-viewer landing
> page. Soft natural light, warm ivory and dusty blush with muted sage and
> slate accents, gentle analog film grain, low contrast, subtle tactile detail,
> and a calm modern Japanese-Scandinavian mood. No people, logos, readable
> text, watermark, border, or collage.

The checked-in WebP files are already cropped to the dimensions declared in
`packages/web/src/features/gallery/WebGalleryPage.tsx` and use quality 82.
