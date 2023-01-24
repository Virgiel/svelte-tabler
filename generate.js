import { emptyDir } from 'https://deno.land/std@0.160.0/fs/mod.ts';
import {
  TextWriter,
  ZipReader,
  HttpReader,
} from 'https://deno.land/x/zipjs@v2.6.50/index.js';

const OUT_DIR = 'ic';
const REGEX = /<svg[^>]*>([\s\S]*?)<\/svg>/;

/// Transform an icon name into a svelte component name
function normalizeName(string) {
  return (
    'Ic' +
    string
      .replace(/(^\w|-\w)/g, letter => letter.toUpperCase())
      .replace(/-/g, '')
  );
}

/// Generate a svelte icon component from a name and svg content
function component(name, content) {
  return `<script>
  export let size = "44px";
  export let color = 'currentColor';
  export let strokeWidth = 1.5;
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  class="icon icon-tabler icon-tabler-${name}"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  stroke={color}
  stroke-width={strokeWidth}
  fill="none"
  stroke-linecap="round"
  stroke-linejoin="round"
>${content}</svg>`;
}

/* ----- Clean state ----- */

await emptyDir(OUT_DIR);

/* ----- Download taler icons ----- */

const release = await (
  await fetch(
    'https://api.github.com/repos/tabler/tabler-icons/releases/latest'
  )
).json();
console.info('Found version ' + release.tag_name);

const zipReader = new ZipReader(
  new HttpReader(release.assets[0].browser_download_url)
);
const entries = await zipReader.getEntries();

/* ----- Generate svelte components ----- */

const list = [];
for (const entry of entries) {
  if (entry.filename.startsWith('svg/')) {
    const svgName = entry.filename.split('/')[1].split('.')[0];
    const componentName = normalizeName(svgName);
    const full = await entry.getData(new TextWriter());
    const [, content] = REGEX.exec(full);
    const path = `./${OUT_DIR}/${svgName}.svelte`;
    await Deno.writeTextFile(path, component(svgName, content));
    list.push([componentName, path]);
  }
}
await zipReader.close();

/* ----- Generate index file ----- */

await Deno.writeTextFile(
  `${OUT_DIR}/index.js`,
  list
    .map(([name, path]) => `export { default as ${name}} from "${path}";`)
    .join('\n')
);

/* ----- Generate type file ----- */

const types = list
  .map(
    ([name]) =>
      `export class ${name} extends SvelteComponentTyped<{\n\tcolor?: string;\n\tsize?: string | number;\n\tstrokeWidth?: string | number;\n}> {}`
  )
  .join('\n');
await Deno.writeTextFile(
  `${OUT_DIR}/index.d.ts`,
  `import { SvelteComponentTyped } from "svelte"\n${types}`
);

console.info(`Processed ${list.length} icons`);

export default release.tag_name;
