# Visualizer sample images

These files are the before/after pictures in `assets/images/visualizer/`. They are fictional scenes, not real homes, and not Pacific Pro Group or Board of Project Stewardship projects.

The public page labels them only as: “Sample — illustrative. Not a Pacific Pro Group project.” That sentence is the only on-page credit. Do not put model names, vendor names, or the word AI on a public page.

## Provenance

Produced 2026-10-11, about 11:31 PM PT. Account balance moved from 59.53 to 53.53 (6.0 credits). Each “after” is an edit of the matching “before,” so the slider is the same scene.

| Delivered file | Source file | How it was made | Credits | Job ID |
| --- | --- | --- | --- | --- |
| `exterior-before.webp` | house-before | GPT Image 2.5 (`gpt_image_2_5`), medium, 1k, 3:2, text-to-image | 0.5 | 6718c0c1-17e1-49ff-af04-ecfa5b8c5eea |
| `exterior-after.webp` | house-after | Nano Banana 2.1 (`nano_banana_2_1`), 1k, 3:2, image edit of house-before | 1.5 | a301e6d6-abdd-4920-9981-0ea3c7975efd |
| `kitchen-before.webp` | kitchen-before | GPT Image 2.5, medium, 1k, 3:2, text-to-image | 0.5 | 84fa2f24-e605-4d97-b87b-72e3ab64e4f8 |
| `kitchen-after.webp` | kitchen-after | Nano Banana 2.1, 1k, 3:2, image edit of kitchen-before | 1.5 | aa340456-baf4-4916-9869-cdd2c0727cb1 |
| `bathroom-before.webp` | bath-before | GPT Image 2.5, medium, 1k, 3:2, text-to-image | 0.5 | a2faf2c9-91e8-4583-a917-02cf697e19a4 |
| `bathroom-after.webp` | bath-after | Nano Banana 2.1, 1k, 3:2, image edit of bath-before | 1.5 | f8c8707b-8fd6-4c50-acd5-f3566f89a3d6 |

Native sizes were 1024×688 for the befores and 1264×848 for the afters. Delivered WebP (quality 86) and JPEG fallbacks (quality 85) are Lanczos-resized to 1600×1075 so each pair lines up in the slider. `exterior-before-800.webp` and `exterior-after-800.webp` are the 800px sources used in the exterior `srcset`.

`tools/make_visualizer_samples.py` still draws the older illustrations and will not overwrite these photographs unless `--drawings` is passed. There is one after image per project type.
