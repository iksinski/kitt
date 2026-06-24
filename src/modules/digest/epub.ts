import JSZip from 'jszip';

export interface Chapter { id: string; title: string; html: string; }

// Minimal, dependency-light EPUB 3 builder. Hand-rolled so there are no flaky ebook
// libraries; produces a valid reflowable EPUB that Send-to-Kindle accepts.
export async function buildEpub(opts: { title: string; author?: string; chapters: Chapter[]; date: string; images?: Array<{ name: string; data: Buffer }> }): Promise<Buffer> {
  const { title, author = 'kitt', chapters, date, images = [] } = opts;
  const zip = new JSZip();

  // mimetype must be first and stored uncompressed.
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  zip.file('META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);

  for (const c of chapters) {
    zip.file(`OEBPS/${c.id}.xhtml`,
      `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/><title>${esc(c.title)}</title></head>
<body>${c.html}</body></html>`);
  }

  for (const img of images) zip.file(`OEBPS/icons/${img.name}`, img.data);

  zip.file('OEBPS/nav.xhtml',
    `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><meta charset="utf-8"/><title>Contents</title></head>
<body><nav epub:type="toc"><h1>Contents</h1><ol>
${chapters.map((c) => `<li><a href="${c.id}.xhtml">${esc(c.title)}</a></li>`).join('\n')}
</ol></nav></body></html>`);

  zip.file('OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:kitt:daily:${esc(date)}</dc:identifier>
    <dc:title>${esc(title)}</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>${esc(author)}</dc:creator>
    <meta property="dcterms:modified">${date}T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${chapters.map((c) => `<item id="${c.id}" href="${c.id}.xhtml" media-type="application/xhtml+xml"/>`).join('\n    ')}
    ${images.map((img, i) => `<item id="img${i}" href="icons/${img.name}" media-type="image/png"/>`).join('\n    ')}
  </manifest>
  <spine>
    ${chapters.map((c) => `<itemref idref="${c.id}"/>`).join('\n    ')}
  </spine>
</package>`);

  return zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' });
}

export function esc(s: string): string {
  return (s || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' }[c]!));
}
