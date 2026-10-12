# Visualizer sample photographs

These files are the demo before/after pictures in `assets/images/visualizer/`. They are stock photographs, not Pacific Pro Group projects, and not photos of a customer's house. The page says so: "Sample — illustrative. Not a Pacific Pro Group project and not a photo of a customer's house."

Each pair uses two different photographs so the slider shows a clear change. They are not a remodel of one house.

License: [Unsplash License](https://unsplash.com/license). The photos may be used, including commercially, without permission. Unsplash does not require attribution. Photo pages are linked below so the source can be checked.

| File | Role | Source image |
| --- | --- | --- |
| `exterior-before.webp` | One-story exterior | [photo-1583608205776-bfd35f0d9f83](https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83) |
| `exterior-after.webp` | Two-story exterior | [photo-1568605114967-8130f3a36994](https://images.unsplash.com/photo-1568605114967-8130f3a36994) |
| `exterior-after-b.webp` | Alternate two-story exterior | [photo-1572120360610-d971b9d7767c](https://images.unsplash.com/photo-1572120360610-d971b9d7767c) |
| `kitchen-before.webp` | Older kitchen | [photo-1565538810643-b5bdb714032a](https://images.unsplash.com/photo-1565538810643-b5bdb714032a) |
| `kitchen-after.webp` | Newer kitchen | [photo-1556909114-f6e7ad7d3136](https://images.unsplash.com/photo-1556909114-f6e7ad7d3136) |
| `kitchen-after-b.webp` | Alternate newer kitchen | [photo-1600489000022-c2086d79f9d4](https://images.unsplash.com/photo-1600489000022-c2086d79f9d4) |
| `bathroom-before.webp` | Tub and shower | [photo-1631889993959-41b4e9c6e3c5](https://images.unsplash.com/photo-1631889993959-41b4e9c6e3c5) |
| `bathroom-after.webp` | Newer bathroom | [photo-1620626011761-996317b8d101](https://images.unsplash.com/photo-1620626011761-996317b8d101) |
| `bathroom-after-b.webp` | Alternate newer bathroom | [photo-1600566752355-35792bedcfea](https://images.unsplash.com/photo-1600566752355-35792bedcfea) |

The image URLs used to download them were `https://images.unsplash.com/{photo-id}`. Files in the repo are 960×640 WebP crops. `tools/make_visualizer_samples.py` still draws the older illustrations and will not overwrite these files unless `--drawings` is passed.
