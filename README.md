# Rahul Kuttappy — Filmmaker Portfolio

Personal portfolio site. Filmmaker, editor, sound design. Based in Bengaluru.

## Stack

Static site, no build step. Open `index.html` and it runs.

- Vanilla HTML, CSS and JavaScript
- [GSAP](https://gsap.com) + ScrollTrigger from CDN for scroll reveals, parallax and count-ups
- Canvas for the cursor trail, the footer plexus network, the dithered audio visualiser and the dithered headline
- Web Audio API for the background track and its frequency analysis

## Layout

```
index.html          Home: hero, works list, stills, brands, reel, contact
about.html          About
work/               One detail page per project
css/                style.css (global), about.css, work.css
js/main.js          All behaviour, page agnostic
assets/             images, video, audio, logo
```

## Running locally

Any static server works, for example:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000

## Notes

Raw source footage and photography live outside the repo and are not tracked.
