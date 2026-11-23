/* Read ordinary XLSX cells from Excel/WPS, including legacy two-row headers. */
window.FrameWorkbook = (() => {
  const nodes = (parent, name) => Array.from(parent.getElementsByTagNameNS('*', name));
  const yes = value => /^(是|true|1|yes|y)$/i.test(value || '');
  const no = value => /^(否|false|0|no|n)$/i.test(value || '');
  const names = {gallery:'画廊',works:'作品',reference:'参考',tags:'TAG库',home:'首页设置'};
  const resolvePart = (path, base) => new URL(path, 'https://xlsx.invalid/' + base).pathname.slice(1);
  async function parse(bytes, page, sectionName = '') {
    const zip = await JSZip.loadAsync(bytes);
    async function xml(path) {
      const part = zip.file(path);
      if (!part) throw Error('表格缺少工作簿数据，请用 Excel 另存为 .xlsx');
      const doc = new DOMParser().parseFromString(await part.async('string'), 'application/xml');
      if (nodes(doc,'parsererror').length) throw Error('表格数据损坏，请重新保存为 .xlsx');
      return doc;
    }
    const book = await xml('xl/workbook.xml');
    const sheets = nodes(book,'sheet');
    const rels = await xml('xl/_rels/workbook.xml.rels');
    const strings = zip.file('xl/sharedStrings.xml') ? nodes(await xml('xl/sharedStrings.xml'),'si').map(richText) : [];
    function richText(node) { return nodes(node,'t').map(t=>t.textContent).join(''); }
    async function readSheet(name) {
      const sheet=sheets.find(node=>node.getAttribute('name')?.trim()===name);
      if (!sheet) return null;
      const id=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
      const rel=nodes(rels,'Relationship').find(node=>node.getAttribute('Id')===id);
      const doc=await xml(resolvePart(rel.getAttribute('Target'),'xl/workbook.xml'));
    const rows = nodes(doc,'row').map(row => {
      const cells = {};
      for (const c of nodes(row,'c')) {
        const col = c.getAttribute('r')?.replace(/[0-9]/g,'');
        const value = nodes(c,'v')[0]?.textContent || '';
        const type = c.getAttribute('t');
        cells[col] = String(type === 'inlineStr' ? richText(c) : type === 's' ? strings[Number(value)] ?? '' : value).trim();
      }
      return {cells, line:row.getAttribute('r')};
    });
      return rows;
    }
    const navRows=await readSheet('导航');
    const navigation=navRows?.slice(1).filter(r=>r.cells.A).map(({cells})=>[cells.A,cells.B || cells.A,cells.C || '']);
    if (page==='home') {
      const settings=Object.fromEntries(((await readSheet('首页设置'))||[]).map(({cells})=>[cells.A,cells.B]));
      return {site:no(settings.useExcelSettings) ? {} : settings,navigation};
    }
    const simpleRows=await readSheet('素材');
    const legacyVideo=page==='section' && sectionName==='视频';
    const rows=simpleRows || await readSheet(legacyVideo ? '作品' : names[page]);
    if (!rows && page==='section') return {items:[],navigation,warnings:[]};
    if (!rows) throw Error('缺少素材工作表');
    const fields=simpleRows ? {
      栏目:'page',标题:'title',分类:'category',图片链接:'image',提示词:'promptZh',视频链接:'videoUrl',
      英文提示词:'promptEn',说明:'description',标签:'tagsText',日期:'added',精选:'featured',演示:'demo',
      原图:'fullImage',缩略图:'thumbnail',出处:'sourceUrl',封面:'poster',来源策略:'referrerPolicy',ID:'id',是否发布:'published'
    } : FrameFields[legacyVideo ? '作品' : names[page]];
    const codes=new Set(Object.values(fields));
    const legacy=!simpleRows && Object.values(rows[1]?.cells || {}).includes('title');
    const header=rows[legacy ? 1 : 0]?.cells || {};
    if(simpleRows && !header.C && !Object.values(header).includes('分类')) header.C='分类';
    const columns=Object.entries(header).map(([col,label])=>[col,Object.hasOwn(fields,label) ? fields[label] : codes.has(label) ? label : '']);
    if (!columns.some(([,key])=>key==='title')) throw Error('「'+names[page]+'」缺少标题列，请恢复模板表头。');
    const kind = page === 'reference' ? 'references' : page;
    const oldLabels = Object.fromEntries(Object.entries(FrameCategories[kind] || FrameCategories.works).map(([label,key])=>[key,label]));
    const display = value => Object.hasOwn(oldLabels,value) ? oldLabels[value] : value;
    const items = [], warnings = [], ids = new Set();
    for (const {cells,line} of rows.slice(legacy ? 2 : 1)) {
      const row = Object.fromEntries(columns.filter(([,key])=>key).map(([col,key])=>[key,cells[col] || '']));
      if (!Object.values(row).some(Boolean) || no(row.published)) continue;
      const section=(row.page || (legacyVideo ? '作品' : names[page]) || '').replace('TAG 库','TAG库');
      const video=Boolean(row.videoUrl) || ['视频作品','视频','video'].includes(row.type);
      if (page==='section') {
        if (section!==sectionName && !(sectionName==='视频' && section==='作品' && video)) continue;
      } else if (section!==names[page]) continue;
      let problem = '';
      if (!row.title) problem = '缺少标题';
      else if (page === 'tags' ? !(row.promptEn || row.promptZh) : !row.image) problem = page === 'tags' ? '缺少提示词' : '缺少图片链接';
      row.id ||= JSON.stringify([row.title,row.image || row.promptEn || row.promptZh]);
      if (ids.has(row.id)) problem = 'ID 重复，复制新增的行请清空 ID';
      if (problem) { warnings.push('第 '+line+' 行'+problem); continue; }
      ids.add(row.id);
      row.tags = (row.tagsText || '').split(/[,，、\n]+/).map(t=>t.trim()).filter(Boolean);
      row.featured = yes(row.featured); row.demo = yes(row.demo);
      if (/^\d{5}(\.\d+)?$/.test(row.added)) {
        const epoch = yes(nodes(book,'workbookPr')[0]?.getAttribute('date1904')) ? Date.UTC(1904,0,1) : Date.UTC(1899,11,30);
        row.added = new Date(epoch + Math.floor(Number(row.added))*86400000).toISOString().slice(0,10);
      }
      if (page==='works' || page==='section') {
        row.type = ['视频作品','video','视频'].includes(row.type) || row.videoUrl ? 'video' : 'image';
        row.category ||= display(row.type);
      } else if (page==='reference') {
        const [group,...rest] = (display(row.subcategory || row.category) || '未分类').split(/\s*[／/]\s*/);
        row.category = group.trim() || '未分类'; row.subcategory = rest.join(' / ').trim();
      } else row.category = display(row.category) || '未分类';
      if (row.referrerPolicy === '不发送来源') row.referrerPolicy = 'no-referrer';
      items.push(row);
    }
    items.sort((a,b)=>Number(b.featured)-Number(a.featured)||(b.added||'').localeCompare(a.added||''));
    return {items,warnings,navigation};
  }
  return {parse};
})();
