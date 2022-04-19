import { emptyDir } from 'https://deno.land/std@0.135.0/fs/mod.ts';
import { decompress } from 'https://deno.land/x/zip@v1.2.3/mod.ts';
import { readerFromStreamReader } from 'https://deno.land/std@0.135.0/io/mod.ts';

const OUT_DIR = 'ic';
const REGEX = /<svg[^>]*>([\s\S]*?)<\/svg>/;

async function downloadFile(url, path) {
  const res = await fetch(url);
  const file = await Deno.open(path, {
    create: true,
    write: true,
  });
  const reader = readerFromStreamReader(res.body.getReader());
  await Deno.copy(reader, file);
  file.close();
}

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

const archivePath = await Deno.makeTempFile();
const tablerDir = await Deno.makeTempDir();
const release = await (
  await fetch(
    'https://api.github.com/repos/tabler/tabler-icons/releases/latest'
  )
).json();
console.info('Found version ' + release.tag_name);
await downloadFile(release.assets[0].browser_download_url, archivePath);
await decompress(archivePath, tablerDir);

/* ----- Generate svelte components ----- */

const list = [];
for await (const icon of Deno.readDir(`${tablerDir}/icons`)) {
  const [svgName] = icon.name.split('.');
  const componentName = normalizeName(svgName);
  const full = await Deno.readTextFile(`${tablerDir}/icons/${icon.name}`);
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
