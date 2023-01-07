import { emptyDir, copy } from "https://deno.land/std@0.95.0/fs/mod.ts";
import { Language, minify } from "https://deno.land/x/minifier@v1.1.1/mod.ts";

// clear docs folder or create it if it doesnt exist
await emptyDir("./docs");
// minify html and css into docs
const html = await Deno.readTextFile("./src/index.html");
await minifyAndMoveFile("./docs/index.html", "HTML", html);
const css = await Deno.readTextFile("./src/styles.css");
await minifyAndMoveFile("./docs/styles.css", "CSS", css);
// create js bundle and minify it into docs
const js = new TextDecoder().decode(await Deno.run({
    cmd: ["deno", "bundle", "./src/main.js"],
    stdout: "piped"
}).output());
// NOTE: we manually replace inline-comments,
// as deno.bundle adds inline-comments to the start of its output,
// which minify doesnt remove,
// making the bundle a long comment
await minifyAndMoveFile("./docs/main.js", "JS", js.replace(/^\/\/[^\n\r]+[\n\r]*$/gm, ''));
// minify service-worker,
// replacing version number for cache busting
const sw = await Deno.readTextFile("./src/service-worker.js");
await minifyAndMoveFile("./docs/service-worker.js", "JS", sw.replace('#!#', Date.now()));
// copy images and manifest into docs
copy("./src/manifest.json", "./docs/manifest.json");
copy("./src/images", "./docs/images");

function minifyAndMoveFile(target, language, source) {
    return Deno
        .writeTextFile(
            target,
            minify(
                Language[language],
                source
            )
        );
}