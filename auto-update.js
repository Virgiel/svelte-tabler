
const release = await (
  await fetch(
    'https://api.github.com/repos/tabler/tabler-icons/releases/latest'
  )
).json();
console.info('Found version ' + release.tag_name);