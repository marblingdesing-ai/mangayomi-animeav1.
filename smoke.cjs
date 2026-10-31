// Small, sequential live API check. Does not pretend Node has Mangayomi extractors.
const vm = require('node:vm');
const fs = require('node:fs');
const source = JSON.parse(fs.readFileSync(__dirname + '/anime_index.json'))[0];
const context = vm.createContext({ console,
  MProvider: class { get source() { return source; } },
  Client: class { async get(url, headers) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
    return { statusCode: response.status, body: await response.text() };
  } }
});
const ext = vm.runInContext(fs.readFileSync(__dirname + '/animeav1.js', 'utf8') + '\nnew DefaultExtension()', context);
(async () => {
  const latest = await ext.getLatestUpdates(1);
  const search = await ext.search('naruto', 1, []);
  if (!latest.list.length || !search.list.length) throw Error('Empty live results');
  const detail = await ext.getDetail(search.list[0].link);
  if (!detail.chapters.length) throw Error('No chapters');
  const p = ext.mediaPath(detail.chapters[0].url, true);
  const episode = await ext.request('/anime/' + p.slug + '/' + p.number);
  if (!Array.isArray(episode.embeds)) throw Error('Invalid episode');
  console.log(JSON.stringify({ latest: latest.list.length, search: search.list.length, title: detail.name, chapters: detail.chapters.length, servers: episode.embeds.map(e => e.name), playback: 'NOT TESTED: requires Mangayomi runtime and player' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
