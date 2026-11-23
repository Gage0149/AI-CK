/* FRAME ATELIER — independent static pages, no framework or backend required. */
(() => {
  'use strict';
  const page = document.body.dataset.page;
  const $ = selector => document.querySelector(selector);
  const el = (tag, className = '', value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  };
  const safeImage = value => {
    if (typeof value !== 'string') return './assets/fallback.svg';
    return (/^https:\/\/[^\s]+$/i.test(value) || /^\.\/assets\/(?!.*\.\.)[a-z\d_./-]+$/i.test(value))
      ? value : './assets/fallback.svg';
  };
  const safeVideo = value => typeof value === 'string' && (/^https:\/\/[^\s]+$/i.test(value) || /^\.\/assets\/(?!.*\.\.)[a-z\d_./-]+\.(?:mp4|webm)$/i.test(value)) ? value : '';
  const allGroup = Symbol('all');
  const allLabels = {gallery:'全部灵感',works:'全部作品',reference:'全部参考',tags:'全部 TAG'};
  const readFavorites = () => {
    try { const items = JSON.parse(localStorage.getItem('frame-atelier-favorites') || '[]'); return new Set(Array.isArray(items) ? items : []); }
    catch { return new Set(); }
  };
  const state = {items:[],group:allGroup,sub:allGroup,query:'',favoritesOnly:false,favorites:readFavorites(),chosen:new Set()};
  const favoriteKey = item => (page==='section' ? page+':'+new URLSearchParams(location.search).get('section') : page) + ':' + item.id;
  const isFavorite = item => state.favorites.has(favoriteKey(item));
  const saveFavorites = () => { try { localStorage.setItem('frame-atelier-favorites',JSON.stringify([...state.favorites])); } catch {} };
  let toastTimer;
  const notify = message => {
    const node = $('#toast'); if (!node) return;
    node.textContent = message; node.classList.add('is-visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('is-visible'), 2200);
  };
  async function copy(text) {
    if (!text) { notify('这条内容尚未填写'); return; }
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const field = el('textarea'); field.value = text; field.style.cssText = 'position:fixed;left:-9999px';
        document.body.append(field); field.select();
        if (!document.execCommand('copy')) throw Error('复制失败');
        field.remove();
      }
      notify('已复制到剪贴板');
    } catch { notify('复制受浏览器限制，请手动选择内容'); }
  }
  function updateFavCount() {
    const node = $('#favoriteCount');
    if (node) node.textContent = state.items.filter(isFavorite).length;
    const button = $('#favoriteFilter');
    if (button) { button.classList.toggle('is-on', state.favoritesOnly); button.setAttribute('aria-pressed', String(state.favoritesOnly)); }
  }
  function toggleFavorite(item) {
    const key = favoriteKey(item);
    if (state.favorites.has(key)) state.favorites.delete(key); else state.favorites.add(key);
    saveFavorites(); notify(state.favorites.has(key) ? '已加入收藏' : '已取消收藏');
    render();
  }
  const matches = item => {
    if (state.favoritesOnly && !isFavorite(item)) return false;
    if (state.group !== allGroup && state.group !== item.category) return false;
    if (state.sub !== allGroup && state.sub !== item.subcategory) return false;
    if (!state.query) return true;
    const text = [item.title,item.description,item.promptZh,item.promptEn,item.category,item.subcategory,...(item.tags || [])].join(' ').toLocaleLowerCase();
    return state.query.split(/\s+/).every(term => text.includes(term));
  };
  function filterButton(value, label, count, selected, callback) {
    const button = el('button','filter-chip'+(selected ? ' is-on':''),label);
    button.type = 'button'; button.setAttribute('aria-pressed', String(selected));
    if (count !== undefined) button.append(el('span','chip-count',String(count).padStart(2,'0')));
    button.addEventListener('click',callback);
    return button;
  }
  function renderFilters() {
    const parent = $('#filterBar'); if (!parent) return; parent.replaceChildren();
    function chips(container, items, field, allLabel, selected, select) {
      const counts = new Map();
      for (const item of items) {
        const key = item[field];
        if (key) counts.set(key,(counts.get(key) || 0)+1);
      }
      container.append(filterButton(allGroup,allLabel,items.length,selected === allGroup,()=>select(allGroup)));
      for (const [key,count] of counts) {
        container.append(filterButton(key,key,count,selected === key,()=>select(key)));
      }
    }
    chips(parent,state.items,'category',allLabels[page] || '全部素材',state.group,key=>{
      state.group=key; state.sub=allGroup; render();
    });
    const subParent = $('#subFilterBar');
    if (!subParent) return;
    subParent.replaceChildren();
    const scoped = state.items.filter(item=>state.group===allGroup || item.category===state.group);
    if (scoped.some(item=>item.subcategory)) {
      chips(subParent,scoped,'subcategory','全部细分',state.sub,key=>{state.sub=key;render();});
    }
  }
  function makeImage(item, className = '') {
    const image = el('img',className);
    image.src = safeImage(item.thumbnail || item.image || item.poster);
    image.alt = item.title || '视觉参考';
    image.loading = 'lazy'; image.decoding = 'async';
    if (item.referrerPolicy === 'no-referrer') image.referrerPolicy='no-referrer';
    image.addEventListener('error',() => { if (!image.src.endsWith('/fallback.svg')) image.src='./assets/fallback.svg'; },{once:true});
    return image;
  }
  function makeCard(item,index) {
    const card = el('article','art-card');
    card.style.setProperty('--card-delay', Math.min(index,12)*45+'ms');
    const media = el('button','art-card-media');
    media.type='button'; media.setAttribute('aria-label','查看 '+item.title);
    media.append(makeImage(item,'art-thumb'));
    const overlay = el('span','image-overlay');
    overlay.append(el('span','image-open','查看详情 ↗'));media.append(overlay);
    if (item.type === 'video') media.append(el('span','play-indicator','▶'));
    media.addEventListener('click',()=>openDetail(item));
    const badge = el('span','media-badge',item.demo ? '演示作品' : (item.type === 'video' ? 'MOTION' : 'STILL'));
    media.append(badge); card.append(media);
    const caption = el('div','art-caption');
    const left = el('div','art-caption-main');
    left.append(el('div','card-category', item.subcategory || item.category));
    left.append(el('h3','card-title',item.title));
    if (item.description) left.append(el('p','card-description',item.description));
    caption.append(left);
    const heart = el('button','heart-button'+(isFavorite(item) ? ' is-liked':''),isFavorite(item) ? '♥' : '♡');
    heart.type='button'; heart.title=isFavorite(item) ? '取消收藏':'加入收藏'; heart.setAttribute('aria-label',heart.title);
    heart.addEventListener('click',()=>toggleFavorite(item));
    caption.append(heart);card.append(caption);
    return card;
  }
  const textBlock = (label,text) => {
    const block=el('section','detail-text-block');
    const heading=el('div','detail-text-header');
    heading.append(el('span','',label));
    const action=el('button','copy-mini','复制 ↗');action.type='button';action.addEventListener('click',()=>copy(text));
    heading.append(action);block.append(heading,el('p','',text));
    return block;
  };
  function openDetail(item) {
    const dialog=$('#detailDialog'), body=$('#dialogContent'); if (!dialog||!body) return;
    body.replaceChildren();
    const layout=el('div','detail-layout');
    const visual=el('div','detail-visual');
    if (item.type === 'video' && safeVideo(item.videoUrl)) {
      const video=el('video','detail-video');video.controls=true;video.playsInline=true;video.preload='metadata';
      video.poster=safeImage(item.poster || item.image);video.src=safeVideo(item.videoUrl);
      visual.append(video);
    } else visual.append(makeImage({...item,thumbnail:item.fullImage || item.image || item.poster},'detail-image'));
    const info=el('div','detail-info');
    info.append(el('div','detail-kicker',page.toUpperCase()+' / '+(item.added || 'THE COLLECTION')));
    info.append(el('h2','detail-heading',item.title));
    if (item.description) info.append(el('p','detail-description',item.description));
    if (item.tags && item.tags.length) {
      const tags=el('div','detail-tags'); for(const tag of item.tags) tags.append(el('span','', '#'+tag)); info.append(tags);
    }
    if (item.promptZh) info.append(textBlock('中文提示词',item.promptZh));
    if (item.promptEn) info.append(textBlock('ENGLISH PROMPT',item.promptEn));
    if (item.type==='video' && !safeVideo(item.videoUrl)) info.append(el('p','video-missing','尚未设置视频直链。请在后台填写 HTTPS MP4 / WebM 链接。'));
    if (item.sourceUrl && /^https:\/\//.test(item.sourceUrl)) {
      const anchor=el('a','source-link','查看素材来源 ↗');anchor.href=item.sourceUrl;anchor.target='_blank';anchor.rel='noopener noreferrer';info.append(anchor);
    }
    const favorite=el('button','detail-favorite',isFavorite(item)?'♥ 已收藏':'♡ 收藏这张灵感');
    favorite.type='button';favorite.addEventListener('click',()=>{toggleFavorite(item);favorite.textContent=isFavorite(item)?'♥ 已收藏':'♡ 收藏这张灵感';});
    info.append(favorite);layout.append(visual,info);body.append(layout);
    if (!dialog.open) dialog.showModal();
  }
  function makeTagCard(item) {
    const card=el('article','tag-card');
    if (item.image) {
      const preview=el('button','tag-preview');
      preview.type='button';preview.setAttribute('aria-label','查看 '+item.title);
      preview.append(makeImage(item,'tag-cover'));
      preview.addEventListener('click',()=>openDetail(item));
      card.append(preview);
    }
    const top=el('div','tag-card-top');top.append(el('span','tag-category',item.category));
    const heart=el('button','tag-heart'+(isFavorite(item)?' is-liked':''),isFavorite(item)?'♥':'♡');
    heart.type='button';heart.setAttribute('aria-label',isFavorite(item)?'取消收藏':'收藏 TAG');
    heart.addEventListener('click',()=>toggleFavorite(item));top.append(heart);card.append(top);
    card.append(el('h3','',item.title));
    if(item.promptEn) card.append(el('p','tag-english',item.promptEn));
    if(item.promptZh) card.append(el('p','tag-chinese',item.promptZh));
    if(item.tags?.length) {
      const tags=el('div','tag-list');for(const tag of item.tags.slice(0,5)) tags.append(el('span','', '#'+tag));card.append(tags);
    }
    const actions=el('div','tag-actions');
    const copyEn=el('button','tag-copy','复制 EN ↗'); copyEn.type='button';copyEn.disabled=!item.promptEn;
    copyEn.addEventListener('click',()=>copy(item.promptEn));actions.append(copyEn);
    const copyZh=el('button','tag-copy','复制中文 ↗');copyZh.type='button';copyZh.disabled=!item.promptZh;
    copyZh.addEventListener('click',()=>copy(item.promptZh));actions.append(copyZh);
    const add=el('button','tag-add'+(state.chosen.has(item.id)?' is-added':''),state.chosen.has(item.id)?'已添加 ✓':'添加 +');
    add.type='button';add.setAttribute('aria-pressed',String(state.chosen.has(item.id)));
    add.addEventListener('click',()=>{
      if(state.chosen.has(item.id))state.chosen.delete(item.id);else state.chosen.add(item.id);
      render();
    });actions.append(add);card.append(actions);return card;
  }
  function updateComposer() {
    const chosen=state.items.filter(item => state.chosen.has(item.id));
    const target=$('#combinedPrompt'),count=$('#selectedCount');if(!target)return;
    const text=chosen.map(item => item.promptEn || item.promptZh).filter(Boolean).join(', ');
    target.value=text;count.textContent=String(chosen.length).padStart(2,'0')+' ITEMS';
  }
  function render() {
    renderFilters();updateFavCount();
    const items=state.items.filter(matches);
    const counter=$('#resultsLabel');if(counter)counter.textContent=String(items.length).padStart(2,'0')+' / '+String(state.items.length).padStart(2,'0')+' 个条目';
    const target=page==='tags'?$('#tagGrid'):$('#galleryGrid');
    if(target) {
      target.replaceChildren();
      const chunk=document.createDocumentFragment();
      items.forEach((item,index)=>chunk.append(page==='tags'?makeTagCard(item):makeCard(item,index)));
      target.append(chunk);
    }
    const empty=$('#emptyState');if(empty)empty.hidden=items.length>0;
    if(page==='tags')updateComposer();
  }
  const homeDefaults=page==='home' ? {
    title:document.title,heroTitle:$('#heroTitle').textContent,heroDescription:$('#heroDescription').textContent,heroButtonText:$('#heroButtonText').textContent
  } : {};
  function applyHome(site) {
      document.title=homeDefaults.title;
      site={...homeDefaults,...Object.fromEntries(Object.entries(site).filter(([,v])=>v))};
      $('#homeHero').style.removeProperty('--hero-image');
      if(site.siteName) document.title='首页 · '+site.siteName;
      if(site.heroTitle) $('#heroTitle').textContent=site.heroTitle;
      if(site.heroDescription) $('#heroDescription').textContent=site.heroDescription;
      if(site.heroButtonText) $('#heroButtonText').textContent=site.heroButtonText;
      if(site.heroBackground && safeImage(site.heroBackground)!=='./assets/fallback.svg') {
        // CSS custom-property URLs resolve against site.css (inside /src/).
        const url=site.heroBackground.startsWith('./assets/')?'../'+site.heroBackground.slice(2):site.heroBackground;
        $('#homeHero').style.setProperty('--hero-image','url("'+url.replace(/["\\]/g,'')+'")');
      }
  }
  const category = new URLSearchParams(location.search).get('category');
  const sectionName=new URLSearchParams(location.search).get('section') || '素材';
  const defaultNav=[['首页','首页'],['画廊','画廊'],['作品','作品'],['参考','参考'],['TAG 库','TAG库']];
  const routes=new Map([['首页','index'],['画廊','gallery'],['作品','works'],['参考','reference'],['TAG库','tags']]);
  function updateNavigation(rows) {
    const nav=$('.main-menu'), links=document.createDocumentFragment();
    for (const [label,destination,filter] of rows || defaultNav) {
      const target=destination.replace('TAG 库','TAG库');
      let url;
      if (/^https:\/\//i.test(target)) {
        try {url=new URL(target);} catch {continue;}
      } else {
        const path=routes.get(target) || 'section';
        url=new URL('./'+path+'.html',location.href);
        if (path==='section') url.searchParams.set('section',target);
        if (filter) url.searchParams.set('category',filter);
      }
      const link=el('a','',label);link.href=url.href;
      if (url.href===location.href.split('#')[0] || (page==='home' && target==='首页')) {
        link.classList.add('is-active');link.setAttribute('aria-current','page');
      }
      links.append(link);
    }
    nav.replaceChildren(links);
  }
  let busy=false, version='', loaded=false;
  const status=el('p','sync-status');status.hidden=true;status.setAttribute('role','status');
  $('.site-header').after(status);
  async function sync() {
    if (busy || document.hidden) return;
    if (location.protocol==='file:') {
      status.hidden=false; status.textContent='同步预览请打开已部署的网址，或运行包内的本机预览启动文件。'; return;
    }
    busy=true;
    try {
      const response=await fetch('./content/frame-atelier-content.xlsx',{cache:'no-store'});
      if (!response.ok) throw Error('表格请求返回 HTTP '+response.status);
      const bytes=await response.arrayBuffer();
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).join(',');
      if (loaded && digest===version) {status.hidden=!status.dataset.warning;status.textContent=status.dataset.warning || '';return;}
      const result=await FrameWorkbook.parse(bytes,page,sectionName);
      updateNavigation(result.navigation);
      if (page==='home') applyHome(result.site);
      else {
        if (page==='section') {$('#sectionTitle').textContent=sectionName;document.title=sectionName+' · FRAME ATELIER';}
        state.items=result.items;
        if (!loaded) state.group=category || allGroup;
        else if (!category && !state.items.some(i=>i.category===state.group)) state.group=allGroup;
        if (!state.items.some(i=>i.subcategory===state.sub)) state.sub=allGroup;
        render();
      }
      version=digest;loaded=true;
      status.dataset.warning=(result.warnings || []).slice(0,3).join('；');
      status.textContent=status.dataset.warning;status.hidden=!status.textContent;
    } catch(error) {
      status.hidden=false;status.textContent='Excel 同步失败：'+error.message+'。请检查 content/frame-atelier-content.xlsx；页面稍后会重试。';
    } finally {busy=false;}
  }
  sync();setInterval(sync,30000);
  document.addEventListener('visibilitychange',()=>{if (!document.hidden) sync();});
  $('#searchInput')?.addEventListener('input',event=>{state.query=event.target.value.trim().toLocaleLowerCase();render();});
  $('#favoriteFilter')?.addEventListener('click',()=>{state.favoritesOnly=!state.favoritesOnly;render();});
  $('#closeDialog')?.addEventListener('click',()=>$('#detailDialog').close());
  $('#detailDialog')?.addEventListener('click',event=>{if(event.target===$('#detailDialog'))$('#detailDialog').close();});
  $('#copyCombined')?.addEventListener('click',()=>copy($('#combinedPrompt').value.trim()));
  $('#clearCombined')?.addEventListener('click',()=>{state.chosen.clear();render();notify('已清空拼接板');});

})();
