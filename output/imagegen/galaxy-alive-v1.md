# Living galaxy background

Created with the **built-in imagegen tool** for `/2.0`. Original generated images remain in Codex's generated-images directory. The selected artwork is saved in the project as optimized WebP files, with no artificial upscaling.

## Final assets

- [Landscape, 1672 × 941](../../public/galaxy-alive-desktop-v1.webp)
- [Landscape, 1280 × 720](../../public/galaxy-alive-desktop-small-v1.webp)
- [Portrait, 941 × 1672](../../public/galaxy-alive-mobile-v1.webp)
- [Portrait, 640 × 1137](../../public/galaxy-alive-mobile-small-v1.webp)

The browser selects a portrait or landscape composition by viewport shape, then a resolution from the responsive source set. Full-size versions use WebP quality 94; smaller versions use quality 92. The image tool returned the native dimensions above, despite the larger ideal dimensions requested in the prompt.

`GalaxyBackground.tsx` adds a 36-second alternating camera drift and sixteen foreground stars with independent 9–16-second brightness cycles. Scroll parallax runs on a separate parent layer. The pause control, reduced-motion preference, hidden-tab state, and island-entry transition stop ambient movement as appropriate.

## Final desktop prompt

Use case: stylized-concept

Asset type: high-resolution full-viewport galaxy background for an immersive personal portfolio website, behind clickable floating islands.

Primary request: Remake a muddy, indistinct space background as an exceptionally clear, richly detailed, cinematic galaxy. Generate a brand-new landscape image, ideally 3840 x 2160, 16:9.

Scene/backdrop: deep blue-black outer space with one beautifully resolved spiral galaxy, tilted slightly in perspective. A recognizable luminous ivory nucleus at roughly 66% across and 26% down, elegant sweeping spiral arms with intricately defined dusty indigo filaments and restrained pale blue stellar clusters. The galaxy spans the upper third and upper-right half; lower half and left-center remain spacious dark space for foreground islands and cream editorial text. Make this feel like looking through a very clear telescope, with exquisite structure and individual crisp points of starlight at varied natural brightness.

Style/medium: sophisticated photoreal cinematic astronomical artwork; optically sharp, natural depth and high local detail, smooth clean black gradients, no grain. Preserve deep black negative space rather than fog washing over the frame. Fine, readable spiral structure rather than blurry clouds. A restrained warm ivory core complements warm bronze islands; the rest is midnight navy and subtle silver-blue, consistent with an existing dark cosmic site.

Composition/framing: edge-to-edge landscape backdrop only. Main galaxy concentrated in upper center-right; dark left-center for a headline, lower middle-right for a floating island. Leave overscan room at the edges for gentle camera drift. Sparse scattered stars outside the galaxy, most tiny and crisp, just a handful a little brighter. Intentional composition, not a uniformly dense star wallpaper.

Constraints: no text, letters, logos, watermarks, UI, planets, Earth horizon, islands, buildings, spacecraft, rings, black holes, cartoon stars, lens flare, bokeh, motion blur, thick haze, oversaturation, rainbow nebula, excessive bloom, or noisy grain. Render one finished background image.

## Final portrait prompt

Use case: precise-object-edit

Asset type: portrait mobile companion background for the same cosmic portfolio.

Input image: the finished landscape galaxy background, an edit target for composition only.

Primary request: Recompose this same exquisitely detailed galaxy artwork into a tall 9:16 portrait image at the highest available native resolution. Preserve the exact photorealistic astronomical style, clear ivory nucleus, resolved indigo dust lanes, delicate silver-blue stars, deep blue-black negative space and level of sharpness. Do not just crop or zoom the landscape image.

Composition change: the visible spiral galaxy should occupy a graceful diagonal band through the middle-upper right, with its nucleus at approximately 75% across and 37% down. Its arms should span around 85% of the portrait width. Keep the upper-left 30% of the image very dark and sparse for the website headline, and the bottom half mostly dark, spacious stars for a floating island. The galaxy must remain clearly recognizable on a phone, with the nucleus above the foreground island and below the main headline area. Preserve generous black negative space around the galaxy, especially at the bottom. Only the backdrop; no website content.

Constraints: preserve the same galaxy visual identity and restrained palette; change composition for portrait. No text, UI, islands, planets, buildings, spacecraft, horizon, lens flare, blurry haze, noisy grain, watermark or excessive bloom.
