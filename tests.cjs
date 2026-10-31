const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync(__dirname + '/animeav1.js', 'utf8');
function extension(data, statusCode = 200, extractors = {}) {
  const calls = [];
  const context = vm.createContext({ console, ...extractors,
    MProvider: class { get source() { return {}; } },
    Client: class { async get(url) { calls.push(url); return { statusCode, body: typeof data === 'string' ? data : JSON.stringify(data) }; } }
  });
  const ext = vm.runInContext(code + '\nnew DefaultExtension()', context);
  return { ext, calls };
}
const ok = data => ({ success: true, data });
const media = (slug, number) => ({ title: slug, cover: 'cover', url: 'https://animeav1.com/media/' + slug + (number ? '/' + number : '') });
test('latest strips episode numbers, deduplicates, stops pagination', async () => {
  const { ext, calls } = extension(ok([media('show-2', 3), media('show-2', 2)]));
  const result = await ext.getLatestUpdates(1);
  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].link, 'https://animeav1.com/media/show-2');
  assert.equal(result.hasNextPage, false);
  await ext.getLatestUpdates(2);
  assert.equal(calls.length, 1);
});
test('search encodes query and honors API pagination', async () => {
  const { ext, calls } = extension(ok({ media: [media('show')], hasNextPage: true }));
  assert.equal((await ext.search('a & b', 2)).hasNextPage, true);
  assert.match(calls[0], /query=a%20%26%20b&page=2$/);
});
test('only documented no-results response becomes empty search', async () => {
  const { ext } = extension({ data: { success: false, error: 'No se han encontrado resultados en la búsqueda' } }, 404);
  assert.equal((await ext.search('missing', 1)).list.length, 0);
  await assert.rejects(extension({ message: 'missing route' }, 404).ext.search('x', 1), /HTTP 404/);
  await assert.rejects(extension('<html>', 503).ext.search('x', 1), /no devolvió JSON/);
  await assert.rejects(extension(ok({})).ext.search('x', 1), /inválida/);
});
test('details map status and sort/deduplicate chapters without fake dates', async () => {
  const { ext } = extension(ok({ title: 'Show', status: 'Finalizado', episodes: [{ number: 1 }, { number: 3 }, { number: 3 }] }));
  const result = await ext.getDetail('/media/show');
  assert.equal(result.status, 1);
  assert.equal(result.chapters.length, 2);
  assert.equal(result.chapters[0].url, 'https://animeav1.com/media/show/3');
  assert.equal(result.chapters[0].dateUpload, undefined);
  await assert.rejects(ext.getDetail('https://evil.test/media/show'), /inválida/);
});
test('extractor fallback preserves headers and rejects embed as media', async () => {
  const embeds = [{ name: 'Voe', url: 'https://voe.sx/e/id', type: 'SUB' }, { name: 'MP4Upload', url: 'https://www.mp4upload.com/embed-id.html', type: 'LAT' }];
  const { ext } = extension(ok({ embeds }), 200, {
    voeExtractor: async () => { throw Error('host offline'); },
    mp4UploadExtractor: async () => [{ url: 'https://cdn.example/video.mp4', quality: '720p', headers: { Referer: 'host' } }]
  });
  const videos = await ext.getVideoList('/media/show/1');
  assert.equal(videos.length, 1);
  assert.equal(videos[0].headers.Referer, 'host');
  assert.match(videos[0].quality, /LAT/);
  await assert.rejects(extension(ok({ embeds }), 200, { voeExtractor: async url => [{ url }] }).ext.getVideoList('/media/show/1'), /ningún extractor/);
});
test('unsupported hosts produce explicit error; never returned as playable', async () => {
  const { ext } = extension(ok({ embeds: [{ name: 'HLS', url: 'https://player.zilla-networks.com/play/id' }] }));
  await assert.rejects(ext.getVideoList('/media/show/1'), /ningún extractor/);
});
test('index identifies a JavaScript anime source and existing local source', () => {
  const index = JSON.parse(fs.readFileSync(__dirname + '/anime_index.json'));
  assert.equal(index.length, 1);
  assert.equal(index[0].itemType, 1);
  assert.equal(index[0].sourceCodeLanguage, 1);
  assert.equal(index[0].isManga, false);
  assert.ok(index[0].sourceCodeUrl.endsWith('/animeav1.js'));
});
