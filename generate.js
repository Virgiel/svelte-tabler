import { emptyDir } from 'https://deno.land/std@0.117.0/fs/mod.ts';
import { unZipFromURL } from 'https://deno.land/x/zip@v1.1.0/mod.ts';

const OUT_DIR = 'ic';
const TABLER_DIR = 'tabler';
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
  export let size = 44;
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
await emptyDir(TABLER_DIR);

/* ----- Download taler icons ----- */

const release = await (
  await fetch(
    'https://api.github.com/repos/tabler/tabler-icons/releases/latest'
  )
).json();
console.info('Found version ' + release.tag_name);
await unZipFromURL(release.assets[0].browser_download_url, TABLER_DIR);

/* ----- Generate svelte components ----- */

const list = [];
for await (const icon of Deno.readDir(`${TABLER_DIR}/icons`)) {
  const [svgName] = icon.name.split('.');
  const componentName = normalizeName(svgName);
  const full = await Deno.readTextFile(`${TABLER_DIR}/icons/${icon.name}`);
  const [, content] = REGEX.exec(full);
  const path = `./${OUT_DIR}/${svgName}.svelte`;
  await Deno.writeTextFile(path, component(svgName, content));
  list.push([componentName, path]);
}

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

console.info('Done');
