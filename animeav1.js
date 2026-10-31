// AnimeAV1 adapter for Mangayomi's JavaScript MProvider runtime.
class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  get supportsLatest() { return true; }
  getHeaders() { return { Referer: 'https://animeav1.com/' }; }
  getFilterList() { return []; }
  getSourcePreferences() { return []; }

  async request(path, emptySearch) {
    const base = (this.source.apiUrl || 'https://animeav1.ahmedrangel.com/api').replace(/\/+$/, '');
    const response = await this.client.get(base + path, { Accept: 'application/json' });
    let body;
    try { body = JSON.parse(response.body); }
    catch (_) { throw new Error('AnimeAV1: la API no devolvió JSON (HTTP ' + response.statusCode + ').'); }
    if (emptySearch && response.statusCode === 404 && body.data &&
        body.data.success === false && /No se han encontrado resultados/.test(body.data.error || '')) {
      return { media: [], hasNextPage: false };
    }
    if (response.statusCode !== 200 || body.success !== true || body.data == null) {
      throw new Error('AnimeAV1: error de API (HTTP ' + response.statusCode + ').');
    }
    return body.data;
  }

  // Avoid URL/DOM browser globals: Mangayomi runs this in QuickJS.
  mediaPath(url, episode) {
    const match = String(url).match(/^(?:https:\/\/animeav1\.com)?\/media\/([a-z0-9-]+)(?:\/(\d+(?:\.\d+)?))?\/?(?:[?#].*)?$/i);
    if (!match || (episode && !match[2])) throw new Error('AnimeAV1: URL de anime o episodio inválida.');
    return { slug: match[1], number: match[2] };
  }

  card(item) {
    if (!item || typeof item.title !== 'string') throw new Error('AnimeAV1: ficha inválida.');
    const slug = this.mediaPath(item.url).slug;
    return { name: item.title, imageUrl: item.cover || '', link: 'https://animeav1.com/media/' + slug };
  }

  // The API has no popularity ranking; browse deliberately shows recent anime.
  async getPopular(page) { return this.getLatestUpdates(page); }

  async getLatestUpdates(page) {
    if (page > 1) return { list: [], hasNextPage: false };
    const data = await this.request('/list/latest-episodes');
    if (!Array.isArray(data)) throw new Error('AnimeAV1: lista de novedades inválida.');
    const seen = new Set();
    const list = [];
    for (const item of data) {
      const card = this.card(item);
      if (!seen.has(card.link)) { seen.add(card.link); list.push(card); }
    }
    return { list: list, hasNextPage: false };
  }

  async search(query, page, filters) {
    if (!String(query).trim()) return this.getPopular(page);
    const data = await this.request('/search?query=' + encodeURIComponent(query) + '&page=' + Math.max(1, Number(page) || 1), true);
    if (!Array.isArray(data.media) || typeof data.hasNextPage !== 'boolean') {
      throw new Error('AnimeAV1: respuesta de búsqueda inválida.');
    }
    return { list: data.media.map(item => this.card(item)), hasNextPage: data.hasNextPage };
  }

  async getDetail(url) {
    const slug = this.mediaPath(url).slug;
    const data = await this.request('/anime/' + encodeURIComponent(slug));
    if (typeof data.title !== 'string' || !Array.isArray(data.episodes)) {
      throw new Error('AnimeAV1: detalle inválido.');
    }
    const status = String(data.status || '').toLowerCase();
    const seen = new Set();
    const chapters = data.episodes.slice().sort((a, b) => b.number - a.number).map(ep => {
      const number = Number(ep.number);
      if (!Number.isFinite(number) || number < 0) throw new Error('AnimeAV1: número de episodio inválido.');
      return { name: 'Episodio ' + number, url: 'https://animeav1.com/media/' + slug + '/' + number };
    }).filter(ep => { if (seen.has(ep.url)) return false; seen.add(ep.url); return true; });
    return {
      name: data.title, link: 'https://animeav1.com/media/' + slug,
      imageUrl: data.cover || '', description: data.synopsis || '',
      genre: Array.isArray(data.genres) ? data.genres : [],
      status: /finalizado|finished|completed/.test(status) ? 1 : /emisi[oó]n|ongoing/.test(status) ? 0 : 5,
      chapters: chapters
    };
  }

  async getVideoList(url) {
    const path = this.mediaPath(url, true);
    const data = await this.request('/anime/' + encodeURIComponent(path.slug) + '/' + path.number);
    if (!Array.isArray(data.embeds)) throw new Error('AnimeAV1: lista de servidores inválida.');
    const videos = [];
    const seen = new Set();
    for (const embed of data.embeds) {
      if (typeof embed.url !== 'string' || !/^https:\/\//i.test(embed.url)) continue;
      let extracted = [];
      try {
        // Match verified host families, never a server's display name alone.
        if (/^https:\/\/(?:www\.)?voe\.sx\//i.test(embed.url) && typeof voeExtractor === 'function') {
          extracted = await voeExtractor(embed.url, 'Voe');
        } else if (/^https:\/\/(?:www\.)?mp4upload\.com\//i.test(embed.url) && typeof mp4UploadExtractor === 'function') {
          extracted = await mp4UploadExtractor(embed.url, this.getHeaders(), 'MP4Upload ', '');
        }
      } catch (_) {
        // A failed host must not prevent trying the other supported hosts.
        console.log('AnimeAV1: falló el extractor de ' + embed.name);
      }
      if (!Array.isArray(extracted)) continue;
      for (const video of extracted) {
        if (!video || typeof video.url !== 'string' || !/^https?:\/\//i.test(video.url) || video.url === embed.url || seen.has(video.url)) continue;
        seen.add(video.url);
        videos.push(Object.assign({}, video, {
          originalUrl: embed.url,
          quality: (embed.type || 'SUB') + ' · ' + (video.quality || embed.name || 'Video')
        }));
      }
    }
    if (!videos.length) throw new Error('AnimeAV1: ningún extractor obtuvo video. Voe/MP4Upload pueden fallar; HLS, UPNShare y Byse todavía no están implementados.');
    return videos;
  }

  async getPageList() { throw new Error('AnimeAV1 es una fuente de anime.'); }
}
