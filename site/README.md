# Landing page

Static presentation site for Too Smart To Be Tube: plain HTML, CSS and a small script, with no build step and no
third-party requests (fonts, analytics or CDNs), matching the extension's privacy promise.

- Preview: open `site/index.html` in a browser.
- Deploy: published to GitHub Pages by `.github/workflows/pages.yml` on every change to `site/` on `main`
  (https://iagosaito.github.io/too-smart-to-be-tube/). Being plain files, it also works on any static host.
- Design: a product page for a browser extension. A red hero (the color of the platform it lives in) says what it
  is, "Free Chrome extension for YouTube", next to the real screenshot inside a browser window with the extension's
  icon in the toolbar; the light body below uses short icon cards. It never uses YouTube's logo or name as its own.

## Screenshots

The images in `assets/` are real screenshots of the built extension running on youtube.com (headless Chrome,
logged out, with the extension's storage seeded with demo categories). Every video, thumbnail and avatar comes
from a channel that publishes under a Creative Commons license, and the footer credits them:

| Channel | License |
| --- | --- |
| [Blender](https://www.youtube.com/@BlenderOfficial) | CC BY (set on each video on YouTube) |
| [CS50](https://www.youtube.com/@cs50) | CC BY-NC-SA 4.0 (stated in each video's description) |
| [MIT OpenCourseWare](https://www.youtube.com/@mitocw) | CC BY-NC-SA (stated in each video's description) |
| [Wikipedia](https://www.youtube.com/@Wikipedia) | CC BY (set on each video on YouTube) |
| [Creative Commons](https://www.youtube.com/@creativecommons) | CC BY (only videos that declare it) |

The Videos tab shows exactly the seeded videos, each checked one by one. YouTube Shorts can't carry a license
field, so the Shorts screenshot uses CS50 and Blender, whose licenses cover their published material. When
replacing a screenshot, keep to licensed channels and update the credits.
