# Inter assets

The original TTF files and `Inter-LICENSE.txt` are retained for native builds.
The WOFF2 files are compressed copies for web, generated with
`fonttools[woff]==4.66.1` (`TTFont`, `font.flavor = "woff2"`, then `font.save`).
No subsetting was applied. The character map, glyph order and horizontal metrics
were compared against the original TTFs after decompression and are identical.

The four web files total 466,500 bytes (TTFs: 1,373,004 bytes before HTTP
compression). Web renders fallback text immediately while loading them; native
startup still waits for the registered TTF font families.
